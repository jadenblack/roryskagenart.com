import React, { useState } from 'react';
import { 
  Sun, 
  Moon, 
  Lock, 
  ShieldCheck, 
  Menu, 
  X,
  Palette
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenAdminAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  onOpenAdminAuth,
}) => {
  const { toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'gallery', label: 'Catalog' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0C]/95 backdrop-blur-md border-b-2 border-zinc-900 dark:border-zinc-800 transition-colors shadow-xs">
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
            <div className="w-4 h-4 bg-zinc-950 dark:bg-white transition-transform group-hover:rotate-45"></div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-[0.2em] uppercase text-zinc-950 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors font-serif leading-tight">
                Rory Skagen Art
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-500 font-mono">
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
                      ? 'text-zinc-950 dark:text-white font-black'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-950 dark:bg-white animate-in fade-in" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ─────────────────────────────────────────────────────────────
              3. RIGHT CONTROLS (Login + Light/Dark)
          ────────────────────────────────────────────────────────────────*/}
          <div className="hidden md:flex items-center gap-3 font-mono text-xs">
            {/* Login / Admin Status Button */}
            {onOpenAdminAuth && (
              <button
                onClick={onOpenAdminAuth}
                title={isAuthenticated ? 'Studio Admin Authenticated' : 'Studio Portal Sign In'}
                className={`flex items-center gap-1.5 px-3 py-2 border text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer rounded-xs ${
                  isAuthenticated
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                    : 'bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300'
                }`}
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Login</span>
                  </>
                )}
              </button>
            )}

            {/* Theme Toggle (Light/Dark) */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              className="flex items-center justify-center w-9 h-9 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer rounded-xs"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-800" />
              )}
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. MOBILE MENU BUTTON
          ────────────────────────────────────────────────────────────────*/}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xs"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-800" />}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xs cursor-pointer focus:outline-none"
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
          <div className="md:hidden border-t border-zinc-300 dark:border-zinc-800 py-4 space-y-2 font-mono text-xs uppercase tracking-wider animate-in slide-in-from-top-2 duration-200">
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
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="text-[10px]">●</span>}
                </button>
              );
            })}

            {onOpenAdminAuth && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdminAuth();
                  }}
                  className="w-full text-left px-3 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xs flex items-center gap-2"
                >
                  {isAuthenticated ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Admin Portal (Authenticated)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-zinc-500" />
                      <span>Studio Login</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
};
