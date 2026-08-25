import React, { useState } from 'react';
import { PageDocument } from '../types';
import { Info, Mail, Award, Palette, Send, CheckCircle2 } from 'lucide-react';

interface PagesViewProps {
  pages: PageDocument[];
  activePageSlug: string;
  onSelectPage: (slug: string) => void;
  onSelectArtwork: (slug: string) => void;
  renderedHtmlMap: Record<string, string>;
}

export const PagesView: React.FC<PagesViewProps> = ({
  pages,
  activePageSlug,
  onSelectPage,
  onSelectArtwork,
  renderedHtmlMap
}) => {
  const currentPage = pages.find((p) => p.slug === activePageSlug) || pages[0];
  const [formSent, setFormSent] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderMessage, setSenderMessage] = useState('');

  // Handle Wikilink clicks inside markdown rendered HTML
  const handlePageContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const linkEl = target.closest('a');
    if (!linkEl) return;

    const href = linkEl.getAttribute('href');
    if (href && href.startsWith('#artwork/')) {
      e.preventDefault();
      const slug = href.replace('#artwork/', '');
      onSelectArtwork(slug);
    } else if (href && href.startsWith('#page/')) {
      e.preventDefault();
      const pageSlug = href.replace('#page/', '');
      onSelectPage(pageSlug);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
  };

  const pageNav = [
    { slug: 'about', label: 'Biography and Legacy', icon: Info },
    { slug: 'commissions', label: 'Mural and Canvas Commissions', icon: Palette },
    { slug: 'exhibitions', label: 'Exhibitions and Collections', icon: Award },
    { slug: 'contact', label: 'Studio Inquiries', icon: Mail },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16 font-mono">
      {/* Page Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-2 text-[10px] shadow-xs transition-colors rounded-xs">
        {pageNav.map((nav) => {
          const Icon = nav.icon;
          const isSelected = currentPage.slug === nav.slug;
          return (
            <button
              key={nav.slug}
              onClick={() => onSelectPage(nav.slug)}
              className={`flex items-center gap-2 px-4 py-2 uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer font-bold rounded-xs ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-emerald-500 dark:border-emerald-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-200 hover:bg-[#F2F1EC] dark:hover:bg-zinc-900/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{nav.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Page Article Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Document Content */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-10 space-y-6 shadow-xs transition-colors">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <span className="text-[9px] text-zinc-600 dark:text-zinc-500 uppercase tracking-widest block mb-1 font-bold">
              DOCUMENT: pages/{currentPage.slug}.md
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans">
              {currentPage.title}
            </h1>
            {currentPage.subtitle && (
              <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 font-sans">{currentPage.subtitle}</p>
            )}
          </div>

          <div
            onClick={handlePageContentClick}
            dangerouslySetInnerHTML={{ __html: renderedHtmlMap[currentPage.slug] || '' }}
            className="prose prose-zinc dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-300 text-xs sm:text-sm leading-relaxed"
          />
        </div>

        {/* Right Sidebar: Studio Factsheet & Interactive Contact */}
        <div className="lg:col-span-4 space-y-6">
          {/* Studio Quick Factsheet */}
          <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 space-y-4 shadow-xs transition-colors">
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-950 dark:text-white font-black flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-zinc-950 dark:bg-white inline-block"></span>
              <span>Rory Skagen Studio Facts</span>
            </h3>
            <ul className="space-y-3 text-[10px] text-zinc-700 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">▪</span>
                <span>Co-Creator of world-famous <em>Greetings from Austin</em> (1998) mural</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">▪</span>
                <span>Active in Austin art and cosmic pop culture since the 1980s</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">▪</span>
                <span>Represented by Yard Dog Gallery (Austin) &amp; Desert Pop (Santa Fe)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">▪</span>
                <span>Specializes in monumental outdoor masonry murals and fine oil on canvas</span>
              </li>
            </ul>
          </div>

          {/* Interactive Fast Dispatch Form */}
          <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 space-y-4 shadow-xs transition-colors">
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-950 dark:text-white font-black flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Direct Studio Dispatch</span>
            </h3>

            {formSent ? (
              <div className="text-center py-6 space-y-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 p-4 rounded-xs">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">Inquiry Transmitted</p>
                <p className="text-[9px] text-zinc-600 dark:text-zinc-400">Rory Skagen Studio will respond to {senderEmail} promptly.</p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-3 text-[10px]">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Your Name</label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Collector / Curator"
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Email</label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="collector@domain.com"
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Message</label>
                  <textarea
                    rows={3}
                    required
                    value={senderMessage}
                    onChange={(e) => setSenderMessage(e.target.value)}
                    placeholder="Inquiry regarding available works, canvas acquisitions, or mural commissions..."
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs"
                >
                  Send Studio Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
