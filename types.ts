export interface Unit {
  id: string;
  name: string;
  createdAt: number;
}

export interface Word {
  id: string;
  unitId: string;
  text: string;
  meaning: string;
  phonetic: string;
  example?: string;
}

export interface Sentence {
  id: string;
  unitId: string;
  text: string;
  translation: string;
}

export interface TextData {
  id: string;
  unitId: string;
  title: string;
  content: string; // Stored as plain text, we parse paragraphs by \n
  translation: string;
}

export enum AppRoute {
  HOME = 'HOME',
  UNIT_DETAIL = 'UNIT_DETAIL',
  FLASHCARDS = 'FLASHCARDS',
  DICTATION = 'DICTATION',
  READING = 'READING'
}
// types.ts (追加)

// types.ts 追加或修改
export type QuestionType = 
  | 'listening-choice' 
  | 'listening-bool' 
  | 'reading-choice' 
  | 'context-choice'        // 新增：语境挖空选择
  | 'reading-comprehension'; // 新增：阅读理解（含短文）

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  query: string;       // 题干或需要朗读的文本
  passage?: string;    // 新增：用于存放阅读理解的短文
  display?: string;    // 提示语（如 "Read the story and answer"）
  options: string[];
  answer: number;
  explanation?: string;
}
// types.ts 追加
export interface QuizConfig {
  difficulty: 'Elementary' | 'Intermediate' | 'Advanced';
  counts: {
    listeningChoice: number;    // 单词听力
    readingWord: number;       // 单词选择
    listeningContext: number;  // 听力语境
    contextChoice: number;     // 语境填空
    readingComp: number;       // 阅读理解
  };
}
