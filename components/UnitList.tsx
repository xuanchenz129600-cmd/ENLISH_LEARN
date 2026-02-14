import React, { useState, useEffect, useRef } from 'react';
import { Unit, QuizConfig } from '../types';
import { db } from '../services/storage';
import { 
  Plus, ArrowUpRight, Sparkles, BoxSelect, 
  Trash2, Edit2, X, PlayCircle, Settings2 
} from 'lucide-react';
import QuizModal from './QuizModal';

interface Props {
  onSelectUnit: (unit: Unit) => void;
}

const UnitList: React.FC<Props> = ({ onSelectUnit }) => {
  // --- 基础状态 ---
  const [units, setUnits] = useState<Unit[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // --- 考核相关状态 ---
  const [quizUnit, setQuizUnit] = useState<Unit | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // 默认考核配置
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
    difficulty: 'Intermediate',
    counts: {
      listeningChoice: 2,
      readingWord: 2,
      listeningContext: 2,
      contextChoice: 2,
      readingComp: 3
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnits = () => {
    setUnits(db.getUnits().sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    loadUnits();
  }, []);

  // --- 单元管理逻辑 ---
  const handleCreate = () => {
    if (!newUnitName.trim()) return;
    if (editUnitId) {
      db.updateUnitName(editUnitId, newUnitName);
    } else {
      db.addUnit(newUnitName);
    }
    setNewUnitName('');
    setEditUnitId(null);
    setIsModalOpen(false);
    loadUnits();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Dissolve this memory unit completely?')) {
      db.deleteUnit(id);
      loadUnits();
    }
  };

  const openEdit = (unit: Unit, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditUnitId(unit.id);
    setNewUnitName(unit.name);
    setIsModalOpen(true);
  };

  // --- 视觉效果逻辑 ---
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const getGradient = (id: string) => {
    const hash = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    const hues = [
      'from-blue-500/10 via-purple-500/5 to-transparent',
      'from-emerald-500/10 via-teal-500/5 to-transparent',
      'from-rose-500/10 via-orange-500/5 to-transparent',
      'from-indigo-500/10 via-cyan-500/5 to-transparent',
    ];
    return hues[hash % hues.length];
  };

  // --- 考核配置逻辑 ---
  const updateCount = (key: keyof QuizConfig['counts'], delta: number) => {
    setQuizConfig(prev => ({
      ...prev,
      counts: {
        ...prev.counts,
        [key]: Math.max(0, prev.counts[key] + delta)
      }
    }));
  };

  const handleStartQuiz = () => {
    // 关闭配置弹窗，此时 quizUnit 仍有值，所以 QuizModal 会被渲染
    setIsConfigOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="h-full relative overflow-y-auto bg-gray-50 dark:bg-black text-gray-900 dark:text-white no-scrollbar font-sans selection:bg-indigo-500/20 transition-colors duration-500"
    >
      {/* === LAYER 0: 背景氛围 === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute inset-0 bg-noise opacity-20 dark:opacity-30 mix-blend-multiply dark:mix-blend-overlay fixed"></div>
         <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[100px] animate-float opacity-60"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-emerald-300/30 dark:bg-emerald-900/10 rounded-full blur-[120px] animate-float-delayed opacity-50"></div>
      </div>

      {/* === LAYER 1: 内容区 === */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:px-12 md:py-20 flex flex-col min-h-screen">
        
        {/* Header Section */}
        <header className="mb-16 md:mb-24 flex justify-between items-end animate-fade-in relative z-20">
          <div>
            <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 leading-[1.1]">
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-white dark:to-gray-500">
                LinguaFlow
              </span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-mono text-sm tracking-widest uppercase pl-1">
              Deep Learning Space
            </p>
          </div>
          <div className="hidden md:block text-right">
             <div className="text-4xl font-light text-gray-700 dark:text-gray-500 font-serif italic">{units.length.toString().padStart(2, '0')}</div>
             <div className="text-xs text-gray-500 dark:text-gray-600 font-mono uppercase tracking-widest">Active Units</div>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[280px]">
          
          {/* Create Unit Button */}
          <button
            onClick={() => {
              setEditUnitId(null);
              setNewUnitName('');
              setIsModalOpen(true);
            }}
            className="group relative flex flex-col items-center justify-center glass-panel rounded-3xl p-8 hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-500 border-dashed border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/50 animate-slide-up"
          >
            <div className="w-16 h-16 rounded-full border border-gray-300 dark:border-white/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-gray-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black text-gray-400 dark:text-gray-300 transition-all duration-300">
              <Plus size={32} strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Initialize Unit</span>
          </button>

          {/* Unit Cards Loop */}
          {units.map((unit, index) => {
            const wordCount = db.getWords(unit.id).length;
            const sentCount = db.getSentences(unit.id).length;
            const textCount = db.getTexts(unit.id).length;
            
            const isWide = index > 0 && index % 6 === 0;
            const gradientClass = getGradient(unit.id);

            return (
              <div
                key={unit.id}
                onClick={() => onSelectUnit(unit)}
                className={`group relative glass-card rounded-3xl p-8 flex flex-col justify-between overflow-hidden cursor-pointer animate-slide-up ${isWide ? 'md:col-span-2' : ''}`}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {/* Internal Glows */}
                <div className={`absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br ${gradientClass} opacity-60 blur-3xl rounded-full group-hover:opacity-80 transition-opacity duration-1000`}></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                     <div className="w-10 h-10 rounded-full bg-white/40 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        <BoxSelect size={18} />
                     </div>
                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-[-10px] group-hover:translate-y-0">
                        <button onClick={(e) => openEdit(unit, e)} className="p-2 hover:bg-white/20 rounded-full text-gray-600 dark:text-white"><Edit2 size={14}/></button>
                        <button onClick={(e) => handleDelete(unit.id, e)} className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full text-gray-400 dark:text-gray-400"><Trash2 size={14}/></button>
                     </div>
                  </div>
                  
                  <h3 className="font-serif text-3xl md:text-4xl text-gray-800 dark:text-white leading-tight mb-2 group-hover:translate-x-1 transition-transform duration-300">
                    {unit.name}
                  </h3>
                  
                  <div className="w-12 h-0.5 bg-gray-300 dark:bg-white/20 mt-4 mb-4 group-hover:w-20 group-hover:bg-gray-500 dark:group-hover:bg-white/50 transition-all duration-500"></div>
                </div>

                <div className="relative z-10 flex items-end justify-between">
                  <div className="flex gap-3 text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                    <span>{wordCount} WDS</span>
                    <span>/</span>
                    <span>{sentCount} SNT</span>
                    <span>/</span>
                    <span>{textCount} TXT</span>
                  </div>
                  
                  {/* Action Buttons: Play (Assessment) & Open */}
                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setQuizUnit(unit); 
                        setIsConfigOpen(true); // 打开配置界面
                      }}
                      className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                      title="Start Assessment"
                    >
                        <PlayCircle size={22} />
                    </button>
                    <div className="p-3 bg-white/10 dark:bg-white/5 rounded-full text-gray-800 dark:text-white">
                      <ArrowUpRight size={22} />
                    </div>
                  </div>
                </div>

                {/* Spotlight Effect */}
                <div 
                  className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.1), transparent 40%)`
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* === MODAL: ASSESSMENT CONFIG (配置层) === */}
      {isConfigOpen && quizUnit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setIsConfigOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-pop overflow-hidden">
            {/* Top Decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-serif text-2xl text-gray-900 dark:text-white flex items-center gap-2">
                <Settings2 size={24} className="text-indigo-500" /> Assessment Settings
              </h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={24} /></button>
            </div>

            {/* 1. Difficulty Selector */}
            <div className="mb-8">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-3">Target Difficulty</label>
              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl">
                {(['Elementary', 'Intermediate', 'Advanced'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setQuizConfig({ ...quizConfig, difficulty: d })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      quizConfig.difficulty === d 
                      ? 'bg-white dark:bg-white/10 text-indigo-500 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Question Matrix (Counts) */}
            <div className="space-y-3 mb-8">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-2">Question Distribution</label>
              {Object.entries(quizConfig.counts).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 px-4 py-3 rounded-2xl border border-transparent hover:border-indigo-500/20 transition-colors">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => updateCount(key as keyof QuizConfig['counts'], -1)} 
                      className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-indigo-500 active:bg-gray-200 dark:active:bg-white/10"
                    >
                      -
                    </button>
                    <span className="text-sm font-mono dark:text-white w-4 text-center">{value}</span>
                    <button 
                      onClick={() => updateCount(key as keyof QuizConfig['counts'], 1)} 
                      className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-indigo-500 active:bg-gray-200 dark:active:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Start Button */}
            <button 
              onClick={handleStartQuiz} 
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Sparkles size={18} /> Materialize Quiz
            </button>
          </div>
        </div>
      )}

      {/* === COMPONENT: QUIZ MODAL (实际考核界面) === */}
      {/* 仅当 quizUnit 存在且配置层关闭时显示 */}
      {quizUnit && !isConfigOpen && (
        <QuizModal 
          unitId={quizUnit.id} 
          unitName={quizUnit.name} 
          config={quizConfig} // 传递配置
          onClose={() => setQuizUnit(null)} 
        />
      )}

      {/* === MODAL: CREATE/RENAME UNIT === */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-200/60 dark:bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl animate-pop overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>

             <div className="relative z-10">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-serif text-3xl text-gray-900 dark:text-white">{editUnitId ? 'Rename Unit' : 'New Collection'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Unit Title</label>
                    <input
                      autoFocus
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="e.g. Quantum Physics, Daily Journal..."
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-gray-400 dark:focus:border-white/30 focus:bg-white dark:focus:bg-white/10 rounded-xl px-4 py-4 text-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-700 outline-none transition-all font-serif"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                     <button
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors font-mono text-xs uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!newUnitName.trim()}
                      className="flex-1 py-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} />
                      <span>{editUnitId ? 'Update' : 'Materialize'}</span>
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitList;
