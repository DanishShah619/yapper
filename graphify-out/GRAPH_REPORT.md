# Graph Report - yapper  (2026-05-11)

## Corpus Check
- 101 files · ~48,783 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 283 nodes · 263 edges · 12 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `loadRoomKey()` - 10 edges
2. `pushHealthUpdateToAdmins()` - 7 edges
3. `storeRoomKey()` - 6 edges
4. `runDetection()` - 6 edges
5. `handleSend()` - 5 edges
6. `handleDownloadAttachment()` - 5 edges
7. `getOrRequestGroupKey()` - 5 edges
8. `getOrCreateKeyPair()` - 5 edges
9. `getDMRoomKey()` - 5 edges
10. `decryptMessages()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `handleSend()` --calls--> `encryptMessage()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleSend()` --calls--> `loadRoomKey()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `loadRoomKey()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `decryptFile()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `detectAndAlertStaleShards()` --calls--> `runDetection()`  [INFERRED]
  lib\keyDelivery.ts → workers\staleShardDetector.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (19): decryptMessages(), handleUpdateMessage(), deriveRoomKey(), E2EEKeyMissingError, encryptMessage(), exportRoomKey(), generateAndStoreGroupKey(), generateKeyPair() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (8): base64ToArrayBuffer(), cancelEditingMessage(), handleDeleteMessage(), handleDownloadAttachment(), handleFileSelect(), isSupportedAttachment(), saveDecryptedAttachment(), decryptFile()

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (5): handleKeyDown(), handleSend(), join(), usePresence(), validateInput()

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (5): VideoListPage(), WaitingRoomPage(), Providers(), useSocket(), useToast()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (7): validateSession(), verifyToken(), deleteSession(), getSession(), legacySessionKey(), sessionKey(), setSession()

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (4): generateUserKeyPair(), loadPrivateKey(), savePrivateKey(), initUserKeys()

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (7): register(), acquireWorkerLock(), registerSignalHandlers(), releaseWorkerLock(), runDetection(), startLockRenewal(), startStaleShardDetector()

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (5): verifyRedisConnection(), checkReadiness(), main(), withTimeout(), setIO()

### Community 8 - "Community 8"
Cohesion: 0.36
Nodes (7): emitRealtimeMessage(), emitRealtimeMessageDelete(), emitRealtimeMessageUpdate(), toFileShape(), toMsgShape(), toUserShape(), tryGetIO()

### Community 9 - "Community 9"
Cohesion: 0.42
Nodes (8): detectAndAlertStaleShards(), getRoomKeyHealth(), markShardAcknowledged(), markShardDecrypted(), markShardDelivered(), pushHealthUpdateToAdmins(), redeliverShard(), getIO()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (3): isConnected(), requireConnection(), requireConnectionGuard()

### Community 11 - "Community 11"
Cohesion: 0.43
Nodes (5): handleLogout(), disconnectSocket(), getAuthPayload(), getSocket(), reconnectSocket()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRoomKey()` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `handleSend()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `getIO()` connect `Community 9` to `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `loadRoomKey()` (e.g. with `handleSend()` and `decryptMessages()`) actually correct?**
  _`loadRoomKey()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `handleSend()` (e.g. with `encryptMessage()` and `loadRoomKey()`) actually correct?**
  _`handleSend()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._