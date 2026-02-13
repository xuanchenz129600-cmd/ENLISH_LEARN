// 扩展全局类型定义
declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;
    __activeMobileAudio?: HTMLAudioElement | null;
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 判断当前是否为移动端设备
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
    // 1. 基础检查
    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    // 2. 全局重置：无论是哪种模式，先停止所有当前正在发音的声音
    tts.cancel();

    // ============================================================
    // 模式 A：手机端 (使用 Edge TTS 网络发音)
    // ============================================================
    if (isMobile()) {
      console.log('TTS: Mobile Mode (Edge TTS)');
      
      // 选取一个高质量的微软神经网络声音 (Ava 是非常自然的女性声音)
      const voice = 'en-US-AvaNeural'; 
      // 使用公开的代理接口 (如果失效可更换节点)
      const url = `https://api.pawan.krd/tts?text=${encodeURIComponent(text.trim())}&voice=${voice}`;

      try {
        const audio = new Audio(url);
        window.__activeMobileAudio = audio;
        
        audio.onended = () => {
          window.__activeMobileAudio = null;
          if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
          console.error('Edge TTS Mobile Error:', e);
          window.__activeMobileAudio = null;
          if (onEnd) onEnd();
        };

        // 手机端必须在用户交互事件中直接调用 play
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Mobile play blocked or failed:", error);
          });
        }
      } catch (err) {
        console.error("Failed to initialize mobile audio:", err);
        if (onEnd) onEnd();
      }
      return; // 手机端逻辑结束，直接返回
    }

    // ============================================================
    // 模式 B：电脑端 (保持您原有的 Web Speech API 逻辑)
    // ============================================================
    if (!window.speechSynthesis) {
      console.warn('Web Speech API not supported');
      if (onEnd) onEnd();
      return;
    }

    console.log('TTS: Desktop Mode (Native API)');

    // 延迟 50ms 启动，防止原生引擎在 cancel 后立刻 speak 导致的跳字 bug
    setTimeout(() => {
      const runSpeak = () => {
        const voices = window.speechSynthesis.getVoices();

        // 优先匹配 Google US English
        const voice = voices.find(v => v.name === 'Google US English') ||
          voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
          voices.find(v => v.lang === 'en-US');

        const utterance = new SpeechSynthesisUtterance(text);
        window.__activeSpeechUtterance = utterance;

        if (voice) {
          utterance.voice = voice;
          console.log('TTS: Using Desktop Voice:', voice.name);
        }

        utterance.rate = rate;
        utterance.lang = 'en-US';

        if (onBoundary) {
          utterance.onboundary = (e) => {
            if (typeof e.charIndex === 'number') {
              onBoundary(e.charIndex);
            }
          };
        }

        utterance.onend = () => {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          window.__activeSpeechUtterance = null;
          if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
          if (e.error === 'interrupted' || e.error === 'canceled') return;
          console.error('TTS Desktop Error Event:', e);
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          window.__activeSpeechUtterance = null;
          if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);

        // PC Chrome 保活机制
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
    // 停止电脑端发音
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    window.__activeSpeechUtterance = null;

    // 停止手机端发音
    if (window.__activeMobileAudio) {
      window.__activeMobileAudio.pause();
      window.__activeMobileAudio.src = ""; // 强制卸载音频流
      window.__activeMobileAudio = null;
    }
  }
};

/**
 * 保持原有逻辑不变的 UI 音效函数
 */
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
