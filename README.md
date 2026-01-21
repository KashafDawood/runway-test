# Runway API

Backend service for Runway following the Hemero API pattern.

## Getting Started

### Prerequisites

- Node.js >= 16.17.0
- MongoDB (local or remote)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration values.

### Running the Application

#### Development
```bash
npm run dev
```

#### Production
```bash
npm run build
npm start
```

### Environment Variables

See `.env.example` for all required environment variables. The application supports:
- `development` - Local development environment
- `staging` - Staging environment
- `production` - Production environment

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically

### Project Structure

```
runway/
├── src/
│   ├── app.ts              # Express app configuration
│   ├── server.ts           # Server entry point
│   ├── components/         # Feature modules
│   │   ├── health/         # Health check endpoint
│   │   └── 404/            # 404 handler
│   ├── config/             # Configuration files
│   │   ├── config.ts       # Environment config
│   │   ├── db.ts           # Database connection
│   │   └── consts.ts       # Constants
│   ├── core/               # Core utilities
│   │   ├── middlewares/    # Express middlewares
│   │   └── utils/          # Utility functions
│   └── routes/             # API routes
│       ├── api.ts          # Main API router
│       └── v1/             # Version 1 routes
├── logs/                   # Application logs
├── .env.example            # Environment variables template
└── package.json            # Dependencies and scripts
```

### API Endpoints

- `GET /api/v1/health` - Health check endpoint

### CI/CD

The project includes GitHub Actions workflow for:
- Linting (`npm run lint`)
- Building (`npm run build`)

Workflow runs on push and pull requests to `main` and `develop` branches.
