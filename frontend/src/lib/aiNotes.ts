import { supabase } from './supabaseClient';

export interface AiSessionNote {
  id: string;
  profile_id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  insights: string[] | null;
  key_topics: string[] | null;
  created_at: string;
}

export async function saveSessionNote(note: {
  title: string;
  transcript?: string;
  summary?: string;
  insights?: string[];
  key_topics?: string[];
}): Promise<AiSessionNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('ai_session_notes')
    .insert({
      profile_id: user.id,
      title: note.title,
      transcript: note.transcript ?? null,
      summary: note.summary ?? null,
      insights: note.insights ?? null,
      key_topics: note.key_topics ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSessionNotes(): Promise<AiSessionNote[]> {
  const { data, error } = await supabase
    .from('ai_session_notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deleteSessionNote(id: string): Promise<void> {
  const { error } = await supabase.from('ai_session_notes').delete().eq('id', id);
  if (error) throw error;
}
