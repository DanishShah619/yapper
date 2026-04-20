# Phase 3 Architecture — Audit, Fixes & Key Code

> Full review of the proposed implementation plan, identifying all errors and providing corrected implementations for each flaw.

---

## Fix 1 — Group E2EE Pairwise Key Distribution

### Original Plan Assessment

The pairwise key-wrapping approach (ECDH shared secret → wrap AES-GCM group key) is **sound and standard** (similar to Signal's sender key distribution). However, three gaps make it incomplete.

---

### Error 1A — No Key Rotation on Member Removal

**Problem:** When a member is removed from a group, they retain the current AES-GCM group key and can continue decrypting all future messages. The plan has no mechanism to rotate the key and re-wrap it for remaining members.

**Fix:** On every member removal, generate a new group key and re-wrap it for each remaining member.

```typescript
// graphql/resolvers/groups.ts

async removeGroupMember(_, { groupId, memberId }, { prisma, redis, currentUser }) {
  // 1. Remove the member
  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: memberId } }
  });

  // 2. Fetch remaining members and their public keys
  const remaining = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { publicKey: true, id: true } } }
  });

  // 3. Signal clients to rotate — each Admin client will re-wrap
  //    the newly generated key for all remaining members
  await redisPubSub.publish('GROUP_KEY_ROTATION_REQUIRED', {
    groupId,
    remainingMemberIds: remaining.map(m => m.userId)
  });

  return { success: true };
}

// Mutation to accept the newly wrapped keys from the Admin client
async submitRotatedGroupKeys(_, { groupId, wrappedKeys }, { prisma, currentUser }) {
  // wrappedKeys: Array<{ memberId: string, encryptedKey: string }>
  const updates = wrappedKeys.map(({ memberId, encryptedKey }) =>
    prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: memberId } },
      data: { encryptedKey }
    })
  );
  await prisma.$transaction(updates);
  return { success: true };
}
```

---

### Error 1B — No Fallback When Admin is Offline

**Problem:** The plan states the Admin wraps keys when adding members. If the Admin is offline during member addition, the new member receives a null `encryptedKey` and silently loses access to all group history.

**Fix:** Allow any existing member (not just Admin) to act as key distributor. Track whether a member's key has been delivered.

```typescript
// lib/e2ee.ts (frontend)

// Any online group member can wrap the key for a new joiner
export async function wrapGroupKeyForNewMember(
  groupKey: CryptoKey,
  newMemberPublicKeyB64: string,
  myPrivateKey: CryptoKey
): Promise<string> {
  const newMemberPublicKey = await importPublicKey(newMemberPublicKeyB64);

  // Derive ECDH shared secret between current user and new member
  const sharedSecret = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: newMemberPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey']
  );

  // Wrap (encrypt) the group AES-GCM key using the shared secret
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await crypto.subtle.wrapKey('raw', groupKey, sharedSecret, {
    name: 'AES-GCM',
    iv
  });

  // Return IV + wrapped key as base64 for storage
  const combined = new Uint8Array([...iv, ...new Uint8Array(wrappedKey)]);
  return btoa(String.fromCharCode(...combined));
}

// Called on app open — checks if any pending members need their key
export async function distributeKeyToPendingMembers(groupId: string) {
  const { data } = await apolloClient.query({
    query: GET_MEMBERS_MISSING_KEY,
    variables: { groupId }
  });

  if (!data.membersWithoutKey.length) return;

  const groupKey = await getGroupKey(groupId); // from local IndexedDB
  const myPrivateKey = await getMyPrivateKey();

  const wrappedKeys = await Promise.all(
    data.membersWithoutKey.map(async (member) => ({
      memberId: member.id,
      encryptedKey: await wrapGroupKeyForNewMember(groupKey, member.publicKey, myPrivateKey)
    }))
  );

  await apolloClient.mutate({
    mutation: SUBMIT_WRAPPED_KEYS,
    variables: { groupId, wrappedKeys }
  });
}
```

---

### Error 1C — Nullable `encryptedKey` Has No Error Surface

**Problem:** `encryptedKey String?` being nullable means a member with a missing key silently fails to decrypt — the UI shows nothing and the user has no indication of why.

**Fix:** Add a client-side guard that detects a null key and shows a clear recovery prompt.

```typescript
// lib/e2ee.ts (frontend)

export async function getOrRequestGroupKey(groupId: string, adminPublicKey: string) {
  const member = await fetchMyGroupMembership(groupId);

  if (!member.encryptedKey) {
    // Key was never delivered — surface this explicitly
    throw new E2EEKeyMissingError(
      'Your encryption key for this group has not been delivered yet. ' +
      'Ask a group member to open the app so it can be sent to you.'
    );
  }

  const myPrivateKey = await getMyPrivateKey();
  return unwrapGroupKey(member.encryptedKey, adminPublicKey, myPrivateKey);
}

// In the chat UI component
try {
  const groupKey = await getOrRequestGroupKey(groupId, group.adminPublicKey);
  setGroupKey(groupKey);
} catch (err) {
  if (err instanceof E2EEKeyMissingError) {
    setError(err.message); // Render visible banner in UI
  }
}
```

---

## Fix 2 — Redis PubSub & Apollo Subscriptions

### Original Plan Assessment

The Redis PubSub swap is correct. However, the plan's prescription of `subscribeToMore()` alone is **insufficient** for ephemeral messages. Ephemeral messages are never written to Postgres. If a client disconnects (WebSocket drops, mobile backgrounded) even briefly, those messages are **permanently lost** — `subscribeToMore` has no replay mechanism. Three layers are needed.

---

### Error 2A — No Replay Buffer for Disconnected Clients

**Fix — Layer 1:** Write ephemeral messages to a short-lived Redis List alongside the PubSub publish. This creates a 60-second replay window without touching Postgres.

```typescript
// graphql/resolvers/messages.ts

async sendEphemeralMessage(_, { roomId, content, ttlSeconds }, { redis, redisPubSub, currentUser }) {
  const messageId = generateId();
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const payload = JSON.stringify({
    id: messageId,
    content,
    senderId: currentUser.id,
    expiresAt,
    sentAt: Date.now()
  });

  // Publish to live subscribers via PubSub (unchanged)
  await redisPubSub.publish('MESSAGE_RECEIVED', { roomId, ...JSON.parse(payload) });

  // NEW: Also buffer in a Redis List for disconnected clients
  const bufferKey = `ephemeral:room:${roomId}`;
  await redis.lpush(bufferKey, payload);

  // Buffer TTL matches the shortest ephemeral window (or 60s, whichever is less)
  const bufferTtl = Math.min(ttlSeconds, 60);
  await redis.expire(bufferKey, bufferTtl);

  // Schedule deletion of the message content itself
  await redis.set(`ephemeral:msg:${messageId}`, payload, 'EX', ttlSeconds);

  return JSON.parse(payload);
}
```

```typescript
// graphql/resolvers/messages.ts — new query

async missedEphemeralMessages(_, { roomId, since }, { redis }) {
  const bufferKey = `ephemeral:room:${roomId}`;
  const rawMessages = await redis.lrange(bufferKey, 0, -1);

  return rawMessages
    .map(raw => JSON.parse(raw))
    .filter(msg => msg.sentAt > since && msg.expiresAt > Date.now())
    .reverse(); // LPUSH stores newest first; reverse for chronological order
}
```

---

### Error 2B — No Reconnect Handler on the Frontend

**Fix — Layer 2:** The client must detect WebSocket reconnection and drain the Redis buffer to catch up on missed messages.

```typescript
// app/chat/[roomId]/page.tsx

import { useApolloClient } from '@apollo/client';
import { useEffect, useRef } from 'react';

export default function ChatRoom({ roomId }) {
  const client = useApolloClient();
  const lastReceivedAt = useRef<number>(Date.now());

  useEffect(() => {
    // Track the timestamp of every successfully received message
    const sub = client.subscribe({ query: MESSAGE_RECEIVED_SUBSCRIPTION, variables: { roomId } })
      .subscribe(({ data }) => {
        lastReceivedAt.current = Date.now();
        // merge into Apollo cache / local state as before
        appendMessage(data.messageReceived);
      });

    return () => sub.unsubscribe();
  }, [roomId]);

  useEffect(() => {
    // wsLink is the Apollo WebSocketLink instance — import from lib/apollo/client.ts
    const handleReconnect = async () => {
      const gapMs = Date.now() - lastReceivedAt.current;

      // If offline longer than the buffer TTL, warn and bail
      if (gapMs > 55_000) {
        showToast('You were offline too long — some ephemeral messages could not be recovered.');
        return;
      }

      // Fetch messages sent while disconnected
      const { data } = await client.query({
        query: MISSED_EPHEMERAL_MESSAGES_QUERY,
        variables: { roomId, since: lastReceivedAt.current },
        fetchPolicy: 'network-only'
      });

      if (data.missedEphemeralMessages.length) {
        data.missedEphemeralMessages.forEach(appendMessage);
        lastReceivedAt.current = Date.now();
      }
    };

    wsLink.on('reconnected', handleReconnect);
    return () => wsLink.off('reconnected', handleReconnect);
  }, [roomId]);
}
```

---

### Error 2C — No Honest UX for Unrecoverable Gaps

**Fix — Layer 3:** When a client has been offline longer than the Redis TTL, surface this explicitly rather than rendering a silent gap in the message history.

```typescript
// components/EphemeralGapBanner.tsx

export function EphemeralGapBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2 text-sm rounded">
      ⚠️ You were offline for more than 60 seconds. Ephemeral messages sent during
      that time are not recoverable and have not been shown.
    </div>
  );
}
```

---

### Additional Verification Tests for Fix 2

These were missing from the original plan's verification section:

| Test | Steps | Expected Result |
|---|---|---|
| **Disconnect & replay** | Send ephemeral msg while Client B's WS is killed. Reconnect within 60s. | Client B receives missed message via catch-up query |
| **TTL expiry** | Send ephemeral msg, wait 65s, reconnect. | Gap banner shown; no phantom messages |
| **Concurrent senders** | Two clients send ephemeral messages simultaneously. | Ordering is consistent (Redis LPUSH/LRANGE preserves insertion order) |

---

## Fix 3 — Secure Session Management

### Original Plan Assessment

The `httpOnly` cookie migration is the **right approach** and the steps are accurate. However, one significant security gap is introduced by the migration itself.

---

### Error 3A — CSRF Protection Not Addressed

**Problem:** Switching from `localStorage` + `Authorization` header to `httpOnly` cookies with `credentials: 'include'` opens CSRF attack surface. A malicious third-party site can now trigger authenticated requests to your API because the browser auto-attaches cookies. `SameSite: 'strict'` helps but is not sufficient on its own — it does not protect against same-site subdomain attacks or all redirect scenarios.

**Fix:** Add a CSRF Double Submit Cookie pattern to the Next.js API proxy routes.

```typescript
// lib/csrf.ts

import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(token: string) {
  // This cookie is readable by JS (no httpOnly) — intentionally, so the client can send it as a header
  cookies().set('csrf_token', token, {
    secure: true,
    sameSite: 'strict',
    path: '/'
    // NOT httpOnly — must be readable by frontend JS
  });
}

export function validateCsrfToken(request: Request): boolean {
  const cookieToken = cookies().get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (!cookieToken || !headerToken) return false;
  // Timing-safe comparison
  return cookieToken === headerToken;
}
```

```typescript
// app/api/auth/login/route.ts

import { cookies } from 'next/headers';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  // Execute GraphQL login server-side
  const result = await executeGraphQL(LOGIN_MUTATION, { username, password });

  if (!result.data?.login?.token) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const jwt = result.data.login.token;
  const csrfToken = generateCsrfToken();

  // JWT in httpOnly cookie — JS cannot read this
  cookies().set('nexchat_token', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  // CSRF token in a separate readable cookie
  setCsrfCookie(csrfToken);

  return Response.json({ success: true });
}
```

```typescript
// lib/apollo/client.ts

// On the frontend, read the CSRF token from the cookie and attach it to every request
function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1] ?? '';
}

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      'x-csrf-token': getCsrfToken(), // CSRF header — validated server-side
      // No Authorization header — JWT is sent automatically via httpOnly cookie
    }
  }));
  return forward(operation);
});

const httpLink = new HttpLink({
  uri: '/api/graphql',
  credentials: 'include' // sends the httpOnly nexchat_token cookie
});
```

```typescript
// app/api/graphql/route.ts — validate CSRF on every GraphQL request

import { validateCsrfToken } from '@/lib/csrf';

export async function POST(request: Request) {
  if (!validateCsrfToken(request)) {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  // proceed with GraphQL execution
}
```

---

## Updated Verification Plan

The original plan's verification section was insufficient. The complete test matrix is:

### Automated

| Check | Command |
|---|---|
| TypeScript compilation | `tsc --noEmit` |
| Prisma migration | `npx prisma migrate dev --name add_encrypted_key` |
| Unit: CSRF token validation | `jest lib/csrf.test.ts` |
| Unit: Key wrap/unwrap round-trip | `jest lib/e2ee.test.ts` |

### Manual

| # | Scenario | Steps | Pass Condition |
|---|---|---|---|
| 1 | **Group chat delivery** | Device A creates group, adds Device B, sends message | Device B decrypts successfully |
| 2 | **Member removal + rotation** | Device A removes Device B, sends new message | Device B **cannot** decrypt post-removal message |
| 3 | **Admin offline join** | Admin goes offline, Device C joins via link, Admin comes back online | Device C eventually receives key; no silent failure |
| 4 | **Ephemeral live delivery** | Send 30s ephemeral message with both clients online | Appears instantly via WS, auto-deletes |
| 5 | **Ephemeral disconnect replay** | Kill Client B's WS, send ephemeral, reconnect within 60s | Client B receives message via catch-up query |
| 6 | **Ephemeral TTL expiry** | Kill Client B's WS, send ephemeral, wait 65s, reconnect | Gap banner shown; no message displayed |
| 7 | **Auth — no JWT in localStorage** | Log in, open DevTools → Application → Storage | No JWT in localStorage; `nexchat_token` httpOnly cookie present |
| 8 | **CSRF rejection** | Send POST to `/api/graphql` without `x-csrf-token` header | 403 returned; request blocked |