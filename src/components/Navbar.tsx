import React, { useState } from 'react';
import { 
  Sun, 
  Moon, 
  Menu, 
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate
}) => {
  const { toggleTheme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'gallery', label: 'Catalog' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact Me' },
    ...(isAuthenticated ? [{ id: '/admin', label: 'Dashboard' }] : []),
  ];

  const handleNavClick = (id: string) => {
    // Every link goes through the router. Writing `window.location.hash` directly here used to be
    // harmless, but the canonical artwork route lives in the *pathname*: from `/artwork/<slug>`
    // a direct hash write would leave the path in place and the router would keep rendering the
    // artwork. `onNavigate` is what clears the path.
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b-2 border-line-strong transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* ─────────────────────────────────────────────────────────────
              1. BRAND LOGO (Left)
          ────────────────────────────────────────────────────────────────*/}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
            aria-label="Rory Skagen Art Home"
          >
            <img
              src="/android-chrome-192x192.png"
              alt=""
              className="h-9 w-9 rounded-md transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-[0.2em] uppercase text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors font-serif leading-tight">
                Rory Skagen Art
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono">
                Austin, Texas • Est. 1985
              </span>
            </div>
          </button>

          {/* ─────────────────────────────────────────────────────────────
              2. DESKTOP PUBLIC NAV LINKS (Center)
          ────────────────────────────────────────────────────────────────*/}
          <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-[0.18em] font-bold">
            {navLinks.map((link) => {
              const isActive =
                currentRoute === link.id ||
                (link.id === 'gallery' && (currentRoute === 'catalog' || currentRoute.startsWith('artwork/')));

              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`py-1.5 transition-all cursor-pointer relative ${
                    isActive
                      ? 'text-foreground font-black'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-line-strong animate-in fade-in" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ─────────────────────────────────────────────────────────────
              3. RIGHT CONTROLS (Light/Dark)
          ────────────────────────────────────────────────────────────────*/}
          <div className="hidden md:flex items-center gap-3 font-mono text-xs">
            {/* Theme Toggle (Light/Dark) */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              className="flex items-center justify-center w-9 h-9 bg-surface-deep hover:bg-muted border border-line text-foreground transition-colors cursor-pointer rounded-xs flex-shrink-0"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-foreground/80" />
              )}
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. MOBILE MENU BUTTON
          ────────────────────────────────────────────────────────────────*/}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 bg-surface-deep border border-line text-foreground rounded-xs"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-foreground/80" />}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-primary text-primary-foreground rounded-xs cursor-pointer focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            5. MOBILE DROPDOWN MENU
        ────────────────────────────────────────────────────────────────*/}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-line py-4 space-y-2 font-mono text-xs uppercase tracking-wider animate-in slide-in-from-top-2 duration-200">
            {navLinks.map((link) => {
              const isActive =
                currentRoute === link.id ||
                (link.id === 'gallery' && (currentRoute === 'catalog' || currentRoute.startsWith('artwork/')));
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xs transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'text-foreground/80 hover:bg-muted'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="text-[10px]">●</span>}
                </button>
              );
            })}

          </div>
        )}

      </div>
    </header>
  );
};
