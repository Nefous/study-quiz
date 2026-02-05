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
  AttemptCreate,
  AttemptReviewItem,
  AttemptStats,
  QuizQuestion,
  FavoriteQuestion,
  MistakesStats,
  NextQuizRecommendation,
  NextQuizRecommendationGenerated,
  AiReviewResponse,
  LoginRequest,
  TokenResponse,
  User,
  QuestionCandidate,
  QuestionCandidateApproveResponse,
  QuestionCandidatePublishResponse,
  QuestionCandidateRejectResponse,
  QuestionCandidateUpdateResponse,
  QuestionCandidateValidateResponse
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

export async function generateMistakesReview(
  limit = 10
): Promise<QuizGenerateResponse> {
  return request<QuizGenerateResponse>(apiUrl("/quiz/generate"), {
    method: "POST",
    body: JSON.stringify({ attempt_type: "mistakes_review", limit })
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

export async function submitAttempt(
  attemptId: string,
  payload: AttemptCreate
): Promise<AttemptOut> {
  return request<AttemptOut>(apiUrl(`/attempts/${attemptId}/submit`), {
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

export async function getAttemptReview(
  attemptId: string
): Promise<AttemptReviewItem[]> {
  return request<AttemptReviewItem[]>(apiUrl(`/attempts/${attemptId}/review`));
}

export async function getAttemptStats(): Promise<AttemptStats> {
  return request<AttemptStats>(apiUrl("/attempts/stats"));
}

export async function getNextQuizRecommendation(
  force = false
): Promise<NextQuizRecommendation> {
  const query = force ? "?force=true" : "";
  return request<NextQuizRecommendation>(
    apiUrl(`/recommendations/next-quiz${query}`)
  );
}

export async function generateNextQuizRecommendation(
  force = false
): Promise<NextQuizRecommendationGenerated> {
  const query = force ? "?force=true" : "";
  return request<NextQuizRecommendationGenerated>(
    apiUrl(`/recommendations/next-quiz/generate${query}`),
    { method: "POST" }
  );
}

export async function startRecommendation(
  recommendationId: string
): Promise<{ attempt_id: string }> {
  return request<{ attempt_id: string }>(
    apiUrl(`/recommendations/${recommendationId}/start`),
    { method: "POST" }
  );
}

export async function getAttemptAiReview(
  attemptId: string,
  generate = false
): Promise<AiReviewResponse> {
  const query = generate ? "?generate=true" : "";
  return request<AiReviewResponse>(apiUrl(`/attempts/${attemptId}/ai-review${query}`));
}

export async function favoriteQuestion(questionId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(apiUrl(`/questions/${questionId}/favorite`), {
    method: "POST"
  });
}

export async function unfavoriteQuestion(questionId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(apiUrl(`/questions/${questionId}/favorite`), {
    method: "DELETE"
  });
}

export async function listFavoriteQuestions(
  limit = 200,
  offset = 0,
  topic?: string,
  difficulty?: string
): Promise<FavoriteQuestion[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });
  if (topic) params.set("topic", topic);
  if (difficulty) params.set("difficulty", difficulty);
  return request<FavoriteQuestion[]>(apiUrl(`/questions/favorites?${params.toString()}`));
}

export async function getMistakesStats(): Promise<MistakesStats> {
  return request<MistakesStats>(apiUrl("/questions/mistakes/stats"));
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

export async function listQuestionCandidates(
  status?: string,
  limit = 50,
  offset = 0
): Promise<QuestionCandidate[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });
  if (status) {
    params.set("status", status);
  }
  return request<QuestionCandidate[]>(
    apiUrl(`/admin/question-candidates?${params.toString()}`)
  );
}

export async function validateQuestionCandidate(
  candidateId: string
): Promise<QuestionCandidateValidateResponse> {
  return request<QuestionCandidateValidateResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/validate`),
    { method: "POST" }
  );
}

export async function approveQuestionCandidate(
  candidateId: string
): Promise<QuestionCandidateApproveResponse> {
  return request<QuestionCandidateApproveResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/approve`),
    { method: "POST" }
  );
}

export async function rejectQuestionCandidate(
  candidateId: string,
  reason?: string | null
): Promise<QuestionCandidateRejectResponse> {
  return request<QuestionCandidateRejectResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/reject`),
    {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null })
    }
  );
}

export async function publishQuestionCandidate(
  candidateId: string
): Promise<QuestionCandidatePublishResponse> {
  return request<QuestionCandidatePublishResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/publish`),
    { method: "POST" }
  );
}

export async function updateQuestionCandidate(
  candidateId: string,
  payloadJson: Record<string, unknown>
): Promise<QuestionCandidateUpdateResponse> {
  return request<QuestionCandidateUpdateResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}`),
    {
      method: "PATCH",
      body: JSON.stringify({ payload_json: payloadJson })
    }
  );
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
