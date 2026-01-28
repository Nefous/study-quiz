type TopicKey =
  | "python_core"
  | "big_o"
  | "algorithms"
  | "data_structures"
  | "random"
  | "mix"
  | string;

const TOPIC_LABELS: Record<string, string> = {
  python_core: "Python Core",
  big_o: "Big O",
  algorithms: "Algorithms",
  data_structures: "Data Structures",
  random: "Random",
  mix: "Mix"
};

const TOPIC_BADGE_CLASSES: Record<string, string> = {
  python_core: "bg-amber-400/10 text-amber-200 border border-amber-400/20",
  big_o: "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20",
  algorithms: "bg-sky-400/10 text-sky-200 border border-sky-400/20",
  data_structures: "bg-violet-400/10 text-violet-200 border border-violet-400/20",
  random: "bg-slate-400/10 text-slate-200 border border-slate-400/20",
  mix: "bg-slate-400/10 text-slate-200 border border-slate-400/20"
};

export function topicLabel(topic: TopicKey) {
  return TOPIC_LABELS[topic] ?? topic;
}

export function topicBadgeClass(topic: TopicKey) {
  return (
    TOPIC_BADGE_CLASSES[topic] ??
    "bg-slate-400/10 text-slate-200 border border-slate-400/20"
  );
}
