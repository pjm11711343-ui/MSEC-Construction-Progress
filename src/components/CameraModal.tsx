import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraModalProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('카메라를 시작할 수 없습니다. 권한을 확인해 주세요.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col h-full md:h-auto md:max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            현장 사진 촬영
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-medium">{error}</p>
              <button 
                onClick={startCamera}
                className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm"
              >
                다시 시도
              </button>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-8 pb-12 flex items-center justify-center gap-8 bg-slate-800/50 backdrop-blur-xl">
          {capturedImage ? (
            <>
              <button 
                onClick={handleRetry}
                className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-white"
              >
                <RefreshCw className="w-8 h-8" />
              </button>
              <button 
                onClick={handleConfirm}
                className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/30 text-white"
              >
                <Check className="w-10 h-10" />
              </button>
            </>
          ) : (
            <button 
              onClick={handleCapture}
              disabled={!!error || !stream}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
            >
              <div className="w-16 h-16 border-4 border-slate-900 rounded-full flex items-center justify-center">
                <div className="w-12 h-12 bg-slate-900 rounded-full" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
