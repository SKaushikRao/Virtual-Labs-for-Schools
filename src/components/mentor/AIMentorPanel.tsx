import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import {
  Sparkles,
  X,
  Send,
  Mic,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Bot,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Message {
  id: string;
  sender: 'user' | 'mentor';
  text: string;
  audioBase64?: string;
  language?: 'en' | 'hi' | 'te';
  timestamp: string;
}

export const AIMentorPanel: React.FC = () => {
  const isMentorOpen = useAppStore((s) => s.isMentorOpen);
  const setMentorOpen = useAppStore((s) => s.setMentorOpen);
  const setTutorialOpen = useAppStore((s) => s.setTutorialOpen);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const selectedExperiment = useAppStore((s) => s.selectedExperiment) || 'titration-10';
  const currentStep = useAppStore((s) => s.currentStep);
  const recentMistake = useAppStore((s) => s.recentMistake);

  const [input, setInput] = useState('');
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'mentor',
      text:
        selectedLanguage === 'hi'
          ? 'नमस्ते! मैं MindLab AI हूँ, आपका साइंस लैब मेंटर। कोई भी सवाल पूछें या किसी स्टेप में मदद चाहिए तो बेझिझक कहें!'
          : selectedLanguage === 'te'
          ? 'నమస్కారం! నేను MindLab AI, మీ సైన్స్ ల్యాబ్ మెంటార్‌ని. ఏదైనా సందేహం ఉంటే లేదా సహాయం కావాలంటే అడగండి!'
          : "Hey there! I'm MindLab AI, your virtual science lab mentor. Ask me anything about what's happening or if you get stuck!",
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize SpeechSynthesis voice list
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = onVoices;
    }
  }, []);

  // Update greeting when user toggles language if chat is fresh
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        const updatedWelcome: Message = {
          id: 'welcome',
          sender: 'mentor',
          text:
            selectedLanguage === 'hi'
              ? 'नमस्ते! मैं MindLab AI हूँ, आपका साइंस लैब मेंटर। कोई भी सवाल पूछें या किसी स्टेप में मदद चाहिए तो बेझिझक कहें!'
              : selectedLanguage === 'te'
              ? 'నమస్కారం! నేను MindLab AI, మీ సైన్స్ ల్యాబ్ మెంటార్‌ని. ఏదైనా సందేహం ఉంటే లేదా సహాయం కావాలంటే అడగండి!'
              : "Hey there! I'm MindLab AI, your virtual science lab mentor. Ask me anything about what's happening or if you get stuck!",
          language: selectedLanguage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        return [updatedWelcome];
      }
      return prev;
    });
  }, [selectedLanguage]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Direct client ElevenLabs TTS (Guarantees fluent Telugu & Hindi neural speech everywhere)
  const synthesizeVoiceDirectly = async (text: string, langPref: 'en' | 'hi' | 'te'): Promise<string | null> => {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenKey || elevenKey === 'MY_ELEVENLABS_API_KEY') return null;

    const voiceId =
      langPref === 'hi'
        ? (process.env.ELEVENLABS_VOICE_HI || 'onwK4e9ZLuTAKqWW03F9')
        : langPref === 'te'
        ? (process.env.ELEVENLABS_VOICE_TE || 'onwK4e9ZLuTAKqWW03F9')
        : (process.env.ELEVENLABS_VOICE_EN || 'JBFqnCBsd6RMkjVDRZzb');

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      }
    } catch (err) {
      console.warn('Direct ElevenLabs client TTS error:', err);
    }
    return null;
  };

  const speakWithBrowserSynthesis = (text: string, langPref: 'en' | 'hi' | 'te') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langPref === 'hi' ? 'hi-IN' : langPref === 'te' ? 'te-IN' : 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const targetLang = langPref === 'hi' ? 'hi' : langPref === 'te' ? 'te' : 'en';
        const matchedVoice =
          voices.find((v) => v.lang.toLowerCase().startsWith(targetLang)) ||
          voices.find((v) => v.lang.toLowerCase().includes(targetLang)) ||
          voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) ||
          voices[0];
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const playVoiceResponse = async (msg: Message) => {
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const lang = msg.language || selectedLanguage;

    // 1. If audioBase64 already exists
    if (msg.audioBase64) {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${msg.audioBase64}`);
        currentAudioElementRef.current = audio;
        setIsPlayingAudio(true);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          setIsPlayingAudio(false);
          speakWithBrowserSynthesis(msg.text, lang);
        };
        await audio.play();
        return;
      } catch {
        // Fall back to direct synthesis
      }
    }

    setLoadingAudioId(msg.id);

    // 2. Try Backend Server TTS endpoint
    let generatedAudioBase64: string | null = null;
    try {
      const res = await fetch('/api/mentor/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.text,
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          generatedAudioBase64 = data.audioBase64;
        }
      }
    } catch {
      // Backend not running on port 3001, fallback to direct client call
    }

    // 3. Direct Client ElevenLabs TTS fallback (Works seamlessly even without Express server running!)
    if (!generatedAudioBase64) {
      generatedAudioBase64 = await synthesizeVoiceDirectly(msg.text, lang);
    }

    setLoadingAudioId(null);

    // If audio was generated from ElevenLabs (Backend or Client)
    if (generatedAudioBase64) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, audioBase64: generatedAudioBase64! } : m))
      );
      try {
        const audio = new Audio(`data:audio/mp3;base64,${generatedAudioBase64}`);
        currentAudioElementRef.current = audio;
        setIsPlayingAudio(true);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          setIsPlayingAudio(false);
          speakWithBrowserSynthesis(msg.text, lang);
        };
        await audio.play();
        return;
      } catch {
        // Fall back to browser synthesis
      }
    }

    // 4. Last-resort fallback: Browser SpeechSynthesis
    speakWithBrowserSynthesis(msg.text, lang);
  };

  // Direct Groq API fallback in case proxy or backend server is not running
  const queryGroqDirectly = async (q: string, lang: 'en' | 'hi' | 'te'): Promise<string> => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('No Groq key available');
    }

    let systemPrompt = '';
    if (lang === 'te') {
      systemPrompt = `You are MindLab AI, an encouraging senior-student science lab mentor assisting a high school student in a virtual science lab.
Respond ENTIRELY in natural, fluent Telugu using Telugu script (తెలుగు లిపి).
Keep your answer strictly to 2 to 4 concise sentences.
Current Experiment: ${selectedExperiment}, Current Step: ${currentStep}.
${recentMistake ? `Recent Mis-step: ${recentMistake}` : ''}`;
    } else if (lang === 'hi') {
      systemPrompt = `You are MindLab AI, an encouraging senior-student science lab mentor assisting a high school student in a virtual science lab.
Respond ENTIRELY in fluent Hindi using Devanagari script (हिंदी लिपि).
Keep your answer strictly to 2 to 4 concise sentences.
Current Experiment: ${selectedExperiment}, Current Step: ${currentStep}.
${recentMistake ? `Recent Mis-step: ${recentMistake}` : ''}`;
    } else {
      systemPrompt = `You are MindLab AI, an encouraging, friendly senior-student science lab mentor assisting a high school student in a virtual science lab.
Speak warmly, clearly, and naturally in English. Keep your answer strictly to 2 to 4 concise sentences.
Current Experiment: ${selectedExperiment}, Current Step: ${currentStep}.
${recentMistake ? `Recent Mis-step: ${recentMistake}` : ''}`;
    }

    const candidateModels = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'allam-2-7b'];
    for (const model of candidateModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: q },
            ],
            temperature: 0.5,
            max_tokens: 300,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        }
      } catch (e) {
        console.warn(`Direct Groq query error with model ${model}:`, e);
      }
    }
    throw new Error('All Groq models failed');
  };

  const handleSend = async (questionText?: string, autoSpeak = true) => {
    const q = (questionText || input).trim();
    if (!q || isLoading) return;

    setInput('');
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let mentorReply = '';
    let audioBase64: string | undefined;
    let detectedLanguage = selectedLanguage;

    // 1. Try Backend Server
    try {
      const response = await fetch('/api/mentor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: selectedExperiment,
          currentStep,
          language: selectedLanguage,
          studentQuestion: q,
          mistakeContext: recentMistake,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        mentorReply = data.reply;
        audioBase64 = data.audioBase64;
        detectedLanguage = data.language || selectedLanguage;
      }
    } catch {
      // Backend not running / proxy error
    }

    // 2. Direct Groq fallback if backend did not reply
    if (!mentorReply) {
      try {
        mentorReply = await queryGroqDirectly(q, selectedLanguage);
      } catch {
        mentorReply =
          selectedLanguage === 'hi'
            ? 'लैब गाइड: अपनी स्क्रीन पर दिखाए गए स्टेप के अनुसार सही उपकरण और रसायनों का प्रयोग करें।'
            : selectedLanguage === 'te'
            ? 'ల్యాబ్ గైడ్: స్క్రీన్‌పై చూపించిన దశల ప్రకారం సరైన పరికరాలను ఉపయోగించండి.'
            : 'Lab Guide Tip: Observe the highlighted apparatus and follow the step sequence precisely.';
      }
    }

    const mentorMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'mentor',
      text: mentorReply,
      audioBase64,
      language: detectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, mentorMsg]);
    setIsLoading(false);

    if (autoSpeak || autoSpeakEnabled) {
      playVoiceResponse(mentorMsg);
    }
  };

  // Speech-to-Text Voice Recording (Resilient MediaRecorder + Web Speech API live stream)
  const streamRef = useRef<MediaStream | null>(null);
  const liveTranscriptRef = useRef<string>('');

  const startRecording = async () => {
    liveTranscriptRef.current = '';
    audioChunksRef.current = [];

    try {
      // 1. Acquire microphone stream first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Initialize MediaRecorder
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        
        // Cleanup mic tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const currentTranscript = liveTranscriptRef.current.trim();
        if (currentTranscript) {
          // If browser speech recognition already transcribed the speech
          handleSend(currentTranscript, true);
        } else if (audioBlob.size > 0) {
          // Send recorded audio to backend Whisper/ElevenLabs STT
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (base64Audio) {
              await handleVoiceSubmit(base64Audio);
            }
          };
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecording(true);

      // 3. Simultaneously attach Web Speech Recognition if supported for live captioning
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang =
            selectedLanguage === 'hi'
              ? 'hi-IN'
              : selectedLanguage === 'te'
              ? 'te-IN'
              : 'en-US';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript + ' ';
              } else {
                interimTranscript += res[0].transcript;
              }
            }
            const fullText = (finalTranscript + interimTranscript).trim();
            if (fullText) {
              liveTranscriptRef.current = fullText;
              setInput(fullText);
            }
          };

          recognition.onerror = (e: any) => {
            // Ignore benign non-fatal pauses/no-speech events so recording doesn't cut off prematurely
            if (e.error !== 'no-speech' && e.error !== 'audio-capture') {
              console.warn('[SpeechRecognition Notice]:', e.error);
            }
          };

          recognition.onend = () => {
            // Do not reset isRecording here; user explicitly controls or sends
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch (recognitionErr) {
          console.warn('SpeechRecognition initialization skipped:', recognitionErr);
        }
      }
    } catch (err: any) {
      console.error('Microphone error:', err);
      setIsRecording(false);
      alert('Could not access microphone. Please ensure microphone permissions are allowed.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
  };

  const handleVoiceSubmit = async (base64Audio: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentor/ask-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          experimentId: selectedExperiment,
          currentStep,
          language: selectedLanguage,
          mistakeContext: recentMistake,
        }),
      });

      if (!res.ok) throw new Error('Voice API failed');
      const data = await res.json();

      const userText = data.transcript || (selectedLanguage === 'hi' ? 'बोला गया प्रश्न' : 'Spoken Question');
      const replyText = data.reply || (selectedLanguage === 'hi' ? 'लैब सहायता तैयार है।' : 'Step assistance ready.');

      const mentorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'mentor',
        text: replyText,
        audioBase64: data.audioBase64,
        language: data.detectedLanguage || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'user',
          text: userText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        mentorMsg,
      ]);

      playVoiceResponse(mentorMsg);
    } catch {
      handleSend(
        selectedLanguage === 'hi' ? 'क्या करना है?' : selectedLanguage === 'te' ? 'తర్వాత ఏమి చేయాలి?' : 'What should I do next?',
        true
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isMentorOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-16 right-0 bottom-0 w-96 max-w-[90vw] bg-[#0c0d1e]/95 backdrop-blur-2xl border-l border-white/10 z-40 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.8)]"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-white flex items-center gap-1.5">
                  MindLab AI <span className="text-[10px] font-mono text-purple-300 font-normal px-1.5 py-0.5 rounded bg-purple-500/20">Mentor</span>
                </h3>
                <p className="text-[10px] font-mono text-white/50">Grounded in NCERT Practical Guide</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Auto-Speak Toggle */}
              <button
                onClick={() => {
                  setAutoSpeakEnabled((prev) => !prev);
                  if (isPlayingAudio && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    setIsPlayingAudio(false);
                  }
                }}
                className={cn(
                  'p-1.5 rounded-lg border transition-all cursor-pointer',
                  autoSpeakEnabled
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border-white/10 text-white/40'
                )}
                title={autoSpeakEnabled ? 'Auto voice enabled (Click to mute)' : 'Auto voice muted (Click to unmute)'}
              >
                {autoSpeakEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>

              {/* Language Switch */}
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => setLanguage('en')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-all',
                    selectedLanguage === 'en' ? 'bg-purple-600 text-white font-bold' : 'text-white/60'
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('hi')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-all',
                    selectedLanguage === 'hi' ? 'bg-purple-600 text-white font-bold' : 'text-white/60'
                  )}
                >
                  HI
                </button>
                <button
                  onClick={() => setLanguage('te')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-all',
                    selectedLanguage === 'te' ? 'bg-purple-600 text-white font-bold' : 'text-white/60'
                  )}
                >
                  TE
                </button>
              </div>

              <button
                onClick={() => setMentorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Context Notice / Recent Mistake Banner */}
          {recentMistake && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-200">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold">Detected Mis-step: </span>
                <span>{recentMistake}</span>
              </div>
            </div>
          )}

          {/* Messages List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex gap-2.5', msg.sender === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.sender === 'mentor' && (
                  <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-1">
                    <Sparkles size={12} />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed',
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-md'
                      : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-sm backdrop-blur-md'
                  )}
                >
                  <p>{msg.text}</p>
                  <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-white/5 text-[9px] text-white/40">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'mentor' && (
                      <button
                        onClick={() => playVoiceResponse(msg)}
                        disabled={loadingAudioId === msg.id}
                        className="hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-mono font-medium"
                        title="Play spoken response"
                      >
                        {loadingAudioId === msg.id ? (
                          <Loader2 size={11} className="animate-spin text-cyan-300" />
                        ) : (
                          <Volume2 size={11} />
                        )}
                        <span>{loadingAudioId === msg.id ? 'Loading...' : 'Listen 🔊'}</span>
                      </button>
                    )}
                  </div>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-1">
                    <User size={12} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-xs text-purple-300/80 font-mono">
                <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 animate-pulse">
                  <Sparkles size={12} />
                </div>
                <div className="flex items-center gap-1 bg-white/5 px-3 py-2 rounded-2xl border border-white/10">
                  <span>MindLab AI is thinking</span>
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce [animation-delay:0.2s]">.</span>
                  <span className="animate-bounce [animation-delay:0.4s]">.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Gesture Assistance Link */}
          <div className="px-4 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-cyan-300">
            <span>Stuck with gestures?</span>
            <button
              onClick={() => {
                setMentorOpen(false);
                setTutorialOpen(true);
              }}
              className="flex items-center gap-1 hover:underline text-cyan-400 font-bold cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Retry gesture practice</span>
            </button>
          </div>

          {/* Input & Voice Controls */}
          <div className="p-4 border-t border-white/10 bg-black/40">
            {isRecording ? (
              <div className="flex flex-col gap-2 bg-red-500/10 border border-red-500/40 rounded-2xl p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 font-mono animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span>Listening to your voice...</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-red-500/30 cursor-pointer"
                  >
                    <Square size={13} />
                    <span>Stop & Send</span>
                  </button>
                </div>
                {input.trim() && (
                  <p className="text-[11px] text-purple-200/90 italic bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5 truncate">
                    "{input}"
                  </p>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedLanguage === 'hi'
                      ? 'MindLab AI से कोई भी सवाल पूछें...'
                      : selectedLanguage === 'te'
                      ? 'MindLab AI ని ఏదైనా ప్రశ్న అడగండి...'
                      : 'Ask MindLab AI anything about the lab...'
                  }
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 transition-colors"
                />

                <button
                  type="button"
                  onClick={startRecording}
                  title="Speak question (Microphone)"
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  <Mic size={16} />
                </button>

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-40 transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.4)] cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
