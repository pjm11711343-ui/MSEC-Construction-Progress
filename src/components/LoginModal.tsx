/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, ShieldCheck, Lock, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

interface LoginModalProps {
  onLogin: (role: UserRole) => void;
  adminPassword?: string;
}

export default function LoginModal({ onLogin, adminPassword = '4714' }: LoginModalProps) {
  const [password, setPassword] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<UserRole | null>(null);
  const [error, setError] = React.useState('');

  const handleLogin = () => {
    if (password === adminPassword) {
      if (selectedRole) {
        onLogin(selectedRole);
      }
    } else {
      setError('비밀번호가 틀렸습니다.');
      setPassword('');
    }
  };

  const selectRole = (role: UserRole) => {
    if (role === 'FIELD') {
      onLogin('FIELD');
    } else if (role === 'GUEST') {
      onLogin('GUEST');
    } else {
      setSelectedRole('ADMIN');
      setPassword('');
      setError('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="bg-slate-900 p-8 text-white text-center">
          <h2 className="text-2xl font-black tracking-tight tracking-wider">현장 공정 통합 시스템</h2>
          <p className="text-slate-400 mt-2 text-sm font-semibold">어떤 보안 등급으로 접속하시겠습니까?</p>
        </div>

        <div className="p-8 space-y-4">
          <div className="space-y-3">
            {/* ADMIN Role Button */}
            <button
              onClick={() => selectRole('ADMIN')}
              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                selectedRole === 'ADMIN' 
                  ? 'border-blue-600 bg-blue-50/50 text-blue-900' 
                  : 'border-slate-100 hover:border-slate-200 text-slate-700 bg-white shadow-sm'
              }`}
            >
              <div className={`p-3 rounded-xl ${selectedRole === 'ADMIN' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold text-sm block">관리자 모드</span>
                <span className="text-xs text-slate-400 font-semibold">동별 관리, 설정 변경, 현장 제어 (비밀번호 검증 필요)</span>
              </div>
            </button>

            {/* FIELD Role Button */}
            <button
              onClick={() => selectRole('FIELD')}
              className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-all flex items-center gap-4 text-left bg-white shadow-sm group"
            >
              <div className="p-3 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold text-sm block group-hover:text-slate-900">현장 관리인 모드</span>
                <span className="text-xs text-slate-400 font-semibold text-wrap">현장 별 공정율 업데이트, 기상정보 확인 및 공정일 기록</span>
              </div>
            </button>

            {/* GUEST Role Button (Read Only) */}
            <button
              onClick={() => selectRole('GUEST')}
              className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-all flex items-center gap-4 text-left bg-white shadow-sm group"
            >
              <div className="p-3 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                <Eye className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold text-sm block group-hover:text-slate-900">외부인 / 게스트 모드 (조회 전용)</span>
                <span className="text-xs text-slate-400 font-semibold block">공정율 조회, 기상청 예측 정보 및 자재 예정표 실시간 모니터링</span>
              </div>
            </button>
          </div>

          <AnimatePresence>
            {selectedRole === 'ADMIN' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-4 border-t border-slate-100"
              >
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">관리자 비밀번호 입력</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    autoFocus
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

                <button
                  onClick={handleLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200"
                >
                  로그인
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
