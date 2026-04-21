"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiCalendar, FiDollarSign, FiEdit2, FiTrash2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface Project {
  _id: string;
  title: string;
  status: string;
  deadline: string | null;
  cost: number;
  paymentStatus: string;
  advanceAmount: number;
  description: string;
  tasks: { title: string; done: boolean }[];
  clientId?: { _id: string; name: string };
  assignedTo?: { _id: string; name: string; role: string }[];
  createdAt: string;
}

interface ClientOption { _id: string; name: string; }
interface UserOption { _id: string; name: string; role: string; }

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "on_hold", label: "On Hold" },
];

const statusBadge: Record<string, string> = { new: "purple", in_progress: "blue", completed: "green", on_hold: "orange" };
const payBadge: Record<string, string> = { paid: "green", pending: "orange", advance: "blue" };

export default function ProjectsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "admin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [form, setForm] = useState({ title: "", clientId: "", status: "new", deadline: "", cost: 0, paymentStatus: "pending", advanceAmount: 0, description: "", assignedTo: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchProjects = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    const res = await fetch(`/api/projects?${params}`);
    const data = await res.json();
    setProjects(data.projects || []);
    setLoading(false);
  }, [activeStatus]);

  useEffect(() => {
    if (session) {
      fetchProjects();
      if (isAdmin) {
        fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
        fetch("/api/users")
          .then((r) => r.json())
          .then((d) => setStaffUsers((d.users || []).filter((u: UserOption) => u.role !== "admin")));
      }
    }
  }, [session, fetchProjects, isAdmin]);

  const openCreate = () => {
    if (!isAdmin) return;
    setForm({ title: "", clientId: clients[0]?._id || "", status: "new", deadline: "", cost: 0, paymentStatus: "pending", advanceAmount: 0, description: "", assignedTo: [] });
    setShowAssigneeDropdown(false);
    setShowModal(true);
  };

  const toggleAssignee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter((id) => id !== userId)
        : [...prev.assignedTo, userId],
    }));
  };

  const getAssignedSummary = () => {
    if (form.assignedTo.length === 0) return "Select team members";
    const names = staffUsers
      .filter((u) => form.assignedTo.includes(u._id))
      .map((u) => u.name);
    return names.join(", ");
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!form.title || !form.clientId) { toast.error("Title and client are required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success("Project created!");
      setShowModal(false);
      fetchProjects();
    } catch { toast.error("Failed to create project"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Delete this project?")) return;
    try { await fetch(`/api/projects/${id}`, { method: "DELETE" }); toast.success("Project deleted"); fetchProjects(); }
    catch { toast.error("Failed to delete"); }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{projects.length} projects</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}><FiPlus size={16} /> New Project</button>}
      </div>

      {/* Status Tabs */}
      <div className="tabs">
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeStatus === tab.key ? "active" : ""}`} onClick={() => setActiveStatus(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {projects.map((project) => {
            const completedTasks = project.tasks.filter((t) => t.done).length;
            const totalTasks = project.tasks.length;
            const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            return (
              <motion.div key={project._id} className="card" style={{ cursor: "pointer", position: "relative" }} whileHover={{ y: -2 }} onClick={() => router.push(`/projects/${project._id}`)}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${statusBadge[project.status] === "purple" ? "#6c5ce7" : statusBadge[project.status] === "blue" ? "#3b82f6" : statusBadge[project.status] === "green" ? "#22c55e" : "#f59e0b"}, transparent)`, borderRadius: "14px 14px 0 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{project.title}</h3>
                    {isAdmin && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{project.clientId?.name || "—"}</span>}
                  </div>
                  <span className={`badge badge-${statusBadge[project.status]}`}>{project.status.replace("_", " ")}</span>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
                  {isAdmin && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                      <FiDollarSign size={14} /> ₹{project.cost.toLocaleString("en-IN")}
                    </span>
                  )}
                  {project.deadline && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                      <FiCalendar size={14} /> {format(new Date(project.deadline), "MMM d")}
                    </span>
                  )}
                  {isAdmin && <span className={`badge badge-${payBadge[project.paymentStatus]}`}>{project.paymentStatus}</span>}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(project.assignedTo || []).map((assignee) => (
                    <span
                      key={assignee._id}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--bg-info)",
                        color: "var(--text-info)",
                        fontWeight: 500,
                      }}
                    >
                      {assignee.name}
                    </span>
                  ))}
                </div>

                {/* Progress Bar */}
                {totalTasks > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                      <span>Tasks</span><span>{completedTasks}/{totalTasks}</span>
                    </div>
                    <div style={{ height: 4, background: "var(--bg-tertiary)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "var(--bg-accent-gradient)", borderRadius: 2, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon" onClick={() => router.push(`/projects/${project._id}`)}><FiEdit2 size={14} /></button>
                  {isAdmin && <button className="btn-icon" style={{ color: "var(--text-danger)" }} onClick={() => handleDelete(project._id)}><FiTrash2 size={14} /></button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-state-icon">📁</div>
          <h3>No projects yet</h3>
            <p>{isAdmin ? "Create your first project to start tracking" : "You have no assigned projects yet"}</p>
            {isAdmin && <button className="btn btn-primary" onClick={openCreate}><FiPlus size={16} /> New Project</button>}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && isAdmin && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>New Project</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Title *</label>
                  <input className="form-input" placeholder="e.g. E-commerce Website" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Client *</label>
                    <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                      <option value="">Select client</option>
                      {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Project Cost (₹)</label>
                    <input className="form-input" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input className="form-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Status</label>
                    <select className="form-select" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
                      <option value="pending">Pending</option>
                      <option value="advance">Advance Paid</option>
                      <option value="paid">Fully Paid</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Amount (₹)</label>
                    <input className="form-input" type="number" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: Number(e.target.value) })} />
                  </div>
                  <div className="form-group" style={{ position: "relative" }}>
                    <label className="form-label">Assign Team</label>
                    <button
                      type="button"
                      className="form-input"
                      style={{ textAlign: "left", cursor: "pointer", minHeight: 42 }}
                      onClick={() => setShowAssigneeDropdown((prev) => !prev)}
                    >
                      <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getAssignedSummary()}
                      </span>
                    </button>
                    {showAssigneeDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          maxHeight: 180,
                          overflowY: "auto",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-md)",
                          zIndex: 50,
                          padding: 8,
                        }}
                      >
                        {staffUsers.length > 0 ? (
                          staffUsers.map((u) => (
                            <label
                              key={u._id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "7px 8px",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={form.assignedTo.includes(u._id)}
                                onChange={() => toggleAssignee(u._id)}
                                style={{ width: 14, height: 14 }}
                              />
                              <span>{u.name}</span>
                            </label>
                          ))
                        ) : (
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: 8 }}>No staff users available</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" rows={3} placeholder="Project details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating...</> : "Create Project"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
