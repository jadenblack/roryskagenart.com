import React, { useState, useEffect } from 'react';
import { DriveFile, ArtworkRecord } from '../types';
import { 
  FolderTree, 
  FileText, 
  Image, 
  Plus, 
  Save, 
  Check, 
  Folder, 
  Search,
  Layers,
  X,
  Cloud
} from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';

interface DriveExplorerProps {
  files: DriveFile[];
  initialSelectedPath?: string;
  onSaveFile: (path: string, content: string) => void;
  onCreateArtwork: (record: Partial<ArtworkRecord>, narrative: string) => void;
  onSelectArtwork: (slug: string) => void;
  onOpenCloudinary?: () => void;
}

export const DriveExplorer: React.FC<DriveExplorerProps> = ({
  files = [],
  initialSelectedPath,
  onSaveFile,
  onCreateArtwork,
  onOpenCloudinary
}) => {
  const safeFiles = files || [];
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(() => {
    if (initialSelectedPath) {
      return safeFiles.find((f) => f.path === initialSelectedPath) || safeFiles[0] || null;
    }
    return safeFiles.find((f) => f.path === 'index.md') || safeFiles[0] || null;
  });

  const [editorContent, setEditorContent] = useState<string>(selectedFile?.content || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [newArtworkModalOpen, setNewArtworkModalOpen] = useState(false);
  const [folderFilter, setFolderFilter] = useState<'all' | 'posts' | 'pages' | 'images' | 'root'>('all');
  const [fileSearch, setFileSearch] = useState('');

  // New artwork form state
  const [newTitle, setNewTitle] = useState('');
  const [newYear, setNewYear] = useState('2024');
  const [newMedium, setNewMedium] = useState('Oil & Acrylic on Linen');
  const [newDimensions, setNewDimensions] = useState('40" x 50"');
  const [newPrice, setNewPrice] = useState('$9,500');
  const [newStatus, setNewStatus] = useState('Available');
  const [newSeries, setNewSeries] = useState('Neon Americana');
  const [newNarrative, setNewNarrative] = useState('Original contemporary retro pop painting created by Rory Skagen in Austin, Texas.');

  useEffect(() => {
    if (initialSelectedPath) {
      const found = files.find((f) => f.path === initialSelectedPath);
      if (found) {
        setSelectedFile(found);
        setEditorContent(found.content);
      }
    }
  }, [initialSelectedPath, files]);

  const handleSelectFile = (file: DriveFile) => {
    setSelectedFile(file);
    setEditorContent(file.content);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    if (!selectedFile) return;
    onSaveFile(selectedFile.path, editorContent);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCreateArtworkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateArtwork(
      {
        title: newTitle,
        year: parseInt(newYear, 10) || 2024,
        medium: newMedium,
        dimensions: newDimensions,
        price: newPrice,
        status: newStatus as any,
        gallery_series: newSeries,
      },
      `# ${newTitle}\n\n${newNarrative}`
    );

    setNewArtworkModalOpen(false);
    setNewTitle('');
  };

  const filteredFiles = safeFiles.filter((f) => {
    if (!f) return false;
    if (folderFilter !== 'all' && f.folder !== folderFilter) return false;
    if (fileSearch && !f.path.toLowerCase().includes(fileSearch.toLowerCase())) return false;
    return true;
  });

  const getFolderIcon = (folder: string) => {
    switch (folder) {
      case 'posts':
        return <Layers className="w-3.5 h-3.5 text-zinc-500" />;
      case 'pages':
        return <FileText className="w-3.5 h-3.5 text-zinc-500" />;
      case 'images':
        return <Image className="w-3.5 h-3.5 text-zinc-500" />;
      default:
        return <Folder className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      {/* Top Banner */}
      <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 flex items-center justify-between flex-wrap gap-4 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-2 font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"></span>
            <span>RORY SKAGEN STUDIO — DRIVE REPOSITORY</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans">
            Drive File System &amp; Markdown Workspace
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 font-sans">
            Directly author, modify, and inspect <code className="text-zinc-900 dark:text-zinc-300 font-bold">{DRIVE_ROOT_PATH}</code> files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenCloudinary && (
            <button
              onClick={onOpenCloudinary}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-[0.15em] text-[10px] transition-colors cursor-pointer rounded-xs shadow-xs"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Cloudinary CDN Hub</span>
            </button>
          )}

          <button
            onClick={() => setNewArtworkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Artwork Record (.md)</span>
          </button>
        </div>
      </div>

      {/* Workspace Split Layout: File Tree (Left) & Editor/Viewer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: File Tree Explorer */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-4 space-y-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-950 dark:text-white flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> Directory Tree
            </span>
            <span className="text-[9px] text-zinc-500">{files.length} Files</span>
          </div>

          {/* Folder tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[10px]">
            {(['all', 'posts', 'pages', 'images', 'root'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFolderFilter(f)}
                className={`px-2 py-1 uppercase tracking-wider transition-colors font-bold rounded-xs cursor-pointer ${
                  folderFilter === f
                    ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-zinc-950 dark:border-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search files */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="filter_files..."
              className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 pl-8 pr-2 py-1 text-[10px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 rounded-xs"
            />
          </div>

          {/* Files List */}
          <div className="space-y-1 max-h-[550px] overflow-y-auto pr-1">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[10px] text-left transition-all rounded-xs cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-zinc-950 dark:border-white font-bold shadow-xs'
                      : 'text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {getFolderIcon(file.folder)}
                    <span className="truncate">{file.path}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 flex-shrink-0 ml-2">{file.size}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code/Markdown Editor & Live Preview */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 overflow-hidden space-y-0 shadow-xs transition-colors">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-[#F2F1EC] dark:bg-black border-b border-zinc-200 dark:border-zinc-800 p-3 sm:px-4 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                {selectedFile && getFolderIcon(selectedFile.folder)}
                <span>{selectedFile ? selectedFile.path : 'Select a file'}</span>
              </span>
              {selectedFile?.lastModified && (
                <span className="text-[9px] text-zinc-500 hidden sm:inline">
                  (Modified: {selectedFile.lastModified})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              {selectedFile?.extension === 'md' && (
                <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 border border-zinc-300 dark:border-zinc-800 rounded-xs">
                  <button
                    onClick={() => setPreviewMode('edit')}
                    className={`px-2.5 py-1 uppercase tracking-wider transition-colors font-bold rounded-xs cursor-pointer ${
                      previewMode === 'edit' ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setPreviewMode('split')}
                    className={`px-2.5 py-1 uppercase tracking-wider transition-colors font-bold rounded-xs cursor-pointer ${
                      previewMode === 'split' ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className={`px-2.5 py-1 uppercase tracking-wider transition-colors font-bold rounded-xs cursor-pointer ${
                      previewMode === 'preview' ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              )}

              {/* Save file button */}
              <button
                onClick={handleSave}
                disabled={selectedFile?.extension === 'svg'}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-[0.15em] text-[10px] hover:bg-black dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 cursor-pointer rounded-xs shadow-xs"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div className="p-4">
            {selectedFile?.extension === 'svg' ? (
              <div className="p-8 text-center space-y-4 bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xs">
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-bold">Vector Artwork Asset ({selectedFile.path})</p>
                <div className="max-w-md mx-auto aspect-[4/3] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-4 flex items-center justify-center shadow-xs">
                  <img src={selectedFile.content} alt={selectedFile.name} className="max-h-full object-contain" />
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-4 ${
                  previewMode === 'split'
                    ? 'grid-cols-1 lg:grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {/* Code Textarea */}
                {(previewMode === 'edit' || previewMode === 'split') && (
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block font-bold">
                      Markdown Source Editor
                    </span>
                    <textarea
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      rows={22}
                      className="w-full bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 text-[11px] text-zinc-900 dark:text-zinc-200 leading-relaxed focus:outline-none focus:border-zinc-500 resize-y font-mono rounded-xs"
                      spellCheck={false}
                    />
                  </div>
                )}

                {/* Live Preview */}
                {(previewMode === 'preview' || previewMode === 'split') && (
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block font-bold">
                      Live Parsed Output
                    </span>
                    <div className="bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-5 overflow-y-auto max-h-[520px] text-zinc-900 dark:text-zinc-200 text-xs space-y-4 leading-relaxed rounded-xs">
                      <div className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400 text-[9px] uppercase tracking-wider font-bold">
                        Studio Sync Engine: Live Preview with Frontmatter &amp; Wikilink Parser
                      </div>
                      <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <pre className="text-zinc-800 dark:text-zinc-400 text-[10px] bg-white dark:bg-zinc-900 p-3 border border-zinc-300 dark:border-zinc-800 overflow-x-auto rounded-xs">
                          {editorContent.substring(0, 1500)}...
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Artwork Authoring Modal */}
      {newArtworkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl rounded-xs">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
              <div>
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-1 font-bold">
                  <span className="w-1.5 h-1.5 bg-zinc-900 dark:bg-white inline-block"></span>
                  <span>AUTHOR NEW STUDIO RECORD</span>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans">
                  New Artwork Markdown Post
                </h2>
              </div>
              <button
                onClick={() => setNewArtworkModalOpen(false)}
                className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-1.5 cursor-pointer rounded-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateArtworkSubmit} className="space-y-4 text-[10px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Artwork Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Austin Neon Skyline"
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Production Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Medium / Substrate</label>
                  <input
                    type="text"
                    value={newMedium}
                    onChange={(e) => setNewMedium(e.target.value)}
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Dimensions</label>
                  <input
                    type="text"
                    value={newDimensions}
                    onChange={(e) => setNewDimensions(e.target.value)}
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Valuation / Pricing</label>
                  <input
                    type="text"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Curated Series</label>
                  <input
                    type="text"
                    value={newSeries}
                    onChange={(e) => setNewSeries(e.target.value)}
                    className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-2 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 rounded-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 text-[9px] font-bold">Curatorial Narrative</label>
                <textarea
                  rows={4}
                  value={newNarrative}
                  onChange={(e) => setNewNarrative(e.target.value)}
                  className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-3 text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none rounded-xs font-mono"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewArtworkModalOpen(false)}
                  className="px-4 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-400 uppercase tracking-wider cursor-pointer rounded-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer rounded-xs shadow-xs"
                >
                  Create &amp; Publish Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
