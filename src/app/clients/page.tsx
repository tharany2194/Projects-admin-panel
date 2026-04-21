"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiSearch, FiPhone, FiMail, FiEdit2, FiTrash2, FiMessageCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface Client {
  _id: string;
  name: string;
  type: string;
  email: string;
  portalAccessEnabled?: boolean;
  phone: string;
  whatsapp: string;
  tags: string[];
  assignedTo?: { _id: string; name: string; role: string }[];
  createdAt: string;
}

interface TeamMemberOption {
  _id: string;
  name: string;
  role: string;
}

const TAG_OPTIONS = ["High Value", "Pending Payment", "New Client", "Regular", "VIP"];

export default function ClientsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [form, setForm] = useState({ name: "", type: "individual", email: "", phone: "", whatsapp: "", address: "", gstNumber: "", tags: [] as string[], notes: "", assignedTo: [] as string[], portalAccessEnabled: false, portalPassword: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchClients = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (activeTag) params.set("tag", activeTag);
    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  }, [search, activeTag]);

  useEffect(() => {
    if (!session) return;
    fetchClients();
    if (session.user.role === "admin") {
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => setTeamMembers((d.users || []).filter((u: TeamMemberOption) => ["sales", "developer"].includes(u.role))));
    }
  }, [session, fetchClients]);

  const openCreate = () => {
    setEditingClient(null);
    setForm({ name: "", type: "individual", email: "", phone: "", whatsapp: "", address: "", gstNumber: "", tags: [], notes: "", assignedTo: [], portalAccessEnabled: false, portalPassword: "" });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      type: client.type,
      email: client.email,
      phone: client.phone,
      whatsapp: client.whatsapp || "",
      address: "",
      gstNumber: "",
      tags: client.tags,
      notes: "",
      assignedTo: (client.assignedTo || []).map((m) => m._id),
      portalAccessEnabled: !!client.portalAccessEnabled,
      portalPassword: "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Client name is required"); return; }
    setSaving(true);
    try {
      const url = editingClient ? `/api/clients/${editingClient._id}` : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success(editingClient ? "Client updated!" : "Client created!");
      setShowModal(false);
      fetchClients();
    } catch { toast.error("Failed to save client"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
      toast.success("Client deleted");
      fetchClients();
    } catch { toast.error("Failed to delete"); }
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const toggleAssignee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter((id) => id !== userId)
        : [...prev.assignedTo, userId],
    }));
  };

  if (authStatus === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{clients.length} total clients</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}><FiPlus size={16} /> Add Client</button>}
      </div>

      {/* Search & Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search-bar">
          <FiSearch size={16} className="search-icon" />
          <input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-bar">
          <button className={`filter-tag ${activeTag === "" ? "active" : ""}`} onClick={() => setActiveTag("")}>All</button>
          {TAG_OPTIONS.map((tag) => (
            <button key={tag} className={`filter-tag ${activeTag === tag ? "active" : ""}`} onClick={() => setActiveTag(activeTag === tag ? "" : tag)}>{tag}</button>
          ))}
        </div>
      </div>

      {/* Clients Table */}
      {clients.length > 0 ? (
        <div className="table-container">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Tags</th>
                  <th>Added</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id} style={{ cursor: "pointer" }} onClick={() => router.push(`/clients/${client._id}`)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "var(--radius-full)", background: "var(--bg-accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{client.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-gray" style={{ textTransform: "capitalize" }}>{client.type}</span></td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
                        {client.email && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><FiMail size={12} /> {client.email}</span>}
                        {client.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><FiPhone size={12} /> {client.phone}</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {client.tags.map((tag) => (
                          <span key={tag} className={`badge ${tag === "High Value" ? "badge-green" : tag === "Pending Payment" ? "badge-orange" : tag === "VIP" ? "badge-purple" : "badge-blue"}`}>{tag}</span>
                        ))}
                        {client.assignedTo && client.assignedTo.length > 0 && (
                          <span className="badge badge-gray">Team: {client.assignedTo.length}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{format(new Date(client.createdAt), "MMM d, yyyy")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {client.whatsapp && (
                          <a href={`https://wa.me/${client.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-icon" style={{ background: "#25d366", color: "white", border: "none" }}><FiMessageCircle size={14} /></a>
                        )}
                        {isAdmin && <button className="btn-icon" onClick={() => openEdit(client)}><FiEdit2 size={14} /></button>}
                        {isAdmin && <button className="btn-icon" style={{ color: "var(--text-danger)" }} onClick={() => handleDelete(client._id)}><FiTrash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No clients yet</h3>
          <p>Add your first client to get started</p>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}><FiPlus size={16} /> Add Client</button>}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="modal-header">
                <h2>{editingClient ? "Edit Client" : "Add Client"}</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Client Name *</label>
                    <input className="form-input" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      <option value="individual">Individual</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" placeholder="client@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp</label>
                    <input className="form-input" placeholder="919876543210" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input className="form-input" placeholder="GSTIN" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-textarea" rows={2} placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {TAG_OPTIONS.map((tag) => (
                      <button key={tag} type="button" className={`filter-tag ${form.tags.includes(tag) ? "active" : ""}`} onClick={() => toggleTag(tag)}>{tag}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} placeholder="Internal notes about this client" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                {session?.user?.role === "admin" && (
                  <div className="form-group">
                    <label className="form-label">Assign Team Members</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {teamMembers.length > 0 ? (
                        teamMembers.map((member) => (
                          <button
                            key={member._id}
                            type="button"
                            className={`filter-tag ${form.assignedTo.includes(member._id) ? "active" : ""}`}
                            onClick={() => toggleAssignee(member._id)}
                          >
                            {member.name} ({member.role})
                          </button>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No team members available</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.portalAccessEnabled}
                      onChange={(e) => setForm({ ...form, portalAccessEnabled: e.target.checked })}
                      style={{ width: 14, height: 14 }}
                    />
                    Enable Client Portal Access
                  </label>
                </div>
                {form.portalAccessEnabled && (
                  <div className="form-group">
                    <label className="form-label">Portal Password {editingClient ? "(set new password)" : "*"}</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder={editingClient ? "Leave blank to keep existing password" : "Minimum 6 characters"}
                      value={form.portalPassword}
                      onChange={(e) => setForm({ ...form, portalPassword: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : editingClient ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
