// activitiesBlock.ts - Dibujo del bloque "ACTIVIDADES DE RONDA" (fuera del panel).
// La geometria viene de computeActivitiesLayout (verificable sin canvas).
import type { ActivitiesLayout } from './watermarkGeometry';

const FONT = '"Roboto Condensed", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';

export const drawActivitiesBlock = (
  ctx: CanvasRenderingContext2D,
  a: ActivitiesLayout,
  items: ReadonlyArray<{ label: string; desc: string }>,
  s: number,
): void => {
  if (items.length === 0) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Sin fondo: legibilidad por sombra.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 6 * s;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1 * s;

  ctx.fillStyle = '#ffe9b8';
  ctx.font = `bold ${a.fontTitle}px ${FONT}`;
  ctx.fillText('ACTIVIDADES DE RONDA', a.x, a.titleY, a.width);

  items.forEach((item, i) => {
    const y = a.firstNameY + i * a.pitch;
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold ${a.fontName}px ${FONT}`;
    ctx.fillText(item.label, a.x, y, a.width);
    if (a.descOffset !== null) {
      ctx.fillStyle = '#f1e2c0';
      ctx.font = `${a.fontDesc}px ${FONT}`;
      ctx.fillText(item.desc, a.x, y + a.descOffset, a.width);
    }
  });
  ctx.restore();
};
