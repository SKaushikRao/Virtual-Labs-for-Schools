import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { labAudio } from '../utils/LabAudio';

export type VoiceTriggerStatus = 'listening' | 'detected' | 'paused' | 'unsupported';

// Explicit phrase patterns for wake detection
const WAKE_PATTERNS = [
  /hello\s*mind\s*lab/i,
  /hello\s*mindlab/i,
  /hey\s*mind\s*lab/i,
  /hey\s*mindlab/i,
  /hi\s*mind\s*lab/i,
  /hi\s*mindlab/i,
  /ok\s*mind\s*lab/i,
  /okay\s*mind\s*lab/i,
  /namaste\s*mind\s*lab/i,
  /namaste\s*mindlab/i,
  /namaskaram\s*mind\s*lab/i,
  /hello\s*mine\s*lab/i,
  /hello\s*main\s*lab/i,
  /hello\s*my\s*lab/i,
  /hello\s*mind\s*lap/i,
  /hello\s*mind\s*map/i,
  /hello\s*mind\s*app/i,
  /hello\s*mentor/i,
  /hey\s*mentor/i,
  /hi\s*mentor/i,
  /open\s*mentor/i,
  /open\s*mind\s*lab/i,
  /open\s*ai\s*mentor/i,
  /\bmind\s*lab\b/i,
  /\bmindlab\b/i,
];

/**
 * Custom React hook for continuous browser-native speech recognition
 * listening for the "Hello MindLab" wake phrase to trigger the AI Mentor panel.
 */
export function useMindLabVoiceTrigger() {
  const isMentorOpen = useAppStore((s) => s.isMentorOpen);
  const setMentorOpen = useAppStore((s) => s.setMentorOpen);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);

  const [status, setStatus] = useState<VoiceTriggerStatus>('paused');
  const [isEnabled, setIsEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(true);
  const isRunningRef = useRef(false);
  const lastTriggerTimeRef = useRef<number>(0);
  const restartTimerRef = useRef<number | null>(null);
  const isComponentMountedRef = useRef(true);
  const detectedTimerRef = useRef<number | null>(null);

  isEnabledRef.current = isEnabled;

  // Transcript normalizer
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"!\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Trigger wake phrase match
  const handleWakePhraseDetected = useCallback(
    (matchedText: string) => {
      const now = Date.now();
      // 2.5s debounce / cooldown to avoid multiple firings on continuous interim streams
      if (now - lastTriggerTimeRef.current < 2500) {
        return;
      }
      lastTriggerTimeRef.current = now;

      console.log('[MindLab Voice Trigger] 🎯 WAKE PHRASE DETECTED:', matchedText);

      // Play soft chime audio feedback
      try {
        labAudio.playGrabSound();
      } catch {
        // Ignore audio errors
      }

      // Show detected state briefly in UI
      setStatus('detected');
      if (detectedTimerRef.current) {
        clearTimeout(detectedTimerRef.current);
      }
      detectedTimerRef.current = window.setTimeout(() => {
        if (isComponentMountedRef.current && isEnabledRef.current) {
          setStatus('listening');
        }
      }, 2500);

      // Open existing AI Mentor panel in global store
      useAppStore.getState().setMentorOpen(true);
      setMentorOpen(true);
    },
    [setMentorOpen]
  );

  // Safe start function
  const safeStart = useCallback(() => {
    if (!recognitionRef.current || !isEnabledRef.current || !isComponentMountedRef.current) {
      return;
    }
    if (isRunningRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
      isRunningRef.current = true;
      setStatus('listening');
      console.log('[MindLab Voice Trigger] 🎙️ Speech recognition started (listening for "Hello MindLab").');
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        // Already started
        isRunningRef.current = true;
        setStatus('listening');
      } else {
        console.warn('[MindLab Voice Trigger] Start notice:', err.message || err);
      }
    }
  }, []);

  useEffect(() => {
    isComponentMountedRef.current = true;

    // Check browser compatibility for Web Speech API
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('[MindLab Voice Trigger] Web Speech API not supported in this browser.');
      setStatus('unsupported');
      return;
    }

    let recognition: any = null;

    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      // Select default locale (en-IN works well for Indian English, Hindi & Telugu accents, fall back to navigator)
      recognition.lang =
        selectedLanguage === 'hi'
          ? 'hi-IN'
          : selectedLanguage === 'te'
          ? 'te-IN'
          : navigator.language || 'en-IN';

      recognition.onstart = () => {
        isRunningRef.current = true;
        if (isEnabledRef.current) {
          setStatus('listening');
        }
      };

      recognition.onaudiostart = () => {
        isRunningRef.current = true;
      };

      recognition.onresult = (event: any) => {
        if (!isEnabledRef.current) return;

        // Build full transcript across all recent results to avoid missing split phrases across results
        const resultTexts: string[] = [];
        let combinedRecent = '';

        const startIndex = Math.max(0, event.results.length - 6);
        for (let i = startIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res) continue;

          for (let j = 0; j < res.length; ++j) {
            const transcript = res[j]?.transcript || '';
            if (transcript) {
              resultTexts.push(transcript);
              if (j === 0) {
                combinedRecent += ' ' + transcript;
              }
            }
          }
        }

        resultTexts.push(combinedRecent);

        // Check all candidate phrases
        for (const rawText of resultTexts) {
          const normalized = normalizeText(rawText);
          if (!normalized) continue;

          // Check if any wake pattern matches
          for (const pattern of WAKE_PATTERNS) {
            if (pattern.test(normalized)) {
              handleWakePhraseDetected(normalized);
              return;
            }
          }
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          console.warn('[MindLab Voice Trigger]: Mic permission denied or blocked by browser.');
          setStatus('paused');
          isRunningRef.current = false;
        } else if (e.error === 'no-speech') {
          // Normal silence timeout in continuous mode - do not log as error
        } else if (e.error !== 'aborted') {
          console.warn('[MindLab Voice Trigger]:', e.error);
        }
      };

      recognition.onend = () => {
        isRunningRef.current = false;
        // Automatically restart speech recognition if enabled and component is still mounted
        if (isComponentMountedRef.current && isEnabledRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = window.setTimeout(() => {
            if (isComponentMountedRef.current && isEnabledRef.current && !isRunningRef.current) {
              safeStart();
            }
          }, 300);
        } else {
          setStatus('paused');
        }
      };

      recognitionRef.current = recognition;

      if (isEnabled) {
        safeStart();
      } else {
        setStatus('paused');
      }
    } catch (err) {
      console.warn('[MindLab Voice Trigger]: Speech recognition initialization failed:', err);
      setStatus('unsupported');
    }

    return () => {
      isComponentMountedRef.current = false;
      isRunningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (detectedTimerRef.current) clearTimeout(detectedTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [selectedLanguage, isEnabled, handleWakePhraseDetected, safeStart]);

  // Toggle voice trigger active / paused
  const toggleVoiceTrigger = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      isEnabledRef.current = next;

      if (!recognitionRef.current) return next;

      if (next) {
        safeStart();
      } else {
        try {
          isRunningRef.current = false;
          recognitionRef.current.stop();
          setStatus('paused');
        } catch {
          setStatus('paused');
        }
      }
      return next;
    });
  }, [safeStart]);

  return {
    status,
    isEnabled,
    toggleVoiceTrigger,
  };
}
