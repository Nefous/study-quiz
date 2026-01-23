import type { QuizQuestion } from "../types";

export default function QuestionCard({
  question,
  index,
  value,
  onChange
}: {
  question: QuizQuestion;
  index: number;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Question {index + 1}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">
          {question.type === "mcq" ? "MCQ" : "Code output"}
        </span>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-slate-900">{question.prompt}</div>

      {question.type === "mcq" && question.choices ? (
        <div className="mt-4 grid gap-2">
          {Object.entries(question.choices).map(([key, option]) => (
            <label key={key} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={key}
                checked={value === key}
                onChange={() => onChange(key)}
              />
              <span className="text-sm text-slate-800">
                <strong className="mr-2">{key}.</strong>
                {option}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type expected output"
          className="mt-4 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
          rows={3}
        />
      )}
    </div>
  );
}
