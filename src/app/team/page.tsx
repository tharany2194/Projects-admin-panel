"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiTrash2, FiMail, FiShield, FiCode, FiDollarSign, FiLock } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface UserMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  admin: { icon: <FiShield size={14} />, color: "#6c5ce7", bg: "rgba(108,92,231,0.12)", label: "Admin" },
  developer: { icon: <FiCode size={14} />, color: "#3b82f6", bg: "rgba(59,130,246,0.12)", label: "Developer" },
  sales: { icon: <FiDollarSign size={14} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Sales" },
};

export default function TeamPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<UserMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "developer" });
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setMembers(data.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchMembers(); }, [session, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.password) { toast.error("All fields required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed"); }
      toast.success("Team member added!");
      setShowInvite(false);
      setInviteForm({ name: "", email: "", password: "", role: "developer" });
      fetchMembers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to add member"); }
    setSaving(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isAdmin) { toast.error("Only admins can change roles"); return; }
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: newRole }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      toast.success("Role updated!");
      fetchMembers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to update role"); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!isAdmin) { toast.error("Only admins can remove members"); return; }
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      toast.success("Member removed");
      fetchMembers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to remove"); }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {members.length} team members
            {!isAdmin && <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-tertiary)" }}><FiLock size={11} /> View only</span>}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}><FiPlus size={16} /> Add Member</button>
        )}
      </div>

      {/* Team Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {members.map((member) => {
          const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.developer;
          const isCurrentUser = member._id === session?.user?.id;

          return (
            <motion.div key={member._id} className="card" whileHover={{ y: -2 }} style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: roleConfig.color }} />
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--radius-full)", background: `linear-gradient(135deg, ${roleConfig.color}, ${roleConfig.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {member.name} {isCurrentUser && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>(You)</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                    <FiMail size={12} /> {member.email}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isAdmin && !isCurrentUser ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member._id, e.target.value)}
                      style={{
                        background: roleConfig.bg, color: roleConfig.color, border: "none", padding: "4px 10px",
                        borderRadius: "var(--radius-full)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="sales">Sales</option>
                    </select>
                  ) : (
                    <span style={{
                      background: roleConfig.bg, color: roleConfig.color, padding: "4px 10px",
                      borderRadius: "var(--radius-full)", fontSize: 12.5, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {roleConfig.icon} {roleConfig.label}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Joined {format(new Date(member.createdAt), "MMM d, yyyy")}</span>
                  {isAdmin && !isCurrentUser && (
                    <button className="btn-icon" style={{ color: "var(--text-danger)", width: 28, height: 28 }} onClick={() => handleRemove(member._id, member.name)}>
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Member Modal — admin only */}
      <AnimatePresence>
        {showInvite && isAdmin && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInvite(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Team Member</h2>
                <button className="btn-icon" onClick={() => setShowInvite(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" placeholder="Full name" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" placeholder="email@company.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input className="form-input" type="password" placeholder="Temporary password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setInviteForm({ ...inviteForm, role: key })}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "10px 12px", borderRadius: "var(--radius-md)", border: `2px solid ${inviteForm.role === key ? config.color : "var(--border-primary)"}`,
                          background: inviteForm.role === key ? config.bg : "transparent", color: inviteForm.role === key ? config.color : "var(--text-secondary)",
                          fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
                        }}
                      >
                        {config.icon} {config.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleInvite} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Adding...</> : "Add Member"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
