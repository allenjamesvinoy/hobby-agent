import React, { useState } from 'react';
import { User, Shield, Key, LogIn, UserPlus, Check, X, Sparkles } from 'lucide-react';
import { PRESET_USERS } from '../services/apiClient';

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onSelectPersona,
  onCustomLogin,
  onCustomRegister,
  onLogout
}) {
  const [tab, setTab] = useState('personas'); // 'personas' | 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (tab === 'login') {
      const res = await onCustomLogin(username, password);
      if (res?.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } else if (tab === 'register') {
      const res = await onCustomRegister({ username, password, name });
      if (res?.error) {
        setError(res.error);
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#E6E0D5] max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#F9F6F0] border-b border-[#E6E0D5] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C35832] text-white rounded-xl shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#242220]">Reviewer Identity & Accounts</h3>
              <p className="text-xs text-[#6B635A]">Distributed multi-user code review</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#6B635A] hover:text-[#242220] p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active User Banner */}
        <div className="px-6 pt-5">
          <div className="bg-[#FFFDF9] border border-[#D08A29]/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentUser?.avatar || '👨‍💻'}</span>
              <div>
                <div className="text-xs font-bold text-[#242220]">{currentUser?.name}</div>
                <div className="text-[11px] text-[#6B635A] font-medium font-mono">@{currentUser?.username || currentUser?.id}</div>
              </div>
            </div>
            <span className="text-[10px] bg-[#4F6D56]/15 text-[#4F6D56] border border-[#4F6D56]/30 px-2 py-0.5 rounded-full font-bold">
              Active Now
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E6E0D5] px-6 mt-4">
          <button
            onClick={() => setTab('personas')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'personas'
                ? 'border-[#C35832] text-[#C35832]'
                : 'border-transparent text-[#6B635A] hover:text-[#242220]'
            }`}
          >
            ⚡ 1-Click Persona Switch
          </button>
          <button
            onClick={() => setTab('login')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'login'
                ? 'border-[#C35832] text-[#C35832]'
                : 'border-transparent text-[#6B635A] hover:text-[#242220]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('register')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'register'
                ? 'border-[#C35832] text-[#C35832]'
                : 'border-transparent text-[#6B635A] hover:text-[#242220]'
            }`}
          >
            Register
          </button>
        </div>

        {/* Tab 1: 1-Click Persona Switch */}
        {tab === 'personas' && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-[#6B635A] mb-3">
              Switch reviewers instantly to test peer review comments, flag handoffs, and multi-user verdicts without typing passwords:
            </p>
            {PRESET_USERS.map((p) => {
              const isSelected = currentUser?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPersona(p.id);
                    onClose();
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F4F8F5] border-[#4F6D56] shadow-xs ring-1 ring-[#4F6D56]'
                      : 'bg-white border-[#E6E0D5] hover:bg-[#F9F6F0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <div className="text-xs font-bold text-[#242220] flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6B635A] font-mono">@{p.username}</div>
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className="w-5 h-5 text-[#4F6D56]" />
                  ) : (
                    <span className="text-[11px] font-bold text-[#C35832]">Switch →</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab 2 & 3: Custom Login / Register Form */}
        {(tab === 'login' || tab === 'register') && (
          <form onSubmit={handleCustomSubmit} className="p-6 space-y-3.5">
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            {tab === 'register' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6B635A] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full text-xs p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B635A] mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full text-xs p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B635A] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full text-xs p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 mt-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {tab === 'login' ? 'Sign In' : 'Create Reviewer Account'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="bg-[#F9F6F0] border-t border-[#E6E0D5] p-4 flex items-center justify-between">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="text-xs font-medium text-[#6B635A] hover:text-[#C35832] transition-colors cursor-pointer"
          >
            Reset Session to Default
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-white border border-[#E6E0D5] text-[#242220] hover:bg-[#FFFDF9] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
