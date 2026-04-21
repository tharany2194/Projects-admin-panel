"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiBell, FiAlertCircle, FiClock, FiCheckCircle, FiDollarSign, FiBriefcase, FiCalendar, FiTrash2 } from "react-icons/fi";
import { format, isPast, addDays } from "date-fns";

interface NotificationItem {
  id: string;
  type: "overdue_invoice" | "upcoming_deadline" | "pending_payment" | "completed_project";
  title: string;
  message: string;
  time: string;
  link: string;
  read: boolean;
}

const ICON_MAP: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  overdue_invoice: { icon: <FiAlertCircle size={18} />, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  upcoming_deadline: { icon: <FiClock size={18} />, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  pending_payment: { icon: <FiDollarSign size={18} />, color: "#6c5ce7", bg: "rgba(108,92,231,0.1)" },
  completed_project: { icon: <FiCheckCircle size={18} />, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
};

export default function NotificationsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  useEffect(() => {
    if (!session) return;
    const generateNotifications = async () => {
      const notifs: NotificationItem[] = [];

      // Fetch overdue invoices
      const invoicesRes = await fetch("/api/invoices?status=unpaid");
      const invoicesData = await invoicesRes.json();
      const invoices = invoicesData.invoices || [];
      for (const inv of invoices) {
        if (inv.dueDate && isPast(new Date(inv.dueDate))) {
          notifs.push({
            id: `overdue-${inv._id}`, type: "overdue_invoice",
            title: `Invoice ${inv.invoiceNumber} is overdue`,
            message: `₹${inv.total.toLocaleString("en-IN")} from ${inv.clientId?.name || "Unknown"} — due ${format(new Date(inv.dueDate), "MMM d")}`,
            time: inv.dueDate, link: `/invoices/${inv._id}`, read: false,
          });
        } else {
          notifs.push({
            id: `pending-${inv._id}`, type: "pending_payment",
            title: `Payment pending: ${inv.invoiceNumber}`,
            message: `₹${inv.total.toLocaleString("en-IN")} from ${inv.clientId?.name || "Unknown"}`,
            time: inv.createdAt, link: `/invoices/${inv._id}`, read: false,
          });
        }
      }

      // Fetch upcoming project deadlines
      const projectsRes = await fetch("/api/projects?status=in_progress");
      const projectsData = await projectsRes.json();
      const projects = projectsData.projects || [];
      for (const proj of projects) {
        if (proj.deadline) {
          const deadline = new Date(proj.deadline);
          const upcoming = addDays(new Date(), 7);
          if (deadline <= upcoming) {
            notifs.push({
              id: `deadline-${proj._id}`, type: "upcoming_deadline",
              title: `Deadline approaching: ${proj.title}`,
              message: `Due ${format(deadline, "MMM d, yyyy")} — ${proj.clientId?.name || ""}`,
              time: proj.deadline, link: `/projects/${proj._id}`, read: false,
            });
          }
        }
      }

      // Fetch recently completed projects
      const completedRes = await fetch("/api/projects?status=completed");
      const completedData = await completedRes.json();
      const completed = completedData.projects || [];
      for (const proj of completed.slice(0, 3)) {
        notifs.push({
          id: `completed-${proj._id}`, type: "completed_project",
          title: `Project completed: ${proj.title}`,
          message: proj.clientId?.name || "",
          time: proj.updatedAt || proj.createdAt, link: `/projects/${proj._id}`, read: true,
        });
      }

      notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setNotifications(notifs);
      setLoading(false);
    };

    generateNotifications();
  }, [session]);

  const dismiss = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {unread > 0 ? `${unread} unread notification${unread > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {notifications.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}>
            Mark all read
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((notif) => {
            const config = ICON_MAP[notif.type];
            return (
              <div
                key={notif.id}
                className="card"
                onClick={() => { markRead(notif.id); router.push(notif.link); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer",
                  borderLeft: notif.read ? "3px solid transparent" : `3px solid ${config.color}`,
                  opacity: notif.read ? 0.65 : 1, transition: "all 0.2s ease",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: config.bg, color: config.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {config.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{notif.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{notif.message}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {format(new Date(notif.time), "MMM d")}
                  </span>
                  <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}>
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-state-icon"><FiBell size={48} /></div>
          <h3>All caught up!</h3>
          <p>No new notifications right now</p>
        </div>
      )}
    </div>
  );
}
