import { describe, it, expect } from 'vitest';
import {
  computeWatermarkLayout,
  computeActivitiesLayout,
  layoutFitsCanvas,
  PANEL_BASE_HEIGHT,
  PANEL_BASE_HEIGHT_NO_TASK,
  WATERMARK_BASE_WIDTH,
} from '../src/watermarkGeometry';

// Geometria del panel de marca de agua (H-04).
//
// El hallazgo H-04 dice que el panel de altura fija (220) se sale del lienzo en
// imagenes panoramicas: `panelY = canvasH - panelH - 24*s` es NEGATIVO cuando
// `canvasH/canvasW < (220+24)/1080 = 0.226`, es decir, en fotos de aspecto
// superior a ~4.43:1. Con la compresion introducida, el panel SIEMPRE cabe.

describe('computeWatermarkLayout', () => {
  const op = { hasTask: true, hasLogo: true };

  it('en una foto normal (4:3) el panel NO se comprime', () => {
    const l = computeWatermarkLayout(1080, 1440, op);
    expect(l.compressed).toBe(false);
    expect(l.scale).toBe(1);
    expect(l.panelHeight).toBeCloseTo(PANEL_BASE_HEIGHT, 5);
  });

  it('sin actividad el panel es mas bajo', () => {
    const l = computeWatermarkLayout(1080, 1440, { hasTask: false, hasLogo: true });
    expect(l.panelHeight).toBeCloseTo(PANEL_BASE_HEIGHT_NO_TASK, 5);
    expect(l.taskY).toBeNull();
  });

  it('el panel SIEMPRE cabe dentro del lienzo (imagen panoramica extrema)', () => {
    // Fotografias panoramicas muy alargadas.
    const casos: Array<[number, number]> = [
      [1920, 400],   // 4.8:1  -> panelY NEGATIVO con la altura fija anterior
      [1920, 300],   // 6.4:1
      [4000, 500],   // 8:1
      [1080, 200],   // 5.4:1
      [1920, 220],   // 8.7:1
    ];
    for (const [w, h] of casos) {
      const l = computeWatermarkLayout(w, h, op);
      expect(l.panelY, `panelY fuera del lienzo en ${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(l.panelY + l.panelHeight, `panel desbordado en ${w}x${h}`)
        .toBeLessThanOrEqual(h + 0.001);
      expect(layoutFitsCanvas(l, w, h), `layout no cabe en ${w}x${h}`).toBe(true);
    }
  });

  it('en una panoramica el panel se comprime (no se recorta)', () => {
    const l = computeWatermarkLayout(1920, 400, op);
    expect(l.compressed).toBe(true);
    expect(l.scale).toBeLessThan(1);
    expect(l.scale).toBeGreaterThan(0);
  });

  it('las lineas de texto se mantienen ordenadas y dentro del panel', () => {
    for (const [w, h] of [[1080, 1440], [1920, 400], [4000, 500]] as Array<[number, number]>) {
      const l = computeWatermarkLayout(w, h, op);
      expect(l.coordsY).toBeLessThan(l.addressY);
      expect(l.addressY).toBeLessThan(l.taskY!);
      expect(l.taskY!).toBeLessThan(l.timestampY);
      // Ninguna linea se sale del panel por abajo.
      expect(l.timestampY).toBeLessThanOrEqual(l.panelY + l.panelHeight);
      expect(l.coordsY).toBeGreaterThanOrEqual(l.panelY);
    }
  });

  it('sin actividad, la linea TIMESTAMP sustituye a la de ACTIVIDAD', () => {
    const l = computeWatermarkLayout(1080, 1440, { hasTask: false, hasLogo: true });
    expect(l.taskY).toBeNull();
    expect(l.timestampY).toBeGreaterThan(l.addressY);
    expect(l.timestampY).toBeLessThanOrEqual(l.panelY + l.panelHeight);
  });

  it('el logo se mantiene dentro del panel', () => {
    for (const [w, h] of [[1080, 1440], [1920, 400]] as Array<[number, number]>) {
      const l = computeWatermarkLayout(w, h, { hasTask: true, hasLogo: true });
      expect(l.logoSize).toBeGreaterThan(0);
      expect(l.logoX).toBeGreaterThanOrEqual(l.panelX);
      expect(l.logoX + l.logoSize).toBeLessThanOrEqual(l.panelX + l.panelWidth + 0.001);
      expect(l.logoY).toBeGreaterThanOrEqual(l.panelY - 0.001);
      expect(l.logoY + l.logoSize).toBeLessThanOrEqual(l.panelY + l.panelHeight + 0.001);
    }
  });

  it('sin logo no se reserva espacio para el logo', () => {
    const l = computeWatermarkLayout(1080, 1440, { hasTask: true, hasLogo: false });
    expect(l.logoSize).toBe(0);
  });

  it('la escala es proporcional al ancho del lienzo', () => {
    const l = computeWatermarkLayout(2160, 2880, op);
    expect(l.s).toBeCloseTo(2160 / WATERMARK_BASE_WIDTH, 6);
    expect(l.panelHeight).toBeCloseTo(PANEL_BASE_HEIGHT * 2, 5);
  });

  it('el ancho del panel nunca excede el 90% del lienzo', () => {
    for (const w of [400, 1080, 1920, 4000]) {
      const l = computeWatermarkLayout(w, 1000, op);
      expect(l.panelWidth).toBeLessThanOrEqual(w * 0.9 + 0.001);
    }
  });
});

// Bloque "ACTIVIDADES DE RONDA": va FUERA del panel, arriba a la derecha, y no
// altera la geometria del panel. Regresion: en a4e83d9 las actividades estaban
// dentro del panel (columna) y "VERIFICADO" pisaba la ultima.
describe('computeActivitiesLayout (bloque fuera del panel)', () => {
  const sizes: Array<[number, number]> = [[1080, 810], [1080, 608], [2160, 2880], [1920, 1080]];

  it('sin actividades seleccionadas no hay bloque', () => {
    const panel = computeWatermarkLayout(1080, 810, { hasTask: false, hasLogo: true });
    expect(computeActivitiesLayout(1080, 810, panel, 0)).toBeNull();
  });

  it.each(sizes)('el bloque queda a la derecha, dentro del lienzo y sobre el panel, de 1 a 6 actividades (%i x %i)', (w, h) => {
    const panel = computeWatermarkLayout(w, h, { hasTask: false, hasLogo: true });
    for (let n = 1; n <= 6; n++) {
      const a = computeActivitiesLayout(w, h, panel, n)!;
      expect(a.x).toBeGreaterThan(w / 2);
      expect(a.x + a.width).toBeLessThanOrEqual(w);
      expect(a.titleY).toBeGreaterThan(0);
      expect(a.bottom).toBeLessThanOrEqual(panel.panelY + 0.001);
      expect(a.fontName).toBeGreaterThan(0);
    }
  });

  it('con espacio de sobra muestra descripciones; si no caben las omite en vez de pisar el panel', () => {
    const roomy = computeWatermarkLayout(1080, 810, { hasTask: false, hasLogo: true });
    expect(computeActivitiesLayout(1080, 810, roomy, 3)!.descOffset).not.toBeNull();
    const tight = computeWatermarkLayout(1080, 608, { hasTask: false, hasLogo: true });
    expect(computeActivitiesLayout(1080, 608, tight, 6)!.descOffset).toBeNull();
  });

  it('el panel no depende de las actividades (hasTask=false siempre)', () => {
    const a = computeWatermarkLayout(1080, 810, { hasTask: false, hasLogo: true });
    expect(a.panelHeight).toBe(PANEL_BASE_HEIGHT_NO_TASK * a.s);
    expect(a.taskY).toBeNull();
  });
});
