# WhatsApp Anonymous Chat Bot

A production-grade WhatsApp anonymous chat bot built with Node.js, Baileys, Firebase, and Redis.

## Features

- Anonymous random chat system
- Advanced matching with preferences
- Anti-abuse protection
- Privacy-focused design
- Media support
- Scalable architecture
- Admin dashboard API

## Tech Stack

- Node.js 18+
- Baileys WhatsApp API
- Firebase Realtime Database & Firestore
- Redis for caching
- Express.js
- Docker

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials
4. Set up Firebase project and download service account key
5. Run Redis: `docker-compose up redis`
6. Start the bot: `npm start`

## Deployment

### Docker

```bash
docker-compose up --build
```

### PM2

```bash
npm run pm2:start
```

### VPS Ubuntu

1. Install Node.js 18+
2. Install PM2: `npm install -g pm2`
3. Clone repo and install deps
4. Configure environment
5. Run with PM2

## Firebase Database Schema

### Collections

- `users`: User data
- `active_pairs`: Current chat pairs
- `waiting_queue`: Users waiting for match (Redis)
- `reports`: User reports
- `moderation`: Moderation actions

## Scaling

- Use Redis clusters for caching
- Firebase auto-scaling
- Load balancer for multiple instances
- Horizontal scaling with PM2 clusters

## Security

- Input sanitization
- Rate limiting
- Encrypted communications
- Anonymous IDs

## License

MIT