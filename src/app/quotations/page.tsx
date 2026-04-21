"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiSearch, FiFileText, FiDownload, FiCheckCircle, FiXCircle, FiSend } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

export default function QuotationsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [form, setForm] = useState({
    clientId: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
    discount: 0,
    discountType: "percentage",
    gstEnabled: false,
    gstRate: 18,
    notes: "",
    terms: "Validity: 15 days from quotation date.\nPayment: 50% advance, 50% on completion.",
    validUntil: "",
  });

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchData = useCallback(async () => {
    const [quoRes, cliRes] = await Promise.all([
      fetch("/api/quotations").then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]);
    setQuotations(quoRes.quotations || []);
    setClients(cliRes.clients || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session, fetchData]);

  const calculateTotals = () => {
    const subtotal = form.items.reduce((s, i) => s + i.amount, 0);
    const discountAmount = form.discountType === "percentage" ? (subtotal * form.discount) / 100 : form.discount;
    const afterDiscount = subtotal - discountAmount;
    const taxValue = form.gstEnabled ? (afterDiscount * form.gstRate) / 100 : 0;
    const cgst = taxValue / 2;
    const sgst = taxValue / 2;
    const total = afterDiscount + taxValue;
    return { subtotal, discountAmount, cgst, sgst, total };
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...form.items];
    const item = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      item.amount = Number(item.quantity) * Number(item.rate);
    }
    newItems[index] = item;
    setForm({ ...form, items: newItems });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, amount: 0 }] });
  const removeItem = (index: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const handleCreate = async () => {
    if (!form.clientId) { toast.error("Select a client"); return; }
    if (form.items.some(i => !i.description || i.amount <= 0)) { toast.error("Invalid line items"); return; }
    setSaving(true);
    try {
      const totals = calculateTotals();
      const payload: any = { ...form, ...totals };
      if (!payload.validUntil) delete payload.validUntil;

      const res = await fetch("/api/quotations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success("Quotation created!");
      setShowCreate(false);
      fetchData();
      router.push(`/quotations/${data.quotation._id}`);
    } catch { toast.error("Failed to create quotation"); }
    setSaving(false);
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  const filtered = quotations.filter(q => {
    const matchSearch = q.quotationNumber.toLowerCase().includes(search.toLowerCase()) || q.clientId?.name.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || q.status === activeTab;
    return matchSearch && matchTab;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted": return <FiCheckCircle size={14} />;
      case "rejected": return <FiXCircle size={14} />;
      case "sent": return <FiSend size={14} />;
      default: return <FiFileText size={14} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "green";
      case "rejected": return "red";
      case "sent": return "blue";
      default: return "gray";
    }
  };

  const isOwner = (createdBy: unknown) => {
    if (!session?.user?.id) return false;
    if (typeof createdBy === "string") return createdBy === session.user.id;
    if (createdBy && typeof createdBy === "object" && "_id" in createdBy) {
      return String((createdBy as { _id?: unknown })._id || "") === String(session.user.id);
    }
    return false;
  };

  const isClientVisible = (workflowStatus?: string) => {
    return workflowStatus === "sent" || workflowStatus === "approved" || workflowStatus === "rejected";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Quotations</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Manage client estimates and proposals</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="search-bar">
            <FiSearch className="search-icon" size={16} />
            <input type="text" placeholder="Search Q-num or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><FiPlus size={16} /> New Quotation</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>All</button>
        <button className={`tab ${activeTab === "draft" ? "active" : ""}`} onClick={() => setActiveTab("draft")}>Draft</button>
        <button className={`tab ${activeTab === "sent" ? "active" : ""}`} onClick={() => setActiveTab("sent")}>Sent</button>
        <button className={`tab ${activeTab === "accepted" ? "active" : ""}`} onClick={() => setActiveTab("accepted")}>Accepted</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Status</th><th>Quotation #</th><th>Client</th><th>Date</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((q) => (
              <tr key={q._id} onClick={() => router.push(`/quotations/${q._id}`)} className="clickable-row" style={{ cursor: "pointer" }}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <span className={`badge badge-${getStatusColor(q.status)}`} style={{ textTransform: "capitalize" }}>{getStatusIcon(q.status)} <span style={{ marginLeft: 4 }}>{q.status}</span></span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className={`badge badge-${q.workflowStatus === "approved" ? "green" : q.workflowStatus === "rejected" ? "red" : q.workflowStatus === "sent" ? "blue" : q.workflowStatus === "review" ? "orange" : "gray"}`} style={{ textTransform: "capitalize" }}>
                        WF: {q.workflowStatus || "draft"}
                      </span>
                      <span className={`badge badge-${isClientVisible(q.workflowStatus) ? "green" : "gray"}`}>
                        Client: {isClientVisible(q.workflowStatus) ? "Visible" : "Hidden"}
                      </span>
                      <span className={`badge badge-${isOwner(q.createdBy) ? "blue" : "gray"}`}>
                        Owner: {isOwner(q.createdBy) ? "Me" : "Other"}
                      </span>
                    </div>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{q.quotationNumber}</td>
                <td>{q.clientId?.name || "Unknown"}</td>
                <td>{format(new Date(q.quotationDate), "MMM d, yyyy")}</td>
                <td style={{ fontWeight: 700 }}>₹{q.total.toLocaleString("en-IN")}</td>
              </tr>
            )) : <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No quotations found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)}>
            <motion.div className="modal" style={{ maxWidth: 800 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>New Quotation</h2>
                <button className="btn-icon" onClick={() => setShowCreate(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Client *</label>
                    <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                      <option value="">Select client...</option>
                      {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Valid Until</label>
                    <input className="form-input" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
                  </div>
                </div>

                {/* Items */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label">Line Items</label>
                  <div style={{ background: "var(--bg-tertiary)", padding: 16, borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 120px 30px", gap: 12, fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                      <div>Description</div><div>Qty</div><div>Rate (₹)</div><div>Amount</div><div></div>
                    </div>
                    {form.items.map((item, index) => (
                      <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 120px 30px", gap: 12, alignItems: "center" }}>
                        <input className="form-input" placeholder="Web Development" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} />
                        <input className="form-input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
                        <input className="form-input" type="number" min="0" value={item.rate} onChange={(e) => updateItem(index, "rate", e.target.value)} />
                        <div style={{ fontWeight: 600, padding: "0 10px" }}>₹{item.amount.toLocaleString()}</div>
                        <button className="btn-icon" style={{ color: "var(--text-danger)", width: 30, height: 30 }} onClick={() => removeItem(index)}>✕</button>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm" style={{ width: "fit-content", marginTop: 8 }} onClick={addItem}><FiPlus size={14} /> Add Item</button>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tax (GST)</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={form.gstEnabled} onChange={(e) => setForm({ ...form, gstEnabled: e.target.checked })} style={{ width: 16, height: 16 }} /> Enable GST
                      </label>
                      {form.gstEnabled && (
                        <select className="form-select" style={{ flex: 1 }} value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
                          <option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input className="form-input" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} style={{ flex: 1 }} />
                      <select className="form-select" style={{ width: 100 }} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                        <option value="percentage">%</option><option value="fixed">₹</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Terms & Conditions</label>
                  <textarea className="form-textarea" rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: "space-between" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Total: <span style={{ color: "var(--text-accent)" }}>₹{calculateTotals().total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                    {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating...</> : "Create Quotation"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
