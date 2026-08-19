import React, { useState } from 'react';
import { 
  Palette, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  Calendar, 
  Send, 
  CheckCircle2, 
  Maximize2, 
  Layers, 
  FileText, 
  Table, 
  Image as ImageIcon,
  FolderTree,
  Mail,
  Phone,
  Clock
} from 'lucide-react';
import { ArtworkRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { InquiryModal } from './InquiryModal';

interface HomeLandingViewProps {
  onNavigate: (route: string, param?: string) => void;
  onOpenAdminAuth: () => void;
  featuredArtworks: ArtworkRecord[];
  totalWorks: number;
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  onNavigate,
  onOpenAdminAuth,
  featuredArtworks,
  totalWorks,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedInquiryArtwork, setSelectedInquiryArtwork] = useState<ArtworkRecord | null>(null);

  // Fallback featured items if none provided
  const showcaseItems = featuredArtworks.slice(0, 6);

  const handleArtworkInquiry = (art: ArtworkRecord) => {
    setSelectedInquiryArtwork(art);
    setInquiryModalOpen(true);
  };

  const handleProtectedAction = (targetRoute: string, param?: string) => {
    if (isAuthenticated) {
      onNavigate(targetRoute, param);
    } else {
      onOpenAdminAuth();
    }
  };

  return (
    <div id="home-landing-page" className="space-y-16 sm:space-y-24 pb-16 font-sans">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-12 lg:p-16 shadow-xs rounded-xs transition-colors">
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-60"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Micro Status Chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-300 rounded-xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Austin, Texas • Studio Established 1985</span>
          </div>

          {/* Main Title */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif leading-[1.08]">
              Rory Skagen Studio
            </h1>
            <p className="text-xs sm:text-sm md:text-base font-mono uppercase tracking-[0.25em] text-zinc-600 dark:text-zinc-400 font-semibold">
              Original Fine Art • Landmark Murals • Retro Pop Americana
            </p>
          </div>

          {/* Description */}
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-2xl mx-auto font-sans">
            Home of iconic mid-century pop surrealism and public landmark artwork, including the world-famous <em className="font-serif italic font-semibold text-zinc-950 dark:text-white">&ldquo;Greetings from Austin&rdquo;</em> mural. Showcasing four decades of collectible paintings, neon Americana, and architectural mural commissions.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4 font-mono text-xs">
            {isAuthenticated ? (
              <button
                onClick={() => onNavigate('gallery')}
                className="px-6 py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-md flex items-center gap-2"
              >
                <span>Enter Studio Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onOpenAdminAuth}
                className="px-6 py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-md flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Studio Portal Sign In</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectedInquiryArtwork(null);
                setInquiryModalOpen(true);
              }}
              className="px-6 py-3.5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold uppercase tracking-[0.2em] text-[11px] transition-colors cursor-pointer rounded-xs flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Acquisition Inquiry</span>
            </button>
          </div>

          {/* Auth State Note */}
          <div className="pt-4 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            {isAuthenticated ? (
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Signed in as {user?.name || 'Studio Administrator'} — Full catalog unlocked</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-zinc-500" />
                <span>Detailed master catalogue, files &amp; archives reserved for authorized studio sessions.</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. CURATED ARTWORK HIGHLIGHTS */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-300 dark:border-zinc-800 pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">
              PORTFOLIO PREVIEWS
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif">
              Featured Studio Works
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleProtectedAction('gallery')}
              className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{isAuthenticated ? 'View All 700+ Works' : 'Unlock Full Catalog (700+)'}</span>
              {isAuthenticated ? <ArrowRight className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {showcaseItems.map((art) => (
            <article
              key={art.slug}
              className="group bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 rounded-xs overflow-hidden flex flex-col justify-between hover:border-zinc-500 dark:hover:border-zinc-600 transition-all shadow-xs"
            >
              {/* Artwork Media Frame */}
              <div 
                onClick={() => handleProtectedAction('artwork', art.slug)}
                className="relative aspect-4/3 bg-[#F2F1EC] dark:bg-zinc-950 overflow-hidden cursor-pointer flex items-center justify-center p-4"
              >
                {art.imageUrl ? (
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 font-mono text-xs">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <span>{art.title}</span>
                  </div>
                )}

                {/* Status Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-black/80 backdrop-blur-xs text-white text-[9px] font-mono uppercase tracking-wider font-bold rounded-xs">
                    {art.status}
                  </span>
                  {art.year && (
                    <span className="px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 text-[9px] font-mono font-bold rounded-xs border border-zinc-300 dark:border-zinc-700">
                      {art.year}
                    </span>
                  )}
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-mono text-xs font-bold uppercase tracking-wider gap-1.5">
                  {isAuthenticated ? (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>Inspect Artwork</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Sign In to Inspect</span>
                    </>
                  )}
                </div>
              </div>

              {/* Artwork Metadata Box */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
                    {art.medium || 'Acrylic on Canvas'} • {art.dimensions || 'Studio Scale'}
                  </span>
                  <h3 
                    onClick={() => handleProtectedAction('artwork', art.slug)}
                    className="font-serif font-black text-lg text-zinc-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer uppercase line-clamp-1"
                  >
                    {art.title}
                  </h3>
                  {art.narrative && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                      {art.narrative}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-200">
                    {art.price || 'Inquire for Price'}
                  </span>
                  <button
                    onClick={() => handleArtworkInquiry(art)}
                    className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Inquire</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. STUDIO PILLARS & ARTIST BACKGROUND */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 space-y-3 rounded-xs shadow-xs">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center justify-center rounded-xs font-mono font-black text-sm">
            01
          </div>
          <h3 className="font-serif font-black uppercase text-lg text-zinc-950 dark:text-white">
            Austin Heritage &amp; Murals
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Co-creator of the iconic South 1st &ldquo;Greetings from Austin&rdquo; postcard mural and influential figures behind the South Austin Pop Culture Center, celebrating Central Texas folklore and vibrant roadside history.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 space-y-3 rounded-xs shadow-xs">
          <div className="w-10 h-10 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 flex items-center justify-center rounded-xs font-mono font-black text-sm">
            02
          </div>
          <h3 className="font-serif font-black uppercase text-lg text-zinc-950 dark:text-white">
            Retro Pop Mastery
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Signature aesthetic merging 1950s commercial billboard techniques, neon typography, airbrush shading, and surrealist character designs that evoke mid-century optimism with a subversive modern edge.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 space-y-3 rounded-xs shadow-xs">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center rounded-xs font-mono font-black text-sm">
            03
          </div>
          <h3 className="font-serif font-black uppercase text-lg text-zinc-950 dark:text-white">
            Custom Commissions
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            Available for private client commissions, commercial architectural murals, gallery exhibitions, and museum acquisitions worldwide with complete provenance and archival specifications.
          </p>
        </div>
      </section>

      {/* 4. PROTECTED PORTAL GATEWAY SECTION */}
      <section className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-8 sm:p-12 rounded-xs shadow-xs transition-colors">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Studio Portal &amp; Catalog Management</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif">
              Master Archive &amp; Administrative Workspace
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              The full portfolio features over 700 fine art works, interactive scale visualizers, real-time index synchronization, and cloud media management. Access is authenticated for studio curators, collectors, and staff.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-zinc-500" />
                <span>Master Catalog</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-zinc-500" />
                <span>Drive Workspace</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>Cloudinary CDN</span>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto text-center">
            {isAuthenticated ? (
              <div className="p-6 bg-[#F2F1EC] dark:bg-zinc-900 border border-emerald-400 dark:border-emerald-700 space-y-3 rounded-xs">
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
                  ✓ Session Authenticated
                </div>
                <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 font-bold">
                  {user?.name || 'Administrator'}
                </div>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="w-full px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs"
                >
                  Enter Studio Catalog
                </button>
              </div>
            ) : (
              <div className="p-6 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 space-y-4 rounded-xs">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-bold flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span>Authorized Personnel Only</span>
                </div>
                <button
                  onClick={onOpenAdminAuth}
                  className="w-full px-6 py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sign In to Studio Portal</span>
                </button>
                <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  Password protected via scrypt encryption
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Inquiry Modal */}
      <InquiryModal
        artwork={selectedInquiryArtwork}
        isOpen={inquiryModalOpen}
        onClose={() => {
          setInquiryModalOpen(false);
          setSelectedInquiryArtwork(null);
        }}
      />
    </div>
  );
};
