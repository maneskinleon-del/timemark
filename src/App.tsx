import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  Upload, 
  MapPin, 
  LayoutDashboard, 
  FileText, 
  Map as MapIcon, 
  Settings, 
  HelpCircle, 
  Clock, 
  Maximize, 
  ShieldCheck,
  Target,
  Edit2,
  X
} from 'lucide-react';

// Tipos para la cola de procesamiento
interface QueueItem {
  file: File;
  id: string;
}

interface BatchProcessState {
  queue: QueueItem[];
  isProcessing: boolean;
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [mapCoords, setMapCoords] = useState({ lat: -33.606, lng: -70.879 });
  const [logs, setLogs] = useState<Array<{id: number, img: string, time: string, address: string}>>([]);
  const [unitName, setUnitName] = useState('Unidad 402');
  const [location, setLocation] = useState({
    coords: "33°36'21.6\"S 70°52'44.4\"W",
    address: "AVENIDA BERLÍN 34",
    city: "PEÑAFLOR",
    timestamp: ""
  });

  // Refs para leer siempre el valor actualizado dentro de callbacks asíncronos
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  const logoImageRef = useRef<string | null>(null);
  useEffect(() => { logoImageRef.current = logoImage; }, [logoImage]);

  const [settings, setSettings] = useState({
    strictDarkMode: true,
    saveOriginal: false,
    resolution: "1080"
  });

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editLocationDetails, setEditLocationDetails] = useState({ coords: '', address: '', city: '' });
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  const customTimestampRef = useRef<string | null>(null);

  // Estado unificado para la cola de procesamiento por lotes
  const [batchState, setBatchState] = useState<BatchProcessState>({
    queue: [],
    isProcessing: false
  });

  // drawId: cancela renders obsoletos cuando llegan imágenes rápido
  const drawIdRef = useRef(0);

  // Nuevo estado para bloquear guardado mientras renderiza
  const [isRendering, setIsRendering] = useState(false);

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { hour12: false });
  const dateString = currentTime.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).toUpperCase();

  // Geolocalización al montar
  useEffect(() => {
    const savedLogo = localStorage.getItem('timemark_logo');
    if (savedLogo) setLogoImage(savedLogo);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const latDir = lat >= 0 ? 'N' : 'S';
          const lngDir = lng >= 0 ? 'E' : 'W';
          const formatCoord = (val: number) => {
            const abs = Math.abs(val);
            const d = Math.floor(abs);
            const m = Math.floor((abs - d) * 60);
            const s = ((abs - d - m / 60) * 3600).toFixed(1);
            return `${d}°${m}'${s}"`;
          };
          setMapCoords({ lat, lng });
          setLocation(prev => ({
            ...prev,
            coords: `${formatCoord(lat)}${latDir} ${formatCoord(lng)}${lngDir}`
          }));
        },
        (error) => console.log("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Redibujar SOLO cuando cambia logo o ubicación manualmente — sin newDrawId (reusa el actual)
  useEffect(() => {
    if (originalImage) {
      drawWatermark(originalImage, logoImageRef.current, locationRef.current, drawIdRef.current);
    }
  }, [logoImage, location.coords, location.address]);

  // Limpiar imágenes cuando termina el batch
  useEffect(() => {
    if (!batchState.isProcessing && batchState.queue.length === 0 && previewImage) {
      setOriginalImage(null);
      setPreviewImage(null);
    }
  }, [batchState.isProcessing, batchState.queue.length]);

  const buildTimestamp = (): string => {
    const ts = customTimestampRef.current;
    if (ts) {
      const parts = ts.split(':');
      if (parts.length >= 2) {
        const randomSecs = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        return `${parts[0]}:${parts[1]}:${randomSecs}`;
      }
      return ts;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleTimeString('en-US', { hour12: false })}`;
  };

  // drawWatermark recibe un drawId OBLIGATORIO: si para cuando termina el canvas ya hay uno más nuevo, descarta
  const drawWatermark = (imgSrc: string, logoSrc: string | null, loc: typeof location, myDrawId: number) => {
    const currentDrawId = myDrawId;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Si ya llegó otra imagen más nueva, no continuamos
      if (currentDrawId !== drawIdRef.current) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Aplicar resolución según configuración
      const maxDim = Number(settingsRef.current.resolution) || 1080;
      const scaleDown = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scaleDown);
      canvas.height = Math.round(img.height * scaleDown);
      const scale = canvas.width / 1080;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Top Left: "TIMEMARK SYSTEM"
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      const topRectWidth = 240 * scale;
      const topRectHeight = 36 * scale;
      ctx.fillRect(24 * scale, 24 * scale, topRectWidth, topRectHeight);
      ctx.fillStyle = '#ffb95f';
      ctx.fillRect(24 * scale, 24 * scale, 6 * scale, topRectHeight);
      ctx.font = `bold ${16 * scale}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'white';
      ctx.textBaseline = 'middle';
      ctx.fillText('TIMEMARK SYSTEM', 44 * scale, 24 * scale + topRectHeight / 2);

      const finishDrawing = (logoImg: HTMLImageElement | null) => {
        // Verificar de nuevo: si llegó otra imagen mientras cargaba el logo, descartar
        if (currentDrawId !== drawIdRef.current) return;

        const ctx2 = canvas.getContext('2d');
        if (!ctx2) return;
        const s = canvas.width / 1080;

        const panelHeight = 180 * s;
        const panelWidth = Math.min(canvas.width * 0.9, 800 * s);
        const panelX = 24 * s;
        const panelY = canvas.height - panelHeight - 24 * s;

        ctx2.shadowColor = 'rgba(0,0,0,0.5)';
        ctx2.shadowBlur = 12 * s;
        ctx2.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx2.beginPath();
        ctx2.roundRect(panelX, panelY, panelWidth, panelHeight, [0, 16 * s, 16 * s, 0]);
        ctx2.fill();
        ctx2.shadowBlur = 0;

        ctx2.fillStyle = '#ffb95f';
        ctx2.fillRect(panelX, panelY, 6 * s, panelHeight);

        ctx2.textBaseline = 'alphabetic';
        ctx2.fillStyle = '#ffb95f';
        ctx2.font = `${24 * s}px sans-serif`;
        ctx2.fillText(`📍 ${loc.coords}`, panelX + 30 * s, panelY + 50 * s);

        ctx2.fillStyle = 'white';
        ctx2.font = `bold ${32 * s}px "JetBrains Mono", monospace`;
        ctx2.fillText(`${loc.address}, ${loc.city}`, panelX + 30 * s, panelY + 100 * s);

        ctx2.fillStyle = '#c6c6cd';
        ctx2.font = `${20 * s}px "JetBrains Mono", monospace`;
        ctx2.fillText(`TIMESTAMP: ${loc.timestamp}`, panelX + 30 * s, panelY + 145 * s);

        if (logoImg) {
          const logoSize = 130 * s;
          const logoPadding = (panelHeight - logoSize) / 2;
          const logoX = panelX + panelWidth - logoSize - 25 * s;
          const logoY = panelY + logoPadding;

          ctx2.fillStyle = 'rgba(255, 255, 255, 1)';
          ctx2.beginPath();
          ctx2.roundRect(logoX, logoY, logoSize, logoSize, 8 * s);
          ctx2.fill();

          const targetSize = logoSize - 16 * s;
          const imgAspect = logoImg.width / logoImg.height;
          let drawWidth = targetSize;
          let drawHeight = targetSize;
          let drawX = logoX + 8 * s;
          let drawY = logoY + 8 * s;
          if (imgAspect > 1) { drawHeight = targetSize / imgAspect; drawY += (targetSize - drawHeight) / 2; }
          else if (imgAspect < 1) { drawWidth = targetSize * imgAspect; drawX += (targetSize - drawWidth) / 2; }

          ctx2.drawImage(logoImg, drawX, drawY, drawWidth, drawHeight);
          ctx2.fillStyle = '#ffb95f';
          ctx2.font = `bold ${20 * s}px "JetBrains Mono", monospace`;
          ctx2.textAlign = 'right';
          ctx2.fillText('VERIFICADO', logoX - 25 * s, panelY + 145 * s);
          ctx2.textAlign = 'left';
        } else {
          ctx2.fillStyle = '#ffb95f';
          ctx2.font = `bold ${20 * s}px "JetBrains Mono", monospace`;
          ctx2.textAlign = 'right';
          ctx2.fillText('VERIFICADO', panelX + panelWidth - 30 * s, panelY + 145 * s);
          ctx2.textAlign = 'left';
        }

        setPreviewImage(canvas.toDataURL('image/jpeg', 0.92));
        if (currentDrawId === drawIdRef.current) setIsRendering(false);
      };

      if (logoSrc) {
        const logo = new Image();
        logo.onload = () => finishDrawing(logo);
        logo.onerror = () => finishDrawing(null);
        logo.src = logoSrc;
      } else {
        finishDrawing(null);
      }
    };
    img.onerror = () => {
      console.error('Imagen no válida o corrupta:', imgSrc.substring(0, 50));
      setIsRendering(false);
      advanceBatchIndex();
    };
    img.src = imgSrc;
  };

  // Procesa un archivo individual de la cola
  const processFile = (file: File) => {
    const myDrawId = ++drawIdRef.current;
    setIsRendering(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgSrc = event.target?.result as string;
      const ts = buildTimestamp();
      const updatedLocation = { ...locationRef.current, timestamp: ts };

      setOriginalImage(imgSrc);
      setLocation(updatedLocation);
      locationRef.current = updatedLocation;

      drawWatermark(imgSrc, logoImageRef.current, updatedLocation, myDrawId);
    };
    reader.onerror = () => {
      console.error('No se pudo leer el archivo:', file.name);
      setIsRendering(false);
      advanceBatchIndex();
    };
    reader.readAsDataURL(file);
  };

  // Agrupa archivos a la cola y comienza procesamiento
  const enqueueBatch = (files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`
    }));

    setBatchState(prev => ({
      queue: [...prev.queue, ...newItems],
      isProcessing: true
    }));
  };

  // Avanza la cola: saca el elemento procesado y reseta a 0
  const advanceBatchIndex = () => {
    setBatchState(prev => {
      const remaining = prev.queue.slice(1);
      return {
        queue: remaining,
        isProcessing: remaining.length > 0
      };
    });
  };

  // Efecto que dispara el procesamiento cuando cambia la cola
  useEffect(() => {
    if (batchState.isProcessing && batchState.queue.length > 0) {
      processFile(batchState.queue[0].file);
    }
  }, [batchState.isProcessing, batchState.queue]);

  // Guarda la imagen actual y procesa la siguiente
  const handleSave = () => {
    if (!previewImage || isRendering) return;

    if (settingsRef.current.saveOriginal && originalImage) {
      const linkOriginal = document.createElement('a');
      linkOriginal.download = `original_${Date.now()}.jpg`;
      linkOriginal.href = originalImage;
      linkOriginal.click();
      setTimeout(() => {
        const link = document.createElement('a');
        link.download = `timemark_${Date.now()}.jpg`;
        link.href = previewImage;
        link.click();
      }, 200);
    } else {
      const link = document.createElement('a');
      link.download = `timemark_${Date.now()}.jpg`;
      link.href = previewImage;
      link.click();
    }

    setLogs(prev => [{
      id: Date.now(),
      img: previewImage,
      time: location.timestamp,
      address: `${location.address}, ${location.city}`
    }, ...prev]);

    advanceBatchIndex();
  };

  // Descarta la imagen actual y procesa la siguiente
  const handleDiscard = () => {
    if (isRendering) return;
    advanceBatchIndex();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      enqueueBatch(files);
    }
    e.target.value = '';
  };

  const openTimeModal = () => {
    const d = new Date();
    if (location.timestamp) {
      const parts = location.timestamp.split(' ');
      if (parts.length >= 2) {
        setEditDate(parts[0]);
        setEditTime(parts[1].substring(0, 5));
      } else {
        setEditDate(d.toISOString().split('T')[0]);
        setEditTime(d.toTimeString().slice(0, 5));
      }
    } else {
      setEditDate(d.toISOString().split('T')[0]);
      setEditTime(d.toTimeString().slice(0, 5));
    }
    setIsTimeModalOpen(true);
  };

  const applyCustomTime = () => {
    if (editDate && editTime) {
      const randomSecs = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      const ts = `${editDate} ${editTime}:${randomSecs}`;
      setLocation(prev => ({ ...prev, timestamp: ts }));
      customTimestampRef.current = ts;
    }
    setIsTimeModalOpen(false);
  };

  const openLocationModal = () => {
    setEditLocationDetails({ coords: location.coords, address: location.address, city: location.city });
    setIsLocationModalOpen(true);
  };

  const applyCustomLocation = () => {
    setLocation(prev => ({
      ...prev,
      coords: editLocationDetails.coords,
      address: editLocationDetails.address,
      city: editLocationDetails.city
    }));
    setIsLocationModalOpen(false);
  };

  // Cantidad de elementos pendientes en la cola
  const queueLength = Math.max(0, batchState.queue.length - 1);

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-surface-container border-r border-outline-variant/30 z-50 shrinks-0">
        <div className="p-6 flex flex-col h-full">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-secondary tracking-tight">TimeMark</h1>
            <div className="mt-4 flex items-center gap-3 p-3 bg-surface-container-high rounded-lg border border-outline-variant/20">
              <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface">U4</div>
              <div>
                <p className="text-on-surface font-bold text-sm">{unitName}</p>
                <p className="text-on-surface-variant text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-secondary rounded-full status-pulse"></span>
                  Turno Activo
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { id: 'dashboard', label: 'Panel de Control', Icon: LayoutDashboard },
              { id: 'logs', label: 'Registros de Patrulla', Icon: FileText },
              { id: 'map', label: 'Vista del Mapa', Icon: MapIcon },
              { id: 'settings', label: 'Ajustes', Icon: Settings },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg font-bold transition-colors text-left ${activeTab === id ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-outline-variant/30">
            <button className="flex items-center gap-4 px-4 py-3 w-full text-on-surface-variant hover:bg-surface-bright rounded-lg transition-colors mb-4 text-left">
              <HelpCircle size={20} /> Soporte
            </button>
            <button className="w-full py-3 bg-error-container text-on-error-container font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all text-center">
              Finalizar Turno
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
        <header className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-on-surface">Centro de Mando</h2>
            <p className="text-on-surface-variant">Centro de Vigilancia y Verificación</p>
          </div>
          <div className="glass-card px-6 py-4 rounded-xl text-right shrink-0">
            <div className="font-mono text-xl md:text-2xl text-secondary tabular-nums font-medium">{timeString}</div>
            <div className="font-bold text-xs tracking-widest text-on-surface-variant mt-1 uppercase">{dateString}</div>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="col-span-1 lg:col-span-4 space-y-6 flex flex-col">
                {/* Location Card */}
                <section className="glass-card p-6 rounded-xl flex-1 max-h-64 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold tracking-[0.1em] text-secondary uppercase">Ubicación Actual</h3>
                    <button onClick={openLocationModal} className="text-secondary hover:text-white transition-colors">
                      <Edit2 size={18} />
                    </button>
                  </div>
                  <p className="text-on-surface font-bold text-lg mb-1">{location.address}</p>
                  <p className="text-on-surface-variant text-sm mb-4">{location.city}, RM</p>
                  <div className="flex-1 rounded-lg bg-surface-container-highest relative overflow-hidden flex items-center justify-center min-h-[140px] mt-4">
                    <iframe
                      title="Current Location"
                      width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
                      src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
                      style={{ border: 0, filter: 'contrast(1.2) brightness(0.8) sepia(0.3) hue-rotate(180deg) invert(0.1)' }}
                    />
                    <div className="absolute inset-0 pointer-events-none border border-outline-variant/30 rounded-lg shadow-inner" />
                  </div>
                </section>

                {/* Actions Card */}
                <section className="glass-card p-6 rounded-xl space-y-4">
                  <h3 className="text-[11px] font-bold tracking-[0.1em] text-on-surface-variant uppercase mb-4">Operaciones de Campo</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRendering}
                    className={`w-full flex items-center justify-center md:justify-between px-6 py-4 bg-secondary text-on-secondary font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="flex items-center gap-3"><Camera size={20} /> Tomar foto</span>
                    <span className="hidden md:inline">→</span>
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isRendering}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 border border-outline-variant bg-surface-container-low text-on-surface font-bold rounded-lg hover:bg-surface-variant transition-all ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ImageIcon size={20} /> Seleccionar de galería
                  </button>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isRendering}
                      className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 border border-outline-variant border-dashed text-on-surface-variant font-medium rounded-lg hover:border-secondary transition-all ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Upload size={20} /> {logoImage ? 'Cambiar logo' : 'Cargar logo'}
                    </button>
                    {logoImage && (
                      <button
                        onClick={() => { setLogoImage(null); localStorage.removeItem('timemark_logo'); }}
                        disabled={isRendering}
                        className={`px-4 py-4 border border-error/50 text-error rounded-lg hover:bg-error/10 transition-colors flex items-center justify-center shrink-0 ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Eliminar logo"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                  <input type="file" accept="image/*" multiple ref={galleryInputRef} className="hidden" onChange={handleImageUpload} />
                  <input
                    type="file" accept="image/png, image/jpeg" ref={logoInputRef} className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const r = new FileReader();
                        r.onload = (ev) => {
                          const result = ev.target?.result as string;
                          setLogoImage(result);
                          localStorage.setItem('timemark_logo', result);
                        };
                        r.readAsDataURL(file);
                      }
                    }}
                  />
                </section>
              </div>

              {/* Right Column: Preview */}
              <div className="col-span-1 lg:col-span-8 h-full">
                <section className="glass-card rounded-xl flex flex-col overflow-hidden h-[500px] lg:h-full min-h-[500px]">
                  <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-high/50 shrink-0">
                    <h3 className="text-[11px] font-bold tracking-[0.1em] text-secondary uppercase flex items-center gap-2">
                      <ShieldCheck size={16} /> Vista Previa
                    </h3>
                    <button className="hover:text-secondary hover:bg-surface-variant p-1.5 rounded transition-colors active:scale-95 flex items-center text-on-surface-variant">
                      <Maximize size={18} />
                    </button>
                  </div>

                  <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-4">
                    {previewImage ? (
                      <img src={previewImage} alt="Watermarked" className="max-h-full max-w-full object-contain rounded shadow-2xl" />
                    ) : (
                      <div className="text-center text-on-surface-variant flex flex-col items-center gap-4">
                        <Camera size={48} className="opacity-20" />
                        <p className="font-mono text-sm">{isRendering ? 'Procesando marca de agua...' : 'Esperando captura de imagen...'}</p>
                      </div>
                    )}
                  </div>

                  {previewImage && (
                    <div className="p-4 md:p-6 bg-surface-container-low/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t border-outline-variant/30 shrink-0">
                      <div>
                        <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-2">Integridad</p>
                        <div className="flex gap-2">
                          <span className="bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded font-mono text-xs">MD5: VERIFICADO</span>
                          <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono text-xs">LISTO</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap w-full md:w-auto gap-3 mt-4 md:mt-0">
                        <button
                          onClick={openTimeModal}
                          disabled={isRendering}
                          className={`flex-1 min-w-[100px] border border-outline-variant/50 hover:bg-surface-container text-on-surface rounded-lg font-bold py-2.5 transition-colors flex justify-center gap-2 ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Clock size={16} /> Hora
                        </button>
                        <button
                          onClick={handleDiscard}
                          disabled={isRendering}
                          className={`flex-1 min-w-[100px] bg-surface-container-highest text-on-surface rounded-lg font-bold border border-outline-variant/50 hover:bg-surface-variant transition-colors ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {queueLength > 0 ? `Descartar (+${queueLength})` : 'Descartar'}
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isRendering}
                          className={`flex-1 min-w-[150px] bg-secondary text-on-secondary rounded-lg font-bold shadow-[0_0_15px_rgba(255,185,95,0.2)] hover:brightness-110 active:scale-95 transition-all ${isRendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isRendering ? 'Procesando…' : (queueLength > 0 ? 'Guardar y Siguiente' : 'Guardar')}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <footer className="mt-6 p-6 glass-card rounded-xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Registros</p>
                  <p className="text-xl font-bold text-on-surface">{String(logs.length).padStart(2, '0')}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Unidad Asignada</p>
                  <p className="text-xl font-bold text-on-surface">{unitName}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Logo Activo</p>
                  <p className="text-xl font-bold text-on-surface">{logoImage ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Calidad</p>
                  <p className="text-xl font-bold text-secondary">{settings.resolution}p</p>
                </div>
              </div>
            </footer>
          </>
        ) : activeTab === 'logs' ? (
          <div className="glass-card flex-1 p-8 rounded-xl flex flex-col items-center justify-start text-on-surface-variant h-[calc(100vh-160px)] min-h-[400px] overflow-y-auto w-full">
            <div className="w-full max-w-5xl">
              <h2 className="text-xl md:text-2xl font-bold text-on-surface uppercase tracking-widest mb-8 flex items-center gap-3">
                <FileText className="text-secondary" /> Registros de Patrulla
              </h2>
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-60 mt-20">
                  <FileText size={64} className="mb-6 opacity-50" />
                  <p className="text-lg">No hay registros guardados en este turno.</p>
                  <p className="mt-2 text-sm max-w-md text-center">Toma una foto en el Panel de Control y guárdala para verla aquí.</p>
                  <button onClick={() => setActiveTab('dashboard')} className="mt-8 px-6 py-2 border border-outline-variant rounded-lg text-on-surface hover:bg-surface-container-highest transition-colors">
                    Ir al Panel de Control
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {logs.map(log => (
                    <div key={log.id} className="bg-surface-container border border-outline-variant/30 rounded-xl p-3 overflow-hidden shadow-lg hover:border-secondary/50 transition-all group">
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'map' ? (
          <div className="glass-card flex-1 p-6 md:p-8 rounded-xl flex flex-col text-on-surface-variant h-[calc(100vh-160px)] min-h-[400px] w-full">
            <h2 className="text-xl md:text-2xl font-bold text-on-surface uppercase tracking-widest mb-6 flex items-center gap-3">
              <MapIcon className="text-secondary" /> Vista del Mapa Operativo
            </h2>
            <div className="flex-1 rounded-xl overflow-hidden border border-outline-variant/50 relative shadow-inner bg-surface-container-lowest">
              <iframe
                title="Operational Map"
                width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
                src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
                style={{ border: 0, filter: 'contrast(1.1) brightness(0.9) sepia(0.2) hue-rotate(180deg) invert(0.1)', position: 'absolute', inset: 0 }}
              />
              <div className="absolute top-4 left-4 bg-surface-container/90 backdrop-blur-md p-4 rounded-lg border border-outline-variant/30 shadow-xl max-w-xs">
                <p className="text-[10px] uppercase font-bold tracking-widest text-secondary mb-1">Última Posición</p>
                <p className="text-on-surface text-sm font-bold truncate">{location.address}</p>
                <p className="text-on-surface-variant text-xs mt-1 font-mono">{location.coords}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card flex-1 p-6 md:p-8 rounded-xl flex flex-col items-center justify-start text-on-surface-variant h-[calc(100vh-160px)] min-h-[400px] overflow-y-auto w-full">
            <div className="w-full max-w-2xl">
              <h2 className="text-xl md:text-2xl font-bold text-on-surface uppercase tracking-widest mb-8 flex items-center gap-3">
                <Settings className="text-secondary" /> Ajustes del Sistema
              </h2>
              <div className="space-y-8">
                <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30 shadow-lg">
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                    <ShieldCheck size={16} /> Perfil Operativo
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Identificador de Unidad</label>
                      <input
                        type="text" value={unitName} onChange={e => setUnitName(e.target.value)}
                        className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg p-3.5 text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Resolución de Captura</label>
                      <select
                        value={settings.resolution}
                        onChange={(e) => setSettings(s => ({ ...s, resolution: e.target.value }))}
                        className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg p-3.5 text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                      >
                        <option value="1080">Alta (1080p - Recomendada)</option>
                        <option value="720">Media (720p - Ahorro de datos)</option>
                        <option value="2160">Máxima (4K UHD)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30 shadow-lg">
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                    <Settings size={16} /> Preferencias
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'strictDarkMode', label: 'Modo Nocturno Estricto', desc: 'Fuerza interfaz oscura incluso de día' },
                      { key: 'saveOriginal', label: 'Guardar Copia Original', desc: 'Almacena foto sin marca de agua' },
                    ].map(({ key, label, desc }) => (
                      <div
                        key={key}
                        onClick={() => setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }))}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer border border-transparent hover:border-outline-variant/30"
                      >
                        <div>
                          <p className="text-on-surface font-bold text-sm">{label}</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">{desc}</p>
                        </div>
                        <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${settings[key as keyof typeof settings] ? 'bg-secondary' : 'bg-surface-container-highest'}`}>
                          <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${settings[key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => alert('Configuración guardada exitosamente.')}
                  className="w-full px-6 py-4 bg-secondary text-on-secondary font-bold text-sm rounded-xl hover:brightness-110 shadow-[0_0_20px_rgba(255,185,95,0.15)] active:scale-[0.98] transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Time Edit Modal */}
      {isTimeModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/50 rounded-xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-secondary" />
            <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <Clock size={20} className="text-secondary" /> Ajustar fecha y hora
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Fecha</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/40 rounded-lg p-3 text-on-surface focus:border-secondary transition-colors outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Hora (24h)</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/40 rounded-lg p-3 text-on-surface focus:border-secondary transition-colors outline-none" />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  customTimestampRef.current = null;
                  const now = new Date();
                  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleTimeString('en-US', { hour12: false })}`;
                  setLocation(prev => ({ ...prev, timestamp: ts }));
                  setIsTimeModalOpen(false);
                }}
                className="px-4 py-3 bg-surface-container-highest text-on-surface text-sm font-bold rounded-lg hover:bg-surface-variant flex-1 transition-colors flex items-center justify-center gap-2"
              >
                ↺ Restablecer
              </button>
              <button onClick={applyCustomTime}
                className="px-4 py-3 bg-secondary text-on-secondary text-sm font-bold rounded-lg hover:brightness-110 flex-1 transition-colors text-center shadow-[0_0_15px_rgba(255,185,95,0.2)]">
                Aplicar
              </button>
              <button onClick={() => setIsTimeModalOpen(false)}
                className="px-4 py-3 border border-outline-variant/40 text-on-surface-variant rounded-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Edit Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/50 rounded-xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-secondary" />
            <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-secondary" /> Editar Ubicación
            </h3>
            <div className="space-y-4">
              {[
                { key: 'coords', label: 'Coordenadas', placeholder: "33°36'21.6\"S 70°52'44.4\"W", mono: true },
                { key: 'address', label: 'Dirección', placeholder: 'AVENIDA BERLÍN 34', mono: false },
                { key: 'city', label: 'Ciudad / Sector', placeholder: 'San Miguel', mono: false },
              ].map(({ key, label, placeholder, mono }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">{label}</label>
                  <input
                    type="text"
                    value={editLocationDetails[key as keyof typeof editLocationDetails]}
                    onChange={e => setEditLocationDetails({ ...editLocationDetails, [key]: e.target.value })}
                    placeholder={placeholder}
                    className={`w-full bg-surface-container-high border border-outline-variant/40 rounded-lg p-3 text-on-surface focus:border-secondary transition-colors outline-none text-sm ${mono ? 'font-mono' : ''}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={applyCustomLocation}
                className="px-4 py-3 bg-secondary text-on-secondary text-sm font-bold rounded-lg hover:brightness-110 flex-1 transition-colors text-center shadow-[0_0_15px_rgba(255,185,95,0.2)]">
                Aplicar
              </button>
              <button onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-3 border border-outline-variant/40 text-on-surface-variant rounded-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
