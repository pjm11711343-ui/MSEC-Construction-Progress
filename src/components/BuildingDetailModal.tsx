import React from 'react';
import { motion } from 'motion/react';
import { X, BarChart3, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend
} from 'recharts';
import { BuildingData, AppState } from '../types';

interface BuildingDetailModalProps {
  building: BuildingData;
  onClose: () => void;
  data: AppState;
  activeTheme: any;
}

const BuildingDetailModal: React.FC<BuildingDetailModalProps> = ({ building, onClose, data, activeTheme }) => {
  // Calculate planned percentage for each process
  const projectStartDate = new Date(data.settings.startDate);
  const currentDate = new Date();
  const diffTime = Math.abs(currentDate.getTime() - projectStartDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const chartData = Object.keys(building.processes).map(processName => {
    const actualRaw = building.processes[processName];
    // Consider -1 as 0 for actual visual display in bars
    const actual = actualRaw === -1 ? 0 : (actualRaw || 0);
    const schedule = data.processSchedules?.[processName];
    
    let planned = 0;
    if (schedule) {
      const { startOffset, duration } = schedule;
      if (diffDays < startOffset) {
        planned = 0;
      } else if (diffDays >= startOffset + duration) {
        planned = 100;
      } else {
        planned = Math.round(((diffDays - startOffset) / Math.max(1, duration)) * 100);
      }
    }

    return {
      name: processName.replace(/^\d+\.\s*/, ''), // Simplified name for chart
      actual: actual,
      planned: planned,
      diff: actual - planned
    };
  });

  const isDark = activeTheme.isDark;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl border ${activeTheme.card} ${activeTheme.border}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-blue-500/10`}>
              <BarChart3 className={`w-6 h-6 text-blue-500`} />
            </div>
            <div>
              <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{building.name} 상세 공정 분석</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">Planned vs Actual Progress Analysis</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-100px)] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={`p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20`}>
              <div className="text-[10px] font-black text-blue-500 uppercase mb-1">전체 실 공정률</div>
              <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {chartData.length > 0 ? Math.round(chartData.reduce((sum, d) => sum + d.actual, 0) / chartData.length) : 0}%
              </div>
            </div>
            <div className={`p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20`}>
              <div className="text-[10px] font-black text-amber-500 uppercase mb-1">전체 지시 공정률</div>
              <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {chartData.length > 0 ? Math.round(chartData.reduce((sum, d) => sum + d.planned, 0) / chartData.length) : 0}%
              </div>
            </div>
            {(() => {
              const avgDiff = chartData.length > 0 
                ? (chartData.reduce((sum, d) => sum + d.actual, 0) - chartData.reduce((sum, d) => sum + d.planned, 0)) / chartData.length 
                : 0;
              const isAhead = avgDiff >= 0;
              return (
                <div className={`p-4 rounded-2xl ${isAhead ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100' : 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-100'} border`}>
                  <div className={`text-[10px] font-black ${isAhead ? 'text-emerald-500' : 'text-rose-500'} uppercase mb-1`}>계획 대비 편차</div>
                  <div className={`text-2xl font-black ${isAhead ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isAhead ? '+' : ''}{Math.round(avgDiff)}%
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="h-[500px] w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 50, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className={`p-3 rounded-xl shadow-xl border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                          <p className="text-xs font-black mb-2">{data.name}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-8">
                              <span className="text-[10px] font-bold text-slate-400">계획:</span>
                              <span className="text-[10px] font-black">{data.planned}%</span>
                            </div>
                            <div className="flex justify-between gap-8">
                              <span className="text-[10px] font-bold text-slate-400">실시:</span>
                              <span className="text-[10px] font-black">{data.actual}%</span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-8">
                              <span className="text-[10px] font-bold text-slate-400">편차:</span>
                              <span className={`text-[10px] font-black ${data.diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {data.diff > 0 ? '+' : ''}{data.diff}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 10, fontWeight: 800 }} />
                <Bar name="계획(Planned)" dataKey="planned" fill={isDark ? '#334155' : '#cbd5e1'} radius={[0, 4, 4, 0]} barSize={12} />
                <Bar name="실시(Actual)" dataKey="actual" fill={isDark ? '#3b82f6' : '#2563eb'} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex gap-4">
            <div className="p-2 rounded-xl bg-blue-500/10 flex-shrink-0 h-max">
              <Info className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              본 분석은 프로젝트 시작일({data.settings.startDate}) 및 각 공종별 설정된 스케줄(시작오프셋, 기간)을 기반으로 계산된 <strong>계획 공정률</strong>과 현재 입력된 <strong>실제 실적</strong>을 비교합니다. 
              푸른색 바(실시)가 회색 바(계획)보다 길면 선행, 짧으면 지연 상태를 의미합니다.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BuildingDetailModal;
