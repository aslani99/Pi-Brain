let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let ambientMasterGain: GainNode | null = null;
let ambientVoices: Array<{ oscillators: OscillatorNode[]; gains: GainNode[] }> = [];
let ambientStarted = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  audioContext ??= new AudioContextClass();
  if (!masterGain || !masterCompressor) {
    masterGain = audioContext.createGain();
    masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-14, audioContext.currentTime);
    masterCompressor.knee.setValueAtTime(18, audioContext.currentTime);
    masterCompressor.ratio.setValueAtTime(2.2, audioContext.currentTime);
    masterCompressor.attack.setValueAtTime(0.008, audioContext.currentTime);
    masterCompressor.release.setValueAtTime(0.22, audioContext.currentTime);
    masterGain.gain.setValueAtTime(1, audioContext.currentTime);
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
  return audioContext;
}

function createEnvelope(ctx: AudioContext, destination: AudioNode, startAt: number, peak: number, attack = 0.015, release = 0.2) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + release);
  gain.connect(destination);
  return gain;
}

export function playUiSound(kind: "tap" | "select" | "success" | "wrong" = "tap") {
  const ctx = getContext();
  if (!ctx || !masterGain) return;

  const outputGain: GainNode = masterGain;
  const now = ctx.currentTime;

  if (kind === "tap") {
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    const envelope = createEnvelope(ctx, outputGain, now, 0.1, 0.008, 0.1);
    oscillator.connect(envelope);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
    return;
  }

  if (kind === "select") {
    const steps = [440, 554.37, 659.25];
    steps.forEach((frequency, index) => {
      const startAt = now + index * 0.04;
      const oscillator = ctx.createOscillator();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      const envelope = createEnvelope(ctx, outputGain, startAt, 0.1, 0.01, 0.16);
      oscillator.connect(envelope);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    });
    return;
  }

  if (kind === "wrong") {
    const startAt = now;
    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.setValueAtTime(392, startAt);
    low.frequency.exponentialRampToValueAtTime(300, startAt + 0.22);
    const lowEnv = createEnvelope(ctx, outputGain, startAt, 0.1, 0.01, 0.24);
    low.connect(lowEnv);

    const high = ctx.createOscillator();
    high.type = "triangle";
    high.frequency.setValueAtTime(466.16, startAt);
    high.frequency.exponentialRampToValueAtTime(349.23, startAt + 0.24);
    const highEnv = createEnvelope(ctx, outputGain, startAt + 0.012, 0.072, 0.01, 0.26);
    high.connect(highEnv);

    low.start(startAt); high.start(startAt + 0.012);
    low.stop(startAt + 0.26); high.stop(startAt + 0.29);
    return;
  }

  const celebratory = [523.25, 659.25, 783.99, 1046.5];
  celebratory.forEach((frequency, index) => {
    const startAt = now + index * 0.05;
    const oscillator = ctx.createOscillator();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    const envelope = createEnvelope(ctx, outputGain, startAt, 0.1, 0.012, 0.24 + index * 0.015);
    oscillator.connect(envelope);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.28 + index * 0.015);
  });
}

function createAmbientVoice(ctx: AudioContext, destination: AudioNode, frequencies: number[], type: OscillatorType, gainValue: number) {
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.value = gainValue * (index === 0 ? 1 : 0.78);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    oscillators.push(oscillator);
    gains.push(gain);
  });
  return { oscillators, gains };
}

function schedulePadMotion(ctx: AudioContext, voice: { oscillators: OscillatorNode[]; gains: GainNode[] }, detuneCents: number, cycleSeconds: number) {
  const now = ctx.currentTime;
  voice.oscillators.forEach((oscillator, index) => {
    const offset = index * 0.8;
    oscillator.detune.cancelScheduledValues(now);
    oscillator.detune.setValueAtTime(-detuneCents, now + offset);
    oscillator.detune.linearRampToValueAtTime(detuneCents, now + offset + cycleSeconds * 0.5);
    oscillator.detune.linearRampToValueAtTime(-detuneCents * 0.65, now + offset + cycleSeconds);
  });
  voice.gains.forEach((gain, index) => {
    const base = gain.gain.value;
    const offset = index * 0.7;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(base * 0.92, now + offset);
    gain.gain.linearRampToValueAtTime(base * 1.08, now + offset + cycleSeconds * 0.45);
    gain.gain.linearRampToValueAtTime(base * 0.95, now + offset + cycleSeconds);
  });
}

export function startAmbientMusic() {
  const ctx = getContext();
  if (!ctx || !masterGain || ambientStarted) return;

  ambientStarted = true;
  ambientMasterGain = ctx.createGain();
  ambientMasterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  ambientMasterGain.gain.exponentialRampToValueAtTime(0.45, ctx.currentTime + 2.2);
  ambientMasterGain.connect(masterGain);

  const root = 261.63; // C4
  const padA = createAmbientVoice(ctx, ambientMasterGain, [root, root * 1.4983, root * 2], "triangle", 0.11);
  const padB = createAmbientVoice(ctx, ambientMasterGain, [root * 1.1225, root * 1.6818], "sine", 0.085);
  const shimmer = createAmbientVoice(ctx, ambientMasterGain, [root * 2.2449], "sine", 0.04);

  ambientVoices = [padA, padB, shimmer];
  schedulePadMotion(ctx, padA, 9, 9.5);
  schedulePadMotion(ctx, padB, 6, 11.5);
  schedulePadMotion(ctx, shimmer, 4, 13.5);
}

export function stopAmbientMusic() {
  if (!audioContext || !ambientMasterGain || !ambientStarted) return;
  const now = audioContext.currentTime;
  ambientMasterGain.gain.cancelScheduledValues(now);
  ambientMasterGain.gain.setValueAtTime(Math.max(ambientMasterGain.gain.value, 0.0001), now);
  ambientMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  const activeVoices = [...ambientVoices];
  window.setTimeout(() => {
    activeVoices.forEach((voice) => {
      voice.oscillators.forEach((node) => {
        try { node.stop(); } catch { /* Already stopped. */ }
      });
    });
  }, 520);

  ambientVoices = [];
  ambientStarted = false;
  ambientMasterGain = null;
}
