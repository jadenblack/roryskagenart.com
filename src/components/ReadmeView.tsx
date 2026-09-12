import React, { useState } from 'react';
import { Copy, Check, Terminal, FolderTree } from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';

interface ReadmeViewProps {
  readmeContent: string;
  onOpenExplorer: () => void;
}

export const ReadmeView: React.FC<ReadmeViewProps> = ({ readmeContent, onOpenExplorer }) => {
  const [copied, setCopied] = useState(false);

  const copyReadme = () => {
    navigator.clipboard.writeText(readmeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-16 font-mono">
      {/* Header */}
      <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 flex items-center justify-between flex-wrap gap-4 shadow-xs transition-colors rounded-xs">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-2 font-bold">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span>ARCHITECTURE SPECIFICATIONS (readme.md)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans">
            Studio System &amp; Architecture Specs
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 font-sans">
            Parsed from <code className="text-zinc-900 dark:text-zinc-300 font-bold">studio-archive/readme.md</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyReadme}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-500" />
                <span>Copy readme.md</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenExplorer}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs"
          >
            <FolderTree className="w-3 h-3" />
            <span>Open in Catalog Files</span>
          </button>
        </div>
      </div>

      {/* Guidelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-5 space-y-2 shadow-xs transition-colors rounded-xs">
          <span className="text-zinc-900 dark:text-white text-[9px] font-black uppercase tracking-widest block">1. File Architecture</span>
          <h3 className="font-bold text-zinc-950 dark:text-white text-sm uppercase">Catalog Store</h3>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Content is loaded from <code className="text-zinc-900 dark:text-zinc-300 font-bold">index.md</code>, <code className="text-zinc-900 dark:text-zinc-300 font-bold">posts/*.md</code>, and <code className="text-zinc-900 dark:text-zinc-300 font-bold">images/</code>.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-5 space-y-2 shadow-xs transition-colors rounded-xs">
          <span className="text-zinc-900 dark:text-white text-[9px] font-black uppercase tracking-widest block">2. Wikilink Engine</span>
          <h3 className="font-bold text-zinc-950 dark:text-white text-sm uppercase">Automatic Hyperlinking</h3>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Internal links like <code className="text-zinc-900 dark:text-zinc-300 font-bold">[[posts/slug]]</code> and <code className="text-zinc-900 dark:text-zinc-300 font-bold">[[pages/about]]</code> are resolved in real time into client SPA hash routes.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-5 space-y-2 shadow-xs transition-colors rounded-xs">
          <span className="text-zinc-900 dark:text-white text-[9px] font-black uppercase tracking-widest block">3. Media Resolver</span>
          <h3 className="font-bold text-zinc-950 dark:text-white text-sm uppercase">Media &amp; CDN Mapping</h3>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Markdown image tags <code className="text-zinc-900 dark:text-zinc-300 font-bold">![alt](images/file.svg)</code> dynamically render high-res visuals with lightbox zoom and scale measurement tools.
          </p>
        </div>
      </div>

      {/* Raw Markdown Rendered Box */}
      <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 shadow-xs transition-colors rounded-xs">
        <h2 className="text-[10px] text-zinc-600 dark:text-zinc-500 uppercase tracking-widest mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-bold">
          <span>Source: studio-archive/readme.md</span>
          <span className="text-[9px] text-zinc-500">RAW BUFFER</span>
        </h2>
        <pre className="p-6 bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap rounded-xs">
          {readmeContent}
        </pre>
      </div>
    </div>
  );
};
