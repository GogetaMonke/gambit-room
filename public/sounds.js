// All three sound effects are synthesized on the fly with the browser's
// Web Audio API, rather than loaded from audio files — no assets to
// download or manage, and it keeps this a plain-JS project with zero
// binary dependencies.

let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone({ freq, duration, type = 'sine', gain = 0.2, glideTo = null }) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (glideTo !== null) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
  }
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playMoveClick() {
  tone({ freq: 920, duration: 0.06, type: 'triangle', gain: 0.15 });
}

export function playCaptureThud() {
  tone({ freq: 180, duration: 0.2, type: 'square', gain: 0.25, glideTo: 80 });
}

export function playCheckTone() {
  tone({ freq: 1200, duration: 0.16, type: 'sine', gain: 0.2 });
  setTimeout(() => tone({ freq: 1500, duration: 0.16, type: 'sine', gain: 0.18 }), 100);
}
