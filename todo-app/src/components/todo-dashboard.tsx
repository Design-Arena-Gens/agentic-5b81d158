"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { BoltIcon, CalendarIcon, ChartBarIcon, PlusIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { format, isBefore, isToday, parseISO } from "date-fns";

type Status = "backlog" | "in-progress" | "review" | "done";
type Priority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: string;
  tags: string[];
  createdAt: string;
};

type Filters = {
  query: string;
  status: "all" | Status;
  priority: "all" | Priority;
  horizon: "all" | "today" | "overdue";
};

const STATUS_META: Record<
  Status,
  { label: string; accent: string; bg: string; dot: string; description: string }
> = {
  backlog: {
    label: "Backlog",
    accent: "text-sky-500",
    bg: "bg-sky-50",
    dot: "bg-sky-500",
    description: "Ideas and upcoming work waiting to be scheduled.",
  },
  "in-progress": {
    label: "In Progress",
    accent: "text-amber-500",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
    description: "Active tasks moving toward completion.",
  },
  review: {
    label: "Review",
    accent: "text-purple-500",
    bg: "bg-purple-50",
    dot: "bg-purple-500",
    description: "Work ready for validation or sign-off.",
  },
  done: {
    label: "Done",
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    description: "Completed tasks tracked for reference.",
  },
};

const PRIORITY_META: Record<Priority, { label: string; chip: string }> = {
  high: { label: "High", chip: "bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20" },
  medium: { label: "Medium", chip: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20" },
  low: { label: "Low", chip: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20" },
};

const DEFAULT_TASKS: Task[] = [
  {
    id: "1",
    title: "Kick-off strategy workshop",
    description: "Align the team on quarterly goals and investment priorities.",
    status: "backlog",
    priority: "high",
    dueDate: new Date().toISOString().slice(0, 10),
    tags: ["Planning", "Leadership"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Refine onboarding sequence",
    description: "Audit the product onboarding flow and suggest quick wins.",
    status: "in-progress",
    priority: "medium",
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tags: ["Lifecycle", "Growth"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Ship analytics dashboard v1",
    description: "Finalize QA checklist and deploy the first analytics release.",
    status: "review",
    priority: "high",
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tags: ["Product", "Delivery"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Publish Q1 investor update",
    description: "Summarize performance, roadmap progress, and key learnings.",
    status: "done",
    priority: "low",
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tags: ["Finance"],
    createdAt: new Date().toISOString(),
  },
];

function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    const stored = window.localStorage.getItem(key);
    if (!stored) return initialValue;

    try {
      return JSON.parse(stored) as T;
    } catch (error) {
      console.error("Failed to parse stored state", error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

function nextStatus(status: Status): Status {
  const order: Status[] = ["backlog", "in-progress", "review", "done"];
  const idx = order.indexOf(status);
  return order[Math.min(order.length - 1, idx + 1)];
}

function previousStatus(status: Status): Status {
  const order: Status[] = ["backlog", "in-progress", "review", "done"];
  const idx = order.indexOf(status);
  return order[Math.max(0, idx - 1)];
}

export default function TodoDashboard() {
  const [tasks, setTasks] = usePersistentState<Task[]>("agentic.todo.tasks.v1", DEFAULT_TASKS);
  const [filters, setFilters] = useState<Filters>({
    query: "",
    status: "all",
    priority: "all",
    horizon: "all",
  });
  const [draft, setDraft] = useState<Partial<Task>>({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    status: "backlog",
    tags: [],
  });
  const [draftTags, setDraftTags] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.query) {
        const query = filters.query.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query) &&
          !task.tags.some((tag) => tag.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      if (filters.status !== "all" && task.status !== filters.status) return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;

      if (filters.horizon !== "all" && task.dueDate) {
        const due = parseISO(task.dueDate);
        if (filters.horizon === "today" && !isToday(due)) return false;
        if (filters.horizon === "overdue" && !isBefore(due, new Date())) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  const stats = useMemo(() => {
    const totals = tasks.length;
    const done = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter((task) => {
      if (!task.dueDate) return false;
      return isBefore(parseISO(task.dueDate), new Date()) && task.status !== "done";
    }).length;

    const flow = tasks
      .filter((task) => task.status === "done")
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
      .slice(-3);

    const focus =
      tasks.find((task) => task.status === "in-progress") ??
      tasks.find((task) => task.status === "backlog");

    return {
      totals,
      done,
      overdue,
      health: totals === 0 ? 0 : Math.round((done / totals) * 100),
      flow,
      focus,
    };
  }, [tasks]);

  function handleAddTask() {
    if (!draft.title?.trim()) return;

    const tagList =
      draftTags.trim().length > 0
        ? draftTags
            .split(",")
            .map((token) => token.trim())
            .filter(Boolean)
        : draft.title
            .split(" ")
            .slice(0, 2)
            .map((token) => token.replace(/[^a-zA-Z0-9]/g, ""))
            .filter(Boolean);

    const task: Task = {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      description: draft.description?.trim(),
      priority: (draft.priority as Priority) ?? "medium",
      status: (draft.status as Status) ?? "backlog",
      dueDate: draft.dueDate || undefined,
      tags: tagList,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [task, ...prev]);
    setDraft({
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
      status: "backlog",
      tags: [],
    });
    setDraftTags("");
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  function updateTask(id: string, changes: Partial<Task>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }

  function toggleStatus(id: string, direction: "forward" | "backward") {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const target =
          direction === "forward" ? nextStatus(task.status) : previousStatus(task.status);
        return { ...task, status: target };
      }),
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 md:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 p-8 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.8)] backdrop-blur">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-400">
                Executive Control Center
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Professional Task Command
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-300">
                Plan, track, and prioritize strategic work with a dashboard built for modern teams.
                Keep context close, celebrate momentum, and spot blockers before they escalate.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Delivery Health
              </span>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold text-white">{stats.health}%</span>
                <span className="text-sm text-slate-400">completion rate</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 transition-all"
                  style={{ width: `${stats.health}%` }}
                />
              </div>
              <p className="text-sm text-slate-400">
                {stats.done} done · {stats.totals - stats.done} active · {stats.overdue} overdue
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-6">
            {stats.focus ? (
              <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 p-6 shadow-lg shadow-emerald-500/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
                      Focus anchor
                    </span>
                    <h2 className="mt-3 text-xl font-semibold text-white">{stats.focus.title}</h2>
                    {stats.focus.description && (
                      <p className="mt-2 text-sm text-emerald-50/80">{stats.focus.description}</p>
                    )}
                  </div>
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                    {STATUS_META[stats.focus.status].label}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
                <span className="rounded-full bg-emerald-500/10 p-2 text-emerald-400">
                  <PlusIcon className="h-4 w-4" />
                </span>
                Add a new initiative
              </div>
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Title
                  </label>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="What needs to be accomplished?"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Narrative
                  </label>
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={3}
                    placeholder="Share the context, success metrics, or the why behind this task."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Due date
                    </label>
                    <input
                      type="date"
                      value={draft.dueDate ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, dueDate: event.target.value }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Priority
                    </label>
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          priority: event.target.value as Priority,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Stage
                    </label>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          status: event.target.value as Status,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                    >
                      <option value="backlog">Backlog</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Tags
                  </label>
                  <input
                    value={draftTags}
                    onChange={(event) => setDraftTags(event.target.value)}
                    placeholder="Separate tags with commas · e.g. Strategy, Design"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">We will suggest tags if you leave this blank.</div>
                  <button
                    onClick={handleAddTask}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:scale-[1.01]"
                  >
                    Create Task
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <ChartBarIcon className="h-6 w-6 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-white">Active workload</div>
                    <div className="text-xs text-slate-400">
                      {filteredTasks.length} of {tasks.length} shown
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    value={filters.query}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, query: event.target.value }))
                    }
                    placeholder="Search tasks, tags, or notes…"
                    className="flex-1 min-w-[180px] rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  />
                  <select
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, status: event.target.value as Filters["status"] }))
                    }
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  >
                    <option value="all">All stages</option>
                    <option value="backlog">Backlog</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                  <select
                    value={filters.priority}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        priority: event.target.value as Filters["priority"],
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={filters.horizon}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        horizon: event.target.value as Filters["horizon"],
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-emerald-400/40 transition focus:ring"
                  >
                    <option value="all">Any due date</option>
                    <option value="today">Due today</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/40">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Momentum feed</h2>
                  <p className="text-sm text-slate-400">Celebrate shipped work and recent wins.</p>
                </div>
                <BoltIcon className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {stats.flow.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    Complete tasks to populate the momentum feed.
                  </div>
                ) : (
                  stats.flow.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
                      <div>
                        <div className="font-medium text-white">{task.title}</div>
                        <div className="text-xs text-slate-400">
                          {task.dueDate ? `Completed • ${format(parseISO(task.dueDate), "MMM d")}` : "Completed"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const statusKey = key as Status;
                const count = filteredTasks.filter((task) => task.status === statusKey).length;
                const total = tasks.filter((task) => task.status === statusKey).length;
                return (
                  <div
                    key={statusKey}
                    className="rounded-3xl border border-white/5 bg-slate-900/70 p-5 shadow-inner shadow-slate-950/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={clsx("h-3 w-3 rounded-full", meta.dot)} />
                        <div className="text-sm font-semibold text-white">{meta.label}</div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {count}/{total}
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-400">{meta.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-inner shadow-slate-950/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Execution board</h2>
                  <p className="text-sm text-slate-400">Organize tasks and promote them through each stage.</p>
                </div>
                <CalendarIcon className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {(["backlog", "in-progress", "review", "done"] satisfies Status[]).map((status) => (
                  <div key={status} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                            STATUS_META[status].bg,
                            STATUS_META[status].accent,
                          )}
                        >
                          {STATUS_META[status].label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {filteredTasks.filter((task) => task.status === status).length} shown
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      {filteredTasks.filter((task) => task.status === status).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
                          No tasks in this stage.
                        </div>
                      ) : (
                        filteredTasks
                          .filter((task) => task.status === status)
                          .map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onDelete={handleDelete}
                              onUpdate={updateTask}
                              onToggleStatus={toggleStatus}
                            />
                          ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type TaskCardProps = {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Task>) => void;
  onToggleStatus: (id: string, direction: "forward" | "backward") => void;
};

function TaskCard({ task, onDelete, onUpdate, onToggleStatus }: TaskCardProps) {
  const dueState = useMemo(() => {
    if (!task.dueDate) return { label: "No due date", tone: "text-slate-400" };
    const due = parseISO(task.dueDate);
    if (isBefore(due, new Date()) && task.status !== "done") {
      return { label: `Overdue · ${format(due, "MMM d")}`, tone: "text-rose-400" };
    }
    if (isToday(due)) return { label: `Due today · ${format(due, "p")}`, tone: "text-amber-400" };
    return { label: `Due ${format(due, "MMM d")}`, tone: "text-slate-300" };
  }, [task.dueDate, task.status]);

  return (
    <article className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-emerald-400/40 hover:bg-slate-950/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">{task.title}</h3>
          {task.description && <p className="mt-2 text-sm text-slate-300">{task.description}</p>}
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs uppercase tracking-widest text-slate-500 transition hover:text-rose-400"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            PRIORITY_META[task.priority].chip,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {PRIORITY_META[task.priority].label} priority
        </span>
        <span className={clsx("text-xs", dueState.tone)}>{dueState.label}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex cursor-pointer items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300"
            onClick={() =>
              onUpdate(task.id, {
                tags: task.tags.filter((existing) => existing !== tag),
              })
            }
          >
            {tag}
          </span>
        ))}
        {task.tags.length === 0 && (
          <span className="text-xs text-slate-500">Tags will appear here for quick filtering.</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Created {format(parseISO(task.createdAt), "MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStatus(task.id, "backward")}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Back
          </button>
          <button
            onClick={() => onToggleStatus(task.id, "forward")}
            className="rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:scale-[1.02]"
          >
            Advance
          </button>
        </div>
      </div>

      {task.status === "review" && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-xs text-purple-200">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Needs sign-off to move to done.
        </div>
      )}
    </article>
  );
}
