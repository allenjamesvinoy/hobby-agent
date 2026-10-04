import React, { useState } from 'react';
import { 
  X, 
  ExternalLink
} from 'lucide-react';

export default function ArchitectureDiagramModal({
  isOpen,
  onClose,
  onSelectNodeFile,
  baselineMermaid,
  proposedMermaid,
  diffMermaid
}) {
  const [activeTab, setActiveTab] = useState('diff'); // 'diff' | 'proposed' | 'baseline'
  const [selectedNode, setSelectedNode] = useState('SM');

  if (!isOpen) return null;

  const nodeDetails = {
    SM: {
      name: "SessionManager.js",
      badge: "+ NEW CORE ENGINE",
      badgeColor: "bg-[#EBF7EE] text-[#2D6A4F] border-[#2D6A4F]/30",
      summary: "Handles AES token storage and calls /api/auth/rotate for refresh tokens.",
      path: "src/services/SessionManager.js"
    },
    API: {
      name: "ApiClient.js",
      badge: "~ MODIFIED 401 INTERCEPTOR",
      badgeColor: "bg-[#FFF8E7] text-[#B45309] border-[#B45309]/30",
      summary: "Catches 401s, sets idempotent _retry guard, and triggers rotateSessionToken().",
      path: "src/api/ApiClient.js"
    },
    SC: {
      name: "SessionContext.jsx",
      badge: "~ MODIFIED BACKGROUND TIMER",
      badgeColor: "bg-[#FFF8E7] text-[#B45309] border-[#B45309]/30",
      summary: "Proactive 14-min interval rotation timer cleaned up on unmount.",
      path: "src/context/SessionContext.jsx"
    },
    PR: {
      name: "ProtectedRoute.jsx",
      badge: "= UNCHANGED ROUTE GUARD",
      badgeColor: "bg-[#F3F4F6] text-[#4B5563] border-[#4B5563]/30",
      summary: "Reads user state from SessionContext to guard routes.",
      path: "src/components/ProtectedRoute.jsx"
    },
    AUTH: {
      name: "Auth Server (/api/auth/rotate)",
      badge: "= EXTERNAL API",
      badgeColor: "bg-[#F3F4F6] text-[#4B5563] border-[#4B5563]/30",
      summary: "Exchanges valid refresh token for fresh JWT access token.",
      path: null
    },
    REST: {
      name: "Protected REST APIs",
      badge: "= EXTERNAL TARGET",
      badgeColor: "bg-[#F3F4F6] text-[#4B5563] border-[#4B5563]/30",
      summary: "Receives replayed requests with Bearer authorization header.",
      path: null
    },
    KILL: {
      name: "Hard /login Kill (Old)",
      badge: "- DEPRECATED FLOW",
      badgeColor: "bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]/30",
      summary: "Old destructive flow where any 401 instantly logged the user out.",
      path: null
    }
  };

  const activeNodeInfo = nodeDetails[selectedNode] || nodeDetails.SM;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 sm:p-6"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FDFCFB] border border-[#E6E0D5] rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E6E0D5] bg-white">
          <div className="flex items-center gap-3">
            <span className="text-xl">📐</span>
            <div>
              <h2 className="text-base font-bold text-[#242220] tracking-tight">
                Architecture Diagram
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#F9F6F0] p-1 rounded-xl border border-[#E6E0D5]">
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'diff'
                    ? 'bg-[#C35832] text-white shadow-2xs'
                    : 'text-[#6B635A] hover:text-[#242220]'
                }`}
              >
                Diff View
              </button>
              <button
                onClick={() => setActiveTab('proposed')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'proposed'
                    ? 'bg-[#C35832] text-white shadow-2xs'
                    : 'text-[#6B635A] hover:text-[#242220]'
                }`}
              >
                Proposed Flow
              </button>
              <button
                onClick={() => setActiveTab('baseline')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'baseline'
                    ? 'bg-[#C35832] text-white shadow-2xs'
                    : 'text-[#6B635A] hover:text-[#242220]'
                }`}
              >
                Baseline Flow
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 text-[#6B635A] hover:text-[#242220] rounded-lg hover:bg-[#F9F6F0] transition-colors ml-2 cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagram Canvas Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FDFCFB] flex flex-col justify-center items-center relative select-none">
          <div className="w-full max-w-4xl bg-white border border-[#E6E0D5] rounded-2xl p-5 shadow-xs relative overflow-hidden">
            {/* Subtle Dot Grid Background */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `radial-gradient(#D5CEC5 1.2px, transparent 1.2px)`,
                backgroundSize: '24px 24px'
              }}
            />

            {/* Legend Strip */}
            <div className="relative z-10 flex items-center justify-between text-xs text-[#6B635A] pb-3 border-b border-[#F1ECE4] mb-4">
              <div className="flex items-center gap-4 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F]"></span>
                  <span className="text-[#2D6A4F] font-semibold">+ Added</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
                  <span className="text-[#D97706] font-semibold">~ Modified</span>
                </span>
                {activeTab === 'diff' && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
                    <span className="text-[#DC2626] font-semibold">- Removed</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]"></span>
                  <span className="text-[#4B5563]">Unchanged</span>
                </span>
              </div>
            </div>

            {/* Visual Diagram (SVG Layout) */}
            <div className="relative z-10">
              <svg viewBox="0 0 820 420" className="w-full h-auto drop-shadow-xs">
                <defs>
                  <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#2D6A4F" />
                  </marker>
                  <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
                  </marker>
                  <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#6B7280" />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
                  </marker>
                </defs>

                {/* ================= CONNECTORS / ARROWS ================= */}
                {/* Auth Server <-> SessionManager */}
                {(activeTab === 'diff' || activeTab === 'proposed') && (
                  <g>
                    <path d="M 410 70 L 410 150" stroke="#2D6A4F" strokeWidth="2.5" markerEnd="url(#arrow-green)" fill="none" />
                    <rect x="345" y="98" width="130" height="22" rx="6" fill="#EBF7EE" stroke="#2D6A4F" strokeWidth="1" />
                    <text x="410" y="113" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1B4332">POST /api/auth/rotate</text>
                  </g>
                )}

                {/* SessionProvider -> SessionManager (14-min timer) */}
                {(activeTab === 'diff' || activeTab === 'proposed') && (
                  <g>
                    <path d="M 230 190 C 270 190, 270 190, 305 190" stroke="#D97706" strokeWidth="2.5" markerEnd="url(#arrow-amber)" fill="none" />
                    <rect x="235" y="162" width="70" height="20" rx="5" fill="#FFF8E7" stroke="#D97706" strokeWidth="1" />
                    <text x="270" y="176" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400E">14m timer</text>
                  </g>
                )}

                {/* ApiClient -> SessionManager (401 retry) */}
                {(activeTab === 'diff' || activeTab === 'proposed') && (
                  <g>
                    <path d="M 590 190 C 550 190, 550 190, 515 190" stroke="#D97706" strokeWidth="2.5" markerEnd="url(#arrow-amber)" fill="none" />
                    <rect x="520" y="162" width="65" height="20" rx="5" fill="#FFF8E7" stroke="#D97706" strokeWidth="1" />
                    <text x="552" y="176" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400E">401 retry</text>
                  </g>
                )}

                {/* ProtectedRoute -> SessionProvider */}
                <g>
                  <path d="M 125 315 L 125 230" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrow-gray)" fill="none" />
                </g>

                {/* ApiClient -> Protected REST APIs */}
                <g>
                  <path d="M 695 230 L 695 315" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrow-gray)" fill="none" />
                  <rect x="655" y="262" width="80" height="20" rx="5" fill="#F3F4F6" stroke="#6B7280" strokeWidth="1" />
                  <text x="695" y="276" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">Bearer JWT</text>
                </g>

                {/* Deprecated Flow: ApiClient -> Hard /login (Removed in PR) */}
                {(activeTab === 'diff' || activeTab === 'baseline') && (
                  <g>
                    <path d="M 600 230 L 490 315" stroke="#DC2626" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow-red)" fill="none" />
                    <rect x="495" y="262" width="90" height="20" rx="5" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1" />
                    <text x="540" y="276" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#991B1B">hard logout</text>
                  </g>
                )}

                {/* Baseline direct flow (if baseline view) */}
                {activeTab === 'baseline' && (
                  <g>
                    <path d="M 230 190 L 590 190" stroke="#6B7280" strokeWidth="2" strokeDasharray="4,4" markerEnd="url(#arrow-gray)" fill="none" />
                    <rect x="365" y="180" width="90" height="20" rx="5" fill="#F3F4F6" stroke="#6B7280" strokeWidth="1" />
                    <text x="410" y="194" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">static token</text>
                  </g>
                )}

                {/* ================= NODES / BOXES ================= */}

                {/* 1. Auth Server (Top Center) */}
                <g 
                  onClick={() => setSelectedNode('AUTH')}
                  className="cursor-pointer"
                >
                  <rect 
                    x="310" y="18" width="200" height="52" rx="10" 
                    fill="#FFFFFF" stroke={selectedNode === 'AUTH' ? '#C35832' : '#6B7280'} 
                    strokeWidth={selectedNode === 'AUTH' ? '3' : '2'}
                  />
                  <text x="410" y="40" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1F2937">Auth Server</text>
                  <text x="410" y="56" textAnchor="middle" fontSize="10" fill="#6B7280">/api/auth/rotate</text>
                </g>

                {/* 2. SessionManager (Center - NEW) */}
                {(activeTab === 'diff' || activeTab === 'proposed') && (
                  <g 
                    onClick={() => setSelectedNode('SM')}
                    className="cursor-pointer"
                  >
                    <rect 
                      x="310" y="150" width="200" height="76" rx="12" 
                      fill="#EBF7EE" stroke={selectedNode === 'SM' ? '#1B4332' : '#2D6A4F'} 
                      strokeWidth={selectedNode === 'SM' ? '3' : '2'}
                    />
                    <rect x="435" y="158" width="65" height="18" rx="5" fill="#2D6A4F" />
                    <text x="467" y="171" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#FFFFFF">+ NEW</text>
                    <text x="325" y="184" fontSize="14" fontWeight="800" fill="#1B4332">SessionManager</text>
                    <text x="325" y="204" fontSize="10.5" fontWeight="600" fill="#2D6A4F">AES Key Storage & Rotation</text>
                  </g>
                )}

                {/* 3. SessionProvider (Left Center - MODIFIED) */}
                <g 
                  onClick={() => setSelectedNode('SC')}
                  className="cursor-pointer"
                >
                  <rect 
                    x="20" y="150" width="210" height="76" rx="12" 
                    fill={activeTab === 'baseline' ? '#FFFFFF' : '#FFF8E7'} 
                    stroke={selectedNode === 'SC' ? '#78350F' : activeTab === 'baseline' ? '#6B7280' : '#D97706'} 
                    strokeWidth={selectedNode === 'SC' ? '3' : '2'}
                  />
                  {activeTab !== 'baseline' && (
                    <>
                      <rect x="145" y="158" width="75" height="18" rx="5" fill="#D97706" />
                      <text x="182" y="171" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#FFFFFF">MODIFIED</text>
                    </>
                  )}
                  <text x="35" y="184" fontSize="14" fontWeight="800" fill="#78350F">SessionProvider</text>
                  <text x="35" y="204" fontSize="10.5" fontWeight="600" fill="#92400E">React User Context</text>
                </g>

                {/* 4. ApiClient (Right Center - MODIFIED) */}
                <g 
                  onClick={() => setSelectedNode('API')}
                  className="cursor-pointer"
                >
                  <rect 
                    x="590" y="150" width="210" height="76" rx="12" 
                    fill={activeTab === 'baseline' ? '#FFFFFF' : '#FFF8E7'} 
                    stroke={selectedNode === 'API' ? '#78350F' : activeTab === 'baseline' ? '#6B7280' : '#D97706'} 
                    strokeWidth={selectedNode === 'API' ? '3' : '2'}
                  />
                  {activeTab !== 'baseline' && (
                    <>
                      <rect x="715" y="158" width="75" height="18" rx="5" fill="#D97706" />
                      <text x="752" y="171" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#FFFFFF">MODIFIED</text>
                    </>
                  )}
                  <text x="605" y="184" fontSize="14" fontWeight="800" fill="#78350F">ApiClient</text>
                  <text x="605" y="204" fontSize="10.5" fontWeight="600" fill="#92400E">Axios HTTP Client</text>
                </g>

                {/* 5. ProtectedRoute (Bottom Left - UNCHANGED) */}
                <g 
                  onClick={() => setSelectedNode('PR')}
                  className="cursor-pointer"
                >
                  <rect 
                    x="25" y="320" width="200" height="55" rx="10" 
                    fill="#FFFFFF" stroke={selectedNode === 'PR' ? '#C35832' : '#6B7280'} 
                    strokeWidth={selectedNode === 'PR' ? '3' : '2'}
                  />
                  <text x="125" y="344" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1F2937">ProtectedRoute.jsx</text>
                  <text x="125" y="360" textAnchor="middle" fontSize="10" fill="#6B7280">Route Guard</text>
                </g>

                {/* 6. Protected REST APIs (Bottom Right - UNCHANGED) */}
                <g 
                  onClick={() => setSelectedNode('REST')}
                  className="cursor-pointer"
                >
                  <rect 
                    x="595" y="320" width="200" height="55" rx="10" 
                    fill="#FFFFFF" stroke={selectedNode === 'REST' ? '#C35832' : '#6B7280'} 
                    strokeWidth={selectedNode === 'REST' ? '3' : '2'}
                  />
                  <text x="695" y="344" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1F2937">Protected REST APIs</text>
                  <text x="695" y="360" textAnchor="middle" fontSize="10" fill="#6B7280">Backend Endpoints</text>
                </g>

                {/* 7. Eliminated Hard /login Flow (Bottom Center - REMOVED) */}
                {(activeTab === 'diff' || activeTab === 'baseline') && (
                  <g 
                    onClick={() => setSelectedNode('KILL')}
                    className="cursor-pointer"
                  >
                    <rect 
                      x="375" y="320" width="170" height="55" rx="10" 
                      fill="#FEE2E2" stroke="#DC2626" 
                      strokeWidth="2" strokeDasharray="5,5"
                    />
                    <text x="460" y="344" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#991B1B">
                      Deprecated /login
                    </text>
                    <text x="460" y="360" textAnchor="middle" fontSize="9.5" fill="#DC2626">
                      Eviction on 401
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Minimal Selected Node Bar (No Paragraphs, Just 1-Line Info & Jump Action) */}
          <div className="w-full max-w-4xl mt-3 bg-white border border-[#E6E0D5] rounded-xl px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${activeNodeInfo.badgeColor}`}>
                {activeNodeInfo.badge}
              </span>
              <span className="text-xs font-extrabold text-[#242220]">
                {activeNodeInfo.name}
              </span>
              <span className="text-xs text-[#6B635A] hidden md:inline">
                • {activeNodeInfo.summary}
              </span>
            </div>

            {activeNodeInfo.path ? (
              <button
                onClick={() => {
                  if (onSelectNodeFile) {
                    onSelectNodeFile(activeNodeInfo.path);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-2xs self-end sm:self-center"
              >
                <span>Jump to File Diff</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-[11px] text-[#6B635A] italic">External system</span>
            )}
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="px-6 py-2.5 border-t border-[#E6E0D5] bg-white flex items-center justify-between text-xs text-[#6B635A]">
          <span>PR-101: Token Rotation & LocalStorage Fallback</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#242220] hover:bg-[#3D3A36] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
