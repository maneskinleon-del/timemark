import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import App from '../src/App';
import LogCard, { logActivities } from '../src/components/LogCard';
import { ROUND_TASKS } from '../src/roundTasks';

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

describe('App - UI de actividades de ronda', () => {
  it('renderiza la seccion "Actividades de Ronda"', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('Actividades de Ronda');
  });

  it('renderiza las seis actividades del catalogo', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    for (const task of ROUND_TASKS) {
      expect(html).toContain(task.label);
    }
  });

  it('indica que no hay actividades seleccionadas por defecto', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('Sin actividades seleccionadas');
  });

  it('marca como seleccionadas TODAS las actividades persistidas', () => {
    localStorage.setItem('timemark_round_tasks', JSON.stringify([ROUND_TASKS[0].id, ROUND_TASKS[2].id]));
    const html = renderToStaticMarkup(React.createElement(App));
    const pressed = html.match(/aria-pressed="true"/g) ?? [];
    expect(pressed.length).toBe(2);
    expect(html).toContain(ROUND_TASKS[0].label);
    expect(html).toContain(ROUND_TASKS[2].label);
  });

  it('migra la clave legacy de una sola actividad', () => {
    localStorage.setItem('timemark_round_task', ROUND_TASKS[1].id);
    const html = renderToStaticMarkup(React.createElement(App));
    const pressed = html.match(/aria-pressed="true"/g) ?? [];
    expect(pressed.length).toBe(1);
    expect(html).toContain(ROUND_TASKS[1].label);
  });

  it('expone los botones como accesibles (aria-pressed) en cada actividad', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    const pressed = html.match(/aria-pressed="false"/g) ?? [];
    expect(pressed.length).toBe(ROUND_TASKS.length);
  });
});

// --- H-03: las actividades se muestran en el historial ------------------------

describe('LogCard - actividades en los registros de patrulla', () => {
  it('muestra la actividad cuando el registro la trae', () => {
    const html = renderToStaticMarkup(React.createElement(LogCard, {
      log: { id: 1, img: 'data:image/jpeg;base64,AA', time: '12:30', address: 'Av. Siempre Viva 742', task: 'Control de accesos' },
    }));
    expect(html).toContain('Control de accesos');
    expect(html).toContain('data-testid="log-task"');
  });

  it('muestra TODAS las actividades cuando el registro trae `tasks`', () => {
    const html = renderToStaticMarkup(React.createElement(LogCard, {
      log: {
        id: 4,
        img: 'data:image/jpeg;base64,AA',
        time: '12:33',
        address: 'Calle 2',
        tasks: ['Control de accesos', 'Revisión de cámaras'],
      },
    }));
    const etiquetas = html.match(/data-testid="log-task"/g) ?? [];
    expect(etiquetas.length).toBe(2);
    expect(html).toContain('Control de accesos');
    expect(html).toContain('Revisión de cámaras');
  });

  it('sigue renderizando los registros antiguos SIN actividad (campo `task` ausente)', () => {
    const html = renderToStaticMarkup(React.createElement(LogCard, {
      log: { id: 2, img: 'data:image/jpeg;base64,AA', time: '12:31', address: 'Av. Siempre Viva 742' },
    }));
    expect(html).toContain('Av. Siempre Viva 742');
    expect(html).toContain('12:31');
    expect(html).not.toContain('data-testid="log-task"');
  });

  it('expone la actividad en una etiqueta accesible', () => {
    const html = renderToStaticMarkup(React.createElement(LogCard, {
      log: { id: 3, img: 'data:image/jpeg;base64,AA', time: '12:32', address: 'Calle 1', task: 'Entrega de turno' },
    }));
    expect(html).toContain('aria-label="Actividad: Entrega de turno"');
  });
});

describe('logActivities - normalizacion de actividades del registro', () => {
  it('prefiere `tasks` sobre el campo legado `task`', () => {
    expect(logActivities({ id: 1, img: '', time: '', address: '', task: 'Viejo', tasks: ['Nuevo'] }))
      .toEqual(['Nuevo']);
  });

  it('usa el campo legado cuando no hay `tasks`', () => {
    expect(logActivities({ id: 1, img: '', time: '', address: '', task: 'Viejo' })).toEqual(['Viejo']);
  });

  it('separa el campo legado combinado por " + "', () => {
    expect(logActivities({ id: 1, img: '', time: '', address: '', task: 'A + B' })).toEqual(['A', 'B']);
  });

  it('devuelve una lista vacia para una ronda generica', () => {
    expect(logActivities({ id: 1, img: '', time: '', address: '' })).toEqual([]);
    expect(logActivities({ id: 1, img: '', time: '', address: '', tasks: [] })).toEqual([]);
  });
});

// --- Logo de Arcangeli Seguridad opcional -----------------------------------
// La visibilidad del logo es una preferencia del usuario (por defecto activa)
// persistida en `timemark_logo_enabled`. La parte de render (hasLogo en
// computeWatermarkLayout y el bloque `if (logoImg)`) esta cubierta en
// tests/watermarkGeometry.test.ts.
describe('App - logo opcional en la marca de agua', () => {
  it('muestra el logo POR DEFECTO cuando no hay preferencia persistida', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('data-testid="logo-visible"');
    expect(html).not.toContain('data-testid="logo-hidden"');
  });

  it('respeta la preferencia guardada en `false` (logo desactivado)', () => {
    localStorage.setItem('timemark_logo_enabled', 'false');
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('data-testid="logo-hidden"');
    expect(html).not.toContain('data-testid="logo-visible"');
  });

  it('respeta la preferencia guardada en `true` (logo activado)', () => {
    localStorage.setItem('timemark_logo_enabled', 'true');
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('data-testid="logo-visible"');
    expect(html).not.toContain('data-testid="logo-hidden"');
  });

  it('cae al valor por defecto ante una clave corrupta', () => {
    localStorage.setItem('timemark_logo_enabled', 'no-es-un-booleano');
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('data-testid="logo-visible"');
    expect(html).not.toContain('data-testid="logo-hidden"');
  });

  it('expone la opcion como control accesible descrito por `aria-label`', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('aria-label="Incluir logo en la marca de agua"');
  });
});
