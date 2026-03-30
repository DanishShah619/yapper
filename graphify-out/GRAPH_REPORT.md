# Graph Report - yapper  (2026-05-02)

## Corpus Check
- 93 files · ~41,891 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 235 nodes · 201 edges · 11 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `pushHealthUpdateToAdmins()` - 7 edges
2. `storeRoomKey()` - 6 edges
3. `loadRoomKey()` - 6 edges
4. `getOrRequestGroupKey()` - 5 edges
5. `getOrCreateKeyPair()` - 5 edges
6. `getDMRoomKey()` - 5 edges
7. `handleSend()` - 4 edges
8. `decryptMessages()` - 4 edges
9. `deriveRoomKey()` - 4 edges
10. `isClient()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `detectAndAlertStaleShards()` --calls--> `runDetection()`  [INFERRED]
  lib\keyDelivery.ts → workers\staleShardDetector.ts
- `register()` --calls--> `startStaleShardDetector()`  [INFERRED]
  instrumentation.ts → workers\staleShardDetector.ts
- `main()` --calls--> `setIO()`  [INFERRED]
  server.ts → lib\socketIO.ts
- `handleLogout()` --calls--> `disconnectSocket()`  [INFERRED]
  app\page.tsx → lib\socketClient.ts
- `useSocket()` --calls--> `WaitingRoomPage()`  [INFERRED]
  app\providers.tsx → app\video\[id]\waiting\page.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (16): decryptMessages(), deriveRoomKey(), E2EEKeyMissingError, exportRoomKey(), generateAndStoreGroupKey(), generateKeyPair(), generateRoomKey(), getDMRoomKey() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (6): encryptMessage(), handleKeyDown(), handleSend(), join(), usePresence(), validateInput()

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (5): VideoListPage(), WaitingRoomPage(), Providers(), useSocket(), useToast()

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (7): validateSession(), verifyToken(), deleteSession(), getSession(), legacySessionKey(), sessionKey(), setSession()

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (4): generateUserKeyPair(), loadPrivateKey(), savePrivateKey(), initUserKeys()

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (6): emitRealtimeMessage(), toMsgShape(), toUserShape(), main(), setIO(), tryGetIO()

### Community 7 - "Community 7"
Cohesion: 0.42
Nodes (8): detectAndAlertStaleShards(), getRoomKeyHealth(), markShardAcknowledged(), markShardDecrypted(), markShardDelivered(), pushHealthUpdateToAdmins(), redeliverShard(), getIO()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (3): isConnected(), requireConnection(), requireConnectionGuard()

### Community 9 - "Community 9"
Cohesion: 0.43
Nodes (5): handleLogout(), disconnectSocket(), getAuthPayload(), getSocket(), reconnectSocket()

### Community 10 - "Community 10"
Cohesion: 0.4
Nodes (3): register(), runDetection(), startStaleShardDetector()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (1): handleSubmit()

## Knowledge Gaps
- **Thin community `Community 15`** (3 nodes): `page.tsx`, `page.tsx`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `encryptMessage()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `decryptMessages()` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._