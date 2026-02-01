import type {
  QuizGenerateRequest,
  QuizGenerateResponse,
  MetaResponse,
  Topic,
  Difficulty,
  QuestionType,
  QuizMode,
  AttemptCreate,
  AttemptOut,
  AttemptStats,
  AiReviewResponse,
  LoginRequest,
  TokenResponse,
  User
} from "./types";
import { apiUrl, getHint, request } from "./client";

export async function generateQuiz(
  payload: QuizGenerateRequest
): Promise<QuizGenerateResponse> {
  return request<QuizGenerateResponse>(apiUrl("/quiz/generate"), {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getMeta(): Promise<MetaResponse> {
  return request<MetaResponse>(apiUrl("/meta"));
}

export async function createAttempt(payload: AttemptCreate): Promise<AttemptOut> {
  return request<AttemptOut>(apiUrl("/attempts"), {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listAttempts(limit = 20, offset = 0): Promise<AttemptOut[]> {
  return request<AttemptOut[]>(
    apiUrl(`/attempts?limit=${limit}&offset=${offset}`)
  );
}

export async function getAttempt(attemptId: string): Promise<AttemptOut> {
  return request<AttemptOut>(apiUrl(`/attempts/${attemptId}`));
}

export async function getAttemptStats(): Promise<AttemptStats> {
  return request<AttemptStats>(apiUrl("/attempts/stats"));
}

export async function getAttemptAiReview(
  attemptId: string,
  generate = false
): Promise<AiReviewResponse> {
  const query = generate ? "?generate=true" : "";
  return request<AiReviewResponse>(apiUrl(`/attempts/${attemptId}/ai-review${query}`));
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  return request<TokenResponse>(apiUrl("/auth/login"), {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function register(payload: LoginRequest): Promise<TokenResponse> {
  return request<TokenResponse>(apiUrl("/auth/register"), {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function refresh(): Promise<TokenResponse> {
  return request<TokenResponse>(apiUrl("/auth/refresh"), {
    method: "POST"
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(apiUrl("/auth/logout"), {
    method: "POST"
  });
}

export async function me(): Promise<User> {
  return request<User>(apiUrl("/auth/me"));
}

export { getHint };

export const topics: { label: string; value: Topic }[] = [
  { label: "Python Core", value: "python_core" },
  { label: "Big O", value: "big_o" },
  { label: "Algorithms", value: "algorithms" },
  { label: "Data Structures", value: "data_structures" },
  { label: "Random", value: "random" }
];

export const difficulties: { label: string; value: Difficulty }[] = [
  { label: "Junior", value: "junior" },
  { label: "Middle", value: "middle" }
];

export const modes: { label: string; value: QuizMode }[] = [
  { label: "Practice (show answers)", value: "practice" },
  { label: "Exam (no answers)", value: "exam" }
];

export const topicLabels: Record<Topic, string> = {
  python_core: "Python Core",
  big_o: "Big O Notation",
  algorithms: "Algorithms",
  data_structures: "Data Structures",
  random: "Random"
};

export const difficultyLabels: Record<Difficulty, string> = {
  junior: "Junior",
  middle: "Middle"
};

export const modeLabels: Record<QuizMode, string> = {
  practice: "Practice",
  exam: "Exam"
};

export const questionTypes: { label: string; value: QuestionType }[] = [
  { label: "MCQ", value: "mcq" },
  { label: "Code Output", value: "code_output" }
];
