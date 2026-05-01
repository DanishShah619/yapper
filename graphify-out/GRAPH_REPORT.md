# Graph Report - yapper  (2026-05-01)

## Corpus Check
- 93 files · ~52,863 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 226 nodes · 181 edges · 10 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 14|Community 14]]

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
- `useSocket()` --calls--> `WaitingRoomPage()`  [INFERRED]
  app\providers.tsx → app\video\[id]\waiting\page.tsx
- `Providers()` --calls--> `useToast()`  [INFERRED]
  app\providers.tsx → components\ui\Toast.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (16): decryptMessages(), deriveRoomKey(), E2EEKeyMissingError, exportRoomKey(), generateAndStoreGroupKey(), generateKeyPair(), generateRoomKey(), getDMRoomKey() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (5): VideoListPage(), WaitingRoomPage(), Providers(), useSocket(), useToast()

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (4): generateUserKeyPair(), loadPrivateKey(), savePrivateKey(), initUserKeys()

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (6): emitRealtimeMessage(), toMsgShape(), toUserShape(), main(), setIO(), tryGetIO()

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (3): validateSession(), verifyToken(), getSession()

### Community 6 - "Community 6"
Cohesion: 0.42
Nodes (8): detectAndAlertStaleShards(), getRoomKeyHealth(), markShardAcknowledged(), markShardDecrypted(), markShardDelivered(), pushHealthUpdateToAdmins(), redeliverShard(), getIO()

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (3): isConnected(), requireConnection(), requireConnectionGuard()

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (3): register(), runDetection(), startStaleShardDetector()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (3): encryptMessage(), handleKeyDown(), handleSend()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (1): handleSubmit()

## Knowledge Gaps
- **Thin community `Community 14`** (3 nodes): `page.tsx`, `page.tsx`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `decryptMessages()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `encryptMessage()` connect `Community 9` to `Community 0`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `getIO()` connect `Community 6` to `Community 3`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._