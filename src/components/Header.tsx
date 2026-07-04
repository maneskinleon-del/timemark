import React from 'react';

interface HeaderProps {
  timeString: string;
  dateString: string;
}

export default function Header({ timeString, dateString }: HeaderProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-on-surface">Centro de Mando</h2>
        <p className="text-on-surface-variant">Centro de Vigilancia y Verificación</p>
      </div>
      <div className="glass-card px-6 py-4">
        <div className="font-mono text-xl md:text-2xl text-secondary tabular-nums font-medium">{timeString}</div>
        <div className="font-bold text-xs tracking-widest text-on-surface-variant mt-1 uppercase">{dateString}</div>
      </div>
    </header>
  );
}