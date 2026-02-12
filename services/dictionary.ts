import { GoogleGenAI, Type } from "@google/genai";

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: {
    text?: string;
    audio?: string;
  }[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const dictionaryService = {
  fetchDefinition: async (word: string): Promise<DictionaryEntry | null> => {
    try {
      const cleanWord = word.replace(/[^a-zA-Z0-9']/g, '');

      // 1. Fire requests in parallel:
      // - Free Dictionary API for Audio/Phonetics (Native Sound)
      // - Gemini for Chinese Definitions (Translation)
      const audioPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      const aiPromise = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Define the English word "${cleanWord}" for a Chinese learner.
                   Provide the definition in Simplified Chinese (Mandarin).
                   Provide a short English example sentence for each definition.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              phonetic: { type: Type.STRING, description: "IPA Phonetic transcription" },
              meanings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partOfSpeech: { type: Type.STRING },
                    definitions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          definition: { type: Type.STRING, description: "Simplified Chinese definition" },
                          example: { type: Type.STRING, description: "English example sentence" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const [apiData, aiResponse] = await Promise.all([audioPromise, aiPromise]);

      // 2. Parse Gemini Result
      let result: DictionaryEntry | null = null;
      
      if (aiResponse.text) {
        try {
          const aiJson = JSON.parse(aiResponse.text);
          result = {
            word: aiJson.word || cleanWord,
            phonetic: aiJson.phonetic || '',
            phonetics: [], // Will be populated from API data
            meanings: aiJson.meanings || []
          };
        } catch (e) {
          console.error("Failed to parse Gemini JSON", e);
        }
      }

      // 3. Merge Strategies
      // If AI failed completely, fallback to API data (English definitions)
      if (!result && apiData && apiData[0]) {
        return apiData[0];
      }

      // If AI succeeded, enrich it with Audio from API data
      if (result && apiData && apiData[0]) {
        result.phonetics = apiData[0].phonetics || [];
        // Prefer API phonetic if AI didn't return one
        if (!result.phonetic && apiData[0].phonetic) {
          result.phonetic = apiData[0].phonetic;
        }
      }

      return result;

    } catch (error) {
      console.error('Dictionary Fetch Error:', error);
      return null;
    }
  },

  // Helper to find the best audio (US preference)
  getAudioUrl: (entry: DictionaryEntry): string | null => {
    if (!entry.phonetics || entry.phonetics.length === 0) return null;

    const usPhonetic = entry.phonetics.find(p => p.audio && p.audio.includes('-us.mp3'));
    if (usPhonetic && usPhonetic.audio) return usPhonetic.audio;
    
    // Fallback to any audio
    const anyAudio = entry.phonetics.find(p => p.audio && p.audio.length > 0);
    return anyAudio?.audio || null;
  },

  // New generic translation method for sentences and texts
  translateToChinese: async (text: string): Promise<string | null> => {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following English text into natural, fluent Simplified Chinese.
                   Maintain the original tone, structure, and paragraph formatting if present.
                   Do not include any introductory or concluding remarks, explanations, or quotes around the output. 
                   Just provide the raw translation.

                   Text to translate:
                   ${text}`
      });
      return result.text ? result.text.trim() : null;
    } catch (error) {
      console.error('Translation Error:', error);
      return null;
    }
  }
};