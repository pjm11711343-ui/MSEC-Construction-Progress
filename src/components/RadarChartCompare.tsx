import React, { useState, useMemo } from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Settings2, 
  Check, 
  SlidersHorizontal, 
  TrendingUp, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { AppState, AppTheme } from '../types';

interface RadarChartCompareProps {
  data: AppState;
  theme: AppTheme;
  activeTheme: {
    accent: string;
    bg: string;
    card: string;
    border: string;
    text: string;
    accentHex?: string;
    isDark?: boolean;
  };
}

export const RadarChartCompare: React.FC<RadarChartCompareProps> = ({
  data,
  theme,
  activeTheme
}) => {
  const isDark = activeTheme.isDark || theme === 'industrial' || theme === 'midnight';

  // Available buildings
  const buildings = data.buildings || [];
  
  // Available processes
  const allProcesses = useMemo(() => {
    if (buildings.length === 0) return [];
    return Object.keys(buildings[0].processes);
  }, [buildings]);

  // Color palette for buildings
  const buildingColors = useMemo(() => {
    const colorsLight = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#06b6d4'];
    const colorsDark = ['#00ff9f', '#00f0ff', '#ffaa00', '#ff007f', '#a855f7', '#00f5d4', '#ff3366', '#3b82f6'];
    const selectedPalette = isDark ? colorsDark : colorsLight;
    
    const map: Record<string, string> = {};
    buildings.forEach((b, idx) => {
      map[b.name] = selectedPalette[idx % selectedPalette.length];
    });
    return map;
  }, [buildings, isDark]);

  // States
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>(() => 
    buildings.slice(0, 3).map(b => b.name)
  );
  
  const [showAverage, setShowAverage] = useState(true);
  
  // Process selection presets:
  // 'key': Key structure and critical piping processes
  // 'piping': All piping and utility processes
  // 'all': All 22 processes
  // 'custom': User selects processes
  const [processPreset, setProcessPreset] = useState<'key' | 'piping' | 'all' | 'custom'>('key');
  
  const [customProcesses, setCustomProcesses] = useState<string[]>(() => {
    // Default key processes
    return allProcesses.slice(0, 8);
  });

  const [showCustomConfig, setShowCustomConfig] = useState(false);

  // Define preset process lists
  const keyProcesses = useMemo(() => {
    // Focus on foundation, concrete, main pipes, and finish items
    return allProcesses.filter(p => 
      p.includes("골조") || 
      p.includes("스리브") || 
      p.includes("알폼") || 
      p.includes("분배기") || 
      p.includes("코일") ||
      p.includes("환기")
    ).slice(0, 7);
  }, [allProcesses]);

  const pipingProcesses = useMemo(() => {
    return allProcesses.filter(p => 
      p.includes("배관") || 
      p.includes("오배수") || 
      p.includes("수전구") || 
      p.includes("급수")
    ).slice(0, 7);
  }, [allProcesses]);

  // Current active processes to display on the chart
  const activeProcesses = useMemo(() => {
    if (processPreset === 'all') return allProcesses;
    if (processPreset === 'key') return keyProcesses.length > 0 ? keyProcesses : allProcesses.slice(0, 6);
    if (processPreset === 'piping') return pipingProcesses.length > 0 ? pipingProcesses : allProcesses.slice(5, 11);
    return customProcesses;
  }, [processPreset, allProcesses, keyProcesses, pipingProcesses, customProcesses]);

  // Transform data for Recharts RadarChart
  const chartData = useMemo(() => {
    return activeProcesses.map(p => {
      const row: any = {
        // Clean up the name for display (e.g. remove number prefix like "1. ")
        processFull: p,
        process: p.replace(/^\d+\.\s*/, '')
      };
      
      buildings.forEach(b => {
        const val = b.processes[p];
        row[b.name] = val === -1 || val === undefined ? 0 : val;
      });

      // Calculate site average
      const validVals = buildings
        .map(b => b.processes[p])
        .filter(v => v !== undefined && v !== -1) as number[];
      const avg = validVals.length > 0 
        ? validVals.reduce((sum, v) => sum + v, 0) / validVals.length 
        : 0;
      row['전체 평균'] = Math.round(avg);

      return row;
    });
  }, [activeProcesses, buildings]);

  const toggleBuilding = (name: string) => {
    setSelectedBuildings(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(n => n !== name);
      }
      return [...prev, name];
    });
  };

  const toggleCustomProcess = (p: string) => {
    setCustomProcesses(prev => {
      if (prev.includes(p)) {
        if (prev.length === 3) return prev; // Keep at least 3 for a valid radar
        return prev.filter(item => item !== p);
      }
      return [...prev, p];
    });
  };

  const selectAllBuildings = () => {
    setSelectedBuildings(buildings.map(b => b.name));
  };

  const resetBuildings = () => {
    setSelectedBuildings(buildings.slice(0, 3).map(b => b.name));
  };

  if (buildings.length === 0) {
    return null;
  }

  return (
    <div className={`${activeTheme.card} rounded-3xl border ${activeTheme.border} p-5 md:p-8 shadow-sm space-y-6 md:space-y-8 relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${activeTheme.accent.replace('text-', 'bg-').replace('border-', 'bg-opacity-10')} text-white flex items-center justify-center`}>
            <SlidersHorizontal className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-lg md:text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                동별 공정률 비교 입체 분석
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 flex items-center gap-1`}>
                <Sparkles className="w-2.5 h-2.5" /> Interactive Radar
              </span>
            </div>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">
              방사형 대조를 통해 각 동의 부문별 진행 편차와 핵심 병목 구간을 다각도로 분석합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Radar Chart Panel */}
        <div className="xl:col-span-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl p-4 min-h-[420px] relative">
          
          {chartData.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <SlidersHorizontal className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
              <p className="text-sm font-bold">표시할 공정이 선택되지 않았습니다.</p>
              <button 
                onClick={() => setProcessPreset('key')} 
                className="mt-3 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
              >
                기본 공종 선택
              </button>
            </div>
          ) : (
            <div className="w-full h-[380px] md:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                  <PolarGrid stroke={isDark ? '#334155' : '#cbd5e1'} />
                  <PolarAngleAxis 
                    dataKey="process" 
                    tick={{ 
                      fill: isDark ? '#94a3b8' : '#475569', 
                      fontSize: 10,
                      fontWeight: '700'
                    }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                    axisLine={false}
                  />
                  
                  {/* Selected Buildings Series */}
                  {selectedBuildings.map(name => (
                    <Radar
                      key={name}
                      name={name}
                      dataKey={name}
                      stroke={buildingColors[name]}
                      fill={buildingColors[name]}
                      fillOpacity={0.15}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: buildingColors[name] }}
                    />
                  ))}

                  {/* Site Average Reference Series */}
                  {showAverage && (
                    <Radar
                      name="전체 평균"
                      dataKey="전체 평균"
                      stroke={isDark ? '#ffffff' : '#64748b'}
                      fill={isDark ? '#ffffff' : '#64748b'}
                      fillOpacity={0.05}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: isDark ? '#ffffff' : '#64748b', strokeDasharray: '0' }}
                    />
                  )}

                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#11141a' : '#ffffff',
                      border: `1px solid ${activeTheme.border}`,
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      fontSize: '11px',
                      color: isDark ? '#f1f5f9' : '#1e293b'
                    }}
                    itemStyle={{ padding: '2px 0' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick Helper Legend */}
          <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-[10px] text-slate-400 font-bold px-2">
            <span>* 외곽으로 갈수록 공정률이 높음 (최대 100%)</span>
            <span>데이터 소스: 현장 일일 기록</span>
          </div>
        </div>

        {/* Interaction Controls Panel */}
        <div className="xl:col-span-4 space-y-6">
          {/* Building Selectors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> 비교 건물 선택 ({selectedBuildings.length})
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={selectAllBuildings}
                  className="text-[9px] font-black text-blue-500 hover:underline"
                >
                  전체 선택
                </button>
                <span className="text-slate-300">|</span>
                <button 
                  onClick={resetBuildings}
                  className="text-[9px] font-black text-slate-400 hover:underline"
                >
                  초기화
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {buildings.map(b => {
                const isSelected = selectedBuildings.includes(b.name);
                const color = buildingColors[b.name];
                return (
                  <button
                    key={b.id}
                    onClick={() => toggleBuilding(b.name)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                      isSelected 
                        ? isDark 
                          ? 'bg-slate-800/80 border-slate-700 shadow-md' 
                          : 'bg-white border-slate-300 shadow-sm'
                        : isDark
                          ? 'bg-slate-900/40 border-slate-800/80 opacity-50 hover:opacity-80'
                          : 'bg-slate-50 border-slate-100 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: color }}
                      />
                      <span className={`text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {b.name}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-500" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference Line Toggle */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> 벤치마크 기준선
            </label>
            <button
              onClick={() => setShowAverage(prev => !prev)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                showAverage 
                  ? isDark 
                    ? 'bg-slate-800/80 border-slate-700' 
                    : 'bg-white border-slate-300 shadow-sm'
                  : isDark
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-50'
                    : 'bg-slate-50 border-slate-100 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400 flex-shrink-0" />
                <div>
                  <span className={`text-xs font-extrabold block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    전체 동 평균선 (Site Average)
                  </span>
                  <span className="text-[9px] text-slate-400 block font-semibold mt-0.5">
                    현장 전체 가중 평균을 분석 점선으로 표시
                  </span>
                </div>
              </div>
              <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ${showAverage ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${showAverage ? 'translate-x-3' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>

          {/* Process Filter / Presets */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" /> 분석 공종 그룹 프리셋
            </label>
            <div className="flex flex-col gap-2">
              {[
                { id: 'key', label: '주요 배관/골조 공종', desc: '골조, 세팅, 알폼 및 핵심 분배기' },
                { id: 'piping', label: '설비 및 오배수 공종', desc: '지하 오배수, 난방횡주관, 수전구' },
                { id: 'all', label: '전체 공종 보기', desc: '현장 전체 22개 공정 일괄 비교' },
                { id: 'custom', label: '사용자 지정 공종', desc: '직접 원하는 공종을 선택하여 비교' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setProcessPreset(preset.id as any);
                    if (preset.id === 'custom') {
                      setShowCustomConfig(true);
                    }
                  }}
                  className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                    processPreset === preset.id 
                      ? isDark 
                        ? 'bg-slate-800/80 border-slate-700 ring-2 ring-blue-500/20' 
                        : 'bg-white border-slate-300 shadow-sm ring-2 ring-blue-500/10'
                      : isDark
                        ? 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/30'
                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-black ${processPreset === preset.id ? 'text-blue-600 dark:text-blue-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {preset.label}
                    </span>
                    {processPreset === preset.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-1">
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Custom Process Configurator */}
      <AnimatePresence>
        {processPreset === 'custom' && showCustomConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-6 mt-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  사용자 지정 분석 공종 구성
                </h4>
                <p className="text-[11px] text-slate-400 font-semibold">
                  분석할 공종을 선택해 주세요. (레이더 차트의 입체각 구성을 위해 최소 3개 이상 선택 권장)
                </p>
              </div>
              <button
                onClick={() => setShowCustomConfig(false)}
                className="text-xs font-black text-blue-500 hover:underline"
              >
                닫기
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {allProcesses.map(p => {
                const isSelected = customProcesses.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggleCustomProcess(p)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? isDark 
                          ? 'bg-blue-900/10 border-blue-500/30 text-blue-400' 
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                        : isDark
                          ? 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                          : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] font-bold truncate pr-1">
                      {p}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-md flex items-center justify-center border ${
                      isSelected 
                        ? 'bg-blue-500 border-blue-500 text-white' 
                        : isDark ? 'border-slate-700' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
