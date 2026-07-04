import React from 'react';
import { Camera, ShieldCheck, Clock, Maximize } from 'lucide-react';

interface PreviewPanelProps {
  previewImage: string | null;
  isRendering: boolean;
  handleSave: () => void;
  handleDiscard: () => void;
  openTimeModal: () => void;
  queueLength: number;
}

export default function PreviewPanel({
  previewImage, isRendering, handleSave, handleDiscard, openTimeModal, queueLength
}: PreviewPanelProps) {
  return (
    <section className="glass-card rounded-xl flex flex-col overflow-hidden h-[500px] lg:h-full min-h-[500px]">
      <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-high/50 shrink-0">
        <h3 className="panel-header flex items-center gap-2">
          <ShieldCheck size={16} /> Vista Previa
        </h3>
        <button className="hover:text-secondary p-1.5 rounded transition-colors text-on-surface-variant">
          <Maximize size={18} />
        </button>
      </div>

      <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-4">
        {previewImage ? (
          <img src={previewImage} alt="Watermarked" className="max-h-full max-w-full object-contain rounded shadow-2xl" />
        ) : (
          <div className="text-center text-on-surface-variant flex flex-col items-center gap-4">
            <Camera size={48} className="opacity-20" />
            <p className="font-mono text-sm">{isRendering ? 'Procesando...' : 'Esperando captura...'}</p>
          </div>
        )}
      </div>

      {previewImage && (
        <div className="p-4 md:p-6 bg-surface-container-low/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t border-outline-variant/20 shrink-0">
          <div>
            <p className="panel-header mb-2">Integridad</p>
            <div className="flex gap-2">
              <span className="bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded font-mono text-xs">MD5: VERIFICADO</span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono text-xs">LISTO</span>
            </div>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-3">
            <button onClick={openTimeModal} disabled={isRendering}
              className="flex-1 min-w-[100px] border border-outline-variant/50 hover:bg-surface-container text-on-surface rounded-lg font-bold py-2.5 transition-colors flex justify-center gap-2">
              <Clock size={16} /> Hora
            </button>
            <button onClick={handleDiscard} disabled={isRendering}
              className="flex-1 min-w-[100px] bg-surface-container-highest text-on-surface rounded-lg font-bold border border-outline-variant/50 hover:bg-surface-variant transition-colors">
              {queueLength > 0 ? `Descartar (+${queueLength})` : 'Descartar'}
            </button>
            <button onClick={handleSave} disabled={isRendering}
              className="flex-1 min-w-[150px] bg-secondary text-on-secondary rounded-lg font-bold shadow-[0_0_15px_rgba(240,179,75,0.2)] hover:brightness-110 transition-all">
              {isRendering ? 'Procesando...' : (queueLength > 0 ? 'Guardar y Siguiente' : 'Guardar')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}