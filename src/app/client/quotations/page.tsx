"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface QuotationItem {
  _id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string | null;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  workflowStatus?: "draft" | "review" | "sent" | "approved" | "rejected";
}

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

export default function ClientQuotationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("");

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);

    const res = await fetch(`/api/client/quotations?${params}`);
    const payload = await res.json();
    setQuotations(payload.quotations || []);
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
    fetchQuotations();
  }, [session, router, fetchQuotations]);

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  const getBadgeColor = (statusKey: string) => {
    if (statusKey === "accepted") return "green";
    if (statusKey === "rejected") return "red";
    if (statusKey === "sent") return "blue";
    return "gray";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Quotations</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {quotations.length} quotation(s)
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

      {quotations.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Date</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => (
                <tr key={quotation._id} onClick={() => router.push(`/client/quotations/${quotation._id}`)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600, color: "var(--text-accent)" }}>{quotation.quotationNumber}</td>
                  <td>{format(new Date(quotation.quotationDate), "MMM d, yyyy")}</td>
                  <td>{quotation.validUntil ? format(new Date(quotation.validUntil), "MMM d, yyyy") : "-"}</td>
                  <td>
                    <span className={`badge badge-${getBadgeColor(quotation.status)}`} style={{ textTransform: "capitalize" }}>
                      {quotation.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{quotation.total.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty-state">
          <h3>No quotations yet</h3>
          <p>Your quotations will appear here once shared.</p>
        </div>
      )}
    </div>
  );
}
