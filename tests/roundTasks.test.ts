import { describe, it, expect, beforeEach } from 'vitest';
import {
  ROUND_TASKS,
  buildFileName,
  buildShareText,
  captureOperation,
  loadRoundTask,
  normalizeTaskId,
  operationFileName,
  operationShareText,
  roundTaskFileToken,
  roundTaskLabel,
  roundTaskWatermarkLine,
  saveRoundTask,
  slugifyFileToken,
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

// Replica de la logica de selectRoundTask en App.tsx.
function selectRoundTask(taskId: string | null) {
  saveRoundTask(normalizeTaskId(taskId));
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('catalogo de actividades de ronda', () => {
  it('expone un catalogo no vacio con ids unicos', () => {
    expect(ROUND_TASKS.length).toBeGreaterThan(0);
    const ids = ROUND_TASKS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada actividad tiene label y descripcion no vacias', () => {
    for (const t of ROUND_TASKS) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.desc.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeTaskId', () => {
  it('acepta un id valido del catalogo', () => {
    const first = ROUND_TASKS[0];
    expect(normalizeTaskId(first.id)).toBe(first.id);
  });

  it('rechaza ids desconocidos, null y undefined', () => {
    expect(normalizeTaskId('no-existe')).toBeNull();
    expect(normalizeTaskId(null)).toBeNull();
    expect(normalizeTaskId(undefined)).toBeNull();
    expect(normalizeTaskId('')).toBeNull();
  });
});

describe('persistencia de la actividad seleccionada', () => {
  it('saveRoundTask persiste y loadRoundTask la recupera', () => {
    const id = ROUND_TASKS[1].id;
    saveRoundTask(id);
    expect(loadRoundTask()).toBe(id);
  });

  it('saveRoundTask(null) borra la seleccion', () => {
    saveRoundTask(ROUND_TASKS[0].id);
    saveRoundTask(null);
    expect(loadRoundTask()).toBeNull();
  });

  it('loadRoundTask ignora un valor corrupto persistido', () => {
    localStorage.setItem('timemark_round_task', 'id-corrupto');
    expect(loadRoundTask()).toBeNull();
  });

  it('loadRoundTask devuelve null si no hay nada persistido', () => {
    expect(loadRoundTask()).toBeNull();
  });
});

describe('roundTaskWatermarkLine', () => {
  it('devuelve la etiqueta en mayusculas para la marca de agua', () => {
    const task = ROUND_TASKS[0];
    expect(roundTaskWatermarkLine(task.id)).toBe(task.label.toUpperCase());
  });

  it('devuelve null sin actividad o con id invalido', () => {
    expect(roundTaskWatermarkLine(null)).toBeNull();
    expect(roundTaskWatermarkLine('no-existe')).toBeNull();
  });
});

describe('seleccion de actividad (logica de selectRoundTask)', () => {
  it('seleccionar y deseleccionar alterna el estado persistido', () => {
    const id = ROUND_TASKS[2].id;
    selectRoundTask(id);
    expect(loadRoundTask()).toBe(id);
    selectRoundTask(null);
    expect(loadRoundTask()).toBeNull();
  });

  it('un id invalido se normaliza a null al seleccionar', () => {
    selectRoundTask('basura');
    expect(loadRoundTask()).toBeNull();
  });
});

// --- H-02 / H-07 / H-08: generador unico de nombres de archivo --------------

describe('buildFileName (generador unico de nombres)', () => {
  const TS = 1730000000000;

  it('sin actividad: prefijo + timestamp + extension', () => {
    expect(buildFileName({ timestamp: TS })).toBe(`timemark_${TS}.jpg`);
  });

  it('con actividad: incluye el token de la actividad en TODAS las rutas', () => {
    const name = buildFileName({ taskId: 'accesos', timestamp: TS });
    expect(name).toBe(`timemark_accesos_${TS}.jpg`);
    expect(name).toContain('accesos');
  });

  it('el token de actividad es el id normalizado del catalogo', () => {
    expect(roundTaskFileToken('accesos')).toBe('accesos');
    expect(roundTaskFileToken('perimetro')).toBe('perimetro');
  });

  it('descarta una actividad desconocida en vez de inventar un token', () => {
    expect(roundTaskFileToken('no-existe')).toBeNull();
    expect(buildFileName({ taskId: 'no-existe', timestamp: TS })).toBe(`timemark_${TS}.jpg`);
  });

  it('un id con acentos o espacios genera un token seguro para el sistema de archivos', () => {
    expect(slugifyFileToken('Control de Accesos')).toBe('control-de-accesos');
    expect(slugifyFileToken('Revisión de cámaras')).toBe('revision-de-camaras');
    expect(slugifyFileToken('a/b\\c:d*e?f')).toBe('a-b-c-d-e-f');
  });

  it('el nombre con actividad nunca contiene espacios ni acentos', () => {
    for (const task of ROUND_TASKS) {
      const name = buildFileName({ taskId: task.id, timestamp: TS });
      expect(name).not.toMatch(/\s/);
      expect(name).toMatch(/^timemark_[a-z0-9-]+_\d+\.jpg$/);
    }
  });

  it('soporta el indice de lote (1-based)', () => {
    expect(buildFileName({ taskId: 'accesos', timestamp: TS, index: 1 })).toBe(`timemark_accesos_${TS}_1.jpg`);
    expect(buildFileName({ timestamp: TS, index: 3 })).toBe(`timemark_${TS}_3.jpg`);
  });

  it('ignora un indice no numerico', () => {
    expect(buildFileName({ timestamp: TS, index: null })).toBe(`timemark_${TS}.jpg`);
    expect(buildFileName({ timestamp: TS, index: NaN })).toBe(`timemark_${TS}.jpg`);
  });

  it('la copia del original usa el MISMO generador (prefijo `original`)', () => {
    expect(buildFileName({ taskId: 'accesos', timestamp: TS, prefix: 'original' }))
      .toBe(`original_accesos_${TS}.jpg`);
    expect(buildFileName({ timestamp: TS, prefix: 'original' }))
      .toBe(`original_${TS}.jpg`);
  });

  it('TODAS las rutas producen el mismo formato (paridad H-02)', () => {
    // Las 5 rutas que antes generaban nombres distintos.
    const save = buildFileName({ taskId: 'accesos', timestamp: TS });
    const saveOriginal = buildFileName({ taskId: 'accesos', timestamp: TS, prefix: 'original' });
    const share = buildFileName({ taskId: 'accesos', timestamp: TS });
    const shareAll = buildFileName({ taskId: 'accesos', timestamp: TS, index: 1 });
    const fallback = buildFileName({ taskId: 'accesos', timestamp: TS, index: 1 });

    const nombres = [save, saveOriginal, share, shareAll, fallback];
    for (const n of nombres) {
      expect(n).toMatch(/^[a-z]+(_[a-z0-9-]+)?_\d+(_\d+)?\.jpg$/);
    }
    // Todas las rutas con actividad comparten el MISMO token.
    for (const n of nombres) {
      expect(n).toContain('_accesos_');
    }
  });

  it('el prefijo y la marca de tiempo son parseables de forma posicional', () => {
    const name = buildFileName({ taskId: 'accesos', timestamp: TS });
    const partes = name.replace(/\.jpg$/, '').split('_');
    expect(partes[0]).toBe('timemark');
    expect(partes[partes.length - 1]).toBe(String(TS));
    expect(Number.isNaN(Number(partes[partes.length - 1]))).toBe(false);
  });
});

describe('roundTaskLabel', () => {
  it('devuelve la etiqueta legible de una actividad valida', () => {
    expect(roundTaskLabel('accesos')).toBe('Control de accesos');
  });

  it('devuelve null si no hay actividad o el id es desconocido', () => {
    expect(roundTaskLabel(null)).toBeNull();
    expect(roundTaskLabel(undefined)).toBeNull();
    expect(roundTaskLabel('no-existe')).toBeNull();
  });
});

describe('buildShareText', () => {
  it('antepone la actividad al texto cuando hay actividad', () => {
    expect(buildShareText({ taskId: 'accesos', address: 'Av. Siempre Viva 742', city: 'Buenos Aires', single: true }))
      .toBe('Control de accesos · Ronda · Av. Siempre Viva 742, Buenos Aires');
  });

  it('omite el prefijo de actividad cuando no hay actividad', () => {
    expect(buildShareText({ address: 'Av. Siempre Viva 742', city: 'Buenos Aires', single: true }))
      .toBe('Ronda · Av. Siempre Viva 742, Buenos Aires');
  });

  it('usa el mismo prefijo de actividad en el lote', () => {
    expect(buildShareText({ taskId: 'accesos', address: 'Av. Siempre Viva 742', city: 'Buenos Aires', count: 3 }))
      .toBe('Control de accesos · Ronda · 3 fotos · Av. Siempre Viva 742, Buenos Aires');
  });

  it('el prefijo del texto y el token del nombre identifican la MISMA actividad', () => {
    const taskId = 'incidente';
    const text = buildShareText({ taskId, address: 'Calle 1', city: 'CABA', single: true });
    const name = buildFileName({ taskId, timestamp: 1730000000000 });
    expect(text.startsWith(roundTaskLabel(taskId)!)).toBe(true);
    expect(name).toContain('_incidente_');
  });
});

// --- H-06: la actividad queda fijada al inicio de cada operacion -------------

describe('captureOperation (fijado de la actividad por operacion)', () => {
  it('captura id, etiqueta y token de la actividad vigente', () => {
    const op = captureOperation('accesos', 1730000000000);
    expect(op.taskId).toBe('accesos');
    expect(op.taskLabel).toBe('Control de accesos');
    expect(op.taskToken).toBe('accesos');
    expect(op.timestamp).toBe(1730000000000);
  });

  it('sin actividad captura null en los tres campos', () => {
    const op = captureOperation(null, 1730000000000);
    expect(op.taskId).toBeNull();
    expect(op.taskLabel).toBeNull();
    expect(op.taskToken).toBeNull();
  });

  it('una actividad desconocida se normaliza a null (no se filtra al archivo)', () => {
    const op = captureOperation('no-existe', 1730000000000);
    expect(op.taskId).toBeNull();
    expect(op.taskToken).toBeNull();
  });

  it('el snapshot NO cambia aunque la actividad global cambie despues', () => {
    const op = captureOperation('accesos', 1730000000000);
    // El usuario cambia de actividad a mitad de la operacion.
    const otro = captureOperation('camaras', 1730000000001);
    expect(op.taskId).toBe('accesos');
    expect(otro.taskId).toBe('camaras');
    expect(operationFileName(op)).not.toBe(operationFileName(otro));
  });

  it('nombre, texto y registro de una operacion comparten la MISMA actividad', () => {
    const op = captureOperation('incidente', 1730000000000);
    const name = operationFileName(op);
    const text = operationShareText(op, { address: 'Calle 1', city: 'CABA', single: true });

    expect(name).toContain('_incidente_');
    expect(text.startsWith('Registro de incidente')).toBe(true);
    expect(op.taskLabel).toBe('Registro de incidente');
  });

  it('el nombre del lote mantiene el mismo token y la misma marca de tiempo', () => {
    const op = captureOperation('entrega', 1730000000000);
    const n1 = operationFileName(op, { index: 1 });
    const n2 = operationFileName(op, { index: 2 });
    expect(n1).toBe('timemark_entrega_1730000000000_1.jpg');
    expect(n2).toBe('timemark_entrega_1730000000000_2.jpg');
  });
});
