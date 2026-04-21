"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiPrinter, FiDownload, FiMessageCircle, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { motion } from "framer-motion";

type WorkflowStatus = "draft" | "review" | "sent" | "approved" | "rejected";

interface WorkflowHistoryEntry {
  action: WorkflowStatus;
  actorName?: string;
  actorRole?: string;
  note?: string;
  at: string;
}

interface QuotationDetail {
  _id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string | null;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  discountType: "fixed" | "percentage";
  gstEnabled: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  workflowStatus?: WorkflowStatus;
  workflowHistory?: WorkflowHistoryEntry[];
  notes?: string;
  terms?: string;
  clientId?: { name?: string; email?: string; phone?: string; whatsapp?: string; address?: string; gstNumber?: string };
}

export default function QuotationDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const isAdmin = session?.user?.role === "admin";
  const isSales = session?.user?.role === "sales";

  const progressSteps: Array<{ key: "draft" | "review" | "sent"; label: string }> = [
    { key: "draft", label: "Draft" },
    { key: "review", label: "In Review" },
    { key: "sent", label: "Sent to Client" },
  ];

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchQuotation = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await fetch(`/api/quotations/${params.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotation(data.quotation);
    } catch { toast.error("Failed to load quotation"); }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { if (session) fetchQuotation(); }, [session, fetchQuotation]);

  const handlePrint = () => {
    window.print();
  };

  const workflowStatus: WorkflowStatus = quotation?.workflowStatus || "draft";
  const normalizedWorkflowStatus: "draft" | "review" | "sent" =
    workflowStatus === "draft" ? "draft" : workflowStatus === "review" ? "review" : "sent";
  const currentStepIndex = progressSteps.findIndex((step) => step.key === normalizedWorkflowStatus);
  const flowPercent = currentStepIndex <= 0 ? 0 : (currentStepIndex / (progressSteps.length - 1)) * 100;
  const canMoveToReview = workflowStatus === "draft";
  const canSendToClient = workflowStatus === "review";
  const canDeleteQuotation = isAdmin && (workflowStatus === "draft" || workflowStatus === "review");

  const updateWorkflow = async (nextStatus: WorkflowStatus) => {
    if (!quotation) return;
    setSaving(true);
    try {
      const workflowNote = window.prompt(`Add a note for moving to ${nextStatus} (optional):`) || "";
      const res = await fetch(`/api/quotations/${quotation._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: nextStatus, workflowNote }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update workflow");
      }

      const payload = await res.json();
      setQuotation(payload.quotation || null);
      toast.success(`Workflow moved to ${nextStatus}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update workflow";
      toast.error(message);
    }
    setSaving(false);
  };

  const deleteQuotation = async () => {
    if (!quotation) return;
    if (!window.confirm("Delete this quotation?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${quotation._id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete quotation");
      }
      toast.success("Quotation deleted");
      router.push("/quotations");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete quotation";
      toast.error(message);
    }
    setSaving(false);
  };

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!quotation) return <div className="page-loading">Quotation not found</div>;

  const client = quotation.clientId;
  const whatsappMsg = encodeURIComponent(`Hello ${client?.name}, here is your quotation (${quotation.quotationNumber}) for ₹${quotation.total.toLocaleString("en-IN")}. Please review and let us know if you have any questions.`);

  return (
    <div className="print-page-container">
      {/* Non-printable header actions */}
      <div className="page-header no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/quotations")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>Quotation {quotation.quotationNumber}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
              <span className={`badge badge-${quotation.status === "accepted" ? "green" : quotation.status === "rejected" ? "red" : quotation.status === "sent" ? "blue" : "gray"}`} style={{ textTransform: "capitalize" }}>
                {quotation.status}
              </span>
              <span className={`badge badge-${normalizedWorkflowStatus === "sent" ? "blue" : normalizedWorkflowStatus === "review" ? "orange" : "gray"}`} style={{ textTransform: "capitalize", marginLeft: 8 }}>
                Flow: {normalizedWorkflowStatus}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canDeleteQuotation && (
            <button className="btn btn-sm" style={{ border: "1px solid var(--text-danger)", color: "var(--text-danger)", background: "var(--bg-danger)" }} onClick={deleteQuotation} disabled={saving}>
              <FiTrash2 size={13} /> Delete
            </button>
          )}
          {client?.whatsapp && <a href={`https://wa.me/${client.whatsapp}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer" className="whatsapp-btn btn-sm"><FiMessageCircle size={14} /> Send</a>}
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><FiPrinter size={14} /> Print / PDF</button>
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
            <div className="flow-title">Quotation Flow</div>
            <div className="flow-current-chip">
              <span className="flow-current-dot" />
              {normalizedWorkflowStatus}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isAdmin || isSales) && <button className="btn btn-sm" onClick={() => updateWorkflow("review")} disabled={saving || !canMoveToReview}>Move to Review</button>}
            {isAdmin && <button className="btn btn-sm" onClick={() => updateWorkflow("sent")} disabled={saving || !canSendToClient}>Send to Client</button>}
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

      {/* Printable Area */}
      <div className="printable-document" ref={printRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid var(--border-primary)", paddingBottom: 24, marginBottom: 24 }}>
          <div>
            <img src="/crowfy-logo.png" alt="Crowfy" style={{ height: 40, marginBottom: 16 }} />
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>QUOTATION</h2>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Ref: {quotation.quotationNumber}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 16, marginBottom: 4 }}>Crowfy Digital</div>
            <div>contact@crowfy.com</div>
            <div>+91 98765 43210</div>
            <div>GSTIN: 33AAAAA0000A1Z5</div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Quotation For</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{client?.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {client?.address && <div>{client.address}</div>}
              {client?.phone && <div>{client.phone}</div>}
              {client?.email && <div>{client.email}</div>}
              {client?.gstNumber && <div style={{ marginTop: 4 }}>GSTIN: {client.gstNumber}</div>}
            </div>
          </div>
          <div style={{ background: "var(--bg-tertiary)", padding: 16, borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
              <div><div style={{ color: "var(--text-tertiary)", marginBottom: 2 }}>Date</div><div style={{ fontWeight: 600 }}>{format(new Date(quotation.quotationDate), "MMM d, yyyy")}</div></div>
              {quotation.validUntil && <div><div style={{ color: "var(--text-tertiary)", marginBottom: 2 }}>Valid Until</div><div style={{ fontWeight: 600 }}>{format(new Date(quotation.validUntil), "MMM d, yyyy")}</div></div>}
              <div><div style={{ color: "var(--text-tertiary)", marginBottom: 2 }}>Total Amount</div><div style={{ fontWeight: 700, color: "var(--text-accent)", fontSize: 16 }}>₹{quotation.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div></div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="detail-items-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ background: "var(--bg-tertiary)", borderBottom: "2px solid var(--border-primary)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Description</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", width: 80 }}>Qty</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", width: 120 }}>Rate</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", width: 140 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <td style={{ padding: "16px", fontSize: 13.5, fontWeight: 500 }}>{item.description}</td>
                <td style={{ padding: "16px", fontSize: 13.5, textAlign: "center", color: "var(--text-secondary)" }}>{item.quantity}</td>
                <td style={{ padding: "16px", fontSize: 13.5, textAlign: "right", color: "var(--text-secondary)" }}>₹{item.rate.toLocaleString("en-IN")}</td>
                <td style={{ padding: "16px", fontSize: 14, textAlign: "right", fontWeight: 600 }}>₹{item.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 40 }}>
          <div style={{ width: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
              <span>Subtotal</span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{quotation.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {quotation.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "var(--text-danger)", borderBottom: "1px solid var(--border-primary)" }}>
                <span>Discount ({quotation.discountType === "percentage" ? `${quotation.discount}%` : "Fixed"})</span><span style={{ fontWeight: 600 }}>-₹{(quotation.discountType === "percentage" ? (quotation.subtotal * quotation.discount / 100) : quotation.discount).toLocaleString("en-IN")}</span>
              </div>
            )}
            {quotation.gstEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
                <span>CGST ({(quotation.gstRate / 2).toFixed(1)}%)</span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{quotation.cgst.toLocaleString("en-IN")}</span>
              </div>
            )}
            {quotation.gstEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
                <span>SGST ({(quotation.gstRate / 2).toFixed(1)}%)</span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{quotation.sgst.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontSize: 18, fontWeight: 800, color: "var(--text-accent)" }}>
              <span>Total</span><span>₹{quotation.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, fontSize: 12, color: "var(--text-secondary)", padding: 24, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
          {quotation.terms && (
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, textTransform: "uppercase" }}>Terms & Conditions</div>
              <div style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{quotation.terms}</div>
            </div>
          )}
          {quotation.notes && (
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, textTransform: "uppercase" }}>Notes</div>
              <div style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{quotation.notes}</div>
            </div>
          )}
        </div>
      </div>

      <motion.div
        className="card no-print"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        style={{ maxWidth: 820, margin: "16px auto 0", padding: 14 }}
      >
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Timeline</div>
        {quotation.workflowHistory && quotation.workflowHistory.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {quotation.workflowHistory
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
