# Graph Report - yapper  (2026-05-11)

## Corpus Check
- 101 files · ~48,654 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 282 nodes · 262 edges · 13 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 17|Community 17]]

## God Nodes (most connected - your core abstractions)
1. `loadRoomKey()` - 9 edges
2. `pushHealthUpdateToAdmins()` - 7 edges
3. `storeRoomKey()` - 6 edges
4. `runDetection()` - 6 edges
5. `handleDownloadAttachment()` - 5 edges
6. `getOrRequestGroupKey()` - 5 edges
7. `getOrCreateKeyPair()` - 5 edges
8. `getDMRoomKey()` - 5 edges
9. `handleSend()` - 4 edges
10. `decryptMessages()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `handleSend()` --calls--> `encryptMessage()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `loadRoomKey()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `decryptFile()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `handleUpdateMessage()` --calls--> `loadRoomKey()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `handleUpdateMessage()` --calls--> `encryptMessage()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (18): decryptMessages(), deriveRoomKey(), E2EEKeyMissingError, encryptMessage(), exportRoomKey(), generateAndStoreGroupKey(), generateKeyPair(), generateRoomKey() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (9): base64ToArrayBuffer(), cancelEditingMessage(), handleDeleteMessage(), handleDownloadAttachment(), handleFileSelect(), handleUpdateMessage(), isSupportedAttachment(), saveDecryptedAttachment() (+1 more)

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

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (1): handleSubmit()

## Knowledge Gaps
- **Thin community `Community 17`** (3 nodes): `page.tsx`, `page.tsx`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `encryptMessage()` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `handleSend()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `getIO()` connect `Community 9` to `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `loadRoomKey()` (e.g. with `decryptMessages()` and `handleDownloadAttachment()`) actually correct?**
  _`loadRoomKey()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `handleDownloadAttachment()` (e.g. with `loadRoomKey()` and `decryptFile()`) actually correct?**
  _`handleDownloadAttachment()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._