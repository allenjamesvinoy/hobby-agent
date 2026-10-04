import React, { useEffect } from 'react';
import { 
  X, 
  Info, 
  Shield, 
  Layers, 
  GitBranch, 
  CheckCircle, 
  Award, 
  ArrowLeft,
  Sparkles,
  HelpCircle,
  FileCode,
  BookOpen
} from 'lucide-react';

export default function InfoSidePanel({ isOpen, onClose }) {
  // Listen for Escape key to close automatically
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-start transition-opacity animate-in fade-in duration-200"
    >
      {/* Sliding Left Side Panel Drawer */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md sm:max-w-lg h-full shadow-2xl border-r border-[#E6E0D5] flex flex-col z-10 animate-in slide-in-from-left duration-200"
      >
        {/* Drawer Header */}
        <div className="bg-[#FFFDF9] border-b border-[#E6E0D5] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FBEFEF] text-[#C35832] rounded-lg border border-[#C35832]/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#242220] leading-snug">
                Review Methodology & Tiers
              </h2>
              <p className="text-xs text-[#6B635A]">
                Understanding Hierarchical Code Review in PR Quest
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-[#6B635A] hover:text-[#242220] hover:bg-[#F1ECE4] rounded-lg transition-colors cursor-pointer"
            title="Close Guide (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Dismissal tip */}
          <div className="bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg p-2.5 flex items-center gap-2 text-[11px] text-[#6B635A]">
            <Info className="w-4 h-4 text-[#C35832] flex-shrink-0" />
            <span>Click anywhere outside this panel or press <kbd className="bg-white px-1.5 py-0.5 rounded border border-[#E6E0D5] font-mono text-[10px] text-[#242220]">Esc</kbd> to return to your review screen.</span>
          </div>

          {/* Section 1: What do Tiers Mean? */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🏗️</span>
              <h3 className="text-sm font-bold text-[#242220] uppercase tracking-wider">
                What Do Tiers Mean?
              </h3>
            </div>

            <p className="text-xs text-[#6B635A] leading-relaxed">
              Standard PR tools display files in alphabetical order (<code className="bg-[#F1ECE4] px-1 rounded text-[11px]">a_file.js</code> before <code className="bg-[#F1ECE4] px-1 rounded text-[11px]">z_file.js</code>). This causes severe reviewer fatigue because you are forced to review consumer components before understanding the foundational state, security, or schema changes.
            </p>
            <p className="text-xs text-[#6B635A] leading-relaxed">
              PR Quest categorizes and orders every file by its <strong>architectural blast radius into 3 Tiers</strong>:
            </p>

            <div className="space-y-3 pt-1">
              {/* Tier 1 Card */}
              <div className="bg-[#FFFDF9] border border-[#C35832]/30 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C35832]"></span>
                    Tier 1: Core Logic (Foundation)
                  </span>
                  <span className="text-[10px] font-bold text-[#C35832] uppercase tracking-wider">
                    Highest Risk
                  </span>
                </div>
                <p className="text-xs text-[#242220] font-semibold mt-1">
                  Foundational state engines, authentication, session tokens, schemas, and network interceptors.
                </p>
                <div className="text-[11px] text-[#6B635A] mt-1.5 space-y-1">
                  <div><strong>Examples:</strong> <code className="bg-[#F1ECE4] px-1 rounded font-mono text-[10px]">SessionManager.js</code>, <code className="bg-[#F1ECE4] px-1 rounded font-mono text-[10px]">ApiClient.js</code></div>
                  <div><strong>Why Review First:</strong> Any regression here breaks all downstream services. Reviewing Tier 1 first guarantees core design and security sanity before inspecting UI syntax.</div>
                </div>
              </div>

              {/* Tier 2 Card */}
              <div className="bg-[#FFFDF9] border border-[#D08A29]/30 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#D08A29] bg-[#FFF8EE] px-2 py-0.5 rounded border border-[#D08A29]/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D08A29]"></span>
                    Tier 2: Consumer (Integration)
                  </span>
                  <span className="text-[10px] font-bold text-[#D08A29] uppercase tracking-wider">
                    Medium Risk
                  </span>
                </div>
                <p className="text-xs text-[#242220] font-semibold mt-1">
                  Direct consumers, React context providers, hooks, navigation guards, and UI views.
                </p>
                <div className="text-[11px] text-[#6B635A] mt-1.5 space-y-1">
                  <div><strong>Examples:</strong> <code className="bg-[#F1ECE4] px-1 rounded font-mono text-[10px]">SessionContext.jsx</code>, <code className="bg-[#F1ECE4] px-1 rounded font-mono text-[10px]">ProtectedRoute.jsx</code></div>
                  <div><strong>Why Review Second:</strong> Once Tier 1 is verified solid, you inspect consumers to verify that API contracts, state subscriptions, and props remain unbroken.</div>
                </div>
              </div>

              {/* Tier 3 Card */}
              <div className="bg-[#FFFDF9] border border-[#4F6D56]/30 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#4F6D56] bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4F6D56]"></span>
                    Tier 3: Support (Peripheral)
                  </span>
                  <span className="text-[10px] font-bold text-[#4F6D56] uppercase tracking-wider">
                    Lower Risk
                  </span>
                </div>
                <p className="text-xs text-[#242220] font-semibold mt-1">
                  Unit tests, mock configurations, peripheral utilities, fixtures, and documentation.
                </p>
                <div className="text-[11px] text-[#6B635A] mt-1.5 space-y-1">
                  <div><strong>Examples:</strong> <code className="bg-[#F1ECE4] px-1 rounded font-mono text-[10px]">SessionManager.test.js</code>, mock fixtures</div>
                  <div><strong>Why Review Third:</strong> Confirms edge-case coverage and assertions without cluttering the primary architecture review.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: The 4 Review Levels */}
          <section className="space-y-3 pt-3 border-t border-[#F1ECE4]">
            <div className="flex items-center gap-2">
              <span className="text-base">🗺️</span>
              <h3 className="text-sm font-bold text-[#242220] uppercase tracking-wider">
                The 4 Progressive Review Levels
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-[#E6E0D5] bg-[#FFFDF9]">
                <div className="font-bold text-[#242220] flex items-center justify-between">
                  <span>Level 1: Spec & Intent Check</span>
                  <span className="text-[10px] text-[#C35832] font-semibold">Stage 1/4</span>
                </div>
                <p className="text-[11px] text-[#6B635A] mt-1 leading-relaxed">
                  Verify PR changes against JIRA Acceptance Criteria. <strong>Check off all left-panel criteria to unlock Level 2.</strong> Code file approvals are optional and persist across levels.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-[#E6E0D5] bg-[#FFFDF9]">
                <div className="font-bold text-[#242220] flex items-center justify-between">
                  <span>Level 2: Architectural & Standards Audit</span>
                  <span className="text-[10px] text-[#C35832] font-semibold">Stage 2/4</span>
                </div>
                <p className="text-[11px] text-[#6B635A] mt-1 leading-relaxed">
                  Inspect the architecture diff modal (+ NEW, ~ MOD, - DEL). <strong>Audit all left-panel standard practices to unlock Level 3.</strong>
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-[#E6E0D5] bg-[#FFFDF9]">
                <div className="font-bold text-[#242220] flex items-center justify-between">
                  <span>Level 3: Blast Radius & Symbol Tree</span>
                  <span className="text-[10px] text-[#C35832] font-semibold">Stage 3/4</span>
                </div>
                <p className="text-[11px] text-[#6B635A] mt-1 leading-relaxed">
                  Click function signatures in the diff to inspect side-by-side original vs. modified code. <strong>Audit all left-panel symbols to unlock Level 4.</strong>
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-[#E6E0D5] bg-[#FFFDF9]">
                <div className="font-bold text-[#242220] flex items-center justify-between">
                  <span>Level 4: Tests & Final Verdict</span>
                  <span className="text-[10px] text-[#4F6D56] font-semibold">Stage 4/4</span>
                </div>
                <p className="text-[11px] text-[#6B635A] mt-1 leading-relaxed">
                  <strong>The Final Stage:</strong> Review unit test assertions and ensure all code files have been approved or flagged before casting your final review verdict.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Review Milestones */}
          <section className="space-y-2 pt-3 border-t border-[#F1ECE4]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D08A29]" />
              <h3 className="text-sm font-bold text-[#242220] uppercase tracking-wider">
                Review Milestones
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#F9F6F0] p-2 rounded border border-[#E6E0D5]">
                <div className="font-bold text-[#4F6D56]">Step 1</div>
                <div className="text-[#6B635A]">Verify Acceptance Criteria</div>
              </div>
              <div className="bg-[#F9F6F0] p-2 rounded border border-[#E6E0D5]">
                <div className="font-bold text-[#4F6D56]">Step 2</div>
                <div className="text-[#6B635A]">Audit Architectural Standards</div>
              </div>
              <div className="bg-[#F9F6F0] p-2 rounded border border-[#E6E0D5]">
                <div className="font-bold text-[#4F6D56]">Step 3</div>
                <div className="text-[#6B635A]">Inspect Blast Radius & Symbols</div>
              </div>
              <div className="bg-[#F9F6F0] p-2 rounded border border-[#E6E0D5]">
                <div className="font-bold text-[#4F6D56]">Step 4</div>
                <div className="text-[#6B635A]">Verify Tests & Final Verdict</div>
              </div>
            </div>
          </section>
        </div>

        {/* Drawer Footer */}
        <div className="bg-[#FFFDF9] border-t border-[#E6E0D5] p-4 flex items-center justify-between">
          <span className="text-[11px] text-[#6B635A]">
            Auto-closes when returning to screen
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Review</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
