/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'FIELD' | 'GUEST';

export interface ConstructionProcess {
  id: string;
  name: string;
  progress: number; // 0 to 100
}

export interface BuildingData {
  id: number;
  name: string;
  processes: Record<string, number>; // process id -> progress
  materialProcesses?: Record<string, number>; // process id -> material request progress
  materialDates?: Record<string, string>; // process id -> arrival date (ISO string)
  minFloor?: number;
  maxFloor?: number;
  photos?: Record<string, string[]>; // process id/name -> array of base64 photos
}

export interface CommonFacility {
  id: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  processes?: Record<string, number>; // process name -> progress (0 or 100)
  inactiveProcesses?: string[];
}

export const FACILITY_PROCESSES = [
  "건축골조",
  "스리브",
  "위생배관",
  "난방배관",
  "오배수배관",
  "환기덕트",
  "위생기구"
];

export type AppTheme = 'slate' | 'blueprint' | 'industrial' | 'earth';

export interface ProjectSettings {
  companyName: string;
  projectName: string;
  startDate: string;
  managerName: string;
  staffName: string;
  buildingCount: number;
  maxFloor: number;
  minFloor: number; // e.g. -3 for B3
  theme: AppTheme;
  progressMode?: 'floor' | 'percent';
  processModes?: Record<string, 'floor' | 'percent'>;
  fontSize?: number;
  tableSpacing?: number;
  headerColor?: string;
  textColor?: string;
}

export interface ProgressSnapshot {
  date: string;
  averageProgress: number;
  buildings?: BuildingData[];
  facilities?: CommonFacility[];
}

export interface DailyReport {
  date: string;
  weather: string;
  manpower: string;
  notes: string;
}

export interface AppState {
  id: string; // Site ID
  settings: ProjectSettings;
  buildings: BuildingData[];
  facilities: CommonFacility[];
  lastSaved: string;
  approval: {
    staffSigned: boolean;
    managerSigned: boolean;
  };
  history?: ProgressSnapshot[];
  dailyReports?: DailyReport[];
  dashboardNotes?: string;
  aiDiagnosis?: string;
}

export interface MultiProjectData {
  activeSiteId: string;
  sites: AppState[];
  trash?: any[];
}

export const DEFAULT_PROCESSES = [
  "1. 건축골조",
  "2. HOIST",
  "3. 기초매립배관",
  "4. 알폼세팅",
  "5. 스리브",
  "6. 가설급수",
  "7. 가설소변기",
  "8. 가설소화",
  "9. 이중관배관",
  "10. 세대 수전구",
  "11. 단위세대오배수",
  "12. 세대오배수입상",
  "13. 동지하 오배수",
  "14. 동지하 위생/난방횡주관",
  "15. 세대 SP배관",
  "16. 전실 위생/난방입상",
  "17. 전실 위생/난방통합거치대",
  "18. 세대 난방분배기",
  "19. 세대 난방코일",
  "20. 세대 환기&직배기",
  "21. 기계실배관"
];

export const INITIAL_FACILITIES = [
  "주차장(B1)", "주차장(B2)", "주차장(B3)", 
  "주민공동시설", "어린이집", "경로당", 
  "작은도서관", "경비실", "기계실", "돌봄센터"
];
