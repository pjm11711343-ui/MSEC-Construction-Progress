import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  BarChart3, 
  ChevronRight,
  Sparkles,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Droplets,
  CloudSun
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { AppState } from '../types';

interface PredictionData {
  predictedCompletionDate: string;
  delayDays: number;
  status: 'AHEAD' | 'ON_TRACK' | 'BEHIND';
  analysis: string;
  risks: { process: string; riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM'; impact: string }[];
  recommendations: string[];
}

interface AIPredictionViewProps {
  data: AppState;
  activeTheme: any;
}

const AIPredictionView: React.FC<AIPredictionViewProps> = ({ data, activeTheme }) => {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/predict-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: data }),
      });
      if (!response.ok) throw new Error('AI 분석 중 오류가 발생했습니다.');
      const result = await response.json();
      setPrediction(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prediction) {
      fetchPrediction();
    }
  }, []);

  const weatherDelays = React.useMemo(() => {
    const reports = data.dailyReports || [];
    // Thresholds for considering a day as "non-working" or "delayed"
    const DELAY_RAIN_THRESHOLD = 5; // 5mm
    const DELAY_WIND_THRESHOLD = 25; // 25km/h
    
    return reports.filter(r => 
      (r.precip !== undefined && r.precip >= DELAY_RAIN_THRESHOLD) || 
      (r.windSpeed !== undefined && r.windSpeed >= DELAY_WIND_THRESHOLD) ||
      (r.weather.includes('비') && (r.precip === undefined || r.precip === 0)) ||
      (r.weather.includes('태풍') || r.weather.includes('강풍'))
    );
  }, [data.dailyReports]);

  const weatherDelayDays = weatherDelays.length;

  const weatherAdjustedDate = React.useMemo(() => {
    if (!prediction?.predictedCompletionDate) return null;
    const date = new Date(prediction.predictedCompletionDate);
    date.setDate(date.getDate() + weatherDelayDays);
    return date.toISOString().split('T')[0];
  }, [prediction, weatherDelayDays]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AHEAD': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'BEHIND': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-rose-500';
      case 'HIGH': return 'bg-orange-500';
      default: return 'bg-amber-500';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30"
        >
          <Sparkles className="w-8 h-8 text-blue-500" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-lg font-black uppercase tracking-tight mb-2">AI 공기 예측 시뮬레이션 중</h2>
          <p className="text-slate-500 text-xs font-bold">현재 공정 데이터를 분석하여 미래 일정을 예측하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <p className="text-rose-500 font-bold">{error}</p>
        <button 
          onClick={fetchPrediction}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
        >
          다시 요청하기
        </button>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl border ${activeTheme.card} ${activeTheme.border} relative overflow-hidden`}
        >
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">AI 예측 준공일</span>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-black">{prediction.predictedCompletionDate}</h2>
              <div className={`p-1 rounded-lg ${getStatusColor(prediction.status)}`}>
                {prediction.status === 'BEHIND' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </div>
            </div>
            
            {weatherDelayDays > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase">
                  <Droplets className="w-3 h-3" /> 악천후 보정 (+{weatherDelayDays}일)
                </div>
                <h3 className="text-lg font-black text-rose-600">{weatherAdjustedDate}</h3>
                <p className="text-[9px] font-bold text-slate-700 dark:text-slate-300">강우/강풍 기록 {weatherDelayDays}회 반영됨</p>
              </div>
            )}

            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-2">
              목표 준공일 대비 <span className={prediction.delayDays + weatherDelayDays > 0 ? "text-rose-500" : "text-emerald-500"}>{Math.abs(prediction.delayDays + weatherDelayDays)}일 {prediction.delayDays + weatherDelayDays > 0 ? '지연' : '선행'}</span>
            </p>
          </div>
          <Clock className="absolute -bottom-4 -right-4 w-24 h-24 text-slate-100 opacity-5" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`p-6 rounded-3xl border ${activeTheme.card} ${activeTheme.border} relative overflow-hidden`}
        >
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">현재 공정 상태</span>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black">
                {prediction.status === 'BEHIND' ? '주의' : prediction.status === 'AHEAD' ? '우수' : '정상'}
              </h2>
              <span className={`px-2 py-1 text-[10px] font-black rounded-lg border ${getStatusColor(prediction.status)}`}>
                {prediction.status}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Critical Path 상의 리스크를 감안한 종합 지수</p>
          </div>
          <Activity className="absolute -bottom-4 -right-4 w-24 h-24 text-slate-100 opacity-5" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={`bg-blue-600 p-6 rounded-3xl border border-blue-500 shadow-xl shadow-blue-500/20 relative overflow-hidden group`}
        >
          <div className="flex flex-col gap-1 relative z-10 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">AI 권장 단축률</span>
            <h2 className="text-3xl font-black">15.5%</h2>
            <p className="text-[10px] font-bold text-blue-100 mt-2">적용 시 최대 12일 단축 가능</p>
            <button className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-[10px] font-black transition-all flex items-center gap-2 w-max">
              시나리오 적용하기 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <Zap className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10 group-hover:scale-110 transition-transform" />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Description */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className={`p-8 rounded-3xl border ${activeTheme.card} ${activeTheme.border}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-tight">AI 심층 분석 리포트</h3>
          </div>
          <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed font-medium">
            <div className="whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: prediction.analysis.replace(/\n/g, '<br/>') }} />
          </div>
        </motion.div>

        {/* Risk & Recommendations */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className={`p-8 rounded-3xl border ${activeTheme.card} ${activeTheme.border}`}
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> 식별된 핵심 리스크
            </h3>
            <div className="space-y-4">
              {prediction.risks.map((risk, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-orange-500/30 transition-all">
                  <div className={`w-1 h-full min-h-[40px] rounded-full ${getRiskColor(risk.riskLevel)}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-900">{risk.process}</span>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase text-white ${getRiskColor(risk.riskLevel)}`}>
                        {risk.riskLevel}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">{risk.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className={`p-8 rounded-3xl border ${activeTheme.card} ${activeTheme.border}`}
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-500" /> 기상 요인 공기 영향 분석
            </h3>
            {weatherDelays.length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400 italic">공기에 영향을 줄 만한 악천후 기록이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 mb-4">
                  <p className="text-[10px] font-black text-rose-600 uppercase mb-1">총 예상 지연 일수</p>
                  <div className="text-2xl font-black text-rose-700">+{weatherDelayDays}일</div>
                </div>
                <div className="max-h-[200px] overflow-auto pr-2 custom-scrollbar space-y-2">
                  {weatherDelays.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900">{r.date}</span>
                        <span className="text-[9px] font-bold text-slate-500">{r.weather}</span>
                      </div>
                      <div className="flex gap-1">
                        {r.precip! >= 5 && <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-black">비 {r.precip}mm</span>}
                        {r.windSpeed! >= 25 && <span className="text-[8px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-black">강풍 {r.windSpeed}km/h</span>}
                        {(!r.precip && r.weather.includes('비')) && <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-black">우천지연</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AIPredictionView;
