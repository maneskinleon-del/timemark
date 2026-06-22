import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// StrictMode removido intencionalmente: montaba los componentes 2 veces en desarrollo,
// causando race conditions en drawWatermark (procesamiento asíncrono de canvas + cola de imágenes).
createRoot(document.getElementById('root')!).render(<App />);
