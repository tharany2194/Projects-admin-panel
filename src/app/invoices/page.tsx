"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format } from "date-fns";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  workflowStatus?: "draft" | "review" | "sent" | "approved" | "rejected";
  invoiceDate: string;
  dueDate: string | null;
  clientId?: { _id: string; name: string };
  projectId?: { title: string };
  createdBy?: string | { _id?: string; name?: string };
  items: { description: string; quantity: number; rate: number; amount: number }[];
  createdAt: string;
}

interface ClientOption { _id: string; name: string; }
interface ProjectOption { _id: string; title: string; }

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

export default function InvoicesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: "", projectId: "", invoiceDate: format(new Date(), "yyyy-MM-dd"), dueDate: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
    discount: 0, discountType: "fixed" as "fixed" | "percentage", gstEnabled: false, gstRate: 18, status: "unpaid", notes: "",
  });

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchInvoices = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }, [activeStatus]);

  useEffect(() => {
    if (session) {
      fetchInvoices();
      fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
      fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || []));
    }
  }, [session, fetchInvoices]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...form.items];
    (newItems[index] as Record<string, unknown>)[field] = value;
    if (field === "quantity" || field === "rate") {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    setForm({ ...form, items: newItems });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, amount: 0 }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const calcSubtotal = () => form.items.reduce((sum, item) => sum + item.amount, 0);
  const calcDiscount = () => {
    const sub = calcSubtotal();
    return form.discountType === "percentage" ? sub * (form.discount / 100) : form.discount;
  };
  const calcGST = () => {
    if (!form.gstEnabled) return { cgst: 0, sgst: 0, total: 0 };
    const afterDiscount = calcSubtotal() - calcDiscount();
    const halfRate = form.gstRate / 2;
    const cgst = afterDiscount * (halfRate / 100);
    const sgst = afterDiscount * (halfRate / 100);
    return { cgst, sgst, total: cgst + sgst };
  };
  const calcTotal = () => calcSubtotal() - calcDiscount() + calcGST().total;

  const handleSave = async () => {
    if (!form.clientId || form.items.length === 0) { toast.error("Client and items are required"); return; }
    setSaving(true);
    const gst = calcGST();
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, subtotal: calcSubtotal(), cgst: gst.cgst, sgst: gst.sgst, total: calcTotal(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Invoice created!");
      setShowModal(false);
      fetchInvoices();
    } catch { toast.error("Failed to create invoice"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    try { await fetch(`/api/invoices/${id}`, { method: "DELETE" }); toast.success("Invoice deleted"); fetchInvoices(); }
    catch { toast.error("Failed to delete"); }
  };

  const markPaid = async (id: string) => {
    try {
      await fetch(`/api/invoices/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
      toast.success("Marked as paid!");
      fetchInvoices();
    } catch { toast.error("Failed to update"); }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  const isAdmin = session?.user?.role === "admin";
  const currentUserId = session?.user?.id || "";

  const isOwner = (createdBy: Invoice["createdBy"]) => {
    const ownerId = typeof createdBy === "string" ? createdBy : createdBy?._id;
    return Boolean(ownerId) && String(ownerId) === String(currentUserId);
  };

  const isClientVisible = (workflowStatus?: Invoice["workflowStatus"]) => {
    return workflowStatus === "sent" || workflowStatus === "approved";
  };

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {invoices.length} invoices · Revenue: ₹{totalRevenue.toLocaleString("en-IN")} · Pending: ₹{totalPending.toLocaleString("en-IN")}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ clientId: clients[0]?._id || "", projectId: "", invoiceDate: format(new Date(), "yyyy-MM-dd"), dueDate: "", items: [{ description: "", quantity: 1, rate: 0, amount: 0 }], discount: 0, discountType: "fixed", gstEnabled: false, gstRate: 18, status: "unpaid", notes: "" }); setShowModal(true); }}>
          <FiPlus size={16} /> Create Invoice
        </button>
      </div>

      <div className="tabs">
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeStatus === tab.key ? "active" : ""}`} onClick={() => setActiveStatus(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {invoices.length > 0 ? (
        <div className="table-container">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} onClick={() => router.push(`/invoices/${inv._id}`)} className="clickable-row" style={{ cursor: "pointer" }}>
                    <td><span style={{ fontWeight: 600, color: "var(--text-accent)" }}>{inv.invoiceNumber}</span></td>
                    <td>{inv.clientId?.name || "—"}</td>
                    <td>{inv.projectId?.title || "—"}</td>
                    <td style={{ fontWeight: 600 }}>₹{inv.total.toLocaleString("en-IN")}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <span className={`badge badge-${inv.status === "paid" ? "green" : inv.status === "overdue" ? "red" : "orange"}`}>{inv.status}</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span className={`badge badge-${inv.workflowStatus === "approved" ? "green" : inv.workflowStatus === "rejected" ? "red" : inv.workflowStatus === "sent" ? "blue" : inv.workflowStatus === "review" ? "orange" : "gray"}`} style={{ textTransform: "capitalize" }}>
                            WF: {inv.workflowStatus || "draft"}
                          </span>
                          <span className={`badge badge-${isClientVisible(inv.workflowStatus) ? "green" : "gray"}`}>
                            Client: {isClientVisible(inv.workflowStatus) ? "Visible" : "Hidden"}
                          </span>
                          <span className={`badge badge-${isOwner(inv.createdBy) ? "blue" : "gray"}`}>
                            Owner: {isOwner(inv.createdBy) ? "Me" : "Other"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{format(new Date(inv.invoiceDate), "MMM d, yyyy")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isAdmin && inv.status !== "paid" && (
                          <button className="btn btn-sm" style={{ background: "var(--bg-success)", color: "var(--text-success)", border: "none", padding: "5px 10px", fontSize: 11.5 }} onClick={() => markPaid(inv._id)}>Paid</button>
                        )}
                        {isAdmin && <button className="btn-icon" style={{ color: "var(--text-danger)" }} onClick={() => handleDelete(inv._id)}><FiTrash2 size={14} /></button>}
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
          <div className="empty-state-icon">🧾</div>
          <h3>No invoices yet</h3>
          <p>Create your first invoice to start billing</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus size={16} /> Create Invoice</button>
        </div>
      )}

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal" style={{ maxWidth: 700, maxHeight: "90vh", overflow: "auto" }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create Invoice</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Client *</label>
                    <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                      <option value="">Select</option>
                      {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Project</label>
                    <select className="form-select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                      <option value="">None</option>
                      {projects.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invoice Date</label>
                    <input className="form-input" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input className="form-input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                  </div>
                </div>

                {/* Items */}
                <div style={{ marginTop: 8 }}>
                  <label className="form-label">Items</label>
                  <div style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px 10px" }}>Description</th>
                          <th style={{ padding: "8px 10px", width: 70 }}>Qty</th>
                          <th style={{ padding: "8px 10px", width: 100 }}>Rate (₹)</th>
                          <th style={{ padding: "8px 10px", width: 100 }}>Amount</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: 4 }}><input className="form-input" style={{ fontSize: 13, padding: "6px 8px" }} placeholder="Website development" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} /></td>
                            <td style={{ padding: 4 }}><input className="form-input" type="number" min={1} style={{ fontSize: 13, padding: "6px 8px" }} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} /></td>
                            <td style={{ padding: 4 }}><input className="form-input" type="number" style={{ fontSize: 13, padding: "6px 8px" }} value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} /></td>
                            <td style={{ padding: "4px 10px", fontWeight: 600 }}>₹{item.amount.toLocaleString("en-IN")}</td>
                            <td style={{ padding: 4 }}>{form.items.length > 1 && <button className="btn-icon" style={{ width: 28, height: 28, color: "var(--text-danger)" }} onClick={() => removeItem(i)}><FiTrash2 size={12} /></button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addItem}><FiPlus size={14} /> Add Item</button>
                </div>

                {/* GST & Discount */}
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={form.gstEnabled} onChange={(e) => setForm({ ...form, gstEnabled: e.target.checked })} style={{ width: 16, height: 16 }} />
                      Enable GST
                    </label>
                    {form.gstEnabled && (
                      <select className="form-select" style={{ marginTop: 6 }} value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST</option>
                        <option value={28}>28% GST</option>
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="form-input" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} style={{ flex: 1 }} />
                      <select className="form-select" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "fixed" | "percentage" })} style={{ width: 100 }}>
                        <option value="fixed">₹</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div style={{ marginTop: 16, padding: 16, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span>Subtotal</span><span>₹{calcSubtotal().toLocaleString("en-IN")}</span>
                  </div>
                  {form.discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "var(--text-danger)" }}>
                      <span>Discount</span><span>-₹{calcDiscount().toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {form.gstEnabled && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span>CGST ({form.gstRate / 2}%)</span><span>₹{calcGST().cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span>SGST ({form.gstRate / 2}%)</span><span>₹{calcGST().sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--border-primary)", paddingTop: 8 }}>
                    <span>Total</span><span>₹{calcTotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={2} placeholder="Payment terms, notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating...</> : "Create Invoice"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
