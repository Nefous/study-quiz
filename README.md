# QuizStudy Monorepo

## How to run locally (docker-compose)

1. Copy environment file and adjust values if needed:
   - Create `.env` by copying `.env.example`.
2. Start the stack:
   - Run `docker compose up --build`.
3. Services:
   - Backend: http://localhost:8000
   - Postgres: localhost:5432
   - Frontend: http://localhost:5173

## How to run dev (optional)

You can run the backend and frontend separately on your host machine.

- Backend (example): create a virtual environment, install dependencies from `backend/requirements.txt`, and run the dev server (e.g., `uvicorn app.main:app --reload`).
- Frontend (example): install dependencies in `frontend/` and run `npm run dev`.

## Environment variables

All required variables are defined in `.env` and mirrored in `.env.example`:

- DATABASE_URL
- APP_HOST
- APP_PORT
- API_V1_PREFIX
- CORS_ORIGINS
- LOG_LEVEL
- SECRET_KEY
- DEFAULT_QUIZ_SIZE
- MAX_QUESTIONS_PER_QUIZ
- VITE_API_URL

For docker-compose, set VITE_API_URL to the public backend URL, e.g.
http://localhost:8000/api/v1

## Manual API examples

Practice mode (returns correct answers and explanations):

curl -i -X POST http://localhost:8000/api/v1/quiz/generate \
   -H "Content-Type: application/json" \
   -d '{"topic":"python_core","difficulty":"junior","mode":"practice","size":5}'

Exam mode (no correct answers or explanations):

curl -X POST http://localhost:8000/api/v1/quiz/generate \
   -H "Content-Type: application/json" \
   -d '{"topic":"python_core","difficulty":"junior","mode":"exam","size":5}'
