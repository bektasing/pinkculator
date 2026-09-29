import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installSounds } from './audio/sounds';
import { installBackButton } from './platform/backButton';
import { hideSplashWhenReady } from './platform/splash';
import { installViewportGuards } from './platform/viewport';

installViewportGuards();
installBackButton();
installSounds();

const root = document.getElementById('root');
if (!root) throw new Error('#root bulunamadı');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
hideSplashWhenReady();
