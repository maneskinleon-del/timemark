import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Test de CONTRATO DE FUENTE: verifica invariantes del codigo que no pueden
// comprobarse con el DOM (jsdom no esta disponible en Termux) pero que son la
// causa raiz de H-01, H-02 y H-06.
//
// No es un test de navegador: lee el fuente y comprueba la estructura.

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');

const appSource = read('src/App.tsx');

describe('H-01 - el redibujado de la marca de agua depende de las actividades', () => {
  it('el useEffect de redibujado incluye roundTaskIds en sus dependencias', () => {
    const efecto = appSource.match(
      /useEffect\(\(\) => \{[\s\S]*?drawWatermark\([\s\S]*?\}, \[[^\]]*\]\);/,
    );
    expect(efecto, 'no se encontro el efecto de redibujado').not.toBeNull();
    expect(efecto![0]).toContain('roundTaskIds');
  });

  it('la llamada a drawWatermark le pasa la seleccion de actividades', () => {
    expect(appSource).toMatch(/drawWatermark\([^)]*roundTaskIds[^)]*\)/);
  });

  it('drawWatermark recibe la seleccion como parametro (no la lee del ref durante el render)', () => {
    expect(appSource).toMatch(/const drawWatermark = \([\s\S]*?taskIds: readonly string\[\] = roundTaskIdsRef\.current,[\s\S]*?\) =>/);
    // Dentro del render del panel NO se vuelve a leer el ref espejo.
    // La linea de actividades del panel se calcula con el parametro `taskIds`,
    // nunca con el ref espejo (que si puede cambiar a mitad del render).
    expect(appSource).not.toContain('roundTasksWatermarkLine(roundTaskIdsRef.current)');
    expect(appSource).toContain('roundTasksWatermarkLine(taskIds)');
  });

  it('renderWatermarkToDataURL recibe la seleccion como parametro', () => {
    expect(appSource).toMatch(/const renderWatermarkToDataURL = \([\s\S]*?taskIds: readonly string\[\] = roundTaskIdsRef\.current/);
  });
});

describe('H-02 - un unico generador de nombres de archivo', () => {
  it('no quedan plantillas de nombre escritas a mano en App.tsx', () => {
    // Se busca el patron `timemark_` seguido de una interpolacion: cualquier
    // generador literal fuera de `buildFileName` esta prohibido.
    const literales = appSource.match(/timemark_\$\{/g) ?? [];
    expect(literales, 'quedan nombres de archivo construidos a mano').toEqual([]);
  });

  it('no quedan plantillas `original_` escritas a mano', () => {
    expect(appSource.match(/original_\$\{/g) ?? []).toEqual([]);
  });

  it('todas las descargas usan buildFileName', () => {
    const descargas = appSource.match(/\.download = /g) ?? [];
    expect(descargas.length).toBeGreaterThan(0);
    const asignaciones = appSource.match(/\.download = [^;]+;/g) ?? [];
    for (const a of asignaciones) {
      expect(a).toContain('buildFileName(');
    }
  });
});

describe('H-06 - las actividades quedan fijadas durante la operacion', () => {
  it('handleShare captura la operacion con captureOperation', () => {
    expect(appSource).toMatch(/const handleShare = async \(\) => \{[\s\S]*?captureOperation\(/);
  });

  it('handleSave captura la operacion con captureOperation', () => {
    expect(appSource).toMatch(/const handleSave = \(\) => \{[\s\S]*?captureOperation\(/);
  });

  it('handleShareAll captura la operacion con captureOperation', () => {
    expect(appSource).toMatch(/const handleShareAll = async \(\) => \{[\s\S]*?captureOperation\(/);
  });

  it('el bloqueo de la interfaz se libera en un `finally`', () => {
    expect(appSource).toMatch(/finally \{\s*(\/\/[^\n]*\n\s*)*setIsSharing\(false\);/);
    expect(appSource).toMatch(/finally \{[\s\S]*?setIsSharingAll\(false\);/);
  });

  it('los botones de actividades se deshabilitan durante el reparto', () => {
    // Se busca el boton de actividad y, dentro del MISMO bloque (<button ...>),
    // la atributo `disabled` que incluye los estados de reparto.
    const botones = appSource.match(/<button[\s\S]{0,900}?toggleRoundTask[\s\S]{0,900}?>/g) ?? [];
    expect(botones.length).toBeGreaterThan(0);
    for (const b of botones) {
      expect(b).toMatch(/disabled=\{[^}]*isSharing[^}]*\}/);
    }
  });

  it('el snapshot de la operacion se toma de la seleccion vigente', () => {
    expect(appSource).toMatch(/captureOperation\(roundTaskIdsRef\.current, Date\.now\(\)\)/);
  });
});

describe('H-03 - las actividades se renderizan en el historial', () => {
  it('la tarjeta del registro muestra el campo `task` cuando existe', () => {
    const logCard = read('src/components/LogCard.tsx');
    expect(logCard).toContain('log.task');
    expect(logCard).toContain('data-testid="log-task"');
  });

  it('la tarjeta del registro soporta varias actividades (`tasks`)', () => {
    const logCard = read('src/components/LogCard.tsx');
    expect(logCard).toContain('log.tasks');
  });

  it('App.tsx usa el componente LogCard para los registros', () => {
    expect(appSource).toContain('<LogCard');
  });
});

describe('H-04 - la geometria del panel esta centralizada', () => {
  it('App.tsx usa computeWatermarkLayout en lugar de calcular el panel a mano', () => {
    expect(appSource).toContain('computeWatermarkLayout');
    // No queda la formula fija `canvas.height - panelHeight - 24 * s`.
    expect(appSource).not.toMatch(/canvas\.height - panelHeight - 24 \* s/);
  });

  it('las dos rutas de render usan la MISMA geometria', () => {
    const usos = appSource.match(/computeWatermarkLayout\(/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(2);
  });
});

// --- GUARD: la PWA publicada mostraba una pantalla negra ------------------------
//
// `origin/main` contenia un `src/App.tsx` stub que retornaba `null`, y varios
// archivos nunca se versionaron. Estos guards detectan esa regresion en el
// repositorio, antes de que llegue a una publicacion.

describe('GUARD - App.tsx no es un stub', () => {
  it('App.tsx no retorna null como componente completo', () => {
    // Un stub suele ser: `export default function App() { return null; }`
    const stub = /export\s+default\s+function\s+App\s*\([^)]*\)\s*\{[^}]*return\s+null\s*;?\s*\}/m;
    expect(appSource, 'App.tsx es un stub que renderiza null (pantalla negra)').not.toMatch(stub);
  });

  it('App.tsx renderiza un elemento de interfaz', () => {
    expect(appSource).toMatch(/return\s*\(\s*<div/);
  });

  it('App.tsx importa los modulos esenciales', () => {
    for (const modulo of [
      './roundTasks',
      './watermarkGeometry',
      './components/LogCard',
      'react',
    ]) {
      expect(appSource, `falta el import de ${modulo}`).toContain(`from '${modulo}'`);
    }
  });

  it('los archivos versionados que la app necesita existen', () => {
    for (const rel of [
      'src/App.tsx',
      'src/main.tsx',
      'src/roundTasks.ts',
      'src/watermarkGeometry.ts',
      'src/components/LogCard.tsx',
      'index.html',
      'public/manifest.json',
    ]) {
      expect(existsSync(resolve(here, '..', rel)), `falta ${rel}`).toBe(true);
    }
  });
});
