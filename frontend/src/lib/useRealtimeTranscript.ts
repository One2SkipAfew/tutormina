/**
 * useRealtimeTranscript — Real-time speech-to-text hook
 *
 * Supports two backends:
 *  1. Deepgram WebSocket (via the AI API) — accurate, speaker diarisation, works everywhere
 *  2. Web Speech API (browser built-in) — free, Chrome-only, less accurate fallback
 *
 * Automatically selects Deepgram if the AI API WebSocket is reachable, otherwise falls back
 * to the browser's Web Speech API.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getWsUrl } from './aiApi';

export interface TranscriptEntry {
  id: string;
  text: string;
  speaker: number;
  start: number;
  end: number;
  timestamp: number;
  isFinal: boolean;
}

interface UseRealtimeTranscriptReturn {
  /** All finalised transcript entries. */
  transcriptEntries: TranscriptEntry[];
  /** Current interim (in-progress) text being spoken. */
  interimText: string;
  /** Current interim speaker index. */
  interimSpeaker: number;
  /** Whether the microphone is actively recording. */
  isListening: boolean;
  /** Whether recording is paused but still connected. */
  isPaused: boolean;
  /** Connection status: 'disconnected' | 'connecting' | 'connected' | 'error' */
  connectionStatus: string;
  /** Elapsed recording time in seconds. */
  duration: number;
  /** Which transcription method is in use. */
  method: 'deepgram' | 'webspeech' | 'none';
  /** Start recording. */
  start: () => Promise<void>;
  /** Stop recording and close connections. */
  stop: () => void;
  /** Toggle pause/resume. */
  togglePause: () => void;
  /** Get full transcript as a single string. */
  getFullTranscript: () => string;
  /** Reset all state. */
  reset: () => void;
}

const MAX_DURATION_SECONDS = 5400; // 1.5 hours

export function useRealtimeTranscript(): UseRealtimeTranscriptReturn {
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [interimSpeaker, setInterimSpeaker] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [duration, setDuration] = useState(0);
  const [method, setMethod] = useState<'deepgram' | 'webspeech' | 'none'>('none');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const isPausedRef = useRef(false);

  // Keep ref in sync with state for use inside callbacks
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      } catch { /* ignore */ }
      wsRef.current.close();
      wsRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    cleanupAudio();
    setIsListening(false);
    setIsPaused(false);
    setConnectionStatus('disconnected');
    setInterimText('');
  }, [cleanupAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const startDeepgram = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          cleanupAudio();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          setConnectionStatus('connected');
          setMethod('deepgram');

          // Audio pipeline: capture PCM and send to server
          const audioContext = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN && !isPausedRef.current) {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              ws.send(pcmData.buffer);
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'transcript') {
              if (msg.is_final) {
                setTranscriptEntries(prev => [
                  ...prev,
                  {
                    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    text: msg.text,
                    speaker: msg.speaker || 0,
                    start: msg.start || 0,
                    end: msg.end || 0,
                    timestamp: Date.now(),
                    isFinal: true,
                  },
                ]);
                setInterimText('');
                setInterimSpeaker(0);
              } else {
                setInterimText(msg.text);
                setInterimSpeaker(msg.speaker || 0);
              }
            }
          } catch { /* ignore */ }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          setConnectionStatus('error');
          resolve(false);
        };

        ws.onclose = () => {
          setConnectionStatus('disconnected');
        };
      });
    } catch {
      return false;
    }
  }, [cleanupAudio]);

  const startWebSpeech = useCallback((): boolean => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setTranscriptEntries(prev => [
            ...prev,
            {
              id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              text: result[0].transcript,
              speaker: 0,
              start: 0,
              end: 0,
              timestamp: Date.now(),
              isFinal: true,
            },
          ]);
          setInterimText('');
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (interimTranscript) {
        setInterimText(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        setConnectionStatus('error');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (isListening && !isPausedRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setConnectionStatus('connected');
      setMethod('webspeech');
      return true;
    } catch {
      return false;
    }
  }, [isListening]);

  const start = useCallback(async () => {
    setConnectionStatus('connecting');
    setDuration(0);
    setIsListening(true);

    // Try Deepgram first, fallback to Web Speech API
    const deepgramOk = await startDeepgram();
    if (!deepgramOk) {
      const webSpeechOk = startWebSpeech();
      if (!webSpeechOk) {
        setConnectionStatus('error');
        setIsListening(false);
        return;
      }
    }

    // Start duration timer
    durationTimerRef.current = setInterval(() => {
      setDuration(prev => {
        if (prev >= MAX_DURATION_SECONDS) {
          stop();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [startDeepgram, startWebSpeech, stop]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const getFullTranscript = useCallback(() => {
    return transcriptEntries
      .filter(e => e.isFinal)
      .map(e => `Speaker ${e.speaker}: ${e.text}`)
      .join('\n\n');
  }, [transcriptEntries]);

  const reset = useCallback(() => {
    stop();
    setTranscriptEntries([]);
    setInterimText('');
    setInterimSpeaker(0);
    setDuration(0);
    setMethod('none');
  }, [stop]);

  return {
    transcriptEntries,
    interimText,
    interimSpeaker,
    isListening,
    isPaused,
    connectionStatus,
    duration,
    method,
    start,
    stop,
    togglePause,
    getFullTranscript,
    reset,
  };
}
