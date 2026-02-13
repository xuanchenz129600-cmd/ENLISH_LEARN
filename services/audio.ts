// We use a global type extension to safely store the utterance on window
declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;
  }
}

// 这里的 Timer 用于解决 Chrome 播放长文卡顿的 bug
let chromeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

export const tts = {
  speak: (
    text: string, 
    onEnd?: () => void, 
    rate: number = 1.0, 
    onBoundary?: (charIndex: number) => void
  ) => {
    // 0. 基础检查
    if (!window.speechSynthesis) {
      console.warn('Web Speech API not supported');
      return;
    }

    // 1. 立即清理之前的状态 (同步执行)
    // 手机端必须在点击的瞬间执行操作，不能等待
    window.speechSynthesis.cancel();
    if (chromeKeepAliveTimer) {
      clearInterval(chromeKeepAliveTimer);
      chromeKeepAliveTimer = null;
    }

    if (!text) {
        if (onEnd) onEnd();
        return;
    }

    // 2. 核心逻辑封装
    const runSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 挂载到 window 防止被垃圾回收 (GC) 导致发音中断
        window.__activeSpeechUtterance = utterance;

        // --- 语音包选择策略优化 (适配手机) ---
        const voices = window.speechSynthesis.getVoices();
        
        // 策略：
        // 1. 优先找 "Google US English" (电脑 Chrome 体验最好)
        // 2. 其次找任何 en-US (适配 iOS/Android 系统语音)
        // 3. 再次找任何 en 开头的 (适配其他英语变体)
        // 4. 如果都没找到，不设置 voice，浏览器会使用系统默认 (手机端通常默认就是最好的)
        let voice = voices.find(v => v.name === 'Google US English');
        if (!voice) {
             voice = voices.find(v => v.lang === 'en-US');
        }
        if (!voice) {
             voice = voices.find(v => v.lang.startsWith('en'));
        }

        if (voice) {
            utterance.voice = voice;
            // console.log('TTS: Using Voice:', voice.name); // 调试用
        }
        
        // 强制指定语言，作为最后的兜底
        utterance.lang = 'en-US';
        utterance.rate = rate;

        // --- 事件绑定 ---
        utterance.onboundary = (e) => {
            if (onBoundary && typeof e.charIndex === 'number') {
                onBoundary(e.charIndex);
            }
        };

        const handleEnd = () => {
            // console.log('TTS: Finished');
            if (chromeKeepAliveTimer) {
                clearInterval(chromeKeepAliveTimer);
                chromeKeepAliveTimer = null;
            }
            window.__activeSpeechUtterance = null;
            if (onEnd) onEnd();
        };

        utterance.onend = handleEnd;
        utterance.onerror = (e) => {
            // 忽略因 cancel 导致的中断错误
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            console.error('TTS Error:', e);
            handleEnd();
        };

        // --- 3. 关键修改：移除 setTimeout，同步调用 speak ---
        // 只有同步调用，手机浏览器才承认这是“用户点的”
        window.speechSynthesis.speak(utterance);

        // --- Chrome 长文本保活机制 ---
        // 仅在 PC Chrome 下生效，手机端一般不需要，或者手机端加上也没坏处
        if (navigator.userAgent.includes("Chrome") && !navigator.userAgent.includes("Mobile")) {
            chromeKeepAliveTimer = setInterval(() => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    window.speechSynthesis.resume();
                } else {
                    if (chromeKeepAliveTimer) clearInterval(chromeKeepAliveTimer);
                }
            }, 10000);
        }
    };

    // --- 语音列表加载处理 ---
    // 手机端通常 getVoices() 一开始是空的，但我们不能等，必须直接 speak
    // 等待 voiceschanged 在手机上极不稳定，容易导致死锁
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        // 如果列表为空，尝试直接播放（手机会用默认语音），同时监听加载以备后用
        // 但不要阻塞当前的播放
        runSpeak(); 
    } else {
        runSpeak();
    }
  },
  
  cancel: () => {
    window.speechSynthesis.cancel();
    if (chromeKeepAliveTimer) {
        clearInterval(chromeKeepAliveTimer);
        chromeKeepAliveTimer = null;
    }
    window.__activeSpeechUtterance = null;
  }
};

export const playSound = async (type: 'ding' | 'error') => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  
  // --- 关键修改：处理 AudioContext 挂起状态 ---
  // 手机浏览器新建的 AudioContext 默认是 suspended (静音) 的
  // 必须在用户点击事件中显式 resume()
  if (ctx.state === 'suspended') {
    try {
        await ctx.resume();
    } catch (e) {
        console.warn("AudioContext resume failed", e);
    }
  }

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
