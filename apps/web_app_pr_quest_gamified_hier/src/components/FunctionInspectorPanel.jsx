import React from 'react';
import { 
  FileCode, 
  CheckCircle, 
  HelpCircle,
  GitBranch
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

  const currentSymKey = activeSymbolKey || activeSymbol.name || 'rotateSessionToken';
  const isCurrentAudited = auditedSymbols.includes(currentSymKey);

  const rawCode = activeSymbol.modifiedCode || activeSymbol.code;
  const displayCode = typeof rawCode === 'string'
    ? rawCode
    : rawCode
      ? JSON.stringify(rawCode, null, 2)
      : '// No implementation code available for this symbol';

  const displaySignature = typeof activeSymbol.signature === 'string'
    ? activeSymbol.signature
    : `${currentSymKey}()`;

  const displayFile = typeof activeSymbol.file === 'string'
    ? activeSymbol.file
    : '';

  return (
    <div className="sticky top-4 bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* Top Banner: Symbol Selector */}
      <div className="border-b border-[#F1ECE4] pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2.5 py-1 rounded-lg border border-[#C35832]/20 flex items-center gap-1.5 font-mono">
            <GitBranch className="w-3.5 h-3.5" /> Functions ({symbols.length})
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
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
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
      <div className="flex items-start justify-between gap-3 border-b border-[#F1ECE4] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 font-mono flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5" />
              {activeSymbol.type || 'function'}
            </span>
            <span className="text-xs font-mono text-[#6B635A] truncate">
              {displayFile}
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#242220] font-mono mt-1.5 truncate">
            {displaySignature}
          </h3>
        </div>

        {/* Audit Toggle Button */}
        {onToggleSymbolAudit && (
          <button
            onClick={() => onToggleSymbolAudit(currentSymKey)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border flex-shrink-0 ${
              isCurrentAudited
                ? 'bg-[#4F6D56] text-white border-[#4F6D56]'
                : 'bg-white text-[#4F6D56] border-[#4F6D56]/40 hover:bg-[#F4F8F5]'
            }`}
            title="Mark this function as audited"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isCurrentAudited ? 'Audited' : 'Mark Audited'}</span>
          </button>
        )}
      </div>

      {/* Function Code */}
      <div className="border border-[#E6E0D5] rounded-xl overflow-hidden bg-white shadow-2xs">
        <pre className="p-4 bg-white font-mono text-xs leading-relaxed text-[#242220] overflow-x-auto">
          {displayCode}
        </pre>
      </div>
    </div>
  );
}
