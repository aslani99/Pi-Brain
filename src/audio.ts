let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let ambientAudio: HTMLAudioElement | null = null;
let ambientSource: MediaElementAudioSourceNode | null = null;
let ambientGain: GainNode | null = null;
let ambientStarted = false;
let musicVolume = 0.20;
const SFX_VOLUME = 0.9;

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

  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => undefined);
  }

  return audioContext;
}

function createEnvelope(
  ctx: AudioContext,
  destination: AudioNode,
  startAt: number,
  peak: number,
  attack = 0.015,
  release = 0.2,
) {
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

  const output = masterGain;
  const now = ctx.currentTime;

  if (kind === "tap") {
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(430, now + 0.08);

    const envelope = createEnvelope(ctx, output, now, SFX_VOLUME, 0.008, 0.1);
    oscillator.connect(envelope);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
    return;
  }

  if (kind === "select") {
    const notes = [440, 554.37, 659.25];
    notes.forEach((frequency, index) => {
      const startAt = now + index * 0.04;
      const oscillator = ctx.createOscillator();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      const envelope = createEnvelope(ctx, output, startAt, SFX_VOLUME, 0.01, 0.16);
      oscillator.connect(envelope);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    });
    return;
  }

  if (kind === "wrong") {
    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.setValueAtTime(392, now);
    low.frequency.exponentialRampToValueAtTime(300, now + 0.22);
    const lowEnv = createEnvelope(ctx, output, now, SFX_VOLUME, 0.01, 0.24);
    low.connect(lowEnv);

    const high = ctx.createOscillator();
    high.type = "triangle";
    high.frequency.setValueAtTime(466.16, now + 0.012);
    high.frequency.exponentialRampToValueAtTime(349.23, now + 0.24);
    const highEnv = createEnvelope(ctx, output, now + 0.012, SFX_VOLUME * 0.7, 0.01, 0.26);
    high.connect(highEnv);

    low.start(now);
    high.start(now + 0.012);
    low.stop(now + 0.26);
    high.stop(now + 0.29);
    return;
  }

  const successNotes = [523.25, 659.25, 783.99, 1046.5];
  successNotes.forEach((frequency, index) => {
    const startAt = now + index * 0.05;
    const oscillator = ctx.createOscillator();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    const envelope = createEnvelope(ctx, output, startAt, SFX_VOLUME, 0.012, 0.24 + index * 0.015);
    oscillator.connect(envelope);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.28 + index * 0.015);
  });
}

function getAmbientAudio() {
  if (typeof window === "undefined") return null;
  if (!ambientAudio) {
    ambientAudio = new Audio(`${import.meta.env.BASE_URL}assets/quiz-ambient.mp3`);
    ambientAudio.loop = true;
    ambientAudio.preload = "auto";
  }
  return ambientAudio;
}

function connectAmbientAudio(ctx: AudioContext, audio: HTMLAudioElement) {
  if (ambientGain && ambientSource) return;
  try {
    // Use an actual gain node: iOS may ignore HTMLAudioElement.volume entirely.
    const source = ambientSource ?? ctx.createMediaElementSource(audio);
    const gain = ambientGain ?? ctx.createGain();
    gain.gain.setValueAtTime(musicVolume, ctx.currentTime);
    if (!ambientSource) source.connect(gain);
    if (!ambientGain) gain.connect(ctx.destination);
    ambientSource = source;
    ambientGain = gain;
    audio.volume = 1; // The Web Audio node, not the media element, controls the volume.
  } catch {
    // Fallback for older embedded browsers without MediaElementAudioSourceNode.
    audio.volume = musicVolume;
  }
}

export function setAmbientMusicVolume(value: number) {
  if (!Number.isFinite(value)) return;
  musicVolume = Math.min(1, Math.max(0, value));
  if (ambientGain && audioContext) {
    ambientGain.gain.setTargetAtTime(musicVolume, audioContext.currentTime, 0.012);
  } else if (ambientAudio) {
    ambientAudio.volume = musicVolume;
  }
}

export function startAmbientMusic() {
  const ctx = getContext();
  const audio = getAmbientAudio();
  if (!audio) return;

  if (ctx) connectAmbientAudio(ctx, audio);
  else audio.volume = musicVolume;

  if (ambientStarted && !audio.paused) return;
  ambientStarted = true;
  void audio.play().catch(() => { ambientStarted = false; });
}

export function stopAmbientMusic() {
  const audio = ambientAudio;
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  ambientStarted = false;
}
