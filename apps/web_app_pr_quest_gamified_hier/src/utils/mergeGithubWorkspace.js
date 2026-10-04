import { chunkLargeFiles } from './chunkLargeFiles.js';

// Fresh diffs always win. Carry review decisions only for unchanged file content.
export function mergeGithubWorkspace(workspace, saved) {
  const previousFiles = new Map((saved?.files || []).map(file => [file.path, file]));
  const files = chunkLargeFiles(workspace.files || [], 200).map(file => {
    const previous = previousFiles.get(file.path);
    const unchanged = previous && JSON.stringify(previous.diffChunks) === JSON.stringify(file.diffChunks);
    return {
      ...file,
      comments: previous?.comments || [],
      status: unchanged ? previous.status : 'pending',
      reviewerStatuses: unchanged ? previous.reviewerStatuses || {} : {}
    };
  });
  const uploadedDocs = (saved?.repoDocs || []).filter(doc => doc.uploaded);
  const previousMeta = saved?.meta?.githubMeta || saved?.githubMeta || saved?.meta;
  const sameRevision = Boolean(workspace.meta?.headSha && previousMeta?.headSha === workspace.meta.headSha);
  return {
    ...workspace,
    files,
    repoDocs: [...(workspace.repoDocs || []).filter(doc => !uploadedDocs.some(old => old.path === doc.path)), ...uploadedDocs],
    standards: saved?.standards || [],
    architectureText: saved?.architectureText || '',
    architectureSummary: sameRevision ? saved?.architectureSummary || '' : '',
    architectureDiagramModel: sameRevision ? saved?.architectureDiagramModel || null : null,
    verdicts: saved?.verdicts || [],
    githubMeta: workspace.meta,
    userProgress: saved?.userProgress ? {
      ...saved.userProgress,
      criteria: (workspace.jiraTicket?.criteria || []).map(criterion => ({
        ...criterion,
        completed: Boolean(sameRevision && saved.userProgress.criteria?.some(old => old.id === criterion.id && old.completed))
      })),
      auditedSymbols: sameRevision ? saved.userProgress.auditedSymbols || [] : []
    } : { level: 1, unlockedLevel: 1, xp: 0, awardedActions: [], criteria: [], auditedSymbols: [] }
  };
}
