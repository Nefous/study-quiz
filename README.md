# QuizStudy

QuizStudy is a full-stack web application for Python interview preparation.  
It allows users to take quizzes on key topics such as **Python Core**, **Big O notation**, **Algorithms**, and **Data Structures**,  progress tracking, and detailed performance analytics enhanced with AI-powered hints and AI-driven review feedback.

<p align="center" >
    <img src="frontend/src/assets/logo.png" alt="QuizStudy Logo" width="120" />
</p>

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
- **Intelligent Contextual Hints** powered by Groq API
  - Penalty-based system for strategic learning
  - Multiple hint levels: subtle guidance to explicit help
- **AI Review** at the end of each quiz with personalized feedback
- **AI Coach** - personalized next quiz recommendations based on performance history
- **Next Quiz Recommendation Chain** for adaptive learning paths

### 🔐 Authentication
- Email / Password
- OAuth providers: Google, GitHub
- JWT-based secure authorization

### 📊 Performance Tracking
- Quiz attempt history
- Score breakdown by topic and question type
- Progress and accuracy analytics
- Detailed performance metrics and trends

### 👤 User Management
- Personal progress statistics
- Profile creation date tracking

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

### Frontend
- **React + TypeScript**
- **Vite**
- **Tailwind CSS**
### Containerization
- **Docker**
- **Docker Compose**

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed
- Git (optional, for cloning)

### Quick Start
```bash
# Clone the repository (if not already)
git clone <repository-url>
cd QuizStudy

# Start the application
docker compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
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
Create a `.env` file in the backend directory with:
```
DATABASE_URL=postgresql://user:password@localhost/quizstudy
SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GITHUB_CLIENT_ID=your-github-client-id
```
