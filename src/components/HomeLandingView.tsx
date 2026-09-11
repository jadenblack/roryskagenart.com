import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Send, 
  Maximize2, 
  Image as ImageIcon,
  Mail,
  Search,
  Eye,
  X,
  Compass,
  ChevronRight
} from 'lucide-react';
import { ArtworkRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { InquiryModal } from './InquiryModal';
import { resolveAssetUrl } from '../data/assetResolver';
import { getArtworkSvg } from '../data/artAssets';
import { HeroGallerySlider } from './HeroGallerySlider';

interface HomeLandingViewProps {
  onNavigate: (route: string, param?: string) => void;
  onOpenAdminAuth: () => void;
  featuredArtworks: ArtworkRecord[];
  totalWorks: number;
}

// 2010 Archive Item Definition
interface ArchiveFeatureDef {
  id: string;
  slug: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  price: string;
  status: 'Available' | 'Sold' | 'Archived' | 'Private Collection' | 'Public Installation';
  imageKey: string;
  narrative: string;
  category: 'monsters' | 'ads' | 'cocktail' | 'vintage' | 'foreign' | 'banners' | 'murals';
}

// Canonical items from the 2010 original archive shown in the user's reference image
const CLASSIC_MAIN_EXHIBITION: ArchiveFeatureDef[] = [
  {
    id: 'kirunam',
    slug: 'kirunan',
    title: 'Kirunam',
    year: '2010',
    medium: 'Enamel on steel panel',
    dimensions: "4' x 5'",
    price: '$4,500.00',
    status: 'Available',
    imageKey: 'kirunan.jpg',
    narrative: "Leaving the nearby ocean forever, Kirunam slithers its way down the city streets. Unable to recognize this dimension, Kirunam, melancholy and alone, prays in its low guttural frequency toward the fading twilight horizon.",
    category: 'monsters'
  },
  {
    id: 'terrordon',
    slug: 'terrordon',
    title: 'Terrordon',
    year: '2010',
    medium: 'Enamel on panel',
    dimensions: "3.5' x 5'",
    price: '$4,000.00',
    status: 'Available',
    imageKey: 'terrordon.jpg',
    narrative: "Terrordon surveys the abandoned streets it will soon demolish. 3.5' x 5' enamel on panel – an ominous monument to mid-century atomic paranoia and creature feature cinema.",
    category: 'monsters'
  },
  {
    id: 'jigoku',
    slug: 'jigoku',
    title: 'Jigoku',
    year: '2010',
    medium: 'Enamel on steel panel',
    dimensions: "4' x 5'",
    price: 'Archived',
    status: 'Archived',
    imageKey: 'jigoku.jpg',
    narrative: "\"Goodbye mankind. A demon incarnate. Literal hell on Earth. We are doomed.\" Last message reported from Los Angeles January 16, 1962.",
    category: 'monsters'
  },
  {
    id: 'utaho',
    slug: 'utaho',
    title: 'Utaho',
    year: '2010',
    medium: 'Enamel on panel',
    dimensions: "4' x 5'",
    price: '$4,200.00',
    status: 'Available',
    imageKey: 'utaho.jpg',
    narrative: "We can thank science for many modern miracles; science has created the atom bomb to protect us from Communism, Fluoridated water to keep our children's teeth strong, and telecommunications for the great forward march of civilization.",
    category: 'monsters'
  }
];

// Sidebar 2010 Spotlight works
const SIDEBAR_SPOTLIGHTS: ArchiveFeatureDef[] = [
  {
    id: 'rendezvous-in-chinatown',
    slug: 'rendezvous-in-chinatown',
    title: 'Rendezvous in Chinatown',
    year: '2010',
    medium: 'Acrylic on framed panel',
    dimensions: "4' x 3'",
    price: '$2,000.00',
    status: 'Available',
    imageKey: 'The-watering-hole-copy.jpg',
    narrative: "A noir-drenched encounter under neon signs and paper lanterns. 4' x 3' acrylic on custom framed panel.",
    category: 'cocktail'
  },
  {
    id: 'the-cats-of-the-colloseum',
    slug: 'the-cats-of-the-colloseum',
    title: 'The Cats of the Colloseum',
    year: '2010',
    medium: 'Acrylic on framed panel',
    dimensions: "4' x 3'",
    price: '$2,000.00',
    status: 'Available',
    imageKey: 'the-cats-of-the-colloseum-copy3.jpg',
    narrative: "Feline sovereigns claim the historic ruins of Rome. 4' x 3' acrylic on framed wooden panel with vintage patina.",
    category: 'vintage'
  },
  {
    id: 'the-production',
    slug: 'the-production',
    title: 'The Production',
    year: '2010',
    medium: 'Acrylic on framed panel',
    dimensions: "4' x 3'",
    price: '$2,000.00',
    status: 'Available',
    imageKey: 'the-production-copy.jpg',
    narrative: "Behind the silver screen of 1950s Hollywood movie sets. 4' x 3' Acrylic on framed panel.",
    category: 'vintage'
  }
];

// Mid-section dual category highlights
const DUAL_SHOWCASE = {
  vintageAds: {
    id: 'drebbles',
    slug: 'drebbles',
    title: 'Drebbles',
    sectionTitle: 'VINTAGE FOOD ADVERTISEMENTS',
    year: '2008',
    medium: 'Sign enamel & clear coat on back-framed wooden panel',
    dimensions: "5' x 3.5'",
    price: '$3,200.00',
    status: 'Available' as const,
    imageKey: 'drebbles-copy.jpg',
    narrative: "\"Strong pine medicine. It's not candy. O.K. ... it is candy.\" This 5' x 3.5' image is painted on a back framed wooden panel in sign enamel and clear coat, evoking vintage mid-century apothecary advertising."
  },
  banners: {
    id: 'dinosaur-land',
    slug: 'dinosaur-land',
    title: 'Dinosaur Land',
    sectionTitle: 'BANNER PAINTINGS',
    year: '2009',
    medium: 'Acrylic on canvas banner with leather corners & brass grommets',
    dimensions: "4' x 6'",
    price: 'Studio Collection',
    status: 'Archived' as const,
    imageKey: 'dinolandcropped-copy1.jpg',
    narrative: "The world of 3rd grade Dinosaurs. 4' x 6' acrylic on heavy duty banner with reinforced leather corners and industrial hanging rings. Painted in the tradition of mid-century carnival sideshow banners."
  }
};

// 5-Column Collections from the 2010 site layout
interface CuratedColumnDef {
  columnTitle: string;
  featured: ArchiveFeatureDef;
  links: Array<{ title: string; slug: string; price?: string }>;
}

const CURATED_FIVE_COLUMNS: CuratedColumnDef[] = [
  {
    columnTitle: 'Commissions & Misc',
    featured: {
      id: 'austin-camouflage',
      slug: 'austin-camouflage',
      title: 'Austin Camouflage',
      year: '2008',
      medium: 'Enamel on Canvas',
      dimensions: '22" x 5\'',
      price: '$1,500.00',
      status: 'Available',
      imageKey: 'austin-Recovered-copy.jpg',
      narrative: 'Mid-century panoramic abstraction celebrating Central Texas iconography and cosmic roadside aesthetics.',
      category: 'murals'
    },
    links: [
      { title: 'Greetings from Austin', slug: 'greetings-from-austin', price: 'Public Landmark' },
      { title: 'Austin Postcard', slug: 'austin-postcard', price: '$950.00' },
      { title: '78704 Heritage', slug: '78704', price: '$1,200.00' },
      { title: 'The Balloon Cats', slug: 'the-balloon-cats-2', price: '$1,800.00' },
      { title: 'Marcia Ball Tour Art', slug: 'marcia-ball', price: '$2,200.00' }
    ]
  },
  {
    columnTitle: 'The Cocktail Hours',
    featured: {
      id: 'the-blue-elephant-lounge',
      slug: 'the-blue-elephant-lounge',
      title: 'The Blue Elephant Lounge',
      year: '2009',
      medium: 'Acrylic on wood with ebonized red oak frame',
      dimensions: '5\' x 22.5"',
      price: '$2,400.00',
      status: 'Available',
      imageKey: 'The-blue-elephant-lounge-.jpg',
      narrative: '5\' long by 22.5" tall acrylic painting on wood with a custom ebonized red oak frame. A classic supper club sanctuary.',
      category: 'cocktail'
    },
    links: [
      { title: 'The Red Mood', slug: 'the-red-mood', price: '$1,600.00' },
      { title: 'The Blue Hour', slug: 'the-blue-hour', price: '$1,800.00' },
      { title: 'Cave Dance', slug: 'cave-dance', price: '$2,100.00' },
      { title: 'Stewed Gorilla', slug: 'stewed-gorilla-copy', price: '$1,400.00' },
      { title: 'The 18,000th Hole', slug: 'the-18000th-whole', price: '$1,900.00' }
    ]
  },
  {
    columnTitle: 'Vintage Appeal',
    featured: {
      id: 'raintree-county',
      slug: 'raintree-county',
      title: 'Raintree County',
      year: '2007',
      medium: 'Enamel & Acrylic on illustration board',
      dimensions: '6.5" x 8"',
      price: '$850.00',
      status: 'Available',
      imageKey: 'raintree-wallpaper-6.5-x-8.jpg',
      narrative: 'Based on the memory of a souvenir ashtray from Saratoga once seen in the trailer of a couple from New York.',
      category: 'vintage'
    },
    links: [
      { title: 'Random House', slug: 'random-house', price: '$1,100.00' },
      { title: 'The Butter and Egg Man', slug: 'the-butter-and-egg-man', price: '$950.00' },
      { title: 'Tuesday Charmer', slug: 'tuesday-charmer', price: '$1,250.00' },
      { title: 'Southern Belle', slug: 'southern-belle', price: '$1,400.00' },
      { title: 'Cornflower', slug: 'cornflower', price: '$900.00' }
    ]
  },
  {
    columnTitle: 'Ad Lands',
    featured: {
      id: 'tipsy-island',
      slug: 'tipsy-island',
      title: 'Tipsy Island',
      year: '2008',
      medium: 'Acrylic on illustration board with exotic frame',
      dimensions: '13" x 24"',
      price: '$1,800.00',
      status: 'Available',
      imageKey: 'tipsy-island-copy-2.jpg',
      narrative: '"Tiki luau fantasy." 13" by 24" acrylic on illustration board beautifully framed and matted under glass, featuring an exotic jaguar motif.',
      category: 'ads'
    },
    links: [
      { title: 'The Hell That Is', slug: 'the-hell-that-is-monkey-island', price: '$2,000.00' },
      { title: 'Monkey Island', slug: 'monkey-sunset', price: '$1,500.00' },
      { title: 'Square Eggs', slug: 'square-eggs', price: '$1,100.00' },
      { title: 'The Great All Stars', slug: 'the-great-all-stars', price: '$2,500.00' },
      { title: 'Beaver Holiday', slug: 'beaver-holiday', price: '$1,300.00' }
    ]
  },
  {
    columnTitle: 'The Foreign Group',
    featured: {
      id: 'wisdom-coffee',
      slug: 'wisdom-coffee',
      title: 'Wisdom Coffee',
      year: '2009',
      medium: 'Acrylic on illustration board',
      dimensions: '22.5" x 13.5"',
      price: '$1,750.00',
      status: 'Available',
      imageKey: 'wisdom-coffee-copy.jpg',
      narrative: '"Voltaire drank 50 cups of coffee a day." 22.5" by 13.5" acrylic painting on heavy illustration board. International pop commercial iconography.',
      category: 'foreign'
    },
    links: [
      { title: 'Mogul Cigarettes', slug: 'mogul-cigarettes', price: '$1,650.00' },
      { title: 'Silent Flute', slug: 'silent-flute', price: '$1,200.00' },
      { title: 'Adventures in Illustration', slug: 'adventures-in-illustration', price: '$1,900.00' },
      { title: 'Moo Goo Gai Pan', slug: 'moo-goo-gai-pan-copy', price: '$1,450.00' },
      { title: 'Nomaka', slug: 'nomaka', price: '$1,350.00' }
    ]
  }
];

// Helper to resolve real artwork image URLs — stage v3.2 dual-read chain
// (Supabase registry first, frozen Cloudinary map second, SVG fallback last)
const resolveImageUrl = (key: string, slug?: string): string => {
  const url = resolveAssetUrl(key, slug, 'hero');
  if (url) return url;
  // Fallback to high-res dynamic SVG from artAssets
  return getArtworkSvg(slug || key.replace(/\.[^/.]+$/, ''));
};

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  onNavigate,
  onOpenAdminAuth,
  featuredArtworks,
  totalWorks,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedInquiryArtwork, setSelectedInquiryArtwork] = useState<ArtworkRecord | null>(null);

  // Lightbox modal state for high-res artwork inspection
  const [lightboxArtwork, setLightboxArtwork] = useState<ArchiveFeatureDef | ArtworkRecord | null>(null);

  // Category filter state for the exhibition
  const [activeCategory, setActiveCategory] = useState<'all' | 'monsters' | 'ads' | 'cocktail' | 'vintage' | 'foreign' | 'murals'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle inquiry dispatch
  const handleArchiveInquiry = (item: ArchiveFeatureDef) => {
    // Construct artwork record shape for modal
    const artRec: ArtworkRecord = {
      slug: item.slug,
      title: item.title,
      year: item.year,
      medium: item.medium,
      dimensions: item.dimensions,
      price: item.price,
      status: item.status,
      featured_image: item.imageKey,
      gallery_series: item.category,
      narrative: item.narrative,
      filePath: `posts/${item.slug}.md`
    };
    setSelectedInquiryArtwork(artRec);
    setInquiryModalOpen(true);
  };

  const handleProtectedAction = (targetRoute: string, param?: string) => {
    if (isAuthenticated) {
      onNavigate(targetRoute, param);
    } else {
      onOpenAdminAuth();
    }
  };

  // Filtered exhibition items
  const filteredMainExhibition = useMemo(() => {
    return CLASSIC_MAIN_EXHIBITION.filter((item) => {
      const matchCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.narrative.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.medium.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div id="rory-skagen-home-archive" className="space-y-12 sm:space-y-16 pb-20 font-sans selection:bg-amber-500/25 selection:text-amber-900 dark:selection:text-amber-200">
      
      {/* ─────────────────────────────────────────────────────────────
          1. CLASSIC VINTAGE TOP BANNER & MASTHEAD (2016 ARCHIVE REVERENCE)
      ────────────────────────────────────────────────────────────────*/}
      <header className="border-b-2 border-zinc-900 dark:border-zinc-700 pb-6 sm:pb-8">
        {/* Archival metadata ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400 border-b border-zinc-300 dark:border-zinc-800 pb-2.5 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
            <span>RORY SKAGEN STUDIO • AUSTIN, TEXAS • EST. 1985</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>COLLECTOR ARCHIVES 2010–2026</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">ORIGINAL ENAMELS, PAINTINGS &amp; MURALS</span>
          </div>
        </div>

        {/* Bold Classic Header Masthead */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-wider text-zinc-950 dark:text-white font-serif leading-none">
            Rory Skagen Art
          </h1>
          <p className="text-xs sm:text-sm font-mono uppercase tracking-[0.3em] text-zinc-700 dark:text-zinc-300 font-semibold max-w-2xl mx-auto">
            Pop Surrealism • Atomic Americana • Landmark Public Murals
          </p>
        </div>

        {/* Hero Gallery Slider Feature */}
        <HeroGallerySlider
          artworks={featuredArtworks}
          onSelectArtwork={(slug) => onNavigate('artwork', slug)}
          onInquireArtwork={(art) => {
            setSelectedInquiryArtwork(art);
            setInquiryModalOpen(true);
          }}
          onOpenLightbox={(art) => setLightboxArtwork(art)}
        />

        {/* Quick Filter / Search Bar */}
        <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 font-mono text-[11px]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              2010 Landmark Archive
            </button>
            <button
              onClick={() => setActiveCategory('monsters')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'monsters'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              Kaiju and Pop Monsters
            </button>
            <button
              onClick={() => setActiveCategory('ads')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'ads'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              Vintage Advertisements
            </button>
            <button
              onClick={() => setActiveCategory('cocktail')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'cocktail'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              Cocktail Hours and Tiki
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archive titles..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white rounded-xs focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN 2-COLUMN ARCHIVE LAYOUT (PRIMARY FEED & SIDEBAR)
      ────────────────────────────────────────────────────────────────*/}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* LEFT COLUMN: THE MASTER 2010 EXHIBITION FEED (Kirunam, Terrordon, Jigoku, Utaho) */}
        <div className="lg:col-span-8 space-y-12 sm:space-y-16">
          <div className="border-b border-zinc-400 dark:border-zinc-700 pb-2 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif">
              Featured Exhibition Works
            </h2>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
              Original Enamel &amp; Panel Masterpieces
            </span>
          </div>

          {filteredMainExhibition.map((art) => {
            const imageUrl = resolveImageUrl(art.imageKey, art.slug);

            return (
              <article 
                key={art.id} 
                className="group bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-4 sm:p-6 shadow-md transition-all hover:shadow-xl space-y-4"
              >
                {/* Artwork Media Box */}
                <div 
                  onClick={() => setLightboxArtwork(art)}
                  className="relative aspect-4/3 bg-[#F4F3ED] dark:bg-zinc-950 overflow-hidden border border-zinc-300 dark:border-zinc-800 cursor-pointer flex items-center justify-center p-3 sm:p-6"
                >
                  <img
                    src={imageUrl}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-102"
                    loading="lazy"
                  />

                  {/* Corner Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 bg-black text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                      {art.status}
                    </span>
                    <span className="px-2 py-1 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-white text-[10px] font-mono font-bold border border-zinc-400 dark:border-zinc-700">
                      {art.dimensions}
                    </span>
                  </div>

                  {/* Inspect Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-mono text-xs font-bold uppercase tracking-widest">
                    <Maximize2 className="w-4 h-4" />
                    <span>Click to Zoom &amp; Inspect</span>
                  </div>
                </div>

                {/* Artwork Narrative & Spec details */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 
                      onClick={() => setLightboxArtwork(art)}
                      className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {art.title}
                    </h3>
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {art.price}
                    </span>
                  </div>

                  {/* Narrative paragraph in artist's exact voice */}
                  <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-serif italic">
                    &ldquo;{art.narrative}&rdquo;
                  </p>

                  {/* Specifications & Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-zinc-500 dark:text-zinc-400">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{art.medium}</span> • {art.dimensions}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleArchiveInquiry(art)}
                        className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider text-[11px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
                        <span>Inquire on Piece</span>
                      </button>
                      <button
                        onClick={() => setLightboxArtwork(art)}
                        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-wider text-[11px] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* RIGHT COLUMN: 2010 SIDEBAR ARCHIVE, SPOTLIGHT WORKS & ARTIST BIO */}
        <aside className="lg:col-span-4 space-y-8">
          
          {/* 1. Year 2010 Spotlight Card */}
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 sm:p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b-2 border-zinc-900 dark:border-zinc-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500 text-black font-mono font-black text-xs uppercase tracking-widest">
                  2010
                </span>
                <h3 className="font-serif font-black text-lg uppercase tracking-tight text-zinc-950 dark:text-white">
                  Archive Spotlight
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Classic Series
              </span>
            </div>

            {/* Spotlight Artworks */}
            <div className="space-y-6">
              {SIDEBAR_SPOTLIGHTS.map((item) => {
                const img = resolveImageUrl(item.imageKey, item.slug);
                return (
                  <div key={item.id} className="group space-y-2 border-b border-zinc-200 dark:border-zinc-800 pb-4 last:border-0 last:pb-0">
                    <div 
                      onClick={() => setLightboxArtwork(item)}
                      className="relative aspect-16/10 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden cursor-pointer flex items-center justify-center p-2"
                    >
                      <img 
                        src={img} 
                        alt={item.title} 
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-mono font-bold">
                        {item.price}
                      </div>
                    </div>
                    <div>
                      <h4 
                        onClick={() => setLightboxArtwork(item)}
                        className="font-serif font-bold text-sm text-zinc-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer uppercase"
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed line-clamp-2">
                        {item.narrative}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-zinc-500">{item.dimensions}</span>
                        <button
                          onClick={() => handleArchiveInquiry(item)}
                          className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>Inquire</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. "About Rory Skagen Art" Profile Box */}
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-5 sm:p-6 shadow-md space-y-4">
            <div className="border-b border-zinc-300 dark:border-zinc-800 pb-3 flex items-center justify-between">
              <h3 className="font-serif font-black text-lg uppercase tracking-tight text-zinc-950 dark:text-white">
                About Rory Skagen Art
              </h3>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>

            {/* Artist portrait / Photo */}
            <div className="relative aspect-4/3 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex items-center justify-center">
              <img
                src={resolveImageUrl('Rory-Skagen-Photo.jpg', 'rory-skagen-photo')}
                alt="Artist Rory Skagen"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-xs text-white p-2 text-[10px] font-mono text-center">
                Rory Skagen • Studio Master Artist
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
              Rory Skagen is a pioneering American painter and public muralist based in Austin, Texas. Co-founder of the South Austin Pop Culture Center and co-creator of the legendary <strong className="font-semibold text-zinc-950 dark:text-white">&ldquo;Greetings from Austin&rdquo;</strong> mural, his work merges 1950s atomic pop culture, monster cinema, and retro advertising into an iconic visual universe.
            </p>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => onNavigate('about')}
                className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Read Full Biography</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Other Sites & Landmark Projects by Rory */}
          <div className="bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-5 space-y-3 rounded-xs font-mono text-xs">
            <h4 className="font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-300 dark:border-zinc-700 pb-2">
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Landmarks and Studio Portals</span>
            </h4>
            <ul className="space-y-2.5 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-zinc-950 dark:text-white block">Greetings From Austin Mural</strong>
                  <span className="text-[11px] text-zinc-500">South 1st &amp; Annie Street, Austin TX</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-zinc-950 dark:text-white block">SouthPop Cultural Center</strong>
                  <span className="text-[11px] text-zinc-500">Preserving Central Texas music &amp; art history</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-zinc-950 dark:text-white block">Planet K Texas Public Murals</strong>
                  <span className="text-[11px] text-zinc-500">Large-scale psychedelic &amp; pop installations</span>
                </div>
              </li>
            </ul>

            <div className="pt-3 border-t border-zinc-300 dark:border-zinc-800">
              {isAuthenticated ? (
                <button
                  onClick={() => onNavigate('gallery')}
                  className="w-full py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-colors cursor-pointer rounded-xs"
                >
                  Open Full Studio Database
                </button>
              ) : (
                <button
                  onClick={onOpenAdminAuth}
                  className="w-full py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-colors cursor-pointer rounded-xs flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Collector Portal Sign In</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. DUAL CURATED CATEGORY HIGHLIGHTS (VINTAGE ADS & BANNERS)
      ────────────────────────────────────────────────────────────────*/}
      <section className="border-t-2 border-b-2 border-zinc-900 dark:border-zinc-700 py-10 sm:py-14 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-zinc-500 font-bold">
            CURATED MEDIUM SPOTLIGHTS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-zinc-950 dark:text-white font-serif">
            Signs, Enamels and Carnival Banners
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Feature 1: Vintage Food Advertisements (Drebbles) */}
          <article className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-zinc-300 dark:border-zinc-800 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">
                  {DUAL_SHOWCASE.vintageAds.sectionTitle}
                </span>
                <h3 className="text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif">
                  {DUAL_SHOWCASE.vintageAds.title}
                </h3>
              </div>

              <div 
                onClick={() => setLightboxArtwork(DUAL_SHOWCASE.vintageAds as any)}
                className="relative aspect-4/3 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden cursor-pointer flex items-center justify-center p-4 group"
              >
                <img
                  src={resolveImageUrl(DUAL_SHOWCASE.vintageAds.imageKey, DUAL_SHOWCASE.vintageAds.slug)}
                  alt={DUAL_SHOWCASE.vintageAds.title}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-103"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-black text-white text-[10px] font-mono font-bold">
                  {DUAL_SHOWCASE.vintageAds.price}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-serif italic leading-relaxed">
                {DUAL_SHOWCASE.vintageAds.narrative}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">{DUAL_SHOWCASE.vintageAds.dimensions}</span>
              <button
                onClick={() => handleArchiveInquiry(DUAL_SHOWCASE.vintageAds as any)}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider text-[10px] hover:bg-black transition-colors cursor-pointer"
              >
                Inquire on Drebbles
              </button>
            </div>
          </article>

          {/* Feature 2: Banner Paintings (Dinosaur Land) */}
          <article className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-zinc-300 dark:border-zinc-800 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold block mb-0.5">
                  {DUAL_SHOWCASE.banners.sectionTitle}
                </span>
                <h3 className="text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif">
                  {DUAL_SHOWCASE.banners.title}
                </h3>
              </div>

              <div 
                onClick={() => setLightboxArtwork(DUAL_SHOWCASE.banners as any)}
                className="relative aspect-4/3 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden cursor-pointer flex items-center justify-center p-4 group"
              >
                <img
                  src={resolveImageUrl(DUAL_SHOWCASE.banners.imageKey, DUAL_SHOWCASE.banners.slug)}
                  alt={DUAL_SHOWCASE.banners.title}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-103"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-amber-600 text-white text-[10px] font-mono font-bold">
                  {DUAL_SHOWCASE.banners.price}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-serif italic leading-relaxed">
                {DUAL_SHOWCASE.banners.narrative}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">{DUAL_SHOWCASE.banners.dimensions}</span>
              <button
                onClick={() => handleArchiveInquiry(DUAL_SHOWCASE.banners as any)}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider text-[10px] hover:bg-black transition-colors cursor-pointer"
              >
                Inquire on Banners
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. THE 5-COLUMN CURATED SERIES GRID (EXACT ARCHIVE HOMAGE)
      ────────────────────────────────────────────────────────────────*/}
      <section className="space-y-8">
        <div className="border-b border-zinc-400 dark:border-zinc-700 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500 block mb-1">
              CANONICAL 2010 COLLECTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif">
              Curated Series and Groups
            </h2>
          </div>
          <button
            onClick={() => onNavigate('gallery')}
            className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Browse Complete Catalog (700+ Works)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {CURATED_FIVE_COLUMNS.map((col, index) => {
            const featImg = resolveImageUrl(col.featured.imageKey, col.featured.slug);

            return (
              <div 
                key={index}
                className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-4 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Column Header */}
                  <div className="border-b-2 border-zinc-900 dark:border-zinc-700 pb-2">
                    <h3 className="font-serif font-black text-base uppercase text-zinc-950 dark:text-white tracking-tight leading-tight">
                      {col.columnTitle}
                    </h3>
                  </div>

                  {/* Featured Item Preview */}
                  <div 
                    onClick={() => setLightboxArtwork(col.featured)}
                    className="relative aspect-4/3 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden cursor-pointer flex items-center justify-center p-2 group"
                  >
                    <img 
                      src={featImg} 
                      alt={col.featured.title} 
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black text-white text-[8px] font-mono font-bold">
                      {col.featured.price}
                    </div>
                  </div>

                  {/* Featured Item Title & Narrative snippet */}
                  <div className="space-y-1">
                    <h4 
                      onClick={() => setLightboxArtwork(col.featured)}
                      className="font-serif font-bold text-sm text-zinc-950 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer uppercase line-clamp-1"
                    >
                      {col.featured.title}
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-snug line-clamp-2">
                      {col.featured.narrative}
                    </p>
                  </div>
                </div>

                {/* Sub-links to related works in this column */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 block">
                    More in Series:
                  </span>
                  <ul className="space-y-1 text-xs font-sans">
                    {col.links.map((link, lidx) => (
                      <li key={lidx} className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => onNavigate('artwork', link.slug)}
                          className="text-left text-zinc-800 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline transition-colors cursor-pointer line-clamp-1 text-[11px]"
                        >
                          {link.title}
                        </button>
                        {link.price && (
                          <span className="text-[9px] font-mono text-zinc-400 flex-shrink-0">
                            {link.price}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. STUDIO PORTAL & COLLECTOR GATEWAY
      ────────────────────────────────────────────────────────────────*/}
      <section className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 sm:p-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[10px] font-mono uppercase tracking-widest font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Collector &amp; Studio Database</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif">
              Explore 700+ Master Catalogue Works
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              The full Rory Skagen Studio archive contains over 700 original paintings, screenprints, mural schematics, scale visualizers, and drive files spanning 1985 to present day. Access is unlocked for authenticated studio sessions.
            </p>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto text-center space-y-3">
            <button
              onClick={() => onNavigate('gallery')}
              className="w-full sm:w-auto px-8 py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-mono font-bold uppercase tracking-[0.2em] text-xs hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <span>Explore Master Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono text-zinc-500">
              Open to collectors, curators, &amp; fine art enthusiasts
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. LIGHTBOX / HIGH-RES ARTWORK INSPECTION MODAL
      ────────────────────────────────────────────────────────────────*/}
      {lightboxArtwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-4 sm:p-8 shadow-2xl overflow-y-auto flex flex-col md:flex-row gap-6">
            {/* Close Button */}
            <button
              onClick={() => setLightboxArtwork(null)}
              className="absolute top-4 right-4 z-10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Lightbox Image Stage */}
            <div className="md:w-3/5 bg-[#F4F3ED] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center p-4 min-h-[300px]">
              <img
                src={resolveImageUrl(lightboxArtwork.imageKey || (lightboxArtwork as any).featured_image || '', lightboxArtwork.slug)}
                alt={lightboxArtwork.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            {/* Lightbox Metadata & Narrative */}
            <div className="md:w-2/5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold block mb-1">
                    {lightboxArtwork.year} • {lightboxArtwork.status}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 dark:text-white font-serif">
                    {lightboxArtwork.title}
                  </h3>
                </div>

                <div className="text-xs font-mono space-y-1 text-zinc-600 dark:text-zinc-400">
                  <div><strong className="text-zinc-900 dark:text-zinc-200">Medium:</strong> {lightboxArtwork.medium}</div>
                  <div><strong className="text-zinc-900 dark:text-zinc-200">Dimensions:</strong> {lightboxArtwork.dimensions}</div>
                  <div><strong className="text-zinc-900 dark:text-zinc-200">Price:</strong> {lightboxArtwork.price}</div>
                </div>

                {lightboxArtwork.narrative && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block mb-1">
                      Artist Statement:
                    </span>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-serif italic leading-relaxed">
                      &ldquo;{lightboxArtwork.narrative}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <button
                  onClick={() => {
                    const rec: ArtworkRecord = {
                      slug: lightboxArtwork.slug,
                      title: lightboxArtwork.title,
                      year: lightboxArtwork.year,
                      medium: lightboxArtwork.medium,
                      dimensions: lightboxArtwork.dimensions,
                      price: lightboxArtwork.price,
                      status: lightboxArtwork.status as any,
                      featured_image: lightboxArtwork.imageKey || '',
                      gallery_series: 'Studio Archive',
                      narrative: lightboxArtwork.narrative,
                      filePath: `posts/${lightboxArtwork.slug}.md`
                    };
                    setSelectedInquiryArtwork(rec);
                    setLightboxArtwork(null);
                    setInquiryModalOpen(true);
                  }}
                  className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                  <span>Send Studio Inquiry</span>
                </button>

                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setLightboxArtwork(null);
                      onNavigate('artwork', lightboxArtwork.slug);
                    }}
                    className="w-full py-2 bg-[#F4F3ED] dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono font-bold uppercase tracking-wider text-[10px] border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Open in Studio Focus View →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. ACQUISITION & GENERAL INQUIRY MODAL
      ────────────────────────────────────────────────────────────────*/}
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
