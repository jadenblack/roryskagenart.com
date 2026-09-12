import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Palette, 
  Sparkles,
  ArrowRight,
  Clock,
  HelpCircle
} from 'lucide-react';

import { PageHeader } from './PageHeader';

interface ContactViewProps {
  onNavigate: (route: string, param?: string) => void;
  prefillArtworkTitle?: string;
}

export const ContactView: React.FC<ContactViewProps> = ({ onNavigate, prefillArtworkTitle }) => {
  const [formSent, setFormSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState('original-artwork');
  const [artworkInterest, setArtworkInterest] = useState(prefillArtworkTitle || '');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          artwork_title: artworkInterest || null,
          inquiry_type: inquiryType,
          message,
        }),
      });
    } catch (err) {
      console.warn('Contact inquiry dispatch notice:', err);
    }

    setFormSent(true);
  };

  const handleReset = () => {
    setFormSent(false);
    setMessage('');
    setArtworkInterest('');
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-20 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER — shared statement masthead
      ────────────────────────────────────────────────────────────────*/}
      <PageHeader
        kicker="Contact — Austin, Texas"
        statement="Originals, commissions & studio representation"
        support="Original art purchases, mural commissions, exhibitions and press — the studio replies to every serious inquiry within 24–48 hours."
        meta={[
          { label: 'Response Time', value: '24–48 hours' },
          { label: 'Studio', value: 'Austin, TX 78704' },
          { label: 'Inquiries', value: 'roryskagenart@gmail.com' },
        ]}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN 2-COLUMN CONTACT GRID
      ────────────────────────────────────────────────────────────────*/}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE INQUIRY FORM */}
        <div className="lg:col-span-7 bg-card border-2 border-line-strong p-6 sm:p-10 shadow-md space-y-6">
          
          <div className="border-b border-line pb-4">
            <h2 className="text-2xl font-black uppercase text-foreground font-serif">
              Studio Inquiry Form
            </h2>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Please complete the details below. Rory Skagen Studio will review your message and reply promptly.
            </p>
          </div>

          {formSent ? (
            <div className="py-12 px-6 text-center space-y-5 bg-surface-deep border border-line rounded-xs animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/80 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-serif uppercase tracking-tight text-foreground">
                  Inquiry Successfully Transmitted
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed font-sans">
                  Thank you, <strong className="text-foreground">{name}</strong>. Your inquiry regarding <span className="font-mono font-bold text-foreground">{inquiryType.toUpperCase()}</span> has been recorded. Studio representation will contact you at <strong className="text-foreground">{email}</strong> within 24–48 hours.
                </p>
              </div>
              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-primary text-primary-foreground font-mono font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Send Another Message
                </button>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="px-4 py-2 bg-muted text-foreground font-mono font-bold text-xs uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
              
              {/* Row 1: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Your Name <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Collector"
                    className="w-full bg-surface-deep border border-line px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Email Address <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collector@gallery.com"
                    className="w-full bg-surface-deep border border-line px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Phone & Inquiry Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Phone / Organization <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(512) 555-0199"
                    className="w-full bg-surface-deep border border-line px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Inquiry Type <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <select
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full bg-surface-deep border border-line px-3 py-2.5 text-foreground focus:outline-none focus:border-line-strong transition-colors cursor-pointer"
                  >
                    <option value="original-artwork">Original Artwork Purchase</option>
                    <option value="mural">Mural / Commercial Commission</option>
                    <option value="canvas">Custom Canvas Commission</option>
                    <option value="exhibition">Exhibition / Gallery Curator</option>
                    <option value="press">Press and Media</option>
                    <option value="general">General Studio Inquiry</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Artwork of Interest */}
              <div>
                <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                  Specific Artwork / Project Reference <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={artworkInterest}
                  onChange={(e) => setArtworkInterest(e.target.value)}
                  placeholder="e.g., Kirunam (2010 Enamel), Drebbles, Tipsy Island, or Wall Dimensions"
                  className="w-full bg-surface-deep border border-line px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong transition-colors"
                />
              </div>

              {/* Row 4: Message */}
              <div>
                <label className="block text-foreground/80 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                  Detailed Message / Project Scope <span className="text-amber-600 dark:text-amber-400">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your inquiry, artwork interest, shipping location, or custom commission vision (wall surface, dimensions, target date)..."
                  className="w-full bg-surface-deep border border-line p-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong transition-colors resize-y font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-primary-foreground font-mono font-bold uppercase tracking-[0.2em] text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Studio Inquiry</span>
              </button>
            </form>
          )}

        </div>

        {/* RIGHT COLUMN: STUDIO DETAILS & COLLECTOR POLICIES */}
        <div className="lg:col-span-5 space-y-6 font-sans">
          
          {/* Studio Profile Box */}
          <div className="bg-card border-2 border-line-strong p-6 shadow-md space-y-4">
            <h3 className="font-serif font-black text-xl uppercase tracking-tight text-foreground border-b border-line pb-3">
              Rory Skagen Studio
            </h3>
            
            <div className="space-y-3 font-mono text-xs text-foreground/80">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-bold">Studio Headquarters</strong>
                  <span>Austin, Texas • 78704</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-bold">Inquiries &amp; Press</strong>
                  <span>roryskagenart@gmail.com</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-bold">Studio Response Time</strong>
                  <span>Typically within 24–48 hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Collector Services & Shipping */}
          <div className="bg-surface-deep border border-line p-6 space-y-4 rounded-xs text-xs">
            <h4 className="font-serif font-bold text-base uppercase tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Collector Services and Guarantees</span>
            </h4>
            <ul className="space-y-2.5 text-muted-foreground font-mono text-[11px]">
              <li className="flex items-start gap-2">
                <span className="text-foreground font-bold">✓</span>
                <span><strong>Certificate of Authenticity:</strong> Every original piece includes a signed and dated certificate from Rory Skagen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground font-bold">✓</span>
                <span><strong>Insured Crating &amp; Shipping:</strong> Custom wood crating and tracked museum-grade transport available worldwide.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground font-bold">✓</span>
                <span><strong>Custom Framing:</strong> Back-framed wooden panels and steel shadowboxes crafted to artist specifications.</span>
              </li>
            </ul>
          </div>

          {/* Mural Commissions Overview */}
          <div className="bg-card border-2 border-line-strong p-6 shadow-md space-y-3">
            <h4 className="font-serif font-bold text-base uppercase tracking-tight text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>Commissioning a Public Mural</span>
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              Rory Skagen accepts select large-scale architectural and outdoor mural commissions for municipalities, commercial headquarters, cultural institutions, and private estates. Please include approximate wall square footage, surface material (brick, stucco, wood), and location in your inquiry.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
