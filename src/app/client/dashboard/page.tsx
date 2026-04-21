"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiBriefcase, FiFileText, FiClock, FiCheckCircle } from "react-icons/fi";
import { format } from "date-fns";

interface DashboardPayload {
  client: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    type: string;
    gstNumber: string;
  };
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalInvoices: number;
    pendingInvoices: number;
  };
  projects: Array<{ _id: string; title: string; status: string; deadline: string | null; paymentStatus: string }>;
  invoices: Array<{ _id: string; invoiceNumber: string; total: number; status: string; dueDate: string | null; invoiceDate: string }>;
}

export default function ClientDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    if (session.user.role !== "client") {
      router.push("/dashboard");
      return;
    }

    fetch("/api/client/dashboard")
      .then((res) => res.json())
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, router]);

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  if (!data) return <div className="page-loading">Unable to load dashboard</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Client Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            Welcome, {data.client.name}
          </p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiBriefcase size={20} /></div>
          <div className="stat-value">{data.stats.totalProjects}</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><FiClock size={20} /></div>
          <div className="stat-value">{data.stats.activeProjects}</div>
          <div className="stat-label">Active Projects</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange"><FiFileText size={20} /></div>
          <div className="stat-value">{data.stats.totalInvoices}</div>
          <div className="stat-label">Invoices</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiCheckCircle size={20} /></div>
          <div className="stat-value">{data.stats.pendingInvoices}</div>
          <div className="stat-label">Pending Invoices</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Recent Projects</h3>
          {data.projects.length > 0 ? data.projects.slice(0, 6).map((p) => (
            <div key={p._id} onClick={() => router.push(`/client/projects/${p._id}`)} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-primary)", cursor: "pointer" }}>
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {p.status.replace("_", " ")} {p.deadline ? `· Due ${format(new Date(p.deadline), "MMM d, yyyy")}` : ""}
              </div>
            </div>
          )) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No projects yet</p>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Recent Invoices</h3>
          {data.invoices.length > 0 ? data.invoices.slice(0, 6).map((inv) => (
            <div key={inv._id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-primary)" }}>
              <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                ₹{inv.total.toLocaleString("en-IN")} · {inv.status}
              </div>
            </div>
          )) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No invoices yet</p>}
        </div>
      </div>
    </div>
  );
}
