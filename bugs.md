# NexChat Functional Audit – Findings

## Overview
The audit compares the current implementation of the **NexChat** codebase (located under `d:/yapper/yapper`) against the **Project Requirements Document** (`NexChat_TaskBreakdown.md`). The goal is to surface:
1. **Missing functional features** – PRD items that have no corresponding resolver, mutation, query, or UI.
2. **Partial / non‑compliant implementations** – features present but not fully satisfying the specifications.
3. **Bugs / flawed logic** – runtime errors, security gaps, or logic inconsistencies discovered via static analysis.

The audit focuses on **functional correctness** only (no integration tests). Any environment‑variable concerns are flagged for user input.

---

## 1. Missing Features (PRD → Code)
| PRD Item | Expected GraphQL Definition | Status | Notes |
|----------|----------------------------|--------|-------|
| **2.1.2 – User search UI** | UI component with debounce, results list | **Missing** | No UI component under `app/...` for user search.
| **2.3 – Connections UI** | Connections list page, pending requests page | **Missing** | No pages/components for connections UI.
| **2.4 – PeopleYouMayKnow** | `peopleYouMayKnow` query (stub) | **Implemented as stub** | Returns empty array, but missing TODO documentation.
| **3.5 – File upload/download** | `uploadFile` mutation & `/api/files/:id` endpoint | **Implemented mutation** | No API route for download; no security check for room membership.
| **4.1 – LiveKit server** | Self‑hosted LiveKit service config | **Missing** | No Docker service defined; `generateLiveKitToken` works but LiveKit server not provisioned.
| **4.3 – Waiting room UI (participant & admin)** | UI screens for waiting participants and admin panel | **Missing** | No components under `app/video/...`.
| **5.4 – Group UI** | Group chat UI, settings panel, creation modal, member management UI | **Missing** | No client‑side pages for groups.
| **6.1 – CSRF protection** | Middleware / header validation on mutations | **Missing** | No CSRF token handling in GraphQL middleware.
| **6.2 – Presence UI integration** | Online/offline indicators in connections list | **Partial** | Presence scalar exists, but UI does not display status.
| **6.3 – V2 stubs documentation** | README sections describing future extensions | **Present** | README includes V2 stubs but lacks detailed algorithm notes for `peopleYouMayKnow`.
| **6.4 – Mobile responsive layout audit** | Verify mobile breakpoints for all pages | **Missing** | No responsive testing reports; layout may break on mobile.
| **6.4 – Loading/error states** | Skeleton loaders, error toasts | **Missing** | UI lacks loading spinners for async ops.
| **6.4 – Auto‑reconnect for Socket.IO & LiveKit** | Configured reconnection options | **Present** | Socket.IO reconnection configured; LiveKit defaults handled.
| **6.4 – README architecture overview** | Detailed setup instructions | **Present** | README covers V2 stubs, but could be richer.

## 2. Partial / Non‑Compliant Implementations
| Feature | Issue | Impact | Suggested Fix |
|--------|-------|--------|--------------|
| **Key Delivery Tracking – `memberKeyDeliveryDetails`** | `isStale` calculation uses `STALE_SHARD_THRESHOLD_MINUTES` constant but the import path `@/lib/redisKeys` does not export it; likely runtime error. | Query will throw at import time. | Export the constant from `lib/redisKeys.ts` or import from correct module.
| **Key Escrow – `uploadKeyShards`** | Admin guard `assertRoomAdmin` is used, but comment says members can upload their own shard; enforcement may be too strict for room creation. | Prevents room creator from uploading their own shard during room creation. | Adjust guard to allow caller if `room.createdBy === callerId` or if uploading own shard.
| **Key Escrow – `rotateKey`** | No notification emitted after rotation; UI may not know keys changed. | Clients won't fetch new keys automatically. | Publish a `keyRotated` event via `pubsub` after successful rotation.
| **Messaging – `missedEphemeralMessages`** | Uses `args.since` (float) but compares `sentAt > args.since` where `since` is seconds since epoch? Might be mismatched unit. | Could miss messages or include stale ones. | Clarify `since` as milliseconds or convert accordingly.
| **Messaging – `sendMessage` (ephemeral)** | Stores message in Redis key `ephmsg:{id}` but also pushes to list buffer with TTL `Math.min(ttl, 60)`. If `ttl` < 60, buffer may expire before messages are read. | Clients may lose ephemeral messages before reading. | Align buffer TTL with message TTL or ensure client reads within buffer TTL.
| **Group – `removeGroupMember`** | After removal, key rotation required flag published, but no fallback admin logic implemented (TODO). | Admins may be unable to rotate keys if offline. | Implement fallback admin selection or persist flag.
| **Group – `lockGroup`** | Returns updated group but does not prevent `inviteToRoom` or `sendMessage` operations beyond lock checks (which exist). However, `inviteToRoom` for groups is not implemented; only room invites exist. | Group lock may not be enforced on member addition. | Add lock check in `addGroupMember` and `inviteToRoom` (if added).
| **Video – `approveParticipant` / `rejectParticipant`** | No check for participant existence in waiting room set before removal; may silently succeed.
| **Video – `lockVideoRoom`** | Sets `locked` flag in DB and Redis, but `join` flow does not verify `room.locked` before token issuance. | Participants could join locked rooms. | Add lock verification in `approveParticipant` before generating token.
| **Auth – `login` rate limiting** | Uses `rateLimit` util, but the key includes client IP only; no per‑user throttling. | Potential denial‑of‑service across accounts from same IP.
| **Presence – `presenceUpdated` subscription** | Resolver publishes events but no debounce; could flood clients. | Performance issue. | Debounce or batch presence updates.
| **CSRF – N/A** | No CSRF token validation on mutations. | Vulnerable to CSRF attacks in browsers. | Add middleware to validate `X-CSRF-Token` header against server‑side token.
| **Security – Logging** | Several resolvers log errors (`console.error`) with potentially sensitive info (e.g., shard delivery failures). | May expose internal state. | Sanitize logs, avoid printing shard details.
| **Schema – `KeyShard` type** | `createdAt` is `String!` but resolver returns ISO string; fine, but could be `DateTime` scalar for consistency.
| **Schema – `KeyShardInput`** | Mutations accept `KeyShardInput` but resolver `uploadKeyShards` expects `{ userId, encryptedShard }` – matches.
| **Schema – `User.publicKey`** | Nullable, but many resolvers assume existence (e.g., `myKeyShard` query). Could cause runtime errors if missing.
| **Schema – `messageReceived` subscription** | Argument `roomId` only, but used for both room and group IDs – ambiguous but works.

## 3. Bugs / Flawed Logic
| Location | Description | Reproduction | Fix |
|----------|-------------|--------------|-----|
| `graphql/resolvers/keyDeliveryTracking.ts:6` | Imports `STALE_SHARD_THRESHOLD_MINUTES` from `@/lib/redisKeys` which does not export it. | Import error at runtime. | Export constant or correct import path.
| `graphql/resolvers/keyEscrow.ts:119` | `assertRoomAdmin` used for uploading own shard; may block legitimate uploads during room creation. | Attempt to call `uploadKeyShards` as room creator. | Adjust guard to allow creator.
| `graphql/resolvers/messaging.ts:197` | `missedEphemeralMessages` filter uses `args.since` (seconds) but compares to `sentAt` (ms). | Off‑by‑factor errors. | Convert `args.since` to ms.
| `graphql/resolvers/video.ts:58` | `approveParticipant` does not verify that the participant is currently in the waiting set before removal; removal returns 0 if not present, but still publishes approval. | Approve non‑waiting participant; client receives token erroneously. | Check `removed` result; if 0, throw error.
| `graphql/resolvers/video.ts:72` | `rejectParticipant` similar issue as approve.
| `graphql/resolvers/video.ts:94` | `lockVideoRoom` sets Redis lock but `createVideoRoom` does not check this lock when generating tokens.
| `graphql/resolvers/auth.ts:80-85` | Rate limiter uses client IP only; attacker can circumvent by rotating IPs. Not a bug per se, but a security gap.
| `app/providers.tsx` | GlobalSocket reconnect logic does not back‑off aggressively; could cause rapid reconnect loops under network loss.
| `server.ts` | Socket.IO authentication middleware falls back to httpOnly cookie but does not verify token expiration on each request.
| `graphql/resolvers/user.ts:55` | `me` query returns user without publicKey; downstream code may assume `publicKey` exists.
| `graphql/resolvers/group.ts:224-225` | `lockGroup` mutation returns group but does not enforce lock in `addGroupMember` or `inviteToRoom` (future implementation). |
| `graphql/resolvers/group.ts:300-301` | `removeGroupMember` publishes `groupKeyRotationRequired` but fallback admin logic is still TODO.
| `graphql/resolvers/video.ts:111-112` | `createVideoRoom` stores `liveKitRoomId` as the same DB `id`; LiveKit SDK expects a different room ID.
| `graphql/resolvers/video.ts:144-148` | `approveParticipant` publishes `participantApproved` to specific participant channel using `ctx.userId` – should use `args.participantId`.
| `graphql/resolvers/video.ts:164-166` | `lockVideoRoom` publishes `roomLocked` event but no subscription guard checks it.

---

## 4. Recommendations / Next Steps
1. **Implement missing UI components** for connections, groups, and video waiting room per PRD.
2. **Add CSRF middleware** (e.g., `csurf` or custom header validation) to protect all mutations.
3. **Fix import/export errors** (`STALE_SHARD_THRESHOLD_MINUTES`).
4. **Adjust admin guards** in `keyEscrow` to allow room creator uploads.
5. **Synchronize time units** in `missedEphemeralMessages`.
6. **Add lock checks** in group/member mutation paths and video join flow.
7. **Finalize V2 stub documentation** with algorithm notes for `peopleYouMayKnow`.
8. **Add responsive design checks** and loading/error UI states.
9. **Audit logging** to remove sensitive data.
10. **Write integration tests** (optional, beyond scope) to verify behavior.

---

**Conclusion**
The codebase covers the majority of core functional requirements (auth, presence, messaging, groups, video). However, several PRD items remain unimplemented or partially implemented, and there are a handful of bugs that could cause runtime failures or security issues. Addressing the items above will bring the project to a **production‑ready** state suitable for senior‑level technical review.

*Please review the findings and let me know which items you would like to prioritize for remediation.*
