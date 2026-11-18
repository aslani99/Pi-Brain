let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let ambientOscillators: OscillatorNode[] = [];
let ambientGain: GainNode | null = null;
let ambientStarted = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  audioContext ??= new AudioContextClass();
  if (!masterGain || !masterCompressor) {
    masterGain = audioContext.createGain();
    masterCompressor = audioContext.createDynamicsCompressor();
    // Protect against overlapping tones while preserving a strong output level.
    masterCompressor.threshold.setValueAtTime(-5, audioContext.currentTime);
    masterCompressor.knee.setValueAtTime(4, audioContext.currentTime);
    masterCompressor.ratio.setValueAtTime(12, audioContext.currentTime);
    masterCompressor.attack.setValueAtTime(0.001, audioContext.currentTime);
    masterCompressor.release.setValueAtTime(0.12, audioContext.currentTime);
    masterGain.gain.setValueAtTime(1, audioContext.currentTime);
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
  return audioContext;
}

/** Original synthesized UI tones routed through a shared peak-control bus. */
export function playUiSound(kind: "tap" | "select" | "success" = "tap") {
  const ctx = getContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const frequencies = kind === "success" ? [660, 880, 1108] : kind === "select" ? [520, 780] : [420];
  // Near full-scale synthesized UI sound; dynamics control handles overlap.
  const peak = kind === "success" ? 0.68 : kind === "select" ? 0.62 : 0.72;
  const outputBus = masterGain;

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const startAt = now + index * 0.045;
    oscillator.type = kind === "success" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + (kind === "success" ? 0.28 : 0.11));
    oscillator.connect(envelope);
    envelope.connect(outputBus);
    oscillator.start(startAt);
    oscillator.stop(startAt + (kind === "success" ? 0.3 : 0.13));
  });
}

/** Loud ambient synth, adjusted for the limited low-frequency response of phone speakers. */
export function startAmbientMusic() {
  const ctx = getContext();
  if (!ctx || !masterGain || ambientStarted) return;

  ambientStarted = true;
  ambientGain = ctx.createGain();
  ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.76, ctx.currentTime + 1.8);
  ambientGain.connect(masterGain);

  // Higher-register harmonics project better on small mobile speakers.
  [220, 329.63, 440].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    voiceGain.gain.value = index === 1 ? 0.25 : 0.30;
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
  window.setTimeout(() => nodes.forEach((node) => {
    try { node.stop(); } catch { /* Already stopped. */ }
  }), 260);

  ambientOscillators = [];
  ambientStarted = false;
  ambientGain = null;
}
