/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MatchState, Player } from '../types';
import { countShootoutScore } from './ScoreCalculation';
import { playSound } from './SoundEffects';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Award, 
  Volume2, 
  Tv, 
  UserCheck, 
  Settings, 
  Keyboard, 
  Undo, 
  Zap,
  Info
} from 'lucide-react';

interface ControllerProps {
  initialState: MatchState;
  onUpdateState: (state: MatchState) => void;
}

export default function ControllerView({ initialState, onUpdateState }: ControllerProps) {
  // Global or local sync
  const [state, setState] = useState<MatchState>(initialState);
  
  // Local quick inputs
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(true);
  
  // Timer interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const lastActionTimestampRef = useRef<number>(initialState.lastActionTimestamp);

  // Synchronize state with prop changes from external fetch
  useEffect(() => {
    setState(initialState);
    
    // Play sound feedback for remote/collaborative operator actions!
    if (initialState.lastActionTimestamp > lastActionTimestampRef.current) {
      const isMyAction = Date.now() - initialState.lastActionTimestamp < 300; // was it likely local?
      if (!isMyAction) {
        if (initialState.lastAction === 'made') {
          playSound('made');
        } else if (initialState.lastAction === 'miss') {
          playSound('miss');
        } else if (initialState.lastAction === 'perfect') {
          playSound('perfect');
        } else if (initialState.lastAction === 'complete') {
          playSound('buzzer');
        }
      }
      lastActionTimestampRef.current = initialState.lastActionTimestamp;
    }
  }, [initialState]);

  // Helper to sync local edits immediately to backend API
  const syncState = (updated: MatchState) => {
    setState(updated);
    onUpdateState(updated);
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent hotkeys if typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ': // Spacebar
        case '1':
          e.preventDefault();
          handleShotInput(true);
          break;
        case '2':
          e.preventDefault();
          handleShotInput(false);
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleUndo();
          } else {
            handleUndo();
          }
          break;
        case 'u':
          handleUndo();
          break;
        case 'p':
        case 's':
          e.preventDefault();
          toggleTimer();
          break;
        case 'r':
          if (e.shiftKey) {
            e.preventDefault();
            resetCurrentShots();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.currentRack, state.currentBall, state.shots, state.isTimerRunning, state.timeLeft, state.players, state.activePlayerId]);

  // Trigger sound countdown beep in the last 5 seconds (only play if timer is ticking)
  useEffect(() => {
    if (state.isTimerRunning && state.timeLeft <= 5 && state.timeLeft > 0) {
      playSound('tick');
    }
  }, [state.timeLeft, state.isTimerRunning]);

  const toggleTimer = () => {
    const nextRunning = !state.isTimerRunning;
    
    // Play touch/start chirp
    playSound('tick');
    
    const updated = {
      ...state,
      isTimerRunning: nextRunning
    };
    
    syncState(updated);

    // Notify server of timer run state
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'timer_running', isTimerRunning: nextRunning })
    }).catch(err => console.error(err));
  };

  const adjustTimer = (amount: number) => {
    const nextTime = Math.max(0, Math.min(300, state.timeLeft + amount));
    playSound('tick');
    const updated = {
      ...state,
      timeLeft: nextTime
    };
    syncState(updated);
    
    if (state.activePlayerId) {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timer_tick', timeLeft: nextTime })
      }).catch(err => console.error(err));
    }
  };

  // Submits a shot result for current selection
  const handleShotInput = (isMade: boolean) => {
    const { currentRack, currentBall, shots } = state;
    if (currentRack > 4) return; // Finished shooting

    // Play feedback sound
    if (isMade) {
      // Check if this makes the rack perfect
      const currentRackShots = [...shots[currentRack]];
      currentRackShots[currentBall] = true;
      const isPerfect = currentRackShots.every(b => b === true);
      
      if (isPerfect) {
        playSound('perfect');
      } else {
        playSound('made');
      }
    } else {
      playSound('miss');
    }

    // Clone shots state
    const nextShots = shots.map((r, rIdx) => 
      rIdx === currentRack ? r.map((b, bIdx) => bIdx === currentBall ? isMade : b) : [...r]
    );

    // Score calculations
    const scoreStats = countShootoutScore(nextShots);
    
    // Find next shot position
    let nextBall = currentBall + 1;
    let nextRack = currentRack;
    if (nextBall > 2) {
      nextBall = 0;
      nextRack = currentRack + 1;
    }

    // Sync to roster of active player
    let updatedPlayers = [...state.players];
    if (state.activePlayerId) {
      updatedPlayers = state.players.map(p => {
        if (p.id === state.activePlayerId) {
          return {
            ...p,
            shots: nextShots,
            score: scoreStats.totalScore,
            timeLeft: state.timeLeft
          };
        }
        return p;
      });
    }

    const updated: MatchState = {
      ...state,
      shots: nextShots,
      currentRack: nextRack,
      currentBall: nextBall,
      players: updatedPlayers,
      lastAction: isMade ? 'made' : 'miss',
      lastActionTimestamp: Date.now(),
      celebrationTrigger: scoreStats.perfectRacks[currentRack] && currentBall === 2 && isMade 
        ? 'perfect-' + currentRack + '-' + Date.now() 
        : state.celebrationTrigger
    };

    syncState(updated);

    // Call lightweight endpoint to sync status with OBS
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_shot',
        rack: currentRack,
        ball: currentBall,
        isMade: isMade
      })
    }).catch(err => console.error(err));
  };

  // Undo previous shot
  const handleUndo = () => {
    const { currentRack, currentBall, shots } = state;
    
    // Work backwards to find last ticked shot
    let prevRack = currentRack;
    let prevBall = currentBall - 1;
    
    if (prevBall < 0) {
      prevRack = currentRack - 1;
      prevBall = 2;
    }

    if (prevRack < 0) return; // Nothing to undo

    playSound('tick');

    // Revert shot to null
    const nextShots = shots.map((r, rIdx) => 
      rIdx === prevRack ? r.map((b, bIdx) => bIdx === prevBall ? null : b) : [...r]
    );

    const scoreStats = countShootoutScore(nextShots);

    let updatedPlayers = [...state.players];
    if (state.activePlayerId) {
      updatedPlayers = state.players.map(p => {
        if (p.id === state.activePlayerId) {
          return {
            ...p,
            shots: nextShots,
            score: scoreStats.totalScore
          };
        }
        return p;
      });
    }

    const updated: MatchState = {
      ...state,
      shots: nextShots,
      currentRack: prevRack,
      currentBall: prevBall,
      players: updatedPlayers,
      lastAction: 'undo',
      lastActionTimestamp: Date.now()
    };

    syncState(updated);
  };

  const selectActivePlayer = (player: Player) => {
    playSound('tick');
    const updated: MatchState = {
      ...state,
      activePlayerId: player.id,
      playerName: player.name,
      teamName: player.team,
      shots: JSON.parse(JSON.stringify(player.shots)),
      timeLeft: player.done ? 0 : state.duration,
      currentRack: 0,
      currentBall: 0,
      isTimerRunning: false,
      lastAction: 'reset',
      lastActionTimestamp: Date.now()
    };
    syncState(updated);
  };

  const markPlayerCompleted = () => {
    if (!state.activePlayerId) return;
    playSound('perfect');
    
    const scoreStats = countShootoutScore(state.shots);
    const updatedPlayers = state.players.map(p => {
      if (p.id === state.activePlayerId) {
        return {
          ...p,
          shots: JSON.parse(JSON.stringify(state.shots)),
          score: scoreStats.totalScore,
          timeLeft: state.timeLeft,
          done: true
        };
      }
      return p;
    });

    const updated: MatchState = {
      ...state,
      players: updatedPlayers,
      isTimerRunning: false,
      lastAction: 'complete',
      lastActionTimestamp: Date.now(),
      celebrationTrigger: 'complete-' + Date.now()
    };
    syncState(updated);
  };

  const resetCurrentShots = () => {
    playSound('tick');
    const cleanShots = Array(5).fill(null).map(() => Array(3).fill(null));
    
    let updatedPlayers = [...state.players];
    if (state.activePlayerId) {
      updatedPlayers = state.players.map(p => {
        if (p.id === state.activePlayerId) {
          return {
            ...p,
            shots: cleanShots,
            score: 0,
            timeLeft: state.duration,
            done: false
          };
        }
        return p;
      });
    }

    const updated: MatchState = {
      ...state,
      shots: cleanShots,
      currentRack: 0,
      currentBall: 0,
      timeLeft: state.duration,
      isTimerRunning: false,
      players: updatedPlayers,
      lastAction: 'reset',
      lastActionTimestamp: Date.now()
    };
    syncState(updated);
  };

  const createPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    playSound('tick');
    const newPlayer: Player = {
      id: 'p-' + Math.random().toString(36).substring(2, 9),
      name: newPlayerName.trim(),
      team: newPlayerTeam.trim() || 'Tự do',
      shots: Array(5).fill(null).map(() => Array(3).fill(null)),
      timeLeft: state.duration,
      score: 0,
      done: false,
      createdAt: Date.now()
    };

    const nextPlayers = [...state.players, newPlayer];
    const updated: MatchState = {
      ...state,
      players: nextPlayers,
      // Automatically make active if none is selected
      activePlayerId: state.activePlayerId ? state.activePlayerId : newPlayer.id,
      playerName: state.activePlayerId ? state.playerName : newPlayer.name,
      teamName: state.activePlayerId ? state.teamName : newPlayer.team,
      shots: state.activePlayerId ? state.shots : newPlayer.shots,
      timeLeft: state.activePlayerId ? state.timeLeft : state.duration
    };

    setNewPlayerName('');
    setNewPlayerTeam('');
    syncState(updated);
  };

  const deletePlayer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('miss');
    const filtered = state.players.filter(p => p.id !== id);
    const wasActive = state.activePlayerId === id;

    const updated: MatchState = {
      ...state,
      players: filtered,
      activePlayerId: wasActive ? null : state.activePlayerId,
      playerName: wasActive ? 'Chưa chọn' : state.playerName,
      teamName: wasActive ? '-' : state.teamName,
      shots: wasActive ? Array(5).fill(null).map(() => Array(3).fill(null)) : state.shots,
      timeLeft: wasActive ? state.duration : state.timeLeft,
      isTimerRunning: wasActive ? false : state.isTimerRunning
    };

    syncState(updated);
  };

  // OBS Overlay URL generation
  const getOverlayUrl = () => {
    return `${window.location.origin}/?view=overlay`;
  };

  const copyOverlayUrl = () => {
    navigator.clipboard.writeText(getOverlayUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    playSound('made');
  };

  const triggerManualCelebration = (type: string) => {
    playSound('perfect');
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_celebration', triggerType: type })
    }).catch(err => console.error(err));
  };

  // Computations
  const scoreBreakdown = countShootoutScore(state.shots);
  const leaderboard = [...state.players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Rank by score
    }
    return b.timeLeft - a.timeLeft; // Tiebreaker: whoever has more time remaining
  });

  // Color mappings
  const themeColors = {
    orange: 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500',
    red: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    blue: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500',
    purple: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    emerald: 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500',
  };

  const themeBorders = {
    orange: 'border-orange-500/20 text-orange-400',
    red: 'border-red-500/20 text-red-400',
    blue: 'border-blue-500/20 text-blue-400',
    purple: 'border-indigo-500/20 text-indigo-400',
    emerald: 'border-emerald-500/20 text-emerald-400',
  };

  const themeTexts = {
    orange: 'text-orange-500 dark:text-orange-400',
    red: 'text-red-500 dark:text-red-400',
    blue: 'text-blue-500 dark:text-blue-400',
    purple: 'text-indigo-500 dark:text-indigo-400',
    emerald: 'text-emerald-500 dark:text-emerald-400',
  };

  const themeHighlights = {
    orange: 'from-orange-500/10 to-transparent border-orange-500',
    red: 'from-red-500/10 to-transparent border-red-500',
    blue: 'from-blue-500/10 to-transparent border-blue-500',
    purple: 'from-indigo-500/10 to-transparent border-indigo-500',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500',
  };

  return (
    <div id="controller-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse">
            <Zap className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl tracking-wide uppercase text-slate-100">
              {state.tournamentName || '3-POINT SHOOTOUT CONTROLLER'}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-ping"></span>
              Control Room &bull; Live OBS Synchronized State
            </p>
          </div>
        </div>

        {/* Global Settings Block */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Tournament Name Input */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 max-w-xs">
            <Settings className="w-3.5 h-3.5 text-slate-500 mr-2" />
            <input 
              type="text"
              value={state.tournamentName}
              placeholder="Tên giải đấu..."
              onChange={(e) => syncState({ ...state, tournamentName: e.target.value })}
              className="bg-transparent border-none text-xs text-slate-200 outline-none w-full focus:ring-0"
            />
          </div>

          {/* Theme Color Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 gap-1">
            <span className="text-xs text-slate-400 mr-1 pl-1">Theme:</span>
            {Object.keys(themeColors).map((colorKey) => (
              <button
                key={colorKey}
                onClick={() => syncState({ ...state, themeColor: colorKey as any })}
                className={`w-3.5 h-3.5 rounded-full border transition ${
                  state.themeColor === colorKey 
                    ? 'border-white scale-125' 
                    : 'border-transparent opacity-65 hover:opacity-100'
                } ${
                  colorKey === 'orange' ? 'bg-orange-500' :
                  colorKey === 'red' ? 'bg-red-500' :
                  colorKey === 'blue' ? 'bg-blue-500' :
                  colorKey === 'purple' ? 'bg-indigo-600' : 'bg-emerald-500'
                }`}
                title={colorKey}
              />
            ))}
          </div>

          {/* Preset Custom Duration */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs gap-1.5">
            <span className="text-slate-400">Giới hạn:</span>
            {[60, 75, 90].map((dur) => (
              <button
                key={dur}
                onClick={() => {
                  playSound('tick');
                  syncState({ ...state, duration: dur, timeLeft: dur });
                }}
                className={`px-1.5 py-0.5 rounded font-mono font-bold transition ${
                  state.duration === dur 
                    ? 'bg-slate-800 text-orange-400 border border-slate-700' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {dur}s
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl w-full mx-auto">
        
        {/* Left Side: Match Control & Target Input (8/12 grid) */}
        <div id="left-section" className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Shooter Banner Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            {/* Background glowing ring */}
            <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl opacity-10 bg-${state.themeColor}-500/20`}></div>
            
            <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 ${themeTexts[state.themeColor]}`}>
                  <UserCheck className="w-8 h-8" />
                </div>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${themeTexts[state.themeColor]}`}>VĐV Ném Chính</span>
                  <h2 className="text-2xl font-display font-extrabold tracking-wide text-slate-100">
                    {state.playerName || 'CHƯA CHỌN VĐV'}
                  </h2>
                  <p className="text-sm text-slate-400 font-medium">Đội tuyển: <strong className="text-slate-200">{state.teamName || '-'}</strong></p>
                </div>
              </div>

              {/* LIVE TIMER COUNTDOWN WIDGET */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-center min-w-[140px] shadow-inner">
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block mb-1">Thời Gian</span>
                
                <div className={`text-3xl font-mono font-extrabold tracking-tight ${
                  state.timeLeft <= 10 && state.timeLeft > 0 && state.isTimerRunning
                    ? 'text-red-500 animate-pulse' 
                    : 'text-slate-100'
                }`}>
                  {state.timeLeft}s
                </div>

                {/* Subtimer Micro Timer Controls */}
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-850">
                  <button 
                    onClick={() => adjustTimer(-1)}
                    className="hover:bg-slate-800 text-slate-400 hover:text-red-400 text-[10px] font-bold px-1.5 rounded"
                    title="Giảm 1 giây"
                  >
                    -1s
                  </button>
                  <button 
                    onClick={() => adjustTimer(1)}
                    className="hover:bg-slate-800 text-slate-400 hover:text-green-400 text-[10px] font-bold px-1.5 rounded"
                    title="Tăng 1 giây"
                  >
                    +1s
                  </button>
                </div>
              </div>
            </div>

            {/* Live Play Console Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-slate-800/60 justify-between">
              <div className="flex gap-2.5">
                <button
                  onClick={toggleTimer}
                  className={`flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg transition ${
                    state.isTimerRunning
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                      : themeColors[state.themeColor]
                  }`}
                >
                  {state.isTimerRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> DỪNG TIMER
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" /> BẮT ĐẦU TIMER
                    </>
                  )}
                </button>

                <button
                  onClick={resetCurrentShots}
                  className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium text-xs px-4 py-2.5 rounded-xl transition"
                  title="Xóa kết quả ném và đặt lại thời gian về giới hạn chuẩn (Shift + R)"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> LÀM MỚI LƯỢT
                </button>
              </div>

              {state.activePlayerId && (
                <button
                  onClick={markPlayerCompleted}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow"
                  title="Chốt điểm và ghi nhận thành tích vào danh sách xếp hạng"
                >
                  <Award className="w-4 h-4 text-emerald-400" /> CHỐT ĐIỂM HOÀN THÀNH
                </button>
              )}
            </div>
          </div>

          {/* THE SHOOTOUT SPREAD GRID (Interactive Scoring Station) */}
          <div id="scoring-station" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-100 flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${themeTexts[state.themeColor]}`} /> 
                  BÀN BẤM ĐIỂM KIỂM SOÁT THỂ THỨC (5 VỊ TRÍ)
                </h3>
                <p className="text-xs text-slate-400">
                  Nhấp vào từng lượt ném trong ma trận, hoặc sử dụng các nút thao tác nhanh phía dưới.
                </p>
              </div>
              
              {/* Highlight Score Breakdown Banner */}
              <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5">
                <div className="text-center border-r border-slate-800 pr-3">
                  <div className="text-lg font-mono font-bold text-slate-200">
                    {scoreBreakdown.regularPoints}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Ném Trúng</div>
                </div>
                <div className="text-center border-r border-slate-800 pr-3">
                  <div className="text-lg font-mono font-bold text-yellow-400">
                    {scoreBreakdown.bonusPoints}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Thưởng Rack</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-mono font-extrabold ${themeTexts[state.themeColor]}`}>
                    {scoreBreakdown.totalScore}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">TỔNG ĐIỂM</div>
                </div>
              </div>
            </div>

            {/* THE GRID: 5 Racks x 3 Balls */}
            <div id="shooting-matrix" className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Array(5).fill(null).map((_, rIdx) => {
                const isRackActive = state.currentRack === rIdx;
                const isPerfect = scoreBreakdown.perfectRacks[rIdx];
                return (
                  <div 
                    key={rIdx} 
                    className={`rounded-2xl border p-4 transition bg-slate-950 flex flex-col justify-between ${
                      isRackActive 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 ring-offset-2 ring-offset-slate-950' 
                        : isPerfect 
                        ? 'border-yellow-500/50 bg-yellow-500/[0.02]'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Rack Header Info */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-850 pb-2">
                      <span className="text-xs font-bold text-slate-300">Vị Trí {rIdx + 1}</span>
                      {isPerfect ? (
                        <span className="text-[9px] bg-yellow-500/10 text-yellow-400 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-95 origin-right animate-bounce">
                          Perfect!
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {scoreBreakdown.rackScores[rIdx]} pts
                        </span>
                      )}
                    </div>

                    {/* 3 Balls Container in Rack */}
                    <div className="flex items-center justify-around gap-2 py-2">
                      {Array(3).fill(null).map((_, bIdx) => {
                        const val = state.shots[rIdx] ? state.shots[rIdx][bIdx] : null;
                        const isCurrentSelection = state.currentRack === rIdx && state.currentBall === bIdx;
                        
                        return (
                          <button
                            key={bIdx}
                            onClick={() => {
                              playSound('tick');
                              syncState({
                                ...state,
                                currentRack: rIdx,
                                currentBall: bIdx
                              });
                            }}
                            className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-mono text-xs font-extrabold relative transition-all border ${
                              val === true 
                                ? 'bg-orange-500 text-slate-950 border-orange-400 shadow shadow-orange-500/30' 
                                : val === false 
                                ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                            } ${
                              isCurrentSelection 
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110 z-10 font-bold' 
                                : ''
                            }`}
                            title={`Vị trí ${rIdx + 1} - Quả ${bIdx + 1}`}
                          >
                            <span>#{bIdx + 1}</span>
                            {/* Inner dot indicator */}
                            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                              val === true ? 'bg-slate-950' : 
                              val === false ? 'bg-red-500' : 'bg-transparent border border-slate-600'
                            }`}></span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 text-[10px] text-slate-500 text-center font-semibold uppercase tracking-wider">
                      {scoreBreakdown.rackMadeCounts[rIdx]}/3 TRÚNG
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PRIMARY QUICK SCORE ACTION STATION */}
            <div id="action-trigger-pad" className="mt-4 bg-slate-950 border border-slate-850 p-5 rounded-xl">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                <span>Bộ Nút Ghi Nhận Điểm Nhanh</span>
                <span className="text-[10px] text-slate-500 font-mono italic">Đang chọn: Vị trí {state.currentRack + 1} &bull; Quả {state.currentBall + 1}</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* SUCCESS BUTTON */}
                <button
                  onClick={() => handleShotInput(true)}
                  disabled={state.currentRack > 4}
                  className="sm:col-span-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-20 text-slate-950 font-display font-black text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition active:scale-95 shadow-lg shadow-orange-500/15 group"
                >
                  <Check className="w-6 h-6 stroke-[3] group-hover:scale-110 transition" />
                  NÉM TRÚNG (MADE)
                </button>

                {/* MISS BUTTON */}
                <button
                  onClick={() => handleShotInput(false)}
                  disabled={state.currentRack > 4}
                  className="sm:col-span-4 bg-slate-900 border border-red-500/30 hover:bg-slate-850 disabled:opacity-20 text-red-500 hover:text-red-400 font-display font-black text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition active:scale-95 shadow"
                >
                  <span className="text-xl leading-none">&times;</span>
                  NÉM TRƯỢT (MISS)
                </button>

                {/* UNDO BUTTON */}
                <button
                  onClick={handleUndo}
                  className="sm:col-span-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold text-sm py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Undo className="w-4 h-4 text-slate-400" />
                  HOÀN TÁC (UNDO)
                </button>
              </div>

              {state.currentRack > 4 && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl text-center font-medium animate-pulse">
                  🎉 Toàn bộ 15 cú ném đã được ghi nhận thành công! Nhấp &apos;Chốt điểm hoàn thành&apos; để lưu kết quả.
                </div>
              )}
            </div>
            
            {/* Keyboard Shortcuts Helper */}
            <div className="border-t border-slate-800/60 pt-4 flex items-center justify-between flex-wrap gap-2 text-xs">
              <button 
                onClick={() => setShowHotkeysHelp(!showHotkeysHelp)}
                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1.5"
                aria-expanded={showHotkeysHelp}
              >
                <Keyboard className="w-4 h-4" /> 
                {showHotkeysHelp ? 'Ẩn phím tắt bàn phím' : 'Hiện cài đặt phím tắt bàn phím'}
              </button>
              
              <div className="text-slate-500 text-[11px] select-none">
                Mẹo: Nên kích hoạt Timer khi giải thi đấu bắt đầu để tính thời gian chính xác
              </div>
            </div>

            {showHotkeysHelp && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-950 p-4 rounded-xl text-[11px] text-slate-400 font-mono border border-slate-850">
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border border-slate-700 shadow shadow-inner">Space</kbd> / <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">1</kbd>
                  <span>: Ném trúng</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">2</kbd>
                  <span>: Ném trượt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">Z</kbd>
                  <span>: Hoàn tác (Undo)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">P</kbd> / <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">S</kbd>
                  <span>: Play/Pause Timer</span>
                </div>
              </div>
            )}
          </div>
          
          {/* OBS / LIVE STREAM INTEGRATION & CUSTOMIZATION PANEL */}
          <div id="obs-integration" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-base text-slate-100 flex items-center gap-2">
                <Tv className="w-5 h-5 text-indigo-400" /> CÀI ĐẶT & TÙY CHỈNH GIAO DIỆN HIỂN THỊ TRÊN LIVE (OBS)
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded border border-slate-750">
                PRO OVERLAY v2.3
              </span>
            </div>
            
            <p className="text-xs text-slate-400">
              Hãy sao chép liên kết nguồn dưới đây và dán làm <strong>&ldquo;Browser Source&rdquo;</strong> trong OBS Studio. Mọi thay đổi về điểm số, thời gian, giao diện sẽ được đồng bộ hóa tức thì sang màn hình livestream.
            </p>

            {/* Link Copy Widget */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 pl-3">
              <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-mono mr-2">
                OBS LINK
              </span>
              <input 
                type="text" 
                readOnly 
                value={getOverlayUrl()}
                className="bg-transparent border-none text-xs text-indigo-400 outline-none w-full font-mono cursor-pointer"
                onClick={copyOverlayUrl}
              />
              <button
                onClick={copyOverlayUrl}
                className="bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 text-xs text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ml-2 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> ĐÃ COPIED
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> SAO CHÉP
                  </>
                )}
              </button>
            </div>

            {/* LIVE CUSTOMIZATION HUB */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-950 p-4 rounded-xl border border-slate-850">
              
              {/* Layout & Style settings */}
              <div className="flex flex-col gap-3.5">
                <div>
                  <span className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wide">
                    🎨 Chọn Bố Cục Hiển Thị
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'lower-third', label: 'Thanh Ngang Đáy', desc: 'Lower Third' },
                      { id: 'scorebug', label: 'Góc Thu Nhỏ', desc: 'Scorebug' },
                      { id: 'stadium', label: 'Bảng Sân Đấu', desc: 'Big Stadium' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          playSound('tick');
                          syncState({ ...state, overlayLayout: mode.id as any });
                        }}
                        className={`p-2 rounded-lg border text-center transition duration-150 flex flex-col justify-center items-center gap-0.5 ${
                          state.overlayLayout === mode.id
                            ? 'bg-indigo-500/15 border-indigo-500 text-white shadow shadow-indigo-500/10'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        <span className="text-[11px] font-bold block">{mode.label}</span>
                        <span className="text-[8px] font-mono opacity-50 block uppercase">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5 uppercase tracking-wide">
                    🏷️ Dòng Chữ Tài Trợ / Quảng Cáo (Sponsor)
                  </label>
                  <input
                    type="text"
                    value={state.sponsorText || ''}
                    onChange={(e) => syncState({ ...state, sponsorText: e.target.value })}
                    placeholder="VD: ĐỒNG HÀNH BỞI AI STUDIO"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                    Chữ chạy hoặc nháy nhẹ ở góc bảng điểm.
                  </span>
                </div>
              </div>

              {/* Toggles and Scale settings */}
              <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-5 pt-4 md:pt-0">
                <div>
                  <span className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wide">
                    ⚙️ Tùy Chọn Chi Tiết
                  </span>
                  
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={state.showRackDetails}
                        onChange={(e) => {
                          playSound('tick');
                          syncState({ ...state, showRackDetails: e.target.checked });
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                      />
                      <span className="group-hover:text-slate-100 transition">Hiển thị chi tiết từng bóng ném (5 Racks)</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={state.showStandingsOnOverlay}
                        onChange={(e) => {
                          playSound('tick');
                          syncState({ ...state, showStandingsOnOverlay: e.target.checked });
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                      />
                      <span className="group-hover:text-slate-100 transition">Kèm Bảng xếp hạng Top 3 bên cạnh</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={state.glowEffects}
                        onChange={(e) => {
                          playSound('tick');
                          syncState({ ...state, glowEffects: e.target.checked });
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                      />
                      <span className="group-hover:text-slate-100 transition">Kích hoạt hiệu ứng phát sáng Neon Cyber</span>
                    </label>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 text-xs font-bold text-slate-300 uppercase tracking-wide">
                    <span>📐 Tỷ Lệ Kích Thước</span>
                    <span className="text-indigo-400 font-mono">{(state.overlayScale * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.25"
                    step="0.05"
                    value={state.overlayScale || 1.0}
                    onChange={(e) => syncState({ ...state, overlayScale: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>Nhỏ (75%)</span>
                    <span>Chuẩn (100%)</span>
                    <span>To (125%)</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Calibration & Manual Broadcast Triggers */}
            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-semibold mr-1">Tông nền OBS Overlay (Chroma Key):</span>
                {['transparent', 'green', 'blue', 'black'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => syncState({ ...state, chromaKey: key as any })}
                    className={`px-2 py-1 rounded capitalize text-[11px] font-bold border transition duration-150 ${
                      state.chromaKey === key
                        ? 'bg-slate-800 text-indigo-400 border-indigo-500/50'
                        : 'bg-slate-950 text-slate-500 border-slate-850 hover:text-slate-300'
                    }`}
                  >
                    {key === 'transparent' ? 'Trong suốt' : key === 'green' ? 'Green-key' : key === 'blue' ? 'Blue-key' : 'Đen'}
                  </button>
                ))}
              </div>

              {/* Debug Test Actions for Stream Producer */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium mr-1">Chạy thử hiệu ứng trên OBS:</span>
                <button
                  type="button"
                  onClick={() => triggerManualCelebration('manual_perfect')}
                  className="bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 border border-amber-500/30 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                >
                  ⭐ PERFECT RACK
                </button>
                <button
                  type="button"
                  onClick={() => triggerManualCelebration('manual_fireworks')}
                  className="bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/30 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                >
                  🎆 PHÁO HOA THẮNG CUỘC
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Roster & Standings Leaderboard (4/12 grid) */}
        <div id="right-section" className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Athlete Roster Management */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="font-display font-bold text-base text-slate-100 flex items-center gap-2">
              <Plus className={`w-5 h-5 ${themeTexts[state.themeColor]}`} /> THÊM VĐV ĐĂNG KÝ
            </h3>
            
            <form onSubmit={createPlayer} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Họ và Tên VĐV</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Nguyễn Văn A..."
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Đội Tuyển / CLB</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Hanoi Buffaloes..."
                  value={newPlayerTeam}
                  onChange={(e) => setNewPlayerTeam(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <button
                type="submit"
                className={`w-full font-bold text-xs py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${themeColors[state.themeColor]}`}
              >
                <Plus className="w-4 h-4" /> ĐĂNG KÝ VĐV
              </button>
            </form>
          </div>

          {/* Player Selection & Administration list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl max-h-[300px] overflow-y-auto">
            <h3 className="font-display font-bold text-base text-slate-100 flex items-center gap-2 sticky top-0 bg-slate-900 pb-2 z-10 border-b border-slate-800">
              <UserCheck className="w-5 h-5 text-slate-400" /> DANH SÁCH THI ĐẤU ({state.players.length})
            </h3>

            <div className="flex flex-col gap-2">
              {state.players.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-xs italic">
                  Chưa có VĐV nào được thêm. Hãy đăng ký ở trên!
                </div>
              ) : (
                state.players.map((p) => {
                  const isActive = state.activePlayerId === p.id;
                  const currentTotalScore = countShootoutScore(p.shots).totalScore;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => selectActivePlayer(p)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 text-left group hover:scale-[1.01] ${
                        isActive 
                          ? 'border-indigo-500 bg-indigo-500/[0.04]' 
                          : p.done
                          ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
                          : 'border-slate-800/80 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400 animate-ping' : p.done ? 'bg-slate-600' : 'bg-slate-400'}`}></div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs text-slate-200 truncate group-hover:text-white transition">
                            {p.name}
                          </h4>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {p.team}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`font-mono text-xs font-black ${isActive ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {p.done ? p.score : currentTotalScore} pts
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono italic block">
                            {p.done ? `Kết thúc (${p.timeLeft}s)` : 'Chưa ném'}
                          </span>
                        </div>
                        
                        <button
                          onClick={(e) => deletePlayer(p.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 p-1 rounded hover:bg-slate-900 transition"
                          title="Xóa VĐV này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Real-time STANDINGS / LEADERBOARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="font-display font-bold text-base text-yellow-500 flex items-center gap-2">
              <Award className="w-5 h-5" /> BẢNG XẾP HẠNG CHUNG CUỘC
            </h3>
            
            <p className="text-[10px] text-slate-500">
              Xếp hạng ưu tiên theo Tổng điểm và Thời gian thừa tối ưu làm tiêu chí phụ.
            </p>

            <div className="rounded-xl overflow-hidden border border-slate-850 bg-slate-950 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2.5 px-3">Hạng</th>
                    <th className="py-2.5 px-2">VĐV</th>
                    <th className="py-2.5 px-2 text-center">Điểm</th>
                    <th className="py-2.5 px-3 text-center">T.g còn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-medium">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 px-3 text-center text-slate-600 italic">
                        Chưa ghi nhận thành tích nào.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((p, idx) => {
                      const isTop3 = idx < 3;
                      const hasCompleted = p.done;
                      
                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-900/40 transition ${
                            state.activePlayerId === p.id ? 'bg-indigo-500/[0.02]' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {idx === 0 ? '👑 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-2">
                            <span className="font-semibold text-slate-200 block truncate max-w-[120px]" title={p.name}>
                              {p.name}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate block max-w-[120px]">
                              {p.team}
                            </span>
                          </td>
                          <td className={`py-2.5 px-2 text-center font-mono font-black ${
                            hasCompleted ? 'text-yellow-400' : 'text-slate-400'
                          }`}>
                            {p.score}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                            {p.timeLeft}s
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed font-mono">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong>Perfect Rack Bonus Rules:</strong> Nếu ném trúng cả 3 quả ở 1 vị trí, VĐV được thưởng thêm +3 điểm. (Tổng tối đa 30đ).
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Page Footer */}
      <footer className="border-t border-slate-850 bg-slate-950 py-3 text-center text-xs text-slate-600 font-mono mt-auto select-none">
        Bảng Điểm Bóng Rổ Shootout OBS &bull; Developed safely behind HTTPS/OBS local pipeline
      </footer>
    </div>
  );
}
