import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRealtimeTranscript } from '../lib/useRealtimeTranscript';
import { useFactChecker } from '../lib/useFactChecker';
import { generateLiveNotes, summariseSession } from '../lib/aiApi';
import { saveSessionNote } from '../lib/aiNotes';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

export interface AILivestreamContextType {
  transcript: ReturnType<typeof useRealtimeTranscript>;
  factChecker: ReturnType<typeof useFactChecker>;
  aiNotes: string;
  setAiNotes: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingNotes: boolean;
  sessionSummary: string;
  setSessionSummary: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingSummary: boolean;
  showSummaryModal: boolean;
  setShowSummaryModal: React.Dispatch<React.SetStateAction<boolean>>;
  isSaving: boolean;
  saved: boolean;
  generateNotes: () => Promise<void>;
  endAndSummarise: () => Promise<void>;
  saveSession: () => Promise<void>;
  resetSession: () => void;
}

const AILivestreamContext = createContext<AILivestreamContextType | null>(null);

export function AILivestreamProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  
  const transcript = useRealtimeTranscript();
  const factChecker = useFactChecker();

  const [aiNotes, setAiNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  const [sessionSummary, setSessionSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const generateNotes = useCallback(async () => {
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim() || fullTranscript.split(/\s+/).length < 20) return;

    setIsGeneratingNotes(true);
    try {
      const response = await generateLiveNotes(fullTranscript);
      setAiNotes(response.result);
    } catch (err) {
      console.error('AI notes error:', err);
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [transcript]);

  const endAndSummarise = useCallback(async () => {
    transcript.stop();
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim()) return;

    setIsGeneratingSummary(true);
    try {
      const response = await summariseSession({
        transcript: fullTranscript,
        aiNotes,
        factCheckResults: factChecker.results,
        durationSeconds: transcript.duration,
      });
      setSessionSummary(response.summary);
      setShowSummaryModal(true);
    } catch (err: any) {
      console.error('Summary error:', err);
      alert('Failed to generate summary. The AI service may be temporarily unavailable or rate-limited. Please try again in a minute.');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [transcript, aiNotes, factChecker.results]);

  const saveSession = useCallback(async () => {
    if (!profile) return;
    setIsSaving(true);

    try {
      // Save to live_sessions table
      const { error } = await supabase.from('live_sessions').insert({
        user_id: profile.id,
        title: `Live Session — ${new Date().toLocaleString()}`,
        transcript_text: transcript.getFullTranscript(),
        ai_notes: aiNotes,
        meeting_package: sessionSummary,
        duration_seconds: transcript.duration,
      });
      
      // We will ignore errors for live_sessions if the table doesn't exist yet, 
      // but log it. We mainly rely on ai_session_notes for SharedDrive.
      if (error) console.warn('live_sessions insert failed:', error);

      // Save as an AI session note for SharedDrive access
      await saveSessionNote({
        title: `Live Session — ${new Date().toLocaleDateString()}`,
        transcript: transcript.getFullTranscript(),
        summary: sessionSummary || aiNotes,
        key_topics: [],
      });

      setSaved(true);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save session.');
    } finally {
      setIsSaving(false);
    }
  }, [profile, transcript, aiNotes, sessionSummary]);

  const resetSession = useCallback(() => {
    transcript.reset();
    setAiNotes('');
    setSessionSummary('');
    setShowSummaryModal(false);
    setSaved(false);
  }, [transcript, factChecker]);

  return (
    <AILivestreamContext.Provider value={{
      transcript,
      factChecker,
      aiNotes,
      setAiNotes,
      isGeneratingNotes,
      sessionSummary,
      setSessionSummary,
      isGeneratingSummary,
      showSummaryModal,
      setShowSummaryModal,
      isSaving,
      saved,
      generateNotes,
      endAndSummarise,
      saveSession,
      resetSession
    }}>
      {children}
    </AILivestreamContext.Provider>
  );
}

export function useAILivestream() {
  const context = useContext(AILivestreamContext);
  if (!context) throw new Error('useAILivestream must be used within AILivestreamProvider');
  return context;
}
