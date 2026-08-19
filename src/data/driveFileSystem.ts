import { DriveFile } from '../types';
import { getArtworkSvg } from './artAssets';
import { generateFullIndexMd, generateAllPostsRecord, PORTFOLIO_POSTS_REGISTRY } from './portfolioPostsData';
import { CLOUDINARY_ASSETS_MAP } from './cloudinaryMap';
import { MEDIA_ASSETS_LOG } from './mediaAssetsData';

export const DRIVE_ROOT_PATH = "My Drive/Clients/roryskagen.com/website-content/";

export const INITIAL_INDEX_MD = generateFullIndexMd();

export const INITIAL_README_MD = `# Rory Skagen Studio — Fine Art Works & Catalog

This directory structure powers the official marketing and fine art sales site for **Rory Skagen Studio** (roryskagen.com). The website is designed to read directly from this synchronized Google Drive repository.

## Directory Layout
\`\`\`
My Drive/Clients/roryskagen.com/website-content/
├── index.md        # Master Map Index table of all portfolio entries
├── readme.md       # Foundational project guidelines (this file)
├── images/         # Original high-res artwork files (.svg, .jpg, .png)
├── pages/          # Static markdown pages (About, Contact, Exhibitions, Commissions)
└── posts/          # Portfolio artwork records with YAML frontmatter
\`\`\`

## Markdown Post Schema (posts/*.md)
Every artwork entry in \`posts/\` must contain YAML frontmatter matching this standard:

\`\`\`yaml
---
title: "Artwork Title"
slug: "unique-kebab-slug"
year: 2024
medium: "Oil on Linen"
dimensions: "48\\" x 60\\""
dimensions_cm: "122 x 152 cm"
status: "Available" # Available | Sold | Public Installation | Private Collection | Limited Edition
price: "$14,500"
featured_image: "images/unique-kebab-slug.svg"
gallery_series: "Neon Americana" # Austin Iconic Murals | Neon Americana | Atomic Pop | Texas Folklore
edition: "Original Painting"
location: "Austin Studio"
tags: [neon, roadside, retro]
---
\`\`\`

## Hyperlink & Media Resolution Rules
- **Internal Wiki Links:** Use \`[[slug}]]\` or \`[[slug]]\` or \`[[slug|Custom Label]]\` to automatically generate client-side SPA routing links.
- **Page Links:** Use \`[[pages/about]]\` or \`[[pages/commissions]]\` to route to informational pages.
- **Image Embeds:** Use standard markdown \`![Alt Text](images/slug.svg)\` to automatically pull from the \`images/\` folder.

## Studio Admin Authentication (Pure Native Node.js • Zero Dependencies)
- **Password Hashing:** Native \`crypto.scryptSync\` with 16-byte random salts and constant-time \`crypto.timingSafeEqual\` comparison.
- **Session Tokens:** 32-byte cryptographic random hex tokens mapped to active user IDs.
- **Cookie Security:** HttpOnly, SameSite=Lax, and Secure flags with 7-day TTL.
- **Dual Verification:** Native cookie parsing with fallback support for \`Authorization: Bearer <token>\`.
`;

export const INITIAL_PAGES: Record<string, string> = {
  'about.md': `---
title: About
date: '2011-01-24'
slug: about
type: page
status: Archived
location: Austin, TX
tags:
- art/location/austin
- art/status/archived
---

[[index|← Return to Resource Map Index]]

---

![[Rory-Skagen-Photo.jpg]]

<p style="text-align: left;">Rory Skagen moved to Austin, TX  in 1992 and began working as a professional artist in 1994. This websites contains the highlights of the fine art side of his career since 1999. Rory's paintings reflect his appreciation of the "visual concept and the art of ideas." Although the content frequently changes, Rory's imagery usually maintains a sense of absurd optimism.</p>
<p style="text-align: left;">Beside his focus on fine art. Rory Skagen freelances as a commercial artist. Over the years he has created a line of art products that are available at Christmas at the Blue Genie Art Bazaar, and the Armadillo Christmas Bazaar, as well as year round at the upcoming Blue Genie store at the popular tourist destination Oasis, Texas.</p>
<p style="text-align: left;">For inquiries regarding the purchase of one of Rory's paintings please contact him via email or telephone from the [Contact ](http:roryskagen.local/contact/)page.</p>
<p style="text-align: left;">And for additional information about the art of Rory Skagen visit his websites:</p>
Central Texas Murals: [centraltexasmurals.com](http://centraltexasmurals.com/)  
Skagen Designs (coming soon): [skagendesign.com](http://skagendesign.com/)  
Blue Genie Art Bazaar: [bluegenieartbazaar.com](http://bluegenieartbazaar.com/)
`,

  'contact.md': `---
title: Contact
date: '2011-01-25'
slug: contact
type: page
status: Archived
location: Austin, TX
tags:
- art/location/austin
- art/status/archived
---

[[index|← Return to Resource Map Index]]

---

![[Rory-Skagen-Photo.jpg]]

# **Rory Skagen**

**<span style="color: #484d79;">Phone: </span>**512-916-9847

**<span style="color: #484d79;">Email: </span>**[rory@bluegenieart.com](mailto:rory@bluegenieart.com)

**<span style="color: #484d79;">Mailing Address:</span>**  
Rory Skagen Art  
2209 S 1st St, Ste F  
Austin TX 78704
`,

  'commissions.md': `---
title: "Commission Guidelines & Public Art"
subtitle: "Custom Canvas Paintings, Neon Installations & Large-Scale Murals"
slug: "commissions"
---

# Commissioning Custom Artwork

Rory Skagen accepts a strictly limited number of private canvas commissions and municipal/commercial public art murals each calendar year.

## 1. Canvas Paintings (Private & Corporate)
- **Scale:** Sizes range from 36" x 48" up to 72" x 120" multi-panel works.
- **Mediums:** Fine oil on Belgian linen, acrylic with palladium/gold metal leaf, and illuminated neon-hybrid canvas.
- **Themes:** Custom roadside Americana, retro Texas architecture, vintage automobile portraits, and atomic-age pop landscapes.
- **Timeline:** Typically 8–14 weeks from concept approval.
- **Pricing:** Inquire with dimensions and desired theme.

## 2. Public & Commercial Murals
As seen in the iconic **[[greetings-from-austin|Greetings from Austin Landmark}]]**, Skagen's murals are engineered to withstand exterior elements using industrial UV-resistant acrylic silicates and elastomeric masonry primers.

### Process:
1. **Initial Site Survey & Conceptual Brief**
2. **Color Study & Digital Architectural Renderings**
3. **Execution & Sealant Application**

Ready to discuss your project? [[pages/contact|Send a Studio Inquiry]].
`,

  'exhibitions.md': `---
title: "Exhibition History & Public Works"
subtitle: "Museum Showings, Gallery Retrospectives & Landmark Installations"
slug: "exhibitions"
---

# Selected Exhibitions & Installations

### Public Landmark Installations
- **1998–Present:** *Greetings from Austin* (South 1st & Annie St, Austin, TX)
- **2014:** *Keep Austin Weird Retro Revival* (Austin Convention Center)
- **2018:** *Lone Star Cosmic Highway* (Willie Nelson Blvd / 2nd Street)
- **2022:** *Texas Neon Odyssey* (East Austin Arts District)

### Solo Exhibitions
- **2024:** *Neon Twilight & Atomic Dreams*, Modern Pop Gallery (Dallas, TX)
- **2023:** *The Open Highway: 30 Years of Texas Pop*, Yard Dog Gallery (Austin, TX)
- **2021:** *Cosmic Armadillo: A Tribute to Austin's Golden Era*, South Congress Arts (Austin, TX)
- **2019:** *Atomic Sunset: Mid-Century Sci-Fi & Americana*, Desert Modern (Palm Springs, CA)

### Permanent Museum Collections
- Austin Museum of Popular Culture (SouthPop)
- The Wittliff Collections (Texas State University)
- San Antonio Pop Art Foundation
`
};

export const INITIAL_POSTS: Record<string, string> = {
  ...generateAllPostsRecord(),
  'greetings-from-austin.md': `---
title: "Greetings from Austin Mural"
slug: "greetings-from-austin"
year: 1998
date: "1998-05-12"
medium: "Enamel & Acrylic on Masonry"
dimensions: "20' x 40'"
dimensions_cm: "610 x 1220 cm"
status: "Public Installation"
price: "Public Landmark"
featured_image: "images/greetings-from-austin.svg"
gallery_series: "Austin Iconic Murals"
edition: "Permanent Public Landmark"
location: "South 1st & Annie Street, Austin, TX"
tags: [mural, iconic, postcard, texas, austin, landmark]
scaleCategory: "monumental"
---

# Greetings from Austin Mural

Painted in 1998 by **Rory Skagen** (with Bill Brakhage and Jerod Foster), the *Greetings from Austin* mural is one of the most photographed and beloved cultural landmarks in Texas.

![Greetings from Austin](images/greetings-from-austin.svg)

## Historical Significance
Modeled after the nostalgic 1940s "Large Letter" linen postcards by Curt Teich & Co., each oversized letter in **AUSTIN** showcases a distinct piece of local iconography:
- **A:** The Texas State Capitol dome silhouette.
- **U:** Austin's legendary Congress Avenue bridge bat colony at dusk.
- **S:** Wild Texas Bluebonnets and Hill Country terrain.
- **T:** The University of Texas Tower.
- **I:** Barton Springs natural spring-fed oasis.
- **N:** Iconic live music venues and cosmic cowboy folklore.

> *"When we first rolled paint on that exterior brick wall on South 1st Street in 1998, we never dreamed it would become a global symbol for the city. It was pure love for Austin's vintage soul."*
> — **Rory Skagen**

### Related Works
- Explore the companion night study: [[south-congress-twilight|South Congress Twilight Marquee}]]
- Discover the psychedelic roots in [[armadillo-world-headquarters|Cosmic Armadillo Honky-Tonk}]]
- Learn about the artist's roots in the [[pages/about|Artist Biography]]
`,

  'neon-lone-star-diner.md': `---
title: "Lone Star Diner at 2 AM"
slug: "neon-lone-star-diner"
year: 2023
date: "2023-11-04"
medium: "Oil & Acrylic on Linen"
dimensions: "48\\" x 72\\""
dimensions_cm: "122 x 183 cm"
status: "Hidden"
enabled: false
price: "$14,500"
featured_image: "images/neon-lone-star-diner.svg"
gallery_series: "Neon Americana"
edition: "Original Oil on Linen"
location: "Rory Skagen Studio, Austin, TX"
tags: [neon, diner, night, roadside, lone-star, oil-painting]
scaleCategory: "large"
---

# Lone Star Diner at 2 AM

*Lone Star Diner at 2 AM* captures the cinematic romance of isolated Texas roadside diners illuminated only by buzzing neon tubes against the pitch-black desert night.

![Lone Star Diner](images/neon-lone-star-diner.svg)

## Visual Composition
Skagen masterfully renders the intense glow of hot magenta and cyan gas-discharge neon tubes reflecting across damp asphalt and polished chrome siding.

### Key Metrics & Details
- **Palette:** Prussian blue, obsidian black, cadmium red, neon magenta, glowing phosphorescent cyan.
- **Technique:** Multi-layered oil glazes over an acrylic underpainting to maximize luminescence.
- **Framing:** Custom hand-finished blackened walnut gallery float frame included.

> *"There's a sacred quietude to a 24-hour Texas roadside diner when the highway has gone still and only the neon star is humming."*

### Related Studies
- Compare with [[route-66-relic|Route 66 Neon Motel Shield}]]
- View commission options in [[pages/commissions|Custom Art Services]]
`,

  'atomic-age-cowboy.md': `---
title: "Atomic Cowboy & 1959 Caddy"
slug: "atomic-age-cowboy"
year: 2022
date: "2022-08-15"
medium: "Acrylic on Canvas with Metal Leaf"
dimensions: "40\\" x 60\\""
dimensions_cm: "101 x 152 cm"
status: "Hidden"
enabled: false
price: "$9,800"
featured_image: "images/atomic-age-cowboy.svg"
gallery_series: "Atomic Pop"
edition: "Original Canvas"
location: "Rory Skagen Studio, Austin, TX"
tags: [retro, 1950s, cadillac, space-age, atomic, cowboy]
scaleCategory: "large"
---

# Atomic Cowboy & 1959 Caddy

A collision of classic Western iconography and 1950s atomic-age optimism, *Atomic Cowboy & 1959 Caddy* features a high-octane palette with genuine palladium leaf accents on the iconic bullet tail-fins.

![Atomic Cowboy](images/atomic-age-cowboy.svg)

## Narrative & Inspiration
Inspired by the 1950s space race craze that swept Texas, Skagen imagines a futuristic cowhand navigating the cosmos in a rocket-finned Eldorado.

- **Surface:** Heavyweight primed 12oz cotton canvas on heavy gallery stretcher bars.
- **Accents:** Genuine palladium metal leaf on the chrome bumpers and tail-fin trim.
- **Series:** Part of the artist's acclaimed *Atomic Pop* cycle.

See also: [[saturn-v-midcentury-voyage|Lone Star Orbit: Apollo Retro}]]
`,

  'armadillo-world-headquarters.md': `---
title: "Cosmic Armadillo Honky-Tonk"
slug: "armadillo-world-headquarters"
year: 2021
date: "2021-04-20"
medium: "Serigraph on Archival Cotton"
dimensions: "36\\" x 48\\""
dimensions_cm: "91 x 122 cm"
status: "Hidden"
enabled: false
price: "$3,200"
featured_image: "images/armadillo-world-headquarters.svg"
gallery_series: "Texas Folklore"
edition: "Edition of 25 (Signed & Numbered)"
location: "Austin Studio Archive"
tags: [armadillo, cosmic-cowboy, music, austin, poster-art]
scaleCategory: "medium"
---

# Cosmic Armadillo Honky-Tonk

An homage to the legendary **Armadillo World Headquarters**—the hall where Austin's cosmic cowboys, hippies, and rednecks united to forge the modern Live Music Capital of the World.

![Cosmic Armadillo](images/armadillo-world-headquarters.svg)

## The Story
Printed using 14 distinct hand-pulled silkscreen screens on 300gsm Coventry Rag archival paper, this piece channels the psychedelic poster art movement pioneered by Jim Franklin and Kerry Awn.

### Specifications:
- **Print Method:** 14-Color Hand-Pulled Screenprint
- **Paper:** 300 gsm 100% Archival Cotton Rag with Deckled Edges
- **Status:** Only 4 prints remaining in the edition of 25.

Related: [[pages/about|Read the Story of Austin Pop Art]]
`,

  'route-66-relic.md': `---
title: "Route 66 Neon Motel Shield"
slug: "route-66-relic"
year: 2024
date: "2024-02-18"
medium: "Enamel on Die-Cut Aluminum"
dimensions: "44\\" x 52\\""
dimensions_cm: "112 x 132 cm"
status: "Hidden"
enabled: false
price: "$11,200"
featured_image: "images/route-66-relic.svg"
gallery_series: "Neon Americana"
edition: "Unique Sculptural Painting"
location: "Rory Skagen Studio, Austin, TX"
tags: [route66, motel, neon, americana, aluminum, enamel]
scaleCategory: "large"
---

# Route 66 Neon Motel Shield

A sculptural painting executed on custom laser-cut aeronautical aluminum, capturing the glorious decay and weathered patina of Texas Route 66 motel signage.

![Route 66 Relic](images/route-66-relic.svg)

## Construction
- **Substrate:** 1/8" Heavy Gauge Aircraft Grade Aluminum with Standoff Cleats.
- **Finish:** Industrial sign enamel treated with authentic multi-stage distressing and high-gloss automotive clear coat.
- **Mounting:** Floats 1.5 inches off the wall with integrated aluminum french cleat system.

Explore more from this series in [[neon-lone-star-diner|Lone Star Diner at 2 AM}]].
`,

  'saturn-v-midcentury-voyage.md': `---
title: "Lone Star Orbit: Apollo Retro"
slug: "saturn-v-midcentury-voyage"
year: 2022
date: "2022-07-20"
medium: "Oil on Panel"
dimensions: "36\\" x 36\\""
dimensions_cm: "91 x 91 cm"
status: "Hidden"
enabled: false
price: "$7,400"
featured_image: "images/saturn-v-midcentury-voyage.svg"
gallery_series: "Atomic Pop"
edition: "Private Collection (Houston, TX)"
location: "Houston, TX"
tags: [space, nasa, retro-future, saturn, apollo]
scaleCategory: "medium"
---

# Lone Star Orbit: Apollo Retro

Celebrating Texas's central role in the space age through the lens of pulp sci-fi magazine covers and 1960s NASA mission illustrations.

![Apollo Retro](images/saturn-v-midcentury-voyage.svg)

*Collection of Dr. and Mrs. Marcus Vance, Houston, Texas.*
`,

  'south-congress-twilight.md': `---
title: "South Congress Twilight Marquee"
slug: "south-congress-twilight"
year: 2023
date: "2023-09-10"
medium: "Oil on Stretched Linen"
dimensions: "50\\" x 70\\""
dimensions_cm: "127 x 178 cm"
status: "Hidden"
enabled: false
price: "$16,000"
featured_image: "images/south-congress-twilight.svg"
gallery_series: "Austin Iconic Murals"
edition: "Commissioned Original"
location: "Private Collection (Austin, TX)"
tags: [soco, austin, sunset, marquee, palm-trees, oil]
scaleCategory: "large"
---

# South Congress Twilight Marquee

Looking north up Austin's vibrant South Congress Avenue as the twilight turns deep violet and magenta, with the Texas Capitol dome gleaming in the distance.

![South Congress Twilight](images/south-congress-twilight.svg)

## Overview
Captured during the golden hour on South Congress, this painting features the classic motel marquee, swaying palm fronds, and the iconic silhouette of the Texas Capitol.

Companion piece to the world-famous [[greetings-from-austin|Greetings from Austin Mural}]].
`,

  'vintage-fiesta-drive-in.md': `---
title: "1959 Fiesta Drive-In Romance"
slug: "vintage-fiesta-drive-in"
year: 2020
date: "2020-10-12"
medium: "Acrylic on Board"
dimensions: "32\\" x 48\\""
dimensions_cm: "81 x 122 cm"
status: "Hidden"
enabled: false
price: "$6,900"
featured_image: "images/vintage-fiesta-drive-in.svg"
gallery_series: "Neon Americana"
edition: "Original Acrylic on Hardboard"
location: "Austin Studio"
tags: [drivein, movie, cars, retro, fiesta]
scaleCategory: "medium"
---

# 1959 Fiesta Drive-In Romance

A luminous nostalgic study of Texas outdoor drive-in movie theaters in their prime, featuring gleaming classic cars parked beneath towering projector beams and moonlit clouds.

![Fiesta Drive-In](images/vintage-fiesta-drive-in.svg)
`,

  'retro-dr-pepper-parody.md': `---
title: "Texas Fizz Vintage Soda Cap"
slug: "retro-dr-pepper-parody"
year: 2021
date: "2021-06-18"
medium: "Distressed Enamel on Heavy Steel"
dimensions: "38\\" Diameter"
dimensions_cm: "96 cm Diameter"
status: "Hidden"
enabled: false
price: "$5,500"
featured_image: "images/retro-dr-pepper-parody.svg"
gallery_series: "Texas Folklore"
edition: "Sculptural Steel Wall Piece"
location: "Waco, TX"
tags: [soda, enamel, vintage-sign, texas, bottlecap]
scaleCategory: "medium"
---

# Texas Fizz Vintage Soda Cap

A 38-inch heavy die-pressed steel bottle cap paying homage to vintage Texas soda bottling heritage with distressed enamel typography.

![Texas Fizz](images/retro-dr-pepper-parody.svg)
`,

  'lone-star-bucking-bronco.md': `---
title: "Lone Star State Fair Rodeo"
slug: "lone-star-bucking-bronco"
year: 2024
date: "2024-05-30"
medium: "Acrylic & Silkscreen on Wood"
dimensions: "42\\" x 54\\""
dimensions_cm: "107 x 137 cm"
status: "Hidden"
enabled: false
price: "$8,600"
featured_image: "images/lone-star-bucking-bronco.svg"
gallery_series: "Texas Folklore"
edition: "Original Mixed Media on Birch Panel"
location: "Austin Studio"
tags: [rodeo, bronco, fair, vintage-poster, western]
scaleCategory: "large"
---

# Lone Star State Fair Rodeo

A high-contrast action piece capturing the explosive motion of the classic Texas rodeo, combined with vintage 1930s State Fair lithograph poster styling.

![Lone Star Rodeo](images/lone-star-bucking-bronco.svg)
`,

  'tiki-oasis-polynesian.md': `---
title: "Austin Polynesian Modern Lounge"
slug: "tiki-oasis-polynesian"
year: 2022
date: "2022-03-14"
medium: "Mixed Media & Gold Leaf"
dimensions: "36\\" x 48\\""
dimensions_cm: "91 x 122 cm"
status: "Hidden"
enabled: false
price: "$7,800"
featured_image: "images/tiki-oasis-polynesian.svg"
gallery_series: "Atomic Pop"
edition: "Original Mixed Media"
location: "Austin Studio"
tags: [tiki, cocktail, midcentury, tropical, pop]
scaleCategory: "medium"
---

# Austin Polynesian Modern Lounge

A sultry mid-century tribute to vintage Polynesian pop and Austin's storied tiki cocktail bars of the 1960s, featuring real 23k gold leaf embellishments.

![Tiki Oasis](images/tiki-oasis-polynesian.svg)
`,

  'matador-velvet-parody.md': `---
title: "El Toro & The Velvet Horizon"
slug: "matador-velvet-parody"
year: 2019
date: "2019-11-20"
medium: "Oil & Velvet Flocking"
dimensions: "40\\" x 50\\""
dimensions_cm: "101 x 127 cm"
status: "Hidden"
enabled: false
price: "$8,200"
featured_image: "images/matador-velvet-parody.svg"
gallery_series: "Texas Folklore"
edition: "Original Painting with Black Velvet"
location: "San Antonio, TX"
tags: [matador, velvet, camp, pop, southwest]
scaleCategory: "large"
---

# El Toro & The Velvet Horizon

A playful and affectionate nod to 1970s black-velvet painting traditions of the American Southwest, elevated with classical oil glaze techniques and satirical pop irony.

![El Toro](images/matador-velvet-parody.svg)
`
};

export function buildInitialVirtualFileSystem(): DriveFile[] {
  const files: DriveFile[] = [];

  // 1. Root files
  files.push({
    path: 'index.md',
    name: 'index.md',
    folder: 'root',
    extension: 'md',
    content: INITIAL_INDEX_MD,
    size: '14.8 KB',
    lastModified: '2026-08-18 10:45 AM'
  });

  files.push({
    path: 'readme.md',
    name: 'readme.md',
    folder: 'root',
    extension: 'md',
    content: INITIAL_README_MD,
    size: '1.2 KB',
    lastModified: '2026-08-18 09:30 AM'
  });

  // 2. Pages
  for (const [filename, content] of Object.entries(INITIAL_PAGES)) {
    files.push({
      path: `pages/${filename}`,
      name: filename,
      folder: 'pages',
      extension: 'md',
      content,
      size: `${(content.length / 1024).toFixed(1)} KB`,
      lastModified: '2026-08-15 02:15 PM'
    });
  }

  // 3. Posts
  for (const [filename, content] of Object.entries(INITIAL_POSTS)) {
    files.push({
      path: `posts/${filename}`,
      name: filename,
      folder: 'posts',
      extension: 'md',
      content,
      size: `${(content.length / 1024).toFixed(1)} KB`,
      lastModified: '2026-08-18 10:15 AM'
    });
  }

  // 4. Images - Verified 174 Cloudinary Media Assets & SVG representations
  for (const asset of MEDIA_ASSETS_LOG) {
    const filename = asset.filename;
    const ext = filename.endsWith('.png') ? 'png' : 'jpg';
    const sizeKb = asset.bytes ? `${(asset.bytes / 1024).toFixed(1)} KB` : 'CDN Asset';
    files.push({
      path: `images/${filename}`,
      name: filename,
      folder: 'images',
      extension: ext,
      content: asset.url,
      size: sizeKb,
      lastModified: '2026-08-18 11:00 AM'
    });
  }

  const allSlugs = Array.from(
    new Set([
      ...PORTFOLIO_POSTS_REGISTRY.map((p) => p.slug),
      'greetings-from-austin',
      'neon-lone-star-diner',
      'atomic-age-cowboy',
      'armadillo-world-headquarters',
      'route-66-relic',
      'saturn-v-midcentury-voyage',
      'south-congress-twilight',
      'vintage-fiesta-drive-in',
      'retro-dr-pepper-parody',
      'lone-star-bucking-bronco',
      'tiki-oasis-polynesian',
      'matador-velvet-parody'
    ])
  );

  for (const slug of allSlugs) {
    const svgData = getArtworkSvg(slug);
    files.push({
      path: `images/${slug}.svg`,
      name: `${slug}.svg`,
      folder: 'images',
      extension: 'svg',
      content: svgData,
      size: '2.4 KB',
      lastModified: '2026-08-10 11:00 AM'
    });
  }

  return files;
}
