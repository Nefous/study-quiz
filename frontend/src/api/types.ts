export type Topic = "python_core" | "big_o" | "algorithms" | "data_structures" | "random";
export type Difficulty = "junior" | "middle";
export type QuestionType = "mcq" | "code_output";
export type QuizMode = "practice" | "exam";

export type QuizGenerateRequest = {
  topic: Topic;
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
