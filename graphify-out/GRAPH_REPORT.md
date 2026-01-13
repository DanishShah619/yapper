# Graph Report - yapper  (2026-05-11)

## Corpus Check
- 101 files · ~50,595 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 297 nodes · 301 edges · 12 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `loadRoomKey()` - 10 edges
2. `getGroupRoomKey()` - 10 edges
3. `getAccountKeyPair()` - 8 edges
4. `storeRoomKey()` - 7 edges
5. `loadLocalKeyPair()` - 7 edges
6. `pushHealthUpdateToAdmins()` - 7 edges
7. `handleSend()` - 6 edges
8. `decryptMessages()` - 6 edges
9. `isClient()` - 6 edges
10. `getOrRequestGroupKey()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `handleSend()` --calls--> `encryptMessage()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleSend()` --calls--> `getGroupRoomKey()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleSend()` --calls--> `loadRoomKey()`  [INFERRED]
  app\groups\[id]\page.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `loadRoomKey()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts
- `handleDownloadAttachment()` --calls--> `decryptFile()`  [INFERRED]
  components\ui\ChatPanel.tsx → lib\e2ee.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (28): decryptMessages(), handleUpdateMessage(), accountKey(), deriveRoomKey(), deriveSharedAesKey(), E2EEKeyMissingError, encryptMessage(), exportRoomKey() (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (8): base64ToArrayBuffer(), cancelEditingMessage(), handleDeleteMessage(), handleDownloadAttachment(), handleFileSelect(), isSupportedAttachment(), saveDecryptedAttachment(), decryptFile()

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (12): verifyRedisConnection(), emitRealtimeMessage(), emitRealtimeMessageDelete(), emitRealtimeMessageUpdate(), toFileShape(), toMsgShape(), toUserShape(), checkReadiness() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (5): handleKeyDown(), handleSend(), join(), usePresence(), validateInput()

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (7): register(), acquireWorkerLock(), registerSignalHandlers(), releaseWorkerLock(), runDetection(), startLockRenewal(), startStaleShardDetector()

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (5): VideoListPage(), WaitingRoomPage(), Providers(), useSocket(), useToast()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): validateSession(), verifyToken(), deleteSession(), getSession(), legacySessionKey(), sessionKey(), setSession()

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (4): generateUserKeyPair(), loadPrivateKey(), savePrivateKey(), initUserKeys()

### Community 8 - "Community 8"
Cohesion: 0.42
Nodes (8): detectAndAlertStaleShards(), getRoomKeyHealth(), markShardAcknowledged(), markShardDecrypted(), markShardDelivered(), pushHealthUpdateToAdmins(), redeliverShard(), getIO()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (3): isConnected(), requireConnection(), requireConnectionGuard()

### Community 11 - "Community 11"
Cohesion: 0.43
Nodes (5): handleLogout(), disconnectSocket(), getAuthPayload(), getSocket(), reconnectSocket()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (2): handleGenerate(), normalizeVideoInviteUrl()

## Knowledge Gaps
- **Thin community `Community 16`** (4 nodes): `InCallInvitePanel.tsx`, `handleCopy()`, `handleGenerate()`, `normalizeVideoInviteUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRoomKey()` connect `Community 0` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `handleSend()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `decryptMessages()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `loadRoomKey()` (e.g. with `decryptMessages()` and `handleDownloadAttachment()`) actually correct?**
  _`loadRoomKey()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `getGroupRoomKey()` (e.g. with `handleSend()` and `handleAddMember()`) actually correct?**
  _`getGroupRoomKey()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getAccountKeyPair()` (e.g. with `decryptMessages()` and `handleAddMember()`) actually correct?**
  _`getAccountKeyPair()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._