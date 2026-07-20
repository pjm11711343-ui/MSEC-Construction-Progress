import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';

interface ProcessMemoCellProps {
  processName: string;
  value: string;
  disabled: boolean;
  onChange: (val: string) => void;
  isDarkTheme: boolean;
}

export const ProcessMemoCell: React.FC<ProcessMemoCellProps> = ({
  processName,
  value,
  disabled,
  onChange,
  isDarkTheme
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with parent value updates when not active
  useEffect(() => {
    if (status === 'idle') {
      setLocalValue(value);
    }
  }, [value, status]);

  // Handle auto-grow height
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [localValue]);

  // Handle window resizing or layout shifts to keep height synced
  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);

    // Clear existing timers
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    // Start saving animation state
    setStatus('saving');

    // Debounce to simulate save completion
    debounceTimerRef.current = setTimeout(() => {
      setStatus('saved');
      
      // Transition back to idle after showing "saved" status
      savedTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, 1500);
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Determine border and shadow styling based on status
  let borderClass = '';
  let shadowClass = '';

  if (status === 'saving') {
    borderClass = isDarkTheme 
      ? 'border-blue-500 ring-2 ring-blue-900/40' 
      : 'border-blue-500 ring-2 ring-blue-100';
    shadowClass = 'shadow-[0_0_10px_rgba(59,130,246,0.2)] animate-pulse';
  } else if (status === 'saved') {
    borderClass = isDarkTheme 
      ? 'border-emerald-500 ring-2 ring-emerald-950/40' 
      : 'border-emerald-500 ring-2 ring-emerald-100';
    shadowClass = 'shadow-[0_0_10px_rgba(16,185,129,0.2)]';
  } else {
    borderClass = isDarkTheme 
      ? 'border-slate-700 hover:border-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' 
      : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  }

  return (
    <div className="relative w-full h-full flex flex-col justify-center px-1 py-1 group/memo">
      <div className="relative flex items-center w-full">
        <textarea
          ref={textareaRef}
          value={localValue}
          disabled={disabled}
          onChange={handleChange}
          placeholder={disabled ? '' : "메모 입력..."}
          rows={1}
          className={`w-full text-[10px] p-1.5 border rounded-lg resize-none leading-relaxed transition-all duration-300 outline-none ${borderClass} ${shadowClass} ${
            isDarkTheme 
              ? 'bg-slate-900/60 text-slate-100 placeholder-slate-600' 
              : 'bg-white text-slate-900 placeholder-slate-400'
          } print:border-none print:bg-transparent print:p-0 print:text-xs print:font-bold`}
          style={{ minHeight: '28px', maxHeight: '160px' }}
        />
        
        {/* Status indicator badge/icon inside the cell */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none no-print">
          <AnimatePresence mode="wait">
            {status === 'saving' && (
              <motion.div
                key="saving-icon"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="flex items-center justify-center bg-blue-500 text-white rounded-full p-0.5 shadow-md"
              >
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              </motion.div>
            )}
            {status === 'saved' && (
              <motion.div
                key="saved-icon"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="flex items-center justify-center bg-emerald-500 text-white rounded-full p-0.5 shadow-md"
              >
                <Check className="w-2.5 h-2.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
