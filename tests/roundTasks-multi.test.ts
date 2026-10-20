import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_WATERMARK_TASKS,
  ROUND_TASKS,
  ROUND_TASKS_STORAGE_KEY,
  ROUND_TASK_STORAGE_KEY,
  buildFileName,
  buildShareText,
  captureOperation,
  loadRoundTasks,
  normalizeTaskIds,
  operationFileName,
  operationShareText,
  roundTaskFileToken,
  roundTaskLabels,
  roundTasksWatermarkLine,
  saveRoundTasks,
} from '../src/roundTasks';

// localStorage minimo para las pruebas (jsdom no esta disponible en termux).
class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

const IDS = ROUND_TASKS.map(t => t.id);

describe('normalizeTaskIds - seleccion multiple', () => {
  it('acepta un array de ids validos', () => {
    expect(normalizeTaskIds([IDS[0], IDS[1]])).toEqual([IDS[0], IDS[1]]);
  });

  it('conserva el ORDEN DEL CATALOGO, no el de seleccion', () => {
    expect(normalizeTaskIds([IDS[3], IDS[1]])).toEqual([IDS[1], IDS[3]]);
  });

  it('elimina ids desconocidos', () => {
    expect(normalizeTaskIds([IDS[0], 'no-existe', 'otro'])).toEqual([IDS[0]]);
  });

  it('elimina duplicados', () => {
    expect(normalizeTaskIds([IDS[0], IDS[0], IDS[1]])).toEqual([IDS[0], IDS[1]]);
  });

  it('acepta un id suelto (retrocompatible con el formato anterior)', () => {
    expect(normalizeTaskIds(IDS[2])).toEqual([IDS[2]]);
  });

  it('acepta una lista separada por comas', () => {
    expect(normalizeTaskIds(`${IDS[0]},${IDS[1]}`)).toEqual([IDS[0], IDS[1]]);
  });

  it('devuelve una lista vacia ante null, undefined o valores no(array)', () => {
    expect(normalizeTaskIds(null)).toEqual([]);
    expect(normalizeTaskIds(undefined)).toEqual([]);
    expect(normalizeTaskIds(42)).toEqual([]);
    expect(normalizeTaskIds({})).toEqual([]);
    expect(normalizeTaskIds('')).toEqual([]);
  });
});

describe('persistencia de la seleccion multiple', () => {
  it('saveRoundTasks persiste y loadRoundTasks la recupera', () => {
    saveRoundTasks([IDS[0], IDS[2]]);
    expect(loadRoundTasks()).toEqual([IDS[0], IDS[2]]);
  });

  it('guarda un ARRAY JSON en la clave nueva', () => {
    saveRoundTasks([IDS[0], IDS[2]]);
    expect(localStorage.getItem(ROUND_TASKS_STORAGE_KEY)).toBe(JSON.stringify([IDS[0], IDS[2]]));
  });

  it('saveRoundTasks([]) borra la seleccion y ambas claves', () => {
    saveRoundTasks([IDS[0]]);
    saveRoundTasks([]);
    expect(localStorage.getItem(ROUND_TASKS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ROUND_TASK_STORAGE_KEY)).toBeNull();
    expect(loadRoundTasks()).toEqual([]);
  });

  it('la clave legacy se migra al formato nuevo al leerla', () => {
    localStorage.setItem(ROUND_TASK_STORAGE_KEY, IDS[1]);
    expect(loadRoundTasks()).toEqual([IDS[1]]);
    // La migracion escribe la clave nueva y elimina la vieja.
    expect(localStorage.getItem(ROUND_TASKS_STORAGE_KEY)).toBe(JSON.stringify([IDS[1]]));
    expect(localStorage.getItem(ROUND_TASK_STORAGE_KEY)).toBeNull();
  });

  it('la clave nueva tiene prioridad sobre la legacy', () => {
    localStorage.setItem(ROUND_TASKS_STORAGE_KEY, JSON.stringify([IDS[0], IDS[3]]));
    localStorage.setItem(ROUND_TASK_STORAGE_KEY, IDS[4]);
    expect(loadRoundTasks()).toEqual([IDS[0], IDS[3]]);
  });

  it('un JSON corrupto en la clave nueva no rompe la app', () => {
    localStorage.setItem(ROUND_TASKS_STORAGE_KEY, '{no es json');
    expect(loadRoundTasks()).toEqual([]);
  });

  it('un valor corrupto en la clave legacy se descarta', () => {
    localStorage.setItem(ROUND_TASK_STORAGE_KEY, 'id-corrupto');
    expect(loadRoundTasks()).toEqual([]);
  });

  it('un array corrupto en la clave nueva se normaliza a vacio', () => {
    localStorage.setItem(ROUND_TASKS_STORAGE_KEY, JSON.stringify(['nope', 42, null]));
    expect(loadRoundTasks()).toEqual([]);
  });

  it('la seleccion vacia es valida (ronda generica)', () => {
    saveRoundTasks([]);
    expect(loadRoundTasks()).toEqual([]);
  });
});

describe('roundTaskLabels - etiquetas de la seleccion', () => {
  it('devuelve las etiquetas en orden de catalogo', () => {
    expect(roundTaskLabels([IDS[2], IDS[0]])).toEqual([
      ROUND_TASKS[0].label,
      ROUND_TASKS[2].label,
    ]);
  });

  it('devuelve una lista vacia sin seleccion', () => {
    expect(roundTaskLabels([])).toEqual([]);
    expect(roundTaskLabels(null)).toEqual([]);
  });
});

describe('roundTasksWatermarkLine - linea de actividades', () => {
  it('una sola actividad conserva el formato anterior', () => {
    expect(roundTasksWatermarkLine([IDS[0]])).toBe(ROUND_TASKS[0].label.toUpperCase());
  });

  it('varias actividades se unen con " + "', () => {
    expect(roundTasksWatermarkLine([IDS[0], IDS[1]]))
      .toBe(`${ROUND_TASKS[0].label.toUpperCase()} + ${ROUND_TASKS[1].label.toUpperCase()}`);
  });

  it('resume como "+N" mas de MAX_WATERMARK_TASKS actividades', () => {
    const line = roundTasksWatermarkLine(IDS);
    expect(line).not.toBeNull();
    expect(line!.endsWith(`+${IDS.length - MAX_WATERMARK_TASKS}`)).toBe(true);
  });

  it('devuelve null sin actividades', () => {
    expect(roundTasksWatermarkLine([])).toBeNull();
    expect(roundTasksWatermarkLine(null)).toBeNull();
  });
});

describe('tokens de archivo', () => {
  it('el token de una actividad es su id normalizado', () => {
    expect(roundTaskFileToken(IDS[0])).toBe(IDS[0]);
  });

  it('un id desconocido no produce token', () => {
    expect(roundTaskFileToken('no-existe')).toBeNull();
  });

  it('varias actividades producen tokens unidos por "-"', () => {
    const name = buildFileName({ taskIds: [IDS[0], IDS[1]], timestamp: 1730000000000 });
    expect(name).toBe(`timemark_${IDS[0]}-${IDS[1]}_1730000000000.jpg`);
  });
});

describe('buildShareText con varias actividades', () => {
  it('antepone TODAS las actividades al texto', () => {
    expect(buildShareText({ taskIds: [IDS[0], IDS[1]], address: 'Av. Siempre Viva 742', city: 'Buenos Aires', single: true }))
      .toBe(`${ROUND_TASKS[0].label} + ${ROUND_TASKS[1].label} · Ronda · Av. Siempre Viva 742, Buenos Aires`);
  });

  it('omite el prefijo cuando no hay actividades', () => {
    expect(buildShareText({ taskIds: [], address: 'Av. Siempre Viva 742', city: 'Buenos Aires', single: true }))
      .toBe('Ronda · Av. Siempre Viva 742, Buenos Aires');
  });
});

describe('captureOperation con varias actividades', () => {
  it('captura la seleccion completa, su etiqueta resumida y su token', () => {
    const op = captureOperation([IDS[0], IDS[1]], 1730000000000);
    expect(op.taskIds).toEqual([IDS[0], IDS[1]]);
    expect(op.taskId).toBe(IDS[0]);
    expect(op.taskLabels).toEqual([ROUND_TASKS[0].label, ROUND_TASKS[1].label]);
    expect(op.taskLabel).toBe(`${ROUND_TASKS[0].label} + ${ROUND_TASKS[1].label}`);
    expect(op.taskToken).toBe(`${IDS[0]}-${IDS[1]}`);
    expect(op.timestamp).toBe(1730000000000);
  });

  it('la seleccion capturada es INMUTABLE', () => {
    const ids = [IDS[0], IDS[1]];
    const op = captureOperation(ids, 1730000000000);
    ids.push(IDS[2]);
    expect(op.taskIds).toEqual([IDS[0], IDS[1]]);
    expect(() => { (op.taskIds as string[]).push(IDS[2]); }).toThrow();
  });

  it('sin actividades captura null en los campos de etiqueta y token', () => {
    const op = captureOperation([], 1730000000000);
    expect(op.taskIds).toEqual([]);
    expect(op.taskId).toBeNull();
    expect(op.taskLabel).toBeNull();
    expect(op.taskToken).toBeNull();
    expect(op.taskLabels).toEqual([]);
  });

  it('el snapshot NO cambia aunque la seleccion global cambie despues', () => {
    const op = captureOperation([IDS[0]], 1730000000000);
    const otro = captureOperation([IDS[1]], 1730000000001);
    expect(op.taskIds).toEqual([IDS[0]]);
    expect(otro.taskIds).toEqual([IDS[1]]);
    expect(operationFileName(op)).not.toBe(operationFileName(otro));
  });

  it('nombre, texto y marca de agua de una operacion comparten la MISMA seleccion', () => {
    const op = captureOperation([IDS[0], IDS[1]], 1730000000000);
    const name = operationFileName(op);
    const text = operationShareText(op, { address: 'Calle 1', city: 'CABA', single: true });
    const line = roundTasksWatermarkLine(op.taskIds);

    expect(name).toContain(`_${IDS[0]}-${IDS[1]}_`);
    expect(text).toContain(`${ROUND_TASKS[0].label} + ${ROUND_TASKS[1].label}`);
    expect(line).toBe(`${ROUND_TASKS[0].label.toUpperCase()} + ${ROUND_TASKS[1].label.toUpperCase()}`);
  });

  it('el nombre del lote mantiene token y marca de tiempo', () => {
    const op = captureOperation([IDS[0], IDS[1]], 1730000000000);
    expect(operationFileName(op, { index: 1 })).toBe(`timemark_${IDS[0]}-${IDS[1]}_1730000000000_1.jpg`);
    expect(operationFileName(op, { index: 2 })).toBe(`timemark_${IDS[0]}-${IDS[1]}_1730000000000_2.jpg`);
  });
});
