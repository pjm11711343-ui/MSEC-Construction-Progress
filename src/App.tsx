/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  Lock,
  Eye
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
import RestoreComparisonModal from './components/RestoreComparisonModal';
import LocationPicker from './components/LocationPicker';
import ReactMarkdown from 'react-markdown';
import ReportPrintView from './components/ReportPrintView';
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
  DailyReport,
  ProgressSnapshot
} from './types';

import initialDataImport from './data/initial_data.json';

const STORAGE_KEY = 'apt_construction_multi_data';

const createNewSite = (name: string): AppState => ({
  id: Math.random().toString(36).substr(2, 9),
  settings: {
    companyName: 'MSEC 공정관리',
    projectName: name || 'MSEC 스마트 아파트 현장',
    startDate: new Date().toISOString().split('T')[0],
    managerName: '김소장',
    staffName: '이공무',
    buildingCount: 10,
    maxFloor: 29,
    minFloor: -2,
    theme: 'blueprint',
    progressMode: 'floor',
    processModes: DEFAULT_PROCESSES.reduce((acc, p) => ({ ...acc, [p]: 'floor' }), {}),
    fontSize: 11,
    tableSpacing: 2,
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

const migrateSite = (site: any) => {
  if (!site || !site.buildings) return site;

  const fuzzyMatch = (obj: any, targetK: string, fallbackVal: any = undefined) => {
    if (!obj) return fallbackVal;
    if (obj[targetK] !== undefined) return obj[targetK];
    const strippedTarget = targetK.replace(/^\d+\.\s*/, '').trim();
    const keys = Object.keys(obj);
    const matchedKey = keys.find(k => k.replace(/^\d+\.\s*/, '').trim() === strippedTarget);
    if (matchedKey !== undefined) {
      return obj[matchedKey];
    }
    return fallbackVal;
  };

  const newProcessSchedules: Record<string, { startOffset: number; duration: number }> = {};
  const originalSchedules = site.processSchedules || {};
  DEFAULT_PROCESSES.forEach((p, idx) => {
    const existing = fuzzyMatch(originalSchedules, p);
    newProcessSchedules[p] = existing || { startOffset: idx * 7, duration: 30 };
  });

  const originalModes = site.settings?.processModes || {};
  const normalizedModes: Record<string, 'floor' | 'percent'> = {};
  DEFAULT_PROCESSES.forEach(p => {
    normalizedModes[p] = fuzzyMatch(originalModes, p, 'floor');
  });

  return {
    ...site,
    processSchedules: newProcessSchedules,
    milestones: site.milestones || [],
    dailyReports: site.dailyReports || [],
    history: site.history || [],
    settings: {
      ...site.settings,
      processModes: normalizedModes
    },
    buildings: site.buildings.map((b: any) => {
      const newProcesses: Record<string, number> = {};
      const newMaterialProcesses: Record<string, number> = {};
      const newMaterialDates: Record<string, string> = {};

      DEFAULT_PROCESSES.forEach(p => {
        // Try fuzzy matching for each
        let procVal = fuzzyMatch(b.processes, p);
        if (procVal === undefined) {
          // Special cases
          const stripped = p.replace(/^\d+\.\s*/, '').trim();
          if (stripped === "스리브" || stripped === "이중관배관") {
            const keysToTry = ["스리브&이중관배관", "4. 스리브", "5. 스리브", "9. 이중관배관", "스리브", "이중관배관"];
            for (const tk of keysToTry) {
              if (b.processes && b.processes[tk] !== undefined) {
                procVal = b.processes[tk];
                break;
              }
            }
          }
        }
        newProcesses[p] = procVal ?? 0;

        // Try fuzzy matching for material progress
        newMaterialProcesses[p] = fuzzyMatch(b.materialProcesses, p, 0);

        // Try fuzzy matching for material dates
        newMaterialDates[p] = fuzzyMatch(b.materialDates, p, "");
      });

      return {
        ...b,
        processes: newProcesses,
        materialProcesses: newMaterialProcesses,
        materialDates: newMaterialDates
      };
    })
  };
};

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [multiData, setMultiData] = useState<MultiProjectData>({
    activeSiteId: '',
    sites: [],
    adminPassword: '1111'
  });
  
  const [storageState, setStorageState] = useState<AppState>(createNewSite('스마트 아파트 현장'));
  const setData = setStorageState;
  const [processes, setProcesses] = useState<string[]>(DEFAULT_PROCESSES);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'settings' | 'analytics' | 'calendar' | 'daily_report' | 'gantt' | 'report'>('table');
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
  const [shareSiteId, setShareSiteId] = useState<string | null>(null);
  const [copiedLinkType, setCopiedLinkType] = useState<'admin' | 'field' | 'guest' | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCloudSuspended, setIsCloudSuspended] = useState<boolean>(false);
  const [mobileViewType, setMobileViewType] = useState<'card' | 'table'>('card');
  const [isLockedToSite, setIsLockedToSite] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<number | null>(null);
  const [newProcessInput, setNewProcessInput] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [analyticsSelectedProcess, setAnalyticsSelectedProcess] = useState<string>(processes[0] || '1. 건축골조');
  const [photoTarget, setPhotoTarget] = useState<{ buildingId: number, processName: string } | null>(null);
  const [galleryTarget, setGalleryTarget] = useState<{ buildingId: number, processName: string } | null>(null);
  const excelUploadRef = useRef<HTMLInputElement>(null);
  const [excelFileDropActive, setExcelFileDropActive] = useState(false);
  const [excelOptions, setExcelOptions] = useState({
    autoCreateProcesses: true,
    autoCreateBuildings: true,
    truncateProgress: true
  });
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [hoveredProgress, setHoveredProgress] = useState<{ buildingId: number, processName: string, x: number, y: number } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    data: any;
    mode: 'FULL' | 'SINGLE' | 'INITIAL';
    targetSiteId?: string;
  } | null>(null);
  const [trash, setTrash] = useState<any[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [siteAuthenticatedId, setSiteAuthenticatedId] = useState<string | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const getPublicOrigin = () => {
    if (multiData.customBaseUrl && multiData.customBaseUrl.trim() !== '') {
      return multiData.customBaseUrl.trim().replace(/\/$/, '');
    }
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  };

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
          // Migration using helper
          const updatedSites = parsed.sites.map(migrateSite);
          const needsTotalUpdate = updatedSites.length < 10;
          
          let finalSites = updatedSites;
          if (needsTotalUpdate) {
            const needed = 10 - updatedSites.length;
            const additional = Array.from({ length: needed }, (_, i) => createNewSite(`신규 현장 ${updatedSites.length + i + 1}`));
            finalSites = [...updatedSites, ...additional];
          }

          const mData = { ...parsed, sites: finalSites, adminPassword: parsed.adminPassword || '1111' };
          setMultiData(mData);
          if (mData.trash) setTrash(mData.trash);
          
          if (siteParam) {
            setIsLockedToSite(true);
          }

          const targetId = siteParam || mData.activeSiteId;
          const activeSite = mData.sites.find(s => s.id === targetId) || mData.sites[0];
          
          setData(activeSite);
          if (activeSite.buildings?.[0]?.processes) {
            setProcesses(Object.keys(activeSite.buildings[0].processes));
          }
          
          // Persistence fix
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
          
          if (siteParam && mData.sites.some((s: any) => s.id === siteParam)) {
            if (siteParam !== activeSite.id) {
              const newUrl = window.location.pathname + `?site=${activeSite.id}`;
              window.history.replaceState({}, '', newUrl);
            }
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
      const restoredData = initialDataImport as any;
      const initialSite = migrateSite(restoredData.sites.find((s: any) => s.id === restoredData.activeSiteId) || restoredData.sites[0]);
      
      // Ensure we have at least 10 sites total
      let finalSites = restoredData.sites.map(migrateSite);
      if (finalSites.length < 10) {
        const needed = 10 - finalSites.length;
        const additional = Array.from({ length: needed }, (_, i) => createNewSite(`신규 현장 ${finalSites.length + i + 1}`));
        finalSites = [...finalSites, ...additional];
      }
      
      const mData = { activeSiteId: initialSite.id, sites: finalSites };
      setMultiData(mData);
      setData(initialSite);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
      if (initialSite.buildings && initialSite.buildings[0]) {
        setProcesses(Object.keys(initialSite.buildings[0].processes));
      }
    }

    // Auto-login from query params and clean url immediately
    const roleParam = urlParams.get('role');
    const pwParam = urlParams.get('pw');
    if (roleParam === 'ADMIN') {
      const savedMData = localStorage.getItem(STORAGE_KEY);
      let adminPw = '1111';
      if (savedMData) {
        try {
          const parsed = JSON.parse(savedMData);
          adminPw = parsed.adminPassword || '1111';
        } catch (e) {}
      }
      if (pwParam === adminPw) {
        setRole('ADMIN');
        const newUrlParams = new URLSearchParams(window.location.search);
        newUrlParams.delete('role');
        newUrlParams.delete('pw');
        const qs = newUrlParams.toString();
        const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '');
        window.history.replaceState({}, '', cleanUrl);
      }
    } else if (roleParam === 'FIELD') {
      setRole('FIELD');
      const newUrlParams = new URLSearchParams(window.location.search);
      newUrlParams.delete('role');
      const qs = newUrlParams.toString();
      const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '');
      window.history.replaceState({}, '', cleanUrl);
    } else if (roleParam === 'GUEST') {
      setRole('GUEST');
      const newUrlParams = new URLSearchParams(window.location.search);
      newUrlParams.delete('role');
      const qs = newUrlParams.toString();
      const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '');
      window.history.replaceState({}, '', cleanUrl);
    } else if (siteParam && !role) {
      // If shared site parameter is specified, auto-login as GUEST to bypass access screen completely for external guests!
      setRole('GUEST');
    }
    
    if (siteParam) {
      setIsLockedToSite(true);
    }
  }, []);

  const lastSavedContent = useRef<string>('');
  const lastSyncedContentRef = useRef<string>('');
  const hasFetchedFromServer = useRef<boolean>(false);

  // 1. Initial load from server-side database
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/project-data');
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn("[Sync] Initial load response is not JSON:", contentType);
            return;
          }
          const res = await response.json();
          if (res.firestoreSuspended) {
            setIsCloudSuspended(true);
          } else {
            setIsCloudSuspended(false);
          }
          if (res.data) {
            const serverMulti = res.data;
            if (serverMulti.sites) {
              serverMulti.sites = serverMulti.sites.map(migrateSite);
            }
            const serialized = JSON.stringify(serverMulti);
            lastSyncedContentRef.current = serialized;
            
            const urlParams = new URLSearchParams(window.location.search);
            const siteParam = urlParams.get('site');
            
            setMultiData(serverMulti);
            if (serverMulti.trash) setTrash(serverMulti.trash);
            
            const targetId = siteParam || serverMulti.activeSiteId;
            const activeSite = serverMulti.sites.find((s: any) => s.id === targetId) || serverMulti.sites[0];
            
            if (activeSite) {
              lastSavedContent.current = JSON.stringify({
                id: activeSite.id,
                settings: activeSite.settings,
                buildings: activeSite.buildings,
                facilities: activeSite.facilities,
                approval: activeSite.approval
              });
              setData(activeSite);
              if (activeSite.buildings?.[0]?.processes) {
                setProcesses(Object.keys(activeSite.buildings[0].processes));
              }
            }
            
            localStorage.setItem(STORAGE_KEY, serialized);
            console.log("[Sync] Initial project data sync from server succeeded.");
          } else {
            console.log("[Sync] Server has no project data yet, using local storage or fallback.");
          }
        }
      } catch (err) {
        console.error("[Sync] Failed to fetch initial data from server:", err);
      } finally {
        hasFetchedFromServer.current = true;
      }
    };
    fetchInitialData();
  }, []);

  // 2. Auto-save multiData to Express server when it changes
  useEffect(() => {
    if (!hasFetchedFromServer.current) return;
    if (multiData.syncMode === 'manual') return;
    const serialized = JSON.stringify(multiData);
    if (!multiData.sites || multiData.sites.length === 0) return;
    if (serialized === lastSyncedContentRef.current) return;

    const timer = setTimeout(() => {
      fetch('/api/project-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: multiData }),
      }).then(res => {
        if (res.ok) {
          lastSyncedContentRef.current = serialized;
          console.log("[Sync] Project data successfully saved to server.");
          return res.json();
        }
      }).then(json => {
        if (json && json.firestoreSuspended) {
          setIsCloudSuspended(true);
        } else {
          setIsCloudSuspended(false);
        }
      }).catch(err => {
        console.error("[Sync] Failed to save project data to server:", err);
      });
    }, 1500); // 1.5 seconds debounce

    return () => clearTimeout(timer);
  }, [multiData]);

  // 3. Real-time polling for changes from other tabs/iframes
  useEffect(() => {
    if (multiData.syncMode === 'manual') return;
    const interval = setInterval(async () => {
      try {
        // Only pull update if there are no local unsaved changes
        const currentLocalStr = JSON.stringify(multiData);
        if (currentLocalStr !== lastSyncedContentRef.current) {
          // Local changes are pending save, do not overwrite them with server data yet
          return;
        }

        const response = await fetch('/api/project-data');
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            // Ignore non-json responses gracefully (such as proxy/restart warning screens)
            return;
          }
          const res = await response.json();
          if (res.firestoreSuspended) {
            setIsCloudSuspended(true);
          } else {
            setIsCloudSuspended(false);
          }
          if (res.data) {
            const serverMulti = res.data;
            if (serverMulti.sites) {
              serverMulti.sites = serverMulti.sites.map(migrateSite);
            }
            const serialized = JSON.stringify(serverMulti);
            
            if (serialized !== lastSyncedContentRef.current) {
              console.log("[Sync] Remote update detected. Pulling changes from server.");
              lastSyncedContentRef.current = serialized;
              
              setMultiData(serverMulti);
              if (serverMulti.trash) setTrash(serverMulti.trash);
              
              const urlParams = new URLSearchParams(window.location.search);
              const siteParam = urlParams.get('site');
              const targetId = siteParam || serverMulti.activeSiteId;
              const activeSite = serverMulti.sites.find((s: any) => s.id === targetId) || serverMulti.sites[0];
              
              if (activeSite) {
                lastSavedContent.current = JSON.stringify({
                  id: activeSite.id,
                  settings: activeSite.settings,
                  buildings: activeSite.buildings,
                  facilities: activeSite.facilities,
                  approval: activeSite.approval
                });
                setData(activeSite);
                if (activeSite.buildings?.[0]?.processes) {
                  setProcesses(Object.keys(activeSite.buildings[0].processes));
                }
              }
              
              localStorage.setItem(STORAGE_KEY, serialized);
            }
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || '';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('Load failed') || errMsg.includes('NetworkError')) {
          console.warn("[Sync] Server offline or restarting, retrying on next poll...");
        } else {
          console.error("[Sync] Error during real-time polling:", err);
        }
      }
    }, 3000); // Poll every 3 seconds for fast real-time synchronization

    return () => clearInterval(interval);
  }, [multiData]);

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

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      console.log("[Manual Sync] Starting synchronization...");
      
      // 1. First, save our current local data to the server
      const responsePost = await fetch('/api/project-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: multiData }),
      });
      
      if (!responsePost.ok) {
        const errorText = await responsePost.text();
        console.error("[Manual Sync] POST failed:", responsePost.status, errorText);
        throw new Error(`서버 저장 실패 (${responsePost.status}): ${errorText.substring(0, 50)}`);
      }

      const postContentType = responsePost.headers.get('content-type');
      if (postContentType && postContentType.includes('application/json')) {
        const postJson = await responsePost.json();
        if (postJson && postJson.firestoreSuspended) {
          setIsCloudSuspended(true);
        } else {
          setIsCloudSuspended(false);
        }
      }
      lastSyncedContentRef.current = JSON.stringify(multiData);
      console.log("[Manual Sync] Project data pushed to server successfully.");

      // 2. Then, pull latest changes from the server
      const responseGet = await fetch('/api/project-data');
      if (!responseGet.ok) {
        const errorText = await responseGet.text();
        console.error("[Manual Sync] GET failed:", responseGet.status, errorText);
        throw new Error(`서버 데이터 로드 실패 (${responseGet.status}): ${errorText.substring(0, 50)}`);
      }

      const getContentType = responseGet.headers.get('content-type');
      if (!getContentType || !getContentType.includes('application/json')) {
        throw new Error('서버가 올바른 JSON 데이터를 반환하지 않았습니다 (현재 서버가 준비 중이거나 점검 중일 수 있습니다).');
      }

      const res = await responseGet.json();
      if (res.firestoreSuspended) {
        setIsCloudSuspended(true);
      } else {
        setIsCloudSuspended(false);
      }
      
      if (res.data) {
        const serverMulti = res.data;
        if (serverMulti.sites) {
          serverMulti.sites = serverMulti.sites.map(migrateSite);
        }
        const serialized = JSON.stringify(serverMulti);
        
        if (serialized !== lastSyncedContentRef.current) {
          console.log("[Manual Sync] Remote update detected. Pulling changes into local view.");
          lastSyncedContentRef.current = serialized;
          
          setMultiData(serverMulti);
          if (serverMulti.trash) setTrash(serverMulti.trash);
          
          const urlParams = new URLSearchParams(window.location.search);
          const siteParam = urlParams.get('site');
          const targetId = siteParam || serverMulti.activeSiteId;
          const activeSite = serverMulti.sites.find((s: any) => s.id === targetId) || serverMulti.sites[0];
          
          if (activeSite) {
            lastSavedContent.current = JSON.stringify({
              id: activeSite.id,
              settings: activeSite.settings,
              buildings: activeSite.buildings,
              facilities: activeSite.facilities,
              approval: activeSite.approval
            });
            setData(activeSite);
            if (activeSite.buildings?.[0]?.processes) {
              setProcesses(Object.keys(activeSite.buildings[0].processes));
            }
          }
          
          localStorage.setItem(STORAGE_KEY, serialized);
        }
      }
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: any) {
      console.error("[Manual Sync] Error during synchronization:", err);
      // alert(`동기화 실패: ${err.message}`); // Optional: show detailed alert
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const switchSite = (id: string) => {
    const site = multiData.sites.find(s => s.id === id);
    if (site) {
      lastSavedContent.current = JSON.stringify({
        id: site.id,
        settings: site.settings,
        buildings: site.buildings,
        facilities: site.facilities,
        approval: site.approval
      });
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
    const url = `${getPublicOrigin()}${window.location.pathname}?site=${data.id}`;
    setShareUrl(url);
    copyToClipboard(url);
    setCopiedLinkType('guest');
    setTimeout(() => setCopiedLinkType(null), 2000);
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

  const updateStateForTarget = (
    updater: (buildings: BuildingData[], facilities: CommonFacility[]) => { buildings: BuildingData[], facilities: CommonFacility[] }
  ) => {
    const today = new Date().toISOString().split('T')[0];
    if (viewDate === today) {
      setData(prev => {
        const { buildings, facilities } = updater(prev.buildings, prev.facilities);
        return { ...prev, buildings, facilities };
      });
    } else {
      setData(prev => {
        const newHistory = [...(prev.history || [])];
        const idx = newHistory.findIndex(h => h.date === viewDate);
        if (idx >= 0) {
          const snapshot = newHistory[idx];
          const { buildings, facilities } = updater(snapshot.buildings || [], snapshot.facilities || []);
          
          // Re-calculate snapshot averageProgress
          const buildingAverages = buildings.map(b => {
            const vals = Object.values(b.processes) as number[];
            return vals.length > 0 ? vals.reduce((sum, val) => sum + val, 0) / vals.length : 0;
          });
          const overallAverage = Math.round(
            buildingAverages.length > 0 
              ? buildingAverages.reduce((sum, val) => sum + val, 0) / buildingAverages.length 
              : 0
          );

          newHistory[idx] = {
            ...snapshot,
            buildings,
            facilities,
            averageProgress: overallAverage
          };
        }
        return { ...prev, history: newHistory };
      });
    }
  };

  const handleCreateHistoryForDate = (targetDate: string) => {
    if (role === 'GUEST') return;
    
    setData(prev => {
      const newHistory = [...(prev.history || [])];
      
      // Sort history to find the closest prior date
      const sortedHistory = [...newHistory].sort((a, b) => a.date.localeCompare(b.date));
      
      let sourceBuildings = prev.buildings;
      let sourceFacilities = prev.facilities;
      
      const priorSnapshot = [...sortedHistory].reverse().find(h => h.date < targetDate);
      if (priorSnapshot) {
        sourceBuildings = priorSnapshot.buildings || prev.buildings;
        sourceFacilities = priorSnapshot.facilities || prev.facilities;
      }
      
      // Deep copy buildings & processes/material items without heavy photo blocks to keep storage clean
      const copiedBuildings = sourceBuildings.map(b => {
        const { photos, ...rest } = b;
        return {
          ...rest,
          processes: { ...b.processes },
          materialProcesses: b.materialProcesses ? { ...b.materialProcesses } : {},
          materialDates: b.materialDates ? { ...b.materialDates } : {}
        } as BuildingData;
      });
      
      const copiedFacilities = sourceFacilities.map(f => ({
        ...f,
        processes: f.processes ? { ...f.processes } : {},
        inactiveProcesses: f.inactiveProcesses ? [...f.inactiveProcesses] : []
      } as CommonFacility));

      // Calculate snapshot initial average
      const buildingAverages = copiedBuildings.map(b => {
        const vals = Object.values(b.processes) as number[];
        return vals.length > 0 ? vals.reduce((sum, val) => sum + val, 0) / vals.length : 0;
      });
      const overallAverage = Math.round(
        buildingAverages.length > 0 
          ? buildingAverages.reduce((sum, val) => sum + val, 0) / buildingAverages.length 
          : 0
      );

      const newSnapshot: ProgressSnapshot = {
        date: targetDate,
        averageProgress: overallAverage,
        buildings: copiedBuildings,
        facilities: copiedFacilities
      };

      // Push and maintain chronological order
      const existingIdx = newHistory.findIndex(h => h.date === targetDate);
      if (existingIdx >= 0) {
        newHistory[existingIdx] = newSnapshot;
      } else {
        newHistory.push(newSnapshot);
      }
      newHistory.sort((a, b) => a.date.localeCompare(b.date));

      const updatedState = { ...prev, history: newHistory };
      
      // Trigger local storage save after state resolves
      setTimeout(() => {
        saveData();
      }, 50);

      return updatedState;
    });
  };

  const handleUpdateProgress = (buildingId: number, processName: string, value: number) => {
    if (role === 'GUEST') return;
    updateStateForTarget((buildings, facilities) => {
      const nextBuildings = buildings.map(b => 
        b.id === buildingId 
          ? { ...b, processes: { ...b.processes, [processName]: Math.min(100, Math.max(0, value)) } }
          : b
      );
      return { buildings: nextBuildings, facilities };
    });
  };

  const handleUpdateMaterialProgress = (buildingId: number, processName: string, value: number) => {
    if (role === 'GUEST') return;
    updateStateForTarget((buildings, facilities) => {
      const nextBuildings = buildings.map(b => 
        b.id === buildingId 
          ? { ...b, materialProcesses: { ...(b.materialProcesses || {}), [processName]: value } }
          : b
      );
      return { buildings: nextBuildings, facilities };
    });
  };

  const handleUpdateMaterialDate = (buildingId: number, processName: string, date: string) => {
    if (role === 'GUEST') return;
    updateStateForTarget((buildings, facilities) => {
      const nextBuildings = buildings.map(b => 
        b.id === buildingId 
          ? { ...b, materialDates: { ...(b.materialDates || {}), [processName]: date } }
          : b
      );
      return { buildings: nextBuildings, facilities };
    });
  };

  const handleUpdateFacilityStatus = (facilityId: string) => {
    if (role === 'GUEST') return;
    const statusOrder: CommonFacility['status'][] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    updateStateForTarget((buildings, facilities) => {
      const nextFacilities = facilities.map(f => {
        if (f.id === facilityId) {
          const currentIndex = statusOrder.indexOf(f.status);
          const nextIndex = (currentIndex + 1) % statusOrder.length;
          return { ...f, status: statusOrder[nextIndex] };
        }
        return f;
      });
      return { buildings, facilities: nextFacilities };
    });
  };

  const handleUpdateFacilitySubProcess = (facilityId: string, processName: string, value: number) => {
    if (role === 'GUEST') return;
    updateStateForTarget((buildings, facilities) => {
      const nextFacilities = facilities.map(f => {
        if (f.id === facilityId) {
          const currentProcesses = f.processes || {};
          const nextProcesses = { ...currentProcesses, [processName]: value };
          
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
      });
      return { buildings, facilities: nextFacilities };
    });
  };

  const toggleFacilityProcess = (facilityId: string, processName: string) => {
    if (role === 'GUEST') return;
    updateStateForTarget((buildings, facilities) => {
      const nextFacilities = facilities.map(f => {
        if (f.id === facilityId) {
          const inactive = f.inactiveProcesses || [];
          const isInactive = inactive.includes(processName);
          const nextInactive = isInactive 
            ? inactive.filter(p => p !== processName)
            : [...inactive, processName];
            
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
      });
      return { buildings, facilities: nextFacilities };
    });
  };

  const handleUpdateDashboardNotes = (notes: string) => {
    if (viewDate !== new Date().toISOString().split('T')[0]) return;
    setData(prev => ({ ...prev, dashboardNotes: notes }));
  };

  const handleExportData = () => {
    let exportData;
    let fileName;
    
    // In Administrator mode (ADMIN role and not locked), backup all sites.
    // When viewing a specific site (Locked to site or non-admin), backup only that site.
    if (role === 'ADMIN' && !isLockedToSite) {
      exportData = multiData;
      fileName = `construction_all_backup_${new Date().toISOString().split('T')[0]}.json`;
    } else {
      exportData = { sites: [data], activeSiteId: data.id };
      fileName = `${data.settings.projectName.trim()}_backup_${new Date().toISOString().split('T')[0]}.json`;
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    const { data: json, mode, targetSiteId } = pendingRestore;

    try {
      if (mode === 'INITIAL' || (mode === 'FULL' && !isLockedToSite)) {
         const restoredData = json as any;
         const initialSite = migrateSite(restoredData.sites.find((s: any) => s.id === restoredData.activeSiteId) || restoredData.sites[0]);
         
         let finalSites = restoredData.sites.map(migrateSite);
         if (finalSites.length < 10) {
           const needed = 10 - finalSites.length;
           const additional = Array.from({ length: needed }, (_, i) => createNewSite(`신규 현장 ${finalSites.length + i + 1}`));
           finalSites = [...finalSites, ...additional];
         }
         
         const mData = { ...multiData, activeSiteId: initialSite.id, sites: finalSites };
         setMultiData(mData);
         setData(initialSite);
         localStorage.setItem(STORAGE_KEY, JSON.stringify(mData));
         
         if (initialSite.buildings && initialSite.buildings[0]) {
           setProcesses(Object.keys(initialSite.buildings[0].processes));
         }
         
         alert('전체 데이터 복원이 완료되었습니다.');
         window.location.reload(); 
      } else {
        // Single site or specific site restore
        const siteCandidate = mode === 'SINGLE' ? json : (json.sites ? (json.sites.find((s: any) => s.id === (targetSiteId || data.id)) || json.sites.find((s: any) => s.settings?.projectName === data.settings.projectName) || json.sites[0]) : json);
        const finalSite = { ...migrateSite(siteCandidate), id: targetSiteId || data.id };
        
        setMultiData(prev => {
          const updatedSites = prev.sites.map(s => s.id === (targetSiteId || data.id) ? finalSite : s);
          const nextMulti = { ...prev, sites: updatedSites };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMulti));
          return nextMulti;
        });
        setData(finalSite);
        lastSavedContent.current = '';
        if (finalSite.buildings && finalSite.buildings[0]) {
          setProcesses(Object.keys(finalSite.buildings[0].processes));
        }
        alert('현장 데이터 복원이 완료되었습니다.');
        window.location.reload();
      }
    } catch (err) {
      console.error('Restore error:', err);
      alert('데이터 복원 중 오류가 발생했습니다.');
    } finally {
      setPendingRestore(null);
    }
  };

  const handleDownloadExcelTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Start with standard DEFAULT_PROCESSES in the exact correct sequence
      const finalProcs = [...DEFAULT_PROCESSES];
      // Append any additional custom processes currently active in the view that are not in the standard list
      processes.forEach(p => {
        if (!finalProcs.includes(p)) {
          finalProcs.push(p);
        }
      });

      // Header row
      const headerRow = ["동 명칭", ...finalProcs];
      // Data rows
      const dataRows = data.buildings.map(b => {
        const row: (string | number)[] = [b.name];
        finalProcs.forEach(p => {
          row.push(b.processes[p] ?? 0);
        });
        return row;
      });

      // Sheet 1: Main Upload Sheet (Must be the first sheet)
      const wsMain = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      
      // Auto-fit column widths for the main sheet
      const colWidthsMain = headerRow.map((h, i) => {
        const maxLen = Math.max(
          h.length,
          ...dataRows.map(row => String(row[i] || '').length)
        );
        return { wch: Math.max(maxLen + 4, 12) };
      });
      wsMain['!cols'] = colWidthsMain;
      XLSX.utils.book_append_sheet(wb, wsMain, "공정진행률_업로드");

      // Sheet 2: Detailed Guide Sheet (For user reference)
      const guideRows = [
        ["MSEC 스마트 아파트 공정관리 시스템 - 엑셀 업로드 작성 가이드", ""],
        ["계정 역할: 관리자, 공무, 소장 등 (GUEST는 불가능)", ""],
        ["", ""],
        ["[1. 기본 규칙 안내]", ""],
        ["규칙 ① - 첫 번째 열(A열) 헤더명", "반드시 '동 명칭'이어야 하며, 행별로 실제 등록된 동 명칭(예: 101동, 102동 등)을 세로로 기입해야 합니다."],
        ["규칙 ② - 공정(열) 이름", "두 번째 열(B열)부터 가로로 공정명(예: '1. 건축골조', '2. HOIST' 등)을 기입합니다. 다운로드받으신 표준 양식을 그대로 유지하는 것을 권장합니다."],
        ["규칙 ③ - 진행률 데이터 범위", "실제 현장의 공정률은 0부터 100 사이의 숫자로만 입력해 주십시오. (기호 % 제외)"],
        ["규칙 ④ - 공정제외 지정하기", "해당 동에서 특정 공정이 성격상 제외되는 경우 숫자 '-1' 또는 공란(빈칸)으로 두시면 자동으로 '공정제외' 상태로 파싱 및 셋팅됩니다."],
        ["규칙 ⑤ - 대소문자 및 띄어쓰기", "공종명에 띄어쓰기가 있는 경우 가능하면 표준 명칭과 똑같이 맞춰 주셔야 오류 매칭을 방지할 수 있습니다."],
        ["", ""],
        ["[2. 시스템 필수 표준 22대 공종 목록]", ""],
        ...DEFAULT_PROCESSES.map((p, idx) => [`순번 ${idx + 1}`, p]),
        ["", ""],
        ["[3. 엑셀 데이터 예시]", ""],
        ["동 명칭", "1. 건축골조", "2. HOIST", "3. 기초매립배관", "4. 알폼세팅", "5. 스리브", "...기타 공종..."],
        ["101동", "100", "0", "100", "100", "45", "0 ~ 100 숫자 입력"],
        ["102동", "85", "-1", "100", "100", "20", "'-1' 입력 시 공정제외 처리"],
        ["103동", "0", "0", "0", "0", "0", "미착공 상태"]
      ];

      const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
      
      // Auto-fit column widths for the guide sheet
      const colWidthsGuide = [
        { wch: 30 },
        { wch: 80 }
      ];
      wsGuide['!cols'] = colWidthsGuide;
      XLSX.utils.book_append_sheet(wb, wsGuide, "업로드_작성_가이드");

      const fileName = `${data.settings.projectName.trim() || '현장'}_공정진행률_업로드_템플릿.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error(err);
      alert(`엑셀 템플릿 생성 실패: ${err.message || err}`);
    }
  };

  const handleExcelFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (!sheetData || sheetData.length < 2) {
          alert("엑셀 파일에 유효한 데이터가 없습니다. 최소한 '동 명칭' 헤더 행과 1개 이상의 데이터 행이 필요합니다.");
          return;
        }

        // Filter out completely empty rows
        const rows = sheetData.filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== ""));
        if (rows.length < 2) {
          alert("유효한 데이터 행이 부족합니다. (최소한 헤더와 1개 이상의 데이터 행 필요)");
          return;
        }

        const currentBuildingNames = data.buildings.map(b => b.name.trim());
        
        // Decide if transposition is needed
        const firstColCells = rows.slice(1).map(r => String(r[0] || '').trim());
        const firstRowCells = rows[0].slice(1).map(c => String(c || '').trim());

        // Count match scores
        const colMatches = firstColCells.filter(cell => currentBuildingNames.includes(cell) || cell.endsWith('동') || cell.endsWith('호') || /^\d+$/.test(cell)).length;
        const rowMatches = firstRowCells.filter(cell => currentBuildingNames.includes(cell) || cell.endsWith('동') || cell.endsWith('호') || /^\d+$/.test(cell)).length;

        let isTransposed = false;
        if (rowMatches > colMatches) {
          isTransposed = true; // Columns match buildings, rows match processes
        }

        let parsedRows: any[][] = rows;
        if (isTransposed) {
          const maxCols = Math.max(...rows.map(r => r.length));
          const transposed: any[][] = [];
          for (let c = 0; c < maxCols; c++) {
            const newRow: any[] = [];
            for (let r = 0; r < rows.length; r++) {
              newRow.push(rows[r][c]);
            }
            transposed.push(newRow);
          }
          parsedRows = transposed.filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== ""));
        }

        const headers = parsedRows[0].map(h => String(h || '').trim());
        const importedProgressColumns = headers.slice(1).filter(h => h !== '');

        if (importedProgressColumns.length === 0) {
          alert("엑셀 시트에서 유효한 공정 열 이름을 식별할 수 없습니다.");
          return;
        }

        setData(prev => {
          let updatedProcesses = [...processes];
          const existingProcSet = new Set(processes);
          
          if (excelOptions.autoCreateProcesses) {
            importedProgressColumns.forEach(p => {
              if (!existingProcSet.has(p)) {
                updatedProcesses.push(p);
              }
            });
            setTimeout(() => {
              setProcesses(updatedProcesses);
            }, 50);
          }

          let updatedBuildings = [...prev.buildings];
          
          parsedRows.slice(1).forEach(row => {
            const rawBName = String(row[0] || '').trim();
            if (!rawBName) return;

            let bName = rawBName;
            if (/^\d+$/.test(bName)) {
              bName = `${bName}동`;
            }

            let bIdx = updatedBuildings.findIndex(b => b.name.trim() === bName || b.name.trim() === rawBName);

            if (bIdx === -1 && excelOptions.autoCreateBuildings) {
              const nextId = Math.max(0, ...updatedBuildings.map(b => b.id)) + 1;
              const newBuilding: BuildingData = {
                id: nextId,
                name: bName,
                processes: {}
              };
              updatedBuildings.push(newBuilding);
              bIdx = updatedBuildings.length - 1;
            }

            if (bIdx !== -1) {
              const b = updatedBuildings[bIdx];
              const updatedProcMap = { ...b.processes };
              
              importedProgressColumns.forEach((procName, colIdx) => {
                const cellVal = row[colIdx + 1];
                if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
                  if (excelOptions.autoCreateProcesses || existingProcSet.has(procName)) {
                    let val = parseFloat(cellVal);
                    if (!isNaN(val)) {
                      if (excelOptions.truncateProgress) {
                        val = Math.max(0, Math.min(100, Math.round(val)));
                      } else {
                        val = Math.max(0, Math.min(100, val));
                      }
                      updatedProcMap[procName] = val;
                    }
                  }
                }
              });

              updatedBuildings[bIdx] = {
                ...b,
                processes: updatedProcMap
              };
            }
          });

          const buildingCount = updatedBuildings.length;

          return {
            ...prev,
            buildings: updatedBuildings,
            settings: {
              ...prev.settings,
              buildingCount
            }
          };
        });

        alert(`공정 엑셀 데이터 파싱이 정상적으로 처리되었습니다!\n지정된 동/공정의 진행률 데이터가 연동되었습니다.`);
      } catch (err: any) {
        console.error(err);
        alert(`엑셀 파일 구문 분석 실패: ${err.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    if (excelUploadRef.current) {
      excelUploadRef.current.value = '';
    }
  };

  const handleExcelUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleExcelFile(file);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        let json = JSON.parse(result);
        
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
              setPendingRestore({ data: json, mode: isMultiFile ? 'FULL' : 'SINGLE', targetSiteId: data.id });
            } else {
              alert('복원 가능한 현장 데이터를 찾을 수 없습니다.');
            }
          } else {
            if (isMultiFile) {
              setPendingRestore({ data: json, mode: 'FULL' });
            } else {
              setPendingRestore({ data: json, mode: 'SINGLE', targetSiteId: data.id });
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
      // Server connectivity check
      try {
        await fetch('/api/health').then(r => r.json()).then(d => console.log("Health OK:", d)).catch(e => console.warn("Health fail:", e));
      } catch (e) {}

      // 서버 정밀 진단 수행 전 데이터 경량화 (사진 데이터는 진단 프롬프트에 포함되지 않으므로 스트립)
      const strippedData = {
        ...data,
        buildings: (data.buildings || []).map(b => ({ ...b, photos: undefined })),
        history: [] // 히스토리도 제외하여 전송량 최소화
      };

      const response = await fetch('/api/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: strippedData }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }

        if (response.status === 404) {
          throw new Error(`진단 API를 찾을 수 없습니다 (404). 
호출 URL: /api/ai-diagnosis
서버 응답: ${errorData.error || 'N/A'}`);
        } else if (response.status === 405) {
          throw new Error(`진단 API 요청 방식이 거부되었습니다 (405). 
호출 URL: /api/ai-diagnosis
서버 설정이나 네트워크 환경을 확인해 주세요.`);
        }
        throw new Error(errorData.error || `서버 오류 (${response.status})`);
      }

      const result = await response.json();
      if (result.diagnosis) {
        setData(prev => ({ 
          ...prev, 
          aiDiagnosis: result.diagnosis,
          aiRisks: result.risks || [],
          aiActions: result.actions || []
        }));
      }
    } catch (error: any) {
      console.error("AI Diagnosis failed:", error);
      alert(error.message || "AI 진단 요청에 실패했습니다.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleExtractFromImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]); // Only base64 data
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const response = await fetch('/api/extract-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64,
          mimeType: file.type 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }

        if (response.status === 404) {
          throw new Error(`진단 API를 찾을 수 없습니다 (404). 
서버에서 기능을 지원하지 않거나 경로가 잘못되었습니다.
서버 응답: ${errorData.error || 'N/A'}`);
        }
        throw new Error(errorData.error || `서버 오류 (${response.status})`);
      }

      const result = await response.json();
      
      if (result.buildings && Array.isArray(result.buildings)) {
        if (window.confirm(`${result.buildings.length}개 동의 공정 데이터를 자동 업데이트하시겠습니까?`)) {
          setData(prev => ({
            ...prev,
            buildings: prev.buildings.map(b => {
              const aiBuilding = result.buildings.find((ab: any) => 
                ab.name === b.name || ab.name.includes(b.name) || b.name.includes(ab.name)
              );
              if (aiBuilding && aiBuilding.processes) {
                return {
                  ...b,
                  processes: {
                    ...b.processes,
                    ...aiBuilding.processes
                  }
                };
              }
              return b;
            })
          }));
          alert('공정표가 성공적으로 업데이트되었습니다.');
        }
      } else {
        throw new Error("이미지에서 유효한 공정 데이터를 찾을 수 없습니다.");
      }
    } catch (error: any) {
      console.error("AI Extraction failed:", error);
      alert(error.message || "공정 추출 중 오류가 발생했습니다.");
    } finally {
      setIsExtracting(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRestoreInitialData = () => {
    setPendingRestore({ data: initialDataImport as any, mode: 'INITIAL' });
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
      accentHex: '#2563eb',
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
      accentHex: '#0077be',
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
      accentHex: '#00ff9f',
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
      accentHex: '#4a6741',
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
    return <LoginModal onLogin={setRole} adminPassword={multiData.adminPassword} />;
  }

  // 관리자 초기 화면 (현장 목록 대시보드)
  if (role === 'ADMIN' && !multiData.activeSiteId && !isLockedToSite) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">현장 관리 대시보드</h1>
              <p className="text-slate-500 mt-2 font-medium">관리자 모드로 접속 중입니다. 관리할 현장을 선택하세요.</p>
            </div>
            <button 
              onClick={() => { setRole(null); setSiteAuthenticatedId(null); }}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-red-600 font-bold transition-colors"
            >
              <LogOut className="w-5 h-5" />
              로그아웃
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {multiData.sites.map((site, index) => (
              <motion.div
                key={`${site.id || site.settings.projectName || 'site'}-${index}`}
                whileHover={{ scale: 1.02, translateY: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => switchSite(site.id)}
                className="group p-6 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all text-left flex flex-col justify-between h-52 cursor-pointer"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Building2 className="w-6 h-6" />
                    </div>
                    {site.settings.sitePassword && <Lock className="w-4 h-4 text-slate-300" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{site.settings.projectName}</h3>
                  <p className="text-sm text-slate-500 mt-1">{site.settings.companyName}</p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                  <span className="text-[10px] font-bold text-slate-400">마지막 저장: {site.lastSaved ? site.lastSaved.split(',')[0] : '기록 없음'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareSiteId(site.id);
                        const url = `${getPublicOrigin()}${window.location.pathname}?site=${site.id}`;
                        setShareUrl(url);
                      }}
                      className="p-1 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-[10px] font-black tracking-tight transition-all flex items-center gap-1 shadow-sm"
                      title="이 현장의 권한별 공유 링크 생성"
                    >
                      <LinkIcon className="w-2.5 h-2.5" />
                      링크 생성
                    </button>
                    <div className="flex items-center text-blue-600 font-bold text-xs">
                      현장 관리 <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            
            <button
              onClick={() => setIsAddingSite(true)}
              className="p-6 bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-white hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-4 text-slate-400 h-52 group"
            >
              <div className="p-4 rounded-full border-2 border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">새 현장 추가하기</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'FIELD' && siteAuthenticatedId !== data.id) {
    // 1. Initial State: No site authenticated yet (and not a direct link)
    if (!siteAuthenticatedId && !isLockedToSite) {
      return (
        <SiteSelector 
          sites={multiData.sites} 
          customBaseUrl={multiData.customBaseUrl}
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
        
        {isCloudSuspended && (
          <div className="bg-[#4f46e5]/90 text-white text-[10px] py-1 px-4 text-center font-bold relative flex items-center justify-center gap-2 border-b border-indigo-500/30">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>클라우드 서버 쿼터 제한 도달: 데이터는 본 기기의 로컬 가상 디스크 파일 &amp; 메모리에 실시간 보안 보존 중입니다. (편집/조회 정상 상태)</span>
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
        <div className="max-w-[1600px] mx-auto px-4 py-2 md:py-0 md:h-16 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-2">
          {/* Top Brand (logo + project name + calendar) AND mobile quick actions */}
          <div className="flex items-center justify-between w-full md:w-auto min-w-0 shrink-0">
            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
              <div className={`${activeTheme.accent} p-1.5 rounded-lg text-white shrink-0 ${data.settings.theme === 'industrial' ? 'text-black' : ''}`}>
                <Construction className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h1 className={`font-black text-xs md:text-sm leading-tight uppercase tracking-tight truncate ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`} style={{ maxWidth: '180px' }}>
                  {data.settings.projectName}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider truncate max-w-[60px]">{data.settings.companyName}</span>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                    <Calendar className="w-2.5 h-2.5 text-blue-500" />
                    <input 
                      type="date" 
                      value={viewDate}
                      onChange={(e) => setViewDate(e.target.value)}
                      className="bg-transparent border-none p-0 text-[8px] font-black focus:ring-0 cursor-pointer text-slate-600 dark:text-slate-300 w-16"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Actions: Save, Print, Logout */}
            <div className="flex items-center gap-1 md:hidden">
              <div className="flex items-center mr-1 text-[8px] text-slate-400">
                {isAutoSaving ? (
                  <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 ${activeTheme.accent} rounded-full animate-pulse`} /> 저장중</span>
                ) : (
                  <span>저장됨: {data.lastSaved.split(',')[1]}</span>
                )}
              </div>
              <button 
                type="button"
                onClick={saveData} 
                className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} 
                title="저장"
              >
                <Save className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => window.print()} 
                className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} 
                title="인쇄"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => { setRole(null); setSiteAuthenticatedId(null); }} 
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-red-500 transition-colors" 
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile middle row: Site Selector + Admin/Role/Sync control bar */}
          <div className="flex md:hidden items-center justify-between gap-2 w-full border-t border-slate-200/40 dark:border-slate-800/40 pt-2 shrink-0">
            <div className={`flex items-center gap-0.5 ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-0.5 border ${activeTheme.border} flex-1 min-w-0 overflow-hidden`}>
              <div className="flex items-center px-1 py-0.5 gap-1 border-r border-slate-300 dark:border-slate-700 min-w-0 flex-1">
                <Building2 className={`w-2.5 h-2.5 ${activeTheme.text} shrink-0`} />
                {isLockedToSite && role !== 'ADMIN' ? (
                  <div className={`text-[8px] font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'} px-0.5 truncate`}>
                    {data.settings.projectName}
                  </div>
                ) : (
                  <select 
                    value={data.id} 
                    onChange={(e) => switchSite(e.target.value)}
                    className={`bg-transparent text-[8px] font-black border-none focus:ring-0 cursor-pointer appearance-none ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'} px-0.5 truncate w-full`}
                  >
                    {multiData.sites.map((s, index) => (
                      <option key={`${s.id || s.settings.projectName || 's'}-${index}`} value={s.id} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        {s.settings.projectName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-0.5 px-0.5 shrink-0">
                {role === 'FIELD' && !isLockedToSite && (
                  <button 
                    type="button"
                    onClick={() => setSiteAuthenticatedId(null)}
                    className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                    title="현장 목록으로 돌아가기"
                  >
                    <LayoutGrid className={`w-2.5 h-2.5 ${activeTheme.text}`} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={copySiteLink}
                  className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group relative`}
                  title="현장 링크 복사"
                >
                  {isCopied ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : <LinkIcon className={`w-2.5 h-2.5 ${activeTheme.text}`} />}
                </button>
                {role === 'ADMIN' && (
                  <button 
                    type="button"
                    onClick={() => setIsAddingSite(true)}
                    className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                    title="신규 현장 추가"
                  >
                    <Plus className={`w-3 h-3 ${activeTheme.text}`} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-[8px] no-print">
              {role === 'ADMIN' && (
                <button 
                  type="button"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full transition-all ${isEditMode ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-705'}`}
                >
                  <SettingsIcon className={`w-2 h-2 ${isEditMode ? 'animate-spin-slow' : ''}`} />
                  {isEditMode ? '수정중' : '수정'}
                </button>
              )}
              {!isLockedToSite && (
                <button 
                  type="button"
                  onClick={() => {
                    const nextRole = role === 'ADMIN' ? 'FIELD' : 'ADMIN';
                    setRole(nextRole);
                    if (nextRole === 'FIELD') setSiteAuthenticatedId(null);
                  }}
                  className={`flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full transition-all ${role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                >
                  {role === 'ADMIN' ? <ShieldCheck className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                  {role === 'ADMIN' ? '현장' : '관리자'}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Swipeable Navigation Menu Tabs Row */}
          <div className="w-full md:hidden overflow-x-auto scrollbar-none shrink-0 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 no-print">
            <div className={`flex ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-0.5 min-w-max gap-0.5`}>
              <button 
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'table' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                공정표
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'grid' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                대시보드
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'calendar' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                달력
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('daily_report')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'daily_report' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                일보
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'gantt' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                간트
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'analytics' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
              >
                리포트
              </button>
              {(role === 'ADMIN' || role === 'FIELD') && (
                <button 
                  type="button"
                  onClick={() => setViewMode('settings')}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${viewMode === 'settings' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {role === 'ADMIN' ? '설정' : '보안'}
                </button>
              )}
            </div>
          </div>

          {/* Desktop Right Hand Containers (Flex-1 flow on md: viewport and up) */}
          <div className="hidden md:flex items-center justify-end gap-1 flex-1 min-w-0">
              <div className={`flex items-center gap-0.5 ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-0.5 mr-0.5 border ${activeTheme.border} shrink-1 min-w-0 overflow-hidden`}>
                <div className="flex items-center px-0.5 py-0.5 gap-1 border-r border-slate-300 dark:border-slate-700 max-w-[120px]">
                  <Building2 className={`w-2.5 h-2.5 ${activeTheme.text} shrink-0`} />
                  {isLockedToSite && role !== 'ADMIN' ? (
                    <div className={`text-[8px] font-black ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'} px-0.5 truncate`}>
                      {data.settings.projectName}
                    </div>
                  ) : (
                    <select 
                      value={data.id} 
                      onChange={(e) => switchSite(e.target.value)}
                      className={`bg-transparent text-[8px] font-black border-none focus:ring-0 cursor-pointer appearance-none ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'} px-0.5 truncate w-full`}
                    >
                      {multiData.sites.map((s, index) => (
                        <option key={`${s.id || s.settings.projectName || 's'}-${index}`} value={s.id} className={data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-950'}>
                          {s.settings.projectName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-0.5 px-0.5">
                  {role === 'FIELD' && !isLockedToSite && (
                    <button 
                      type="button"
                      onClick={() => setSiteAuthenticatedId(null)}
                      className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                      title="현장 목록으로 돌아가기"
                    >
                      <LayoutGrid className={`w-2.5 h-2.5 ${activeTheme.text}`} />
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={copySiteLink}
                    className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group relative`}
                    title="현장 링크 복사"
                  >
                    {isCopied ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : <LinkIcon className={`w-2.5 h-2.5 ${activeTheme.text}`} />}
                  </button>
                  {role === 'ADMIN' && (
                    <>
                      <button 
                        type="button"
                        onClick={() => {
                          const adminUrl = `${getPublicOrigin()}${window.location.pathname}?role=ADMIN&pw=${multiData.adminPassword || '1111'}${data.id ? `&site=${data.id}` : ''}`;
                          setShareUrl(adminUrl);
                          copyToClipboard(adminUrl);
                        }}
                        className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                        title="관리자 접속 링크 복사"
                      >
                        <ShieldCheck className={`w-2.5 h-2.5 text-indigo-650 dark:text-indigo-400`} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsAddingSite(true)}
                        className={`p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all group`}
                        title="신규 현장 추가"
                      >
                        <Plus className={`w-3 h-3 ${activeTheme.text}`} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className={`flex ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg p-0.5 shrink-0`}>
              <button 
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'table' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                공정표
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'grid' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                대시보드
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'calendar' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                달력
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('daily_report')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'daily_report' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-755'}`}
              >
                일보
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('gantt')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'gantt' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                간트
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('analytics')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'analytics' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                리포트
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('report')}
                className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'report' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
              >
                인쇄모드
              </button>
              {(role === 'ADMIN' || role === 'FIELD') && (
                <button 
                  type="button"
                  onClick={() => setViewMode('settings')}
                  className={`px-1.5 py-1 rounded-md text-[8px] font-black transition-all ${viewMode === 'settings' ? `bg-white shadow-sm ${activeTheme.text}` : 'text-slate-500 hover:text-slate-750'}`}
                >
                  {role === 'ADMIN' ? '설정' : '보안'}
                </button>
              )}
            </div>

            <div className={`flex items-center gap-0.5 ml-auto border-r pr-1 ${activeTheme.border} no-print text-[8px] shrink-0`}>
               {role === 'ADMIN' && (
                 <button 
                  type="button"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95 ${isEditMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                 >
                  <SettingsIcon className={`w-2.5 h-2.5 ${isEditMode ? 'animate-spin-slow' : ''}`} />
                  {isEditMode ? '수정 중' : '수정'}
                </button>
               )}
               {!isLockedToSite && (
                 <button 
                  type="button"
                  onClick={() => {
                    const nextRole = role === 'ADMIN' ? 'FIELD' : 'ADMIN';
                    setRole(nextRole);
                    if (nextRole === 'FIELD') setSiteAuthenticatedId(null);
                  }}
                  className={`flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95 ${role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                 >
                  {role === 'ADMIN' ? <ShieldCheck className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                  {role === 'ADMIN' ? '현장 모드' : '관리자 모드'}
                </button>
               )}
               {multiData.syncMode === 'manual' && (
                 <button 
                   type="button"
                   onClick={handleManualSync}
                   disabled={isSyncing}
                   className={`flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95 ${
                     syncStatus === 'success' 
                       ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                       : syncStatus === 'error' 
                       ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                       : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                   }`}
                   title="수동 동기화 실행 (로컬 저장 후 원격 데이터 가져오기)"
                 >
                   <Save className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                   {isSyncing ? '동기화 중' : syncStatus === 'success' ? '동기화 완료' : syncStatus === 'error' ? '실패' : '수동 동기화'}
                 </button>
               )}
              <div className="flex items-center gap-1 text-slate-400 min-w-[70px]">
                {isAutoSaving ? (
                  <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 ${activeTheme.accent} rounded-full animate-pulse`} /> 저장중...</span>
                ) : (
                  <span>저장완료: {data.lastSaved.split(',')[1]}</span>
                )}
              </div>
            </div>

            <button type="button" onClick={saveData} className={`p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} title="저장">
              <Save className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => window.print()} className={`p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors ${data.settings.theme === 'industrial' ? 'hover:bg-slate-800' : ''}`} title="인쇄">
              <Printer className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => { setRole(null); setSiteAuthenticatedId(null); }} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="로그아웃">
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
              className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl border font-bold text-sm shadow-xl gap-4 ${ (data as any).isMissing ? 'bg-red-50 border-red-200 text-red-600 shadow-red-900/5' : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-900/5' }`}
            >
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className={`p-2 rounded-xl ${(data as any).isMissing ? 'bg-red-100' : 'bg-emerald-100 text-emerald-600'}`}>
                  { (data as any).isMissing ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" /> }
                </div>
                <div>
                  <p className="text-base">{(data as any).isMissing ? '저장된 데이터 없음' : `${viewDate} 공정 현황 조회 & 수정 중`}</p>
                  <p className={`text-[10px] font-medium opacity-80`}>
                    {(data as any).isMissing 
                      ? '선택하신 날짜에는 기록된 공정 데이터가 존재하지 않습니다. 새로운 공정 보고서를 작성하시려면 기록 작성을 클릭하세요.' 
                      : '과거 공정 기록을 편집하고 있습니다. 여기서 수정한 내용은 이 날짜에 실시간으로 보존됩니다.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                { (data as any).isMissing && role !== 'GUEST' && (
                  <button 
                    type="button"
                    onClick={() => handleCreateHistoryForDate(viewDate)}
                    className="px-4 py-2 rounded-xl font-black transition-all hover:scale-105 active:scale-95 shadow-md bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 text-xs text-center"
                  >
                    이 날짜의 공정 기록 작성 시작하기
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setViewDate(new Date().toISOString().split('T')[0])}
                  className={`px-4 py-2 rounded-xl font-black transition-all hover:scale-105 active:scale-95 shadow-md text-xs text-center ${ (data as any).isMissing ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-500/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' }`}
                >
                  오늘로 돌아가기
                </button>
              </div>
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

             {role === 'ADMIN' && (
               <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl mb-8 space-y-4">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200">
                       <Lock className="w-5 h-5" />
                     </div>
                     <div>
                       <p className="font-bold text-slate-800 text-sm">시스템 관리자 비밀번호 및 링크</p>
                       <p className="text-[10px] text-slate-500">모든 현장을 관리할 수 있는 마스터 비밀번호와 직접 진입할 수 있는 링크입니다.</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 flex-wrap md:flex-nowrap w-full md:w-auto">
                     <input 
                       type="password" 
                       value={multiData.adminPassword || ''}
                       onChange={(e) => {
                         const newVal = e.target.value;
                         setMultiData(prev => {
                           const updated = { ...prev, adminPassword: newVal };
                           localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                           return updated;
                         });
                       }}
                       className="px-4 py-2 border-2 border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all w-full md:w-48 bg-white font-bold"
                       placeholder="비밀번호 설정"
                     />
                     <button
                       onClick={() => {
                         const adminUrl = `${getPublicOrigin()}${window.location.pathname}?role=ADMIN&pw=${multiData.adminPassword || '1111'}${data.id ? `&site=${data.id}` : ''}`;
                         setShareUrl(adminUrl);
                         copyToClipboard(adminUrl);
                       }}
                       className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all w-full md:w-auto justify-center"
                     >
                       <LinkIcon className="w-3.5 h-3.5" />
                       관리자 링크 복사
                     </button>
                   </div>
                 </div>

                 <div className="border-t border-indigo-100 pt-4 space-y-2">
                   <div className="flex items-center gap-1.5">
                     <span className="text-xs font-black text-indigo-900">공유 링크 기본 주소 (Base URL)</span>
                     <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-200 text-indigo-950">도메인 커스텀</span>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-relaxed">
                     구글 AI Studio 테스트 주소(ais-dev-)는 구글 계정 보안(Access Control)으로 인해 외부 공유가 불가능하고 <strong>403 에러</strong>가 발생합니다.<br />
                     정식으로 배포한 공용 도메인 주소(예: Vercel, Cloud Run 등)가 있다면 아래에 입력하세요. 그 주소를 기반으로 복사 링크가 자동 제작됩니다.
                   </p>
                   <input 
                     type="text" 
                     value={multiData.customBaseUrl || ''}
                     onChange={(e) => {
                       const newVal = e.target.value;
                       setMultiData(prev => {
                         const updated = { ...prev, customBaseUrl: newVal };
                         localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                         return updated;
                       });
                     }}
                     className="w-full px-4 py-2 border border-indigo-100 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all bg-white text-indigo-950"
                     placeholder="예시: https://your-public-deployed-url.run.app"
                   />
                 </div>
               </div>
             )}

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
                        <div className="pt-3 border-t border-slate-200/40 space-y-2">
                          <span className="text-xs font-semibold text-slate-400 mb-1 block">데이터 동기화 방식 설정</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setMultiData(prev => {
                                  const updated = { ...prev, syncMode: 'auto' as const };
                                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                                  return updated;
                                });
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                (multiData.syncMode || 'auto') === 'auto'
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                                  : `${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 hover:bg-slate-50'}`
                              }`}
                            >
                              실시간 연동 (3초 자동)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMultiData(prev => {
                                  const updated = { ...prev, syncMode: 'manual' as const };
                                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                                  return updated;
                                });
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                multiData.syncMode === 'manual'
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                                  : `${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 hover:bg-slate-50'}`
                              }`}
                            >
                              수동 연동 (트래픽 차단)
                            </button>
                          </div>
                          <p className={`text-[10px] leading-relaxed ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {multiData.syncMode === 'manual' 
                              ? '⚠️ 수동 설정 시 백그라운드 서버 통신이 발생하지 않으며, 우측 상단이나 아래 버튼을 눌러야 명시적으로 동기화가 실행됩니다.' 
                              : '동 구성원 및 여러 기기 간 실시간 변경 사항을 3초마다 가져옵니다.'}
                          </p>
                          {multiData.syncMode === 'manual' && (
                            <button
                              type="button"
                              onClick={handleManualSync}
                              disabled={isSyncing}
                              className={`w-full py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 border mt-1 ${
                                syncStatus === 'success'
                                  ? 'bg-green-100 border-green-200 text-green-700 dark:bg-green-950/20 dark:text-green-300'
                                  : syncStatus === 'error'
                                  ? 'bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300'
                                  : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-[#00ff9f]'
                              }`}
                            >
                              <Save className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                              {isSyncing ? '동기화 통신 중...' : syncStatus === 'success' ? '동기화 완결!' : syncStatus === 'error' ? '동기화 실패' : '지금 즉시 동기화 실행'}
                            </button>
                          )}
                        </div>
                      )}
                      {role === 'ADMIN' && (
                        <div className="col-span-full pt-4 space-y-3">
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">현장 정밀 위치 설정 (지도)</h3>
                          <LocationPicker 
                            initialLocation={data.settings.location}
                            initialCoords={data.settings.locationCoords}
                            onLocationSelect={(location, coords) => {
                               setData({
                                 ...data,
                                 settings: {
                                   ...data.settings,
                                   location,
                                   locationCoords: coords
                                 }
                               });
                            }}
                            theme={data.settings.theme}
                          />
                          <p className="text-[10px] text-slate-400 font-bold">지도를 클릭하거나 주소를 검색하여 현장 위치를 정확하게 지정해 주세요. 날씨 정보 연동에 사용됩니다.</p>
                        </div>
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

             {role !== 'GUEST' && (
               <div className="space-y-4 pt-8 border-t border-slate-200/40" id="upload-options-card">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider text-center lg:text-left">현장 공정 데이터 일괄 업로드 및 파싱 옵션</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Left: Drag and Drop Upload Zone */}
                   <div className="lg:col-span-2 flex flex-col">
                     <div 
                       onDragOver={(e) => {
                         e.preventDefault();
                         setExcelFileDropActive(true);
                       }}
                       onDragLeave={() => setExcelFileDropActive(false)}
                       onDrop={(e) => {
                         e.preventDefault();
                         setExcelFileDropActive(false);
                         const file = e.dataTransfer.files?.[0];
                         if (file) handleExcelFile(file);
                       }}
                       className={`w-full h-full min-h-[220px] border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                         data.settings.theme === 'industrial' 
                           ? (excelFileDropActive 
                               ? 'border-[#00ff9f] bg-[#00ff9f]/5 text-slate-100 scale-[0.99]' 
                               : 'border-[#2d333d] hover:border-slate-500 bg-[#1e2229] text-slate-100')
                           : (excelFileDropActive 
                               ? `${activeTheme.border} bg-blue-50/50 scale-[0.99]` 
                               : 'border-slate-200 hover:border-slate-400 bg-slate-50/10 backdrop-blur-sm')
                       }`}
                       onClick={() => excelUploadRef.current?.click()}
                     >
                       <div className={`p-4 rounded-full ${data.settings.theme === 'industrial' ? 'bg-[#2d333d]' : 'bg-green-50'} mb-3`}>
                         <Upload className={`w-8 h-8 ${data.settings.theme === 'industrial' ? 'text-[#00ff9f]' : 'text-green-600'}`} />
                       </div>
                       <h4 className={`text-base font-black flex items-center gap-1.5 justify-center ${data.settings.theme === 'industrial' ? 'text-[#00ff9f]' : 'text-slate-900'}`}>
                         현장별 공정 엑셀 (Excel) 및 CSV 업로드
                       </h4>
                       <p className={`text-xs font-semibold mt-2 ${data.settings.theme === 'industrial' ? 'text-slate-200' : 'text-slate-600'}`}>
                         여기에 마우스로 파일을 끌어 구성원들과 공유하거나 <span className={`${activeTheme.text} font-bold underline`}>파일 찾아보기</span>를 눌러주세요.
                       </p>
                       <p className={`text-[10px] mt-1 ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>
                         지원은 .xlsx, .xls, .csv 포맷이며 동 이름 또는 번호를 기준으로 데이터를 매핑합니다.
                       </p>
                       <input 
                         type="file" 
                         ref={excelUploadRef} 
                         onChange={handleExcelUploadChange} 
                         accept=".xlsx,.xls,.csv" 
                         className="hidden" 
                       />
                     </div>
                   </div>

                   {/* Right: Upload Settings Option Card Column */}
                   <div className="flex flex-col">
                   <div className={`p-5 rounded-2xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-[#1a1d23] text-slate-200' : 'bg-slate-50 text-slate-800'} flex flex-col gap-4 shadow-sm`}>
                     <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                       <span className={`text-xs font-black ${data.settings.theme === 'industrial' ? 'text-[#00ff9f]' : 'text-slate-900'}`}>엑셀 / CSV 파싱 설정</span>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDownloadExcelTemplate();
                         }}
                         className={`px-2.5 py-1 text-[9px] font-black ${activeTheme.button} ${data.settings.theme === 'industrial' ? 'text-black' : 'text-white'} rounded-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95`}
                         title="현재 현장 기준 전용 템플릿 파일 생성"
                       >
                         <Download className="w-2.5 h-2.5" />
                         템플릿 양식 받기
                       </button>
                     </div>

                     <div className="space-y-4 pt-1">
                       <label className="flex items-start gap-2.5 cursor-pointer select-none">
                         <input 
                           type="checkbox" 
                           checked={excelOptions.autoCreateProcesses}
                           onChange={(e) => setExcelOptions(prev => ({ ...prev, autoCreateProcesses: e.target.checked }))}
                           className="rounded text-blue-600 border-slate-300 w-4 h-4 mt-0.5 focus:ring-blue-500"
                         />
                         <div className="flex flex-col gap-0.5">
                           <span className={`text-[10px] font-bold ${data.settings.theme === 'industrial' ? 'text-slate-200' : 'text-slate-800'}`}>신규 공정 자동 생성</span>
                           <span className={`text-[8.5px] leading-tight ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>엑셀 열에 명시된 새로운 공정을 공정표에 자동 추가합니다.</span>
                         </div>
                       </label>

                       <label className="flex items-start gap-2.5 cursor-pointer select-none">
                         <input 
                           type="checkbox" 
                           checked={excelOptions.autoCreateBuildings}
                           onChange={(e) => setExcelOptions(prev => ({ ...prev, autoCreateBuildings: e.target.checked }))}
                           className="rounded text-blue-600 border-slate-300 w-4 h-4 mt-0.5 focus:ring-blue-500"
                         />
                         <div className="flex flex-col gap-0.5">
                           <span className={`text-[10px] font-bold ${data.settings.theme === 'industrial' ? 'text-slate-200' : 'text-slate-800'}`}>없는 '동(건물)' 자동 추가</span>
                           <span className={`text-[8.5px] leading-tight ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>기존 데이터에 등록되지 않은 동을 엑셀 기준으로 자동 신설합니다.</span>
                         </div>
                       </label>

                       <label className="flex items-start gap-2.5 cursor-pointer select-none">
                         <input 
                           type="checkbox" 
                           checked={excelOptions.truncateProgress}
                           onChange={(e) => setExcelOptions(prev => ({ ...prev, truncateProgress: e.target.checked }))}
                           className="rounded text-blue-600 border-slate-300 w-4 h-4 mt-0.5 focus:ring-blue-500"
                         />
                         <div className="flex flex-col gap-0.5">
                           <span className={`text-[10px] font-bold ${data.settings.theme === 'industrial' ? 'text-slate-200' : 'text-slate-800'}`}>진행률 정수로 반올림</span>
                           <span className={`text-[8.5px] leading-tight ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>소수점 단위 수치 데이터를 완결도 높게 일반 정수(0~100)로 자동 보정합니다.</span>
                         </div>
                       </label>
                     </div>

                     <div className={`text-[8.5px] p-2 leading-normal rounded border font-medium mt-2 ${data.settings.theme === 'industrial' ? 'text-amber-400 bg-amber-950/30 border-amber-500/20' : 'text-[#9a3412] bg-[#fffbeb] border-[#fef3c7]'}`}>
                       ⚠️ 엑셀의 첫 번째 열은 <span className="font-bold underline">반드시 동 이름</span>이어야 하며, 나머지 열 이름은 입력할 공정 명칭이어야 함에 유의해 주세요. 템플릿을 받아 사용하시는 것을 적극 권장합니다.
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           )}
         </div>
          </motion.div>
        )}

        {viewMode === 'report' && (
          <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-4"
          >
            <div className="flex flex-col items-center gap-6 mb-12 no-print">
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-base">최종 보고서 인쇄 모드</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">A4 규격에 최적화된 고해상도 출력 레이아웃입니다.</p>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="ml-4 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  지금 바로 인쇄
                </button>
              </div>

              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200/50 dark:border-amber-700/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                 <AlertTriangle className="w-4 h-4 shrink-0" />
                 <span>브라우저 인쇄 설정에서 '배경 그래픽 포함' 옵션을 활성화하시면 더 깔끔한 결과물을 얻으실 수 있습니다.</span>
              </div>
            </div>

            <ReportPrintView 
              data={data} 
              sortedProcesses={sortedDisplayProcesses} 
            />
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
              location={data.settings.location}
              coords={data.settings.locationCoords}
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
            {/* Mobile layout selector toggle */}
            <div className="md:hidden flex flex-col gap-2 mb-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm no-print">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400">화면 레이아웃 모드</span>
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setMobileViewType('card')}
                    className={`px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      mobileViewType === 'card' 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-[#00ff9f] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    카드형 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewType('table')}
                    className={`px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      mobileViewType === 'table' 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-[#00ff9f] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    표(테이블) 보기
                  </button>
                </div>
              </div>
              {mobileViewType === 'table' && (
                <div className="flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="animate-bounce">↔</span>
                  <span>좌우 방향(↔)으로 쓸어넘겨서 전체 공정을 확인해 보세요.</span>
                </div>
              )}
            </div>

            {/* Mobile Actions Panel (Visible Only in Mobile Card View) */}
            {mobileViewType === 'card' && role !== 'GUEST' && (
              <div className="md:hidden grid grid-cols-2 gap-3 mb-4 no-print">
                <button
                  type="button"
                  onClick={addBuilding}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black border transition-all ${
                    data.settings.theme === 'industrial'
                      ? 'bg-[#1a1d23] border-[#2d333d] text-slate-200 hover:bg-slate-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  } shadow-sm`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>동 추가</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewProcessInput(true)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black border transition-all ${
                    data.settings.theme === 'industrial'
                      ? 'bg-[#1a1d23] border-[#2d333d] text-slate-200 hover:bg-slate-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  } shadow-sm`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>공종 추가</span>
                </button>
              </div>
            )}

            {/* Desktop / Large Screen Table (Also visible under mobile if mobileViewType is 'table') */}
            <div 
              className={`${activeTheme.card} rounded-2xl shadow-sm border ${activeTheme.border} overflow-auto max-h-[calc(100vh-180px)] custom-scrollbar ${
                mobileViewType === 'card' ? 'hidden md:block' : 'block'
              }`}
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
                  const isIndustrial = data.settings.theme === 'industrial';
                  const isEven = bIdx % 2 === 0;

                  // Alternating row background colors for clear visual separation
                  const rowBgClass = isIndustrial
                    ? (isEven ? 'bg-[#15181d]' : 'bg-[#1e2229]')
                    : (isEven ? 'bg-white' : 'bg-slate-50/70');

                  // Specific colored background for sticky columns to avoid opacity transparency bleed
                  const stickyBgClass = isIndustrial
                    ? (isEven ? 'bg-[#15181d]' : 'bg-[#1e2229]')
                    : (isEven ? 'bg-white' : 'bg-slate-100');

                  return (
                    <tr key={b.id} className={`${rowBgClass} ${isIndustrial ? 'hover:bg-slate-800/80 text-white border-b border-slate-800' : 'hover:bg-blue-100/30'} transition-colors`}>
                      <td 
                        className={`border-r-2 ${isIndustrial ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'} ${stickyBgClass} text-center font-black text-[10px] sticky left-0 z-10`}
                        style={{ padding: cellPadding }}
                      >
                        {bIdx + 1}
                      </td>
                      <td 
                        className={`border-r-2 ${isIndustrial ? 'border-[#2d333d] text-white' : 'border-slate-200 text-slate-900'} ${stickyBgClass} text-center font-black group relative sticky left-8 z-10`}
                        style={{ padding: cellPadding }}
                      >
                        <div 
                          className={`flex flex-col items-center justify-center gap-0.5`}
                          style={{ padding: cellPadding }}
                        >
                          <input 
                            type="text" 
                            value={b.name} 
                            disabled={role === 'GUEST'} 
                            onChange={(e) => renameBuilding(b.id, e.target.value)} 
                            className={`w-full text-center bg-transparent border-none focus:ring-0 p-0 font-black text-xs tracking-tighter ${isIndustrial ? 'text-white' : 'text-slate-900'}`} 
                          />
                          
                          {role !== 'GUEST' && (
                            <div className="flex items-center gap-1 no-print">
                              <div className={`flex items-center gap-0.5 px-1 py-0 rounded ${isIndustrial ? 'bg-slate-800/80 border border-slate-700 text-slate-200' : 'bg-slate-200/50'}`}>
                                <span className={`text-[8px] font-black ${isIndustrial ? 'text-slate-400' : 'text-slate-500'}`}>B</span>
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
                                  className={`w-4 h-3 text-[8px] text-center p-0 bg-transparent border-none focus:ring-0 font-black ${isIndustrial ? 'text-white' : 'text-slate-900'}`}
                                />
                              </div>
                              <div className={`flex items-center gap-0.5 px-1 py-0 rounded ${isIndustrial ? 'bg-slate-800/80 border border-slate-700 text-slate-200' : 'bg-slate-200/50'}`}>
                                <span className={`text-[8px] font-black ${isIndustrial ? 'text-slate-400' : 'text-slate-500'}`}>F</span>
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
                                  className={`w-4 h-3 text-[8px] text-center p-0 bg-transparent border-none focus:ring-0 font-black ${isIndustrial ? 'text-white' : 'text-slate-900'}`}
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
                          <td key={p} className={`border-r-2 ${isIndustrial ? 'border-slate-800' : 'border-slate-200'} p-0 relative`}>
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
                                className={`text-[10px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center p-0 m-0 ${bProcesses[p] === 100 ? (isIndustrial ? 'text-emerald-400 font-extrabold' : 'text-green-600') : (bProcesses[p] === -1 ? 'text-slate-500 font-medium' : (isIndustrial ? 'text-slate-100 font-extrabold' : 'text-slate-700'))}`}
                              >
                                <option value={0}>대기</option>
                                <option value={1}>진행</option>
                                <option value={-1}>N/A</option>
                                <option value={100}>완료</option>
                                {getProcessMode(p) === 'percent' ? (
                                  <optgroup label="진행율 선택" className={isIndustrial ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                                      <option key={v} value={v} className={isIndustrial ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>{v}%</option>
                                    ))}
                                  </optgroup>
                                ) : (
                                  <optgroup label="층수 선택" className={isIndustrial ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                    {floors.map(f => (
                                      <option key={f} value={floorToPercent(f, b)} className={isIndustrial ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                        {formatFloor(f)}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="flex items-center justify-center gap-0.5 mt-0">
                              <span className={`text-[8px] font-black pointer-events-none ${isIndustrial ? 'text-slate-300' : 'text-slate-400 opacity-60'}`}>{bProcesses[p] === -1 ? '-' : `${bProcesses[p] ?? 0}%`}</span>
                              <div className="flex items-center gap-0.5 no-print">
                                <button 
                                  onClick={() => {
                                    setPhotoTarget({ buildingId: b.id, processName: p });
                                    setTimeout(() => photoUploadRef.current?.click(), 100);
                                  }}
                                  className={`p-0 rounded-full transition-colors ${b.photos?.[p]?.length ? 'text-blue-500' : (isIndustrial ? 'text-slate-500 hover:text-slate-400' : 'text-slate-300 hover:text-slate-400')}`}
                                  title="사진 첨부"
                                >
                                  <ImageIcon className="w-2.5 h-2.5" />
                                </button>
                                {(b.photos?.[p] || []).length > 0 && (
                                  <button 
                                    onClick={() => setGalleryTarget({ buildingId: b.id, processName: p })}
                                    className={`text-[8px] font-black ${isIndustrial ? 'text-blue-400' : 'text-blue-500'}`}
                                  >
                                    [{b.photos[p].length}]
                                  </button>
                                )}
                              </div>
                            </div>
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isIndustrial ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  {bProcesses[p] !== -1 && (
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${bProcesses[p] ?? 0}%` }}
                                      transition={{ duration: 0.5, ease: 'easeOut' }}
                                      className={`h-full ${bProcesses[p] === 100 ? (isIndustrial ? 'bg-emerald-400' : 'bg-green-500') : activeTheme.accent}`} 
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Material Progress & Date */}
                              <div className={`flex flex-col gap-0.5 border-t pt-1 ${isIndustrial ? 'border-slate-800' : 'border-slate-100'}`}>
                                  <div className={`flex items-center justify-center gap-1.5 pt-2 border-t ${isIndustrial ? 'border-slate-800' : 'border-slate-200'}`}>
                                      <span className={`text-[8px] font-black uppercase ${isIndustrial ? 'text-slate-300' : 'text-slate-400'}`}>자재</span>
                                      <select 
                                        value={mProcesses[p] ?? 0} 
                                        disabled={role === 'GUEST'} 
                                        onChange={e => handleUpdateMaterialProgress(b.id, p, Number(e.target.value))}
                                        className={`text-[9px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center p-0 m-0 ${mProcesses[p] === 100 ? (isIndustrial ? 'text-amber-400 font-extrabold' : 'text-amber-600') : (isIndustrial ? 'text-slate-200' : 'text-slate-500')}`}
                                      >
                                        <option value={0}>자재미입고</option>
                                        <option value={1}>진행중</option>
                                        <option value={-1}>N/A</option>
                                        <option value={100}>입고완료</option>
                                        {getProcessMode(p) === 'percent' ? (
                                          <optgroup label="진행율 선택" className={isIndustrial ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                                              <option key={v} value={v} className={isIndustrial ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>{v}%</option>
                                            ))}
                                          </optgroup>
                                        ) : (
                                          <optgroup label="층수 선택" className={isIndustrial ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}>
                                            {floors.map(f => (
                                              <option key={f} value={floorToPercent(f, b)} className={isIndustrial ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                                {formatFloor(f)}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </select>
                                      <div className={`w-10 h-1.5 rounded-full overflow-hidden ${isIndustrial ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${mProcesses[p] ?? 0}%` }}
                                          transition={{ duration: 0.5, ease: 'easeOut' }}
                                          className={`h-full ${mProcesses[p] === 100 ? 'bg-amber-500' : 'bg-amber-400/50'}`} 
                                        />
                                      </div>
                                      <span className={`text-[8px] font-black ml-0.5 ${isIndustrial ? 'text-amber-300' : 'text-amber-500/60'}`}>{mProcesses[p] === -1 ? '-' : `${mProcesses[p] ?? 0}%`}</span>
                                  </div>
                                  <div className={`flex items-center justify-center gap-1 mt-1 border-t pt-1.5 ${isIndustrial ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                    <input 
                                      type="date" 
                                      value={mDates[p] || ''} 
                                      disabled={role === 'GUEST'}
                                      onChange={e => handleUpdateMaterialDate(b.id, p, e.target.value)}
                                      className={`bg-transparent border-none p-0 text-[8px] font-black focus:ring-0 cursor-pointer text-center ${isIndustrial ? 'text-slate-200 hover:text-white' : 'text-slate-400'}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className={`text-center font-black text-[12px] border-l-2 ${isIndustrial ? 'bg-emerald-950/40 text-[#00ff9f] border-slate-800' : 'bg-blue-50/50 text-blue-600 border-slate-200'}`}>
                          {avg}%
                        </td>
                        {role !== 'GUEST' && (
                          <td className={`border-l-2 ${isIndustrial ? 'border-slate-800' : 'border-slate-200'} text-center px-1 no-print py-2`}>
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

          {/* Mobile Card Layout */}
          {mobileViewType === 'card' && (
            <div className="md:hidden space-y-4">
              {[...data.buildings]
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                .map((b, bIdx) => {
                  const processValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                  const avg = processes.length > 0 && processValues.length > 0 
                    ? Math.round(processValues.reduce((a, v) => a + v, 0) / processValues.length) 
                    : 0;
                  const isIndustrial = data.settings.theme === 'industrial';
                  const floors = getFloorList(b);

                  return (
                    <div 
                      key={b.id} 
                      className={`p-4 rounded-2xl border ${activeTheme.border} ${activeTheme.card} shadow-sm space-y-4`}
                    >
                      {/* Header: Building Info & Average */}
                      <div className="flex items-center justify-between border-b pb-3 border-slate-200/50 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-[#00ff9f]/10 text-xs font-black text-blue-600 dark:text-[#00ff9f]">
                            {bIdx + 1}
                          </span>
                          <div className="flex flex-col">
                            <input 
                              type="text" 
                              value={b.name} 
                              disabled={role === 'GUEST'} 
                              onChange={(e) => renameBuilding(b.id, e.target.value)} 
                              className={`font-black text-sm p-0 m-0 bg-transparent border-none focus:ring-0 w-24 ${isIndustrial ? 'text-white' : 'text-slate-900'}`} 
                            />
                            {/* Floor Information */}
                            {role !== 'GUEST' && (
                              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 font-bold">
                                <span className="flex items-center gap-0.5">
                                  지하: 
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
                                    className="w-4 h-3 text-center p-0 bg-transparent border-none focus:ring-0 font-extrabold text-blue-500 dark:text-[#00ff9f]"
                                  />
                                  층
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="flex items-center gap-0.5">
                                  지상: 
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
                                    className="w-4 h-3 text-center p-0 bg-transparent border-none focus:ring-0 font-extrabold text-blue-500 dark:text-[#00ff9f]"
                                  />
                                  층
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">평균 공정률</span>
                            <span className={`text-sm font-black ${isIndustrial ? 'text-[#00ff9f]' : 'text-blue-600'}`}>{avg}%</span>
                          </div>
                          {role !== 'GUEST' && (
                            <button 
                              onClick={() => deleteBuilding(b.id)} 
                              className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/20"
                              title="동 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Processes list for this building */}
                      <div className="space-y-3">
                        {sortedDisplayProcesses.map((p) => {
                          const bProcesses = b.processes || {};
                          const mProcesses = b.materialProcesses || {};
                          const mDates = b.materialDates || {};
                          const isDone = bProcesses[p] === 100;
                          const isNa = bProcesses[p] === -1;

                          return (
                            <div 
                              key={p}
                              className={`p-3 rounded-xl border ${isIndustrial ? 'border-slate-800 bg-slate-900/30' : 'border-slate-100 bg-slate-50/40'} space-y-2`}
                            >
                              {/* Process Title / Header Row */}
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-black truncate max-w-[180px] ${isIndustrial ? 'text-slate-200' : 'text-slate-700'}`}>
                                  {p}
                                </span>
                                
                                {/* Progress Value Status Tag */}
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                  isDone 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                                    : isNa 
                                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450' 
                                    : 'bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-450'
                                }`}>
                                  {isNa ? 'N/A' : `${bProcesses[p] ?? 0}%`}
                                </span>
                              </div>

                              {/* Controls: Progress Selector & Photos */}
                              <div className="grid grid-cols-2 gap-2">
                                {/* Progress Selector */}
                                <div className={`p-1 flex items-center justify-between rounded-lg border ${isIndustrial ? 'border-slate-800 bg-slate-950' : 'border-slate-150 bg-white'}`}>
                                  <span className="text-[9px] font-bold text-slate-400 pl-1">공정:</span>
                                  <select 
                                    value={bProcesses[p] ?? 0} 
                                    disabled={role === 'GUEST'} 
                                    onChange={e => handleUpdateProgress(b.id, p, Number(e.target.value))}
                                    className="text-[10px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer p-0 text-right pr-0.5"
                                  >
                                    <option value={0}>대기</option>
                                    <option value={1}>진행</option>
                                    <option value={-1}>N/A</option>
                                    <option value={100}>완료</option>
                                    {getProcessMode(p) === 'percent' ? (
                                      <optgroup label="진행율">
                                        {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                                          <option key={v} value={v}>{v}%</option>
                                        ))}
                                      </optgroup>
                                    ) : (
                                      <optgroup label="층수">
                                        {floors.map(f => (
                                          <option key={f} value={floorToPercent(f, b)}>
                                            {formatFloor(f)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>

                                {/* Photo Attach Column */}
                                <div className={`p-1 flex items-center justify-between rounded-lg border ${isIndustrial ? 'border-slate-800 bg-slate-950' : 'border-slate-150 bg-white'}`}>
                                  <span className="text-[9px] font-bold text-slate-400 pl-1">사진:</span>
                                  <div className="flex items-center gap-1.5 pr-1">
                                    <button 
                                      onClick={() => {
                                        setPhotoTarget({ buildingId: b.id, processName: p });
                                        setTimeout(() => photoUploadRef.current?.click(), 100);
                                      }}
                                      disabled={role === 'GUEST'}
                                      className={`p-0.5 rounded transition-colors ${b.photos?.[p]?.length ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                                      title="사진 첨부"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                    </button>
                                    {(b.photos?.[p] || []).length > 0 && (
                                      <button 
                                        onClick={() => setGalleryTarget({ buildingId: b.id, processName: p })}
                                        className={`text-[9px] font-black text-blue-500 underline`}
                                      >
                                        [{b.photos[p].length}]
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Active Progress Bar */}
                              {bProcesses[p] !== -1 && (
                                <div className={`w-full h-1 my-1 rounded-full overflow-hidden ${isIndustrial ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                  <div 
                                    className={`h-full ${bProcesses[p] === 100 ? 'bg-green-500' : activeTheme.accent}`}
                                    style={{ width: `${bProcesses[p] ?? 0}%` }}
                                  />
                                </div>
                              )}

                              {/* Material Details Section */}
                              <div className={`grid grid-cols-2 gap-2 border-t pt-2 ${isIndustrial ? 'border-slate-800' : 'border-slate-100'}`}>
                                {/* Material Status Selector */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400">자재 현황</span>
                                  <select 
                                    value={mProcesses[p] ?? 0} 
                                    disabled={role === 'GUEST'} 
                                    onChange={e => handleUpdateMaterialProgress(b.id, p, Number(e.target.value))}
                                    className={`text-[10px] font-black bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer p-0 m-0 ${
                                      mProcesses[p] === 100 
                                        ? 'text-amber-500 font-extrabold' 
                                        : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    <option value={0}>자재미입고</option>
                                    <option value={1}>진행중</option>
                                    <option value={-1}>N/A</option>
                                    <option value={100}>입고완료</option>
                                  </select>
                                  <div className={`w-full h-1 rounded-full overflow-hidden mt-1 ${isIndustrial ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                    <div 
                                      className={`h-full ${mProcesses[p] === 100 ? 'bg-amber-500' : 'bg-amber-400/50'}`}
                                      style={{ width: `${mProcesses[p] ?? 0}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Material Delivery Date */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400">자재 반입일</span>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <input 
                                      type="date" 
                                      value={mDates[p] || ''} 
                                      disabled={role === 'GUEST'}
                                      onChange={e => handleUpdateMaterialDate(b.id, p, e.target.value)}
                                      className={`bg-transparent border-none p-0 text-[10px] font-black focus:ring-0 cursor-pointer text-slate-600 dark:text-slate-300 w-full`}
                                    />
                                  </div>
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
          )}

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
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${avgProgress}%` }}
                         transition={{ duration: 0.5, ease: 'easeOut' }}
                         className={`h-full ${avgProgress === 100 ? 'bg-green-500' : activeTheme.accent}`} 
                       />
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
            {/* AI Diagnosis Summary Cards */}
            {(data.aiRisks && data.aiRisks.length > 0 || data.aiActions && data.aiActions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-5 shadow-sm relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-8 -mt-8" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-rose-500 rounded-lg text-white">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-rose-900 dark:text-rose-400">핵심 위험 요소</h3>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">AI REAL-TIME RISK ANALYSIS</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {(data.aiRisks || []).map((risk, i) => (
                      <li key={i} className="flex gap-3 items-start group">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-200 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center text-[10px] font-black mt-0.5">{i+1}</span>
                        <p className="text-sm font-semibold text-rose-800 dark:text-rose-300 leading-tight group-hover:translate-x-1 transition-transform">{risk}</p>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500 rounded-lg text-white">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-emerald-900 dark:text-emerald-400">권장 조치 사항</h3>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">AI RECOMMENDED ACTIONS</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {(data.aiActions || []).map((action, i) => (
                      <li key={i} className="flex gap-3 items-start group">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-200 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center text-[10px] font-black mt-0.5">{i+1}</span>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 leading-tight group-hover:translate-x-1 transition-transform">{action}</p>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            )}

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
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressVal}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                        className={`${progressVal === 100 ? 'bg-green-500' : activeTheme.accent} h-full`} 
                                      />
                                   </div>
                                   {materialVal !== 0 && materialVal !== -1 && (
                                      <div className={`h-1 rounded-full overflow-hidden ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                         <motion.div 
                                           initial={{ width: 0 }}
                                           animate={{ width: `${materialVal}%` }}
                                           transition={{ duration: 0.5, ease: 'easeOut' }}
                                           className={`bg-blue-400 h-full`} 
                                         />
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

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800/30' : 'bg-slate-50/50'} p-6 rounded-2xl border ${activeTheme.border}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`p-2 rounded-lg ${activeTheme.accent} text-white`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>동별 공정률 비교</h3>
                        <p className="text-xs text-slate-400">각 건물별 전체 공정의 평균 완료 상태 비교</p>
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.buildings.map(b => {
                          const processesValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                          const avg = processesValues.length > 0 ? processesValues.reduce((s, v) => s + v, 0) / processesValues.length : 0;
                          return { name: b.name, progress: Math.round(avg) };
                        })}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={data.settings.theme === 'industrial' ? '#2d333d' : '#f1f5f9'} />
                          <XAxis 
                            dataKey="name" 
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
                            cursor={{ fill: data.settings.theme === 'industrial' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                          />
                          <Bar 
                            dataKey="progress" 
                            name="공정률"
                            radius={[4, 4, 0, 0]}
                            barSize={30}
                          >
                            {data.buildings.map((b, index) => {
                              const processesValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                              const avg = processesValues.length > 0 ? processesValues.reduce((s, v) => s + v, 0) / processesValues.length : 0;
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={avg > 80 ? '#22c55e' : avg > 40 ? '#3b82f6' : '#ef4444'} 
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${data.settings.theme === 'industrial' ? 'bg-slate-800/30' : 'bg-slate-50/50'} p-6 rounded-2xl border ${activeTheme.border}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeTheme.accent} text-white`}>
                          <Construction className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold ${data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>공종별 동 대조</h3>
                          <p className="text-xs text-slate-400">선택한 공종의 동별 진행 단계(층수/%) 비교</p>
                        </div>
                      </div>
                      <select 
                        value={analyticsSelectedProcess}
                        onChange={(e) => setAnalyticsSelectedProcess(e.target.value)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                      >
                        {processes.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.buildings.map(b => {
                          const val = b.processes[analyticsSelectedProcess] ?? 0;
                          return { name: b.name, progress: val === -1 ? 0 : val, isExcluded: val === -1 };
                        })}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={data.settings.theme === 'industrial' ? '#2d333d' : '#f1f5f9'} />
                          <XAxis 
                            dataKey="name" 
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
                            cursor={{ fill: data.settings.theme === 'industrial' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                          />
                          <Bar 
                            dataKey="progress" 
                            name="진행 단계"
                            radius={[4, 4, 0, 0]}
                            barSize={30}
                          >
                            {data.buildings.map((b, index) => {
                              const val = b.processes[analyticsSelectedProcess] ?? 0;
                              if (val === -1) return <Cell key={`cell-${index}`} fill="#94a3b8" opacity={0.3} />;
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={val === 100 ? '#22c55e' : val > 0 ? activeTheme.accentHex || '#3b82f6' : '#94a3b8'} 
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
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
                          {role === 'ADMIN' && !isLockedToSite ? '전체 현장 데이터를 JSON 파일로 내보냅니다.' : '현재 현장의 데이터를 JSON 파일로 내보냅니다.'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportData}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                      {role === 'ADMIN' && !isLockedToSite ? '전체 현장 백업 다운로드' : '현재 현장 백업 다운로드'}
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
                          {role === 'ADMIN' && !isLockedToSite ? '백업 파일을 불러와 전체 데이터를 복원합니다.' : '백업 파일을 불러와 현재 현장 데이터를 복원합니다.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        {role === 'ADMIN' && !isLockedToSite ? '전체 데이터 파일 복원' : '현재 현장 파일 복원'}
                      </button>
                      <button 
                        onClick={handleRestoreInitialData}
                        className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        명신기공 데이터 즉시 복원
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImportData} 
                      className="hidden" 
                      accept=".json"
                    />
                  </div>

                  <div className={`p-6 rounded-2xl border ${activeTheme.border} ${data.settings.theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} space-y-3`}>
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">AI 공정표 자동 업데이트</h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          액셀 공정표 캡처 이미지를 올리면 자동으로 데이터를 입력합니다.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => captureInputRef.current?.click()}
                      disabled={isExtracting}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isExtracting ? '이미지 분석 중...' : '엑셀 캡처 이미지 업로드'}
                    </button>
                    <input 
                      type="file" 
                      ref={captureInputRef} 
                      onChange={handleExtractFromImage} 
                      className="hidden" 
                      accept="image/*"
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
              dailyReports={data.dailyReports}
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
          {shareUrl && (() => {
            const targetSiteId = shareSiteId || data.id;
            const targetSite = multiData.sites.find(s => s.id === targetSiteId) || data;
            const projectName = targetSite?.settings?.projectName || '스마트 아파트 현장';

            const adminUrl = `${getPublicOrigin()}${window.location.pathname}?role=ADMIN&pw=${multiData.adminPassword || '1111'}${targetSiteId ? `&site=${targetSiteId}` : ''}`;
            const fieldUrl = `${getPublicOrigin()}${window.location.pathname}?role=FIELD${targetSiteId ? `&site=${targetSiteId}` : ''}`;
            const guestUrl = `${getPublicOrigin()}${window.location.pathname}?role=GUEST${targetSiteId ? `&site=${targetSiteId}` : ''}`;
            
            const handleModalCopy = (url: string, type: 'admin' | 'field' | 'guest') => {
              copyToClipboard(url);
              setCopiedLinkType(type);
              setTimeout(() => setCopiedLinkType(null), 2000);
            };

            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto no-print">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 15 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: 15 }} 
                  className={`p-6 sm:p-8 rounded-3xl shadow-2xl max-w-2xl w-full space-y-6 my-8 border ${
                    data.settings.theme === 'industrial' 
                      ? 'bg-[#181a20] border-slate-800 text-white' 
                      : 'bg-white border-slate-100 text-slate-900'
                  }`}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`text-xl font-black uppercase tracking-tight flex items-center gap-2 italic ${
                        data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'
                      }`}>
                        <LinkIcon className={`w-5 h-5 ${activeTheme.text}`} />
                        현장 통합 공유 링크 설정
                      </h3>
                      <p className={`text-xs mt-1 ${data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'} font-semibold`}>
                        대상 현장: <span className="font-bold text-blue-500">{projectName}</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setShareUrl(null);
                        setShareSiteId(null);
                      }} 
                      className={`p-2 rounded-full transition-colors ${
                        data.settings.theme === 'industrial' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Plus className="w-5 h-5 rotate-45" />
                    </button>
                  </div>

                  {/* 403 Warning Alert */}
                  {window.location.origin.includes('ais-dev-') && !multiData.customBaseUrl && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold leading-relaxed space-y-1">
                      <p className="font-extrabold flex items-center gap-1.5 text-amber-950">
                        ⚠️ 403 접속 오류 방지 안내 (외부인 공유 전 필독!)
                      </p>
                      <p>
                        현재 복사하는 주소는 개발 테스트용 구글 내부 서버 주소(ais-dev-)입니다. 구글 클라우드 보안 제어로 인해, 다른 사람에게 공유하면 <span className="font-bold text-red-600 underline">403 Forbidden 오류</span>가 나며 접속이 불가능합니다.
                      </p>
                      <p className="mt-1">
                        <strong>해결 방법:</strong> 정식 배포 주소(예: Vercel, Cloud Run 등)가 있다면 <strong>[기본 화면 → 관리자 모드 → 프로젝트 설정]</strong> 하단의 <strong>공유 링크 기본 주소(Base URL)</strong>에 정식 주소를 입력해 주시면 오류가 말끔히 해결됩니다.
                      </p>
                    </div>
                  )}

                  {multiData.customBaseUrl && multiData.customBaseUrl.trim() !== '' && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold leading-relaxed space-y-0.5">
                      <p className="font-extrabold flex items-center gap-1.5 text-emerald-950">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        커스텀 도메인(Base URL)이 활성화되어 있습니다
                      </p>
                      <p className="font-mono text-[10px] text-emerald-750 break-all select-all font-bold">
                        {multiData.customBaseUrl}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        이제 아래 모든 복사 단추를 누르면 해당 정식 주소를 기반으로 변환된 공유 주소가 안전하게 복사됩니다.
                      </p>
                    </div>
                  )}

                  {/* Links Dashboard */}
                  <div className="space-y-4">
                    {/* 1. MASTER ADMIN LINK */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      data.settings.theme === 'industrial' 
                        ? 'bg-[#1e2330]/60 border-indigo-500/20 hover:border-indigo-500/40' 
                        : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'
                    }`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">마스터 관리자 접속 링크</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">최고 권한</span>
                          </div>
                          <p className={`text-[10px] sm:text-xs leading-relaxed mt-0.5 ${
                            data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500 font-semibold'
                          }`}>
                            모든 아파트 동별 관리, 공무 설정 변경, 비밀번호 관리 등을 제어할 수 있는 총괄 계정 주소입니다.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={adminUrl} 
                          className={`flex-1 px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-mono truncate focus:outline-none ${
                            data.settings.theme === 'industrial' 
                              ? 'bg-slate-900/80 border-slate-700 text-[#00ff9f]' 
                              : 'bg-white border-slate-200 text-slate-600'
                          }`} 
                        />
                        <button 
                          onClick={() => handleModalCopy(adminUrl, 'admin')} 
                          className={`px-4 font-black rounded-xl text-xs whitespace-nowrap transition-colors ${
                            copiedLinkType === 'admin'
                              ? 'bg-green-600 text-white'
                              : data.settings.theme === 'industrial' 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {copiedLinkType === 'admin' ? '복사됨!' : '링크 복사'}
                        </button>
                      </div>
                    </div>

                    {/* 2. FIELD REGISTER LINK */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      data.settings.theme === 'industrial' 
                        ? 'bg-[#1e2330]/60 border-blue-500/20 hover:border-blue-500/40' 
                        : 'bg-blue-50/30 border-blue-100 hover:border-blue-200'
                    }`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 dark:shadow-none">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-blue-700 dark:text-blue-400">현장 실무자 등록/입력 링크</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">수정/등록 권한</span>
                          </div>
                          <p className={`text-[10px] sm:text-xs leading-relaxed mt-0.5 ${
                            data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500 font-semibold'
                          }`}>
                            현장별 아파트 동별 즉시 공정률 업데이트, 실시간 기상 상태 기록 및 자재 입고관리가 가능한 실무 링크입니다.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={fieldUrl} 
                          className={`flex-1 px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-mono truncate focus:outline-none ${
                            data.settings.theme === 'industrial' 
                              ? 'bg-slate-900/80 border-slate-700 text-[#00ff9f]' 
                              : 'bg-white border-slate-200 text-slate-600'
                          }`} 
                        />
                        <button 
                          onClick={() => handleModalCopy(fieldUrl, 'field')} 
                          className={`px-4 font-black rounded-xl text-xs whitespace-nowrap transition-colors ${
                            copiedLinkType === 'field'
                              ? 'bg-green-600 text-white'
                              : data.settings.theme === 'industrial' 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {copiedLinkType === 'field' ? '복사됨!' : '링크 복사'}
                        </button>
                      </div>
                    </div>

                    {/* 3. GUEST VIEWER LINK */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      data.settings.theme === 'industrial' 
                        ? 'bg-[#1e2330]/60 border-emerald-500/20 hover:border-emerald-500/40' 
                        : 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200'
                    }`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 dark:shadow-none">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">외부인 / 게스트 조회 전용 링크</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">조회 전용 (안전)</span>
                          </div>
                          <p className={`text-[10px] sm:text-xs leading-relaxed mt-0.5 ${
                            data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500 font-semibold'
                          }`}>
                            비밀번호 없이 즉시 접속되며, Gantt 표, 아파트 공정, 기상 정보 및 기상청 예측을 실시간 조회만 가능합니다.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={guestUrl} 
                          className={`flex-1 px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-mono truncate focus:outline-none ${
                            data.settings.theme === 'industrial' 
                              ? 'bg-slate-900/80 border-slate-700 text-[#00ff9f]' 
                              : 'bg-white border-slate-200 text-slate-600'
                          }`} 
                        />
                        <button 
                          onClick={() => handleModalCopy(guestUrl, 'guest')} 
                          className={`px-4 font-black rounded-xl text-xs whitespace-nowrap transition-colors ${
                            copiedLinkType === 'guest'
                              ? 'bg-green-600 text-white'
                              : data.settings.theme === 'industrial' 
                                ? 'bg-emerald-600 hover:bg-emerald-750 text-white' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {copiedLinkType === 'guest' ? '복사됨!' : '링크 복사'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className={`p-3 rounded-xl text-[10px] flex items-center gap-2 font-semibold ${
                    data.settings.theme === 'industrial' ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-50 text-slate-500'
                  }`}>
                    💡 누르시면 자동으로 해당 기기의 클립보드에 주소가 즉시 저장됩니다. 카톡이나 메일로 전송하세요!
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* Add Process Modal */}
        <AnimatePresence>
          {newProcessInput && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.9 }} 
                className={`p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6 ${
                  data.settings.theme === 'industrial' ? 'bg-[#1a1d23] border border-[#2d333d]' : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-xl font-black uppercase tracking-tight flex items-center gap-2 italic ${
                    data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'
                  }`}>
                    <Construction className={`w-5 h-5 ${activeTheme.text}`} />
                    공종 추가
                  </h3>
                  <button 
                    onClick={() => { setNewProcessInput(false); setNewProcessName(''); }} 
                    className={`p-2 rounded-full transition-colors ${
                      data.settings.theme === 'industrial' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase ml-1 ${
                      data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'
                    }`}>신규 공종 명칭</span>
                    <input 
                      autoFocus 
                      placeholder="예: 23. 미장공사 또는 타일공사" 
                      value={newProcessName} 
                      onChange={e => setNewProcessName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addProcess()} 
                      className={`w-full p-4 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`} 
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => { setNewProcessInput(false); setNewProcessName(''); }} 
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      취소
                    </button>
                    <button 
                      onClick={addProcess} 
                      className={`flex-1 text-white py-3 rounded-xl font-bold transition-colors ${
                        data.settings.theme === 'industrial' ? 'bg-[#00ff9f]/80 text-black hover:bg-[#00ff9f]' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      추가
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Site Modal */}
        <AnimatePresence>
          {pendingRestore && (
           <RestoreComparisonModal 
             currentData={multiData}
             backupData={pendingRestore.data}
             onConfirm={handleConfirmRestore}
             onCancel={() => setPendingRestore(null)}
           />
         )}

         {isAddingSite && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.9 }} 
                className={`p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6 ${
                  data.settings.theme === 'industrial' ? 'bg-[#1a1d23] border border-[#2d333d]' : 'bg-white'
                }`}
              >
                <h3 className={`text-xl font-black uppercase tracking-tight italic ${
                  data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'
                }`}>New Site Add</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase ml-1 ${
                      data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'
                    }`}>현장 명칭</span>
                    <input 
                      autoFocus 
                      placeholder="현장 이름을 입력하세요..." 
                      value={newSiteName} 
                      onChange={e => setNewSiteName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addNewSite()} 
                      className={`w-full p-4 rounded-xl border text-sm font-bold focus:outline-none ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`} 
                    />
                  </div>
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase ml-1 ${
                      data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'
                    }`}>접속 비밀번호 (선택사항)</span>
                    <input 
                      type="text" 
                      placeholder="비밀번호를 입력하세요 (생략 시 무인증)" 
                      value={newSitePassword} 
                      onChange={e => setNewSitePassword(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addNewSite()} 
                      className={`w-full p-4 rounded-xl border text-sm font-bold focus:outline-none ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`} 
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => { setIsAddingSite(false); setNewSiteName(''); setNewSitePassword(''); }} 
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      취소
                    </button>
                    <button 
                      onClick={addNewSite} 
                      className={`flex-1 text-white py-3 rounded-xl font-bold transition-all ${
                        data.settings.theme === 'industrial' 
                        ? 'bg-[#00ff9f]/80 text-black hover:bg-[#00ff9f]' 
                        : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      현장 생성
                    </button>
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
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.9 }} 
                className={`p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6 text-center ${
                  data.settings.theme === 'industrial' ? 'bg-[#1a1d23] border border-[#2d333d]' : 'bg-white'
                }`}
              >
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className={`text-xl font-black italic uppercase ${
                    data.settings.theme === 'industrial' ? 'text-white' : 'text-slate-900'
                  }`}>Delete Site?</h3>
                  <p className={`text-sm ${
                    data.settings.theme === 'industrial' ? 'text-slate-400' : 'text-slate-500 font-semibold'
                  }`}>정말 이 현장을 삭제하시겠습니까?<br/>모든 데이터가 영구적으로 소실됩니다.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteConfirmId(null)} 
                    className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                      data.settings.theme === 'industrial' 
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    취소
                  </button>
                  <button onClick={() => deleteSite(deleteConfirmId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold">삭제 실행</button>
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
            theme={data.settings.theme}
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

      <AnimatePresence>
        {pendingRestore && (
          <RestoreComparisonModal 
            currentData={multiData}
            backupData={pendingRestore.data}
            onConfirm={handleConfirmRestore}
            onCancel={() => setPendingRestore(null)}
          />
        )}
      </AnimatePresence>

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
