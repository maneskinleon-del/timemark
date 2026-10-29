// watermarkGeometry.ts - Geometria del panel de marca de agua.
//
// La geometria vive fuera de App.tsx para poder verificarla con pruebas
// deterministas (sin canvas ni navegador). App.tsx usa estos valores tanto para
// el preview (drawWatermark) como para el render por lote (renderWatermarkToDataURL),
// de modo que ambas rutas comparten exactamente la misma disposicion.
//
// UNIDAD DE MEDIDA: todo se expresa en pixeles de un lienzo de referencia de
// 1080 px de ancho (multiplicado por la escala `s = canvasWidth / 1080`).

// Ancho de referencia del lienzo.
export const WATERMARK_BASE_WIDTH = 1080;

// Altura del panel en el lienzo de referencia.
export const PANEL_BASE_HEIGHT = 220;      // con linea de ACTIVIDAD
export const PANEL_BASE_HEIGHT_NO_TASK = 180; // sin linea de ACTIVIDAD

// Margen inferior del panel respecto del borde inferior del lienzo.
export const PANEL_MARGIN_BOTTOM = 24;

// Baselines (en unidades de referencia) de cada linea dentro del panel.
export const LINE_COORDS_Y = 50;
export const LINE_ADDRESS_Y = 100;
export const LINE_TASK_Y = 145;
export const LINE_TIMESTAMP_Y_WITH_TASK = 185;
export const LINE_TIMESTAMP_Y_NO_TASK = 145;

// Altura del logo dentro del panel.
export const LOGO_SIZE = 130;

// Factor bajo el cual la marca de agua se considera poco legible. No se usa como
// limite duro (el panel debe caber SIEMPRE), solo como aviso informativo.
export const LEGIBILITY_SCALE_FLOOR = 0.55;

export interface WatermarkLayout {
  // Escala del lienzo respecto del ancho de referencia.
  s: number;
  // Factor de compresion vertical aplicado al panel (<= 1).
  scale: number;
  // Si el panel hubo que comprimirse para caber en el lienzo.
  compressed: boolean;
  // Si la compresion llega a reducir la legibilidad.
  legibilityReduced: boolean;
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  // Baselines absolutas (en pixeles del lienzo) de cada elemento.
  coordsY: number;
  addressY: number;
  taskY: number | null;
  timestampY: number;
  verifiedY: number;
  // Tamano del logo (0 si no hay logo).
  logoSize: number;
  logoX: number;
  logoY: number;
  // Fuentes resultantes (en px del lienzo).
  fontCoords: number;
  fontAddress: number;
  fontTask: number;
  fontTimestamp: number;
  fontVerified: number;
}

/**
 * Calcula la disposicion del panel de marca de agua dentro del lienzo.
 *
 * Regla: el panel SIEMPRE queda dentro del lienzo. Si con la altura nominal no
 * cabe (imagenes panoramicas), se comprime proporcionalmente la altura y todas
 * las fuentes del panel (no se recorta contenido ni se reduce todo el panel a un
 * valor arbitrario), de modo que la marca de agua siga siendo legible.
 */
export const computeWatermarkLayout = (
  canvasWidth: number,
  canvasHeight: number,
  options: { hasTask: boolean; hasLogo: boolean },
): WatermarkLayout => {
  const s = canvasWidth / WATERMARK_BASE_WIDTH;
  const baseHeight = options.hasTask ? PANEL_BASE_HEIGHT : PANEL_BASE_HEIGHT_NO_TASK;

  // Alto total que ocuparia el panel con su margen inferior.
  const needed = (baseHeight + PANEL_MARGIN_BOTTOM) * s;
  const available = canvasHeight;

  // Factor de compresion: 1 mientras el panel nominal cabe holgadamente.
  // Si no cabe, se comprime lo justo para que el panel + su margen quepan
  // DENTRO del lienzo (garantia dura: panelY >= 0).
  const rawScale = needed > available && needed > 0 ? available / needed : 1;
  const scale = Math.min(1, rawScale);

  const compressed = scale < 1;
  const legibilityReduced = scale < LEGIBILITY_SCALE_FLOOR;

  const panelHeight = baseHeight * s * scale;
  const panelWidth = Math.min(canvasWidth * 0.9, 800 * s);
  const panelX = 24 * s;
  // El margen inferior nunca puede empujar el panel fuera del lienzo.
  const marginBottom = Math.min(PANEL_MARGIN_BOTTOM * s * scale, Math.max(0, canvasHeight - panelHeight));
  const panelY = Math.max(0, canvasHeight - panelHeight - marginBottom);

  const line = (base: number) => panelY + base * s * scale;

  const taskY = options.hasTask ? line(LINE_TASK_Y) : null;
  const timestampY = options.hasTask ? line(LINE_TIMESTAMP_Y_WITH_TASK) : line(LINE_TIMESTAMP_Y_NO_TASK);

  const logoSize = options.hasLogo ? LOGO_SIZE * s * scale : 0;
  const logoX = panelX + panelWidth - logoSize - 25 * s;
  const logoY = panelY + (panelHeight - logoSize) / 2;

  return {
    s,
    scale,
    compressed,
    legibilityReduced,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    coordsY: line(LINE_COORDS_Y),
    addressY: line(LINE_ADDRESS_Y),
    taskY,
    timestampY,
    verifiedY: timestampY,
    logoSize,
    logoX,
    logoY,
    fontCoords: 24 * s * scale,
    fontAddress: 32 * s * scale,
    fontTask: 20 * s * scale,
    fontTimestamp: 20 * s * scale,
    fontVerified: 20 * s * scale,
  };
};

// --- Bloque de actividades (FUERA del panel) --------------------------------------
// Titulo "ACTIVIDADES DE RONDA" y, debajo, solo las actividades seleccionadas
// (nombre + descripcion), sobre la foto, arriba a la derecha y sin fondo.
// Si no caben sobre el panel se comprimen; si aun asi quedarian muy pequenas se
// omiten las descripciones.
export const ACT_BLOCK_X_RATIO = 0.63;
export const ACT_RIGHT_MARGIN = 24;
export const ACT_TITLE_Y = 56;
export const ACT_TITLE_TO_FIRST = 52;
export const ACT_PITCH_FULL = 72;
export const ACT_PITCH_COMPACT = 40;
export const ACT_NAME_TO_DESC = 26;
export const ACT_DESCENT = 8;
export const ACT_GAP_ABOVE_PANEL = 16;
export const ACT_FONT_TITLE = 22;
export const ACT_FONT_NAME = 26;
export const ACT_FONT_DESC = 20;
export const ACT_FULL_MIN_SCALE = 0.75;
export const ACT_MIN_SCALE = 0.35;

export interface ActivitiesLayout {
  x: number;
  width: number;
  titleY: number;
  firstNameY: number;
  pitch: number;
  // Distancia nombre -> descripcion (null si se omiten las descripciones).
  descOffset: number | null;
  fontTitle: number;
  fontName: number;
  fontDesc: number;
  // Borde inferior del bloque (px del lienzo).
  bottom: number;
  scale: number;
}

export const computeActivitiesLayout = (
  canvasWidth: number,
  canvasHeight: number,
  panel: { panelY: number },
  count: number,
): ActivitiesLayout | null => {
  if (count <= 0) return null;
  const s = canvasWidth / WATERMARK_BASE_WIDTH;
  const x = canvasWidth * ACT_BLOCK_X_RATIO;
  const width = canvasWidth - x - ACT_RIGHT_MARGIN * s;
  const titleY = ACT_TITLE_Y * s;
  const limit = Math.min(canvasHeight, panel.panelY - ACT_GAP_ABOVE_PANEL * s);
  const availUnits = (limit - titleY) / s;

  const fullUnits = ACT_TITLE_TO_FIRST + (count - 1) * ACT_PITCH_FULL + ACT_NAME_TO_DESC + ACT_DESCENT;
  const compactUnits = ACT_TITLE_TO_FIRST + (count - 1) * ACT_PITCH_COMPACT + ACT_DESCENT;
  const kFull = availUnits / fullUnits;
  const withDesc = kFull >= ACT_FULL_MIN_SCALE;
  const k = withDesc
    ? Math.min(1, kFull)
    : Math.max(ACT_MIN_SCALE, Math.min(1, availUnits / compactUnits));

  const firstNameY = titleY + ACT_TITLE_TO_FIRST * s * k;
  const pitch = (withDesc ? ACT_PITCH_FULL : ACT_PITCH_COMPACT) * s * k;
  const descOffset = withDesc ? ACT_NAME_TO_DESC * s * k : null;
  const bottom = firstNameY + (count - 1) * pitch + (descOffset ?? 0) + ACT_DESCENT * s * k;

  return {
    x,
    width,
    titleY,
    firstNameY,
    pitch,
    descOffset,
    fontTitle: ACT_FONT_TITLE * s * k,
    fontName: ACT_FONT_NAME * s * k,
    fontDesc: ACT_FONT_DESC * s * k,
    bottom,
    scale: k,
  };
};

/**
 * Indica si la disposicion cabe dentro del lienzo.
 * Se mantiene separado para poder asertar en pruebas deterministas.
 */
export const layoutFitsCanvas = (layout: WatermarkLayout, canvasWidth: number, canvasHeight: number): boolean =>
  layout.panelY >= 0 &&
  layout.panelX >= 0 &&
  layout.panelX + layout.panelWidth <= canvasWidth + 0.001 &&
  layout.panelY + layout.panelHeight <= canvasHeight + 0.001;
