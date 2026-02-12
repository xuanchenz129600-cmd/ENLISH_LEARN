import React, { useState, useEffect, useRef } from 'react';
import { Word } from '../types';
import { db } from '../services/storage';
import { tts, playSound } from '../services/audio';
import { 
  Volume2, 
  ArrowLeft, 
  Repeat, 
  List, 
  Feather, 
  BookOpen, 
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Loader2,
  Keyboard,
  Lightbulb
} from 'lucide-react';
import { dictionaryService } from '../services/dictionary';

interface Props {
  unitId: string;
  onBack: () => void;
}

type Mode = 'STUDY' | 'TEST';
type TestStatus = 'IDLE' | 'SUCCESS' | 'ERROR';

// Particle Interface
interface Particle {
  id: number;
  x: number;
  y: number;
  style: React.CSSProperties & Record<string, any>; // Fix: Allow custom CSS vars like --color
}

const WordModule: React.FC<Props> = ({ unitId, onBack }) => {
  const [words, setWords] = useState<Word[]>([]);
  const [mode, setMode] = useState<Mode>('STUDY');
  
  // === Gallery/Study State ===
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showListSheet, setShowListSheet] = useState(false);

  // Animation / Gesture State
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 80;

  // === Test/Dictation State ===
  const [testIndex, setTestIndex] = useState(0);
  const [testInput, setTestInput] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('IDLE');
  // Track which indices were auto-filled by hint
  const [hintedIndices, setHintedIndices] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const testContainerRef = useRef<HTMLDivElement>(null); // To calculate origin

  // === Particles State ===
  const [particles, setParticles] = useState<Particle[]>([]);

  // === Add Word State (Modal) ===
  const [isAdding, setIsAdding] = useState(false);
  const [newWord, setNewWord] = useState<Partial<Word>>({});
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  useEffect(() => {
    const data = db.getWords(unitId);
    setWords(data);
  }, [unitId]);

  // Reset states when mode changes
  useEffect(() => {
    if (mode === 'TEST') {
        setIsAutoPlaying(false);
        tts.cancel();
        setTestIndex(0);
        setTestInput('');
        setTestStatus('IDLE');
        setHintedIndices(new Set());
        // Auto-play first word in test mode after a short delay
        if (words.length > 0) {
            setTimeout(() => {
                playTestAudio(0);
                inputRef.current?.focus();
            }, 500);
        }
    } else {
        tts.cancel();
        setCurrentIndex(0);
        setIsFlipped(false);
    }
  }, [mode]);

  // Keep input focused in Test Mode
  useEffect(() => {
    if (mode === 'TEST' && inputRef.current) {
        // Optional logic to keep focus
    }
  }, [mode, testIndex]);

  // --------------------------------------------------------------------------
  // STUDY MODE LOGIC
  // --------------------------------------------------------------------------

  // Auto Play Logic
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (mode === 'STUDY' && isAutoPlaying && words.length > 0) {
      // 1. Speak current word
      tts.speak(words[currentIndex].text, () => {
        // 2. Wait a bit after speaking finishes
        timeout = setTimeout(() => {
            // 3. Flip card to show meaning
            setIsFlipped(true);
            
            // 4. Wait reading time then move next
            timeout = setTimeout(() => {
                setIsFlipped(false);
                setTimeout(() => {
                    handleNext();
                }, 400); // Wait for flip back
            }, 2500); // Time to read back
        }, 500);
      });
    }
    return () => {
      clearTimeout(timeout);
      if (mode === 'STUDY') tts.cancel();
    };
  }, [isAutoPlaying, currentIndex, words, mode]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'STUDY') return;
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || mode !== 'STUDY') return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    
    if ((currentIndex === 0 && diff > 0) || (currentIndex === words.length - 1 && diff < 0)) {
        setDragX(diff * 0.3);
    } else {
        setDragX(diff);
    }
  };

  const handleTouchEnd = () => {
    if (mode !== 'STUDY') return;
    setIsDragging(false);
    
    if (dragX < -SWIPE_THRESHOLD && currentIndex < words.length - 1) {
      handleNext();
    } else if (dragX > SWIPE_THRESHOLD && currentIndex > 0) {
      handlePrev();
    } else {
      setDragX(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
        setDragX(-window.innerWidth); 
        setTimeout(() => {
            setDragX(0);
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        }, 200);
    } else {
        setIsAutoPlaying(false);
        setDragX(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
        setDragX(window.innerWidth); 
        setTimeout(() => {
            setDragX(0);
            setIsFlipped(false);
            setCurrentIndex(prev => prev - 1);
        }, 200);
    } else {
        setDragX(0);
    }
  };

  const handleManualPlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      tts.speak(words[currentIndex].text);
  };

  // --------------------------------------------------------------------------
  // TEST MODE LOGIC (Qwerty Learner Style)
  // --------------------------------------------------------------------------

  const playTestAudio = (index: number = testIndex) => {
      if (words[index]) {
          tts.speak(words[index].text);
      }
  };

  const handleTestInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const currentWord = words[testIndex].text;
      
      // Limit input length to word length
      if (val.length > currentWord.length) return;

      // Clean up hints if user backspaced
      if (val.length < testInput.length) {
         setHintedIndices(prev => {
             const next = new Set(prev);
             for (let i = val.length; i < testInput.length; i++) {
                 next.delete(i);
             }
             return next;
         });
      }

      setTestInput(val);
      setTestStatus('IDLE');

      // Auto-check when length matches
      if (val.length === currentWord.length) {
          checkAnswer(val, currentWord);
      }
  };

  const handleHint = () => {
      const currentWord = words[testIndex].text;
      const currentLen = testInput.length;
      
      if (currentLen >= currentWord.length) {
          playSound('error');
          return;
      }

      const nextChar = currentWord[currentLen];
      
      setHintedIndices(prev => {
          const next = new Set(prev);
          next.add(currentLen);
          return next;
      });

      const newInput = testInput + nextChar;
      setTestInput(newInput);
      setTestStatus('IDLE');
      
      inputRef.current?.focus();

      if (newInput.length === currentWord.length) {
          checkAnswer(newInput, currentWord);
      }
  };

  // --- PARTICLE EFFECT LOGIC ---
  const triggerParticles = () => {
    // 1. Get Origin (Input Center)
    const inputRect = testContainerRef.current?.getBoundingClientRect();
    // 2. Get Destination (Specific Progress Bar Segment)
    const progressEl = document.getElementById(`progress-dot-${testIndex}`);
    const progressRect = progressEl?.getBoundingClientRect();

    if (!inputRect || !progressRect) return;

    // Calculate Centers
    const startX = inputRect.left + inputRect.width / 2;
    const startY = inputRect.top + inputRect.height / 2;
    const endX = progressRect.left + progressRect.width / 2;
    const endY = progressRect.top + progressRect.height / 2;

    const newParticles: Particle[] = [];
    const count = 40; // Number of particles

    for (let i = 0; i < count; i++) {
        // Delta to target
        const tx = endX - startX;
        const ty = endY - startY;
        
        // Random initial burst parameters
        const burstAngle = Math.random() * Math.PI * 2;
        const burstDist = Math.random() * 60; // Spread radius
        
        // Luminous Colors
        const colors = ['#ffffff', '#6366f1', '#a855f7', '#34d399', '#f0abfc'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 4 + 2;

        newParticles.push({
            id: Date.now() + i,
            x: startX,
            y: startY,
            style: {
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                '--burst-x': `${Math.cos(burstAngle) * burstDist}px`,
                '--burst-y': `${Math.sin(burstAngle) * burstDist}px`,
                '--color': color,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${Math.random() * 0.1}s`,
                left: startX,
                top: startY,
            } as React.CSSProperties
        });
    }

    setParticles(newParticles);

    // Clean up
    setTimeout(() => {
        setParticles([]);
    }, 1000);
  };

  const checkAnswer = (input: string, target: string) => {
      if (input.toLowerCase() === target.toLowerCase()) {
          setTestStatus('SUCCESS');
          playSound('ding');
          
          // Trigger Visuals
          triggerParticles();

          // Auto advance
          setTimeout(() => {
              nextTestWord();
          }, 900); // Wait for particle animation roughly
      } else {
          setTestStatus('ERROR');
          playSound('error');
      }
  };

  const nextTestWord = () => {
      if (testIndex < words.length - 1) {
          setTestIndex(prev => prev + 1);
          setTestInput('');
          setTestStatus('IDLE');
          setHintedIndices(new Set());
          setTimeout(() => {
            playTestAudio(testIndex + 1);
            inputRef.current?.focus();
          }, 200);
      } else {
          // Finished Unit
          alert("Dictation Unit Complete! Great job.");
          setMode('STUDY');
      }
  };

  // --------------------------------------------------------------------------
  // SHARED & UTILS
  // --------------------------------------------------------------------------

  const getAuroraColors = (idx: number) => {
    const cycle = idx % 3;
    if (cycle === 0) return 'from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950';
    if (cycle === 1) return 'from-emerald-100 via-teal-100 to-cyan-100 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950';
    return 'from-orange-100 via-rose-100 to-pink-100 dark:from-orange-950 dark:via-rose-950 dark:to-pink-950';
  };

  const getWordFontSize = (text: string) => {
    const len = text.length;
    if (len <= 8) return 'text-5xl sm:text-6xl';
    if (len <= 12) return 'text-4xl sm:text-5xl';
    if (len <= 16) return 'text-3xl sm:text-4xl';
    return 'text-2xl sm:text-3xl';
  };

  const handleAddWord = () => {
    if (!newWord.text || !newWord.meaning) return;
    db.addWord({
      id: crypto.randomUUID(),
      unitId,
      text: newWord.text,
      meaning: newWord.meaning,
      phonetic: newWord.phonetic || '',
      example: newWord.example || ''
    } as Word);
    const updated = db.getWords(unitId);
    setWords(updated);
    setIsAdding(false);
    setNewWord({});
    setCurrentIndex(updated.length - 1);
  };

  const autoFillWordData = async () => {
    const text = newWord.text?.trim();
    if (!text || isAutoFilling) return;
    setIsAutoFilling(true);
    try {
        const data = await dictionaryService.fetchDefinition(text);
        if (data) {
            const firstMeaning = data.meanings[0];
            const firstDef = firstMeaning?.definitions[0];
            setNewWord(prev => ({
                ...prev,
                phonetic: data.phonetic || prev.phonetic,
                meaning: firstDef?.definition || prev.meaning,
                example: firstDef?.example || prev.example
            }));
        }
    } catch (e) {
        console.error("Auto-fill failed", e);
    } finally {
        setIsAutoFilling(false);
    }
  };

  // Empty State
  if (words.length === 0) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
              <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                  <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                  <Sparkles className="text-indigo-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Zen Gallery</h2>
              <p className="text-gray-500 text-center mb-8">Add words to start your immersive experience.</p>
              <button 
                  onClick={() => setIsAdding(true)}
                  className="px-8 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-full font-medium shadow-lg hover:scale-105 transition-transform"
              >
                  Add First Word
              </button>
              {isAdding && renderAddModal()}
          </div>
      );
  }

  const activeIndex = mode === 'STUDY' ? currentIndex : testIndex;
  const activeWord = words[activeIndex];

  return (
    <div className={`h-full flex flex-col relative overflow-hidden transition-colors duration-1000 bg-gradient-to-br ${getAuroraColors(activeIndex)}`}>
        
        {/* Animated Aurora Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute top-[-10%] left-[-10%] w-[80%] h-[60%] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-40 animate-breathe bg-white dark:bg-white/10 transition-colors duration-1000`}></div>
            <div className={`absolute bottom-[-10%] right-[-10%] w-[70%] h-[60%] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-40 animate-breathe bg-white dark:bg-white/10 transition-colors duration-1000`} style={{ animationDelay: '4s' }}></div>
        </div>

        {/* --- PARTICLE LAYER --- */}
        {particles.length > 0 && (
            <div className="fixed inset-0 pointer-events-none z-[100]">
                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute rounded-full animate-suck-in"
                        style={{
                            ...p.style,
                            backgroundColor: p.style['--color'],
                            boxShadow: `0 0 10px ${p.style['--color']}, 0 0 20px ${p.style['--color']}`
                        }}
                    />
                ))}
            </div>
        )}

        {/* Particle Animation Keyframes */}
        <style>{`
            @keyframes suck-in {
                0% {
                    transform: translate(0, 0) scale(1);
                    opacity: 1;
                }
                20% {
                    transform: translate(var(--burst-x), var(--burst-y)) scale(1.5);
                    opacity: 1;
                }
                100% {
                    transform: translate(var(--tx), var(--ty)) scale(0.2);
                    opacity: 0;
                }
            }
            .animate-suck-in {
                animation: suck-in 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }
        `}</style>

        {/* Top Navigation Bar */}
        <div className="w-full pt-4 pb-2 px-4 z-20 flex flex-col gap-4">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between">
                <button 
                    onClick={onBack} 
                    className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200"
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="flex bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-full p-1 shadow-sm border border-white/20 dark:border-white/5">
                    <button 
                        onClick={() => setMode('STUDY')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${mode === 'STUDY' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Study
                    </button>
                    <button 
                        onClick={() => setMode('TEST')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${mode === 'TEST' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Test
                    </button>
                </div>

                <button 
                    onClick={() => setIsAdding(true)}
                    className="p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Progress Bar with IDs for Animation */}
            <div className="flex gap-1 w-full h-1 px-1">
                {words.map((_, idx) => (
                    <div 
                        key={idx} 
                        id={`progress-dot-${idx}`} 
                        className={`flex-1 rounded-full transition-all duration-300 ${
                            idx <= activeIndex 
                                ? 'bg-gray-800/80 dark:bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.5)]' 
                                : 'bg-gray-400/30 dark:bg-white/20'
                        }`}
                    ></div>
                ))}
            </div>
        </div>

        {/* =======================
            CONTENT AREA
           ======================= */}
        
        {mode === 'STUDY' ? renderStudyMode() : renderTestMode()}

        {/* Add Modal */}
        {isAdding && renderAddModal()}
    </div>
  );

  // --- RENDER: STUDY MODE ---
  function renderStudyMode() {
      const word = words[currentIndex];
      const nextWord = words[currentIndex + 1];

      return (
        <>
            <div 
                className="flex-1 w-full max-w-sm mx-auto px-6 relative z-10 flex items-center justify-center perspective-1200 mb-20"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Ghost Card */}
                {nextWord && (
                    <div 
                        className="absolute w-full aspect-[3/4] bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-[2.5rem] shadow-xl border border-white/20 dark:border-white/5 transform scale-90 translate-y-8 opacity-0 animate-[fade-in_0.5s_ease-out_forwards]"
                        style={{ zIndex: 0 }}
                    ></div>
                )}

                {/* Active Card */}
                <div 
                    ref={cardRef}
                    className={`relative w-full aspect-[3/4] transform-style-3d cursor-pointer transition-transform ${isDragging ? 'duration-0' : 'duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)'} ${isFlipped ? 'rotate-y-180' : ''}`}
                    style={{ 
                        transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg) ${isFlipped ? 'rotateY(180deg)' : ''}`,
                        zIndex: 10
                    }}
                    onClick={() => !isDragging && setIsFlipped(!isFlipped)}
                >
                    {/* Front Face */}
                    <div className="absolute inset-0 w-full h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-white/40 dark:border-white/10 backface-hidden flex flex-col items-center justify-center p-8 overflow-hidden">
                        
                        <div className="absolute bottom-[-20px] right-[-20px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                            <Feather size={200} />
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center z-10 w-full">
                            <span className="mb-6 font-sans text-gray-400 dark:text-gray-500 tracking-widest text-sm uppercase">
                                {word.phonetic || 'Pronunciation'}
                            </span>
                            <h2 className={`font-serif ${getWordFontSize(word.text)} text-gray-900 dark:text-white mb-8 text-center leading-tight tracking-tight whitespace-nowrap w-full transition-all duration-300`}>
                                {word.text}
                            </h2>
                            <div className="w-12 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mb-8"></div>
                        </div>
                        
                        <div className="text-[10px] font-bold tracking-[0.2em] text-gray-300 dark:text-gray-600 uppercase">
                            Tap to Reveal
                        </div>
                    </div>

                    {/* Back Face */}
                    <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 backface-hidden rotate-y-180 flex flex-col p-8 relative overflow-hidden">
                        <div className="flex-1 flex flex-col justify-center z-10">
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8 text-center leading-relaxed">
                                {word.meaning}
                            </h3>
                            {word.example && (
                                <div className="pl-6 border-l-2 border-indigo-200 dark:border-indigo-900 py-2 relative">
                                    <p className="font-serif italic text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                                        "{word.example}"
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-6 right-8 opacity-10">
                            <BookOpen size={64} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Study Controls */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-[85%] max-w-sm">
                <div className="h-16 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md shadow-2xl border border-white/50 dark:border-white/10 flex items-center justify-between px-2 sm:px-4">
                    <button 
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isAutoPlaying ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-white/10' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        title="Auto Play"
                    >
                        <Repeat size={20} />
                    </button>

                    <button 
                        onClick={handleManualPlay}
                        className="w-20 h-20 -mt-8 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full shadow-xl shadow-gray-900/20 dark:shadow-white/10 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full border border-white/30 dark:border-black/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                            <Volume2 size={32} strokeWidth={2.5} className="relative z-10" />
                        </div>
                    </button>

                    <button 
                        onClick={() => setShowListSheet(true)}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <List size={22} />
                    </button>
                </div>
            </div>

            {/* Word List Sheet */}
            {showListSheet && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowListSheet(false)}></div>
                    <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] h-[60%] w-full shadow-2xl animate-slide-up flex flex-col border-t border-gray-100 dark:border-slate-800">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mt-4 mb-4"></div>
                        <div className="px-6 pb-4 flex justify-between items-center border-b border-gray-50 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Word List</h3>
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{words.length} items</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {words.map((w, idx) => (
                                <button 
                                    key={w.id}
                                    onClick={() => {
                                        setCurrentIndex(idx);
                                        setShowListSheet(false);
                                        setIsFlipped(false);
                                    }}
                                    className={`w-full p-4 rounded-xl flex items-center justify-between text-left transition-colors ${
                                        idx === currentIndex 
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900' 
                                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`font-bold ${idx === currentIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                        {w.text}
                                    </span>
                                    <span className="text-sm text-gray-400 truncate max-w-[120px]">{w.meaning}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
      );
  }

  // --- RENDER: TEST MODE (Qwerty Learner Style) ---
  function renderTestMode() {
      const word = words[testIndex];
      const targetWord = word.text;
      const chars = targetWord.split('');

      return (
        <div className="flex-1 flex flex-col items-center justify-start pt-10 px-6 pb-20 max-w-lg mx-auto w-full relative z-10">
            
            {/* 1. Meaning Prompt */}
            <div className="mb-12 text-center animate-slide-up">
                 <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-2 drop-shadow-sm">
                    {word.meaning}
                 </h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 font-mono tracking-widest uppercase">
                    {word.phonetic}
                 </p>
            </div>

            {/* 2. Audio Control */}
            <button 
                onClick={() => {
                    playTestAudio();
                    inputRef.current?.focus();
                }}
                className="mb-16 w-16 h-16 bg-white/20 dark:bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 dark:hover:bg-white/10 transition-all shadow-sm border border-white/20"
            >
                <Volume2 size={28} className="text-gray-700 dark:text-gray-200" />
            </button>

            {/* 3. Input Slots (Qwerty Style) */}
            <div 
                ref={testContainerRef} // Ref for particle origin
                className={`flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 w-full transition-transform ${testStatus === 'ERROR' ? 'animate-shake' : ''}`}
                onClick={() => inputRef.current?.focus()}
            >
                {/* 
                   If SUCCESS, we hide the letters to emphasize the particles 
                   (or keep them but the particles spawn on top) 
                */}
                <div className={`flex flex-wrap justify-center gap-2 sm:gap-3 w-full transition-opacity duration-300 ${testStatus === 'SUCCESS' ? 'opacity-0' : 'opacity-100'}`}>
                    {chars.map((char, index) => {
                        const typedChar = testInput[index];
                        const isCurrent = index === testInput.length;
                        const isMatched = typedChar && typedChar.toLowerCase() === char.toLowerCase();
                        const isError = typedChar && !isMatched;
                        const isHinted = hintedIndices.has(index);

                        return (
                            <div 
                                key={index}
                                className={`
                                    relative w-10 h-14 sm:w-12 sm:h-16 flex items-end justify-center pb-2 text-3xl sm:text-4xl font-mono font-bold border-b-4 transition-all duration-300
                                    ${isCurrent && testStatus !== 'ERROR' ? 'border-gray-800 dark:border-gray-200 scale-110 -translate-y-1' : ''}
                                    ${isMatched && !isHinted ? 'text-green-600 dark:text-green-400 border-green-500' : ''}
                                    ${isMatched && isHinted ? 'text-amber-500 dark:text-amber-400 border-amber-500' : ''}
                                    ${isError ? 'text-red-500 border-red-500' : ''}
                                    ${!typedChar && !isCurrent ? 'border-gray-300 dark:border-gray-700 text-transparent' : ''}
                                `}
                            >
                                {/* Cursor */}
                                {isCurrent && testStatus === 'IDLE' && (
                                    <div className="absolute inset-0 bg-gray-500/10 dark:bg-white/10 animate-pulse rounded-t-lg"></div>
                                )}
                                
                                {/* Character */}
                                {typedChar}

                                {/* Hint indicator */}
                                {isMatched && isHinted && (
                                    <div className="absolute top-1 right-1">
                                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping absolute opacity-75"></div>
                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full relative"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Hidden Input for Global Typing */}
            <input 
                ref={inputRef}
                autoFocus
                type="text"
                value={testInput}
                onChange={handleTestInputChange}
                className="opacity-0 absolute top-0 left-0 w-full h-full cursor-default z-0"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />

            {/* 4. Feedback / Hint */}
            <div className="mt-auto h-20 w-full flex flex-col items-center justify-end z-20 pointer-events-none">
                {testStatus === 'SUCCESS' && (
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-6 py-3 rounded-full font-bold animate-slide-up shadow-lg backdrop-blur-md">
                        <CheckCircle2 size={24} />
                        <span>Perfect!</span>
                    </div>
                )}

                {testStatus === 'ERROR' && (
                     <div className="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 px-6 py-3 rounded-full font-bold animate-fade-in shadow-lg backdrop-blur-md">
                        <XCircle size={24} />
                        <span>Try Again</span>
                     </div>
                )}
                
                {testStatus === 'IDLE' && (
                     <div className="pointer-events-auto flex gap-4">
                        <button 
                            onClick={handleHint}
                            disabled={testInput.length >= targetWord.length}
                            className="px-6 py-2.5 bg-white dark:bg-slate-800 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            <Lightbulb size={16} className={testInput.length < targetWord.length ? "fill-current" : ""} />
                            Hint
                        </button>
                        <button 
                            onClick={() => inputRef.current?.focus()}
                            className="sm:hidden px-4 py-2 bg-gray-200 dark:bg-slate-800 rounded-full text-gray-600 dark:text-gray-300 flex items-center gap-2 shadow-sm"
                        >
                            <Keyboard size={16} />
                        </button>
                     </div>
                )}
            </div>
        </div>
      );
  }

  // --- ADD MODAL (Shared) ---
  function renderAddModal() {
    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-pop border dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-gray-800 dark:text-white">Add New Word</h3>
                <div className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-xs text-primary dark:text-indigo-300 rounded font-semibold flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>AI Enabled</span>
                </div>
             </div>
             
             <div className="space-y-4">
               <div className="relative">
                  <input 
                    placeholder="English Word" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500/30 p-3 pr-12 rounded-xl outline-none transition-all font-medium text-lg dark:text-white"
                    value={newWord.text || ''}
                    onChange={e => setNewWord({...newWord, text: e.target.value})}
                    onKeyDown={(e) => e.key === 'Enter' && autoFillWordData()}
                  />
                   <button 
                        onClick={autoFillWordData}
                        disabled={isAutoFilling || !newWord.text}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Auto-fill definitions with AI"
                    >
                        {isAutoFilling ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                    </button>
               </div>
               <div>
                  <input 
                    placeholder="Meaning (Chinese)" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500/30 p-3 rounded-xl outline-none transition-all dark:text-white"
                    value={newWord.meaning || ''}
                    onChange={e => setNewWord({...newWord, meaning: e.target.value})}
                  />
               </div>
               <div className="grid grid-cols-1 gap-4">
                 <input 
                    placeholder="Phonetic (Optional)" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500/30 p-3 rounded-xl outline-none transition-all font-mono text-sm dark:text-white"
                    value={newWord.phonetic || ''}
                    onChange={e => setNewWord({...newWord, phonetic: e.target.value})}
                 />
               </div>
               <textarea 
                 placeholder="Example Sentence (Optional)" 
                 className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500/30 p-3 rounded-xl outline-none transition-all h-24 resize-none dark:text-white"
                 value={newWord.example || ''}
                 onChange={e => setNewWord({...newWord, example: e.target.value})}
               />
             </div>
             <div className="flex justify-end space-x-3 mt-8">
               <button onClick={() => setIsAdding(false)} className="px-5 py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors">Cancel</button>
               <button onClick={handleAddWord} className="px-5 py-3 bg-gray-900 dark:bg-white dark:text-black text-white rounded-xl font-medium shadow-lg hover:scale-105 transition-all">Add Word</button>
             </div>
           </div>
        </div>
    );
  }
};

export default WordModule;
