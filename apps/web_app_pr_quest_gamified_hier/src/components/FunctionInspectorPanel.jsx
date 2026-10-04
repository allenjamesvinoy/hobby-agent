import React, { useState } from 'react';
import { 
  FileCode, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  Code2, 
  Columns, 
  HelpCircle,
  GitBranch,
  CheckSquare,
  Square
} from 'lucide-react';
import { symbolCatalog as defaultSymbolCatalog } from '../mockData.js';

export default function FunctionInspectorPanel({
  activeSymbolKey,
  symbolCatalog,
  onSelectSymbol,
  onSelectFileByPath,
  auditedSymbols = [],
  onToggleSymbolAudit,
  isLevelComplete = false,
  onProceedNextLevel
}) {
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [viewFormat, setViewFormat] = useState('split'); // 'split' | 'modified' | 'original'

  const catalog = symbolCatalog || defaultSymbolCatalog || {};
  const symbols = Object.keys(catalog);
  const activeSymbol = catalog[activeSymbolKey] || catalog['rotateSessionToken'] || Object.values(catalog)[0];
  const auditedCount = auditedSymbols.length;

  if (!activeSymbol) {
    return (
      <div className="sticky top-4 bg-white border border-[#E6E0D5] rounded-xl p-6 shadow-sm text-center">
        <HelpCircle className="w-8 h-8 text-[#6B635A]/50 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-[#242220]">Function Inspector Idle</h3>
        <p className="text-xs text-[#6B635A] mt-1">
          Click on any function signature or call in the middle diff panel to inspect its implementation.
        </p>
      </div>
    );
  }

  const matches = activeSymbol.matches || [];
  const currentMatch = matches.find(m => m.id === selectedMatchId) || matches[0];
  const currentSymKey = activeSymbolKey || activeSymbol.name || 'rotateSessionToken';
  const isCurrentAudited = auditedSymbols.includes(currentSymKey);

  return (
    <div className="sticky top-4 bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* Top Banner: Blast Radius Matrix & Symbol Selector */}
      <div className="border-b border-[#F1ECE4] pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2.5 py-1 rounded-lg border border-[#C35832]/20 flex items-center gap-1.5 font-mono">
            <GitBranch className="w-3.5 h-3.5" /> Blast Radius Matrix
          </span>
          <span className="text-xs text-[#4F6D56] font-bold bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20">
            {auditedCount}/{symbols.length} Audited
          </span>
        </div>

        {/* Symbol Selector Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {symbols.map((symKey) => {
            const isSelected = (currentSymKey === symKey);
            const isAudited = auditedSymbols.includes(symKey);

            return (
              <button
                key={symKey}
                onClick={() => onSelectSymbol && onSelectSymbol(symKey)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 cursor-pointer border ${
                  isSelected 
                    ? 'bg-[#C35832] text-white border-[#C35832] shadow-2xs font-bold' 
                    : isAudited
                      ? 'bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/30 hover:bg-white'
                      : 'bg-[#F9F6F0] text-[#6B635A] border-[#E6E0D5] hover:bg-white'
                }`}
                title={`Click to inspect ${symKey}()`}
              >
                <span>{isAudited ? '✓' : '○'}</span>
                <span>{symKey}()</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Symbol Details Header */}
      <div className="border-b border-[#F1ECE4] pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 flex items-center gap-1 font-mono">
            <FileCode className="w-3.5 h-3.5" /> {activeSymbol.type}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              activeSymbol.isModified
                ? 'bg-[#FBEFEF] text-[#C35832] border-[#C35832]/20'
                : 'bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/20'
            }`}>
              {activeSymbol.isModified ? 'Modified in PR' : 'Original from Codebase'}
            </span>

            {/* Audit Toggle Button */}
            {onToggleSymbolAudit && (
              <button
                onClick={() => onToggleSymbolAudit(currentSymKey)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer border ${
                  isCurrentAudited
                    ? 'bg-[#4F6D56] text-white border-[#4F6D56]'
                    : 'bg-white text-[#4F6D56] border-[#4F6D56]/40 hover:bg-[#F4F8F5]'
                }`}
                title="Mark this function call blast radius as audited"
              >
                <CheckCircle className="w-3 h-3" />
                <span>{isCurrentAudited ? 'Audited' : 'Mark Audited'}</span>
              </button>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold text-[#242220] font-mono mt-2 truncate">
          {activeSymbol.signature}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6B635A]">
          <span className="font-mono">{activeSymbol.file}</span>
          <span>•</span>
          <span className="font-bold text-[#C35832]">{activeSymbol.tier}</span>
        </div>
      </div>

      {/* Disambiguation / Matches Selector */}
      {matches.length > 1 && (
        <div className="bg-[#FFFDF9] border border-[#E6E0D5] rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#6B635A] tracking-wider">
            <span>Disambiguation: {matches.length} Matches Found</span>
            <span className="text-[#C35832]">Select target</span>
          </div>
          <div className="space-y-1.5">
            {matches.map((m) => {
              const isSelected = (currentMatch && currentMatch.id === m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMatchId(m.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-all flex items-center justify-between border ${
                    isSelected 
                      ? 'bg-white border-[#C35832] text-[#242220] shadow-2xs font-bold ring-1 ring-[#C35832]'
                      : 'bg-[#F9F6F0]/70 border-[#E6E0D5] text-[#6B635A] hover:bg-white'
                  }`}
                >
                  <div className="truncate mr-2">
                    <div className="font-mono text-[11px] truncate">{m.label}</div>
                    <div className="text-[10px] font-normal text-[#6B635A]">{m.role}</div>
                  </div>
                  {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#C35832] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-Side / Diff View Controls */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#242220]">
          Function Implementation
        </span>
        <div className="flex items-center gap-1 bg-[#F9F6F0] p-0.5 rounded-lg border border-[#E6E0D5]">
          <button
            onClick={() => setViewFormat('split')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
              viewFormat === 'split' ? 'bg-white text-[#C35832] shadow-2xs font-bold' : 'text-[#6B635A]'
            }`}
          >
            <Columns className="w-3 h-3" /> Split
          </button>
          <button
            onClick={() => setViewFormat('modified')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              viewFormat === 'modified' ? 'bg-white text-[#C35832] shadow-2xs font-bold' : 'text-[#6B635A]'
            }`}
          >
            PR Modified
          </button>
          <button
            onClick={() => setViewFormat('original')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              viewFormat === 'original' ? 'bg-white text-[#C35832] shadow-2xs font-bold' : 'text-[#6B635A]'
            }`}
          >
            Original
          </button>
        </div>
      </div>

      {/* Code Display */}
      {viewFormat === 'split' ? (
        <div className="space-y-3">
          {/* Modified Code */}
          <div className="border border-[#4F6D56]/30 rounded-lg overflow-hidden">
            <div className="bg-[#F4F8F5] px-3 py-1.5 border-b border-[#4F6D56]/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#4F6D56] uppercase">
                ✦ PR Version (Modified)
              </span>
              <span className="text-[9px] font-mono text-[#6B635A]">{activeSymbol.file}</span>
            </div>
            <pre className="p-3 bg-white font-mono text-[11px] leading-relaxed text-[#242220] overflow-x-auto max-h-[220px]">
              {activeSymbol.modifiedCode}
            </pre>
          </div>

          {/* Original Code */}
          <div className="border border-[#E6E0D5] rounded-lg overflow-hidden">
            <div className="bg-[#F9F6F0] px-3 py-1.5 border-b border-[#E6E0D5] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#6B635A] uppercase">
                Original Codebase (Previous)
              </span>
              <span className="text-[9px] font-mono text-[#6B635A]">{activeSymbol.file}</span>
            </div>
            <pre className="p-3 bg-[#F9F6F0]/40 font-mono text-[11px] leading-relaxed text-[#6B635A] overflow-x-auto max-h-[160px]">
              {activeSymbol.originalCode}
            </pre>
          </div>
        </div>
      ) : viewFormat === 'modified' ? (
        <div className="border border-[#4F6D56]/30 rounded-lg overflow-hidden">
          <div className="bg-[#F4F8F5] px-3 py-1.5 border-b border-[#4F6D56]/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#4F6D56] uppercase">
              ✦ PR Version (Modified)
            </span>
            <span className="text-[9px] font-mono text-[#6B635A]">{activeSymbol.file}</span>
          </div>
          <pre className="p-3 bg-white font-mono text-[11px] leading-relaxed text-[#242220] overflow-x-auto max-h-[350px]">
            {activeSymbol.modifiedCode}
          </pre>
        </div>
      ) : (
        <div className="border border-[#E6E0D5] rounded-lg overflow-hidden">
          <div className="bg-[#F9F6F0] px-3 py-1.5 border-b border-[#E6E0D5] flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B635A] uppercase">
              Original Codebase (Previous)
            </span>
            <span className="text-[9px] font-mono text-[#6B635A]">{activeSymbol.file}</span>
          </div>
          <pre className="p-3 bg-[#F9F6F0]/40 font-mono text-[11px] leading-relaxed text-[#6B635A] overflow-x-auto max-h-[350px]">
            {activeSymbol.originalCode}
          </pre>
        </div>
      )}

      {/* Downstream Callers List */}
      <div className="border-t border-[#F1ECE4] pt-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#242220] mb-2">
          <span>Downstream Call Sites ({(activeSymbol.callers || []).length})</span>
          <span className="text-[10px] text-[#C35832]">Blast Radius</span>
        </div>
        <div className="space-y-1.5">
          {(activeSymbol.callers || []).map((caller, idx) => (
            <div 
              key={idx}
              className="p-2 border border-[#E6E0D5] rounded-md bg-[#FFFDF9] hover:border-[#C35832] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-[#242220] truncate">
                  {caller.file}
                </span>
                <button
                  onClick={() => onSelectFileByPath(caller.file)}
                  className="text-[10px] text-[#C35832] font-semibold hover:underline flex items-center gap-0.5 ml-2"
                >
                  <span>Line {caller.line}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="mt-1 font-mono text-[10px] text-[#6B635A] truncate bg-white p-1 rounded border border-[#F1ECE4]">
                {caller.context}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
