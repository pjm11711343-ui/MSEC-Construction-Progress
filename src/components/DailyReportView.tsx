import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CloudSun, 
  Users, 
  FileText,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Wind,
  Droplets,
  Sun
} from 'lucide-react';
import { DailyReport, AppTheme } from '../types';

interface DailyReportViewProps {
  reports: DailyReport[];
  onAddReport: (report: DailyReport) => void;
  onDeleteReport: (date: string) => void;
  theme: AppTheme;
  activeTheme: any;
  location?: string;
}

export default function DailyReportView({ reports, onAddReport, onDeleteReport, theme, activeTheme, location }: DailyReportViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [newReport, setNewReport] = useState<DailyReport>({
    date: new Date().toISOString().split('T')[0],
    weather: '맑음',
    manpower: '',
    notes: ''
  });

  const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));

  const fetchWeather = async () => {
    if (!location) return;
    setIsFetchingWeather(true);
    try {
      // Use internal proxy to avoid CORS issues
      const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
      if (!response.ok) throw new Error('Failed to fetch weather');
      const data = await response.json();
      
      const current = data.current_condition[0];
      const weatherDesc = current.lang_ko ? current.lang_ko[0].value : current.weatherDesc[0].value;
      const temp = current.temp_C;
      
      // Map to friendly Korean names
      let koreanWeather = weatherDesc;
      if (weatherDesc.toLowerCase().includes('sunny') || weatherDesc.toLowerCase().includes('clear')) koreanWeather = '맑음';
      else if (weatherDesc.toLowerCase().includes('cloudy') || weatherDesc.toLowerCase().includes('overcast')) koreanWeather = '흐림';
      else if (weatherDesc.toLowerCase().includes('rain')) koreanWeather = '비';
      else if (weatherDesc.toLowerCase().includes('snow')) koreanWeather = '눈';
      else if (weatherDesc.toLowerCase().includes('mist') || weatherDesc.toLowerCase().includes('fog')) koreanWeather = '안개';

      setNewReport(prev => ({
        ...prev,
        weather: `${koreanWeather} (${temp}°C)`
      }));
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  useEffect(() => {
    if (isAdding && location) {
      fetchWeather();
    }
  }, [isAdding, location]);

  const handleAdd = () => {
    if (!newReport.date || !newReport.notes) return;
    onAddReport(newReport);
    setIsAdding(false);
    setNewReport({
      date: new Date().toISOString().split('T')[0],
      weather: '맑음',
      manpower: '',
      notes: ''
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black uppercase tracking-tight ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>현장 일보 (Daily Report)</h2>
          <p className="text-slate-400 text-sm font-medium">일자별 공사 일지 및 현황 관리</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className={`${activeTheme.button} text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 transition-all hover:scale-105`}
        >
          <Plus className="w-5 h-5" />
          일보 작성
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {sortedReports.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <ClipboardList className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold">등록된 일보가 없습니다. 새로운 일보를 작성해 주세요.</p>
            </div>
          ) : (
            sortedReports.map((report) => (
              <motion.div
                key={report.date}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`${activeTheme.card} p-6 rounded-3xl border ${activeTheme.border} shadow-sm space-y-4 relative group`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className={`w-4 h-4 ${activeTheme.text}`} />
                    <span className={`font-black text-lg ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>{report.date}</span>
                  </div>
                  <button 
                    onClick={() => onDeleteReport(report.date)}
                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} space-y-1`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <CloudSun className="w-3 h-3" /> 날씨
                    </div>
                    <div className="font-bold text-sm">{report.weather}</div>
                  </div>
                  <div className={`p-3 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} space-y-1`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <Users className="w-3 h-3" /> 투입인원
                    </div>
                    <div className="font-bold text-sm">{report.manpower || '0'}명</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                    <FileText className="w-3 h-3" /> 작업내용
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap">{report.notes}</p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-xl w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-tight italic">Create Daily Report</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">공사 일자</label>
                  <input 
                    type="date" 
                    value={newReport.date} 
                    onChange={e => setNewReport({...newReport, date: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
                <div className="space-y-2 relative">
                  <label className="text-xs font-black text-slate-400 uppercase flex items-center justify-between">
                    <span>현장 날씨</span>
                    {location && (
                      <button 
                        onClick={fetchWeather}
                        disabled={isFetchingWeather}
                        className="text-[10px] text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                        날씨 업데이트
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={newReport.weather}
                      onChange={e => setNewReport({...newReport, weather: e.target.value})}
                      placeholder="날씨 입력 (예: 맑음, 25°C)"
                      className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold pr-12"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <CloudSun className={`w-5 h-5 text-slate-300`} />
                    </div>
                  </div>
                  {!location && (
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">관리자 설정에서 현장 위치를 설정하면 날씨를 자동으로 가져옵니다.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">투입 인원 (총합)</label>
                <input 
                  type="text" 
                  placeholder="예: 25명" 
                  value={newReport.manpower} 
                  onChange={e => setNewReport({...newReport, manpower: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">주요 작업 내용</label>
                <textarea 
                  rows={6}
                  placeholder="금일 진행된 주요 공종 및 특이사항을 입력하세요..."
                  value={newReport.notes} 
                  onChange={e => setNewReport({...newReport, notes: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-4 rounded-2xl font-black"
                >
                  취소
                </button>
                <button 
                  onClick={handleAdd}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black"
                >
                  일보 저장하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
