import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  FileCode, 
  Check, 
  Play, 
  ShieldCheck, 
  Award, 
  ArrowRight, 
  Sparkles,
  Columns,
  Maximize2,
  ListChecks,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';

/**
 * Normalizes test suites from either flat test cases or nested suite arrays
 * into guaranteed rich test case objects with safe fallbacks.
 */
function normalizeTestItems(raw, files = []) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const items = [];

  list.forEach((item, suiteIdx) => {
    if (!item) return;

    // Case A: Nested suite format { id, title/suiteName, file, tests: [ ... ] }
    if (Array.isArray(item.tests) && item.tests.length > 0) {
      const suiteName = item.suiteName || item.title || `Suite ${suiteIdx + 1}`;
      const suiteFile = item.file || (files[0] ? `tests/${files[0].path.split('/').pop().replace(/\.[^.]+$/, '')}.test.js` : 'tests/suite.test.js');
      
      item.tests.forEach((t, tIdx) => {
        const testId = t.id || `test-${suiteIdx + 1}-${tIdx + 1}`;
        const targetFile = t.targetFile || files[0]?.path || 'src/index.js';
        const targetSymbol = t.targetSymbol || t.symbol || 'handler';
        items.push({
          id: testId,
          suiteName,
          testName: t.testName || t.name || `should verify ${targetSymbol} flow`,
          file: t.file || suiteFile,
          targetSymbol,
          targetFile,
          targetLines: t.targetLines || '1-40',
          status: t.status === 'fail' || t.status === 'warning' ? 'warning' : 'pass',
          executionMs: t.executionMs || (typeof t.duration === 'string' ? parseInt(t.duration, 10) : 14) || 14,
          assertionsCount: t.assertionsCount || (t.assertions?.length) || 2,
          assertions: Array.isArray(t.assertions) && t.assertions.length > 0 ? t.assertions : [
            { text: `expect(${targetSymbol}).toBeDefined()`, status: 'pass', label: 'Export Verification' },
            { text: 'expect(result).toBeDefined()', status: 'pass', label: 'Return State' }
          ],
          code: t.code || `it('${t.testName || t.name || 'should pass'}', async () => {\n  const res = await ${targetSymbol}();\n  expect(res).toBeDefined();\n});`,
          testedFunctionCode: t.testedFunctionCode || `// Implementation in ${targetFile}\nexport async function ${targetSymbol}() {\n  return { success: true };\n}`,
          notes: t.notes || `Verified against ${targetFile}`
        });
      });
      return;
    }

    // Case B: Flat test case format
    const testId = item.id || `test-${suiteIdx + 1}`;
    const targetFile = item.targetFile || files[0]?.path || 'src/index.js';
    const targetSymbol = item.targetSymbol || item.symbol || 'handler';
    items.push({
      id: testId,
      suiteName: item.suiteName || item.title || 'Verification Suite',
      testName: item.testName || item.name || `should verify ${targetSymbol}`,
      file: item.file || 'tests/index.test.js',
      targetSymbol,
      targetFile,
      targetLines: item.targetLines || '1-40',
      status: item.status === 'fail' || item.status === 'warning' ? 'warning' : 'pass',
      executionMs: item.executionMs || 14,
      assertionsCount: item.assertionsCount || (item.assertions?.length) || 2,
      assertions: Array.isArray(item.assertions) && item.assertions.length > 0 ? item.assertions : [
        { text: `expect(${targetSymbol}).toBeDefined()`, status: 'pass', label: 'Export Verification' },
        { text: 'expect(result).toBeDefined()', status: 'pass', label: 'Return State' }
      ],
      code: item.code || `it('${item.testName || item.name || 'should pass'}', async () => {\n  expect(true).toBe(true);\n});`,
      testedFunctionCode: item.testedFunctionCode || `// Implementation in ${targetFile}\nexport function ${targetSymbol}() {\n  return true;\n}`,
      notes: item.notes || 'Verified test case'
    });
  });

  return items;
}

export default function TestReviewWorkspace({
  testSuites,
  files = [],
  onUpdateFileStatus,
  onOpenVerdict,
  isVerdictSubmitted,
  onAddXp,
  onTriggerAiPopulate,
  isAiPopulating = false
}) {
  const normalizedSuites = useMemo(() => {
    return normalizeTestItems(testSuites, files);
  }, [testSuites, files]);

  const [activeTestId, setActiveTestId] = useState(() => normalizedSuites[0]?.id || "");
  const [testVerdicts, setTestVerdicts] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pass' | 'warning'
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'testOnly' | 'targetOnly'

  useEffect(() => {
    if (!normalizedSuites.length) return;
    if (!activeTestId || !normalizedSuites.some(t => t.id === activeTestId)) {
      setActiveTestId(normalizedSuites[0].id);
    }
  }, [normalizedSuites, activeTestId]);

  const activeTest = normalizedSuites.find(t => t.id === activeTestId) || normalizedSuites[0] || null;

  const handleTestStatus = (testId, verdict) => {
    setTestVerdicts(prev => ({
      ...prev,
      [testId]: verdict
    }));
    onAddXp && onAddXp(20, `Verified test case: ${testId}`, `verify-test-${testId}`);
  };

  const passedCount = normalizedSuites.filter(t => t.status === 'pass').length;
  const warningCount = normalizedSuites.filter(t => t.status === 'warning').length;

  const filteredSuites = normalizedSuites.filter(t => {
    if (filterMode === 'pass') return t.status === 'pass';
    if (filterMode === 'warning') return t.status === 'warning';
    return true;
  });

  return (
    <div className="col-span-12 space-y-6">
      {/* Empty State when no test suites exist */}
      {normalizedSuites.length === 0 ? (
        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4F8F5] border border-[#4F6D56]/20 flex items-center justify-center text-[#4F6D56] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#242220]">Level 4 Unit Test Verification Matrix</h2>
                <p className="text-xs text-[#6B635A] mt-0.5">
                  No automated test suites have been populated for this PR yet. You can auto-generate realistic test cases from PR code diffs using Gemini AI, or proceed directly to file approvals below.
                </p>
              </div>
            </div>
            {onTriggerAiPopulate && (
              <button
                onClick={onTriggerAiPopulate}
                disabled={isAiPopulating}
                className="px-4 py-2 bg-[#242220] hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isAiPopulating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D08A29]" /> : <Sparkles className="w-3.5 h-3.5 text-[#D08A29]" />}
                <span>{isAiPopulating ? "Generating Test Suites..." : "✨ Generate Tests with AI"}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Top Test Suite Matrix - Roomy and Uncluttered */}
          <div className="bg-white border border-[#E6E0D5] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-[#F1ECE4]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#4F6D56] bg-[#F4F8F5] px-2.5 py-0.5 rounded-full border border-[#4F6D56]/20 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Level 4 Test Matrix
                  </span>
                  <span className="text-xs text-[#6B635A] font-medium">
                    ({normalizedSuites.length} Test Cases Total)
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#242220] mt-1">
                  Unit Test Verification & Coverage Matrix
                </h2>
                <p className="text-xs text-[#6B635A] mt-0.5">
                  Select a test case to cross-examine test assertions side-by-side with production logic.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-[#242220] text-white shadow-2xs'
                      : 'bg-[#F9F6F0] text-[#6B635A] hover:bg-[#E6E0D5]'
                  }`}
                >
                  All Tests ({normalizedSuites.length})
                </button>
                <button
                  onClick={() => setFilterMode('pass')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterMode === 'pass'
                      ? 'bg-[#4F6D56] text-white shadow-2xs'
                      : 'bg-[#F4F8F5] text-[#4F6D56] hover:bg-[#E2EDE5]'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Passing ({passedCount})
                </button>
                <button
                  onClick={() => setFilterMode('warning')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterMode === 'warning'
                      ? 'bg-[#C35832] text-white shadow-2xs'
                      : 'bg-[#FBEFEF] text-[#C35832] hover:bg-[#F8DFDF]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Gaps Flagged ({warningCount})
                </button>
              </div>
            </div>

            {/* Spacious Test Cards Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredSuites.map((test) => {
                const isSelected = activeTest?.id === test.id;
                const isVerified = testVerdicts[test.id] === 'approved';
                const isFlagged = testVerdicts[test.id] === 'flagged';

                return (
                  <button
                    key={test.id}
                    onClick={() => setActiveTestId(test.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between space-y-2.5 ${
                      isSelected 
                        ? 'bg-[#FFFDF9] border-[#C35832] ring-2 ring-[#C35832]/30 shadow-md'
                        : 'bg-[#F9F6F0] border-[#E6E0D5] hover:bg-white hover:border-[#C35832]/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          test.status === 'pass'
                            ? 'bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/20'
                            : 'bg-[#FBEFEF] text-[#C35832] border-[#C35832]/20'
                        }`}>
                          {test.status === 'pass' ? `✓ Pass (${test.executionMs}ms)` : '⚠️ Edge Case Gap'}
                        </span>

                        {isVerified && (
                          <span className="text-[10px] font-bold text-[#4F6D56] bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {isFlagged && (
                          <span className="text-[10px] font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Flagged
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-xs text-[#242220] leading-snug">
                        {test.testName}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E6E0D5]/70 flex items-center justify-between text-[11px] text-[#6B635A]">
                      <span className="font-mono text-[#C35832] font-semibold truncate max-w-[130px]">
                        {test.targetSymbol}()
                      </span>
                      <span>{test.assertionsCount} Assertions</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Review Workspace Header & View Mode Switcher */}
          {activeTest && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B635A]">
                    Active Suite:
                  </span>
                  <span className="text-sm font-extrabold text-[#242220]">
                    {activeTest.suiteName}
                  </span>
                </div>

                {/* Layout Switcher (Split vs Full Width Focus) */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E6E0D5] shadow-2xs">
                  <button
                    onClick={() => setLayoutMode('split')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'split'
                        ? 'bg-[#C35832] text-white'
                        : 'text-[#6B635A] hover:text-[#242220]'
                    }`}
                    title="Side-by-side comparison"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Split (50/50)</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode('testOnly')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'testOnly'
                        ? 'bg-[#C35832] text-white'
                        : 'text-[#6B635A] hover:text-[#242220]'
                    }`}
                    title="Expand Test Code to full width"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Focus Test Code</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode('targetOnly')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'targetOnly'
                        ? 'bg-[#C35832] text-white'
                        : 'text-[#6B635A] hover:text-[#242220]'
                    }`}
                    title="Expand Production Logic to full width"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Focus Production Logic</span>
                  </button>
                </div>
              </div>

              {/* Itemized Key Assertions Inspector Strip */}
              <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#F1ECE4]">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-[#C35832]" />
                    <span className="text-xs font-bold text-[#242220] uppercase tracking-wider">
                      Key Assertions Inspector
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6B635A]">
                    Verifies expected return states and mocks
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {(activeTest.assertions || []).map((asrt, idx) => (
                    <div 
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                        asrt.status === 'pass'
                          ? 'bg-[#F4F8F5] border-[#4F6D56]/30 text-[#242220]'
                          : 'bg-[#FBEFEF] border-[#C35832]/30 text-[#C35832]'
                      }`}
                    >
                      {asrt.status === 'pass' ? (
                        <CheckCircle className="w-4 h-4 text-[#4F6D56] mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#C35832] mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B635A]">
                          {asrt.label}
                        </div>
                        <div className="truncate font-semibold mt-0.5" title={asrt.text}>
                          {asrt.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!activeTest.assertions || activeTest.assertions.length === 0) && (
                    <div className="text-xs text-[#C35832] italic col-span-3">
                      No formal assertions declared in this test case. Flagged as test gap.
                    </div>
                  )}
                </div>
              </div>

              {/* Main Spacious Code Workspace Panes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Test Case Implementation */}
                {(layoutMode === 'split' || layoutMode === 'testOnly') && (
                  <div className={`${layoutMode === 'testOnly' ? 'lg:col-span-12' : 'lg:col-span-6'} bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs flex flex-col`}>
                    {/* Pane Header */}
                    <div className="bg-[#FFFDF9] border-b border-[#E6E0D5] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase font-extrabold text-[#6B635A] tracking-wider flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-[#C35832]" />
                          <span>Unit Test Code</span>
                        </div>
                        <div className="text-xs font-bold text-[#242220] font-mono mt-0.5 truncate">
                          {activeTest.file}
                        </div>
                      </div>

                      {/* Reviewer Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestStatus(activeTest.id, 'approved')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            testVerdicts[activeTest.id] === 'approved'
                              ? 'bg-[#4F6D56] text-white shadow-xs'
                              : 'bg-[#F4F8F5] text-[#4F6D56] hover:bg-[#4F6D56] hover:text-white border border-[#4F6D56]/30'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Test
                        </button>
                        <button
                          onClick={() => handleTestStatus(activeTest.id, 'flagged')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            testVerdicts[activeTest.id] === 'flagged'
                              ? 'bg-[#C35832] text-white shadow-xs'
                              : 'bg-[#FBEFEF] text-[#C35832] hover:bg-[#C35832] hover:text-white border border-[#C35832]/30'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Flag Gap
                        </button>
                      </div>
                    </div>

                    {/* Pane Content */}
                    <div className="p-5 flex-1 flex flex-col space-y-3.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#242220]">
                        <span>{activeTest.suiteName} &gt; {activeTest.testName}</span>
                        <span className="text-[11px] text-[#6B635A] font-mono">{activeTest.executionMs}ms</span>
                      </div>

                      {/* Spacious, Roomy Code Container */}
                      <pre className="bg-[#1E1E1E] text-[#D4D4D4] p-5 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto h-[480px] shadow-inner select-text">
                        <code>{typeof activeTest.code === 'string' ? activeTest.code : JSON.stringify(activeTest.code || '', null, 2)}</code>
                      </pre>

                      {/* Insight Callout */}
                      {activeTest.notes && (
                        <div className="text-[11px] text-[#6B635A] font-medium pt-1">
                          💡 <span className="text-[#242220] font-semibold">Note:</span> {typeof activeTest.notes === 'string' ? activeTest.notes : JSON.stringify(activeTest.notes)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Right: Corresponding Function Under Test */}
                {(layoutMode === 'split' || layoutMode === 'targetOnly') && (
                  <div className={`${layoutMode === 'targetOnly' ? 'lg:col-span-12' : 'lg:col-span-6'} bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs flex flex-col`}>
                    {/* Pane Header */}
                    <div className="bg-[#F4F8F5] border-b border-[#4F6D56]/20 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase font-extrabold text-[#4F6D56] tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#4F6D56]" />
                          <span>Production Implementation Under Test</span>
                        </div>
                        <div className="text-xs font-bold text-[#242220] font-mono mt-0.5 truncate">
                          {activeTest.targetFile} (Lines {activeTest.targetLines})
                        </div>
                      </div>

                      <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-lg border border-[#4F6D56]/30 font-bold text-[#4F6D56] shadow-2xs">
                        {activeTest.targetSymbol}()
                      </span>
                    </div>

                    {/* Pane Content */}
                    <div className="p-5 flex-1 flex flex-col space-y-3.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#242220]">
                        <span>Target Logic Executed by Test:</span>
                        <span className="text-[11px] text-[#6B635A]">Verify return contracts</span>
                      </div>

                      {/* Spacious, Roomy Target Code Container */}
                      <pre className="bg-[#FFFDF9] border border-[#E6E0D5] text-[#242220] p-5 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto h-[480px] shadow-inner select-text">
                        <code>{typeof activeTest.testedFunctionCode === 'string' ? activeTest.testedFunctionCode : JSON.stringify(activeTest.testedFunctionCode || '', null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Stage 4 Final Code Files Sign-Off Card */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#F1ECE4]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#C35832] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <span>📋</span> Final Stage Code Files Approval
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                files.every(f => f.status !== 'pending')
                  ? 'bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/30'
                  : 'bg-[#FFFDF9] text-[#D08A29] border-[#D08A29]/30'
              }`}>
                {files.filter(f => f.status !== 'pending').length}/{files.length} Code Files Reviewed
              </span>
            </div>
            <p className="text-xs text-[#6B635A] mt-1">
              Code approvals from previous levels persist here. Review and approve all remaining files before final sign-off:
            </p>
          </div>

          {files.some(f => f.status === 'pending') && (
            <button
              onClick={() => {
                files.forEach(f => {
                  if (f.status === 'pending') {
                    onUpdateFileStatus && onUpdateFileStatus(f.id, 'approved');
                  }
                });
              }}
              className="px-3 py-1.5 bg-[#4F6D56] hover:bg-[#3D5442] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve All Remaining Files</span>
            </button>
          )}
        </div>

        {/* File List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => {
            const isApproved = file.status === 'approved';
            const isFlagged = file.status === 'flagged';
            const isPending = file.status === 'pending';

            return (
              <div 
                key={file.id}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                  isApproved 
                    ? 'bg-[#F4F8F5]/60 border-[#4F6D56]/30' 
                    : isFlagged
                      ? 'bg-[#FBEFEF]/60 border-[#C35832]/30'
                      : 'bg-[#FFFDF9] border-[#E6E0D5]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-[#242220] truncate">
                      {file.path.split('/').pop()}
                    </span>
                    <span className="text-[9px] font-mono bg-[#F1ECE4] text-[#6B635A] px-1.5 py-0.5 rounded font-semibold">
                      {file.tier.split(':')[0]}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6B635A] font-mono truncate mt-0.5">
                    {file.path}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-current/10">
                  <span className={`text-[10px] font-bold capitalize ${
                    isApproved ? 'text-[#4F6D56]' : isFlagged ? 'text-[#C35832]' : 'text-[#6B635A]'
                  }`}>
                    {isApproved ? '✓ Approved' : isFlagged ? '⚠️ Flagged' : '○ Pending Review'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateFileStatus && onUpdateFileStatus(file.id, 'approved')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                        isApproved
                          ? 'bg-[#4F6D56] text-white'
                          : 'bg-[#F4F8F5] text-[#4F6D56] hover:bg-[#4F6D56] hover:text-white border border-[#4F6D56]/30'
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onUpdateFileStatus && onUpdateFileStatus(file.id, 'flagged')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                        isFlagged
                          ? 'bg-[#C35832] text-white'
                          : 'bg-[#FBEFEF] text-[#C35832] hover:bg-[#C35832] hover:text-white border border-[#C35832]/30'
                      }`}
                    >
                      Flag
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roomy Bottom Final Review Milestone Card */}
      <div className="bg-gradient-to-r from-white to-[#FFFDF9] border-2 border-[#C35832] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-[#D08A29] text-white p-1 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#242220]">
              Review Verdict & Sign-Off
            </h3>
          </div>
          <p className="text-xs text-[#6B635A]">
            Submit your full or partial review verdict with optional remarks and handoff notes for your team.
          </p>
        </div>

        <button
          onClick={onOpenVerdict}
          className="px-5 py-2.5 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer group"
        >
          <span>{isVerdictSubmitted ? "View Review Report" : "Submit Review Verdict"}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
