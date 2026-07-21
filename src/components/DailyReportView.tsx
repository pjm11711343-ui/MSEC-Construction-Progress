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
  Sun,
  CloudRain,
  CloudSnow,
  Cloud,
  CloudLightning,
  AlertTriangle,
  CheckCircle2,
  Thermometer
} from 'lucide-react';
import { DailyReport, AppTheme } from '../types';

interface DailyReportViewProps {
  reports: DailyReport[];
  onAddReport: (report: DailyReport) => void;
  onDeleteReport: (date: string) => void;
  theme: AppTheme;
  activeTheme: any;
  location?: string;
  onUpdateLocation?: (location: string) => void;
}

export default function DailyReportView({ 
  reports, 
  onAddReport, 
  onDeleteReport, 
  theme, 
  activeTheme, 
  location,
  onUpdateLocation 
}: DailyReportViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [newReport, setNewReport] = useState<DailyReport>({
    date: new Date().toISOString().split('T')[0],
    weather: '맑음',
    manpower: '',
    notes: '',
    precip: 0,
    windSpeed: 0
  });

  const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));

  // Inline Location Edit States
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState(location || '');

  useEffect(() => {
    setNewLocationInput(location || '');
  }, [location]);

  // 3-Day Forecast States
  const [forecastDays, setForecastDays] = useState<any[]>([]);
  const [isFetchingForecast, setIsFetchingForecast] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const fetchThreeDayForecast = async () => {
    const queryLoc = location || '서울';
    setIsFetchingForecast(true);
    setForecastError(null);
    try {
      const response = await fetch(`/api/weather?location=${encodeURIComponent(queryLoc)}`);
      if (!response.ok) {
        throw new Error('예보 데이터를 가져올 수 없습니다.');
      }
      const data = await response.json();
      if (data.weather && Array.isArray(data.weather)) {
        setForecastDays(data.weather.slice(0, 3));
      } else {
        throw new Error('올바르지 않은 예보 데이터 형식입니다.');
      }
    } catch (error: any) {
      console.error('Forecast fetch error:', error);
      setForecastError(error.message || '예보 조회 실패');
    } finally {
      setIsFetchingForecast(false);
    }
  };

  useEffect(() => {
    fetchThreeDayForecast();
  }, [location]);

  const getWeatherDetails = (conditionStr: string) => {
    const lower = conditionStr.toLowerCase();
    if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle')) {
      return { label: '비/소나기', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40', icon: 'rain' };
    }
    if (lower.includes('snow') || lower.includes('flurry') || lower.includes('ice') || lower.includes('sleet')) {
      return { label: '눈/진눈깨비', color: 'text-sky-400 bg-sky-50 dark:bg-sky-950/40', icon: 'snow' };
    }
    if (lower.includes('thunder') || lower.includes('storm') || lower.includes('lightning')) {
      return { label: '뇌우', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40', icon: 'thunder' };
    }
    if (lower.includes('cloudy') || lower.includes('overcast')) {
      return { label: '흐림', color: 'text-slate-500 bg-slate-50 dark:bg-slate-950/40', icon: 'cloudy' };
    }
    if (lower.includes('partly') || lower.includes('intervals') || lower.includes('sun')) {
      return { label: '구름조금', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40', icon: 'cloudsun' };
    }
    if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
      return { label: '안개/박무', color: 'text-zinc-400 bg-zinc-50 dark:bg-zinc-950/40', icon: 'fog' };
    }
    return { label: '맑음', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', icon: 'sun' };
  };

  const getDayLabel = (dateStr: string, index: number) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    try {
      const d = new Date(dateStr);
      const dayName = days[d.getDay()];
      const formattedDate = dateStr.substring(5).replace('-', '.'); // e.g., 07.21
      if (index === 0) return `오늘 (${formattedDate})`;
      if (index === 1) return `내일 (${formattedDate})`;
      if (index === 2) return `모레 (${formattedDate})`;
      return `${dayName}요일 (${formattedDate})`;
    } catch (e) {
      return dateStr;
    }
  };

  const getWorkSuitability = (day: any) => {
    const maxTemp = parseFloat(day.maxtempC) || 0;
    const minTemp = parseFloat(day.mintempC) || 0;
    const precip = parseFloat(day.totalPrecip_mm) || 0;
    
    let maxWind = 0;
    if (day.hourly) {
      day.hourly.forEach((h: any) => {
        const wind = parseFloat(h.windspeedKmph) || 0;
        if (wind > maxWind) maxWind = wind;
      });
    }

    if (precip >= 10) {
      return {
        status: '야외제한 (우천)',
        desc: '강수량 많음. 야외 고소작업 및 콘크리트 타설 불가.',
        color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
        severity: 'danger'
      };
    }
    if (precip > 2) {
      return {
        status: '우천 유의',
        desc: '약한 비 예보. 노면 유실 및 자재 보양 필요.',
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
        severity: 'warning'
      };
    }
    if (maxWind >= 25) {
      return {
        status: '강풍 위험',
        desc: '강풍 예보. 타워크레인 가동 및 비계 고소작업 중단 조치.',
        color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
        severity: 'danger'
      };
    }
    if (maxWind >= 15) {
      return {
        status: '강풍 유의',
        desc: '바람이 강함. 타워크레인 고소 낙하물 및 가설재 보강.',
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
        severity: 'warning'
      };
    }
    if (maxTemp >= 35) {
      return {
        status: '폭염 위험 (실외제한)',
        desc: '혹서기 경보. 실외 작업 정지 및 매 시간 수분 섭취/휴식.',
        color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
        severity: 'danger'
      };
    }
    if (maxTemp >= 31) {
      return {
        status: '폭염 주의 (단축근무)',
        desc: '혹서기 주의. 휴식시간 연장 및 한낮 무더위 시간 야외 작업 지양.',
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
        severity: 'warning'
      };
    }
    if (minTemp <= -10) {
      return {
        status: '동절기 극저온',
        desc: '한파 경보. 동결 위험으로 콘크리트 및 습식 공사 전면 제한.',
        color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
        severity: 'danger'
      };
    }
    if (minTemp <= -4) {
      return {
        status: '동절기 주의',
        desc: '영하권 날씨. 콘크리트 양생 시 갈탄/보양막 가열 보온 조치 필수.',
        color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900',
        severity: 'warning'
      };
    }
    return {
      status: '야외작업 적합',
      desc: '기온 양호 및 바람 잔잔함. 정상 야외 공정 진행 가능.',
      color: 'text-[#00ff9f] bg-[#00ff9f]/10 border-[#00ff9f]/20',
      severity: 'safe'
    };
  };

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
    const queryLoc = location || '서울';
    setIsFetchingArchive(true);
    setArchiveWeather(null);
    try {
      const response = await fetch(`/api/weather?location=${encodeURIComponent(queryLoc)}&date=${date}`);
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
    fetchArchiveWeather(archiveDate);
  }, [archiveDate, location]);

  const fetchWeather = async (date?: string) => {
    const queryLoc = location || '서울';
    setIsFetchingWeather(true);
    try {
      const targetDate = date || newReport.date;
      const response = await fetch(`/api/weather?location=${encodeURIComponent(queryLoc)}${targetDate !== new Date().toISOString().split('T')[0] ? `&date=${targetDate}` : ''}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '날씨 정보를 가져올 수 없습니다.');
      }
      const data = await response.json();
      
      let weatherStr = '';
      let precipVal = 0;
      let windVal = 0;
      if (data.current_condition) {
        const current = data.current_condition[0];
        const weatherDesc = current.lang_ko ? current.lang_ko[0].value : current.weatherDesc[0].value;
        const temp = current.temp_C;
        precipVal = parseFloat(current.precipMM) || 0;
        windVal = parseFloat(current.windspeedKmph) || 0;
        
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
        precipVal = parseFloat(w.totalPrecip_mm) || 0;
        windVal = parseFloat(h.windspeedKmph) || 0;
      }

      setNewReport(prev => ({
        ...prev,
        weather: weatherStr,
        precip: precipVal,
        windSpeed: windVal
      }));
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  useEffect(() => {
    if (isAdding) {
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
      notes: '',
      precip: 0,
      windSpeed: 0
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black uppercase tracking-tight ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>현장 일보 (Daily Report)</h2>
          <p className="text-slate-400 text-sm font-medium">일자별 공사 일지 및 현황 관리</p>
        </div>
      </div>

      {/* 3-Day Weather Forecast Section */}
      <div className={`${activeTheme.card} p-6 rounded-3xl border ${activeTheme.border} shadow-sm space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400`}>
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-black text-sm uppercase tracking-wider ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>
                  3일 공사 기상 예보
                </h3>
                
                {isEditingLocation ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newLocationInput}
                      onChange={(e) => setNewLocationInput(e.target.value)}
                      placeholder="예: 서울, 인천, 부산"
                      className="px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-blue-500 rounded-md focus:outline-none text-slate-800 dark:text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateLocation?.(newLocationInput);
                          setIsEditingLocation(false);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onUpdateLocation?.(newLocationInput);
                        setIsEditingLocation(false);
                      }}
                      className="text-[10px] bg-blue-500 hover:bg-blue-600 text-white font-bold px-2 py-1 rounded"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setNewLocationInput(location || '');
                        setIsEditingLocation(false);
                      }}
                      className="text-[10px] bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-2 py-1 rounded"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-blue-100/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      📍 {location || '서울 (기본값)'}
                    </span>
                    <button
                      onClick={() => {
                        setNewLocationInput(location || '');
                        setIsEditingLocation(true);
                      }}
                      className="text-[10px] text-blue-500 hover:text-blue-600 font-bold underline cursor-pointer"
                    >
                      [위치 변경]
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">향후 3일간의 실시간 날씨 예측을 통해 외부 공정을 계획합니다.</p>
            </div>
          </div>
          <button 
            onClick={fetchThreeDayForecast}
            disabled={isFetchingForecast}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="날씨 갱신"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isFetchingForecast ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {forecastError ? (
          <div className="py-6 text-center text-rose-500 text-xs font-bold flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            날씨 예보 정보를 불러오지 못했습니다: {forecastError}
          </div>
        ) : isFetchingForecast ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : forecastDays.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs font-bold">
            가용한 날씨 예보가 없습니다. 새로고침 단추를 눌러주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {forecastDays.map((day, index) => {
              const hourly = day.hourly?.[4] || day.hourly?.[0] || {};
              const descText = hourly.lang_ko?.[0]?.value || hourly.weatherDesc?.[0]?.value || '맑음';
              const weather = getWeatherDetails(descText);
              const suitability = getWorkSuitability(day);

              // Render specific icon
              let WeatherIcon = Sun;
              if (weather.icon === 'rain') WeatherIcon = CloudRain;
              else if (weather.icon === 'snow') WeatherIcon = CloudSnow;
              else if (weather.icon === 'thunder') WeatherIcon = CloudLightning;
              else if (weather.icon === 'cloudy') WeatherIcon = Cloud;
              else if (weather.icon === 'cloudsun') WeatherIcon = CloudSun;
              else if (weather.icon === 'fog') WeatherIcon = Cloud;

              return (
                <div 
                  key={day.date} 
                  className={`p-5 rounded-2xl border ${theme === 'industrial' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-100'} flex flex-col justify-between space-y-4`}
                >
                  {/* Day Title and Condition Icon */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase tracking-wider ${theme === 'industrial' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {getDayLabel(day.date, index)}
                    </span>
                    <div className={`p-1.5 rounded-xl ${weather.color}`}>
                      <WeatherIcon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Temperature and Basic Conditions */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black italic ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>
                        {day.avgtempC}°C
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        ({day.mintempC}°C / {day.maxtempC}°C)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <span>{weather.label}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-0.5"><Droplets className="w-3 h-3 text-blue-400" /> {day.totalPrecip_mm}mm</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-0.5"><Wind className="w-3 h-3 text-slate-400" /> {hourly.windspeedKmph || 0}km/h</span>
                    </div>
                  </div>

                  {/* Site Suitability Banner */}
                  <div className={`p-3 rounded-xl border text-xs font-bold ${suitability.color} flex flex-col gap-1`}>
                    <div className="flex items-center gap-1.5">
                      {suitability.severity === 'safe' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                      )}
                      <span className="font-black uppercase tracking-wider">{suitability.status}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-90 font-medium">{suitability.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            <button 
              onClick={() => fetchArchiveWeather(archiveDate)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isFetchingArchive ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {sortedReports.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <ClipboardList className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold">등록된 일보가 없습니다.</p>
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
                    {(report.precip || report.windSpeed) && (
                      <div className="flex gap-2 mt-1">
                        {report.precip! > 0 && <span className="text-[8px] px-1 bg-blue-500/10 text-blue-500 rounded font-bold">강수: {report.precip}mm</span>}
                        {report.windSpeed! > 0 && <span className="text-[8px] px-1 bg-slate-500/10 text-slate-500 rounded font-bold">풍속: {report.windSpeed}km/h</span>}
                      </div>
                    )}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">강수량 (mm)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={newReport.precip} 
                    onChange={e => setNewReport({...newReport, precip: parseFloat(e.target.value) || 0})}
                    className={`w-full p-4 rounded-2xl border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">풍속 (km/h)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={newReport.windSpeed} 
                    onChange={e => setNewReport({...newReport, windSpeed: parseFloat(e.target.value) || 0})}
                    className={`w-full p-4 rounded-2xl border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'industrial' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
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
