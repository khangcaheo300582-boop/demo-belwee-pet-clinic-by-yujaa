// lib/channels.ts
// The ONE place that defines a realtime channel name.
//
// A channel string is an auth boundary here: the stream endpoint decides what
// a connection may subscribe to, so the names are built by functions rather
// than written as literals at each call site. A typo in a literal would
// silently create a channel nobody listens on (messages appear to send, nobody
// receives) — which is exactly the class of bug that is painful to diagnose
// from a UI.
//
//   chat:staff            — the all-staff group channel
//   chat:branch:<id>      — one channel per branch (b1…b4)
//   staff:care            — customer-care requests: offers / accept / busy
//   user:<email>          — a customer's private notification stream
//
// NOTE: user channels are keyed by a *hash* of the email, not the email. The
// channel name travels in the query string of the EventSource URL, where it
// lands in browser history, proxy logs and server access logs. Hashing keeps
// the address out of those.

import crypto from 'crypto';
import { BRANCHES } from './clinics';

/** Deterministic short digest of an identifier, for use in a URL. */
function digest(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex').slice(0, 20);
}

/** The all-staff group channel. */
export const STAFF_CHAT_CHANNEL = 'chat:staff';

/**
 * The customer-care coordination channel: when a customer asks for support the
 * server offers the request to ONE online staff member here. It carries no
 * message text — only routing facts (session id, customer label, which member
 * is being asked) — so it is safe to keep in a shared, staff-wide channel.
 */
export const STAFF_CARE_CHANNEL = 'staff:care';

/** Branch channel for one of the four Belwee branches. */
export function branchChatChannel(branchId: string): string {
  const known = BRANCHES.some((b) => b.id === branchId);
  // An unknown branch falls back to the group channel rather than minting a
  // channel nobody is a member of.
  return known ? `chat:branch:${branchId}` : STAFF_CHAT_CHANNEL;
}

/** Every chat channel a staff member may read: group + their own branch. */
export function chatChannelsFor(branchId: string): string[] {
  const branch = branchChatChannel(branchId);
  return branch === STAFF_CHAT_CHANNEL ? [STAFF_CHAT_CHANNEL] : [STAFF_CHAT_CHANNEL, branch];
}

/** Private notification channel for one customer. */
export function userChannel(email: string): string {
  return `user:${digest(email)}`;
}

/**
 * Which channels a signed-in staff member may subscribe to.
 *
 * `staff:*` is always allowed; a branch channel only when it matches the
 * member's own branch. A staff member cannot listen in on another branch's
 * channel by guessing its id.
 */
export function allowedChannelsForStaff(branchId: string): string[] {
  return chatChannelsFor(branchId);
}

/**
 * Channels a staff member may stream over SSE: the chat channels above PLUS
 * the customer-care coordination channel. `staff:care` is deliberately not in
 * `chatChannelsFor` — the group chat POST route authorises by that list, and
 * business chat text must never be written into a routing channel.
 */
export function streamChannelsForStaff(branchId: string): string[] {
  return [...allowedChannelsForStaff(branchId), STAFF_CARE_CHANNEL];
}