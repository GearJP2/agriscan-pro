# System & Stack Requirements: Agriscan Pro

To run, build, or contribute to this project, you will need to have the following runtimes and frameworks installed.

## 1. System Requirements (Runtimes)

| Technology | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.20.0+` | Core JavaScript runtime for the frontend. |
| **npm** | `10.8.x+` | Package manager for frontend dependencies. |
| **Python** | `3.12.x` | Runtime for the Django backend. |
| **PostgreSQL** | `14+` | Recommended relational database for production (SQLite is used in development). |

## 2. Frontend Core Dependencies (React / Vite)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `18.3.1` | UI Library |
| **React DOM** | `18.3.1` | Web DOM render for React |
| **Vite** | `5.4.19` | Build tool and fast development server |
| **TypeScript** | `5.8.3` | Static typing for JavaScript |
| **Tailwind CSS** | `3.4.17` | Utility-first CSS framework for styling |
| **Shadcn UI** | `(v0.x)` | Reusable UI components (Radix UI + Tailwind) |
| **React Router** | `6.30.1` | Client-side routing |
| **React Query** | `5.83.0` | Server state management and API data fetching |

## 3. Backend Core Dependencies (Django)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Django** | `6.0.x` | Core Python Web Framework |
| **Django REST Framework** | `3.16.x` | Toolkit for building Web APIs (DRF) |
| **django-cors-headers**| `4.9.x` | Handling Cross-Origin Resource Sharing (CORS) |
| **django-redis** | `5.4.x` | Redis cache backend (also serves as Celery broker) |
| **celery** *(coming soon)* | `5.4.x` | Distributed async task queue |

## 4. Cache / Queue Requirements

| Service | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Redis** | `7.x` | Cache backend + Celery broker | 

> Set `REDIS_URL=redis://localhost:6379/0` in your `.env` file.
> See [`backend/requirement.md`](./backend/requirement.md) for full Redis & Celery setup guide.

## 5. How to Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
