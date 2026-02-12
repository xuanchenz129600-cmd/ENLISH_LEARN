import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TextData } from '../types';
import { db } from '../services/storage';
import { tts } from '../services/audio';
import { dictionaryService } from '../services/dictionary';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  Globe, 
  Plus, 
  FileText, 
  Sparkles, 
  Loader2, 
  Settings,
  Eye,
  EyeOff,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import InteractiveText from './ui/InteractiveText';
import WordPortal from './WordPortal';

interface Props {
  unitId: string;
  onBack: () => void;
}

// Helper to split text into structured paragraphs and sentences
interface ParsedParagraph {
  id: string;
  text: string;
  sentences: string[];
  translation?: string;
}

interface PortalState {
  word: string;
  rect: DOMRect;
}

const TextModule: React.FC<Props> = ({ unitId, onBack }) => {
  const [texts, setTexts] = useState<TextData[]>([]);
  const [selectedText, setSelectedText] = useState<TextData | null>(null);
  
  // --- Reading State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentence, setActiveSentence] = useState<{pIndex: number, sIndex: number} | null>(null);
  const [currentSpokenChar, setCurrentSpokenChar] = useState<number>(-1); // For Lens Reader
  const [expandedTranslations, setExpandedTranslations] = useState<Set<number>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  
  // --- Edit/Add State ---
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState<Partial<TextData>>({});
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // --- Portal State ---
  const [activePortal, setActivePortal] = useState<PortalState | null>(null);

  // --- Refs ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTexts(db.getTexts(unitId));
    return () => tts.cancel();
  }, [unitId]);

  // --- Parsing Logic ---
  const parsedContent = useMemo(() => {
    if (!selectedText) return [];
    
    // Split content by double newlines for paragraphs
    const rawParagraphs = selectedText.content.split(/\n\s*\n/).filter(p => p.trim());
    // Try to split translation similarly
    const rawTransParagraphs = selectedText.translation 
        ? selectedText.translation.split(/\n\s*\n/).filter(t => t.trim()) 
        : [];

    return rawParagraphs.map((paraText, idx) => {
        // Split paragraph into sentences (naive regex)
        // Match sentence endings (. ? !) followed by space or end of string
        const sentences = paraText.match( /[^.!?]+[.!?]+["']?|[^.!?]+$/g ) || [paraText];
        
        return {
            id: `p-${idx}`,
            text: paraText,
            sentences: sentences.map(s => s.trim()).filter(s => s),
            translation: rawTransParagraphs[idx] || (idx === rawParagraphs.length -1 && rawTransParagraphs.length === 1 ? rawTransParagraphs[0] : undefined)
        } as ParsedParagraph;
    });
  }, [selectedText]);

  // --- Audio Logic ---
  // Flatten sentences for easy playback navigation
  const flatPlayList = useMemo(() => {
      const list: {pIndex: number, sIndex: number, text: string}[] = [];
      parsedContent.forEach((p, pIndex) => {
          p.sentences.forEach((s, sIndex) => {
              list.push({ pIndex, sIndex, text: s });
          });
      });
      return list;
  }, [parsedContent]);

  const playNext = (currentIndex: number) => {
      if (currentIndex >= flatPlayList.length - 1) {
          setIsPlaying(false);
          setActiveSentence(null);
          setCurrentSpokenChar(-1);
          return;
      }
      const nextIdx = currentIndex + 1;
      const nextItem = flatPlayList[nextIdx];
      
      setActiveSentence({ pIndex: nextItem.pIndex, sIndex: nextItem.sIndex });
      setCurrentSpokenChar(0); // Reset lens for new sentence
      
      // Auto Scroll
      setTimeout(() => {
          activeSentenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      tts.speak(
          nextItem.text, 
          () => playNext(nextIdx), 
          1.0, 
          (charIndex) => setCurrentSpokenChar(charIndex) // Lens Callback
      );
  };

  const togglePlay = () => {
      if (isPlaying) {
          tts.cancel();
          setIsPlaying(false);
          setCurrentSpokenChar(-1);
      } else {
          setIsPlaying(true);
          let startIndex = 0;
          if (activeSentence) {
              startIndex = flatPlayList.findIndex(
                  item => item.pIndex === activeSentence.pIndex && item.sIndex === activeSentence.sIndex
              );
              if (startIndex === -1) startIndex = 0;
          }
          const item = flatPlayList[startIndex];
          if (item) {
              setCurrentSpokenChar(0);
              tts.speak(
                  item.text, 
                  () => playNext(startIndex),
                  1.0,
                  (charIndex) => setCurrentSpokenChar(charIndex)
              );
          }
      }
  };

  const handleSentenceClick = (pIndex: number, sIndex: number, text: string) => {
      tts.cancel();
      setIsPlaying(false); // Pause auto-play sequence on manual click
      setActiveSentence({ pIndex, sIndex });
      setCurrentSpokenChar(0);
      
      tts.speak(
          text, 
          () => { 
              setIsPlaying(false); 
              setCurrentSpokenChar(-1); 
          },
          1.0,
          (charIndex) => setCurrentSpokenChar(charIndex)
      );
  };

  const toggleTranslation = (pIndex: number) => {
      setExpandedTranslations(prev => {
          const next = new Set(prev);
          if (next.has(pIndex)) next.delete(pIndex);
          else next.add(pIndex);
          return next;
      });
  };

  const toggleAllTranslations = () => {
      if (expandedTranslations.size === parsedContent.length) {
          setExpandedTranslations(new Set());
      } else {
          const all = new Set(parsedContent.map((_, i) => i));
          setExpandedTranslations(all);
      }
  };

  // --- CRUD Handlers ---
  const handleAdd = () => {
    if (!newText.title || !newText.content) return;
    db.addText({
      id: crypto.randomUUID(),
      unitId,
      title: newText.title,
      content: newText.content,
      translation: newText.translation || ''
    } as TextData);
    setTexts(db.getTexts(unitId));
    setIsAdding(false);
    setNewText({});
  };

  const autoFillTranslation = async () => {
    if (!newText.content || isAutoFilling) return;
    setIsAutoFilling(true);
    try {
        const translation = await dictionaryService.translateToChinese(newText.content);
        if (translation) {
            setNewText(prev => ({ ...prev, translation }));
        }
    } catch (e) {
        console.error("Translation failed", e);
    } finally {
        setIsAutoFilling(false);
    }
  };

  // --- Parallax Effect ---
  const [scrollY, setScrollY] = useState(0);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollY(e.currentTarget.scrollTop);
  };

  // --------------------------------------------------------------------------
  // RENDER: READING VIEW (Ink & Flow)
  // --------------------------------------------------------------------------
  if (selectedText) {
    return (
      <div className="flex flex-col h-full bg-stone-50 dark:bg-black text-stone-800 dark:text-stone-500 font-sans relative overflow-hidden transition-colors duration-700 group/theme">
        
        {/* === LAYER 0: ATMOSPHERE === */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
             {/* Noise Texture */}
             <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1] bg-noise mix-blend-multiply dark:mix-blend-overlay"></div>
             
             {/* Day Blobs (Komorebi) */}
             <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-orange-200/20 dark:bg-transparent rounded-full blur-3xl animate-float-slow opacity-100 dark:opacity-0 transition-opacity duration-1000"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-amber-100/30 dark:bg-transparent rounded-full blur-3xl animate-float-delayed opacity-100 dark:opacity-0 transition-opacity duration-1000"></div>

             {/* Night Blobs (Floating Ink) - Reduced for Lens focus */}
             <div className="absolute top-[-10%] right-[-20%] w-[70vw] h-[70vw] bg-transparent dark:bg-indigo-950/20 rounded-full blur-3xl animate-float-slow opacity-0 dark:opacity-100 transition-opacity duration-1000"></div>
             <div className="absolute bottom-[-20%] left-[-10%] w-[90vw] h-[90vw] bg-transparent dark:bg-violet-950/10 rounded-full blur-3xl animate-float-delayed opacity-0 dark:opacity-100 transition-opacity duration-1000"></div>
             
             {/* Parallax Abstract Line */}
             <svg 
                className="absolute top-0 left-0 w-full h-[150%] opacity-10 dark:opacity-5 transition-transform duration-75 ease-out"
                style={{ transform: `translateY(-${scrollY * 0.2}px)` }}
                viewBox="0 0 100 200" preserveAspectRatio="none"
             >
                <path d="M50 0 C 20 50, 80 100, 50 200" stroke="currentColor" strokeWidth="0.5" fill="none" />
             </svg>

             {/* Watermark Title Char */}
             <div className="absolute top-20 right-[-2rem] text-[15rem] font-serif leading-none font-bold text-stone-900/5 dark:text-stone-100/5 select-none pointer-events-none z-0">
                {selectedText.title.charAt(0)}
             </div>
        </div>

        {/* === LAYER 1: HEADER === */}
        <div className="sticky top-0 z-40 px-4 py-3 flex justify-between items-center backdrop-blur-md bg-stone-50/80 dark:bg-black/80 border-b border-stone-200/50 dark:border-white/5 transition-colors">
            <button 
                onClick={() => { setSelectedText(null); tts.cancel(); }} 
                className="p-2 -ml-2 rounded-full hover:bg-stone-200 dark:hover:bg-white/10 transition-colors text-stone-600 dark:text-stone-400"
            >
                <ArrowLeft size={22} />
            </button>
            
            {/* Minimal Progress Bar */}
            <div className="flex-1 mx-6 h-0.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-stone-800 dark:bg-stone-200 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, (scrollY / ((scrollContainerRef.current?.scrollHeight || 1) - window.innerHeight)) * 100)}%` }}
                ></div>
            </div>

            <button className="p-2 rounded-full text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors">
                <Settings size={20} />
            </button>
        </div>

        {/* === LAYER 2: CONTENT SCROLL === */}
        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto z-10 relative scroll-smooth pb-32"
        >
            <div className="max-w-2xl mx-auto px-6 py-10 sm:px-10">
                {/* Hero */}
                <header className="mb-12 text-center">
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold text-stone-900 dark:text-white mb-6 leading-tight tracking-tight">
                        {selectedText.title}
                    </h1>
                    <div className="flex items-center justify-center space-x-4 text-xs font-mono uppercase tracking-widest text-stone-400 dark:text-stone-500">
                        <span>{selectedText.content.split(' ').length} Words</span>
                        <span>•</span>
                        <span>Ink & Flow</span>
                    </div>
                </header>

                {/* Article Body */}
                <div className={`space-y-10 transition-all duration-500 ${focusMode ? 'grayscale-[0.5]' : ''}`}>
                    {parsedContent.map((para, pIndex) => (
                        <div 
                            key={para.id} 
                            className={`relative group/para transition-opacity duration-500 ${focusMode && activeSentence?.pIndex !== pIndex ? 'opacity-30 blur-[1px]' : 'opacity-100'}`}
                        >
                            {/* Paragraph Text */}
                            <p className="text-xl leading-9 sm:text-2xl sm:leading-[2.2] font-serif">
                                {para.sentences.map((sent, sIndex) => {
                                    const isActive = activeSentence?.pIndex === pIndex && activeSentence?.sIndex === sIndex;
                                    
                                    // Drop Cap logic for very first letter
                                    const isFirstLetter = pIndex === 0 && sIndex === 0;

                                    return (
                                        <span 
                                            key={sIndex}
                                            ref={isActive ? activeSentenceRef : null}
                                            onClick={() => handleSentenceClick(pIndex, sIndex, sent)}
                                            className={`
                                                relative inline transition-all duration-300 cursor-pointer rounded-lg box-decoration-clone px-1 -mx-1 py-0.5
                                                ${isActive 
                                                    ? 'bg-orange-100/60 shadow-sm text-stone-900 font-medium dark:bg-transparent' // Dark mode removes bg, relies on Lens Reader
                                                    : 'hover:bg-stone-100 dark:hover:bg-white/5'}
                                                ${isFirstLetter ? 'float-left text-6xl leading-[0.8] pr-2 pt-1 font-bold text-orange-400 dark:text-indigo-500 font-serif' : ''}
                                            `}
                                        >
                                            <InteractiveText 
                                                text={sent} 
                                                spokenCharIndex={isActive ? currentSpokenChar : -1}
                                                onWordClick={(w, rect) => {
                                                    tts.cancel();
                                                    setIsPlaying(false);
                                                    setActivePortal({ word: w, rect });
                                                }} 
                                            />
                                            {/* Space between sentences */}
                                            <span className="mr-1.5"> </span> 
                                        </span>
                                    );
                                })}
                            </p>

                            {/* Translation Trigger (Side Icon) */}
                            <button 
                                onClick={() => toggleTranslation(pIndex)}
                                className={`
                                    absolute -right-4 top-1 translate-x-full p-2 text-stone-300 hover:text-stone-600 dark:text-stone-700 dark:hover:text-stone-400 transition-colors
                                    opacity-0 group-hover/para:opacity-100 sm:opacity-0
                                    ${expandedTranslations.has(pIndex) ? 'opacity-100 text-orange-400 dark:text-indigo-400' : ''}
                                `}
                            >
                                <Globe size={18} />
                            </button>

                            {/* Accordion Translation */}
                            <div 
                                className={`
                                    overflow-hidden transition-all duration-500 ease-in-out border-l-2 border-orange-200 dark:border-indigo-900 mt-2
                                    ${expandedTranslations.has(pIndex) ? 'max-h-[500px] opacity-100 pl-4 py-2' : 'max-h-0 opacity-0 pl-0 py-0'}
                                `}
                            >
                                <p className="text-stone-500 dark:text-stone-400 leading-relaxed font-light text-base sm:text-lg">
                                    {para.translation || "No translation available for this section."}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Spacer */}
                <div className="h-24"></div>
            </div>
        </div>

        {/* === LAYER 3: FLOATING DOCK === */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-auto max-w-sm">
             <div className="flex items-center gap-2 p-2 pl-3 bg-stone-900/90 dark:bg-white/10 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 dark:border-white/10 ring-1 ring-black/5">
                
                {/* Focus Mode */}
                <button 
                    onClick={() => setFocusMode(!focusMode)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${focusMode ? 'text-white dark:text-white bg-white/10 dark:bg-white/20' : 'text-stone-500 dark:text-stone-400 hover:text-white dark:hover:text-white'}`}
                >
                    {focusMode ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>

                <div className="w-px h-5 bg-white/10 dark:bg-white/10"></div>

                {/* Play/Pause Main Button */}
                <button 
                    onClick={togglePlay}
                    className="w-14 h-14 bg-stone-100 dark:bg-white text-stone-900 dark:text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1"/>}
                </button>

                <div className="w-px h-5 bg-white/10 dark:bg-white/10"></div>

                {/* Translate All */}
                <button 
                    onClick={toggleAllTranslations}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${expandedTranslations.size > 0 ? 'text-orange-400 dark:text-indigo-400' : 'text-stone-500 dark:text-stone-400 hover:text-white dark:hover:text-white'}`}
                >
                    <Globe size={18} />
                </button>
             </div>
        </div>

        {/* REPLACED MODAL WITH PORTAL */}
        {activePortal && (
          <WordPortal 
             word={activePortal.word} 
             originRect={activePortal.rect}
             onClose={() => setActivePortal(null)} 
           />
        )}
        
        {/* Local Styles for specific animations */}
        <style>{`
          .bg-noise {
             background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E");
          }
          @keyframes float-slow {
             0%, 100% { transform: translate(0, 0) scale(1); }
             33% { transform: translate(30px, -50px) scale(1.1); }
             66% { transform: translate(-20px, 20px) scale(0.95); }
          }
          @keyframes float-delayed {
             0%, 100% { transform: translate(0, 0) scale(1); }
             33% { transform: translate(-30px, 50px) scale(1.15); }
             66% { transform: translate(20px, -20px) scale(0.9); }
          }
          .animate-float-slow {
             animation: float-slow 20s ease-in-out infinite;
          }
          .animate-float-delayed {
             animation: float-delayed 25s ease-in-out infinite reverse;
          }
        `}</style>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: LIST VIEW (Refreshed)
  // --------------------------------------------------------------------------
  return (
    <div className="h-full bg-stone-50 dark:bg-black flex flex-col transition-colors duration-300">
       {/* Background Noise for List View too */}
       <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-noise pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"></div>
       
       <div className="relative z-10 bg-white/50 dark:bg-white/5 p-6 border-b border-stone-100 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
         <div className="flex items-center">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 rounded-full mr-2 transition-colors"><ArrowLeft /></button>
            <div>
                <h2 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-100">Reading</h2>
                <p className="text-xs font-mono uppercase tracking-widest text-stone-400">Immersion</p>
            </div>
         </div>
       </div>

       <div className="relative z-10 flex-1 overflow-y-auto p-4 grid gap-4 content-start pb-24">
         {texts.map((text, idx) => (
            <div 
              key={text.id} 
              onClick={() => setSelectedText(text)}
              className="bg-white dark:bg-white/5 p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-none border border-stone-100 dark:border-white/5 hover:border-orange-200 dark:hover:border-indigo-500/30 active:scale-[0.99] transition-all duration-300 cursor-pointer group animate-slide-up"
              style={{animationDelay: `${idx*50}ms`}}
            >
               <div className="flex items-start justify-between">
                   <div className="flex-1 pr-4">
                        <h3 className="font-serif font-bold text-xl mb-3 text-stone-800 dark:text-stone-200 group-hover:text-orange-600 dark:group-hover:text-indigo-400 transition-colors">{text.title}</h3>
                        <p className="text-stone-500 dark:text-stone-500 line-clamp-2 text-sm leading-relaxed font-light">{text.content}</p>
                   </div>
                   <div className="mt-1 p-3 bg-stone-50 dark:bg-white/5 text-stone-400 dark:text-stone-500 rounded-full group-hover:bg-orange-50 dark:group-hover:bg-indigo-900/30 group-hover:text-orange-500 dark:group-hover:text-indigo-400 transition-all">
                       <BookOpen size={20} />
                   </div>
               </div>
            </div>
         ))}
         {texts.length === 0 && (
             <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                 <FileText size={48} className="mb-4 text-stone-300"/>
                 <p className="text-stone-400">No stories yet.</p>
             </div>
         )}
       </div>

       <div className="fixed bottom-8 right-6 z-20">
        <button 
          onClick={() => setIsAdding(true)}
          className="w-14 h-14 bg-stone-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={28} />
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-stone-200/60 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
           <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-pop border border-stone-100 dark:border-stone-800">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-100">Draft Story</h3>
                <div className="px-2 py-1 bg-orange-50 dark:bg-indigo-900/20 text-xs text-orange-600 dark:text-indigo-300 rounded font-bold uppercase tracking-wide flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>AI Assist</span>
                </div>
             </div>
             <div className="space-y-4">
               <input 
                 placeholder="Title" 
                 className="w-full bg-stone-50 dark:bg-stone-800 border-b-2 border-transparent focus:bg-white dark:focus:bg-stone-800 focus:border-orange-200 dark:focus:border-indigo-500 p-3 rounded-t-lg outline-none transition-all text-xl font-serif dark:text-stone-100 placeholder:text-stone-300"
                 value={newText.title || ''}
                 onChange={e => setNewText({...newText, title: e.target.value})}
               />
               <div className="relative">
                   <textarea 
                     placeholder="Paste English content here..." 
                     className="w-full bg-stone-50 dark:bg-stone-800 border-2 border-transparent focus:bg-white dark:focus:bg-stone-800 focus:border-orange-100 dark:focus:border-indigo-900 p-4 rounded-xl outline-none transition-all h-40 resize-none leading-relaxed text-lg dark:text-stone-200 font-serif placeholder:text-stone-300"
                     value={newText.content || ''}
                     onChange={e => setNewText({...newText, content: e.target.value})}
                   />
                    <button 
                        onClick={autoFillTranslation}
                        disabled={isAutoFilling || !newText.content}
                        className="absolute right-3 bottom-3 px-3 py-1.5 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-orange-500 dark:hover:text-indigo-400 rounded-lg shadow-sm border border-stone-100 dark:border-stone-600 transition-colors disabled:opacity-50 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                        {isAutoFilling ? <Loader2 className="animate-spin" size={14}/> : <><Sparkles size={14}/> Translate</>}
                    </button>
               </div>
               <textarea 
                 placeholder="Translation (Auto-generated or manual)" 
                 className="w-full bg-stone-50 dark:bg-stone-800 border-2 border-transparent focus:bg-white dark:focus:bg-stone-800 focus:border-orange-100 dark:focus:border-indigo-900 p-4 rounded-xl outline-none transition-all h-32 resize-none leading-relaxed dark:text-stone-300 placeholder:text-stone-300"
                 value={newText.translation || ''}
                 onChange={e => setNewText({...newText, translation: e.target.value})}
               />
             </div>
             <div className="flex justify-end space-x-3 mt-8">
               <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 font-medium transition-colors">Cancel</button>
               <button onClick={handleAdd} className="px-6 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-black rounded-lg font-bold shadow-lg hover:translate-y-px transition-all">Save Story</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TextModule;