"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiPrinter, FiDownload } from "react-icons/fi";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { downloadFile } from "@/lib/downloadFile";

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  discountType: "fixed" | "percentage";
  gstEnabled: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  total: number;
  status: "paid" | "unpaid" | "overdue";
  notes: string;
  pdfFileName?: string;
  pdfFileUrl?: string;
  projectId?: { title: string } | null;
}

export default function ClientInvoiceDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session || !params.id) return;
    if (session.user.role !== "client") {
      router.push("/dashboard");
      return;
    }

    fetch(`/api/client/invoices/${params.id}`)
      .then((res) => res.json())
      .then((payload) => {
        setInvoice(payload.invoice || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, params.id, router]);

  const handleDownloadPDF = async () => {
    if (!invoice?.pdfFileUrl) return;
    try {
      await downloadFile(invoice.pdfFileUrl, invoice.pdfFileName || `Invoice-${invoice.invoiceNumber}.pdf`);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  if (!invoice) return <div className="page-loading">Invoice not found</div>;

  const discountValue = invoice.discountType === "percentage"
    ? (invoice.subtotal * invoice.discount) / 100
    : invoice.discount;

  return (
    <div className="print-page-container">
      <div className="page-header no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/client/invoices")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{invoice.invoiceNumber}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
              <span className={`badge badge-${invoice.status === "paid" ? "green" : invoice.status === "overdue" ? "red" : "orange"}`}>{invoice.status}</span>
              {invoice.projectId?.title ? <span style={{ marginLeft: 8 }}>· {invoice.projectId.title}</span> : null}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {invoice.pdfFileUrl ? (handleDownloadPDF
            <button className="btn btn-sm" style={{ border: "1px solid var(--text-secondary)", color: "var(--text-secondary)" }} onClick={() => downloadFile(invoice.pdfFileUrl, invoice.pdfFileName || `Invoice-${invoice.invoiceNumber}.pdf`)}>
              <FiDownload size={14} /> Download PDF
            </button>
          ) : null}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><FiPrinter size={14} /> Print / PDF</button>
        </div>
      </div>

      <div className="card printable-document" style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid var(--border-primary)", paddingBottom: 18, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-accent)", marginBottom: 3 }}>INVOICE</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{invoice.invoiceNumber}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
            <div>Date: {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}</div>
            {invoice.dueDate ? <div>Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}</div> : null}
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
              {invoice.items.map((item, index) => (
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
              <span>₹{invoice.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {invoice.discount > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "var(--text-danger)" }}>
                <span>Discount</span>
                <span>-₹{discountValue.toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            {invoice.gstEnabled ? (
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
            ) : null}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 700, borderTop: "2px solid var(--border-primary)", marginTop: 4 }}>
              <span>Total</span>
              <span style={{ color: "var(--text-accent)" }}>₹{invoice.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div style={{ marginTop: 18, padding: 14, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4 }}>Notes</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{invoice.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
