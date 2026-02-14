import React, { useState, useEffect, useRef } from 'react';
import { QuizQuestion, Unit, QuizConfig } from '../types';
import { quizService } from '../services/quizGenerator';
import { tts, playSound } from '../services/audio';
import { 
  X, Volume2, CheckCircle, XCircle, Loader2, 
  Sparkles, Trophy, RefreshCcw, ArrowRight, 
  BookOpen, Headphones, HelpCircle, GraduationCap, AlertTriangle 
} from 'lucide-react';

interface Props {
  unitId: string;
  unitName: string;
  config: QuizConfig;
  onClose: () => void;
}

const QuizModal: React.FC<Props> = ({ unitId, unitName, config, onClose }) => {
  // --- 状态管理 ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- 初始化：生成题目 ---
  useEffect(() => {
    const initQuiz = async () => {
      setLoading(true);
      setError(null);
      
      // 模拟加载进度感
      const timer = setInterval(() => {
        setLoadingProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 500);

      try {
        // 传递 config 到 service
        const data = await quizService.generateQuiz(unitId, config);
        if (data.length === 0) {
          setError("No questions could be generated from the available material.");
        } else {
          setQuestions(data);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to generate quiz.");
      } finally {
        clearInterval(timer);
        setLoading(false);
      }
    };
    initQuiz();
    return () => tts.cancel();
  }, [unitId, config]);

  // --- 自动播放逻辑 ---
  useEffect(() => {
    if (questions.length > 0 && !loading && !quizFinished && questions[currentIndex]) {
      const currentQ = questions[currentIndex];
      // 如果是听力类题目，自动播放
      if (currentQ.type.startsWith('listening')) {
        setTimeout(() => tts.speak(currentQ.query), 600);
      }
      // 切换题目时滚动到顶部
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex, loading, quizFinished, questions]);

  // --- 交互处理 ---
  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    if (!questions[currentIndex]) return;
    
    setSelectedOption(idx);
    setIsAnswered(true);

    if (idx === questions[currentIndex].answer) {
      setScore(s => s + 1);
      playSound("ding");
    } else {
      playSound("error");
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
    }
  };

  // --- UI 片段：加载中 ---
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center max-w-xs w-full px-6">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
            <div 
              className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"
              style={{ animationDuration: '1s' }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="text-indigo-500 w-10 h-10" />
            </div>
          </div>
          <h3 className="font-serif text-2xl text-gray-900 dark:text-white mb-2">Neural Link Active</h3>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.2em] text-center">
            Synthesizing {unitName} assessment... {loadingProgress}%
          </p>
        </div>
      </div>
    );
  }

  // --- UI 片段：错误处理 ---
  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-black p-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-6" />
          <h3 className="font-serif text-2xl text-gray-900 dark:text-white mb-2">Generation Failed</h3>
          <p className="text-gray-500 mb-8">{error || "Unable to generate questions. Please ensure you have enough vocabulary in this unit."}</p>
          <button onClick={onClose} className="px-8 py-3 bg-gray-100 dark:bg-white/10 rounded-xl font-bold">
            Close
          </button>
        </div>
      </div>
    );
  }

  // --- UI 片段：结算界面 ---
  if (quizFinished) {
    const accuracy = Math.round((score / questions.length) * 100);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 dark:bg-black p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden p-12 text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div className="mb-8 relative inline-block">
             <Trophy size={80} className="text-yellow-500 animate-bounce" />
             <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">LEVEL UP</div>
          </div>

          <h2 className="font-serif text-5xl text-gray-900 dark:text-white mb-2">Assessment Complete</h2>
          <p className="text-gray-500 font-mono mb-10 uppercase tracking-widest">Unit: {unitName}</p>

          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-6 border border-gray-100 dark:border-white/5">
              <div className="text-4xl font-serif text-indigo-500 mb-1">{accuracy}%</div>
              <div className="text-xs font-mono text-gray-400 uppercase tracking-tighter">Accuracy Rate</div>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-6 border border-gray-100 dark:border-white/5">
              <div className="text-4xl font-serif text-purple-500 mb-1">{score}/{questions.length}</div>
              <div className="text-xs font-mono text-gray-400 uppercase tracking-tighter">Score Earned</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
              Return to Hub
            </button>
            <button 
              onClick={() => { setQuizFinished(false); setCurrentIndex(0); setScore(0); setIsAnswered(false); }}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <RefreshCcw size={18} /> Re-evaluate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 安全获取当前题目 ---
  const q = questions[currentIndex];
  // 额外的安全检查，防止渲染时崩溃
  if (!q) return null;

  const isListening = q.type.startsWith('listening');
  const isReadingComp = q.type === 'reading-comprehension';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-black transition-colors duration-500">
      
      {/* 顶部导航 */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500">
            <X size={24} />
          </button>
          <div>
            <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[0.2em]">{q.type.replace('-', ' ')}</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{unitName}</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex-1 max-w-md mx-8">
           <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-2 uppercase">
              <span>Step {currentIndex + 1}</span>
              <span>{Math.round(((currentIndex + 1)/questions.length)*100)}%</span>
           </div>
           <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
           </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
           <Sparkles size={14} /> {score.toString().padStart(2, '0')}
        </div>
      </header>

      {/* 主体内容区 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
          
          {/* 安全检查：如果题目还没加载出来，显示加载占位 */}
          {questions.length > 0 && q ? (() => {
            // 尝试获取当前题目或之前题目的短文内容（防AI漏返回）
            const currentPassage = q.passage || 
              [...questions].slice(0, currentIndex).reverse().find(prev => prev.passage)?.passage;

            return (
              <div className="flex flex-col gap-10">
                
                {/* 1. 阅读材料区域 */}
                {isReadingComp && currentPassage && (
                  <div className="group relative p-8 md:p-12 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] border border-gray-200 dark:border-white/10 animate-fade-in shadow-inner">
                    <div className="absolute top-6 left-8 flex items-center gap-2 text-indigo-500 font-mono text-[10px] uppercase tracking-widest">
                      <BookOpen size={14} /> 
                      <span>Reading Passage</span>
                    </div>
                    
                    <p className="mt-8 text-xl md:text-2xl font-serif text-gray-800 dark:text-gray-200 leading-relaxed first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:text-indigo-500 first-letter:float-left">
                      {currentPassage}
                    </p>
                  </div>
                )}

                {/* 2. 问题展示区 */}
                <div className={`flex flex-col ${isReadingComp ? 'items-start text-left' : 'items-center text-center'} gap-8`}>
                  
                  {/* 听力播放键 */}
                  {isListening && (
                    <div className="relative">
                      <button 
                        onClick={() => tts.speak(q.query)}
                        className="w-32 h-32 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-500/40 group relative z-10"
                      >
                        <Volume2 size={48} className={isAnswered ? "" : "animate-pulse"} />
                      </button>
                      {!isAnswered && (
                        <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20"></div>
                      )}
                    </div>
                  )}

                  {/* 题干文本内容 */}
                  <div className="space-y-4 w-full">
                    {/* 场景描述展示 */}
                    {q.display && q.display !== "null" && q.display.length > 0 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[14px] uppercase tracking-widest">
                        <HelpCircle size={12} /> {q.display}
                      </div>
                    )}
                    
                    <h3 className={`font-serif text-gray-900 dark:text-white leading-[1.3] ${
                      isReadingComp 
                        ? 'text-2xl md:text-3xl border-l-4 border-indigo-500 pl-6 py-1' 
                        : 'text-3xl md:text-5xl max-w-2xl mx-auto'
                    }`}>
                      {/* 听力题逻辑：答题前隐藏原文 */}
                      {isListening && !isAnswered ? (
                        <span className="text-gray-300 dark:text-gray-700 italic opacity-50 select-none">
                          Listen and interpret...
                        </span>
                      ) : (
                        q.query
                      )}
                    </h3>
                  </div>
                </div>

                {/* 3. 选项网格 */}
                <div className={`grid gap-4 ${isReadingComp ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {q.options && q.options.map((option, idx) => {
                    const isCorrect = idx === q.answer;
                    const isSelected = idx === selectedOption;
                    
                    let btnStyle = "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5";
                    
                    if (isAnswered) {
                      if (isCorrect) {
                        btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20";
                      } else if (isSelected) {
                        btnStyle = "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 opacity-100";
                      } else {
                        btnStyle = "border-transparent opacity-40 grayscale-[0.5]";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => handleSelect(idx)}
                        className={`group relative p-6 rounded-3xl border text-left text-lg transition-all duration-300 flex items-center gap-4 ${btnStyle}`}
                      >
                        <span className="w-8 h-8 shrink-0 rounded-full border border-current flex items-center justify-center font-mono text-sm">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 font-medium">{option}</span>
                        {isAnswered && isCorrect && <CheckCircle className="text-emerald-500" size={24} />}
                        {isAnswered && isSelected && !isCorrect && <XCircle className="text-rose-500" size={24} />}
                      </button>
                    );
                  })}
                </div>

                {/* 4. 解析卡片 */}
                {isAnswered && (
                  <div className="animate-slide-up p-8 rounded-[2rem] bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-3">
                      <Sparkles size={18} /> Analysis
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                      {q.explanation || "Correct choice logic applied. Keep building your neural pathways."}
                    </p>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 italic">
              Initializing question matrix...
            </div>
          )}
        </div>
      </main>

      {/* 底部动作栏 */}
      <footer className={`p-6 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-black transition-all duration-500 transform ${isAnswered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="max-w-4xl mx-auto flex justify-end">
          <button 
            onClick={nextQuestion}
            className="group px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            <span>{currentIndex === questions.length - 1 ? 'Finish Assessment' : 'Continue Matrix'}</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default QuizModal;
