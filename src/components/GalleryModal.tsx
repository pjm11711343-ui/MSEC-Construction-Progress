import React from 'react';
import { X, Trash2, Maximize2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryModalProps {
  buildingName: string;
  processName: string;
  photos: string[];
  onClose: () => void;
  onDelete: (index: number) => void;
  onViewPhoto: (photo: string) => void;
}

export default function GalleryModal({ 
  buildingName, 
  processName, 
  photos, 
  onClose, 
  onDelete,
  onViewPhoto 
}: GalleryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-blue-500" />
              공정 사진 갤러리
            </h3>
            <p className="text-sm text-slate-400 font-bold">
              {buildingName} / <span className="text-blue-500">{processName}</span> / 총 {photos.length}장
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {photos.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-bold">저장된 사진이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <motion.div 
                  key={index}
                  layoutId={`photo-${index}`}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <img 
                    src={photo} 
                    alt={`Progress photo ${index + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  
                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => onViewPhoto(photo)}
                      className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110"
                      title="크게 보기"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => onDelete(index)}
                      className="p-2 bg-red-500/80 hover:bg-red-600 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-[10px] text-white font-black">
                    #{index + 1}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <button 
              onClick={onClose}
              className="px-8 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all"
            >
              닫기
            </button>
        </div>
      </motion.div>
    </div>
  );
}
