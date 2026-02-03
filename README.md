# QuizStudy

QuizStudy is a full-stack web application for Python interview preparation.  
It allows users to take quizzes on key topics such as **Python Core**, **Big O notation**, **Algorithms**, and **Data Structures**, with progress tracking, and detailed performance analytics enhanced with AI-powered hints and AI-driven review feedback.

<p align="center" >
    <img src="frontend/src/assets/logo.png" alt="QuizStudy Logo" width="120" />
</p>

## ✨ Features

### 📝 Quiz Modes

- **Practice Mode** - instant feedback after each question
- **Exam Mode** - timed quizzes with no feedback until completion

### 📚 Topics

- Python Core (syntax, data types, idioms)
- Big O Notation (time & space complexity analysis)
- Algorithms (sorting, searching, patterns)
- Data Structures (lists, stacks, queues, trees)
- **Random Mix** - for diverse and well-rounded practice

### ❓ Question Types
- **MCQ** (multiple-choice questions)
- **Code Output** questions (determine the result of Python code)

### 🤖 AI-Powered Features
- **Intelligent Contextual Hints** powered by Groq API
  - Penalty-based system for strategic learning
  - Multiple hint levels: subtle guidance to explicit help
- **AI Review** at the end of each quiz with personalized feedback
- **AI Coach** - personalized next quiz recommendations based on performance history
- **Next Quiz Recommendation Chain** for adaptive learning paths

### 🔐 Authentication & Security
- Email / Password authentication
- OAuth providers: Google, GitHub
- JWT-based secure authorization with refresh tokens
- Secure password hashing

### 📊 Performance Tracking & Analytics
- Comprehensive quiz attempt history
- Score breakdown by topic and question type
- Progress and accuracy analytics
- Detailed performance metrics and trends

### 👤 User Management
- Account management and profile customization
- Personal progress statistics
- Profile creation date tracking
- OAuth account linking

### 🛠️ Additional Features
- Responsive design for mobile and desktop
- Real-time quiz progress
- Session-based quiz setup persistence
- Docker containerization for easy deployment

## 🧱 Tech Stack

### Backend
- **FastAPI** - High-performance async web framework
- **SQLAlchemy** - ORM for database interactions
- **Alembic** - Database migration tool
- **Pydantic** - Data validation and serialization
- **JWT** - JSON Web Tokens for authentication
- **OAuth2** - Social login integration (Google, GitHub)
- **Groq API** - AI-powered hints and recommendations

### Database
- **PostgreSQL** - Robust relational database

### Frontend
- **React + TypeScript** - Modern UI framework with type safety
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library

### DevOps & Deployment
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Web server for frontend serving

### Development Tools
- **ESLint** - Code linting for JavaScript/TypeScript
- **Prettier** - Code formatting
- **PostCSS** - CSS processing
- **Makefile** - Build automation scripts

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

## 📁 Project Structure
```
QuizStudy/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Configuration and utilities
│   │   ├── models/         # SQLAlchemy models
│   │   ├── repositories/   # Data access layer
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── integrations/   # AI integrations
│   ├── alembic/            # Database migrations
│   └── tests/              # Backend tests
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── api/            # API client
│   │   └── context/        # React context
│   └── nginx/              # Nginx configuration
├── docker-compose.yml       # Docker orchestration
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies for efficient learning
- AI-powered features enhance the learning experience
- Open-source community for inspiration and tools