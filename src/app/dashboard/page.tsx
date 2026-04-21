"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiUsers, FiBriefcase, FiDollarSign, FiAlertCircle, FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

interface DashboardData {
  stats: {
    totalClients: number;
    activeProjects: number;
    totalProjects: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    pendingPayments: number;
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
  };
  charts: {
    monthlyRevenue: { month: string; revenue: number }[];
    projectStatus: { status: string; count: number }[];
  };
  recent: {
    clients: Array<{ _id: string; name: string; type: string; createdAt: string }>;
    projects: Array<{ _id: string; title: string; status: string; clientId?: { name: string }; createdAt: string }>;
    invoices: Array<{ _id: string; invoiceNumber: string; total: number; status: string; clientId?: { name: string }; createdAt: string }>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  new: "#6c5ce7",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  on_hold: "#f59e0b",
};

const PIE_COLORS = ["#6c5ce7", "#3b82f6", "#22c55e", "#f59e0b"];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/dashboard")
        .then((res) => res.json())
        .then((d) => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [session]);

  if (authStatus === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  if (!data) return <div className="page-loading">Failed to load dashboard</div>;

  const revenueChange = data.stats.revenueLastMonth > 0
    ? ((data.stats.revenueThisMonth - data.stats.revenueLastMonth) / data.stats.revenueLastMonth * 100).toFixed(0)
    : "0";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            Welcome back, {session?.user?.name} 👋
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple"><FiUsers size={20} /></div>
          <div className="stat-value">{data.stats.totalClients}</div>
          <div className="stat-label">Total Clients</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiBriefcase size={20} /></div>
          <div className="stat-value">{data.stats.activeProjects}</div>
          <div className="stat-label">Active Projects</div>
          <div className="stat-change" style={{ color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}>
            {data.stats.totalProjects} total
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiDollarSign size={20} /></div>
          <div className="stat-value">₹{data.stats.revenueThisMonth.toLocaleString("en-IN")}</div>
          <div className="stat-label">Revenue This Month</div>
          <div className={`stat-change ${Number(revenueChange) >= 0 ? "up" : "down"}`}>
            {Number(revenueChange) >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
            {Math.abs(Number(revenueChange))}%
          </div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange"><FiAlertCircle size={20} /></div>
          <div className="stat-value">₹{data.stats.pendingPayments.toLocaleString("en-IN")}</div>
          <div className="stat-label">Pending Payments</div>
          <div className="stat-change" style={{ color: "var(--text-danger)", background: "var(--bg-danger)" }}>
            {data.stats.overdueInvoices} overdue
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Revenue Overview</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 10, fontSize: 13 }}
                formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill="url(#gradient)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6c5ce7" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Project Status</h3>
          {data.charts.projectStatus.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={data.charts.projectStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {data.charts.projectStatus.map((entry, i) => (
                      <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 10, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.charts.projectStatus.map((p) => (
                  <div key={p.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[p.status] || "#6c5ce7" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{STATUS_LABELS[p.status] || p.status}</span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>No projects yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Clients</h3>
          <div className="activity-list">
            {data.recent.clients.length > 0 ? data.recent.clients.map((c) => (
              <div key={c._id} className="activity-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/clients/${c._id}`)}>
                <div className="activity-dot purple" />
                <div>
                  <div className="activity-text">{c.name}</div>
                  <div className="activity-time">{format(new Date(c.createdAt), "MMM d, yyyy")}</div>
                </div>
              </div>
            )) : <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No clients yet</p>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Projects</h3>
          <div className="activity-list">
            {data.recent.projects.length > 0 ? data.recent.projects.map((p) => (
              <div key={p._id} className="activity-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/projects/${p._id}`)}>
                <div className="activity-dot blue" />
                <div>
                  <div className="activity-text">{p.title}</div>
                  <div className="activity-time">{p.clientId?.name} · {format(new Date(p.createdAt), "MMM d")}</div>
                </div>
              </div>
            )) : <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No projects yet</p>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Invoices</h3>
          <div className="activity-list">
            {data.recent.invoices.length > 0 ? data.recent.invoices.map((inv) => (
              <div key={inv._id} className="activity-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/invoices/${inv._id}`)}>
                <div className={`activity-dot ${inv.status === "paid" ? "green" : "orange"}`} />
                <div>
                  <div className="activity-text">{inv.invoiceNumber} — ₹{inv.total.toLocaleString("en-IN")}</div>
                  <div className="activity-time">{inv.clientId?.name} · <span className={`badge badge-${inv.status === "paid" ? "green" : inv.status === "overdue" ? "red" : "orange"}`} style={{ fontSize: 10, padding: "1px 6px" }}>{inv.status}</span></div>
                </div>
              </div>
            )) : <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No invoices yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
