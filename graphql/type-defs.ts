import { readFileSync } from 'fs';
import { join } from 'path';

// Read the SDL schema file for documentation purposes
// Apollo Server will use the programmatic type definitions below
export const schemaSDL = readFileSync(
  join(process.cwd(), 'graphql', 'schema.graphql'),
  'utf-8'
);

// Type definitions as a string for Apollo Server
export const typeDefs = `#graphql
  scalar DateTime

  enum FriendshipStatus {
    PENDING
    ACCEPTED
    DECLINED
  }

  enum RoomType {
    PERSISTENT
    EPHEMERAL
  }

  enum MemberRole {
    ADMIN
    MEMBER
  }

  enum MemberAddPolicy {
    ADMIN_ONLY
    OPEN
  }

  type User {
    id: ID!
    email: String!
    username: String!
    avatarUrl: String
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Friendship {
    id: ID!
    requester: User!
    addressee: User!
    status: FriendshipStatus!
    createdAt: DateTime!
  }

  type Room {
    id: ID!
    name: String
    type: RoomType!
    locked: Boolean!
    members: [RoomMember!]!
    createdAt: DateTime!
  }

  type RoomMember {
    id: ID!
    user: User!
    role: MemberRole!
    mutedAt: DateTime
    joinedAt: DateTime!
  }

  type Message {
    id: ID!
    roomId: ID
    groupId: ID
    sender: User!
    encryptedPayload: String!
    ephemeral: Boolean!
    expiresAt: DateTime
    createdAt: DateTime!
  }

  type MessageConnection {
    edges: [Message!]!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type File {
    id: ID!
    roomId: ID!
    uploader: User!
    encryptedMetadata: String!
    createdAt: DateTime!
  }

  type Group {
    id: ID!
    name: String!
    type: RoomType!
    avatarUrl: String
    locked: Boolean!
    memberAddPolicy: MemberAddPolicy!
    members: [GroupMember!]!
    createdAt: DateTime!
  }

  type GroupMember {
    id: ID!
    user: User!
    role: MemberRole!
    mutedAt: DateTime
    joinedAt: DateTime!
  }

  type VideoRoom {
    id: ID!
    liveKitRoomId: String
    locked: Boolean!
    maxParticipants: Int!
    createdAt: DateTime!
  }

  type Post {
    id: ID!
    user: User!
    content: String!
    createdAt: DateTime!
  }

  type FeedItem {
    id: ID!
    post: Post!
    createdAt: DateTime!
  }

  type PeopleYouMayKnowSuggestion {
    user: User!
    mutualFriendsCount: Int!
  }

  type InviteLink {
    url: String!
    expiresAt: DateTime!
  }

  type Query {
    me: User!
    user(username: String!): User
    connections: [User!]!
    connectionRequests: [Friendship!]!
    conversation(id: ID!): Room
    conversations: [Room!]!
    messages(roomId: ID!, cursor: String, limit: Int): MessageConnection!
    group(id: ID!): Group
    groups: [Group!]!
    peopleYouMayKnow: [PeopleYouMayKnowSuggestion!]!
    feed(cursor: String, limit: Int): [FeedItem!]!
  }

  type Mutation {
    register(email: String!, username: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    sendConnectionRequest(username: String!): Friendship!
    respondToConnectionRequest(requestId: ID!, accept: Boolean!): Friendship!
    removeConnection(userId: ID!): Boolean!
    createRoom(name: String!, type: RoomType!): Room!
    inviteToRoom(roomId: ID!, username: String!): RoomMember!
    generateInviteLink(roomId: ID, groupId: ID, ttl: Int!): InviteLink!
    sendMessage(roomId: ID, groupId: ID, encryptedPayload: String!, ephemeral: Boolean, ttl: Int): Message!
    uploadFile(roomId: ID!, encryptedBlob: String!, encryptedMetadata: String!): File!
    createGroup(name: String!, type: RoomType!, avatar: String): Group!
    addGroupMember(groupId: ID!, username: String!): GroupMember!
    removeGroupMember(groupId: ID!, userId: ID!): Boolean!
    promoteGroupMember(groupId: ID!, userId: ID!): GroupMember!
    transferGroupOwnership(groupId: ID!, userId: ID!): Group!
    lockGroup(groupId: ID!): Group!
    deleteGroup(groupId: ID!): Boolean!
    muteGroupMember(groupId: ID!, userId: ID!): GroupMember!
    leaveGroup(groupId: ID!): Boolean!
    updateMemberAddPolicy(groupId: ID!, policy: MemberAddPolicy!): Group!
    createVideoRoom(maxParticipants: Int): VideoRoom!
    approveParticipant(roomId: ID!, participantId: ID!): Boolean!
    rejectParticipant(roomId: ID!, participantId: ID!): Boolean!
    lockVideoRoom(roomId: ID!): VideoRoom!
    createPost(content: String!): Post!
  }

  type Subscription {
    messageReceived(roomId: ID!): Message!
    presenceUpdated(userId: ID!): Boolean!
    waitingRoomUpdated(videoRoomId: ID!): Boolean!
    participantApproved(videoRoomId: ID!): Boolean!
    participantRejected(videoRoomId: ID!): Boolean!
    roomLocked(videoRoomId: ID!): Boolean!
    groupMemberUpdated(groupId: ID!): GroupMember!
  }
`;
