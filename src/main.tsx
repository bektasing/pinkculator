import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installBackButton } from './platform/backButton';
import { installViewportGuards } from './platform/viewport';

installViewportGuards();
installBackButton();

const root = document.getElementById('root');
if (!root) throw new Error('#root bulunamadı');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
