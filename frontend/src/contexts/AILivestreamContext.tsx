import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRealtimeTranscript } from '../lib/useRealtimeTranscript';
import { useFactChecker } from '../lib/useFactChecker';
import { generateLiveNotes, summariseSession } from '../lib/aiApi';
import { saveSessionNote } from '../lib/aiNotes';
import { uploadFile } from '../lib/sharedDrive';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { useModal } from './NotificationContext';

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
  const { showModal } = useModal();
  
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
      showModal({
        type: 'error',
        title: 'Summary Error',
        message: 'Failed to generate summary. The AI service may be temporarily unavailable or rate-limited. Please try again in a minute.',
        buttons: [{ label: 'OK', onClick: 'dismiss' }]
      });
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

      const isProfessional = profile?.role === 'tutor' || profile?.role === 'coach';
      if (isProfessional) {
        // Sync to My Resources as a text file
        const title = `Live Session — ${new Date().toLocaleDateString()}`;
        const summary = sessionSummary || aiNotes;
        const fullTranscript = transcript.getFullTranscript();
        const content = `${summary ? `Summary:\n${summary}\n\n` : ''}Transcript:\n${fullTranscript || ''}`;
        const fileBlob = new Blob([content], { type: 'text/plain' });
        const file = new File([fileBlob], `${title}.txt`, { type: 'text/plain' });
        
        await uploadFile(file, {
          title,
          description: 'AI Generated Live Session Note',
          file_type: 'notes',
          visibility: 'private'
        });
      }

      setSaved(true);
    } catch (err) {
      console.error('Save error:', err);
      showModal({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save session.',
        buttons: [{ label: 'OK', onClick: 'dismiss' }]
      });
    } finally {
      setIsSaving(false);
    }
  }, [profile, transcript, aiNotes, sessionSummary]);

  const resetSession = useCallback(() => {
    transcript.reset();
    factChecker.clearResults();
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
