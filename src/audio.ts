let audioContext: AudioContext | null = null;
let ambientOscillators: OscillatorNode[] = [];
let ambientGain: GainNode | null = null;
let ambientStarted = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

/** A small original synthesized UI sound; no external audio files are required. */
export function playUiSound(kind: "tap" | "select" | "success" = "tap") {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const frequencies = kind === "success" ? [660, 880, 1108] : kind === "select" ? [520, 780] : [420];
  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind === "success" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.045);
    gain.gain.setValueAtTime(0.0001, now + index * 0.045);
    gain.gain.exponentialRampToValueAtTime(kind === "success" ? 0.055 : 0.025, now + index * 0.045 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.045 + (kind === "success" ? 0.28 : 0.11));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + index * 0.045);
    oscillator.stop(now + index * 0.045 + (kind === "success" ? 0.3 : 0.13));
  });
}

/** Starts a very quiet, original ambient synth pad after the first user gesture. */
export function startAmbientMusic() {
  const ctx = getContext();
  if (!ctx || ambientStarted) return;
  ambientStarted = true;
  ambientGain = ctx.createGain();
  ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 1.8);
  ambientGain.connect(ctx.destination);
  [110, 164.81, 220].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    voiceGain.gain.value = index === 1 ? 0.22 : 0.32;
    oscillator.connect(voiceGain);
    voiceGain.connect(ambientGain!);
    oscillator.start();
    ambientOscillators.push(oscillator);
  });
}

export function stopAmbientMusic() {
  if (!audioContext || !ambientGain || !ambientStarted) return;
  const now = audioContext.currentTime;
  ambientGain.gain.cancelScheduledValues(now);
  ambientGain.gain.setValueAtTime(Math.max(ambientGain.gain.value, 0.0001), now);
  ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  const nodes = [...ambientOscillators];
  window.setTimeout(() => nodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } }), 260);
  ambientOscillators = [];
  ambientStarted = false;
  ambientGain = null;
}
