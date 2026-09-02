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
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Message {
  id: string;
  sender: 'user' | 'mentor';
  text: string;
  audioBase64?: string;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'mentor',
      text:
        selectedLanguage === 'hi'
          ? 'नमस्ते! मैं आरव हूँ, आपका साइंस लैब बडी। कोई भी सवाल पूछें या किसी स्टेप में मदद चाहिए तो बेझिझक कहें!'
          : "Hey there! I'm Aarav, your senior lab buddy. Ask me anything about what's happening or if you get stuck!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const playVoiceResponse = (text: string, audioBase64?: string) => {
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current = null;
    }

    if (audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      currentAudioElementRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch(() => setIsPlayingAudio(false));
    } else if ('speechSynthesis' in window) {
      // Browser SpeechSynthesis Fallback
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = 1.0;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (questionText?: string) => {
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

      if (!response.ok) throw new Error('Network error');

      const data = await response.json();
      const mentorReply = data.reply || 'Check the highlighted apparatus on your table.';

      const mentorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'mentor',
        text: mentorReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, mentorMsg]);
    } catch {
      // Offline fallback
      const fallbackReply =
        selectedLanguage === 'hi'
          ? 'लैब गाइड: अपनी स्क्रीन पर दिखाए गए स्टेप के अनुसार रसायन डालें और सावधानी बरतें।'
          : 'Lab Guide Tip: Observe the highlighted apparatus and follow the step sequence precisely.';

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'mentor',
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        // Convert to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await handleVoiceSubmit(base64Audio);
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

      const userText = data.transcript || 'Spoken Question';
      const replyText = data.reply || 'Step assistance ready.';

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'user',
          text: userText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: (Date.now() + 1).toString(),
          sender: 'mentor',
          text: replyText,
          audioBase64: data.audioBase64,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      playVoiceResponse(replyText, data.audioBase64);
    } catch {
      // Fallback
      handleSend(selectedLanguage === 'hi' ? 'क्या करना है?' : 'What should I do next?');
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
                  Aarav <span className="text-[10px] font-mono text-purple-300 font-normal px-1.5 py-0.5 rounded bg-purple-500/20">AI Mentor</span>
                </h3>
                <p className="text-[10px] font-mono text-white/50">Grounded in NCERT Practical Guide</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switch */}
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => setLanguage('en')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded',
                    selectedLanguage === 'en' ? 'bg-purple-600 text-white font-bold' : 'text-white/60'
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('hi')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded',
                    selectedLanguage === 'hi' ? 'bg-purple-600 text-white font-bold' : 'text-white/60'
                  )}
                >
                  HI
                </button>
              </div>

              <button
                onClick={() => setMentorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
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
                        onClick={() => playVoiceResponse(msg.text, msg.audioBase64)}
                        className="hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Play audio response"
                      >
                        <Volume2 size={11} />
                        <span>Listen</span>
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
                  <span>Aarav is thinking</span>
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
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 text-xs">
                <div className="flex items-center gap-2 text-red-400 font-mono animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Listening to your question...</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  <Square size={16} />
                </button>
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
                      ? 'आरव से कोई भी सवाल पूछें...'
                      : 'Ask Aarav anything about the lab...'
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
