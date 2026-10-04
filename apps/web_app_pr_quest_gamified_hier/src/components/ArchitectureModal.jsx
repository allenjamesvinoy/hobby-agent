import React, { useState } from 'react';
import { BookOpen, X, Save, FileText } from 'lucide-react';

export default function ArchitectureModal({ 
  isOpen, 
  onClose, 
  architectureText, 
  onSave,
  onAddXp 
}) {
  const [text, setText] = useState(architectureText);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(text);
    onAddXp(30, "Updated System Architecture Map", "architecture-map-saved");
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#E6E0D5] rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1ECE4]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#C35832]" />
            <h2 className="text-base font-bold text-[#242220]">System Architecture & Repository Map</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#6B635A] hover:text-[#242220] p-1 rounded-lg hover:bg-[#F9F6F0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <p className="text-xs text-[#6B635A] leading-relaxed">
            Upload or paste your project's <code className="bg-[#F1ECE4] px-1 py-0.5 rounded">ARCHITECTURE.md</code>. This context helps correlate file diffs with architectural layers and calculates the importance score of each file.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#6B635A] mb-1.5">
              Markdown Content
            </label>
            <textarea
              rows="12"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg p-3 font-mono text-xs focus:outline-none focus:border-[#C35832] leading-relaxed"
              placeholder="# System Architecture..."
            />
          </div>

          <div className="bg-[#FFFDF9] border border-[#D08A29]/20 rounded-lg p-3 flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-[#D08A29] mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-[#6B635A] leading-relaxed">
              <span className="font-bold text-[#242220]">Pro Tip:</span> Keeping this map updated allows the agentic reviewer to automatically flag violations of architectural boundaries (e.g., UI components importing core services directly).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#F1ECE4] flex justify-end gap-2 bg-[#F9F6F0]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E6E0D5] text-xs font-medium rounded-lg hover:bg-[#F9F6F0]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save & Parse
          </button>
        </div>
      </div>
    </div>
  );
}