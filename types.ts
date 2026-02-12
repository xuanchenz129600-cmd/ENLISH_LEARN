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