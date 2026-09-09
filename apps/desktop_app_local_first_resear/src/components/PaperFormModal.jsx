import React, { useState } from 'react';
import { X, Upload, BookPlus } from 'lucide-react';

export default function PaperFormModal({ isOpen, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [totalPages, setTotalPages] = useState('');
  const [tags, setTags] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        // Save persistent Data URL (base64) so it survives application reloads
        setPdfFile(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: 'p_' + Date.now(),
      title,
      authors: authors || 'Unknown Author',
      year: Number(year) || new Date().getFullYear(),
      totalPages: Number(totalPages) || 1,
      currentPage: 0,
      status: 'Not Started',
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      notes: '',
      pdfUrl: pdfFile,
      createdAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-stone-700" />
            <h2 className="font-bold text-stone-800 text-sm">Add Research Paper</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-stone-700 mb-1">Paper Title *</label>
            <input
              type="text"
              required
              placeholder="e.g., Attention Is All You Need"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Authors</label>
            <input
              type="text"
              placeholder="e.g., Ashish Vaswani, Noam Shazeer..."
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Publication Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 mb-1">Total Pages</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 15"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g., Transformer, NLP, Deep Learning"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-all"
            />
          </div>

          {/* Local PDF attachment */}
          <div>
            <label className="block font-medium text-stone-700 mb-1">Attach Local PDF (Optional)</label>
            <div className="relative border-2 border-dashed border-stone-200 rounded-xl p-4 hover:border-stone-400 transition-colors text-center cursor-pointer bg-stone-50/50">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-stone-400 mx-auto mb-1" />
              <p className="text-stone-500 text-xs font-mono">
                {fileName ? `Attached: ${fileName}` : 'Click to select local PDF'}
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors shadow-sm"
            >
              Save Paper
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}