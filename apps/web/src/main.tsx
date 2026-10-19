import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fontsource-variable/geist';
import './styles/tokens.css';
import './styles/global.css';
import './styles/spreadsheet.css';
import './styles/pages.css';
import './styles/landing.css';
import './styles/header.css';
import './styles/sprint.css';
import { AppRoutes, Providers } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
