import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, Target, TrendingUp, Clock, AlertCircle, ShoppingCart } from 'lucide-react';
import { AppState } from '../types';

interface DashboardWidgetsProps {
  data: AppState;
  isIndustrial: boolean;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ data, isIndustrial }) => {
  const { settings, buildings } = data;

  // 1. D-Day Calculation
  const dDayInfo = useMemo(() => {
    if (!settings.endDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(settings.endDate);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      days: diffDays,
      label: diffDays === 0 ? 'D-Day' : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`,
      status: diffDays < 0 ? 'completed' : diffDays < 30 ? 'urgent' : 'on-track'
    };
  }, [settings.endDate]);

  // 2. Progress Calculations
  const progressStats = useMemo(() => {
    // Actual Average
    let totalProgress = 0;
    let count = 0;
    
    buildings.forEach(b => {
      Object.values(b.processes).forEach(p => {
        if (p !== -1) {
          totalProgress += p;
          count++;
        }
      });
    });
    
    const actualAvg = count > 0 ? totalProgress / count : 0;

    // Target Progress (Linear)
    if (!settings.startDate || !settings.endDate) {
      return { actualAvg, targetAvg: 0, status: 'na' };
    }

    const start = new Date(settings.startDate).getTime();
    const end = new Date(settings.endDate).getTime();
    const now = new Date().getTime();

    if (now < start) return { actualAvg, targetAvg: 0, status: 'not-started' };
    if (now > end) return { actualAvg, targetAvg: 100, status: 'finished' };

    const totalDuration = end - start;
    const elapsed = now - start;
    const targetAvg = (elapsed / totalDuration) * 100;

    const diff = actualAvg - targetAvg;
    let status: 'ahead' | 'behind' | 'on-schedule' = 'on-schedule';
    if (diff > 2) status = 'ahead';
    else if (diff < -2) status = 'behind';

    return { 
      actualAvg, 
      targetAvg, 
      diff,
      status 
    };
  }, [buildings, settings.startDate, settings.endDate]);

  // 3. Urgent Lead Time Alerts
  const urgentOrders = useMemo(() => {
    const alerts: { buildingName: string; processName: string; materialDate: string; latestOrderDate: Date; daysToOrder: number; status: 'critical' | 'warning' }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    buildings.forEach(b => {
      if (!b.materialDates) return;
      Object.entries(b.materialDates).forEach(([processName, dateStr]) => {
        if (!dateStr) return;
        
        const leadTime = settings.processLeadTimes?.[processName] || 0;
        const materialDate = new Date(dateStr);
        materialDate.setHours(0, 0, 0, 0);
        
        const latestOrderDate = new Date(materialDate);
        latestOrderDate.setDate(latestOrderDate.getDate() - leadTime);
        
        const diffTime = latestOrderDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Alert if order is due in 3 days or already past
        if (diffDays <= 3) {
          alerts.push({
            buildingName: b.name,
            processName,
            materialDate: dateStr,
            latestOrderDate,
            daysToOrder: diffDays,
            status: diffDays <= 0 ? 'critical' : 'warning'
          });
        }
      });
    });

    // Sort by urgency
    return alerts.sort((a, b) => a.daysToOrder - b.daysToOrder).slice(0, 4);
  }, [buildings, settings.processLeadTimes]);

  const cardBg = isIndustrial ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100';
  const textColor = isIndustrial ? 'text-white' : 'text-slate-900';
  const subTextColor = isIndustrial ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-3 md:space-y-6 mb-4 md:mb-8">
      {/* Top Row: D-Day and Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {/* 1. D-Day Widget */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardBg} border rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-sm flex items-center justify-between overflow-hidden relative group`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
          <div className="flex items-center gap-3 md:gap-5">
            <div className={`p-2.5 md:p-4 rounded-xl md:rounded-2xl ${isIndustrial ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Calendar className="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
              <h3 className={`text-[10px] md:text-sm font-black ${textColor} uppercase tracking-tight`}>준공 예정일</h3>
              <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                <Clock className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-slate-400" />
                <p className="text-[8px] md:text-[10px] font-bold text-slate-400">{settings.endDate || '미설정'}</p>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl md:text-3xl font-black ${dDayInfo?.status === 'urgent' ? 'text-rose-500 animate-pulse' : isIndustrial ? 'text-blue-400' : 'text-blue-600'}`}>
              {dDayInfo?.label || 'N/A'}
            </div>
            <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">REMAINING DAYS</p>
          </div>
        </motion.div>

        {/* 2. Target vs Actual Gauge */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${cardBg} border rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm col-span-1 lg:col-span-2 overflow-hidden relative`}
        >
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <div className="relative w-20 h-20 md:w-28 md:h-28 flex items-center justify-center shrink-0">
               <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
                 <circle 
                  cx="56" cy="56" r="50" 
                  fill="transparent" 
                  stroke={isIndustrial ? '#1e293b' : '#f1f5f9'} 
                  strokeWidth="10" 
                 />
                 <motion.circle 
                  cx="56" cy="56" r="50" 
                  fill="transparent" 
                  stroke={isIndustrial ? '#3b82f6' : '#2563eb'} 
                  strokeWidth="10" 
                  strokeDasharray="314.159"
                  initial={{ strokeDashoffset: 314.159 }}
                  animate={{ strokeDashoffset: 314.159 - (314.159 * progressStats.actualAvg / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeLinecap="round"
                 />
                 <motion.circle 
                  cx="56" cy="56" r="50" 
                  fill="transparent" 
                  stroke={isIndustrial ? '#00ff9f' : '#10b981'} 
                  strokeWidth="3" 
                  strokeDasharray="2 6"
                  initial={{ strokeDashoffset: 314.159 }}
                  animate={{ strokeDashoffset: 314.159 - (314.159 * progressStats.targetAvg / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeOpacity={0.6}
                 />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm md:text-xl font-black ${textColor}`}>{Math.round(progressStats.actualAvg)}%</span>
                  <span className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase tracking-tighter text-center leading-none">ACTUAL<br/>AVG</span>
               </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3 md:gap-6 w-full">
              <div className="space-y-2 md:space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                    <Target className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-emerald-500" />
                    <h4 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">목표 진행률</h4>
                  </div>
                  <div className={`text-base md:text-xl font-black ${textColor}`}>{Math.round(progressStats.targetAvg)}%</div>
                </div>
                
                <div className={`p-1.5 md:p-2.5 rounded-lg md:rounded-xl ${
                  progressStats.status === 'ahead' 
                    ? (isIndustrial ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                    : progressStats.status === 'behind'
                    ? (isIndustrial ? 'bg-rose-900/20 text-rose-400' : 'bg-rose-50 text-rose-600')
                    : (isIndustrial ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                } flex items-center gap-1.5 md:gap-2`}>
                  {progressStats.status === 'ahead' ? <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" /> : progressStats.status === 'behind' ? <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter">
                    {progressStats.status === 'ahead' ? '일정 단축' : progressStats.status === 'behind' ? '지연 주의' : '일정 준수'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 md:space-y-4">
                 <div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                      <Clock className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-blue-500" />
                      <h4 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">프로젝트 회차</h4>
                    </div>
                    <div className={`text-[9px] md:text-xs font-bold leading-tight ${textColor}`}>
                      {settings.startDate ? new Date(settings.startDate).toLocaleDateString() : '-'} ~ 
                      <br className="md:hidden" />
                      <span className="hidden md:inline"> </span>
                      {settings.endDate ? new Date(settings.endDate).toLocaleDateString() : '-'}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Urgent Order Alerts Section */}
      {urgentOrders.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardBg} border rounded-2xl md:rounded-3xl p-3 md:p-5 shadow-sm overflow-hidden relative border-rose-500/30`}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
            <h3 className={`text-[11px] md:text-sm font-black ${textColor} uppercase tracking-tight`}>발주 임박 품목</h3>
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[8px] md:text-[10px] font-black animate-pulse">URGENT</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
            {urgentOrders.map((alert, idx) => (
              <div 
                key={`${alert.buildingName}-${alert.processName}-${idx}`}
                className={`p-2 md:p-3 rounded-xl md:rounded-2xl border ${
                  alert.status === 'critical' 
                    ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800' 
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex justify-between items-start mb-0.5 md:mb-1">
                  <span className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded ${
                    alert.status === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {alert.daysToOrder <= 0 ? '발주지연' : `D-${alert.daysToOrder}`}
                  </span>
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{alert.buildingName}</span>
                </div>
                <h4 className={`text-xs md:text-sm font-black truncate ${textColor}`}>{alert.processName}</h4>
                <div className="flex flex-col gap-0.5 md:gap-1 mt-1.5 md:mt-2">
                   <div className="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-500">
                     <span>입고:</span>
                     <span className={textColor}>{alert.materialDate.split('-').slice(1).join('/')}</span>
                   </div>
                   <div className="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-500">
                     <span>데드라인:</span>
                     <span className={alert.status === 'critical' ? 'text-rose-500' : 'text-amber-600'}>
                        {alert.latestOrderDate.toISOString().split('T')[0].split('-').slice(1).join('/')}
                     </span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
