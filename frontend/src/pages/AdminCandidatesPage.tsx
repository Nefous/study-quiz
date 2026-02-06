import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle
} from "lucide-react";
import type {
  QuestionCandidate,
  QuestionCandidateStatus,
  QuestionCandidateValidationReport
} from "../api/types";
import {
  approveCandidate,
  generateCandidates,
  getQuestionOptions,
  listCandidates,
  publishCandidate,
  rejectCandidate,
  validateCandidate
} from "../api/adminCandidatesApi";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import PageHeader from "../components/ui/PageHeader";
import { cn } from "../components/ui/cn";

const STATUS_OPTIONS: { label: string; value: QuestionCandidateStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Generated", value: "generated" },
  { label: "Validated", value: "validated" },
  { label: "Failed", value: "failed" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Published", value: "published" }
];

const DIFFICULTY_OPTIONS = ["all", "junior", "middle"] as const;
const DEFAULT_TOPIC_OPTIONS = [
  "python_core",
  "big_o",
  "algorithms",
  "data_structures"
];
const DEFAULT_DIFFICULTY_OPTIONS = ["junior", "middle"];
const DEFAULT_TYPE_OPTIONS = ["mcq", "code_output"];

const STATUS_TONES: Record<QuestionCandidateStatus, "neutral" | "success" | "error" | "warning" | "info" | "primary"> = {
  generated: "info",
  validated: "success",
  failed: "error",
  approved: "primary",
  rejected: "warning",
  published: "success"
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const defaultGenerateForm = {
  topic: "",
  difficulty: "junior",
  count: 20,
  qtype: ""
};

const getValidationSummary = (report?: QuestionCandidateValidationReport | null) => {
  if (!report) return [];
  return [
    report.schema ? { label: "Schema", ok: report.schema.ok } : null,
    report.dedupe ? { label: "Dedupe", ok: report.dedupe.ok } : null,
    report.code_output ? { label: "Code", ok: report.code_output.ok } : null
  ].filter((item): item is { label: string; ok: boolean | undefined } => Boolean(item));
};

const pickAnswerLabel = (candidate: QuestionCandidate) => {
  const answer = candidate.payload_json?.answer;
  if (!answer) return "";
  return String(answer);
};

const canApproveCandidate = (status: QuestionCandidateStatus) =>
  status === "generated" || status === "validated";

const canRejectCandidate = (status: QuestionCandidateStatus) =>
  status === "generated" || status === "validated" || status === "approved";

const canPublishCandidate = (status: QuestionCandidateStatus) => status === "approved";

const canValidateCandidate = (status: QuestionCandidateStatus) =>
  status === "generated" || status === "failed";

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

const parsePrompt = (prompt: string) => {
  const match = prompt.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!match) {
    return { before: prompt, code: "", after: "", language: "python" };
  }

  const [block, lang = "python", code] = match;
  const before = prompt.slice(0, match.index ?? 0).trim();
  const after = prompt.slice((match.index ?? 0) + block.length).trim();
  return { before, code, after, language: lang || "python" };
};

export default function AdminCandidatesPage() {
  const [status, setStatus] = useState<QuestionCandidateStatus | "all">("all");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>("all");
  const [appliedStatus, setAppliedStatus] = useState<QuestionCandidateStatus | "all">("all");
  const [appliedTopic, setAppliedTopic] = useState("");
  const [appliedDifficulty, setAppliedDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>(
    "all"
  );
  const [candidates, setCandidates] = useState<QuestionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "error" } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [activeCandidate, setActiveCandidate] = useState<QuestionCandidate | null>(null);
  const [rejectingCandidate, setRejectingCandidate] = useState<QuestionCandidate | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState(defaultGenerateForm);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [questionOptions, setQuestionOptions] = useState<{
    topics: string[];
    difficulties: string[];
    types: string[];
  } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await listCandidates({
          status: appliedStatus,
          limit: pageSize,
          offset: page * pageSize
        });
        if (active) {
          setCandidates(items);
        }
      } catch (err) {
        const message = (err as { message?: string })?.message ?? "Failed to load candidates";
        if (active) {
          setError(message);
          setToast({ message, tone: "error" });
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
  }, [appliedStatus, page, pageSize, listRefreshKey]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      if (!showGenerateModal || optionsLoading || questionOptions) return;
      setOptionsError(null);
      setOptionsLoading(true);
      try {
        const response = await getQuestionOptions();
        if (import.meta.env.MODE === "development") {
          console.debug("question-options", response);
        }
        const normalized = normalizeOptions(response as unknown);
        if (active) {
          setQuestionOptions(normalized);
          if (!normalized.topics.length || !normalized.difficulties.length) {
            setOptionsError("Options are missing from the API response.");
          }
        }
      } catch (err) {
        const message = (err as { message?: string })?.message ?? "Failed to load options";
        if (active) {
          setOptionsError(message);
          setToast({ message, tone: "error" });
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
  }, [showGenerateModal, optionsLoading, questionOptions]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (appliedTopic && candidate.topic !== appliedTopic) return false;
      if (appliedDifficulty !== "all" && candidate.difficulty !== appliedDifficulty) return false;
      return true;
    });
  }, [candidates, appliedTopic, appliedDifficulty]);

  const canGoNext = candidates.length >= pageSize;
  const canGoPrev = page > 0;
  const optionTopics = questionOptions?.topics?.length
    ? questionOptions.topics
    : DEFAULT_TOPIC_OPTIONS;
  const optionDifficulties = questionOptions?.difficulties?.length
    ? questionOptions.difficulties
    : DEFAULT_DIFFICULTY_OPTIONS;
  const optionTypes = questionOptions?.types?.length
    ? questionOptions.types
    : DEFAULT_TYPE_OPTIONS;

  const showToast = (message: string, tone: "info" | "error" = "info") => {
    setToast({ message, tone });
  };

  const handleApplyFilters = () => {
    setAppliedStatus(status);
    setAppliedTopic(topic.trim());
    setAppliedDifficulty(difficulty);
    setPage(0);
    setListRefreshKey((prev) => prev + 1);
  };

  const updateCandidate = (id: string, updates: Partial<QuestionCandidate>) => {
    setCandidates((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    if (activeCandidate?.id === id) {
      setActiveCandidate({ ...activeCandidate, ...updates });
    }
  };

  const handleAction = async (
    candidate: QuestionCandidate,
    action: "approve" | "reject" | "publish" | "validate",
    reason?: string | null
  ) => {
    const id = candidate.id;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    const previous = { ...candidate };

    try {
      if (action === "approve") {
        updateCandidate(id, { status: "approved" });
        const response = await approveCandidate(id);
        updateCandidate(id, {
          status: response.status,
          approved_by_user_id: response.approved_by_user_id,
          approved_at: response.approved_at
        });
        showToast("Candidate approved.");
        return;
      }
      if (action === "reject") {
        updateCandidate(id, { status: "rejected" });
        const response = await rejectCandidate(id, reason);
        updateCandidate(id, {
          status: response.status,
          validation_report_json: response.validation_report
        });
        showToast("Candidate rejected.");
        return;
      }
      if (action === "publish") {
        updateCandidate(id, { status: "published" });
        const response = await publishCandidate(id);
        updateCandidate(id, {
          status: response.candidate.status,
          published_at: response.candidate.published_at
        });
        showToast("Candidate published.");
        return;
      }
      if (action === "validate") {
        const response = await validateCandidate(id);
        updateCandidate(id, {
          status: response.status,
          validation_report_json: response.validation_report
        });
        showToast("Candidate validated.");
      }
    } catch (err) {
      updateCandidate(id, previous);
      const message = (err as { message?: string })?.message ?? "Action failed";
      showToast(message, "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleGenerate = async () => {
    const payload = {
      topic: generateForm.topic.trim() || null,
      difficulty: generateForm.difficulty || null,
      count: generateForm.count,
      qtype: generateForm.qtype.trim() || null
    };
    if (payload.count < 5 || payload.count > 50) {
      showToast("Count must be between 5 and 50.", "error");
      return;
    }
    setActionLoading((prev) => ({ ...prev, generate: true }));
    try {
      await generateCandidates(payload);
      showToast("Generation started.");
      setShowGenerateModal(false);
      setListRefreshKey((prev) => prev + 1);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Generate failed";
      showToast(message, "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, generate: false }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Question Candidates"
        description="Review, approve, and publish AI-generated questions."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            className="gap-2"
          >
            <Plus size={14} />
            Generate
          </Button>
        }
      />

      {toast ? (
        <div className="fixed right-4 top-20 z-50">
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
              toast.tone === "error"
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border-white/10 bg-slate-900/80 text-slate-100"
            )}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</label>
            <select
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              value={status}
              onChange={(event) => setStatus(event.target.value as QuestionCandidateStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Topic</label>
            <input
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              placeholder="python_core"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Difficulty</label>
            <select
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as (typeof DIFFICULTY_OPTIONS)[number])
              }
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All" : option}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={handleApplyFilters}
          >
            <RefreshCw size={14} />
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
            {error ? <span className="text-rose-300">{error}</span> : "Candidates"}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                    No candidates found.
                  </td>
                </tr>
              ) : null}
              {filteredCandidates.map((candidate) => {
                const isBusy = actionLoading[candidate.id];
                const canApprove = canApproveCandidate(candidate.status);
                const canReject = canRejectCandidate(candidate.status);
                const canPublish = canPublishCandidate(candidate.status);
                return (
                  <tr key={candidate.id} className="text-slate-200">
                    <td className="px-4 py-3 font-semibold text-white">{candidate.topic}</td>
                    <td className="px-4 py-3">{candidate.difficulty}</td>
                    <td className="px-4 py-3">{candidate.type}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[candidate.status]}>{candidate.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(candidate.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveCandidate(candidate)}
                          className="gap-2"
                        >
                          <Eye size={14} />
                          View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isBusy || !canApprove}
                          onClick={() => handleAction(candidate, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isBusy || !canReject}
                          onClick={() => setRejectingCandidate(candidate)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isBusy || !canPublish}
                          onClick={() => handleAction(candidate, "publish")}
                        >
                          Publish
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-300">
          <span>
            Page {page + 1}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              className="gap-2"
            >
              <ChevronLeft size={14} />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoNext}
              onClick={() => setPage((prev) => prev + 1)}
              className="gap-2"
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {activeCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Candidate</p>
                <h2 className="text-lg font-semibold text-white">
                  {activeCandidate.topic} · {activeCandidate.difficulty}
                </h2>
              </div>
              <Badge tone={STATUS_TONES[activeCandidate.status]}>{activeCandidate.status}</Badge>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prompt</p>
                {(() => {
                  const { before, code, after, language } = parsePrompt(
                    activeCandidate.payload_json?.prompt ?? ""
                  );
                  return (
                    <div className="mt-2 space-y-3">
                      {before ? <p className="whitespace-pre-wrap">{before}</p> : null}
                      {code ? <CodeBlock code={code} language={language} /> : null}
                      {after ? <p className="whitespace-pre-wrap">{after}</p> : null}
                    </div>
                  );
                })()}
              </div>

              {activeCandidate.payload_json?.type === "mcq" &&
              activeCandidate.payload_json.choices ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Choices</p>
                  {activeCandidate.payload_json.choices.map((choice) => {
                    const answer = pickAnswerLabel(activeCandidate);
                    const isAnswer = answer === choice.key || answer === choice.text;
                    return (
                      <div
                        key={choice.key}
                        className={cn(
                          "rounded-xl border px-3 py-2",
                          isAnswer
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        <span className="font-semibold text-slate-300">{choice.key}.</span>{" "}
                        {choice.text}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {activeCandidate.payload_json?.type === "code_output" ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Code</p>
                  <CodeBlock code={activeCandidate.payload_json.code ?? ""} language="python" />
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs text-slate-200">
                    <p className="mb-2 text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">
                      Expected output
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-sm text-slate-100">
                      {activeCandidate.payload_json.expected_output}
                    </pre>
                  </div>
                </div>
              ) : null}

              {activeCandidate.payload_json?.explanation ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Explanation</p>
                  <p className="mt-2 whitespace-pre-line">
                    {activeCandidate.payload_json.explanation}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Validation</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {getValidationSummary(activeCandidate.validation_report_json).map((step) => (
                    <div key={step.label} className="flex items-center gap-2 text-xs">
                      {step.ok ? (
                        <CheckCircle2 size={14} className="text-emerald-300" />
                      ) : (
                        <XCircle size={14} className="text-rose-300" />
                      )}
                      {step.label}
                    </div>
                  ))}
                  {getValidationSummary(activeCandidate.validation_report_json).length === 0 ? (
                    <span className="text-xs text-slate-400">No validation report.</span>
                  ) : null}
                </div>
                <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200">
                  {JSON.stringify(activeCandidate.validation_report_json, null, 2)}
                </pre>
              </div>

              <details className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-200">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-400">
                  Raw AI output
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-slate-100">
                  {activeCandidate.raw_ai_output ?? "Raw output not available."}
                </pre>
              </details>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(activeCandidate, "validate")}
                  disabled={
                    Boolean(actionLoading[activeCandidate.id]) ||
                    !canValidateCandidate(activeCandidate.status)
                  }
                  className="gap-2"
                >
                  <ShieldCheck size={14} />
                  Validate
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(activeCandidate, "approve")}
                  disabled={
                    Boolean(actionLoading[activeCandidate.id]) ||
                    !canApproveCandidate(activeCandidate.status)
                  }
                  className="gap-2"
                >
                  <ThumbsUp size={14} />
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRejectingCandidate(activeCandidate)}
                  disabled={
                    Boolean(actionLoading[activeCandidate.id]) ||
                    !canRejectCandidate(activeCandidate.status)
                  }
                  className="gap-2"
                >
                  <ThumbsDown size={14} />
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(activeCandidate, "publish")}
                  disabled={
                    Boolean(actionLoading[activeCandidate.id]) ||
                    !canPublishCandidate(activeCandidate.status)
                  }
                  className="gap-2"
                >
                  <CheckCircle2 size={14} />
                  Publish
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveCandidate(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Reject candidate</h2>
            <p className="mt-1 text-sm text-slate-400">Share a brief reason for rejection.</p>
            <textarea
              className="mt-4 h-28 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/60"
              placeholder="Reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRejectingCandidate(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!rejectingCandidate) return;
                  handleAction(rejectingCandidate, "reject", rejectReason.trim() || null);
                  setRejectingCandidate(null);
                  setRejectReason("");
                }}
              >
                Confirm reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showGenerateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Generate candidates</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowGenerateModal(false)}>
                Close
              </Button>
            </div>
            {optionsLoading ? (
              <div className="mt-3 text-xs text-slate-400">Loading options...</div>
            ) : null}
            {optionsError ? (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {optionsError} You can type values manually.
              </div>
            ) : null}
            {optionsError ? (
              <div className="mt-2 text-xs text-amber-200">
                Using fallback options. Please check the meta endpoint.
              </div>
            ) : null}
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Topic</label>
                <select
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
                  value={generateForm.topic}
                  onChange={(event) =>
                    setGenerateForm((prev) => ({ ...prev, topic: event.target.value }))
                  }
                >
                  <option value="">Any topic</option>
                  {optionTopics.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Difficulty
                </label>
                <select
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
                  value={generateForm.difficulty}
                  onChange={(event) =>
                    setGenerateForm((prev) => ({ ...prev, difficulty: event.target.value }))
                  }
                >
                  <option value="">Any difficulty</option>
                  {optionDifficulties.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Count</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
                  value={generateForm.count}
                  onChange={(event) =>
                    setGenerateForm((prev) => ({
                      ...prev,
                      count: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Type (optional)
                </label>
                <select
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100"
                  value={generateForm.qtype}
                  onChange={(event) =>
                    setGenerateForm((prev) => ({ ...prev, qtype: event.target.value }))
                  }
                >
                  <option value="">Any type</option>
                  {optionTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGenerateModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                disabled={Boolean(actionLoading.generate)}
                className="gap-2"
              >
                {actionLoading.generate ? (
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                ) : null}
                Generate
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
