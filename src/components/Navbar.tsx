import React, { useState } from 'react';
import { 
  Palette, 
  FolderTree, 
  Table, 
  FileText, 
  Info, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Cloud, 
  Trash2,
  Sun,
  Moon,
  Sparkles,
  Lock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalWorks: number;
  trashedCount?: number;
  onOpenCloudinary?: () => void;
  onOpenAdminAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  searchQuery,
  onSearchChange,
  totalWorks,
  trashedCount = 0,
  onOpenCloudinary,
  onOpenAdminAuth
}) => {
  const [copied, setCopied] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const copyPath = () => {
    navigator.clipboard.writeText(DRIVE_ROOT_PATH);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'gallery', label: 'Fine Art Works' },
    { id: 'registry', label: 'Master Catalog' },
    { id: 'trash', label: 'Trash', badge: trashedCount > 0 ? trashedCount : undefined },
    { id: 'explorer', label: 'Drive Files' },
    { id: 'pages', label: 'About & Inquire' },
    { id: 'readme', label: 'Specs' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/90 backdrop-blur-md border-b border-zinc-300 dark:border-zinc-800 transition-colors shadow-xs">
      {/* Top micro status bar */}
      <div className="bg-[#ECEBE6] dark:bg-black border-b border-zinc-300 dark:border-zinc-800/80 px-4 sm:px-6 py-1 text-[9px] font-mono text-zinc-600 dark:text-zinc-500 flex items-center justify-between overflow-x-auto gap-4 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="tracking-widest uppercase text-zinc-700 dark:text-zinc-400 font-bold">
              STUDIO CATALOG: <span className="text-emerald-700 dark:text-emerald-400">ACTIVE &amp; AVAILABLE</span>
            </span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <button
            onClick={copyPath}
            title="Click to copy DRIVE_ROOT path"
            className="text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5 truncate group cursor-pointer"
          >
            <span className="text-zinc-500 dark:text-zinc-600 hidden sm:inline font-medium">DRIVE_ROOT:</span>
            <span className="truncate">&quot;{DRIVE_ROOT_PATH}&quot;</span>
            {copied ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold ml-1">COPIED</span>
            ) : (
              <Copy className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-300" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 text-zinc-700 dark:text-zinc-400 flex-shrink-0 tracking-widest uppercase">
          {onOpenCloudinary && (
            <button
              onClick={onOpenCloudinary}
              className="flex items-center gap-1 text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer font-medium"
            >
              <Cloud className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              <span>CLOUDINARY CDN</span>
            </button>
          )}
          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>
          <span>ORIGINAL WORKS: <strong className="text-zinc-900 dark:text-white font-mono font-bold">{totalWorks}</strong></span>
          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>
          <span className="text-zinc-500 hidden sm:inline">Austin, Texas</span>
          {onOpenAdminAuth && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>
              <button
                onClick={onOpenAdminAuth}
                className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
                  isAuthenticated
                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                }`}
                title={isAuthenticated ? 'Studio Admin Authenticated' : 'Admin Sign In'}
              >
                {isAuthenticated ? (
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-2.5 h-2.5 text-zinc-500" />
                )}
                <span>{isAuthenticated ? `ADMIN: ${user?.name?.toUpperCase() || 'ACTIVE'}` : 'STUDIO ADMIN'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Logo / Studio Brand Title */}
          <button
            onClick={() => onNavigate('gallery')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
          >
            <div className="w-3.5 h-3.5 bg-zinc-900 dark:bg-white transition-transform group-hover:rotate-45"></div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black tracking-[0.2em] uppercase text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors font-mono leading-none">
                Rory Skagen Studio
              </span>
              <span className="text-[8px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Fine Art Gallery &amp; Original Works
              </span>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-5 text-[10px] tracking-widest uppercase font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
            {navItems.map((item) => {
              const isActive =
                currentRoute === item.id ||
                (item.id === 'gallery' && (currentRoute === '' || currentRoute.startsWith('artwork/')));
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative py-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isActive 
                      ? 'text-zinc-950 dark:text-white font-bold' 
                      : 'hover:text-zinc-950 dark:hover:text-white text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {isActive && <span className="w-1 h-1 bg-zinc-950 dark:bg-white inline-block"></span>}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 text-[8px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-1"></div>

            {/* Admin Key Button */}
            {onOpenAdminAuth && (
              <button
                onClick={onOpenAdminAuth}
                title={isAuthenticated ? 'Manage Studio Admin / Change Password' : 'Studio Admin Sign In'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-[9px] uppercase tracking-wider transition-colors cursor-pointer rounded-xs font-mono font-bold ${
                  isAuthenticated
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                    : 'bg-[#EAE9E4] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Admin: {user?.name?.split(' ')[0] || 'Studio'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span>Admin</span>
                  </>
                )}
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EAE9E4] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-[9px] uppercase tracking-wider transition-colors cursor-pointer rounded-xs"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-zinc-800" />
                  <span className="font-bold">Dark</span>
                </>
              )}
            </button>

            {/* Sleek Search Input */}
            <div className="flex items-center gap-2 bg-[#EAE9E4] dark:bg-zinc-900 px-3 py-1.5 rounded-xs border border-zinc-300 dark:border-zinc-800 focus-within:border-zinc-500 dark:focus-within:border-zinc-500 transition-colors">
              <span className="opacity-50 text-xs text-zinc-500 dark:text-zinc-400">/</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="search_artworks..."
                className="bg-transparent outline-none w-28 lg:w-36 text-[10px] font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => onNavigate('pages')}
              className="py-1.5 px-3.5 bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-[9px] uppercase font-bold tracking-[0.18em] transition-colors rounded-xs cursor-pointer shadow-xs"
            >
              Acquire / Inquire
            </button>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="md:hidden flex items-center justify-between border-t border-zinc-300 dark:border-zinc-800 py-2 overflow-x-auto gap-2 text-[10px] font-mono no-scrollbar">
          {navItems.map((item) => {
            const isActive =
              currentRoute === item.id ||
              (item.id === 'gallery' && (currentRoute === '' || currentRoute.startsWith('artwork/')));
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-1 px-2 py-1 uppercase tracking-wider whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold border-b border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 px-2 py-1 uppercase tracking-wider whitespace-nowrap text-zinc-800 dark:text-zinc-200"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
