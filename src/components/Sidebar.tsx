import React from 'react';
import { LayoutDashboard, FileText, MapIcon, Settings, HelpCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
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
          <p className="mt-2 text-on-surface-variant text-sm">Fotos verificadas de ronda</p>
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
        </div>
      </div>
    </aside>
  );
}
