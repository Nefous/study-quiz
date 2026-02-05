import type {
  QuestionCandidate,
  QuestionCandidateApproveResponse,
  QuestionCandidatePublishResponse,
  QuestionCandidateRejectResponse,
  QuestionCandidateUpdateResponse,
  QuestionCandidateValidateResponse,
  QuestionCandidateStatus,
  MetaResponse,
  QuestionOptionsResponse,
  User
} from "./types";
import { apiUrl, request } from "./client";

export type AdminCandidateFilters = {
  status?: QuestionCandidateStatus | "all";
  limit?: number;
  offset?: number;
};

export type GenerateCandidatesRequest = {
  topic?: string | null;
  difficulty: string;
  count: number;
  qtype?: string | null;
};

export type AdminUser = User & {
  is_admin?: boolean;
  role?: string | null;
};

export async function getAdminUser(): Promise<AdminUser> {
  return request<AdminUser>(apiUrl("/auth/me"));
}

export async function listCandidates(
  filters: AdminCandidateFilters = {}
): Promise<QuestionCandidate[]> {
  const params = new URLSearchParams();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  return request<QuestionCandidate[]>(
    apiUrl(`/admin/question-candidates?${params.toString()}`)
  );
}

export async function getQuestionOptions(): Promise<QuestionOptionsResponse> {
  try {
    return await request<QuestionOptionsResponse>(apiUrl("/meta/question-options"));
  } catch {
    const meta = await request<MetaResponse>(apiUrl("/meta"));
    return {
      topics: meta.topics ?? [],
      difficulties: meta.difficulties ?? [],
      types: ["mcq", "code_output"]
    };
  }
}

export async function generateCandidates(
  body: GenerateCandidatesRequest
): Promise<{ created: number; failed: number; candidate_ids: string[] }> {
  return request<{ created: number; failed: number; candidate_ids: string[] }>(
    apiUrl("/admin/question-candidates/generate"),
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export async function validateCandidate(
  candidateId: string
): Promise<QuestionCandidateValidateResponse> {
  return request<QuestionCandidateValidateResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/validate`),
    { method: "POST" }
  );
}

export async function approveCandidate(
  candidateId: string
): Promise<QuestionCandidateApproveResponse> {
  return request<QuestionCandidateApproveResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/approve`),
    { method: "POST" }
  );
}

export async function rejectCandidate(
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

export async function publishCandidate(
  candidateId: string
): Promise<QuestionCandidatePublishResponse> {
  return request<QuestionCandidatePublishResponse>(
    apiUrl(`/admin/question-candidates/${candidateId}/publish`),
    { method: "POST" }
  );
}

export async function updateCandidate(
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

export async function getCandidate(
  candidateId: string,
  status?: QuestionCandidateStatus | "all"
): Promise<QuestionCandidate | null> {
  const items = await listCandidates({ status, limit: 200, offset: 0 });
  return items.find((item) => item.id === candidateId) ?? null;
}
