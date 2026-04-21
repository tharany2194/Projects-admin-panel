"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface ProjectItem {
  _id: string;
  title: string;
  status: string;
  clientStage: "planning" | "design" | "development" | "testing" | "deployment" | "handover";
  clientProgressPercent: number;
  deadline: string | null;
  cost: number;
  paymentStatus: string;
  description: string;
  tasks: Array<{ title: string; done: boolean }>;
  files: Array<{ key: string; name: string }>;
  updatedAt: string;
}

export default function ClientProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
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

    fetch("/api/client/projects")
      .then((res) => res.json())
      .then((payload) => {
        setProjects(payload.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, router]);

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Projects</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{projects.length} project(s)</p>
        </div>
      </div>

      {projects.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {projects.map((p) => (
            <div
              key={p._id}
              className="card"
              onClick={() => router.push(`/client/projects/${p._id}`)}
              style={{
                cursor: "pointer",
                border: "1px solid var(--border-primary)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{p.title}</h3>
                <span className={`badge badge-${p.paymentStatus === "paid" ? "green" : p.paymentStatus === "advance" ? "blue" : "orange"}`}>{p.paymentStatus}</span>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, minHeight: 36 }}>
                {p.description || "Project details and updates from your team."}
              </p>

              <div style={{ marginTop: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                  <span>Progress</span>
                  <span>{p.clientProgressPercent || 0}%</span>
                </div>
                <div style={{ height: 7, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${p.clientProgressPercent || 0}%`, height: "100%", background: "var(--bg-accent-gradient)" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Stage</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{p.clientStage || "planning"}</div>
                </div>
                <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Project Amount</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>₹{(p.cost || 0).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Status</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.status.replace("_", " ")}</div>
                </div>
                <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Deadline</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.deadline ? format(new Date(p.deadline), "MMM d, yyyy") : "N/A"}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
                Files: {p.files.length}
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/client/projects/${p._id}#payment-details`);
                  }}
                >
                  View Payment Breakdown
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card empty-state">
          <h3>No projects yet</h3>
          <p>Your project updates will appear here.</p>
        </div>
      )}
    </div>
  );
}
