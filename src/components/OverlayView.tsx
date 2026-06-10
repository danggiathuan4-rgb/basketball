/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MatchState } from '../types';
import { countShootoutScore } from './ScoreCalculation';
import { AnimatePresence, motion } from 'motion/react';
import { Trophy, Star, ShieldAlert, Award, Clock } from 'lucide-react';

interface OverlayProps {
  state: MatchState;
  onRefresh: () => void;
}

export default function OverlayView({ state, onRefresh }: OverlayProps) {
  // Local polling state to capture continuous updates
  const [localState, setLocalState] = useState<MatchState>(state);
  const [lastScore, setLastScore] = useState<number>(0);
  
  // Celebration triggers
  const [showPerfectCelebration, setShowPerfectCelebration] = useState(false);
  const [perfectRackNum, setPerfectRackNum] = useState<number | null>(null);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);
  const [showTimerEnd, setShowTimerEnd] = useState(false);

  const prevTriggerRef = useRef<string | null>(null);

  // Sync prop state to local
  useEffect(() => {
    setLocalState(state);
  }, [state]);

  // Handle live calculation values
  const scoreStats = countShootoutScore(localState.shots);

  // Trigger animations based on action triggers broadcast by the server
  useEffect(() => {
    if (localState.celebrationTrigger && localState.celebrationTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = localState.celebrationTrigger;
      
      const triggerString = localState.celebrationTrigger;
      
      if (triggerString.startsWith('perfect-')) {
        // Extract rack number
        const parts = triggerString.split('-');
        const rackVal = parseInt(parts[1], 10);
        setPerfectRackNum(isNaN(rackVal) ? null : rackVal + 1);
        setShowPerfectCelebration(true);
        setTimeout(() => setShowPerfectCelebration(false), 4000);
      } else if (triggerString.startsWith('end-') || triggerString.startsWith('complete-')) {
        setShowTimerEnd(true);
        setTimeout(() => setShowTimerEnd(false), 4500);
      } else if (triggerString.startsWith('manual_perfect')) {
        setPerfectRackNum(null);
        setShowPerfectCelebration(true);
        setTimeout(() => setShowPerfectCelebration(false), 4000);
      } else if (triggerString.startsWith('manual_fireworks')) {
        setShowWinnerCelebration(true);
        setTimeout(() => setShowWinnerCelebration(false), 5000);
      }
    }
  }, [localState.celebrationTrigger]);

  // Keep track of score increases to spark dynamic count bumps
  useEffect(() => {
    if (scoreStats.totalScore > lastScore) {
      // Score went up! Check if it reached max score for ultimate celebration
      if (scoreStats.totalScore === 30) {
        setShowWinnerCelebration(true);
        setTimeout(() => setShowWinnerCelebration(false), 6000);
      }
      setLastScore(scoreStats.totalScore);
    } else if (scoreStats.totalScore === 0) {
      setLastScore(0);
    }
  }, [scoreStats.totalScore]);

  // Continuous high-frequency polling against `/api/state` for smooth real-time stream sync (500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
    }, 500);

    return () => clearInterval(interval);
  }, [onRefresh]);

  // Chroma key classes
  const keyColors = {
    transparent: 'bg-transparent',
    green: 'bg-[#00FF00]', // Standard Chroma Key green
    blue: 'bg-[#0000FF]', // Standard Chroma Key blue
    black: 'bg-slate-950',
  };

  const themeColors = {
    orange: {
      accent: 'text-orange-400',
      badge: 'bg-orange-500 border-orange-400 text-slate-950',
      glow: 'shadow-orange-500/20 shadow-lg',
      border: 'border-orange-500/30',
      bgGlow: 'from-orange-500/20 to-transparent',
      textGlow: 'drop-shadow-[0_2px_8px_rgba(249,115,22,0.4)]',
      progressBall: 'bg-gradient-to-tr from-orange-600 to-amber-400 border-orange-300',
    },
    red: {
      accent: 'text-red-400',
      badge: 'bg-red-500 border-red-400 text-slate-950',
      glow: 'shadow-red-500/20 shadow-lg',
      border: 'border-red-500/30',
      bgGlow: 'from-red-500/20 to-transparent',
      textGlow: 'drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]',
      progressBall: 'bg-gradient-to-tr from-red-600 to-rose-400 border-red-300',
    },
    blue: {
      accent: 'text-blue-400',
      badge: 'bg-blue-500 border-blue-400 text-slate-950',
      glow: 'shadow-blue-500/20 shadow-lg',
      border: 'border-blue-500/30',
      bgGlow: 'from-blue-500/20 to-transparent',
      textGlow: 'drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]',
      progressBall: 'bg-gradient-to-tr from-blue-600 to-cyan-400 border-blue-300',
    },
    purple: {
      accent: 'text-indigo-400',
      badge: 'bg-indigo-600 border-indigo-400 text-white',
      glow: 'shadow-indigo-500/20 shadow-lg',
      border: 'border-indigo-500/30',
      bgGlow: 'from-indigo-500/20 to-transparent',
      textGlow: 'drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]',
      progressBall: 'bg-gradient-to-tr from-indigo-600 to-purple-400 border-indigo-300',
    },
    emerald: {
      accent: 'text-emerald-400',
      badge: 'bg-emerald-500 border-emerald-400 text-slate-950',
      glow: 'shadow-emerald-500/20 shadow-lg',
      border: 'border-emerald-500/30',
      bgGlow: 'from-emerald-500/20 to-transparent',
      textGlow: 'drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]',
      progressBall: 'bg-gradient-to-tr from-emerald-600 to-teal-400 border-emerald-300',
    },
  };

  const currentTheme = themeColors[localState.themeColor || 'orange'];

  const layout = localState.overlayLayout || 'lower-third';
  const showDetails = localState.showRackDetails !== false;
  const showStandings = localState.showStandingsOnOverlay === true;
  const glow = localState.glowEffects !== false;
  const scale = localState.overlayScale !== undefined ? localState.overlayScale : 1.0;
  const sponsor = localState.sponsorText || '';

  // Calculate top 3 standings
  const topStandings = [...(localState.players || [])]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.timeLeft - a.timeLeft;
    })
    .slice(0, 3);

  // General wrapper inline scale
  const containerStyle = {
    transform: `scale(${scale})`,
    transformOrigin: layout === 'scorebug' ? 'top left' : layout === 'stadium' ? 'center' : 'bottom center',
    width: layout === 'scorebug' ? 'auto' : '100%',
    maxWidth: layout === 'scorebug' ? '460px' : 'none',
  };

  return (
    <div 
      className={`fixed inset-0 overflow-hidden flex ${
        layout === 'scorebug' 
          ? 'items-start justify-start p-6' 
          : layout === 'stadium' 
          ? 'items-center justify-center p-8' 
          : 'items-end justify-center p-8'
      } text-white font-sans ${keyColors[localState.chromaKey || 'transparent']}`}
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      
      {/* PERFECT RACK FLYING CELEBRATION BUBBLE */}
      <AnimatePresence>
        {showPerfectCelebration && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.7, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -100 }}
            transition={{ type: 'spring', damping: 15 }}
            className="absolute inset-x-0 top-1/4 mx-auto max-w-lg bg-slate-950/95 border-2 border-yellow-500 rounded-3xl p-6 shadow-2xl shadow-yellow-500/20 text-center flex flex-col items-center gap-2.5 z-50 backdrop-blur-md"
          >
            {/* Spinning Star Chime */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="w-14 h-14 bg-gradient-to-tr from-yellow-500 to-amber-300 rounded-full flex items-center justify-center text-slate-950 shadow-lg"
            >
              <Star className="w-8 h-8 fill-current" />
            </motion.div>
            
            <h2 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-200 to-yellow-500 tracking-wide uppercase">
              PERFECT RACK!
            </h2>
            <p className="text-sm font-semibold text-slate-300 font-mono">
              {perfectRackNum ? `VĐV ném trúng tuyệt đối 3/3 tại Vị Trí ${perfectRackNum}!` : 'VĐV đã ném trúng tuyệt đối cả 3 quả!'}
            </p>
            <div className="bg-yellow-500 text-slate-950 text-xs font-black font-mono px-3 py-1 rounded-full uppercase tracking-wider shadow">
              +3 ĐIỂM THƯỞNG BONUS 🌟
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WINNER MAX SCORE OR MANUAL FIREWORKS CELEBRATION */}
      <AnimatePresence>
        {showWinnerCelebration && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 m-auto flex flex-col items-center justify-center bg-slate-950/90 gap-4 z-50 text-center"
          >
            {/* Confetti particles */}
            <div className="absolute inset-0 pointer-events-none opacity-50 flex flex-wrap gap-8 items-center justify-center">
              {Array(30).fill(null).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    y: [0, 500], 
                    x: [0, (i % 2 === 0 ? 100 : -100)],
                    rotate: [0, 360],
                    scale: [1, 0] 
                  }}
                  transition={{ duration: 3 + Math.random() * 2, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-yellow-400"
                  style={{ backgroundColor: ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6'][i % 5] }}
                />
              ))}
            </div>

            <div className="w-20 h-20 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center shadow-2xl shadow-yellow-500/30 scale-125 animate-bounce">
              <Trophy className="w-12 h-12 stroke-[2.5]" />
            </div>
            <h1 className="text-6xl font-display font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-white to-amber-500 uppercase drop-shadow">
              KỶ LỤC HOÀN HẢO!
            </h1>
            <p className="text-xl text-slate-300 max-w-md font-medium px-4">
              Thành tích không tưởng! VĐV vừa đạt mốc điểm số tối đa với màn trình diễn tuyệt vời!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUZZER END / SHOT COMPLETED OVERLAY */}
      <AnimatePresence>
        {showTimerEnd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-x-0 top-1/3 mx-auto max-w-sm bg-red-600 border border-red-500/40 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center gap-2 z-50 animate-pulse"
          >
            <ShieldAlert className="w-12 h-12 text-slate-100 animate-spin" />
            <h2 className="text-4xl font-display font-black text-white tracking-widest uppercase">
              HẾT GIỜ!
            </h2>
            <p className="text-xs font-semibold text-red-100 uppercase tracking-widest font-mono">
              TIME&apos;S UP - ROUND COMPLETE
            </p>
            <div className="mt-2 bg-slate-950 text-slate-100 text-sm font-black font-mono px-4 py-1.5 rounded-full uppercase tracking-wider">
              Thành tích: {scoreStats.totalScore} Điểm
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTH THE SCOREBOARD AND OPTIONAL MINI-STANDING GRAPHICS */}
      <div 
        style={containerStyle} 
        className={`transition-all duration-300 flex ${
          layout === 'stadium' 
            ? 'flex-col items-center justify-center max-w-3xl w-full' 
            : 'w-full max-w-7xl'
        } ${layout === 'lower-third' ? 'flex-col gap-3.5' : 'flex-row gap-5'}`}
      >
        
        {/* STANDINGS LIVE PREVIEW COLUMN (Left/Right depending on layout) */}
        {showStandings && layout !== 'scorebug' && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className={`bg-slate-950/95 border-2 border-slate-800 rounded-3xl p-4 w-72 shrink-0 backdrop-blur-md flex flex-col gap-3 ${
              glow ? 'shadow-xl shadow-slate-950/50 border-indigo-500/20' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-[11px] font-bold tracking-wider text-slate-200 uppercase font-mono">
                BẢNG XẾP HẠNG TOP 3
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {topStandings.length === 0 ? (
                <div className="text-[10px] text-slate-500 italic text-center py-2">Chưa ghi nhận thành tích</div>
              ) : (
                topStandings.map((p, idx) => {
                  const colors = [
                    'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
                    'text-slate-300 bg-slate-300/10 border-slate-300/20',
                    'text-amber-600 bg-amber-600/10 border-amber-600/20'
                  ];
                  return (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between p-2 rounded-xl border bg-slate-900/40 ${
                        p.id === localState.activePlayerId ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black border ${colors[idx] || 'text-slate-500 bg-slate-800 border-slate-700'}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-100 uppercase truncate leading-tight">{p.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{p.team}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pr-1">
                        <div className="text-sm font-mono font-black text-slate-100">{p.score}đ</div>
                        <div className="text-[8px] font-mono text-slate-400">{p.timeLeft}s</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== 1. LAYOUT: LOWER THIRD (THANH NGANG ĐÁY CHUẨN) ==================== */}
        {layout === 'lower-third' && (
          <div className="w-full flex flex-col gap-3 relative">
            <div id="hud-top-tray" className="flex items-center justify-between px-4">
              <div className={`bg-slate-950/90 border border-slate-800 rounded-full px-4 py-1 flex items-center gap-2 shadow backdrop-blur-md ${glow ? 'shadow-indigo-500/5' : ''}`}>
                <div className={`w-2 h-2 rounded-full bg-${localState.themeColor || 'orange'}-500 animate-pulse shadow shadow-orange-500/50`}></div>
                <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase font-mono">
                  {localState.tournamentName || '3-POINT SHOOTOUT TOURNAMENT'}
                </span>
              </div>

              {sponsor && (
                <div className="bg-slate-950/90 border border-slate-800 rounded-full px-4 py-1 flex items-center gap-1.5 shadow backdrop-blur-md animate-pulse">
                  <Star className="w-2.5 h-2.5 text-yellow-400 animate-spin" />
                  <span className="text-[9px] font-black tracking-widest text-yellow-400 font-mono uppercase">
                    {sponsor}
                  </span>
                </div>
              )}
            </div>

            <div className={`bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-5 flex flex-wrap items-center justify-between gap-6 backdrop-blur-md relative ${
              glow ? 'shadow-slate-950/90 border-indigo-500/20' : ''
            }`}>
              <div className={`absolute left-0 bottom-0 top-0 w-1/3 bg-gradient-to-r ${currentTheme.bgGlow} pointer-events-none -z-10`}></div>
              
              {/* Profile card */}
              <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                <div className={`w-14 h-14 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-center shrink-0 ${glow ? currentTheme.glow : ''} ${currentTheme.accent}`}>
                  <Award className="w-8 h-8" />
                </div>
                <div className="min-w-0">
                  <span className={`text-[10px] font-bold tracking-widest uppercase font-mono ${currentTheme.accent}`}>Vận Động Viên</span>
                  <h1 className="text-3xl font-display font-black tracking-wide text-slate-100 leading-tight uppercase truncate">
                    {localState.playerName || 'CHƯA CHỌN VĐV'}
                  </h1>
                  <p className="text-xs font-semibold text-slate-400 font-mono tracking-wide uppercase truncate">
                    Đội tuyển: <strong className="text-slate-200">{localState.teamName || 'Tự do'}</strong>
                  </p>
                </div>
              </div>

              {/* Racks Progress (Hidden if showDetails === false) */}
              {showDetails && (
                <div className="flex items-center gap-3 flex-wrap justify-center flex-1.5">
                  {Array(5).fill(null).map((_, rIdx) => {
                    const isPerfect = scoreStats.perfectRacks[rIdx];
                    const isCurrentRack = localState.currentRack === rIdx;
                    
                    return (
                      <div 
                        key={rIdx} 
                        className={`bg-slate-950/80 border p-2 py-2.5 rounded-2xl flex flex-col items-center gap-1.5 min-w-[70px] transition ${
                          isCurrentRack 
                            ? 'border-indigo-500 scale-105 shadow shadow-indigo-500/25 ring-1 ring-indigo-500/50' 
                            : isPerfect 
                            ? 'border-yellow-500/40 bg-yellow-500/[0.03]'
                            : 'border-slate-800'
                        }`}
                      >
                        <span className={`text-[9px] font-bold font-mono uppercase tracking-widest ${
                          isCurrentRack ? 'text-indigo-400' : isPerfect ? 'text-yellow-400' : 'text-slate-500'
                        }`}>
                          RACK {rIdx + 1}
                        </span>
                        
                        <div className="flex gap-1">
                          {Array(3).fill(null).map((_, bIdx) => {
                            const made = localState.shots[rIdx] ? localState.shots[rIdx][bIdx] : null;
                            const isCurrentBall = isCurrentRack && localState.currentBall === bIdx;
                            
                            return (
                              <div
                                key={bIdx}
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                                  made === true
                                    ? `${currentTheme.progressBall} scale-110 shadow`
                                    : made === false
                                    ? 'bg-red-500/30'
                                    : 'bg-slate-900 border border-slate-755'
                                } ${isCurrentBall ? 'ring-[1.5px] ring-white animate-pulse scale-110' : ''}`}
                              >
                                {made === true ? (
                                  <span className="w-1 h-1 rounded-full bg-slate-950"></span>
                                ) : made === false ? (
                                  <span className="text-[7px] text-red-500 font-black font-mono leading-none">&times;</span>
                                ) : (
                                  <span className="w-0.5 h-0.5 rounded-full bg-slate-700"></span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-center min-h-[12px]">
                          {isPerfect ? (
                            <span className="text-[8px] font-black text-yellow-400 tracking-wider flex items-center gap-0.5 animate-bounce">
                              <Star className="w-2 h-2 fill-current" /> PERFECT
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold font-mono text-slate-500">
                              {scoreStats.rackScores[rIdx]} PTS
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Score scoreboard board */}
              <div className="flex items-center gap-4 border-l border-slate-800 pl-6 shrink-0 justify-end ml-auto">
                <div className="text-center min-w-[90px]">
                  <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-slate-400 block mb-0.5">
                    TỔNG ĐIỂM
                  </span>
                  <div className={`text-5xl font-mono font-black tracking-tight ${glow ? currentTheme.textGlow : ''} ${currentTheme.accent}`}>
                    {scoreStats.totalScore}
                  </div>
                  <span className="text-[8px] bg-slate-950 font-bold border border-slate-850 px-2 py-0.5 rounded text-yellow-500 uppercase font-mono">
                    {scoreStats.bonusPoints > 0 ? `+${scoreStats.bonusPoints} bonus` : '0 bonus'}
                  </span>
                </div>

                <div className="bg-slate-950 px-5 py-3 rounded-2xl border border-slate-850 text-center min-w-[105px] shadow-inner">
                  <span className="text-[9px] font-bold tracking-widest uppercase font-mono text-slate-550 flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-2.5 h-2.5" /> TIMER
                  </span>
                  <div className={`text-3xl font-mono font-extrabold tracking-tight ${
                    localState.timeLeft <= 10 && localState.timeLeft > 0 && localState.isTimerRunning
                      ? 'text-red-500 animate-pulse' 
                      : 'text-slate-100'
                  }`}>
                    {localState.timeLeft}s
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider block mt-0.5 ${
                    localState.isTimerRunning ? 'text-green-400 animate-pulse' : 'text-slate-550'
                  }`}>
                    {localState.isTimerRunning ? '● LIVE' : '■ STOPPED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. LAYOUT: SCOREBUG (GÓC THU NHỎ - TOP LEFT COMPACT) ==================== */}
        {layout === 'scorebug' && (
          <div className={`bg-slate-950/95 border-2 border-slate-800 rounded-2xl flex flex-col min-w-[340px] max-w-[380px] overflow-hidden backdrop-blur-md shrink-0 shadow-2xl relative ${
            glow ? 'shadow-slate-950/80 border-indigo-500/20' : ''
          }`}>
            {/* Top theme highlight bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r from-${localState.themeColor || 'orange'}-500 to-indigo-500`}></div>
            
            {/* Header info row */}
            <div className="flex justify-between items-center bg-slate-900 px-4 py-2 border-b border-slate-850">
              <span className="text-[9px] font-black text-slate-400 tracking-wider font-mono truncate uppercase mr-2">
                {localState.tournamentName || '3-POINT SHOOTOUT'}
              </span>
              {sponsor && (
                <span className="text-[8px] font-black text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded font-mono uppercase shrink-0">
                  {sponsor.split(' ')[0]} {/* shortened */}
                </span>
              )}
            </div>

            {/* Athlete row */}
            <div className="p-3.5 pb-2.5 border-b border-slate-850/60">
              <h1 className="text-xl font-display font-black tracking-wide text-slate-100 uppercase leading-none truncate">
                {localState.playerName || 'CHƯA CHỌN VĐV'}
              </h1>
              <span className={`text-[9px] font-bold font-mono tracking-widest ${currentTheme.accent} uppercase mt-1 inline-block truncate max-w-full`}>
                Đội: {localState.teamName || 'Tự do'}
              </span>
            </div>

            {/* Dynamic scores / countdown grid row */}
            <div className="grid grid-cols-2 bg-slate-900/40">
              <div className="p-3.5 border-r border-slate-850/80 text-center flex flex-col justify-center">
                <span className="text-[8px] font-black text-slate-500 tracking-wider uppercase block mb-1">SCORE</span>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className={`text-4xl font-mono font-black ${glow ? currentTheme.textGlow : ''} ${currentTheme.accent}`}>
                    {scoreStats.totalScore}
                  </span>
                  <span className="text-[9px] text-yellow-500 font-mono font-bold">
                    ({scoreStats.bonusPoints}b)
                  </span>
                </div>
              </div>

              <div className="p-3.5 text-center flex flex-col justify-center bg-slate-950">
                <span className="text-[8px] font-black text-slate-550 tracking-wider uppercase block mb-1">TIMER</span>
                <div className={`text-3xl font-mono font-bold leading-tight ${
                  localState.timeLeft <= 10 && localState.timeLeft > 0 && localState.isTimerRunning
                    ? 'text-red-500 animate-pulse'
                    : 'text-slate-100'
                }`}>
                  {localState.timeLeft}s
                </div>
                <div className="flex justify-center items-center gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${localState.isTimerRunning ? 'bg-green-400 animate-ping' : 'bg-slate-650'}`} />
                  <span className="text-[8px] font-bold text-slate-400 uppercase font-mono tracking-widest">
                    {localState.isTimerRunning ? 'ACTIVE' : 'READY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Micro rack detail balls dot row underneath (conditionally rendered) */}
            {showDetails && (
              <div className="px-3.5 py-2.5 bg-slate-950/80 border-t border-slate-850 flex items-center justify-between gap-1.5">
                <span className="text-[8px] text-slate-500 uppercase font-bold font-mono tracking-widest">
                  Rack {localState.currentRack + 1}/5
                </span>
                
                {/* 5 Racks indicator lights */}
                <div className="flex gap-1.5">
                  {Array(5).fill(null).map((_, rIdx) => {
                    const isPerfect = scoreStats.perfectRacks[rIdx];
                    const isCurrent = localState.currentRack === rIdx;
                    
                    return (
                      <div 
                        key={rIdx} 
                        className={`w-2.5 h-2.5 rounded-sm flex items-center justify-center text-[7px] font-extrabold ${
                          isCurrent 
                            ? 'bg-indigo-600 ring-1 ring-indigo-400 text-slate-100' 
                            : isPerfect 
                            ? 'bg-yellow-500 text-slate-950 shadow shadow-yellow-500/20' 
                            : scoreStats.rackScores[rIdx] > 0 
                            ? 'bg-slate-700 text-slate-300' 
                            : 'bg-slate-900 border border-slate-800'
                        }`}
                        title={`Rack ${rIdx + 1}: ${scoreStats.rackScores[rIdx]} điểm`}
                      >
                        {rIdx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 3. LAYOUT: STADIUM (BẢNG SÂN ĐẤU - LARGE CENTER SCOREBOARD) ==================== */}
        {layout === 'stadium' && (
          <div className={`bg-slate-950/95 border-2 border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 w-full max-w-2xl text-center backdrop-blur-md shrink-0 shadow-2xl relative ${
            glow ? 'shadow-slate-950/90 border-indigo-500/20' : ''
          }`}>
            
            {/* Top Logo banner or tournament header */}
            <div className="flex flex-col gap-2 border-b border-slate-850 pb-4">
              <span className={`text-[11px] font-black text-indigo-400 tracking-widest font-mono uppercase ${currentTheme.accent}`}>
                {localState.tournamentName || '3-POINT SHOOTOUT CHAMPIONSHIP'}
              </span>
              
              {sponsor && (
                <div className="mx-auto bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-0.5 text-[9px] font-extrabold text-amber-500 font-mono uppercase tracking-widest">
                  {sponsor}
                </div>
              )}
            </div>

            {/* Stadium Main score grid */}
            <div className="grid grid-cols-2 gap-4 items-center justify-center my-2">
              
              {/* Stadium Total Score */}
              <div className="flex flex-col justify-center items-center bg-slate-900/60 border border-slate-850 rounded-2xl p-5 shadow-inner">
                <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase font-mono block mb-1">
                  ĐIỂM SỐ TỔNG
                </span>
                <span className={`text-6xl md:text-7xl font-mono font-black ${glow ? currentTheme.textGlow : ''} ${currentTheme.accent}`}>
                  {scoreStats.totalScore}
                </span>
                <span className="text-[9px] font-black font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded-full mt-2 inline-block">
                  {scoreStats.bonusPoints > 0 ? `+${scoreStats.bonusPoints} bonus points` : 'No bonus racks yet'}
                </span>
              </div>

              {/* Stadium Countdown clock */}
              <div className="flex flex-col justify-center items-center bg-slate-900/80 border border-slate-850 rounded-2xl p-5 shadow-inner">
                <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase font-mono block mb-1">
                  THỜI GIAN THI ĐẤU
                </span>
                <span className={`text-5xl md:text-6xl font-mono font-black ${
                  localState.timeLeft <= 10 && localState.timeLeft > 0 && localState.isTimerRunning
                    ? 'text-red-500 animate-pulse' 
                    : 'text-slate-100'
                }`}>
                  {localState.timeLeft}s
                </span>
                
                <span className={`text-[9px] font-black tracking-widest uppercase font-mono px-3 py-1 rounded-full mt-2 inline-block ${
                  localState.isTimerRunning 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {localState.isTimerRunning ? '● LIVE TICKING' : '■ SESSION COMPLETED'}
                </span>
              </div>

            </div>

            {/* Stadium Athlete Banner row */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-850">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">
                ĐANG TRÌNH DIỄN (ATHLETE ROUND)
              </span>
              <h2 className="text-3xl font-display font-black tracking-wide text-white uppercase leading-none mt-1">
                {localState.playerName || 'CHƯA CHỌN VĐV'}
              </h2>
              <p className="text-xs text-slate-300 font-semibold tracking-wide uppercase mt-1 select-none">
                Độ tuyển: <strong className={currentTheme.accent}>{localState.teamName || 'Tự do'}</strong>
              </p>
            </div>

            {/* Miniature Balls tracking rack list (Stadium layout style) */}
            {showDetails && (
              <div className="flex gap-2.5 justify-center items-center flex-wrap pt-2">
                {Array(5).fill(null).map((_, rIdx) => {
                  const isCurrent = localState.currentRack === rIdx;
                  const score = scoreStats.rackScores[rIdx];
                  const balls = localState.shots[rIdx] || [null, null, null];
                  
                  return (
                    <div 
                      key={rIdx} 
                      className={`flex flex-col gap-1.5 p-2 rounded-xl bg-slate-900/30 border transition min-w-[90px] ${
                        isCurrent 
                          ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 scale-105' 
                          : 'border-slate-850'
                      }`}
                    >
                      <span className="text-[8px] font-mono font-bold text-slate-400">RACK {rIdx + 1}</span>
                      
                      <div className="flex gap-1 justify-center">
                        {balls.map((b, bIdx) => (
                          <span 
                            key={bIdx} 
                            className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${
                              b === true 
                                ? 'bg-orange-500 text-slate-950' 
                                : b === false 
                                ? 'bg-red-500 text-slate-100' 
                                : 'bg-slate-800'
                            }`}
                          >
                            {b === true ? '●' : b === false ? '×' : ''}
                          </span>
                        ))}
                      </div>

                      <span className={`text-[8px] font-black font-mono ${score === 6 ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {score}đ {score === 6 ? '⭐' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
