import React, { useState, useEffect, useRef } from 'react';
import { Unit } from '../types';
import { db } from '../services/storage';
import { Plus, MoreHorizontal, ArrowUpRight, Sparkles, BoxSelect, Trash2, Edit2, X } from 'lucide-react';

interface Props {
  onSelectUnit: (unit: Unit) => void;
}

const UnitList: React.FC<Props> = ({ onSelectUnit }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Ref for the container to calculate relative mouse position
  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnits = () => {
    setUnits(db.getUnits().sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    loadUnits();
  }, []);

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

  // Global Mouse Move for Spotlight Effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Helper to generate abstract gradient colors based on unit ID
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

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="h-full relative overflow-y-auto bg-gray-50 dark:bg-black text-gray-900 dark:text-white no-scrollbar font-sans selection:bg-indigo-500/20 transition-colors duration-500"
    >
      {/* === LAYER 0: LUMINOUS ATMOSPHERE === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
         {/* Noise Texture Overlay */}
         <div className="absolute inset-0 bg-noise opacity-20 dark:opacity-30 mix-blend-multiply dark:mix-blend-overlay fixed"></div>
         
         {/* Floating Aurora Blobs */}
         <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[100px] animate-float opacity-60"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-emerald-300/30 dark:bg-emerald-900/10 rounded-full blur-[120px] animate-float-delayed opacity-50"></div>
         <div className="absolute top-[40%] left-[50%] w-[40vw] h-[40vw] bg-purple-300/30 dark:bg-purple-900/10 rounded-full blur-[90px] animate-pulse-glow opacity-40"></div>
      </div>

      {/* === LAYER 1: CONTENT === */}
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
          
          {/* New Unit Button (First Item) */}
          <button
            onClick={() => {
              setEditUnitId(null);
              setNewUnitName('');
              setIsModalOpen(true);
            }}
            className="group relative flex flex-col items-center justify-center glass-panel rounded-3xl p-8 hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-500 border-dashed border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/50 animate-slide-up"
            style={{ animationDelay: '0ms' }}
          >
            <div className="w-16 h-16 rounded-full border border-gray-300 dark:border-white/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-gray-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black text-gray-400 dark:text-gray-300 transition-all duration-300">
              <Plus size={32} strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Initialize Unit</span>
          </button>

          {/* Unit Cards */}
          {units.map((unit, index) => {
            const wordCount = db.getWords(unit.id).length;
            const sentCount = db.getSentences(unit.id).length;
            const textCount = db.getTexts(unit.id).length;
            
            // Bento Logic: Every 4th item spans 2 cols (just for visual variation)
            const isWide = index > 0 && index % 6 === 0;
            const spanClass = isWide ? 'md:col-span-2' : '';
            const gradientClass = getGradient(unit.id);

            return (
              <div
                key={unit.id}
                onClick={() => onSelectUnit(unit)}
                className={`group relative glass-card rounded-3xl p-8 flex flex-col justify-between overflow-hidden cursor-pointer animate-slide-up ${spanClass}`}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {/* Internal Ambient Glow (Static) */}
                <div className={`absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br ${gradientClass} opacity-60 blur-3xl rounded-full group-hover:opacity-80 transition-opacity duration-1000`}></div>
                
                {/* Internal Slow Spin Glow */}
                <div className="absolute bottom-[-50%] left-[-20%] w-[80%] h-[80%] bg-white/20 dark:bg-white/5 rounded-full blur-2xl animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                {/* Card Content */}
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                     <div className="w-10 h-10 rounded-full bg-white/40 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white group-hover:bg-white/60 dark:group-hover:bg-white/10 transition-colors">
                        <BoxSelect size={18} />
                     </div>
                     
                     {/* Actions (Hidden by default, show on hover) */}
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
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0">
                    <ArrowUpRight className="text-gray-800 dark:text-white" />
                  </div>
                </div>

                {/* Dynamic Spotlight Border Effect */}
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

      {/* === MODAL: DARK GLASS === */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-200/60 dark:bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl animate-pop overflow-hidden">
             {/* Modal Background decoration */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
             <div className="absolute top-[-50%] right-[-50%] w-[80%] h-[80%] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[80px]"></div>

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