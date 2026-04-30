"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiPrinter, FiCheckCircle, FiXCircle, FiDownload } from "react-icons/fi";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { downloadFile } from "@/lib/downloadFile";

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
  workflowStatus?: "draft" | "review" | "sent" | "approved" | "rejected";
  notes: string;
  terms: string;
  pdfFileName?: string;
  pdfFileUrl?: string;
}

export default function ClientQuotationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session || !params.id) return;
    if (session.user.role !== "client") {
      router.push("/dashboard");
      return;
    }

    fetch(`/api/client/quotations/${params.id}`)
      .then((res) => res.json())
      .then((payload) => {
        setQuotation(payload.quotation || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, params.id, router]);

  const updateStatus = async (newStatus: "accepted" | "rejected") => {
    if (!quotation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/client/quotations/${quotation._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setQuotation(payload.quotation || quotation);
      toast.success(`Quotation marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
    setSaving(false);
  };

  const handleDownloadPDF = async () => {
    if (!quotation?.pdfFileUrl) return;
    try {
      await downloadFile(quotation.pdfFileUrl, quotation.pdfFileName || `Quotation-${quotation.quotationNumber}.pdf`);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  if (!quotation) return <div className="page-loading">Quotation not found</div>;

  const discountValue = quotation.discountType === "percentage"
    ? (quotation.subtotal * quotation.discount) / 100
    : quotation.discount;
  const canRespond = quotation.status === "sent" && quotation.workflowStatus === "sent";

  return (
    <div className="print-page-container">
      <div className="page-header no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/client/quotations")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{quotation.quotationNumber}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
              <span className={`badge badge-${quotation.status === "accepted" ? "green" : quotation.status === "rejected" ? "red" : quotation.status === "sent" ? "blue" : "gray"}`} style={{ textTransform: "capitalize" }}>
                {quotation.status}
              </span>
              {quotation.validUntil ? <span style={{ marginLeft: 8 }}>· Valid till {format(new Date(quotation.validUntil), "MMM d, yyyy")}</span> : null}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {canRespond ? (
            <button className="btn btn-sm" style={{ background: "var(--bg-success)", color: "var(--text-success)", border: "1px solid currentColor" }} onClick={() => updateStatus("accepted")} disabled={saving}>
              <FiCheckCircle size={14} /> Accept
            </button>
          ) : null}
          {canRespond ? (
            <button className="btn btn-sm" style={{ background: "var(--bg-danger)", color: "var(--text-danger)", border: "1px solid currentColor" }} onClick={() => updateStatus("rejected")} disabled={saving}>
              <FiXCircle size={14} /> Reject
            </button>
          ) : null}
          {quotation.pdfFileUrl ? (
            <button className="btn btn-sm" style={{ border: "1px solid var(--text-secondary)", color: "var(--text-secondary)" }} onClick={handleDownloadPDF} disabled={saving}>
              <FiDownload size={14} /> Download PDF
            </button>
          ) : null}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><FiPrinter size={14} /> Print / PDF</button>
        </div>
      </div>

      <div className="card printable-document" style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid var(--border-primary)", paddingBottom: 18, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-accent)", marginBottom: 3 }}>QUOTATION</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{quotation.quotationNumber}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
            <div>Date: {format(new Date(quotation.quotationDate), "MMM d, yyyy")}</div>
            {quotation.validUntil ? <div>Valid Until: {format(new Date(quotation.validUntil), "MMM d, yyyy")}</div> : null}
          </div>
        </div>

        <div style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 20 }}>
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
              {quotation.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: "10px 14px" }}>{index + 1}</td>
                  <td style={{ padding: "10px 14px" }}>{item.description}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>₹{item.rate.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>₹{item.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 290 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span>₹{quotation.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {quotation.discount > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "var(--text-danger)" }}>
                <span>Discount</span>
                <span>-₹{discountValue.toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            {quotation.gstEnabled ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>CGST ({quotation.gstRate / 2}%)</span>
                  <span>₹{quotation.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>SGST ({quotation.gstRate / 2}%)</span>
                  <span>₹{quotation.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            ) : null}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 700, borderTop: "2px solid var(--border-primary)", marginTop: 4 }}>
              <span>Total</span>
              <span style={{ color: "var(--text-accent)" }}>₹{quotation.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {quotation.terms ? (
          <div style={{ marginTop: 18, padding: 14, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4 }}>Terms</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{quotation.terms}</p>
          </div>
        ) : null}

        {quotation.notes ? (
          <div style={{ marginTop: 12, padding: 14, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4 }}>Notes</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{quotation.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
