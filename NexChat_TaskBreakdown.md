**NexChat**

Development Task Breakdown & Execution Plan

Time-Efficient • Goal-Oriented • CV-Ready • 6 Phases

  ------------------------------------------------------------------------------------------------------------------------------------------
  **Phase**   **Name**                     **Deliverable**                                                     **Duration**   **Priority**
  ----------- ---------------------------- ------------------------------------------------------------------- -------------- --------------
  1           Foundation & Infra           Project scaffold, DB schema, auth, Redis, GraphQL skeleton          3-4 days       Critical

  2           Social Graph & Connections   User search, connection requests, friend system                     2-3 days       Critical

  3           Messaging Core               DMs, group chat, E2E encryption, ephemeral messages, file sharing   5-6 days       Critical

  4           Video Calling                LiveKit SFU, waiting room, screen share, room controls              4-5 days       High

  5           Groups & Admin Controls      Group creation, roles, admin controls, group messaging              3-4 days       High

  6           Polish & Stubs               UI polish, V2 stubs, observability, security hardening              2-3 days       Medium
  ------------------------------------------------------------------------------------------------------------------------------------------

**Total estimated duration: 19--25 focused working days. Each phase produces independently testable, deployable increments.**

  ----------------------------------------------------- -----------------
  **Phase 1: Foundation & Infrastructure**              **3--4 Days**

  ----------------------------------------------------- -----------------

This phase establishes everything all other phases build on. Do not skip or rush this phase --- a weak foundation will multiply complexity in every subsequent phase.

**Goal**

A running Next.js + GraphQL + PostgreSQL + Redis + Socket.IO stack with working JWT authentication, fully migrated database schema (including V2 stubs), and all environment configuration in place.

**1.1 --- Project Scaffold & Environment**

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                     **Technical Detail**                                                                                                 **FR / NFR**   **Est.**
  -------- ------------------------------------------------------------ -------------------------------------------------------------------------------------------------------------------- -------------- ----------
  1.1.1    Initialise Next.js 14 (App Router) project with TypeScript   npx create-next-app, configure tsconfig, ESLint, Prettier                                                            NFR-3          2h

  1.1.2    Set up Docker Compose for local dev                          Services: PostgreSQL, Redis, LiveKit server, Coturn. Single docker-compose.yml for one-command startup               NFR-7          2h

  1.1.3    Configure environment variables                              .env.local with DATABASE_URL, REDIS_URL, JWT_SECRET, LIVEKIT_API_KEY, LIVEKIT_SECRET. Document all vars in README.   NFR-3          1h

  1.1.4    Install and configure Prisma ORM                             prisma init, connect to PostgreSQL, verify connection                                                                All FRs        1h
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.2 --- Database Schema Migration**

Create the full production schema in one migration. Do not create partial schemas --- schema V1 must include V2 stubs (posts, feed_items) to avoid future breaking migrations.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                            **Technical Detail**                                                                                                                                                   **FR / NFR**   **Est.**
  -------- --------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  1.2.1    Create users table                                  id (uuid), email (unique), username (unique), passwordHash, avatarUrl, createdAt                                                                                       FR-1, FR-2     30m

  1.2.2    Create friendships table                            id, requesterId, addresseeId, status (pending\|accepted\|declined), createdAt. Composite unique index on (requesterId, addresseeId)                                    FR-3           30m

  1.2.3    Create rooms + room_members tables                  rooms: id, name, type (persistent\|ephemeral), createdBy, locked, createdAt. room_members: roomId, userId, role (admin\|member), mutedAt, joinedAt                     FR-7           45m

  1.2.4    Create messages + files tables                      messages: id, roomId, senderId, encryptedPayload, ephemeral (bool), expiresAt, createdAt. files: id, roomId, uploaderId, encryptedBlob, encryptedMetadata, createdAt   FR-5, FR-10    45m

  1.2.5    Create groups + group_members tables                groups: id, name, type, avatarUrl, createdBy, locked, memberAddPolicy, createdAt. group_members: groupId, userId, role, mutedAt, joinedAt                              FR-8           45m

  1.2.6    Create video_rooms table                            id, liveKitRoomId, createdBy, locked, maxParticipants (default 4), createdAt                                                                                           FR-11          30m

  1.2.7    Create posts + feed_items stub tables (V2)          posts: id, userId, content, createdAt. feed_items: id, userId, postId, createdAt. Tables created but no resolvers implemented.                                         FR-14          30m

  1.2.8    Run prisma migrate dev and generate Prisma client   Verify all tables created correctly. Seed with 2-3 test users.                                                                                                         All            30m
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.3 --- GraphQL API Skeleton**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                                 **Technical Detail**                                                                                                                                  **FR / NFR**     **Est.**
  -------- ------------------------------------------------------------------------ ----------------------------------------------------------------------------------------------------------------------------------------------------- ---------------- ----------
  1.3.1    Install Apollo Server with Next.js App Router integration                apollo-server-micro or \@apollo/server with Next.js route handler at /api/graphql                                                                     All FRs          1h

  1.3.2    Define complete GraphQL schema (schema-first)                            Write full schema.graphql with ALL types, queries, mutations, subscriptions defined --- including V2 stubs. Resolvers can be empty stubs initially.   All FRs          3h

  1.3.3    Set up GraphQL context --- inject Prisma and Redis clients per request   context function extracts JWT from header, validates against Redis, attaches user to context                                                          NFR-10, NFR-11   1h

  1.3.4    Set up Apollo Client in Next.js frontend                                 ApolloProvider wrapping app, configure httpLink + wsLink for subscriptions                                                                            All FRs          1h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.4 --- Redis Setup**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                               **Technical Detail**                                                                                        **FR / NFR**   **Est.**
  -------- ------------------------------------------------------ ----------------------------------------------------------------------------------------------------------- -------------- ----------
  1.4.1    Connect ioredis client, configure connection pooling   Singleton Redis client, connection error handling, reconnect strategy                                       NFR-7          1h

  1.4.2    Implement JWT session cache helpers                    setSession(userId, token, ttl), getSession(userId), deleteSession(userId)                                   FR-2, NFR-11   1h

  1.4.3    Implement rate limiter utility                         rateLimit(key, maxAttempts, windowSeconds) using Redis INCR + EXPIRE. Reusable across auth and messaging.   NFR-10         1.5h

  1.4.4    Configure Socket.IO Redis adapter                      Install \@socket.io/redis-adapter, connect to Redis pub/sub channels                                        NFR-7          1h
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.5 --- Authentication**

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                            **Technical Detail**                                                                                        **FR / NFR**   **Est.**
  -------- --------------------------------------------------- ----------------------------------------------------------------------------------------------------------- -------------- ----------
  1.5.1    Implement register mutation                         Validate unique email + username, bcrypt hash password (cost 12), create user, issue JWT, cache in Redis    FR-1           2h

  1.5.2    Implement login mutation                            Validate credentials, check bcrypt hash, apply rate limiter (5 attempts/15min), issue JWT, cache in Redis   FR-2           1.5h

  1.5.3    Implement logout mutation                           Delete Redis session key immediately on logout                                                              FR-2, NFR-11   30m

  1.5.4    Build auth middleware for all protected resolvers   withAuth HOF that checks JWT + Redis session before resolver executes                                       All FRs        1h

  1.5.5    Build register and login UI pages in Next.js        Forms with client-side validation, error states, redirect on success                                        FR-1, FR-2     2h
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 1 Checkpoint: Registration, login, logout working. GraphQL playground accessible. All tables exist in DB. Redis connected. Docker Compose starts full stack.**

  ----------------------------------------------------- -----------------
  **Phase 2: Social Graph & Connection System**         **2--3 Days**

  ----------------------------------------------------- -----------------

Establishes the social layer that gates all messaging. This must be complete before messaging (Phase 3) begins --- messaging depends on the connection model.

**Goal**

Users can search by username, send/accept/decline connection requests, view their connections, and remove connections. Messaging remains locked until connection is mutual.

**2.1 --- User Search & Discovery**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                 **Technical Detail**                                                                                      **FR / NFR**   **Est.**
  -------- ---------------------------------------- --------------------------------------------------------------------------------------------------------- -------------- ----------
  2.1.1    Implement user(username) GraphQL query   Exact username lookup --- returns public profile (id, username, avatarUrl). Returns null if not found.    FR-3           1h

  2.1.2    Build user search UI component           Search input with debounce (300ms), shows avatar + username + connection status, button to send request   FR-3           2h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**2.2 --- Connection Request System**

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                            **Technical Detail**                                                                                                                **FR / NFR**   **Est.**
  -------- --------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  2.2.1    Implement sendConnectionRequest mutation            Creates friendship record with status=pending. Validates: not already connected, not self-request, not duplicate pending request.   FR-3           1.5h

  2.2.2    Implement respondToConnectionRequest mutation       Accepts requestId + accept (bool). Updates status to accepted or declined.                                                          FR-3           1h

  2.2.3    Implement connectionRequests query                  Returns all pending incoming requests for the current user with sender profile.                                                     FR-3           1h

  2.2.4    Implement connections query                         Returns all accepted connections for the current user.                                                                              FR-3           1h

  2.2.5    Implement removeConnection mutation                 Deletes friendship record. Both users lose DM access immediately.                                                                   FR-3           1h

  2.2.6    Real-time notification for new connection request   Socket.IO event connectionRequest:received fires when a request arrives --- frontend shows notification badge.                      FR-3           1.5h
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**2.3 --- Connections UI**

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                              **Technical Detail**                                                                                        **FR / NFR**   **Est.**
  -------- ------------------------------------- ----------------------------------------------------------------------------------------------------------- -------------- ----------
  2.3.1    Build connections list page           Grid/list of accepted connections with avatarUrl, username, online status indicator (from Redis presence)   FR-3           2h

  2.3.2    Build pending requests UI             Incoming requests list with accept/decline buttons. Real-time update when new request arrives.              FR-3           1.5h

  2.3.3    Implement isConnected guard utility   Reusable function: isConnected(userA, userB) --- used in messaging resolvers to gate access                 FR-3, FR-5     30m
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**2.4 --- People You May Know Stub**

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                    **Technical Detail**                                                                                    **FR / NFR**   **Est.**
  -------- ----------------------------------------------------------- ------------------------------------------------------------------------------------------------------- -------------- ----------
  2.4.1    Add peopleYouMayKnow to GraphQL schema with stub resolver   Query defined, resolver returns empty array with TODO comment. Schema validates --- no runtime error.   FR-4           30m

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 2 Checkpoint: User search works. Connection requests can be sent, accepted, declined. Connections list visible. isConnected guard in place. Real-time request notification firing.**

  ----------------------------------------------------- -----------------
  **Phase 3: Messaging Core**                           **5--6 Days**

  ----------------------------------------------------- -----------------

The most complex phase. Build in this strict order: encryption engine first, then DMs, then rooms, then ephemeral, then file sharing. Each step depends on the previous.

**Goal**

Fully working end-to-end encrypted 1-to-1 messaging, persistent and ephemeral rooms, per-message ephemeral control, real-time delivery, message history, and secure file sharing with download.

**3.1 --- Client-Side Encryption Engine**

Build this as a standalone utility module. All other messaging features depend on it.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                 **Technical Detail**                                                                                                         **FR / NFR**   **Est.**
  -------- ---------------------------------------- ---------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  3.1.1    Implement AES-GCM key generation         generateRoomKey() using Web Crypto API --- returns CryptoKey. One key per room/conversation.                                 NFR-1          1h

  3.1.2    Implement message encrypt/decrypt        encryptMessage(plaintext, roomKey) and decryptMessage(ciphertext, roomKey). Returns base64-encoded ciphertext + IV.          NFR-1          1.5h

  3.1.3    Implement file encrypt/decrypt           encryptFile(file, roomKey) and decryptFile(encryptedBlob, roomKey). Handles ArrayBuffer.                                     NFR-1, FR-10   1.5h

  3.1.4    Implement key exchange (ECDH)            generateKeyPair(), deriveSharedSecret(privateKey, publicKeyOfOther). Used to securely share room key between participants.   NFR-1          2h

  3.1.5    Write unit tests for encryption module   Test encrypt-then-decrypt roundtrip for messages and files. Verify ciphertext differs from plaintext.                        NFR-1          1h
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3.2 --- Direct Messaging (1-to-1)**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                             **Technical Detail**                                                                                                                                      **FR / NFR**   **Est.**
  -------- ---------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  3.2.1    Implement createRoom mutation for DM conversations   Creates room with type=persistent, adds both users as members. Validates isConnected guard.                                                               FR-5           1.5h

  3.2.2    Implement sendMessage mutation                       Accepts roomId + encryptedPayload + ephemeral (bool) + ttl. Validates room membership. Routes to PostgreSQL (persistent) or Redis with TTL (ephemeral).   FR-5, FR-6     2h

  3.2.3    Implement Socket.IO message delivery                 On sendMessage, emit encrypted payload to room channel via Socket.IO. Redis adapter ensures cross-instance delivery.                                      FR-5, NFR-7    1.5h

  3.2.4    Implement messages query with cursor pagination      messages(roomId, cursor, limit=50). Returns encrypted payloads. Client decrypts. Validates room membership.                                               FR-9           1.5h

  3.2.5    Implement messageReceived subscription               GraphQL subscription backed by Socket.IO / Redis pub/sub. Fires on new message in room.                                                                   FR-5           1.5h

  3.2.6    Build DM chat UI                                     Message thread view, input box with send button, real-time incoming messages, scrollable history loading.                                                 FR-5           3h

  3.2.7    Implement delivery status (sent, delivered, read)    sent on send, delivered on Socket.IO acknowledgement, read on client visibility event.                                                                    FR-5           1.5h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3.3 --- Per-Message Ephemeral Control**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                 **Technical Detail**                                                                                                 **FR / NFR**   **Est.**
  -------- -------------------------------------------------------- -------------------------------------------------------------------------------------------------------------------- -------------- ----------
  3.3.1    Add ephemeral toggle and TTL selector to message input   Toggle button in UI. When toggled, show TTL dropdown: 30s, 5min, 1hr, 24hr, 7 days.                                  FR-6           1.5h

  3.3.2    Implement Redis ephemeral message store                  On sendMessage with ephemeral=true, store in Redis as ephmsg:{messageId} with TTL. Do not write to PostgreSQL.       FR-6           1h

  3.3.3    Show ephemeral indicator and countdown in UI             Messages marked as ephemeral show a timer icon and remaining TTL. Visual differentiation from persistent messages.   FR-6           1h

  3.3.4    Enforce no-forward restriction client-side               Disable copy/forward actions on ephemeral messages in UI.                                                            FR-6           30m
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3.4 --- Secure Chat Rooms**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                                                **Technical Detail**                                                                                                            **FR / NFR**   **Est.**
  -------- --------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  3.4.1    Implement createRoom mutation (named rooms)                                             Creates persistent or ephemeral room. Creator becomes admin. Returns room with invite capability.                               FR-7           1h

  3.4.2    Implement inviteToRoom mutation                                                         Validates invitee is a connection of the inviting user. Adds to room_members.                                                   FR-7           1h

  3.4.3    Implement generateInviteLink mutation                                                   Creates UUID token, stores in Redis as invite:{token} = roomId with configurable TTL. Returns full invite URL.                  FR-7, FR-13    1.5h

  3.4.4    Implement invite link join flow                                                         On visiting invite URL, validate token in Redis. If valid and user is authenticated, add to room. Delete token if single-use.   FR-7, FR-13    1.5h

  3.4.5    Enforce ephemeral room rule --- all messages ephemeral regardless of per-message flag   In sendMessage resolver, if room.type === ephemeral, force ephemeral=true and route to Redis only.                              FR-7, FR-6     1h

  3.4.6    Implement room lock mutation                                                            Sets room.locked = true. sendMessage and inviteToRoom reject with ROOM_LOCKED error.                                            FR-7           1h
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3.5 --- Secure File Sharing**

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                **Technical Detail**                                                                                                                             **FR / NFR**   **Est.**
  -------- --------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------ -------------- ----------
  3.5.1    Implement file upload mutation          Client encrypts file, sends encryptedBlob + encryptedMetadata (filename, MIME, size) to GraphQL. Server stores encrypted blob. Returns fileId.   FR-10          2h

  3.5.2    Implement file download endpoint        GET /api/files/:fileId. Validates room membership. Generates short-lived Redis file access token (15min TTL). Returns encrypted blob.            FR-10          1.5h

  3.5.3    Client-side file download and decrypt   On download, fetch encrypted blob, decrypt using room key via encryption engine, trigger browser download of plaintext file.                     FR-10          1.5h

  3.5.4    Build file message UI component         Shows file icon, encrypted metadata (filename, size), download button. Upload progress indicator.                                                FR-10          1.5h
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 3 Checkpoint: E2E encrypted DMs working. Ephemeral messages auto-deleting in Redis. Room creation, invite links, room lock working. File upload/download/decrypt working. Message history paginating.**

  ----------------------------------------------------- -----------------
  **Phase 4: Video Calling**                            **4--5 Days**

  ----------------------------------------------------- -----------------

Integrate LiveKit SFU for video/audio. Build the full waiting room flow with Socket.IO. This phase is largely independent of Phase 3 --- it can be parallelised by a second developer if needed.

**Goal**

Fully working 1-to-1 and group (max 4) video calls via LiveKit, E2E encrypted streams, working waiting room with admin approve/reject, screen sharing, and room lock.

**4.1 --- LiveKit Setup**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                         **Technical Detail**                                                                      **FR / NFR**   **Est.**
  -------- ------------------------------------------------ ----------------------------------------------------------------------------------------- -------------- ----------
  4.1.1    Self-host LiveKit server via Docker Compose      Add LiveKit service to docker-compose.yml. Configure API key, secret, and port.           FR-11          1h

  4.1.2    Install LiveKit Server SDK on backend            livekit-server-sdk-node. Configure with API key and secret from env.                      FR-11          30m

  4.1.3    Install LiveKit Client SDK on frontend           \@livekit/client, \@livekit/components-react                                              FR-11          30m

  4.1.4    Configure Coturn TURN server in Docker Compose   TURN server as fallback for WebRTC when direct connection fails. Configure credentials.   FR-11, NFR-3   1h
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.2 --- Video Room Management**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                     **Technical Detail**                                                                                                                                **FR / NFR**   **Est.**
  -------- -------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  4.2.1    Implement createVideoRoom mutation           Creates video_rooms record. Generates LiveKit room via server SDK. Enforces maxParticipants=4.                                                      FR-11          1.5h

  4.2.2    Implement LiveKit access token generation    generateLiveKitToken(userId, roomId) --- issues JWT token to client. Token grants entry to LiveKit room. Called only after waiting room approval.   FR-11, FR-12   1.5h

  4.2.3    Enforce 4-participant cap at GraphQL layer   Before issuing token, count active participants in LiveKit room via server SDK. Reject if at capacity.                                              FR-11          1h

  4.2.4    Enable E2EE on LiveKit room                  Configure LiveKit room with E2EE via insertable streams. Key exchange handled by LiveKit SDK.                                                       NFR-2          1.5h
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.3 --- Waiting Room**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                   **Technical Detail**                                                                                                                    **FR / NFR**   **Est.**
  -------- ---------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  4.3.1    Implement waiting room join flow                           When user requests to join video room, add userId to Redis set waitingroom:{roomId}. Do NOT issue LiveKit token yet.                    FR-12          1h

  4.3.2    Emit Socket.IO event to admin on new waiting participant   waiting:joined event fires to admin\'s socket with participant name and count.                                                          FR-12          1h

  4.3.3    Implement approveParticipant mutation                      Validates caller is admin of video room. Removes from Redis waiting set. Issues LiveKit token. Emits waiting:approved to participant.   FR-12          1.5h

  4.3.4    Implement rejectParticipant mutation                       Validates caller is admin. Removes from Redis waiting set. Emits waiting:rejected to participant.                                       FR-12          1h

  4.3.5    Implement auto-reject when admin is absent                 On join request: check if any admin is in the LiveKit room (via LiveKit server SDK). If none, immediately reject.                       FR-12          1.5h

  4.3.6    Implement auto-reject on admin departure                   Socket.IO event fires when admin disconnects from call. Backend auto-rejects all in Redis waiting set and clears it.                    FR-12          1.5h

  4.3.7    Build waiting room UI for participant                      Blank screen with: avatar, name, and Waiting for the host to let you in. message. No call controls visible.                             FR-12          1.5h

  4.3.8    Build waiting room panel for admin                         In-call panel showing real-time count and list of waiting participants. Approve / Decline buttons per participant.                      FR-12          2h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.4 --- In-Call Features**

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                  **Technical Detail**                                                                                                           **FR / NFR**   **Est.**
  -------- --------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------ -------------- ----------
  4.4.1    Build main video call UI using LiveKit React components   Grid layout for up to 4 participant video tiles. Audio/video toggle buttons. Leave call button.                                FR-11          3h

  4.4.2    Implement screen sharing                                  startScreenShare() via LiveKit SDK. Renders as separate video track. Shows who is sharing.                                     FR-11          2h

  4.4.3    Enforce single active screen share                        Before starting screen share, check if any participant has an active screen track via LiveKit room state. Block if occupied.   FR-11          1h

  4.4.4    Implement lockVideoRoom mutation                          Sets video_rooms.locked = true. Stores in Redis. New join requests rejected with ROOM_LOCKED error.                            FR-13          1h

  4.4.5    Build room controls bar for admin                         Lock/unlock room button, end call for all button, participant list with remove option.                                         FR-13          1.5h
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 4 Checkpoint: 1-to-1 and group video calls working via LiveKit. Waiting room approve/reject flow complete. Screen sharing works with single-share enforcement. Room lock working. E2EE on streams.**

  ----------------------------------------------------- -----------------
  **Phase 5: Groups & Admin Controls**                  **3--4 Days**

  ----------------------------------------------------- -----------------

Groups reuse most of Phase 3\'s messaging infrastructure. The primary new work is the member management system, role enforcement, and group-specific UI.

**Goal**

Full group creation, admin role system, member management, group messaging (reusing encryption engine), persistent and ephemeral group types.

**5.1 --- Group CRUD**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                             **Technical Detail**                                                                                    **FR / NFR**   **Est.**
  -------- ------------------------------------ ------------------------------------------------------------------------------------------------------- -------------- ----------
  5.1.1    Implement createGroup mutation       name, type (persistent\|ephemeral), optional avatarUrl. Creator assigned Admin role in group_members.   FR-8           1.5h

  5.1.2    Implement group and groups queries   group(id) returns group with members and metadata. groups returns all groups for current user.          FR-8           1h

  5.1.3    Implement deleteGroup mutation       Admin only. Deletes group, all group_members, all messages, all files in group. Cascading delete.       FR-8           1h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**5.2 --- Member Management**

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                           **Technical Detail**                                                                                                                   **FR / NFR**   **Est.**
  -------- ------------------------------------------------------------------ -------------------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  5.2.1    Implement addGroupMember mutation                                  Admin (or any member if memberAddPolicy=open) can add. Validates: invitee is a connection of the adder. Max members enforced if set.   FR-8           1.5h

  5.2.2    Implement removeGroupMember mutation                               Admin only. Removes member. Member loses access to group messages and files immediately.                                               FR-8           1h

  5.2.3    Implement promoteGroupMember mutation                              Admin only. Sets role=admin for target member.                                                                                         FR-8           1h

  5.2.4    Implement transferGroupOwnership mutation                          Current admin promotes another member to admin, then removes their own admin role. Validates at least one admin remains.               FR-8           1h

  5.2.5    Implement muteGroupMember mutation                                 Admin only. Sets mutedAt timestamp. sendMessage resolver rejects messages from muted members with MEMBER_MUTED error.                  FR-8           1h

  5.2.6    Implement leaveGroup mutation                                      Any member can leave. If last admin leaves and other members remain, reject with MUST_TRANSFER_OWNERSHIP error.                        FR-8           1h

  5.2.7    Implement lockGroup and memberAddPolicy mutations                  lockGroup prevents new members. updateMemberAddPolicy(adminOnly\|open) controls who can add members.                                   FR-8           1h

  5.2.8    Emit groupMemberUpdated subscription event on all member changes   Real-time updates when member is added, removed, promoted, or muted.                                                                   FR-8           1h
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**5.3 --- Group Messaging**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                             **Technical Detail**                                                                                    **FR / NFR**   **Est.**
  -------- ---------------------------------------------------- ------------------------------------------------------------------------------------------------------- -------------- ----------
  5.3.1    Extend sendMessage resolver to support group rooms   Groups share the same message routing as rooms. Validate group membership instead of room membership.   FR-8           1h

  5.3.2    Extend invite link system for groups                 generateInviteLink works for group IDs. Admin-only. Stores invite:{token} = groupId in Redis.           FR-8, FR-7     1h

  5.3.3    Enforce ephemeral group rule                         If group.type === ephemeral, all messages forced to Redis-only regardless of per-message flag.          FR-8, FR-6     30m
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**5.4 --- Group UI**

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                          **Technical Detail**                                                                                           **FR / NFR**   **Est.**
  -------- ------------------------------------------------- -------------------------------------------------------------------------------------------------------------- -------------- ----------
  5.4.1    Build group chat interface                        Identical to DM UI but with group header, member count, and admin badge on messages from admins.               FR-8           2h

  5.4.2    Build group settings panel (admin view)           Member list with promote/remove/mute actions. Lock group toggle. Delete group button. Invite link generator.   FR-8           2.5h

  5.4.3    Build group creation modal                        Name input, type selector (persistent/ephemeral), avatar upload, confirm button.                               FR-8           1.5h

  5.4.4    Build member management UI (add/search members)   Search connected users, add to group. Shows current members with roles.                                        FR-8           1.5h
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 5 Checkpoint: Groups fully functional with all admin controls. Ephemeral groups auto-delete messages. Invite links work for groups. All member management mutations working.**

  ----------------------------------------------------- -----------------
  **Phase 6: Polish, Stubs & Security Hardening**       **2--3 Days**

  ----------------------------------------------------- -----------------

Final phase focuses on production-readiness, security hardening, V2 stub definition, and observability. Do not skip --- these items are what separate a portfolio project from a professional one.

**Goal**

Platform is production-hardened, all V2 stubs defined cleanly, observability in place, and the codebase is presentable for a technical interview review.

**6.1 --- Security Hardening**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                      **Technical Detail**                                                                           **FR / NFR**   **Est.**
  -------- ------------------------------------------------------------- ---------------------------------------------------------------------------------------------- -------------- ----------
  6.1.1    Add CSRF protection to all state-changing GraphQL mutations   Use csrf-csrf or similar. Token in custom header validated server-side.                        NFR-12         1.5h

  6.1.2    Add input validation to all GraphQL inputs                    Use zod or graphql-constraint-directive. Validate string lengths, enum values, UUID formats.   NFR-13         2h

  6.1.3    Verify no plaintext data in any log output                    Audit all console.log and logger calls. Ensure encryptedPayload fields are never logged.       NFR-16         1h

  6.1.4    Add HTTP security headers                                     helmet.js or Next.js headers config: CSP, HSTS, X-Frame-Options, X-Content-Type-Options.       NFR-3          1h

  6.1.5    Test rate limiter across all protected endpoints              Auth: 5 attempts/15min. Messages: configurable per-user limit. Verify Redis INCR behaviour.    NFR-10         1h
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**6.2 --- Online Presence System**

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                        **Technical Detail**                                                                                                      **FR / NFR**   **Est.**
  -------- ----------------------------------------------- ------------------------------------------------------------------------------------------------------------------------- -------------- ----------
  6.2.1    Implement heartbeat presence via Socket.IO      Client emits presence:heartbeat every 20 seconds. Server sets Redis presence:{userId}=online with 30s TTL.                FR-3           1h

  6.2.2    Implement presence status in connections list   Green dot for online users (Redis key exists), grey for offline. Updates in real-time via presenceUpdated subscription.   FR-3           1h
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**6.3 --- V2 Stub Finalisation**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                    **Technical Detail**                                                                                        **FR / NFR**   **Est.**
  -------- ----------------------------------------------------------- ----------------------------------------------------------------------------------------------------------- -------------- ----------
  6.3.1    Verify peopleYouMayKnow query stub is clean                 Returns \[\] with no errors. Add TODO comment with algorithm description for V2.                            FR-4           30m

  6.3.2    Verify feed query and createPost mutation stubs are clean   Returns \[\] / success with no errors. Schema validates end-to-end.                                         FR-14          30m

  6.3.3    Document V2 extension points in README                      Section: Future Extensions --- describes feed, discovery, and how schema supports them without migration.   FR-4, FR-14    1h
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**6.4 --- UI Polish**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **\#**   **Task**                                                         **Technical Detail**                                                                                            **FR / NFR**   **Est.**
  -------- ---------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------- -------------- ----------
  6.4.1    Implement auto-reconnect for Socket.IO                           Socket.IO client config: reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000.                 NFR-9          30m

  6.4.2    Implement auto-reconnect for LiveKit                             LiveKit client SDK handles reconnect natively --- verify configuration and test on network interruption.        NFR-9          30m

  6.4.3    Add loading and error states to all async operations             Skeleton loaders for message history, connection lists, group lists. Error toasts on failed mutations.          UX             2h

  6.4.4    Mobile responsive layout audit                                   Test all key flows on mobile viewport. Fix critical layout breaks.                                              UX             1.5h

  6.4.5    Write README with architecture overview and setup instructions   Stack diagram, quick start (docker-compose up), environment variable reference, CV-ready project description.   CV             2h
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Phase 6 Checkpoint: All security headers in place. No plaintext in logs. Rate limiting verified. V2 stubs clean. Auto-reconnect working. README complete. Project ready for CV submission.**

**Summary: Total Effort Estimate**

  ------------------------------------------------------------------------------------------------------------------------------
  **Phase**   **Name**                      **Days**      **Key Risk**
  ----------- ----------------------------- ------------- ----------------------------------------------------------------------
  1           Foundation & Infrastructure   3--4          Docker/Prisma config issues --- budget extra time if first time

  2           Social Graph & Connections    2--3          Low risk --- straightforward CRUD with one real-time event

  3           Messaging Core                5--6          Highest risk --- encryption key exchange is complex, test thoroughly

  4           Video Calling                 4--5          LiveKit setup and waiting room Socket.IO coordination

  5           Groups & Admin Controls       3--4          Low risk --- reuses Phase 3 infrastructure heavily

  6           Polish & Security Hardening   2--3          Often underestimated --- do not cut this phase

              TOTAL                         19--25 days   Parallelise Phase 4 with Phase 5 to save 3--4 days if 2 devs
  ------------------------------------------------------------------------------------------------------------------------------

**Dependency Order --- Must Not Violate**

1.  Phase 1 must be 100% complete before any other phase begins.

2.  Phase 2 (connections) must be complete before Phase 3 (messaging) --- the isConnected guard is required.

3.  Phase 3 encryption engine (3.1) must be complete before any messaging feature (3.2--3.5).

4.  Phase 4 (video) can begin in parallel with Phase 5 (groups) once Phase 3 is done.

5.  Phase 6 always last --- it validates and hardens everything built in phases 1--5.

**CV-Ready Technology Showcase**

  -----------------------------------------------------------------------------------------------------------------------------------------------------------
  **Technology**        **Where Demonstrated**                                                                                             **Depth Signal**
  --------------------- ------------------------------------------------------------------------------------------------------------------ ------------------
  GraphQL               Full schema-first API with queries, mutations, subscriptions, cursor pagination, and forward-compatible V2 stubs   Senior

  Redis                 6 distinct roles: session cache, rate limiting, pub/sub adapter, presence, ephemeral TTL, invite tokens            Senior

  Socket.IO             Real-time messaging, waiting room events, presence heartbeat, Redis adapter for horizontal scaling                 Senior

  PostgreSQL + Prisma   Full relational schema with indexes, constraints, cascade deletes, and forward-compatible V2 tables                Mid-Senior

  LiveKit / WebRTC      Self-hosted SFU, E2EE via insertable streams, screen sharing, TURN fallback                                        Senior

  Web Crypto API        AES-GCM encryption, ECDH key exchange, client-side file encryption --- zero plaintext to server                    Senior

  Next.js               App Router, server components, API routes, Apollo Client integration                                               Mid-Senior
  -----------------------------------------------------------------------------------------------------------------------------------------------------------
