import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Settings2,
  Clock,
  CheckCircle2,
  Building2,
  Hash,
  ArrowRightLeft
} from 'lucide-react';
import { AppTheme, UserRole } from '../types';

interface GanttViewProps {
  processes: string[];
  schedules: Record<string, { startOffset: number; duration: number }>;
  onUpdateSchedule: (processName: string, startOffset: number, duration: number) => void;
  startDate: string;
  endDate?: string;
  stairwellCount?: number;
  unitCount?: number;
  projectName: string;
  companyName: string;
  theme: AppTheme;
  activeTheme: any;
  role: UserRole;
  buildingProgress: Record<string, number>; // Process name -> Average progress
}

export default function GanttView({ 
  processes, 
  schedules, 
  onUpdateSchedule, 
  startDate, 
  endDate,
  stairwellCount,
  unitCount,
  projectName,
  companyName,
  theme, 
  activeTheme, 
  role,
  buildingProgress
}: GanttViewProps) {
  const [viewRange, setViewRange] = useState({ start: 0, weeks: 12 });
  const [editingProcess, setEditingProcess] = useState<string | null>(null);

  const projectStart = useMemo(() => new Date(startDate), [startDate]);

  const getDateAtOffset = (days: number) => {
    const d = new Date(projectStart);
    d.setDate(d.getDate() + days);
    return d;
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const timeAxis = useMemo(() => {
    const days = [];
    for (let i = viewRange.start; i < viewRange.start + viewRange.weeks * 7; i++) {
        days.push(getDateAtOffset(i));
    }
    return days;
  }, [projectStart, viewRange]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < viewRange.weeks; i++) {
        w.push(getDateAtOffset(viewRange.start + i * 7));
    }
    return w;
  }, [projectStart, viewRange]);

  const handleEdit = (p: string) => {
    if (role === 'GUEST') return;
    setEditingProcess(p);
  };

  return (
    <div className="space-y-6">
      {/* Project Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center gap-4`}>
          <div className={`p-3 rounded-xl bg-blue-100 text-blue-600`}>
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project / Company</p>
            <h3 className="text-sm font-black truncate max-w-[150px]">{projectName}</h3>
            <p className="text-[10px] text-slate-500 font-bold">{companyName}</p>
          </div>
        </div>

        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center gap-4`}>
          <div className={`p-3 rounded-xl bg-emerald-100 text-emerald-600`}>
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Schedule</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">{startDate}</span>
              <span className="text-slate-300 text-xs text-bold">→</span>
              <span className="text-xs font-black">{endDate || 'N/A'}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold">Planned Period</p>
          </div>
        </div>

        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center gap-4`}>
          <div className={`p-3 rounded-xl bg-purple-100 text-purple-600`}>
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacities</p>
            <h3 className="text-sm font-black">{unitCount?.toLocaleString()} 세대</h3>
            <p className="text-[10px] text-slate-500 font-bold">Total Units</p>
          </div>
        </div>

        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center gap-4`}>
          <div className={`p-3 rounded-xl bg-orange-100 text-orange-600`}>
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stairwells</p>
            <h3 className="text-sm font-black">{stairwellCount} Halls / Floor</h3>
            <p className="text-[10px] text-slate-500 font-bold">Structural Info</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${activeTheme.accent} text-white`}>
                <Clock className="w-5 h-5" />
            </div>
            <div>
                <h2 className={`text-xl font-black uppercase tracking-tight ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>전체 공정 간트 차트</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master Construction Schedule (Gantt)</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button 
                onClick={() => setViewRange(prev => ({ ...prev, start: Math.max(0, prev.start - 14) }))}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="px-3 flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">View Range</span>
                <span className="text-xs font-black">
                    {formatDate(getDateAtOffset(viewRange.start))} - {formatDate(getDateAtOffset(viewRange.start + viewRange.weeks * 7))}
                </span>
            </div>
            <button 
                onClick={() => setViewRange(prev => ({ ...prev, start: prev.start + 14 }))}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
                <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
        </div>
      </div>

      <div className={`${activeTheme.card} rounded-3xl border ${activeTheme.border} shadow-xl overflow-hidden`}>
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1200px]">
            {/* Timeline Header */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="w-64 flex-shrink-0 p-4 border-r border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process / Phase</span>
              </div>
              <div className="flex flex-1">
                {weeks.map((w, i) => (
                  <div key={i} className="flex-1 min-w-[80px] p-2 text-center border-r border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-500">{w.getMonth() + 1}월</span>
                    <div className="text-[8px] font-bold text-slate-400">{w.getDate()}일</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {processes.map((p) => {
                const schedule = schedules[p] || { startOffset: 0, duration: 30 };
                const progress = buildingProgress[p] || 0;
                
                // Calculate display position
                const startDay = schedule.startOffset;
                const endDay = schedule.startOffset + schedule.duration;
                
                const viewStart = viewRange.start;
                const viewEnd = viewRange.start + viewRange.weeks * 7;
                
                const isVisible = !(endDay < viewStart || startDay > viewEnd);
                
                const leftPercent = Math.max(0, (startDay - viewStart) / (viewRange.weeks * 7)) * 100;
                const widthPercent = (Math.min(viewEnd, endDay) - Math.max(viewStart, startDay)) / (viewRange.weeks * 7) * 100;

                return (
                  <div key={p} className="flex group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div 
                        className="w-64 flex-shrink-0 p-4 border-r border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                        onClick={() => handleEdit(p)}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black tracking-tight truncate">{p}</span>
                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full w-12 overflow-hidden">
                             <div className={`h-full ${activeTheme.accent}`} style={{ width: `${progress}%` }} />
                           </div>
                           <span className="text-[9px] font-bold text-slate-400">{progress}%</span>
                        </div>
                      </div>
                      {role !== 'GUEST' && <Settings2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                    <div className="flex-1 relative h-16 p-4">
                      {/* Column lines */}
                      <div className="absolute inset-0 flex">
                        {weeks.map((_, i) => (
                           <div key={i} className="flex-1 border-r border-slate-100/50 dark:border-slate-800/50 h-full" />
                        ))}
                      </div>
                      
                      {isVisible && (
                        <motion.div 
                          layoutId={`gantt-${p}`}
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-xl shadow-lg border-2 ${activeTheme.border} ${theme === 'industrial' ? 'bg-slate-800' : 'bg-white'} overflow-hidden group/bar`}
                          style={{ 
                            left: `${leftPercent}%`, 
                            width: `${widthPercent}%`,
                            minWidth: '4px'
                          }}
                        >
                           {/* Progress Overlay */}
                           <div 
                             className={`absolute inset-0 ${activeTheme.accent} opacity-20`} 
                             style={{ width: `${progress}%` }} 
                           />
                           {/* Actual Bar */}
                           <div className="absolute inset-0 flex items-center px-3 gap-2">
                              {progress === 100 && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                              <span className="text-[9px] font-black truncate">{schedule.duration}일</span>
                           </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Date Adjustment */}
      <AnimatePresence>
        {editingProcess && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black">{editingProcess}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Schedule Parameters</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Start Offset (Site Start + X days)</label>
                   <input 
                     type="number" 
                     value={schedules[editingProcess]?.startOffset || 0}
                     onChange={(e) => onUpdateSchedule(editingProcess, parseInt(e.target.value) || 0, schedules[editingProcess]?.duration || 30)}
                     className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Duration (days)</label>
                   <input 
                     type="number" 
                     value={schedules[editingProcess]?.duration || 30}
                     onChange={(e) => onUpdateSchedule(editingProcess, schedules[editingProcess]?.startOffset || 0, parseInt(e.target.value) || 0)}
                     className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
                   />
                </div>
              </div>

              <button 
                onClick={() => setEditingProcess(null)}
                className={`w-full ${activeTheme.button} text-white font-black py-4 rounded-2xl transition-all shadow-xl`}
              >
                닫기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
