# QuizStudy

QuizStudy is a full-stack web application for Python interview preparation.  
It allows users to take quizzes on key topics such as **Python Core**, **Big O notation**, **Algorithms**, and **Data Structures**,  progress tracking, and detailed performance analytics enhanced with AI-powered hints and AI-driven review feedback.

<img src="frontend/src/assets/logo.png" alt="QuizStudy Logo" width="120" />


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

### 🤖 AI-Powered 
- Intelligent contextual hints powered by the Groq API
- Penalty-based system
- Multiple hint levels, from subtle guidance to more explicit help
- Ai Review in the end of quiz

### 🔐 Authentication
- Email / Password
- OAuth providers: Google, GitHub
- JWT-based secure authorization

### 📊 Performance Tracking
- Quiz attempt history
- Score breakdown by topic and question type
- Progress and accuracy analytics

### 👤 User Profiles
- Account management
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
```bash
docker compose up --build
```