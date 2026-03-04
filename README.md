# WhatsApp Anonymous Chat Bot

A production-grade WhatsApp anonymous chat bot built with Node.js, Baileys, Supabase, and Redis.

## Features

- Anonymous random chat system
- Advanced matching with preferences
- Anti-abuse protection
- Privacy-focused design
- Media support
- Scalable architecture
- Admin dashboard API

## Tech Stack

- Node.js 20+
- Baileys WhatsApp API
- Supabase (PostgreSQL)
- Redis for caching
- Express.js
- Docker

## Prerequisites

### Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Wait for setup to complete

2. **Get API Keys**
   - Go to Settings → API
   - Copy:
     - Project URL
     - `anon` `public` key
     - `service_role` `secret` key

3. **Database Setup**
   - Go to SQL Editor in Supabase Dashboard
   - Run the SQL from `supabase-schema.sql`
   - This creates all tables, indexes, and RLS policies

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in Supabase credentials
4. Set up Redis: `docker-compose up -d redis`
5. Start the bot: `npm start`

## Environment Configuration

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Admin
ADMIN_PHONE=1234567890@c.us
```

## Database Schema

### Tables

- `users`: User data and preferences
- `active_pairs`: Current chat pairs
- `reports`: User reports
- `moderation`: Admin moderation actions
- `analytics`: System analytics

### Key Features

- Row Level Security (RLS) enabled
- Automatic timestamps
- Foreign key constraints
- Performance indexes
- PostgreSQL functions for matchmaking

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

1. Install Node.js 20+, PM2
2. Clone repo, `npm install`
3. Configure `.env`
4. `npm start` or PM2

## API Endpoints

- `GET /health` - Health check
- `GET /api/analytics` - System analytics
- `POST /api/moderate` - Moderation actions

## Security

- Row Level Security in Supabase
- Input sanitization
- Rate limiting
- Anti-spam detection
- Flood protection

## Scaling

- Supabase auto-scaling
- Redis for session management
- Horizontal scaling with PM2
- Database connection pooling

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Run tests
npm test

# Docker development
docker-compose up
```

## License

MIT