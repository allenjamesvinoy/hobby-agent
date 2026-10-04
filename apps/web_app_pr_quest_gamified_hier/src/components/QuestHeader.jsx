import React from 'react';
import { Shield, RefreshCw, GitPullRequest, Award, CheckCircle, ChevronLeft, ChevronRight, Loader2, Github, Sparkles } from 'lucide-react';

export default function QuestHeader({ 
  level, 
  setLevel, 
  unlockedLevel = 1,
  xp,
  reviewPoints,
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
  isVerdictSubmitted = false,
  githubPullRequests = [],
  githubPrLoading = false,
  onPrevGithubPr,
  onNextGithubPr,
  githubStatus = null,
  hasArchitectureDoc = false
}) {
  const levels = [
    { 
      num: 1, 
      name: "1. Spec & Intent", 
      desc: "Verify JIRA criteria",
      statsText: `${completedAcCount}/${totalAcCount} ACs`,
      isDone: isLevel1Complete
    },
    { 
      num: 2, 
      name: "2. Core Architecture", 
      desc: "Tier 1 logic & standards",
      statsText: hasArchitectureDoc ? `${completedStandardsCount}/${totalStandardsCount} Audited` : 'Locked',
      isDone: isLevel2Complete
    },
    { 
      num: 3, 
      name: "3. Blast Radius", 
      desc: "Downstream call-sites",
      statsText: `${completedSymbolsCount}/${totalSymbolsCount} Audited`,
      isDone: isLevel3Complete
    },
    { 
      num: 4, 
      name: "4. Tests & Verdict", 
      desc: "Unit tests & sign-off",
      statsText: `${reviewedCount}/${totalFiles} Reviewed`,
      isDone: isVerdictSubmitted || isLevel4Complete
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

          {/* Active Query Selector Pill + optional GitHub PR toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {githubPullRequests.length > 1 && (
              <div className="flex items-center gap-0.5 bg-[#F9F6F0] p-0.5 rounded-lg border border-[#E6E0D5]">
                <button
                  type="button"
                  onClick={onPrevGithubPr}
                  disabled={githubPrLoading}
                  className="p-1 text-[#6B635A] hover:text-[#242220] rounded hover:bg-white transition-colors cursor-pointer disabled:opacity-40"
                  title="Previous open PR in repo"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onNextGithubPr}
                  disabled={githubPrLoading}
                  className="p-1 text-[#6B635A] hover:text-[#242220] rounded hover:bg-white transition-colors cursor-pointer disabled:opacity-40"
                  title="Next open PR in repo"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={onOpenQuerySelector}
              className="flex items-center gap-2 bg-[#F9F6F0] hover:bg-[#F1ECE4] border border-[#E6E0D5] hover:border-[#4F6D56]/50 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer group flex-shrink-0"
              title="Switch Review Target / Pull Request Query"
            >
              {githubPrLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-[#C35832] animate-spin" />
              ) : String(currentQueryId).startsWith('GH-') ? (
                <Github className="w-3.5 h-3.5 text-[#242220]" />
              ) : (
                <GitPullRequest className="w-3.5 h-3.5 text-[#4F6D56]" />
              )}
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

            {githubStatus?.linked && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-[#242220] bg-[#F1ECE4] border border-[#E6E0D5] px-2 py-1 rounded-lg">
                <Github className="w-3 h-3 text-[#242220]" />
                <span>@{githubStatus.login}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Architecture Diagram + Subtle Refresh + Circular User on the Right */}
        <div className="flex items-center justify-end gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#E6E0D5] bg-[#FFFDF9] px-3 py-1.5 text-xs" title="Per PR: each first manual approval earns at least 1 point, rising to 10 after 30 seconds of active review. Each reviewer earns their own contribution. Faster approvals earn proportionally less. Full-point reviews on different blocks earn a 10-point team bonus when teammates overlap for 5 seconds and approve within 60 seconds. Repeat and bulk approvals add no extra points.">
            <Award className="h-4 w-4 text-[#C35832]" />
            <span className="font-bold text-[#C35832]" aria-live="polite">{reviewPoints?.teamPoints ?? '—'} team pts</span>
            {reviewPoints && <span className="text-[#8C827A]">You {reviewPoints.myPoints}{reviewPoints.bonusPoints > 0 ? ` · +${reviewPoints.bonusPoints} team bonus` : ''}</span>}
          </div>
          {onOpenArch && (
            <button
              onClick={onOpenArch}
              className="px-3 py-1.5 bg-white border border-[#E6E0D5] hover:border-[#C35832]/40 text-[#242220] hover:bg-[#F9F6F0] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open interactive architecture diagram"
            >
              <span>📐 Architecture Diagram</span>
            </button>
          )}

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

      {/* Smart Slim Level Selector Tabs - Freely accessible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#F1ECE4]">
        {levels.map((lvl) => {
          const isActive = level === lvl.num;
          const isCompleted = lvl.isDone;

          return (
            <div key={lvl.num} className="relative">
              <button
                onClick={() => setLevel(lvl.num)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#FFFDF9] border-[#C35832] ring-2 ring-[#C35832]/25 shadow-xs' 
                    : isCompleted
                      ? 'bg-[#F4F8F5] border-[#4F6D56]/30 text-[#4F6D56] hover:bg-white'
                      : 'bg-[#F9F6F0] border-[#E6E0D5] hover:bg-white hover:border-[#C35832]/30'
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
            </div>
          );
        })}
      </div>
    </header>
  );
}