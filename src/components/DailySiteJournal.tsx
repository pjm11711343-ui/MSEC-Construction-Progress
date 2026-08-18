import React, { useState, useEffect, useRef, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Printer, 
  Clock, 
  BookOpen, 
  Trash2, 
  Check, 
  Copy, 
  Sparkles,
  Inbox
} from 'lucide-react';

interface DailyJournalEntry {
  notes: string;
  issues?: string;
  milestones?: string;
}

interface DailySiteJournalProps {
  theme: string;
  activeTheme: {
    bg: string;
    border: string;
    text: string;
    accent: string;
    accentHex: string;
    card: string;
  };
  dailyJournals?: Record<string, DailyJournalEntry>;
  onSaveJournal: (date: string, entry: DailyJournalEntry) => void;
  onClearJournal?: (date: string) => void;
}

export const DailySiteJournal: React.FC<DailySiteJournalProps> = ({
  theme,
  activeTheme,
  dailyJournals = {},
  onSaveJournal,
  onClearJournal
}) => {
  const isIndustrial = theme === 'industrial';
  
  // Get today's local date string YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [milestones, setMilestones] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [copied, setCopied] = useState<boolean>(false);

  // Load entry for selected date
  useEffect(() => {
    const entry = dailyJournals[selectedDate];
    if (entry) {
      setNotes(entry.notes || '');
      setIssues(entry.issues || '');
      setMilestones(entry.milestones || '');
    } else {
      setNotes('');
      setIssues('');
      setMilestones('');
    }
    setSaveStatus('idle');
  }, [selectedDate, dailyJournals]);

  // Handle local typing changes and queue saving (autosave)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutosave = (updatedNotes: string, updatedIssues: string, updatedMilestones: string) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSaveJournal(selectedDate, {
        notes: updatedNotes,
        issues: updatedIssues,
        milestones: updatedMilestones
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    }, 800); // 800ms debounce
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    triggerAutosave(val, issues, milestones);
  };

  const handleIssuesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setIssues(val);
    triggerAutosave(notes, val, milestones);
  };

  const handleMilestonesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMilestones(val);
    triggerAutosave(notes, issues, val);
  };

  // Get days in the week view around current week offset
  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    // Start of the week (Sunday based)
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7));

    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      const dateStr = getLocalDateString(date);
      const hasEntry = !!(dailyJournals[dateStr]?.notes || dailyJournals[dateStr]?.issues || dailyJournals[dateStr]?.milestones);
      days.push({
        date,
        dateStr,
        dayLabel: ['일', '월', '화', '수', '목', '금', '토'][i],
        dayNum: date.getDate(),
        hasEntry,
        isToday: dateStr === getLocalDateString(new Date())
      });
    }
    return days;
  }, [currentWeekOffset, dailyJournals]);

  // Quick navigation functions
  const jumpToToday = () => {
    const todayStr = getLocalDateString(new Date());
    setSelectedDate(todayStr);
    setCurrentWeekOffset(0);
  };

  const handlePrevDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 1);
    const dateStr = getLocalDateString(cur);
    setSelectedDate(dateStr);
    
    // Auto-adjust week offset if selected day is out of current week days
    const weekStart = weekDays[0].date;
    const weekEnd = weekDays[6].date;
    if (cur < weekStart) {
      setCurrentWeekOffset(prev => prev - 1);
    }
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 1);
    const dateStr = getLocalDateString(cur);
    setSelectedDate(dateStr);

    // Auto-adjust week offset if selected day is out of current week days
    const weekStart = weekDays[0].date;
    const weekEnd = weekDays[6].date;
    if (cur > weekEnd) {
      setCurrentWeekOffset(prev => prev + 1);
    }
  };

  // Delete/Clear Entry
  const handleClearJournalEntry = () => {
    if (window.confirm(`${selectedDate} 일지 데이터를 정말 삭제하시겠습니까?`)) {
      setNotes('');
      setIssues('');
      setMilestones('');
      if (onClearJournal) {
        onClearJournal(selectedDate);
      } else {
        onSaveJournal(selectedDate, { notes: '', issues: '', milestones: '' });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    }
  };

  // Copy entry log to clipboard
  const copyToClipboard = () => {
    const hasLog = notes || issues || milestones;
    if (!hasLog) return;
    
    const formattedText = `[현장 일지 - ${selectedDate}]
------------------------------------
■ 금일 주요 공무 및 진행 내용:
${notes || '기록 없음'}

■ 발생 이슈 및 특별 관리 사항 (건의):
${issues || '이슈 없음'}

■ 금일 주요 달성 실적 / 마일스톤:
${milestones || '실적 없음'}
------------------------------------`;

    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Print entry layout
  const printEntry = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const contentHtml = `
      <html>
        <head>
          <title>현장 일지 - ${selectedDate}</title>
          <style>
            body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header p { margin: 5px 0 0; color: #666; font-size: 14px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 16px; font-weight: bold; border-left: 4px solid #2563eb; padding-left: 10px; margin-bottom: 12px; color: #1e3a8a; background-color: #f0f4ff; padding-top: 4px; padding-bottom: 4px; }
            .content { font-size: 14px; white-space: pre-wrap; padding-left: 14px; word-break: break-all; }
            .footer { border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 50px; font-size: 11px; color: #999; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <h1>일일 현장 작업 일지</h1>
            <p>기록 일자: ${selectedDate}</p>
          </div>
          <div class="section">
            <div class="section-title">금일 주요 공무 및 기획 일지</div>
            <div class="content">${notes || '기록된 내용이 없습니다.'}</div>
          </div>
          <div class="section">
            <div class="section-title">발생 이슈 및 제약 조건 제어 관리</div>
            <div class="content">${issues || '특이 사항 및 이슈가 보고되지 않았습니다.'}</div>
          </div>
          <div class="section">
            <div class="section-title">현장 실적 및 달성 마일스톤</div>
            <div class="content">${milestones || '완료된 마일스톤이나 특이 실적이 없습니다.'}</div>
          </div>
          <div class="footer">
            <span>건설 스마트 종합 모니터링 시스템 (CAP)</span>
            <span>출력 일시: ${new Date().toLocaleString()}</span>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(contentHtml);
    printWindow.document.close();
  };

  // Recent 5 entries timeline lookup
  const recentEntries = useMemo(() => {
    return Object.entries(dailyJournals)
      .filter(([_, entry]) => entry.notes || entry.issues || entry.milestones)
      .sort((a, b) => b[0].localeCompare(a[0])) // Descending date
      .slice(0, 5);
  }, [dailyJournals]);

  return (
    <div className={`rounded-3xl border ${activeTheme.card} ${activeTheme.border} p-4 md:p-6 shadow-sm relative overflow-hidden flex flex-col gap-6`}>
      {/* Background ambient accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500 opacity-[0.02] dark:opacity-[0.015] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Journal Component Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-slate-800/40 pb-4 relative z-10 no-print">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isIndustrial ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className={`font-black text-sm md:text-base leading-tight ${isIndustrial ? 'text-white' : 'text-slate-900'}`}>
              일일 현장 업무 일지 (캘린더 일지)
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Daily Site Work Journal & Milestones Control
            </p>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 shadow-inner">
            <button 
              type="button"
              onClick={handlePrevDay}
              className="p-1 px-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-950 dark:hover:text-white transition-all text-xs"
              title="이전날"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
              {selectedDate}
            </span>
            <button 
              type="button"
              onClick={handleNextDay}
              className="p-1 px-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-950 dark:hover:text-white transition-all text-xs"
              title="다음날"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={jumpToToday}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border ${activeTheme.border}`}
          >
            Today
          </button>
          
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className={`px-2 py-1 base-input rounded-xl border ${activeTheme.border} text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${isIndustrial ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}
          />
        </div>
      </div>

      {/* Week Navigator Bar */}
      <div className="flex flex-col gap-2 no-print relative z-10">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>주간 탐색</span>
          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setCurrentWeekOffset(p => p - 1)}
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[9px] text-slate-500">
              {currentWeekOffset === 0 ? 'Current Week' : currentWeekOffset > 0 ? `+${currentWeekOffset} Weeks` : `${currentWeekOffset} Weeks`}
            </span>
            <button 
              type="button"
              onClick={() => setCurrentWeekOffset(p => p + 1)}
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Days Array Horizontal List */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => setSelectedDate(day.dateStr)}
                className={`relative p-2 md:p-3 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                  isSelected 
                    ? `bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20`
                    : day.isToday
                    ? `${isIndustrial ? 'bg-indigo-950/20 border-indigo-500/40 text-indigo-400' : 'bg-indigo-50/50 border-indigo-200 text-indigo-600'}`
                    : `${isIndustrial ? 'bg-slate-900/30 border-slate-800 hover:bg-slate-800/50' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'} text-slate-600 dark:text-slate-400`
                }`}
              >
                <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                  {day.dayLabel}
                </span>
                <span className="text-sm font-black font-mono">
                  {day.dayNum}
                </span>

                {/* Entry Dot Indicator */}
                {day.hasEntry && (
                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Area + Recents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Side: Detail Forms (Autosaving) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${notes || issues || milestones ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {selectedDate} 일지 편집 중
              </h3>
            </div>

            {/* Save Status and Tool bar */}
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                {saveStatus === 'saving' && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-emerald-500 flex items-center gap-1 animate-pulse">
                    <Check className="w-3.5 h-3.5" /> All Saved
                  </span>
                )}
                {saveStatus === 'idle' && (
                  <span className="text-slate-400">Autosave Active</span>
                )}
              </div>

              {/* Copy & Print actions */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/40 dark:border-slate-700/40">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  disabled={!notes && !issues && !milestones}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="클립보드 복사"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={printEntry}
                  disabled={!notes && !issues && !milestones}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="일지 인쇄하기"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={handleClearJournalEntry}
                  disabled={!notes && !issues && !milestones}
                  className="p-1.5 hover:bg-red-50 hover:dark:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="일지 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Notes Input Section */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                금일 주요 공무 및 진행 내용 (General Journal)
              </label>
              <textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder="오늘 완료한 주요 세대 작업, 감리 미팅 사항, 동인원 배정 등 전체적인 공무 및 시공 지침 기획 사항을 기록하세요..."
                className={`w-full min-h-[120px] max-h-[120px] text-sm p-4 rounded-2xl border ${activeTheme.border} focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 transition-all ${
                  isIndustrial ? 'bg-slate-900 text-white placeholder-slate-600' : 'bg-slate-50 text-slate-800'
                }`}
              />
            </div>

            {/* Dual Grid for Milestones and Issues */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Issues / Constraint Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  특별 관리 / 발생 이슈 (Major Issues)
                </label>
                <textarea
                  value={issues}
                  onChange={handleIssuesChange}
                  placeholder="예: '3동 이중관 배관 자재 입고가 지연되어 타일 공정 재협의 예정', '중앙 주차장 스프링클러 설치에 소방 특별점검 진행'..."
                  className={`w-full min-h-[110px] max-h-[110px] text-[13px] p-4 rounded-2xl border ${activeTheme.border} focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-amber-500 transition-all ${
                    isIndustrial ? 'bg-slate-900 text-white placeholder-slate-600' : 'bg-slate-50 text-slate-800'
                  }`}
                />
              </div>

              {/* Milestones / Checklist Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  금일 주요 달성 실적 / 마일스톤 (Milestones)
                </label>
                <textarea
                  value={milestones}
                  onChange={handleMilestonesChange}
                  placeholder="예: '1동/2동 기초 매립 배관 완료', '주차장(B1) 소방 입상 100% 진행', '전체 공정률 1.2% 상승 달성'..."
                  className={`w-full min-h-[110px] max-h-[110px] text-[13px] p-4 rounded-2xl border ${activeTheme.border} focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500 transition-all ${
                    isIndustrial ? 'bg-slate-900 text-white placeholder-slate-600' : 'bg-slate-50 text-slate-800'
                  }`}
                />
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Quick History Log Sidebar & Useful Tips */}
        <div className="lg:col-span-4 flex flex-col gap-4 no-print border-l border-slate-200/40 dark:border-slate-800/40 lg:pl-6">
          <div>
            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              최근 작성 기록 (Recent Logs)
            </h3>

            {recentEntries.length === 0 ? (
              <div className={`flex flex-col items-center justify-center p-6 border border-dashed ${activeTheme.border} rounded-2xl text-center group`}>
                <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform mb-2" />
                <p className="text-[11px] font-bold text-slate-400 leading-snug">최근 생성된 일지 내역이 없습니다.</p>
                <p className="text-[9px] text-slate-400/70 mt-0.5">상단 캘린더에서 일을 선택해 첫 일지를 생성해 보세요.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {recentEntries.map(([dateKey, entry]) => {
                  const isCurrent = dateKey === selectedDate;
                  const contentLimit = entry.notes?.substring(0, 42) + (entry.notes && entry.notes.length > 42 ? '...' : '');
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                        isCurrent 
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40 shadow-sm' 
                          : 'bg-transparent border-slate-200/40 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-black font-mono text-slate-700 dark:text-slate-300">{dateKey}</span>
                        {isCurrent && (
                          <span className="text-[8px] bg-indigo-500 text-white font-black px-1 rounded">EDITING</span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                        {contentLimit || '기록 있으나 세부 텍스트 없음'}
                      </p>
                      <div className="flex gap-2.5 items-center mt-0.5">
                        {entry.issues && (
                          <span className="text-[7.5px] font-black text-amber-500 flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-amber-500" /> ISSUE
                          </span>
                        )}
                        {entry.milestones && (
                          <span className="text-[7.5px] font-black text-emerald-500 flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" /> MILESTONE
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Advisor Context Tip Box */}
          <div className={`p-4 rounded-2xl border ${isIndustrial ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50 border-slate-100'} shadow-inner flex flex-col gap-2`}>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>MANAGER ADVISER TIP</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
              본 일지에 매일의 자재 변동이나 병목 현상(이슈 및 제약 조건)을 상세히 남기면, <span className="font-bold text-indigo-500">대시보드 AI 진단 및 리스크 탐지</span> 기능이 각 이벤트 데이터를 맥락으로 인지하여 한층 더 정교한 일정 시뮬레이션 및 권장 대응 안을 제공합니다.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
