/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Printer, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Construction,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Settings as SettingsIcon,
  Download,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import LoginModal from './components/LoginModal';
import CalendarView from './components/CalendarView';
import { 
  AppState, 
  BuildingData, 
  CommonFacility, 
  DEFAULT_PROCESSES, 
  INITIAL_FACILITIES, 
  FACILITY_PROCESSES,
  UserRole,
  MultiProjectData
} from './types';

const STORAGE_KEY = 'apt_construction_multi_data';

const createNewSite = (name: string): AppState => ({
  id: Math.random().toString(36).substr(2, 9),
  settings: {
    companyName: '(주) 건설 혁신',
    projectName: name || '스마트 아파트 신축공사 현장',
    startDate: new Date().toISOString().split('T')[0],
    managerName: '김소장',
    staffName: '이공무',
    buildingCount: 10,
    maxFloor: 29,
    minFloor: -2,
    theme: 'slate'
  },
  buildings: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `${i + 1}동`,
    processes: DEFAULT_PROCESSES.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
    materialProcesses: DEFAULT_PROCESSES.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
    materialDates: {}
  })),
  facilities: INITIAL_FACILITIES.map(name => ({
    id: name,
    name,
    status: 'NOT_STARTED',
    processes: {}
  })),
  lastSaved: new Date().toLocaleString(),
  approval: {
    staffSigned: false,
    managerSigned: false
  },
  history: []
});

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [multiData, setMultiData] = useState<MultiProjectData>({
    activeSiteId: '',
    sites: []
  });
  
  const [data, setData] = useState<AppState>(createNewSite('스마트 아파트 현장'));
  const [processes, setProcesses] = useState<string[]>(DEFAULT_PROCESSES);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'settings' | 'analytics' | 'calendar'>('table');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const checkStorageUsage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const sizeInMB = new Blob([saved]).size / (1024 * 1024);
        if (sizeInMB > 4) {
          setStorageWarning(`브라우저 저장 공간이 부족합니다 (${sizeInMB.toFixed(1)}MB / 5MB). 오래된 현장을 삭제해 주세요.`);
        } else {
          setStorageWarning(null);
        }
      }
    } catch (e) { console.error(e); }
  };

  // Load from local storage and check URL params
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const urlParams = new URLSearchParams(window.location.search);
    const siteParam = urlParams.get('site');

    if (saved) {
      try {
        const parsed: MultiProjectData = JSON.parse(saved);
        if (parsed && parsed.sites && parsed.sites.length > 0) {
          setMultiData(parsed);
          
          // Priority: 1. URL Param 2. Saved activeSiteId 3. First site
          const targetId = siteParam || parsed.activeSiteId;
          const activeSite = parsed.sites.find(s => s.id === targetId) || parsed.sites[0];
          
          setData(activeSite);
          if (activeSite.buildings?.[0]?.processes) {
            setProcesses(Object.keys(activeSite.buildings[0].processes));
          }
          
          // Clear param if it was invalid or just keep it? 
          // Let's ensure the URL reflects the active site for future reloads
          if (siteParam !== activeSite.id) {
            const newUrl = window.location.pathname + `?site=${activeSite.id}`;
            window.history.replaceState({}, '', newUrl);
          }
        } else {
          // Migration from old single-site format if needed
          const oldSaved = localStorage.getItem('apt_construction_data');
          if (oldSaved) {
            const oldParsed = JSON.parse(oldSaved);
            const initialSite = { ...oldParsed, id: 'default-site' };
            const mData = { activeSiteId: 'default-site', sites: [initialSite] };
            setMultiData(mData);
            setData(initialSite);
          } else {
            const initialSite = createNewSite('전체 공사 현장');
            setMultiData({ activeSiteId: initialSite.id, sites: [initialSite] });
            setData(initialSite);
          }
        }
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    } else {
      const initialSite = createNewSite('전체 공사 현장');
      setMultiData({ activeSiteId: initialSite.id, sites: [initialSite] });
      setData(initialSite);
    }
  }, []);

  const lastSavedContent = useRef<string>('');

  // Auto-save logic
  useEffect(() => {
    checkStorageUsage();
    const contentToCompare = JSON.stringify({
      id: data.id,
      settings: data.settings,
      buildings: data.buildings,
      facilities: data.facilities,
      approval: data.approval
    });

    if (contentToCompare === lastSavedContent.current) return;
    
    const timer = setTimeout(() => {
      if (role) {
        saveData();
        lastSavedContent.current = contentToCompare;
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [data, role]);

  const saveData = () => {
    setIsAutoSaving(true);
    
    // 1. Update the current site in multiData
    setData(prev => {
      const buildingAverages = prev.buildings.map(b => {
        const vals = Object.values(b.processes) as number[];
        return vals.length > 0 ? vals.reduce((sum, val) => sum + val, 0) / vals.length : 0;
      });
      const overallAverage = Math.round(
        buildingAverages.length > 0 
          ? buildingAverages.reduce((sum, val) => sum + val, 0) / buildingAverages.length 
          : 0
      );

      const today = new Date().toISOString().split('T')[0];
      let newHistory = [...(prev.history || [])];
      const existingIndex = newHistory.findIndex(h => h.date === today);
      
      if (existingIndex >= 0) {
        newHistory[existingIndex] = { date: today, averageProgress: overallAverage };
      } else {
        newHistory.push({ date: today, averageProgress: overallAverage });
      }

      const updatedData = { ...prev, lastSaved: new Date().toLocaleString(), history: newHistory.slice(-60) };
      
      // Update multiSite record
      setMultiData(mPrev => {
        const updatedSites = mPrev.sites.map(s => s.id === updatedData.id ? updatedData : s);
        const nextMulti = { ...mPrev, sites: updatedSites };
        
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMulti));
        } catch (e) {
          console.error("Storage failed", e);
        }
        return nextMulti;
      });
      
      return updatedData;
    });

    setTimeout(() => setIsAutoSaving(false), 1000);
  };

  const switchSite = (id: string) => {
    const site = multiData.sites.find(s => s.id === id);
    if (site) {
      setData(site);
      setMultiData(prev => ({ ...prev, activeSiteId: id }));
      if (site.buildings?.[0]?.processes) {
        setProcesses(Object.keys(site.buildings[0].processes));
      }
      
      // Update URL
      const newUrl = window.location.pathname + `?site=${id}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  const copySiteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?site=${data.id}`;
    
    // Fallback for non-secure contexts (if clipboard API is blocked)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        alert(`현장 고유 링크가 복사되었습니다:\n${data.settings.projectName}`);
      }).catch(() => {
        prompt('링크를 드래그하여 복사하세요:', url);
      });
    } else {
      prompt('링크를 드래그하여 복사하세요:', url);
    }
  };

  const addNewSite = () => {
    const name = prompt('새 현장 이름을 입력하세요:');
    if (name) {
      const newSite = createNewSite(name);
      setMultiData(prev => {
        const nextMulti = {
          ...prev,
          sites: [...prev.sites, newSite],
          activeSiteId: newSite.id
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMulti));
        return nextMulti;
      });
      setData(newSite);
      setProcesses(DEFAULT_PROCESSES);
      setViewMode('table');
    }
  };

  const deleteSite = (id: string) => {
    if (multiData.sites.length <= 1) {
      alert('최소 하나의 현장은 유지되어야 합니다.');
      return;
    }
    const siteToDelete = multiData.sites.find(s => s.id === id);
    if (!confirm(`'${siteToDelete?.settings.projectName}' 현장을 삭제하시겠습니까? 데이터가 모두 소실됩니다.`)) return;

    setMultiData(prev => {
      const filtered = prev.sites.filter(s => s.id !== id);
      const nextActive = filtered[0].id;
      const nextData = filtered[0];
      
      setData(nextData);
      return { activeSiteId: nextActive, sites: filtered };
    });
  };

  const handleUpdateProgress = (buildingId: number, processName: string, value: number) => {
    if (role === 'GUEST') return;
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => 
        b.id === buildingId 
          ? { ...b, processes: { ...b.processes, [processName]: Math.min(100, Math.max(0, value)) } }
          : b
      )
    }));
  };

  const handleUpdateMaterialProgress = (buildingId: number, processName: string, value: number) => {
    if (role === 'GUEST') return;
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => 
        b.id === buildingId 
          ? { 
              ...b, 
              materialProcesses: { ...(b.materialProcesses || {}), [processName]: value } 
            }
          : b
      )
    }));
  };

  const handleUpdateMaterialDate = (buildingId: number, processName: string, date: string) => {
    if (role === 'GUEST') return;
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => 
        b.id === buildingId 
          ? { 
              ...b, 
              materialDates: { ...(b.materialDates || {}), [processName]: date } 
            }
          : b
      )
    }));
  };

  const handleUpdateFacilityStatus = (facilityId: string) => {
    if (role === 'GUEST') return;
    const statusOrder: CommonFacility['status'][] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    setData(prev => ({
      ...prev,
      facilities: prev.facilities.map(f => {
        if (f.id === facilityId) {
          const currentIndex = statusOrder.indexOf(f.status);
          const nextIndex = (currentIndex + 1) % statusOrder.length;
          return { ...f, status: statusOrder[nextIndex] };
        }
        return f;
      })
    }));
  };

  const handleUpdateFacilitySubProcess = (facilityId: string, processName: string, value: number) => {
    if (role === 'GUEST') return;
    setData(prev => ({
      ...prev,
      facilities: prev.facilities.map(f => {
        if (f.id === facilityId) {
          const currentProcesses = f.processes || {};
          const nextProcesses = { ...currentProcesses, [processName]: value };
          
          // Auto-update main status based on sub-progress
          const vals = Object.values(nextProcesses) as number[];
          const avg = vals.reduce((s, v) => s + (v || 0), 0) / FACILITY_PROCESSES.length;
          let nextStatus: CommonFacility['status'] = f.status;
          if (avg === 100) nextStatus = 'COMPLETED';
          else if (avg > 0) nextStatus = 'IN_PROGRESS';
          else nextStatus = 'NOT_STARTED';

          return {
            ...f,
            status: nextStatus,
            processes: nextProcesses
          };
        }
        return f;
      })
    }));
  };

  const addProcess = (name: string) => {
    if (processes.includes(name)) return;
    const newProcesses = [...processes, name];
    setProcesses(newProcesses);
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        processes: { ...b.processes, [name]: 0 }
      }))
    }));
  };

  const deleteProcess = (name: string) => {
    if (!confirm(`'${name}' 공종을 삭제하시겠습니까? 모든 동의 데이터가 소실됩니다.`)) return;
    setProcesses(processes.filter(p => p !== name));
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => {
        const { [name]: _, ...rest } = b.processes;
        return { ...b, processes: rest };
      })
    }));
  };

  const moveProcess = (index: number, direction: 'left' | 'right') => {
    const newProcesses = [...processes];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newProcesses.length) return;
    [newProcesses[index], newProcesses[targetIndex]] = [newProcesses[targetIndex], newProcesses[index]];
    setProcesses(newProcesses);
  };

  const addBuilding = () => {
    setData(prev => {
      const nextId = Math.max(0, ...prev.buildings.map(b => b.id)) + 1;
      return {
        ...prev,
        buildings: [
          ...prev.buildings,
          {
            id: nextId,
            name: `${nextId}동`,
            processes: processes.reduce((acc, p) => ({ ...acc, [p]: 0 }), {})
          }
        ],
        settings: { ...prev.settings, buildingCount: prev.buildings.length + 1 }
      };
    });
  };

  const deleteBuilding = (id: number) => {
    // For safety in some environments, confirm might not work well, 
    // but we'll try to provide a fallback or ensure state updates clearly.
    if (!window.confirm('정말 이 동을 삭제하시겠습니까?')) return;
    
    setData(prev => {
      const filtered = prev.buildings.filter(b => b.id !== id);
      return {
        ...prev,
        buildings: filtered,
        settings: {
          ...prev.settings,
          buildingCount: filtered.length
        }
      };
    });
  };

  const renameBuilding = (id: number, newName: string) => {
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => b.id === id ? { ...b, name: newName } : b)
    }));
  };

  const addFacility = (name: string) => {
    setData(prev => ({
      ...prev,
      facilities: [...prev.facilities, { id: name, name, status: 'NOT_STARTED' }]
    }));
  };

  const deleteFacility = (id: string) => {
    setData(prev => ({
      ...prev,
      facilities: prev.facilities.filter(f => f.id !== id)
    }));
  };

  const handleUpdateBuildingCount = (count: number) => {
    if (isNaN(count) || count < 0) return;
    
    setData(prev => {
      const prevCount = prev.buildings.length;
      
      // Case 1: Just updating the setting value (buildingCount could be 0, but we might want to keep buildings for a moment)
      if (count === 0) {
        return { ...prev, settings: { ...prev.settings, buildingCount: 0 } };
      }

      // Case 2: Increasing buildings
      if (count > prevCount) {
        const toAdd = count - prevCount;
        const newBuildings = Array.from({ length: toAdd }, (_, i) => {
          const nextId = Math.max(0, ...prev.buildings.map(b => b.id)) + i + 1;
          return {
            id: nextId,
            name: `${prevCount + i + 1}동`,
            processes: processes.reduce((acc, p) => ({ ...acc, [p]: 0 }), {})
          };
        });
        return {
          ...prev,
          buildings: [...prev.buildings, ...newBuildings],
          settings: { ...prev.settings, buildingCount: count }
        };
      } 
      
      // Case 3: Decreasing buildings
      if (count < prevCount) {
        return {
          ...prev,
          buildings: prev.buildings.slice(0, count),
          settings: { ...prev.settings, buildingCount: count }
        };
      }

      // Case 4: No change in count, just update setting if needed
      return { ...prev, settings: { ...prev.settings, buildingCount: count } };
    });
  };

  const handleSign = (type: 'staff' | 'manager') => {
    if (role !== 'ADMIN') return;
    setData(prev => ({
      ...prev,
      approval: {
        ...prev.approval,
        [type === 'staff' ? 'staffSigned' : 'managerSigned']: !prev.approval[type === 'staff' ? 'staffSigned' : 'managerSigned']
      }
    }));
  };

  const handleBatchUpdateProgress = (processName: string, percent: number) => {
    if (role === 'GUEST') return;
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        processes: { ...b.processes, [processName]: percent }
      }))
    }));
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newProcesses = [...processes];
    const item = newProcesses[draggedIdx];
    newProcesses.splice(draggedIdx, 1);
    newProcesses.splice(idx, 0, item);
    
    setProcesses(newProcesses);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const THEMES = {
    slate: {
      bg: 'bg-slate-50',
      text: 'text-blue-600',
      accent: 'bg-blue-600',
      card: 'bg-white',
      border: 'border-slate-200',
      header: 'bg-slate-900',
      button: 'bg-blue-600 hover:bg-blue-700',
      shadow: 'shadow-blue-100'
    },
    blueprint: {
      bg: 'bg-[#f0f4f8]',
      text: 'text-[#0077be]',
      accent: 'bg-[#0077be]',
      card: 'bg-white',
      border: 'border-[#dae1e7]',
      header: 'bg-[#1b4b72]',
      button: 'bg-[#0077be] hover:bg-[#005fa3]',
      shadow: 'shadow-cyan-100'
    },
    industrial: {
      bg: 'bg-[#0f1115]',
      text: 'text-[#00ff9f]',
      accent: 'bg-[#00ff9f]',
      card: 'bg-[#1a1d23]',
      border: 'border-[#2d333d]',
      header: 'bg-[#000000]',
      button: 'bg-[#00ff9f] hover:bg-[#00d685] text-black',
      shadow: 'shadow-emerald-900/20'
    },
    earth: {
      bg: 'bg-[#faf7f2]',
      text: 'text-[#4a6741]',
      accent: 'bg-[#4a6741]',
      card: 'bg-white',
      border: 'border-[#e5e1d8]',
      header: 'bg-[#2c3e2d]',
      button: 'bg-[#4a6741] hover:bg-[#3d5536]',
      shadow: 'shadow-green-100'
    }
  };

  const activeTheme = THEMES[data.settings.theme] || THEMES.slate;

  // Helper Logic
  const getFacilityAverage = (f: CommonFacility) => {
    const subProcesses = f.processes || {};
    const values = Object.values(subProcesses);
    if (values.length === 0) return f.status === 'COMPLETED' ? 100 : (f.status === 'IN_PROGRESS' ? 50 : 0);
    return Math.round(values.reduce((sum, val) => sum + (val || 0), 0) / FACILITY_PROCESSES.length);
  };
  const getFloorList = (building?: BuildingData) => {
    const minFloor = building?.minFloor !== undefined ? building.minFloor : data.settings.minFloor;
    const maxFloor = building?.maxFloor !== undefined ? building.maxFloor : data.settings.maxFloor;
    
    if (isNaN(minFloor) || isNaN(maxFloor)) return [1];
    
    const floors: number[] = [];
    const min = Math.max(-20, minFloor); // Guard rails
    const max = Math.min(200, maxFloor);
    
    for (let i = min; i <= max; i++) {
      if (i !== 0) floors.push(i);
    }
    return floors.length > 0 ? floors : [1];
  };

  const floorToPercent = (floor: number, building?: BuildingData) => {
    if (floor === -1) return -1; // N/A
    const floorList = getFloorList(building);
    if (floorList.length <= 1) return 5;
    const index = floorList.indexOf(floor);
    if (index === -1) {
      const closest = floorList.reduce((prev, curr) => Math.abs(curr - floor) < Math.abs(prev - floor) ? curr : prev);
      return 5 + Math.round((floorList.indexOf(closest) / (floorList.length - 1)) * 90);
    }
    return 5 + Math.round((index / (floorList.length - 1)) * 90);
  };

  const percentToFloor = (percent: number, building?: BuildingData) => {
    if (percent === -1) return -1; // N/A
    const floorList = getFloorList(building);
    if (floorList.length === 0) return 1;
    const adjustedPercent = (Math.max(5, Math.min(95, percent)) - 5) / 90;
    const index = Math.round(adjustedPercent * (floorList.length - 1));
    return floorList[index];
  };

  const formatFloor = (floor: number) => {
    if (floor === -1) return 'N/A';
    if (floor < 0) return `지하${Math.abs(floor)}층`;
    return `${floor}층`;
  };

  const getFloorText = (percent: number, building?: BuildingData) => {
    if (percent === -1) return 'N/A';
    if (percent === 0) return '대기';
    if (percent === 1) return '진행중';
    if (percent === 100) return '완료';
    return formatFloor(percentToFloor(percent, building));
  };

  if (!role) {
    return <LoginModal onLogin={setRole} />;
  }

  return (
    <div className={`min-h-screen ${activeTheme.bg} transition-colors duration-500`}>
      {/* Header */}
      <header className={`${activeTheme.card} border-b ${activeTheme.border} sticky top-0 z-30 no-print`}>
        {storageWarning && (
          <div className="bg-amber-500 text-white text-[10px] py-1 px-4 text-center font-bold relative">
            {storageWarning}
            <button onClick={() => setStorageWarning(null)} className="absolute right-2 top-1/2 -translate-y-1/2">
              <Plus className="w-3 h-3 rotate-45" />
            </button>
          </div>
        )}
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`${activeTheme.accent} p-2 rounded-lg text-white ${data.settings.theme === 'industrial' ? 'text-black' : ''}`}>
              <Construction className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`font-black text-lg leading-tight uppercase tracking-tight ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{data.settings.projectName}</h1>
              <p className="text-slate-400 text-xs font-medium">{data.settings.companyName} | {new Date().toLocaleDateString('ko-KR')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-1 mr-4 border ${activeTheme.border}`}>
                <div className="flex items-center px-2 py-1 gap-2 border-r border-slate-300 dark:border-slate-700">
                  <Building2 className={`w-3.5 h-3.5 ${activeTheme.text}`} />
                  <select 
                    value={data.id} 
                    onChange={(e) => switchSite(e.target.value)}
                    className={`bg-transparent text-[11px] font-black border-none focus:ring-0 cursor-pointer appearance-none ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}
                  >
                    {multiData.sites.map(s => (
                      <option key={s.id} value={s.id} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        {s.settings.projectName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 px-1">
                  <button 
                    onClick={copySiteLink}
                    className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                    title="현장 링크 복사"
                  >
                    <LinkIcon className={`w-3.5 h-3.5 ${activeTheme.text} group-hover:scale-110 transition-transform`} />
                  </button>
                  <button 
                    onClick={addNewSite}
                    className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                    title="새 현장 추가"
                    disabled={role === 'GUEST'}
                  >
                    <Plus className={`w-4 h-4 ${activeTheme.text} group-hover:scale-110 transition-transform`} />
                  </button>
                  {role === 'ADMIN' && multiData.sites.length > 1 && (
                    <button 
                      onClick={() => deleteSite(data.id)}
                      className={`p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all group`}
                      title="현재 현장 삭제"
                    >
                      <Trash2 className={`w-3.5 h-3.5 text-slate-400 group-hover:text-red-500`} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className={`flex ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-1 mr-4`}>
              <button 
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'table' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                상세 표
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'grid' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                요약 대시보드
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'calendar' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                자재 입고 달력
              </button>
              <button 
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'analytics' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                분석 리포트
              </button>
              {role === 'ADMIN' && (
                <button 
                  onClick={() => setViewMode('settings')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'settings' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
                >
                  프로젝트 설정
                </button>
              )}
            </div>

            <div className={`flex items-center gap-2 mr-4 border-r pr-4 ${activeTheme.border} no-print text-[10px]`}>
               <button 
                onClick={() => setRole(role === 'ADMIN' ? 'FIELD' : 'ADMIN')}
                className={`flex items-center gap-1.5 font-bold px-3 py-1 rounded-full transition-all hover:scale-105 active:scale-95 ${role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
               >
                {role === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {role === 'ADMIN' ? '현장 모드로 전환' : '관리자 보드로 전환'}
              </button>
              <div className="flex items-center gap-1 text-slate-400 min-w-[80px]">
                {isAutoSaving ? (
                  <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 ${activeTheme.accent} rounded-full animate-pulse`} /> 저장중...</span>
                ) : (
                  <span>저장완료: {data.lastSaved.split(',')[1]}</span>
                )}
              </div>
            </div>

            <button onClick={saveData} className={`p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} title="저장">
              <Save className="w-5 h-5" />
            </button>
            <button onClick={() => window.print()} className={`p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} title="인쇄">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={() => setRole(null)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="로그아웃">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Printable Header */}
        <div className="hidden print:block mb-6">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div>
              <h1 className="text-3xl font-black">{data.settings.projectName}</h1>
              <p className="text-sm font-bold text-slate-600">{data.settings.companyName}</p>
              <p className="text-xs mt-1">작성일시: {new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <div className="grid grid-cols-2 border border-black h-24 w-64 text-center">
              <div className="border-r border-black flex flex-col">
                <span className="bg-slate-50 border-b border-black py-0.5 text-[10px] font-bold">공무</span>
                <div className="flex-1 flex items-center justify-center relative italic">
                   {data.approval.staffSigned ? (
                     <div className="text-blue-600 font-serif text-lg font-bold border-2 border-blue-600 rounded-full px-2 py-0.5 transform -rotate-12 select-none">
                       {data.settings.staffName}
                     </div>
                   ) : <span className="text-slate-300 text-[10px]">미결재</span>}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="bg-slate-50 border-b border-black py-0.5 text-[10px] font-bold">소장</span>
                <div className="flex-1 flex items-center justify-center relative italic">
                  {data.approval.managerSigned ? (
                     <div className="text-red-600 font-serif text-lg font-bold border-2 border-red-600 rounded-full px-2 py-0.5 transform -rotate-12 select-none">
                       {data.settings.managerName}
                     </div>
                   ) : <span className="text-slate-300 text-[10px]">미결재</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'settings' && role === 'ADMIN' && (
          <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
             <div className={`flex items-center gap-2 mb-6 ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>
                <SettingsIcon className={`w-6 h-6 ${activeTheme.text}`} />
                <h2 className="text-xl font-bold">프로젝트 설정</h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">기본 정보</h3>
                   <div className="space-y-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400 mb-1 block">현장명</span>
                        <input type="text" value={data.settings.projectName} onChange={e => setData({...data, settings: {...data.settings, projectName: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400 mb-1 block">업체명</span>
                        <input type="text" value={data.settings.companyName} onChange={e => setData({...data, settings: {...data.settings, companyName: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                      </label>
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">디자인 & 공용시설</h3>
                   <div className="grid grid-cols-2 gap-2 mb-4">
                     {(['slate', 'blueprint', 'industrial', 'earth'] as const).map(t => (
                       <button key={t} onClick={() => setData({...data, settings: {...data.settings, theme: t}})} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${data.settings.theme === t ? `border-blue-600 bg-blue-50` : `${activeTheme.border} hover:bg-slate-50`}`}>
                         <div className={`w-8 h-8 rounded-full border-2 border-white ${THEMES[t].accent}`} />
                         <span className="text-[10px] font-bold uppercase tracking-widest">{t}</span>
                       </button>
                     ))}
                   </div>
                   <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.facilities.map(f => (
                          <div key={f.id} className={`flex items-center justify-between ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-2 rounded-lg group`}>
                            <span className="text-sm font-medium">{f.name}</span>
                            <button onClick={() => deleteFacility(f.id)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input id="facilityInput" type="text" placeholder="시설 추가..." className={`flex-1 px-3 py-1.5 rounded-lg border ${activeTheme.border} text-sm ${data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white'}`} />
                        <button onClick={() => { const input = document.getElementById('facilityInput') as HTMLInputElement; if (input.value) { addFacility(input.value); input.value = ''; } }} className={`${activeTheme.button} text-white p-2 rounded-lg transition-colors`}><Plus className="w-4 h-4" /></button>
                      </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">현장 규모 & 서명</h3>
                   <div className="grid grid-cols-1 gap-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-400 mb-1 block">동수</span>
                          <input 
                            type="text" 
                            value={data.settings.buildingCount || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') {
                                handleUpdateBuildingCount(0);
                              } else if (/^\d+$/.test(val)) {
                                handleUpdateBuildingCount(Number(val));
                              }
                            }}
                            className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} 
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-400 mb-1 block">지상 최고층</span>
                          <input 
                            type="number" 
                            min="1"
                            value={data.settings.maxFloor} 
                            onChange={e => setData({...data, settings: {...data.settings, maxFloor: Number(e.target.value)}})}
                            className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} 
                          />
                        </label>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400 mb-2 block">지하 총 층수 선택</span>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5].map(val => (
                            <button 
                              key={val}
                              onClick={() => setData({...data, settings: {...data.settings, minFloor: -val}})}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                Math.abs(data.settings.minFloor) === val && data.settings.minFloor !== 0
                                  ? `${activeTheme.accent} text-white border-transparent` 
                                  : `${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600'}`
                              }`}
                            >
                              지하 {val}층
                            </button>
                          ))}
                          <button 
                            onClick={() => setData({...data, settings: {...data.settings, minFloor: 0}})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              data.settings.minFloor === 0 
                                ? `${activeTheme.accent} text-white border-transparent` 
                                : `${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600'}`
                            }`}
                          >
                            지상전용
                          </button>
                        </div>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="block"><input type="text" value={data.settings.staffName} onChange={e => setData({...data, settings: {...data.settings, staffName: e.target.value}})} placeholder="공무 성함" className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} /></label>
                      <label className="block"><input type="text" value={data.settings.managerName} onChange={e => setData({...data, settings: {...data.settings, managerName: e.target.value}})} placeholder="소장 성함" className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} /></label>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleSign('staff')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${data.approval.staffSigned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>공무서명</button>
                        <button onClick={() => handleSign('manager')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${data.approval.managerSigned ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>소장서명</button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {viewMode === 'calendar' && (
          <CalendarView 
            buildings={data.buildings} 
            theme={data.settings.theme} 
            activeTheme={activeTheme} 
            getFloorText={getFloorText}
          />
        )}

        {viewMode === 'table' && (
          <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} overflow-hidden overflow-x-auto animate-in fade-in duration-700`}>
            <table className="w-full border-collapse table-condensed min-w-[2000px] print:min-w-0">
              <thead>
                <tr className={`${activeTheme.header} text-white sticky top-0 z-20`}>
                  <th className="border-r border-slate-700 w-12 text-center font-bold px-1 py-3">No.</th>
                  <th className="border-r border-slate-700 w-24 text-center font-bold px-2 py-3">동 명칭</th>
                  {processes.map((p, idx) => (
                    <th 
                      key={p} 
                      draggable 
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`border-r border-slate-700 text-left px-2 py-3 min-w-[120px] group cursor-move hover:bg-white/10 transition-colors ${draggedIdx === idx ? 'opacity-30' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold leading-tight break-keep select-none">{p}</span>
                          {role === 'ADMIN' && (
                            <div className="no-print flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  const floorStr = prompt(`${p} 공정을 모든 동에 적용할 층수(숫자)를 입력하세요:`);
                                  if (floorStr !== null && !isNaN(Number(floorStr))) {
                                    const floor = Number(floorStr);
                                    if (role === 'GUEST') return;
                                    setData(prev => ({
                                      ...prev,
                                      buildings: prev.buildings.map(b => ({
                                        ...b,
                                        processes: { ...b.processes, [p]: floorToPercent(floor, b) }
                                      }))
                                    }));
                                  }
                                }} 
                                className="text-slate-400 hover:text-blue-400" 
                                title="전 동 일괄 업데이트"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button onClick={() => deleteProcess(p)} className="text-slate-400 hover:text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className={`text-center font-bold px-2 py-3 w-20 ${data.settings.theme === 'industrial' ? 'bg-emerald-900' : 'bg-blue-900'}`}>평균</th>
                  {role === 'ADMIN' && <th className="border-l border-slate-700 w-16 text-center font-bold px-1 py-3 no-print">삭제</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${data.settings.theme === 'industrial' ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {data.buildings.map((b, bIdx) => {
                  const processValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                  const avg = processes.length > 0 && processValues.length > 0 
                    ? Math.round(processValues.reduce((a, v) => a + v, 0) / processValues.length) 
                    : 0;
                  return (
                    <tr key={b.id} className={`${data.settings.theme === 'industrial' ? 'hover:bg-slate-800/50' : 'hover:bg-blue-50/30'} transition-colors`}>
                      <td className={`border-r ${activeTheme.border} text-center font-bold text-[10px] text-slate-400 ${data.settings.theme === 'industrial' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        {bIdx + 1}
                      </td>
                      <td className={`border-r ${activeTheme.border} text-center font-bold group relative ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>
                        <div className="flex flex-col items-center justify-center p-2 gap-1">
                          <input type="text" value={b.name} disabled={role === 'GUEST'} onChange={(e) => renameBuilding(b.id, e.target.value)} className="w-full text-center bg-transparent border-none focus:ring-0 p-0 font-black text-sm" />
                          
                          {role === 'ADMIN' && (
                            <div className="flex items-center gap-1 no-print">
                              <div className="flex items-center gap-0.5">
                                <span className="text-[8px] text-slate-400 font-bold">지하</span>
                                <input 
                                  type="text" 
                                  value={Math.abs(b.minFloor !== undefined ? b.minFloor : data.settings.minFloor)} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                      setData(prev => ({
                                        ...prev,
                                        buildings: prev.buildings.map(item => item.id === b.id ? { ...item, minFloor: val === '' ? 0 : -Math.abs(Number(val)) } : item)
                                      }));
                                    }
                                  }}
                                  className={`w-6 h-4 text-[9px] text-center p-0 rounded border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`}
                                />
                              </div>
                              <div className="flex items-center gap-0.5">
                                <span className="text-[8px] text-slate-400 font-bold">지상</span>
                                <input 
                                  type="text" 
                                  value={b.maxFloor !== undefined ? b.maxFloor : data.settings.maxFloor} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                      setData(prev => ({
                                        ...prev,
                                        buildings: prev.buildings.map(item => item.id === b.id ? { ...item, maxFloor: val === '' ? 1 : Number(val) } : item)
                                      }));
                                    }
                                  }}
                                  className={`w-6 h-4 text-[9px] text-center p-0 rounded border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {processes.map(p => {
                        const bProcesses = b.processes || {};
                        const mProcesses = b.materialProcesses || {};
                        const mDates = b.materialDates || {};
                        const floors = getFloorList(b);
                        
                        return (
                          <td key={p} className={`border-r ${activeTheme.border} p-0 relative`}>
                            <div className="p-2 space-y-1.5">
                              {/* Construction Progress */}
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                    <select 
                                      value={bProcesses[p] ?? 0} 
                                      disabled={role === 'GUEST'} 
                                      onChange={e => handleUpdateProgress(b.id, p, Number(e.target.value))}
                                      className={`text-[9px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none ${bProcesses[p] === 100 ? (data.settings.theme === 'industrial' ? 'text-emerald-400' : 'text-green-600') : (bProcesses[p] === -1 ? 'text-slate-400' : (data.settings.theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'))}`}
                                    >
                                      <option value={0}>대기</option>
                                      <option value={1}>진행중</option>
                                      <option value={-1}>N/A(해당없음)</option>
                                      {floors.map(f => (
                                        <option key={f} value={floorToPercent(f, b)} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                          {formatFloor(f)}
                                        </option>
                                      ))}
                                      <option value={100}>완료</option>
                                    </select>
                                  <span className="ml-auto text-[8px] font-bold text-slate-400 opacity-60 pointer-events-none">{bProcesses[p] === -1 ? '-' : `${bProcesses[p] ?? 0}%`}</span>
                                </div>
                                <div className={`w-full h-[3px] rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  {bProcesses[p] !== -1 && (
                                    <div className={`h-full transition-all duration-500 ${bProcesses[p] === 100 ? (data.settings.theme === 'industrial' ? 'bg-emerald-400' : 'bg-green-500') : activeTheme.accent}`} style={{ width: `${bProcesses[p] ?? 0}%` }} />
                                  )}
                                </div>
                              </div>

                              {/* Material Progress & Date */}
                              <div className="flex flex-col gap-0.5 border-t border-slate-100 dark:border-slate-800 pt-1">
                                <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-bold text-slate-400">자재</span>
                                    <select 
                                      value={mProcesses[p] ?? 0} 
                                      disabled={role === 'GUEST'} 
                                      onChange={e => handleUpdateMaterialProgress(b.id, p, Number(e.target.value))}
                                      className={`text-[9px] font-bold bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none ${mProcesses[p] === 100 ? 'text-blue-500' : (mProcesses[p] === -1 ? 'text-slate-400' : 'text-slate-500')}`}
                                    >
                                      <option value={0}>대기</option>
                                      <option value={-1}>N/A(해당없음)</option>
                                      {floors.map(f => (
                                        <option key={f} value={floorToPercent(f, b)} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                          {formatFloor(f)}
                                        </option>
                                      ))}
                                      <option value={100}>완료</option>
                                    </select>
                                  <span className="ml-auto text-[8px] font-bold text-blue-400/60 pointer-events-none">{mProcesses[p] === -1 ? '-' : `${mProcesses[p] ?? 0}%`}</span>
                                </div>
                                
                                {mProcesses[p] !== -1 && (
                                  <div className="flex flex-col gap-0.5">
                                    <div className={`w-full h-[2px] rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                      <div className={`h-full transition-all duration-500 bg-blue-400`} style={{ width: `${mProcesses[p] ?? 0}%` }} />
                                    </div>
                                    <div className="flex items-center gap-1 no-print">
                                      <span className="text-[6px] font-bold text-slate-400 uppercase">입고</span>
                                      <input 
                                        type="date"
                                        value={mDates[p] || ''}
                                        disabled={role === 'GUEST'}
                                        onChange={(e) => handleUpdateMaterialDate(b.id, p, e.target.value)}
                                        className={`text-[8px] bg-transparent border-none p-0 focus:ring-0 cursor-pointer ${data.settings.theme === 'industrial' ? 'text-slate-400 color-scheme-dark' : 'text-slate-500'}`}
                                      />
                                    </div>
                                    {mDates[p] && (
                                      <div className="hidden print:block text-[7px] font-bold text-blue-600">
                                        입고: {mDates[p]}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className={`text-center font-black text-sm ${activeTheme.text} ${data.settings.theme === 'industrial' ? 'bg-slate-900/50' : 'bg-blue-50/50'}`}>{avg}%</td>
                      {role === 'ADMIN' && (
                        <td className={`border-l ${activeTheme.border} text-center no-print px-1 py-2`}>
                          <button 
                            onClick={() => deleteBuilding(b.id)} 
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            title="동 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Quick Stats Chart Header */}
            {data.history && data.history.length > 0 && (
              <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-6 h-64`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                      <TrendingUp className={`w-5 h-5 ${activeTheme.text}`} />
                      <h3 className={`font-bold ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>전체 공정 추이</h3>
                   </div>
                   <span className="text-xs text-slate-400 font-medium">최근 공정 진행률 스냅샷</span>
                </div>
                <div className="w-full h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                      <defs>
                        <linearGradient id="colorProg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={data.settings.theme === 'industrial' ? '#00ff9f' : '#2563eb'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={data.settings.theme === 'industrial' ? '#00ff9f' : '#2563eb'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={data.settings.theme === 'industrial' ? '#2d333d' : '#f1f5f9'} />
                      <XAxis 
                        dataKey="date" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#94a3b8' }}
                        tickFormatter={(str) => str.split('-').slice(1).join('/')}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#94a3b8' }}
                        unit="%"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: data.settings.theme === 'industrial' ? '#1a1d23' : '#ffffff', 
                          border: `1px solid ${activeTheme.border}`,
                          borderRadius: '8px',
                          fontSize: '12px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="averageProgress" 
                        stroke={data.settings.theme === 'industrial' ? '#00ff9f' : '#2563eb'} 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorProg)" 
                        name="평균 진행률"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {data.buildings.map(b => {
                const avg = processes.length > 0 ? Math.round((Object.values(b.processes) as number[]).reduce((a, b) => a + b, 0) / processes.length) : 0;
                return (
                  <div key={b.id} className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-5 hover:shadow-md transition-all relative overflow-hidden`}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${avg === 100 ? 'bg-green-500' : activeTheme.accent}`} />
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${avg === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}><Building2 className="w-5 h-5" /></div>
                        <h3 className={`font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{b.name}</h3>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-black ${avg === 100 ? 'text-green-600' : activeTheme.text}`}>{avg}%</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">PROGRESS: {getFloorText(avg, b)}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {processes.map(p => {
                        const progressVal = b.processes[p] ?? 0;
                        const materialVal = b.materialProcesses?.[p] ?? 0;
                        const materialDate = b.materialDates?.[p];
                        if (progressVal === -1) return null;

                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        const tomorrow = new Date(today);
                        tomorrow.setDate(today.getDate() + 1);
                        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                        
                        const isSoon = materialDate === todayStr || materialDate === tomorrowStr;

                        return (
                          <div key={p} className={`space-y-0.5 p-1 rounded-lg transition-all ${isSoon ? (data.settings.theme === 'industrial' ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-amber-50 border border-amber-200 ring-2 ring-amber-400 ring-opacity-20') : ''}`}>
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1 w-[60px]">
                                <span className="text-slate-500 font-medium truncate">{p}</span>
                                {isSoon && <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}><AlertTriangle className="w-2.5 h-2.5 text-amber-500" /></motion.div>}
                              </div>
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                 <div className="flex flex-col items-end gap-0">
                                   <div className="flex items-center gap-1">
                                      <span className="text-[7px] text-slate-400 uppercase">공정</span>
                                      <span className="text-[9px] font-bold text-slate-400 min-w-[30px]">{getFloorText(progressVal, b)}</span>
                                   </div>
                                   {materialVal !== 0 && materialVal !== -1 && (
                                     <div className="flex flex-col items-end">
                                       <div className="flex items-center gap-1">
                                          <span className="text-[7px] text-blue-400 uppercase">자재</span>
                                          <span className="text-[9px] font-bold text-blue-400/70 min-w-[30px]">{getFloorText(materialVal, b)}</span>
                                       </div>
                                       {materialDate && (
                                          <span className={`text-[7px] font-bold leading-none ${isSoon ? 'text-amber-500 animate-pulse' : 'text-blue-500'}`}>
                                            {materialDate.split('-').slice(1).join('/')} {materialDate === todayStr ? '금일' : '내일'} 입고
                                          </span>
                                       )}
                                     </div>
                                   )}
                                 </div>
                                 <div className="w-[60px] flex flex-col gap-0.5">
                                   <div className={`h-1.5 rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                      <div className={`${progressVal === 100 ? 'bg-green-500' : activeTheme.accent} h-full`} style={{ width: `${progressVal}%` }} />
                                   </div>
                                   {materialVal !== 0 && materialVal !== -1 && (
                                     <div className={`h-1 rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <div className={`bg-blue-400 h-full`} style={{ width: `${materialVal}%` }} />
                                     </div>
                                   )}
                                 </div>
                                 <span className="font-bold min-w-[24px] text-right">{progressVal}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'analytics' && (
          <div className="space-y-8 animate-in fade-in duration-700">
             <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`${activeTheme.accent} p-3 rounded-xl text-white`}>
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>건설 공정 분석</h2>
                      <p className="text-slate-400 text-sm font-medium">프로젝트 전체 진행률 추이 및 동별 수치 분석</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">일별 평균 진행률 추이</h3>
                       <div className="flex items-center gap-4 text-[10px] font-bold">
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> 진행률</div>
                       </div>
                    </div>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={data.history}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={data.settings.theme === 'industrial' ? '#2d333d' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="date" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#94a3b8' }}
                          dy={10}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#94a3b8' }}
                          unit="%"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: data.settings.theme === 'industrial' ? '#1a1d23' : '#ffffff', 
                            border: `1px solid ${activeTheme.border}`,
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="averageProgress" 
                          stroke={data.settings.theme === 'industrial' ? '#00ff9f' : '#2563eb'} 
                          strokeWidth={4} 
                          dot={{ r: 4, fill: data.settings.theme === 'industrial' ? '#00ff9f' : '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                          name="평균 진행률"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">요약 통계</h3>
                    <div className="grid grid-cols-1 gap-4">
                       <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-2xl border ${activeTheme.border}`}>
                          <div className="text-xs font-bold text-slate-400 mb-1">전체 동 평균</div>
                          <div className={`text-3xl font-black ${activeTheme.text}`}>
                             {Math.round(data.buildings.reduce((acc, b) => {
                               const processesValues = Object.values(b.processes) as number[];
                               const buildingAvg = processesValues.length > 0 ? processesValues.reduce((s, v) => s + v, 0) / processesValues.length : 0;
                               return acc + buildingAvg;
                             }, 0) / (data.buildings.length || 1))}%
                          </div>
                          <div className="text-[10px] text-green-500 font-bold mt-1">+2.4% vs last snapshot</div>
                       </div>
                       <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-2xl border ${activeTheme.border}`}>
                          <div className="text-xs font-bold text-slate-400 mb-1">최고 진행 동</div>
                          {(() => {
                             const sorted = [...data.buildings].sort((a,b) => {
                               const processesA = Object.values(a.processes) as number[];
                               const processesB = Object.values(b.processes) as number[];
                               const avgA = processesA.length > 0 ? processesA.reduce((s, v) => s + v, 0) / processesA.length : 0;
                               const avgB = processesB.length > 0 ? processesB.reduce((s, v) => s + v, 0) / processesB.length : 0;
                               return avgB - avgA;
                             });
                             return (
                               <>
                                 <div className={`text-xl font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{sorted[0]?.name || '-'}</div>
                                 <div className="text-[10px] text-slate-500 font-bold mt-1">완료율: {Math.round((Object.values(sorted[0]?.processes || {}) as number[]).reduce((s, v) => s + v, 0) / (processes.length || 1))}%</div>
                               </>
                             );
                          })()}
                       </div>
                       <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-2xl border ${activeTheme.border}`}>
                          <div className="text-xs font-bold text-slate-400 mb-1">공통시설 완료율</div>
                          <div className={`text-2xl font-black text-emerald-500`}>
                             {Math.round((data.facilities.filter(f => f.status === 'COMPLETED').length / data.facilities.length) * 100)}%
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold mt-1">{data.facilities.filter(f => f.status === 'COMPLETED').length} / {data.facilities.length} 시설 완료</div>
                       </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {viewMode !== 'calendar' && (
          <section className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8 space-y-6`}>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <LayoutGrid className={`w-5 h-5 ${activeTheme.text}`} />
                  <h2 className={`text-lg font-bold ${data.settings.theme === 'industrial' ? 'text-white underline decoration-emerald-500/30' : 'text-slate-900 underline decoration-blue-500/30'} decoration-4 underline-offset-4`}>부대시설 및 주민공동시설 현황</h2>
               </div>
               <p className="text-xs text-slate-400 font-medium">* 클릭하여 상태 변경</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {data.facilities.map(f => {
                 const avgProgress = getFacilityAverage(f);
                 return (
                   <div key={f.id} className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-5 space-y-4`}>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${f.status === 'COMPLETED' ? 'bg-green-500' : f.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                          <h3 className={`font-bold ${data.settings.theme === 'industrial' ? 'text-slate-200' : 'text-slate-800'}`}>{f.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${avgProgress === 100 ? 'text-green-500' : activeTheme.text}`}>{avgProgress}%</span>
                          <button onClick={() => handleUpdateFacilityStatus(f.id)} className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : f.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {f.status === 'COMPLETED' ? '완료' : f.status === 'IN_PROGRESS' ? '진행중' : '대기'}
                          </button>
                        </div>
                     </div>

                     <div className={`w-full h-1.5 rounded-full ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} overflow-hidden`}>
                       <div className={`h-full transition-all duration-500 ${avgProgress === 100 ? 'bg-green-500' : activeTheme.accent}`} style={{ width: `${avgProgress}%` }} />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-2">
                        {FACILITY_PROCESSES.map(fp => {
                          const prog = f.processes?.[fp] ?? 0;
                          return (
                            <div key={fp} className="space-y-1">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] text-slate-400 font-bold">{fp}</span>
                                <span className={`text-[9px] font-black ${prog === 100 ? 'text-green-500' : 'text-slate-500'}`}>{prog}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={prog}
                                disabled={role === 'GUEST'}
                                onChange={(e) => handleUpdateFacilitySubProcess(f.id, fp, Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>
                          );
                        })}
                     </div>
                   </div>
                 );
               })}
            </div>
          </section>
        )}

        <div className="hidden print:flex justify-between items-end mt-12 text-[10px] text-slate-400 font-medium border-t pt-4">
          <p>Construction Analytics Platform | {new Date().toLocaleDateString()}</p>
          <p>Project: {data.settings.projectName} | Site Manager: {data.settings.managerName}</p>
          <p>Page 1 / 1</p>
        </div>
      </main>

      {viewMode !== 'calendar' && (
        <div className="fixed bottom-6 right-6 no-print flex flex-col gap-3">
           <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { const name = prompt('새로운 공종을 입력하세요:'); if (name) addProcess(name); }} className={`${activeTheme.button} text-white p-4 rounded-full shadow-xl ${activeTheme.shadow} flex items-center justify-center`}><Plus className="w-6 h-6" /></motion.button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .max-w-[1600px] { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          table { width: 100% !important; table-layout: fixed !important; }
          th, td { font-size: 8px !important; padding: 2px !important; }
          .min-w-[2000px] { min-width: 0 !important; }
        }
      `}</style>
    </div>
  );
}
