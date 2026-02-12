import { Unit, Word, Sentence, TextData } from '../types';

const STORAGE_KEYS = {
  UNITS: 'linguaflow_units',
  WORDS: 'linguaflow_words',
  SENTENCES: 'linguaflow_sentences',
  TEXTS: 'linguaflow_texts'
};

// Helpers
const get = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Storage Error', e);
    return [];
  }
};

const set = (key: string, data: any[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initial Data Seeding
export const seedData = () => {
  if (get(STORAGE_KEYS.UNITS).length === 0) {
    const demoUnitId = 'unit-demo-1';
    const demoUnit: Unit = { id: demoUnitId, name: 'Unit 1: Nature & Tech', createdAt: Date.now() };
    set(STORAGE_KEYS.UNITS, [demoUnit]);

    const words: Word[] = [
      { id: 'w1', unitId: demoUnitId, text: 'ubiquitous', meaning: '无处不在的', phonetic: '/juːˈbɪkwɪtəs/', example: 'Smartphones are ubiquitous nowadays.' },
      { id: 'w2', unitId: demoUnitId, text: 'extraordinary', meaning: '非凡的', phonetic: '/ɪkˈstrɔːrdəneri/', example: 'He is an extraordinary person.' },
      { id: 'w3', unitId: demoUnitId, text: 'apple', meaning: '苹果', phonetic: '/ˈæpl/', example: 'I eat an apple every day.' },
    ];
    set(STORAGE_KEYS.WORDS, words);

    const sentences: Sentence[] = [
      { id: 's1', unitId: demoUnitId, text: 'The quick brown fox jumps over the lazy dog.', translation: '那只敏捷的棕色狐狸跳过了懒惰的狗。' },
      { id: 's2', unitId: demoUnitId, text: 'It was an extraordinary day for science.', translation: '这对科学来说是非凡的一天。' }
    ];
    set(STORAGE_KEYS.SENTENCES, sentences);

    const texts: TextData[] = [
      { 
        id: 't1', 
        unitId: demoUnitId, 
        title: 'The Future of AI', 
        content: "Artificial Intelligence is becoming ubiquitous in our daily lives.\nIt assists us in ways we never thought possible. From driving cars to writing code, AI is reshaping the world.",
        translation: "人工智能正变得在我们的日常生活中无处不在。\n它以我们要么意想不到的方式帮助我们。从驾驶汽车到编写代码，人工智能正在重塑世界。"
      }
    ];
    set(STORAGE_KEYS.TEXTS, texts);
  }
};

// API
export const db = {
  getUnits: () => get<Unit>(STORAGE_KEYS.UNITS),
  addUnit: (name: string) => {
    const units = get<Unit>(STORAGE_KEYS.UNITS);
    const newUnit = { id: crypto.randomUUID(), name, createdAt: Date.now() };
    set(STORAGE_KEYS.UNITS, [...units, newUnit]);
    return newUnit;
  },
  deleteUnit: (id: string) => {
    set(STORAGE_KEYS.UNITS, get<Unit>(STORAGE_KEYS.UNITS).filter(u => u.id !== id));
    set(STORAGE_KEYS.WORDS, get<Word>(STORAGE_KEYS.WORDS).filter(w => w.unitId !== id));
    set(STORAGE_KEYS.SENTENCES, get<Sentence>(STORAGE_KEYS.SENTENCES).filter(s => s.unitId !== id));
    set(STORAGE_KEYS.TEXTS, get<TextData>(STORAGE_KEYS.TEXTS).filter(t => t.unitId !== id));
  },
  updateUnitName: (id: string, name: string) => {
    const units = get<Unit>(STORAGE_KEYS.UNITS);
    const index = units.findIndex(u => u.id === id);
    if (index !== -1) {
      units[index].name = name;
      set(STORAGE_KEYS.UNITS, units);
    }
  },

  getWords: (unitId: string) => get<Word>(STORAGE_KEYS.WORDS).filter(w => w.unitId === unitId),
  addWord: (word: Word) => set(STORAGE_KEYS.WORDS, [...get<Word>(STORAGE_KEYS.WORDS), word]),
  deleteWord: (id: string) => set(STORAGE_KEYS.WORDS, get<Word>(STORAGE_KEYS.WORDS).filter(w => w.id !== id)),

  getSentences: (unitId: string) => get<Sentence>(STORAGE_KEYS.SENTENCES).filter(s => s.unitId === unitId),
  addSentence: (sentence: Sentence) => set(STORAGE_KEYS.SENTENCES, [...get<Sentence>(STORAGE_KEYS.SENTENCES), sentence]),
  deleteSentence: (id: string) => set(STORAGE_KEYS.SENTENCES, get<Sentence>(STORAGE_KEYS.SENTENCES).filter(s => s.id !== id)),

  getTexts: (unitId: string) => get<TextData>(STORAGE_KEYS.TEXTS).filter(t => t.unitId === unitId),
  addText: (text: TextData) => set(STORAGE_KEYS.TEXTS, [...get<TextData>(STORAGE_KEYS.TEXTS), text]),
  deleteText: (id: string) => set(STORAGE_KEYS.TEXTS, get<TextData>(STORAGE_KEYS.TEXTS).filter(t => t.id !== id)),
};