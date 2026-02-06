import { useEffect, useMemo, useState } from "react";

import AdminNav from "../components/admin/AdminNav";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { cn } from "../components/ui/cn";
import { getQuestionOptions } from "../api/adminCandidatesApi";
import type {
  AdminQuestionDetail,
  AdminQuestionListItem,
  QuestionType
} from "../api/types";
import {
  archiveAdminQuestion,
  getAdminQuestion,
  listAdminQuestions
} from "../api/adminQuestionsApi";

const DEFAULT_TOPIC_OPTIONS = [
  "python_core",
  "big_o",
  "algorithms",
  "data_structures"
];
const DEFAULT_DIFFICULTY_OPTIONS = ["junior", "middle"];
const DEFAULT_TYPE_OPTIONS: QuestionType[] = ["mcq", "code_output"];

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const normalizeOptions = (raw: unknown) => {
  const payload =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as { data?: unknown }).data
      : raw;
  const record = (payload ?? {}) as Record<string, unknown>;
  const topics =
    (record.topics as string[] | undefined) ??
    (record.topic_options as string[] | undefined) ??
    [];
  const difficulties =
    (record.difficulties as string[] | undefined) ??
    (record.difficulty_options as string[] | undefined) ??
    [];
  const types =
    (record.types as string[] | undefined) ??
    (record.type_options as string[] | undefined) ??
    [];
  return {
    topics: Array.isArray(topics) ? topics : [],
    difficulties: Array.isArray(difficulties) ? difficulties : [],
    types: Array.isArray(types) ? types : []
  };
};

const isCodeLike = (value: string) => {
  if (!value || !value.includes("\n")) return false;
  return value.split("\n").some((line) => /^\s{2,}\S/.test(line) || /^\t+\S/.test(line));
};

const formatPromptPreview = (value: string) => {
  return value.replace(/\s+/g, " ").trim().slice(0, 120) || "—";
};

export default function AdminQuestionsPage() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [qtype, setQtype] = useState("all");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [appliedTopic, setAppliedTopic] = useState("");
  const [appliedDifficulty, setAppliedDifficulty] = useState("all");
  const [appliedType, setAppliedType] = useState("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedIncludeArchived, setAppliedIncludeArchived] = useState(false);
  const [questions, setQuestions] = useState<AdminQuestionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [activeQuestion, setActiveQuestion] = useState<AdminQuestionDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminQuestionListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [questionOptions, setQuestionOptions] = useState<{
    topics: string[];
    difficulties: string[];
    types: string[];
  } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listAdminQuestions({
          topic: appliedTopic || undefined,
          difficulty: appliedDifficulty !== "all" ? appliedDifficulty : undefined,
          type: appliedType !== "all" ? appliedType : undefined,
          q: appliedQuery || undefined,
          include_archived: appliedIncludeArchived,
          limit: pageSize,
          offset: page * pageSize
        });
        if (active) {
          setQuestions(response.items);
          setTotal(response.total);
        }
      } catch (err) {
        const message = (err as { message?: string })?.message ?? "Failed to load questions";
        if (active) {
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [
    appliedTopic,
    appliedDifficulty,
    appliedType,
    appliedQuery,
    appliedIncludeArchived,
    page,
    pageSize
  ]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      if (optionsLoading || questionOptions) return;
      setOptionsLoading(true);
      try {
        const response = await getQuestionOptions();
        if (active) {
          setQuestionOptions(normalizeOptions(response));
        }
      } catch {
        if (active) {
          setQuestionOptions({
            topics: DEFAULT_TOPIC_OPTIONS,
            difficulties: DEFAULT_DIFFICULTY_OPTIONS,
            types: DEFAULT_TYPE_OPTIONS
          });
        }
      } finally {
        if (active) {
          setOptionsLoading(false);
        }
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [optionsLoading, questionOptions]);

  const optionTopics = questionOptions?.topics?.length
    ? questionOptions.topics
    : DEFAULT_TOPIC_OPTIONS;
  const optionDifficulties = questionOptions?.difficulties?.length
    ? questionOptions.difficulties
    : DEFAULT_DIFFICULTY_OPTIONS;
  const optionTypes = questionOptions?.types?.length
    ? questionOptions.types
    : DEFAULT_TYPE_OPTIONS;

  const canGoNext = (page + 1) * pageSize < total;
  const canGoPrev = page > 0;

  const handleApplyFilters = () => {
    setAppliedTopic(topic.trim());
    setAppliedDifficulty(difficulty);
    setAppliedType(qtype);
    setAppliedQuery(query.trim());
    setAppliedIncludeArchived(includeArchived);
    setPage(0);
  };

  const handleDetails = async (item: AdminQuestionListItem) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const detail = await getAdminQuestion(item.id);
      setActiveQuestion(detail);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Failed to load question";
      setDetailsError(message);
      setActiveQuestion(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleArchive = async (item: AdminQuestionListItem) => {
    setActionLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      await archiveAdminQuestion(item.id);
      setArchiveTarget(null);
      setPage(0);
      const response = await listAdminQuestions({
        topic: appliedTopic || undefined,
        difficulty: appliedDifficulty !== "all" ? appliedDifficulty : undefined,
        type: appliedType !== "all" ? appliedType : undefined,
        q: appliedQuery || undefined,
        include_archived: appliedIncludeArchived,
        limit: pageSize,
        offset: 0
      });
      setQuestions(response.items);
      setTotal(response.total);
      setActiveQuestion(null);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Archive failed";
      setError(message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const renderPrompt = (question: AdminQuestionDetail) => {
    const prompt = question.prompt ?? "";
    const code = question.code?.trim() ?? "";

    if (code) {
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-slate-200">{prompt}</p>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-100">
            <code className="font-mono">{code}</code>
          </pre>
        </div>
      );
    }

    if (isCodeLike(prompt)) {
      return (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-100">
          <code className="font-mono">{prompt}</code>
        </pre>
      );
    }

    return <p className="whitespace-pre-wrap text-sm text-slate-200">{prompt}</p>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        description="Browse, inspect, and archive published questions."
      />
      <AdminNav />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Topic</label>
            <select
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option value="">All topics</option>
              {optionTopics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Difficulty</label>
            <select
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="all">All</option>
              {optionDifficulties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Type</label>
            <select
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              value={qtype}
              onChange={(event) => setQtype(event.target.value)}
            >
              <option value="all">All</option>
              {optionTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search</label>
            <input
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              placeholder="Search prompt text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Archive</label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/10 bg-slate-950/70"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              Include archived
            </label>
          </div>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleApplyFilters}>
            Apply
          </Button>
        </div>
      </Card>

      <Card className="space-y-4" padding="none">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
            ) : null}
            {error ? <span className="text-rose-300">{error}</span> : "Questions"}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Total: {total}</span>
            <span>Rows:</span>
            <select
              className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {questions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                    No questions found.
                  </td>
                </tr>
              ) : null}
              {questions.map((question) => (
                <tr key={question.id} className="text-slate-200">
                  <td className="px-4 py-3 font-semibold text-white">{question.topic}</td>
                  <td className="px-4 py-3">{question.difficulty}</td>
                  <td className="px-4 py-3">
                    <Badge tone={question.type === "mcq" ? "info" : "primary"}>
                      {question.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {formatPromptPreview(question.prompt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDateTime(question.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDetails(question)}
                      >
                        Details
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={Boolean(actionLoading[question.id]) || Boolean(question.archived_at)}
                        onClick={() => setArchiveTarget(question)}
                      >
                        {question.archived_at ? "Archived" : "Archive"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-300">
          <span>Page {page + 1}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoNext}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {detailsLoading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Loading question...
        </div>
      ) : null}

      {detailsError ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {detailsError}
        </div>
      ) : null}

      {activeQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Question</p>
                <h2 className="text-lg font-semibold text-white">
                  {activeQuestion.topic} · {activeQuestion.difficulty}
                </h2>
              </div>
              <Badge tone={activeQuestion.type === "mcq" ? "info" : "primary"}>
                {activeQuestion.type}
              </Badge>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prompt</p>
                <div className="mt-2">{renderPrompt(activeQuestion)}</div>
              </div>

              {activeQuestion.type === "mcq" && activeQuestion.choices ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Choices</p>
                  {Object.entries(activeQuestion.choices).map(([key, value]) => (
                    <div
                      key={key}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm",
                        key === activeQuestion.correct_answer
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-white/5 text-slate-200"
                      )}
                    >
                      <span className="font-semibold text-slate-300">{key}.</span> {value}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Answer</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">
                    {activeQuestion.correct_answer ?? "—"}
                  </p>
                </div>
              )}

              {activeQuestion.explanation ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Explanation</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                    {activeQuestion.explanation}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2 text-xs text-slate-400">
                <span>Created: {formatDateTime(activeQuestion.created_at)}</span>
                <span>Updated: {formatDateTime(activeQuestion.updated_at)}</span>
                <span>
                  Archived: {activeQuestion.archived_at ? formatDateTime(activeQuestion.archived_at) : "No"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(actionLoading[activeQuestion.id]) || Boolean(activeQuestion.archived_at)}
                  onClick={() => setArchiveTarget(activeQuestion as AdminQuestionListItem)}
                >
                  {activeQuestion.archived_at ? "Archived" : "Archive"}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveQuestion(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Archive question?</h2>
            <p className="mt-1 text-sm text-slate-400">
              The question will be hidden from the admin list by default.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleArchive(archiveTarget)}
                disabled={Boolean(actionLoading[archiveTarget.id])}
              >
                Confirm archive
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
