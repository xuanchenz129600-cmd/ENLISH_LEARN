import React, { useEffect, useState, useRef } from 'react';
import { X, Volume2, Loader2, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import { DictionaryEntry, dictionaryService } from '../services/dictionary';
import { tts } from '../services/audio';

interface Props {
  word: string;
  originRect: DOMRect | null;
  onClose: () => void;
}

const WordPortal: React.FC<Props> = ({ word, originRect, onClose }) => {
  const [data, setData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Animation State
  const [isExpanded, setIsExpanded] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  
  // Calculate positioning
  useEffect(() => {
    if (!originRect) return;

    // Initial State: Match the word exactly
    setPortalStyle({
      top: originRect.top,
      left: originRect.left,
      width: originRect.width,
      height: originRect.height,
      borderRadius: '4px',
      opacity: 0.5,
      transform: 'scale(1)'
    });

    // Expand State: Centered card, but slightly offset to feel like it popped out
    // We use a timeout to trigger the CSS transition
    requestAnimationFrame(() => {
      setIsExpanded(true);
    });
  }, [originRect]);

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      const result = await dictionaryService.fetchDefinition(word);
      if (result) {
        setData(result);
        setAudioUrl(dictionaryService.getAudioUrl(result));
        // Auto play audio shortly after expansion
        setTimeout(() => playAudio(result), 600);
      } else {
        setError(true);
      }
      setLoading(false);
    };
    fetchData();
  }, [word]);

  const playAudio = (entry: DictionaryEntry | null = data) => {
    const url = entry ? dictionaryService.getAudioUrl(entry) : audioUrl;
    if (url) {
      new Audio(url).play().catch(() => tts.speak(word));
    } else {
      tts.speak(word);
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExpanded(false);
    // Wait for transition to finish before unmounting
    setTimeout(onClose, 300);
  };

  // Dynamic Styles for expansion
  const expandedStyle: React.CSSProperties = {
    top: '50%',
    left: '50%',
    width: '90%',
    maxWidth: '400px',
    height: 'auto',
    maxHeight: '70vh',
    transform: 'translate(-50%, -50%)',
    borderRadius: '24px',
    opacity: 1,
  };

  const currentStyle = isExpanded ? expandedStyle : portalStyle;

  return (
    <>
      {/* 
        Backdrop: 
        Instead of a dark overlay, we use a transparent layer to capture clicks.
        We might add a very subtle blur to the rest of the screen to focus attention.
      */}
      <div 
        className={`fixed inset-0 z-40 transition-all duration-500 ${isExpanded ? 'backdrop-blur-[2px] bg-black/5 dark:bg-black/20' : 'pointer-events-none opacity-0'}`}
        onClick={handleClose}
      />

      {/* The Portal Card */}
      <div
        className="fixed z-50 overflow-hidden shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_0_50px_-10px_rgba(255,255,255,0.1)] border border-white/40 dark:border-white/10 flex flex-col transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)"
        style={{
          ...currentStyle,
          // Glass Effect
          background: isExpanded ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255,255,255,0)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Mode Background Override via Class since inline handles opacity */}
        <div className="absolute inset-0 bg-transparent dark:bg-black/50 pointer-events-none -z-10"></div>
        
        {/* Animated Gradient Border/Glow */}
        <div className={`absolute inset-0 opacity-30 pointer-events-none transition-opacity duration-700 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"></div>
             <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent"></div>
        </div>

        {/* --- CONTENT (Only visible when expanding/expanded) --- */}
        <div className={`flex flex-col h-full transition-opacity duration-300 delay-100 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
            
            {/* Header */}
            <div className="p-6 pb-2 flex justify-between items-start shrink-0">
                <div>
                    <h2 className="text-4xl font-serif font-bold text-gray-900 dark:text-white mb-1 capitalize tracking-tight flex items-center gap-3">
                        {word}
                    </h2>
                    {!loading && !error && data?.phonetic && (
                        <div className="flex items-center gap-2">
                             <span className="font-mono text-sm text-indigo-600 dark:text-indigo-300">
                                {data.phonetic}
                             </span>
                        </div>
                    )}
                </div>
                <button 
                    onClick={handleClose}
                    className="p-2 -mr-2 -mt-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 pt-2 no-scrollbar">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <Loader2 size={32} className="animate-spin mb-2" />
                        <span className="text-xs uppercase tracking-widest">Opening Portal...</span>
                    </div>
                )}

                {error && (
                    <div className="text-center py-6">
                         <AlertCircle className="mx-auto text-orange-400 mb-2" size={32} />
                         <p className="text-gray-600 dark:text-gray-300">Definition unavailable in this sector.</p>
                         <button onClick={() => playAudio()} className="mt-4 text-sm font-bold underline">Play Audio Only</button>
                    </div>
                )}

                {!loading && !error && data && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Audio Fab (Floating Action Button style inside) */}
                        <div className="flex justify-start">
                             <button 
                                onClick={() => playAudio()}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-white text-white dark:text-black rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform"
                             >
                                <Volume2 size={16} />
                                <span>Pronounce</span>
                             </button>
                        </div>

                        {/* Meanings */}
                        <div className="space-y-5">
                            {data.meanings.map((meaning, idx) => (
                                <div key={idx}>
                                    <div className="flex items-center gap-2 mb-2 opacity-60">
                                        <BookOpen size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">{meaning.partOfSpeech}</span>
                                    </div>
                                    <ul className="space-y-3">
                                        {meaning.definitions.slice(0, 2).map((def, dIdx) => (
                                            <li key={dIdx} className="bg-white/40 dark:bg-white/5 p-3 rounded-xl border border-white/20 dark:border-white/5">
                                                <p className="text-base font-medium text-gray-800 dark:text-gray-100 leading-snug">
                                                    {def.definition}
                                                </p>
                                                {def.example && (
                                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic font-serif border-l-2 border-indigo-300 pl-2">
                                                        "{def.example}"
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100/20 dark:border-white/5 shrink-0">
                <div className="flex justify-center items-center space-x-2 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    <Sparkles size={10} />
                    <span>Neural Link Active</span>
                </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default WordPortal;