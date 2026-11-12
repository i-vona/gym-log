import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { I18nProvider } from './i18n';
import { ensureSeed } from './db';
import { TimerProvider } from './timer';

// Ask the browser not to evict our data when the phone is low on storage.
navigator.storage?.persist?.().catch(() => {});
ensureSeed().catch((e) => console.error('seed failed', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <TimerProvider>
        <App />
      </TimerProvider>
    </I18nProvider>
  </StrictMode>,
);
