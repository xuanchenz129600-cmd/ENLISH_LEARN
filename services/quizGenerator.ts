import { db } from './storage';
import { QuizQuestion, QuizConfig } from '../types';

// API 配置
const DOUBAO_API_KEY = "2f32a348-0f27-4539-9168-72bf1db51c6e";
const DOUBAO_MODEL = "doubao-seed-1-6-flash-250828";
const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export const quizService = {
  /**
   * 生成考核题目
   * @param unitId 单元ID
   * @param config 用户自定义配置（含难度和各项数量）
   */
  generateQuiz: async (unitId: string, config: QuizConfig): Promise<QuizQuestion[]> => {
    try {
      // --- 1. 参数安全检查 (防止崩溃的核心) ---
      if (!config || !config.counts) {
        console.error("Quiz configuration is missing:", config);
        throw new Error("Configuration Error: config.counts is undefined");
      }

      // --- 2. 获取素材 ---
      const unitWords = db.getWords(unitId);
      const unitSentences = db.getSentences(unitId);
      
      const wordsData = unitWords.map(w => `${w.text} (释义: ${w.meaning})`).join('; ');
      const sentencesData = unitSentences.map(s => s.text).join('; ');

      if (unitWords.length < 3) {
        // 如果素材太少，返回一个提示性错误或空数组，这里抛出错误由前端捕获
        throw new Error("素材不足，请至少添加3个单词后再试");
      }

      // --- 3. 计算总题数与难度描述 ---
      const totalQuestions = Object.values(config.counts).reduce((a, b) => a + b, 0);
      
      // 如果总数为0，直接返回空数组，不消耗 Token
      if (totalQuestions === 0) return [];

      const difficultyDescMap: Record<string, string> = {
        Elementary: "基础词汇用法，句子结构简单，选项干扰度低。",
        Intermediate: "自然地道的语境，考察常见搭配，干扰项有一定迷惑性。",
        Advanced: "学术或深层文学语境，侧重考察同义词辨析、抽象用法及复杂逻辑，干扰项极强。"
      };
      
      const difficultyDesc = difficultyDescMap[config.difficulty] || difficultyDescMap['Intermediate'];

      // --- 4. 构造请求 Payload ---
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
              content: `你是一个专业的英语教育专家。请基于提供的素材生成总共 ${totalQuestions} 道英语考核题,要求题目和答案均合理。

【难度要求】：${config.difficulty}级。注意：${difficultyDesc}

【素材库】：
单词：${wordsData}
句子：${sentencesData}

【题目分布（严格按此数量生成）】：
1. 单词听力 (listening-choice): ${config.counts.listeningChoice}道,query为单词，options为中文释义，display为null,随机选取素材单词。
2. 单词选择 (reading-word): ${config.counts.readingWord}道，query为中文释义，options为英文单词,display为null,随机选取素材单词。
3. 听力语境理解 (listening-context): ${config.counts.listeningContext}道，query听力原文,display为题目要求。
4. 语境填空题 (context-choice): ${config.counts.contextChoice}道。query题目,display为null。
5. 综合阅读理解 (reading-comprehension): ${config.counts.readingComp}道，display为null。

【JSON 结构定义】：
每个对象必须包含：
- "id": 随机字符串
- "type": 对应上述类型名称
- "query": 题干文本（单词听力时为单词，填空题需包含 ____）
- "passage": (仅针对 reading-comprehension) 编写一段不少于100词的短文。**必须在每一道阅读理解题的对象里都完整返回此短文内容**。
- "display": 仅听力语境理解提供，作为题目要求，要求带中文释义。
- "options": ["A", "B", "C", "D"]
- "answer": 正确选项索引(0-3)
- "explanation": 中文，答案逻辑解析,包含题干解析,答案解析,对于阅读理解吗,有短文和题目还有选项的中文翻译。

【核心禁令】：
1. 严禁返回任何 Markdown 标签（如 \`\`\`json）。
2. 直接返回一个合法的 JSON 数组字符串。
3. 确保 JSON 转义正确。`
            },
            {
              role: "user",
              content: `基于素材库开始生成。总数：${totalQuestions}。`
            }
          ],
          temperature: 0.9,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API 异常: ${err}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";

      // --- 5. 清洗内容 ---
      content = content.replace(/```json/g, '')
                       .replace(/```/g, '')
                       .trim();

      try {
        const questions: QuizQuestion[] = JSON.parse(content);
        console.log("生成成功，题数：", questions.length);
        return questions;
      } catch (parseError) {
        console.error("JSON 解析错误，原始内容为:", content);
        throw new Error("AI 返回数据格式不合法");
      }

    } catch (error) {
      console.error("Quiz Service Error:", error);
      // 抛出错误以便 UI 层捕获并显示
      throw error; 
    }
  }
};
