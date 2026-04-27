
# NexChat

**Secure Social Messaging & Video Platform**

NexChat is a full-stack, security-first social communication platform combining end-to-end encrypted messaging, group chat, and video calling with social networking features. Built for production-grade engineering and portfolio demonstration.

---

## Features

- End-to-end encrypted 1-to-1 and group messaging (AES-GCM, client-side only)
- Secure group and 1-to-1 video calling (LiveKit SFU, WebRTC E2EE)
- Username-based social graph (mutual connections required for messaging)
- Per-message ephemeral control (auto-expiring messages)
- Secure file sharing (client-side encryption)
- Forward-compatible schema (social feed, discovery, V2-ready)
- Robust rate limiting, CSRF, and input validation

---

## Architecture Overview

| Layer           | Technology                  | Responsibility                                  |
|-----------------|----------------------------|--------------------------------------------------|
| Client Layer    | Next.js (React)            | Chat UI, Video UI, Encryption Engine, File UI    |
| API Layer       | GraphQL (Apollo Server)    | Data queries, mutations, subscriptions           |
| Realtime Layer  | Socket.IO + Redis Adapter  | Live messaging, presence, waiting room events    |
| Video Layer     | LiveKit SFU + WebRTC       | Audio, video, screen share streams               |
| Network Relay   | Coturn TURN Server         | WebRTC fallback relay                            |
| Data Layer      | PostgreSQL + Redis         | Persistent storage, caching, pub/sub, TTL store  |

---

## Setup & Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- (Optional) LiveKit server for video

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env` and fill in your secrets:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/nexchat
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
```

### 3. Run database migrations
```bash
npx prisma migrate deploy
```

### 4. Start the development server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable           | Description                        |
|--------------------|------------------------------------|
| DATABASE_URL       | PostgreSQL connection string        |
| REDIS_URL          | Redis connection string             |
| JWT_SECRET         | JWT signing secret                  |
| LIVEKIT_API_KEY    | LiveKit API key (video)             |
| LIVEKIT_API_SECRET | LiveKit API secret (video)          |

---

## Stack Diagram

```mermaid
graph TD;
	A[Next.js Client] -->|GraphQL| B[Apollo Server]
	B -->|DB| C[PostgreSQL]
	B -->|Cache/PubSub| D[Redis]
	B -->|WebSocket| E[Socket.IO]
	E -->|Scaling| D
	B -->|Video| F[LiveKit SFU]
	F -->|TURN| G[Coturn]
```

---

## Quick Start

1. Clone the repo and install dependencies
2. Set up `.env` and run migrations
3. Start Redis and PostgreSQL
4. `npm run dev` and open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
yapper/
	app/                # Next.js App Router
	components/ui/      # Reusable UI components
	graphql/            # Schema, resolvers, context
	lib/                # Utilities (auth, redis, e2ee, etc)
	prisma/             # Prisma schema and migrations
	public/             # Static assets
```

---

## Security & Compliance

- All messages/files encrypted client-side (AES-GCM 256)
- No plaintext ever stored or logged server-side
- JWT auth with Redis session cache
- CSRF protection and input validation enforced
- Rate limiting on all sensitive endpoints

---

## License

This project is for portfolio and demonstration purposes. See PRD for details.
