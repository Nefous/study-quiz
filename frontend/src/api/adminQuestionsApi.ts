import type {
  AdminQuestionDetail,
  AdminQuestionListResponse,
  QuestionType
} from "./types";
import { apiUrl, request } from "./client";

export type AdminQuestionsFilters = {
  topic?: string;
  difficulty?: string;
  type?: QuestionType | string;
  q?: string;
  include_archived?: boolean;
  limit?: number;
  offset?: number;
};

export async function listAdminQuestions(
  filters: AdminQuestionsFilters = {}
): Promise<AdminQuestionListResponse> {
  const params = new URLSearchParams();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.type) params.set("type", String(filters.type));
  if (filters.q) params.set("q", filters.q);
  if (filters.include_archived) params.set("include_archived", "true");
  return request<AdminQuestionListResponse>(apiUrl(`/admin/questions?${params.toString()}`));
}

export async function getAdminQuestion(
  questionId: string
): Promise<AdminQuestionDetail> {
  return request<AdminQuestionDetail>(apiUrl(`/admin/questions/${questionId}`));
}

export async function archiveAdminQuestion(
  questionId: string
): Promise<AdminQuestionDetail> {
  return request<AdminQuestionDetail>(apiUrl(`/admin/questions/${questionId}/archive`), {
    method: "POST"
  });
}
