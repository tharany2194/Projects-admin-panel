"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiDownload, FiMessageCircle, FiMail, FiEdit2, FiPrinter } from "react-icons/fi";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  discountType: string;
  gstEnabled: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  total: number;
  status: string;
  workflowStatus?: "draft" | "review" | "sent" | "approved" | "rejected";
  workflowHistory?: {
    action: "draft" | "review" | "sent" | "approved" | "rejected";
    actorName?: string;
    actorRole?: string;
    note?: string;
    at: string;
  }[];
  notes: string;
  clientId?: { _id: string; name: string; email: string; phone: string; whatsapp: string; address: string; gstNumber: string };
  projectId?: { title: string };
  createdAt: string;
}

export default function InvoiceDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.user?.role === "admin";
  const isSales = session?.user?.role === "sales";

  const progressSteps: Array<{ key: "draft" | "review" | "sent"; label: string }> = [
    { key: "draft", label: "Draft" },
    { key: "review", label: "In Review" },
    { key: "sent", label: "Sent to Client" },
  ];

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  useEffect(() => {
    if (session && params.id) {
      fetch(`/api/invoices/${params.id}`).then((r) => r.json()).then((d) => { setInvoice(d.invoice); setLoading(false); });
    }
  }, [session, params.id]);

  const markPaid = async () => {
    try {
      await fetch(`/api/invoices/${invoice?._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
      toast.success("Marked as paid!");
      setInvoice(invoice ? { ...invoice, status: "paid" } : null);
    } catch { toast.error("Failed to update"); }
  };

  const workflowStatus = (invoice?.workflowStatus || "draft") as NonNullable<InvoiceDetail["workflowStatus"]>;
  const normalizedWorkflowStatus: "draft" | "review" | "sent" =
    workflowStatus === "draft" ? "draft" : workflowStatus === "review" ? "review" : "sent";
  const currentStepIndex = progressSteps.findIndex((step) => step.key === normalizedWorkflowStatus);
  const flowPercent = currentStepIndex <= 0 ? 0 : (currentStepIndex / (progressSteps.length - 1)) * 100;
  const canMoveToReview = workflowStatus === "draft";
  const canSendToClient = workflowStatus === "review";
  const canMarkPaid = isAdmin && invoice?.status !== "paid" && normalizedWorkflowStatus === "sent";

  const updateWorkflow = async (nextStatus: NonNullable<InvoiceDetail["workflowStatus"]>) => {
    try {
      const note = window.prompt(`Add a note for moving to ${nextStatus} (optional):`) || "";
      const res = await fetch(`/api/invoices/${invoice?._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: nextStatus, workflowNote: note }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update workflow");
      }

      const payload = await res.json();
      setInvoice(payload.invoice || null);
      toast.success(`Workflow moved to ${nextStatus}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update workflow";
      toast.error(message);
    }
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!invoice) return <div className="page-loading">Invoice not found</div>;

  return (
    <div className="print-page-container">
      <div className="page-header no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/invoices")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{invoice.invoiceNumber}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
              <span className={`badge badge-${invoice.status === "paid" ? "green" : invoice.status === "overdue" ? "red" : "orange"}`}>{invoice.status}</span>
              <span className={`badge badge-${normalizedWorkflowStatus === "sent" ? "blue" : normalizedWorkflowStatus === "review" ? "orange" : "gray"}`} style={{ marginLeft: 8, textTransform: "capitalize" }}>
                Flow: {normalizedWorkflowStatus}
              </span>
              {invoice.projectId && <span style={{ marginLeft: 8 }}>· {invoice.projectId.title}</span>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {invoice.clientId?.whatsapp && (
            <a href={`https://wa.me/${invoice.clientId.whatsapp}?text=${encodeURIComponent(`Hi ${invoice.clientId.name}, here's your invoice ${invoice.invoiceNumber} for ₹${invoice.total.toLocaleString("en-IN")}`)}`} target="_blank" rel="noopener noreferrer" className="whatsapp-btn">
              <FiMessageCircle size={16} /> WhatsApp
            </a>
          )}
          {canMarkPaid && <button className="btn btn-primary btn-sm" onClick={markPaid}>Mark as Paid</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><FiPrinter size={14} /> Print / PDF</button>
        </div>
      </div>

      <motion.div
        className="no-print"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{}}
      >
        <div className="flow-strip">
        <div className="flow-header">
          <div className="flow-title-wrap">
            <div className="flow-title">Invoice Flow</div>
            <div className="flow-current-chip">
              <span className="flow-current-dot" />
              {normalizedWorkflowStatus}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isAdmin || isSales) && <button className="btn btn-sm" onClick={() => updateWorkflow("review")} disabled={!canMoveToReview}>Move to Review</button>}
            {isAdmin && <button className="btn btn-sm" onClick={() => updateWorkflow("sent")} disabled={!canSendToClient}>Send to Client</button>}
          </div>
        </div>

        <div className="flow-track">
          <motion.div
            className="flow-track-fill"
            initial={{ width: 0 }}
            animate={{ width: `${flowPercent}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{}}
          />
        </div>

        <div className="flow-step-grid">
          {progressSteps.map((step, idx) => {
            const done = idx <= currentStepIndex;
            const active = idx === currentStepIndex;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0.75, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`flow-step-card ${done ? "done" : ""} ${active ? "active" : ""}`}
              >
                <div className="flow-step-row">
                  <div className="flow-step-index">{idx + 1}</div>
                  <span className="flow-step-label">{step.label}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
        </div>
      </motion.div>

      {/* Invoice Preview */}
      <div className="card printable-document" style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, paddingBottom: 20, borderBottom: "2px solid var(--border-primary)" }}>
          <div>
            <img src="/crowfy-logo.png" alt="Crowfy" style={{ height: 40, marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-accent)", marginBottom: 4 }}>INVOICE</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{invoice.invoiceNumber}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Crowfy</div>
            <div style={{ color: "var(--text-secondary)" }}>
              <div>Date: {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}</div>
              {invoice.dueDate && <div>Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}</div>}
            </div>
          </div>
        </div>

        {/* Bill To */}
        {invoice.clientId && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 6 }}>Bill To</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{invoice.clientId.name}</div>
            {invoice.clientId.email && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{invoice.clientId.email}</div>}
            {invoice.clientId.phone && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{invoice.clientId.phone}</div>}
            {invoice.clientId.address && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{invoice.clientId.address}</div>}
            {invoice.clientId.gstNumber && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>GSTIN: {invoice.clientId.gstNumber}</div>}
          </div>
        )}

        {/* Items Table */}
        <div style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 24 }}>
          <table className="detail-items-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 14px" }}>#</th>
                <th style={{ padding: "10px 14px" }}>Description</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Qty</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Rate</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "10px 14px" }}>{i + 1}</td>
                  <td style={{ padding: "10px 14px" }}>{item.description}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>₹{item.rate.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>₹{item.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span>₹{invoice.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {invoice.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "var(--text-danger)" }}>
                <span>Discount ({invoice.discountType === "percentage" ? `${invoice.discount}%` : "flat"})</span>
                <span>-₹{(invoice.discountType === "percentage" ? invoice.subtotal * invoice.discount / 100 : invoice.discount).toLocaleString("en-IN")}</span>
              </div>
            )}
            {invoice.gstEnabled && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>CGST ({invoice.gstRate / 2}%)</span>
                  <span>₹{invoice.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>SGST ({invoice.gstRate / 2}%)</span>
                  <span>₹{invoice.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 700, borderTop: "2px solid var(--border-primary)", marginTop: 6 }}>
              <span>Total</span>
              <span style={{ color: "var(--text-accent)" }}>₹{invoice.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 24, padding: 16, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)", marginBottom: 4 }}>Notes</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{invoice.notes}</p>
          </div>
        )}
      </div>

      <motion.div
        className="card no-print"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        style={{ maxWidth: 820, margin: "16px auto 0", padding: 14 }}
      >
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Timeline</div>
        {invoice.workflowHistory && invoice.workflowHistory.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {invoice.workflowHistory
              .slice()
              .reverse()
              .map((entry, index) => (
                <motion.div
                  key={`${entry.at}-${index}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: 10, alignItems: "start" }}
                >
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: "var(--text-accent)" }} />
                  </div>
                  <div style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: 9, background: "var(--bg-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12.5, textTransform: "capitalize", fontWeight: 700 }}>{entry.action}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{format(new Date(entry.at), "MMM d, yyyy h:mm a")}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 3 }}>
                      {entry.actorName || "System"}{entry.actorRole ? ` (${entry.actorRole})` : ""}
                    </div>
                    {entry.note ? <div style={{ marginTop: 5, fontSize: 12, padding: "5px 7px", borderRadius: 8, background: "var(--bg-tertiary)" }}>{entry.note}</div> : null}
                  </div>
                </motion.div>
              ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", padding: "10px 9px", border: "1px dashed var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
            No workflow activity recorded yet.
          </div>
        )}
      </motion.div>
    </div>
  );
}
