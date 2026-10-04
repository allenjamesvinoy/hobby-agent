import React from 'react';
import { Shield, RefreshCw, GitPullRequest, Award, CheckCircle } from 'lucide-react';

export default function QuestHeader({ 
  level, 
  setLevel, 
  unlockedLevel = 1,
  xp, 
  totalFiles, 
  reviewedCount, 
  progressPercent = 0,
  onReset, 
  onOpenVerdict,
  onOpenArch,
  onOpenProgress,
  onOpenInfo,
  currentUser,
  onOpenAuth,
  currentQueryId = 'PR-101',
  currentQueryTitle = 'Session Token Rotation',
  onOpenQuerySelector,
  syncStatus = 'saved', // 'saved' | 'syncing' | 'offline'
  completedAcCount = 0,
  totalAcCount = 5,
  completedStandardsCount = 0,
  totalStandardsCount = 4,
  completedSymbolsCount = 0,
  totalSymbolsCount = 3,
  isLevel1Complete = false,
  isLevel2Complete = false,
  isLevel3Complete = false,
  isLevel4Complete = false,
  isVerdictSubmitted = false
}) {
  const levels = [
    { 
      num: 1, 
      name: "1. Spec & Intent", 
      desc: "Verify JIRA criteria",
      statsText: `${completedAcCount}/${totalAcCount} ACs`,
      isDone: unlockedLevel > 1 || isLevel1Complete
    },
    { 
      num: 2, 
      name: "2. Core Architecture", 
      desc: "Tier 1 logic & standards",
      statsText: `${completedStandardsCount}/${totalStandardsCount} Audited`,
      isDone: unlockedLevel > 2 || (unlockedLevel >= 2 && isLevel2Complete)
    },
    { 
      num: 3, 
      name: "3. Blast Radius", 
      desc: "Downstream call-sites",
      statsText: `${completedSymbolsCount}/${totalSymbolsCount} Audited`,
      isDone: unlockedLevel > 3 || (unlockedLevel >= 3 && isLevel3Complete)
    },
    { 
      num: 4, 
      name: "4. Tests & Verdict", 
      desc: "Unit tests & sign-off",
      statsText: `${reviewedCount}/${totalFiles} Reviewed`,
      isDone: unlockedLevel >= 4 && (isVerdictSubmitted || isLevel4Complete)
    }
  ];

  return (
    <header className="bg-white border-b border-[#E6E0D5] px-6 py-3.5 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        {/* Left: Brand + Active Query */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#C35832] text-white p-2 rounded-lg shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-[#242220] tracking-tight">PR Quest</h1>
          </div>

          <div className="h-6 w-px bg-[#E6E0D5] hidden sm:block" />

          {/* Active Query Selector Pill */}
          <button
            onClick={onOpenQuerySelector}
            className="flex items-center gap-2 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] hover:border-[#4F6D56]/50 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer group flex-shrink-0"
            title="Switch Review Target / Pull Request Query"
          >
            <GitPullRequest className="w-3.5 h-3.5 text-[#4F6D56]" />
            <div className="text-left">
              <span className="font-bold text-[#242220] mr-1.5 font-mono">{currentQueryId}:</span>
              <span className="text-[#6B635A] group-hover:text-[#242220] font-medium truncate max-w-[180px] sm:max-w-[260px] inline-block align-bottom">
                {currentQueryTitle}
              </span>
            </div>
            <span className="text-[10px] text-[#6B635A] ml-1 bg-white px-1.5 py-0.2 rounded border border-[#E6E0D5]">
              Switch ▼
            </span>
          </button>
        </div>

        {/* Right: Architecture Diagram + Subtle Refresh + Circular User on the Right */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onOpenArch}
            className="px-3 py-1.5 bg-white border border-[#E6E0D5] hover:border-[#C35832]/40 text-[#242220] hover:bg-[#F9F6F0] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Open interactive architecture diagram"
          >
            <span>📐 Architecture Diagram</span>
          </button>

          <button
            onClick={onReset}
            title="Reset Quest Progress"
            className="p-1.5 text-[#8C827A] hover:text-[#C35832] hover:bg-[#F9F6F0] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Circular User Avatar on the Far Right */}
          <button
            onClick={onOpenAuth}
            className="relative w-9 h-9 rounded-full bg-[#FFFDF9] hover:bg-[#F9F6F0] border-2 border-[#D08A29]/40 hover:border-[#C35832] flex items-center justify-center text-lg shadow-xs hover:shadow-sm transition-all cursor-pointer group flex-shrink-0"
            title={`Reviewer: ${currentUser?.name || 'reviewer_1'} (@${currentUser?.username || 'reviewer_1'}) • Click to switch user`}
          >
            <span>{currentUser?.avatar || '👨‍💻'}</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4F6D56] rounded-full border-2 border-white" />
          </button>
        </div>
      </div>

      {/* Option B: Smart Slim Level Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#F1ECE4]">
        {levels.map((lvl) => {
          const isActive = level === lvl.num;
          const isLocked = lvl.num > unlockedLevel;
          const isCompleted = !isLocked && lvl.isDone;

          return (
            <div key={lvl.num} className="relative group">
              <button
                onClick={() => {
                  if (!isLocked) {
                    setLevel(lvl.num);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                  isActive 
                    ? 'bg-[#FFFDF9] border-[#C35832] ring-2 ring-[#C35832]/25 shadow-xs cursor-default' 
                    : isCompleted
                      ? 'bg-[#F4F8F5] border-[#4F6D56]/30 text-[#4F6D56] hover:bg-white cursor-pointer'
                      : isLocked
                        ? 'bg-[#F9F6F0]/60 border-[#E6E0D5] opacity-65 cursor-not-allowed'
                        : 'bg-[#F9F6F0] border-[#E6E0D5] hover:bg-white cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`text-xs font-bold truncate ${
                    isActive ? 'text-[#C35832]' : isCompleted ? 'text-[#4F6D56]' : 'text-[#242220]'
                  }`}>
                    {lvl.name}
                  </span>
                  {isCompleted ? (
                    <span className="text-[10px] font-bold bg-[#4F6D56] text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs flex-shrink-0">
                      <CheckCircle className="w-3 h-3" /> Done
                    </span>
                  ) : isLocked ? (
                    <span className="text-[9px] text-[#8C827A] bg-[#F1ECE4] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 flex-shrink-0">
                      🔒 Locked
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border flex-shrink-0 ${
                      isActive 
                        ? 'bg-[#FFF8F6] text-[#C35832] border-[#C35832]/30' 
                        : 'bg-white text-[#6B635A] border-[#E6E0D5]'
                    }`}>
                      {lvl.statsText}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#6B635A] truncate mt-0.5">{lvl.desc}</div>
              </button>

              {/* Checklist Guide Hover Popover on Locked Tab */}
              {isLocked && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-[#E6E0D5] rounded-xl p-3.5 shadow-xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#242220] pb-2 border-b border-[#F1ECE4]">
                    <Award className="w-3.5 h-3.5 text-[#D08A29]" />
                    <span>
                      {lvl.num === 2 ? 'Level 1 Checklist Guide' :
                       lvl.num === 3 ? 'Level 2 Checklist Guide' :
                       'Level 3 Checklist Guide'}
                    </span>
                  </div>
                  <ul className="text-[11px] text-[#6B635A] mt-2 space-y-1.5 list-disc list-inside leading-snug">
                    {lvl.num === 2 ? (
                      <>
                        <li>Check off each AC as you verify code in the middle panel.</li>
                        <li>Click sliced AC filter pills above to isolate relevant diff hunks.</li>
                      </>
                    ) : lvl.num === 3 ? (
                      <>
                        <li>Audit each Tier 1 architecture standard from docs/standards.</li>
                        <li>Inspect the net architectural diagram and verify state flows.</li>
                      </>
                    ) : (
                      <>
                        <li>Audit function call blast radii in the right inspector panel.</li>
                        <li>Verify downstream consumer integrations and imports.</li>
                      </>
                    )}
                  </ul>
                  <div className="mt-2.5 pt-2 border-t border-[#F1ECE4] text-[10px] text-[#C35832] font-semibold">
                    Complete Level {lvl.num - 1} milestone to unlock
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}