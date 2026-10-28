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

// --- Configuracion de columnas ---
// El panel se divide en zona izquierda (logo e informacion) y columna derecha (actividades).
// El ancho del panel se reparte: 70% para la zona izquierda, 30% para la columna derecha de actividades.
export const COLUMN_RATIO_LEFT = 0.7;   // zona izquierda: 70% ancho panel
export const COLUMN_RATIO_RIGHT = 0.3;  // columna derecha: 30% ancho panel

// Margen horizontal entre zona izquierda y columna derecha (en unidades de referencia).
export const COLUMN_GAP = 20;

// Baselines de la columna derecha (actividades).
export const COLUMN_TASK_X = 30;        // offset X dentro de la columna derecha
export const COLUMN_TASK_LINE_BASE = 130; // baseline Y base para la linea de actividades dentro de la columna

// Espacio entre multiples actividades en la columna derecha (en unidades de referencia).
export const COLUMN_TASK_SPACING = 35;

// Font sizes resultantes (en px del lienzo).
// Fuente para la coordenadas.
export const FONT_COORDS_BASE = 24;
// Fuente para la direccion.
export const FONT_ADDRESS_BASE = 32;
// Fuente para la tarea/actividad.
export const FONT_TASK_BASE = 20;
// Fuente para la marca de tiempo.
export const FONT_TIMESTAMP_BASE = 20;
// Fuente para VERIFICADO.
export const FONT_VERIFIED_BASE = 20;

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
  // NUEVO: valores de la columna derecha
  columnTaskX: number;
  columnTaskY: number;
  columnTaskWidth: number;
  columnTaskFontTask: number;
  columnTaskFontTimestamp: number;
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
  options: { hasTask: boolean; hasLogo: boolean; activityColumn?: boolean },
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
  const leftColumnWidth = panelWidth * COLUMN_RATIO_LEFT;
  const rightColumnWidth = panelWidth * COLUMN_RATIO_RIGHT - COLUMN_GAP;
  const rightColumnX = panelX + leftColumnWidth + COLUMN_GAP;

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
    // NUEVO: valores de la columna derecha
    columnTaskX: rightColumnX + COLUMN_TASK_X,
    columnTaskY: line(COLUMN_TASK_LINE_BASE),
    columnTaskWidth: rightColumnWidth,
    columnTaskFontTask: FONT_TASK_BASE * s * scale,
    columnTaskFontTimestamp: FONT_TIMESTAMP_BASE * s * scale,
    // Fuentes resultantes (en px del lienzo)
    fontCoords: 24 * s * scale,
    fontAddress: 32 * s * scale,
    fontTask: 20 * s * scale,
    fontTimestamp: 20 * s * scale,
    fontVerified: 20 * s * scale,
  };
};

/**
 * Obtiene la posicion X para dibujar actividades en la columna derecha.
 * Llama a computeWatermarkLayout para obtener la posicion calculada.
 */
export const getColumnTaskX = (layout: WatermarkLayout): number => {
  return layout.columnTaskX;
};

/**
 * Obtiene la posicion Y para dibujar la linea de actividades en la columna derecha.
 * Llama a computeWatermarkLayout para obtener la posicion calculada.
 */
export const getColumnTaskY = (layout: WatermarkLayout): number => {
  return layout.columnTaskY;
};

/**
 * Obtiene el ancho disponible para la columna de actividades.
 * Llama a computeWatermarkLayout para obtener el ancho calculado.
 */
export const getColumnTaskWidth = (layout: WatermarkLayout): number => {
  return layout.columnTaskWidth;
};

/**
 * Obtiene el font size para la tarea en la columna derecha.
 * Llama a computeWatermarkLayout para obtener el font size calculado.
 */
export const getColumnTaskFontTask = (layout: WatermarkLayout): number => {
  return layout.columnTaskFontTask;
};

/**
 * Obtiene el font size para la marca de tiempo en la columna derecha.
 * Llama a computeWatermarkLayout para obtener el font size calculado.
 */
export const getColumnTaskFontTimestamp = (layout: WatermarkLayout): number => {
  return layout.columnTaskFontTimestamp;
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
