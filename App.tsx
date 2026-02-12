import React, { useState, useEffect } from 'react';
import { Unit } from './types';
import { seedData } from './services/storage';
import UnitList from './components/UnitList';
import WordModule from './components/WordModule';
import SentenceModule from './components/SentenceModule';
import TextModule from './components/TextModule';
import { Book, AlignLeft, FileText, ChevronLeft, Moon, Sun, PlayCircle, Layers, Palette } from 'lucide-react';

type View = 
  | { type: 'HOME' }
  | { type: 'UNIT_DETAIL', unit: Unit }
  | { type: 'MODULE_WORD', unit: Unit }
  | { type: 'MODULE_SENTENCE', unit: Unit }
  | { type: 'MODULE_TEXT', unit: Unit };

const App: React.FC = () => {
  const [view, setView] = useState<View>({ type: 'HOME' });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    seedData();
    
    // Initialize Theme from local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Default to dark mode for this design system if no preference
    if (savedTheme === 'dark' || (!savedTheme)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const renderContent = () => {
    switch (view.type) {
      case 'HOME':
        return <UnitList onSelectUnit={(unit) => setView({ type: 'UNIT_DETAIL', unit })} />;
      
      case 'UNIT_DETAIL':
        return (
          <div className="h-full relative bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden font-sans selection:bg-indigo-500/30 animate-fade-in transition-colors duration-500">
             {/* === LAYER 0: LUMINOUS ATMOSPHERE === */}
             <div className="absolute inset-0 pointer-events-none">
                 <div className="absolute inset-0 bg-noise opacity-20 mix-blend-multiply dark:mix-blend-overlay"></div>
                 {/* Dynamic color blobs */}
                 <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[100px] animate-float"></div>
                 <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-fuchsia-300/30 dark:bg-fuchsia-900/10 rounded-full blur-[120px] animate-float-delayed"></div>
             </div>

             {/* === LAYER 1: CONTENT === */}
             <div className="relative z-10 flex flex-col h-full max-w-5xl mx-auto">
                
                {/* Header */}
                <header className="px-6 pt-8 pb-6 flex items-center gap-6">
                    <button 
                      onClick={() => setView({ type: 'HOME' })} 
                      className="p-4 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 backdrop-blur-md transition-all group active:scale-95"
                    >
                      <ChevronLeft className="text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" size={24} />
                    </button>
                    <div className="flex-1 overflow-hidden">
                        <h2 className="text-xs font-mono text-gray-500 tracking-[0.2em] uppercase mb-2 animate-slide-up" style={{ animationDelay: '0ms' }}>
                            Selected Unit
                        </h2>
                        <h1 className="text-3xl md:text-5xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-500 leading-tight truncate animate-slide-up" style={{ animationDelay: '100ms' }}>
                            {view.unit.name}
                        </h1>
                    </div>
                </header>

                {/* Modules Grid */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 auto-rows-min no-scrollbar">
                    
                    {/* 1. Vocabulary Card (Hero) */}
                    <button 
                        onClick={() => setView({ type: 'MODULE_WORD', unit: view.unit })}
                        className="group relative md:col-span-2 min-h-[220px] bg-gradient-to-br from-indigo-100/50 to-blue-100/30 dark:from-indigo-900/20 dark:to-blue-900/10 border border-white/40 dark:border-white/10 rounded-[2.5rem] p-8 text-left overflow-hidden hover:border-indigo-300/50 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-white/5 transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] animate-slide-up shadow-xl dark:shadow-2xl dark:shadow-black/50"
                        style={{ animationDelay: '200ms' }}
                    >
                        <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay"></div>
                        {/* Abstract Background Element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[80px] group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-colors duration-700"></div>
                        <div className="absolute top-4 right-8 opacity-10 group-hover:opacity-30 transition-all duration-700 transform group-hover:scale-110 group-hover:rotate-12">
                            <span className="text-[10rem] font-serif italic font-bold leading-none text-indigo-900 dark:text-white">Aa</span>
                        </div>
                        
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center mb-6 backdrop-blur-md border border-indigo-200/20 dark:border-white/10 group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-all duration-300">
                                <Book className="text-indigo-600 dark:text-indigo-200" size={28} />
                            </div>
                            <div>
                                <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 font-serif tracking-tight">Vocabulary</h3>
                                <p className="text-indigo-700/60 dark:text-indigo-200/60 font-medium tracking-wide flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                    Flashcards
                                    <span className="opacity-50">•</span>
                                    Dictation
                                    <span className="opacity-50">•</span>
                                    Spaced Repetition
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* 2. Sentences Card */}
                    <button 
                        onClick={() => setView({ type: 'MODULE_SENTENCE', unit: view.unit })}
                        className="group relative min-h-[240px] bg-gradient-to-br from-emerald-100/50 to-teal-100/30 dark:from-emerald-900/20 dark:to-teal-900/10 border border-white/40 dark:border-white/10 rounded-[2.5rem] p-8 text-left overflow-hidden hover:border-emerald-300/50 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] animate-slide-up shadow-xl dark:shadow-2xl dark:shadow-black/50"
                        style={{ animationDelay: '300ms' }}
                    >
                        <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay"></div>
                        {/* Abstract Waveform Visual */}
                        <div className="absolute bottom-0 left-0 w-full h-40 flex items-end justify-between px-8 pb-0 opacity-10 group-hover:opacity-30 transition-opacity gap-2 pointer-events-none">
                            {[...Array(12)].map((_,i) => (
                                 <div key={i} className="w-full bg-emerald-600 dark:bg-emerald-400 rounded-t-full transition-all duration-700 group-hover:animate-pulse" style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 50}ms` }}></div>
                            ))}
                        </div>

                        <div className="relative z-10 h-full flex flex-col">
                             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center mb-auto backdrop-blur-md border border-emerald-200/20 dark:border-white/10 group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-500/30 transition-all">
                                <AlignLeft className="text-emerald-600 dark:text-emerald-200" size={24} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-serif">Sentences</h3>
                                <p className="text-emerald-700/60 dark:text-emerald-200/60 font-medium text-sm leading-relaxed">
                                    Master grammar & prosody through granular audio interaction.
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* 3. Texts Card */}
                    <button 
                        onClick={() => setView({ type: 'MODULE_TEXT', unit: view.unit })}
                        className="group relative min-h-[240px] bg-gradient-to-br from-rose-100/50 to-orange-100/30 dark:from-rose-900/20 dark:to-orange-900/10 border border-white/40 dark:border-white/10 rounded-[2.5rem] p-8 text-left overflow-hidden hover:border-rose-300/50 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] animate-slide-up shadow-xl dark:shadow-2xl dark:shadow-black/50"
                        style={{ animationDelay: '400ms' }}
                    >
                        <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay"></div>
                        <div className="absolute top-[-30px] right-[-30px] p-8 opacity-10 group-hover:opacity-20 transition-opacity transform rotate-12 group-hover:rotate-6 duration-700 scale-150">
                            <Layers size={140} className="text-rose-900 dark:text-white" />
                        </div>

                        <div className="relative z-10 h-full flex flex-col">
                             <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center mb-auto backdrop-blur-md border border-rose-200/20 dark:border-white/10 group-hover:bg-rose-500/20 dark:group-hover:bg-rose-500/30 transition-all">
                                <FileText className="text-rose-600 dark:text-rose-200" size={24} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-serif">Immersion</h3>
                                <p className="text-rose-700/60 dark:text-rose-200/60 font-medium text-sm leading-relaxed">
                                    Deep reading with instant translation and context.
                                </p>
                            </div>
                        </div>
                    </button>

                </div>
             </div>
          </div>
        );

      case 'MODULE_WORD':
        return <div className="animate-fade-in h-full"><WordModule unitId={view.unit.id} onBack={() => setView({ type: 'UNIT_DETAIL', unit: view.unit })} /></div>;
      
      case 'MODULE_SENTENCE':
        return <div className="animate-fade-in h-full"><SentenceModule unitId={view.unit.id} onBack={() => setView({ type: 'UNIT_DETAIL', unit: view.unit })} /></div>;
        
      case 'MODULE_TEXT':
        return <div className="animate-fade-in h-full"><TextModule unitId={view.unit.id} onBack={() => setView({ type: 'UNIT_DETAIL', unit: view.unit })} /></div>;
    }
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-black font-sans overflow-hidden transition-colors duration-500">
      {renderContent()}
      
      {/* 
        SIDE DOCKED THEME TOGGLE 
        'Side hidden fix' implementation:
        Attached to the right side, slides out on hover/focus.
      */}
      <div className="fixed top-24 right-0 z-[100] translate-x-[60%] hover:translate-x-0 transition-transform duration-300 ease-out group">
        <button 
          onClick={toggleTheme}
          className="flex items-center gap-3 p-3 pl-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-l border-t border-b border-gray-200 dark:border-white/10 rounded-l-2xl shadow-lg hover:shadow-xl hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"
          title="Toggle Theme"
        >
          <div className="text-gray-600 dark:text-gray-300 group-hover:text-indigo-500 dark:group-hover:text-yellow-400 transition-colors">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </div>
          <span className="pr-4 font-mono text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
             {isDark ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default App;
