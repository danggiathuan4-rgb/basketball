/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synthesize sounds using browser's AudioContext (zero assets loading required)
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSound(type: 'made' | 'miss' | 'perfect' | 'buzzer' | 'tick') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'made':
        // Crisp high-pitch retro synth beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now); // E5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'miss':
        // Soft punchy thud
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(80, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;

      case 'perfect':
        // Digital fan-fare rising chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.setValueAtTime(0.18, now + 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;

      case 'buzzer':
        // Simulated stadium horn buzzer (multiple oscillators for heavy fat tone)
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now); // A2
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(111.5, now); // Detuned
        
        osc3.type = 'sawtooth';
        osc3.frequency.setValueAtTime(220, now); // Octave
        
        const buzzerGain = ctx.createGain();
        osc.connect(buzzerGain);
        osc2.connect(buzzerGain);
        osc3.connect(buzzerGain);
        buzzerGain.connect(ctx.destination);
        
        buzzerGain.gain.setValueAtTime(0.25, now);
        buzzerGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        
        osc.start(now);
        osc2.start(now);
        osc3.start(now);
        
        osc.stop(now + 1.2);
        osc2.stop(now + 1.2);
        osc3.stop(now + 1.2);
        break;
        
      case 'tick':
        // Subtle analog clock click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
    }
  } catch (e) {
    console.warn('Audio Context is blocked or not supported on this browser', e);
  }
}
