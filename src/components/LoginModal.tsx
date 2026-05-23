/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, ShieldCheck, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

interface LoginModalProps {
  onLogin: (role: UserRole) => void;
}

export default function LoginModal({ onLogin }: LoginModalProps) {
  const [password, setPassword] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<UserRole | null>(null);
  const [error, setError] = React.useState('');

  const handleLogin = () => {
    if (password === '1111') {
      if (selectedRole) {
        onLogin(selectedRole);
      }
    } else {
      setError('비밀번호가 틀렸습니다.');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-slate-900 p-8 text-white text-center">
          <h2 className="text-2xl font-bold tracking-tight">현장 관리 시스템</h2>
          <p className="text-slate-400 mt-2 text-sm">접속 권한을 선택하고 비밀번호를 입력하세요.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedRole('ADMIN')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                selectedRole === 'ADMIN' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-slate-100 hover:border-slate-200 text-slate-500'
              }`}
            >
              <ShieldCheck className="w-8 h-8" />
              <span className="font-semibold text-sm">관리자 모드</span>
            </button>
            <button
              onClick={() => setSelectedRole('FIELD')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                selectedRole === 'FIELD' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-slate-100 hover:border-slate-200 text-slate-500'
              }`}
            >
              <User className="w-8 h-8" />
              <span className="font-semibold text-sm">현장 모드</span>
            </button>
          </div>

          <AnimatePresence>
            {selectedRole && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    autoFocus
                    placeholder="비밀번호 입력 (초기: 1111)"
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
