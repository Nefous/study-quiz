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
