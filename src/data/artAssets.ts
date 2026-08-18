// High-fidelity vector artwork renderings for Rory Skagen's portfolio archive

export function getArtworkSvg(slug: string): string {
  switch (slug) {
    case 'greetings-from-austin':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="%231e3c72" />
            <stop offset="50%" stop-color="%232a5298" />
            <stop offset="100%" stop-color="%23f39c12" />
          </linearGradient>
          <linearGradient id="letters" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="%23ffffff" />
            <stop offset="30%" stop-color="%23ffd166" />
            <stop offset="100%" stop-color="%23ef476f" />
          </linearGradient>
          <filter id="retro-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="8" dy="12" stdDeviation="0" flood-color="%23111" flood-opacity="0.9" />
          </filter>
        </defs>
        <!-- Background Postcard Border -->
        <rect width="1200" height="800" fill="%23fbf5e8" />
        <rect x="24" y="24" width="1152" height="752" fill="url(%23sky)" stroke="%231c1917" stroke-width="8" />
        
        <!-- Postcard Banner -->
        <path d="M 120,100 Q 600,60 1080,100 L 1050,180 Q 600,140 150,180 Z" fill="%23ef476f" stroke="%23111" stroke-width="4" filter="url(%23retro-shadow)" />
        <text x="600" y="150" font-family="'Cinzel', 'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="44" fill="%23ffffff" text-anchor="middle" letter-spacing="8">GREETINGS FROM</text>
        
        <!-- Capital Dome & Bats in Background Silhouette -->
        <path d="M 520,380 L 520,330 Q 600,280 600,240 Q 600,280 680,330 L 680,380 Z" fill="%230f172a" opacity="0.6"/>
        <circle cx="600" cy="230" r="14" fill="%23ffd166" />
        <!-- Bats -->
        <path d="M 350,220 Q 370,210 390,220 Q 380,230 370,225 Q 360,230 350,220 Z" fill="%230f172a" />
        <path d="M 400,190 Q 415,180 430,190 Q 422,198 415,194 Q 407,198 400,190 Z" fill="%230f172a" />
        <path d="M 800,200 Q 820,190 840,200 Q 830,210 820,205 Q 810,210 800,200 Z" fill="%230f172a" />
        
        <!-- Giant AUSTIN Letters 3D Block -->
        <g filter="url(%23retro-shadow)">
          <!-- A -->
          <path d="M 90,540 L 210,240 L 290,240 L 370,540 L 285,540 L 265,460 L 195,460 L 175,540 Z M 215,380 L 245,380 L 230,300 Z" fill="%2306d6a0" stroke="%23111" stroke-width="6"/>
          <!-- U -->
          <path d="M 350,240 L 415,240 L 415,440 Q 415,480 450,480 Q 485,480 485,440 L 485,240 L 550,240 L 550,440 Q 550,545 450,545 Q 350,545 350,440 Z" fill="%23ffd166" stroke="%23111" stroke-width="6"/>
          <!-- S -->
          <path d="M 545,260 Q 645,210 710,260 L 675,320 Q 635,280 595,300 Q 565,315 585,350 Q 610,380 720,410 Q 755,480 670,540 Q 580,560 525,500 L 575,445 Q 615,480 660,470 Q 685,455 670,425 Q 640,395 545,360 Q 510,300 545,260 Z" fill="%23ff7b00" stroke="%23111" stroke-width="6"/>
          <!-- T -->
          <path d="M 685,240 L 870,240 L 870,305 L 805,305 L 805,540 L 745,540 L 745,305 L 685,305 Z" fill="%23118ab2" stroke="%23111" stroke-width="6"/>
          <!-- I -->
          <path d="M 855,240 L 925,240 L 925,540 L 855,540 Z" fill="%23ef476f" stroke="%23111" stroke-width="6"/>
          <!-- N -->
          <path d="M 915,240 L 980,240 L 1055,430 L 1055,240 L 1120,240 L 1120,540 L 1055,540 L 980,350 L 980,540 L 915,540 Z" fill="%238338ec" stroke="%23111" stroke-width="6"/>
        </g>

        <!-- Foreground Hill Country & Texas Lone Star -->
        <path d="M 24,700 Q 300,640 600,660 Q 900,680 1176,640 L 1176,776 L 24,776 Z" fill="%232d6a4f" stroke="%23111" stroke-width="4"/>
        <path d="M 24,730 Q 450,680 800,710 Q 1050,720 1176,690 L 1176,776 L 24,776 Z" fill="%231b4332" />
        
        <!-- Postcard Banner TEXAS -->
        <rect x="420" y="600" width="360" height="70" rx="12" fill="%23111827" stroke="%23f39c12" stroke-width="4" filter="url(%23retro-shadow)"/>
        <text x="600" y="650" font-family="'Cinzel', sans-serif" font-weight="900" font-size="42" fill="%23ffd166" text-anchor="middle" letter-spacing="14">★ TEXAS ★</text>
        
        <!-- Retro Halftone Dots Effect Overlay -->
        <circle cx="1060" cy="120" r="45" fill="%23ffd166" opacity="0.8" />
        <text x="1060" y="125" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="bold" fill="%23111" text-anchor="middle">S. 1st &amp; Annie</text>
      </svg>`;

    case 'neon-lone-star-diner':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" result="blur1" />
            <feGaussianBlur stdDeviation="24" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <!-- Deep Night Sky -->
        <rect width="1200" height="800" fill="%230b0b14" />
        <!-- Distant Texas desert horizon -->
        <path d="M 0,550 L 1200,550 L 1200,800 L 0,800 Z" fill="%23161622" />
        <path d="M 0,550 Q 300,530 600,545 Q 900,535 1200,550 Z" fill="%23221c35" />

        <!-- Vintage Roadside Diner Silhouette -->
        <polygon points="650,480 1100,480 1140,620 620,620" fill="%231a1a2b" stroke="%233a3a55" stroke-width="2"/>
        <rect x="700" y="520" width="120" height="60" rx="4" fill="%23ffd166" opacity="0.3" />
        <rect x="850" y="520" width="120" height="60" rx="4" fill="%23ffd166" opacity="0.3" />
        
        <!-- Giant Neon Sign Tower -->
        <line x1="260" y1="200" x2="260" y2="650" stroke="%23334155" stroke-width="14" />
        <line x1="280" y1="200" x2="280" y2="650" stroke="%231e293b" stroke-width="8" />

        <!-- Neon Star Backdrop Shape -->
        <polygon points="270,60 330,190 470,200 360,290 395,420 270,350 145,420 180,290 70,200 210,190" fill="%231e1b4b" stroke="%23e11d48" stroke-width="6" />

        <!-- Glowing Neon Tubes (Pink, Cyan, Amber) -->
        <g filter="url(%23neon-glow)">
          <!-- Glowing Star -->
          <polygon points="270,80 320,185 435,195 345,270 375,375 270,320 165,375 195,270 105,195 220,185" fill="none" stroke="%23ff0055" stroke-width="8" />
          
          <!-- Neon Arrow -->
          <path d="M 270,420 L 480,480 L 460,430 L 530,500 L 450,530 L 470,490 L 270,440 Z" fill="%2300f5d4" stroke="%23ffffff" stroke-width="3" />
          
          <!-- LONE STAR DINER Text -->
          <text x="270" y="240" font-family="'Cinzel', sans-serif" font-weight="900" font-size="44" fill="%23ffffff" stroke="%2300f5d4" stroke-width="3" text-anchor="middle">LONE STAR</text>
          <text x="270" y="300" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="36" fill="%23ffee00" stroke="%23ff5400" stroke-width="2" text-anchor="middle" letter-spacing="6">DINER</text>
          
          <!-- OPEN 24 HRS Capsule -->
          <rect x="180" y="350" width="180" height="42" rx="21" fill="none" stroke="%2300bbff" stroke-width="5" />
          <text x="270" y="378" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="18" fill="%23ffffff" text-anchor="middle" letter-spacing="3">OPEN 24 HRS</text>
        </g>
        
        <!-- Wet Asphalt Reflection -->
        <ellipse cx="270" cy="670" rx="260" ry="40" fill="%23ff0055" opacity="0.15" filter="url(%23neon-glow)" />
        <ellipse cx="480" cy="680" rx="180" ry="30" fill="%2300f5d4" opacity="0.12" filter="url(%23neon-glow)" />
      </svg>`;

    case 'atomic-age-cowboy':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <linearGradient id="atomic-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="%23d90429" />
            <stop offset="60%" stop-color="%23ef233c" />
            <stop offset="100%" stop-color="%23ffb703" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(%23atomic-bg)" />
        
        <!-- 1950s Atomic Boomerang Shapes -->
        <path d="M 100,100 Q 500,-50 900,150 Q 600,400 300,250 Z" fill="%23023047" opacity="0.8" />
        <ellipse cx="850" cy="400" rx="220" ry="80" transform="rotate(-25 850 400)" fill="none" stroke="%238ecae6" stroke-width="8" stroke-dasharray="24 12" />
        <ellipse cx="850" cy="400" rx="80" ry="220" transform="rotate(-25 850 400)" fill="none" stroke="%23ffd166" stroke-width="8" />
        <circle cx="850" cy="400" r="45" fill="%23ffffff" stroke="%23023047" stroke-width="8" />
        
        <!-- Classic 1959 Tail-Fin Cadillac Silhouette -->
        <g transform="translate(150, 420)">
          <!-- Fins and car body -->
          <path d="M 0,220 L 80,180 L 300,160 L 600,160 L 820,120 L 850,70 L 890,200 L 860,250 L 50,250 Z" fill="%23f8f9fa" stroke="%23023047" stroke-width="8" />
          <!-- Tail Fin Bullet Taillight -->
          <circle cx="860" cy="80" r="18" fill="%23d90429" stroke="%23fff" stroke-width="4" />
          <path d="M 860,80 L 980,60" stroke="%23ffee38" stroke-width="6" stroke-linecap="round" />
          <circle cx="200" cy="250" r="60" fill="%23111" stroke="%23fff" stroke-width="12" />
          <circle cx="200" cy="250" r="25" fill="%23e5e5e5" />
          <circle cx="700" cy="250" r="60" fill="%23111" stroke="%23fff" stroke-width="12" />
          <circle cx="700" cy="250" r="25" fill="%23e5e5e5" />
        </g>
        
        <!-- Atomic Cowboy Pop Art Silhouette with Raygun & Hat -->
        <g transform="translate(320, 160)">
          <!-- Stetson Hat -->
          <path d="M 120,120 Q 220,40 320,120 Q 220,90 120,120 Z" fill="%23fff" stroke="%23111" stroke-width="8" />
          <path d="M 160,110 Q 220,30 280,110 Z" fill="%23ffb703" stroke="%23111" stroke-width="6" />
          <!-- Raygun Ray -->
          <path d="M 440,240 L 900,180" stroke="%2300f5d4" stroke-width="12" stroke-dasharray="30 15" />
          <!-- Starburst badge -->
          <circle cx="220" cy="220" r="80" fill="%23023047" stroke="%23ffb703" stroke-width="6" />
          <text x="220" y="230" font-family="'Cinzel', sans-serif" font-size="22" font-weight="900" fill="%23fff" text-anchor="middle">ATOMIC 1959</text>
        </g>
        
        <!-- Pop Art Ben-Day Dots Pattern Border -->
        <rect x="30" y="30" width="1140" height="740" fill="none" stroke="%23023047" stroke-width="12" />
      </svg>`;

    case 'armadillo-world-headquarters':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <radialGradient id="psy-sun" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="%23ffdd00" />
            <stop offset="35%" stop-color="%23ff6600" />
            <stop offset="70%" stop-color="%23cc0066" />
            <stop offset="100%" stop-color="%232b0938" />
          </radialGradient>
        </defs>
        <rect width="1200" height="800" fill="url(%23psy-sun)" />
        
        <!-- Sunburst Rays -->
        <g stroke="%23ffffff" stroke-width="3" opacity="0.25">
          <line x1="600" y1="400" x2="0" y2="0" />
          <line x1="600" y1="400" x2="300" y2="0" />
          <line x1="600" y1="400" x2="600" y2="0" />
          <line x1="600" y1="400" x2="900" y2="0" />
          <line x1="600" y1="400" x2="1200" y2="0" />
          <line x1="600" y1="400" x2="1200" y2="400" />
          <line x1="600" y1="400" x2="1200" y2="800" />
          <line x1="600" y1="400" x2="0" y2="800" />
          <line x1="600" y1="400" x2="0" y2="400" />
        </g>

        <!-- Cosmic Armadillo Silhouette & Armor Plates -->
        <g transform="translate(240, 220)">
          <!-- Tail -->
          <path d="M 50,320 Q 0,280 -40,340 Q 10,360 80,350 Z" fill="%234a5568" stroke="%23fff" stroke-width="4"/>
          <!-- Shell / Back Curve -->
          <path d="M 60,340 Q 150,80 480,100 Q 640,120 700,280 L 650,360 Q 350,380 60,340 Z" fill="%232d3748" stroke="%23fff" stroke-width="8" />
          <!-- Armor bands -->
          <path d="M 220,130 Q 250,350 240,360" stroke="%23cbd5e1" stroke-width="6" fill="none" />
          <path d="M 310,115 Q 340,350 330,365" stroke="%23cbd5e1" stroke-width="6" fill="none" />
          <path d="M 400,110 Q 430,350 420,370" stroke="%23cbd5e1" stroke-width="6" fill="none" />
          <path d="M 490,115 Q 520,350 510,370" stroke="%23cbd5e1" stroke-width="6" fill="none" />
          <!-- Head and Snout -->
          <path d="M 680,240 L 780,310 L 750,340 L 660,310 Z" fill="%234a5568" stroke="%23fff" stroke-width="6" />
          <circle cx="710" cy="280" r="10" fill="%23ff0055" />
          <!-- Ears -->
          <polygon points="670,240 680,170 710,230" fill="%23e2e8f0" stroke="%23111" stroke-width="4" />
          <polygon points="695,240 715,175 735,235" fill="%23cbd5e1" stroke="%23111" stroke-width="4" />
        </g>
        
        <!-- Retro Banner -->
        <rect x="150" y="60" width="900" height="90" rx="16" fill="%23111827" stroke="%23ffdd00" stroke-width="6" />
        <text x="600" y="122" font-family="'Cinzel', serif" font-weight="900" font-size="40" fill="%23ffdd00" text-anchor="middle" letter-spacing="6">ARMADILLO WORLD HQ</text>
        
        <!-- Austin TX Subtitle -->
        <rect x="360" y="660" width="480" height="60" rx="30" fill="%23e11d48" stroke="%23fff" stroke-width="4" />
        <text x="600" y="700" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="24" fill="%23ffffff" text-anchor="middle" letter-spacing="6">COSMIC HONKY TONK • 1970</text>
      </svg>`;

    case 'route-66-relic':
    case 'texas-route-66-motel':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <rect width="1200" height="800" fill="%23111827" />
        <!-- Big Texas Route 66 Shield -->
        <path d="M 400,100 L 800,100 Q 820,380 600,680 Q 380,380 400,100 Z" fill="%23ffffff" stroke="%23b91c1c" stroke-width="18" />
        <!-- Shield Top Header -->
        <path d="M 416,116 L 784,116 L 784,240 L 416,240 Z" fill="%23b91c1c" />
        <text x="600" y="200" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="64" fill="%23ffffff" text-anchor="middle" letter-spacing="8">TEXAS</text>
        <!-- 66 Numerals -->
        <text x="600" y="540" font-family="'Cinzel', sans-serif" font-weight="900" font-size="280" fill="%23111827" text-anchor="middle">66</text>
        
        <!-- Motel Vacancy Neon Badge -->
        <rect x="100" y="320" width="220" height="120" rx="14" fill="%230369a1" stroke="%2338bdf8" stroke-width="6" />
        <text x="210" y="375" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="26" fill="%23f8fafc" text-anchor="middle">MOTEL</text>
        <text x="210" y="415" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="22" fill="%234ade80" text-anchor="middle">VACANCY</text>
      </svg>`;

    case 'saturn-v-midcentury-voyage':
    case 'mid-century-spaceman':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <linearGradient id="space-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="%23050510" />
            <stop offset="50%" stop-color="%231a0933" />
            <stop offset="100%" stop-color="%232b1055" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(%23space-grad)" />
        
        <!-- Ringed Planet -->
        <circle cx="950" cy="220" r="110" fill="%23fb8500" />
        <ellipse cx="950" cy="220" rx="220" ry="35" transform="rotate(-20 950 220)" fill="none" stroke="%23ffb703" stroke-width="16" />
        
        <!-- Rocket Ship 50s Sci-Fi -->
        <g transform="translate(300, 150) rotate(-35 300 250)">
          <!-- Exhaust Flame -->
          <polygon points="120,450 180,650 240,450" fill="%23ffb703" />
          <polygon points="140,450 180,580 220,450" fill="%23d90429" />
          <!-- Body -->
          <path d="M 180,50 Q 280,250 260,450 L 100,450 Q 80,250 180,50 Z" fill="%23ffffff" stroke="%230f172a" stroke-width="8" />
          <!-- Cockpit Window -->
          <circle cx="180" cy="200" r="40" fill="%2300b4d8" stroke="%230f172a" stroke-width="6" />
          <!-- Fins -->
          <polygon points="100,320 0,460 100,440" fill="%23d90429" stroke="%230f172a" stroke-width="6" />
          <polygon points="260,320 360,460 260,440" fill="%23d90429" stroke="%230f172a" stroke-width="6" />
        </g>
        
        <text x="600" y="720" font-family="'Cinzel', sans-serif" font-weight="900" font-size="44" fill="%23ffd166" text-anchor="middle" letter-spacing="12">LONE STAR ORBIT 1965</text>
      </svg>`;

    case 'south-congress-twilight':
    case 'south-congress-dusk':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="%231e1b4b" />
            <stop offset="40%" stop-color="%23701a75" />
            <stop offset="80%" stop-color="%23f97316" />
            <stop offset="100%" stop-color="%23fef08a" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(%23dusk-sky)" />
        
        <!-- Palm Trees Silhouette -->
        <path d="M 120,700 Q 150,450 180,250" stroke="%2309090b" stroke-width="16" fill="none" />
        <path d="M 180,250 Q 80,180 20,240 M 180,250 Q 150,140 100,160 M 180,250 Q 220,130 260,180 M 180,250 Q 280,200 320,260" stroke="%2309090b" stroke-width="8" fill="none" />

        <!-- Austin Capitol at end of Congress Ave -->
        <polygon points="560,540 600,420 640,540" fill="%2309090b" />
        <rect x="585" y="380" width="30" height="40" fill="%2309090b" />
        <circle cx="600" cy="370" r="16" fill="%2309090b" />

        <!-- South Congress Sign -->
        <rect x="750" y="240" width="360" height="140" rx="12" fill="%2318181b" stroke="%23ef4444" stroke-width="6" />
        <text x="930" y="300" font-family="'Cinzel', sans-serif" font-weight="900" font-size="34" fill="%23ffffff" text-anchor="middle">SOCO MOTEL</text>
        <text x="930" y="350" font-family="'JetBrains Mono', monospace" font-size="20" fill="%2338bdf8" text-anchor="middle">AUSTIN, TEXAS</text>

        <!-- Street Glow -->
        <polygon points="200,800 600,560 1000,800" fill="%2318181b" />
        <line x1="600" y1="560" x2="600" y2="800" stroke="%23eab308" stroke-width="8" stroke-dasharray="30 20" />
      </svg>`;

    default:
      // Elegant retro pop art generic graphic
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
        <defs>
          <linearGradient id="art-bg-${slug}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="%231f2937" />
            <stop offset="100%" stop-color="%23111827" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(%23art-bg-${slug})" />
        <circle cx="600" cy="400" r="260" fill="none" stroke="%23d4af37" stroke-width="6" stroke-dasharray="16 8" />
        <polygon points="600,180 750,480 450,480" fill="%23ef4444" opacity="0.3" />
        <rect x="250" y="320" width="700" height="160" rx="16" fill="%230f172a" stroke="%23f59e0b" stroke-width="6" />
        <text x="600" y="390" font-family="'Cinzel', serif" font-weight="900" font-size="44" fill="%23ffffff" text-anchor="middle" letter-spacing="4">${slug.replace(/-/g, ' ').toUpperCase()}</text>
        <text x="600" y="445" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="20" fill="%23d4af37" text-anchor="middle" letter-spacing="8">RORY SKAGEN STUDIO ARCHIVE</text>
        <rect x="40" y="40" width="1120" height="720" fill="none" stroke="%23d4af37" stroke-width="4" />
      </svg>`;
  }
}
