"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiEdit2, FiCheck, FiPlus, FiTrash2, FiUpload, FiFile, FiImage, FiDownload, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface ProjectFile {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedByName?: string;
  uploadedByRole?: "admin" | "developer" | "sales" | "client";
}

interface ProjectFileHistory {
  _id: string;
  action: "uploaded" | "deleted";
  fileKey: string;
  fileName: string;
  actorName: string;
  actorRole: "admin" | "developer" | "sales" | "client";
  actedAt: string;
}

interface ProjectTask {
  title: string;
  done: boolean;
}

interface ProjectNote {
  _id: string;
  text: string;
  authorName: string;
  authorRole: "admin" | "developer" | "sales" | "client";
  createdAt: string;
}

interface ProjectDetail {
  _id: string;
  title: string;
  status: string;
  clientStage: "planning" | "design" | "development" | "testing" | "deployment" | "handover";
  clientProgressPercent: number;
  deadline: string | null;
  cost: number;
  paymentStatus: string;
  advanceAmount: number;
  description: string;
  tasks: ProjectTask[];
  notes: ProjectNote[];
  files: ProjectFile[];
  fileHistory?: ProjectFileHistory[];
  clientId?: { _id: string; name: string };
  assignedTo?: { _id: string; name: string }[];
  createdAt: string;
}

interface UserOption {
  _id: string;
  name: string;
  role: string;
}

export default function ProjectDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", status: "", clientStage: "planning", clientProgressPercent: 0, cost: 0, deadline: "", paymentStatus: "", advanceAmount: 0, description: "", assignedTo: [] as string[] });
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingFileKey, setDownloadingFileKey] = useState<string | null>(null);
  const [staffUsers, setStaffUsers] = useState<UserOption[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchProject = useCallback(async () => {
    if (!params.id) return;
    const res = await fetch(`/api/projects/${params.id}`);
    const data = await res.json();
    setProject(data.project);
    if (data.project) {
      setForm({
        title: data.project.title,
        status: data.project.status,
        clientStage: data.project.clientStage || "planning",
        clientProgressPercent: data.project.clientProgressPercent || 0,
        cost: data.project.cost,
        deadline: data.project.deadline ? format(new Date(data.project.deadline), "yyyy-MM-dd") : "",
        paymentStatus: data.project.paymentStatus,
        advanceAmount: data.project.advanceAmount,
        description: data.project.description,
        assignedTo: (data.project.assignedTo || []).map((u: { _id: string }) => u._id),
      });
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { if (session) fetchProject(); }, [session, fetchProject]);

  useEffect(() => {
    if (!session || !isAdmin) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setStaffUsers((d.users || []).filter((u: UserOption) => u.role !== "admin")));
  }, [session, isAdmin]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${project?._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      toast.success("Project updated!");
      setEditing(false);
      fetchProject();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
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

  const toggleTask = async (index: number) => {
    if (!project) return;
    const updated = project.tasks.map((t, i) => i === index ? { ...t, done: !t.done } : t);
    await fetch(`/api/projects/${project._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: updated }) });
    setProject({ ...project, tasks: updated });
  };

  const addTask = async () => {
    if (!newTask || !project) return;
    const updated = [...project.tasks, { title: newTask, done: false }];
    await fetch(`/api/projects/${project._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: updated }) });
    setProject({ ...project, tasks: updated });
    setNewTask("");
  };

  const addNote = async () => {
    if (!project || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNoteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNewNoteText("");
      toast.success("Note added");
      fetchProject();
    } catch {
      toast.error("Failed to add note");
    }
    setAddingNote(false);
  };

  const deleteTask = async (index: number) => {
    if (!project) return;
    const updated = project.tasks.filter((_, i) => i !== index);
    await fetch(`/api/projects/${project._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: updated }) });
    setProject({ ...project, tasks: updated });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !project) return;
    setUploading(true);

    try {
      let uploadedCount = 0;
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", `projects/${project._id}`);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        const attachRes = await fetch(`/api/projects/${project._id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: data.file }),
        });
        if (!attachRes.ok) throw new Error("Failed to attach file to project");
        uploadedCount += 1;
      }

      toast.success(`${uploadedCount} file${uploadedCount > 1 ? "s" : ""} uploaded!`);
      fetchProject();
    } catch { toast.error("Upload failed"); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteFile = async (fileKey: string) => {
    if (!project || !confirm("Remove this file?")) return;
    try {
      const deleteRes = await fetch("/api/upload/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fileKey }),
      });

      if (!deleteRes.ok) {
        throw new Error("Storage delete failed");
      }

      const detachRes = await fetch(`/api/projects/${project._id}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fileKey }),
      });
      if (!detachRes.ok) {
        throw new Error("Failed to remove file from project history");
      }

      toast.success("File removed");
      fetchProject();
    } catch {
      toast.error("Failed to remove file from storage");
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <FiImage size={18} />;
    return <FiFile size={18} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadFile = async (file: ProjectFile) => {
    setDownloadingFileKey(file.key);
    try {
      const downloadUrl = `/api/upload/download?key=${encodeURIComponent(file.key)}&name=${encodeURIComponent(file.name)}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("File download failed:", error);
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloadingFileKey((current) => (current === file.key ? null : current));
    }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!project) return <div className="page-loading">Project not found</div>;

  const doneTasks = project.tasks.filter((t) => t.done).length;
  const totalTasks = project.tasks.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/projects")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{project.title}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
              <span className={`badge badge-${project.status === "completed" ? "green" : project.status === "in_progress" ? "blue" : project.status === "on_hold" ? "orange" : "gray"}`}>
                {project.status.replace("_", " ")}
              </span>
              {project.clientId && <span style={{ marginLeft: 8, cursor: "pointer", color: "var(--text-accent)" }} onClick={() => router.push(`/clients/${project.clientId?._id}`)}>{project.clientId.name}</span>}
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>
          <FiEdit2 size={14} /> {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Main Content */}
        <div>
          {/* Edit Form */}
          {editing && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Edit Project</h3>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="new">New</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input className="form-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                {isAdmin && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Client Stage</label>
                      <select className="form-select" value={form.clientStage} onChange={(e) => setForm({ ...form, clientStage: e.target.value })}>
                        <option value="planning">Planning</option>
                        <option value="design">Design</option>
                        <option value="development">Development</option>
                        <option value="testing">Testing</option>
                        <option value="deployment">Deployment</option>
                        <option value="handover">Handover</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Client Progress (%)</label>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        max={100}
                        value={form.clientProgressPercent}
                        onChange={(e) => setForm({ ...form, clientProgressPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      />
                    </div>
                  </>
                )}
                {isAdmin && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Cost (₹)</label>
                      <input className="form-input" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Status</label>
                      <select className="form-select" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
                        <option value="pending">Pending</option><option value="advance">Advance</option><option value="paid">Paid</option>
                      </select>
                    </div>
                  </>
                )}
                {isAdmin && (
                  <div className="form-group" style={{ gridColumn: "1 / -1", position: "relative" }}>
                    <label className="form-label">Assigned Team</label>
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
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : <><FiCheck size={14} /> Save</>}
                </button>
              </div>
            </div>
          )}

          {/* Tasks */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Tasks ({doneTasks}/{totalTasks})</h3>
              <span style={{ fontSize: 12, fontWeight: 600, color: progress === 100 ? "var(--text-success)" : "var(--text-accent)" }}>{progress}%</span>
            </div>
            <div style={{ height: 4, background: "var(--bg-tertiary)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--bg-accent-gradient)", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <AnimatePresence>
                {project.tasks.map((task, i) => (
                  <motion.div key={i} layout style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius-sm)" }}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(i)} style={{ width: 16, height: 16, accentColor: "var(--bg-accent)", cursor: "pointer" }} />
                    <span style={{ flex: 1, fontSize: 13.5, textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--text-tertiary)" : "var(--text-primary)" }}>{task.title}</span>
                    <button className="btn-icon" style={{ width: 24, height: 24, opacity: 0.5 }} onClick={() => deleteTask(i)}><FiTrash2 size={11} /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Add a task..." value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} />
              <button className="btn btn-primary btn-sm" onClick={addTask}><FiPlus size={14} /></button>
            </div>
          </div>

          {/* Shared Notes */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Project Notes</h3>
              <span className="badge badge-gray">{(project.notes || []).length}</span>
            </div>

            {(project.notes || []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {[...(project.notes || [])]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((note) => (
                    <div key={note._id} style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{note.authorName} ({note.authorRole})</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}</span>
                      </div>
                      <p style={{ fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{note.text}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 10 }}>No notes added yet.</p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Add note, reference URL, or update details..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                style={{ flex: 1, minHeight: 70 }}
              />
              <button className="btn btn-primary" onClick={addNote} disabled={addingNote || !newNoteText.trim()}>
                {addingNote ? "Adding..." : "Add Note"}
              </button>
            </div>
          </div>

          {/* Files */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiFile size={16} style={{ color: "var(--text-accent)" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>Files ({(project.files || []).length})</h3>
              </div>
              <div>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: "none" }} />
                <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Uploading...</> : <><FiUpload size={13} /> Upload</>}
                </button>
              </div>
            </div>

            {(project.files || []).length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {(project.files || []).map((file) => (
                  <div key={file.key} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: 12,
                    background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--bg-accent-light)", color: "var(--text-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {getFileIcon(file.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatSize(file.size)}</div>
                      {file.uploadedByName && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          by {file.uploadedByName} ({file.uploadedByRole})
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26 }}
                        onClick={() => handleDownloadFile(file)}
                        disabled={downloadingFileKey === file.key}
                        title="Download file"
                      >
                        {downloadingFileKey === file.key ? (
                          <div className="spinner" style={{ width: 12, height: 12 }} />
                        ) : (
                          <FiDownload size={12} />
                        )}
                      </button>
                      {isAdmin && <button className="btn-icon" style={{ width: 26, height: 26, color: "var(--text-danger)" }} onClick={() => deleteFile(file.key)}><FiX size={12} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)" }}>
                <FiUpload size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>Upload logos, docs, and assets</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)" }}>Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Client Stage</span>
                <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{project.clientStage || "planning"}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Client Progress</span>
                <div style={{ marginTop: 4 }}>
                  <div style={{ height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${project.clientProgressPercent || 0}%`, height: "100%", background: "var(--bg-accent-gradient)" }} />
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary)" }}>{project.clientProgressPercent || 0}%</div>
                </div>
              </div>
              {isAdmin && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Cost</span><div style={{ fontSize: 22, fontWeight: 700 }}>₹{(project.cost || 0).toLocaleString("en-IN")}</div></div>}
              {isAdmin && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Payment</span><div><span className={`badge badge-${project.paymentStatus === "paid" ? "green" : project.paymentStatus === "advance" ? "blue" : "orange"}`}>{project.paymentStatus}</span></div></div>}
              {isAdmin && project.advanceAmount > 0 && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Advance Paid</span><div style={{ fontWeight: 600 }}>₹{project.advanceAmount.toLocaleString("en-IN")}</div></div>}
              {(project.assignedTo || []).length > 0 && (
                <div>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Assigned Team</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {(project.assignedTo || []).map((member) => (
                      <span key={member._id} className="badge badge-blue">{member.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {project.deadline && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Deadline</span><div style={{ fontWeight: 500 }}>{format(new Date(project.deadline), "MMM d, yyyy")}</div></div>}
              <div><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Created</span><div style={{ fontWeight: 500, fontSize: 13 }}>{format(new Date(project.createdAt), "MMM d, yyyy")}</div></div>
            </div>
          </div>

          {project.description && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)" }}>Description</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{project.description}</p>
            </div>
          )}

          {isAdmin && (project.fileHistory || []).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)" }}>File Upload History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...(project.fileHistory || [])]
                  .sort((a, b) => new Date(b.actedAt).getTime() - new Date(a.actedAt).getTime())
                  .slice(0, 20)
                  .map((entry) => (
                    <div key={entry._id} style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                        {entry.action} - {entry.fileName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {entry.actorName} ({entry.actorRole}) · {format(new Date(entry.actedAt), "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
