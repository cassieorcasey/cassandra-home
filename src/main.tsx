import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/bottom-bar.css';

// Probe frame: median 60 frame pertama > 24ms → mode hemat (tanpa blur, kilau, ripple)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const t: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      t.push(now - last);
      last = now;
      if (t.length < 60) return requestAnimationFrame(tick);
      t.sort((a, b) => a - b);
      if (t[30] > 24) document.documentElement.dataset.perf = 'lite';
    };
    requestAnimationFrame(tick);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
