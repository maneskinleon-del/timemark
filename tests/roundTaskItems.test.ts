import { describe, it, expect } from 'vitest';
import { roundTaskItems, ROUND_TASKS } from '../src/roundTasks';

describe('roundTaskItems', () => {
  it('devuelve solo las seleccionadas, en orden de catalogo, con su descripcion', () => {
    const items = roundTaskItems(['entrega', 'accesos']);
    expect(items.map(i => i.label)).toEqual(['Control de accesos', 'Entrega de turno']);
    expect(items[0].desc).toBe(ROUND_TASKS.find(t => t.id === 'accesos')!.desc);
  });
  it('ignora ids invalidos y vacio da lista vacia', () => {
    expect(roundTaskItems(['nope'])).toEqual([]);
    expect(roundTaskItems(null)).toEqual([]);
  });
});
