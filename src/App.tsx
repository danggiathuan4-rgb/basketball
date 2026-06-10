/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MatchState } from './types';
import ControllerView from './components/ControllerView';
import OverlayView from './components/OverlayView';
import { RotateCcw, ShieldAlert, Loader } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOverlayRoute, setIsOverlayRoute] = useState(false);

  // Check URL query parameters for view routing (e.g., ?view=overlay)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsOverlayRoute(params.get('view') === 'overlay' || params.get('overlay') === 'true');
  }, []);

  // Fetch match state from fullstack Express API
  const fetchState = useCallback(async () => {
    try {
      const response = await fetch('/api/state');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setState(data);
      if (loading) setLoading(false);
      if (error) setError(null);
    } catch (err: any) {
      console.error('Failed to sync match state:', err);
      // Wait to display errors to prevent flickering under quick connection drops
      if (loading) {
        setError('Không thể kết nối đến máy chủ bảng điểm. Vui lòng kiểm tra lại liên kết hoặc khởi động máy chủ.');
        setLoading(false);
      }
    }
  }, [loading, error]);

  // Load initial state & poll continuously for real-time multi-device sync
  useEffect(() => {
    fetchState();

    const interval = setInterval(() => {
      fetchState();
    }, 500);

    return () => clearInterval(interval);
  }, [fetchState]);

  // Sync state mutation back to Express server
  const handleUpdateState = async (newState: MatchState) => {
    // Optimistic update locally
    setState(newState);

    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newState),
      });
      if (!response.ok) {
        console.error('Server failed to record scoreboard modifications.');
      }
    } catch (err) {
      console.error('Failed to post scorecard state update:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <Loader className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-widest text-slate-400 font-mono animate-pulse uppercase">
          Khởi động Bảng Điểm Bóng Rổ...
        </p>
      </div>
    );
  }

  // Error boundary layout helper
  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 animate-bounce">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-display uppercase tracking-wide text-slate-200 mb-2">
          Mất Kết Nối Khối Điều Khiển
        </h2>
        <p className="text-xs text-slate-450 max-w-sm mb-6 leading-relaxed">
          {error || 'Không nạp được cấu hình trạng thái thi đấu.'}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchState();
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-bold px-5 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> THỬ KẾT NỐI LẠI
        </button>
      </div>
    );
  }

  // Choose viewport based on router parameters
  if (isOverlayRoute) {
    return <OverlayView state={state} onRefresh={fetchState} />;
  }

  // Default Scorer dashboard
  return <ControllerView initialState={state} onUpdateState={handleUpdateState} />;
}
