export type ArtworkStatus = 'Available' | 'Sold' | 'Archived' | 'Public Installation' | 'Private Collection' | 'Limited Edition' | 'Disabled' | 'Trashed';

export interface ArtworkRecord {
  slug: string;
  title: string;
  year: number | string;
  date?: string;
  medium: string;
  dimensions: string; // e.g. "48\" x 60\""
  dimensions_cm?: string; // e.g. "122 x 152 cm"
  status: ArtworkStatus;
  price: string;
  featured_image: string; // relative image path e.g. "images/greetings-from-austin.svg"
  imageUrl?: string;
  gallery_series: string; // e.g. "Austin Iconic Murals", "Neon Americana", "Atomic Pop", "Texas Folklore"
  edition?: string; // e.g. "Original Oil on Canvas", "Edition of 25 Archival Prints"
  location?: string; // e.g. "Austin, TX (South 1st & Annie St)"
  surface?: string; // e.g. "Canvas", "Panel", "Illustration Board"
  type?: 'post' | 'page';
  enabled?: boolean;
  archived?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  narrative: string; // Raw markdown body
  renderedHtml?: string; // Rendered with resolved wikilinks
  rawContent?: string; // Full markdown source with frontmatter
  filePath: string; // Full drive path e.g. "posts/greetings-from-austin.md"
  tags?: string[];
  scaleCategory?: 'small' | 'medium' | 'large' | 'monumental'; // for scale visualizer
}

export interface DriveFile {
  path: string; // relative to rootPath, e.g. "posts/greetings-from-austin.md"
  name: string;
  folder: 'root' | 'images' | 'pages' | 'posts' | 'trash';
  extension: 'md' | 'svg' | 'jpg' | 'png' | 'json';
  content: string;
  size: string;
  lastModified: string;
  isVirtual?: boolean;
}

export interface FilterState {
  search: string;
  status: string; // "all" | status
  medium: string; // "all" | medium
  series: string; // "all" | series
  sort: 'newest' | 'oldest' | 'price-desc' | 'price-asc' | 'title';
}

export interface MasterIndexRow {
  slug: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  status: string;
  price: string;
  series: string;
  imageFile: string;
  tags: string;
}

export interface PageDocument {
  slug: string;
  title: string;
  subtitle?: string;
  filePath: string;
  rawMarkdown: string;
}

export interface CloudinaryResource {
  publicId: string;
  format: string;
  version: number;
  resourceType: string;
  type: string;
  createdAt: string;
  bytes: number;
  width: number;
  height: number;
  folder: string;
  url: string;
  thumbnailUrl: string;
}

export interface CloudinaryStatus {
  configured: boolean;
  connected: boolean;
  cloudName: string | null;
  message: string;
  error?: string;
}
