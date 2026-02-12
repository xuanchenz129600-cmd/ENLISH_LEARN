
// We use a global type extension to safely store the utterance on window
declare global {
  interface Window {
    __activeSpeechUtterance?: SpeechSynthesisUtterance | null;
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export const tts = {
  speak: (
    text: string, 
    onEnd?: () => void, 
    rate: number = 1.0, 
    onBoundary?: (charIndex: number) => void
  ) => {
    if (!window.speechSynthesis) {
      console.warn('Web Speech API not supported');
      return;
    }

    // 1. Log the text to ensure it's valid
    console.log('TTS: Request to speak text:', text ? `"${text.substring(0, 20)}..."` : '<EMPTY>');
    if (!text) {
        if (onEnd) onEnd();
        return;
    }

    // 2. HARD RESET: Cancel everything first
    window.speechSynthesis.cancel();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;

    // 3. THE MAGIC DELAY
    // Chrome's speech engine often "skips" if cancel() and speak() happen in the same tick.
    // A small timeout allows the engine to reset its internal state.
    setTimeout(() => {
        const runSpeak = () => {
            const voices = window.speechSynthesis.getVoices();
            
            // Prioritize Google US English
            const voice = voices.find(v => v.name === 'Google US English') || 
                          voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
                          voices.find(v => v.lang === 'en-US');

            const utterance = new SpeechSynthesisUtterance(text);
            
            // 4. NUCLEAR GC FIX: Attach to window explicitly
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
                    // console.log('TTS: Boundary', e.charIndex); // Uncomment if needed, but reducing noise
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
                // Ignore interruption errors caused by our own cancel()
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
    }, 50); // 50ms delay is usually enough
  },
  
  cancel: () => {
    window.speechSynthesis.cancel();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    window.__activeSpeechUtterance = null;
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
