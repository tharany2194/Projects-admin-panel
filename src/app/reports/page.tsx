"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiTrendingUp, FiUsers, FiBriefcase, FiFileText, FiDollarSign } from "react-icons/fi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface ReportData {
  totalRevenue: number;
  totalPending: number;
  totalClients: number;
  totalProjects: number;
  totalInvoices: number;
  monthlyRevenue: { month: string; revenue: number; pending: number }[];
  clientsByRevenue: { name: string; revenue: number }[];
  projectCompletion: { status: string; count: number }[];
  paymentBreakdown: { status: string; count: number; total: number }[];
}

const PIE_COLORS = ["#6c5ce7", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  useEffect(() => {
    if (!session) return;
    const fetchData = async () => {
      try {
        const [invRes, projRes, clientRes] = await Promise.all([
          fetch("/api/invoices").then((r) => r.json()),
          fetch("/api/projects").then((r) => r.json()),
          fetch("/api/clients").then((r) => r.json()),
        ]);

        const invoices = invRes.invoices || [];
        const projects = projRes.projects || [];
        const clients = clientRes.clients || [];

        const invoiceRevenue = invoices.filter((i: { status: string }) => i.status === "paid").reduce((s: number, i: { total: number }) => s + i.total, 0);
        const clientPayments = clients.flatMap((c: { name: string; paymentHistory?: { amount: number; paidAt: string; label?: string }[] }) =>
          (c.paymentHistory || []).map((p) => ({ ...p, clientName: c.name }))
        );
        const clientRevenue = clientPayments.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
        const totalRevenue = invoiceRevenue + clientRevenue;
        const totalPending = invoices.filter((i: { status: string }) => i.status !== "paid").reduce((s: number, i: { total: number }) => s + i.total, 0);

        // Monthly revenue (last 6 months)
        const monthMap = new Map<string, { revenue: number; pending: number }>();
        for (const inv of invoices) {
          const d = new Date(inv.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const entry = monthMap.get(key) || { revenue: 0, pending: 0 };
          if (inv.status === "paid") entry.revenue += inv.total;
          else entry.pending += inv.total;
          monthMap.set(key, entry);
        }

        for (const payment of clientPayments) {
          const d = new Date(payment.paidAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const entry = monthMap.get(key) || { revenue: 0, pending: 0 };
          entry.revenue += payment.amount || 0;
          monthMap.set(key, entry);
        }

        const monthlyRevenue = Array.from(monthMap.entries()).map(([month, vals]) => ({ month, ...vals })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

        // Clients by revenue
        const clientRev = new Map<string, number>();
        for (const inv of invoices.filter((i: { status: string }) => i.status === "paid")) {
          const name = inv.clientId?.name || "Unknown";
          clientRev.set(name, (clientRev.get(name) || 0) + inv.total);
        }

        for (const payment of clientPayments) {
          const name = payment.clientName || "Unknown";
          clientRev.set(name, (clientRev.get(name) || 0) + (payment.amount || 0));
        }

        const clientsByRevenue = Array.from(clientRev.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Project completion
        const statusCount = new Map<string, number>();
        for (const proj of projects) {
          statusCount.set(proj.status, (statusCount.get(proj.status) || 0) + 1);
        }
        const projectCompletion = Array.from(statusCount.entries()).map(([status, count]) => ({ status, count }));

        // Payment breakdown
        const payMap = new Map<string, { count: number; total: number }>();
        for (const inv of invoices) {
          const entry = payMap.get(inv.status) || { count: 0, total: 0 };
          entry.count += 1;
          entry.total += inv.total;
          payMap.set(inv.status, entry);
        }

        if (clientPayments.length > 0) {
          const entry = payMap.get("client_payment") || { count: 0, total: 0 };
          entry.count += clientPayments.length;
          entry.total += clientPayments.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
          payMap.set("client_payment", entry);
        }

        const paymentBreakdown = Array.from(payMap.entries()).map(([status, vals]) => ({ status, ...vals }));

        setData({
          totalRevenue, totalPending, totalClients: clients.length, totalProjects: projects.length,
          totalInvoices: invoices.length, monthlyRevenue, clientsByRevenue, projectCompletion, paymentBreakdown,
        });
      } catch { /* empty */ }
      setLoading(false);
    };
    fetchData();
  }, [session]);

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!data) return <div className="page-loading">Failed to load reports</div>;

  const STATUS_LABELS: Record<string, string> = { new: "New", in_progress: "In Progress", completed: "Completed", on_hold: "On Hold", paid: "Paid", unpaid: "Unpaid", overdue: "Overdue", client_payment: "Client Payments" };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Business analytics and insights</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon green"><FiDollarSign size={20} /></div>
          <div className="stat-value">₹{data.totalRevenue.toLocaleString("en-IN")}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange"><FiTrendingUp size={20} /></div>
          <div className="stat-value">₹{data.totalPending.toLocaleString("en-IN")}</div>
          <div className="stat-label">Pending Payments</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><FiUsers size={20} /></div>
          <div className="stat-value">{data.totalClients}</div>
          <div className="stat-label">Total Clients</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiFileText size={20} /></div>
          <div className="stat-value">{data.totalInvoices}</div>
          <div className="stat-label">Total Invoices</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Revenue vs Pending (Monthly)</h3>
          {data.monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 10, fontSize: 13 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 40 }}>No data yet</p>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Payment Breakdown</h3>
          {data.paymentBreakdown.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={data.paymentBreakdown} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {data.paymentBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 10, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.paymentBreakdown.map((p, i) => (
                  <div key={p.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ color: "var(--text-secondary)" }}>{STATUS_LABELS[p.status] || p.status}</span>
                    <span style={{ fontWeight: 700 }}>₹{p.total.toLocaleString("en-IN")}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>({p.count})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 40 }}>No data yet</p>}
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Top Clients by Revenue</h3>
          {data.clientsByRevenue.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.clientsByRevenue.map((client, i) => (
                <div key={client.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "var(--radius-full)", background: PIE_COLORS[i % PIE_COLORS.length], color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{client.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>₹{client.revenue.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No revenue data yet</p>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Project Status Overview</h3>
          {data.projectCompletion.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.projectCompletion.map((item) => {
                const percent = data.totalProjects > 0 ? Math.round((item.count / data.totalProjects) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span style={{ textTransform: "capitalize" }}>{STATUS_LABELS[item.status] || item.status}</span>
                      <span style={{ fontWeight: 600 }}>{item.count} ({percent}%)</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${percent}%`, background: "var(--bg-accent-gradient)", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No project data yet</p>}
        </div>
      </div>
    </div>
  );
}
