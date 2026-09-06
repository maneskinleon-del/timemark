// Utilidades de ubicación para TimeMark.
//
// Separación deliberada del modelo de datos:
//   - GPS (navigator.geolocation) entrega SOLO coordenadas: lat/lng/accuracy.
//   - La dirección/comuna (address/city) es un dato DISTINTO: proviene de entrada
//     manual del usuario o de un reverse geocoding futuro. NUNCA se deriva de las
//     coordenadas automáticamente.
//   - "GPS solicitado" ≠ "GPS obtenido" ≠ "dirección obtenida".

/** Opciones de adquisición usadas por TODA solicitud GPS de la app. */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Única forma de solicitar posición en la app. Rechaza con el error original de
 * la API (GeolocationPositionError) para que el llamador decida cómo mostrarlo.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

/**
 * Convierte coordenadas decimales a DMS con el mismo formato que usa el watermark:
 * dd°mm'ss.s"N dd°mm'ss.s"W (con redondeo seguro de segundos/minutos).
 * No introduce errores de signo: N/S según latitud, E/W según longitud.
 */
export function formatDMS(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  const formatCoord = (val: number): string => {
    const abs = Math.abs(val);
    let d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    let m = Math.floor(mFloat);
    let s = (mFloat - m) * 60;

    // Corrección de redondeo: 59.96" → 0.0" y +1 minuto (y +1 grado si aplica)
    let sStr = s.toFixed(1);
    if (sStr === '60.0') {
      m += 1;
      sStr = '0.0';
      if (m >= 60) {
        m = 0;
        d += 1;
      }
    }
    return `${d}°${m}'${sStr}"`;
  };

  return `${formatCoord(lat)}${latDir} ${formatCoord(lng)}${lngDir}`;
}

/**
 * Timestamp de adquisición en el formato que usa la app (YYYY-MM-DD HH:MM:SS),
 * compatible con buildTimestamp() y con el prefiltro del modal de hora.
 */
export function formatNowTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${date.toLocaleTimeString('en-US', { hour12: false })}`;
}

/**
 * Traduce errores de GeolocationPositionError a mensajes legibles para el usuario.
 * El detalle técnico se registra por separado con console.error (ver App.tsx).
 */
export function geolocationErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | null)?.code;
  switch (code) {
    case GeolocationPositionError.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado. Revisa los permisos de ubicación del navegador.';
    case GeolocationPositionError.POSITION_UNAVAILABLE:
      return 'El dispositivo no pudo determinar la ubicación.';
    case GeolocationPositionError.TIMEOUT:
      return 'La obtención de ubicación tardó demasiado. Inténtalo nuevamente.';
    default:
      return 'No se pudo obtener la ubicación.';
  }
}

/**
 * Reverse geocoding NO configurado. TimeMark no usa ninguna API externa de
 * dirección/comuna en esta versión. Cuando se integre un servicio real
 * (ej: Nominatim), reemplazar el cuerpo de esta función y llamarla desde la
 * adquisición GPS; hasta entonces devuelve null y address/city solo se llenan
 * manualmente. Mantiene desacoplado el paso "coordenadas → dirección".
 */
export async function reverseGeocode(_lat: number, _lng: number): Promise<{ address: string; city: string } | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Persistencia y validación de ubicación manual
// ---------------------------------------------------------------------------

export interface LocationData {
  coords: string;
  address: string;
  city: string;
  timestamp: string;
  source: 'gps' | 'manual' | 'unknown';
  mapCoords: { lat: number; lng: number } | null;
  accuracy: number | null;
}

interface StoredLocation {
  version: 1;
  activeSource: 'gps' | 'manual';
  manual: LocationData;
  gps: LocationData;
}

const STORAGE_KEY = 'timemark_location';

/**
 * Intenta convertir una cadena DMS (dd°mm'ss.s"N) a coordenadas decimales.
 * Devuelve null si el formato no es reconocido.
 */
export function parseDMS(dms: string): number | null {
  const cleaned = dms.trim().replace(/\s+/g, '');
  const match = cleaned.match(/^(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)['′](\d+(?:\.\d+)?)["″]([NSEW])$/i);
  if (!match) return null;
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') decimal = -decimal;
  return decimal;
}

/**
 * Valida coordenadas decimales (lat: -90..90, lng: -180..180).
 */
export function validateCoords(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Extrae coordenadas decimales desde un string DMS de coordenadas.
 * Acepta formato: dd°mm'ss.s"N dd°mm'ss.s"W
 */
export function parseCoordsString(coordsStr: string): { lat: number; lng: number } | null {
  const cleaned = coordsStr.trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;
  const latRaw = parts.slice(0, -1).join(' ');
  const lngRaw = parts[parts.length - 1];
  const lat = parseDMS(latRaw);
  const lng = parseDMS(lngRaw);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Carga la ubicación persistida. Devuelve null si no hay datos o si falla la lectura. */
export function loadLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persiste ubicación y fuente activa. No lanza excepciones. */
export function saveLocation(stored: StoredLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('TimeMark - No se pudo guardar ubicación en localStorage:', e);
  }
}