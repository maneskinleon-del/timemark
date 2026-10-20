// roundTasks.ts - Catalogo, seleccion multiple y persistencia de actividades de ronda.
//
// La(s) actividad(es) seleccionada(s) se graban en la marca de agua de cada foto y
// acompanan al archivo cuando se comparte, de modo que el receptor sabe que
// verificacion se esta reportando.
//
// COMPATIBILIDAD RETROACTIVA:
//   - Persistencia NUEVA: clave `timemark_round_tasks` con un array JSON de ids
//     (por ejemplo `["accesos","camaras"]`).
//   - Persistencia VIEJA: clave `timemark_round_task` con UN id suelto. Se sigue
//     leyendo y se migra automaticamente al formato nuevo, de modo que la seleccion
//     de los usuarios que ya tenian la app no se pierde.
//   - Los registros de patrulla guardan `task` (string) y, desde ahora, tambien
//     `tasks` (array). Los registros antiguos (sin `tasks`) se siguen leyendo.


export interface RoundTask {
  id: string;
  label: string;
  desc: string;
}

// Catalogo por defecto de actividades de ronda.
export const ROUND_TASKS: RoundTask[] = [
  { id: 'perimetro',    label: 'Verificación de perímetro', desc: 'Recorrido perimetral y control de bardas' },
  { id: 'accesos',      label: 'Control de accesos',       desc: 'Validación de entradas y salidas' },
  { id: 'camaras',      label: 'Revisión de cámaras',      desc: 'Inspección de cámaras y zonas ciegas' },
  { id: 'equipos',      label: 'Chequeo de equipos',       desc: 'Estado de equipos y dispositivos de seguridad' },
  { id: 'incidente',    label: 'Registro de incidente',    desc: 'Relevamiento de incidente o anomalía' },
  { id: 'entrega',      label: 'Entrega de turno',         desc: 'Cierre de ronda y traspaso de guardia' },
];

// Clave de persistencia de la seleccion multiple (formato nuevo).
export const ROUND_TASKS_STORAGE_KEY = 'timemark_round_tasks';
// Clave de persistencia de la seleccion simple (formato legado: lectura + migracion).
export const ROUND_TASK_STORAGE_KEY = 'timemark_round_task';

// Maximo de actividades que se escriben en la linea de la marca de agua.
// El resto se resume como "+N" para que la linea nunca desborde el panel.
export const MAX_WATERMARK_TASKS = 3;

// Normaliza un id de actividad desconocido (catalogo editado, dato corrupto).
export const normalizeTaskId = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const found = ROUND_TASKS.find(t => t.id === raw);
  return found ? found.id : null;
};

// Normaliza una seleccion completa: descarta ids desconocidos, quita duplicados y
// conserva el ORDEN DEL CATALOGO (independiente del orden en que el usuario eligio).
export const normalizeTaskIds = (raw: unknown): string[] => {
  let candidates: unknown[] = [];
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Acepta tanto un id suelto como una lista separada por comas.
    candidates = trimmed.includes(',') ? trimmed.split(',') : [trimmed];
  }
  const selected = new Set<string>();
  for (const c of candidates) {
    const id = normalizeTaskId(typeof c === 'string' ? c : null);
    if (id) selected.add(id);
  }
  return ROUND_TASKS.filter(t => selected.has(t.id)).map(t => t.id);
};

// Etiqueta legible de una actividad (null si no hay o el id no es valido).
export const roundTaskLabel = (taskId: string | null | undefined): string | null => {
  const id = normalizeTaskId(taskId ?? null);
  if (!id) return null;
  const task = ROUND_TASKS.find(t => t.id === id);
  return task ? task.label : null;
};

// Etiquetas legibles de una seleccion (en orden de catalogo).
export const roundTaskLabels = (taskIds: readonly string[] | null | undefined): string[] =>
  normalizeTaskIds(taskIds ?? []).map(id => roundTaskLabel(id) as string);

// Convierte un texto en un token seguro para nombres de archivo:
// sin espacios, acentos ni caracteres problematicos.
export const slugifyFileToken = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // todo lo que no sea alfanumerico -> '-'
    .replace(/^-+|-+$/g, '');          // recorta guiones sobrantes

// Token de archivo derivado del catalogo de actividades.
// Si el id no pertenece al catalogo, se descarta (no se inventan identificadores).
export const roundTaskFileToken = (taskId: string | null | undefined): string | null => {
  const id = normalizeTaskId(taskId ?? null);
  if (!id) return null;
  const token = slugifyFileToken(id);
  return token.length > 0 ? token : null;
};

// Tokens de archivo de una seleccion (en orden de catalogo).
export const roundTaskFileTokens = (taskIds: readonly string[] | null | undefined): string[] =>
  normalizeTaskIds(taskIds ?? [])
    .map(id => roundTaskFileToken(id))
    .filter((t): t is string => !!t);

// Segmento de nombre de archivo para una seleccion (tokens unidos por "-").
// null si la seleccion esta vacia.
export const roundTaskTokenSegment = (taskIds: readonly string[] | null | undefined): string | null => {
  const tokens = roundTaskFileTokens(taskIds);
  return tokens.length > 0 ? tokens.join('-') : null;
};

// Extension por defecto de los archivos generados por TimeMark.
export const TIMEMARK_FILE_EXTENSION = 'jpg';

// --- Linea de la marca de agua -------------------------------------------------
//
// Una sola actividad: se mantiene el formato ANTERIOR (`ACTIVIDAD: <ETIQUETA>`).
// Varias actividades: se enumeran separadas por " + " y, si hay mas de
// MAX_WATERMARK_TASKS, el resto se resume como "+N".
export const roundTaskWatermarkLine = (taskId: string | null | undefined): string | null => {
  const label = roundTaskLabel(taskId ?? null);
  return label ? label.toUpperCase() : null;
};

export const roundTasksWatermarkLine = (taskIds: readonly string[] | null | undefined): string | null => {
  const labels = roundTaskLabels(taskIds).map(l => l.toUpperCase());
  if (labels.length === 0) return null;
  const shown = labels.slice(0, MAX_WATERMARK_TASKS);
  const rest = labels.length - shown.length;
  return rest > 0 ? `${shown.join(' + ')} +${rest}` : shown.join(' + ');
};

// --- Nombre de archivo --------------------------------------------------------
//
// FORMATO ANTERIOR (5 generadores distintos e incoherentes entre si):
//   1. `timemark_<epochMs>.jpg`                -> handleSave (sin actividad)
//   2. `timemark_<epochMs>.jpg`                -> handleSave con original (sin actividad)
//   3. `timemark_<taskId>_<epochMs>.jpg`       -> handleShare (con actividad)
//   4. `timemark_<taskId>_<epochMs>_<n>.jpg`   -> handleShareAll (con actividad)
//   5. `timemark_<epochMs>_<n>.jpg`            -> fallback de handleShareAll (sin actividad)
//   (la copia del original usaba `original_<epochMs>.jpg`, fuera del prefijo timemark)
//
// FORMATO NUEVO (generador unico `buildFileName`):
//   `timemark[_<taskToken>]_<epochMs>[_<n>].jpg`
//   `original[_<taskToken>]_<epochMs>.jpg`  (copia del original, mismo generador)
//   Con varias actividades el token es la union de tokens separados por "-":
//   `timemark_accesos-camaras_<epochMs>.jpg`
//
// COMPATIBILIDAD: se conservan el prefijo, el separador `_`, la marca de tiempo en
// epoch milisegundos, el sufijo `_n` de los lotes y la extension `.jpg`. La unica
// diferencia funcional es que el token de actividad aparece ahora en TODAS las
// rutas (incluido "Guardar" y los fallbacks) y que el token se normaliza con el
// catalogo (`roundTaskFileToken`), por lo que nunca contiene espacios ni acentos.
// Los nombres del formato anterior siguen siendo validos y no se renombran a mano.
export interface BuildFileNameOptions {
  // Actividad vigente de la operacion (se normaliza via el catalogo).
  taskId?: string | null;
  // Seleccion multiple de actividades de la operacion. Si se informa, tiene
  // prioridad sobre `taskId`.
  taskIds?: readonly string[] | null;
  // Marca de tiempo en epoch milisegundos.
  timestamp: number;
  // Indice 1-based dentro de un lote (opcional).
  index?: number | null;
  // Prefijo base del archivo (por defecto `timemark`).
  prefix?: string;
  // Extension sin punto (por defecto `jpg`).
  extension?: string;
}

export const buildFileName = (options: BuildFileNameOptions): string => {
  const prefix = options.prefix ?? 'timemark';
  const extension = options.extension ?? TIMEMARK_FILE_EXTENSION;
  const parts: string[] = [prefix];

  const token = options.taskIds !== undefined
    ? roundTaskTokenSegment(options.taskIds)
    : roundTaskFileToken(options.taskId ?? null);
  if (token) parts.push(token);

  parts.push(String(options.timestamp));

  if (typeof options.index === 'number' && Number.isFinite(options.index)) {
    parts.push(String(options.index));
  }

  return `${parts.join('_')}.${extension}`;
};

// --- Contexto de operacion ----------------------------------------------------
//
// Una "operacion" es un Guardar / Compartir / Compartir todas. Al iniciarla se
// captura la seleccion de actividades y la marca de tiempo, y ese snapshot se usa
// para el render, el nombre de archivo, el texto compartido y el registro. Asi todos
// los salidas de una misma operacion son coherentes entre si, aunque el usuario
// cambie de seleccion mientras la operacion esta en curso (H-02, H-06, H-07).

export interface OperationContext {
  // Seleccion de actividades de la operacion (normalizada y CONGELADA).
  taskIds: readonly string[];
  // Actividad principal (la primera del catalogo). null si no hay ninguna.
  taskId: string | null;
  // Etiquetas legibles de cada actividad seleccionada.
  taskLabels: readonly string[];
  // Etiqueta legible resumida (actividades unidas por " + "). null si no hay.
  taskLabel: string | null;
  // Token seguro para el nombre de archivo (tokens unidos por "-"). null si no hay.
  taskToken: string | null;
  // Marca de tiempo en epoch milisegundos.
  timestamp: number;
}

export const captureOperation = (
  taskIds: string | readonly string[] | null | undefined,
  timestamp: number,
): OperationContext => {
  // Acepta tanto un id suelto (formato anterior) como una seleccion completa.
  const ids = normalizeTaskIds(taskIds ?? []);
  const labels = ids.map(id => roundTaskLabel(id) as string);
  const tokens = roundTaskFileTokens(ids);
  return {
    taskIds: Object.freeze([...ids]),
    taskId: ids.length > 0 ? ids[0] : null,
    taskLabels: Object.freeze([...labels]),
    taskLabel: labels.length > 0 ? labels.join(' + ') : null,
    taskToken: tokens.length > 0 ? tokens.join('-') : null,
    timestamp,
  };
};

// Nombre de archivo de la operacion (usa el mismo generador unico).
export const operationFileName = (
  op: OperationContext,
  options: { index?: number | null; prefix?: string } = {},
): string => buildFileName({
  taskIds: op.taskIds,
  timestamp: op.timestamp,
  index: options.index ?? null,
  prefix: options.prefix,
});

// Texto compartido de la operacion.
export const operationShareText = (
  op: OperationContext,
  options: { address?: string | null; city?: string | null; count?: number; single?: boolean },
): string => buildShareText({
  taskIds: op.taskIds,
  address: options.address,
  city: options.city,
  count: options.count,
  single: options.single,
});

// --- Texto compartido ---------------------------------------------------------
//
// FORMATO ANTERIOR: `<Actividad> · Ronda · <addr>` / `Ronda · <addr>`.
// FORMATO NUEVO: identico. Solo se centraliza la construccion en un unico sitio
// para que texto, nombre de archivo, marca de agua y registro usen la misma
// seleccion de actividades.
export const buildShareText = (options: {
  taskId?: string | null;
  taskIds?: readonly string[] | null;
  address?: string | null;
  city?: string | null;
  count?: number;
  single?: boolean;
}): string => {
  const labels = options.taskIds !== undefined
    ? roundTaskLabels(options.taskIds)
    : (roundTaskLabel(options.taskId ?? null) ? [roundTaskLabel(options.taskId ?? null) as string] : []);
  const prefix = labels.length > 0 ? `${labels.join(' + ')} · ` : '';
  const address = (options.address ?? '').trim();
  const city = (options.city ?? '').trim();
  const place = [address, city].filter(Boolean).join(', ');

  if (options.single) {
    return place ? `${prefix}Ronda · ${place}` : `${prefix}Foto de ronda verificada`;
  }

  const count = options.count ?? 0;
  const head = `${prefix}Ronda · ${count} ${count === 1 ? 'foto' : 'fotos'}`;
  return place ? `${head} · ${place}` : `${head} verificadas`;
};

// --- Persistencia de la seleccion ---------------------------------------------
//
// El formato NUEVO guarda un array JSON. El formato VIEJO guarda un id suelto y se
// migra al leerlo, de modo que la seleccion de los usuarios previos no se pierde.
// Cualquier dato corrupto (JSON invalido, id desconocido) se descarta sin romper
// la app: la seleccion queda vacia.

export const loadRoundTasks = (): string[] => {
  try {
    const raw = localStorage.getItem(ROUND_TASKS_STORAGE_KEY);
    if (raw !== null) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null; // JSON corrupto: se ignora
      }
      return normalizeTaskIds(parsed);
    }

    // Formato legado: un unico id en `timemark_round_task`.
    const legacy = localStorage.getItem(ROUND_TASK_STORAGE_KEY);
    if (legacy !== null) {
      const ids = normalizeTaskIds(legacy);
      if (ids.length > 0) {
        // Migracion transparente al formato nuevo.
        saveRoundTasks(ids);
      }
      return ids;
    }
  } catch {
    /* localStorage no disponible (modo privado): la seleccion queda solo en memoria */
  }
  return [];
};

export const saveRoundTasks = (taskIds: readonly string[] | null | undefined): void => {
  const ids = normalizeTaskIds(taskIds ?? []);
  try {
    if (ids.length === 0) {
      localStorage.removeItem(ROUND_TASKS_STORAGE_KEY);
      localStorage.removeItem(ROUND_TASK_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ROUND_TASKS_STORAGE_KEY, JSON.stringify(ids));
    // La clave legado deja de ser la fuente de verdad.
    localStorage.removeItem(ROUND_TASK_STORAGE_KEY);
  } catch {
    /* localStorage no disponible (modo privado): la seleccion queda solo en memoria */
  }
};

// --- API legado (seleccion simple) --------------------------------------------
//
// Se conservan para retrocompatibilidad: `loadRoundTask` lee SOLO la clave vieja y
// `saveRoundTask` escribe SOLO la clave vieja. La app usa las funciones multiples.

export const loadRoundTask = (): string | null => {
  try {
    return normalizeTaskId(localStorage.getItem(ROUND_TASK_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const saveRoundTask = (taskId: string | null): void => {
  try {
    if (taskId === null) localStorage.removeItem(ROUND_TASK_STORAGE_KEY);
    else localStorage.setItem(ROUND_TASK_STORAGE_KEY, taskId);
  } catch {
    /* localStorage no disponible (modo privado): la seleccion queda solo en memoria */
  }
};
