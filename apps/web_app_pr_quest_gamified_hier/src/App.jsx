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
import { Award, CheckCircle, AlertTriangle, Sparkles, ArrowRight, ShieldAlert, MessageSquare, Send, Check, Clock } from 'lucide-react';

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
  const [unlockedLevel, setUnlockedLevel] = useState(4);

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
  const [alsoApproveRemaining, setAlsoApproveRemaining] = useState(false);

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
      { id: Date.now() + Math.random(), text: `Completed: ${reason}`, timestamp: new Date().toLocaleTimeString() },
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

  const handleRemoveFlag = async (fileId, commentId) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        const nextStatuses = { ...(f.reviewerStatuses || {}) };
        delete nextStatuses[currentUser.id];

        const nextComments = (f.comments || []).filter(c => {
          if (commentId) return c.id !== commentId;
          return !(c.type === 'flag' && (c.authorId === currentUser.id || c.authorName === currentUser.name));
        });

        const anyFlagged = Object.values(nextStatuses).some(s => s.status === 'flagged');
        const anyApproved = Object.values(nextStatuses).some(s => s.status === 'approved');
        const nextStatus = anyFlagged ? 'flagged' : anyApproved ? 'approved' : 'pending';

        return {
          ...f,
          status: nextStatus,
          reviewerStatuses: nextStatuses,
          comments: nextComments
        };
      }
      return f;
    }));

    await api.removeFlag(currentQueryId, fileId, currentUser.id);
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
    // If user explicitly checked the box to bulk-approve remaining files
    if (userVerdictType === 'approved' && alsoApproveRemaining && pendingCount > 0) {
      for (const f of files) {
        if (getUserFileStatus(f) === 'pending') {
          await handleUpdateFileStatus(f.id, 'approved');
        }
      }
    }

    const currentReviewed = files.filter(f => getUserFileStatus(f) !== 'pending').length;
    const isPartialReview = userVerdictType === 'partial' || (pendingCount > 0 && !alsoApproveRemaining);

    const defaultNotes = userVerdictType === 'approved' 
      ? 'All reviewed code changes approved.' 
      : userVerdictType === 'partial'
        ? `Partial review submitted (${currentReviewed} of ${files.length} files reviewed).`
        : userVerdictType === 'changes_requested'
          ? 'Changes requested by reviewer.'
          : 'Review comments provided.';

    const verdictEntry = {
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar || '👨‍💻',
      verdict: userVerdictType,
      isPartial: isPartialReview,
      reviewedCount: currentReviewed,
      totalFiles: files.length,
      notes: userVerdictNotes || defaultNotes,
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
    handleAddXp(100, `Submitted Review Verdict as ${currentUser.name}`, "final-verdict-submitted");

    setQuestLogs(prev => [
      { id: Date.now(), text: `🏆 Verdict submitted: ${userVerdictType.toUpperCase()} by ${currentUser.name}`, timestamp: new Date().toLocaleTimeString() },
      ...prev
    ].slice(0, 5));

    setIsVerdictOpen(false);
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset your review quest progress for this query?")) {
      setLevel(1);
      setUnlockedLevel(4);
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
        ) : level === 3 ? (
          /* Level 3: Only Middle (Diff Workspace) and Right (Function Inspector) Panel */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7">
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
                onRemoveFlag={handleRemoveFlag}
                onOpenVerdict={() => setIsVerdictOpen(true)}
              />
            </section>
            <section className="lg:col-span-5 lg:sticky lg:top-4 self-start">
              <FunctionInspectorPanel 
                activeSymbolKey={activeSymbolKey}
                symbolCatalog={initialSymbolCatalog}
                onSelectSymbol={setActiveSymbolKey}
                auditedSymbols={auditedSymbols}
                onToggleSymbolAudit={handleToggleSymbolAudit}
                onAddXp={handleAddXp}
                onSelectFileByPath={handleSelectFileByPath}
                isLevelComplete={isLevel3Complete}
              />
            </section>
          </div>
        ) : (
          /* Level 1 & 2: Left and Middle Panel */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
              />
            </section>
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
                  onRemoveFlag={handleRemoveFlag}
                  onOpenVerdict={() => setIsVerdictOpen(true)}
                />
              </section>
          </div>
        )}
      </main>

      {/* Architecture Diagram Modal */}
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
            className="bg-white border border-[#E6E0D5] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#F1ECE4] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#242220]">Submit PR Review</h2>
                <p className="text-xs text-[#6B635A] mt-0.5">
                  <span className="font-mono font-bold text-[#C35832]">{currentQueryId}</span>
                  <span className="mx-1.5">•</span>
                  <span>Reviewing as <strong className="text-[#242220]">@{currentUser.username || currentUser.id}</strong></span>
                </p>
              </div>
              <button 
                onClick={() => setIsVerdictOpen(false)}
                className="text-[#8C827A] hover:text-[#242220] p-1.5 rounded-lg hover:bg-[#F9F6F0] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Review Scope / Status Bar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F9F6F0] rounded-xl text-xs border border-[#E6E0D5]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#242220]">Scope:</span>
                  <span className="text-[#4F6D56] font-bold">{approvedCount} approved</span>
                  {flaggedCount > 0 && (
                    <>
                      <span className="text-[#8C827A]">•</span>
                      <span className="text-[#C35832] font-bold">{flaggedCount} flagged</span>
                    </>
                  )}
                  {pendingCount > 0 && (
                    <>
                      <span className="text-[#8C827A]">•</span>
                      <span className="text-[#D08A29] font-bold">{pendingCount} pending</span>
                    </>
                  )}
                </div>
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'approved' } : f));
                    }}
                    className="text-[11px] font-bold text-[#4F6D56] hover:underline cursor-pointer"
                  >
                    Approve All Pending
                  </button>
                )}
              </div>

              {/* Verdict Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#6B635A] uppercase tracking-wider">
                  Review Verdict
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUserVerdictType('approved')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      userVerdictType === 'approved'
                        ? 'bg-[#F4F8F5] border-[#4F6D56] text-[#4F6D56] ring-1 ring-[#4F6D56] shadow-2xs'
                        : 'bg-white border-[#E6E0D5] text-[#242220] hover:bg-[#F9F6F0]'
                    }`}
                  >
                    <Check className="w-4 h-4 mt-0.5 text-[#4F6D56] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Approve</div>
                      <div className="text-[10px] text-[#6B635A]">Approve merging</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserVerdictType('changes_requested')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      userVerdictType === 'changes_requested'
                        ? 'bg-[#FFF8F6] border-[#C35832] text-[#C35832] ring-1 ring-[#C35832] shadow-2xs'
                        : 'bg-white border-[#E6E0D5] text-[#242220] hover:bg-[#F9F6F0]'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-[#C35832] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Request Changes</div>
                      <div className="text-[10px] text-[#6B635A]">Block until fixes</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserVerdictType('partial')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      userVerdictType === 'partial'
                        ? 'bg-[#FFFDF9] border-[#D08A29] text-[#D08A29] ring-1 ring-[#D08A29] shadow-2xs'
                        : 'bg-white border-[#E6E0D5] text-[#242220] hover:bg-[#F9F6F0]'
                    }`}
                  >
                    <Clock className="w-4 h-4 mt-0.5 text-[#D08A29] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Partial Review</div>
                      <div className="text-[10px] text-[#6B635A]">Submit review so far</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserVerdictType('comment')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      userVerdictType === 'comment'
                        ? 'bg-[#F9F6F0] border-[#6B635A] text-[#242220] ring-1 ring-[#6B635A] shadow-2xs'
                        : 'bg-white border-[#E6E0D5] text-[#242220] hover:bg-[#F9F6F0]'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 mt-0.5 text-[#6B635A] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Comment</div>
                      <div className="text-[10px] text-[#6B635A]">General feedback</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Contextual checkbox when approving with pending files */}
              {userVerdictType === 'approved' && pendingCount > 0 && (
                <label className="flex items-center gap-2 p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl text-xs text-[#6B635A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoApproveRemaining}
                    onChange={(e) => setAlsoApproveRemaining(e.target.checked)}
                    className="rounded border-[#E6E0D5] text-[#C35832] focus:ring-[#C35832]"
                  />
                  <span>Also mark remaining <strong className="text-[#242220]">{pendingCount} pending file(s)</strong> as approved</span>
                </label>
              )}

              {/* Review Feedback Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#6B635A] uppercase tracking-wider">
                  Review Summary <span className="font-normal text-[#8C827A] normal-case">(optional)</span>
                </label>
                <textarea
                  rows="3"
                  className="w-full bg-[#F9F6F0]/50 border border-[#E6E0D5] rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#C35832] focus:bg-white transition-all resize-none"
                  placeholder="Leave review comments or handoff notes for your peer reviewers..."
                  value={userVerdictNotes}
                  onChange={(e) => setUserVerdictNotes(e.target.value)}
                />
              </div>

              {/* Peer Verdicts (Only shown if verdicts exist) */}
              {verdicts.length > 0 && (
                <details className="text-xs group border-t border-[#F1ECE4] pt-2">
                  <summary className="cursor-pointer text-[#6B635A] hover:text-[#242220] font-medium flex items-center justify-between py-1">
                    <span>Peer Reviews ({verdicts.length})</span>
                    <span className="text-[11px] text-[#4F6D56] font-bold">
                      {verdicts.filter(v => v.verdict === 'approved').length} of {verdicts.length} approved
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2 max-h-36 overflow-y-auto">
                    {verdicts.map((v, idx) => (
                      <div key={idx} className="p-2.5 bg-[#F9F6F0] rounded-xl border border-[#E6E0D5] text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#242220]">@{v.userId || v.userName}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                            v.verdict === 'approved' ? 'bg-[#F4F8F5] text-[#4F6D56]' : 'bg-[#FFF8F6] text-[#C35832]'
                          }`}>
                            {v.verdict}
                          </span>
                        </div>
                        {v.notes && <p className="mt-1 text-[#6B635A] font-mono">{v.notes}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#F9F6F0]/60 border-t border-[#E6E0D5] p-4 flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVerdictOpen(false)}
                className="px-4 py-2 bg-white border border-[#E6E0D5] text-xs font-semibold text-[#6B635A] rounded-xl hover:bg-[#F9F6F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFinalVerdict}
                className="px-5 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Submit Verdict</span>
              </button>
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
                  onClick={() => { setLevel(2); setIsProgressOpen(false); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] transition-colors cursor-pointer"
                >
                  {level === 2 ? "Active" : "Jump to L2"}
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
                  onClick={() => { setLevel(3); setIsProgressOpen(false); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] transition-colors cursor-pointer"
                >
                  {level === 3 ? "Active" : "Jump to L3"}
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
                  onClick={() => { setLevel(4); setIsProgressOpen(false); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#F9F6F0] hover:bg-[#E6E0D5] text-[#242220] transition-colors cursor-pointer"
                >
                  {level === 4 ? "Active" : "Jump to L4"}
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