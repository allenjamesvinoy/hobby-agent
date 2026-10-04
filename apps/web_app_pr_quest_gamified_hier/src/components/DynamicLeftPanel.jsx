import React from 'react';
import SpecNav from './SpecNav';
import MermaidViewer from './MermaidViewer';
import { 
  ShieldCheck, 
  GitBranch, 
  CheckSquare, 
  Square, 
  FileCode, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award
} from 'lucide-react';

export default function DynamicLeftPanel({
  level,
  jiraTicket,
  setJiraTicket,
  selectedSpec,
  setSelectedSpec,
  architectureStandards,
  onToggleStandard,
  mermaidCode,
  symbolCatalog,
  activeSymbol,
  onSelectSymbol,
  onSelectFileByPath,
  onOpenArchModal,
  isLevelComplete,
  auditedSymbols = [],
  onToggleSymbolAudit,
  onProceedNextLevel
}) {
  // Level 1: Spec & Intent Check
  if (level === 1) {
    return (
      <SpecNav 
        jiraTicket={jiraTicket} 
        setJiraTicket={setJiraTicket} 
        selectedSpec={selectedSpec} 
        setSelectedSpec={setSelectedSpec} 
        onAddXp={onAddXp}
        isLevelComplete={isLevelComplete}
        onProceedNextLevel={onProceedNextLevel}
      />
    );
  }

  // Level 2: Core Architecture & Standards Audit
  if (level === 2) {
    const verifiedCount = architectureStandards.filter(s => s.completed).length;

    return (
      <div className="space-y-4">
        {/* Excalidraw Architecture Diagram Launcher Card */}
        <div className="bg-[#FFFDF9] border-2 border-[#C35832]/30 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#C35832] flex items-center gap-1.5">
              <span>📐</span> Excalidraw Architecture
            </span>
            <span className="text-[10px] font-bold bg-[#EBF7EE] text-[#2D6A4F] px-2 py-0.5 rounded border border-[#2D6A4F]/20">
              Visual Net Diff
            </span>
          </div>

          <p className="text-xs text-[#6B635A] mt-1.5 leading-snug">
            Whiteboard sketch showing added, modified, and removed component flows.
          </p>

          <button
            onClick={onOpenArchModal}
            className="w-full mt-3 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Excalidraw Diagram</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Architecture Standards Checklist (Now Spacious & Uncramped) */}
        <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col">
          <div className="border-b border-[#F1ECE4] pb-3 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#242220] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#C35832]" />
                <span>Standard Practice Checklist</span>
              </span>
              <span className="text-xs text-[#4F6D56] font-bold bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20">
                {verifiedCount}/{architectureStandards.length} Audited
              </span>
            </div>
            <p className="text-[11px] text-[#6B635A] mt-1.5 leading-relaxed">
              Verify Tier 1 modules against production security and resilience standards from <code className="bg-[#F1ECE4] px-1 rounded text-[10px]">docs/standards/</code>:
            </p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {architectureStandards.map((std) => (
              <div 
                key={std.id}
                className={`p-3 rounded-lg border transition-all ${
                  std.completed 
                    ? 'bg-[#F4F8F5] border-[#4F6D56]/30 text-[#4F6D56]' 
                    : 'bg-[#FFFDF9] border-[#E6E0D5] text-[#242220] hover:border-[#C35832]/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button 
                    onClick={() => onToggleStandard(std.id)}
                    className="mt-0.5 text-[#C35832] hover:scale-110 transition-transform flex-shrink-0 cursor-pointer"
                    title={std.completed ? "Mark incomplete" : "Mark standard audited (+25 XP)"}
                  >
                    {std.completed ? (
                      <CheckSquare className="w-4 h-4 text-[#4F6D56]" />
                    ) : ( 
                      <Square className="w-4 h-4 text-[#6B635A]" />
                    )}
                  </button>
                  <div className="text-xs flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-bold text-[#242220]">{std.title}</span>
                      <span className="text-[9px] font-mono bg-[#F1ECE4] text-[#6B635A] px-1.5 py-0.2 rounded font-semibold">
                        {std.id}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#C35832] font-semibold mt-0.5">
                      {std.category}
                    </div>
                    <p className="text-[11px] text-[#6B635A] leading-relaxed mt-1">
                      {std.description}
                    </p>
                    <div className="text-[9px] text-[#6B635A]/70 font-mono mt-1.5 flex items-center justify-between pt-1 border-t border-current/10">
                      <span>Ref: {std.standardFile}</span>
                      <span className="font-semibold text-[#4F6D56]">{std.completed ? "✓ Audited" : "+25 XP"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#F1ECE4] flex items-center justify-between text-[11px] text-[#6B635A]">
            <span>+25 XP per audited item</span>
            <button
              onClick={onOpenArchModal}
              className="text-[#C35832] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect Architecture</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Level 2 Next Progression Action with Hover Guide Popover */}
          <div className="mt-3 pt-3 border-t border-[#E6E0D5]">
            {isLevelComplete ? (
              <button
                onClick={onProceedNextLevel}
                className="w-full py-2.5 px-3 bg-[#4F6D56] hover:bg-[#3D5442] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 animate-pulse cursor-pointer"
              >
                <span>Proceed to Level 3: Blast Radius</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="relative group">
                <button
                  type="button"
                  className="w-full py-2.5 px-3 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] text-[#8C827A] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                >
                  <span>Next: Level 3 (Locked)</span>
                  <span className="text-xs">🔒</span>
                </button>

                {/* Level 2 Checklist Guide Popover */}
                <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-[#E6E0D5] rounded-xl p-3.5 shadow-xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#242220] pb-2 border-b border-[#F1ECE4]">
                    <Award className="w-3.5 h-3.5 text-[#D08A29]" />
                    <span>Level 2 Checklist Guide</span>
                  </div>
                  <ul className="text-[11px] text-[#6B635A] mt-2 space-y-1.5 list-disc list-inside leading-snug">
                    <li>Audit each Tier 1 architecture standard from docs/standards.</li>
                    <li>Inspect the net architectural diagram and verify state flows.</li>
                  </ul>
                  <div className="mt-2.5 pt-2 border-t border-[#F1ECE4] flex items-center justify-between text-[10px]">
                    <span className="text-[#C35832] font-bold">
                      {verifiedCount}/{architectureStandards.length} Standards audited
                    </span>
                    <span className="text-[#6B635A]">
                      Audit all to unlock Level 3
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Level 3: Blast Radius Impact Matrix & Dependency Tree
  if (level === 3) {
    const symbols = Object.keys(symbolCatalog);
    const auditedCount = auditedSymbols.length;

    return (
      <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col space-y-4">
        {/* Header */}
        <div className="border-b border-[#F1ECE4] pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 flex items-center gap-1 font-mono">
              <GitBranch className="w-3.5 h-3.5" /> Blast Radius Matrix
            </span>
            <span className="text-xs text-[#4F6D56] font-bold bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20">
              {auditedCount}/{symbols.length} Audited (+25 XP)
            </span>
          </div>
          <h2 className="text-sm font-bold text-[#242220] mt-2 leading-snug">
            Exported Symbol Dependency Tree
          </h2>
          <p className="text-[11px] text-[#6B635A] mt-1">
            Audit all symbols below to verify blast radius and unlock Level 4:
          </p>
        </div>

        {/* Symbol Tree */}
        <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px] pr-1">
          {symbols.map((symKey) => {
            const sym = symbolCatalog[symKey];
            const isSelected = activeSymbol === symKey;
            const isAudited = auditedSymbols.includes(symKey);

            return (
              <div 
                key={symKey}
                onClick={() => onSelectSymbol(symKey)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[#FFFDF9] border-[#C35832] ring-2 ring-[#C35832]/20 shadow-xs' 
                    : isAudited
                      ? 'bg-[#F4F8F5] border-[#4F6D56]/30'
                      : 'bg-[#F9F6F0]/60 border-[#E6E0D5] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSymbolAudit && onToggleSymbolAudit(symKey);
                      }}
                      className="text-[#C35832] hover:scale-110 transition-transform cursor-pointer"
                      title={isAudited ? "Mark symbol unverified" : "Audit symbol blast radius (+25 XP)"}
                    >
                      {isAudited ? (
                        <CheckSquare className="w-4 h-4 text-[#4F6D56]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#6B635A]" />
                      )}
                    </button>
                    <span className="font-mono text-xs font-bold text-[#242220] flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5 text-[#C35832]" />
                      {sym.name}()
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                    isAudited 
                      ? 'bg-white text-[#4F6D56] border-[#4F6D56]/30 font-semibold' 
                      : 'bg-white border-[#E6E0D5] text-[#6B635A]'
                  }`}>
                    {sym.callers.length} consumers
                  </span>
                </div>
                <div className="text-[10px] text-[#6B635A] font-mono mt-1 truncate pl-6">
                  {sym.file}
                </div>

                {/* Consumer list preview */}
                <div className="mt-2 pt-1.5 border-t border-[#E6E0D5]/40 space-y-1 pl-6">
                  {sym.callers.map((caller, cIdx) => (
                    <div key={cIdx} className="text-[10px] text-[#242220]/80 flex items-center justify-between">
                      <span className="font-mono truncate max-w-[170px]">{caller.file.split('/').pop()}</span>
                      <span className="text-[9px] text-[#C35832] font-semibold">Line {caller.line}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Consumer Isolation Shortcuts */}
        <div className="pt-3 border-t border-[#F1ECE4] space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6B635A]">
            🎯 Quick Consumer Isolation
          </label>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => onSelectFileByPath("src/context/SessionContext.jsx")}
              className="text-left px-2.5 py-1.5 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] rounded-md text-[11px] font-medium text-[#242220] flex items-center justify-between"
            >
              <span>SessionContext.jsx</span>
              <span className="text-[10px] text-[#D08A29] font-bold">Tier 2</span>
            </button>
            <button
              onClick={() => onSelectFileByPath("src/components/ProtectedRoute.jsx")}
              className="text-left px-2.5 py-1.5 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] rounded-md text-[11px] font-medium text-[#242220] flex items-center justify-between"
            >
              <span>ProtectedRoute.jsx</span>
              <span className="text-[10px] text-[#D08A29] font-bold">Tier 2</span>
            </button>
          </div>
        </div>

        {/* Level 3 Next Progression Action with Hover Guide Popover */}
        <div className="pt-3 border-t border-[#E6E0D5]">
          {isLevelComplete ? (
            <button
              onClick={onProceedNextLevel}
              className="w-full py-2.5 px-3 bg-[#4F6D56] hover:bg-[#3D5442] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 animate-pulse cursor-pointer"
            >
              <span>Proceed to Level 4: Tests & Verdict</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="relative group">
              <button
                type="button"
                className="w-full py-2.5 px-3 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] text-[#8C827A] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
              >
                <span>Next: Level 4 (Locked)</span>
                <span className="text-xs">🔒</span>
              </button>

              {/* Level 3 Checklist Guide Popover */}
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-[#E6E0D5] rounded-xl p-3.5 shadow-xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#242220] pb-2 border-b border-[#F1ECE4]">
                  <Award className="w-3.5 h-3.5 text-[#D08A29]" />
                  <span>Level 3 Checklist Guide</span>
                </div>
                <ul className="text-[11px] text-[#6B635A] mt-2 space-y-1.5 list-disc list-inside leading-snug">
                  <li>Audit function call blast radii in the right inspector panel.</li>
                  <li>Verify downstream consumer integrations and imports.</li>
                </ul>
                <div className="mt-2.5 pt-2 border-t border-[#F1ECE4] flex items-center justify-between text-[10px]">
                  <span className="text-[#C35832] font-bold">
                    {auditedCount}/{symbols.length} Symbols audited
                  </span>
                  <span className="text-[#6B635A]">
                    Audit all to unlock Level 4
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Level 4: Tests & Final Verdict Summary
  return (
    <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col space-y-4">
      <div className="border-b border-[#F1ECE4] pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#4F6D56] bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Stage 4 Final Audit
          </span>
          <span className="text-[10px] bg-[#F1ECE4] text-[#6B635A] px-1.5 py-0.5 rounded font-bold">
            All Diffs
          </span>
        </div>
        <h2 className="text-sm font-bold text-[#242220] mt-2 leading-snug">
          Verification Scorecard
        </h2>
        <p className="text-[11px] text-[#6B635A] mt-1">
          Review unit test coverage at the top and cross-check tested functions on the right before giving your final sign-off.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div className="bg-[#F4F8F5] border border-[#4F6D56]/30 p-2.5 rounded-lg flex items-center justify-between">
          <span className="font-semibold text-[#4F6D56]">Acceptance Criteria</span>
          <span className="font-bold text-[#4F6D56]">
            {jiraTicket.criteria.filter(c => c.completed).length}/{jiraTicket.criteria.length} Verified
          </span>
        </div>
        <div className="bg-[#FFFDF9] border border-[#D08A29]/30 p-2.5 rounded-lg flex items-center justify-between">
          <span className="font-semibold text-[#D08A29]">Architecture Standards</span>
          <span className="font-bold text-[#D08A29]">
            {architectureStandards.filter(s => s.completed).length}/{architectureStandards.length} Audited
          </span>
        </div>
      </div>

      <div className="pt-2 text-[11px] text-[#6B635A] leading-relaxed">
        💡 <span className="font-semibold">Reviewer Checklist:</span> Ensure negative paths (e.g. missing refresh token) are properly tested before approving.
      </div>
    </div>
  );
}
