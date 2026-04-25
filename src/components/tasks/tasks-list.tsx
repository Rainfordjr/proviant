"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutGrid, List, Search, Filter, Calendar, User, Building2,
  AlertCircle, Clock, CheckCircle2, XCircle, Eye,
} from "lucide-react";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_user: { id: string; full_name: string; email: string } | null;
  department: { id: string; name: string; color: string } | null;
  creator: { id: string; full_name: string } | null;
}

interface Props {
  tasks: Task[];
  departments: { id: string; name: string; color: string }[];
  users: { id: string; full_name: string; email: string }[];
  currentUserId: string;
}

type ViewMode = "board" | "list";

const STATUS_ORDER = ["open", "in_progress", "review", "done", "cancelled"] as const;

const STATUS_ICONS: Record<string, React.ElementType> = {
  open: AlertCircle,
  in_progress: Clock,
  review: Eye,
  done: CheckCircle2,
  cancelled: XCircle,
};

export function TasksList({ tasks, departments, users, currentUserId }: Props) {
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
      if (assigneeFilter === "me" && t.assigned_user?.id !== currentUserId) return false;
      if (assigneeFilter === "unassigned" && t.assigned_user) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "me" && assigneeFilter !== "unassigned" && t.assigned_user?.id !== assigneeFilter) return false;
      if (deptFilter !== "all" && t.department?.id !== deptFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter, typeFilter, assigneeFilter, deptFilter, currentUserId]);

  const isOverdue = (t: Task): boolean =>
    !!t.due_date && new Date(t.due_date) < new Date() && !["done", "cancelled"].includes(t.status);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setView("board")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "board" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid size={14} /> Board
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "list" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <List size={14} /> List
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>

        {/* Filters */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
        >
          <option value="all">All Assignees</option>
          <option value="me">Assigned to Me</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
        >
          <option value="all">All Priorities</option>
          {Object.entries(TASK_PRIORITIES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
        >
          <option value="all">All Types</option>
          {Object.entries(TASK_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Board View */}
      {view === "board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {STATUS_ORDER.map((status) => {
            const info = TASK_STATUSES[status];
            const StatusIcon = STATUS_ICONS[status];
            const columnTasks = filtered.filter((t) => t.status === status);
            return (
              <div key={status} className="flex flex-col rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
                  <StatusIcon size={16} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">{info.label}</span>
                  <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2 min-h-[100px]">
                  {columnTasks.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-gray-400">No tasks</p>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} isOverdue={isOverdue(task)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Due Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No tasks match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const statusInfo = TASK_STATUSES[task.status as keyof typeof TASK_STATUSES];
                  const priorityInfo = TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES];
                  const typeInfo = TASK_TYPES[task.task_type as keyof typeof TASK_TYPES];
                  const overdue = isOverdue(task);
                  return (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {task.title}
                        </Link>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{task.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                          {statusInfo?.label || task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityInfo?.color || "bg-gray-100 text-gray-800"}`}>
                          {priorityInfo?.label || task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {task.assigned_user?.full_name || <span className="text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {task.department ? (
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: task.department.color + "20", color: task.department.color }}
                          >
                            {task.department.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo?.color || "bg-gray-100 text-gray-700"}`}>
                          {typeInfo?.label || task.task_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {task.due_date ? (
                          <span className={overdue ? "font-medium text-red-600" : "text-gray-700"}>
                            {overdue && "⚠ "}
                            {formatDate(task.due_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/tasks/${task.id}`} className="text-sm text-gray-500 hover:text-gray-900">
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Board Card ───────────────────────────────────────────── */
function TaskCard({ task, isOverdue }: { task: Task; isOverdue: boolean }) {
  const priorityInfo = TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES];
  const typeInfo = TASK_TYPES[task.task_type as keyof typeof TASK_TYPES];

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</h3>
        <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityInfo?.color || "bg-gray-100"}`}>
          {priorityInfo?.label || task.priority}
        </span>
      </div>

      {task.description && (
        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{task.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeInfo?.color || "bg-gray-100"}`}>
          {typeInfo?.label || task.task_type}
        </span>
        {task.department && (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: task.department.color + "20", color: task.department.color }}
          >
            {task.department.name}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <User size={10} />
          {task.assigned_user?.full_name || "Unassigned"}
        </span>
        {task.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? "font-medium text-red-500" : ""}`}>
            <Calendar size={10} />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </Link>
  );
}
