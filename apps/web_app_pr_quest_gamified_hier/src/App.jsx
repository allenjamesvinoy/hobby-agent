import React, { useState, useEffect, useRef } from 'react';
import {
  initialJiraTicket,
  initialFiles,
  initialReferences,
  defaultArchitecture,
  initialArchitectureMermaid,
  architectureStandards as initialStandards,
  symbolCatalog as initialSymbolCatalog,
  initialTestSuites
} from './mockData';
import { api, PRESET_USERS } from './services/apiClient';
import QuestHeader from './components/QuestHeader';
import DynamicLeftPanel from './components/DynamicLeftPanel';
import HierarchicalDiffViewer from './components/HierarchicalDiffViewer';
import FunctionInspectorPanel from './components/FunctionInspectorPanel';
import TestReviewWorkspace from './components/TestReviewWorkspace';
import ArchitectureModal from './components/ArchitectureModal';
import ArchitectureDiagramModal from './components/ArchitectureDiagramModal';
import InfoSidePanel from './components/InfoSidePanel';
import AuthModal from './components/AuthModal';
import QuerySelectorModal from './components/QuerySelectorModal';
import { Award, CheckCircle, AlertTriangle, Sparkles, ArrowRight, ShieldAlert, MessageSquare, Send, Check } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("PR Quest render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center p-6 text-center">
          <div className="bg-white border border-[#E6E0D5] rounded-2xl p-8 max-w-lg shadow-xl space-y-4">
            <span className="text-4xl">⚔️</span>
            <h2 className="text-lg font-bold text-[#242220]">Review Session Restored</h2>
            <p className="text-xs text-[#6B635A]">
              We encountered an issue reading state:
            </p>
            <p className="text-xs text-[#C35832] font-mono bg-[#FFF8F6] p-3 rounded-lg border border-[#F7D8D0] text-left overflow-x-auto">
              {this.state.error?.message || 'Application render error'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/?query=PR-101';
                }}
                className="px-5 py-2.5 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Reset Storage & Reload PR-101
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // --- Auth & User State ---
  const [currentUser, setCurrentUser] = useState(() => api.currentUser || PRESET_USERS[0]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // --- Query / PR State ---
  const [currentQueryId, setCurrentQueryId] = useState(() => {
    const urlParam = new URLSearchParams(window.location.search).get('query');
    return urlParam || localStorage.getItem('pr_quest_current_query') || 'PR-101';
  });
  const [currentQueryTitle, setCurrentQueryTitle] = useState('PR #101: Session Token Rotation & Salt Validation');
  const [queries, setQueries] = useState([]);
  const [isQuerySelectorOpen, setIsQuerySelectorOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'syncing' | 'offline'

  // --- Review Workspace State ---
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [awardedActions, setAwardedActions] = useState([]);
  const [unlockedLevel, setUnlockedLevel] = useState(1);

  const [jiraTicket, setJiraTicket] = useState(initialJiraTicket);
  const [files, setFiles] = useState(initialFiles);
  const [references, setReferences] = useState(initialReferences);
  const [architectureText, setArchitectureText] = useState(defaultArchitecture);
  const [standards, setStandards] = useState(initialStandards);
  const [activeSymbolKey, setActiveSymbolKey] = useState("rotateSessionToken");
  const [auditedSymbols, setAuditedSymbols] = useState([]);
  const [testSuites, setTestSuites] = useState(initialTestSuites);
  const [verdicts, setVerdicts] = useState([]);

  // Verdict Modal Form State
  const [userVerdictType, setUserVerdictType] = useState('approved');
  const [userVerdictNotes, setUserVerdictNotes] = useState('');

  const [selectedSpec, setSelectedSpec] = useState('ALL');
  const [activeFileId, setActiveFileId] = useState(initialFiles[0]?.id || null);
  const [isArchOpen, setIsArchOpen] = useState(false);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isVerdictOpen, setIsVerdictOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [questLogs, setQuestLogs] = useState([]);

  const isInitialLoad = useRef(true);

  // --- Load Initial Query & Setup ---
  useEffect(() => {
    async function init() {
      await api.checkHealth();
      const queryList = await api.listQueries();
      setQueries(queryList);
      await loadQueryState(currentQueryId, currentUser);
      isInitialLoad.current = false;
    }
    init();
  }, []);

  // Save current query ID to local storage & URL
  useEffect(() => {
    localStorage.setItem('pr_quest_current_query', currentQueryId);
    const url = new URL(window.location);
    url.searchParams.set('query', currentQueryId);
    window.history.replaceState({}, '', url);
  }, [currentQueryId]);

  // --- Query State Loader ---
  const loadQueryState = async (queryId, user = currentUser) => {
    setSyncStatus('syncing');
    const targetUserId = user?.id || 'alex';
    const res = await api.getQueryState(queryId, targetUserId);

    if (res.success && res.data) {
      const { title, files: sharedFiles, verdicts: sharedVerdicts, userProgress } = res.data;
      setCurrentQueryTitle(title || `PR #${queryId}`);

      if (sharedFiles && Array.isArray(sharedFiles)) {
        const safeFiles = sharedFiles.map(f => {
          const canonical = initialFiles.find(cf => cf.id === f.id || cf.path === f.path);
          return {
            ...canonical,
            ...f,
            tier: String(f.tier || canonical?.tier || 'Tier 1: Core Logic'),
            importance: typeof f.importance === 'number' ? f.importance : (canonical?.importance || 80),
            diffChunks: Array.isArray(f.diffChunks) && f.diffChunks.length > 0 
              ? f.diffChunks 
              : (canonical?.diffChunks || []),
            reviewerStatuses: f.reviewerStatuses || {},
            comments: Array.isArray(f.comments) ? f.comments : []
          };
        });
        setFiles(safeFiles);
        setActiveFileId(prev => (prev && safeFiles.some(f => f.id === prev)) ? prev : (safeFiles[0]?.id || null));
      }

      if (sharedVerdicts && Array.isArray(sharedVerdicts)) {
        setVerdicts(sharedVerdicts);
      }

      if (userProgress) {
        setLevel(userProgress.level || 1);
        setUnlockedLevel(userProgress.unlockedLevel || 1);
        setXp(userProgress.xp || 0);
        setAwardedActions(userProgress.awardedActions || []);

        if (Array.isArray(userProgress.criteria) && userProgress.criteria.length > 0) {
          setJiraTicket(prev => ({
            ...prev,
            criteria: userProgress.criteria
          }));
        } else {
          setJiraTicket(prev => ({
            ...prev,
            criteria: initialJiraTicket.criteria.map(ac => ({ ...ac, completed: false }))
          }));
        }

        if (Array.isArray(userProgress.standards) && userProgress.standards.length > 0) {
          setStandards(userProgress.standards);
        } else {
          setStandards(initialStandards.map(s => ({ ...s, completed: false })));
        }

        if (Array.isArray(userProgress.auditedSymbols)) {
          setAuditedSymbols(userProgress.auditedSymbols);
        } else {
          setAuditedSymbols([]);
        }
      } else {
        setLevel(1);
        setUnlockedLevel(1);
        setXp(0);
        setAwardedActions([]);
        setJiraTicket(prev => ({
          ...prev,
          criteria: initialJiraTicket.criteria.map(ac => ({ ...ac, completed: false }))
        }));
        setStandards(initialStandards.map(s => ({ ...s, completed: false })));
        setAuditedSymbols([]);
      }

      setSyncStatus(res.isOnline ? 'saved' : 'offline');
    } else {
      setSyncStatus('offline');
    }
  };

  // --- Debounced Auto-Save to SQLite Database ---
  useEffect(() => {
    if (isInitialLoad.current) return;

    setSyncStatus('syncing');
    const timer = setTimeout(async () => {
      const progressObj = {
        level,
        unlockedLevel,
        xp,
        awardedActions,
        criteria: jiraTicket.criteria,
        standards,
        auditedSymbols
      };
      const res = await api.saveUserProgress(currentQueryId, progressObj);
      setSyncStatus(res.isOnline ? 'saved' : 'offline');
    }, 600);

    return () => clearTimeout(timer);
  }, [currentQueryId, jiraTicket.criteria, standards, auditedSymbols, level, unlockedLevel, xp, awardedActions]);

  // --- Persona Switch Handler ---
  const handleSelectPersona = async (personaId) => {
    const res = await api.login({ personaId });
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setQuestLogs(prev => [
        { id: Date.now(), text: `👤 Switched reviewer to: ${res.user.name} (@${res.user.username})`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 5));
      await loadQueryState(currentQueryId, res.user);
    }
  };

  const handleCustomLogin = async (username, password) => {
    const res = await api.login({ username, password });
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await loadQueryState(currentQueryId, res.user);
    }
    return res;
  };

  const handleCustomRegister = async (data) => {
    const res = await api.register(data);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await loadQueryState(currentQueryId, res.user);
    }
    return res;
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(PRESET_USERS[0]);
    loadQueryState(currentQueryId, PRESET_USERS[0]);
  };

  // --- Query Switch & Create Handlers ---
  const handleSelectQuery = async (queryId) => {
    if (queryId === currentQueryId) return;
    setCurrentQueryId(queryId);
    await loadQueryState(queryId, currentUser);
    const updatedQueries = await api.listQueries();
    setQueries(updatedQueries);
  };

  const handleCreateQuery = async (queryId, title) => {
    const cleanId = queryId.toUpperCase();
    const cleanTitle = title || `PR #${cleanId}: Feature Review`;
    const initialPr101 = await api.getQueryState('PR-101');
    const newState = {
      ...(initialPr101?.data?.state || {}),
      queryId: cleanId,
      title: cleanTitle,
      verdicts: []
    };

    await api.saveQueryState(cleanId, cleanTitle, newState, { level: 1, unlockedLevel: 1, xp: 0, awardedActions: [] });
    setCurrentQueryId(cleanId);
    setCurrentQueryTitle(cleanTitle);
    await loadQueryState(cleanId, currentUser);
    const updatedQueries = await api.listQueries();
    setQueries(updatedQueries);
  };

  // --- XP & Progression Handlers ---
  const handleAddXp = (amount, reason, actionId = null) => {
    if (actionId) {
      if (awardedActions.includes(actionId)) {
        return false;
      }
      setAwardedActions(prev => [...prev, actionId]);
    }
    setXp(prev => prev + amount);
    setQuestLogs(prev => [
      { id: Date.now() + Math.random(), text: `+${amount} XP: ${reason}`, timestamp: new Date().toLocaleTimeString() },
      ...prev
    ].slice(0, 5));
    return true;
  };

  // Milestone objective calculations
  const completedAcCount = (jiraTicket.criteria || []).filter(ac => ac.completed).length;
  const totalAcCount = (jiraTicket.criteria || []).length;
  const isLevel1Complete = totalAcCount > 0 && completedAcCount === totalAcCount;

  const completedStandardsCount = (standards || []).filter(s => s.completed).length;
  const totalStandardsCount = (standards || []).length;
  const isLevel2Complete = totalStandardsCount > 0 && completedStandardsCount === totalStandardsCount;

  const symbolKeys = Object.keys(initialSymbolCatalog);
  const completedSymbolsCount = (auditedSymbols || []).length;
  const totalSymbolsCount = symbolKeys.length;
  const isLevel3Complete = totalSymbolsCount > 0 && completedSymbolsCount === totalSymbolsCount;

  const getUserFileStatus = (f) => f.reviewerStatuses?.[currentUser?.id]?.status || 'pending';
  const allFilesReviewed = files.length > 0 && files.every(f => getUserFileStatus(f) !== 'pending');
  const reviewedCount = files.filter(f => getUserFileStatus(f) !== 'pending').length;
  const approvedCount = files.filter(f => getUserFileStatus(f) === 'approved').length;
  const flaggedCount = files.filter(f => getUserFileStatus(f) === 'flagged').length;
  const pendingCount = files.filter(f => getUserFileStatus(f) === 'pending').length;

  const isVerdictSubmitted = awardedActions.includes('final-verdict-submitted') || verdicts.some(v => v.userId === currentUser.id);
  const isLevel4Complete = allFilesReviewed && isVerdictSubmitted;

  // Sequential level unlock trigger
  useEffect(() => {
    let eligibleUnlocked = 1;
    if (isLevel1Complete) eligibleUnlocked = 2;
    if (isLevel1Complete && isLevel2Complete) eligibleUnlocked = 3;
    if (isLevel1Complete && isLevel2Complete && isLevel3Complete) eligibleUnlocked = 4;

    if (eligibleUnlocked > unlockedLevel) {
      setUnlockedLevel(eligibleUnlocked);
      handleAddXp(50, `Unlocked Level ${eligibleUnlocked}!`, `unlock-level-${eligibleUnlocked}`);
      setQuestLogs(prev => [
        { id: Date.now(), text: `🎉 LEVEL UNLOCKED! Level ${eligibleUnlocked} is now available!`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 5));
    }
  }, [isLevel1Complete, isLevel2Complete, isLevel3Complete, unlockedLevel]);

  // Overall progress percentage
  const l1Prog = totalAcCount > 0 ? (completedAcCount / totalAcCount) * 25 : 0;
  const l2Prog = totalStandardsCount > 0 ? (completedStandardsCount / totalStandardsCount) * 25 : 0;
  const l3Prog = totalSymbolsCount > 0 ? (completedSymbolsCount / totalSymbolsCount) * 25 : 0;
  const l4FileProg = files.length > 0 ? (reviewedCount / files.length) * 15 : 0;
  const l4VerdictProg = isVerdictSubmitted ? 10 : 0;
  const totalProgressPercent = Math.min(100, Math.round(l1Prog + l2Prog + l3Prog + l4FileProg + l4VerdictProg));

  // --- Review Action Handlers ---
  const handleUpdateFileStatus = async (fileId, status) => {
    if (status === 'reset') {
      setSelectedSpec('ALL');
      return;
    }
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        const nextStatuses = { ...(f.reviewerStatuses || {}) };
        nextStatuses[currentUser.id] = { 
          status, 
          userName: currentUser.name, 
          timestamp: 'Just now' 
        };
        return { ...f, status, reviewerStatuses: nextStatuses };
      }
      return f;
    }));

    await api.updateFileReviewStatus(currentQueryId, fileId, status);
  };

  const handleAddComment = async (fileId, commentPayload) => {
    const enriched = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar || '👨‍💻',
      type: commentPayload.type || 'note',
      text: commentPayload.text,
      timestamp: 'Just now',
      ...commentPayload
    };

    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        const nextComments = [...(f.comments || []), enriched];
        const nextStatuses = { ...(f.reviewerStatuses || {}) };
        if (commentPayload.type === 'flag') {
          nextStatuses[currentUser.id] = { 
            status: 'flagged', 
            userName: currentUser.name, 
            timestamp: 'Just now' 
          };
        }
        return { 
          ...f, 
          comments: nextComments, 
          status: commentPayload.type === 'flag' ? 'flagged' : f.status, 
          reviewerStatuses: nextStatuses 
        };
      }
      return f;
    }));

    await api.addComment(currentQueryId, fileId, enriched);
    if (commentPayload.type === 'flag') {
      await api.updateFileReviewStatus(currentQueryId, fileId, 'flagged');
    }
  };

  const handleToggleStandard = (id) => {
    setStandards(prev => prev.map(s => {
      if (s.id === id) {
        const nextVal = !s.completed;
        if (nextVal) {
          handleAddXp(25, `Verified Architecture Standard: ${s.id}`, `verify-std-${s.id}`);
        }
        return { ...s, completed: nextVal };
      }
      return s;
    }));
  };

  const handleToggleSymbolAudit = (symKey) => {
    const isAudited = auditedSymbols.includes(symKey);
    if (isAudited) {
      setAuditedSymbols(prev => prev.filter(k => k !== symKey));
    } else {
      setAuditedSymbols(prev => [...prev, symKey]);
      handleAddXp(25, `Audited Blast Radius for ${symKey}()`, `audit-symbol-${symKey}`);
    }
  };

  const handleSelectFileByPath = (path) => {
    const found = files.find(f => f.path === path);
    if (found) {
      setActiveFileId(found.id);
    }
  };

  const handleSubmitFinalVerdict = async () => {
    if (pendingCount > 0) {
      if (window.confirm(`You still have ${pendingCount} pending code file(s) in your review. Would you like to approve all remaining files and submit your verdict?`)) {
        for (const f of files) {
          if (getUserFileStatus(f) === 'pending') {
            await handleUpdateFileStatus(f.id, 'approved');
          }
        }
      } else {
        return;
      }
    }

    const verdictEntry = {
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar || '👨‍💻',
      verdict: userVerdictType,
      notes: userVerdictNotes || (userVerdictType === 'approved' ? 'All acceptance criteria and code changes approved.' : 'Changes requested by reviewer.'),
      timestamp: 'Just now'
    };

    setVerdicts(prev => {
      const idx = prev.findIndex(v => v.userId === verdictEntry.userId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = verdictEntry;
        return copy;
      }
      return [...prev, verdictEntry];
    });

    await api.submitVerdict(currentQueryId, verdictEntry);
    handleAddXp(100, `Submitted Final Review Verdict as ${currentUser.name}`, "final-verdict-submitted");

    setQuestLogs(prev => [
      { id: Date.now(), text: `🏆 Verdict submitted: ${userVerdictType.toUpperCase()} by ${currentUser.name}`, timestamp: new Date().toLocaleTimeString() },
      ...prev
    ].slice(0, 5));

    setIsVerdictOpen(false);
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset your review quest progress for this query?")) {
      setLevel(1);
      setUnlockedLevel(1);
      setXp(0);
      setAwardedActions([]);
      const freshCriteria = initialJiraTicket.criteria.map(ac => ({ ...ac, completed: false }));
      const freshStandards = initialStandards.map(s => ({ ...s, completed: false }));
      setJiraTicket(prev => ({ ...prev, criteria: freshCriteria }));
      setStandards(freshStandards);
      setTestSuites(initialTestSuites);
      setActiveSymbolKey("rotateSessionToken");
      setSelectedSpec('ALL');
      setAuditedSymbols([]);
      setQuestLogs([]);
      await api.saveUserProgress(currentQueryId, { 
        level: 1, 
        unlockedLevel: 1, 
        xp: 0, 
        awardedActions: [],
        criteria: freshCriteria,
        standards: freshStandards,
        auditedSymbols: []
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] flex flex-col">
      {/* Header with Smart Slim Level Cards */}
      <QuestHeader 
        level={level} 
        setLevel={setLevel} 
        unlockedLevel={unlockedLevel}
        xp={xp} 
        totalFiles={files.length} 
        reviewedCount={reviewedCount} 
        progressPercent={totalProgressPercent}
        onReset={handleReset}
        onOpenVerdict={() => setIsVerdictOpen(true)}
        onOpenArch={() => setIsDiagramModalOpen(true)}
        onOpenProgress={() => setIsProgressOpen(true)}
        onOpenInfo={() => setIsInfoOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        currentQueryId={currentQueryId}
        currentQueryTitle={currentQueryTitle}
        onOpenQuerySelector={() => setIsQuerySelectorOpen(true)}
        syncStatus={syncStatus}
        completedAcCount={completedAcCount}
        totalAcCount={totalAcCount}
        completedStandardsCount={completedStandardsCount}
        totalStandardsCount={totalStandardsCount}
        completedSymbolsCount={completedSymbolsCount}
        totalSymbolsCount={totalSymbolsCount}
        isLevel1Complete={isLevel1Complete}
        isLevel2Complete={isLevel2Complete}
        isLevel3Complete={isLevel3Complete}
        isLevel4Complete={isLevel4Complete}
        isVerdictSubmitted={isVerdictSubmitted}
      />

      {/* Main Workspace: Dynamically adapts per level */}
      <main className="flex-1 max-w-7xl xl:max-w-[1440px] w-full mx-auto p-4 lg:p-6">
        {level === 4 ? (
          <div className="w-full">
            <TestReviewWorkspace 
              testSuites={testSuites}
              setTestSuites={setTestSuites}
              files={files}
              onUpdateFileStatus={handleUpdateFileStatus}
              onAddXp={handleAddXp}
              onOpenVerdict={() => setIsVerdictOpen(true)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Sticky dynamic criteria */}
            <section className="lg:col-span-4 lg:sticky lg:top-4 self-start space-y-4">
              <DynamicLeftPanel 
                level={level}
                jiraTicket={jiraTicket}
                setJiraTicket={setJiraTicket}
                selectedSpec={selectedSpec}
                setSelectedSpec={setSelectedSpec}
                architectureStandards={standards}
                onToggleStandard={handleToggleStandard}
                mermaidCode={initialArchitectureMermaid}
                symbolCatalog={initialSymbolCatalog}
                activeSymbol={activeSymbolKey}
                onSelectSymbol={setActiveSymbolKey}
                onSelectFileByPath={handleSelectFileByPath}
                onAddXp={handleAddXp}
                onOpenArchModal={() => setIsDiagramModalOpen(true)}
                auditedSymbols={auditedSymbols}
                onToggleSymbolAudit={handleToggleSymbolAudit}
                isLevelComplete={
                  level === 1 ? isLevel1Complete :
                  level === 2 ? isLevel2Complete :
                  level === 3 ? isLevel3Complete :
                  isLevel4Complete
                }
                onProceedNextLevel={() => {
                  if (level === 1) {
                    setUnlockedLevel(prev => Math.max(prev, 2));
                    setLevel(2);
                  } else if (level === 2) {
                    setUnlockedLevel(prev => Math.max(prev, 3));
                    setLevel(3);
                  } else if (level === 3) {
                    setUnlockedLevel(prev => Math.max(prev, 4));
                    setLevel(4);
                  }
                }}
              />
            </section>

            {level === 3 ? (
              <>
                <section className="lg:col-span-5">
                  <HierarchicalDiffViewer 
                    files={files} 
                    selectedSpec={selectedSpec} 
                    activeFileId={activeFileId} 
                    setActiveFileId={setActiveFileId} 
                    onUpdateFileStatus={handleUpdateFileStatus} 
                    onAddComment={handleAddComment} 
                    onAddXp={handleAddXp}
                    level={level}
                    onInspectSymbol={(sym) => setActiveSymbolKey(sym)}
                    onOpenInfo={() => setIsInfoOpen(true)}
                    currentUser={currentUser}
                  />
                </section>
                <section className="lg:col-span-3 lg:sticky lg:top-4 self-start">
                  <FunctionInspectorPanel 
                    activeSymbolKey={activeSymbolKey}
                    onAddXp={handleAddXp}
                    onSelectFileByPath={handleSelectFileByPath}
                    onAuditedChange={handleToggleSymbolAudit}
                    auditedSymbols={auditedSymbols}
                  />
                </section>
              </>
            ) : (
              <section className="lg:col-span-8">
                <HierarchicalDiffViewer 
                  files={files} 
                  selectedSpec={selectedSpec} 
                  activeFileId={activeFileId} 
                  setActiveFileId={setActiveFileId} 
                  onUpdateFileStatus={handleUpdateFileStatus} 
                  onAddComment={handleAddComment} 
                  onAddXp={handleAddXp}
                  level={level}
                  onInspectSymbol={(sym) => setActiveSymbolKey(sym)}
                  onOpenInfo={() => setIsInfoOpen(true)}
                  currentUser={currentUser}
                />
              </section>
            )}
          </div>
        )}
      </main>

      {/* Excalidraw Style Architecture Diagram Modal */}
      <ArchitectureDiagramModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
        jiraTicket={jiraTicket}
        architectureStandards={standards}
        onAddXp={handleAddXp}
      />

      {/* Architecture Text Modal */}
      <ArchitectureModal 
        isOpen={isArchOpen} 
        onClose={() => setIsArchOpen(false)} 
        architectureText={architectureText} 
        onSave={setArchitectureText}
        onAddXp={handleAddXp}
      />

      {/* Distributed Team Verdict & Handoff Modal */}
      {isVerdictOpen && (
        <div 
          onClick={() => setIsVerdictOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#E6E0D5] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="bg-[#FFF8F6] border-b border-[#F7D8D0] p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C35832] text-white rounded-xl shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#242220]">Team Review Verdict & Sign-Off</h2>
                  <p className="text-xs text-[#6B635A]">
                    Target: <span className="font-mono font-bold text-[#C35832]">{currentQueryId}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVerdictOpen(false)}
                className="text-[#6B635A] hover:text-[#242220] p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* File Approvals Summary Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#F4F8F5] border border-[#4F6D56]/20 rounded-xl p-3">
                  <div className="text-xl font-extrabold text-[#4F6D56]">{approvedCount}</div>
                  <div className="text-[10px] text-[#6B635A] uppercase font-bold">Approved</div>
                </div>
                <div className="bg-[#FFF8F6] border border-[#C35832]/20 rounded-xl p-3">
                  <div className="text-xl font-extrabold text-[#C35832]">{flaggedCount}</div>
                  <div className="text-[10px] text-[#6B635A] uppercase font-bold">Flagged</div>
                </div>
                <div className="bg-[#FFFDF9] border border-[#D08A29]/20 rounded-xl p-3">
                  <div className="text-xl font-extrabold text-[#D08A29]">{pendingCount}</div>
                  <div className="text-[10px] text-[#6B635A] uppercase font-bold">Pending</div>
                </div>
              </div>

              {pendingCount > 0 && (
                <div className="bg-[#FFFDF9] border border-[#D08A29]/30 rounded-xl p-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#D08A29] mt-0.5 shrink-0" />
                    <span className="text-[#6B635A]">
                      You have <strong className="text-[#242220]">{pendingCount} pending files</strong>. Approve them to complete final review:
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'approved' } : f));
                    }}
                    className="px-2.5 py-1 bg-[#4F6D56] hover:bg-[#3D5442] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Approve All
                  </button>
                </div>
              )}

              {/* Distributed Peer Verdicts Section */}
              <div className="bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#6B635A] flex items-center justify-between">
                  <span>Team Review Verdicts ({verdicts.length})</span>
                  <span className="text-[11px] font-bold text-[#4F6D56]">
                    {verdicts.filter(v => v.verdict === 'approved').length} of {verdicts.length} Approved
                  </span>
                </div>
                {verdicts.length === 0 ? (
                  <div className="text-xs text-[#6B635A] italic py-2">
                    No peer verdicts recorded yet. Submit your verdict below to establish the baseline review.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {verdicts.map((v, idx) => (
                      <div key={idx} className="bg-white border border-[#E6E0D5] rounded-xl p-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{v.userAvatar || '👤'}</span>
                            <div>
                              <span className="font-bold text-[#242220]">{v.userName}</span>
                              <span className="text-[10px] text-[#6B635A] ml-1.5 bg-[#F1ECE4] px-1.5 py-0.2 rounded font-medium font-mono">
                                @{v.userId || 'reviewer'}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            v.verdict === 'approved' 
                              ? 'bg-[#F4F8F5] text-[#4F6D56] border border-[#4F6D56]/30' 
                              : v.verdict === 'changes_requested'
                                ? 'bg-[#FFF8F6] text-[#C35832] border border-[#F7D8D0]'
                                : 'bg-[#FFFDF9] text-[#D08A29] border border-[#D08A29]/30'
                          }`}>
                            {v.verdict === 'approved' ? '✓ APPROVED' : v.verdict === 'changes_requested' ? '⚠️ CHANGES REQUESTED' : '💬 COMMENT'}
                          </span>
                        </div>
                        {v.notes && (
                          <p className="mt-2 text-[11px] text-[#242220] pl-6 font-mono leading-relaxed bg-[#F9F6F0] p-2 rounded-lg">
                            "{v.notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Your Verdict Form */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6B635A]">
                    Your Verdict as: <strong className="text-[#242220]">{currentUser.name}</strong>
                  </label>
                  <span className="text-[11px] text-[#6B635A] font-mono">@{currentUser.username || currentUser.id}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserVerdictType('approved')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      userVerdictType === 'approved'
                        ? 'bg-[#4F6D56] text-white border-[#4F6D56] shadow-xs'
                        : 'bg-white border-[#E6E0D5] text-[#4F6D56] hover:bg-[#F4F8F5]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve (LGTM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserVerdictType('changes_requested')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      userVerdictType === 'changes_requested'
                        ? 'bg-[#C35832] text-white border-[#C35832] shadow-xs'
                        : 'bg-white border-[#E6E0D5] text-[#C35832] hover:bg-[#FFF8F6]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserVerdictType('comment')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      userVerdictType === 'comment'
                        ? 'bg-[#D08A29] text-white border-[#D08A29] shadow-xs'
                        : 'bg-white border-[#E6E0D5] text-[#D08A29] hover:bg-[#FFFDF9]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Comment / Handoff</span>
                  </button>
                </div>

                <div>
                  <textarea
                    rows="3"
                    className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#C35832]"
                    placeholder="Provide constructive review comments, architecture feedback, or handoff notes for your peer reviewers..."
                    value={userVerdictNotes}
                    onChange={(e) => setUserVerdictNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#F9F6F0] border-t border-[#E6E0D5] p-4 flex justify-between items-center">
              <span className="text-xs text-[#6B635A]">
                Persisted against <strong className="text-[#242220] font-mono">{currentQueryId}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsVerdictOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E6E0D5] text-xs font-medium rounded-xl hover:bg-[#FFFDF9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFinalVerdict}
                  className="px-5 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Submit Review Verdict (+100 XP)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Progress Breakdown Modal */}
      {isProgressOpen && (
        <div 
          onClick={() => setIsProgressOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#E6E0D5] rounded-2xl max-w-lg w-full shadow-2xl p-6"
          >
            <div className="flex items-center justify-between border-b border-[#F1ECE4] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D08A29]" />
                <h2 className="text-base font-bold text-[#242220]">Review Progress & Milestone Breakdown</h2>
              </div>
              <button 
                onClick={() => setIsProgressOpen(false)}
                className="text-[#6B635A] hover:text-[#242220] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#FFFDF9] border border-[#D08A29]/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#242220]">Comprehensive Completion</div>
                  <div className="text-[11px] text-[#6B635A]">Weighted across all 4 review stages</div>
                </div>
                <div className="text-xl font-extrabold text-[#D08A29]">{totalProgressPercent}%</div>
              </div>

              {/* Level 1 Item */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                isLevel1Complete ? 'bg-[#F4F8F5] border-[#4F6D56]/30' : 'bg-white border-[#E6E0D5]'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#242220]">Level 1: Spec & Intent Check</span>
                    {isLevel1Complete && <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">Done ✓</span>}
                  </div>
                  <div className="text-[11px] text-[#6B635A] mt-0.5">
                    {completedAcCount}/{totalAcCount} Acceptance Criteria verified
                  </div>
                </div>
                <button
                  onClick={() => { setLevel(1); setIsProgressOpen(false); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] transition-colors cursor-pointer"
                >
                  {level === 1 ? "Active" : "Jump to L1"}
                </button>
              </div>

              {/* Level 2 Item */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                isLevel2Complete ? 'bg-[#F4F8F5] border-[#4F6D56]/30' : 'bg-white border-[#E6E0D5]'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#242220]">Level 2: Core Architecture</span>
                    {isLevel2Complete && <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">Done ✓</span>}
                  </div>
                  <div className="text-[11px] text-[#6B635A] mt-0.5">
                    {completedStandardsCount}/{totalStandardsCount} Left-panel Standards audited
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (unlockedLevel >= 2) { setLevel(2); setIsProgressOpen(false); }
                  }}
                  disabled={unlockedLevel < 2}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    unlockedLevel < 2 
                      ? 'bg-[#F1ECE4] text-[#6B635A] cursor-not-allowed opacity-50'
                      : 'bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] cursor-pointer'
                  }`}
                >
                  {level === 2 ? "Active" : unlockedLevel < 2 ? "Locked" : "Jump to L2"}
                </button>
              </div>

              {/* Level 3 Item */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                isLevel3Complete ? 'bg-[#F4F8F5] border-[#4F6D56]/30' : 'bg-white border-[#E6E0D5]'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#242220]">Level 3: Blast Radius</span>
                    {isLevel3Complete && <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">Done ✓</span>}
                  </div>
                  <div className="text-[11px] text-[#6B635A] mt-0.5">
                    {completedSymbolsCount}/{totalSymbolsCount} Left-panel Symbols audited
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (unlockedLevel >= 3) { setLevel(3); setIsProgressOpen(false); }
                  }}
                  disabled={unlockedLevel < 3}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    unlockedLevel < 3 
                      ? 'bg-[#F1ECE4] text-[#6B635A] cursor-not-allowed opacity-50'
                      : 'bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] cursor-pointer'
                  }`}
                >
                  {level === 3 ? "Active" : unlockedLevel < 3 ? "Locked" : "Jump to L3"}
                </button>
              </div>

              {/* Level 4 Item */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                isLevel4Complete ? 'bg-[#F4F8F5] border-[#4F6D56]/30' : 'bg-white border-[#E6E0D5]'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#242220]">Level 4: Tests & Final Verdict</span>
                    {isLevel4Complete && <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">Done ✓</span>}
                  </div>
                  <div className="text-[11px] text-[#6B635A] mt-0.5">
                    {reviewedCount}/{files.length} Code Files approved • Verdict: {isVerdictSubmitted ? "Submitted ✓" : "Pending"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (unlockedLevel >= 4) { setLevel(4); setIsProgressOpen(false); }
                  }}
                  disabled={unlockedLevel < 4}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    unlockedLevel < 4 
                      ? 'bg-[#F1ECE4] text-[#6B635A] cursor-not-allowed opacity-50'
                      : 'bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] cursor-pointer'
                  }`}
                >
                  {level === 4 ? "Active" : unlockedLevel < 4 ? "Locked" : "Jump to L4"}
                </button>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#F1ECE4] flex justify-between items-center">
              <span className="text-xs text-[#6B635A]">
                {reviewedCount}/{files.length} Files Reviewed
              </span>
              <button
                onClick={() => setIsProgressOpen(false)}
                className="px-4 py-2 bg-[#C35832] text-white text-xs font-bold rounded-lg hover:bg-[#A84725] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth & Persona Switcher Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onSelectPersona={handleSelectPersona}
        onCustomLogin={handleCustomLogin}
        onCustomRegister={handleCustomRegister}
        onLogout={handleLogout}
      />

      {/* Query Selector Modal */}
      <QuerySelectorModal
        isOpen={isQuerySelectorOpen}
        onClose={() => setIsQuerySelectorOpen(false)}
        currentQueryId={currentQueryId}
        queries={queries}
        onSelectQuery={handleSelectQuery}
        onCreateQuery={handleCreateQuery}
      />

      {/* Global Informational Side Panel / Drawer */}
      <InfoSidePanel 
        isOpen={isInfoOpen} 
        onClose={() => setIsInfoOpen(false)} 
      />
    </div>
  );
}