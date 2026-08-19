import React from 'react';
import { 
  Lock, 
  ShieldCheck, 
  ArrowLeft, 
  KeyRound, 
  Table, 
  FolderTree, 
  FileText,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface AuthGateViewProps {
  pageName: string;
  onOpenAdminAuth: () => void;
  onBackToHome: () => void;
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  pageName,
  onOpenAdminAuth,
  onBackToHome,
}) => {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-8 sm:p-12 shadow-md rounded-xs text-center space-y-6 transition-colors">
        {/* Security Badge */}
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto rounded-xs">
          <Lock className="w-7 h-7" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
            Studio Portal Restricted Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif">
            {pageName} Protected
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans max-w-md mx-auto">
            Viewing the fine art master catalog, high-resolution dossiers, and studio files requires authentication.
          </p>
        </div>

        {/* Details Box */}
        <div className="p-4 bg-[#F7F6F2] dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-left font-mono text-xs space-y-2 rounded-xs">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
            Access Specifications
          </div>
          <ul className="space-y-1.5 text-zinc-700 dark:text-zinc-300 text-[11px]">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Full collection catalogue &amp; high-res previews</span>
            </li>
            <li className="flex items-center gap-2">
              <Table className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Real-time index synchronization &amp; price registry</span>
            </li>
            <li className="flex items-center gap-2">
              <FolderTree className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Markdown authoring &amp; drive file workspace</span>
            </li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 font-mono text-xs">
          <button
            onClick={onOpenAdminAuth}
            className="w-full sm:w-auto px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs flex items-center justify-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Sign In with Studio Account</span>
          </button>

          <button
            onClick={onBackToHome}
            className="w-full sm:w-auto px-5 py-3 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-[0.2em] text-[11px] transition-colors cursor-pointer rounded-xs flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
