# GraphicalQL Backend

This is the backend service for the GraphicalQL application, a BIM-oriented project analysis platform. Built with FastAPI and SQLite, it provides API endpoints, user authentication, and model processing functionality.

## Features

- User authentication with Autodesk OAuth (3-legged)
- GraphQL API for project and model access
- Integration with Autodesk Data Management API
- SQLite database storage for lightweight deployments
- CORS and session management for secure cross-origin access

## Stack

- **Framework**: FastAPI
- **Database**: SQLite
- **Auth**: Autodesk OAuth 2.0
- **Runtime**: Python 3.11+

## Requirements

- Python 3.11+
- Pip / virtualenv
- Autodesk Developer account (Client ID & Secret)

## Getting Started

### Clone the repository
```bash
git clone https://github.com/emnss26/GraphicalQL_Backend.git
cd GraphicalQL_Backend
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Set environment variables
Create a `.env` file with the following variables:
```env
CLIENT_ID=your_autodesk_client_id
CLIENT_SECRET=your_autodesk_client_secret
FRONTEND_BASE_URL=http://localhost:5173
```

### Run the server
```bash
uvicorn main:app --reload --port 8000
```

## Deployment (IIS on Windows Server)
1. Install Python 3.11 and `pip install fastapi uvicorn python-dotenv`
2. Set up `IIS + FastCGI` with a reverse proxy to Uvicorn/Gunicorn
3. Ensure `dev.sqlite3` is placed in a writable, persistent path
4. Set IIS rules to allow cookies and headers
5. Set appropriate CORS origins in FastAPI

## Security Notes
- Secure cookies are used for session tokens
- Ensure HTTPS termination and CSRF protection via frontend if needed

## License
MIT

---
For more info, contact [emnss26](https://github.com/emnss26).
