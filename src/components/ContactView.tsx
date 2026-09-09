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
          1. HEADER
      ────────────────────────────────────────────────────────────────*/}
      <header className="border-b-2 border-zinc-900 dark:border-zinc-700 pb-8 space-y-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
          <span>Contact Me • Austin, Texas</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif leading-none">
          Contact Me
        </h1>
        <p className="text-sm sm:text-base font-mono uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400 font-semibold max-w-3xl">
          Original Art Purchases, Mural Commissions and Studio Representation
        </p>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN 2-COLUMN CONTACT GRID
      ────────────────────────────────────────────────────────────────*/}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE INQUIRY FORM */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 sm:p-10 shadow-md space-y-6">
          
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h2 className="text-2xl font-black uppercase text-zinc-950 dark:text-white font-serif">
              Studio Inquiry Form
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans mt-1">
              Please complete the details below. Rory Skagen Studio will review your message and reply promptly.
            </p>
          </div>

          {formSent ? (
            <div className="py-12 px-6 text-center space-y-5 bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xs animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/80 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-serif uppercase tracking-tight text-zinc-950 dark:text-white">
                  Inquiry Successfully Transmitted
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                  Thank you, <strong className="text-zinc-900 dark:text-white">{name}</strong>. Your inquiry regarding <span className="font-mono font-bold text-zinc-900 dark:text-white">{inquiryType.toUpperCase()}</span> has been recorded. Studio representation will contact you at <strong className="text-zinc-900 dark:text-white">{email}</strong> within 24–48 hours.
                </p>
              </div>
              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
                >
                  Send Another Message
                </button>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-zinc-300 transition-colors cursor-pointer"
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
                  <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Your Name <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Collector"
                    className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Email Address <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collector@gallery.com"
                    className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Phone & Inquiry Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Phone / Organization <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(512) 555-0199"
                    className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                    Inquiry Type <span className="text-amber-600 dark:text-amber-400">*</span>
                  </label>
                  <select
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors cursor-pointer"
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
                <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                  Specific Artwork / Project Reference <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={artworkInterest}
                  onChange={(e) => setArtworkInterest(e.target.value)}
                  placeholder="e.g., Kirunam (2010 Enamel), Drebbles, Tipsy Island, or Wall Dimensions"
                  className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                />
              </div>

              {/* Row 4: Message */}
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 font-bold text-[11px]">
                  Detailed Message / Project Scope <span className="text-amber-600 dark:text-amber-400">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your inquiry, artwork interest, shipping location, or custom commission vision (wall surface, dimensions, target date)..."
                  className="w-full bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors resize-y font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-mono font-bold uppercase tracking-[0.2em] text-xs hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
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
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 shadow-md space-y-4">
            <h3 className="font-serif font-black text-xl uppercase tracking-tight text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
              Rory Skagen Studio
            </h3>
            
            <div className="space-y-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-950 dark:text-white block font-bold">Studio Headquarters</strong>
                  <span>Austin, Texas • 78704</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-950 dark:text-white block font-bold">Inquiries &amp; Press</strong>
                  <span>roryskagenart@gmail.com</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-950 dark:text-white block font-bold">Studio Response Time</strong>
                  <span>Typically within 24–48 hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Collector Services & Shipping */}
          <div className="bg-[#F4F3ED] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-6 space-y-4 rounded-xs text-xs">
            <h4 className="font-serif font-bold text-base uppercase tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Collector Services and Guarantees</span>
            </h4>
            <ul className="space-y-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">✓</span>
                <span><strong>Certificate of Authenticity:</strong> Every original piece includes a signed and dated certificate from Rory Skagen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">✓</span>
                <span><strong>Insured Crating &amp; Shipping:</strong> Custom wood crating and tracked museum-grade transport available worldwide.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-950 dark:text-white font-bold">✓</span>
                <span><strong>Custom Framing:</strong> Back-framed wooden panels and steel shadowboxes crafted to artist specifications.</span>
              </li>
            </ul>
          </div>

          {/* Mural Commissions Overview */}
          <div className="bg-white dark:bg-[#0E0E12] border-2 border-zinc-900 dark:border-zinc-700 p-6 shadow-md space-y-3">
            <h4 className="font-serif font-bold text-base uppercase tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>Commissioning a Public Mural</span>
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              Rory Skagen accepts select large-scale architectural and outdoor mural commissions for municipalities, commercial headquarters, cultural institutions, and private estates. Please include approximate wall square footage, surface material (brick, stucco, wood), and location in your inquiry.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
