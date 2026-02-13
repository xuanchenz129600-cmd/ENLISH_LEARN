// ============================================================
// audio.ts — 混合模式：电脑端原生 Google 语音 + 手机端 Edge TTS
// ============================================================

// 扩展全局类型，用于存储当前的播放实例
declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;
    __activeMobileAudio?: HTMLAudioElement | null;
  }
}

// 你的 Cloudflare Worker 地址
const EDGE_TTS_API = "https://my-edge-tts.xuanchenz129600.workers.dev/";
// 手机端使用的发音人 (Ava 是微软最自然的英语女声之一)
const EDGE_VOICE = "en-US-AvaNeural";

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 判断是否为移动设备
 */
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const tts = {
  speak: (
    text: string, 
    onEnd?: () => void, 
    rate: number = 1.0, 
    onBoundary?: (charIndex: number) => void
  ) => {
    // 0. 基础检查
    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    // 1. 全局重置：先停止任何正在播放的声音 (包括电脑和手机端)
    tts.cancel();

    // ============================================================
    // 分支 A：手机端 (使用 Cloudflare Worker + Edge TTS)
    // ============================================================
    if (isMobile()) {
      console.log('TTS: Mobile Mode detected. Using Edge TTS Worker.');

      // 构建请求 URL
      // 注意：这里将文本进行编码，防止特殊字符导致 URL 错误
      const url = `${EDGE_TTS_API}?text=${encodeURIComponent(text.trim())}&voice=${EDGE_VOICE}`;

      try {
        const audio = new Audio(url);
        window.__activeMobileAudio = audio;

        // 绑定结束事件
        audio.onended = () => {
          window.__activeMobileAudio = null;
          console.log('TTS: Mobile playback finished');
          if (onEnd) onEnd();
        };

        // 绑定错误事件
        audio.onerror = (e) => {
          console.error('TTS: Mobile playback error', e);
          window.__activeMobileAudio = null;
          if (onEnd) onEnd();
        };

        // 播放 (手机端必须由用户点击触发，否则 Promise 会 reject)
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("TTS: Mobile autoplay blocked. Ensure speak() is called within a click handler.", error);
          });
        }
      } catch (err) {
        console.error("TTS: Failed to initialize mobile audio", err);
        if (onEnd) onEnd();
      }
      
      // 手机端逻辑结束，不再执行下方电脑端逻辑
      return;
    }

    // ============================================================
    // 分支 B：电脑端 (保持原有 Web Speech API 逻辑)
    // ============================================================
    if (!window.speechSynthesis) {
      console.warn('Web Speech API not supported');
      return;
    }

    console.log('TTS: Desktop Mode. Using Native Web Speech API.');
    console.log('TTS: Request to speak text:', text ? `"${text.substring(0, 20)}..."` : '<EMPTY>');

    // HARD RESET: Cancel everything first
    window.speechSynthesis.cancel();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;

    // THE MAGIC DELAY
    setTimeout(() => {
        const runSpeak = () => {
            const voices = window.speechSynthesis.getVoices();
            
            // Prioritize Google US English
            const voice = voices.find(v => v.name === 'Google US English') || 
                          voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
                          voices.find(v => v.lang === 'en-US');

            const utterance = new SpeechSynthesisUtterance(text);
            
            // NUCLEAR GC FIX
            window.__activeSpeechUtterance = utterance;

            if (voice) {
                utterance.voice = voice;
                console.log('TTS: Using Voice:', voice.name);
            }
            
            utterance.rate = rate;
            utterance.lang = 'en-US';

            // Events
            if (onBoundary) {
                utterance.onboundary = (e) => {
                    if (typeof e.charIndex === 'number') {
                        onBoundary(e.charIndex);
                    }
                };
            }

            utterance.onend = () => {
                console.log('TTS: Finished');
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                window.__activeSpeechUtterance = null;
                if (onEnd) onEnd();
            };

            utterance.onerror = (e) => {
                if (e.error === 'interrupted' || e.error === 'canceled') return;
                
                console.error('TTS Error Event:', e);
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                window.__activeSpeechUtterance = null;
                if (onEnd) onEnd();
            };

            // Speak
            window.speechSynthesis.speak(utterance);

            // Chrome Keep-Alive
            keepAliveTimer = setInterval(() => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    window.speechSynthesis.resume();
                } else {
                    if (keepAliveTimer) clearInterval(keepAliveTimer);
                }
            }, 10000);
        };

        // Ensure voices are loaded
        if (window.speechSynthesis.getVoices().length === 0) {
            const onVoicesChanged = () => {
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                runSpeak();
            };
            window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        } else {
            runSpeak();
        }
    }, 50); 
  },
  
  cancel: () => {
    // 1. 停止电脑端
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;

    // 2. 停止手机端
    if (window.__activeMobileAudio) {
        window.__activeMobileAudio.pause();
        window.__activeMobileAudio = null;
    }
  }
};

export const playSound = (type: 'ding' | 'error') => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (type === 'ding') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
};
