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

  const [archiveDate, setArchiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [archiveWeather, setArchiveWeather] = useState<any>(null);
  const [isFetchingArchive, setIsFetchingArchive] = useState(false);
  const [manualWeather, setManualWeather] = useState({
    temp: '',
    humidity: '',
    wind: '',
    precip: '',
    condition: '맑음'
  });

  const fetchArchiveWeather = async (date: string) => {
    if (!location) return;
    setIsFetchingArchive(true);
    setArchiveWeather(null);
    try {
      const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&date=${date}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '날씨 정보를 가져올 수 없습니다.');
      }
      const data = await response.json();
      
      const weatherAtDate = data.weather?.[0];
      if (weatherAtDate) {
        const avgTemp = weatherAtDate.avgtempC;
        const totalSnow = weatherAtDate.totalSnow_cm;
        const precip = weatherAtDate.totalPrecip_mm;
        const uvIndex = weatherAtDate.uvIndex;
        const hourly = weatherAtDate.hourly?.[4] || weatherAtDate.hourly?.[0]; // Midday
        
        const weatherDesc = hourly.lang_ko ? hourly.lang_ko[0].value : hourly.weatherDesc[0].value;
        const humidity = hourly.humidity;
        const windspeed = hourly.windspeedKmph;

        setArchiveWeather({
          temp: avgTemp,
          condition: weatherDesc,
          humidity: humidity,
          wind: windspeed,
          precip: precip,
          uv: uvIndex,
          snow: totalSnow
        });
      }
    } catch (error) {
      console.error('Archive weather fetch error:', error);
      setArchiveWeather(null);
    } finally {
      setIsFetchingArchive(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchArchiveWeather(archiveDate);
    }
  }, [archiveDate, location]);

  const fetchWeather = async (date?: string) => {
    if (!location) return;
    setIsFetchingWeather(true);
    try {
      const targetDate = date || newReport.date;
      const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}${targetDate !== new Date().toISOString().split('T')[0] ? `&date=${targetDate}` : ''}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '날씨 정보를 가져올 수 없습니다.');
      }
      const data = await response.json();
      
      let weatherStr = '';
      if (data.current_condition) {
        const current = data.current_condition[0];
        const weatherDesc = current.lang_ko ? current.lang_ko[0].value : current.weatherDesc[0].value;
        const temp = current.temp_C;
        
        let koreanWeather = weatherDesc;
        if (weatherDesc.toLowerCase().includes('sunny') || weatherDesc.toLowerCase().includes('clear')) koreanWeather = '맑음';
        else if (weatherDesc.toLowerCase().includes('cloudy') || weatherDesc.toLowerCase().includes('overcast')) koreanWeather = '흐림';
        else if (weatherDesc.toLowerCase().includes('rain')) koreanWeather = '비';
        else if (weatherDesc.toLowerCase().includes('snow')) koreanWeather = '눈';
        else if (weatherDesc.toLowerCase().includes('mist') || weatherDesc.toLowerCase().includes('fog')) koreanWeather = '안개';
        
        weatherStr = `${koreanWeather} (${temp}°C)`;
      } else if (data.weather?.[0]) {
        const w = data.weather[0];
        const h = w.hourly[4];
        const weatherDesc = h.lang_ko ? h.lang_ko[0].value : h.weatherDesc[0].value;
        weatherStr = `${weatherDesc} (${w.avgtempC}°C)`;
      }

      setNewReport(prev => ({
        ...prev,
        weather: weatherStr
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

      {/* Weather History Section */}
      <div className={`${activeTheme.card} p-6 rounded-3xl border ${activeTheme.border} shadow-sm space-y-6`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-amber-100 text-amber-600`}>
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-black text-sm uppercase tracking-wider ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>일간 기상 정보 조회</h3>
              <p className="text-[10px] text-slate-400 font-bold">선택한 일자의 과거 기상 데이터를 확인합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={archiveDate}
              onChange={e => setArchiveDate(e.target.value)}
              className={`text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-none rounded-lg focus:ring-0 py-1.5 px-3`}
            />
            {location && (
              <button 
                onClick={() => fetchArchiveWeather(archiveDate)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${isFetchingArchive ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {!location ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Sun className="w-3 h-3" /> 평균 기온</label>
              <input 
                type="text"
                placeholder="25°C"
                value={manualWeather.temp}
                onChange={e => setManualWeather({...manualWeather, temp: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Droplets className="w-3 h-3" /> 평균 습도</label>
              <input 
                type="text"
                placeholder="60%"
                value={manualWeather.humidity}
                onChange={e => setManualWeather({...manualWeather, humidity: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" /> 강수량</label>
              <input 
                type="text"
                placeholder="0mm"
                value={manualWeather.precip}
                onChange={e => setManualWeather({...manualWeather, precip: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Wind className="w-3 h-3" /> 평균 풍속</label>
              <input 
                type="text"
                placeholder="5km/h"
                value={manualWeather.wind}
                onChange={e => setManualWeather({...manualWeather, wind: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><CloudSun className="w-3 h-3" /> 날씨 상태</label>
              <select 
                value={manualWeather.condition}
                onChange={e => setManualWeather({...manualWeather, condition: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold appearance-none"
              >
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">맑음</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">흐림</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">비</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">눈</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">안개</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
             {isFetchingArchive ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-50 dark:bg-slate-800 animate-pulse rounded-2xl" />
                ))
             ) : archiveWeather ? (
               <>
                 <div className={`p-4 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400">평균 기온</span>
                    <span className="text-sm font-black italic">{archiveWeather.temp}°C</span>
                 </div>
                 <div className={`p-4 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400">습도</span>
                    <span className="text-sm font-black italic">{archiveWeather.humidity}%</span>
                 </div>
                 <div className={`p-4 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <Droplets className="w-5 h-5 text-indigo-400" />
                    <span className="text-[10px] font-bold text-slate-400">강수량</span>
                    <span className="text-sm font-black italic">{archiveWeather.precip}mm</span>
                 </div>
                 <div className={`p-4 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <Wind className="w-5 h-5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400">풍속</span>
                    <span className="text-sm font-black italic">{archiveWeather.wind}km/h</span>
                 </div>
                 <div className={`p-4 rounded-2xl ${theme === 'industrial' ? 'bg-slate-800' : 'bg-slate-50'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <CloudSun className="w-5 h-5 text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-400">날씨</span>
                    <span className="text-sm font-black italic">{archiveWeather.condition}</span>
                 </div>
               </>
             ) : (
               <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium">
                 해당 날짜의 기상 데이터를 가져올 수 없습니다.
               </div>
             )}
          </div>
        )}
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
              className={`p-8 rounded-[2rem] shadow-2xl max-w-xl w-full space-y-6 ${
                theme === 'industrial' ? 'bg-[#1a1d23] border border-[#2d333d] text-white' : 'bg-white text-slate-900 border border-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-tight italic">Create Daily Report</h3>
                <button 
                  onClick={() => setIsAdding(false)} 
                  className={`p-2 rounded-full transition-colors ${
                    theme === 'industrial' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
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
                    className={`w-full p-4 rounded-2xl border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-705 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className="space-y-2 relative">
                  <label className="text-xs font-black text-slate-400 uppercase flex items-center justify-between">
                    <span>현장 날씨</span>
                    {location && (
                      <button 
                        onClick={() => fetchWeather()}
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
                      className={`w-full p-4 rounded-2xl border font-bold pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        theme === 'industrial' 
                          ? 'bg-slate-800 border-slate-705 text-white placeholder-slate-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
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
                  className={`w-full p-4 rounded-2xl border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === 'industrial' 
                      ? 'bg-slate-800 border-slate-705 text-white placeholder-slate-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">주요 작업 내용</label>
                <textarea 
                  rows={6}
                  placeholder="금일 진행된 주요 공종 및 특이사항을 입력하세요..."
                  value={newReport.notes} 
                  onChange={e => setNewReport({...newReport, notes: e.target.value})}
                  className={`w-full p-4 rounded-2xl border font-bold resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === 'industrial' 
                      ? 'bg-slate-800 border-slate-705 text-white placeholder-slate-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsAdding(false)}
                  className={`flex-1 py-4 rounded-2xl font-black transition-colors ${
                    theme === 'industrial' 
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  취소
                </button>
                <button 
                  onClick={handleAdd}
                  className={`flex-1 py-4 rounded-2xl font-black transition-all ${
                    theme === 'industrial' 
                      ? 'bg-[#00ff9f]/80 text-black hover:bg-[#00ff9f]' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
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
