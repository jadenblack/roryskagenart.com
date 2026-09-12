import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  Send, 
  Maximize2, 
  Mail,
  Search,
  Eye,
  X,
  Compass,
  ChevronRight,
  MapPin,
  Camera,
  Award
} from 'lucide-react';
import { motion } from 'motion/react';
import { ArtworkRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { InquiryModal } from './InquiryModal';
import { resolveAssetUrl } from '../data/assetResolver';
import { getArtworkSvg } from '../data/artAssets';
import { HeroGallerySlider } from './HeroGallerySlider';
import { PageHeader } from './PageHeader';

interface HomeLandingViewProps {
  onNavigate: (route: string, param?: string) => void;
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

// ─────────────────────────────────────────────────────────────
// LANDMARK PHOTO TRIPTYCH — the "Greetings from Austin" mural
// in three eras: today, roadside nostalgia, and painting day 1998.
// ─────────────────────────────────────────────────────────────
const LANDMARK_TRIPTYCH = [
  {
    src: '/images/greetings-from-austin-mural.jpg',
    alt: 'Visitor posing in front of the Greetings from Austin mural at Roadhouse Relics',
    era: 'The Landmark Today',
    caption: 'South 1st & Annie Street — photographed by millions of travelers since 1998.',
    tag: 'Espy 2024'
  },
  {
    src: '/images/greetings-mural-turquoise-truck.jpg',
    alt: 'Vintage turquoise Chevrolet Apache pickup parked in front of the Greetings from Austin mural',
    era: 'Roadside Americana',
    caption: 'Roadhouse Relics gallery with a 1957 Apache — vintage neon signs & decor for homes.',
    tag: 'The Gallery Years'
  },
  {
    src: '/images/greetings-mural-painting-1998.jpg',
    alt: 'Rory Skagen painting the Greetings from Austin mural in 1998 with ladder and paint supplies',
    era: 'Painting Day, 1998',
    caption: 'Skagen at the wall — hand-lettering the large-letter postcard that became an Austin icon.',
    tag: 'Original Installation'
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
    <div id="rory-skagen-home-archive" className="space-y-12 sm:space-y-16 pb-20 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HERO — ONE EDITORIAL STATEMENT, ONE STAGE. No duplicated
          studio ribbon or masthead; the navbar carries the name.
      ────────────────────────────────────────────────────────────────*/}
      <PageHeader
        kicker="The Studio of Rory Skagen — Austin, Texas"
        statement="Pop surrealism from the roadside imagination"
        support="Four decades of atomic Americana, Kaiju giants, neon supper clubs and landmark Texas murals — original enamels and paintings, available to collectors and curators."
        meta={[
          { label: 'Works Cataloged', value: String(totalWorks) },
          { label: 'Studio Est.', value: '1985' },
          { label: 'Landmark', value: 'Greetings from Austin' },
        ]}
      >
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
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 font-mono text-[11px]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-deep text-foreground/75 hover:bg-muted'
              }`}
            >
              2010 Landmark Archive
            </button>
            <button
              onClick={() => setActiveCategory('monsters')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'monsters'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-deep text-foreground/75 hover:bg-muted'
              }`}
            >
              Kaiju and Pop Monsters
            </button>
            <button
              onClick={() => setActiveCategory('ads')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'ads'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-deep text-foreground/75 hover:bg-muted'
              }`}
            >
              Vintage Advertisements
            </button>
            <button
              onClick={() => setActiveCategory('cocktail')}
              className={`px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === 'cocktail'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-deep text-foreground/75 hover:bg-muted'
              }`}
            >
              Cocktail Hours and Tiki
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archive titles..."
              className="w-full pl-9 pr-3 py-1.5 bg-card border border-line text-xs font-mono text-foreground rounded-xs focus:outline-none focus:border-line-strong transition-colors placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {/* ─────────────────────────────────────────────────────────────
          1b. LANDMARK TRIPTYCH — Greetings from Austin in three eras
      ────────────────────────────────────────────────────────────────*/}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground font-bold flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              THE STUDIO LANDMARK
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif tracking-tight">
              Greetings from Austin — 1998 to Today
            </h2>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            Co-created with Bill Johnston • Roadhouse Relics
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {LANDMARK_TRIPTYCH.map((photo, idx) => (
            <motion.figure
              key={photo.src}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: idx * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden border-2 border-line-strong bg-card shadow-md transition-shadow hover:shadow-xl"
            >
              <div className="relative aspect-4/3 overflow-hidden">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
                {/* Era tag */}
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold uppercase tracking-widest">
                  {photo.tag}
                </span>
                {/* Hover veil */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <figcaption className="p-4 space-y-1 bg-surface">
                <span className="block font-serif font-black text-sm uppercase tracking-tight text-foreground">
                  {photo.era}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-relaxed">
                  {photo.caption}
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN 2-COLUMN ARCHIVE LAYOUT (PRIMARY FEED & SIDEBAR)
      ────────────────────────────────────────────────────────────────*/}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* LEFT COLUMN: THE MASTER 2010 EXHIBITION FEED (Kirunam, Terrordon, Jigoku, Utaho) */}
        <div className="lg:col-span-8 space-y-12 sm:space-y-16">
          <div className="border-b border-line-strong pb-2 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground font-serif">
              Featured Exhibition Works
            </h2>
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
              Original Enamel &amp; Panel Masterpieces
            </span>
          </div>

          {filteredMainExhibition.map((art) => {
            const imageUrl = resolveImageUrl(art.imageKey, art.slug);

            return (
              <article 
                key={art.id} 
                className="group bg-card border-2 border-line-strong p-4 sm:p-6 shadow-md transition-all hover:shadow-xl space-y-4"
              >
                {/* Artwork Media Box */}
                <div 
                  onClick={() => setLightboxArtwork(art)}
                  className="relative aspect-4/3 bg-surface-deep overflow-hidden border border-line cursor-pointer flex items-center justify-center p-3 sm:p-6"
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
                    <span className="px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
                      {art.status}
                    </span>
                    <span className="px-2 py-1 bg-card/90 text-foreground text-[10px] font-mono font-bold border border-line">
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
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-line pb-2">
                    <h3 
                      onClick={() => setLightboxArtwork(art)}
                      className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      {art.title}
                    </h3>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {art.price}
                    </span>
                  </div>

                  {/* Narrative paragraph in artist's exact voice */}
                  <p className="text-sm sm:text-base text-foreground/85 leading-relaxed font-serif italic">
                    &ldquo;{art.narrative}&rdquo;
                  </p>

                  {/* Specifications & Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-muted-foreground">
                      <span className="font-bold text-foreground">{art.medium}</span> • {art.dimensions}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleArchiveInquiry(art)}
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[11px] hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
                        <span>Inquire on Piece</span>
                      </button>
                      <button
                        onClick={() => setLightboxArtwork(art)}
                        className="px-3 py-2 bg-surface-deep border border-line text-foreground font-bold uppercase tracking-wider text-[11px] hover:bg-muted transition-colors cursor-pointer"
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
          <div className="bg-card border-2 border-line-strong p-5 sm:p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b-2 border-line-strong pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500 text-black font-mono font-black text-xs uppercase tracking-widest">
                  2010
                </span>
                <h3 className="font-serif font-black text-lg uppercase tracking-tight text-foreground">
                  Archive Spotlight
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Classic Series
              </span>
            </div>

            {/* Spotlight Artworks */}
            <div className="space-y-6">
              {SIDEBAR_SPOTLIGHTS.map((item) => {
                const img = resolveImageUrl(item.imageKey, item.slug);
                return (
                  <div key={item.id} className="group space-y-2 border-b border-line pb-4 last:border-0 last:pb-0">
                    <div 
                      onClick={() => setLightboxArtwork(item)}
                      className="relative aspect-16/10 bg-surface-deep border border-line overflow-hidden cursor-pointer flex items-center justify-center p-2"
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
                        className="font-serif font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors cursor-pointer uppercase"
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground font-sans leading-relaxed line-clamp-2">
                        {item.narrative}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">{item.dimensions}</span>
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
          <div className="bg-card border-2 border-line-strong p-5 sm:p-6 shadow-md space-y-4">
            <div className="border-b border-line pb-3 flex items-center justify-between">
              <h3 className="font-serif font-black text-lg uppercase tracking-tight text-foreground">
                About Rory Skagen Art
              </h3>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>

            {/* Artist portrait / Photo */}
            <div className="relative aspect-4/3 bg-surface-deep border border-line overflow-hidden flex items-center justify-center">
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

            <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed font-sans">
              Rory Skagen is a pioneering American painter and public muralist based in Austin, Texas. Co-founder of the South Austin Pop Culture Center and co-creator of the legendary <strong className="font-semibold text-foreground">&ldquo;Greetings from Austin&rdquo;</strong> mural, his work merges 1950s atomic pop culture, monster cinema, and retro advertising into an iconic visual universe.
            </p>

            <div className="pt-2 border-t border-line flex items-center justify-between">
              <button
                onClick={() => onNavigate('about')}
                className="text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Read Full Biography</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Other Sites & Landmark Projects by Rory */}
          <div className="bg-surface-deep border border-line p-5 space-y-3 rounded-xs font-mono text-xs">
            <h4 className="font-bold uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-line pb-2">
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Landmarks and Studio Portals</span>
            </h4>
            <ul className="space-y-2.5 text-foreground/80">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-foreground block">Greetings From Austin Mural</strong>
                  <span className="text-[11px] text-muted-foreground">South 1st &amp; Annie Street, Austin TX</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-foreground block">SouthPop Cultural Center</strong>
                  <span className="text-[11px] text-muted-foreground">Preserving Central Texas music &amp; art history</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <div>
                  <strong className="text-foreground block">Planet K Texas Public Murals</strong>
                  <span className="text-[11px] text-muted-foreground">Large-scale psychedelic &amp; pop installations</span>
                </div>
              </li>
            </ul>

            <div className="pt-3 border-t border-line">
              <button
                onClick={() => onNavigate('gallery')}
                className="w-full py-2 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] hover:opacity-90 transition-opacity cursor-pointer rounded-xs"
              >
                Open Full Studio Database
              </button>
            </div>
          </div>
        </aside>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. DUAL CURATED CATEGORY HIGHLIGHTS (VINTAGE ADS & BANNERS)
      ────────────────────────────────────────────────────────────────*/}
      <section className="border-t-2 border-b-2 border-line-strong py-10 sm:py-14 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground font-bold">
            CURATED MEDIUM SPOTLIGHTS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-foreground font-serif">
            Signs, Enamels and Carnival Banners
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Feature 1: Vintage Food Advertisements (Drebbles) */}
          <article className="bg-card border-2 border-line-strong p-6 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-line pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">
                  {DUAL_SHOWCASE.vintageAds.sectionTitle}
                </span>
                <h3 className="text-2xl font-black uppercase text-foreground font-serif">
                  {DUAL_SHOWCASE.vintageAds.title}
                </h3>
              </div>

              <div 
                onClick={() => setLightboxArtwork(DUAL_SHOWCASE.vintageAds as any)}
                className="relative aspect-4/3 bg-surface-deep border border-line overflow-hidden cursor-pointer flex items-center justify-center p-4 group"
              >
                <img
                  src={resolveImageUrl(DUAL_SHOWCASE.vintageAds.imageKey, DUAL_SHOWCASE.vintageAds.slug)}
                  alt={DUAL_SHOWCASE.vintageAds.title}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-103"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold">
                  {DUAL_SHOWCASE.vintageAds.price}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-foreground/85 font-serif italic leading-relaxed">
                {DUAL_SHOWCASE.vintageAds.narrative}
              </p>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">{DUAL_SHOWCASE.vintageAds.dimensions}</span>
              <button
                onClick={() => handleArchiveInquiry(DUAL_SHOWCASE.vintageAds as any)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[10px] hover:opacity-90 transition-opacity cursor-pointer"
              >
                Inquire on Drebbles
              </button>
            </div>
          </article>

          {/* Feature 2: Banner Paintings (Dinosaur Land) */}
          <article className="bg-card border-2 border-line-strong p-6 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-line pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold block mb-0.5">
                  {DUAL_SHOWCASE.banners.sectionTitle}
                </span>
                <h3 className="text-2xl font-black uppercase text-foreground font-serif">
                  {DUAL_SHOWCASE.banners.title}
                </h3>
              </div>

              <div 
                onClick={() => setLightboxArtwork(DUAL_SHOWCASE.banners as any)}
                className="relative aspect-4/3 bg-surface-deep border border-line overflow-hidden cursor-pointer flex items-center justify-center p-4 group"
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

              <p className="text-xs sm:text-sm text-foreground/85 font-serif italic leading-relaxed">
                {DUAL_SHOWCASE.banners.narrative}
              </p>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">{DUAL_SHOWCASE.banners.dimensions}</span>
              <button
                onClick={() => handleArchiveInquiry(DUAL_SHOWCASE.banners as any)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[10px] hover:opacity-90 transition-opacity cursor-pointer"
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
        <div className="border-b border-line-strong pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground block mb-1">
              CANONICAL 2010 COLLECTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif">
              Curated Series and Groups
            </h2>
          </div>
          <button
            onClick={() => onNavigate('gallery')}
            className="text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Browse Complete Catalog ({totalWorks} Works)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {CURATED_FIVE_COLUMNS.map((col, index) => {
            const featImg = resolveImageUrl(col.featured.imageKey, col.featured.slug);

            return (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="bg-card border-2 border-line-strong p-4 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Column Header */}
                  <div className="border-b-2 border-line-strong pb-2">
                    <h3 className="font-serif font-black text-base uppercase text-foreground tracking-tight leading-tight">
                      {col.columnTitle}
                    </h3>
                  </div>

                  {/* Featured Item Preview */}
                  <div 
                    onClick={() => setLightboxArtwork(col.featured)}
                    className="relative aspect-4/3 bg-surface-deep border border-line overflow-hidden cursor-pointer flex items-center justify-center p-2 group"
                  >
                    <img 
                      src={featImg} 
                      alt={col.featured.title} 
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-primary text-primary-foreground text-[8px] font-mono font-bold">
                      {col.featured.price}
                    </div>
                  </div>

                  {/* Featured Item Title & Narrative snippet */}
                  <div className="space-y-1">
                    <h4 
                      onClick={() => setLightboxArtwork(col.featured)}
                      className="font-serif font-bold text-sm text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer uppercase line-clamp-1"
                    >
                      {col.featured.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-sans leading-snug line-clamp-2">
                      {col.featured.narrative}
                    </p>
                  </div>
                </div>

                {/* Sub-links to related works in this column */}
                <div className="pt-3 border-t border-line space-y-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                    More in Series:
                  </span>
                  <ul className="space-y-1 text-xs font-sans">
                    {col.links.map((link, lidx) => (
                      <li key={lidx} className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => onNavigate('artwork', link.slug)}
                          className="text-left text-foreground/85 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors cursor-pointer line-clamp-1 text-[11px]"
                        >
                          {link.title}
                        </button>
                        {link.price && (
                          <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
                            {link.price}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. STUDIO PORTAL & COLLECTOR GATEWAY
      ────────────────────────────────────────────────────────────────*/}
      <section className="bg-card border-2 border-line-strong p-6 sm:p-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[10px] font-mono uppercase tracking-widest font-bold">
              <Award className="w-3.5 h-3.5" />
              <span>Collector &amp; Studio Database</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif">
              Explore the Complete Catalogue — {totalWorks} Works
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">
              The full Rory Skagen Studio archive spans 1985 to present day — original paintings, enamels on panel, and landmark public murals. Open to collectors, curators, and fine art enthusiasts.
            </p>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto text-center space-y-3">
            <button
              onClick={() => onNavigate('gallery')}
              className="w-full sm:w-auto px-8 py-3.5 bg-primary text-primary-foreground font-mono font-bold uppercase tracking-[0.2em] text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <span>Explore Master Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono text-muted-foreground">
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
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border-2 border-line-strong p-4 sm:p-8 shadow-2xl overflow-y-auto flex flex-col md:flex-row gap-6">
            {/* Close Button */}
            <button
              onClick={() => setLightboxArtwork(null)}
              className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground bg-surface-deep border border-line p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Lightbox Image Stage */}
            <div className="md:w-3/5 bg-surface-deep border border-line flex items-center justify-center p-4 min-h-[300px]">
              <img
                src={resolveImageUrl(
                  (lightboxArtwork as ArchiveFeatureDef).imageKey || (lightboxArtwork as any).featured_image || '',
                  lightboxArtwork.slug
                )}
                alt={lightboxArtwork.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            {/* Lightbox Metadata & Narrative */}
            <div className="md:w-2/5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="border-b border-line pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold block mb-1">
                    {lightboxArtwork.year} • {lightboxArtwork.status}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase text-foreground font-serif">
                    {lightboxArtwork.title}
                  </h3>
                </div>

                <div className="text-xs font-mono space-y-1 text-muted-foreground">
                  <div><strong className="text-foreground">Medium:</strong> {lightboxArtwork.medium}</div>
                  <div><strong className="text-foreground">Dimensions:</strong> {lightboxArtwork.dimensions}</div>
                  <div><strong className="text-foreground">Price:</strong> {lightboxArtwork.price}</div>
                </div>

                {lightboxArtwork.narrative && (
                  <div className="pt-2 border-t border-line">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                      Artist Statement:
                    </span>
                    <p className="text-xs sm:text-sm text-foreground/85 font-serif italic leading-relaxed">
                      &ldquo;{lightboxArtwork.narrative}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-line space-y-2">
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
                      featured_image: (lightboxArtwork as ArchiveFeatureDef).imageKey || '',
                      gallery_series: 'Studio Archive',
                      narrative: lightboxArtwork.narrative,
                      filePath: `posts/${lightboxArtwork.slug}.md`
                    };
                    setSelectedInquiryArtwork(rec);
                    setLightboxArtwork(null);
                    setInquiryModalOpen(true);
                  }}
                  className="w-full py-3 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-[11px] hover:opacity-90 transition-opacity cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Studio Inquiry</span>
                </button>

                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setLightboxArtwork(null);
                      onNavigate('artwork', lightboxArtwork.slug);
                    }}
                    className="w-full py-2 bg-surface-deep text-foreground font-mono font-bold uppercase tracking-wider text-[10px] border border-line hover:bg-muted transition-colors cursor-pointer"
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
