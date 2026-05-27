import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './Sidebar';
// Import the compiled Tailwind CSS as a string so we can inject it into a
// shadow root and avoid leaking styles into (or inheriting from) the page.
import styles from '../index.css?inline';

const HOST_ID = 'kalshi-edge-root';

function mount() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(
    <StrictMode>
      <Sidebar />
    </StrictMode>,
  );
}

mount();
