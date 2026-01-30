import type { ApiError } from "./types";

const ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const V1 = "/api/v1";

const normalizeOrigin = (origin: string) =>
  origin.endsWith(V1) ? origin.slice(0, -V1.length) : origin;

export const apiUrl = (path: string) =>
  `${normalizeOrigin(ORIGIN)}${V1}${path.startsWith("/") ? path : `/${path}`}`;

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler;
}


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
  url: string,
  options?: RequestInit,
  retried = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined)
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    headers,
    credentials: "include",
    ...options
  });

  if (response.status === 401 && !retried && refreshHandler && !url.includes("/auth/")) {
    const newToken = await refreshHandler();
    if (newToken) {
      return request<T>(url, options, true);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    const message = body || response.statusText || "Request failed";
    throw { message, status: response.status } satisfies ApiError;
  }

  return parseJson<T>(response);
}

export async function getHint(
  questionId: string,
  payload: { user_answer?: string; level: number; attempt_id?: string }
): Promise<{ hint: string }> {
  try {
    return await request<{ hint: string }>(
      apiUrl(`/questions/${questionId}/hint`),
      {
      method: "POST",
      body: JSON.stringify(payload)
      }
    );
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
