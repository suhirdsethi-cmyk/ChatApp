# Chat App - Docker Setup

This project is containerized using Docker and Docker Compose for easy deployment and development.

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` with your MongoDB connection string and other configuration.

3. **Build and run the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Health Check: http://localhost:8000/api/health

## Services

- **frontend**: React application served by Nginx (port 3000)
- **backend**: FastAPI application with WebSocket support (port 8000)

## Development

For development with hot reloading:

```bash
# Backend (with reload)
docker-compose up backend

# Frontend (with hot reload - requires separate setup)
cd frontend && npm run dev
```

## Environment Variables

### Backend (.env)
- `MONGO_URL`: MongoDB connection string
- `JWT_SECRET_KEY`: Secret key for JWT tokens
- `JWT_ALGORITHM`: JWT algorithm (default: HS256)
- `JWT_EXPIRE_MINUTES`: Token expiration time
- `CORS_ORIGINS`: Comma-separated list of allowed origins

## Docker Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs

# Rebuild and restart
docker-compose up --build --force-recreate
```

## Production Deployment

For production deployment:

1. Update environment variables for production URLs
2. Use a reverse proxy (nginx) in front of the containers
3. Set up proper SSL certificates
4. Configure MongoDB Atlas for production access
5. Use Docker secrets for sensitive data

## Troubleshooting

- **Port conflicts**: Ensure ports 3000 and 8000 are available
- **MongoDB connection**: Verify your MongoDB URL and network access
- **CORS issues**: Check CORS_ORIGINS matches your frontend URL
- **WebSocket issues**: Ensure backend is accessible for WebSocket connections