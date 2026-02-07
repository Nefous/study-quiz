# QuizStudy

QuizStudy is an application focused on core Python concepts and essential programming skills.
It allows users to take quizzes on key topics such as **Python Core**, **Big O notation**, **Algorithms**, and **Data Structures**,  progress tracking, and detailed performance analytics enhanced with AI-powered hints and AI-driven review feedback.

<p align="center" >
    <img src="frontend/src/assets/logo.png" alt="QuizStudy Logo" width="120" />
</p>

### 📷 Documentation Screenshots

Screenshots can be found in the [`/docs/docs`](docs/docs) directory.

## ✨ Features

### 📝 Quiz Modes

- Practice Mode - instant feedback after each question
- Exam Mode - timed quizzes with no feedback until completion

### 📚 Topics

- Python Core  
- Big O Notation  
- Algorithms  
- Data Structures  
- Random Mix - for diverse and well-rounded practice

### ❓ Question Types
- MCQ (multiple-choice questions)
- Code Output questions (determine the result of Python code)

### 🤖 AI-Powered Features
- **Intelligent Contextual Hints**
  - Penalty-based system for strategic learning
  - Multiple hint levels: subtle guidance to explicit help
  - Rate-limited to encourage thoughtful problem-solving
- **AI Review** at the end of each quiz with personalized feedback
  - Detailed performance analysis
  - Strengths and weaknesses identification
  - Study plan recommendations
  - Micro-drills for targeted improvement
  - Next quiz suggestions based on performance
- **AI Coach** - personalized next quiz recommendations based on performance history

### 🧪 Question Candidate Pipeline (Admin)
- AI-generated question candidates with configurable topic, difficulty, and type
- Validation pipeline
- Moderation workflow: approve, reject, publish to question bank
- Admin-only endpoints for candidate generation and review

### 🔐 Authentication
- Email / Password
- OAuth providers: Google, GitHub
- JWT-based secure authorization

### 📊 Performance Tracking & Analytics
- Comprehensive quiz attempt history
- Individual question answer tracking
- Score breakdown by topic and question type
- Progress and accuracy analytics with trends
- Detailed performance metrics and streaks
- Strongest and weakest topic identification
- Recent performance scores visualization

### ⭐ Question Management
- Question favoriting/bookmarking system
- Favorite questions filtering and review
- Question difficulty and topic categorization

### 🔄 Learning Features
- Repeat Mistakes - Review and retake previously incorrect questions
- Attempt types: Normal quizzes and Mistakes Review

## 🧱 Tech Stack

### Backend
- **FastAPI** , **REST API**
- **SQLAlchemy**, **Alembic**
- **Pydantic**
- **JWT**
- **OAuth**: Google, GitHub
- **Groq API**

### Database
- **PostgreSQL**

### Cache
- **Redis**

### Frontend
- **React + TypeScript**
- **Vite**
- **Tailwind CSS**

### Containerization
- **Docker**

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed
- Git 

### Quick Start
```bash
git clone https://github.com/Nefous/study-quiz.git
cd QuizStudy

# Start the application
docker compose up --build
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Development Setup
For development with hot reloading:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables
Copy `.env.example` to `.env` at the repo root and update values.

