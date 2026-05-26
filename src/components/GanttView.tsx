import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ArrowRightLeft,
  Flag,
  Plus,
  Trash2,
  GripVertical
} from 'lucide-react';
import { AppTheme, UserRole, Milestone, DailyReport } from '../types';

interface GanttViewProps {
  processes: string[];
  schedules: Record<string, { startOffset: number; duration: number }>;
  onUpdateSchedule: (processName: string, startOffset: number, duration: number) => void;
  milestones: Milestone[];
  onUpdateMilestones: (milestones: Milestone[]) => void;
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
  dailyReports?: DailyReport[];
}

export default function GanttView({ 
  processes, 
  schedules, 
  onUpdateSchedule, 
  milestones,
  onUpdateMilestones,
  startDate, 
  endDate,
  stairwellCount,
  unitCount,
  projectName,
  companyName,
  theme, 
  activeTheme, 
  role,
  buildingProgress,
  dailyReports = []
}: GanttViewProps) {
  const [viewRange, setViewRange] = useState({ start: 0, weeks: 12 });
  const [editingProcess, setEditingProcess] = useState<string | null>(null);
  const [isManagingMilestones, setIsManagingMilestones] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(false);
  const [dragState, setDragState] = useState<{
    process: string;
    type: 'move' | 'resize-end' | 'resize-start';
    initialX: number;
    initialStartOffset: number;
    initialDuration: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const projectStart = useMemo(() => new Date(startDate), [startDate]);

  // Calculate predicted delay factor based on historical weather
  const weatherDelayFactor = useMemo(() => {
    if (!dailyReports || dailyReports.length === 0) return 0;
    
    let totalPoints = 0;
    dailyReports.forEach(report => {
      const w = report.weather.toLowerCase();
      if (w.includes('비') || w.includes('rain') || w.includes('눈') || w.includes('snow')) {
        totalPoints += 0.3; // 30% daily delay for bad weather
      } else if (w.includes('흐림') || w.includes('cloudy') || w.includes('overcast')) {
        totalPoints += 0.05; // 5% slight delay
      }
    });
    
    // Average delay factor across reported days
    return totalPoints / dailyReports.length;
  }, [dailyReports]);

  // Derived effective schedules based on auto-sync logic
  const effectiveSchedules = useMemo(() => {
    if (!isAutoSync) return schedules;

    const derived: Record<string, { startOffset: number; duration: number }> = {};
    let currentOffset = 0;

    processes.forEach(p => {
      const original = schedules[p] || { startOffset: 0, duration: 30 };
      derived[p] = {
        startOffset: currentOffset,
        duration: original.duration
      };
      currentOffset += original.duration;
    });

    return derived;
  }, [isAutoSync, processes, schedules]);

  // Derived milestones based on auto-sync logic
  const effectiveMilestones = useMemo(() => {
    if (!isAutoSync) return milestones;

    return milestones.map(m => {
      // Simple heuristic: if milestone name contains process name, attach it to end date
      const matchingProcess = processes.find(p => m.name.includes(p.replace(/^\d+\.\s*/, '')));
      if (matchingProcess) {
        const schedule = effectiveSchedules[matchingProcess];
        const endDay = schedule.startOffset + schedule.duration;
        const newDate = new Date(projectStart);
        newDate.setDate(newDate.getDate() + endDay);
        return { ...m, date: newDate.toISOString().split('T')[0] };
      }
      return m;
    });
  }, [isAutoSync, milestones, processes, effectiveSchedules, projectStart]);

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
  }, [projectStart, viewRange.start, viewRange.weeks]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !dragState) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const deltaX = x - dragState.initialX;
      
      const daysInView = viewRange.weeks * 7;
      const pxPerDay = rect.width / daysInView;
      const deltaDays = Math.round(deltaX / pxPerDay);

      if (dragState.type === 'move') {
        onUpdateSchedule(dragState.process, dragState.initialStartOffset + deltaDays, dragState.initialDuration);
      } else if (dragState.type === 'resize-end') {
        onUpdateSchedule(dragState.process, dragState.initialStartOffset, Math.max(1, dragState.initialDuration + deltaDays));
      } else if (dragState.type === 'resize-start') {
        onUpdateSchedule(dragState.process, dragState.initialStartOffset + deltaDays, Math.max(1, dragState.initialDuration - deltaDays));
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, viewRange.weeks, onUpdateSchedule]);

  const handleDragStart = (e: React.MouseEvent, process: string, type: 'move' | 'resize-end' | 'resize-start') => {
    if (role === 'GUEST') return;
    if (isAutoSync && type !== 'resize-end') return; // Only allow resizing the end if auto-sync is on
    e.stopPropagation();
    const schedule = effectiveSchedules[process] || { startOffset: 0, duration: 30 };
    setDragState({
      process,
      type,
      initialX: e.clientX - (containerRef.current?.getBoundingClientRect().left || 0),
      initialStartOffset: schedule.startOffset,
      initialDuration: schedule.duration
    });
  };

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
                onClick={() => setIsAutoSync(!isAutoSync)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-black ${isAutoSync ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`}
            >
                <Clock className={`w-3.5 h-3.5 ${isAutoSync ? 'text-white' : 'text-orange-500'}`} />
                {isAutoSync ? '자동 동기화 ON' : '자동 동기화 OFF'}
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <button 
                onClick={() => setIsManagingMilestones(true)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-xs font-black"
            >
                <Flag className="w-4 h-4 text-orange-500" />
                마일스톤 관리
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
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
            <div className="divide-y divide-slate-100 dark:divide-slate-800 relative" ref={containerRef}>
              {/* Milestone Lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="flex h-full">
                  <div className="w-64 flex-shrink-0" /> {/* Sidebar spacer */}
                  <div className="flex-1 relative">
                    {effectiveMilestones.map((m) => {
                      const mDate = new Date(m.date);
                      const diff = Math.floor((mDate.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000));
                      
                      const viewStart = viewRange.start;
                      const viewEnd = viewRange.start + viewRange.weeks * 7;
                      
                      if (diff < viewStart || diff > viewEnd) return null;
                      
                      const leftPercent = (diff - viewStart) / (viewRange.weeks * 7) * 100;
                      
                      return (
                        <div 
                          key={m.id}
                          className="absolute top-0 bottom-0 border-l-2 border-dashed border-orange-500/50 z-20"
                          style={{ left: `${leftPercent}%` }}
                        >
                          <div className="absolute top-0 transform -translate-x-1/2 -translate-y-full pb-1">
                            <div className="bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                              {m.name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {processes.map((p) => {
                const schedule = effectiveSchedules[p] || { startOffset: 0, duration: 30 };
                const progress = buildingProgress[p] || 0;
                
                // Calculate display position
                const startDay = schedule.startOffset;
                const endDay = schedule.startOffset + schedule.duration;
                
                const viewStart = viewRange.start;
                const viewEnd = viewRange.start + viewRange.weeks * 7;
                
                const isVisible = !(endDay < viewStart || startDay > viewEnd);
                
                const leftPercent = Math.max(0, (startDay - viewStart) / (viewRange.weeks * 7)) * 100;
                const widthPercent = (Math.min(viewEnd, endDay) - Math.max(viewStart, startDay)) / (viewRange.weeks * 7) * 100;

                // Predicted delay calculation
                const predictedDelay = Math.round(schedule.duration * weatherDelayFactor);
                const delayWidthPercent = (predictedDelay / (viewRange.weeks * 7)) * 100;
                const totalEndDay = endDay + predictedDelay;
                const isDelayVisible = isVisible || (totalEndDay >= viewStart && startDay <= viewEnd);

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
                           {predictedDelay > 0 && (
                             <span className="text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-1 rounded">+{predictedDelay}d</span>
                           )}
                        </div>
                      </div>
                      {role !== 'GUEST' && <Settings2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                      <div className="flex-1 relative h-16 p-4">
                        {/* Column lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {weeks.map((_, i) => (
                             <div key={i} className="flex-1 border-r border-slate-100/50 dark:border-slate-800/50 h-full" />
                          ))}
                        </div>
                        
                        {isVisible && (
                          <motion.div 
                            layoutId={`gantt-${p}`}
                            className={`absolute top-1/2 -translate-y-1/2 h-9 rounded-xl shadow-lg border-2 ${activeTheme.border} ${theme === 'industrial' ? 'bg-slate-800' : 'bg-white'} overflow-visible group/bar cursor-move`}
                            style={{ 
                              left: `${leftPercent}%`, 
                              width: `${widthPercent}%`,
                              minWidth: '20px',
                              zIndex: dragState?.process === p ? 40 : 30
                            }}
                            onMouseDown={(e) => handleDragStart(e, p, 'move')}
                          >
                             {/* Progress Overlay */}
                             <div 
                               className={`absolute inset-0 ${activeTheme.accent} opacity-20 pointer-events-none`} 
                               style={{ width: `${progress}%` }} 
                             />

                             {/* Predicted Delay Visualization */}
                             {predictedDelay > 0 && (
                               <div 
                                 className="absolute left-full top-0 bottom-0 bg-rose-500/10 border-r-2 border-t-2 border-b-2 border-rose-500/30 border-dashed rounded-r-xl flex items-center justify-center overflow-hidden"
                                 style={{ width: `${(delayWidthPercent / widthPercent) * 100}%`, minWidth: '4px' }}
                               >
                                 <div className="absolute inset-0 bg-repeating-linear-gradient opacity-10" 
                                      style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, currentColor 5px, currentColor 10px)', color: '#f43f5e' }} />
                                 <span className="text-[7px] font-black text-rose-500 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap px-1">
                                   Expected Delay: +{predictedDelay}d
                                 </span>
                               </div>
                             )}

                             {/* Resize Start Handle */}
                             {role !== 'GUEST' && !isAutoSync && (
                               <div 
                                 className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-orange-500/30 rounded-l-xl z-10"
                                 onMouseDown={(e) => handleDragStart(e, p, 'resize-start')}
                               />
                             )}

                             {/* Actual Bar Header */}
                             <div className="absolute inset-0 flex items-center px-2 gap-1 pointer-events-none">
                                <GripVertical className="w-3 h-3 text-slate-300 shrink-0" />
                                <span className="text-[9px] font-black truncate">{schedule.duration}d</span>
                                {progress === 100 && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                             </div>

                             {/* Resize End Handle */}
                             {role !== 'GUEST' && (
                               <div 
                                 className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-orange-500/30 rounded-r-xl z-10"
                                 onMouseDown={(e) => handleDragStart(e, p, 'resize-end')}
                               />
                             )}
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
                   <label className="text-[10px] font-black text-slate-400 uppercase">
                     Start Offset (Site Start + X days)
                     {isAutoSync && <span className="text-orange-500 ml-2">(자동 계산됨)</span>}
                   </label>
                   <input 
                     type="number" 
                     disabled={isAutoSync}
                     value={effectiveSchedules[editingProcess]?.startOffset || 0}
                     onChange={(e) => onUpdateSchedule(editingProcess, parseInt(e.target.value) || 0, schedules[editingProcess]?.duration || 30)}
                     className={`w-full p-4 rounded-2xl border font-bold ${isAutoSync ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
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

        {isManagingMilestones && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">마일스톤 관리</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Milestones</p>
                </div>
                <button 
                  onClick={() => setIsManagingMilestones(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {milestones.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Flag className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">등록된 마일스톤이 없습니다.</p>
                  </div>
                )}
                {milestones.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl group">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{m.date}</div>
                    </div>
                    <button 
                      onClick={() => onUpdateMilestones(milestones.filter(x => x.id !== m.id))}
                      className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase">새 마일스톤 추가</div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    id="newMilestoneName"
                    type="text" 
                    placeholder="마일스톤 명칭"
                    className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                  <input 
                    id="newMilestoneDate"
                    type="date" 
                    className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <button 
                  onClick={() => {
                    const nameInput = document.getElementById('newMilestoneName') as HTMLInputElement;
                    const dateInput = document.getElementById('newMilestoneDate') as HTMLInputElement;
                    if (nameInput.value && dateInput.value) {
                      onUpdateMilestones([
                        ...milestones, 
                        { id: Math.random().toString(36).substr(2, 9), name: nameInput.value, date: dateInput.value }
                      ]);
                      nameInput.value = '';
                      dateInput.value = '';
                    }
                  }}
                  className={`w-full ${activeTheme.button} text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  추가하기
                </button>
              </div>

              <button 
                onClick={() => setIsManagingMilestones(false)}
                className={`w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl transition-all shadow-xl`}
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
