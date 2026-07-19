import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Conversation, Message, Notification, Profile } from '../types/lms';

// ============ CONTACTS ============

export async function getMessageableContacts(): Promise<Profile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [asCustomer, asProvider, admins] = await Promise.all([
    supabase
      .from('bookings')
      .select('provider:profiles!bookings_provider_id_fkey(*)')
      .eq('customer_id', user.id),
    supabase
      .from('bookings')
      .select('customer:profiles!bookings_customer_id_fkey(*)')
      .eq('provider_id', user.id),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin'),
  ]);

  if (asCustomer.error) throw asCustomer.error;
  if (asProvider.error) throw asProvider.error;
  if (admins.error) throw admins.error;

  const contacts = new Map<string, Profile>();
  for (const row of asCustomer.data ?? []) {
    const p = row.provider as unknown as Profile | null;
    if (p) contacts.set(p.id, p);
  }
  for (const row of asProvider.data ?? []) {
    const p = row.customer as unknown as Profile | null;
    if (p) contacts.set(p.id, p);
  }
  for (const p of admins.data ?? []) {
    if (p.id !== user.id) contacts.set(p.id, p as Profile);
  }
  contacts.delete(user.id);

  return Array.from(contacts.values());
}

// ============ CONVERSATIONS ============

export async function getOrCreateConversation(otherUserId: string): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [participant_one_id, participant_two_id] =
    user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_one_id', participant_one_id)
    .eq('participant_two_id', participant_two_id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ participant_one_id, participant_two_id })
    .select()
    .single();

  if (insertError) {
    // Race: another tab/request created it first - just fetch it.
    if (insertError.code === '23505') {
      const { data: retried, error: retryError } = await supabase
        .from('conversations')
        .select('*')
        .eq('participant_one_id', participant_one_id)
        .eq('participant_two_id', participant_two_id)
        .single();
      if (retryError) throw retryError;
      return retried;
    }
    throw insertError;
  }

  return created;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  if (!conversations || conversations.length === 0) return [];

  const otherIds = conversations.map((c) =>
    c.participant_one_id === user.id ? c.participant_two_id : c.participant_one_id
  );

  const [{ data: profiles, error: profilesError }, { data: lastMessages, error: messagesError }] =
    await Promise.all([
      supabase.from('profiles').select('*').in('id', otherIds),
      supabase
        .from('messages')
        .select('conversation_id, body, sender_id, read_at')
        .in('conversation_id', conversations.map((c) => c.id))
        .order('created_at', { ascending: false }),
    ]);

  if (profilesError) throw profilesError;
  if (messagesError) throw messagesError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  const previewByConversation = new Map<string, string>();
  const unreadByConversation = new Map<string, number>();
  for (const m of lastMessages ?? []) {
    if (!previewByConversation.has(m.conversation_id)) {
      previewByConversation.set(m.conversation_id, m.body);
    }
    if (m.sender_id !== user.id && !m.read_at) {
      unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return conversations.map((c) => {
    const otherId = c.participant_one_id === user.id ? c.participant_two_id : c.participant_one_id;
    const other = profileById.get(otherId);
    return {
      ...c,
      other_participant_name: other ? `${other.first_name} ${other.last_name}` : 'Unknown',
      other_participant_role: other?.role,
      last_message_preview: previewByConversation.get(c.id),
      unread_count: unreadByConversation.get(c.id) ?? 0,
    } as Conversation;
  });
}

// ============ MESSAGES ============

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles!messages_sender_id_fkey(first_name, last_name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((m: Record<string, unknown>) => {
    const profile = m.profiles as { first_name: string; last_name: string } | null;
    return {
      ...m,
      sender_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
    } as Message;
  });
}

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: trimmed })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToConversation(
  conversationId: string,
  onInsert: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();
}

// ============ NOTIFICATIONS ============

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: Notification) => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as Notification)
    )
    .subscribe();
}
