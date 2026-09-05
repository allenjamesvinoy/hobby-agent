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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-100 text-sm">Add Research Paper</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Paper Title *</label>
            <input
              type="text"
              required
              placeholder="e.g., Attention Is All You Need"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Authors</label>
            <input
              type="text"
              placeholder="e.g., Ashish Vaswani, Noam Shazeer..."
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Publication Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Total Pages</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 15"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g., Transformer, NLP, Deep Learning"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Local PDF attachment */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Attach Local PDF (Optional)</label>
            <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-4 hover:border-indigo-500/50 transition-colors text-center cursor-pointer bg-slate-950/40">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              <p className="text-slate-400 text-xs font-mono">
                {fileName ? `Attached: ${fileName}` : 'Click to select local PDF'}
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-md shadow-indigo-600/20"
            >
              Save Paper
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}