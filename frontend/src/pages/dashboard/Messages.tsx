import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation, Message, Profile } from '../../types/lms';
import { getRoleDisplayName } from '../../types/lms';
import {
  getConversations,
  getMessages,
  sendMessage,
  subscribeToConversation,
  getMessageableContacts,
  getOrCreateConversation,
} from '../../lib/messaging';
import '../../styles/messaging.css';

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(searchParams.get('c'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    getMessages(activeConversationId)
      .then((data) => { if (!cancelled) setMessages(data); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => { if (!cancelled) setLoadingMessages(false); });

    channelRef.current?.unsubscribe();
    channelRef.current = subscribeToConversation(activeConversationId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setSearchParams({ c: conversationId }, { replace: true });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || !draft.trim()) return;
    const body = draft;
    setDraft('');
    try {
      const message = await sendMessage(activeConversationId, body);
      // Don't wait on the realtime echo to see our own message - append it now.
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setDraft(body);
    }
  };

  const openContactPicker = async () => {
    setShowContactPicker(true);
    setLoadingContacts(true);
    try {
      const data = await getMessageableContacts();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const startConversation = async (otherUserId: string) => {
    try {
      const conversation = await getOrCreateConversation(otherUserId);
      setShowContactPicker(false);
      await loadConversations();
      openConversation(conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="messages-page">
      <div className="messages-sidebar">
        <div className="messages-sidebar-header">
          <h2>Messages</h2>
          <button className="btn btn-primary btn-sm" onClick={openContactPicker}>New message</button>
        </div>

        {loadingConversations ? (
          <div className="messages-empty-state">Loading conversations…</div>
        ) : conversations.length === 0 ? (
          <div className="messages-empty-state">
            No conversations yet. Book a session or message an admin to get started.
          </div>
        ) : (
          <ul className="conversation-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  className={`conversation-list-item ${c.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => openConversation(c.id)}
                >
                  <div className="conversation-list-item-header">
                    <span className="conversation-list-item-name">{c.other_participant_name}</span>
                    {!!c.unread_count && <span className="conversation-unread-badge">{c.unread_count}</span>}
                  </div>
                  <div className="conversation-list-item-role">
                    {c.other_participant_role ? getRoleDisplayName(c.other_participant_role) : ''}
                  </div>
                  {c.last_message_preview && (
                    <div className="conversation-list-item-preview">{c.last_message_preview}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="messages-thread">
        {!activeConversationId ? (
          <div className="messages-empty-state messages-thread-empty">Select a conversation to start chatting</div>
        ) : (
          <>
            <div className="messages-thread-header">
              {activeConversation?.other_participant_name ?? 'Conversation'}
            </div>
            <div className="messages-thread-body">
              {loadingMessages ? (
                <div className="messages-empty-state">Loading messages…</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message-bubble ${m.sender_id === user?.id ? 'own' : 'other'}`}
                  >
                    <div className="message-bubble-body">{m.body}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="messages-thread-input" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>Send</button>
            </form>
          </>
        )}
      </div>

      {showContactPicker && (
        <div className="modal-overlay" onClick={() => setShowContactPicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Start a new conversation</h3>
            {loadingContacts ? (
              <div className="messages-empty-state">Loading contacts…</div>
            ) : contacts.length === 0 ? (
              <div className="messages-empty-state">
                No one to message yet — you can message someone once you have a booking together.
              </div>
            ) : (
              <ul className="contact-picker-list">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button className="contact-picker-item" onClick={() => startConversation(c.id)}>
                      <span>{c.first_name} {c.last_name}</span>
                      <span className="contact-picker-role">{getRoleDisplayName(c.role)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn btn-outline" onClick={() => setShowContactPicker(false)}>Close</button>
          </div>
        </div>
      )}

      {error && <div className="messages-error-toast" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
