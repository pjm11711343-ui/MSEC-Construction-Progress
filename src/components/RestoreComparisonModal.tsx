import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, XCircle, Info, ArrowRight, Building2, Layers, ShieldAlert } from 'lucide-react';
import { AppState, MultiProjectData } from '../types';

interface DiffSummary {
  newSites: string[];
  removedSites: string[];
  changedSites: {
    name: string;
    newBuildings: string[];
    removedBuildings: string[];
    newProcesses: string[];
    removedProcesses: string[];
  }[];
}

interface RestoreComparisonModalProps {
  currentData: MultiProjectData;
  backupData: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RestoreComparisonModal({ currentData, backupData, onConfirm, onCancel }: RestoreComparisonModalProps) {
  const diff = React.useMemo(() => {
    const summary: DiffSummary = {
      newSites: [],
      removedSites: [],
      changedSites: []
    };

    const isBackupMulti = Array.isArray(backupData.sites);
    const backupSites: AppState[] = isBackupMulti ? backupData.sites : [backupData];
    const currentSites = currentData.sites;

    const backupSiteIds = new Set(backupSites.map(s => s.id));
    const currentSiteIds = new Set(currentSites.map(s => s.id));

    // Sites in backup not in current
    backupSites.forEach(bs => {
      if (!currentSiteIds.has(bs.id)) {
        summary.newSites.push(bs.settings.projectName);
      }
    });

    // Sites in current not in backup
    currentSites.forEach(cs => {
      if (!backupSiteIds.has(cs.id)) {
        summary.removedSites.push(cs.settings.projectName);
      }
    });

    // Changed sites
    backupSites.forEach(bs => {
      const cs = currentSites.find(s => s.id === bs.id);
      if (cs) {
        const siteDiff = {
          name: bs.settings.projectName,
          newBuildings: [] as string[],
          removedBuildings: [] as string[],
          newProcesses: [] as string[],
          removedProcesses: [] as string[]
        };

        const bBuildings = bs.buildings || [];
        const cBuildings = cs.buildings || [];
        const bBldMap = new Map(bBuildings.map(b => [b.name, b]));
        const cBldMap = new Map(cBuildings.map(b => [b.name, b]));

        bBuildings.forEach(b => {
          if (!cBldMap.has(b.name)) siteDiff.newBuildings.push(b.name);
        });
        cBuildings.forEach(b => {
          if (!bBldMap.has(b.name)) siteDiff.removedBuildings.push(b.name);
        });

        const bProcesses = new Set<string>();
        bBuildings.forEach(b => Object.keys(b.processes || {}).forEach(p => bProcesses.add(p)));
        
        const cProcesses = new Set<string>();
        cBuildings.forEach(b => Object.keys(b.processes || {}).forEach(p => cProcesses.add(p)));

        bProcesses.forEach(p => {
          if (!cProcesses.has(p)) siteDiff.newProcesses.push(p);
        });
        cProcesses.forEach(p => {
          if (!bProcesses.has(p)) siteDiff.removedProcesses.push(p);
        });

        if (siteDiff.newBuildings.length > 0 || siteDiff.removedBuildings.length > 0 || 
            siteDiff.newProcesses.length > 0 || siteDiff.removedProcesses.length > 0) {
          summary.changedSites.push(siteDiff);
        }
      }
    });

    return summary;
  }, [currentData, backupData]);

  const hasDifferences = diff.newSites.length > 0 || diff.removedSites.length > 0 || diff.changedSites.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">데이터 복원 분석</h2>
              <p className="text-sm text-slate-500 font-medium">로컬 데이터와 백업 파일의 차이점입니다.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!hasDifferences ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="p-4 bg-emerald-50 text-emerald-500 rounded-full">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">일치하는 데이터</p>
                <p className="text-slate-500">현재 데이터와 백업 파일이 구조적으로 동일합니다.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Added Sites */}
              {diff.newSites.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                    추가될 현장 ({diff.newSites.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {diff.newSites.map(name => (
                      <span key={name} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed Sites */}
              {diff.removedSites.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    삭제될 현장 ({diff.removedSites.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {diff.removedSites.map(name => (
                      <span key={name} className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Changed Details */}
              {diff.changedSites.map(site => (
                <div key={site.name} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-800">{site.name}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">내부 변경됨</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Buildings */}
                    {(site.newBuildings.length > 0 || site.removedBuildings.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> 건물 구성
                        </p>
                        <div className="space-y-1">
                          {site.newBuildings.map(b => (
                            <div key={b} className="flex items-center gap-1.5 text-[11px] text-blue-600 font-bold">
                              <PlusIcon className="w-3 h-3" /> {b} 추가
                            </div>
                          ))}
                          {site.removedBuildings.map(b => (
                            <div key={b} className="flex items-center gap-1.5 text-[11px] text-red-500 font-bold">
                              <MinusIcon className="w-3 h-3" /> {b} 삭제
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Processes */}
                    {(site.newProcesses.length > 0 || site.removedProcesses.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> 공종 목록
                        </p>
                        <div className="space-y-1">
                          {site.newProcesses.map(p => (
                            <div key={p} className="flex items-center gap-1.5 text-[11px] text-blue-600 font-bold">
                              <PlusIcon className="w-3 h-3" /> {p} (신규 공종)
                            </div>
                          ))}
                          {site.removedProcesses.map(p => (
                            <div key={p} className="flex items-center gap-1.5 text-[11px] text-red-500 font-bold">
                              <MinusIcon className="w-3 h-3" /> {p} (누락됨)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
             <Info className="w-5 h-5 text-amber-500 shrink-0" />
             <div className="text-xs text-amber-800 leading-relaxed font-medium">
               복원을 진행하면 현재 브라우저에 저장된 모든 데이터가 백업 파일의 내용으로 덮어씌워집니다. 
               <span className="font-bold block mt-1">이 작업은 취소할 수 없습니다. 계속하시겠습니까?</span>
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
          >
            취소
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-6 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            복원 실행하기
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
    </svg>
  );
}
