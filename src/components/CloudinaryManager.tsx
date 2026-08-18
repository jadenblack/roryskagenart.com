import React, { useState, useEffect } from 'react';
import { CloudinaryResource, CloudinaryStatus, ArtworkRecord } from '../types';
import { GalleryAppEngineInstance } from '../engine/galleryStateEngine';
import { 
  Cloud, 
  UploadCloud, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  Image as ImageIcon, 
  X, 
  Copy, 
  CheckCircle2, 
  Link, 
  HardDrive
} from 'lucide-react';

interface CloudinaryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  artworks: ArtworkRecord[];
  onSelectArtwork?: (slug: string) => void;
}

export const CloudinaryManager: React.FC<CloudinaryManagerProps> = ({
  isOpen,
  onClose,
  artworks,
}) => {
  const [status, setStatus] = useState<CloudinaryStatus>({
    configured: false,
    connected: false,
    cloudName: null,
    message: 'Checking Cloudinary connection status...'
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [resources, setResources] = useState<CloudinaryResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'upload' | 'setup'>('browse');

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFolder, setUploadFolder] = useState('roryskagen/website-content/images');
  const [targetArtworkSlug, setTargetArtworkSlug] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch status on mount or when opened
  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/cloudinary/status');
      const data: CloudinaryStatus = await res.json();
      setStatus(data);
      if (data.connected) {
        fetchResources();
      }
    } catch (err: any) {
      setStatus({
        configured: false,
        connected: false,
        cloudName: null,
        message: 'Could not communicate with backend server: ' + (err.message || 'Network error')
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchResources = async () => {
    setLoadingResources(true);
    try {
      const res = await fetch('/api/cloudinary/resources?max_results=60');
      if (res.ok) {
        const data = await res.json();
        setResources(data.resources || []);
      }
    } catch (err) {
      console.error('Failed to fetch Cloudinary resources', err);
    } finally {
      setLoadingResources(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadUrl) {
      setUploadMessage({ type: 'error', text: 'Please choose a file or provide an image URL.' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      let data: any;

      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('folder', uploadFolder);
        if (targetArtworkSlug) {
          formData.append('public_id', targetArtworkSlug);
        }

        const res = await fetch('/api/cloudinary/upload', {
          method: 'POST',
          body: formData,
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
      } else {
        const res = await fetch('/api/cloudinary/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: uploadUrl,
            folder: uploadFolder,
            public_id: targetArtworkSlug || undefined
          })
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
      }

      setUploadMessage({
        type: 'success',
        text: `Successfully uploaded to Cloudinary: ${data.publicId}`
      });

      // Synchronize into engine if assigned or selected
      if (data.url && data.publicId) {
        GalleryAppEngineInstance.syncCloudinaryAsset(
          data.url,
          data.publicId,
          targetArtworkSlug || undefined
        );
      }

      // Reset form
      setUploadFile(null);
      setUploadUrl('');
      fetchResources();
      setTimeout(() => {
        setActiveTab('browse');
      }, 1200);
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Error uploading to Cloudinary'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncToArtwork = (resource: CloudinaryResource, slug: string) => {
    GalleryAppEngineInstance.syncCloudinaryAsset(resource.url, resource.publicId, slug);
    setCopiedUrl(resource.publicId);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="relative w-full max-w-4xl bg-[#0D0D10] border border-zinc-800 p-6 sm:p-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
        {/* Header Bar */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
            <div>
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                <span className={`w-1.5 h-1.5 ${status.connected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span>MEDIA ENGINE INTEGRATION</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-white font-sans flex items-center gap-2">
                <Cloud className="w-5 h-5 text-zinc-300" />
                Cloudinary Asset Hub
              </h2>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Connection Status Badge */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 mb-6 flex items-center justify-between flex-wrap gap-3 text-[10px]">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
              <div>
                <span className="font-bold text-white uppercase tracking-wider">
                  {status.connected ? `Connected: ${status.cloudName}` : status.configured ? 'Configured (Verifying)' : 'Not Configured in Environment'}
                </span>
                <p className="text-zinc-500 text-[9px] mt-0.5">{status.message}</p>
              </div>
            </div>

            <button
              onClick={checkStatus}
              disabled={loadingStatus}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[9px] uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-6 text-[10px]">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-zinc-800 text-white font-bold border-l-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Browse Cloudinary Assets ({resources.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-zinc-800 text-white font-bold border-l-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Upload Artwork Asset
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'setup'
                  ? 'bg-zinc-800 text-white font-bold border-l-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              API Credentials Setup Guide
            </button>
          </div>

          {/* TAB 1: Browse Assets */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {!status.connected ? (
                <div className="p-6 bg-zinc-950 border border-zinc-800 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Cloudinary Credentials Needed</h4>
                  <p className="text-[10px] text-zinc-400 max-w-md mx-auto">
                    Provide your Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` or `CLOUDINARY_URL`) in Settings Secrets to browse and sync real photography.
                  </p>
                  <button
                    onClick={() => setActiveTab('setup')}
                    className="px-4 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                  >
                    View Setup Instructions
                  </button>
                </div>
              ) : loadingResources ? (
                <div className="py-12 text-center text-zinc-500 text-[10px] space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-zinc-400" />
                  <p>Fetching media library from Cloudinary...</p>
                </div>
              ) : resources.length === 0 ? (
                <div className="p-8 bg-zinc-950 border border-zinc-800 text-center space-y-3">
                  <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">No Assets Found Yet</h4>
                  <p className="text-[10px] text-zinc-500">
                    Upload Rory Skagen artwork photos to your Cloudinary cloud or click the Upload tab.
                  </p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                  >
                    Upload First Artwork
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-1">
                  {resources.map((res) => {
                    const isCopied = copiedUrl === res.url || copiedUrl === res.publicId;
                    return (
                      <div
                        key={res.publicId}
                        className="bg-zinc-950 border border-zinc-800 p-3 space-y-2 flex flex-col justify-between hover:border-zinc-700 transition-colors group"
                      >
                        <div className="aspect-square bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center relative">
                          <img
                            src={res.thumbnailUrl || res.url}
                            alt={res.publicId}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[8px] text-zinc-300 uppercase tracking-widest font-mono">
                            {res.format} · {res.width}x{res.height}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-white truncate" title={res.publicId}>
                            {res.publicId.split('/').pop()}
                          </p>
                          <p className="text-[8px] text-zinc-500 truncate">{res.folder || 'root'}</p>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyLink(res.url)}
                              className="flex-1 py-1 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] uppercase tracking-wider text-zinc-300 flex items-center justify-center gap-1"
                              title="Copy Cloudinary CDN URL"
                            >
                              {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                              <span>{isCopied ? 'Copied' : 'Copy URL'}</span>
                            </button>
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
                              title="Open original in new tab"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>

                          {/* Link to existing artwork dropdown */}
                          <div className="flex items-center gap-1">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleSyncToArtwork(res, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                              className="w-full py-1 px-1.5 bg-zinc-900 border border-zinc-800 text-[8px] text-zinc-300 focus:outline-none focus:border-zinc-500 cursor-pointer"
                            >
                              <option value="" disabled>
                                Sync as Post Image...
                              </option>
                              {artworks.map((art) => (
                                <option key={art.slug} value={art.slug}>
                                  {art.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Upload Artwork */}
          {activeTab === 'upload' && (
            <form onSubmit={handleFileUpload} className="space-y-4 text-[10px]">
              {uploadMessage && (
                <div
                  className={`p-3 border text-[10px] flex items-center gap-2 ${
                    uploadMessage.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-red-950/40 border-red-800 text-red-300'
                  }`}
                >
                  {uploadMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{uploadMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    1. Choose Image File (.jpg, .png, .webp, .tiff)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                        setUploadUrl('');
                      }
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-300 file:bg-zinc-800 file:text-white file:border-0 file:px-2 file:py-1 file:text-[9px] file:uppercase file:tracking-wider file:cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Or Provide Remote Image URL
                  </label>
                  <input
                    type="url"
                    value={uploadUrl}
                    onChange={(e) => {
                      setUploadUrl(e.target.value);
                      if (e.target.value) setUploadFile(null);
                    }}
                    placeholder="https://images.example.com/rory-skagen-painting.jpg"
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Target Artwork Post (Optional Auto-Sync)
                  </label>
                  <select
                    value={targetArtworkSlug}
                    onChange={(e) => setTargetArtworkSlug(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    <option value="">Do not auto-assign (Library upload only)</option>
                    {artworks.map((art) => (
                      <option key={art.slug} value={art.slug}>
                        Assign to: {art.title} ({art.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Cloudinary Folder
                  </label>
                  <input
                    type="text"
                    value={uploadFolder}
                    onChange={(e) => setUploadFolder(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to Cloudinary...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload &amp; Sync Image</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Setup Guide */}
          {activeTab === 'setup' && (
            <div className="space-y-4 text-[10px] text-zinc-400">
              <div className="p-4 bg-zinc-950 border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white"></span>
                  Cloudinary Environment Secrets Setup
                </h4>
                <p className="leading-relaxed">
                  Your Cloudinary API key and secrets are securely managed on the server backend without ever exposing keys to the browser.
                </p>

                <div className="bg-zinc-900 border border-zinc-800 p-3 space-y-2 font-mono text-[9px]">
                  <p className="text-zinc-300 font-bold">Your Account Parameters (Pre-configured):</p>
                  <pre className="text-zinc-400 whitespace-pre-wrap">
{`# Cloud Name & API Key are auto-linked:
CLOUDINARY_CLOUD_NAME=xjilp2pq
CLOUDINARY_API_KEY=576841392331492

# Secret required in Settings → Secrets:
CLOUDINARY_API_SECRET=<your_secret_from_cloudinary>

# Or as a single Connection String:
CLOUDINARY_URL=cloudinary://576841392331492:<your_secret>@xjilp2pq`}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <p className="text-zinc-300 font-bold">Steps to Activate:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-400">
                    <li>Open <strong>Settings → Secrets</strong> in the AI Studio platform panel.</li>
                    <li>Add <code>CLOUDINARY_API_SECRET</code> with your secret key (or add <code>CLOUDINARY_URL</code>).</li>
                    <li>Click <strong>Refresh Status</strong> above to verify the live connection.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-6 border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-600">
          <span>Rory Skagen Digital Archive · Media Pipeline</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
