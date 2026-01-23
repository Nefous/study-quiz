import type {
  QuizGenerateRequest,
  QuizGenerateResponse,
  MetaResponse,
  Topic,
  Difficulty,
  QuestionType,
  QuizMode
} from "./types";
import { request } from "./client";

export async function generateQuiz(
  payload: QuizGenerateRequest
): Promise<QuizGenerateResponse> {
  return request<QuizGenerateResponse>("/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getMeta(): Promise<MetaResponse> {
  return request<MetaResponse>("/meta");
}

export const topics: { label: string; value: Topic }[] = [
  { label: "Python Core", value: "python_core" },
  { label: "Big O", value: "big_o" },
  { label: "Algorithms", value: "algorithms" },
  { label: "Data Structures", value: "data_structures" }
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
  data_structures: "Data Structures"
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
