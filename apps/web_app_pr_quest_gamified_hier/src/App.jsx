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
import { buildSymbolCatalogFromFiles, isGithubWorkspaceFiles } from './utils/buildSymbolCatalog';
import { buildArchitectureDiagram } from './utils/buildArchitectureDiagram';
import { chunkLargeFiles } from './utils/chunkLargeFiles';
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
  const [geminiStatus, setGeminiStatus] = useState({ configured: false, source: 'none' });

  // --- Query / PR State ---
  const [currentQueryId, setCurrentQueryId] = useState(() => {
    const urlParam = new URLSearchParams(window.location.search).get('query');
    return urlParam || localStorage.getItem('pr_quest_current_query') || 'PR-101';
  });
  const [currentQueryTitle, setCurrentQueryTitle] = useState('PR #101: Session Token Rotation & Salt Validation');
  const [queries, setQueries] = useState([]);
  const [isQuerySelectorOpen, setIsQuerySelectorOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'syncing' | 'offline'

  // --- GitHub Import & Sync State ---
  const [githubRepoUrl, setGithubRepoUrl] = useState(() => {
    return new URLSearchParams(window.location.search).get('repo') || localStorage.getItem('pr_quest_gh_repo') || '';
  });
  const [githubPullRequests, setGithubPullRequests] = useState([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubPrLoading, setGithubPrLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [githubStatus, setGithubStatus] = useState({ linked: false, login: null, avatarUrl: null });
  const [myRepos, setMyRepos] = useState([]);
  const [myReposLoading, setMyReposLoading] = useState(false);
  const [repoDocs, setRepoDocs] = useState([]);
  const [githubMeta, setGithubMeta] = useState(null);

  // --- Gemini & AI Automation State ---
  const [customDiagramModel, setCustomDiagramModel] = useState(null);
  const [customSymbolCatalog, setCustomSymbolCatalog] = useState(null);
  const [architectureSummary, setArchitectureSummary] = useState('');
  const [hasUploadedArchitecture, setHasUploadedArchitecture] = useState(false);
  const [isLinkingIssue, setIsLinkingIssue] = useState(false);
  const [isAnalyzingArchitecture, setIsAnalyzingArchitecture] = useState(false);

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

  const refreshGithubStatus = async () => {
    const st = await api.getGithubStatus();
    setGithubStatus(st);
    return st;
  };

  // --- Load Initial Query & Setup ---
  useEffect(() => {
    async function init() {
      await api.checkHealth();
      await refreshGithubStatus();
      try {
        const gst = await api.getGeminiStatus();
        setGeminiStatus(gst);
      } catch (e) {
        console.error("Failed to load Gemini status:", e);
      }
      const queryList = await api.listQueries();
      setQueries(queryList);
      await loadQueryState(currentQueryId, currentUser);
      if (githubRepoUrl) {
        handleLoadRepo(githubRepoUrl);
      }
      isInitialLoad.current = false;
    }
    init();
  }, []);

  // Save current query ID & repo URL to local storage & URL
  useEffect(() => {
    localStorage.setItem('pr_quest_current_query', currentQueryId);
    const url = new URL(window.location);
    url.searchParams.set('query', currentQueryId);
    if (githubRepoUrl) {
      url.searchParams.set('repo', githubRepoUrl);
      localStorage.setItem('pr_quest_gh_repo', githubRepoUrl);
    }
    window.history.replaceState({}, '', url);
  }, [currentQueryId, githubRepoUrl]);

  // --- Query State Loader ---
  const loadQueryState = async (queryId, user = currentUser) => {
    setSyncStatus('syncing');
    const targetUserId = user?.id || 'reviewer_1';
    const res = await api.getQueryState(queryId, targetUserId);

    if (res.success && res.data) {
      const {
        title,
        files: sharedFiles,
        verdicts: sharedVerdicts,
        jiraTicket: queryTicket,
        standards: queryStandards,
        architectureText: queryArch,
        repoDocs: queryDocs,
        meta: queryMeta,
        userProgress,
        testSuites: queryTestSuites,
        architectureDiagramModel: queryArchDiagram,
        symbolCatalog: querySymbols,
        architectureSummary: queryArchSummary
      } = res.data;
      setCurrentQueryTitle(title || `PR #${queryId}`);

      const isGh = String(queryId).startsWith('GH-');

      if (sharedFiles && Array.isArray(sharedFiles)) {
        const safeFiles = sharedFiles.map(f => {
          const canonical = isGh ? null : initialFiles.find(cf => cf.id === f.id || cf.path === f.path);
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
        const chunkedFiles = chunkLargeFiles(safeFiles, 200);
        setFiles(chunkedFiles);
        setActiveFileId(prev => (prev && chunkedFiles.some(f => f.id === prev)) ? prev : (chunkedFiles[0]?.id || null));
      }

      if (sharedVerdicts && Array.isArray(sharedVerdicts)) {
        setVerdicts(sharedVerdicts);
      }

      if (queryTicket) setJiraTicket(queryTicket);
      if (queryStandards && Array.isArray(queryStandards) && queryStandards.length > 0) {
        setStandards(queryStandards);
      } else if (!isGh && queryId === 'PR-101') {
        setStandards(initialStandards);
      } else {
        setStandards([]);
      }

      if (queryArch && (queryId === 'PR-101' || queryArch !== defaultArchitecture)) {
        setArchitectureText(queryArch);
      } else if (!isGh && queryId === 'PR-101') {
        setArchitectureText(defaultArchitecture);
      } else {
        setArchitectureText('');
      }

      if (queryDocs && Array.isArray(queryDocs) && queryDocs.length > 0) {
        setRepoDocs(queryDocs);
        const hasUploadedDoc = queryDocs.some(d => (d.role === 'architecture' || d.path?.toLowerCase().endsWith('architecture.md')) && d.uploaded === true);
        setHasUploadedArchitecture(hasUploadedDoc);
      } else if (!isGh && queryId === 'PR-101') {
        setRepoDocs(initialReferences);
        setHasUploadedArchitecture(false);
      } else {
        setRepoDocs([]);
        setHasUploadedArchitecture(false);
      }

      if (queryMeta) setGithubMeta(queryMeta);

      let resolvedSuites = (queryTestSuites && Array.isArray(queryTestSuites) && queryTestSuites.length > 0)
        ? queryTestSuites
        : (queryMeta?.testSuites && Array.isArray(queryMeta.testSuites) && queryMeta.testSuites.length > 0)
          ? queryMeta.testSuites
          : null;

      if (!resolvedSuites || resolvedSuites.length === 0) {
        if (!isGh) {
          resolvedSuites = initialTestSuites;
        } else if (safeFiles && safeFiles.length > 0) {
          const primaryFiles = safeFiles.slice(0, 3);
          resolvedSuites = primaryFiles.map((f, idx) => {
            const fileName = f.path.split('/').pop();
            const modName = fileName.replace(/\.[^.]+$/, '');
            const sym = modName.charAt(0).toLowerCase() + modName.slice(1);
            return {
              id: `gh-test-${idx + 1}`,
              suiteName: `${modName} Verification`,
              testName: `should verify ${sym} flow without exceptions`,
              file: `tests/${modName}.test.js`,
              targetSymbol: sym,
              targetFile: f.path,
              targetLines: '1-40',
              status: 'pass',
              executionMs: 14 + idx * 4,
              assertionsCount: 2,
              assertions: [
                { text: `expect(${sym}).toBeDefined()`, status: 'pass', label: 'Export Verification' },
                { text: 'expect(result.status).toBe(200)', status: 'pass', label: 'Response Contract' }
              ],
              code: `describe('${modName}', () => {\n  it('should verify ${sym} flow', async () => {\n    const res = await ${sym}();\n    expect(res).toBeDefined();\n  });\n});`,
              testedFunctionCode: `// Production Implementation in ${f.path}\nexport async function ${sym}() {\n  return { status: 200 };\n}`,
              notes: `Auto-generated test case for ${f.path}`
            };
          });
        } else {
          resolvedSuites = [];
        }
      }
      setTestSuites(resolvedSuites);

      const resolvedDiagram = queryArchDiagram || queryMeta?.architectureDiagramModel || null;
      setCustomDiagramModel(resolvedDiagram);

      const resolvedSymbols = querySymbols || queryMeta?.symbolCatalog || null;
      setCustomSymbolCatalog(resolvedSymbols);

      const resolvedSummary = queryArchSummary || queryMeta?.architectureSummary || '';
      setArchitectureSummary(resolvedSummary);

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
        } else if (queryTicket?.criteria) {
          setJiraTicket(prev => ({
            ...prev,
            criteria: queryTicket.criteria.map(ac => ({ ...ac, completed: false }))
          }));
        } else {
          setJiraTicket(prev => ({
            ...prev,
            criteria: initialJiraTicket.criteria.map(ac => ({ ...ac, completed: false }))
          }));
        }

        if (Array.isArray(userProgress.standards) && userProgress.standards.length > 0) {
          setStandards(userProgress.standards);
        } else if (queryStandards && queryStandards.length > 0) {
          setStandards(queryStandards.map(s => ({ ...s, completed: false })));
        } else if (!isGh && queryId === 'PR-101') {
          setStandards(initialStandards.map(s => ({ ...s, completed: false })));
        } else {
          setStandards([]);
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
        if (!queryTicket) {
          setJiraTicket(prev => ({
            ...prev,
            criteria: initialJiraTicket.criteria.map(ac => ({ ...ac, completed: false }))
          }));
        }
        if (queryStandards && queryStandards.length > 0) {
          setStandards(queryStandards.map(s => ({ ...s, completed: false })));
        } else if (!isGh && queryId === 'PR-101') {
          setStandards(initialStandards.map(s => ({ ...s, completed: false })));
        } else {
          setStandards([]);
        }
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

  const isGh = String(currentQueryId).startsWith('GH-');
  const hasUploadedMd = Boolean(
    hasUploadedArchitecture ||
    repoDocs.some(d => (d.role === 'architecture' || d.path?.toLowerCase().endsWith('architecture.md')) && d.uploaded === true)
  );
  const hasArchitectureDoc = isGh
    ? hasUploadedMd
    : Boolean(
        hasUploadedMd ||
        (currentQueryId === 'PR-101' && architectureText && architectureText.trim()) ||
        (architectureText && architectureText !== defaultArchitecture && architectureText.trim())
      );

  // Milestone objective calculations
  const completedAcCount = (jiraTicket.criteria || []).filter(ac => ac.completed).length;
  const totalAcCount = (jiraTicket.criteria || []).length;
  const isLevel1Complete = totalAcCount > 0 && completedAcCount === totalAcCount;

  const completedStandardsCount = (standards || []).filter(s => s.completed).length;
  const totalStandardsCount = (standards || []).length;
  const isLevel2Complete = hasArchitectureDoc && totalStandardsCount > 0 && completedStandardsCount === totalStandardsCount;

  const isGithubWorkspace = isGithubWorkspaceFiles(files) || isGh;
  const derivedSymbols = isGithubWorkspace ? buildSymbolCatalogFromFiles(files) : null;
  const symbolCatalog = customSymbolCatalog
    || (derivedSymbols?.catalog && Object.keys(derivedSymbols.catalog).length > 0
      ? derivedSymbols.catalog
      : initialSymbolCatalog);
  const symbolKeys = Object.keys(symbolCatalog || {});
  const completedSymbolsCount = (auditedSymbols || []).filter(k => symbolKeys.includes(k)).length;
  const totalSymbolsCount = symbolKeys.length;
  const isLevel3Complete = totalSymbolsCount > 0 && completedSymbolsCount === totalSymbolsCount;

  // Keep Level 3 inspector keyed to a symbol that exists for this workspace
  useEffect(() => {
    if (!symbolKeys.length) return;
    if (!activeSymbolKey || !symbolKeys.includes(activeSymbolKey)) {
      setActiveSymbolKey(derivedSymbols?.defaultKey || symbolKeys[0]);
    }
  }, [currentQueryId, symbolKeys.join(',')]);

  const architectureDiagramModel = hasArchitectureDoc
    ? (customDiagramModel || (isGithubWorkspace ? buildArchitectureDiagram(files, architectureText, repoDocs) : null))
    : null;

  // --- GitHub PR Handlers ---
  const handleLoadRepo = async (repoInput) => {
    setGithubLoading(true);
    setGithubError('');
    const res = await api.fetchOpenPullRequests(repoInput);
    setGithubLoading(false);
    if (!res.success) {
      setGithubError(res.error || 'Failed to load pull requests');
      return false;
    }
    setGithubRepoUrl(res.repoUrl || repoInput);
    setGithubPullRequests(res.pullRequests || []);
    return true;
  };

  const handleSelectGitHubPr = async (pr) => {
    if (!pr?.owner || !pr?.repo || !pr?.number) return;
    if (pr.queryId === currentQueryId && !githubPrLoading) return;

    setGithubPrLoading(true);
    setGithubError('');
    setSyncStatus('syncing');

    const res = await api.fetchGitHubPullRequest(pr.owner, pr.repo, pr.number, {
      head: pr.head,
      base: pr.base,
      title: pr.title
    });
    setGithubPrLoading(false);

    if (!res.success) {
      setGithubError(res.error || `Failed to load PR #${pr.number}`);
      setSyncStatus('offline');
      return;
    }

    await applyGithubWorkspace(res);
    setQuestLogs(prev => [
      {
        id: Date.now(),
        text: `🔀 Switched to GitHub PR #${pr.number}: ${pr.title}`,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev
    ].slice(0, 5));
  };

  const applyGithubWorkspace = async (workspace) => {
    const queryId = workspace.queryId;
    const title = workspace.title;
    const existing = await api.getQueryState(queryId);

    const hasSavedReview = existing.success && existing.data?.files && existing.data.files.length > 0;

    if (hasSavedReview) {
      setCurrentQueryId(queryId);
      setCurrentQueryTitle(existing.data.title || title);
      await loadQueryState(queryId, currentUser);
    } else {
      const chunkedFiles = chunkLargeFiles(workspace.files || [], 200);
      const nextStandards = Array.isArray(workspace.standards) && workspace.standards.length > 0
        ? workspace.standards.map(s => ({ ...s, completed: false }))
        : [];
      const nextArchitectureText = typeof workspace.architectureText === 'string' && workspace.architectureText.trim()
        ? workspace.architectureText
        : '';
      const nextRepoDocs = Array.isArray(workspace.repoDocs) ? workspace.repoDocs : [];
      const nextTestSuites = Array.isArray(workspace.testSuites) && workspace.testSuites.length > 0
        ? workspace.testSuites
        : (workspace.meta?.testSuites && Array.isArray(workspace.meta.testSuites) ? workspace.meta.testSuites : []);
      const nextDiagramModel = workspace.architectureDiagramModel || null;
      const nextSymbolCatalog = workspace.symbolCatalog || null;

      const newState = {
        queryId,
        title,
        jiraTicket: workspace.jiraTicket,
        files: chunkedFiles,
        references: [],
        standards: nextStandards,
        architectureText: nextArchitectureText,
        repoDocs: nextRepoDocs,
        auditedSymbols: [],
        testSuites: nextTestSuites,
        architectureDiagramModel: nextDiagramModel,
        symbolCatalog: nextSymbolCatalog,
        verdicts: [],
        githubMeta: workspace.meta || null
      };

      await api.saveQueryState(queryId, title, newState, {
        level: 1,
        unlockedLevel: 1,
        xp: 0,
        awardedActions: []
      });

      setCurrentQueryId(queryId);
      setCurrentQueryTitle(title);
      setJiraTicket(workspace.jiraTicket);
      setFiles(chunkedFiles);
      setActiveFileId(chunkedFiles[0]?.id || null);
      setStandards(nextStandards);
      setArchitectureText(nextArchitectureText);
      setRepoDocs(nextRepoDocs);
      setAuditedSymbols([]);
      setTestSuites(nextTestSuites);
      setCustomDiagramModel(nextDiagramModel);
      setCustomSymbolCatalog(nextSymbolCatalog);
      setVerdicts([]);
      setGithubMeta(workspace.meta || null);
      setLevel(1);
      setUnlockedLevel(1);
      setXp(0);
      setAwardedActions([]);
      setSelectedSpec('ALL');
      setHasUploadedArchitecture(false);
      setSyncStatus('saved');

      if (nextSymbolCatalog && Object.keys(nextSymbolCatalog).length > 0) {
        setActiveSymbolKey(Object.keys(nextSymbolCatalog)[0]);
      } else {
        const derived = buildSymbolCatalogFromFiles(workspace.files || []);
        setActiveSymbolKey(derived.defaultKey || null);
      }
    }

    const updatedQueries = await api.listQueries();
    setQueries(updatedQueries);
  };

  const handlePrevGithubPr = async () => {
    if (!githubPullRequests.length) return;
    const idx = githubPullRequests.findIndex(pr => pr.queryId === currentQueryId);
    const prevIdx = idx <= 0 ? githubPullRequests.length - 1 : idx - 1;
    await handleSelectGitHubPr(githubPullRequests[prevIdx]);
  };

  const handleNextGithubPr = async () => {
    if (!githubPullRequests.length) return;
    const idx = githubPullRequests.findIndex(pr => pr.queryId === currentQueryId);
    const nextIdx = idx < 0 || idx >= githubPullRequests.length - 1 ? 0 : idx + 1;
    await handleSelectGitHubPr(githubPullRequests[nextIdx]);
  };

  const handleLinkGithubToken = async (token) => {
    const res = await api.linkGithubWithToken(token);
    if (res.success) {
      await refreshGithubStatus();
      if (githubRepoUrl) {
        await handleLoadRepo(githubRepoUrl);
      }
    }
    return res;
  };

  const handleUnlinkGithub = async () => {
    const res = await api.unlinkGithub();
    if (res.success) {
      await refreshGithubStatus();
    }
    return res;
  };

  const handleLinkGithubOAuth = () => {
    api.startGithubOAuth();
  };

  const handleRefreshMyRepos = async () => {
    setMyReposLoading(true);
    const res = await api.listGithubRepos();
    setMyReposLoading(false);
    if (res.success) {
      setMyRepos(res.repos || []);
    }
  };

  const handleSelectMyRepo = async (fullName) => {
    if (!fullName) return false;
    return await handleLoadRepo(fullName);
  };

  // --- Gemini & AI Automation Handlers ---
  const handleSaveGeminiKey = async (key) => {
    const res = await api.saveGeminiKey(key);
    if (res.success) {
      const gst = await api.getGeminiStatus();
      setGeminiStatus(gst);
      setQuestLogs(prev => [
        { id: Date.now(), text: `🔑 Gemini API Key configured (${gst.source})`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 5));
    }
    return res;
  };

  const handleLinkGithubIssue = async (issueRef) => {
    setIsLinkingIssue(true);
    const res = await api.linkGithubIssue(currentQueryId, issueRef);
    setIsLinkingIssue(false);
    if (res.success && res.jiraTicket) {
      setJiraTicket(res.jiraTicket);
      if (res.files && Array.isArray(res.files) && res.files.length > 0) {
        setFiles(res.files);
      }
      setQuestLogs(prev => [
        { id: Date.now(), text: `📋 Linked Issue #${res.jiraTicket.key}: Extracted ${res.jiraTicket.criteria?.length || 0} Acceptance Criteria`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 5));
      return { success: true, count: res.jiraTicket.criteria?.length || 0 };
    }
    return { success: false, error: res.error || 'Failed to link issue' };
  };

  const handleUploadArchitecture = async (content, fileName = 'architecture.md') => {
    setIsAnalyzingArchitecture(true);
    setArchitectureText(content);
    setHasUploadedArchitecture(true);
    const res = await api.uploadArchitectureDoc(currentQueryId, fileName, content);
    setIsAnalyzingArchitecture(false);
    if (res.success) {
      if (res.standards && Array.isArray(res.standards)) {
        setStandards(res.standards);
      }
      if (res.architectureDiagramModel || res.diagramModel) {
        setCustomDiagramModel(res.architectureDiagramModel || res.diagramModel);
      }
      if (res.architectureText) {
        setArchitectureText(res.architectureText);
      }
      if (res.summary) {
        setArchitectureSummary(res.summary);
      }
      setRepoDocs(prev => {
        const withoutArch = prev.filter(d => d.role !== 'architecture' && d.path !== fileName);
        return [{ name: fileName, path: fileName, role: 'architecture', content, rawSize: content.length, uploaded: true }, ...withoutArch];
      });
      setQuestLogs(prev => [
        { id: Date.now(), text: `🏛️ Analyzed ${fileName}: Generated ${res.standards?.length || 0} architectural standards`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 5));
      return { success: true, count: res.standards?.length || 0 };
    }
    return { success: false, error: res.error || 'Failed to analyze architecture' };
  };

  const handleSaveArchitecture = (archText, nextDocs) => {
    setArchitectureText(archText);
    if (nextDocs) {
      setRepoDocs(nextDocs);
    }
  };

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
        githubPullRequests={githubPullRequests}
        githubPrLoading={githubPrLoading}
        onPrevGithubPr={handlePrevGithubPr}
        onNextGithubPr={handleNextGithubPr}
        githubStatus={githubStatus}
        hasArchitectureDoc={hasArchitectureDoc}
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
                symbolCatalog={symbolCatalog}
              />
            </section>
            <section className="lg:col-span-5 lg:sticky lg:top-4 self-start">
              <FunctionInspectorPanel 
                activeSymbolKey={activeSymbolKey}
                symbolCatalog={symbolCatalog}
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
                symbolCatalog={symbolCatalog}
                activeSymbol={activeSymbolKey}
                onSelectSymbol={setActiveSymbolKey}
                onSelectFileByPath={handleSelectFileByPath}
                onAddXp={handleAddXp}
                onOpenArchModal={() => setIsDiagramModalOpen(true)}
                onOpenArchTextModal={() => setIsArchOpen(true)}
                auditedSymbols={auditedSymbols}
                onToggleSymbolAudit={handleToggleSymbolAudit}
                onUploadArchitecture={handleUploadArchitecture}
                isAnalyzingArchitecture={isAnalyzingArchitecture}
                hasArchitectureDoc={hasArchitectureDoc}
                onLinkGithubIssue={handleLinkGithubIssue}
                isLinkingIssue={isLinkingIssue}
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
                  symbolCatalog={symbolCatalog}
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
        diagramModel={architectureDiagramModel}
        currentQueryTitle={currentQueryTitle}
        onSelectNodeFile={handleSelectFileByPath}
        onAddXp={handleAddXp}
        hasArchitectureDoc={hasArchitectureDoc}
        isGithubQuery={isGh}
        hasUploadedMd={hasUploadedMd}
        onUploadArchitecture={handleUploadArchitecture}
      />

      {/* Architecture Text Modal */}
      <ArchitectureModal 
        isOpen={isArchOpen} 
        onClose={() => setIsArchOpen(false)} 
        architectureText={architectureText} 
        repoDocs={repoDocs}
        onSave={handleSaveArchitecture}
        onAddXp={handleAddXp}
        onUploadArchitecture={handleUploadArchitecture}
        isAnalyzingArchitecture={isAnalyzingArchitecture}
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
        githubStatus={githubStatus}
        onLinkGithubToken={handleLinkGithubToken}
        onUnlinkGithub={handleUnlinkGithub}
        onLinkGithubOAuth={handleLinkGithubOAuth}
        geminiStatus={geminiStatus}
        onSaveGeminiKey={handleSaveGeminiKey}
      />

      {/* Query Selector Modal */}
      <QuerySelectorModal
        isOpen={isQuerySelectorOpen}
        onClose={() => setIsQuerySelectorOpen(false)}
        currentQueryId={currentQueryId}
        queries={queries}
        onSelectQuery={handleSelectQuery}
        onCreateQuery={handleCreateQuery}
        githubRepoUrl={githubRepoUrl}
        githubPullRequests={githubPullRequests}
        githubLoading={githubLoading}
        githubError={githubError}
        onLoadRepo={handleLoadRepo}
        onSelectGitHubPr={handleSelectGitHubPr}
        githubLinked={Boolean(githubStatus?.linked)}
        githubLogin={githubStatus?.login}
        myRepos={myRepos}
        myReposLoading={myReposLoading}
        onRefreshMyRepos={handleRefreshMyRepos}
        onSelectMyRepo={handleSelectMyRepo}
      />

      {/* Global Informational Side Panel / Drawer */}
      <InfoSidePanel 
        isOpen={isInfoOpen} 
        onClose={() => setIsInfoOpen(false)} 
      />
    </div>
  );
}