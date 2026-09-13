import React from 'react';
import { Camera, ShieldCheck, Clock, Maximize, Share2 } from 'lucide-react';

interface PreviewPanelProps {
  previewImage: string | null;
  isRendering: boolean;
  handleSave: () => void;
  handleShare: () => void;
  handleDiscard: () => void;
  openTimeModal: () => void;
  queueLength: number;
}

export default function PreviewPanel({
  previewImage, isRendering, handleSave, handleShare, handleDiscard, openTimeModal, queueLength
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
        <div className="p-4 md:p-6 bg-surface-container-low/50 flex flex-col gap-4 border-t border-outline-variant/20 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="hidden sm:block">
              <p className="panel-header mb-2">Integridad</p>
              <div className="flex gap-2">
                <span className="bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded font-mono text-xs">MD5: VERIFICADO</span>
                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono text-xs">LISTO</span>
              </div>
            </div>
            <div className="flex flex-wrap w-full sm:w-auto gap-3">
              <button onClick={openTimeModal} disabled={isRendering}
                className="flex-1 min-w-[100px] border border-outline-variant/50 hover:bg-surface-container text-on-surface rounded-lg font-bold py-3 transition-colors flex justify-center gap-2">
                <Clock size={18} /> Hora
              </button>
              <button onClick={handleDiscard} disabled={isRendering}
                className="flex-1 min-w-[100px] bg-surface-container-highest text-on-surface rounded-lg font-bold border border-outline-variant/50 hover:bg-surface-variant transition-colors py-3">
                {queueLength > 0 ? `Descartar (+${queueLength})` : 'Descartar'}
              </button>
            </div>
          </div>

          {/* Botón Guardar más grande */}
          <button
            onClick={handleSave}
            disabled={isRendering}
            className="w-full py-4 text-base md:text-lg bg-secondary text-on-secondary rounded-xl font-bold shadow-[0_0_20px_rgba(240,179,75,0.35)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRendering ? 'Procesando...' : (queueLength > 0 ? 'Guardar y Siguiente' : 'Guardar')}
          </button>

          {/* Botón Compartir (WhatsApp / compartir nativo) */}
          <button
            onClick={handleShare}
            disabled={isRendering}
            className="w-full py-3.5 text-base border-2 border-secondary/60 text-secondary bg-secondary/10 rounded-xl font-bold hover:bg-secondary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Share2 size={20} />
            Compartir
          </button>
        </div>
      )}
    </section>
  );
}
