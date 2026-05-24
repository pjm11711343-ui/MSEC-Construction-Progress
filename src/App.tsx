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
  Upload,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle,
  Link as LinkIcon,
  ClipboardList,
  CloudSun,
  Lock
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
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import LoginModal from './components/LoginModal';
import CalendarView from './components/CalendarView';
import DailyReportView from './components/DailyReportView';
import GanttView from './components/GanttView';
import GalleryModal from './components/GalleryModal';
import SiteSelector from './components/SiteSelector';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  MessageSquare,
  Send,
  Loader2,
  Image as ImageIcon,
  Undo2,
  Trash
} from 'lucide-react';
import { 
  AppState, 
  BuildingData, 
  CommonFacility, 
  DEFAULT_PROCESSES, 
  INITIAL_FACILITIES, 
  FACILITY_PROCESSES,
  UserRole,
  MultiProjectData,
  DailyReport
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
    theme: 'slate',
    progressMode: 'floor',
    processModes: DEFAULT_PROCESSES.reduce((acc, p) => ({ ...acc, [p]: 'floor' }), {}),
    fontSize: 12,
    tableSpacing: 4,
    headerColor: '',
    textColor: '',
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    stairwellCount: 1,
    unitCount: 500
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
  history: [],
  dailyReports: [],
  processSchedules: DEFAULT_PROCESSES.reduce((acc, p, i) => ({ ...acc, [p]: { startOffset: i * 7, duration: 30 } }), {}),
  milestones: []
});

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [multiData, setMultiData] = useState<MultiProjectData>({
    activeSiteId: '',
    sites: []
  });
  
  const [storageState, setStorageState] = useState<AppState>(createNewSite('스마트 아파트 현장'));
  const setData = setStorageState;
  const [processes, setProcesses] = useState<string[]>(DEFAULT_PROCESSES);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'settings' | 'analytics' | 'calendar' | 'daily_report' | 'gantt'>('table');
  const [viewDate, setViewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSitePassword, setNewSitePassword] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLockedToSite, setIsLockedToSite] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<number | null>(null);
  const [newProcessInput, setNewProcessInput] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [photoTarget, setPhotoTarget] = useState<{ buildingId: number, processName: string } | null>(null);
  const [galleryTarget, setGalleryTarget] = useState<{ buildingId: number, processName: string } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [hoveredProgress, setHoveredProgress] = useState<{ buildingId: number, processName: string, x: number, y: number } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [trash, setTrash] = useState<any[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [siteAuthenticatedId, setSiteAuthenticatedId] = useState<string | null>(null);

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
          // Migration: Ensure all sites use the new 21 processes
          let migrationNeeded = false;
          let updatedSites = parsed.sites.map(site => {
            const firstB = site.buildings[0];
            const currentProcesses = firstB?.processes ? Object.keys(firstB.processes) : [];
            
            if (currentProcesses.length !== DEFAULT_PROCESSES.length || currentProcesses[0] !== DEFAULT_PROCESSES[0]) {
              migrationNeeded = true;
              return {
                ...site,
                buildings: site.buildings.map(b => {
                  const newProcesses: Record<string, number> = {};
                  DEFAULT_PROCESSES.forEach(p => {
                    let val = b.processes[p] ?? 0;
                    // Handle migration from non-numbered names or splits
                    if (val === 0) {
                      const coreName = p.replace(/^\d+\.\s*/, '');
                      val = b.processes[coreName] ?? 0;
                      
                      if (val === 0) {
                        if (coreName === "스리브" || coreName === "이중관배관") {
                          val = (b.processes as any)["스리브&이중관배관"] ?? 0;
                        }
                      }
                    }
                    newProcesses[p] = val;
                  });
                  return { ...b, processes: newProcesses };
                })
              };
            }
            return site;
          });

          // Ensure we have at least 10 sites total if requested
          if (updatedSites.length < 10) {
            const needed = 10 - updatedSites.length;
            const additional = Array.from({ length: needed }, (_, i) => createNewSite(`신규 현장 ${updatedSites.length + i + 1}`));
            updatedSites = [...updatedSites, ...additional];
            migrationNeeded = true;
          }

          if (migrationNeeded) {
            parsed.sites = updatedSites;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }

          setMultiData(parsed);
          if (parsed.trash) setTrash(parsed.trash);
          
          if (siteParam) {
            setIsLockedToSite(true);
            // If locked to site via link, we might want to default the role if not set
          }

          const targetId = siteParam || parsed.activeSiteId;
          const activeSite = parsed.sites.find(s => s.id === targetId) || parsed.sites[0];
          
          setData(activeSite);
          if (activeSite.buildings?.[0]?.processes) {
            setProcesses(Object.keys(activeSite.buildings[0].processes));
          }
          
          if (siteParam && siteParam !== activeSite.id) {
            const newUrl = window.location.pathname + `?site=${activeSite.id}`;
            window.history.replaceState({}, '', newUrl);
          }
        } else {
          // Migration or first run
          const oldSaved = localStorage.getItem('apt_construction_data');
          if (oldSaved) {
            const oldParsed = JSON.parse(oldSaved);
            const initialSite = { ...oldParsed, id: 'default-site' };
            const additionalSites = Array.from({ length: 9 }, (_, i) => createNewSite(`신규 현장 ${i + 1}`));
            const mData = { activeSiteId: 'default-site', sites: [initialSite, ...additionalSites] };
            setMultiData(mData);
            setData(initialSite);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
          } else {
            const initialSite = createNewSite('전체 공사 현장');
            const additionalSites = Array.from({ length: 9 }, (_, i) => createNewSite(`신규 현장 ${i + 1}`));
            const mData = { activeSiteId: initialSite.id, sites: [initialSite, ...additionalSites] };
            setMultiData(mData);
            setData(initialSite);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
          }
        }
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    } else {
      const initialSite = createNewSite('전체 공사 현장');
      const additionalSites = Array.from({ length: 9 }, (_, i) => createNewSite(`신규 현장 ${i + 1}`));
      const mData = { activeSiteId: initialSite.id, sites: [initialSite, ...additionalSites] };
      setMultiData(mData);
      setData(initialSite);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
    }
  }, []);

  const lastSavedContent = useRef<string>('');

  // Auto-save logic
  useEffect(() => {
    checkStorageUsage();
    const contentToCompare = JSON.stringify({
      id: storageState.id,
      settings: storageState.settings,
      buildings: storageState.buildings,
      facilities: storageState.facilities,
      approval: storageState.approval
    });

    if (contentToCompare === lastSavedContent.current) return;
    
    const timer = setTimeout(() => {
      if (role) {
        saveData();
        lastSavedContent.current = contentToCompare;
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [storageState, role]);

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

      // Snapshot without photos to save space
      const snapshot = {
        date: today,
        averageProgress: overallAverage,
        buildings: prev.buildings.map(b => {
          const { photos, ...rest } = b;
          return rest;
        }),
        facilities: prev.facilities
      };
      
      if (existingIndex >= 0) {
        newHistory[existingIndex] = snapshot;
      } else {
        newHistory.push(snapshot);
      }

      const updatedData = { ...prev, lastSaved: new Date().toLocaleString(), history: newHistory.slice(-100) };
      
      // Update multiSite record
      setMultiData(mPrev => {
        const updatedSites = mPrev.sites.map(s => s.id === updatedData.id ? updatedData : s);
        const nextMulti = { ...mPrev, sites: updatedSites, trash: trash.filter(t => Date.now() - t.deletedAt < 3600000) };
        
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

  const copyToClipboard = (text: string) => {
    const handleSuccess = () => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
        // Fallback to execCommand if clipboard API fails
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
      const successful = document.execCommand('copy');
      if (successful) callback();
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const copySiteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?site=${data.id}`;
    setShareUrl(url);
    copyToClipboard(url);
  };

  const addNewSite = () => {
    if (!newSiteName.trim()) return;
    const newSite = createNewSite(newSiteName);
    if (newSitePassword.trim()) {
      newSite.settings.sitePassword = newSitePassword.trim();
    }
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
    setIsAddingSite(false);
    setNewSiteName('');
    setNewSitePassword('');
    setIsLockedToSite(false);
    
    // Update URL
    const newUrl = window.location.pathname + `?site=${newSite.id}`;
    window.history.pushState({}, '', newUrl);
  };

  const addToTrash = (type: string, data: any, siteId?: string) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data,
      deletedAt: Date.now(),
      siteId: siteId || storageState.id
    };
    setTrash(prev => [newItem, ...prev].slice(0, 50));
  };

  const deleteSite = (id: string) => {
    if (multiData.sites.length <= 1) return;
    if (!window.confirm('정말 이 현장을 삭제하시겠습니까? 1시간 이내에 설정에서 복구 가능합니다.')) return;

    const siteToDelete = multiData.sites.find(s => s.id === id);
    if (siteToDelete) addToTrash('site', siteToDelete);
    
    setMultiData(prev => {
      const filtered = prev.sites.filter(s => s.id !== id);
      const nextActive = filtered[0].id;
      const nextData = filtered[0];
      
      setData(nextData);
      setDeleteConfirmId(null);
      return { activeSiteId: nextActive, sites: filtered, trash: [
        ...(prev.trash || []),
        { id: Math.random().toString(36).substr(2, 9), type: 'site', data: siteToDelete, deletedAt: Date.now() }
      ]};
    });
  };

  const restoreItem = (item: any) => {
    if (Date.now() - item.deletedAt > 3600000) {
      alert('삭제된 지 1시간이 지나 복구할 수 없습니다.');
      setTrash(prev => prev.filter(t => t.id !== item.id));
      return;
    }

    if (item.type === 'site') {
      setMultiData(prev => ({
        ...prev,
        sites: [...prev.sites, item.data]
      }));
    } else if (item.type === 'building') {
      if (item.siteId === storageState.id) {
        setData(prev => ({
          ...prev,
          buildings: [...prev.buildings, item.data],
          settings: { ...prev.settings, buildingCount: prev.buildings.length + 1 }
        }));
      } else {
        alert('이 항목은 다른 현장에서 삭제되었습니다.');
        return;
      }
    } else if (item.type === 'process') {
      if (item.siteId === storageState.id) {
        const { name, buildings } = item.data;
        if (processes.includes(name)) {
          alert('이미 동일한 이름의 공정이 존재합니다.');
          return;
        }
        setProcesses(prev => [...prev, name]);
        setData(prev => ({
          ...prev,
          buildings: prev.buildings.map(b => {
             const restoredVal = buildings.find((rb: any) => rb.id === b.id)?.progress ?? 0;
             return { ...b, processes: { ...b.processes, [name]: restoredVal } };
          })
        }));
      } else {
        alert('이 항목은 다른 현장에서 삭제되었습니다.');
        return;
      }
    } else if (item.type === 'facility') {
       if (item.siteId === storageState.id) {
         setData(prev => ({ ...prev, facilities: [...prev.facilities, item.data] }));
       } else {
        alert('이 항목은 다른 현장에서 삭제되었습니다.');
        return;
       }
    }

    setTrash(prev => prev.filter(t => t.id !== item.id));
    alert('복구되었습니다.');
  };

  const handleUpdateProgress = (buildingId: number, processName: string, value: number) => {
    if (role === 'GUEST' || (data as any).isHistorical) return;
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
    if (role === 'GUEST' || (data as any).isHistorical) return;
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
    if (role === 'GUEST' || (data as any).isHistorical) return;
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
    if (role === 'GUEST' || (data as any).isHistorical) return;
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
    if (role === 'GUEST' || (data as any).isHistorical) return;
    setData(prev => ({
      ...prev,
      facilities: prev.facilities.map(f => {
        if (f.id === facilityId) {
          const currentProcesses = f.processes || {};
          const nextProcesses = { ...currentProcesses, [processName]: value };
          
          // Auto-update main status based on sub-progress
          const activeFacilityProcesses = FACILITY_PROCESSES.filter(fp => !(f.inactiveProcesses || []).includes(fp));
          const avg = activeFacilityProcesses.length > 0 
            ? activeFacilityProcesses.reduce((s, fp) => s + (nextProcesses[fp] || 0), 0) / activeFacilityProcesses.length
            : 0;
            
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

  const toggleFacilityProcess = (facilityId: string, processName: string) => {
    if (role === 'GUEST' || (data as any).isHistorical) return;
    setData(prev => ({
      ...prev,
      facilities: prev.facilities.map(f => {
        if (f.id === facilityId) {
          const inactive = f.inactiveProcesses || [];
          const isInactive = inactive.includes(processName);
          const nextInactive = isInactive 
            ? inactive.filter(p => p !== processName)
            : [...inactive, processName];
            
          // Recalculate average and status with new active processes
          const currentProcesses = f.processes || {};
          const activeFacilityProcesses = FACILITY_PROCESSES.filter(fp => !nextInactive.includes(fp));
          const avg = activeFacilityProcesses.length > 0 
            ? activeFacilityProcesses.reduce((s, fp) => s + (currentProcesses[fp] || 0), 0) / activeFacilityProcesses.length
            : 0;
            
          let nextStatus: CommonFacility['status'] = f.status;
          if (avg === 100) nextStatus = 'COMPLETED';
          else if (avg > 0) nextStatus = 'IN_PROGRESS';
          else nextStatus = 'NOT_STARTED';

          return {
            ...f,
            inactiveProcesses: nextInactive,
            status: nextStatus
          };
        }
        return f;
      })
    }));
  };

  const handleUpdateDashboardNotes = (notes: string) => {
    if (viewDate !== new Date().toISOString().split('T')[0]) return;
    setData(prev => ({ ...prev, dashboardNotes: notes }));
  };

  const handleExportData = () => {
    let exportData;
    let fileName;
    
    if (isLockedToSite) {
      exportData = { sites: [data], activeSiteId: data.id };
      fileName = `${data.settings.projectName}_backup_${new Date().toISOString().split('T')[0]}.json`;
    } else {
      exportData = multiData;
      fileName = `construction_all_backup_${new Date().toISOString().split('T')[0]}.json`;
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        let json = JSON.parse(result);
        
        const migrateSite = (site: any) => {
          if (!site || !site.buildings) return site;
          const firstB = site.buildings[0];
          const currentProcesses = firstB?.processes ? Object.keys(firstB.processes) : [];
          
          if (currentProcesses.length !== DEFAULT_PROCESSES.length || (currentProcesses.length > 0 && currentProcesses[0] !== DEFAULT_PROCESSES[0])) {
            return {
              ...site,
              buildings: site.buildings.map((b: any) => {
                const newProcesses: Record<string, number> = {};
                DEFAULT_PROCESSES.forEach(p => {
                  let val = b.processes[p] ?? 0;
                  if (val === 0) {
                    const coreName = p.replace(/^\d+\.\s*/, '');
                    val = b.processes[coreName] ?? 0;
                    if (val === 0 && (coreName === "스리브" || coreName === "이중관배관")) {
                      val = (b.processes as any)["스리브&이중관배관"] ?? 0;
                    }
                  }
                  newProcesses[p] = val;
                });
                return { ...b, processes: newProcesses };
              })
            };
          }
          return site;
        };

        const isMultiFile = json.sites && Array.isArray(json.sites);
        const isSingleFile = json.buildings && Array.isArray(json.buildings);

        if (!isMultiFile && !isSingleFile) {
          alert('올바른 백업 파일 형식이 아닙니다.');
          return;
        }

        if (isLockedToSite) {
          let siteCandidate = null;
          if (isMultiFile) {
            siteCandidate = json.sites.find((s: any) => s.id === data.id) || 
                            json.sites.find((s: any) => s.settings?.projectName === data.settings.projectName);
            
            if (!siteCandidate && json.sites.length > 0) {
              if (window.confirm('파일에서 현재 현장과 일치하는 ID나 이름을 찾을 수 없습니다. 파일의 첫 번째 현장 데이터를 현재 현장에 강제로 복원하시겠습니까?')) {
                siteCandidate = json.sites[0];
              }
            }
          } else {
            siteCandidate = json;
          }

          if (siteCandidate) {
            const finalSite = { ...migrateSite(siteCandidate), id: data.id };
            if (window.confirm(`'${data.settings.projectName}' 현장의 데이터를 복원하시겠습니까? 기존 데이터는 삭제됩니다.`)) {
              setMultiData(prev => {
                const updatedSites = prev.sites.map(s => s.id === data.id ? finalSite : s);
                const nextMulti = { ...prev, sites: updatedSites };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMulti));
                return nextMulti;
              });
              setData(finalSite);
              if (finalSite.buildings && finalSite.buildings[0]) {
                setProcesses(Object.keys(finalSite.buildings[0].processes));
              }
              alert('현장 데이터 복원이 완료되었습니다.');
            }
          } else {
            alert('복원 가능한 현장 데이터를 찾을 수 없습니다.');
          }
        } else {
          if (isMultiFile) {
            if (window.confirm('전체 현장 데이터를 파일 내용으로 복원하시겠습니까? 기존 모든 데이터가 교체됩니다.')) {
              const migratedJson = { ...json, sites: json.sites.map(migrateSite) };
              if (migratedJson.sites.length < 10) {
                const needed = 10 - migratedJson.sites.length;
                const additional = Array.from({ length: needed }, (_, i) => createNewSite(`신규 현장 ${migratedJson.sites.length + i + 1}`));
                migratedJson.sites = [...migratedJson.sites, ...additional];
              }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedJson));
              setMultiData(migratedJson);
              const active = migratedJson.sites.find((s: any) => s.id === migratedJson.activeSiteId) || migratedJson.sites[0];
              setData(active);
              if (active.buildings && active.buildings[0]) {
                setProcesses(Object.keys(active.buildings[0].processes));
              }
              alert('전체 데이터 복원이 완료되었습니다.');
            }
          } else {
            if (window.confirm('가져온 파일은 단일 현장 데이터입니다. 현재 보고 있는 현장에 이 데이터를 복원하시겠습니까?')) {
              const finalSite = { ...migrateSite(json), id: data.id };
              setMultiData(prev => {
                const updatedSites = prev.sites.map(s => s.id === data.id ? finalSite : s);
                const nextMulti = { ...prev, sites: updatedSites };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMulti));
                return nextMulti;
              });
              setData(finalSite);
              if (finalSite.buildings && finalSite.buildings[0]) {
                setProcesses(Object.keys(finalSite.buildings[0].processes));
              }
              alert('단일 현장 데이터 복원이 완료되었습니다.');
            }
          }
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('데이터 복원 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleRunAIDiagnosis = async () => {
    if (isDiagnosing) return;
    setIsDiagnosing(true);
    try {
      const response = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: data }),
      });
      const result = await response.json();
      if (result.diagnosis) {
        setData(prev => ({ ...prev, aiDiagnosis: result.diagnosis }));
      } else if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      console.error("AI Diagnosis failed:", error);
      alert("AI 진단 요청에 실패했습니다.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const addProcess = () => {
    if (!newProcessName.trim() || processes.includes(newProcessName)) return;
    const name = newProcessName.trim();
    const newProcesses = [...processes, name];
    setProcesses(newProcesses);
    setData(prev => {
      const mode = prev.settings.progressMode || 'floor';
      return {
        ...prev,
        settings: {
          ...prev.settings,
          processModes: {
            ...(prev.settings.processModes || {}),
            [name]: mode
          }
        },
        buildings: prev.buildings.map(b => ({
          ...b,
          processes: { ...b.processes, [name]: 0 }
        }))
      };
    });
    setNewProcessName('');
    setNewProcessInput(false);
  };

  const renameProcess = (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || oldName === trimmedNewName) return;
    
    if (processes.includes(trimmedNewName)) {
      alert('이미 존재하는 공종명입니다.');
      return;
    }

    setProcesses(prev => prev.map(p => p === oldName ? trimmedNewName : p));
    setData(prev => {
      const currentModes = prev.settings.processModes || {};
      const mode = currentModes[oldName] || prev.settings.progressMode || 'floor';
      const { [oldName]: _, ...restModes } = currentModes;
      
      return {
        ...prev,
        settings: {
          ...prev.settings,
          processModes: {
            ...restModes,
            [trimmedNewName]: mode
          }
        },
        buildings: prev.buildings.map(b => {
        const currentProcesses = b.processes || {};
        const progress = currentProcesses[oldName];
        const { [oldName]: _, ...restProcesses } = currentProcesses;
        
        const currentMatProcesses = b.materialProcesses || {};
        const matProgress = currentMatProcesses[oldName];
        const { [oldName]: __, ...restMatProcesses } = currentMatProcesses;
        
        const currentMatDates = b.materialDates || {};
        const matDate = currentMatDates[oldName];
        const { [oldName]: ___, ...restMatDates } = currentMatDates;
        
        const currentPhotos = b.photos || {};
        const photos = currentPhotos[oldName];
        const { [oldName]: ____, ...restPhotos } = currentPhotos;
        
        return {
          ...b,
          processes: { ...restProcesses, [trimmedNewName]: progress ?? 0 },
          materialProcesses: { ...restMatProcesses, [trimmedNewName]: matProgress ?? 0 },
          materialDates: { ...restMatDates, [trimmedNewName]: matDate ?? '' },
          photos: { ...restPhotos, [trimmedNewName]: photos || [] }
        };
      })
    }; });
  };

  const deleteProcess = (name: string | null) => {
    if (!name) return;
    if (!window.confirm(`'${name}' 공정을 삭제하시겠습니까?`)) return;

    addToTrash('process', { name, buildings: storageState.buildings.map(b => ({ id: b.id, progress: b.processes[name] })) });

    setProcesses(processes.filter(p => p !== name));
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => {
        const { [name]: _, ...rest } = b.processes;
        return { ...b, processes: rest };
      })
    }));
    setProcessToDelete(null);
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

  const deleteBuilding = (id: number | null) => {
    if (id === null) return;
    const bToDelete = storageState.buildings.find(b => b.id === id);
    if (!window.confirm(`'${bToDelete?.name}'를 삭제하시겠습니까?`)) return;

    if (bToDelete) addToTrash('building', bToDelete);

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
    setBuildingToDelete(null);
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
    const fToDelete = storageState.facilities.find(f => f.id === id);
    if (!window.confirm(`'${fToDelete?.name}' 시설을 삭제하시겠습니까?`)) return;
    if (fToDelete) addToTrash('facility', fToDelete);

    setData(prev => ({
      ...prev,
      facilities: prev.facilities.filter(f => f.id !== id)
    }));
  };
  
  const handleAddDailyReport = (report: DailyReport) => {
    setData(prev => ({
      ...prev,
      dailyReports: [report, ...(prev.dailyReports || [])].filter((r, i, self) => 
        i === self.findIndex(t => t.date === r.date)
      )
    }));
  };

  const handleDeleteDailyReport = (date: string) => {
    setData(prev => ({
      ...prev,
      dailyReports: (prev.dailyReports || []).filter(r => r.date !== date)
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

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !photoTarget) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const { buildingId, processName } = photoTarget;
      setData(prev => ({
        ...prev,
        buildings: prev.buildings.map(b => 
          b.id === buildingId 
            ? { 
                ...b, 
                photos: { 
                  ...(b.photos || {}), 
                  [processName]: [base64, ...(b.photos?.[processName] || [])].slice(0, 10)
                } 
              } 
            : b
        )
      }));
      setPhotoTarget(null);
    };
    reader.readAsDataURL(file);
    if (photoUploadRef.current) photoUploadRef.current.value = '';
  };

  const handleDeletePhoto = (buildingId: number, processName: string, photoIndex: number) => {
    setData(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => 
        b.id === buildingId 
          ? { 
              ...b, 
              photos: { 
                ...(b.photos || {}), 
                [processName]: (b.photos?.[processName] || []).filter((_, i) => i !== photoIndex)
              } 
            } 
          : b
      )
    }));
  };

  const handleSign = (type: 'staff' | 'manager') => {
    if (role === 'GUEST') return;
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

  // Sort processes numerically for display
  const sortedDisplayProcesses = [...processes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

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

  const displayData = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (viewDate === today) return { ...storageState, isHistorical: false };
    
    const snapshot = storageState.history?.find((h: any) => h.date === viewDate);
    if (snapshot && snapshot.buildings && snapshot.facilities) {
      return {
        ...storageState,
        buildings: snapshot.buildings,
        facilities: snapshot.facilities,
        isHistorical: true
      };
    }
    
    return { ...storageState, isHistorical: true, isMissing: true };
  }, [storageState, viewDate]);

  const data = displayData;
  const activeTheme = THEMES[data.settings.theme] || THEMES.slate;

  // Helper Logic
  const getFacilityAverage = (f: CommonFacility) => {
    const activeFacilityProcesses = FACILITY_PROCESSES.filter(fp => !(f.inactiveProcesses || []).includes(fp));
    if (activeFacilityProcesses.length === 0) return f.status === 'COMPLETED' ? 100 : 0;
    
    const subProcesses = f.processes || {};
    const sum = activeFacilityProcesses.reduce((acc, fp) => acc + (subProcesses[fp] || 0), 0);
    return Math.round(sum / activeFacilityProcesses.length);
  };
  const getFloorList = (building?: BuildingData) => {
    const minFloor = building?.minFloor !== undefined ? building.minFloor : data.settings.minFloor;
    const maxFloor = building?.maxFloor !== undefined ? building.maxFloor : data.settings.maxFloor;
    
    if (isNaN(minFloor) || isNaN(maxFloor)) return [1, 999];
    
    const floors: number[] = [];
    const min = Math.max(-20, minFloor); // Guard rails
    const max = Math.min(200, maxFloor);
    
    for (let i = min; i <= max; i++) {
      if (i !== 0) floors.push(i);
    }
    // Add Roof Floor at the end
    floors.push(999);
    
    return floors.length > 0 ? floors : [1, 999];
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
    if (floor === 999) return "지붕층";
    if (floor < 0) return `지하${Math.abs(floor)}층`;
    return `${floor}층`;
  };

  const getProcessMode = (processName: string) => {
    if (data.settings.processModes?.[processName]) {
      return data.settings.processModes[processName];
    }
    return data.settings.progressMode || 'floor';
  };

  const getFloorText = (percent: number, building?: BuildingData, processName?: string) => {
    if (percent === -1) return 'N/A';
    if (percent === 0) return '대기';
    if (percent === 1) return '진행';
    if (percent === 100) return '완료';
    
    const mode = processName ? getProcessMode(processName) : (data.settings.progressMode || 'floor');
    if (mode === 'percent') return `${percent}%`;
    return formatFloor(percentToFloor(percent, building));
  };

  const getMaterialText = (percent: number, building?: BuildingData, processName?: string) => {
    if (percent === -1) return 'N/A';
    if (percent === 0) return '자재미입고';
    if (percent === 1) return '진행중';
    if (percent === 100) return '입고완료';
    
    const mode = processName ? getProcessMode(processName) : (data.settings.progressMode || 'floor');
    if (mode === 'percent') return `${percent}%`;
    return formatFloor(percentToFloor(percent, building));
  };

  if (!role) {
    return <LoginModal onLogin={setRole} />;
  }

  if (role === 'FIELD' && siteAuthenticatedId !== data.id) {
    // 1. Initial State: No site authenticated yet (and not a direct link)
    if (!siteAuthenticatedId && !isLockedToSite) {
      return (
        <SiteSelector 
          sites={multiData.sites} 
          onSelect={(site, password) => {
            if (!site.settings.sitePassword || site.settings.sitePassword === password) {
              switchSite(site.id);
              setSiteAuthenticatedId(site.id);
              return true;
            }
            return false;
          }} 
        />
      );
    }

    // 2. Switched State or Locked Site: Must authenticate for SPECIFIC 'data'
    if (!data.settings.sitePassword) {
      // Auto-authenticate if no password
      setSiteAuthenticatedId(data.id);
      return null;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex justify-between items-center mb-6">
              <div className="p-3 bg-white/10 rounded-2xl w-fit">
                <Lock className="w-6 h-6" />
              </div>
              {!isLockedToSite && (
                <button 
                  onClick={() => setSiteAuthenticatedId(null)}
                  className="text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors"
                >
                  현장 목록으로
                </button>
              )}
            </div>
            <h2 className="text-xl font-black">{data.settings.projectName}</h2>
            <p className="text-white/50 text-sm mt-1">현장 보안을 위해 비밀번호를 입력해 주세요.</p>
          </div>
          <div className="p-8 space-y-4">
            <div className="space-y-2">
              <input 
                type="password"
                placeholder="비밀번호 입력"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.currentTarget.value === data.settings.sitePassword) {
                      setSiteAuthenticatedId(data.id);
                    } else {
                      alert('비밀번호가 일치하지 않습니다.');
                    }
                  }
                }}
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl tracking-widest font-bold"
              />
            </div>
            <button 
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                if (input && input.value === data.settings.sitePassword) {
                  setSiteAuthenticatedId(data.id);
                } else {
                  alert('비밀번호가 일치하지 않습니다.');
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
            >
              현장 접속하기
            </button>
          </div>
        </motion.div>
      </div>
    );
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
        
        {/* Style Controls Toolbar */}
        <AnimatePresence>
          {isEditMode && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`border-b ${activeTheme.border} ${activeTheme.card} overflow-hidden bg-slate-50 dark:bg-slate-900/50`}
            >
              <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-6 overflow-x-auto">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">글자 크기</span>
                    <div className="flex items-center gap-2">
                       <input 
                        type="range" 
                        min="8" 
                        max="24" 
                        value={data.settings.fontSize || 12} 
                        onChange={(e) => setData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, fontSize: parseInt(e.target.value) }
                        }))}
                        className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs font-bold w-6">{data.settings.fontSize || 12}px</span>
                    </div>
                  </div>

                  <div className="h-6 w-[1px] bg-slate-200" />

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">표 간격</span>
                    <div className="flex items-center gap-2">
                       <input 
                        type="range" 
                        min="0" 
                        max="24" 
                        value={data.settings.tableSpacing || 4} 
                        onChange={(e) => setData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, tableSpacing: parseInt(e.target.value) }
                        }))}
                        className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs font-bold w-6">{data.settings.tableSpacing || 4}px</span>
                    </div>
                  </div>

                  <div className="h-6 w-[1px] bg-slate-200" />

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">상단 배경</span>
                    <input 
                      type="color" 
                      value={data.settings.headerColor || '#334155'} 
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, headerColor: e.target.value }
                      }))}
                      className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">글씨 색상</span>
                    <input 
                      type="color" 
                      value={data.settings.textColor || '#000000'} 
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, textColor: e.target.value }
                      }))}
                      className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                    />
                    <button 
                      onClick={() => setData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, headerColor: '', textColor: '', fontSize: 12, tableSpacing: 4 }
                      }))}
                      className="text-[10px] font-bold text-red-500 hover:underline ml-2 whitespace-nowrap"
                    >
                      초기화
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setIsEditMode(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  편집 종료
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`${activeTheme.accent} p-2 rounded-lg text-white ${data.settings.theme === 'industrial' ? 'text-black' : ''}`}>
              <Construction className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`font-black text-lg leading-tight uppercase tracking-tight ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{data.settings.projectName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">{data.settings.companyName}</p>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <input 
                    type="date" 
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-[10px] font-black focus:ring-0 cursor-pointer text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-1 mr-4 border ${activeTheme.border}`}>
                <div className="flex items-center px-2 py-1 gap-2 border-r border-slate-300 dark:border-slate-700">
                  <Building2 className={`w-3.5 h-3.5 ${activeTheme.text}`} />
                  {isLockedToSite && role !== 'ADMIN' ? (
                    <div className={`text-[11px] font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'} px-1`}>
                      {data.settings.projectName}
                    </div>
                  ) : (
                    <select 
                      value={data.id} 
                      onChange={(e) => switchSite(e.target.value)}
                      className={`bg-transparent text-[11px] font-black border-none focus:ring-0 cursor-pointer appearance-none ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}
                    >
                      {multiData.sites.map(s => (
                        <option key={s.id} value={s.id} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                          {s.settings.projectName} {role === 'ADMIN' && s.settings.sitePassword ? `[PW: ${s.settings.sitePassword}]` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1 px-1">
                  {role === 'FIELD' && !isLockedToSite && (
                    <button 
                      onClick={() => setSiteAuthenticatedId(null)}
                      className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                      title="현장 목록으로 돌아가기"
                    >
                      <LayoutGrid className={`w-3.5 h-3.5 ${activeTheme.text}`} />
                    </button>
                  )}
                  <button 
                    onClick={copySiteLink}
                    className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group relative`}
                    title="현장 링크 복사"
                  >
                    {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 animate-in zoom-in" /> : <LinkIcon className={`w-3.5 h-3.5 ${activeTheme.text} group-hover:scale-110 transition-transform`} />}
                    {isCopied && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap animate-bounce">
                        복사됨!
                      </span>
                    )}
                  </button>
                  {role === 'ADMIN' && (
                    <button 
                      onClick={() => setIsAddingSite(true)}
                      className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                      title="새 현장 추가"
                    >
                      <Plus className={`w-4 h-4 ${activeTheme.text} group-hover:scale-110 transition-transform`} />
                    </button>
                  )}
                  {role === 'ADMIN' && multiData.sites.length > 1 && (
                    <button 
                      onClick={() => setDeleteConfirmId(data.id)}
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
                공정표
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
                onClick={() => setViewMode('daily_report')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'daily_report' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                현장 일보
              </button>
              <button 
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'gantt' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                간트 차트
              </button>
              <button 
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'analytics' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                분석 리포트
              </button>
              {(role === 'ADMIN' || role === 'FIELD') && (
                <button 
                  onClick={() => setViewMode('settings')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'settings' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {role === 'ADMIN' ? '프로젝트 설정' : '현장 비밀번호 변경'}
                </button>
              )}
            </div>

            <div className={`flex items-center gap-2 mr-4 border-r pr-4 ${activeTheme.border} no-print text-[10px]`}>
               {role === 'ADMIN' && (
                 <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-1.5 font-bold px-3 py-1 rounded-full transition-all hover:scale-105 active:scale-95 ${isEditMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                 >
                  <SettingsIcon className={`w-3 h-3 ${isEditMode ? 'animate-spin-slow' : ''}`} />
                  {isEditMode ? '수정 중...' : '수정모드'}
                </button>
               )}
               {!isLockedToSite && (
                 <button 
                  onClick={() => {
                    const nextRole = role === 'ADMIN' ? 'FIELD' : 'ADMIN';
                    setRole(nextRole);
                    if (nextRole === 'FIELD') setSiteAuthenticatedId(null);
                  }}
                  className={`flex items-center gap-1.5 font-bold px-3 py-1 rounded-full transition-all hover:scale-105 active:scale-95 ${role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                 >
                  {role === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  {role === 'ADMIN' ? '현장 모드로 전환' : '관리자 보드로 전환'}
                </button>
               )}
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
            <button onClick={() => { setRole(null); setSiteAuthenticatedId(null); }} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="로그아웃">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-1 md:p-2 space-y-2">
        
        {(data as any).isHistorical && (
          <div className="no-print mb-8">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-4 rounded-2xl border font-bold text-sm shadow-xl ${ (data as any).isMissing ? 'bg-red-50 border-red-200 text-red-600 shadow-red-900/5' : 'bg-blue-50 border-blue-200 text-blue-600 shadow-blue-900/5' }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${(data as any).isMissing ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base">{(data as any).isMissing ? '저장된 데이터 없음' : `${viewDate} 공정 현황 조회 중`}</p>
                  <p className={`text-[10px] font-medium opacity-70`}>
                    {(data as any).isMissing ? '선택하신 날짜에는 기록된 공정 데이터가 존재하지 않습니다.' : '과거 데이터를 조회 중입니다. 수정은 오늘 공정에서만 가능합니다.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewDate(new Date().toISOString().split('T')[0])}
                className={`px-6 py-2.5 rounded-xl font-black transition-all hover:scale-105 active:scale-95 shadow-lg ${ (data as any).isMissing ? 'bg-red-600 text-white shadow-red-500/20' : 'bg-blue-600 text-white shadow-blue-500/20' }`}
              >
                오늘로 돌아가기
              </button>
            </motion.div>
          </div>
        )}

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

        <AnimatePresence mode="wait">
          {viewMode === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8 space-y-8`}>
             <div className={`flex items-center gap-2 mb-6 ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>
                <SettingsIcon className={`w-6 h-6 ${activeTheme.text}`} />
                <h2 className="text-xl font-bold">{role === 'ADMIN' ? '프로젝트 설정' : '현장 보안 설정'}</h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{role === 'ADMIN' ? '기본 정보' : '비밀번호 설정'}</h3>
                   <div className="space-y-3">
                      {role === 'ADMIN' && (
                        <>
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-400 mb-1 block">현장명</span>
                            <input type="text" value={data.settings.projectName} onChange={e => setData({...data, settings: {...data.settings, projectName: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-400 mb-1 block">업체명</span>
                            <input type="text" value={data.settings.companyName} onChange={e => setData({...data, settings: {...data.settings, companyName: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400 mb-1 block">착공일</span>
                              <input type="date" value={data.settings.startDate} onChange={e => setData({...data, settings: {...data.settings, startDate: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400 mb-1 block">준공일</span>
                              <input type="date" value={data.settings.endDate || ''} onChange={e => setData({...data, settings: {...data.settings, endDate: e.target.value}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400 mb-1 block">1개층 계단홀수</span>
                              <input type="number" value={data.settings.stairwellCount || 0} onChange={e => setData({...data, settings: {...data.settings, stairwellCount: parseInt(e.target.value) || 0}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400 mb-1 block">전체 세대수</span>
                              <input type="number" value={data.settings.unitCount || 0} onChange={e => setData({...data, settings: {...data.settings, unitCount: parseInt(e.target.value) || 0}})} className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                            </label>
                          </div>
                        </>
                      )}
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400 mb-1 block">{role === 'ADMIN' ? '현장 접속 비밀번호' : '현장 접속 비밀번호 변경'}</span>
                        <input type="text" value={data.settings.sitePassword || ''} onChange={e => setData({...data, settings: {...data.settings, sitePassword: e.target.value}})} placeholder="설정 안 함" className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                        <p className="text-[10px] text-slate-400 mt-1">현장 모드 접속 시 요구되는 비밀번호입니다.</p>
                      </label>
                      {role === 'ADMIN' && (
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-400 mb-1 block">현장 위치 (도시명)</span>
                          <input type="text" value={data.settings.location || ''} onChange={e => setData({...data, settings: {...data.settings, location: e.target.value}})} placeholder="예: Seoul, Busan 등" className={`w-full px-3 py-2 rounded-lg border ${activeTheme.border} text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-white' : 'bg-white'}`} />
                          <p className="text-[10px] text-slate-400 mt-1">날씨 정보를 자동으로 가져오기 위한 도시 이름입니다.</p>
                        </label>
                      )}
                   </div>
                </div>

                {role === 'ADMIN' && (
                  <>
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
                            <span className="text-xs font-semibold text-slate-400 mb-2 block">공정 입력 모드</span>
                            <div className="flex gap-2">
                              {(['floor', 'percent'] as const).map(mode => (
                                <button 
                                  key={mode}
                                  onClick={() => setData({...data, settings: {...data.settings, progressMode: mode}})}
                                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                    data.settings.progressMode === mode 
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                                      : `${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 hover:bg-slate-50'}`
                                  }`}
                                >
                                  {mode === 'floor' ? '층수 모드' : '% 모드'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-400 mb-2 block">지하 총 층수 선택</span>
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(val => (
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
                  </>
                )}
             </div>
          </div>
          </motion.div>
        )}

        {viewMode === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <CalendarView 
              buildings={data.buildings} 
              theme={data.settings.theme} 
              activeTheme={activeTheme} 
              getFloorText={getFloorText}
              getMaterialText={getMaterialText}
            />
          </motion.div>
        )}

        {viewMode === 'table' && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div 
              className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} overflow-auto max-h-[calc(100vh-180px)] custom-scrollbar`}
              style={{ fontSize: `${data.settings.fontSize || 12}px` }}
            >
            <table className="w-full border-collapse table-condensed min-w-[1200px] print:min-w-0">
              <thead>
                <tr 
                  className={`${activeTheme.header} text-white sticky top-0 z-20`}
                  style={data.settings.headerColor ? { backgroundColor: data.settings.headerColor } : {}}
                >
                  <th className={`border-r border-white/20 w-8 text-center font-black px-1 py-1 text-[9px] uppercase tracking-tighter sticky left-0 z-30 ${activeTheme.header}`} style={data.settings.headerColor ? { backgroundColor: data.settings.headerColor } : {}}>No.</th>
                  <th className={`border-r border-white/20 w-24 text-center font-black px-1 py-1 text-[10px] uppercase tracking-tighter sticky left-8 z-30 ${activeTheme.header}`} style={data.settings.headerColor ? { backgroundColor: data.settings.headerColor } : {}}>동 명칭</th>
                  {sortedDisplayProcesses.map((p) => (
                    <th 
                      key={p} 
                      className={`border-r border-white/20 text-center px-1 py-1 min-w-[80px] group transition-colors relative`}
                    >
                      <div className="flex flex-col gap-0.5 items-center">
                        <div className="flex items-center justify-center gap-1 w-full relative">
                          <div className="absolute right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-0.5 no-print">
                            <button 
                              onClick={() => {
                                const currentMode = getProcessMode(p);
                                const nextMode = currentMode === 'floor' ? 'percent' : 'floor';
                                setData(prev => ({
                                  ...prev,
                                  settings: {
                                    ...prev.settings,
                                    processModes: {
                                      ...(prev.settings.processModes || {}),
                                      [p]: nextMode
                                    }
                                  }
                                }));
                              }}
                              className={`p-0.5 rounded text-[7px] font-black uppercase transition-all ${
                                getProcessMode(p) === 'percent' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-white/20 text-white/50 hover:bg-white/30'
                              }`}
                              title={getProcessMode(p) === 'floor' ? '층수 모드 (클릭하여 %로 변경)' : '% 모드 (클릭하여 층수로 변경)'}
                            >
                              {getProcessMode(p) === 'floor' ? 'F' : '%'}
                            </button>
                          </div>
                          <input 
                            type="text" 
                            defaultValue={p} 
                            disabled={role === 'GUEST'}
                            onBlur={(e) => renameProcess(p, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="bg-transparent border-none focus:ring-0 p-0 text-[11px] font-black leading-tight text-center w-full min-w-0"
                          />
                          {role !== 'GUEST' && (
                            <div className="no-print flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 -bottom-4">
                              <button 
                                onClick={() => {
                                  const mode = getProcessMode(p);
                                  const promptMsg = mode === 'percent' 
                                    ? `${p} 공정을 모든 동에 적용할 진행율(%)을 입력하세요:` 
                                    : `${p} 공정을 모든 동에 적용할 층수(숫자)를 입력하세요:`;
                                  const inputStr = prompt(promptMsg);
                                  if (inputStr !== null && !isNaN(Number(inputStr))) {
                                    const val = Number(inputStr);
                                    setData(prev => ({
                                      ...prev,
                                      buildings: prev.buildings.map(b => ({
                                        ...b,
                                        processes: { ...b.processes, [p]: mode === 'percent' ? val : floorToPercent(val, b) }
                                      }))
                                    }));
                                  }
                                }} 
                                className="text-white/40 hover:text-white" 
                                title="전 동 일괄 업데이트"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button onClick={() => deleteProcess(p)} className="text-white/40 hover:text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                  {role !== 'GUEST' && (
                    <th className="border-r border-white/10 w-24 px-2 py-1 no-print">
                      <button 
                        onClick={() => setNewProcessInput(true)}
                        className="w-full flex items-center justify-center gap-1 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-black transition-all border border-white/10"
                      >
                        <Plus className="w-3 h-3" />
                        <span>공종추가</span>
                      </button>
                    </th>
                  )}
                  <th className={`text-center font-black px-2 py-1 w-24 text-[10px] uppercase tracking-tighter ${data.settings.theme === 'industrial' ? 'bg-emerald-800' : 'bg-blue-800'}`} style={data.settings.headerColor ? { backgroundColor: data.settings.headerColor, filter: 'brightness(90%)' } : {}}>평균</th>
                  {role !== 'GUEST' && <th className="border-l border-white/10 w-16 text-center font-black px-1 py-1 text-[10px] uppercase tracking-tighter no-print" style={data.settings.headerColor ? { backgroundColor: data.settings.headerColor } : {}}>삭제</th>}
                </tr>
              </thead>
              <tbody 
                className={`divide-y-2 ${data.settings.theme === 'industrial' ? 'divide-slate-800' : 'divide-slate-200'}`}
                style={data.settings.textColor ? { color: data.settings.textColor } : {}}
              >
                {[...data.buildings].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((b, bIdx) => {
                  const processValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                  const avg = processes.length > 0 && processValues.length > 0 
                    ? Math.round(processValues.reduce((a, v) => a + v, 0) / processValues.length) 
                    : 0;
                  const cellPadding = `${data.settings.tableSpacing || 4}px`;
                  return (
                    <tr key={b.id} className={`${data.settings.theme === 'industrial' ? 'hover:bg-slate-800/80' : 'hover:bg-blue-100/30'} transition-colors`}>
                      <td 
                        className={`border-r-2 ${data.settings.theme === 'industrial' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'} text-center font-black text-[10px] text-slate-500 sticky left-0 z-10`}
                        style={{ padding: cellPadding }}
                      >
                        {bIdx + 1}
                      </td>
                      <td 
                        className={`border-r-2 ${data.settings.theme === 'industrial' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'} text-center font-black group relative sticky left-8 z-10`}
                        style={{ padding: cellPadding }}
                      >
                        <div 
                          className={`flex flex-col items-center justify-center gap-0.5`}
                          style={{ padding: cellPadding }}
                        >
                          <input type="text" value={b.name} disabled={role === 'GUEST'} onChange={(e) => renameBuilding(b.id, e.target.value)} className="w-full text-center bg-transparent border-none focus:ring-0 p-0 font-black text-xs tracking-tighter" />
                          
                          {role !== 'GUEST' && (
                            <div className="flex items-center gap-1 no-print">
                              <div className="flex items-center gap-0.5 px-1 py-0 rounded bg-slate-200/50 dark:bg-slate-800/50">
                                <span className="text-[8px] text-slate-500 font-black">B</span>
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
                                  className={`w-4 h-3 text-[8px] text-center p-0 bg-transparent border-none focus:ring-0 font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}
                                />
                              </div>
                              <div className="flex items-center gap-0.5 px-1 py-0 rounded bg-slate-200/50 dark:bg-slate-800/50">
                                <span className="text-[8px] text-slate-500 font-black">F</span>
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
                                  className={`w-4 h-3 text-[8px] text-center p-0 bg-transparent border-none focus:ring-0 font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {sortedDisplayProcesses.map(p => {
                        const bProcesses = b.processes || {};
                        const mProcesses = b.materialProcesses || {};
                        const mDates = b.materialDates || {};
                        const floors = getFloorList(b);
                        const cellPadding = `${data.settings.tableSpacing || 4}px`;
                        
                        return (
                          <td key={p} className={`border-r-2 ${data.settings.theme === 'industrial' ? 'border-slate-800' : 'border-slate-200'} p-0 relative`}>
                            <div 
                              className={`space-y-1`}
                              style={{ padding: cellPadding }}
                            >
                              {/* Construction Progress */}
                              <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-center gap-1 w-full">
                              <select 
                                value={bProcesses[p] ?? 0} 
                                disabled={role === 'GUEST'} 
                                onChange={e => handleUpdateProgress(b.id, p, Number(e.target.value))}
                                className={`text-[10px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center p-0 m-0 ${bProcesses[p] === 100 ? (data.settings.theme === 'industrial' ? 'text-emerald-400' : 'text-green-600') : (bProcesses[p] === -1 ? 'text-slate-400' : (data.settings.theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'))}`}
                              >
                                <option value={0}>대기</option>
                                <option value={1}>진행</option>
                                <option value={-1}>N/A</option>
                                <option value={100}>완료</option>
                                {getProcessMode(p) === 'percent' ? (
                                  <optgroup label="진행율 선택" className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                                      <option key={v} value={v} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>{v}%</option>
                                    ))}
                                  </optgroup>
                                ) : (
                                  <optgroup label="층수 선택" className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                    {floors.map(f => (
                                      <option key={f} value={floorToPercent(f, b)} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                        {formatFloor(f)}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="flex items-center justify-center gap-0.5 mt-0">
                              <span className="text-[8px] font-black text-slate-400 opacity-60 pointer-events-none">{bProcesses[p] === -1 ? '-' : `${bProcesses[p] ?? 0}%`}</span>
                              <div className="flex items-center gap-0.5 no-print">
                                <button 
                                  onClick={() => {
                                    setPhotoTarget({ buildingId: b.id, processName: p });
                                    setTimeout(() => photoUploadRef.current?.click(), 100);
                                  }}
                                  className={`p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${b.photos?.[p]?.length ? 'text-blue-500' : 'text-slate-300'}`}
                                  title="사진 첨부"
                                >
                                  <ImageIcon className="w-2.5 h-2.5" />
                                </button>
                                {(b.photos?.[p] || []).length > 0 && (
                                  <button 
                                    onClick={() => setGalleryTarget({ buildingId: b.id, processName: p })}
                                    className="text-[8px] font-black text-blue-500"
                                  >
                                    [{b.photos[p].length}]
                                  </button>
                                )}
                              </div>
                            </div>
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  {bProcesses[p] !== -1 && (
                                    <div className={`h-full transition-all duration-500 ${bProcesses[p] === 100 ? (data.settings.theme === 'industrial' ? 'bg-emerald-400' : 'bg-green-500') : activeTheme.accent}`} style={{ width: `${bProcesses[p] ?? 0}%` }} />
                                  )}
                                </div>
                              </div>

                              {/* Material Progress & Date */}
                              <div className="flex flex-col gap-0.5 border-t border-slate-100 dark:border-slate-800 pt-1">
                                  <div className="flex items-center justify-center gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-2">
                                      <span className="text-[8px] font-black text-slate-400 uppercase">자재</span>
                                      <select 
                                        value={mProcesses[p] ?? 0} 
                                        disabled={role === 'GUEST'} 
                                        onChange={e => handleUpdateMaterialProgress(b.id, p, Number(e.target.value))}
                                        className={`text-[9px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center ${mProcesses[p] === 100 ? (data.settings.theme === 'industrial' ? 'text-amber-400' : 'text-amber-600') : (data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500')}`}
                                      >
                                        <option value={0}>자재미입고</option>
                                        <option value={1}>진행중</option>
                                        <option value={-1}>N/A</option>
                                        <option value={100}>입고완료</option>
                                        {getProcessMode(p) === 'percent' ? (
                                          <optgroup label="진행율 선택" className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                                              <option key={v} value={v} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>{v}%</option>
                                            ))}
                                          </optgroup>
                                        ) : (
                                          <optgroup label="층수 선택" className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                            {floors.map(f => (
                                              <option key={f} value={floorToPercent(f, b)} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                                {formatFloor(f)}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </select>
                                      <div className={`w-10 h-1.5 rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <div className={`h-full transition-all duration-500 ${mProcesses[p] === 100 ? 'bg-amber-500' : 'bg-amber-400/50'}`} style={{ width: `${mProcesses[p] ?? 0}%` }} />
                                      </div>
                                      <span className="text-[8px] font-black text-amber-500/60 ml-0.5">{mProcesses[p] === -1 ? '-' : `${mProcesses[p] ?? 0}%`}</span>
                                  </div>
                                  <div className="flex items-center justify-center gap-1 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                    <input 
                                      type="date" 
                                      value={mDates[p] || ''} 
                                      disabled={role === 'GUEST'}
                                      onChange={e => handleUpdateMaterialDate(b.id, p, e.target.value)}
                                      className="bg-transparent border-none p-0 text-[8px] font-black focus:ring-0 cursor-pointer text-slate-400 text-center"
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className={`text-center font-black text-[12px] border-l-2 ${data.settings.theme === 'industrial' ? 'bg-emerald-900/30 text-emerald-400 border-slate-800' : 'bg-blue-50/50 text-blue-600 border-slate-200'}`}>
                          {avg}%
                        </td>
                        {role !== 'GUEST' && (
                          <td className={`border-l-2 ${data.settings.theme === 'industrial' ? 'border-slate-800' : 'border-slate-200'} text-center px-1 no-print py-2`}>
                            <button 
                              onClick={() => deleteBuilding(b.id)} 
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
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
          <section className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8 space-y-6 mt-8`}>
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
                          const isInactive = (f.inactiveProcesses || []).includes(fp);
                          return (
                            <div key={fp} className={`space-y-1 p-1.5 rounded-lg transition-all ${isInactive ? 'opacity-40 grayscale bg-slate-100/50' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                              <div className="flex items-center justify-between px-0.5">
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => toggleFacilityProcess(f.id, fp)}
                                    title={isInactive ? '활성화' : '비활성화'}
                                    className={`w-2.5 h-2.5 rounded-full border shadow-sm transition-all ${isInactive ? 'bg-slate-200 border-slate-300' : 'bg-blue-500 border-blue-600'}`}
                                  />
                                  <span className={`text-[9px] font-bold ${isInactive ? 'text-slate-400' : 'text-slate-600'}`}>{fp}</span>
                                </div>
                                <span className={`text-[9px] font-black ${prog === 100 ? 'text-green-500' : 'text-slate-500'}`}>{isInactive ? '-' : `${prog}%`}</span>
                              </div>
                              {!isInactive && (
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
                              )}
                            </div>
                          );
                        })}
                     </div>
                   </div>
                 );
               })}
            </div>
          </section>
          </motion.div>
        )}

        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-8">
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
                                      <span className="text-[9px] font-bold text-slate-400 min-w-[30px]">{getFloorText(progressVal, b, p)}</span>
                                   </div>
                                   {materialVal !== 0 && materialVal !== -1 && (
                                     <div className="flex flex-col items-end">
                                       <div className="flex items-center gap-1">
                                          <span className="text-[7px] text-blue-400 uppercase">자재</span>
                                          <span className="text-[9px] font-bold text-blue-400/70 min-w-[30px]">{getMaterialText(materialVal, b, p)}</span>
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
           </motion.div>
         )}
         {viewMode === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-8">
             <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-8`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`${activeTheme.accent} p-3 rounded-xl text-white`}>
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>건설 공정 분석</h2>
                      <p className="text-slate-400 text-sm font-medium">프로젝트 전체 진행률 추이 및 공정별 상세 분석</p>
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
                          <div className="text-xs font-bold text-slate-400 mb-1">전체 동 평균 진행률</div>
                          <div className={`text-3xl font-black ${activeTheme.text}`}>
                             {Math.round(data.buildings.reduce((acc, b) => {
                               const processesValues = Object.values(b.processes) as number[];
                               const buildingAvg = processesValues.length > 0 ? processesValues.reduce((s, v) => s + v, 0) / processesValues.length : 0;
                               return acc + buildingAvg;
                             }, 0) / (data.buildings.length || 1))}%
                          </div>
                          <div className="text-[10px] text-green-500 font-bold mt-1">데이터 분석 기반 예측</div>
                       </div>
                       <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-2xl border ${activeTheme.border}`}>
                          <div className="text-xs font-bold text-slate-400 mb-1">최고 선행동 (Leading)</div>
                          {(() => {
                             const sorted = [...data.buildings].sort((a,b) => {
                               const processesA = Object.values(a.processes) as number[];
                               const processesB = Object.values(b.processes) as number[];
                               const avgA = processesA.length > 0 ? processesA.reduce((s, v) => s + v, 0) / processesA.length : 0;
                               const avgB = processesB.length > 0 ? processesB.reduce((s, v) => s + v, 0) / processesB.length : 0;
                               return avgB - avgA;
                             });
                             const topAvg = (Object.values(sorted[0]?.processes || {}) as number[]).reduce((s, v) => s + v, 0) / (processes.length || 1);
                             return (
                               <>
                                 <div className={`text-xl font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{sorted[0]?.name || '-'}</div>
                                 <div className="text-[10px] text-slate-500 font-bold mt-1">완료율: {Math.round(topAvg)}% (현장 전체 모범 사례)</div>
                               </>
                             );
                          })()}
                       </div>
                       <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-2xl border ${activeTheme.border}`}>
                          <div className="text-xs font-bold text-slate-400 mb-1">진행 지연 우려 공종 (Bottleneck)</div>
                          {(() => {
                             const processProgress = processes.map(p => {
                               const buildingVals = data.buildings.map(b => b.processes[p] ?? 0);
                               const avg = buildingVals.length > 0 ? buildingVals.reduce((s, v) => s + v, 0) / buildingVals.length : 0;
                               return { name: p, avg };
                             }).sort((a, b) => a.avg - b.avg);
                             
                             const lowest = processProgress[0];
                             return (
                               <>
                                 <div className={`text-xl font-black text-amber-500`}>{lowest?.name || '-'}</div>
                                 <div className="text-[10px] text-slate-500 font-bold mt-1">평균 진행률: {Math.round(lowest?.avg || 0)}% (자재 입고 및 인원 투입 확인 필요)</div>
                               </>
                             );
                          })()}
                       </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Process Breakdown */}
                <div className="mt-12 space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">전체 공정별 세부 지표</h3>
                     <span className="text-[10px] text-slate-400 font-medium">총 {processes.length}개 공종 분석</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[...processes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(p => {
                         const buildingVals = data.buildings.map(b => b.processes[p] ?? 0);
                         const avg = buildingVals.length > 0 ? buildingVals.reduce((s, v) => s + v, 0) / buildingVals.length : 0;
                         const completedCount = buildingVals.filter(v => v === 100).length;
                         const progressCount = buildingVals.filter(v => v > 0 && v < 100).length;
                         
                         return (
                            <div key={p} className={`${data.settings.theme === 'industrial' ? 'bg-slate-800/50' : 'bg-slate-50/50'} p-4 rounded-xl border ${activeTheme.border} space-y-3`}>
                               <div className="flex items-center justify-between">
                                  <span className={`text-[11px] font-black truncate max-w-[120px] ${data.settings.theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'}`}>{p}</span>
                                  <span className={`text-[11px] font-black ${avg === 100 ? 'text-green-500' : activeTheme.text}`}>{Math.round(avg)}%</span>
                               </div>
                               <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${avg}%` }}
                                    className={`h-full ${avg === 100 ? 'bg-green-500' : activeTheme.accent}`} 
                                  />
                               </div>
                               <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                  <span>완료: {completedCount}개동</span>
                                  <span>진행: {progressCount}개동</span>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>

                {/* Facility Breakdown */}
                <div className="mt-12 space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">부대복리시설 진행 지표</h3>
                     <span className="text-[10px] text-slate-400 font-medium">총 {data.facilities.length}개 항목 분석</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[...data.facilities].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(f => {
                         const avg = getFacilityAverage(f);
                         return (
                            <div key={f.id} className={`${data.settings.theme === 'industrial' ? 'bg-slate-800/50' : 'bg-slate-50/50'} p-4 rounded-xl border ${activeTheme.border} space-y-3`}>
                               <div className="flex items-center justify-between">
                                  <span className={`text-[11px] font-black truncate max-w-[120px] ${data.settings.theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'}`}>{f.name}</span>
                                  <span className={`text-[11px] font-black ${avg === 100 ? 'text-green-500' : activeTheme.text}`}>{Math.round(avg)}%</span>
                               </div>
                               <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${avg}%` }}
                                    className={`h-full ${avg === 100 ? 'bg-green-500' : activeTheme.accent}`} 
                                  />
                               </div>
                               <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                  <span className={`px-1.5 py-0.5 rounded ${f.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : f.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {f.status === 'COMPLETED' ? '완료' : f.status === 'IN_PROGRESS' ? '진행중' : '대기'}
                                  </span>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                   {/* Special Notes / Memo */}
                   <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-6 flex flex-col`}>
                     <div className="flex items-center gap-2 mb-4">
                       <MessageSquare className={`w-5 h-5 ${activeTheme.text}`} />
                       <h3 className={`font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>현장 특이사항 및 메모</h3>
                     </div>
                     <textarea
                       value={data.dashboardNotes || ''}
                       onChange={(e) => handleUpdateDashboardNotes(e.target.value)}
                       placeholder="현장의 주요 이슈, 자재 수급 상황, 특이 기상 등을 기록해 주세요..."
                       className={`flex-1 w-full min-h-[200px] p-4 rounded-xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-900/50 text-slate-300' : 'bg-slate-50 text-slate-700'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm leading-relaxed custom-scrollbar`}
                     />
                   </div>

                   {/* AI Diagnosis */}
                   <div className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} p-6 flex flex-col`}>
                     <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <Sparkles className="w-5 h-5 text-amber-500" />
                         <h3 className={`font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>AI 현장 정밀 진단</h3>
                       </div>
                       <button
                         onClick={handleRunAIDiagnosis}
                         disabled={isDiagnosing}
                         className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${isDiagnosing ? 'bg-slate-100 text-slate-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95'}`}
                       >
                         {isDiagnosing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                         {isDiagnosing ? '분석 중...' : '진단 시작'}
                       </button>
                     </div>
                     <div className={`flex-1 w-full min-h-[200px] p-4 rounded-xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-900/50' : 'bg-slate-50'} overflow-y-auto custom-scrollbar`}>
                       {data.aiDiagnosis ? (
                         <div className={`markdown-body text-sm ${data.settings.theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'}`}>
                           <ReactMarkdown>{data.aiDiagnosis}</ReactMarkdown>
                         </div>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                           <Sparkles className="w-12 h-12" />
                           <p className="text-xs font-bold font-mono">데이터 기반 공정 분석 및 리스크 예측을 시작해 보세요.</p>
                         </div>
                       )}
                     </div>
                   </div>
                </div>
              </div>

              {/* Trash Section */}
              <div className={`mt-8 pt-8 border-t ${activeTheme.border}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Trash className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">최근 삭제 항목 (1시간 이내 복구 가능)</h3>
                </div>
                {trash.filter(item => Date.now() - item.deletedAt < 3600000).length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium italic">삭제된 항목이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trash.filter(item => Date.now() - item.deletedAt < 3600000).map(item => (
                      <div key={item.id} className={`${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} p-4 rounded-xl border ${activeTheme.border} flex items-center justify-between shadow-sm`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[9px] font-black uppercase text-slate-500">{item.type}</span>
                            <span className="text-xs font-bold">{item.type === 'site' ? item.data.settings.projectName : item.data.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">약 {Math.round((Date.now() - item.deletedAt) / 60000)}분 전 삭제됨</p>
                        </div>
                        <button 
                          onClick={() => restoreItem(item)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> 복구하기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Backup & Restore */}
              <div className={`mt-8 pt-8 border-t ${activeTheme.border}`}>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">데이터 관리 (백업 및 복원)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-6 rounded-2xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} space-y-3`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">데이터 백업</h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {isLockedToSite ? '현재 현장의 데이터를 JSON 파일로 내보냅니다.' : '전체 현장 데이터를 JSON 파일로 내보냅니다.'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportData}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                      {isLockedToSite ? '현재 현장 백업 다운로드' : '전체 현장 백업 다운로드'}
                    </button>
                  </div>

                  <div className={`p-6 rounded-2xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} space-y-3`}>
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">데이터 복원</h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {isLockedToSite ? '백업 파일을 불러와 현재 현장 데이터를 복원합니다.' : '백업 파일을 불러와 전체 데이터를 복원합니다.'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {isLockedToSite ? '현재 현장 복원하기' : '전체 데이터 복원하기'}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImportData} 
                      className="hidden" 
                      accept=".json"
                    />
                  </div>
                </div>
              </div>
           </div>
          </motion.div>
        )}

        {viewMode === 'gantt' && (
          <motion.div
            key="gantt"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GanttView 
              processes={processes}
              schedules={data.processSchedules || {}}
              onUpdateSchedule={(p, start, dur) => {
                setData(prev => ({
                  ...prev,
                  processSchedules: {
                    ...(prev.processSchedules || {}),
                    [p]: { startOffset: start, duration: dur }
                  }
                }));
              }}
              startDate={data.settings.startDate}
              endDate={data.settings.endDate}
              stairwellCount={data.settings.stairwellCount}
              unitCount={data.settings.unitCount}
              projectName={data.settings.projectName}
              companyName={data.settings.companyName}
              theme={data.settings.theme}
              activeTheme={activeTheme}
              role={role || 'GUEST'}
              milestones={data.milestones || []}
              onUpdateMilestones={(m) => setData(prev => ({ ...prev, milestones: m }))}
              buildingProgress={processes.reduce((acc, p) => {
                const values = data.buildings.map(b => b.processes[p] || 0);
                acc[p] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
                return acc;
              }, {} as Record<string, number>)}
            />
          </motion.div>
        )}

        {viewMode === 'daily_report' && (
          <motion.div
            key="daily_report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DailyReportView 
              reports={data.dailyReports || []} 
              onAddReport={handleAddDailyReport} 
              onDeleteReport={handleDeleteDailyReport}
              theme={data.settings.theme}
              activeTheme={activeTheme}
              location={data.settings.location}
            />
          </motion.div>
        )}
      </AnimatePresence>

        <div className="hidden print:flex justify-between items-end mt-12 text-[10px] text-slate-400 font-medium border-t pt-4">
          <p>Construction Analytics Platform | {new Date().toLocaleDateString()}</p>
          <p>Project: {data.settings.projectName} | Site Manager: {data.settings.managerName}</p>
          <p>Page 1 / 1</p>
        </div>

        {/* Share Link Modal */}
        <AnimatePresence>
          {shareUrl && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-lg w-full space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 italic">
                    <LinkIcon className={`w-5 h-5 ${activeTheme.text}`} />
                    Share Site
                  </h3>
                  <button onClick={() => setShareUrl(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><Plus className="w-5 h-5 rotate-45" /></button>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">아래 링크를 공유하여 다른 사용자가 이 현장의 데이터를 조회하게 할 수 있습니다.</p>
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} className="flex-1 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-blue-600 truncate" />
                  <button 
                    onClick={() => copyToClipboard(shareUrl)} 
                    className="bg-blue-600 text-white px-6 font-black rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    {isCopied ? '복사됨!' : '링크 복사'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Site Modal */}
        <AnimatePresence>
          {isAddingSite && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tight italic">New Site Add</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">현장 명칭</span>
                    <input autoFocus placeholder="현장 이름을 입력하세요..." value={newSiteName} onChange={e => setNewSiteName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNewSite()} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">접속 비밀번호 (선택사항)</span>
                    <input type="text" placeholder="비밀번호를 입력하세요 (생략 시 무인증)" value={newSitePassword} onChange={e => setNewSitePassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNewSite()} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setIsAddingSite(false); setNewSiteName(''); setNewSitePassword(''); }} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">취소</button>
                    <button onClick={addNewSite} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">현장 생성</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Site Modal */}
        <AnimatePresence>
          {deleteConfirmId && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black italic uppercase">Delete Site?</h3>
                  <p className="text-sm text-slate-500">정말 이 현장을 삭제하시겠습니까?<br/>모든 데이터가 영구적으로 소실됩니다.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">취소</button>
                  <button onClick={() => deleteSite(deleteConfirmId)} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">삭제 실행</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Gallery Modal */}
      <AnimatePresence>
        {galleryTarget && (
          <GalleryModal
            buildingName={data.buildings.find(b => b.id === galleryTarget.buildingId)?.name || ''}
            processName={galleryTarget.processName}
            photos={data.buildings.find(b => b.id === galleryTarget.buildingId)?.photos?.[galleryTarget.processName] || []}
            onClose={() => setGalleryTarget(null)}
            onDelete={(index) => handleDeletePhoto(galleryTarget.buildingId, galleryTarget.processName, index)}
            onViewPhoto={(photo) => setSelectedPhoto(photo)}
          />
        )}
      </AnimatePresence>

      {/* Photo View Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 cursor-pointer no-print"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={selectedPhoto} alt="Captured progress" className="w-full h-auto rounded-2xl shadow-2xl border-4 border-white" />
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute -top-4 -right-4 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={photoUploadRef} 
        onChange={handleUploadPhoto} 
        className="hidden" 
        accept="image/*"
      />

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
