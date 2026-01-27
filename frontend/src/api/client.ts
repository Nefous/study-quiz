import type { ApiError } from "./types";

const baseURL = import.meta.env.VITE_API_URL || "/api";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw { message: "Invalid JSON response", status: response.status } satisfies ApiError;
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.text();
    const message = body || response.statusText || "Request failed";
    throw { message, status: response.status } satisfies ApiError;
  }

  return parseJson<T>(response);
}

export async function getHint(
  questionId: string,
  payload: { user_answer?: string; level: number }
): Promise<{ hint: string }> {
  try {
    return await request<{ hint: string }>(`/questions/${questionId}/hint`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError?.status === 503) {
      throw {
        message: "AI hints are unavailable right now. Please try again later.",
        status: 503
      } satisfies ApiError;
    }
    throw error;
  }
}
