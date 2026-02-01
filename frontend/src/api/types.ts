export type Topic = "python_core" | "big_o" | "algorithms" | "data_structures" | "random";
export type Difficulty = "junior" | "middle";
export type QuestionType = "mcq" | "code_output";
export type QuizMode = "practice" | "exam";

export type QuizGenerateRequest = {
  topic?: Topic;
  topics?: Topic[];
  difficulty: Difficulty;
  mode: QuizMode;
  size?: number;
};

export type QuizQuestion = {
  id: string;
  topic: Topic;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  choices?: Record<"A" | "B" | "C" | "D", string> | null;
  explanation?: string | null;
  correct_answer?: string | null;
};

export type QuizGenerateResponse = {
  quiz_id: string;
  questions: QuizQuestion[];
};

export type ApiError = {
  message: string;
  status?: number;
};

export type MetaResponse = {
  topics: Topic[];
  difficulties: Difficulty[];
  modes: QuizMode[];
  defaultQuizSize: number;
  maxQuestionsPerQuiz: number;
};

export type AttemptAnswer = {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
};

export type AttemptCreate = {
  topic: string;
  difficulty: string;
  mode: QuizMode;
  size?: number;
  correct_count: number;
  total_count: number;
  answers: AttemptAnswer[];
  meta?: {
    topics?: Topic[];
  };
  started_at?: string | null;
  finished_at?: string | null;
  time_limit_seconds?: number | null;
  time_spent_seconds?: number | null;
  timed_out?: boolean | null;
};

export type AttemptOut = AttemptCreate & {
  id: string;
  created_at: string;
  score_percent: number;
};

export type AttemptTopicStats = {
  topic: string;
  attempts: number;
  avg_score_percent: number;
};

export type AttemptStats = {
  total_attempts: number;
  avg_score_percent: number;
  best_score_percent: number;
  last_attempt_at: string | null;
  by_topic: AttemptTopicStats[];
};

export type QuizSummary = {
  total: number;
  correct: number;
  percent: number;
  timeUsedSec?: number;
  timeLimitSec?: number;
};

export type AiReviewFocusTopic = {
  topic: string;
  why: string;
  priority: "high" | "medium" | "low";
};

export type AiReviewStudyPlanItem = {
  day: number;
  tasks: string[];
};

export type AiReviewNextQuizSuggestion = {
  topics: string[];
  difficulty: string;
  size: number;
};

export type AiReviewResponse = {
  status?: "ready" | "pending" | "error" | string;
  raw?: string | null;
  summary?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  focus_topics?: AiReviewFocusTopic[];
  study_plan?: AiReviewStudyPlanItem[];
  next_quiz_suggestion?: AiReviewNextQuizSuggestion | null;
  ai_review?: Record<string, unknown> | null;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  user: User;
};
