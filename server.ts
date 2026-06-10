/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { MatchState, Player } from './src/types.js';

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), 'shootout-data.json');

// Helper to calculate basketball checkout shootout score with the Perfect Rack bonus rules
function calculateScore(shots: (boolean | null)[][]): number {
  let score = 0;
  for (let r = 0; r < 5; r++) {
    let madeInRack = 0;
    for (let b = 0; b < 3; b++) {
      if (shots[r] && shots[r][b] === true) {
        madeInRack++;
        score += 1; // 1 point per regular made shot
      }
    }
    if (madeInRack === 3) {
      score += 3; // Perfect Rack Bonus (+3 points) -> total 6 points for this rack
    }
  }
  return score;
}

// Generate empty shots array (5 racks of 3 balls empty)
function createEmptyShots(): (boolean | null)[][] {
  return Array(5).fill(null).map(() => Array(3).fill(null));
}

// Initial default state
const defaultPlayers: Player[] = [
  {
    id: 'curry-gsw',
    name: 'Stephen Curry',
    team: 'Golden State Warriors',
    shots: [
      [true, true, true],  // Rack 1: Perfect (3 pts + 3 bonus = 6 pts)
      [true, false, true], // Rack 2: 2 made (2 pts)
      [true, true, true],  // Rack 3: Perfect (3 pts + 3 bonus = 6 pts)
      [false, true, true], // Rack 4: 2 made (2 pts)
      [true, true, true],  // Rack 5: Perfect (3 pts + 3 bonus = 6 pts) => Total 22 points
    ],
    timeLeft: 12,
    score: 22,
    done: true,
    createdAt: Date.now() - 300000
  },
  {
    id: 'hieu-sgb',
    name: 'Dư Minh Hiếu',
    team: 'Saigon Heat',
    shots: [
      [true, true, false],
      [true, true, true],  // Perfect Rack
      [false, true, false],
      [true, true, true],  // Perfect Rack
      [false, false, true]
    ],
    timeLeft: 5,
    score: 15,
    done: true,
    createdAt: Date.now() - 200000
  },
  {
    id: 'hung-hnb',
    name: 'Nguyễn Văn Hùng',
    team: 'Hanoi Buffaloes',
    shots: createEmptyShots(),
    timeLeft: 60,
    score: 0,
    done: false,
    createdAt: Date.now() - 100000
  }
];

let matchState: MatchState = {
  tournamentName: 'GIẢI VÔ ĐỊCH BÓNG RỔ 3-POINT SHOOTOUT',
  players: defaultPlayers,
  activePlayerId: 'hung-hnb',
  playerName: 'Nguyễn Văn Hùng',
  teamName: 'Hanoi Buffaloes',
  shots: createEmptyShots(),
  timeLeft: 60,
  isTimerRunning: false,
  duration: 60,
  currentRack: 0,
  currentBall: 0,
  lastAction: 'none',
  lastActionTimestamp: Date.now(),
  celebrationTrigger: null,
  themeColor: 'orange',
  chromaKey: 'transparent',
  overlayLayout: 'lower-third',
  showRackDetails: true,
  sponsorText: 'ĐỒNG HÀNH BỞI AI STUDIO',
  showStandingsOnOverlay: false,
  glowEffects: true,
  overlayScale: 1.0
};

// Background server-side timer to sync all clients concurrently without races
setInterval(() => {
  if (matchState.isTimerRunning) {
    if (matchState.timeLeft > 0) {
      matchState.timeLeft -= 1;
      
      // Update the active player's profile inside roster
      if (matchState.activePlayerId) {
        const pIndex = matchState.players.findIndex(p => p.id === matchState.activePlayerId);
        if (pIndex !== -1) {
          matchState.players[pIndex].timeLeft = matchState.timeLeft;
        }
      }

      // If timer completes
      if (matchState.timeLeft === 0) {
        matchState.isTimerRunning = false;
        matchState.lastAction = 'complete';
        matchState.lastActionTimestamp = Date.now();
        matchState.celebrationTrigger = 'end-' + Date.now();
        
        if (matchState.activePlayerId) {
          const pIndex = matchState.players.findIndex(p => p.id === matchState.activePlayerId);
          if (pIndex !== -1) {
            matchState.players[pIndex].done = true;
            matchState.players[pIndex].score = calculateScore(matchState.shots);
          }
        }
      }

      fs.writeFile(DATA_FILE, JSON.stringify(matchState, null, 2), (err) => {
        if (err) console.error('Error auto-saving state on tick:', err);
      });
    } else {
      matchState.isTimerRunning = false;
    }
  }
}, 1000);

// Load initial state if data-file exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(rawData);
    // Merge schema properties in case layout changed
    matchState = { ...matchState, ...parsed };
    console.log('Successfully loaded persisted state from shootout-data.json');
  } catch (error) {
    console.error('Failed to parse shootout-data.json, starting fresh', error);
  }
} else {
  // Save default state initially
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(matchState, null, 2));
  } catch (e) {
    console.error('Failed to create initial shootout-data.json', e);
  }
}

// Ensure express parses json body
app.use(express.json());

// API: Get current match state
app.get('/api/state', (req, res) => {
  res.json(matchState);
});

// API: Save entire match state
app.post('/api/state', (req, res) => {
  const newState = req.body;
  
  if (newState) {
    matchState = { ...matchState, ...newState };
    
    // Automatically keep server score calculation strictly synced
    for (let player of matchState.players) {
      player.score = calculateScore(player.shots);
    }
    
    // Write backups asynchronously to keep response fast
    fs.writeFile(DATA_FILE, JSON.stringify(matchState, null, 2), (err) => {
      if (err) console.error('Error writing state file:', err);
    });
  }
  
  res.json({ success: true, state: matchState });
});

// API: Post single shot action (for lightweight updates from overlay/controllers)
app.post('/api/action', (req, res) => {
  const { action, rack, ball, isMade } = req.body;
  const now = Date.now();
  
  if (action === 'submit_shot') {
    if (rack >= 0 && rack < 5 && ball >= 0 && ball < 3) {
      matchState.shots[rack][ball] = isMade;
      
      // Update action log for HUD animation
      if (isMade) {
        matchState.lastAction = 'made';
        // Check if perfect rack just happened
        const isPerfect = matchState.shots[rack].every(v => v === true);
        if (isPerfect) {
          matchState.lastAction = 'perfect';
          matchState.celebrationTrigger = Math.random().toString(36).substring(2, 9);
        }
      } else {
        matchState.lastAction = 'miss';
      }
      
      matchState.lastActionTimestamp = now;
      
      // Sync into the active player profile if there is an active player
      if (matchState.activePlayerId) {
        const pIndex = matchState.players.findIndex(p => p.id === matchState.activePlayerId);
        if (pIndex !== -1) {
          matchState.players[pIndex].shots = JSON.parse(JSON.stringify(matchState.shots));
          matchState.players[pIndex].timeLeft = matchState.timeLeft;
          matchState.players[pIndex].score = calculateScore(matchState.shots);
        }
      }
    }
  } else if (action === 'timer_tick') {
    const { timeLeft } = req.body;
    matchState.timeLeft = timeLeft;
    if (matchState.activePlayerId) {
      const pIndex = matchState.players.findIndex(p => p.id === matchState.activePlayerId);
      if (pIndex !== -1) {
        matchState.players[pIndex].timeLeft = timeLeft;
      }
    }
  } else if (action === 'timer_running') {
    const { isTimerRunning } = req.body;
    matchState.isTimerRunning = isTimerRunning;
  } else if (action === 'trigger_celebration') {
    const { triggerType } = req.body;
    matchState.celebrationTrigger = triggerType + '-' + now;
  }
  
  fs.writeFile(DATA_FILE, JSON.stringify(matchState, null, 2), (err) => {
    if (err) console.error('Error writing action file:', err);
  });
  
  res.json({ success: true, state: matchState });
});

// Start routing & server entry point
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Basketball Scoring & Overlay Server running on http://localhost:${PORT}`);
  });
}

startServer();
