import { useCallback, useRef, useState } from "react";

export type SoundType = "click" | "win" | "lose" | "cash" | "tick" | "countdown";

const MUTE_KEY = "winwave_muted";

function buildSound(ctx: AudioContext, type: SoundType): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  switch (type) {
    case "tick":
    case "countdown":
      // Sharp metronome tick — call once per second (5,4,3,2,1)
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046, t); // C6
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
      break;
    case "click":
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.08);
      break;
    case "win": {
      osc.type = "triangle";
      const freqs = [523, 659, 784, 1047];
      freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t + i * 0.1));
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.55);
      osc.start(t); osc.stop(t + 0.55);
      break;
    }
    case "lose":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(90, t + 0.55);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.55);
      osc.start(t); osc.stop(t + 0.55);
      break;
    case "cash":
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.08);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
      break;
  }
}

export function useSound() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
  });
  const mutedRef = useRef(isMuted);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const play = useCallback((type: SoundType) => {
    if (mutedRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      buildSound(new AudioCtx(), type);
    } catch { /* blocked before user gesture */ }
  }, []);

  return { isMuted, toggleMute, play };
}
