
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sentence } from '../types';
import { db } from '../services/storage';
import { tts } from '../services/audio';
import { dictionaryService } from '../services/dictionary';
import { 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Loader2, 
  Play, 
  Pause, 
  Turtle, 
  Repeat, 
  Trash2,
  MoreVertical,
  Volume2,
  Leaf,
  Flower2
} from 'lucide-react';
import InteractiveText from './ui/InteractiveText';
import WordPortal from './WordPortal';

interface Props {
  unitId: string;
  onBack: () => void;
}

interface PortalState {
  word: string;
  rect: DOMRect;
}

const SentenceModule: React.FC<Props> = ({ unitId, onBack }) => {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  
  // Navigation & View State
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interaction State
  const [revealedTranslations, setRevealedTranslations] = useState<Set<string>>(new Set());
  const [activePortal, setActivePortal] = useState<PortalState | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'normal' | 'slow'>('normal');
  const [isLooping, setIsLooping] = useState(false);
  // NEW: Track char index for highlighting
  const [spokenCharIndex, setSpokenCharIndex] = useState(-1);

  // Add Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newSent, setNewSent] = useState<Partial<Sentence>>({});
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  useEffect(() => {
    setSentences(db.getSentences(unitId));
    return () => tts.cancel();
  }, [unitId]);

  // --- Scroll Snap Logic (Intersection Observer) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            // Debounce the index update slightly to avoid rapid firing during fast scroll
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => {
                setCurrentIndex(index);
                // Reset states when changing page
                setIsPlaying(false);
                setSpokenCharIndex(-1);
                tts.cancel();
            }, 100);
          }
        });
      },
      {
        root: container,
        threshold: 0.6, // Trigger when 60% visible
      }
    );

    const children = container.querySelectorAll('.sentence-slide');
    children.forEach((child) => observer.observe(child));

    return () => {
      observer.disconnect();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [sentences.length]);

  // --- Audio Logic ---
  const handlePlay = useCallback(() => {
    const currentSent = sentences[currentIndex];
    if (!currentSent) return;

    if (isPlaying) {
      tts.cancel();
      setIsPlaying(false);
      setSpokenCharIndex(-1);
    } else {
      setIsPlaying(true);
      setSpokenCharIndex(0);
      const rate = playMode === 'slow' ? 0.6 : 1.0;
      
      tts.speak(
        currentSent.text, 
        () => {
          setIsPlaying(false);
          setSpokenCharIndex(-1);
          if (isLooping) {
            setTimeout(() => handlePlay(), 500);
          }
        }, 
        rate,
        (charIndex) => {
            console.log('SentenceModule: Updating spokenCharIndex:', charIndex);
            setSpokenCharIndex(charIndex);
        }
      );
    }
  }, [sentences, currentIndex, isPlaying, playMode, isLooping]);

  // If mode changes while playing, restart
  useEffect(() => {
    if (isPlaying) {
        tts.cancel();
        handlePlay();
    }
  }, [playMode]);

  const handleWordClick = (word: string, rect: DOMRect) => {
    tts.cancel();
    setIsPlaying(false);
    setSpokenCharIndex(-1);
    
    // Quick speak just the word first
    tts.speak(word, undefined, 0.9);
    
    // Open Portal
    setActivePortal({ word, rect });
  };

  const toggleTranslation = (id: string) => {
    setRevealedTranslations(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  // --- Data Operations ---
  const handleAdd = () => {
    if (!newSent.text || !newSent.translation) return;
    db.addSentence({
      id: crypto.randomUUID(),
      unitId,
      text: newSent.text,
      translation: newSent.translation
    } as Sentence);
    setSentences(db.getSentences(unitId));
    setIsAdding(false);
    setNewSent({});
    // Scroll to new sentence (last one)
    setTimeout(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, 100);
  };

  const handleDelete = () => {
    const currentSent = sentences[currentIndex];
    if (currentSent && confirm("Delete this sentence?")) {
      db.deleteSentence(currentSent.id);
      const newSentences = sentences.filter(s => s.id !== currentSent.id);
      setSentences(newSentences);
      // Adjust index if needed
      if (currentIndex >= newSentences.length) {
        setCurrentIndex(Math.max(0, newSentences.length - 1));
      }
      setIsMenuOpen(false);
    }
  };

  const autoFillTranslation = async () => {
    if (!newSent.text || isAutoFilling) return;
    setIsAutoFilling(true);
    try {
        const translation = await dictionaryService.translateToChinese(newSent.text);
        if (translation) {
            setNewSent(prev => ({ ...prev, translation }));
        }
    } catch (e) {
        console.error("Translation failed", e);
    } finally {
        setIsAutoFilling(false);
    }
  };

  // --- Render Helpers ---
  const getDynamicFontSize = (text: string) => {
    const len = text.split(' ').length;
    if (len <= 6) return 'text-4xl sm:text-5xl text-center leading-tight';
    if (len <= 12) return 'text-3xl sm:text-4xl text-left leading-snug';
    return 'text-2xl sm:text-3xl text-left leading-relaxed';
  };

  // Theme Logic
  const theme = currentIndex % 2 === 0 ? 'bamboo' : 'flower';

  return (
    <div className={`h-full font-sans relative overflow-hidden transition-all duration-1000 ease-in-out
        ${theme === 'bamboo' 
           ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950' 
           : 'bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950 dark:via-purple-950 dark:to-fuchsia-950'}
    `}>
      
      {/* 0. Background Decoration Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         {/* Bamboo Theme Decorations */}
         <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'bamboo' ? 'opacity-100' : 'opacity-0'}`}>
             {/* Abstract Glows */}
             <div className="absolute top-[-10%] left-[10%] w-64 h-64 bg-green-200/40 dark:bg-green-800/20 rounded-full blur-3xl rotate-[-20deg]"></div>
             <div className="absolute bottom-[20%] right-[-10%] w-80 h-80 bg-emerald-200/30 dark:bg-emerald-800/20 rounded-full blur-3xl rotate-[30deg]"></div>
             
             {/* Bamboo Leaves (Icons & Shapes) */}
             <Leaf className="absolute top-24 left-8 text-green-300/60 dark:text-green-700/30 w-16 h-16 rotate-[-45deg] animate-breathe" strokeWidth={1.5} />
             <div className="absolute top-40 left-[-10px] w-24 h-4 bg-green-300/30 dark:bg-green-700/20 rounded-full rotate-[30deg]"></div>
             
             <Leaf className="absolute bottom-40 right-10 text-emerald-300/50 dark:text-emerald-700/30 w-24 h-24 rotate-[15deg]" strokeWidth={1} />
             <div className="absolute bottom-60 right-[-20px] w-32 h-6 bg-emerald-300/20 dark:bg-emerald-700/10 rounded-full rotate-[-10deg]"></div>
         </div>

         {/* Flower Theme Decorations */}
         <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'flower' ? 'opacity-100' : 'opacity-0'}`}>
             {/* Abstract Glows */}
             <div className="absolute top-[-10%] right-[20%] w-64 h-64 bg-pink-200/40 dark:bg-pink-800/20 rounded-full blur-3xl"></div>
             <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-purple-200/30 dark:bg-purple-800/20 rounded-full blur-3xl"></div>
             
             {/* Petals (Icons & Shapes) */}
             <Flower2 className="absolute top-32 right-12 text-pink-300/60 dark:text-pink-700/30 w-20 h-20 rotate-12 animate-breathe" strokeWidth={1} />
             
             {/* Scattered Petals */}
             <div className="absolute top-1/2 left-12 w-4 h-4 bg-pink-300/50 dark:bg-pink-700/30 rounded-full rounded-tr-none rotate-45"></div>
             <div className="absolute top-40 left-24 w-3 h-3 bg-purple-300/40 dark:bg-purple-700/30 rounded-full rounded-bl-none rotate-12"></div>
             <div className="absolute bottom-32 left-20 w-6 h-6 bg-fuchsia-300/40 dark:bg-fuchsia-700/30 rounded-full rounded-tl-none rotate-[-45deg]"></div>
         </div>
      </div>

      {/* 1. Top Controls */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-between items-start pointer-events-none">
         <button onClick={onBack} className="pointer-events-auto p-3 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-full text-gray-800 dark:text-gray-200 hover:bg-white/40 dark:hover:bg-white/20 transition-colors shadow-sm">
            <ArrowLeft size={24} />
         </button>

         <div className="flex flex-col items-end gap-2 pointer-events-auto">
             <div className="px-3 py-1 bg-black/5 dark:bg-white/5 backdrop-blur-sm rounded-full text-xs font-mono font-bold text-gray-600 dark:text-gray-300">
                {(currentIndex + 1).toString().padStart(2, '0')} / {sentences.length.toString().padStart(2, '0')}
             </div>
             
             {/* Context Menu for current slide */}
             <div className="relative">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-3 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-full text-gray-800 dark:text-gray-200 hover:bg-white/40 transition-colors shadow-sm"
                >
                    <MoreVertical size={24} />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pop origin-top-right">
                        <button onClick={handleDelete} className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                )}
             </div>
         </div>
      </div>

      {/* 2. Vertical Progress Bar */}
      <div className="absolute right-1 top-1/4 bottom-1/4 w-1 z-20 flex flex-col items-center justify-center gap-1 opacity-40">
        {sentences.map((_, idx) => (
            <div 
                key={idx} 
                className={`w-1 rounded-full transition-all duration-300 ${
                    idx === currentIndex 
                    ? 'h-6 bg-gray-800 dark:bg-white' 
                    : 'h-1 bg-gray-400 dark:bg-gray-500'
                }`}
            />
        ))}
      </div>

      {/* 3. Main Full-Screen Scroll Container */}
      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar relative z-10"
      >
        {sentences.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center">
                 <div className="w-20 h-20 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 animate-pulse backdrop-blur-sm">
                    <Plus className="text-gray-500 dark:text-gray-400" size={32} />
                 </div>
                 <p className="text-gray-600 dark:text-gray-300 font-serif text-xl">Tap + to add sentences</p>
             </div>
        )}

        {sentences.map((sent, idx) => {
            const isRevealed = revealedTranslations.has(sent.id);
            const dynamicClass = getDynamicFontSize(sent.text);
            
            return (
                <div 
                    key={sent.id} 
                    data-index={idx}
                    className="sentence-slide h-full w-full snap-center shrink-0 flex flex-col items-center justify-center px-8 sm:px-12 relative"
                >
                    {/* Decorative Background Text (Watermark) */}
                    <div className="absolute select-none pointer-events-none text-[12rem] font-serif font-bold text-gray-900/5 dark:text-white/5 z-0 top-20 left-10 overflow-hidden" style={{ lineHeight: 0.8 }}>
                        {idx + 1}
                    </div>

                    <div className="relative z-10 w-full max-w-3xl">
                        {/* English Text */}
                        <div className={`font-serif font-medium text-gray-900 dark:text-gray-100 mb-12 transition-all duration-500 ${dynamicClass}`}>
                            <InteractiveText 
                                text={sent.text} 
                                spokenCharIndex={currentIndex === idx ? spokenCharIndex : -1}
                                onWordClick={handleWordClick}
                                className=""
                            />
                        </div>

                        {/* Translation (The Blur) */}
                        <div 
                            onClick={() => toggleTranslation(sent.id)}
                            className="relative cursor-pointer group"
                        >
                            <div className={`
                                transition-all duration-700 ease-out transform origin-top-left
                                ${isRevealed ? 'blur-none opacity-100 translate-y-0' : 'blur-md opacity-40 hover:opacity-60 translate-y-2'}
                            `}>
                                <p className={`text-lg sm:text-xl font-light leading-relaxed select-none ${theme === 'bamboo' ? 'text-emerald-900/80 dark:text-emerald-100/80' : 'text-purple-900/80 dark:text-purple-100/80'}`}>
                                    {sent.translation}
                                </p>
                            </div>
                            
                            {!isRevealed && (
                                <div className={`absolute -top-6 left-0 text-xs font-bold tracking-widest uppercase pointer-events-none ${theme === 'bamboo' ? 'text-emerald-700/40 dark:text-emerald-300/40' : 'text-purple-700/40 dark:text-purple-300/40'}`}>
                                    Tap to reveal
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* 4. Floating Control Capsule */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 w-auto">
        <div className="flex items-center gap-1 p-1.5 bg-white/70 dark:bg-black/60 backdrop-blur-xl rounded-full shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/5">
            
            {/* Play/Pause */}
            <button 
                onClick={handlePlay}
                className={`w-14 h-14 text-white dark:text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all
                    ${theme === 'bamboo' ? 'bg-emerald-900 dark:bg-emerald-100' : 'bg-purple-900 dark:bg-purple-100'}
                `}
            >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1"/>}
            </button>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-400/30 dark:bg-white/20 mx-2"></div>

            {/* Slow Mode Toggle */}
            <button 
                onClick={() => setPlayMode(prev => prev === 'normal' ? 'slow' : 'normal')}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playMode === 'slow' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                title="Slow Mode"
            >
                <Turtle size={20} />
            </button>

            {/* Loop Toggle */}
            <button 
                onClick={() => setIsLooping(!isLooping)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isLooping ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                title="Loop Current"
            >
                <Repeat size={18} />
            </button>

            {/* Add Button (Mini) */}
            <div className="w-px h-6 bg-gray-400/30 dark:bg-white/20 mx-2"></div>
             <button 
                onClick={() => setIsAdding(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
                title="Add New"
            >
                <Plus size={22} />
            </button>
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-pop border border-gray-100 dark:border-slate-800">
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-serif font-bold text-2xl text-gray-900 dark:text-white">New Entry</h3>
                <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-600 dark:text-emerald-400 rounded font-bold uppercase tracking-wide flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>AI Assist</span>
                </div>
             </div>
             
             <div className="space-y-6">
               <div className="relative group">
                   <textarea 
                     autoFocus
                     placeholder="Paste English sentence..." 
                     className="w-full bg-transparent border-b-2 border-gray-100 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 p-2 outline-none transition-all h-24 resize-none text-xl font-serif text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                     value={newSent.text || ''}
                     onChange={e => setNewSent({...newSent, text: e.target.value})}
                   />
                    <button 
                        onClick={autoFillTranslation}
                        disabled={isAutoFilling || !newSent.text}
                        className="absolute right-0 bottom-4 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full text-xs font-bold transition-colors disabled:opacity-30"
                    >
                        {isAutoFilling ? <Loader2 className="animate-spin" size={14}/> : 'TRANSLATE'}
                    </button>
               </div>
               
               <div className="group">
                 <input 
                   placeholder="Chinese translation" 
                   className="w-full bg-transparent border-b-2 border-gray-100 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 p-2 outline-none transition-all text-base text-gray-600 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                   value={newSent.translation || ''}
                   onChange={e => setNewSent({...newSent, translation: e.target.value})}
                 />
               </div>
             </div>

             <div className="flex justify-end space-x-4 mt-10">
               <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 font-medium transition-colors text-sm uppercase tracking-wide">Cancel</button>
               <button onClick={handleAdd} className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-sm uppercase tracking-wide">Save Entry</button>
             </div>
           </div>
        </div>
      )}

      {/* REPLACED MODAL WITH PORTAL */}
      {activePortal && (
          <WordPortal 
            word={activePortal.word} 
            originRect={activePortal.rect}
            onClose={() => setActivePortal(null)} 
          />
      )}

      {/* Styles for interactive words override */}
      <style>{`
        .interactive-word:hover {
            background-color: transparent !important;
            color: inherit !important;
            text-decoration: underline;
            text-decoration-color: ${theme === 'bamboo' ? '#10b981' : '#d946ef'};
            text-decoration-thickness: 2px;
            text-underline-offset: 4px;
        }
        .interactive-word:active {
            transform: scale(0.95);
        }
        /* Custom highlight for Zen Mode - Pill shape */
        .highlight-word {
            background-color: ${theme === 'bamboo' ? '#d1fae5' : '#f5d0fe'} !important;
            color: ${theme === 'bamboo' ? '#064e3b' : '#701a75'} !important;
            border-radius: 999px;
            padding: 0px 8px;
            margin: 0 -8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            z-index: 5;
        }
        .dark .highlight-word {
            background-color: ${theme === 'bamboo' ? '#065f46' : '#86198f'} !important;
            color: ${theme === 'bamboo' ? '#ecfdf5' : '#fdf4ff'} !important;
        }
      `}</style>
    </div>
  );
};

export default SentenceModule;
