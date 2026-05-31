/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppState, BuildingData } from '../types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ShieldCheck } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ReportPrintViewProps {
  data: AppState;
  sortedProcesses: string[];
}

const ReportPrintView: React.FC<ReportPrintViewProps> = ({ data, sortedProcesses }) => {
  // Helper to format progress text consistently with App.tsx logic
  const getProgressText = (val: number, b: BuildingData, p: string) => {
    if (val === -1) return '-';
    if (val === 100) return '완료';
    if (val === 0) return '대기';
    if (val === 1) return '진행';
    
    const mode = data.settings.processModes?.[p] || data.settings.progressMode || 'floor';
    if (mode === 'floor') {
      const min = b.minFloor !== undefined ? b.minFloor : data.settings.minFloor;
      const max = b.maxFloor !== undefined ? b.maxFloor : data.settings.maxFloor;
      const floors = [];
      for (let f = min; f <= max; f++) {
        if (f !== 0) floors.push(f);
      }
      
      if (floors.length === 0) return '1층';
      const adjustedPercent = (Math.max(5, Math.min(95, val)) - 5) / 90;
      const idx = Math.round(adjustedPercent * (floors.length - 1));
      const f = floors[idx];
      if (f === 999) return "지붕층";
      if (f < 0) return `지하${Math.abs(f)}층`;
      return `${f}층`;
    }
    
    return `${val}%`;
  };

  const getMaterialProgressText = (val: number, b: BuildingData, p: string) => {
    if (val === -1) return '-';
    if (val === 100) return '입고완료';
    if (val === 0) return '자재미입고';
    if (val === 1) return '진행중';
    
    const mode = data.settings.processModes?.[p] || data.settings.progressMode || 'floor';
    if (mode === 'floor') {
      const min = b.minFloor !== undefined ? b.minFloor : data.settings.minFloor;
      const max = b.maxFloor !== undefined ? b.maxFloor : data.settings.maxFloor;
      const floors = [];
      for (let f = min; f <= max; f++) {
        if (f !== 0) floors.push(f);
      }
      
      if (floors.length === 0) return '1층';
      const adjustedPercent = (Math.max(5, Math.min(95, val)) - 5) / 90;
      const idx = Math.round(adjustedPercent * (floors.length - 1));
      const f = floors[idx];
      if (f === 999) return "지붕층";
      if (f < 0) return `지하${Math.abs(f)}층`;
      return `${f}층`;
    }
    
    return `${val}%`;
  };

  const today = format(new Date(), 'yyyy년 MM월 dd일', { locale: ko });

  // Limit columns to ensure readability in A4 portrait
  // If there are many processes, we take the first 10
  const displayProcesses = sortedProcesses.slice(0, 10);

  // Prepare Radar Chart Data
  const radarData = displayProcesses.map(p => {
    const entry: any = {
      subject: p.replace(/^\d+\.\s*/, ''),
      fullMark: 100,
    };
    data.buildings.forEach(b => {
      // Use process value, default to 0 if not set or -1
      entry[b.name] = b.processes[p] === -1 ? 0 : (b.processes[p] ?? 0);
    });
    return entry;
  });

  const chartColors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#4f46e5', '#db2777', '#059669'];

  return (
    <div className="bg-white p-8 max-w-[210mm] mx-auto min-h-[297mm] shadow-lg print:shadow-none print:p-0 print:m-0 print:max-w-none report-print-container">
      {/* Report Header */}
      <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">최종 공정 현황 보고서</h1>
          <p className="text-sm text-slate-500 font-bold mt-1 uppercase tracking-wider">Construction Progress Report</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Output Date</p>
          <p className="text-lg font-black text-slate-900">{today}</p>
        </div>
      </div>

      {/* Project Overview */}
      <div className="mb-8">
        <h2 className="text-xs font-black text-slate-900 mb-3 bg-slate-900 text-white px-3 py-1 inline-block uppercase tracking-[0.2em]">01. Project Info</h2>
        <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 p-3 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">현장명</span>
            <span className="text-xs font-black text-slate-800">{data.settings.projectName}</span>
          </div>
          <div className="bg-slate-50 p-3 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">시공사</span>
            <span className="text-xs font-black text-slate-800">{data.settings.companyName}</span>
          </div>
          <div className="bg-slate-50 p-3 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">공사 기간</span>
            <span className="text-xs font-black text-slate-800">{data.settings.startDate} ~ {data.settings.endDate || '-'}</span>
          </div>
          <div className="bg-slate-50 p-3 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">관리 인원</span>
            <span className="text-xs font-black text-slate-800">{data.settings.managerName} (소장) / {data.settings.staffName} (공무)</span>
          </div>
        </div>
      </div>

      {/* Progress & Material Status Data Table */}
      <div className="mb-8">
        <h2 className="text-xs font-black text-slate-900 mb-3 bg-slate-900 text-white px-3 py-1 inline-block uppercase tracking-[0.2em]">02. Construction & Material Progress</h2>
        <div className="overflow-hidden border border-slate-300 rounded-lg">
          <table className="w-full text-[8px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-300 p-1.5 w-8 text-center font-black">No.</th>
                <th className="border border-slate-300 p-1.5 w-14 text-center font-black">동 명칭</th>
                {displayProcesses.map(p => (
                  <th key={p} className="border border-slate-300 p-1.5 text-center font-black">
                    {p.replace(/^\d+\.\s*/, '')}
                  </th>
                ))}
                <th className="border border-slate-300 p-1.5 w-12 text-center font-black bg-slate-200">평균</th>
              </tr>
            </thead>
            <tbody>
              {data.buildings.map((b, idx) => {
                const processValues = (Object.values(b.processes) as number[]).filter(v => v !== -1);
                const avg = sortedProcesses.length > 0 && processValues.length > 0 
                  ? Math.round(processValues.reduce((a, v) => a + v, 0) / processValues.length) 
                  : 0;

                return (
                  <tr key={b.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="border border-slate-200 p-1.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="border border-slate-200 p-1.5 text-center font-black text-slate-900">{b.name}</td>
                    {displayProcesses.map(p => {
                      const val = b.processes[p] ?? 0;
                      const mProgress = b.materialProcesses?.[p] ?? 0;
                      const mDate = b.materialDates?.[p];
                      
                      return (
                        <td key={p} className="border border-slate-200 p-1.5 text-center leading-tight">
                          {/* Construction Progress */}
                          <div className={`mb-1 pb-1 border-b border-dashed border-slate-200 font-black ${val === 100 ? 'text-blue-600' : val === -1 ? 'text-slate-300' : 'text-slate-800'}`}>
                            <span className="text-[7px] text-slate-400 block mb-0.5 opacity-50 font-bold">공정</span>
                            {getProgressText(val, b, p)}
                          </div>
                          
                          {/* Material Progress */}
                          <div className={`font-bold pb-0.5 ${mProgress === 100 ? 'text-amber-600' : mProgress === -1 ? 'text-slate-300' : 'text-slate-500'}`}>
                            <span className="text-[7px] text-amber-500/50 block mb-0.5 font-bold uppercase">자재</span>
                            {getMaterialProgressText(mProgress, b, p)}
                            {mDate && (
                              <div className="text-[6px] text-slate-300 font-bold mt-0.5">{mDate}</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 p-1.5 text-center font-black bg-slate-50 text-blue-700">{avg}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sortedProcesses.length > 10 && (
          <p className="text-[8px] text-slate-400 mt-2 italic">* 지면 관계상 주요 공정 10개만 표시되었습니다. 전체 현황은 시스템을 확인하십시오.</p>
        )}
      </div>

      {/* Radar Chart Analysis */}
      <div className="mb-8 break-inside-avoid">
        <h2 className="text-xs font-black text-slate-900 mb-3 bg-slate-900 text-white px-3 py-1 inline-block uppercase tracking-[0.2em]">03. Comparative Progress Analysis (Radar)</h2>
        <div className="border border-slate-200 rounded-lg bg-white p-4 h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: '#64748b', fontSize: 8, fontWeight: 700 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 100]} 
                tick={{ fill: '#cbd5e1', fontSize: 8 }}
                axisLine={false}
              />
              {data.buildings.map((b, idx) => (
                <Radar
                  key={b.id}
                  name={b.name}
                  dataKey={b.name}
                  stroke={chartColors[idx % chartColors.length]}
                  fill={chartColors[idx % chartColors.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend 
                wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 900 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Construction Completion Status */}
      <div className="mb-8">
        <h2 className="text-xs font-black text-slate-900 mb-3 bg-blue-600 text-white px-3 py-1 inline-block uppercase tracking-[0.2em]">04. Construction Completion Status</h2>
        <div className="grid grid-cols-2 gap-4">
          {data.buildings.map(b => {
            const completedProcesses = sortedProcesses.filter(p => b.processes[p] === 100);
            if (completedProcesses.length === 0) return null;
            
            return (
              <div key={b.id} className="border border-blue-100 rounded-lg p-3 bg-blue-50/30">
                <div className="flex items-center justify-between mb-2 border-b border-blue-100 pb-1">
                  <span className="text-[10px] font-black text-blue-900">{b.name} 동</span>
                  <span className="text-[8px] font-bold text-blue-500">{completedProcesses.length}개 공정 완료</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {completedProcesses.map(p => (
                    <span key={p} className="bg-blue-600 text-white text-[7px] px-1.5 py-0.5 rounded-sm font-black whitespace-nowrap">
                      {p.replace(/^\d+\.\s*/, '')}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {data.buildings.every(b => !sortedProcesses.some(p => b.processes[p] === 100)) && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-[10px] text-slate-400 font-bold">
            현재 완료된 공종이 없습니다.
          </div>
        )}
      </div>

      {/* Specific Notes */}
      <div className="mb-12">
        <h2 className="text-xs font-black text-slate-900 mb-3 bg-slate-900 text-white px-3 py-1 inline-block uppercase tracking-[0.2em]">05. Special Notes</h2>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg min-h-[120px] text-[10px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
          {data.dashboardNotes || '본 현장의 주요 이슈 및 특이사항이 기술되는 공간입니다. 현재 등록된 특이사항이 없습니다.'}
        </div>
      </div>

      {/* Signature & Approval Block */}
      <div className="mt-auto pt-10 border-t-2 border-slate-100 grid grid-cols-2 gap-12">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewer</span>
            <span className="text-xs font-black text-slate-800">공무 담당: {data.settings.staffName}</span>
          </div>
          <div className="h-32 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
            {data.approval.staffSigned ? (
               <>
                 <div className="absolute inset-0 flex items-center justify-center opacity-10">
                   <ShieldCheck className="w-20 h-20 text-blue-600" />
                 </div>
                 <div className="relative z-10 w-24 h-24 border-4 border-blue-600/40 rounded-full flex items-center justify-center text-blue-600 font-black text-lg rotate-12 uppercase tracking-tighter shadow-sm bg-white/40">
                   VERIFIED
                   <p className="absolute bottom-2 text-[8px] font-black">{today}</p>
                 </div>
               </>
            ) : (
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Awaiting Signature</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approver</span>
            <span className="text-xs font-black text-slate-800">현장 소장: {data.settings.managerName}</span>
          </div>
          <div className="h-32 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
            {data.approval.managerSigned ? (
               <>
                 <div className="absolute inset-0 flex items-center justify-center opacity-10">
                   <ShieldCheck className="w-20 h-20 text-red-600" />
                 </div>
                 <div className="relative z-10 w-24 h-24 border-4 border-red-600/40 rounded-full flex items-center justify-center text-red-600 font-black text-lg -rotate-12 uppercase tracking-tighter shadow-sm bg-white/40">
                   APPROVED
                   <p className="absolute bottom-2 text-[8px] font-black">{today}</p>
                 </div>
               </>
            ) : (
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Awaiting Signature</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-16 text-center text-[8px] text-slate-300 font-black uppercase tracking-[0.4em]">
        MSEC Smart Construction Management Platform
      </div>
    </div>
  );
};

export default ReportPrintView;
