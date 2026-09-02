import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Voice ID map for ElevenLabs
export const VOICE_ID_MAP: Record<string, string> = {
  en: process.env.ELEVENLABS_VOICE_EN || '21m00Tcm4TlvDq8ikWAM', // Rachel
  hi: process.env.ELEVENLABS_VOICE_HI || 'onwK4e9ZLuTAKqWW03F9', // Multilingual Hindi Voice
};

interface CorpusChunk {
  id: string;
  step: number;
  type: string;
  text_en: string;
  text_hi: string;
}

interface CorpusDocument {
  experiment: string;
  title?: string;
  chunks: CorpusChunk[];
}

// In-memory Corpus Store
const corpusDatabase: Map<string, CorpusDocument> = new Map();

function loadAllCorpora() {
  const corpusBase = path.resolve(process.cwd(), 'corpus');
  if (!fs.existsSync(corpusBase)) return;

  const categories = fs.readdirSync(corpusBase);
  for (const cat of categories) {
    const catPath = path.join(corpusBase, cat);
    if (fs.statSync(catPath).isDirectory()) {
      const files = fs.readdirSync(catPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(catPath, file), 'utf-8');
            const doc: CorpusDocument = JSON.parse(raw);
            corpusDatabase.set(doc.experiment, doc);
          } catch (e) {
            console.error(`Failed to parse corpus file: ${file}`, e);
          }
        }
      }
    }
  }
  console.log(`[Corpus] Loaded ${corpusDatabase.size} experiment knowledge bases into memory.`);
}

loadAllCorpora();

// In-memory LRU Query Cache
const queryCache = new Map<string, { reply: string; timestamp: number }>();

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function calculateSimilarity(tokens1: Set<string>, tokens2: Set<string>): number {
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  tokens1.forEach((token) => {
    if (tokens2.has(token)) intersection++;
  });
  return intersection / Math.sqrt(tokens1.size * tokens2.size);
}

function detectIsHindi(question: string, langPref?: string): boolean {
  if (langPref === 'hi') return true;
  // Check for Devanagari characters
  if (/[\u0900-\u097F]/.test(question)) return true;
  
  // Check for common Hinglish question tokens
  const hinglishTokens = [
    'kya', 'kaise', 'kyu', 'kyun', 'karna', 'kare', 'karen', 'karein',
    'hoga', 'hota', 'hoti', 'hote', 'hai', 'hain', 'ho', 'tha', 'the',
    'batao', 'samjhao', 'namaste', 'aage', 'pehle', 'daale', 'daalna',
    'daalo', 'chahiye', 'nahi', 'nahin', 'madad', 'sahi', 'galat'
  ];
  const words = question.toLowerCase().split(/\s+/);
  return words.some((w) => hinglishTokens.includes(w));
}

function retrieveRelevantChunks(
  experimentId: string,
  currentStep: number,
  studentQuestion: string,
  language: 'en' | 'hi'
): { chunks: CorpusChunk[]; hasDirectMatch: boolean } {
  const doc = corpusDatabase.get(experimentId);
  if (!doc || !doc.chunks || doc.chunks.length === 0) {
    const allChunks: CorpusChunk[] = [];
    corpusDatabase.forEach((d) => allChunks.push(...d.chunks));
    return { chunks: allChunks.slice(0, 3), hasDirectMatch: false };
  }

  const qTokens = tokenize(studentQuestion);

  const scored = doc.chunks.map((chunk) => {
    const text = language === 'hi' ? chunk.text_hi : chunk.text_en;
    const cTokens = tokenize(text);
    let score = calculateSimilarity(qTokens, cTokens);

    if (chunk.step === currentStep) score += 0.45;
    if (chunk.step === 0) score += 0.2;

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.filter((s) => s.score > 0.08);
  const hasDirectMatch = topMatches.length > 0;

  return {
    chunks: (hasDirectMatch ? topMatches : scored).slice(0, 3).map((s) => s.chunk),
    hasDirectMatch,
  };
}

// Helper: Synthesize speech using ElevenLabs Multilingual model
async function synthesizeElevenLabsAudio(text: string, language: 'en' | 'hi'): Promise<string | null> {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey || elevenKey === 'MY_ELEVENLABS_API_KEY') return null;

  try {
    const voiceId = VOICE_ID_MAP[language] || VOICE_ID_MAP.en;
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });

    if (ttsRes.ok) {
      const arrayBuffer = await ttsRes.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    }
  } catch (err) {
    console.warn('ElevenLabs TTS error:', err);
  }
  return null;
}

// Groq Generation with Strict Language Routing
async function generateMentorResponse(
  experimentId: string,
  currentStep: number,
  languagePref: 'en' | 'hi',
  studentQuestion: string,
  mistakeContext?: string | null
): Promise<{ reply: string; detectedLanguage: 'en' | 'hi' }> {
  const isHindi = detectIsHindi(studentQuestion, languagePref);
  const language: 'en' | 'hi' = isHindi ? 'hi' : 'en';

  const cacheKey = `${experimentId}:${currentStep}:${language}:${studentQuestion.trim().toLowerCase()}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 30) {
    return { reply: cached.reply, detectedLanguage: language };
  }

  const { chunks, hasDirectMatch } = retrieveRelevantChunks(experimentId, currentStep, studentQuestion, language);
  const contextText = chunks
    .map((c) => `- ${language === 'hi' ? c.text_hi : c.text_en}`)
    .join('\n');

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'MY_GROQ_API_KEY' || apiKey.trim() === '') {
    if (chunks.length > 0) {
      const best = language === 'hi' ? chunks[0].text_hi : chunks[0].text_en;
      const prefix =
        language === 'hi'
          ? 'अरे दोस्त! लैब गाइड के अनुसार: '
          : "Hey there! Here's a tip from the lab guide: ";
      const reply = `${prefix}${best}`;
      queryCache.set(cacheKey, { reply, timestamp: Date.now() });
      return { reply, detectedLanguage: language };
    }
    return {
      reply: language === 'hi'
        ? 'प्रयोग में ध्यान रखें और दिए गए निर्देशों का क्रम से पालन करें।'
        : 'Keep following the step-by-step procedure on your screen. You are doing great!',
      detectedLanguage: language,
    };
  }

  const candidateModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'allam-2-7b'];

  for (const model of candidateModels) {
    try {
      const systemPrompt = isHindi
        ? `You are Aarav, an encouraging, friendly senior-student science lab buddy assisting an Indian high school student in a virtual science laboratory.
CRITICAL LANGUAGE REQUIREMENT:
You MUST respond ENTIRELY in fluent Hindi using the Devanagari script (हिंदी लिपि).
Do NOT write your answer in English.
You may mention scientific terms in English within brackets (e.g. उदासीनीकरण (neutralization), अम्ल (acid)), but the full explanation must be in Hindi.
Guidelines:
1. Speak warmly and encouragingly as a senior lab peer.
2. Keep your answer strictly to 2 to 4 concise sentences.
3. Current Experiment: ${experimentId}, Current Step: ${currentStep}.
${mistakeContext ? `Recent Student Mis-step: ${mistakeContext}` : ''}

${hasDirectMatch ? `NCERT Lab Facts:\n${contextText}` : 'Directly explain the student question accurately with scientific rigor.'}`
        : `You are Aarav, an encouraging, friendly senior-student science lab buddy assisting a high school student in a virtual science lab.
Guidelines:
1. Speak warmly, clearly, and naturally in English.
2. Keep your answer strictly to 2 to 4 concise, high-value sentences.
3. Current Experiment: ${experimentId}, Current Step: ${currentStep}.
${mistakeContext ? `Recent Student Mis-step: ${mistakeContext}` : ''}

${hasDirectMatch ? `Verified Lab Facts from NCERT Syllabus:\n${contextText}` : 'Instruction: Provide a helpful scientific explanation.'}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: studentQuestion },
          ],
          temperature: 0.5,
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          queryCache.set(cacheKey, { reply, timestamp: Date.now() });
          return { reply, detectedLanguage: language };
        }
      }
    } catch (modelErr) {
      console.warn(`Groq error with model ${model}:`, modelErr);
    }
  }

  const fallbackChunk = chunks[0] ? (language === 'hi' ? chunks[0].text_hi : chunks[0].text_en) : 'Follow the step sequence on your screen.';
  return {
    reply: `${language === 'hi' ? 'लैब गाइड संकेत:' : 'Lab Mentor hint:'} ${fallbackChunk}`,
    detectedLanguage: language,
  };
}

// Endpoint 1: Text Q&A with RAG + Groq + ElevenLabs Audio
app.post('/api/mentor/ask', async (req: Request, res: Response) => {
  try {
    const { experimentId = 'titration-10', currentStep = 1, language = 'en', mistakeContext, studentQuestion } = req.body;

    if (!studentQuestion || typeof studentQuestion !== 'string') {
      res.status(400).json({ error: 'studentQuestion is required' });
      return;
    }

    const { reply, detectedLanguage } = await generateMentorResponse(
      experimentId,
      Number(currentStep),
      language === 'hi' ? 'hi' : 'en',
      studentQuestion,
      mistakeContext
    );

    // Synthesize ElevenLabs audio in the detected language (Hindi / English)
    const audioBase64 = await synthesizeElevenLabsAudio(reply, detectedLanguage);

    res.json({
      reply,
      experimentId,
      currentStep,
      language: detectedLanguage,
      audioBase64,
    });
  } catch (error: any) {
    console.error('Error in /api/mentor/ask:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Endpoint 2: Voice Q&A with ElevenLabs STT + RAG/Groq + ElevenLabs TTS
app.post('/api/mentor/ask-voice', async (req: Request, res: Response) => {
  try {
    const { audioBase64, experimentId = 'titration-10', currentStep = 1, language = 'en', mistakeContext } = req.body;
    const elevenKey = process.env.ELEVENLABS_API_KEY;

    let transcript = language === 'hi' ? 'प्रयोग का अगला चरण क्या है?' : 'What is the next step in this experiment?';

    // 1. ElevenLabs STT
    if (elevenKey && elevenKey !== 'MY_ELEVENLABS_API_KEY' && audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/webm' });
        formData.append('file', blob, 'audio.webm');
        formData.append('model_id', 'scribe_v1');

        const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey },
          body: formData,
        });

        if (sttRes.ok) {
          const sttData = await sttRes.json();
          if (sttData.text) transcript = sttData.text;
        }
      } catch (sttErr) {
        console.warn('ElevenLabs STT error:', sttErr);
      }
    }

    // 2. Generate Mentor text reply via RAG + Groq
    const { reply, detectedLanguage } = await generateMentorResponse(
      experimentId,
      Number(currentStep),
      language === 'hi' ? 'hi' : 'en',
      transcript,
      mistakeContext
    );

    // 3. ElevenLabs TTS for high quality natural Hindi / English voice
    const audioBase64Response = await synthesizeElevenLabsAudio(reply, detectedLanguage);

    res.json({
      transcript,
      reply,
      detectedLanguage,
      audioBase64: audioBase64Response,
      useSpeechSynthesisFallback: !audioBase64Response,
    });
  } catch (error: any) {
    console.error('Error in /api/mentor/ask-voice:', error);
    res.status(500).json({ error: error.message || 'Voice pipeline error' });
  }
});

// Endpoint 3: On-Demand ElevenLabs TTS Generation
app.post('/api/mentor/tts', async (req: Request, res: Response) => {
  try {
    const { text, language = 'hi' } = req.body;
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const isHindi = detectIsHindi(text, language);
    const audioBase64 = await synthesizeElevenLabsAudio(text, isHindi ? 'hi' : 'en');

    res.json({
      audioBase64,
      language: isHindi ? 'hi' : 'en',
    });
  } catch (err: any) {
    console.error('Error in /api/mentor/tts:', err);
    res.status(500).json({ error: err.message || 'TTS generation error' });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    corporaCount: corpusDatabase.size,
    groqActive: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'MY_GROQ_API_KEY'),
    elevenLabsActive: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'MY_ELEVENLABS_API_KEY'),
  });
});

app.listen(PORT, () => {
  console.log(`[V-Lab Server] AI Mentor & Voice Backend running at http://localhost:${PORT}`);
});
