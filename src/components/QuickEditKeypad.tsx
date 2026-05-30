import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowLeft, Layers, Percent } from 'lucide-react';
import { BuildingData } from '../types';

interface QuickEditKeypadProps {
  building: BuildingData;
  processName: string;
  currentValue: number;
  isPercentMode: boolean;
  floors: number[];
  onClose: () => void;
  onSave: (value: number) => void;
  isIndustrial: boolean;
  formatFloor: (floor: number) => string;
  floorToPercent: (floor: number, building?: BuildingData) => number;
  percentToFloor: (percent: number, building?: BuildingData) => number;
}

export const QuickEditKeypad: React.FC<QuickEditKeypadProps> = ({
  building,
  processName,
  currentValue,
  isPercentMode,
  floors,
  onClose,
  onSave,
  isIndustrial,
  formatFloor,
  floorToPercent,
  percentToFloor,
}) => {
  // We keep a string state for numeric input
  const [typedValue, setTypedValue] = useState<string>('');
  
  // Track selected floor or state in percentage representation
  const [tempValue, setTempValue] = useState<number>(currentValue);

  // Initialize input when modal opens
  useEffect(() => {
    setTempValue(currentValue);
    if (isPercentMode) {
      if (currentValue === -1) {
        setTypedValue('');
      } else {
        setTypedValue(currentValue.toString());
      }
    } else {
      // In floor mode, map to floor number
      const currentFloor = percentToFloor(currentValue, building);
      if (currentFloor !== -1) {
        setTypedValue(currentFloor.toString());
      } else {
        setTypedValue('');
      }
    }
  }, [currentValue, isPercentMode, building, percentToFloor]);

  // Handle keyboard events for even faster physical input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        handleApply();
        return;
      }

      if (isPercentMode) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          appendDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleClear();
        }
      } else {
        // Floor mode typing support
        if (/^[0-9\-]$/.test(e.key)) {
          e.preventDefault();
          setTypedValue(prev => {
            const next = prev + e.key;
            const floorNum = Number(next);
            if (!isNaN(floorNum) && floors.includes(floorNum)) {
              setTempValue(floorToPercent(floorNum, building));
            }
            return next;
          });
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setTypedValue(prev => {
            const next = prev.slice(0, -1);
            if (next === '' || next === '-') {
              setTempValue(0);
            } else {
              const floorNum = Number(next);
              if (!isNaN(floorNum) && floors.includes(floorNum)) {
                setTempValue(floorToPercent(floorNum, building));
              }
            }
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [typedValue, isPercentMode, floors, building, floorToPercent]);

  const appendDigit = (digit: string) => {
    setTypedValue(prev => {
      let nextStr = prev === '0' ? digit : prev + digit;
      let val = Number(nextStr);
      if (isNaN(val)) return prev;
      if (val > 100) {
        val = 100;
        nextStr = '100';
      }
      setTempValue(val);
      return nextStr;
    });
  };

  const handleBackspace = () => {
    setTypedValue(prev => {
      const nextStr = prev.slice(0, -1);
      const val = nextStr === '' ? 0 : Number(nextStr);
      setTempValue(val);
      return nextStr;
    });
  };

  const handleClear = () => {
    setTypedValue('');
    setTempValue(0);
  };

  const handleApply = () => {
    onSave(tempValue);
  };

  const handlePreset = (val: number) => {
    setTempValue(val);
    if (val === -1) {
      setTypedValue('');
    } else {
      if (isPercentMode) {
        setTypedValue(val.toString());
      } else {
        const fl = percentToFloor(val, building);
        setTypedValue(fl !== -1 ? fl.toString() : '');
      }
    }
  };

  const handleFloorClick = (floor: number) => {
    const pct = floorToPercent(floor, building);
    setTempValue(pct);
    setTypedValue(floor.toString());
  };

  // Compute text rendering for the header/preview
  const getDisplayValueText = (val: number) => {
    if (val === -1) return 'N/A';
    if (val === 0) return '대기 (0%)';
    if (val === 1) return '진행 (1%)';
    if (val === 100) return '완료 (100%)';
    
    if (isPercentMode) return `${val}%`;
    return `${formatFloor(percentToFloor(val, building))} (${val}%)`;
  };

  const bgModal = isIndustrial ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800';
  const buttonBg = isIndustrial ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200';
  const accentColor = isIndustrial ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[500] flex items-center justify-center p-4 no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={`w-full max-w-md ${bgModal} rounded-3xl shadow-2xl border-2 overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isIndustrial ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isIndustrial ? 'bg-emerald-950/50 text-emerald-400' : 'bg-blue-50 text-blue-600'}`}>
              {isPercentMode ? <Percent className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">{building.name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{processName.replace(/^\d+\.\s*/, '')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
          </button>
        </div>

        {/* Value Display and Real-time Progress Bar */}
        <div className={`p-6 border-b flex flex-col gap-3 ${isIndustrial ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50/30'}`}>
          <div className="flex items-end justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">진행 상태 설정</span>
            <span className={`text-xl font-black ${tempValue === 100 ? 'text-green-500' : (tempValue === -1 ? 'text-slate-400' : 'text-blue-500')}`}>
              {getDisplayValueText(tempValue)}
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
            {tempValue !== -1 && (
              <motion.div 
                className={`h-full ${tempValue === 100 ? 'bg-green-500' : accentColor}`}
                animate={{ width: `${tempValue}%` }}
                transition={{ duration: 0.2 }}
              />
            )}
          </div>
        </div>

        {/* Content Tabs (Numeric Keypad or Grid Selector) */}
        <div className="p-6 flex-1 flex flex-col gap-4">
          {isPercentMode ? (
            // NUMERIC KEYPAD INPUT
            <div className="grid grid-cols-4 gap-4">
              {/* Left 3x4 Grid */}
              <div className="col-span-3 grid grid-cols-3 gap-2">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(digit => (
                  <button
                    key={digit}
                    onClick={() => appendDigit(digit)}
                    className={`h-12 text-lg font-black rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${buttonBg}`}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="h-12 text-sm font-black rounded-xl border flex items-center justify-center transition-all bg-red-50 hover:bg-red-100 text-red-600 border-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/30"
                >
                  C
                </button>
                <button
                  onClick={() => appendDigit('0')}
                  className={`h-12 text-lg font-black rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${buttonBg}`}
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className={`h-12 text-lg font-black rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${buttonBg}`}
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Right Side Presets Column */}
              <div className="col-span-1 flex flex-col gap-2">
                <button
                  onClick={() => handlePreset(-1)}
                  className={`py-2 text-[10px] font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === -1 ? accentColor : buttonBg}`}
                >
                  N/A
                </button>
                <button
                  onClick={() => handlePreset(0)}
                  className={`py-2 text-[10px] font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 0 ? accentColor : buttonBg}`}
                >
                  0%
                </button>
                <button
                  onClick={() => handlePreset(25)}
                  className={`py-2 text-[10px] font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 25 ? accentColor : buttonBg}`}
                >
                  25%
                </button>
                <button
                  onClick={() => handlePreset(50)}
                  className={`py-2 text-[10px] font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 50 ? accentColor : buttonBg}`}
                >
                  50%
                </button>
                <button
                  onClick={() => handlePreset(75)}
                  className={`py-2 text-[10px] font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 75 ? accentColor : buttonBg}`}
                >
                  75%
                </button>
                <button
                  onClick={() => handlePreset(100)}
                  className={`py-2 text-[10px] font-black rounded-xl border-t-2 flex items-center justify-center transition-all ${tempValue === 100 ? 'bg-green-500 text-white' : buttonBg}`}
                >
                  100%
                </button>
              </div>
            </div>
          ) : (
            // FLOOR GRID SELECTOR
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">해당 동의 전체 층 목록</span>
              <div className="max-h-[220px] overflow-y-auto pr-1 grid grid-cols-4 gap-2 custom-scrollbar">
                {/* N/A & Wait blocks */}
                <button
                  onClick={() => handlePreset(-1)}
                  className={`h-11 text-xs font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === -1 ? accentColor : buttonBg}`}
                >
                  N/A
                </button>
                <button
                  onClick={() => handlePreset(0)}
                  className={`h-11 text-xs font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 0 ? accentColor : buttonBg}`}
                >
                  대기
                </button>
                <button
                  onClick={() => handlePreset(1)}
                  className={`h-11 text-xs font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 1 ? accentColor : buttonBg}`}
                >
                  진행
                </button>
                <button
                  onClick={() => handlePreset(100)}
                  className={`h-11 text-xs font-black rounded-xl border flex items-center justify-center transition-all ${tempValue === 100 ? 'bg-green-500 text-white' : buttonBg}`}
                >
                  완료
                </button>

                {/* Actual floors */}
                {floors.map(floor => {
                  const pct = floorToPercent(floor, building);
                  const isSelected = tempValue === pct;
                  return (
                    <button
                      key={floor}
                      onClick={() => handleFloorClick(floor)}
                      className={`h-11 text-xs font-black rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isSelected ? accentColor : buttonBg}`}
                    >
                      {formatFloor(floor)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-5 border-t flex items-center gap-3 ${isIndustrial ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors uppercase tracking-tight text-slate-400 dark:text-slate-500"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            className={`flex-1 py-3 text-sm font-black rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg ${
              tempValue === 100 
                ? 'bg-green-500 text-white shadow-green-500/20 hover:bg-green-600' 
                : (isIndustrial ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 text-white')
            }`}
          >
            <Check className="w-4 h-4" />
            적용하기
          </button>
        </div>
      </motion.div>
    </div>
  );
};
