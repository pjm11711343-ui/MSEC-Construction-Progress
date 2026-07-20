import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Info, Trash2, Settings, X, Check, ArrowRight, Layers, Plus, Minus, Clock, Zap, Copy, ClipboardPaste, RefreshCcw, Eraser, Printer } from 'lucide-react';
import { AppState, BuildingData, UnitTypeConfig, DEFAULT_UNIT_TYPES, DEFAULT_PROCESSES } from '../types';

interface GolgudoViewProps {
  data: AppState;
  activeTheme: any;
  isDarkTheme: boolean;
  onUpdateBuilding: (id: number, updates: Partial<BuildingData>) => void;
  onDeleteBuilding: (id: number) => void;
  onAddBuilding: () => void;
  onResetAll?: () => void;
  onUpdateUnitTypeConfigs?: (configs: UnitTypeConfig[]) => void;
  onClose?: () => void;
}

const GolgudoView: React.FC<GolgudoViewProps> = ({ data, activeTheme, isDarkTheme, onUpdateBuilding, onDeleteBuilding, onAddBuilding, onResetAll, onUpdateUnitTypeConfigs, onClose }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [dynamicFloorHeight, setDynamicFloorHeight] = useState(false);
  const [isEditingUnitTypes, setIsEditingUnitTypes] = useState(false);
  const unitTypeConfigs = useMemo(() => data.settings.unitTypeConfigs || DEFAULT_UNIT_TYPES, [data.settings.unitTypeConfigs]);
  const [layerOpacity, setLayerOpacity] = useState(1);
  const [copyBuffer, setCopyBuffer] = useState<Partial<BuildingData> | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [hoveredUnitType, setHoveredUnitType] = useState<string | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null);
  const [isProcessSynced, setIsProcessSynced] = useState(true);
  const [isWideView, setIsWideView] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [showRecentMods, setShowRecentMods] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const [layoutConfig, setLayoutConfig] = useState({
    cellHeight: 40,
    fontSize: 9,
    gridGap: 40,
    cardWidth: 350,
    showSettings: false
  });

  const visibleProcesses = useMemo(() => {
    return [
      "1. 건축골조",
      "5. 스리브",
      "8. 단위세대오배수",
      "11. 세대 수전구",
      "15. 세대 SP배관",
      "17. 세대 난방코일",
      "18. 세대 환기&직배기"
    ];
  }, []);

  const handlePrint = () => {
    window.print();
  };

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

  // Keyboard Shortcuts for Efficiency
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1-9 Keys to select unit types
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (unitTypeConfigs[index]) {
          setSelectedUnitType(unitTypeConfigs[index].type);
        }
      }
      // 'Esc' to clear selection
      if (e.key === 'Escape') {
        setSelectedUnitType(null);
        setHoveredUnitType(null);
      }
    };

    const handleMouseUp = () => setIsPainting(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [unitTypeConfigs]);

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
    if (isLocked) {
      alert('편집 잠금 상태입니다. 상단 열쇠 아이콘을 눌러 잠금을 해제하세요.');
      return;
    }
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
    
    if (building.unitMap && building.unitMap[key] !== undefined) {
      return building.unitMap[key];
    }

    if (floor < 1 && floor !== 0) return ''; // B1, B2, etc. default empty if not in map
    if (floor === 1) return '필로티';
    
    if (unitTypeConfigs.length === 0) return '';
    const index = (building.id + Math.abs(floor) + line) % unitTypeConfigs.length;
    return unitTypeConfigs[index].type;
  };

  const cycleUnitType = (b: BuildingData, floor: number, line: number) => {
    if (isLocked) return;
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

  const applyTypeToBuilding = (b: BuildingData) => {
    if (isLocked || !onUpdateBuilding || !selectedUnitType) return;
    
    if (!window.confirm(`${b.name}의 모든 세대를 ${selectedUnitType || '삭제'} 타입으로 일괄 변경하시겠습니까?`)) {
      return;
    }
    
    const { mainFloors, basementFloors, lines } = getBuildingUnits(b);
    const allFloors = [...mainFloors, ...basementFloors];
    const newUnitMap = { ...(b.unitMap || {}) };
    
    allFloors.forEach(f => {
      if (f === 0) return;
      for (let l = 1; l <= lines; l++) {
        const maxFloorNum = b.maxFloor || data.settings.maxFloor;
        if (f > maxFloorNum || f < 1) {
           newUnitMap[`${f}:${l}`] = '';
        } else {
           newUnitMap[`${f}:${l}`] = selectedUnitType;
        }
      }
    });

    onUpdateBuilding(b.id, { 
      unitMap: newUnitMap,
      lastLog: {
        type: 'unit_change',
        description: `동 전체 타입 일괄 적용 -> ${selectedUnitType}`,
        timestamp: new Date().toISOString()
      }
    });

    // Check for Alt key sync
    if (window.event && (window.event as any).altKey) {
      data.buildings.forEach(otherB => {
        if (otherB.id === b.id) return;
        const otherMap = { ...(otherB.unitMap || {}) };
        const { mainFloors: mF, basementFloors: bF, lines: oL } = getBuildingUnits(otherB);
        [...mF, ...bF].forEach(f => {
          if (f === 0) return;
          for (let l = 1; l <= oL; l++) {
            otherMap[`${f}:${l}`] = selectedUnitType;
          }
        });
        onUpdateBuilding(otherB.id, { unitMap: otherMap });
      });
    }
  };

  const applyTypeToFloor = (b: BuildingData, floor: number) => {
    if (isLocked || !onUpdateBuilding) return;
    const { lines } = getBuildingUnits(b);
    
    let nextType = selectedUnitType;
    if (nextType === null) {
      const current = getUnitType(b, floor, 1);
      const types = ['', '필로티', ...unitTypeConfigs.map(ut => ut.type)];
      const currentIndex = types.indexOf(current);
      nextType = types[(currentIndex + 1) % types.length];
    } else {
      // Safety confirmation for bulk apply
      if (!window.confirm(`${floor < 0 ? `B${Math.abs(floor)}` : `${floor}F`} 층의 모든 세대를 ${nextType || '삭제'} 타입으로 변경하시겠습니까?`)) {
        return;
      }
    }

    const newUnitMap = { ...(b.unitMap || {}) };
    for (let l = 1; l <= lines; l++) {
      newUnitMap[`${floor}:${l}`] = nextType;
    }

    onUpdateBuilding(b.id, { 
      unitMap: newUnitMap,
      lastLog: {
        type: 'unit_change',
        description: `${floor < 0 ? `B${Math.abs(floor)}` : `${floor}F`} 층 전체 타입 변경 -> ${nextType || '삭제'}`,
        timestamp: new Date().toISOString()
      }
    });

    // Sync to all buildings on Alt+Click
    if (window.event && (window.event as any).altKey) {
      data.buildings.forEach(otherB => {
        if (otherB.id === b.id) return;
        const otherMap = { ...(otherB.unitMap || {}) };
        const { lines: oL } = getBuildingUnits(otherB);
        for (let l = 1; l <= oL; l++) {
          otherMap[`${floor}:${l}`] = nextType;
        }
        onUpdateBuilding(otherB.id, { unitMap: otherMap });
      });
    }
  };

  const cycleLineUnitType = (b: BuildingData, line: number) => {
    if (isLocked) return;
    const maxFloor = b.maxFloor || data.settings.maxFloor;
    const minFloor = b.minFloor || data.settings.minFloor;
    
    let nextType: string;
    if (selectedUnitType !== null) {
      nextType = selectedUnitType;
      // Safety confirmation for bulk line apply
      if (!window.confirm(`${b.name} ${line}호 라인 전체를 ${nextType || '삭제'} 타입으로 일괄 변경하시겠습니까?`)) {
        return;
      }
    } else {
      const currentType = getUnitType(b, Math.floor(maxFloor/2) || 2, line);
      const types = ['', '필로티', ...unitTypeConfigs.map(ut => ut.type)];
      const currentIndex = types.indexOf(currentType);
      const nextIndex = (currentIndex + 1) % types.length;
      nextType = types[nextIndex];
    }

    const newUnitMap = { ...(b.unitMap || {}) };
    
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

    // Sync to all buildings on Alt+Click
    if (window.event && (window.event as any).altKey) {
      data.buildings.forEach(otherB => {
        if (otherB.id === b.id) return;
        const { lines: oLines } = getBuildingUnits(otherB);
        const oMax = otherB.maxFloor || data.settings.maxFloor;
        const oMin = otherB.minFloor || data.settings.minFloor;
        if (line > oLines) return;
        const otherMap = { ...(otherB.unitMap || {}) };
        for (let f = oMin; f <= (oMax + 2); f++) {
          if (f === 0) continue;
          if (f > oMax || f < 1) {
            otherMap[`${f}:${line}`] = '';
          } else {
            otherMap[`${f}:${line}`] = nextType;
          }
        }
        onUpdateBuilding(otherB.id, { unitMap: otherMap });
      });
    }
  };

  const getTypeColorInfo = (type: string) => {
    if (!type) return { className: 'bg-transparent border border-dashed border-slate-200 dark:border-slate-800', style: { borderStyle: 'dashed' } };
    if (type === '필로티') return { className: 'bg-neutral-800 text-neutral-400', style: { backgroundColor: '#262626', color: '#a3a3a3' } };
    
    const found = unitTypeConfigs.find(ut => ut.type === type);
    if (!found) return { className: 'bg-slate-200 text-slate-600', style: { backgroundColor: '#e2e8f0', color: '#475569' } };
    
    const isTailwind = found.color.startsWith('bg-');
    
    // Default fallback colors for common tailwind prefixes if used in types.ts defaults
    const tailwindMapping: Record<string, string> = {
      'bg-emerald-500': '#10b981',
      'bg-amber-500': '#f59e0b',
      'bg-indigo-500': '#6366f1',
      'bg-rose-500': '#f43f5e',
      'bg-cyan-500': '#06b6d4'
    };

    const bgColor = isTailwind ? (tailwindMapping[found.color] || '#3b82f6') : found.color;
    
    return {
      className: `${isTailwind ? found.color : ''} ${found.textColor || 'text-white'}`,
      style: { 
        backgroundColor: bgColor, 
        color: found.textColor === 'text-slate-900' ? '#0f172a' : '#ffffff' 
      }
    };
  };

  const getProcessProgress = (b: BuildingData, processName: string) => {
    const key = Object.keys(b.processes).find(k => k.includes(processName)) || processName;
    return b.processes[key] || 0;
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
    <div className="p-4 md:p-8 space-y-12 max-w-[1700px] mx-auto font-sans print-container">
      <style>
        {`
          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }
            body {
              background: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .buildings-grid {
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 15px !important;
              justify-content: center !important;
            }
            .building-card {
              break-inside: avoid;
              border: 1.5px solid #cbd5e1 !important;
              box-shadow: none !important;
              width: 320px !important;
              min-width: 320px !important;
              background-color: white !important;
              margin-bottom: 15px;
            }
            .unit-cell, .unit-cell * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-header {
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-start !important;
              margin-bottom: 2rem;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 1rem;
              width: 100%;
            }
            .sticky {
              position: static !important;
            }
          }
        `}
      </style>

      {/* Title Header */}
      <div className="text-center relative space-y-8">
        <div className="print-header">
          <div className="flex flex-col items-start gap-1">
            <h1 className={`text-2xl md:text-4xl font-black tracking-tighter drop-shadow-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'} antialiased underline-offset-8`}>
              {data.settings.projectName} 단지배치도(골구조도)
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest no-print">골구조도 현황판 (Golgudo Status Board)</p>
          </div>
          <div className="no-print flex items-center gap-3">
            <button 
              onClick={() => setIsLocked(prev => !prev)}
              className={`p-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isLocked ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-2 border-emerald-200'}`}
              title={isLocked ? "편집 잠금 해제" : "실수 방지 잠금 설정"}
            >
              {isLocked ? <Zap className="w-4 h-4 fill-current" /> : <Settings className="w-4 h-4" />}
              <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <div className="w-[1px] h-6 bg-slate-300 mx-1" />
            <button 
              onClick={() => setLayoutConfig(prev => ({ ...prev, showSettings: !prev.showSettings }))}
              className={`p-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${layoutConfig.showSettings ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 border-2 border-slate-200 dark:border-slate-700'}`}
              title="레이아웃 간격 및 크기 조절"
            >
              <Layers className="w-4 h-4" />
              <span>Layout</span>
            </button>
            <button 
              onClick={() => setShowSummary(prev => !prev)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${showSummary ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:text-white'}`}
              title="요약 테이블 토글"
            >
              {showSummary ? 'Hide Summary' : 'Show Summary'}
            </button>
            <button 
              onClick={() => setShowRecentMods(prev => !prev)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${showRecentMods ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:text-white'}`}
              title="최근 수정 로그 토글"
            >
              {showRecentMods ? 'Hide Logs' : 'Show Logs'}
            </button>
            <div className="w-[2px] h-8 bg-slate-200 dark:bg-slate-800 mx-1" />
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button 
              onClick={() => setIsEditingUnitTypes(true)}
              className="w-10 h-10 rounded-xl bg-slate-200 hover:bg-blue-500 hover:text-white dark:bg-white/10 transition-all flex items-center justify-center group shadow-inner"
              title="세대 타입 및 색상 설정"
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-500 hover:text-white dark:bg-red-950/20 transition-all flex items-center justify-center group shadow-md"
                title="닫기"
              >
                <X className="w-4 h-4 text-red-500 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {layoutConfig.showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center -mb-4 relative z-20 no-print"
          >
            <div className={`p-6 rounded-[2rem] border-2 ${activeTheme.border} ${activeTheme.card} shadow-xl flex flex-wrap gap-8 items-center justify-center`}>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <Layers className="w-3 h-3" />
                   Cell Height ({layoutConfig.cellHeight}px)
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="20" max="80" step="1" 
                    value={layoutConfig.cellHeight} 
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, cellHeight: parseInt(e.target.value) }))}
                    className="w-32 accent-blue-500"
                  />
                  <div className="flex gap-1">
                    {[24, 32, 40, 50, 60].map(v => (
                       <button 
                        key={v} 
                        onClick={() => setLayoutConfig(prev => ({ ...prev, cellHeight: v }))}
                        className={`px-2 py-1 rounded text-[9px] font-bold ${layoutConfig.cellHeight === v ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:bg-slate-700'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-slate-200 dark:bg-slate-800" />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <Plus className="w-3 h-3 text-emerald-500" />
                   Grid Gap ({layoutConfig.gridGap}px)
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="0" max="100" step="5" 
                    value={layoutConfig.gridGap} 
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, gridGap: parseInt(e.target.value) }))}
                    className="w-32 accent-emerald-500"
                  />
                  <div className="flex gap-1">
                    {[0, 10, 20, 40, 60].map(v => (
                       <button 
                        key={v} 
                        onClick={() => setLayoutConfig(prev => ({ ...prev, gridGap: v }))}
                        className={`px-2 py-1 rounded text-[9px] font-bold ${layoutConfig.gridGap === v ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:bg-slate-700'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-slate-200 dark:bg-slate-800" />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <ArrowRight className="w-3 h-3 text-amber-500" />
                   Card Width ({layoutConfig.cardWidth}px)
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="200" max="600" step="10" 
                    value={layoutConfig.cardWidth} 
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, cardWidth: parseInt(e.target.value) }))}
                    className="w-32 accent-amber-500"
                  />
                  <div className="flex gap-1">
                    {[280, 320, 350, 400, 500].map(v => (
                       <button 
                        key={v} 
                        onClick={() => setLayoutConfig(prev => ({ ...prev, cardWidth: v }))}
                        className={`px-2 py-1 rounded text-[9px] font-bold ${layoutConfig.cardWidth === v ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:bg-slate-700'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-slate-200 dark:bg-slate-800" />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <Settings className="w-3 h-3 text-indigo-500" />
                   Font Size ({layoutConfig.fontSize}px)
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="6" max="16" step="0.5" 
                    value={layoutConfig.fontSize} 
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, fontSize: parseFloat(e.target.value) }))}
                    className="w-24 accent-indigo-500"
                  />
                  <div className="flex gap-1">
                    {[7, 8, 9, 10, 12].map(v => (
                      <button 
                        key={v} 
                        onClick={() => setLayoutConfig(prev => ({ ...prev, fontSize: v }))}
                        className={`px-2 py-1 rounded text-[9px] font-bold ${layoutConfig.fontSize === v ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:dark:bg-slate-700'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-slate-200 dark:bg-slate-800" />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <Clock className="w-3 h-3 text-blue-500" />
                   Height Mode
                </label>
                <button 
                  onClick={() => setDynamicFloorHeight(prev => !prev)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dynamicFloorHeight ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 hover:dark:bg-slate-700'}`}
                >
                  {dynamicFloorHeight ? 'Auto-Fit ON' : 'Fixed Height'}
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                 <button 
                    onClick={() => setLayoutConfig({
                      cellHeight: 40,
                      fontSize: 9,
                      gridGap: 40,
                      cardWidth: 350,
                      showSettings: true
                    })}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all flex items-center gap-2 text-[10px] font-black uppercase"
                 >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Reset
                 </button>
                 <button 
                    onClick={() => setLayoutConfig(prev => ({ ...prev, showSettings: false }))}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                 >
                    <X className="w-4 h-4" />
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Modifications Panel */}
      <AnimatePresence>
        {showRecentMods && recentMods.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center -mb-4 relative z-20 no-print"
          >
            <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 ${activeTheme.border} ${activeTheme.card} shadow-xl max-w-full overflow-x-auto no-scrollbar relative`}>
               <button 
                onClick={() => setShowRecentMods(false)}
                className="absolute top-1 right-1 p-1 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                title="Hide Logs"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Recent Modifications</span>
              </div>
              <div className="flex gap-6">
                {recentMods.map((mod, idx) => (
                  <div key={`${mod.id}-${idx}-${mod.log.timestamp}`} className="flex items-center gap-2 whitespace-nowrap">
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
      <AnimatePresence>
        {showSummary && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-3xl border-2 ${activeTheme.border} ${activeTheme.card} shadow-2xl relative group/table no-print`}
          >
             <button 
              onClick={() => setShowSummary(false)}
              className="absolute top-4 right-4 z-30 p-2 bg-slate-900/5 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover/table:opacity-100 no-print"
              title="Close Summary Table"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-separate border-spacing-0 min-w-max">
                <thead>
                  <tr className={`${activeTheme.header} text-white`}>
                    <th className="p-4 text-[11px] font-black border-r border-white/10 uppercase bg-black/20 sticky left-0 z-20">구분</th>
                    {unitTypeConfigs.map(ut => {
                      const colorInfo = getTypeColorInfo(ut.type);
                      const activeFilter = selectedUnitType || hoveredUnitType;
                      const isHovered = activeFilter === ut.type;
                      return (
                        <th 
                          key={ut.type} 
                          onMouseEnter={() => setHoveredUnitType(ut.type)}
                          onMouseLeave={() => setHoveredUnitType(null)}
                          onClick={() => setSelectedUnitType(prev => prev === ut.type ? null : ut.type)}
                          className={`p-4 text-[11px] font-black border-r border-white/10 min-w-[90px] transition-all duration-300 cursor-pointer ${isHovered ? 'ring-2 ring-inset ring-white/30 overflow-visible z-20' : ''}`}
                          style={{
                            backgroundColor: `${colorInfo.style?.backgroundColor}cc` || undefined,
                          }}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div 
                              className={`w-full py-2 rounded-lg shadow-lg border-2 border-white/40 text-[10px] font-black uppercase tracking-tighter transition-all duration-300 flex items-center justify-center ${isHovered ? 'scale-110 shadow-xl' : ''}`} 
                              style={{
                                backgroundColor: colorInfo.style?.backgroundColor,
                                color: colorInfo.style?.color
                              }}
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
                  const activeFilter = selectedUnitType || hoveredUnitType;
                  const isHovered = activeFilter === ut.type;
                  return (
                    <td 
                      key={ut.type} 
                      onMouseEnter={() => setHoveredUnitType(ut.type)}
                      onMouseLeave={() => setHoveredUnitType(null)}
                      onClick={() => setSelectedUnitType(prev => prev === ut.type ? null : ut.type)}
                      className={`p-2 px-3 text-[11px] font-bold border-r border-slate-200 dark:border-slate-800 transition-all duration-300 cursor-pointer ${isHovered ? 'ring-2 ring-inset ring-blue-500/30 bg-blue-500/5' : ''}`}
                      style={{
                        backgroundColor: colorInfo.style?.backgroundColor ? `${colorInfo.style.backgroundColor}22` : undefined
                      }}
                    >
                      <div 
                        className={`w-full py-2 rounded-lg shadow-md font-black transition-all duration-300 flex items-center justify-center ${isHovered ? 'scale-110 shadow-lg border border-white/30' : ''}`} 
                        style={{
                          backgroundColor: colorInfo.style?.backgroundColor,
                          color: colorInfo.style?.color
                        }}
                      >
                        {getUnitStats[ut.type] || 0}
                      </div>
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
      </motion.div>
      )}
      </AnimatePresence>

      {/* Buildings Container */}
      <div 
        className={`buildings-grid transition-all duration-700 ${isWideView ? 'flex flex-nowrap overflow-x-auto pb-12 items-end min-h-[600px] custom-scrollbar' : `grid ${viewMode === '3d' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 perspective-[2000px] py-20' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'}`}`}
        style={{ gap: `${layoutConfig.gridGap}px` }}
      >
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
              className={`building-card flex flex-col border-2 ${activeTheme.border} ${activeTheme.card} rounded-[2rem] overflow-hidden shadow-2xl relative group transition-all duration-700 ${isWideView ? '' : ''} ${viewMode === '3d' ? 'shadow-[20px_40px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-[30px_60px_80px_-20px_rgba(59,130,246,0.3)] hover:-translate-y-4' : 'hover:-translate-y-1'}`}
              style={{ minWidth: isWideView ? `${layoutConfig.cardWidth}px` : undefined, maxWidth: isWideView ? `${layoutConfig.cardWidth}px` : undefined, width: !isWideView ? '100%' : undefined }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Building2 className="w-40 h-40" />
              </div>

              {/* Building Header */}
              <div className={`p-6 ${activeTheme.header} text-white relative z-20 sticky top-0 shadow-lg backdrop-blur-sm`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Building Unit Layout</div>
                  <div className="flex gap-2">
                    {copyBuffer ? (
                      <button 
                         onClick={() => handlePasteConfig(b.id)}
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[10px] font-black uppercase tracking-tighter transition-all shadow-lg animate-pulse"
                         title="복사된 세대 구성 이 동에 붙여넣기"
                       >
                         <ClipboardPaste className="w-3.5 h-3.5" />
                         붙여넣기
                       </button>
                    ) : (
                      <button 
                        onClick={() => handleCopyConfig(b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm"
                        title="이 동의 세대 구성을 복사"
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
                    <div className="text-xl font-black">{getProcessProgress(b, '건축골조')}%</div>
                  </div>
                </div>
                
                {/* Progress Bar in Header */}
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${getProcessProgress(b, '건축골조')}%` }}
                    className={`h-full ${getProcessProgress(b, '건축골조') === 100 ? 'bg-green-400' : 'bg-blue-400'} shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
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
              <div className="flex no-print sticky top-[136px] z-[60] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b-2 border-slate-200 dark:border-slate-800">
                <div className="flex-1 grid" style={{ gridTemplateColumns: `50px repeat(${lines}, 1fr)` }}>
                  <button 
                    onClick={() => applyTypeToBuilding(b)}
                    disabled={!selectedUnitType}
                    className={`p-3 text-center border-r-2 border-slate-200 dark:border-slate-800 uppercase transition-all ${selectedUnitType ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-pointer active:scale-95' : 'text-slate-400'}`}
                    style={{ fontSize: `${Math.max(8, layoutConfig.fontSize + 1)}px`, fontWeight: 900 }}
                    title={selectedUnitType ? `전체 호실을 ${selectedUnitType} 타입으로 일괄 변경 (Alt+클릭: 전 단지 동일 적용)` : '타입 선택 후 클릭 시 전체 변경'}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>구분</span>
                      {selectedUnitType && <Zap className="w-2.5 h-2.5 fill-blue-500" />}
                    </div>
                  </button>
                  {Array.from({ length: lines }).map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => cycleLineUnitType(b, i + 1)}
                      className="p-2 text-blue-500 hover:bg-blue-500/10 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col items-center justify-center gap-1 transition-colors group cursor-pointer active:scale-95 shadow-inner font-black"
                      style={{ fontSize: `${Math.max(8, layoutConfig.fontSize + 1)}px` }}
                      title={selectedUnitType ? `${i + 1}호 라인 전체를 ${selectedUnitType} 타입으로 변경 (Alt+클릭: 전 단지 적용)` : '클릭하여 라인 전체 타입 변경 (Alt+클릭: 전 단지 적용)'}
                    >
                      <span className="group-hover:scale-110 transition-transform">{i + 1}호</span>
                      <Zap className={`w-2.5 h-2.5 transition-opacity ${selectedUnitType ? 'opacity-100 fill-blue-500' : 'opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  ))}
                </div>
                <div className="w-[60px] flex items-center justify-center border-l border-slate-200 dark:border-slate-800">
                  <span className="text-[7px] font-black uppercase text-slate-400 rotate-90">Progress</span>
                </div>
              </div>

              {/* Main Floors */}
              <div className="flex-1 relative z-10">
                {/* Max Floor Adjustment Handle */}
                <div className="flex no-print">
                  <div className="flex-1 flex items-center justify-center gap-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
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
                  <div className="w-[60px] border-l border-b border-slate-200 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10" />
                </div>

                {/* Line Adjustment Handle */}
                <div className="flex no-print">
                  <div className="flex-1 flex items-center justify-center gap-4 py-2 bg-slate-50/30 dark:bg-slate-900/10 border-b border-slate-200 dark:border-slate-800">
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
                  <div className="w-[60px] border-l border-b border-slate-200 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10" />
                </div>

                {mainFloors.map((fNum, fIdx) => {
                  const progress = getProcessProgress(b, '건축골조');
                  const totalMainFloors = mainFloors.length;
                  const builtFloorCount = Math.floor((progress / 100) * totalMainFloors);
                  
                  // A floor is wireframe if its index is smaller than the remaining unbuilt count (top-down list)
                  const isWireframe = isProcessSynced && fIdx < (totalMainFloors - builtFloorCount);
                  const isWorkingFloor = isProcessSynced && fIdx === (totalMainFloors - builtFloorCount - 1) && progress < 100;
                  
                  const isHovered = hoveredFloor === fNum;
                  const isPersistentGuide = guideConfig.enabled && guideConfig.targets.includes(fNum);
                  const showGuide = isHovered || isPersistentGuide;
                  
                  const totalBuildingFloors = mainFloors.length + basementFloors.length;
                  const floorScale = dynamicFloorHeight ? Math.max(0.6, Math.min(1, 22 / totalBuildingFloors)) : 1;

                  return (
                    <div key={fNum} className="flex">
                      <motion.div 
                        onMouseEnter={() => setHoveredFloor(fNum)}
                        onMouseLeave={() => setHoveredFloor(null)}
                        initial={false}
                        animate={{ 
                          backgroundColor: showGuide 
                            ? (isDarkTheme ? (isPersistentGuide ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.2)") : (isPersistentGuide ? "rgba(59, 130, 246, 0.05)" : "rgba(59, 130, 246, 0.1)"))
                            : isWireframe ? "rgba(0,0,0,0)" : (isDarkTheme ? "rgba(59, 130, 246, 0.05)" : "rgba(59, 130, 246, 0.02)"),
                          opacity: isWireframe ? 0.4 : 1
                        }}
                        className={`grid flex-1 border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-blue-500/5 transition-colors relative group/floor ${isWireframe ? 'grayscale-[0.5]' : ''} ${showGuide ? 'z-30' : 'z-10'}`} 
                        style={{ 
                          gridTemplateColumns: `50px repeat(${lines}, 1fr)`,
                          minHeight: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * floorScale)}px` : `${layoutConfig.cellHeight}px`
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

                        <button 
                          onClick={() => applyTypeToFloor(b, fNum)}
                          className={`p-2 flex flex-col items-center justify-center border-r-2 border-slate-200 dark:border-slate-800 font-black relative overflow-hidden transition-all duration-500 z-20 active:scale-95 cursor-pointer ${isWorkingFloor ? 'bg-blue-600 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]' : isWireframe ? 'text-slate-400 bg-slate-50/10' : 'text-blue-600 bg-slate-100/30 dark:bg-slate-900/30'} ${showGuide ? 'text-blue-500 bg-blue-50/50 dark:bg-blue-900/30 underline decoration-blue-500/50 decoration-2' : ''}`} 
                          style={{ minWidth: '50px', padding: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.25 * floorScale)}px 0` : `${Math.floor(layoutConfig.cellHeight * 0.25)}px 0` }}
                          title={selectedUnitType ? `${fNum}층 전체를 ${selectedUnitType} 타입으로 변경 (Alt+클릭: 전 단지 적용)` : '클릭하여 층 전체 타입 변경 (Alt+클릭: 전 단지 적용)'}
                        >
                          {isWorkingFloor && (
                            <motion.div 
                              initial={{ x: "-100%" }}
                              animate={{ x: "200%" }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute inset-0 bg-white/20 skew-x-12"
                            />
                          )}
                          <span className={`${isWorkingFloor ? 'text-[11px] scale-110' : 'text-[10px]'} relative z-10`}>
                            {fNum > maxFloorNum ? `PH${fNum - maxFloorNum}` : `${fNum}F`}
                          </span>
                          {isWorkingFloor && (
                            <span className="text-[6px] font-black uppercase tracking-tighter opacity-90 leading-none relative z-10 mt-0.5 px-1 bg-white text-blue-600 rounded-sm">
                              작업중
                            </span>
                          )}
                          {!isWireframe && fNum <= maxFloorNum && !isWorkingFloor && progress > 0 && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-1 right-1"
                            >
                               <Check className={`w-2.5 h-2.5 ${isHovered || showGuide ? 'text-white bg-blue-500' : 'text-blue-500 bg-white/80 dark:bg-slate-800/80'} rounded-full shadow-sm p-0.5`} />
                            </motion.div>
                          )}
                        </button>
                        {Array.from({ length: lines }).map((_, i) => {
                          const type = getUnitType(b, fNum, i + 1);
                          const colorInfo = getTypeColorInfo(type);
                          const activeFilter = selectedUnitType || hoveredUnitType;
                          const isTypeHovered = activeFilter !== null && type === activeFilter;
                          const isOtherTypeHovered = activeFilter !== null && type !== activeFilter;
                          
                          return (
                            <button 
                              key={i} 
                              onMouseDown={() => {
                                if (isLocked) return;
                                if (selectedUnitType !== null) {
                                  setIsPainting(true);
                                  // Directly set type if painting instead of cycling
                                  const currentMap = b.unitMap || {};
                                  onUpdateBuilding(b.id, {
                                    unitMap: { ...currentMap, [`${fNum}:${i + 1}`]: selectedUnitType },
                                    lastLog: {
                                      type: 'unit_change',
                                      description: `${fNum < 0 ? `B${Math.abs(fNum)}` : `${fNum}F`} ${i + 1}호 -> ${selectedUnitType || '삭제'}`,
                                      timestamp: new Date().toISOString()
                                    }
                                  });
                                }
                              }}
                              onMouseEnter={() => {
                                if (isLocked) return;
                                if (isPainting && selectedUnitType !== null) {
                                  if (getUnitType(b, fNum, i + 1) !== selectedUnitType) {
                                    // Directly set type if painting
                                    const currentMap = b.unitMap || {};
                                    onUpdateBuilding(b.id, {
                                      unitMap: { ...currentMap, [`${fNum}:${i + 1}`]: selectedUnitType }
                                    });
                                  }
                                }
                              }}
                              onClick={() => {
                                if (!isPainting) cycleUnitType(b, fNum, i + 1);
                              }}
                              className={`p-1.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex items-center justify-center hover:bg-blue-500/10 transition-all cursor-pointer group/unit shadow-inner active:scale-95 px-1 ${isOtherTypeHovered ? 'opacity-20 grayscale' : 'opacity-100'}`}
                              style={{ padding: dynamicFloorHeight ? `${Math.floor(6 * floorScale)}px 4px` : '' }}
                              title={`${fNum}층 ${i + 1}호 타입 변경 (현재: ${type || '없음'}) ${selectedUnitType ? '- 드래그하여 페인팅 가능' : ''}`}
                            >
                              <div 
                                className={`unit-cell w-full py-1.5 rounded-lg font-black text-center shadow-md uppercase tracking-tighter transition-all duration-300 flex items-center justify-center ${isTypeHovered ? 'ring-2 ring-blue-500 scale-110 z-10' : ''} ${isWireframe && type ? 'border-2 border-dashed' : colorInfo.className}`}
                                style={{
                                  ...colorInfo.style,
                                  ...(isWireframe && type ? { 
                                    backgroundColor: colorInfo.style?.backgroundColor ? `${colorInfo.style.backgroundColor}20` : 'rgba(148, 163, 184, 0.15)',
                                    borderColor: colorInfo.style?.backgroundColor || '#94a3b8',
                                    color: colorInfo.style?.backgroundColor || '#94a3b8',
                                    boxShadow: 'none'
                                  } : {}),
                                  padding: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.15 * floorScale)}px 0` : `${Math.floor(layoutConfig.cellHeight * 0.15)}px 0`,
                                  minHeight: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.6 * floorScale)}px` : `${Math.floor(layoutConfig.cellHeight * 0.6)}px`,
                                  fontSize: dynamicFloorHeight ? `${Math.max(7, Math.floor(layoutConfig.fontSize * floorScale))}px` : `${layoutConfig.fontSize}px`
                                }}
                              >
                                {type}
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                      
                      <div className="w-[60px] no-print border-l border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/10 dark:bg-slate-900/10 flex items-center justify-center gap-0.5 px-0.5 py-1">
                        {visibleProcesses.map((p) => {
                          const mode = data.settings.processModes?.[p] || data.settings.progressMode || 'floor';
                          const curVal = b.processes[p] || 0;
                          let isReached = false;
                          if (mode === 'floor') {
                            isReached = fNum <= curVal;
                          } else {
                            const total = maxFloorNum || 1;
                            isReached = fNum <= (curVal / 100) * total;
                          }
                          return (
                            <div 
                              key={p} 
                              className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${isReached ? 'bg-blue-500/60 shadow-[0_0_4px_rgba(59,130,246,0.2)]' : 'bg-slate-200/10'}`}
                              title={`${p}: ${curVal}${mode === 'floor' ? 'F' : '%'}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Basement Floors */}
              {basementFloors.length >= 0 && (
                <div className="bg-slate-100/50 dark:bg-slate-950/50 border-t-2 border-slate-200 dark:border-slate-800 relative z-10">
                   {/* Basement Adjustment Handle */}
                   <div className="flex no-print">
                     <div className="flex-1 flex items-center justify-center gap-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50">
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
                    <div className="w-[60px] border-l border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/10 dark:bg-slate-900/10" />
                  </div>

                  {basementFloors.map(fNum => {
                    const isHovered = hoveredFloor === fNum;
                    const isPersistentGuide = guideConfig.enabled && guideConfig.targets.includes(fNum);
                    const showGuide = isHovered || isPersistentGuide;
                    
                    const totalBuildingFloors = mainFloors.length + basementFloors.length;
                    const floorScale = dynamicFloorHeight ? Math.max(0.6, Math.min(1, 22 / totalBuildingFloors)) : 1;

                    return (
                      <div key={fNum} className="flex">
                        <div 
                           onMouseEnter={() => setHoveredFloor(fNum)}
                           onMouseLeave={() => setHoveredFloor(null)}
                           className={`grid flex-1 border-b border-slate-200/50 dark:border-slate-800/50 last:border-b-0 relative transition-colors ${showGuide ? (isDarkTheme ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`} 
                           style={{ 
                             gridTemplateColumns: `50px repeat(${lines}, 1fr)`,
                             minHeight: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.8 * floorScale)}px` : `${Math.floor(layoutConfig.cellHeight * 0.8)}px`
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
                            <div className={`p-2 font-black text-center border-r-2 border-slate-200 dark:border-slate-800 transition-colors ${showGuide ? 'text-blue-500 bg-blue-100/20 shadow-inner' : 'text-slate-400'} flex items-center justify-center`} style={{ padding: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.15 * floorScale)}px 0` : `${Math.floor(layoutConfig.cellHeight * 0.15)}px 0`, fontSize: `${Math.max(7, layoutConfig.fontSize - 1)}px` }}>
                              B{Math.abs(fNum)}
                            </div>
                          {Array.from({ length: lines }).map((_, i) => {
                            const type = getUnitType(b, fNum, i + 1);
                            const colorInfo = getTypeColorInfo(type);
                            const activeFilter = selectedUnitType || hoveredUnitType;
                            const isTypeHovered = activeFilter !== null && type === activeFilter;
                            const isOtherTypeHovered = activeFilter !== null && type !== activeFilter;
                            return (
                              <button 
                                key={i} 
                                onClick={() => cycleUnitType(b, fNum, i + 1)}
                                className={`p-1 border-r border-slate-200/50 dark:border-slate-800/50 last:border-r-0 hover:bg-white/5 transition-all group/unit min-h-[20px] flex items-center justify-center cursor-pointer px-1 ${isOtherTypeHovered ? 'opacity-20 grayscale' : 'opacity-100'}`}
                                style={{ padding: dynamicFloorHeight ? `${Math.floor(layoutConfig.cellHeight * 0.1 * floorScale)}px 4px` : `${Math.floor(layoutConfig.cellHeight * 0.1)}px 4px` }}
                                title="클릭하여 타입 변경"
                              >
                                 {type ? (
                                  <div 
                                    className={`unit-cell w-full py-1 rounded text-[7px] font-black text-center uppercase tracking-tighter shadow-sm transition-all duration-300 ${isTypeHovered ? 'scale-125 shadow-lg ring-1 ring-white/30 z-10 opacity-100' : 'opacity-80'}`}
                                    style={{
                                      ...colorInfo.style,
                                      fontSize: dynamicFloorHeight ? `${Math.max(6, Math.floor((layoutConfig.fontSize - 2) * floorScale))}px` : `${layoutConfig.fontSize - 2}px`
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
                        <div className="w-[60px] no-print border-l border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/10 dark:bg-slate-900/10 flex items-center justify-center gap-0.5 px-0.5 py-1">
                          {visibleProcesses.map((p) => {
                            const mode = data.settings.processModes?.[p] || data.settings.progressMode || 'floor';
                            const curVal = b.processes[p] || 0;
                            let isReached = false;
                            if (mode === 'floor') {
                              isReached = fNum <= curVal;
                            } else {
                              const total = maxFloorNum || 1;
                              isReached = fNum <= (curVal / 100) * total;
                            }
                            return (
                              <div 
                                key={p} 
                                className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${isReached ? 'bg-blue-500/60 shadow-[0_0_4px_rgba(59,130,246,0.2)]' : 'bg-slate-200/10'}`}
                                title={`${p}: ${curVal}${mode === 'floor' ? 'F' : '%'}`}
                              />
                            );
                          })}
                        </div>
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
          className={`flex flex-col items-center justify-center border-2 border-dashed ${activeTheme.border} ${activeTheme.card} rounded-[2rem] p-10 min-h-[400px] group transition-all hover:border-blue-500 hover:bg-blue-500/5 ${isWideView ? 'min-w-[320px]' : ''}`}
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
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">세대 타입 (Type)</th>
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">색상 코드 / 선택 (Color)</th>
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">색상 프리셋 (Presets)</th>
                        <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">미리보기 (Preview)</th>
                        <th className="pb-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {unitTypeConfigs.map((ut, idx) => {
                        const colorInfo = getTypeColorInfo(ut.type);
                        const isTailwind = ut.color.startsWith('bg-');
                        const hexVal = isTailwind ? (colorInfo.style?.backgroundColor || '#3b82f6') : ut.color;
                        return (
                          <tr key={idx} className="group">
                            <td className="py-4">
                              <input 
                                type="text"
                                value={ut.type}
                                onChange={(e) => {
                                  const newConfigs = [...unitTypeConfigs];
                                  newConfigs[idx] = { ...ut, type: e.target.value };
                                  onUpdateUnitTypeConfigs?.(newConfigs);
                                }}
                                placeholder="예: 84A"
                                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 outline-none font-black text-blue-500 focus:ring-2 focus:ring-blue-500/20 w-24 text-sm"
                              />
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="relative w-8 h-8 rounded-xl cursor-pointer overflow-hidden border border-slate-300 dark:border-slate-700 shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: hexVal }}
                                  title="색상 선택기 열기"
                                >
                                  <input 
                                    type="color" 
                                    value={hexVal.startsWith('#') && hexVal.length === 7 ? hexVal : '#3b82f6'}
                                    onChange={(e) => {
                                      const newConfigs = [...unitTypeConfigs];
                                      newConfigs[idx] = { ...ut, color: e.target.value };
                                      onUpdateUnitTypeConfigs?.(newConfigs);
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                                  />
                                </div>
                                <input 
                                  type="text"
                                  value={ut.color}
                                  onChange={(e) => {
                                    const newConfigs = [...unitTypeConfigs];
                                    newConfigs[idx] = { ...ut, color: e.target.value };
                                    onUpdateUnitTypeConfigs?.(newConfigs);
                                  }}
                                  placeholder="bg-blue-500 또는 #HEX"
                                  className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 outline-none font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 w-28 text-xs"
                                />
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {[
                                  { bg: '#3b82f6', tw: 'bg-blue-500', name: '블루' },
                                  { bg: '#10b981', tw: 'bg-emerald-500', name: '에머럴드' },
                                  { bg: '#f59e0b', tw: 'bg-amber-500', name: '앰バー' },
                                  { bg: '#ef4444', tw: 'bg-rose-500', name: '레드' },
                                  { bg: '#06b6d4', tw: 'bg-cyan-500', name: '시안' },
                                  { bg: '#6366f1', tw: 'bg-indigo-500', name: '인디고' },
                                  { bg: '#a855f7', tw: 'bg-purple-500', name: '퍼플' },
                                  { bg: '#ec4899', tw: 'bg-pink-500', name: '핑크' }
                                ].map((p) => (
                                  <button
                                    key={p.tw}
                                    type="button"
                                    onClick={() => {
                                      const newConfigs = [...unitTypeConfigs];
                                      newConfigs[idx] = { ...ut, color: p.tw };
                                      onUpdateUnitTypeConfigs?.(newConfigs);
                                    }}
                                    className={`w-5 h-5 rounded-md border shadow-sm hover:scale-115 active:scale-95 transition-transform ${ut.color === p.tw ? 'ring-2 ring-blue-500 scale-110 border-blue-500' : 'border-slate-200 dark:border-slate-800'}`}
                                    style={{ backgroundColor: p.bg }}
                                    title={`${p.name} (${p.tw})`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newConfigs = [...unitTypeConfigs];
                                    const isDarkText = ut.textColor === 'text-slate-900';
                                    newConfigs[idx] = { 
                                      ...ut, 
                                      textColor: isDarkText ? 'text-white' : 'text-slate-900' 
                                    };
                                    onUpdateUnitTypeConfigs?.(newConfigs);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-md text-center transition-all ${colorInfo.className} hover:scale-105 active:scale-95`}
                                  style={colorInfo.style}
                                  title="클릭하여 글자색 변경 (흰색 / 검은색)"
                                >
                                  {ut.type || 'N/A'}
                                </button>
                                <span className="text-[8px] font-bold text-slate-400 select-none">글자색 클릭 전환</span>
                              </div>
                            </td>
                            <td className="py-4 text-right">
                              <button 
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`'${ut.type}' 타입을 삭제하시겠습니까?`)) return;
                                  const newConfigs = unitTypeConfigs.filter((_, i) => i !== idx);
                                  onUpdateUnitTypeConfigs?.(newConfigs);
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
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
