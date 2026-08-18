import React, { useState } from 'react';
import { Palette, FolderTree, Table, FileText, Info, Search, Copy, Check, ExternalLink, Cloud } from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalWorks: number;
  onOpenCloudinary?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  searchQuery,
  onSearchChange,
  totalWorks,
  onOpenCloudinary
}) => {
  const [copied, setCopied] = useState(false);

  const copyPath = () => {
    navigator.clipboard.writeText(DRIVE_ROOT_PATH);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'gallery', label: 'Collections' },
    { id: 'registry', label: 'Index Map' },
    { id: 'explorer', label: 'Drive Vault' },
    { id: 'pages', label: 'Dossier & Bio' },
    { id: 'readme', label: 'Protocol' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-zinc-800">
      {/* Top micro status bar */}
      <div className="bg-black border-b border-zinc-800/80 px-4 sm:px-6 py-1 text-[9px] font-mono text-zinc-500 flex items-center justify-between overflow-x-auto gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400"></span>
            <span className="tracking-widest uppercase text-zinc-400">
              VAULT STATUS: <span className="text-emerald-400">SYNCED</span>
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <button
            onClick={copyPath}
            title="Click to copy DRIVE_ROOT path"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 truncate group cursor-pointer"
          >
            <span className="text-zinc-600 hidden sm:inline">DRIVE_ROOT:</span>
            <span className="truncate">&quot;{DRIVE_ROOT_PATH}&quot;</span>
            {copied ? (
              <span className="text-emerald-400 font-bold ml-1">COPIED</span>
            ) : (
              <Copy className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-300" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 text-zinc-400 flex-shrink-0 tracking-widest uppercase">
          {onOpenCloudinary && (
            <button
              onClick={onOpenCloudinary}
              className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <Cloud className="w-3 h-3 text-sky-400" />
              <span>CLOUDINARY CDN</span>
            </button>
          )}
          <span className="text-zinc-700 hidden sm:inline">|</span>
          <span>ENTITIES: <strong className="text-white font-mono">{totalWorks}</strong></span>
          <span className="text-zinc-700 hidden sm:inline">|</span>
          <span className="text-zinc-500 hidden sm:inline">v1.0.4-LTS</span>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo / System Title */}
          <button
            onClick={() => onNavigate('gallery')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
          >
            <div className="w-3 h-3 bg-white transition-transform group-hover:rotate-45"></div>
            <div className="flex flex-col">
              <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-white group-hover:text-zinc-200 transition-colors font-mono">
                Rory Skagen Archive
              </h1>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-[10px] tracking-widest uppercase font-medium text-zinc-400 font-mono">
            {navItems.map((item) => {
              const isActive =
                currentRoute === item.id ||
                (item.id === 'gallery' && (currentRoute === '' || currentRoute.startsWith('artwork/')));
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative py-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isActive ? 'text-white font-bold' : 'hover:text-white text-zinc-400'
                  }`}
                >
                  {isActive && <span className="w-1 h-1 bg-white inline-block"></span>}
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="h-6 w-px bg-zinc-800 mx-1"></div>

            {/* Cloudinary Action Link */}
            {onOpenCloudinary && (
              <button
                onClick={onOpenCloudinary}
                className="flex items-center gap-1.5 py-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Cloud className="w-3 h-3 text-sky-400" />
                <span>Cloudinary Hub</span>
              </button>
            )}

            {/* Sleek Search Input */}
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-sm border border-zinc-800 focus-within:border-zinc-500 transition-colors">
              <span className="opacity-50 text-xs text-zinc-400">/</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="search_vault"
                className="bg-transparent outline-none w-28 lg:w-36 text-[10px] font-mono text-zinc-200 placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="text-zinc-400 hover:text-white text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => onNavigate('pages')}
              className="py-1.5 px-3.5 bg-white text-black text-[9px] uppercase font-bold tracking-[0.18em] hover:bg-zinc-200 transition-colors rounded-sm cursor-pointer"
            >
              Inquire
            </button>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="md:hidden flex items-center justify-between border-t border-zinc-800 py-2 overflow-x-auto gap-2 text-[10px] font-mono no-scrollbar">
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
                    ? 'bg-zinc-800 text-white font-bold border-b border-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
          {onOpenCloudinary && (
            <button
              onClick={onOpenCloudinary}
              className="flex items-center gap-1 px-2 py-1 uppercase tracking-wider whitespace-nowrap text-sky-400 hover:text-sky-300"
            >
              <Cloud className="w-3 h-3" />
              <span>Cloudinary</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
