import React, { useState } from 'react';
import { Building2, Lock, ArrowRight, ShieldCheck, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState } from '../types';

interface SiteSelectorProps {
  sites: AppState[];
  onSelect: (site: AppState, password?: string) => boolean; // returns true if success
  customBaseUrl?: string;
}

export default function SiteSelector({ sites, onSelect, customBaseUrl }: SiteSelectorProps) {
  const [selectedSite, setSelectedSite] = useState<AppState | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getPublicOrigin = () => {
    if (customBaseUrl && customBaseUrl.trim() !== '') {
      return customBaseUrl.trim().replace(/\/$/, '');
    }
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  };

  const copyToClipboard = (text: string, key: string) => {
    const handleSuccess = () => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
        copyFallback(text, handleSuccess);
      });
    } else {
      copyFallback(text, handleSuccess);
    }
  };

  const copyFallback = (text: string, callback: () => void) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      callback();
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleEntry = () => {
    if (selectedSite) {
      const success = onSelect(selectedSite, password);
      if (success) {
        setSelectedSite(null);
        setPassword('');
        setError('');
      } else {
        setError('비밀번호가 일치하지 않습니다.');
        setPassword('');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold mb-4"
          >
            <ShieldCheck className="w-4 h-4" />
            현장 관리 시스템 - 현장 선택
          </motion.div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">접속할 현장을 선택해 주세요</h1>
          <p className="text-slate-500 mt-3">각 현장별로 설정된 비밀번호를 통해 안전하게 접속할 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site, index) => {
            const hasPassword = !!site.settings.sitePassword;
            return (
              <motion.button
                key={`${site.id || site.settings.projectName || 'site'}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  if (!hasPassword) {
                    onSelect(site);
                  } else {
                    setSelectedSite(site);
                  }
                }}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 p-6 text-left transition-all hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  {hasPassword && <Lock className="w-4 h-4 text-slate-400" />}
                </div>
                
                <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {site.settings.projectName}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">{site.settings.companyName}</p>
                
                {/* 🔗 현장별 링크 주소 복사 공간 */}
                <div 
                  className="mt-4 pt-3 border-t border-slate-100 space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[10px] font-black text-slate-400 mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-slate-400" />
                    <span>현장 직접 접속 공유링크</span>
                  </div>
                  
                  {/* 조회용(GUEST) 링크 복사 버튼 */}
                  <div className="flex items-center justify-between bg-slate-50 hover:bg-slate-150 p-1.5 rounded-xl border border-slate-100 transition-all">
                    <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1 select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      조회용 (GUEST)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = `${getPublicOrigin()}${window.location.pathname}?role=GUEST&site=${site.id}`;
                        copyToClipboard(link, `${site.id}-guest`);
                      }}
                      className={`text-[9.5px] font-black px-2 py-1 rounded-lg transition-all select-none ${
                        copiedKey === `${site.id}-guest` 
                          ? 'bg-emerald-600 text-white shadow-sm font-extrabold' 
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100'
                      }`}
                    >
                      {copiedKey === `${site.id}-guest` ? '복사완료! ✓' : '주소 복사'}
                    </button>
                  </div>

                  {/* 입력용(FIELD) 링크 복사 버튼 */}
                  <div className="flex items-center justify-between bg-slate-50 hover:bg-slate-150 p-1.5 rounded-xl border border-slate-100 transition-all">
                    <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1 select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                      입력용 (FIELD)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = `${getPublicOrigin()}${window.location.pathname}?role=FIELD&site=${site.id}`;
                        copyToClipboard(link, `${site.id}-field`);
                      }}
                      className={`text-[9.5px] font-black px-2 py-1 rounded-lg transition-all select-none ${
                        copiedKey === `${site.id}-field` 
                          ? 'bg-emerald-600 text-white shadow-sm font-extrabold' 
                          : 'bg-indigo-50 hover:bg-indigo-150 text-indigo-600 border border-indigo-100'
                      }`}
                    >
                      {copiedKey === `${site.id}-field` ? '복사완료! ✓' : '주소 복사'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                    ))}
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                      +{site.buildings.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    접속하기 <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedSite && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-center mb-6">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Lock className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={() => setSelectedSite(null)}
                    className="text-white/40 hover:text-white"
                  >
                    취소
                  </button>
                </div>
                <h2 className="text-xl font-black">{selectedSite.settings.projectName}</h2>
                <p className="text-white/50 text-sm mt-1">현장 보안을 위해 비밀번호를 입력해 주세요.</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <input 
                    type="password"
                    autoFocus
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEntry()}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-center text-xl tracking-widest"
                  />
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-center text-xs font-bold"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <button 
                  onClick={handleEntry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                >
                  현장 접속하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
