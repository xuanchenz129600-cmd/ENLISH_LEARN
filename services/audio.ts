/* ================================================================
 * audio.ts
 * Desktop: Web Speech API (unchanged)
 * Mobile:  fetch GET your Worker -> Audio(mp3)
 * ================================================================ */

declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;

    __edgeTtsAudio?: HTMLAudioElement | null;
    __edgeTtsAudioUrl?: string | null;
    __edgeTtsSpeakToken?: number;
    __edgeTtsAbort?: AbortController | null;
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

// Your GET worker endpoint
const EDGE_TTS_WORKER_BASE = "https://zhangchen981109.dpdns.org/";

/** -------- helpers -------- */
function isMobileDevice(): boolean {
  const navAny = navigator as any;
  if (typeof navAny?.userAgentData?.mobile === "boolean") return navAny.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function cleanupEdgeAudio() {
  if (window.__edgeTtsAbort) {
    try { window.__edgeTtsAbort.abort(); } catch {}
  }
  window.__edgeTtsAbort = null;

  if (window.__edgeTtsAudio) {
    try {
      window.__edgeTtsAudio.pause();
      window.__edgeTtsAudio.src = "";
      window.__edgeTtsAudio.load();
    } catch {}
  }
  window.__edgeTtsAudio = null;

  if (window.__edgeTtsAudioUrl) {
    try { URL.revokeObjectURL(window.__edgeTtsAudioUrl); } catch {}
  }
  window.__edgeTtsAudioUrl = null;
}

/** -------- Desktop: your original Web Speech code (unchanged) -------- */
function speakDesktopWebSpeech(
  text: string,
  onEnd?: () => void,
  rate: number = 1.0,
  onBoundary?: (charIndex: number) => void
) {
  if (!window.speechSynthesis) {
    console.warn("Web Speech API not supported");
    return;
  }

  console.log("TTS: Request to speak text:", text ? `"${text.substring(0, 20)}..."` : "<EMPTY>");
  if (!text) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  window.__activeSpeechUtterance = null;

  setTimeout(() => {
    const runSpeak = () => {
      const voices = window.speechSynthesis.getVoices();

      const voice =
        voices.find((v) => v.name === "Google US English") ||
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang === "en-US");

      const utterance = new SpeechSynthesisUtterance(text);
      window.__activeSpeechUtterance = utterance;

      if (voice) {
        utterance.voice = voice;
        console.log("TTS: Using Voice:", voice.name);
      }

      utterance.rate = rate;
      utterance.lang = "en-US";

      if (onBoundary) {
        utterance.onboundary = (e) => {
          if (typeof (e as any).charIndex === "number") {
            onBoundary((e as any).charIndex);
          }
        };
      }

      utterance.onend = () => {
        console.log("TTS: Finished");
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        window.__activeSpeechUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e: any) => {
        if (e.error === "interrupted" || e.error === "canceled") return;

        console.error("TTS Error Event:", e);
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        window.__activeSpeechUtterance = null;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);

      keepAliveTimer = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
        }
      }, 10000);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      const onVoicesChanged = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        runSpeak();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    } else {
      runSpeak();
    }
  }, 50);
}

/** -------- Mobile: GET Worker -> mp3 -> play -------- */
async function speakMobileViaWorker(text: string, onEnd?: () => void, rate: number = 1.0) {
  if (!text) {
    onEnd?.();
    return;
  }

  cleanupEdgeAudio();

  const token = (window.__edgeTtsSpeakToken ?? 0) + 1;
  window.__edgeTtsSpeakToken = token;

  // Abortable fetch (so cancel works)
  const ac = new AbortController();
  window.__edgeTtsAbort = ac;

  try {
    const voice = "en-US-AvaNeural"; // keep consistent with your Worker default; you can change here

    const u = new URL(EDGE_TTS_WORKER_BASE);
    u.searchParams.set("text", text);
    u.searchParams.set("voice", voice);
    u.searchParams.set("rate", String(rate)); // Worker clamps 0.5~2.0

    const resp = await fetch(u.toString(), {
      method: "GET",
      signal: ac.signal,
    });

    if (window.__edgeTtsSpeakToken !== token) return;

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`Worker TTS failed: ${resp.status} ${err}`);
    }

    const blob = await resp.blob();
    if (window.__edgeTtsSpeakToken !== token) return;

    const url = URL.createObjectURL(blob);
    window.__edgeTtsAudioUrl = url;

    const audio = new Audio(url);
    window.__edgeTtsAudio = audio;

    audio.onended = () => {
      if (window.__edgeTtsSpeakToken === token) cleanupEdgeAudio();
      onEnd?.();
    };
    audio.onerror = () => {
      if (window.__edgeTtsSpeakToken === token) cleanupEdgeAudio();
      onEnd?.();
    };

    await audio.play();
  } catch (e) {
    // fetch aborted is normal on cancel
    console.error("Mobile TTS error:", e);
    if (window.__edgeTtsSpeakToken === token) cleanupEdgeAudio();
    onEnd?.();
  }
}

export const tts = {
  speak: (
    text: string,
    onEnd?: () => void,
    rate: number = 1.0,
    onBoundary?: (charIndex: number) => void
  ) => {
    if (isMobileDevice()) {
      // Mobile uses Worker (no boundary events in mp3 mode)
      void speakMobileViaWorker(text, onEnd, rate);
      return;
    }

    // Desktop unchanged
    speakDesktopWebSpeech(text, onEnd, rate, onBoundary);
  },

  cancel: () => {
    // Desktop cancel
    window.speechSynthesis?.cancel();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;

    // Mobile cancel
    window.__edgeTtsSpeakToken = (window.__edgeTtsSpeakToken ?? 0) + 1; // invalidate in-flight
    cleanupEdgeAudio();
  },
};

export const playSound = (type: "ding" | "error") => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (type === "ding") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
};
