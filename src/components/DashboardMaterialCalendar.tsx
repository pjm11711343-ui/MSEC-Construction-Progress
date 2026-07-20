import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Building2, 
  Clock, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Timer,
  RefreshCw,
  Info
} from 'lucide-react';
import { AppState, AppTheme } from '../types';

interface DashboardMaterialCalendarProps {
  data: AppState;
  theme: AppTheme;
  activeTheme: {
    accent: string;
    bg: string;
    card: string;
    border: string;
    text: string;
    accentHex?: string;
  };
}

export const DashboardMaterialCalendar: React.FC<DashboardMaterialCalendarProps> = ({
  data,
  theme,
  activeTheme
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const isIndustrial = theme === 'industrial';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 1. Extract all material delivery date events from all buildings and processes
  const allEvents = useMemo(() => {
    const list: Array<{
      id: string;
      buildingId: number;
      buildingName: string;
      processName: string;
      deliveryDate: string;
      status: number; // 0: 자재미입고, 1: 진행중, 100: 입고완료, -1: N/A
      leadTime: number;
      deadlineDate: string;
      daysRemainingToDeadline: number;
      daysRemainingToDelivery: number;
      isUrgent: boolean;
      isOverdue: boolean;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    data.buildings.forEach(b => {
      if (b.materialDates) {
        Object.entries(b.materialDates).forEach(([procName, dateStr]) => {
          if (dateStr) {
            const status = b.materialProcesses?.[procName] ?? 0;
            if (status === -1) return; // Skip N/A

            const leadTime = data.settings.processLeadTimes?.[procName] || 0;
            const deliveryDateObj = new Date(dateStr);
            deliveryDateObj.setHours(0, 0, 0, 0);

            // Calculate deadline (Delivery Date - Lead Time)
            const deadlineDateObj = new Date(deliveryDateObj);
            deadlineDateObj.setDate(deadlineDateObj.getDate() - leadTime);

            const timeDiffToDeadline = deadlineDateObj.getTime() - today.getTime();
            const daysToDeadline = Math.ceil(timeDiffToDeadline / (1000 * 60 * 60 * 24));

            const timeDiffToDelivery = deliveryDateObj.getTime() - today.getTime();
            const daysToDelivery = Math.ceil(timeDiffToDelivery / (1000 * 60 * 60 * 24));

            // Overdue if deadline has passed and material is not yet fully delivered (status < 100)
            const isOverdue = daysToDeadline <= 0 && status < 100;
            // Urgent if deadline is in 3 days and status < 100
            const isUrgent = daysToDeadline > 0 && daysToDeadline <= 3 && status < 100;

            list.push({
              id: `${b.id}-${procName}-${dateStr}`,
              buildingId: b.id,
              buildingName: b.name,
              processName: procName,
              deliveryDate: dateStr,
              status,
              leadTime,
              deadlineDate: deadlineDateObj.toISOString().split('T')[0],
              daysRemainingToDeadline: daysToDeadline,
              daysRemainingToDelivery: daysToDelivery,
              isUrgent,
              isOverdue
            });
          }
        });
      }
    });

    return list.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  }, [data.buildings, data.settings.processLeadTimes]);

  // 2. Filter events based on search term, status filter, and selected calendar date
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      // Search matches
      const matchesSearch = 
        ev.processName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.deliveryDate.includes(searchTerm);

      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'PENDING') matchesStatus = ev.status === 0;
      else if (statusFilter === 'IN_PROGRESS') matchesStatus = ev.status === 1;
      else if (statusFilter === 'COMPLETED') matchesStatus = ev.status === 100;

      // Calendar date filter
      const matchesSelectedDate = selectedDate ? ev.deliveryDate === selectedDate : true;

      return matchesSearch && matchesStatus && matchesSelectedDate;
    });
  }, [allEvents, searchTerm, statusFilter, selectedDate]);

  // 3. Calendar calculations
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setSelectedDate(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const calendarCells = useMemo(() => {
    const cells = [];
    // Pad previous month days
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(i);
    }
    return cells;
  }, [year, month, firstDay, daysInMonth]);

  // Group events by date for calendar highlighting
  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof allEvents> = {};
    allEvents.forEach(ev => {
      if (!map[ev.deliveryDate]) {
        map[ev.deliveryDate] = [];
      }
      map[ev.deliveryDate].push(ev);
    });
    return map;
  }, [allEvents]);

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const getStatusBadgeStyle = (status: number) => {
    if (status === 100) {
      return isIndustrial 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    } else if (status === 1) {
      return isIndustrial 
        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
        : 'bg-amber-50 text-amber-700 border border-amber-100';
    } else {
      return isIndustrial 
        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
        : 'bg-rose-50 text-rose-700 border border-rose-100';
    }
  };

  const getStatusLabel = (status: number) => {
    if (status === 100) return '입고완료';
    if (status === 1) return '진행중';
    return '자재미입고';
  };

  const activeCount = useMemo(() => {
    return allEvents.filter(e => e.status < 100).length;
  }, [allEvents]);

  const overdueCount = useMemo(() => {
    return allEvents.filter(e => e.isOverdue).length;
  }, [allEvents]);

  return (
    <div className="space-y-6">
      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isIndustrial ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider">전체 예정 건수</h4>
              <p className={`text-lg md:text-2xl font-black ${isIndustrial ? 'text-white' : 'text-slate-900'}`}>{allEvents.length}건</p>
            </div>
          </div>
        </div>

        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isIndustrial ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider">미완료 수급 건수</h4>
              <p className={`text-lg md:text-2xl font-black ${isIndustrial ? 'text-amber-400' : 'text-amber-600'}`}>{activeCount}건</p>
            </div>
          </div>
        </div>

        <div className={`${activeTheme.card} p-4 rounded-2xl border ${activeTheme.border} shadow-sm flex items-center justify-between border-rose-500/20`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isIndustrial ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider">발주 지연/임박 위험</h4>
              <p className={`text-lg md:text-2xl font-black ${overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{overdueCount}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Mini Calendar */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`${activeTheme.card} rounded-2xl border ${activeTheme.border} shadow-sm p-4 overflow-hidden`}>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <span className={`text-sm font-black ${isIndustrial ? 'text-white' : 'text-slate-900'}`}>
                {year}년 {month + 1}월 입고 달력
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={prevMonth} 
                  className={`p-1.5 rounded-lg transition-colors ${
                    isIndustrial ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSelectedDate(null)}
                  className={`px-2 py-1 rounded text-[8px] font-bold border transition-all ${
                    selectedDate 
                      ? (isIndustrial ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700')
                      : 'opacity-50 cursor-default'
                  }`}
                  disabled={!selectedDate}
                >
                  전체보기
                </button>
                <button 
                  onClick={nextMonth} 
                  className={`p-1.5 rounded-lg transition-colors ${
                    isIndustrial ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of the Week */}
            <div className="grid grid-cols-7 text-center text-[9px] font-black text-slate-400 mb-2 uppercase tracking-wider">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={i === 0 ? 'text-rose-500' : (i === 6 ? 'text-blue-500' : '')}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1 border-t border-dashed border-slate-200 dark:border-slate-800 pt-1">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-10 md:h-12 bg-transparent opacity-20" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = eventsByDate[dateStr] || [];
                const isSelected = selectedDate === dateStr;
                const hasPending = dayEvents.some(ev => ev.status === 0);
                const hasInProgress = dayEvents.some(ev => ev.status === 1);
                const hasCompleted = dayEvents.some(ev => ev.status === 100);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`h-10 md:h-12 rounded-xl flex flex-col items-center justify-between p-1 border transition-all duration-200 relative ${
                      isSelected 
                        ? (isIndustrial ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20')
                        : isToday(day)
                        ? (isIndustrial ? 'bg-slate-800/80 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600')
                        : (isIndustrial ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/50 text-slate-300' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/50 text-slate-700')
                    }`}
                  >
                    <span className="text-[10px] font-black">{day}</span>

                    {/* Miniature delivery dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 justify-center w-full mb-0.5">
                        {hasPending && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                        {hasInProgress && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        {hasCompleted && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {dayEvents.length > 3 && (
                          <span className={`text-[6px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>+</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="flex justify-center gap-3 mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 text-[8px] font-bold text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>미입고</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>진행중</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>입고완료</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-500 font-bold text-xs">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>자동 연동 및 추출 안내</span>
            </div>
            <p className="text-[9px] leading-relaxed">
              본 일정표는 각 아파트 동별 공정 시트 내에 기입된 <strong>'자재 반입일'</strong> 데이터를 실시간으로 자동 수집하여 구축됩니다. 공정표를 수정하는 즉시 해당 정보가 이곳 달력과 리스트에 반영됩니다.
            </p>
          </div>
        </div>

        {/* Right Column: Searchable, Filterable Scheduled Delivery List */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`${activeTheme.card} rounded-2xl border ${activeTheme.border} p-4 space-y-4 shadow-sm`}>
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="공종, 동명 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-4 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 ${
                    isIndustrial 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-600 focus:ring-blue-500 focus:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
                {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                      statusFilter === f
                        ? 'bg-blue-600 text-white'
                        : isIndustrial
                        ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800/50'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' && '전체'}
                    {f === 'PENDING' && '미입고'}
                    {f === 'IN_PROGRESS' && '진행중'}
                    {f === 'COMPLETED' && '완료'}
                  </button>
                ))}
              </div>
            </div>

            {/* List Header / Breadcrumb if date is selected */}
            <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-bold">
              <div className="flex items-center gap-1">
                <span>자재 입고 예정일 목록</span>
                {selectedDate && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                    {selectedDate} 필터링됨
                  </span>
                )}
              </div>
              <span>총 {filteredEvents.length}건</span>
            </div>

            {/* Delivery Items List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              <AnimatePresence mode="wait">
                {filteredEvents.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center text-slate-400 space-y-2"
                  >
                    <Package className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-xs font-bold">해당하는 자재 입고 일정이 없습니다.</p>
                    <p className="text-[10px] text-slate-500 font-medium">상단 공정표에서 반입 날짜를 설정해 주세요.</p>
                  </motion.div>
                ) : (
                  filteredEvents.map((ev, index) => {
                    const dDayStr = ev.daysRemainingToDelivery === 0 
                      ? '오늘 입고' 
                      : ev.daysRemainingToDelivery > 0 
                      ? `입고 D-${ev.daysRemainingToDelivery}` 
                      : `입고 완료 (${Math.abs(ev.daysRemainingToDelivery)}일 전)`;

                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`p-3 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 group transition-all hover:translate-x-1 ${
                          isIndustrial 
                            ? 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80' 
                            : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                        }`}
                      >
                        {/* Process and Building details */}
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            ev.status === 100 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : ev.isOverdue 
                              ? 'bg-rose-500/10 text-rose-500 animate-pulse' 
                              : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-xs font-black ${isIndustrial ? 'text-white' : 'text-slate-900'}`}>
                                {ev.processName}
                              </h5>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${getStatusBadgeStyle(ev.status)}`}>
                                {getStatusLabel(ev.status)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                {ev.buildingName}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3 text-slate-500" />
                                예정일: {ev.deliveryDate}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Order lead time and critical status */}
                        <div className="flex items-center justify-between md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-dashed border-slate-200 dark:border-slate-800">
                          <div className="md:hidden">
                            <span className="text-[10px] text-slate-400 font-bold">발주 마감 정보</span>
                          </div>
                          <div className="space-y-1 text-right">
                            <div className="flex items-center md:justify-end gap-1">
                              <span className={`text-xs font-black ${
                                ev.status === 100 
                                  ? 'text-emerald-500' 
                                  : ev.isOverdue 
                                  ? 'text-rose-500 animate-pulse font-extrabold' 
                                  : 'text-blue-500'
                              }`}>
                                {ev.status === 100 ? '입고 완료' : dDayStr}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center md:justify-end gap-1.5 text-[9px] text-slate-400">
                              <Clock className="w-2.5 h-2.5 text-slate-500" />
                              <span>발주 마감: <strong className={ev.isOverdue ? 'text-rose-500 font-black' : 'text-slate-300 dark:text-slate-500'}>{ev.deadlineDate}</strong></span>
                              <span className={`px-1 rounded-sm text-[8px] font-bold ${
                                ev.isOverdue 
                                  ? 'bg-rose-500/10 text-rose-500' 
                                  : ev.isUrgent 
                                  ? 'bg-amber-500/10 text-amber-500' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              }`}>
                                {ev.status === 100 ? '완료' : ev.daysRemainingToDeadline <= 0 ? '지연됨' : `마감 D-${ev.daysRemainingToDeadline}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
