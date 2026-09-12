import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  Award, 
  Mail, 
  ArrowRight, 
  Compass,
  Camera,
  Paintbrush
} from 'lucide-react';
import { motion } from 'motion/react';
import { resolveAssetUrl } from '../data/assetResolver';
import { PageHeader } from './PageHeader';

interface AboutViewProps {
  onNavigate: (route: string, param?: string) => void;
  onOpenInquiry: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate, onOpenInquiry }) => {
  const roryPhotoUrl = resolveAssetUrl('Rory-Skagen-Photo.jpg', 'rory-skagen-photo', 'hero') ||
    'https://res.cloudinary.com/xjilp2pq/image/upload/v1787077006/Rory-Skagen-Photo.jpg';

  return (
    <div className="space-y-12 sm:space-y-16 pb-20 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HERO EDITORIAL HEADER — shared statement masthead
      ────────────────────────────────────────────────────────────────*/}
      <PageHeader
        kicker="Artist Biography & Studio Heritage"
        statement="Four decades of pop art, atomic Americana and landmark Texas murals"
        support="From the ‘Greetings from Austin’ mural to Kaiju enamel panels — the life, the craft, and the cultural stewardship of Austin's most enduring pop surrealist."
        meta={[
          { label: 'Studio Origin', value: 'Austin, Texas — 1985' },
          { label: 'Co-Founder', value: 'SouthPop Center' },
          { label: 'Landmark', value: 'Greetings from Austin' },
        ]}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. BIOGRAPHY & ARTIST PORTRAIT GRID
      ────────────────────────────────────────────────────────────────*/}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Portrait & Studio Credentials */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card border-2 border-line-strong p-4 sm:p-5 shadow-md space-y-4">
            <div className="relative aspect-4/5 bg-surface-deep border border-line overflow-hidden">
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
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted-foreground uppercase">Studio Origin:</span>
                <span className="font-bold text-foreground">Austin, Texas (Est. 1985)</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted-foreground uppercase">Key Mediums:</span>
                <span className="font-bold text-foreground">Enamel, Canvas, Steel, Murals</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted-foreground uppercase">Cultural Heritage:</span>
                <span className="font-bold text-foreground">Co-Founder, SouthPop Center</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground uppercase">Public Landmark:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Greetings from Austin Mural</span>
              </div>
            </div>
          </div>

          {/* Quick Contact & Inquire Box */}
          <div className="bg-surface-deep border border-line p-6 space-y-4 rounded-xs">
            <h3 className="font-serif font-black text-lg uppercase tracking-tight text-foreground">
              Studio Representation and Inquiries
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              Original panel enamels, large banner paintings, and commissioned murals are available directly through the studio and authorized gallery representations.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onNavigate('contact')}
                className="w-full py-2.5 bg-primary text-primary-foreground font-mono font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact Me</span>
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className="w-full py-2.5 bg-muted text-foreground font-mono font-bold uppercase tracking-wider text-xs hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>View Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Full Narrative & History */}
        <div className="lg:col-span-7 space-y-8 text-foreground/85 font-sans leading-relaxed">
          
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif border-b border-line-strong pb-2">
              The Vision of Rory Skagen
            </h2>
            <p className="text-base sm:text-lg text-foreground/90 font-serif italic leading-relaxed">
              &ldquo;My work lives at the intersection of atomic-age optimism, creature-feature dread, and the faded neon romance of mid-century commercial Americana.&rdquo;
            </p>
            <p className="text-sm sm:text-base">
              Rory Skagen is one of Austin&apos;s most celebrated visual artists and muralists. Since establishing his studio in Central Texas in the mid-1980s, Skagen has produced hundreds of original paintings, monumental outdoor murals, and commercial art pieces that have defined the visual identity of Austin&apos;s creative landscape.
            </p>
            <p className="text-sm sm:text-base">
              Drawing inspiration from 1950s cinema lobby cards, carnival sideshow canvas banners, vintage food advertisements, and Japanese Kaiju monsters, Skagen crafts rich, satirical, and deeply textured works that feel both nostalgically familiar and strikingly surreal.
            </p>
          </div>

          {/* Landmark Section: Greetings from Austin — with 1998 painting photo */}
          <div className="bg-card border-2 border-line-strong p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Award className="w-4 h-4" />
              <span>Historic Austin Icon</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black uppercase text-foreground font-serif">
              The &ldquo;Greetings from Austin&rdquo; Mural (1998)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <figure className="space-y-2">
                <div className="relative overflow-hidden border border-line bg-surface-deep">
                  <img
                    src="/images/greetings-mural-painting-1998.jpg"
                    alt="Rory Skagen hand-painting the Greetings from Austin mural in 1998"
                    className="w-full h-44 object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 text-white text-[8px] font-mono font-bold uppercase tracking-widest">
                    1998 • Painting Day
                  </span>
                </div>
                <figcaption className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                  Skagen at the wall on South 1st — ladder, enamel pots, and the large-letter postcard taking shape.
                </figcaption>
              </figure>
              <figure className="space-y-2">
                <div className="relative overflow-hidden border border-line bg-surface-deep">
                  <img
                    src="/images/greetings-mural-turquoise-truck.jpg"
                    alt="Vintage turquoise pickup parked before the Greetings from Austin mural at Roadhouse Relics"
                    className="w-full h-44 object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 text-white text-[8px] font-mono font-bold uppercase tracking-widest">
                    Roadhouse Relics
                  </span>
                </div>
                <figcaption className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                  The gallery wall as roadside destination — vintage neon, relics, and a &apos;57 Apache keeping watch.
                </figcaption>
              </figure>
            </div>
            <p className="text-xs sm:text-sm text-foreground/85">
              In 1998, Rory Skagen, along with collaborator Bill Johnston, painted the world-famous <strong className="text-foreground">&ldquo;Greetings from Austin&rdquo;</strong> postcard mural on the side of Roadhouse Relics at South 1st and Annie Street.
            </p>
            <p className="text-xs sm:text-sm text-foreground/85">
              Transforming a 1940s Curt Teich large-letter linen postcard into a 20-foot outdoor landmark, the mural has become the undisputed cultural beacon of Austin, photographed by millions of visitors, featured in films, television, and international travel documentaries.
            </p>
          </div>

          {/* SouthPop & Cultural Stewardship */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-black uppercase text-foreground font-serif border-b border-line-strong pb-2">
              SouthPop &amp; Community Roots
            </h3>
            <p className="text-sm sm:text-base">
              Skagen co-founded the <strong>South Austin Popular Culture Center (SouthPop)</strong> alongside cultural preservationists Leea Mechling and Henry Gonzalez. Dedicated to archiving the rich tapestry of Central Texas music history, psychedelic poster art, Armadillo World Headquarters memorabilia, and underground counterculture, Skagen has served as a devoted custodian of Austin&apos;s artistic heritage.
            </p>
          </div>

          {/* Mediums & Techniques */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-black uppercase text-foreground font-serif border-b border-line-strong pb-2">
              Techniques &amp; Craftsmanship
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-surface-deep p-4 border border-line">
                <span className="font-bold text-foreground block mb-1 uppercase">
                  Sign Enamels on Steel
                </span>
                <span className="text-muted-foreground">
                  Industrial high-gloss sign enamels applied to custom steel and hardwood panels with multi-coat automotive clear patinas.
                </span>
              </div>
              <div className="bg-surface-deep p-4 border border-line">
                <span className="font-bold text-foreground block mb-1 uppercase">
                  Sideshow Banners
                </span>
                <span className="text-muted-foreground">
                  Heavy canvas banners with hand-stitched leather corners, brass grommets, and weather-resistant paints echoing 1940s carnival art.
                </span>
              </div>
              <div className="bg-surface-deep p-4 border border-line">
                <span className="font-bold text-foreground block mb-1 uppercase">
                  Monumental Murals
                </span>
                <span className="text-muted-foreground">
                  Large-scale exterior brick and masonry installations, including public art for Planet K Texas, commercial venues, and private estates.
                </span>
              </div>
              <div className="bg-surface-deep p-4 border border-line">
                <span className="font-bold text-foreground block mb-1 uppercase">
                  Hand-Lettered Satire
                </span>
                <span className="text-muted-foreground">
                  Original typographic compositions evoking mid-century apothecary packaging, Tiki lounges, and atomic cinema title cards.
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2b. THE MURAL TODAY — full-bleed visitor photo moment
      ────────────────────────────────────────────────────────────────*/}
      <section className="relative overflow-hidden border-2 border-line-strong shadow-lg">
        <div className="relative aspect-21/9 min-h-[280px]">
          <img
            src="/images/greetings-from-austin-mural.jpg"
            alt="A visitor poses before the Greetings from Austin postcard mural"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono font-bold uppercase tracking-widest">
                <Camera className="w-3 h-3" />
                South 1st &amp; Annie • Est. 1998
              </span>
              <p className="text-white font-serif font-black text-lg sm:text-2xl uppercase tracking-tight max-w-xl leading-tight">
                The most photographed wall in Texas
              </p>
            </div>
            <button
              onClick={() => onNavigate('gallery')}
              className="flex-shrink-0 px-5 py-2.5 bg-white/95 text-black font-mono font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>See Mural-Inspired Works</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. SIGNATURE THEMES & EXHIBITION SERIES
      ────────────────────────────────────────────────────────────────*/}
      <section className="border-t-2 border-line-strong pt-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-line-strong pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground font-bold block mb-1">
              STUDIO THEMATIC CANON
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif">
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
          {[
            {
              num: '01 • SERIES',
              title: 'Kaiju & Atomic Paranoia',
              body: 'Majestic, solitary behemoths like Kirunam, Terrordon, and Jigoku wandering dystopian mid-century metropolises.',
            },
            {
              num: '02 • SERIES',
              title: 'Vintage Advertisements',
              body: 'Fictional mid-century apothecary remedies, pine medicines (Drebbles), and satirical consumer goods in rich sign enamels.',
            },
            {
              num: '03 • SERIES',
              title: 'The Cocktail Hours & Tiki',
              body: 'Nocturnal encounters in supper clubs, neon lounges (The Blue Elephant Lounge), and Polynesian luau fantasies (Tipsy Island).',
            },
            {
              num: '04 • SERIES',
              title: 'Landmark Murals & Banners',
              body: 'Public masonry installations across Texas, alongside heavy carnival sideshow banners (Dinosaur Land) painted on canvas.',
            },
          ].map((series, idx) => (
            <motion.div
              key={series.num}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
              className="bg-card border-2 border-line-strong p-5 space-y-2"
            >
              <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">{series.num}</span>
              <h4 className="font-serif font-bold text-lg text-foreground uppercase">{series.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{series.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM CTA BANNER
      ────────────────────────────────────────────────────────────────*/}
      <section className="bg-primary text-primary-foreground border-2 border-line-strong p-8 sm:p-12 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-emerald-400 font-bold">
            ORIGINAL ARTWORKS AND COMMISSIONS
          </span>
          <h3 className="text-3xl sm:text-4xl font-black uppercase font-serif tracking-tight">
            Inquire on an Original Rory Skagen
          </h3>
          <p className="text-primary-foreground/75 text-xs sm:text-sm leading-relaxed">
            Inquire about available panel originals, historical archive prints, or custom mural commissions for public and private spaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onNavigate('gallery')}
            className="px-6 py-3 bg-primary-foreground text-primary font-mono font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-opacity cursor-pointer"
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
