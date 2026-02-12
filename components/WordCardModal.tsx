import React, { useEffect, useState } from 'react';
import { X, Volume2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { DictionaryEntry, dictionaryService } from '../services/dictionary';
import { tts } from '../services/audio';

interface Props {
  word: string;
  onClose: () => void;
}

const WordCardModal: React.FC<Props> = ({ word, onClose }) => {
  const [data, setData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      const result = await dictionaryService.fetchDefinition(word);
      if (result) {
        setData(result);
        setAudioUrl(dictionaryService.getAudioUrl(result));
      } else {
        setError(true);
      }
      setLoading(false);
    };

    fetchData();
  }, [word]);

  const playAudio = () => {
    if (audioUrl) {
      new Audio(audioUrl).play().catch(e => {
        console.warn("Audio play failed, falling back to TTS", e);
        tts.speak(word);
      });
    } else {
      tts.speak(word);
    }
  };

  // Auto-play audio when loaded
  useEffect(() => {
    if (!loading && !error && (audioUrl || word)) {
        // Short delay to allow modal animation to start
        const timer = setTimeout(() => playAudio(), 300);
        return () => clearTimeout(timer);
    }
  }, [loading, error, audioUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-pop border border-white/20 dark:border-slate-700 flex flex-col max-h-[80vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-2 flex justify-between items-start">
            <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 capitalize">{word}</h2>
                {!loading && !error && data?.phonetic && (
                    <span className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-primary dark:text-indigo-300 rounded-full font-mono text-sm border border-indigo-100 dark:border-indigo-800">
                        {data.phonetic}
                    </span>
                )}
            </div>
            <button 
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
            {loading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                    <Loader2 size={40} className="animate-spin mb-4 text-primary" />
                    <div className="flex items-center space-x-2 text-sm font-medium">
                        <Sparkles size={16} className="text-purple-500" />
                        <span>Translating with AI...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Definition Not Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mb-6">
                        We couldn't retrieve the definition for "{word}".
                    </p>
                    <button 
                        onClick={() => tts.speak(word)}
                        className="flex items-center space-x-2 px-6 py-3 bg-indigo-50 dark:bg-slate-800 text-primary dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
                    >
                        <Volume2 size={20} />
                        <span>Play TTS Audio</span>
                    </button>
                </div>
            )}

            {!loading && !error && data && (
                <div className="space-y-6">
                    {/* Audio Button */}
                    <button 
                        onClick={playAudio}
                        className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/30 flex items-center justify-center space-x-3 hover:bg-primaryDark active:scale-[0.98] transition-all"
                    >
                        <Volume2 size={24} />
                        <span>Play Pronunciation</span>
                    </button>

                    {/* Meanings */}
                    <div className="space-y-6">
                        {data.meanings.map((meaning, idx) => (
                            <div key={idx} className="animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className="flex items-center space-x-2 mb-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                                    <span className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 italic">
                                        {meaning.partOfSpeech}
                                    </span>
                                </div>
                                <ul className="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-slate-800">
                                    {meaning.definitions.slice(0, 3).map((def, dIdx) => (
                                        <li key={dIdx}>
                                            <p className="text-lg text-gray-800 dark:text-gray-100 leading-relaxed font-bold">
                                                {def.definition}
                                            </p>
                                            {def.example && (
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic font-serif">
                                                    "{def.example}"
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    
                    <div className="pt-4 border-t border-gray-50 dark:border-slate-800">
                        <div className="flex justify-center items-center space-x-2 text-xs text-gray-300 dark:text-slate-600">
                            <Sparkles size={12} />
                            <span>AI-Powered Translation</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default WordCardModal;