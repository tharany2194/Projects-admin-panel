"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiEdit2, FiMessageCircle, FiMail, FiPhone, FiMapPin, FiTag, FiBriefcase, FiFileText, FiPlus, FiTrash2, FiDollarSign, FiRefreshCw, FiCalendar, FiCheck, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { format, isPast, addMonths, addQuarters, addYears, isSameDay, isToday, endOfMonth, startOfMonth, subMonths, parseISO } from "date-fns";
import Calendar from "react-calendar";

interface RecurringPayment {
  _id: string;
  label: string;
  amount: number;
  frequency: string;
  startDate?: string;
  endDate?: string | null;
  nextDueDate: string;
  active: boolean;
}

interface PaymentLog {
  _id?: string;
  amount: number;
  label: string;
  paidAt: string;
  notes: string;
  recurringPaymentId?: string | null;
  recurringDueDate?: string | null;
}

interface TaskItem {
  _id: string;
  title: string;
  description?: string;
  deadline: string;
  status?: string;
  priority?: string;
  projectId?: { _id: string; title: string } | string | null;
}

interface ClientDetail {
  _id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  gstNumber: string;
  tags: string[];
  notes: string;
  assignedTo?: { _id: string; name: string; role: string }[];
  recurringPayments: RecurringPayment[];
  paymentHistory: PaymentLog[];
  createdAt: string;
}

export default function ClientDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [projects, setProjects] = useState<{ _id: string; title: string; status: string; cost: number; paymentStatus: string }[]>([]);
  const [invoices, setInvoices] = useState<{ _id: string; invoiceNumber: string; total: number; status: string }[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ label: "", amount: "", frequency: "monthly", startDate: "", endDate: "" });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", label: "", notes: "", paidAt: "", recurringPaymentId: "", recurringDueDate: "" });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", status: "todo", priority: "medium", projectId: "", deadline: "" });
  const [showDayActionModal, setShowDayActionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const fetchClient = useCallback(async () => {
    if (!params.id) return;
    const [clientRes, projRes, invRes] = await Promise.all([
      fetch(`/api/clients/${params.id}`).then((r) => r.json()),
      fetch(`/api/projects?clientId=${params.id}`).then((r) => r.json()),
      fetch(`/api/invoices?clientId=${params.id}`).then((r) => r.json()),
    ]);
    
    // Fetch all tasks associated with these projects
    const projectsList = projRes.projects || [];
    const taskPromises = projectsList.map((p: { _id: string }) => fetch(`/api/tasks?projectId=${p._id}`).then((r) => r.json()));
    const taskRes = await Promise.all(taskPromises);
    const allTasks: TaskItem[] = taskRes.flatMap((res: { tasks?: TaskItem[] }) => res.tasks || []);
    const uniqueTasks = Array.from(new Map(allTasks.map((task) => [task._id, task])).values());

    setClient(clientRes.client);
    setProjects(projectsList);
    setInvoices(invRes.invoices || []);
    setTasks(uniqueTasks);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      void fetchClient();
    }, 0);
    return () => clearTimeout(timer);
  }, [session, fetchClient]);

  const addFrequency = (date: Date, frequency: string) => {
    if (frequency === "quarterly") return addQuarters(date, 1);
    if (frequency === "yearly") return addYears(date, 1);
    return addMonths(date, 1);
  };

  const addRecurringPayment = async () => {
    if (!recurringForm.label || !recurringForm.amount || !recurringForm.startDate) {
      toast.error("Label, amount and start date are required");
      return;
    }
    if (recurringForm.endDate && recurringForm.endDate < recurringForm.startDate) {
      toast.error("End date cannot be before start date");
      return;
    }

    setSaving(true);
    try {
      const newPayments = [...(client?.recurringPayments || []), {
        label: recurringForm.label,
        amount: Number(recurringForm.amount),
        frequency: recurringForm.frequency,
        startDate: recurringForm.startDate,
        endDate: recurringForm.endDate || null,
        nextDueDate: recurringForm.startDate,
        active: true,
      }];
      await fetch(`/api/clients/${client?._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recurringPayments: newPayments }) });
      toast.success("Recurring payment added!");
      setShowRecurringModal(false);
      setRecurringForm({ label: "", amount: "", frequency: "monthly", startDate: "", endDate: "" });
      fetchClient();
    } catch { toast.error("Failed"); }
    setSaving(false);
  };

  const openRecurringPaidModal = (rp: RecurringPayment, dueDate?: Date, paidDate?: Date) => {
    const targetDueDate = dueDate || parseISO(rp.nextDueDate);
    const targetPaidDate = paidDate || targetDueDate;

    setPaymentForm({
      amount: String(rp.amount),
      label: rp.label,
      notes: `Recurring - ${rp.frequency}`,
      paidAt: format(targetPaidDate, "yyyy-MM-dd"),
      recurringPaymentId: rp._id,
      recurringDueDate: format(targetDueDate, "yyyy-MM-dd"),
    });

    setShowPaymentModal(true);
  };

  const removeRecurring = async (id: string) => {
    if (!confirm("Remove this recurring payment?")) return;
    const updated = (client?.recurringPayments || []).filter((p) => p._id !== id);
    await fetch(`/api/clients/${client?._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recurringPayments: updated }) });
    toast.success("Removed");
    fetchClient();
  };

  const addPaymentLog = async () => {
    if (!paymentForm.amount || !paymentForm.label) { toast.error("Amount and label required"); return; }
    setSaving(true);
    try {
      const paidDate = paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : new Date().toISOString();
      const newHistory = [...(client?.paymentHistory || []), {
        amount: Number(paymentForm.amount),
        label: paymentForm.label,
        paidAt: paidDate,
        notes: paymentForm.notes,
        recurringPaymentId: paymentForm.recurringPaymentId || null,
        recurringDueDate: paymentForm.recurringDueDate ? new Date(paymentForm.recurringDueDate).toISOString() : null,
      }];

      let updatedRecurring: RecurringPayment[] | null = null;
      if (paymentForm.recurringPaymentId && paymentForm.recurringDueDate) {
        const targetDueDate = new Date(paymentForm.recurringDueDate);
        updatedRecurring = (client?.recurringPayments || []).map((rp) => {
          if (rp._id !== paymentForm.recurringPaymentId) return rp;
          const currentNextDue = parseISO(rp.nextDueDate);
          if (targetDueDate < currentNextDue) return rp;
          return { ...rp, nextDueDate: addFrequency(targetDueDate, rp.frequency).toISOString() };
        });
      }

      const updatePayload: { paymentHistory: PaymentLog[]; recurringPayments?: RecurringPayment[] } = {
        paymentHistory: newHistory,
      };
      if (updatedRecurring) updatePayload.recurringPayments = updatedRecurring;

      await fetch(`/api/clients/${client?._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
      toast.success("Payment logged!");
      setShowPaymentModal(false);
      setPaymentForm({ amount: "", label: "", notes: "", paidAt: "", recurringPaymentId: "", recurringDueDate: "" });
      fetchClient();
    } catch { toast.error("Failed"); }
    setSaving(false);
  };

  const saveTask = async () => {
    if (!taskForm.title) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      const url = editingTaskId ? `/api/tasks/${editingTaskId}` : "/api/tasks";
      const method = editingTaskId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskForm) });
      if (!res.ok) throw new Error();
      toast.success(editingTaskId ? "Task updated!" : "Task created for client project!");
      setShowTaskModal(false);
      setEditingTaskId(null);
      setTaskForm({ title: "", description: "", status: "todo", priority: "medium", projectId: "", deadline: "" });
      fetchClient();
    } catch { toast.error("Failed to add task"); }
    setSaving(false);
  };

  const openCreateTask = (date?: Date) => {
    setEditingTaskId(null);
    setTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: projects[0]?._id || "",
      deadline: date ? format(date, "yyyy-MM-dd") : "",
    });
    setShowTaskModal(true);
  };

  const openEditTask = (task: TaskItem) => {
    setEditingTaskId(task._id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status || "todo",
      priority: task.priority || "medium",
      projectId: typeof task.projectId === "string" ? task.projectId : task.projectId?._id || "",
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd") : "",
    });
    setShowTaskModal(true);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayActionModal(true);
  };

  const getRecurringStart = (rp: RecurringPayment) => parseISO(rp.startDate || rp.nextDueDate);
  const getRecurringEnd = (rp: RecurringPayment) => (rp.endDate ? parseISO(rp.endDate) : null);

  const isRecurringDuePaid = useCallback((recurringPaymentId: string, dueDate: Date) => {
    return (client?.paymentHistory || []).some((payment) => {
      if (payment.recurringPaymentId !== recurringPaymentId) return false;
      if (!payment.recurringDueDate) return false;
      return isSameDay(new Date(payment.recurringDueDate), dueDate);
    });
  }, [client]);

  const getMonthProjectedDues = useCallback(() => {
    const duesMap: Record<string, { dueDate: Date; recurring: RecurringPayment }[]> = {};
    const monthStart = startOfMonth(currentMonth);
    const capDate = endOfMonth(currentMonth);
    
    (client?.recurringPayments || []).forEach(rp => {
      if (!rp.active || !rp.nextDueDate) return;
      let cursor = getRecurringStart(rp);
      const recurringEnd = getRecurringEnd(rp);

      while (cursor < monthStart) {
        const nextCursor = addFrequency(cursor, rp.frequency);
        if (nextCursor <= cursor) break;
        cursor = nextCursor;
      }
      
      let iterations = 0;
      while (cursor <= capDate && iterations < 120) {
        if (recurringEnd && cursor > recurringEnd) break;
        const dateKey = format(cursor, "yyyy-MM-dd");
        if (!duesMap[dateKey]) duesMap[dateKey] = [];
        duesMap[dateKey].push({ dueDate: new Date(cursor), recurring: rp });
        
        cursor = addFrequency(cursor, rp.frequency);
        iterations++;
      }
    });
    return duesMap;
  }, [client, currentMonth]);

  if (authStatus === "loading" || loading) return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!client) return <div className="page-loading">Client not found</div>;

  const totalRecurring = (client.recurringPayments || []).filter((p) => p.active).reduce((s, p) => s + p.amount, 0);
  const overdue = (client.recurringPayments || []).filter((p) => p.active && isPast(new Date(p.nextDueDate)));
  const totalPaid = (client.paymentHistory || []).reduce((s, p) => s + p.amount, 0);

  const monthDuesMap = getMonthProjectedDues();

  const getDayData = (date: Date) => {
    const logs = (client.paymentHistory || []).filter(p => isSameDay(new Date(p.paidAt), date));
    const dateKey = format(date, "yyyy-MM-dd");
    const dueList = monthDuesMap[dateKey] || [];
    
    // Also attach tasks due on this matching date
    const tasksForDay = tasks.filter(t => t.deadline && isSameDay(new Date(t.deadline), date));
    
    return { logs, dueList, tasksForDay };
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/clients")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{client.name}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
              <span className={`badge badge-${client.type === "business" ? "blue" : "purple"}`}>{client.type}</span>
              {client.tags?.map((t) => <span key={t} className="badge badge-gray" style={{ marginLeft: 4 }}>{t}</span>)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {client.whatsapp && (
            <a href={`https://wa.me/${client.whatsapp}`} target="_blank" rel="noopener noreferrer" className="whatsapp-btn">
              <FiMessageCircle size={16} /> WhatsApp
            </a>
          )}
          {isAdmin && <button className="btn btn-secondary" onClick={() => router.push(`/clients`)}><FiEdit2 size={14} /> Edit</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Contact Info */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)" }}>Contact</h3>
          {client.email && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14 }}><FiMail size={14} style={{ color: "var(--text-tertiary)" }} /> {client.email}</div>}
          {client.phone && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14 }}><FiPhone size={14} style={{ color: "var(--text-tertiary)" }} /> {client.phone}</div>}
          {client.address && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14 }}><FiMapPin size={14} style={{ color: "var(--text-tertiary)" }} /> {client.address}</div>}
          {client.gstNumber && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><FiTag size={14} style={{ color: "var(--text-tertiary)" }} /> GSTIN: {client.gstNumber}</div>}
          {client.assignedTo && client.assignedTo.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Assigned Team</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {client.assignedTo.map((member) => (
                  <span key={member._id} className="badge badge-gray">{member.name} ({member.role})</span>
                ))}
              </div>
            </div>
          )}
          {client.notes && <div style={{ marginTop: 12, padding: 10, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--text-secondary)" }}>{client.notes}</div>}
        </div>

        {/* Payment Summary */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-tertiary)" }}>Payment Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>Monthly Recurring</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-accent)" }}>₹{totalRecurring.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>Total Collected</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-success)" }}>₹{totalPaid.toLocaleString("en-IN")}</div>
            </div>
          </div>
          {overdue.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg-danger)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--text-danger)", fontWeight: 600 }}>
              ⚠️ {overdue.length} overdue payment{overdue.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Recurring Payments */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiRefreshCw size={16} style={{ color: "var(--text-accent)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recurring Payments</h3>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--bg-accent-light)", color: "var(--text-accent)", fontWeight: 600 }}>
              {(client.recurringPayments || []).length}
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowRecurringModal(true)}><FiPlus size={14} /> Add</button>
        </div>

        {(client.recurringPayments || []).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(client.recurringPayments || []).map((rp) => {
              const isOverdue = isPast(new Date(rp.nextDueDate));
              return (
                <div key={rp._id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                  background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                  borderLeft: `3px solid ${isOverdue ? "#ef4444" : "#22c55e"}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{rp.label}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12.5, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-accent)", fontWeight: 700 }}>₹{rp.amount.toLocaleString("en-IN")}</span>
                      <span style={{ color: "var(--text-tertiary)", textTransform: "capitalize" }}>{rp.frequency}</span>
                      <span style={{ color: "var(--text-secondary)" }}>Start {format(new Date(rp.startDate || rp.nextDueDate), "MMM d, yyyy")}</span>
                      <span style={{ color: "var(--text-secondary)" }}>End {rp.endDate ? format(new Date(rp.endDate), "MMM d, yyyy") : "Ongoing"}</span>
                      <span style={{ color: isOverdue ? "var(--text-danger)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                        <FiCalendar size={11} /> {isOverdue ? "Overdue since " : "Due "}{format(new Date(rp.nextDueDate), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: "#22c55e", color: "white", border: "none" }}
                      onClick={() => openRecurringPaidModal(rp, parseISO(rp.nextDueDate), new Date())}
                      disabled={saving}
                    >
                      <FiCheck size={13} /> Log Paid
                    </button>
                    {isAdmin && (
                      <button className="btn-icon" style={{ width: 30, height: 30, color: "var(--text-danger)" }} onClick={() => removeRecurring(rp._id)}>
                        <FiTrash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 20 }}>No recurring payments set up</p>
        )}
      </div>

      {/* Payment History */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiDollarSign size={16} style={{ color: "var(--text-success)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payment History</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPaymentModal(true)}><FiPlus size={14} /> Log Payment</button>
        </div>

        {(client.paymentHistory || []).length > 0 ? (
          <div className="table-container" style={{ border: "none", boxShadow: "none" }}>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr><th>Date</th><th>Label</th><th>Amount</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {[...(client.paymentHistory || [])].reverse().map((p) => (
                    <tr key={p._id}>
                      <td>{format(new Date(p.paidAt), "MMM d, yyyy")}</td>
                      <td style={{ fontWeight: 500 }}>{p.label}</td>
                      <td style={{ fontWeight: 700, color: "var(--text-success)" }}>₹{p.amount.toLocaleString("en-IN")}</td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: 12.5 }}>{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 20 }}>No payments logged yet</p>
        )}
      </div>

      {/* Payment Calendar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiCalendar size={16} style={{ color: "var(--text-accent)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payment Calendar</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>Today</button>
            <button className="btn-icon" onClick={() => setCurrentMonth((prev) => startOfMonth(subMonths(prev, 1)))}><FiChevronLeft size={15} /></button>
            <span style={{ minWidth: 120, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{format(currentMonth, "MMMM yyyy")}</span>
            <button className="btn-icon" onClick={() => setCurrentMonth((prev) => startOfMonth(addMonths(prev, 1)))}><FiChevronRight size={15} /></button>
          </div>
        </div>

        <div className="custom-calendar-wrapper">
          <Calendar
            activeStartDate={currentMonth}
            onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setCurrentMonth(startOfMonth(activeStartDate))}
            onClickDay={handleDayClick}
            tileContent={({ date, view }) => {
              if (view !== "month") return null;
              const { logs, dueList, tasksForDay } = getDayData(date);
              const unpaidDues = dueList.filter((entry) => !isRecurringDuePaid(entry.recurring._id, entry.dueDate));
              const firstDue = unpaidDues[0];
              const isDueOverdue = firstDue && isPast(date) && !isToday(date);
              const dayAmount = logs.reduce((sum, payment) => sum + payment.amount, 0);
              
              if (dayAmount === 0 && unpaidDues.length === 0 && tasksForDay.length === 0) return null;
              
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, alignItems: "center" }}>
                  {tasksForDay.map((t) => (
                    <div
                      key={t._id}
                      role="presentation"
                      style={{ fontSize: 9, background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", padding: "2px", borderRadius: 3, fontWeight: 600, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", cursor: "pointer" }}
                      onMouseDown={(e) => {
                        // Prevent the parent calendar tile button click from firing first.
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTask(t);
                      }}
                    >
                      Task: {t.title}
                    </div>
                  ))}
                  {dayAmount > 0 && (
                    <div style={{ fontSize: 9, background: "#22c55e20", color: "#16a34a", padding: "2px", borderRadius: 3, fontWeight: 700, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      +₹{dayAmount}
                    </div>
                  )}
                  {firstDue && dayAmount === 0 && (
                    <div style={{ fontSize: 9, background: isDueOverdue ? "#ef444420" : "var(--bg-accent-light)", color: isDueOverdue ? "#dc2626" : "var(--text-accent)", padding: "2px", borderRadius: 3, fontWeight: 700, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Due{unpaidDues.length > 1 ? ` (${unpaidDues.length})` : ""}: ₹{firstDue.recurring.amount}
                    </div>
                  )}
                </div>
              );
            }}
            tileClassName={({ date, view }) => {
              if (view !== "month") return "";
              const { logs, dueList, tasksForDay } = getDayData(date);
              const unpaidDueExists = dueList.some((entry) => !isRecurringDuePaid(entry.recurring._id, entry.dueDate));
              
              const isDueOverdue = unpaidDueExists && isPast(date) && !isToday(date);
              let cls = "custom-tile ";
              if (logs.length > 0) cls += "has-paid ";
              else if (isDueOverdue) cls += "has-overdue ";
              else if (unpaidDueExists) cls += "has-due ";
              if (tasksForDay.length > 0) cls += "has-task ";
              return cls;
            }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "#22c55e", borderRadius: 2 }}/> Paid</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "var(--text-accent)", borderRadius: 2 }}/> Upcoming Due</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2 }}/> Overdue</div>
        </div>
      </div>

      {/* Projects & Invoices */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FiBriefcase size={15} style={{ color: "var(--text-accent)" }} />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Projects ({projects.length})</h3>
          </div>
          {projects.length > 0 ? projects.map((p) => (
            <div key={p._id} onClick={() => router.push(`/projects/${p._id}`)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer", marginBottom: 4 }}>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>{p.title}</span>
              <span className={`badge badge-${p.status === "completed" ? "green" : p.status === "in_progress" ? "blue" : "gray"}`}>{p.status.replace("_", " ")}</span>
            </div>
          )) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No projects</p>}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FiFileText size={15} style={{ color: "var(--text-accent)" }} />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Invoices ({invoices.length})</h3>
          </div>
          {invoices.length > 0 ? invoices.map((inv) => (
            <div key={inv._id} onClick={() => router.push(`/invoices/${inv._id}`)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer", marginBottom: 4 }}>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>{inv.invoiceNumber}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>₹{inv.total.toLocaleString("en-IN")}</span>
                <span className={`badge badge-${inv.status === "paid" ? "green" : "orange"}`}>{inv.status}</span>
              </div>
            </div>
          )) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No invoices</p>}
        </div>
      </div>

      {/* Add Recurring Payment Modal */}
      <AnimatePresence>
        {showRecurringModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRecurringModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Recurring Payment</h2>
                <button className="btn-icon" onClick={() => setShowRecurringModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Label *</label>
                  <input className="form-input" placeholder="e.g. Database Hosting, Server Maintenance" value={recurringForm.label} onChange={(e) => setRecurringForm({ ...recurringForm, label: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input className="form-input" type="number" placeholder="5000" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Frequency</label>
                    <select className="form-select" value={recurringForm.frequency} onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" value={recurringForm.startDate} onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date (optional)</label>
                  <input className="form-input" type="date" value={recurringForm.endDate} onChange={(e) => setRecurringForm({ ...recurringForm, endDate: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowRecurringModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addRecurringPayment} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : "Add Payment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Log Payment</h2>
                <button className="btn-icon" onClick={() => setShowPaymentModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Payment Date</label>
                  <input className="form-input" type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} />
                </div>
                {paymentForm.recurringPaymentId && paymentForm.recurringDueDate && (
                  <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-accent-light)", color: "var(--text-accent)", fontSize: 12.5, fontWeight: 500 }}>
                    Recurring due for {format(new Date(paymentForm.recurringDueDate), "MMM d, yyyy")}
                  </div>
                )}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Label *</label>
                    <input className="form-input" placeholder="What was this for?" value={paymentForm.label} onChange={(e) => setPaymentForm({ ...paymentForm, label: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input className="form-input" type="number" placeholder="Amount" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={2} placeholder="Optional notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addPaymentLog} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : "Log Payment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Day Action Modal */}
      <AnimatePresence>
        {showDayActionModal && selectedDate && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDayActionModal(false)}>
            <motion.div className="modal" style={{ maxWidth: 400 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Actions for {format(selectedDate, "MMM d, yyyy")}</h2>
                <button className="btn-icon" onClick={() => setShowDayActionModal(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(() => {
                  const dayData = getDayData(selectedDate);
                  const unpaidDues = dayData.dueList.filter((entry) => !isRecurringDuePaid(entry.recurring._id, entry.dueDate));
                  if (unpaidDues.length === 0) return null;

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>Recurring Dues</div>
                      {unpaidDues.map((entry) => (
                        <div key={`${entry.recurring._id}-${entry.dueDate.toISOString()}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{entry.recurring.label}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>₹{entry.recurring.amount.toLocaleString("en-IN")}</div>
                          </div>
                          <button
                            className="btn btn-sm"
                            style={{ background: "#22c55e", color: "white", border: "none" }}
                            onClick={() => {
                              setShowDayActionModal(false);
                              openRecurringPaidModal(entry.recurring, entry.dueDate, selectedDate || entry.dueDate);
                            }}
                          >
                            <FiCheck size={13} /> Mark Paid
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {(() => {
                  const dayData = getDayData(selectedDate);
                  if (dayData.tasksForDay.length === 0) return null;

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>Tasks on this day</div>
                      {dayData.tasksForDay.map((task) => (
                        <button
                          key={task._id}
                          className="btn btn-secondary"
                          style={{ width: "100%", justifyContent: "space-between" }}
                          onClick={() => {
                            openEditTask(task);
                            setShowDayActionModal(false);
                          }}
                        >
                          <span>{task.title}</span>
                          <FiEdit2 size={14} />
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", justifyContent: "center", padding: 14 }}
                  onClick={() => {
                    setPaymentForm({ amount: "", label: "", notes: "", paidAt: format(selectedDate, "yyyy-MM-dd"), recurringPaymentId: "", recurringDueDate: "" });
                    setShowDayActionModal(false);
                    setShowPaymentModal(true);
                  }}
                >
                  <FiDollarSign size={16} /> Log Payment on this Date
                </button>

                <button 
                  className="btn btn-secondary" 
                  style={{ width: "100%", justifyContent: "center", padding: 14 }}
                  onClick={() => {
                    openCreateTask(selectedDate);
                    setShowDayActionModal(false);
                  }}
                >
                  <FiCheck size={16} /> Add Task Due on this Date
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowTaskModal(false); setEditingTaskId(null); }}>
            <motion.div className="modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingTaskId ? "Edit Task" : "New Task"}</h2>
                <button className="btn-icon" onClick={() => { setShowTaskModal(false); setEditingTaskId(null); }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
                  <input className="form-input" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" rows={2} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project</label>
                  <select className="form-select" value={taskForm.projectId} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}>
                    <option value="">No Project</option>
                    {projects.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                      <option value="todo">To Do</option>
                      <option value="doing">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input className="form-input" type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowTaskModal(false); setEditingTaskId(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={saveTask} disabled={saving}>
                  {saving ? "Saving..." : editingTaskId ? "Update Task" : "Create Task"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
