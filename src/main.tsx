// Imported first, and called, so its module body runs before anything that
// constructs the Supabase client: it captures the invite/recovery `type` from
// the URL fragment, which supabase-js blanks during its own initialization.
// See src/lib/authRedirect.ts.
import { getAuthHandoff } from './lib/authRedirect';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { PaletteProvider } from './context/PaletteContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';

void getAuthHandoff();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PaletteProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PaletteProvider>
    </ThemeProvider>
  </StrictMode>,
);
