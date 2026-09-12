import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  Award, 
  Palette, 
  Layers, 
  Mail, 
  ArrowRight, 
  Compass, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { resolveAssetUrl } from '../data/assetResolver';

interface AboutViewProps {
  onNavigate: (route: string, param?: string) => void;
  onOpenInquiry: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate, onOpenInquiry }) => {
  const roryPhotoUrl = resolveAssetUrl('Rory-Skagen-Photo.jpg', 'rory-skagen-photo', 'hero') ||
    'https://res.cloudinary.com/xjilp2pq/image/upload/v1787077006/Rory-Skagen-Photo.jpg';

  const austinMuralUrl = resolveAssetUrl('austin-Recovered-copy.jpg', 'greetings-from-austin', 'hero') ||
    'https://res.cloudinary.com/xjilp2pq/image/upload/v1787076989/austin-Recovered-copy.jpg';

  const drebblesUrl = resolveAssetUrl('drebbles-copy.jpg', 'drebbles', 'hero') ||
    'https://res.cloudinary.com/xjilp2pq/image/upload/v1787076993/drebbles-copy.jpg';

  return (
    <div className="space-y-12 sm:space-y-16 pb-20 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HERO EDITORIAL HEADER
      ────────────────────────────────────────────────────────────────*/}
      <header className="border-b-2 border-zinc-900 dark:border-zinc-700 pb-8 space-y-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
          <span>Artist Biography and Studio Heritage • Austin, Texas</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif leading-none">
          About Rory Skagen
        </h1>
        <p className="text-sm sm:text-base font-mono uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400 font-semibold max-w-3xl">
          Four Decades of Pop Art, Atomic Americana and Landmark Texas Murals
        </p>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. BIOGRAPHY & ARTIST PORTRAIT GRID
      ────────────────────────────────────────────────────────────────*/}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Portrait & Studio Credentials */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-4 sm:p-5 shadow-md space-y-4">
            <div className="relative aspect-4/5 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden">
              <img
                src={roryPhotoUrl}
                alt="Rory Skagen in Studio"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
                loading="eager"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-xs text-white p-3 text-[11px] font-mono text-center">
                Rory Skagen • Studio Master Artist
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs pt-2">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">Studio Origin:</span>
                <span className="font-bold text-zinc-900 dark:text-white">Austin, Texas (Est. 1985)</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">Key Mediums:</span>
                <span className="font-bold text-zinc-900 dark:text-white">Enamel, Canvas, Steel, Murals</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">Cultural Heritage:</span>
                <span className="font-bold text-zinc-900 dark:text-white">Co-Founder, SouthPop Center</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 uppercase">Public Landmark:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Greetings from Austin Mural</span>
              </div>
            </div>
          </div>

          {/* Quick Contact & Inquire Box */}
          <div className="bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-6 space-y-4 rounded-xs">
            <h3 className="font-serif font-black text-lg uppercase tracking-tight text-zinc-950 dark:text-white">
              Studio Representation and Inquiries
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              Original panel enamels, large banner paintings, and commissioned murals are available directly through the studio and authorized gallery representations.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onNavigate('contact')}
                className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-mono font-bold uppercase tracking-wider text-xs hover:bg-black transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact Me</span>
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className="w-full py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono font-bold uppercase tracking-wider text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>View Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Full Narrative & History */}
        <div className="lg:col-span-7 space-y-8 text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
          
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif border-b border-zinc-300 dark:border-zinc-800 pb-2">
              The Vision of Rory Skagen
            </h2>
            <p className="text-base sm:text-lg text-zinc-700 dark:text-zinc-300 font-serif italic leading-relaxed">
              &ldquo;My work lives at the intersection of atomic-age optimism, creature-feature dread, and the faded neon romance of mid-century commercial Americana.&rdquo;
            </p>
            <p className="text-sm sm:text-base">
              Rory Skagen is one of Austin&apos;s most celebrated visual artists and muralists. Since establishing his studio in Central Texas in the mid-1980s, Skagen has produced hundreds of original paintings, monumental outdoor murals, and commercial art pieces that have defined the visual identity of Austin&apos;s creative landscape.
            </p>
            <p className="text-sm sm:text-base">
              Drawing inspiration from 1950s cinema lobby cards, carnival sideshow canvas banners, vintage food advertisements, and Japanese Kaiju monsters, Skagen crafts rich, satirical, and deeply textured works that feel both nostalgically familiar and strikingly surreal.
            </p>
          </div>

          {/* Landmark Section: Greetings from Austin */}
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Award className="w-4 h-4" />
              <span>Historic Austin Icon</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif">
              The &ldquo;Greetings from Austin&rdquo; Mural (1998)
            </h3>
            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
              In 1998, Rory Skagen, along with collaborator Bill Johnston, painted the world-famous <strong className="text-zinc-950 dark:text-white">&ldquo;Greetings from Austin&rdquo;</strong> postcard mural on the side of Roadhouse Relics at South 1st and Annie Street.
            </p>
            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
              Transforming a 1940s Curt Teich large-letter linen postcard into a 20-foot outdoor landmark, the mural has become the undisputed cultural beacon of Austin, photographed by millions of visitors, featured in films, television, and international travel documentaries.
            </p>
          </div>

          {/* SouthPop & Cultural Stewardship */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif border-b border-zinc-300 dark:border-zinc-800 pb-2">
              SouthPop &amp; Community Roots
            </h3>
            <p className="text-sm sm:text-base">
              Skagen co-founded the <strong>South Austin Popular Culture Center (SouthPop)</strong> alongside cultural preservationists Leea Mechling and Henry Gonzalez. Dedicated to archiving the rich tapestry of Central Texas music history, psychedelic poster art, Armadillo World Headquarters memorabilia, and underground counterculture, Skagen has served as a devoted custodian of Austin&apos;s artistic heritage.
            </p>
          </div>

          {/* Mediums & Techniques */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif border-b border-zinc-300 dark:border-zinc-800 pb-2">
              Techniques &amp; Craftsmanship
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#F4F3ED] dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white block mb-1 uppercase">
                  Sign Enamels on Steel
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Industrial high-gloss sign enamels applied to custom steel and hardwood panels with multi-coat automotive clear patinas.
                </span>
              </div>
              <div className="bg-[#F4F3ED] dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white block mb-1 uppercase">
                  Sideshow Banners
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Heavy canvas banners with hand-stitched leather corners, brass grommets, and weather-resistant paints echoing 1940s carnival art.
                </span>
              </div>
              <div className="bg-[#F4F3ED] dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white block mb-1 uppercase">
                  Monumental Murals
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Large-scale exterior brick and masonry installations, including public art for Planet K Texas, commercial venues, and private estates.
                </span>
              </div>
              <div className="bg-[#F4F3ED] dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white block mb-1 uppercase">
                  Hand-Lettered Satire
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Original typographic compositions evoking mid-century apothecary packaging, Tiki lounges, and atomic cinema title cards.
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. SIGNATURE THEMES & EXHIBITION SERIES
      ────────────────────────────────────────────────────────────────*/}
      <section className="border-t-2 border-zinc-900 dark:border-zinc-700 pt-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-zinc-300 dark:border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500 font-bold block mb-1">
              STUDIO THEMATIC CANON
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif">
              Signature Art Series
            </h2>
          </div>
          <button
            onClick={() => onNavigate('gallery')}
            className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Explore All Works in Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">01 • SERIES</span>
            <h4 className="font-serif font-bold text-lg text-zinc-950 dark:text-white uppercase">Kaiju &amp; Atomic Paranoia</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Majestic, solitary behemoths like <em>Kirunam</em>, <em>Terrordon</em>, and <em>Jigoku</em> wandering dystopian mid-century metropolises.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">02 • SERIES</span>
            <h4 className="font-serif font-bold text-lg text-zinc-950 dark:text-white uppercase">Vintage Advertisements</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Fictional mid-century apothecary remedies, pine medicines (<em>Drebbles</em>), and satirical consumer goods in rich sign enamels.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">03 • SERIES</span>
            <h4 className="font-serif font-bold text-lg text-zinc-950 dark:text-white uppercase">The Cocktail Hours &amp; Tiki</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Nocturnal encounters in supper clubs, neon lounges (<em>The Blue Elephant Lounge</em>), and Polynesian luau fantasies (<em>Tipsy Island</em>).
            </p>
          </div>

          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">04 • SERIES</span>
            <h4 className="font-serif font-bold text-lg text-zinc-950 dark:text-white uppercase">Landmark Murals &amp; Banners</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Public masonry installations across Texas, alongside heavy carnival sideshow banners (<em>Dinosaur Land</em>) painted on canvas.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM CTA BANNER
      ────────────────────────────────────────────────────────────────*/}
      <section className="bg-zinc-900 text-white dark:bg-zinc-950 border-2 border-zinc-900 dark:border-zinc-700 p-8 sm:p-12 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-emerald-400 font-bold">
            ORIGINAL ARTWORKS AND COMMISSIONS
          </span>
          <h3 className="text-3xl sm:text-4xl font-black uppercase font-serif tracking-tight">
            Inquire on an Original Rory Skagen
          </h3>
          <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
            Inquire about available panel originals, historical archive prints, or custom mural commissions for public and private spaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onNavigate('gallery')}
            className="px-6 py-3 bg-white text-black font-mono font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Browse Master Catalog
          </button>
          <button
            onClick={() => onNavigate('contact')}
            className="px-6 py-3 bg-emerald-600 text-white font-mono font-bold uppercase tracking-widest text-xs hover:bg-emerald-500 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Me</span>
          </button>
        </div>
      </section>

    </div>
  );
};
