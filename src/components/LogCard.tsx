// LogCard.tsx - Tarjeta de un registro de patrulla.
//
// El campo `task` (actividad de ronda reportada) es OPCIONAL: los registros
// antiguos, capturados antes de existir ese campo, se siguen renderizando igual,
// simplemente sin la etiqueta de actividad (H-03).
//
// Desde la seleccion multiple, los registros nuevos traen ADEMAS `tasks` (array de
// actividades). Si viene `tasks`, se muestran todas (una etiqueta por actividad);
// si no viene, se usa el campo `task` legado (una sola actividad). Un registro
// puede no tener ninguna: es una ronda generica.

import { Target } from 'lucide-react';

export interface PatrolLog {
  id: number;
  img: string;
  time: string;
  address: string;
  // Actividad unica (formato anterior). Se conserva para retrocompatibilidad.
  task?: string;
  // Actividades multiples (formato actual). Si esta presente, manda sobre `task`.
  tasks?: string[];
}

interface LogCardProps {
  log: PatrolLog;
  // `key` se declara aqui porque el proyecto no tipa React (los tipos de React no
  // estan instalados), de modo que JSX no reconoce `key` en un componente propio.
  key?: string | number;
}

// Devuelve las actividades del registro: `tasks` si existe (y no esta vacio),
// si no el campo legado `task` (dividido por " + " por si viniera combinado).
export function logActivities(log: PatrolLog): string[] {
  if (Array.isArray(log.tasks) && log.tasks.length > 0) {
    return log.tasks.filter(t => typeof t === 'string' && t.trim().length > 0);
  }
  if (typeof log.task === 'string' && log.task.trim().length > 0) {
    return log.task.split('+').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

export default function LogCard({ log }: LogCardProps) {
  const activities = logActivities(log);
  return (
    <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-3 overflow-hidden shadow-lg hover:border-secondary/50 transition-all group">
      <div className="relative h-48 w-full overflow-hidden rounded-lg mb-4 bg-black flex items-center justify-center">
        <img src={log.img} alt="Registro" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="px-2 pb-2">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-secondary font-mono font-bold">{log.time}</p>
          <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold uppercase tracking-widest">Verificado</span>
        </div>
        <p className="text-sm text-on-surface font-medium truncate flex items-center gap-2">
          <Target size={14} className="text-secondary" /> {log.address}
        </p>
        {/* Actividades reportadas (H-03): solo si el registro las trae. */}
        {activities.map(activity => (
          <p
            key={activity}
            data-testid="log-task"
            aria-label={`Actividad: ${activity}`}
            className="text-[10px] text-secondary bg-secondary/10 border border-secondary/30 rounded px-2 py-1 mt-2 font-bold uppercase tracking-widest truncate"
          >
            {activity}
          </p>
        ))}
      </div>
    </div>
  );
}
