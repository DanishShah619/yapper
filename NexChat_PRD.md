**NexChat**

Secure Social Messaging & Video Platform

Product Requirements Document • Version 1.0 • 2025

  --------------------------------------------------------------------------------------------------
  **Document Property**      **Detail**
  -------------------------- -----------------------------------------------------------------------
  Project Name               NexChat

  Document Type              Product Requirements Document (PRD)

  Version                    1.0

  Status                     Active --- V1 Scope Defined

  Primary Stack              Next.js · GraphQL · Socket.IO · Redis · PostgreSQL · LiveKit · WebRTC

  Author                     Development Team

  Classification             Confidential
  --------------------------------------------------------------------------------------------------

**1. Executive Summary**

NexChat is a full-stack, security-first social communication platform that combines end-to-end encrypted messaging, group chat, and video calling with social networking capabilities. The platform is architected to demonstrate production-grade engineering competency across modern technologies including GraphQL, Redis, Socket.IO, WebRTC, and LiveKit SFU.

**The core design philosophy centres on three principles:**

-   Privacy by default --- the server never accesses plaintext messages, unencrypted files, or video streams.

-   Social-first architecture --- all communication features are gated behind a mutual-connection model, ensuring users can only interact with people they have explicitly connected with.

-   Forward-compatible design --- the V1 schema and API are intentionally designed to support future features (social feed, people you may know, post reactions) without breaking changes.

**2. Product Vision & Goals**

**2.1 Vision Statement**

To build a platform where users can communicate freely with complete confidence that their conversations, files, and video interactions are private, encrypted, and inaccessible to any third party including the platform itself.

**2.2 Primary Goals**

-   Deliver end-to-end encrypted 1-to-1 and group messaging with per-message ephemeral control.

-   Deliver secure group and 1-to-1 video calling via LiveKit SFU with admin-controlled waiting rooms.

-   Implement a username-based social graph where messaging is gated behind mutual connections.

-   Showcase deep technical competency across GraphQL, Redis, Socket.IO, PostgreSQL, and LiveKit for portfolio/CV purposes.

-   Design a forward-compatible schema that can extend to a social feed and discovery features without migration breaking changes.

**3. System Architecture**

**3.1 Architecture Overview**

NexChat is composed of six distinct layers, each with a defined responsibility boundary:

  --------------------------------------------------------------------------------------------------
  **Layer**        **Technology**              **Responsibility**
  ---------------- --------------------------- -----------------------------------------------------
  Client Layer     Next.js (React)             Chat UI, Video UI, Encryption Engine, File Handling

  API Layer        GraphQL (Apollo Server)     All data queries, mutations, subscriptions, schema

  Realtime Layer   Socket.IO + Redis Adapter   Live messaging, presence, waiting room events

  Video Layer      LiveKit SFU + WebRTC        Audio, video, screen share streams

  Network Relay    Coturn TURN Server          WebRTC fallback relay when P2P fails

  Data Layer       PostgreSQL + Redis          Persistent storage + caching, pub/sub, TTL store
  --------------------------------------------------------------------------------------------------

**3.2 Authentication Flow**

Authentication follows a stateless JWT model with Redis-backed session caching for performance:

-   User submits credentials via GraphQL mutation.

-   Server validates credentials against bcrypt-hashed password in PostgreSQL.

-   Server issues signed JWT with configurable TTL (default 7 days).

-   JWT cached in Redis with matching TTL to avoid database lookups on every request.

-   Client stores token in memory and httpOnly cookie (not localStorage).

-   All GraphQL requests and Socket.IO connections require Authorization: Bearer \<JWT\> header.

-   On token expiry, Redis key TTL expires simultaneously --- user is logged out.

**3.3 Encryption Architecture**

All message encryption is performed entirely on the client. The server acts as a blind relay and storage layer:

-   AES-GCM 256-bit symmetric encryption via the Web Crypto API.

-   Each chat room has a unique room key generated client-side.

-   Room key is shared securely between participants via asymmetric key exchange (RSA-OAEP or ECDH).

-   The server stores only encrypted ciphertext --- plaintext is never transmitted to or accessible by the server.

-   File uploads are encrypted client-side before transmission. The server stores only the encrypted blob.

-   Video streams are end-to-end encrypted via LiveKit\'s insertable streams (WebRTC E2EE).

**3.4 Redis Usage Map**

Redis serves six distinct roles in the NexChat architecture:

  ------------------------------------------------------------------------------------------------------------------------
  **Redis Role**              **Mechanism**               **Purpose**
  --------------------------- --------------------------- ----------------------------------------------------------------
  Socket.IO Scaling Adapter   Pub/Sub + Redis Adapter     Broadcasts messages across multiple Socket.IO server instances

  JWT / Session Cache         Key-Value + TTL             Eliminates DB lookup per request --- O(1) token validation

  Rate Limiting               Atomic INCR + Sliding TTL   Cross-instance rate limiting for messages, logins, API calls

  Online Presence             Key-Value + Heartbeat TTL   Real-time user online/offline status without DB polling

  Ephemeral Message Store     Key-Value + TTL             Auto-expiring messages with zero cron job overhead

  Invite Token Store          Key-Value + TTL             Time-limited secure invite links for rooms and groups
  ------------------------------------------------------------------------------------------------------------------------

**4. Functional Requirements**

**FR-1 --- User Registration**

**Authentication**

-   User creates account with a unique email address and a unique username.

-   Username is the public-facing identity used for discovery and connection requests.

-   Password is hashed using bcrypt with a minimum cost factor of 12 before storage.

-   Email and username uniqueness enforced at database constraint level.

-   Registration returns a JWT token --- user is immediately authenticated on signup.

**FR-2 --- Login & Session Management**

**Authentication**

-   User authenticates via email and password via GraphQL mutation.

-   Server validates credentials against stored bcrypt hash.

-   On success, server issues signed JWT with 7-day TTL and caches session in Redis.

-   On failure, rate limiter (Redis INCR) blocks further attempts after 5 failed tries within 15 minutes.

-   Logout mutation invalidates the Redis session key immediately.

**FR-3 --- Username-Based Connection System**

**Social Graph**

-   Users can search for other users by exact username.

-   A user must send a connection request via username.

-   The recipient accepts or declines the request.

-   Messaging (DMs and group invitations) is only unlocked after mutual acceptance --- users who are not connected cannot initiate contact.

-   Users can view their connections list at any time.

-   Users can remove a connection --- this immediately revokes DM access between the two parties.

**FR-4 --- People You May Know (V2 Extension Stub)**

**Social Graph · Future**

-   Schema and GraphQL query stub defined in V1 --- resolver left unimplemented.

-   Algorithm will surface users with 2+ mutual connections as suggestions.

-   GraphQL query: peopleYouMayKnow returns user id, username, avatar, mutualFriendsCount.

-   Data model fully supported by V1 PostgreSQL friendships table --- no migration required in V2.

**FR-5 --- Direct Messaging (1-to-1)**

**Messaging**

-   Connected users can initiate a DM conversation.

-   DM conversations are persistent by default --- message history is stored encrypted.

-   Each DM conversation has a unique room key generated client-side.

-   Messages are delivered in real time via Socket.IO WebSocket connection.

-   Message delivery status: sent, delivered, read receipts.

**FR-6 --- Per-Message Ephemeral Control**

**Messaging**

-   At the time of composing any message, the sender can toggle an ephemeral flag.

-   If ephemeral is toggled, the sender selects a duration: 30 seconds, 5 minutes, 1 hour, 24 hours, or 7 days.

-   Ephemeral messages are stored in Redis with the configured TTL --- they auto-delete on expiry.

-   Non-ephemeral messages are stored in PostgreSQL as encrypted ciphertext.

-   Recipients are visually informed that a message is ephemeral and can see its remaining TTL.

-   Ephemeral messages cannot be forwarded or copied --- client enforces this restriction.

**FR-7 --- Secure Chat Rooms**

**Messaging · Rooms**

-   Any user can create a named chat room.

-   Room creator is automatically assigned host/admin role.

-   Rooms have two types:

```{=html}
<!-- -->
```
-   Persistent Room --- message history retained in encrypted form, accessible to members.

-   Ephemeral Room --- all messages auto-delete regardless of per-message flag; no history stored.

```{=html}
<!-- -->
```
-   Admin can invite users to a room via username search --- only connected users can be invited.

-   Admin can generate a secure invite link with a configurable TTL (1 hour, 24 hours, 7 days) stored in Redis.

-   Admin can lock a room to prevent new participants from joining.

-   Admin can remove any participant from the room at any time.

**FR-8 --- Group Messaging**

**Messaging · Groups**

-   Any user can create a named group with an optional avatar and description.

-   Group creator is automatically assigned Admin role.

-   Groups support two member roles: Admin and Member.

-   Admin capabilities:

```{=html}
<!-- -->
```
-   Add members from their connected users list.

-   Remove members from the group.

-   Promote any member to Admin.

-   Transfer ownership of the group to another Admin.

-   Toggle whether members can add others, or only Admins can.

-   Lock the group to prevent new members from joining.

-   Delete the group entirely.

-   Mute specific members (they can read but not send messages).

```{=html}
<!-- -->
```
-   Any member can leave the group at any time.

-   Groups have two types:

```{=html}
<!-- -->
```
-   Persistent Group --- message history retained as encrypted ciphertext.

-   Ephemeral Group --- all messages auto-delete; no history stored.

```{=html}
<!-- -->
```
-   All messaging features apply inside groups: per-message ephemeral toggle, file sharing, read receipts.

-   Group invite links are time-limited and stored in Redis with TTL (FR-7 invite link system applies).

**FR-9 --- Message History**

**Messaging**

-   Persistent rooms and groups retain message history as AES-GCM encrypted ciphertext in PostgreSQL.

-   History is paginated --- loaded in chunks of 50 messages via GraphQL cursor-based pagination.

-   Ephemeral rooms and ephemeral groups never store message history under any circumstance.

-   Per-message ephemeral messages are excluded from history after their TTL expires.

**FR-10 --- Secure File Sharing & Download**

**Messaging · Files**

-   Files are encrypted client-side using AES-GCM before upload --- the server receives only encrypted bytes.

-   Encrypted file blob is stored on the server; metadata (filename, MIME type, size) stored encrypted.

-   Only members of the room or group where the file was shared can download it.

-   Download flow: client requests file --- server verifies room membership --- encrypted blob returned --- client decrypts using room key.

-   Download access is scoped to room members only --- no public or link-based file access.

-   File access tokens are short-lived (15 minutes) and stored in Redis to prevent token reuse.

-   Supported file types: images, PDFs, documents, videos, audio files --- max size 100MB per file.

**FR-11 --- Video Calls (1-to-1 and Group)**

**Video · LiveKit**

-   Users can initiate a 1-to-1 video call with any connected user.

-   Users can create a group video room with a maximum of 4 participants.

-   Video infrastructure is powered by LiveKit SFU --- all audio and video tracks routed through the SFU.

-   End-to-end encryption applied to all video and audio streams via LiveKit\'s WebRTC insertable streams.

-   If direct P2P connection fails, traffic is relayed through a self-hosted Coturn TURN server.

-   Participants can toggle their microphone and camera independently at any time.

-   Any participant can share their screen --- only one screen share is active at a time.

```{=html}
<!-- -->
```
-   When a participant initiates a screen share, others are shown the shared screen as a separate video track.

-   If another participant attempts to share their screen while a share is active, they receive an error: Screen share already in progress.

```{=html}
<!-- -->
```
-   The 4-participant cap is enforced at the GraphQL layer before a LiveKit room token is issued.

**FR-12 --- Waiting Room**

**Video · Access Control**

-   All video room joins pass through a waiting room before gaining access to the call.

-   A participant in the waiting room sees a blank screen with the message: Waiting for the host to let you in.

-   The host (admin) sees a real-time counter: X participant(s) waiting --- updated via Socket.IO events.

-   The admin can view the list of all waiting participants by name.

-   The admin can approve or reject each waiting participant individually.

-   Approved participants are immediately admitted to the call.

-   Rejected participants see the message: Your request to join was declined.

-   If no admin is present in the call at the time a participant requests to join, they are auto-rejected immediately.

-   If the last admin leaves an active call, all waiting room participants are auto-rejected.

-   Waiting room state (participant list) is stored as a Redis set per room ID and cleared on room close.

**FR-13 --- Room Lock**

**Video · Access Control**

-   Admin can lock a video room at any time to prevent new participants from joining or entering the waiting room.

-   Participants attempting to join a locked room see: This room is locked.

-   Room lock state is stored in Redis and reflected in LiveKit room metadata.

-   Admin can unlock the room at any time.

**FR-14 --- Social Feed (V2 Extension Stub)**

**Social Feed · Future**

-   Posts and feed_items tables created in V1 schema --- empty in V1, populated in V2.

-   GraphQL schema defines createPost mutation and feed(cursor, limit) query as stubs.

-   Feed will display posts from connected users in reverse-chronological order.

-   Redis sorted sets (score = timestamp) will be used for feed caching and cursor-based pagination in V2.

**5. Non-Functional Requirements**

  -------------------------------------------------------------------------------------------------------------------------------------------------
  **ID**   **Category**         **Requirement**                                                                               **Target**
  -------- -------------------- --------------------------------------------------------------------------------------------- ---------------------
  NFR-1    Encryption           AES-GCM 256-bit E2E encryption for all messages and files. Server never accesses plaintext.   100% compliance

  NFR-2    Encryption           End-to-end video/audio encryption via LiveKit insertable streams.                             All streams

  NFR-3    Transport Security   All traffic over HTTPS and WSS. WebRTC uses DTLS-SRTP.                                        100% compliance

  NFR-4    Privacy              Server must never store plaintext messages, unencrypted files, or video recordings.           Zero plaintext

  NFR-5    Performance          Message delivery latency target under 200ms on stable connection.                             \<200ms p95

  NFR-6    Performance          Video call room join (post-approval) completes within 3 seconds.                              \<3s

  NFR-7    Scalability          Support minimum 1000 concurrent users via horizontal Socket.IO scaling with Redis adapter.    1000 CCU

  NFR-8    Reliability          Platform uptime target of 99.9%.                                                              99.9% uptime

  NFR-9    Reliability          Auto-reconnect for Socket.IO and LiveKit connections on network interruption.                 Automatic

  NFR-10   Security             Rate limiting on all auth endpoints and message sends (Redis sliding window).                 Enforced

  NFR-11   Security             JWT expiry enforced. Token invalidation on logout via Redis key deletion.                     Enforced

  NFR-12   Security             CSRF protection on all state-changing mutations.                                              Enforced

  NFR-13   Security             Input validation and sanitisation on all GraphQL inputs.                                      Enforced

  NFR-14   Data Retention       Ephemeral rooms and groups auto-delete all messages --- no recovery possible.                 Enforced

  NFR-15   Data Retention       Per-message ephemeral TTL enforced in Redis --- no override possible after send.              Enforced

  NFR-16   Observability        System errors logged. No decrypted user data ever appears in logs.                            Zero plaintext logs

  NFR-17   Abuse Prevention     Invite token validation enforced. Expired or used tokens rejected.                            Enforced
  -------------------------------------------------------------------------------------------------------------------------------------------------

**6. GraphQL API Design**

**6.1 Core Queries**

  ----------------------------------------------------------------------------------------------
  **Query**                         **Returns**                              **Auth Required**
  --------------------------------- ---------------------------------------- -------------------
  me                                Current authenticated user profile       Yes

  user(username)                    Public user profile by username          Yes

  connections                       List of accepted connections             Yes

  connectionRequests                Pending incoming requests                Yes

  conversation(id)                  Single DM or room conversation           Yes

  conversations                     All conversations for current user       Yes

  group(id)                         Group with members and metadata          Yes

  groups                            All groups for current user              Yes

  messages(roomId, cursor, limit)   Paginated message history                Yes

  peopleYouMayKnow                  STUB --- mutual connection suggestions   Yes

  feed(cursor, limit)               STUB --- social feed                     Yes
  ----------------------------------------------------------------------------------------------

**6.2 Core Mutations**

  --------------------------------------------------------------------------------------------------
  **Mutation**                                            **Action**
  ------------------------------------------------------- ------------------------------------------
  register(email, username, password)                     Create user account, return JWT

  login(email, password)                                  Validate credentials, return JWT

  logout                                                  Invalidate Redis session

  sendConnectionRequest(username)                         Send connection request to user

  respondToConnectionRequest(requestId, accept)           Accept or decline request

  removeConnection(userId)                                Remove mutual connection

  createRoom(name, type)                                  Create persistent or ephemeral room

  inviteToRoom(roomId, username)                          Invite connected user to room

  generateInviteLink(roomId, ttl)                         Create time-limited invite token (Redis)

  createGroup(name, type, avatar)                         Create persistent or ephemeral group

  addGroupMember(groupId, username)                       Add connected user to group

  removeGroupMember(groupId, userId)                      Remove member from group

  promoteGroupMember(groupId, userId)                     Promote member to Admin

  transferGroupOwnership(groupId, userId)                 Transfer Admin ownership

  lockGroup(groupId)                                      Lock group from new members

  deleteGroup(groupId)                                    Delete group and all data

  muteGroupMember(groupId, userId)                        Mute member in group

  sendMessage(roomId, encryptedPayload, ephemeral, ttl)   Send encrypted message

  uploadFile(roomId, encryptedBlob, metadata)             Upload encrypted file

  createVideoRoom(maxParticipants)                        Create LiveKit video room

  approveParticipant(roomId, participantId)               Approve waiting room participant

  rejectParticipant(roomId, participantId)                Reject waiting room participant

  lockVideoRoom(roomId)                                   Lock video room

  createPost(content)                                     STUB --- create feed post
  --------------------------------------------------------------------------------------------------

**6.3 Subscriptions**

  -------------------------------------------------------------------------------
  **Subscription**                   **Triggers On**
  ---------------------------------- --------------------------------------------
  messageReceived(roomId)            New encrypted message in room

  presenceUpdated(userId)            User online/offline status change

  waitingRoomUpdated(videoRoomId)    Participant joins or leaves waiting room

  participantApproved(videoRoomId)   Admin approves a participant

  participantRejected(videoRoomId)   Admin rejects a participant

  roomLocked(videoRoomId)            Video room lock state changes

  groupMemberUpdated(groupId)        Member added, removed, or role changed
  -------------------------------------------------------------------------------

**7. Database Schema (PostgreSQL)**

  -----------------------------------------------------------------------------------------------------------------------------------------
  **Table**       **Key Columns**                                                            **Purpose**
  --------------- -------------------------------------------------------------------------- ----------------------------------------------
  users           id, email, username, passwordHash, avatarUrl, createdAt                    Core user accounts

  friendships     id, requesterId, addresseeId, status, createdAt                            Connection requests and accepted connections

  rooms           id, name, type (persistent\|ephemeral), createdBy, locked, createdAt       Chat rooms and DM conversations

  room_members    id, roomId, userId, role, mutedAt, joinedAt                                Room membership and roles

  messages        id, roomId, senderId, encryptedPayload, ephemeral, expiresAt, createdAt    Encrypted message store

  files           id, roomId, uploaderId, encryptedBlob, encryptedMetadata, createdAt        Encrypted file store

  groups          id, name, type, avatarUrl, createdBy, locked, memberAddPolicy, createdAt   Group definitions

  group_members   id, groupId, userId, role, mutedAt, joinedAt                               Group membership and roles

  video_rooms     id, liveKitRoomId, createdBy, locked, maxParticipants, createdAt           Video room state

  posts           id, userId, content, createdAt                                             STUB --- social feed posts (V2)

  feed_items      id, userId, postId, createdAt                                              STUB --- feed delivery (V2)
  -----------------------------------------------------------------------------------------------------------------------------------------

**7.1 Redis Key Schema**

  ----------------------------------------------------------------------------------------------------
  **Key Pattern**             **Type**               **TTL**            **Purpose**
  --------------------------- ---------------------- ------------------ ------------------------------
  session:{userId}            String (JWT)           7 days             JWT session cache

  ratelimit:auth:{ip}         Counter (INCR)         15 min             Login rate limiting

  ratelimit:msg:{userId}      Counter (INCR)         1 min              Message rate limiting

  presence:{userId}           String (online)        30 sec heartbeat   Online status

  ephmsg:{messageId}          String (payload)       Configurable       Ephemeral message store

  invite:{token}              String (roomId)        Configurable       Invite link tokens

  waitingroom:{videoRoomId}   Set (participantIds)   Duration of call   Waiting room state

  videoroom:lock:{roomId}     String (locked)        Duration of call   Video room lock state

  filetoken:{token}           String (fileId)        15 min             Temporary file access tokens
  ----------------------------------------------------------------------------------------------------

**8. Conflict Analysis & Resolutions**

The following conflicts were identified between requirements and have been explicitly resolved in this PRD:

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Conflict**                                    **Requirements**                                                   **Resolution**
  ----------------------------------------------- ------------------------------------------------------------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Social graph features vs blind server model     FR-4 (People You May Know) vs NFR-4 (server stores no user data)   Social graph operates only on non-sensitive relational data (user IDs, friendship edges). No message content is ever involved. The server is blind to message content but not to connection metadata.

  Message history vs ephemeral messages           FR-9 (History) vs FR-6 (Ephemeral)                                 Resolved via two distinct storage paths: non-ephemeral messages go to PostgreSQL; ephemeral messages go to Redis with TTL only. They never share a storage path.

  Per-message ephemeral vs room-level ephemeral   FR-6 vs FR-7 / FR-8                                                In an ephemeral room or group, the room-level ephemeral setting overrides all per-message settings. No message in an ephemeral room can ever be made persistent.

  GraphQL subscriptions at scale                  NFR-7 (1000 CCU) vs real-time subscriptions                        Resolved by Socket.IO Redis adapter --- all Socket.IO instances share a Redis pub/sub bus. GraphQL subscriptions are backed by the same Redis channel.

  Waiting room when admin is absent               FR-12 (waiting room) vs undefined admin absence behaviour          Explicitly defined: if no admin is present when a participant requests to join, auto-reject fires immediately. If last admin leaves mid-call, all waiting participants are auto-rejected.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**9. Security Model**

**9.1 Threat Model Summary**

  -----------------------------------------------------------------------------------------------------------------------------
  **Threat**                           **Mitigation**
  ------------------------------------ ----------------------------------------------------------------------------------------
  Server compromise exposes messages   AES-GCM client-side encryption --- server stores only ciphertext

  Man-in-the-middle on transit         HTTPS + WSS enforced. WebRTC uses DTLS-SRTP. No fallback to plaintext.

  Brute force login                    bcrypt cost 12 + Redis rate limiting (5 attempts / 15 min per IP)

  JWT token theft                      httpOnly cookies + short-lived tokens + Redis invalidation on logout

  Unauthorised room access             Room membership checked on every message send and file access

  Invite link abuse                    Tokens stored in Redis with TTL --- expired or replayed tokens rejected

  CSRF attacks                         CSRF token required on all state-changing GraphQL mutations

  Ephemeral message recovery           Ephemeral messages stored only in Redis with TTL --- no database fallback, no recovery
  -----------------------------------------------------------------------------------------------------------------------------

**10. Out of Scope --- V1**

The following features are explicitly out of scope for V1 but are architecturally planned for:

-   Social Feed --- posts, feed rendering, reactions, comments (schema stubbed, resolvers not implemented).

-   People You May Know --- mutual friend algorithm (query stubbed, resolver not implemented).

-   Push notifications (mobile or web push).

-   Message search and full-text search across history.

-   Multi-device sync and key management across devices.

-   Native mobile applications (iOS / Android).

-   Group video calls exceeding 4 participants (SFU architecture supports this --- feature-flagged for V2).

**11. Glossary**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Term**             **Definition**
  -------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------
  AES-GCM              Advanced Encryption Standard - Galois/Counter Mode. Authenticated symmetric encryption used for all messages and files.

  SFU                  Selective Forwarding Unit. A media server (LiveKit) that receives streams from all participants and selectively forwards them, replacing peer-to-peer mesh.

  E2EE                 End-to-End Encryption. Encryption where only the communicating parties can read the messages --- the server cannot.

  JWT                  JSON Web Token. A signed token used for stateless authentication.

  TTL                  Time To Live. An expiry duration after which a Redis key or message is automatically deleted.

  Ephemeral            Temporary. In NexChat, ephemeral messages or rooms auto-delete after a defined duration with no recovery.

  Cursor Pagination    A pagination method using an opaque cursor (typically a record ID or timestamp) rather than page numbers --- more efficient for large, real-time datasets.

  TURN                 Traversal Using Relays around NAT. A relay server (Coturn) used as fallback when direct WebRTC peer connection cannot be established.

  Insertable Streams   A WebRTC API that allows encryption/decryption of media tracks before encoding and after decoding --- used by LiveKit for E2EE video.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
