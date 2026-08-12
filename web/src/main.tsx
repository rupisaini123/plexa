import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { MotionRoot } from './components/MotionRoot';
import 'react-tooltip/dist/react-tooltip.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionRoot>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionRoot>
  </StrictMode>,
);
