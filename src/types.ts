/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  team: string;
  shots: (boolean | null)[][]; // 5 Racks, each has 3 balls
  timeLeft: number;
  score: number; // calculated live
  done: boolean;
  createdAt: number;
}

export interface MatchState {
  tournamentName: string;
  players: Player[];
  activePlayerId: string | null;
  
  // Active game run-time fields
  playerName: string;
  teamName: string;
  shots: (boolean | null)[][]; // 5 x 3 array
  timeLeft: number;
  isTimerRunning: boolean;
  duration: number; // typically 60 seconds
  currentRack: number; // 0 -> 4
  currentBall: number; // 0 -> 2
  
  // Real-time animation triggers for OBS Browser Source
  lastAction: 'none' | 'made' | 'miss' | 'perfect' | 'reset' | 'undo' | 'complete';
  lastActionTimestamp: number;
  celebrationTrigger: string | null; // e.g., random id to trigger confetti
  
  // Visual Customizations
  themeColor: 'orange' | 'red' | 'blue' | 'purple' | 'emerald';
  chromaKey: 'transparent' | 'green' | 'blue' | 'black';
  
  // Advanced Live Overlay Customizations
  overlayLayout: 'lower-third' | 'scorebug' | 'stadium';
  showRackDetails: boolean;
  sponsorText: string;
  showStandingsOnOverlay: boolean;
  glowEffects: boolean;
  overlayScale: number; // e.g. 0.8, 1.0, 1.2
}
