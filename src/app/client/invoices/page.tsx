"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: "paid" | "unpaid" | "overdue";
  invoiceDate: string;
  dueDate: string | null;
  projectId?: { title: string } | null;
}

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

export default function ClientInvoicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);

    const res = await fetch(`/api/client/invoices?${params}`);
    const payload = await res.json();
    setInvoices(payload.invoices || []);
    setLoading(false);
  }, [activeStatus]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    if (session.user.role !== "client") {
      router.push("/dashboard");
      return;
    }
    fetchInvoices();
  }, [session, router, fetchInvoices]);

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0);
  const pendingTotal = invoices.filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.total, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Invoices</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {invoices.length} invoice(s) · Paid: ₹{paidTotal.toLocaleString("en-IN")} · Pending: ₹{pendingTotal.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeStatus === tab.key ? "active" : ""}`} onClick={() => setActiveStatus(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {invoices.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Project</th>
                <th>Date</th>
                <th>Due</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id} onClick={() => router.push(`/client/invoices/${invoice._id}`)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600, color: "var(--text-accent)" }}>{invoice.invoiceNumber}</td>
                  <td>{invoice.projectId?.title || "-"}</td>
                  <td>{format(new Date(invoice.invoiceDate), "MMM d, yyyy")}</td>
                  <td>{invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}</td>
                  <td>
                    <span className={`badge badge-${invoice.status === "paid" ? "green" : invoice.status === "overdue" ? "red" : "orange"}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{invoice.total.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty-state">
          <h3>No invoices yet</h3>
          <p>Your invoices will appear here once shared.</p>
        </div>
      )}
    </div>
  );
}
