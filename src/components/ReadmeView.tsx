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
      <div className="bg-black border border-zinc-800 p-6 sm:p-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-500 mb-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span>ARCHITECTURE GUIDELINES (readme.md)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-sans">
            Google Drive Ecosystem &amp; System Specs
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Directly parsed from <code className="text-zinc-300">{DRIVE_ROOT_PATH}readme.md</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyReadme}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-400" />
                <span>Copy readme.md</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenExplorer}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <FolderTree className="w-3 h-3" />
            <span>Open in Explorer</span>
          </button>
        </div>
      </div>

      {/* Guidelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0D0D10] border border-zinc-800 p-5 space-y-2">
          <span className="text-white text-[9px] font-bold uppercase tracking-widest block">1. File Architecture</span>
          <h3 className="font-bold text-white text-sm uppercase">Static Content Driven</h3>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
            Content is loaded straight from <code className="text-zinc-300">index.md</code>, <code className="text-zinc-300">posts/*.md</code>, and <code className="text-zinc-300">images/</code> without any external database dependencies.
          </p>
        </div>

        <div className="bg-[#0D0D10] border border-zinc-800 p-5 space-y-2">
          <span className="text-white text-[9px] font-bold uppercase tracking-widest block">2. Wikilink Engine</span>
          <h3 className="font-bold text-white text-sm uppercase">Automatic Hyperlinking</h3>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
            Internal shortcuts like <code className="text-zinc-300">[[posts/slug]]</code> and <code className="text-zinc-300">[[pages/about]]</code> are resolved in real time into client SPA hash routes.
          </p>
        </div>

        <div className="bg-[#0D0D10] border border-zinc-800 p-5 space-y-2">
          <span className="text-white text-[9px] font-bold uppercase tracking-widest block">3. Media Resolver</span>
          <h3 className="font-bold text-white text-sm uppercase">Direct Asset Mapping</h3>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
            Markdown image tags <code className="text-zinc-300">![alt](images/file.svg)</code> dynamically render high-res vector visuals with lightbox zoom and scale measurement tools.
          </p>
        </div>
      </div>

      {/* Raw Markdown Rendered Box */}
      <div className="bg-[#0D0D10] border border-zinc-800 p-6 sm:p-8">
        <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4 pb-2 border-b border-zinc-800 flex items-center justify-between">
          <span>Source: {DRIVE_ROOT_PATH}readme.md</span>
          <span className="text-[9px] text-zinc-600">RAW BUFFER</span>
        </h2>
        <pre className="p-6 bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {readmeContent}
        </pre>
      </div>
    </div>
  );
};
