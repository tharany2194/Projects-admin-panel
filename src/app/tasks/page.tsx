"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiTrash2, FiCalendar, FiFlag, FiEdit2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
  projectId?: { _id: string; title: string };
  assignedTo?: { _id: string; name: string };
  createdBy?: { _id: string; name: string; role: string };
  history?: {
    action: string;
    field?: string;
    from?: string;
    to?: string;
    note?: string;
    at: string;
    actorId?: { _id: string; name: string; role: string };
  }[];
  createdAt: string;
}

interface ProjectOption { _id: string; title: string; }
interface UserOption { _id: string; name: string; role: string; }

const COLUMNS = [
  { key: "todo", label: "To Do", color: "#6c5ce7", emoji: "📋" },
  { key: "doing", label: "In Progress", color: "#3b82f6", emoji: "🔧" },
  { key: "done", label: "Done", color: "#22c55e", emoji: "✅" },
];

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "High" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Medium" },
  low: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Low" },
};

export default function TasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "admin";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", projectId: "", assignedTo: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || []));
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => setStaffUsers((d.users || []).filter((u: UserOption) => u.role !== "admin")));
    }
  }, [session, fetchTasks, isAdmin]);

  const openCreate = (status: string = "todo") => {
    setEditingTask(null);
    setForm({ title: "", description: "", status, priority: "medium", projectId: "", assignedTo: "", deadline: "" });
    setShowModal(true);
  };

  const openEdit = (task: Task) => {
    if (!isAdmin && task.createdBy?._id !== session?.user?.id) {
      toast.error("You can edit only tasks created by you");
      return;
    }
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId?._id || "",
      assignedTo: task.assignedTo?._id || "",
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd") : "",
    });
    setShowModal(true);
  };

  const openDetails = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedTask(data.task || null);
      setShowDetailsModal(true);
    } catch {
      toast.error("Failed to load task details");
    }
  };

  const handleSave = async () => {
    if (!form.title) { toast.error("Task title is required"); return; }
    setSaving(true);
    try {
      const url = editingTask ? `/api/tasks/${editingTask._id}` : "/api/tasks";
      const method = editingTask ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success(editingTask ? "Task updated!" : "Task created!");
      setShowModal(false);
      fetchTasks();
    } catch { toast.error("Failed to save task"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Delete this task?")) return;
    try { await fetch(`/api/tasks/${id}`, { method: "DELETE" }); toast.success("Task deleted"); fetchTasks(); }
    catch { toast.error("Failed to delete"); }
  };

  const handleDragStart = (taskId: string) => { setDraggedTask(taskId); };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); };
  const handleDragLeave = (e: React.DragEvent) => { e.currentTarget.classList.remove("drag-over"); };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    if (!draggedTask) return;
    const droppedTask = tasks.find((t) => t._id === draggedTask);
    if (!droppedTask) return;
    if (!canMoveTask(droppedTask)) {
      toast.error("You can move only tasks assigned to you or created by you");
      setDraggedTask(null);
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${draggedTask}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error();
      await fetchTasks();
      setDraggedTask(null);
    } catch { toast.error("Failed to move task"); }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  const getColumnTasks = (status: string) => tasks.filter((t) => t.status === status);
  const formatStatus = (status: string) => COLUMNS.find((c) => c.key === status)?.label || status;
  const canEditTask = (task: Task) => isAdmin || task.createdBy?._id === session?.user?.id;
  const canMoveTask = (task: Task) =>
    isAdmin || task.createdBy?._id === session?.user?.id || task.assignedTo?._id === session?.user?.id;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{tasks.length} tasks across {COLUMNS.length} columns</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()}><FiPlus size={16} /> Add Task</button>
      </div>

      {/* Kanban Board */}
      <div
        className="tasks-kanban-board"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, minHeight: "60vh" }}
      >
        {COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.key);
          return (
            <div
              className="tasks-kanban-column"
              key={col.key}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-lg)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.2s ease",
                minHeight: 0,
              }}
            >
              {/* Column Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 14px", borderBottom: `2px solid ${col.color}`, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{col.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{col.label}</span>
                  <span style={{ background: col.color, color: "white", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--radius-full)", minWidth: 22, textAlign: "center" }}>
                    {columnTasks.length}
                  </span>
                </div>
                <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => openCreate(col.key)}><FiPlus size={14} /></button>
              </div>

              {/* Tasks */}
              <div className="tasks-kanban-list" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}>
                <AnimatePresence>
                  {columnTasks.map((task) => {
                    const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                    return (
                      <motion.div
                        key={task._id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable={canMoveTask(task)}
                        onDragStart={() => handleDragStart(task._id)}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-md)",
                          padding: 14,
                          cursor: canMoveTask(task) ? "grab" : "default",
                          borderLeft: `3px solid ${prio.color}`,
                          transition: "box-shadow 0.2s ease",
                        }}
                        whileHover={{ boxShadow: "var(--shadow-md)" }}
                        onClick={() => openDetails(task._id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, lineHeight: 1.3 }}>{task.title}</span>
                          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                            <button
                              className="btn-icon"
                              style={{ width: 24, height: 24, opacity: !isAdmin && task.createdBy?._id !== session?.user?.id ? 0.45 : 1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(task);
                              }}
                            >
                              <FiEdit2 size={11} />
                            </button>
                            {isAdmin && <button className="btn-icon" style={{ width: 24, height: 24, color: "var(--text-danger)" }} onClick={(e) => { e.stopPropagation(); handleDelete(task._id); }}><FiTrash2 size={11} /></button>}
                          </div>
                        </div>

                        {task.description && (
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {task.description}
                          </p>
                        )}

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--radius-full)", background: prio.bg, color: prio.color }}>
                            <FiFlag size={9} /> {prio.label}
                          </span>
                          {task.projectId && (
                            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: "var(--radius-full)", background: "var(--bg-accent-light)", color: "var(--text-accent)", fontWeight: 500 }}>
                              {task.projectId.title}
                            </span>
                          )}
                          {task.assignedTo && (
                            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: "var(--radius-full)", background: "var(--bg-info)", color: "var(--text-info)", fontWeight: 500 }}>
                              {task.assignedTo.name}
                            </span>
                          )}
                          {task.deadline && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: "var(--text-tertiary)" }}>
                              <FiCalendar size={9} /> {format(new Date(task.deadline), "MMM d")}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {columnTasks.length === 0 && (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
                      Drop tasks here<br />or <span style={{ color: "var(--text-accent)", cursor: "pointer" }} onClick={() => openCreate(col.key)}>add one</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingTask ? "Edit Task" : "Add Task"}</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" placeholder="What needs to be done?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" rows={2} placeholder="Add details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="todo">To Do</option>
                      <option value="doing">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      <option value="low">🟢 Low</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="high">🔴 High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Project</label>
                    <select className="form-select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                      <option value="">No project</option>
                      {projects.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign To</label>
                    <select className="form-select" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                      <option value="">Unassigned</option>
                      {staffUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input className="form-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  </div>
                </div>

                {isAdmin && editingTask && (editingTask.history || []).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <label className="form-label">Task History</label>
                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: "auto",
                        border: "1px solid var(--border-primary)",
                        borderRadius: "var(--radius-md)",
                        padding: 8,
                        background: "var(--bg-tertiary)",
                      }}
                    >
                      {(editingTask.history || [])
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                          <div
                            key={`${entry.at}-${index}`}
                            style={{
                              padding: "7px 8px",
                              borderBottom: index === (editingTask.history || []).length - 1 ? "none" : "1px solid var(--border-primary)",
                              fontSize: 12,
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                              {entry.actorId?.name || "Unknown"} • {entry.note || entry.action}
                            </div>
                            <div style={{ color: "var(--text-secondary)" }}>
                              {entry.field ? `${entry.field}: ` : ""}
                              {entry.from || ""}
                              {entry.to ? ` -> ${entry.to}` : ""}
                            </div>
                            <div style={{ color: "var(--text-tertiary)", marginTop: 2 }}>{format(new Date(entry.at), "MMM d, yyyy HH:mm")}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : editingTask ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailsModal && selectedTask && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetailsModal(false)}>
            <motion.div className="modal" style={{ maxWidth: 700 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Task Details</h2>
                <button className="btn-icon" onClick={() => setShowDetailsModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedTask.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge badge-blue">{formatStatus(selectedTask.status)}</span>
                    <span className={`badge ${selectedTask.priority === "high" ? "badge-red" : selectedTask.priority === "medium" ? "badge-orange" : "badge-green"}`}>{selectedTask.priority}</span>
                    {selectedTask.projectId && <span className="badge badge-purple">{selectedTask.projectId.title}</span>}
                    {selectedTask.assignedTo && <span className="badge badge-gray">Assigned: {selectedTask.assignedTo.name}</span>}
                    {selectedTask.deadline && <span className="badge badge-gray">Due: {format(new Date(selectedTask.deadline), "MMM d, yyyy")}</span>}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Description</div>
                  <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", fontSize: 13.5, color: "var(--text-secondary)", minHeight: 48 }}>
                    {selectedTask.description || "No description"}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div className="form-label">Created By</div>
                    <div style={{ fontSize: 13.5 }}>{selectedTask.createdBy?.name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="form-label">Created At</div>
                    <div style={{ fontSize: 13.5 }}>{format(new Date(selectedTask.createdAt), "MMM d, yyyy HH:mm")}</div>
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ marginTop: 12 }}>
                    <div className="form-label">Task History</div>
                    <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)" }}>
                      {(selectedTask.history || []).length === 0 ? (
                        <div style={{ padding: 12, fontSize: 13, color: "var(--text-tertiary)" }}>No history yet</div>
                      ) : (
                        (selectedTask.history || []).slice().reverse().map((entry, index) => (
                          <div key={`${entry.at}-${index}`} style={{ padding: "10px 12px", borderBottom: index === (selectedTask.history || []).length - 1 ? "none" : "1px solid var(--border-primary)" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                              {entry.actorId?.name || "Unknown"} • {format(new Date(entry.at), "MMM d, yyyy HH:mm")}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 2 }}>{entry.note || entry.action}</div>
                            {entry.field === "status" ? (
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                Stage: {formatStatus(entry.from || "")} {entry.to ? `-> ${formatStatus(entry.to)}` : ""}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                {entry.field || "field"}: {entry.from || ""} {entry.to ? `-> ${entry.to}` : ""}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
                {canEditTask(selectedTask) && (
                  <button className="btn btn-primary" onClick={() => { setShowDetailsModal(false); openEdit(selectedTask); }}>
                    Edit Task
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
