import { supabase } from './supabaseClient';
import { processAudio, factCheck } from './aiApi';
import type {
  SessionRecording,
  SessionRecordingClaim,
  SessionRecordingCaptureMethod,
  SessionRecordingPlatform,
} from '../types/lms';

export interface UploadRecordingOptions {
  bookingId?: string | null;
  title?: string;
  captureMethod?: SessionRecordingCaptureMethod;
  platform?: SessionRecordingPlatform | null;
  consentConfirmed?: boolean;
}

/** Reads a media file's duration client-side via its own decoder. Resolves null if it can't be determined quickly. */
function getMediaDuration(file: File, isVideo: boolean): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(isVideo ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
    };
    el.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    };
    el.src = url;
  });
}

/** Upload a recording file and create its session_recordings row. Mirrors uploadAvatar() in storage.ts. */
export async function uploadRecording(
  file: File,
  userId: string,
  options: UploadRecordingOptions = {}
): Promise<SessionRecording> {
  const isVideo = file.type.startsWith('video/');
  const fileExt = file.name.split('.').pop() || (isVideo ? 'webm' : 'mp3');
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  const [, durationSeconds] = await Promise.all([
    supabase.storage.from('session-recordings').upload(filePath, file, { cacheControl: '3600', upsert: false })
      .then(({ error }) => { if (error) throw error; }),
    getMediaDuration(file, isVideo),
  ]);

  const { data, error } = await supabase
    .from('session_recordings')
    .insert({
      owner_id: userId,
      booking_id: options.bookingId ?? null,
      title: options.title || file.name,
      capture_method: options.captureMethod ?? 'upload',
      platform: options.platform ?? null,
      video_path: isVideo ? filePath : null,
      audio_path: isVideo ? null : filePath,
      consent_confirmed: options.consentConfirmed ?? false,
      status: 'pending',
      duration_seconds: durationSeconds,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SessionRecording;
}

export async function listRecordings(userId: string): Promise<SessionRecording[]> {
  const { data, error } = await supabase
    .from('session_recordings')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionRecording[];
}

export async function getRecording(id: string): Promise<SessionRecording> {
  const { data, error } = await supabase.from('session_recordings').select('*').eq('id', id).single();
  if (error) throw error;
  return data as SessionRecording;
}

export async function getRecordingClaims(recordingId: string): Promise<SessionRecordingClaim[]> {
  const { data, error } = await supabase
    .from('session_recording_claims')
    .select('*')
    .eq('session_recording_id', recordingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionRecordingClaim[];
}

/** Download the recording's media file as a File so it can be sent to /process-audio. */
async function downloadRecordingFile(recording: SessionRecording): Promise<File> {
  const path = recording.video_path || recording.audio_path;
  if (!path) throw new Error('Recording has no stored media file.');

  const { data, error } = await supabase.storage.from('session-recordings').download(path);
  if (error) throw error;

  const filename = path.split('/').pop() || 'recording';
  return new File([data], filename, { type: data.type });
}

/**
 * Runs the existing AI pipeline (transcribe -> fact-check) against a stored recording and
 * persists the results. Mirrors the client-orchestrated flow already used for live sessions
 * in AILivestreamContext.tsx.
 */
export async function processRecording(recordingId: string): Promise<SessionRecording> {
  const recording = await getRecording(recordingId);

  await supabase.from('session_recordings').update({ status: 'processing' }).eq('id', recordingId);

  try {
    const file = await downloadRecordingFile(recording);
    const { transcript } = await processAudio(file);

    const { data: updated, error: updateError } = await supabase
      .from('session_recordings')
      .update({
        transcript_text: transcript,
        status: 'ready',
        completed_at: new Date().toISOString(),
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (transcript?.trim()) {
      try {
        const factCheckResponse = await factCheck(transcript);
        const claims = factCheckResponse.results ?? [];
        if (claims.length > 0) {
          await supabase.from('session_recording_claims').insert(
            claims.map((claim) => ({
              session_recording_id: recordingId,
              claim_text: claim.claim,
              speaker: claim.speaker || null,
              category: claim.category || null,
              verdict: claim.verdict,
              confidence_score: claim.confidence,
              explanation: claim.explanation || null,
              key_evidence: claim.key_evidence || null,
              source_urls: (claim.sources ?? []).map((s) => s.url).filter(Boolean),
              used_web_search: claim.used_web_search,
            }))
          );
        }
      } catch (factCheckErr) {
        console.warn('Fact-check failed for recording, continuing without it:', factCheckErr);
      }
    }

    return updated as SessionRecording;
  } catch (err) {
    await supabase.from('session_recordings').update({ status: 'failed' }).eq('id', recordingId);
    throw err;
  }
}

/** Detect which supported platform a meeting/tab URL belongs to, if any. */
export function detectPlatform(url: string): SessionRecordingPlatform {
  if (/meet\.google\.com/i.test(url)) return 'google_meet';
  if (/teams\.microsoft\.com|teams\.live\.com/i.test(url)) return 'microsoft_teams';
  if (/zoom\.us/i.test(url)) return 'zoom';
  return 'other';
}
