import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Package, Building2, Sun, Cloud, CloudRain, CloudSnow, Wind, CloudLightning, RefreshCw } from 'lucide-react';
import { BuildingData, AppTheme } from '../types';

interface CalendarViewProps {
  buildings: BuildingData[];
  theme: AppTheme;
  activeTheme: {
    accent: string;
    bg: string;
    card: string;
    border: string;
    text: string;
  };
  getFloorText: (percent: number, building?: BuildingData, processName?: string) => string;
  getMaterialText: (percent: number, building?: BuildingData, processName?: string) => string;
  location?: string;
  coords?: { lat: number; lng: number };
}

export default function CalendarView({ buildings, theme, activeTheme, getFloorText, getMaterialText, location, coords }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weatherData, setWeatherData] = useState<Record<string, { desc: string; temp: string; precip: string; icon: React.ReactNode }>>({});
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  // Aggregate all delivery events
  const events: Record<string, Array<{ building: string; proc: string; floor: string }>> = {};
  buildings.forEach(b => {
    if (b.materialDates) {
      Object.entries(b.materialDates).forEach(([proc, date]) => {
        if (date) {
          if (!events[date]) events[date] = [];
          const progress = b.materialProcesses?.[proc] ?? 0;
          const floor = getMaterialText(progress, b, proc);
          events[date].push({ building: b.name, proc, floor });
        }
      });
    }
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getWeatherIcon = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('sun') || d.includes('clear')) return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    if (d.includes('rain') || d.includes('drizzle')) return <CloudRain className="w-3.5 h-3.5 text-blue-400" />;
    if (d.includes('snow') || d.includes('ice') || d.includes('sleet')) return <CloudSnow className="w-3.5 h-3.5 text-slate-300" />;
    if (d.includes('thunder')) return <CloudLightning className="w-3.5 h-3.5 text-yellow-500" />;
    if (d.includes('cloud') || d.includes('overcast')) return <Cloud className="w-3.5 h-3.5 text-slate-400" />;
    if (d.includes('mist') || d.includes('fog')) return <Wind className="w-3.5 h-3.5 text-slate-300" />;
    return <CloudSunIcon className="w-3.5 h-3.5 text-slate-400" />;
  };

  const fetchWeatherForMonth = async () => {
    if (!location) return;
    setIsFetchingWeather(true);
    
    const daysInMonth = getDaysInMonth(year, month);
    const results: Record<string, any> = {};
    
    // To avoid hitting rate limits or slow performance, we'll fetch only a subset or try to find a balanced way.
    // wttr.in supports finding weather for a specific date: location@YYYY-MM-DD
    
    // We'll fetch weather for a few key dates (beginning, middle, end) if there are too many, 
    // but the user wants "past to present record". 
    // Consturction managers usually want to see what happened on specific work days.
    
    // Let's fetch for the current month and the 5 days before today if it's the current month.
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    const datesToFetch = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // Only fetch for past dates or today
      const dateObj = new Date(year, month, d);
      if (dateObj <= today) {
        datesToFetch.push(dateStr);
      }
    }

    // Limit to prevent blocking - fetch in batches
    const batchSize = 2; // Reduced batch size
    for (let i = 0; i < datesToFetch.length; i += batchSize) {
      const batch = datesToFetch.slice(i, i + batchSize);
      await Promise.all(batch.map(async (dateStr) => {
        try {
          const locParam = coords ? `${coords.lat},${coords.lng}` : (location || '');
          const response = await fetch(`/api/weather?location=${encodeURIComponent(locParam)}&date=${dateStr}`);
          if (response.ok) {
            const data = await response.json();
            let desc = '';
            let temp = '';
            let precip = '0';
            
            if (data.weather?.[0]) {
              const w = data.weather[0];
              const h = w.hourly[4]; // midday
              desc = h.lang_ko ? h.lang_ko[0].value : h.weatherDesc[0].value;
              temp = w.avgtempC;
              precip = w.totalPrecip_mm;
            } else if (data.current_condition?.[0]) {
              const c = data.current_condition[0];
              desc = c.lang_ko ? c.lang_ko[0].value : c.weatherDesc[0].value;
              temp = c.temp_C;
              precip = '0';
            }

            if (desc) {
              results[dateStr] = {
                desc,
                temp,
                precip,
                icon: getWeatherIcon(desc)
              };
            }
          }
        } catch (error) {
          console.error(`Weather fetch error for ${dateStr}:`, error);
        }
      }));
      // Pause between batches to avoid rate limiting or socket closure
      if (i + batchSize < datesToFetch.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setWeatherData(prev => ({ ...prev, ...results }));
    setIsFetchingWeather(false);
  };

  useEffect(() => {
    fetchWeatherForMonth();
  }, [year, month, location]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = [];
  // Padding for first week
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const getKmaReg = (loc?: string) => {
    if (!loc) return '108'; // Default Seoul
    const l = loc.toLowerCase();
    if (l.includes('인천') || l.includes('김포')) return '112';
    if (l.includes('수원')) return '119';
    if (l.includes('대전')) return '133';
    if (l.includes('부산')) return '159';
    if (l.includes('대구')) return '143';
    if (l.includes('광주')) return '156';
    if (l.includes('울산')) return '152';
    if (l.includes('제주')) return '184';
    return '108';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <h2 className={`text-xl font-black uppercase tracking-tight ${theme === 'industrial' ? 'text-white' : 'text-slate-900'}`}>자재 입고 예정표</h2>
        <div className={`flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl border ${activeTheme.border} shadow-sm`}>
          <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <span className="text-sm font-black min-w-[100px] text-center">
            {year}년 {month + 1}월
          </span>
          {isFetchingWeather && (
            <div className="flex items-center gap-1 animate-pulse">
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
              <span className="text-[9px] font-bold text-blue-500">날씨 조회 중...</span>
            </div>
          )}
          <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      <div className={`${activeTheme.card} rounded-3xl border ${activeTheme.border} shadow-xl overflow-hidden print:border-none print:shadow-none`}>
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`py-4 text-center text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'text-red-400' : (i === 6 ? 'text-blue-400' : 'text-slate-400')}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800 border-l border-t border-transparent">
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className={`${theme === 'industrial' ? 'bg-slate-900/30' : 'bg-slate-50/50'}`} />;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events[dateStr] || [];
            const dayWeather = weatherData[dateStr];

            return (
              <div key={day} className={`min-h-[140px] p-2 space-y-2 group transition-all ${isToday(day) ? (theme === 'industrial' ? 'bg-slate-800/50' : 'bg-blue-50/30') : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isToday(day) ? activeTheme.text : (idx % 7 === 0 ? 'text-red-500' : (idx % 7 === 6 ? 'text-blue-500' : 'text-slate-400'))}`}>
                    {day}
                  </span>
                  {dayWeather && (
                    <div className="flex flex-col items-end gap-0.5">
                      <a 
                        href={`https://www.weather.go.kr/w/obs-prev/land.do?tm=${year}.${month + 1}.${day}&type=t99&reg=${getKmaReg(location)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="기상청 과거관측 보기"
                        className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-100 dark:border-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group/weather"
                      >
                        {dayWeather.icon}
                        <span className="text-[8px] font-black text-slate-500 group-hover/weather:text-blue-500">{dayWeather.temp}°</span>
                      </a>
                      {parseFloat(dayWeather.precip) > 0 && (
                        <span className="text-[7px] font-bold text-blue-500 bg-blue-50/50 dark:bg-blue-900/20 px-1 rounded">
                          {dayWeather.precip}mm
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.map((ev, ei) => (
                    <div key={ei} className={`p-1.5 rounded-lg border text-[9px] font-bold shadow-sm transition-all hover:scale-105 ${theme === 'industrial' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-blue-100 text-slate-700'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1 text-blue-500 min-w-0">
                          <Package className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{ev.proc}</span>
                        </div>
                        <span className={`text-[7px] px-1 rounded-full ${theme === 'industrial' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                           {ev.floor}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[8px] text-slate-400 font-medium">
                        <Building2 className="w-2 h-2" />
                        <span>{ev.building}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        <div className={`${activeTheme.card} p-5 rounded-2xl border ${activeTheme.border} shadow-sm space-y-3`}>
          <div className="flex items-center gap-2 mb-2">
            <Package className={`w-5 h-5 ${activeTheme.text}`} />
            <h3 className="font-black text-sm uppercase tracking-tight">이달의 입고 요약</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(events)
              .filter(([date]) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, evList]) => (
                <div key={date} className="flex items-center justify-between text-xs border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-400">{date.split('-')[2]}일</span>
                  <div className="flex -space-x-1">
                    {evList.slice(0, 5).map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full border border-white dark:border-slate-800 ${activeTheme.accent}`} />
                    ))}
                    {evList.length > 5 && (
                      <div className="w-4 h-4 rounded-full border border-white dark:border-slate-800 bg-slate-200 text-[8px] flex items-center justify-center font-bold">
                        +{evList.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-[10px]">{evList.length}건</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudSunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
