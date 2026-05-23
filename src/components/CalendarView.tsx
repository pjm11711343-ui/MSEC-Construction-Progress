import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Building2 } from 'lucide-react';
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
  getFloorText: (percent: number, building?: BuildingData) => string;
}

export default function CalendarView({ buildings, theme, activeTheme, getFloorText }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Aggregate all delivery events
  const events: Record<string, Array<{ building: string; proc: string; floor: string }>> = {};
  buildings.forEach(b => {
    if (b.materialDates) {
      Object.entries(b.materialDates).forEach(([proc, date]) => {
        if (date) {
          if (!events[date]) events[date] = [];
          const progress = b.materialProcesses?.[proc] ?? 0;
          const floor = getFloorText(progress, b);
          events[date].push({ building: b.name, proc, floor });
        }
      });
    }
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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

            return (
              <div key={day} className={`min-h-[140px] p-2 space-y-2 group transition-all ${isToday(day) ? (theme === 'industrial' ? 'bg-slate-800/50' : 'bg-blue-50/30') : ''}`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-black ${isToday(day) ? activeTheme.text : (idx % 7 === 0 ? 'text-red-500' : (idx % 7 === 6 ? 'text-blue-500' : 'text-slate-400'))}`}>
                    {day}
                  </span>
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
