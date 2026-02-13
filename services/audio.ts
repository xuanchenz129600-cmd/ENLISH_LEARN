/* ================================================================
 * audio.ts
 * Desktop: Web Speech API (System Native)
 * Mobile:  fetch POST Cloudflare Pages -> Audio(mp3)
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

// 👇👇👇 请在这里配置你的 Cloudflare Pages 信息 👇👇👇
const EDGE_TTS_API_BASE = "https://myprotts.xuanchenz129600.workers.dev"; // 你的 Pages 域名 (不要带 /v1/...)
const EDGE_TTS_API_KEY = "sk-123456"; // 你在 Pages 设置里填写的 API_KEY
// 👆👆👆 配置结束 👆👆👆

/** -------- helpers -------- */
function isMobileDevice(): boolean {
  // 如果你想在电脑上也使用高清语音，可以直接由 return true;
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

/** -------- Desktop: Web Speech API (保持不变) -------- */
function speakDesktopWebSpeech(
  text: string,
  onEnd?: () => void,
  rate: number = 1.0,
  onBoundary?: (charIndex: number) => void
) {
  if (!window.speechSynthesis) {
    console.warn("Web Speech API not supported");
    onEnd?.();
    return;
  }

  // console.log("TTS: Desktop Native request:", text);
  if (!text) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  window.__activeSpeechUtterance = null;

  setTimeout(() => {
    const runSpeak = () => {
      const voices = window.speechSynthesis.getVoices();

      // 尝试寻找系统自带的高质量英文
      const voice =
        voices.find((v) => v.name === "Google US English") ||
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang === "en-US");

      const utterance = new SpeechSynthesisUtterance(text);
      window.__activeSpeechUtterance = utterance;

      if (voice) {
        utterance.voice = voice;
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
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        window.__activeSpeechUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e: any) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.error("TTS Native Error:", e);
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        window.__activeSpeechUtterance = null;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);

      // Chrome bug fix: prevent garbage collection or silence after 15s
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

/** -------- Mobile: Fetch POST OpenAI-Compatible API -> MP3 -------- */
async function speakMobileViaWorker(text: string, onEnd?: () => void, rate: number = 1.0) {
  if (!text) {
    onEnd?.();
    return;
  }

  cleanupEdgeAudio();

  const token = (window.__edgeTtsSpeakToken ?? 0) + 1;
  window.__edgeTtsSpeakToken = token;

  const ac = new AbortController();
  window.__edgeTtsAbort = ac;

  try {
    // ⚠️ 关键点：这里使用 'shimmer'，因为我们在 worker 中把它映射到了 Ava Dragon 高清版
    const voiceModel = "alloy"; 
    
    // 构造 API 地址
    const apiUrl = `${EDGE_TTS_API_BASE.replace(/\/$/, "")}/v1/audio/speech`;

    // 使用 POST 请求，符合 OpenAI 接口规范
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${EDGE_TTS_API_KEY}`
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: voiceModel,
        speed: rate, // OpenAI API 使用 speed 参数 (0.25 ~ 4.0)
        response_format: "mp3"
      }),
      signal: ac.signal,
    });

    if (window.__edgeTtsSpeakToken !== token) return;

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "Unknown error");
      throw new Error(`TTS API Error ${resp.status}: ${errText}`);
    }

    // 获取音频 Blob
    const blob = await resp.blob();
    if (window.__edgeTtsSpeakToken !== token) return;

    const url = URL.createObjectURL(blob);
    window.__edgeTtsAudioUrl = url;

    const audio = new Audio(url);
    window.__edgeTtsAudio = audio;

    // 绑定事件
    const handleEndOrError = () => {
      if (window.__edgeTtsSpeakToken === token) cleanupEdgeAudio();
      onEnd?.();
    };

    audio.onended = handleEndOrError;
    audio.onerror = (e) => {
      console.error("Audio Playback Error", e);
      handleEndOrError();
    };

    await audio.play();

  } catch (e: any) {
    // 如果是手动取消 (AbortError)，则不报错
    if (e.name === "AbortError") {
      // expected behavior on cancel
    } else {
      console.error("Mobile TTS fetch error:", e);
      if (window.__edgeTtsSpeakToken === token) cleanupEdgeAudio();
      onEnd?.();
    }
  }
}

export const tts = {
  speak: (
    text: string,
    onEnd?: () => void,
    rate: number = 1.0,
    onBoundary?: (charIndex: number) => void
  ) => {
    // 判断是否使用云端 TTS (移动端默认使用，PC端如果想用高清语音也可以把 isMobileDevice() 改为 true)
    if (isMobileDevice()) {
      // Mobile uses Cloudflare Worker (MP3 stream, no boundary events)
      void speakMobileViaWorker(text, onEnd, rate);
      return;
    }

    // Desktop uses Browser Native TTS
    speakDesktopWebSpeech(text, onEnd, rate, onBoundary);
  },

  cancel: () => {
    // Desktop cancel
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;

    // Mobile cancel
    window.__edgeTtsSpeakToken = (window.__edgeTtsSpeakToken ?? 0) + 1;
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
