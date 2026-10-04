/**
 * Frontend utility to break down large files / diffs into logical chunks of <= 200 lines of code.
 * Naming convention: file_name_part_1.ext, file_name_part_2.ext, etc.
 */

export const MAX_LOC_PER_BLOCK = 200;

export function formatPartPath(originalPath, partNum) {
  const parts = originalPath.split('/');
  const fileName = parts.pop() || originalPath;
  const dir = parts.length > 0 ? parts.join('/') + '/' : '';

  const lastDot = fileName.lastIndexOf('.');
  let baseName = fileName;
  let ext = '';
  if (lastDot > 0) {
    baseName = fileName.substring(0, lastDot);
    ext = fileName.substring(lastDot);
  }

  return `${dir}${baseName}_part_${partNum}${ext}`;
}

export function countDiffLines(diffChunks = []) {
  return diffChunks.reduce((acc, c) => acc + (c.lines?.length || 0), 0);
}

function splitLargeChunk(chunk, maxLines = MAX_LOC_PER_BLOCK) {
  const lines = chunk.lines || [];
  if (lines.length <= maxLines) return [chunk];

  const subChunks = [];
  let currentLines = [];
  let subIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    currentLines.push(lines[i]);

    const atCapacity = currentLines.length >= maxLines;
    const isBoundary = atCapacity || (currentLines.length >= maxLines - 20 && (
      lines[i].content?.trim() === '' ||
      lines[i].content?.trim() === '}' ||
      lines[i].content?.trim() === '};' ||
      lines[i].content?.trim().startsWith('function ') ||
      lines[i].content?.trim().startsWith('export ')
    ));

    if (isBoundary || i === lines.length - 1) {
      subChunks.push({
        header: `${chunk.header} (part ${subIndex})`,
        lines: currentLines
      });
      currentLines = [];
      subIndex++;
    }
  }

  if (currentLines.length > 0) {
    subChunks.push({
      header: `${chunk.header} (part ${subIndex})`,
      lines: currentLines
    });
  }

  return subChunks;
}

export function chunkLargeFiles(files = [], maxLines = MAX_LOC_PER_BLOCK) {
  if (!Array.isArray(files) || files.length === 0) return [];

  const result = [];

  for (const file of files) {
    // If file is already a split part, don't re-chunk
    if (file.isSplitPart) {
      result.push(file);
      continue;
    }

    const totalLines = countDiffLines(file.diffChunks || []);

    if (totalLines <= maxLines) {
      result.push(file);
      continue;
    }

    const normalizedChunks = [];
    for (const chunk of (file.diffChunks || [])) {
      if ((chunk.lines?.length || 0) > maxLines) {
        normalizedChunks.push(...splitLargeChunk(chunk, maxLines));
      } else {
        normalizedChunks.push(chunk);
      }
    }

    const partGroups = [];
    let currentGroup = [];
    let currentCount = 0;

    for (const chunk of normalizedChunks) {
      const chunkLen = chunk.lines?.length || 0;
      if (currentCount + chunkLen > maxLines && currentGroup.length > 0) {
        partGroups.push(currentGroup);
        currentGroup = [chunk];
        currentCount = chunkLen;
      } else {
        currentGroup.push(chunk);
        currentCount += chunkLen;
      }
    }

    if (currentGroup.length > 0) {
      partGroups.push(currentGroup);
    }

    const totalParts = partGroups.length;

    partGroups.forEach((groupChunks, idx) => {
      const partNum = idx + 1;
      const partPath = formatPartPath(file.path, partNum);
      const partId = `${file.id}_part_${partNum}`;
      const partLines = countDiffLines(groupChunks);

      let additions = 0;
      let deletions = 0;
      groupChunks.forEach(c => {
        (c.lines || []).forEach(l => {
          if (l.type === 'add') additions++;
          if (l.type === 'delete') deletions++;
        });
      });

      result.push({
        ...file,
        id: partId,
        path: partPath,
        originalPath: file.path,
        isSplitPart: true,
        partIndex: partNum,
        totalParts,
        partLabel: `Part ${partNum} of ${totalParts} (${partLines} LOC)`,
        diffChunks: groupChunks,
        additions,
        deletions,
        status: file.status || 'pending',
        reviewerStatuses: file.reviewerStatuses ? { ...file.reviewerStatuses } : {},
        comments: Array.isArray(file.comments) ? [...file.comments] : []
      });
    });
  }

  return result;
}
