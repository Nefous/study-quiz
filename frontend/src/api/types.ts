export type Topic = "python_core" | "big_o" | "algorithms" | "data_structures" | "random";
export type Difficulty = "junior" | "middle";
export type QuestionType = "mcq" | "code_output";
export type QuizMode = "practice" | "exam";
export type AttemptType = "normal" | "mistakes_review";

export type QuizGenerateRequest = {
  topic?: Topic;
  topics?: Topic[];
  difficulty: Difficulty;
  mode: QuizMode;
  attempt_type?: AttemptType;
  size?: number;
};

export type QuizQuestion = {
  id: string;
  topic: Topic;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  code?: string | null;
  choices?: Record<"A" | "B" | "C" | "D", string> | null;
  explanation?: string | null;
  correct_answer?: string | null;
};

export type FavoriteQuestion = QuizQuestion & {
  correct_answer_text?: string | null;
};

export type QuizGenerateResponse = {
  quiz_id: string;
  questions: QuizQuestion[];
  attempt_id?: string | null;
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
  selected_answer: string;
  is_correct: boolean;
};

export type AttemptCreate = {
  attempt_id?: string | null;
  topic: string;
  difficulty: string;
  mode: QuizMode;
  attempt_type?: AttemptType;
  size?: number;
  correct_count: number;
  total_count: number;
  answers: AttemptAnswer[];
  meta?: {
    topics?: Topic[];
  };
  started_at?: string | null;
  finished_at?: string | null;
  submitted_at?: string | null;
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

export type AttemptRecentScore = {
  score_percent: number;
  created_at: string;
  mode?: QuizMode | string;
};

export type AttemptReviewItem = {
  question_id: string;
  prompt: string;
  code?: string | null;
  choices?: Record<string, string> | null;
  correct_answer?: string | null;
  correct_answer_text?: string | null;
  user_answer?: string | null;
  is_correct: boolean;
  explanation?: string | null;
};

export type AttemptStats = {
  total_attempts: number;
  avg_score_percent: number;
  best_score_percent: number;
  last_attempt_at: string | null;
  by_topic: AttemptTopicStats[];
  current_streak_days?: number;
  strongest_topic?: string | null;
  weakest_topic?: string | null;
  recent_scores?: number[];
  recent_attempts?: AttemptRecentScore[];
};

export type MistakesStats = {
  total_wrong: number;
  unique_wrong_questions: number;
  last_30_days_wrong: number;
  last_30_days_unique: number;
};

export type QuizSummary = {
  total: number;
  correct: number;
  percent: number;
  timeUsedSec?: number;
  timeLimitSec?: number;
};

export type NextQuizRecommendation = {
  id?: string | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
  size?: number | null;
  based_on?: string | null;
  reason?: string | null;
  prep?: string[] | null;
};

export type NextQuizRecommendationGenerated = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  size: number;
  based_on: string;
  reason: string;
  prep: string[];
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

export type AiReviewTopMistake = {
  question_ref: string;
  your_answer: string;
  correct_answer: string;
  why: string;
};

export type AiReviewNextQuiz = {
  topic: string;
  difficulty: string;
  size: number;
};

export type AiReviewResponse = {
  status?: "ready" | "not_generated" | "error" | string;
  raw?: string | null;
  headline?: string | null;
  score_line?: string | null;
  top_mistakes?: AiReviewTopMistake[];
  summary?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  micro_drills?: string[];
  focus_topics?: AiReviewFocusTopic[];
  study_plan?: AiReviewStudyPlanItem[];
  next_quiz_suggestion?: AiReviewNextQuizSuggestion | null;
  next_quiz?: AiReviewNextQuiz | null;
  ai_review?: Record<string, unknown> | null;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
  first_name?: string | null;
  is_admin?: boolean;
  role?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  user: User;
};

export type QuestionCandidateStatus =
  | "generated"
  | "validated"
  | "failed"
  | "approved"
  | "rejected"
  | "published";

export type QuestionCandidatePayload = {
  topic: string;
  difficulty: string;
  type: QuestionType | string;
  prompt: string;
  explanation?: string | null;
  choices?: { key: string; text: string }[] | null;
  answer?: string | null;
  code?: string | null;
  expected_output?: string | null;
};

export type QuestionCandidateValidationReport = {
  schema?: { ok: boolean; errors?: string[] };
  dedupe?: {
    ok: boolean;
    reason?: string;
    candidate_id?: string;
    question_id?: string;
  };
  code_output?: {
    ok?: boolean;
    timeout?: boolean;
    exit_code?: number | null;
    stdout?: string;
    stderr?: string;
  };
  error?: string;
};

export type QuestionCandidate = {
  id: string;
  topic: string;
  difficulty: string;
  type: QuestionType | string;
  status: QuestionCandidateStatus;
  created_at: string;
  updated_at?: string | null;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  published_at?: string | null;
  payload_json?: QuestionCandidatePayload | null;
  validation_report_json?: QuestionCandidateValidationReport | null;
  raw_ai_output?: string | null;
};

export type QuestionCandidateValidateResponse = {
  id: string;
  status: QuestionCandidateStatus;
  validation_report?: QuestionCandidateValidationReport | null;
  simhash?: string | null;
};

export type QuestionCandidateApproveResponse = {
  id: string;
  status: QuestionCandidateStatus;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
};

export type QuestionCandidateRejectResponse = {
  id: string;
  status: QuestionCandidateStatus;
  validation_report?: QuestionCandidateValidationReport | null;
};

export type QuestionCandidatePublishResponse = {
  candidate: {
    id: string;
    status: QuestionCandidateStatus;
    published_at?: string | null;
  };
  created_question_id?: string | null;
};

export type QuestionCandidateUpdateResponse = {
  id: string;
  status: QuestionCandidateStatus;
};

export type QuestionOptionsResponse = {
  topics: string[];
  difficulties: string[];
  types: string[];
};
