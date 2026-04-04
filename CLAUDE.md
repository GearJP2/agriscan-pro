# AgriScan Pro - Claude Code Instructions

This file helps Claude (Claude Code and other Claude instances) understand the project structure, conventions, and working approach.

## 🌾 Project Overview

**AgriScan Pro** is a comprehensive agricultural research platform for lab sample analysis and mycotoxin detection.

### Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Django REST Framework (Python)
- **Database**: PostgreSQL (managed via Django ORM)
- **Agent System**: Node.js orchestrator (in development - local only)
- **Auth**: JWT (via rest_framework_simplejwt)

### Key URLs
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/`
- Django Admin: `http://localhost:8000/admin/`

---

## 📁 Project Structure

```
agriscan-pro/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API clients and utilities
│   │   ├── store/            # State management (Zustand/Context)
│   │   └── main.tsx          # Entry point
│   ├── vite.config.ts        # Vite configuration
│   └── package.json
│
├── backend/                  # Django REST Framework
│   ├── manage.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── settings.py       # Django configuration
│   │   ├── urls.py           # Main URL routing
│   │   └── wsgi.py
│   ├── accounts/             # User authentication
│   │   ├── models.py         # User model
│   │   ├── views.py          # Auth endpoints (login, register)
│   │   ├── serializers.py    # Auth serializers
│   │   └── urls.py
│   ├── samples/              # Core business logic
│   │   ├── models.py         # Sample, ProcessLog, MycotoxinResult
│   │   ├── views.py          # CRUD viewsets
│   │   ├── serializers.py    # Data serialization
│   │   ├── urls.py
│   │   └── admin.py          # Django admin config
│   └── venv/                 # Python virtual environment
│
├── .claude/                  # Claude Code configuration
│   ├── agents/               # Agent definitions (7 types)
│   │   ├── orchestrator.md
│   │   ├── dev-agent.md
│   │   ├── data-pipeline.md
│   │   ├── research-collab.md
│   │   ├── devops-agent.md
│   │   ├── qa-agent.md
│   │   ├── report-notify.md
│   │   └── security-monitor.md
│   └── settings.json         # Claude Code workspace settings
│
├── agents-orchestrator/      # 🚧 WIP - Local development only
│   ├── orchestrator.js       # Main orchestration engine
│   ├── api-gateway.js        # REST API for agents
│   ├── lib/                  # Supporting libraries
│   ├── workflows/            # Workflow definitions (4 examples)
│   ├── examples/             # Runnable examples
│   ├── package.json
│   └── README.md
│
├── .mcp/                     # 🚧 WIP - MCP Server implementations
│   ├── servers/
│   │   ├── jira-server.js    # Jira integration
│   │   ├── linear-server.js  # Linear integration
│   │   ├── slack-server.js   # Slack integration
│   │   ├── github-server.js  # GitHub integration
│   │   └── database-server.js # PostgreSQL operations
│   └── .env.example
│
├── .gitignore                # Git ignore rules
├── CLAUDE.md                 # This file
├── ORCHESTRATOR_SUMMARY.md   # Agent system documentation
└── README.md                 # Project README
```

### Key Files by Purpose

#### Frontend Build & Config
- `frontend/vite.config.ts` - Vite build config
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/package.json` - Frontend dependencies

#### Backend Configuration
- `backend/core/settings.py` - Django settings (DB, apps, auth)
- `backend/core/urls.py` - Root URL routing
- `backend/requirements.txt` - Python dependencies

#### Authentication & User Management
- `backend/accounts/models.py` - User model definition
- `backend/accounts/serializers.py` - User serialization
- `backend/accounts/views.py` - Login/register endpoints

#### Core Business Logic (Samples)
- `backend/samples/models.py` - Sample, ProcessLog, MycotoxinResult models
- `backend/samples/views.py` - CRUD operations and custom actions
- `backend/samples/serializers.py` - Data serialization for API

---

## 🔄 API Endpoints

### Authentication
```
POST /api/auth/login/           # Login (email, password)
POST /api/auth/register/        # Register (email, password, name)
POST /api/auth/token/refresh/   # Refresh JWT token
```

### Samples (Core Business)
```
GET    /api/samples/            # List samples (with filters)
POST   /api/samples/            # Create new sample
GET    /api/samples/{id}/       # Get sample details
PUT    /api/samples/{id}/       # Update sample
DELETE /api/samples/{id}/       # Delete sample

GET    /api/samples/statistics/ # Dashboard stats
GET    /api/samples/recent_alerts/ # Flagged samples
POST   /api/samples/{id}/add_process_log/    # Add process log
POST   /api/samples/{id}/add_mycotoxin_result/ # Add test result
POST   /api/samples/bulk_create/ # Bulk import samples
```

### Filtering Examples
```
GET /api/samples/?status=pending
GET /api/samples/?region=Southeast
GET /api/samples/?vegetation=Rice
GET /api/samples/?date_from=2026-01-01&date_to=2026-03-31
```

---

## 🛠️ Development Workflow

### Backend Development

#### Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Creating Models
1. Define in `backend/samples/models.py`
2. Create serializer in `backend/samples/serializers.py`
3. Create viewset in `backend/samples/views.py`
4. Register in `backend/samples/urls.py`
5. Run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

#### Creating API Endpoints
```python
# In backend/samples/views.py
@action(detail=False, methods=['post'])
def custom_action(self, request):
    """Custom API action"""
    # Your logic here
    return Response({'result': 'success'})
```

### Frontend Development

#### Setup
```bash
cd frontend
npm install
npm run dev
```

#### Adding Features
1. Create component in `src/components/`
2. Add service/API call in `src/services/`
3. Add route in main router config
4. Use hooks for state management

#### API Calls
```typescript
// In src/services/api.ts
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

export const getSamples = (filters) => api.get('/samples/', { params: filters });
```

---

## 🧪 Testing Strategy

### Backend Tests
```bash
# Run all tests
python manage.py test

# Run specific test
python manage.py test samples.tests.SampleViewSetTest

# With coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

### Agent Tests (when implemented)
```bash
# Test agent system
node agents-orchestrator/examples/simple-task.js
```

---

## 📝 Code Conventions

### Python (Django)
- Follow PEP 8
- Use snake_case for variables and functions
- Add docstrings to classes and methods
- Model names: singular (Sample, ProcessLog)
- View methods: descriptive verbs (get_queryset, perform_create)

### TypeScript (React)
- Use PascalCase for components
- Use camelCase for variables and functions
- Add types for all function parameters
- Extract complex logic to custom hooks
- Use descriptive component names

### Database
- All tables have `id` primary key (auto-increment)
- All tables have `created_at` and `updated_at` timestamps
- Foreign keys use `_id` suffix in field names
- Use descriptive field names (not abbreviations)

### API Responses
```json
{
  "data": {...},
  "status": "success",
  "timestamp": "2026-03-27T...",
  "meta": {
    "count": 10,
    "page": 1
  }
}
```

---

## 🚀 Status & WIP Features

### ✅ Completed
- User authentication (JWT)
- Sample CRUD operations
- Process logging
- Mycotoxin result tracking
- Dashboard statistics
- Bulk sample import
- Django admin integration
- AWS S3 storage integration with presigned URL upload service
- Celery async task queue (broker: Redis)
- Background file processing via Celery tasks (`backend/samples/tasks.py`)

### 🚧 In Development (Local Only - Not in Cloud)
- **Agent Orchestrator** (`agents-orchestrator/`) - Multi-agent task execution system
- **MCP Servers** (`.mcp/`) - External service integrations
- **Agent Integration** - Connecting agents to Django backend

These are NOT yet committed to production and are for local development only. See `ORCHESTRATOR_SUMMARY.md` for details.

### 📋 Future Planned
- Real-time notifications (WebSocket)
- Advanced data visualization
- Export to PDF/Excel
- Automated alerts for high-risk samples
- Researcher collaboration features
- Mobile app

---

## 🔐 Security Notes

### Current Implementation
- JWT tokens for authentication
- User permission checks in viewsets
- CORS enabled for localhost dev
- Django CSRF protection enabled

### Best Practices
- Never commit `.env` files with real credentials
- Always validate user input in serializers
- Use Django's built-in permission system
- Keep secret keys in environment variables
- Use HTTPS in production

---

## 📊 Database Models

### Sample
```
id: UUID (primary key)
sample_id: String (unique)
region: String
vegetation_variety: String
status: String (pending, in_progress, completed, flagged)
collection_date: DateTime
purpose: String
sample_type: String
processing_type: String
collected_by: String
updated_by: ForeignKey(User)
created_at: DateTime (auto)
updated_at: DateTime (auto)
```

### ProcessLog
```
id: Integer (primary key)
sample: ForeignKey(Sample)
state: String (registered, processing, testing, etc)
notes: Text
conducted_by: String
timestamp: DateTime (auto)
```

### MycotoxinResult
```
id: Integer (primary key)
sample: ForeignKey(Sample)
test_type: String
value: Float
unit: String
dangerous: Boolean
timestamp: DateTime (auto)
```

---

## 🎯 Common Tasks

### Add New Sample Field
1. Add to model in `backend/samples/models.py`
2. Add to serializers in `backend/samples/serializers.py`
3. Run migrations
4. Update frontend form in `frontend/src/components/SampleForm.tsx`

### Add Custom API Endpoint
1. Create method in viewset (with `@action` decorator)
2. Implement logic
3. Add test in `backend/tests/`
4. Call from frontend via `src/services/api.ts`

### Debug API Issues
```bash
# Check Django logs
python manage.py runserver  # Watch console

# Check network in browser
# Open DevTools > Network tab

# Test API manually
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/samples/
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and setup |
| `CLAUDE.md` | This file - Claude instructions |
| `ORCHESTRATOR_SUMMARY.md` | Agent system documentation |
| `agents-orchestrator/README.md` | Orchestrator API documentation |
| `agents-orchestrator/QUICK_START.md` | Agent system quick start |

---

## 🤖 When Working with Claude Code

### Context to Provide
When asking Claude Code to work on this project, mention:
- **Which component**: frontend, backend, or agents
- **What to modify**: models, views, components, etc.
- **Current behavior**: what works now
- **Desired behavior**: what you want to change

### Example Request
```
In the backend, add a new "risk_level" field to the Sample model.
It should be a choice field with options: low, medium, high.
Update the serializer and viewset accordingly.
```

### Code Review Instructions
Before committing code changes:
1. Run linter/formatter (Prettier, Black)
2. Run tests to ensure nothing breaks
3. Check Django admin to ensure models display correctly
4. Test API endpoints with sample data

---

## 🔗 Integration Points (When Ready)

These are documented but not yet integrated:

### To Integrate Agents
1. Start orchestrator: `npm start` (in `agents-orchestrator/`)
2. Create Django task model to track agent jobs
3. Add endpoint that calls orchestrator API
4. Update tests to include agent workflows

### To Integrate MCP Servers
1. Configure credentials in `.mcp/.env`
2. Start MCP servers
3. Create agent implementations that use MCP tools
4. Test with example scripts

---

## ✨ Key Principles for This Project

1. **Security First** - All user inputs validated, authentication required
2. **Data Integrity** - Careful migration management, no data loss
3. **API-Driven** - All features exposed via REST API
4. **Testing Required** - Tests for all new features
5. **Documentation** - Keep docs up-to-date with code changes
6. **Clean Code** - Follow conventions, use descriptive names
7. **User-Focused** - Feature decisions based on researcher needs

---

## 📞 Quick Reference

### Common Commands

**Backend**
```bash
python manage.py runserver           # Start Django
python manage.py makemigrations      # Create migration
python manage.py migrate             # Apply migration
python manage.py createsuperuser     # Create admin
python manage.py test                # Run tests
```

**Frontend**
```bash
npm run dev                          # Start dev server
npm run build                        # Build for production
npm run preview                      # Preview production build
npm run test                         # Run tests
npm run lint                         # Check code quality
```

**Git**
```bash
git status                           # Check status
git add .                            # Stage changes
git commit -m "message"              # Commit with message
git push origin main                 # Push to GitHub
```

---

## Last Updated
- Date: 2026-04-04
- By: Claude Code
- Status: AWS S3 + Celery integration added
