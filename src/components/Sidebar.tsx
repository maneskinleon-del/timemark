import React from 'react';
import { LayoutDashboard, FileText, MapIcon, Settings, HelpCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unitName: string;
}

export default function Sidebar({ activeTab, setActiveTab, unitName }: SidebarProps) {
  const items = [
    { id: 'dashboard', label: 'Panel de Control', Icon: LayoutDashboard },
    { id: 'logs', label: 'Registros de Patrulla', Icon: FileText },
    { id: 'map', label: 'Vista del Mapa', Icon: MapIcon },
    { id: 'settings', label: 'Ajustes', Icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-surface-container border-r border-outline-variant/20 shrink-0">
      <div className="p-6 flex flex-col h-full">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-secondary tracking-tight">TimeMark</h1>
          <div className="mt-4 flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface">U4</div>
            <div>
              <p className="text-on-surface font-bold text-sm">{unitName}</p>
              <p className="text-on-surface-variant text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-secondary rounded-full animate-status-pulse" />
                Turno Activo
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {items.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg font-bold text-left transition-colors ${
                activeTab === id
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Icon size={20} /> {label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-outline-variant/20">
          <button className="flex items-center gap-4 px-4 py-3 w-full text-on-surface-variant hover:bg-surface-bright rounded-lg">
            <HelpCircle size={20} /> Soporte
          </button>
          <button className="w-full py-3 mt-4 bg-error-container text-on-error-container font-bold rounded-lg hover:brightness-110 transition-all">
            Finalizar Turno
          </button>
        </div>
      </div>
    </aside>
  );
}