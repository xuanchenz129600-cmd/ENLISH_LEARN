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

// --- 豆包 (Doubao) 配置 ---
const DOUBAO_API_KEY = "2f32a348-0f27-4539-9168-72bf1db51c6e";
const DOUBAO_MODEL = "doubao-seed-1-6-flash-250828";
const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export const dictionaryService = {
  fetchDefinition: async (word: string): Promise<DictionaryEntry | null> => {
    try {
      const cleanWord = word.replace(/[^a-zA-Z0-9']/g, '');

      // ============================================================
      // 修复核心：使用 async/await 包装请求，彻底解决 .catch 类型报错
      // ============================================================

      // 1. 请求 Free Dictionary API (获取音频)
      const audioPromise = (async () => {
        try {
          const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
          return res.ok ? await res.json() : null;
        } catch (error) {
          return null; // 这里返回 null 不会再报错了
        }
      })();

      // 2. 请求 豆包 API (获取中文释义)
      const doubaoPromise = (async () => {
        try {
          const res = await fetch(DOUBAO_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DOUBAO_API_KEY}`
            },
            body: JSON.stringify({
              model: DOUBAO_MODEL,
              messages: [
                {
                  role: "system",
                  content: `你是一个英汉词典 API。
请严格按照以下 JSON 格式返回单词 "${cleanWord}" 的解释。
不要使用 Markdown 代码块，不要包含 \`\`\`json，直接返回纯 JSON 字符串。

JSON 格式要求：
{
  "word": "${cleanWord}",
  "phonetic": "音标",
  "meanings": [
    {
      "partOfSpeech": "词性 (如 noun, verb)",
      "definitions": [
        {
          "definition": "简体中文释义",
          "example": "简短的英文例句"
        }
      ]
    }
  ]
}`
                },
                {
                  role: "user",
                  content: cleanWord
                }
              ],
              temperature: 0.1
            })
          });

          if (!res.ok) {
            console.error("Doubao API Error:", await res.text());
            return null;
          }
          return await res.json();
        } catch (error) {
          console.error("Doubao Network Error:", error);
          return null;
        }
      })();

      // 3. 并行等待结果
      const [apiData, doubaoResponse] = await Promise.all([audioPromise, doubaoPromise]);

      // 4. 解析豆包数据
      let result: DictionaryEntry | null = null;

      // 使用类型断言 any，避免复杂的类型检查
      const doubaoAny = doubaoResponse as any;

      if (doubaoAny && doubaoAny.choices && doubaoAny.choices[0]) {
        try {
          let content = doubaoAny.choices[0].message.content;
          // 清洗 Markdown 标记
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          const aiJson = JSON.parse(content);

          result = {
            word: aiJson.word || cleanWord,
            phonetic: aiJson.phonetic || '',
            phonetics: [],
            meanings: aiJson.meanings || []
          };
        } catch (e) {
          console.error("Failed to parse Doubao JSON", e);
        }
      }

      // 5. 兜底与合并
      const apiDataAny = apiData as any; // 同样断言为 any 方便处理

      // 如果豆包失败，用英文 API 兜底
      if (!result && Array.isArray(apiDataAny) && apiDataAny[0]) {
        return apiDataAny[0] as DictionaryEntry;
      }

      // 如果豆包成功，合并英文 API 的音频
      if (result && Array.isArray(apiDataAny) && apiDataAny[0]) {
        result.phonetics = apiDataAny[0].phonetics || [];

        if (!result.phonetic && apiDataAny[0].phonetic) {
          result.phonetic = apiDataAny[0].phonetic;
        }
      }

      return result;

    } catch (error) {
      console.error('Dictionary Fetch Error:', error);
      return null;
    }
  },

  getAudioUrl: (entry: DictionaryEntry): string | null => {
    if (!entry.phonetics || entry.phonetics.length === 0) return null;
    const usPhonetic = entry.phonetics.find(p => p.audio && p.audio.includes('-us.mp3'));
    if (usPhonetic && usPhonetic.audio) return usPhonetic.audio;
    const anyAudio = entry.phonetics.find(p => p.audio && p.audio.length > 0);
    return anyAudio?.audio || null;
  },

  translateToChinese: async (text: string): Promise<string | null> => {
    try {
      const response = await fetch(DOUBAO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`
        },
        body: JSON.stringify({
          model: DOUBAO_MODEL,
          messages: [
            {
              role: "system",
              content: "你是一个翻译助手。请将用户输入的英文直接翻译成地道的简体中文，不要包含任何解释或额外文本。"
            },
            {
              role: "user",
              content: text
            }
          ]
        })
      });

      if (!response.ok) return null;
      const data: any = await response.json(); // 显式声明 any
      return data.choices?.[0]?.message?.content || null;

    } catch (error) {
      console.error('Translation Error:', error);
      return null;
    }
  }
};
