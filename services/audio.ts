// ============================================================
// tts.ts — 完整替换版，兼容桌面 + 手机端 (Android Chrome/Edge)
// ============================================================

declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;
    __ttsAborted?: boolean;
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

// ---- 工具函数 ----

/** 判断是否为移动设备 */
const isMobile = (): boolean =>
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

/** 判断是否 iOS（iOS 上 Chrome/Edge 本质都是 WebKit） */
const isIOS = (): boolean =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** sleep 工具 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 将长文本按句子 + 最大长度切片
 * 移动端对单条 utterance 长度敏感，太长会卡死/无声
 */
function chunkText(text: string, maxLen: number = 160): string[] {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) return [];

  // 按常见句末标点切分
  const sentences = clean.split(/(?<=[.!?;。！？；\n])\s*/);
  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    // 如果当前缓冲区 + 新句子不超限，就合并
    if (buffer.length + sentence.length + 1 <= maxLen) {
      buffer = buffer ? buffer + " " + sentence : sentence;
    } else {
      // 先把缓冲区推出去
      if (buffer) chunks.push(buffer);

      // 如果单句本身就超长，硬切
      if (sentence.length > maxLen) {
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        buffer = "";
      } else {
        buffer = sentence;
      }
    }
  }
  if (buffer) chunks.push(buffer);

  return chunks.filter(Boolean);
}

/**
 * 等待 voices 加载 — 兼容移动端 voiceschanged 不触发的情况
 * 采用 "轮询 + 事件" 双保险策略
 */
function waitForVoices(timeoutMs: number = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      resolve(voices);
      return;
    }

    let resolved = false;
    const done = (v: SpeechSynthesisVoice[]) => {
      if (resolved) return;
      resolved = true;
      resolve(v);
    };

    // 方式 1：监听事件
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      done(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);

    // 方式 2：轮询兜底
    const start = Date.now();
    const poll = setInterval(() => {
      const v = window.speechSynthesis.getVoices();
      if ((v && v.length > 0) || Date.now() - start > timeoutMs) {
        clearInterval(poll);
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        done(v || []);
      }
    }, 80);
  });
}

/**
 * 选取最佳 voice
 * 桌面优先 Google US English；手机端放宽条件，避免因匹配不到而静音
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 优先级列表
  const priority = [
    (v: SpeechSynthesisVoice) => v.name === "Google US English",
    (v: SpeechSynthesisVoice) =>
      v.name.includes("Google") && v.lang.startsWith("en"),
    (v: SpeechSynthesisVoice) => v.lang === "en-US" && !v.localService,
    (v: SpeechSynthesisVoice) => v.lang === "en-US",
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];

  for (const test of priority) {
    const found = voices.find(test);
    if (found) return found;
  }

  return null; // 使用系统默认
}

// ---- 清理函数 ----

function cleanUp() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  window.__activeSpeechUtterance = null;
}

// ============================================================
// 主导出：tts 对象
// ============================================================

export const tts = {
  /**
   * 朗读文本
   * ⚠️ 必须在用户交互（click/touch）事件链中调用，否则移动端会静默拦截
   */
  speak: (
    text: string,
    onEnd?: () => void,
    rate: number = 1.0,
    onBoundary?: (charIndex: number) => void
  ) => {
    // --- 基础校验 ---
    if (!window.speechSynthesis) {
      console.warn("TTS: Web Speech API not supported on this device.");
      onEnd?.();
      return;
    }

    const content = (text || "").trim();
    console.log(
      "TTS: speak() called —",
      content ? `"${content.slice(0, 40)}..."` : "<EMPTY>"
    );
    if (!content) {
      onEnd?.();
      return;
    }

    // --- 标志位：用于 cancel 时中断分片队列 ---
    window.__ttsAborted = false;

    // --- HARD RESET ---
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    // 移动端有时会卡在 paused 状态，强制 resume 一下
    try {
      window.speechSynthesis.resume();
    } catch (_) {}
    cleanUp();

    // --- 核心异步流程 ---
    const run = async () => {
      // 给引擎一个 reset 的喘息时间（移动端需要更长）
      await sleep(isMobile() ? 150 : 50);

      // 等待 voices
      const voices = await waitForVoices(isMobile() ? 2000 : 1000);
      console.log("TTS: Available voices:", voices.length);

      const voice = pickVoice(voices);
      if (voice) {
        console.log("TTS: Selected voice:", voice.name, voice.lang);
      } else {
        console.log("TTS: No preferred voice found, using system default.");
      }

      // 分片
      const maxChunk = isMobile() ? 150 : 220;
      const chunks = chunkText(content, maxChunk);
      console.log("TTS: Split into", chunks.length, "chunk(s)");

      // 用于 onBoundary 的全局偏移量
      let globalCharOffset = 0;

      // 逐片播放
      const speakChunk = (index: number) => {
        // 如果已被 cancel，不再继续
        if (window.__ttsAborted) {
          cleanUp();
          return;
        }

        if (index >= chunks.length) {
          console.log("TTS: All chunks finished.");
          cleanUp();
          onEnd?.();
          return;
        }

        const piece = chunks[index];
        const utterance = new SpeechSynthesisUtterance(piece);

        // 防 GC 回收
        window.__activeSpeechUtterance = utterance;

        // 设置 voice（找到了才设，否则让系统自己选）
        if (voice) {
          utterance.voice = voice;
        }
        utterance.rate = rate;
        utterance.lang = "en-US";
        // 移动端 volume 显式设为 1，有些设备默认 0
        utterance.volume = 1;
        utterance.pitch = 1;

        // boundary 回调（带全局偏移）
        if (onBoundary) {
          utterance.onboundary = (e: SpeechSynthesisEvent) => {
            if (typeof e.charIndex === "number") {
              onBoundary(globalCharOffset + e.charIndex);
            }
          };
        }

        utterance.onend = () => {
          // 更新全局偏移
          globalCharOffset += piece.length + 1; // +1 for space between chunks
          // 移动端片间加一点间隔，避免引擎来不及
          setTimeout(
            () => speakChunk(index + 1),
            isMobile() ? 100 : 20
          );
        };

        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          // 自己 cancel 导致的中断不算错误
          if (
            e.error === "interrupted" ||
            e.error === "canceled"
          ) {
            return;
          }
          console.error("TTS: Error on chunk", index, "—", e.error, e);
          cleanUp();
          onEnd?.();
        };

        // 在 speak 前再确保没有卡在 paused
        try {
          window.speechSynthesis.resume();
        } catch (_) {}

        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.error("TTS: speak() threw:", err);
          cleanUp();
          onEnd?.();
          return;
        }
      };

      // 启动第一片
      speakChunk(0);

      // --- Chrome 桌面端 Keep-Alive（防 15 秒超时静音） ---
      // 移动端不启用，因为 pause/resume 循环在移动端反而会导致卡死
      if (!isMobile()) {
        keepAliveTimer = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            if (keepAliveTimer) {
              clearInterval(keepAliveTimer);
              keepAliveTimer = null;
            }
          }
        }, 10000);
      }
    };

    // 执行
    run().catch((err) => {
      console.error("TTS: Unexpected error in run():", err);
      cleanUp();
      onEnd?.();
    });
  },

  /** 停止朗读 */
  cancel: () => {
    console.log("TTS: cancel() called");
    window.__ttsAborted = true;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    cleanUp();
  },

  /** 检测当前是否正在朗读 */
  isSpeaking: (): boolean => {
    return window.speechSynthesis?.speaking ?? false;
  },
};

// ============================================================
// playSound — 保持原有逻辑不变
// ============================================================

export const playSound = (type: "ding" | "error") => {
  const AudioCtx =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
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
