import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Info, Trash2, Settings, X, Check, ArrowRight, Layers, Plus, Minus, Clock, Zap, Copy, ClipboardPaste, RefreshCcw } from 'lucide-react';
import { AppState, BuildingData, UnitTypeConfig, DEFAULT_UNIT_TYPES } from '../types';

interface GolgudoViewProps {
  data: AppState;
  activeTheme: any;
  isDarkTheme: boolean;
  onUpdateBuilding: (id: number, updates: Partial<BuildingData>) => void;
  onDeleteBuilding: (id: number) => void;
  onAddBuilding: () => void;
  onResetAll?: () => void;
  onUpdateUnitTypeConfigs?: (configs: UnitTypeConfig[]) => void;
}

const GolgudoView: React.FC<GolgudoViewProps> = ({ data, activeTheme, isDarkTheme, onUpdateBuilding, onDeleteBuilding, onAddBuilding, onResetAll, onUpdateUnitTypeConfigs }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [dynamicFloorHeight, setDynamicFloorHeight] = useState(false);
  const [isEditingUnitTypes, setIsEditingUnitTypes] = useState(false);
  const unitTypeConfigs = useMemo(() => data.settings.unitTypeConfigs || DEFAULT_UNIT_TYPES, [data.settings.unitTypeConfigs]);
  const [layerOpacity, setLayerOpacity] = useState(1);
  const [copyBuffer, setCopyBuffer] = useState<Partial<BuildingData> | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [hoveredUnitType, setHoveredUnitType] = useState<string | null>(null);
  const [guideConfig, setGuideConfig] = useState<{ enabled: boolean, targets: number[] }>({
    enabled: true,
    targets: []
  });
  const [editValues, setEditValues] = useState<{name: string, minFloor: number, maxFloor: number, lines: number}>({
    name: '',
    minFloor: 0,
    maxFloor: 0,
    lines: 4
  });

  const handleCopyConfig = (b: BuildingData) => {
    const { mainFloors, basementFloors, lines } = getBuildingUnits(b);
    const effectiveUnitMap: Record<string, string> = {};
    
    // Capture effective unit types for all floors and lines
    const allFloors = [...mainFloors, ...basementFloors];
    allFloors.forEach(f => {
      if (f === 0) return;
      for (let l = 1; l <= lines; l++) {
        const key = `${f}:${l}`;
        effectiveUnitMap[key] = getUnitType(b, f, l);
      }
    });

    setCopyBuffer({
      maxFloor: b.maxFloor || data.settings.maxFloor,
      minFloor: b.minFloor || data.settings.minFloor,
      lines: b.lines || lines,
      unitMap: effectiveUnitMap
    });
  };

  const handlePasteConfig = (targetId: number) => {
    if (!copyBuffer) return;
    onUpdateBuilding(targetId, {
      maxFloor: copyBuffer.maxFloor,
      minFloor: copyBuffer.minFloor,
      lines: copyBuffer.lines,
      unitMap: copyBuffer.unitMap,
      lastLog: {
        type: 'floor_change',
        description: '타 단지 구성 일괄 복제됨',
        timestamp: new Date().toISOString()
      }
    });
    setCopyBuffer(null);
  };

  const startEditing = (b: BuildingData) => {
    setEditValues({
      name: b.name,
      minFloor: b.minFloor || data.settings.minFloor,
      maxFloor: b.maxFloor || data.settings.maxFloor,
      lines: b.lines || 4
    });
    setEditingId(b.id);
  };

  const handleSave = (id: number) => {
    const b = data.buildings.find(item => item.id === id);
    let logDesc = `${editValues.name} 정보 수정`;
    
    if (b) {
      const changes = [];
      if (b.name !== editValues.name) changes.push(`이름: ${b.name} -> ${editValues.name}`);
      if (b.maxFloor !== editValues.maxFloor) changes.push(`층수: ${b.maxFloor || data.settings.maxFloor}F -> ${editValues.maxFloor}F`);
      if (b.lines !== editValues.lines) changes.push(`호수: ${b.lines || 4}호 -> ${editValues.lines}호`);
      if (changes.length > 0) logDesc = changes.join(', ');
    }

    onUpdateBuilding(id, {
      name: editValues.name,
      minFloor: editValues.minFloor,
      maxFloor: editValues.maxFloor,
      lines: editValues.lines,
      lastLog: {
        type: 'floor_change',
        description: logDesc,
        timestamp: new Date().toISOString()
      }
    });
    setEditingId(null);
  };

  const recentMods = useMemo(() => {
    return data.buildings
      .filter(b => b.lastLog)
      .map(b => ({
        id: b.id,
        name: b.name,
        log: b.lastLog!
      }))
      .sort((a, b) => new Date(b.log.timestamp).getTime() - new Date(a.log.timestamp).getTime())
      .slice(0, 5);
  }, [data.buildings]);

  const getBuildingUnits = (building: BuildingData) => {
    const maxFloor = building.maxFloor || data.settings.maxFloor;
    const minFloor = building.minFloor || data.settings.minFloor;
    const lines = building.lines || 4;
    
    const mainFloors = [];
    if (maxFloor >= 20) {
      mainFloors.push(maxFloor + 2); // PH2
      mainFloors.push(maxFloor + 1); // PH1
    }
    for (let f = maxFloor; f >= 1; f--) {
      mainFloors.push(f);
    }
    
    const basementFloors = [];
    for (let b = 1; b <= Math.abs(minFloor); b++) {
      basementFloors.push(-b);
    }

    return { mainFloors, basementFloors, lines };
  };

  const getUnitType = (building: BuildingData, floor: number, line: number) => {
    const maxFloorNum = building.maxFloor || data.settings.maxFloor;
    const key = `${floor}:${line}`;

    // Hard rules for specific floors
    if (floor > maxFloorNum) return ''; // PH floors
    if (floor < 1 && floor !== 0) return ''; // B1, B2, etc. as requested

    if (building.unitMap && building.unitMap[key] !== undefined) {
      return building.unitMap[key];
    }

    if (floor === 1) return '필로티';
    
    if (unitTypeConfigs.length === 0) return '';
    const index = (building.id + Math.abs(floor) + line) % unitTypeConfigs.length;
    return unitTypeConfigs[index].type;
  };

  const cycleUnitType = (b: BuildingData, floor: number, line: number) => {
    const currentType = getUnitType(b, floor, line);
    const types = ['', '필로티', ...unitTypeConfigs.map(ut => ut.type)];
    const currentIndex = types.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex];

    const currentMap = b.unitMap || {};
    onUpdateBuilding(b.id, {
      unitMap: { ...currentMap, [`${floor}:${line}`]: nextType },
      lastLog: {
        type: 'unit_change',
        description: `${floor < 0 ? `B${Math.abs(floor)}` : `${floor}F`} ${line}호 -> ${nextType || '삭제'}`,
        timestamp: new Date().toISOString()
      }
    });
  };

  const cycleLineUnitType = (b: BuildingData, line: number) => {
    const maxFloor = b.maxFloor || data.settings.maxFloor;
    const minFloor = b.minFloor || data.settings.minFloor;
    
    // Get current type from a mid-floor to determine next cycle state
    const currentType = getUnitType(b, Math.floor(maxFloor/2) || 2, line);
    const types = ['', '필로티', ...unitTypeConfigs.map(ut => ut.type)];
    const currentIndex = types.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex];

    const newUnitMap = { ...(b.unitMap || {}) };
    
    // Apply types to main floors, keep PH and Basements empty
    for (let f = minFloor; f <= (maxFloor + 2); f++) {
      if (f === 0) continue;
      if (f > maxFloor || f < 1) {
        newUnitMap[`${f}:${line}`] = '';
      } else {
        newUnitMap[`${f}:${line}`] = nextType;
      }
    }

    onUpdateBuilding(b.id, {
      unitMap: newUnitMap,
      lastLog: {
        type: 'unit_change',
        description: `${line}호 라인 일괄 타입 변경 -> ${nextType || '삭제'}`,
        timestamp: new Date().toISOString()
      }
    });
  };

  const getTypeColorInfo = (type: string) => {
    if (!type) return { className: 'bg-transparent border border-dashed border-slate-200 dark:border-slate-800', style: {} };
    if (type === '필로티') return { className: 'bg-neutral-800 text-neutral-400', style: {} };
    
    const found = unitTypeConfigs.find(ut => ut.type === type);
    if (!found) return { className: 'bg-slate-200 text-slate-600', style: {} };
    
    const isTailwind = found.color.startsWith('bg-');
    return {
      className: `${isTailwind ? found.color : ''} ${found.textColor || 'text-white'}`,
      style: isTailwind ? {} : { backgroundColor: found.color }
    };
  };

  const getUnitStats = useMemo(() => {
    const stats: Record<string, number> = {};
    unitTypeConfigs.forEach(ut => { stats[ut.type] = 0; });
    
    data.buildings.forEach(b => {
      const { mainFloors, basementFloors } = getBuildingUnits(b);
      const allFloors = [...mainFloors, ...basementFloors];
      for (const f of allFloors) {
        if (f === 0) continue;
        for (let l = 1; l <= (b.lines || 4); l++) {
          const type = getUnitType(b, f, l);
          if (type && type !== '필로티') {
            stats[type] = (stats[type] || 0) + 1;
          }
        }
      }
    });
    return stats;
  }, [data.buildings, unitTypeConfigs, data.settings.maxFloor, data.settings.minFloor]);

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-[1700px] mx-auto font-sans">
      {/* Title Header */}
      <div className="text-center relative">
        <h1 className={`text-4xl md:text-7xl font-black mb-4 tracking-tighter ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
          {data.settings.projectName} 단지배치도(골구조도)
        </h1>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          <div className="flex items-center gap-4">
            <div className="h-[3px] w-12 md:w-24 bg-blue-600 rounded-full" />
            <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Vertical Unit Status Diagram</span>
            <div className="h-[3px] w-12 md:w-24 bg-blue-600 rounded-full" />
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {unitTypeConfigs.map(ut => {
              const colorInfo = getTypeColorInfo(ut.type);
              const isHovered = hoveredUnitType === ut.type;
              return (
                <div 
                  key={ut.type} 
                  onMouseEnter={() => setHoveredUnitType(ut.type)}
                  onMouseLeave={() => setHoveredUnitType(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md border cursor-help transition-all duration-300 ${isHovered ? 'scale-110 ring-2 ring-blue-500 z-10 border-blue-400' : 'border-white/10'} ${colorInfo.className}`}
                  style={colorInfo.style}
                >
                  <span className="text-[9px] font-black uppercase tracking-tighter">{ut.type}</span>
                </div>
              );
            })}
            <button 
              onClick={() => setIsEditingUnitTypes(true)}
              className="p-1.5 rounded-full bg-slate-200 hover:bg-blue-500 hover:text-white dark:bg-slate-800 transition-all shadow-sm flex items-center justify-center"
              title="세대 타입 및 색상 설정"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Opacity Control Slider */}
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-full shadow-inner">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Opacity</span>
            <input 
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
              className="w-24 md:w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[9px] font-black text-blue-500 w-8">{Math.round(layerOpacity * 100)}%</span>
          </div>

          {/* Guide Line Control Panel */}
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-full shadow-inner">
            <button 
              onClick={() => setGuideConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`p-1.5 rounded-full transition-all ${guideConfig.enabled ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}
              title="Align Guide Toggle"
            >
              <Zap className={`w-3.5 h-3.5 ${guideConfig.enabled ? 'fill-white' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter whitespace-nowrap">Target Floors</span>
              <div className="flex gap-1.5 max-w-[150px] overflow-x-auto no-scrollbar py-0.5">
                {[1, 10, 20, 25, 29].map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setGuideConfig(prev => {
                        const exists = prev.targets.includes(f);
                        return {
                          ...prev,
                          targets: exists ? prev.targets.filter(t => t !== f) : [...prev.targets, f]
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${guideConfig.targets.includes(f) ? 'bg-blue-500 text-white shadow-md shadow-blue-500/10' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {f}F
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setGuideConfig(prev => ({ ...prev, targets: [] }))}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                title="Clear all targets"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <button 
            onClick={() => setDynamicFloorHeight(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${dynamicFloorHeight ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}
            title="층고 동적 조절"
          >
            <Layers className={`w-3.5 h-3.5 ${dynamicFloorHeight ? 'text-white' : 'text-slate-400'}`} />
            {dynamicFloorHeight ? 'Dynamic Height ON' : 'Fixed Height'}
          </button>

          <button 
            onClick={() => setViewMode(prev => prev === '2d' ? '3d' : '2d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}
          >
            <div className={`w-3.5 h-3.5 flex items-center justify-center border-2 rounded-sm ${viewMode === '3d' ? 'border-white' : 'border-slate-400'}`}>
              <div className={`w-1.5 h-1.5 ${viewMode === '3d' ? 'bg-white' : 'bg-slate-400'} rounded-full`} />
            </div>
            {viewMode === '3d' ? '3D Isometric' : '2D Grid'}
          </button>

          <button 
            onClick={onResetAll}
            className="flex items-center gap-2 bg-slate-100 hover:bg-red-50 dark:bg-slate-900 dark:hover:bg-red-950/30 px-4 py-2 rounded-full text-[10px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest transition-all shadow-sm active:scale-95"
            title="모든 동 설정 초기화"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Reset All
          </button>

          <AnimatePresence>
            {copyBuffer && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => setCopyBuffer(null)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                <X className="w-3 h-3" />
                Cancel Copy
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Recent Modifications Panel */}
      <AnimatePresence>
        {recentMods.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center -mb-4 relative z-20"
          >
            <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 ${activeTheme.border} ${activeTheme.card} shadow-xl max-w-full overflow-x-auto no-scrollbar`}>
              <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Recent Modifications</span>
              </div>
              <div className="flex gap-6">
                {recentMods.map((mod, idx) => (
                  <div key={mod.id + idx} className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[10px] font-black text-blue-500">{mod.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{mod.log.description}</span>
                    <span className="text-[8px] font-medium text-slate-300">{new Date(mod.log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Table */}
      <div className={`overflow-hidden rounded-3xl border-2 ${activeTheme.border} ${activeTheme.card} shadow-2xl`}>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-separate border-spacing-0 min-w-max">
                <thead>
                  <tr className={`${activeTheme.header} text-white`}>
                    <th className="p-4 text-[11px] font-black border-r border-white/10 uppercase bg-black/20 sticky left-0 z-20">구분</th>
                    {unitTypeConfigs.map(ut => {
                      const colorInfo = getTypeColorInfo(ut.type);
                      return (
                        <th key={ut.type} className="p-4 text-[11px] font-black border-r border-white/10 min-w-[80px]">
                          <div className="flex flex-col items-center gap-2">
                            <div 
                              className={`px-3 py-1 rounded-lg shadow-md border border-white/20 text-[10px] uppercase tracking-tighter ${colorInfo.className}`} 
                              style={colorInfo.style}
                            >
                              {ut.type}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="p-4 text-[11px] font-black bg-black/10">계</th>
                  </tr>
                </thead>
            <tbody className={isDarkTheme ? 'text-white' : 'text-slate-900'}>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-white/5">
                <td className="p-3 text-[11px] font-black border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky left-0 z-10">세대수</td>
                {unitTypeConfigs.map(ut => {
                  const colorInfo = getTypeColorInfo(ut.type);
                  return (
                    <td key={ut.type} className="p-3 text-[11px] font-bold border-r border-slate-200 dark:border-slate-800">
                      <span className={`px-2 py-0.5 rounded shadow-sm ${colorInfo.className}`} style={colorInfo.style}>
                        {getUnitStats[ut.type] || 0}
                      </span>
                    </td>
                  );
                })}
                <td className="p-3 text-[11px] font-black bg-blue-500/10">
                  {Object.values(getUnitStats).reduce((a, b) => a + b, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Buildings Grid */}
      <div className={`grid gap-10 transition-all duration-700 ${viewMode === '3d' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 perspective-[2000px] py-20' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'}`}>
        {data.buildings.map((b) => {
          const { mainFloors, basementFloors, lines } = getBuildingUnits(b);
          const maxFloorNum = b.maxFloor || data.settings.maxFloor;
          
          return (
            <motion.div 
              key={b.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: layerOpacity, scale: 1 }}
              animate={{ 
                opacity: layerOpacity,
                rotateX: viewMode === '3d' ? 30 : 0,
                rotateZ: viewMode === '3d' ? -15 : 0,
                y: viewMode === '3d' ? -20 : 0,
                scale: viewMode === '3d' ? 0.9 : 1,
              }}
              viewport={{ once: true }}
              className={`flex flex-col border-2 ${activeTheme.border} ${activeTheme.card} rounded-[2rem] overflow-hidden shadow-2xl relative group transition-all duration-700 ${viewMode === '3d' ? 'shadow-[20px_40px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-[30px_60px_80px_-20px_rgba(59,130,246,0.3)] hover:-translate-y-4' : 'hover:-translate-y-1'}`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Building2 className="w-40 h-40" />
              </div>

              {/* Building Header */}
              <div className={`p-6 ${activeTheme.header} text-white relative z-10`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Building Unit Layout</div>
                  <div className="flex gap-2">
                    {copyBuffer ? (
                      <button 
                         onClick={() => handlePasteConfig(b.id)}
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[10px] font-black uppercase tracking-tighter transition-all shadow-lg animate-pulse"
                       >
                         <ClipboardPaste className="w-3.5 h-3.5" />
                         붙여넣기
                       </button>
                    ) : (
                      <button 
                        onClick={() => handleCopyConfig(b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        구성 복사
                      </button>
                    )}
                    <button 
                      onClick={() => startEditing(b)}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm"
                      title="동 정보 수정"
                    >
                      <Settings className="w-4 h-4 text-white" />
                    </button>
                    <button 
                      onClick={() => onDeleteBuilding(b.id)}
                      className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors shadow-sm"
                      title="동 삭제"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-3xl font-black tracking-tighter">{b.name}</span>
                      { (b.processes['건축골조'] ?? 0) === 100 && <div className="bg-green-500 rounded-full p-0.5 shadow-lg"><Check className="w-3 h-3 text-white" /></div> }
                    </div>
                    <span className="text-[10px] font-bold opacity-60">총 {(mainFloors.length + basementFloors.length) * lines}세대 (준공예정)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold opacity-60 uppercase">Progress (건축골조)</div>
                    <div className="text-xl font-black">{(b.processes['건축골조'] ?? 0)}%</div>
                  </div>
                </div>
                
                {/* Progress Bar in Header */}
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${b.processes['건축골조'] ?? 0}%` }}
                    className={`h-full ${(b.processes['건축골조'] ?? 0) === 100 ? 'bg-green-400' : 'bg-blue-400'} shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                  />
                </div>
              </div>

              {/* Editing Overlay */}
              <AnimatePresence>
                {editingId === b.id && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm p-6 flex flex-col justify-center gap-6"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-white font-black text-xl uppercase tracking-tighter flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        Building Options
                      </h3>
                      <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Building Name</label>
                        <input 
                          type="text"
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-white">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Floor Count</label>
                          <input 
                            type="number"
                            value={editValues.maxFloor}
                            onChange={(e) => setEditValues({ ...editValues, maxFloor: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Units Per Floor</label>
                          <input 
                            type="number"
                            value={editValues.lines}
                            onChange={(e) => setEditValues({ ...editValues, lines: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={() => handleSave(b.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        <Check className="w-5 h-5" />
                        UPDATE BUILDING
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid Header (Lines) */}
              <div className="grid border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 relative z-10" style={{ gridTemplateColumns: `50px repeat(${lines}, 1fr)` }}>
                <div className="p-3 text-[10px] font-black text-slate-400 text-center border-r-2 border-slate-200 dark:border-slate-800 uppercase">구분</div>
                {Array.from({ length: lines }).map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => cycleLineUnitType(b, i + 1)}
                    className="p-2 text-[10px] font-black text-blue-500 hover:bg-blue-500/10 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col items-center justify-center gap-1 transition-colors group cursor-pointer active:scale-95 shadow-inner"
                    title="클릭하여 라인 전체 타입 변경"
                  >
                    <span className="group-hover:scale-110 transition-transform">{i + 1}호</span>
                    <Zap className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              {/* Main Floors */}
              <div className="flex-1 overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-blue-500/20 relative z-10">
                {/* Max Floor Adjustment Handle */}
                <div className="flex items-center justify-center gap-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={() => {
                      const current = b.maxFloor || data.settings.maxFloor;
                      const newValue = Math.max(1, current - 1);
                      onUpdateBuilding(b.id, { 
                        maxFloor: newValue,
                        lastLog: {
                          type: 'floor_change',
                          description: `지상층수 하향: ${current}F -> ${newValue}F`,
                          timestamp: new Date().toISOString()
                        }
                      });
                    }}
                    className="p-1 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Height Control</span>
                  <button 
                    onClick={() => {
                      const current = b.maxFloor || data.settings.maxFloor;
                      const newValue = current + 1;
                      onUpdateBuilding(b.id, { 
                        maxFloor: newValue,
                        lastLog: {
                          type: 'floor_change',
                          description: `지상층수 상향: ${current}F -> ${newValue}F`,
                          timestamp: new Date().toISOString()
                        }
                      });
                    }}
                    className="p-1 rounded-md hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Line Adjustment Handle */}
                <div className="flex items-center justify-center gap-4 py-2 bg-slate-50/30 dark:bg-slate-900/10 border-b border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={() => {
                      const current = b.lines || 4;
                      const newValue = Math.max(1, current - 1);
                      onUpdateBuilding(b.id, { 
                        lines: newValue,
                        lastLog: {
                          type: 'floor_change',
                          description: `호라인 감축: ${current}호 -> ${newValue}호`,
                          timestamp: new Date().toISOString()
                        }
                      });
                    }}
                    className="p-1 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Line Control</span>
                  <button 
                    onClick={() => {
                      const current = b.lines || 4;
                      const newValue = current + 1;
                      onUpdateBuilding(b.id, { 
                        lines: newValue,
                        lastLog: {
                          type: 'floor_change',
                          description: `호라인 상향: ${current}호 -> ${newValue}호`,
                          timestamp: new Date().toISOString()
                        }
                      });
                    }}
                    className="p-1 rounded-md hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {mainFloors.map((fNum, fIdx) => {
                  const progress = b.processes['건축골조'] || 0;
                  const totalMainFloors = mainFloors.length;
                  const builtFloorCount = Math.floor((progress / 100) * totalMainFloors);
                  const isWireframe = fIdx < (totalMainFloors - builtFloorCount);
                  const isJustCompleted = !isWireframe && (fIdx === (totalMainFloors - builtFloorCount));
                  const isHovered = hoveredFloor === fNum;
                  const isPersistentGuide = guideConfig.enabled && guideConfig.targets.includes(fNum);
                  const showGuide = isHovered || isPersistentGuide;
                  
                  const totalBuildingFloors = mainFloors.length + basementFloors.length;
                  const floorScale = dynamicFloorHeight ? Math.max(0.6, Math.min(1, 22 / totalBuildingFloors)) : 1;

                  return (
                    <motion.div 
                      key={fNum} 
                      onMouseEnter={() => setHoveredFloor(fNum)}
                      onMouseLeave={() => setHoveredFloor(null)}
                      initial={false}
                      animate={{ 
                        backgroundColor: showGuide 
                          ? (isDarkTheme ? (isPersistentGuide ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.2)") : (isPersistentGuide ? "rgba(59, 130, 246, 0.05)" : "rgba(59, 130, 246, 0.1)"))
                          : isWireframe ? "rgba(0,0,0,0)" : (isDarkTheme ? "rgba(59, 130, 246, 0.05)" : "rgba(59, 130, 246, 0.02)"),
                        opacity: isWireframe ? 0.4 : 1
                      }}
                      className={`grid border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-blue-500/5 transition-colors relative group/floor ${isWireframe ? 'grayscale-[0.5]' : ''} ${showGuide ? 'z-30' : 'z-10'}`} 
                      style={{ 
                        gridTemplateColumns: `50px repeat(${lines}, 1fr)`,
                        minHeight: dynamicFloorHeight ? `${Math.floor(40 * floorScale)}px` : '40px'
                      }}
                    >
                      {/* Highlight Guide Line Overlay */}
                      {showGuide && (
                        <motion.div 
                          layoutId={isPersistentGuide ? undefined : "guide-line"}
                          className={`absolute inset-0 border-y ${isPersistentGuide ? 'border-blue-500/20' : 'border-blue-500/50'} pointer-events-none`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      )}

                      {/* Highlight Glow for Completed Floor */}
                      {!isWireframe && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`absolute inset-0 pointer-events-none border-l-4 ${showGuide ? 'border-blue-500' : 'border-blue-500/50'} z-20`}
                        />
                      )}

                      <div className={`p-2.5 text-[10px] font-black text-center border-r-2 border-slate-200 dark:border-slate-800 relative z-10 ${isWireframe ? 'text-slate-400 bg-slate-50/10' : 'text-slate-500 bg-slate-100/30 dark:bg-slate-900/30'} ${showGuide ? 'text-blue-500 bg-blue-50/50 dark:bg-blue-900/30' : ''} flex items-center justify-center`} style={{ padding: dynamicFloorHeight ? `${Math.floor(10 * floorScale)}px 0` : '' }}>
                        {fNum > maxFloorNum ? `PH${fNum - maxFloorNum}` : `${fNum}F`}
                        {!isWireframe && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1"
                          >
                             <Check className={`w-2.5 h-2.5 ${isHovered ? 'text-white bg-blue-500' : 'text-blue-500 bg-white dark:bg-slate-900'} rounded-full shadow-sm transition-colors`} />
                          </motion.div>
                        )}
                      </div>
                      {Array.from({ length: lines }).map((_, i) => {
                        const type = getUnitType(b, fNum, i + 1);
                        const colorInfo = getTypeColorInfo(type);
                        const isTypeHovered = hoveredUnitType !== null && type === hoveredUnitType;
                        const isOtherTypeHovered = hoveredUnitType !== null && type !== hoveredUnitType;
                        
                        return (
                          <button 
                            key={i} 
                            onClick={() => cycleUnitType(b, fNum, i + 1)}
                            className={`p-1.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex items-center justify-center hover:bg-blue-500/10 transition-all cursor-pointer group/unit shadow-inner active:scale-95 px-1 ${isOtherTypeHovered ? 'opacity-20 grayscale' : 'opacity-100'}`}
                            style={{ padding: dynamicFloorHeight ? `${Math.floor(6 * floorScale)}px 4px` : '' }}
                            title="클릭하여 타입 변경"
                          >
                            <div 
                              className={`w-full py-1.5 rounded-lg text-[9px] font-black text-center shadow-md uppercase tracking-tighter transition-all duration-300 min-h-[24px] flex items-center justify-center ${isTypeHovered ? 'ring-2 ring-blue-500 scale-110 z-10' : ''} ${isWireframe && type ? 'bg-transparent border-2 border-dashed border-blue-400/30 text-blue-400/60' : colorInfo.className}`}
                              style={{
                                ...((!isWireframe || !type) ? colorInfo.style : {}),
                                padding: dynamicFloorHeight ? `${Math.floor(6 * floorScale)}px 0` : '',
                                minHeight: dynamicFloorHeight ? `${Math.floor(24 * floorScale)}px` : '24px',
                                fontSize: dynamicFloorHeight ? `${Math.max(7, Math.floor(9 * floorScale))}px` : '9px'
                              }}
                            >
                              {type}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                );
              })}
              </div>

              {/* Basement Floors */}
              {basementFloors.length >= 0 && (
                <div className="bg-slate-100/50 dark:bg-slate-950/50 border-t-2 border-slate-200 dark:border-slate-800 relative z-10">
                   {/* Basement Adjustment Handle */}
                   <div className="flex items-center justify-center gap-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50">
                    <button 
                      onClick={() => {
                        const current = b.minFloor || data.settings.minFloor;
                        const newValue = current - 1;
                        onUpdateBuilding(b.id, { 
                          minFloor: newValue,
                          lastLog: {
                            type: 'floor_change',
                            description: `지하층수 증설: B${Math.abs(current)} -> B${Math.abs(newValue)}`,
                            timestamp: new Date().toISOString()
                          }
                        });
                      }}
                      className="p-1 rounded-md hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Basement Control</span>
                    <button 
                      onClick={() => {
                        const current = b.minFloor || data.settings.minFloor;
                        const newValue = Math.min(0, current + 1);
                        onUpdateBuilding(b.id, { 
                          minFloor: newValue,
                          lastLog: {
                            type: 'floor_change',
                            description: `지하층수 감축: B${Math.abs(current)} -> B${Math.abs(newValue)}`,
                            timestamp: new Date().toISOString()
                          }
                        });
                      }}
                      className="p-1 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>

                   {basementFloors.map(fNum => {
                     const isHovered = hoveredFloor === fNum;
                     const isPersistentGuide = guideConfig.enabled && guideConfig.targets.includes(fNum);
                     const showGuide = isHovered || isPersistentGuide;
                     
                     const totalBuildingFloors = mainFloors.length + basementFloors.length;
                     const floorScale = dynamicFloorHeight ? Math.max(0.6, Math.min(1, 22 / totalBuildingFloors)) : 1;

                     return (
                       <div 
                          key={fNum} 
                          onMouseEnter={() => setHoveredFloor(fNum)}
                          onMouseLeave={() => setHoveredFloor(null)}
                          className={`grid border-b border-slate-200/50 dark:border-slate-800/50 last:border-b-0 relative transition-colors ${showGuide ? (isDarkTheme ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`} 
                          style={{ 
                            gridTemplateColumns: `50px repeat(${lines}, 1fr)`,
                            minHeight: dynamicFloorHeight ? `${Math.floor(32 * floorScale)}px` : '32px'
                          }}
                        >
                          {showGuide && (
                             <motion.div 
                               layoutId={isPersistentGuide ? undefined : "guide-line"}
                               className={`absolute inset-0 border-y ${isPersistentGuide ? 'border-blue-500/10' : 'border-blue-500/20'} pointer-events-none`}
                               initial={{ opacity: 0 }}
                               animate={{ opacity: 1 }}
                             />
                           )}
                          <div className={`p-2 text-[10px] font-black text-center border-r-2 border-slate-200 dark:border-slate-800 transition-colors ${showGuide ? 'text-blue-500 bg-blue-100/20 shadow-inner' : 'text-slate-400'} flex items-center justify-center`} style={{ padding: dynamicFloorHeight ? `${Math.floor(6 * floorScale)}px 0` : '' }}>
                            B{Math.abs(fNum)}
                          </div>
                        {Array.from({ length: lines }).map((_, i) => {
                          const type = getUnitType(b, fNum, i + 1);
                          const colorInfo = getTypeColorInfo(type);
                          const isTypeHovered = hoveredUnitType !== null && type === hoveredUnitType;
                          const isOtherTypeHovered = hoveredUnitType !== null && type !== hoveredUnitType;
                          return (
                            <button 
                              key={i} 
                              onClick={() => cycleUnitType(b, fNum, i + 1)}
                              className={`p-1 border-r border-slate-200/50 dark:border-slate-800/50 last:border-r-0 hover:bg-white/5 transition-all group/unit min-h-[20px] flex items-center justify-center cursor-pointer px-1 ${isOtherTypeHovered ? 'opacity-20 grayscale' : 'opacity-100'}`}
                              style={{ padding: dynamicFloorHeight ? `${Math.floor(4 * floorScale)}px 4px` : '' }}
                              title="클릭하여 타입 변경"
                            >
                               {type ? (
                                <div 
                                  className={`w-full py-0.5 rounded text-[7px] font-black text-center uppercase tracking-tighter opacity-50 group-hover/unit:opacity-100 transition-all duration-300 ${isTypeHovered ? 'scale-125 opacity-100 ring-1 ring-blue-500 z-10' : ''} ${colorInfo.className}`}
                                  style={{
                                    ...colorInfo.style,
                                    fontSize: dynamicFloorHeight ? `${Math.max(6, Math.floor(7 * floorScale))}px` : '7px'
                                  }}
                                >
                                   {type}
                                </div>
                               ) : (
                                <div className="w-full h-4 border border-dashed border-slate-300 dark:border-slate-700 rounded opacity-40" />
                               )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Building Footer (Log Label) */}
              {b.lastLog && (
                <div className="p-3 bg-slate-100/30 dark:bg-slate-950/30 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 backdrop-blur-md">
                   <div className="flex items-center gap-2">
                     <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                     <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Last Change</span>
                   </div>
                   <div className="flex flex-col items-end">
                     <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{b.lastLog.description}</span>
                     <span className="text-[8px] font-medium text-slate-400">{new Date(b.lastLog.timestamp).toLocaleTimeString()}</span>
                   </div>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Add Building Placeholder */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{ opacity: layerOpacity }}
          onClick={onAddBuilding}
          className={`flex flex-col items-center justify-center border-2 border-dashed ${activeTheme.border} ${activeTheme.card} rounded-[2rem] p-10 min-h-[400px] group transition-all hover:border-blue-500 hover:bg-blue-500/5`}
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner">
            <Building2 className="w-8 h-8 text-slate-400 group-hover:text-white" />
          </div>
          <span className="text-sm font-black text-slate-400 group-hover:text-blue-500 uppercase tracking-widest">Add New Building</span>
          <p className="text-[10px] font-bold text-slate-500 mt-2 opacity-60">동 정보를 추가하여 배치도를 확장하세요</p>
        </motion.button>
      </div>

      {/* Unit Type Configuration Modal */}
      <AnimatePresence>
        {isEditingUnitTypes && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-2xl ${activeTheme.card} rounded-[2.5rem] border-2 ${activeTheme.border} shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
            >
              <div className={`p-8 ${activeTheme.header} text-white flex justify-between items-center`}>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Unit Type Configuration</h3>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Manage color mapping for each generation type</p>
                </div>
                <button 
                  onClick={() => setIsEditingUnitTypes(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type Name</th>
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Color Class (Tailwind)</th>
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Preview</th>
                        <th className="pb-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {unitTypeConfigs.map((ut, idx) => {
                        const colorInfo = getTypeColorInfo(ut.type);
                        return (
                          <tr key={idx} className="group">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div 
                                className={`w-10 h-10 rounded-xl shadow-lg border-2 border-white/20 flex items-center justify-center transition-all ${colorInfo.className}`}
                                style={colorInfo.style}
                              >
                                 <span className="text-[10px] font-black">{ut.type}</span>
                              </div>
                              <input 
                                type="text"
                                value={ut.type}
                                onChange={(e) => {
                                  const newConfigs = [...unitTypeConfigs];
                                  newConfigs[idx] = { ...ut, type: e.target.value };
                                  onUpdateUnitTypeConfigs?.(newConfigs);
                                }}
                                placeholder="e.g. 84A"
                                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 outline-none font-black text-blue-500 focus:ring-2 focus:ring-blue-500/20 w-32"
                              />
                            </div>
                          </td>
                          <td className="py-3">
                            <input 
                              type="text"
                              value={ut.color}
                              onChange={(e) => {
                                const newConfigs = [...unitTypeConfigs];
                                newConfigs[idx] = { ...ut, color: e.target.value };
                                onUpdateUnitTypeConfigs?.(newConfigs);
                              }}
                              placeholder="bg-blue-500 or #HEX"
                              className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 outline-none font-bold text-slate-400 focus:ring-2 focus:ring-blue-500/20 w-full text-xs"
                            />
                          </td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => {
                                if (!window.confirm(`'${ut.type}' 타입을 삭제하시겠습니까?`)) return;
                                const newConfigs = unitTypeConfigs.filter((_, i) => i !== idx);
                                onUpdateUnitTypeConfigs?.(newConfigs);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <button 
                    onClick={() => {
                      const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                      const randomColor = colors[Math.floor(Math.random() * colors.length)];
                      onUpdateUnitTypeConfigs?.([...unitTypeConfigs, { type: 'New', color: randomColor, textColor: 'text-white' }]);
                    }}
                    className="mt-4 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-all font-black uppercase text-[10px] tracking-widest"
                  >
                    <Plus className="w-4 h-4" />
                    새 세대 타입 추가
                  </button>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                <button 
                  onClick={() => setIsEditingUnitTypes(false)}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-tighter shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GolgudoView;
