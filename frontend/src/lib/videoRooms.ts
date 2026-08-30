import { supabase } from './supabaseClient';
import { AI_API_BASE } from './aiApi';
import type { VideoRoom } from '../types/lms';

/**
 * Ask the API to attach a video room to a booking.
 *
 * Room creation is deliberately server-side only: the provider's video API key must never reach
 * the browser bundle. The endpoint is idempotent (returns the existing room if the booking
 * already has one) and pulls from the professional's small reusable room pool, so calling it
 * again after a failure is safe and doesn't leak rooms.
 *
 * Either participant may call this — whoever opens the session first provisions it. The room is
 * always hosted by the professional regardless of who triggered it.
 */
export async function provisionVideoRoom(bookingId: string): Promise<VideoRoom> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You need to be signed in to start a session.');

  const res = await fetch(`${AI_API_BASE}/video-rooms/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ booking_id: bookingId }),
  });

  if (!res.ok) throw new Error(await readError(res, 'We could not set up the video room. Please try again in a moment.'));

  return res.json();
}

/**
 * Fetch a short-lived join token for a room.
 *
 * Rooms are private and reused across bookings, so the URL alone grants nothing — the server
 * checks you're on the booking before issuing a token, and the token expires after the session.
 */
export async function getVideoRoomToken(videoRoomId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You need to be signed in to join this session.');

  const res = await fetch(`${AI_API_BASE}/video-rooms/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ video_room_id: videoRoomId }),
  });

  if (!res.ok) throw new Error(await readError(res, 'We could not get you into the video room.'));

  const { token } = await res.json();
  return token;
}

/** Build the iframe src — the token is what actually admits you to a private room. */
export function buildRoomUrl(roomUrl: string, token: string): string {
  const separator = roomUrl.includes('?') ? '&' : '?';
  return `${roomUrl}${separator}t=${encodeURIComponent(token)}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.detail) return body.detail;
  } catch {
    // Non-JSON error body — keep the friendly default.
  }
  return fallback;
}
