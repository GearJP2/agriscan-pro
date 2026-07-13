# Agriscan Pro Docker Setup

This project uses Docker Compose to run the full-stack application with Django backend, React frontend, and PostgreSQL database.

## Prerequisites

- Docker and Docker Compose installed. If using WSL, enable WSL integration in Docker Desktop.

## Usage

1. Ensure you are in the project root directory (`/home/rojsak/Coding/agriscan-pro`).

2. Build and start the services:
   ```
   docker compose up --build
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080
   - Database: localhost:5433 (user: agriscan_user, pass: agriscan_pass, db: agriscan)

4. To stop the services:
   ```
   docker compose down
   ```

## Services

- **db**: PostgreSQL database
- **backend**: Django REST API server
- **frontend**: Vite React development server

## Troubleshooting

- If Docker is not found, install Docker Desktop and enable WSL 2 integration.
- If ports are in use, change the port mappings in `docker-compose.yml`.
- For production, build the frontend and serve statically.
