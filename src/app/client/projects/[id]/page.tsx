"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiDownload, FiUpload, FiX } from "react-icons/fi";
import { addMonths, addQuarters, addYears, endOfMonth, format, isSameDay, isToday, parseISO, startOfMonth, subMonths } from "date-fns";
import { toast } from "react-toastify";
import Calendar from "react-calendar";

interface ProjectDetail {
  _id: string;
  title: string;
  status: string;
  clientStage: "planning" | "design" | "development" | "testing" | "deployment" | "handover";
  clientProgressPercent: number;
  deadline: string | null;
  cost: number;
  paymentStatus: string;
  description: string;
  files?: Array<{ key: string; name: string; size: number }>;
  notes?: Array<{
    _id: string;
    text: string;
    authorName: string;
    authorRole: "admin" | "developer" | "sales" | "client";
    createdAt: string;
  }>;
}

interface ClientInvoicePayment {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: "paid" | "unpaid" | "overdue";
  dueDate: string | null;
  invoiceDate: string;
}

interface RecurringPayment {
  _id: string;
  label: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly";
  startDate?: string;
  endDate?: string | null;
  nextDueDate: string;
  active: boolean;
}

interface PaymentLog {
  amount: number;
  label: string;
  paidAt: string;
  recurringPaymentId?: string | null;
  recurringDueDate?: string | null;
}

interface PaymentPayload {
  invoices: ClientInvoicePayment[];
  quotations: ClientQuotationPayment[];
  recurringPayments: RecurringPayment[];
  paymentHistory: PaymentLog[];
}

interface ClientQuotationPayment {
  _id: string;
  quotationNumber: string;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  quotationDate: string;
}

interface PaymentCalendarItem {
  date: Date;
  title: string;
  amount: number;
  type: "invoice" | "recurring";
  status: "paid" | "due" | "overdue";
}

export default function ClientProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [payment, setPayment] = useState<PaymentPayload>({ invoices: [], quotations: [], recurringPayments: [], paymentHistory: [] });
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadProject = async (projectId: string) => {
    const res = await fetch(`/api/client/projects/${projectId}`);
    const payload = await res.json();
    setProject(payload.project || null);
    setPayment(payload.payment || { invoices: [], quotations: [], recurringPayments: [], paymentHistory: [] });
  };

  useEffect(() => {
    if (!session || !params.id) return;
    if (session.user.role !== "client") {
      router.push("/dashboard");
      return;
    }

    loadProject(String(params.id))
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [session, params.id, router]);

  const handleDownload = async (key: string, name: string) => {
    setDownloadingKey(key);
    try {
      const response = await fetch(`/api/upload/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingKey(null);
    }
  };

  const addNote = async () => {
    if (!project || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/client/projects/${project._id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNoteText.trim() }),
      });
      if (!res.ok) throw new Error();
      await loadProject(project._id);
      setNewNoteText("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
    setAddingNote(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !project) return;

    setUploading(true);
    try {
      let uploadedCount = 0;
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", `projects/${project._id}`);

        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadData = await uploadRes.json();

        const attachRes = await fetch(`/api/projects/${project._id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: uploadData.file }),
        });
        if (!attachRes.ok) throw new Error("Failed to attach file");

        uploadedCount += 1;
      }

      await loadProject(project._id);
      toast.success(`${uploadedCount} file${uploadedCount > 1 ? "s" : ""} uploaded`);
    } catch {
      toast.error("Failed to upload files");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteFile = async (key: string) => {
    if (!project || !confirm("Remove this file?")) return;

    try {
      const storageRes = await fetch("/api/upload/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!storageRes.ok) throw new Error("Failed to delete file from storage");

      const detachRes = await fetch(`/api/projects/${project._id}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!detachRes.ok) throw new Error("Failed to update project files");

      await loadProject(project._id);
      toast.success("File removed");
    } catch {
      toast.error("Failed to remove file");
    }
  };

  if (status === "loading" || loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  if (!project) return <div className="page-loading">Project not found</div>;

  const files = project.files || [];
  const notes = project.notes || [];

  const addFrequency = (date: Date, frequency: "monthly" | "quarterly" | "yearly") => {
    if (frequency === "quarterly") return addQuarters(date, 1);
    if (frequency === "yearly") return addYears(date, 1);
    return addMonths(date, 1);
  };

  const recurringItems: PaymentCalendarItem[] = [];
  const recurringWindowStart = startOfMonth(subMonths(new Date(), 2));
  const recurringWindowEnd = endOfMonth(addMonths(new Date(), 6));

  for (const recurring of payment.recurringPayments || []) {
    if (!recurring.active) continue;

    let cursor = parseISO(recurring.startDate || recurring.nextDueDate);
    const recurringEndDate = recurring.endDate ? parseISO(recurring.endDate) : null;

    while (cursor < recurringWindowStart) {
      const next = addFrequency(cursor, recurring.frequency);
      if (next <= cursor) break;
      cursor = next;
    }

    let iterations = 0;
    while (cursor <= recurringWindowEnd && iterations < 120) {
      if (recurringEndDate && cursor > recurringEndDate) break;

      const isPaid = (payment.paymentHistory || []).some(
        (entry) => entry.recurringPaymentId === recurring._id && !!entry.recurringDueDate && isSameDay(parseISO(entry.recurringDueDate), cursor)
      );

      recurringItems.push({
        date: new Date(cursor),
        title: recurring.label,
        amount: recurring.amount,
        type: "recurring",
        status: isPaid ? "paid" : cursor < new Date() ? "overdue" : "due",
      });

      cursor = addFrequency(cursor, recurring.frequency);
      iterations += 1;
    }
  }

  const invoiceItems: PaymentCalendarItem[] = (payment.invoices || []).map((invoice) => {
    const eventDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(invoice.invoiceDate);
    return {
      date: eventDate,
      title: invoice.invoiceNumber,
      amount: invoice.total,
      type: "invoice",
      status: invoice.status === "paid" ? "paid" : eventDate < new Date() ? "overdue" : "due",
    };
  });

  const paymentCalendar = [...invoiceItems, ...recurringItems].sort((a, b) => a.date.getTime() - b.date.getTime());
  const paidInvoicesTotal = (payment.invoices || []).filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0);
  const pendingInvoicesTotal = (payment.invoices || []).filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.total, 0);
  const paidInvoiceDetails = (payment.invoices || [])
    .filter((i) => i.status === "paid")
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : new Date(a.invoiceDate).getTime();
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : new Date(b.invoiceDate).getTime();
      return bd - ad;
    });
  const recurringPaidTotal = (payment.paymentHistory || [])
    .filter((p) => !!p.recurringPaymentId)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const manualPaidTotal = (payment.paymentHistory || [])
    .filter((p) => !p.recurringPaymentId)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const recurringPendingThisMonth = recurringItems
    .filter((item) => item.status !== "paid" && item.date >= monthStart && item.date <= monthEnd)
    .reduce((sum, item) => sum + item.amount, 0);

  const quotationTotal = (payment.quotations || []).reduce((sum, q) => sum + q.total, 0);
  const quotationAcceptedTotal = (payment.quotations || [])
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + q.total, 0);
  const quotationPendingTotal = (payment.quotations || [])
    .filter((q) => q.status === "draft" || q.status === "sent")
    .reduce((sum, q) => sum + q.total, 0);

  const paymentEventsByDate = paymentCalendar.reduce((acc, item) => {
    const key = format(item.date, "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, PaymentCalendarItem[]>);

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayEvents = (paymentEventsByDate[selectedDateKey] || []).sort((a, b) => b.amount - a.amount);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-icon" onClick={() => router.push("/client/projects")}><FiArrowLeft size={18} /></button>
          <div>
            <h1>{project.title}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
              {project.status.replace("_", " ")} · Stage: {project.clientStage} · Payment: {project.paymentStatus}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Project Details</h3>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{project.description || "No description"}</p>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Progress</div>
            <div style={{ height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${project.clientProgressPercent || 0}%`, height: "100%", background: "var(--bg-accent-gradient)" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{project.clientProgressPercent || 0}% completed</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Project Amount</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-accent)" }}>₹{(project.cost || 0).toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Deadline</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Files</h3>
            <div>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: "none" }} />
              <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Uploading...</> : <><FiUpload size={13} /> Upload</>}
              </button>
            </div>
          </div>
          {files.length > 0 ? files.map((file) => (
            <div key={file.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-primary)" }}>
              <span style={{ fontSize: 13.5 }}>{file.name}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn-icon" onClick={() => handleDownload(file.key, file.name)} disabled={downloadingKey === file.key}>
                  {downloadingKey === file.key ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <FiDownload size={13} />}
                </button>
                <button className="btn-icon" onClick={() => deleteFile(file.key)} style={{ color: "var(--text-danger)" }}>
                  <FiX size={13} />
                </button>
              </div>
            </div>
          )) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No files uploaded.</p>}
        </div>
      </div>

      <div id="payment-details" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, scrollMarginTop: 90 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Payment Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Paid Invoices</div>
              <div style={{ fontWeight: 700, color: "var(--text-success)" }}>₹{paidInvoicesTotal.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Pending Invoices</div>
              <div style={{ fontWeight: 700, color: "var(--text-warning)" }}>₹{pendingInvoicesTotal.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Recurring Paid</div>
              <div style={{ fontWeight: 700, color: "var(--text-success)" }}>₹{recurringPaidTotal.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Recurring Pending ({format(calendarMonth, "MMM")})</div>
              <div style={{ fontWeight: 700, color: "var(--text-warning)" }}>₹{recurringPendingThisMonth.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Quotation Total</div>
              <div style={{ fontWeight: 700, color: "var(--text-accent)" }}>₹{quotationTotal.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Quotation Pending</div>
              <div style={{ fontWeight: 700, color: "var(--text-warning)" }}>₹{quotationPendingTotal.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ padding: 10, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Quotation Accepted + Manual Paid Logs</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--text-success)" }}>Accepted: ₹{quotationAcceptedTotal.toLocaleString("en-IN")}</span>
                <span style={{ fontWeight: 700, color: "var(--text-accent)" }}>Manual Paid: ₹{manualPaidTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FiCalendar size={15} style={{ color: "var(--text-accent)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payment Calendar (Month View)</h3>
          </div>

          <Calendar
            value={selectedDate}
            onChange={(value) => {
              if (value instanceof Date) setSelectedDate(value);
            }}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) setCalendarMonth(activeStartDate);
            }}
            tileContent={({ date, view }) => {
              if (view !== "month") return null;
              const events = paymentEventsByDate[format(date, "yyyy-MM-dd")] || [];
              if (events.length === 0) return null;
              const hasOverdue = events.some((e) => e.status === "overdue");
              const hasDue = events.some((e) => e.status === "due");
              const hasPaid = events.some((e) => e.status === "paid");

              let color = "#22c55e";
              if (hasOverdue) color = "#ef4444";
              else if (hasDue) color = "#f59e0b";
              else if (hasPaid) color = "#22c55e";

              return (
                <div style={{ marginTop: 2, display: "flex", justifyContent: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
                </div>
              );
            }}
          />

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>
              Selected Date: {format(selectedDate, "MMM d, yyyy")}
            </div>
            {selectedDayEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 170, overflowY: "auto" }}>
                {selectedDayEvents.map((item, index) => (
                  <div key={`${item.type}-${item.title}-${index}`} style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{item.type === "invoice" ? "Invoice" : "Recurring"} - {item.title}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>₹{item.amount.toLocaleString("en-IN")}</span>
                    </div>
                    <span className={`badge badge-${item.status === "paid" ? "green" : item.status === "overdue" ? "red" : "orange"}`}>
                      {item.status === "paid" ? <FiCheckCircle size={12} /> : <FiClock size={12} />} {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-tertiary)", fontSize: 12.5 }}>No payment events on this date.</p>
            )}
          </div>

          <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>Tasks are hidden from this client calendar.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Paid Amount Details For This Project</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="badge badge-green">Paid Total: ₹{paidInvoicesTotal.toLocaleString("en-IN")}</span>
          <span className="badge badge-orange">Pending Total: ₹{pendingInvoicesTotal.toLocaleString("en-IN")}</span>
          <span className="badge badge-blue">Total Invoices: {(payment.invoices || []).length}</span>
        </div>

        {paidInvoiceDetails.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {paidInvoiceDetails.map((invoice) => (
              <div key={invoice._id} style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{invoice.invoiceNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      Invoice Date: {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
                      {invoice.dueDate ? ` · Due Date: ${format(new Date(invoice.dueDate), "MMM d, yyyy")}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>₹{invoice.total.toLocaleString("en-IN")}</div>
                    <span className="badge badge-green">Paid</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No paid invoices for this project yet. Once admin marks an invoice as paid, it will appear here.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Project Notes</h3>
        {notes.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {[...notes]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((note) => (
                <div key={note._id} style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{note.authorName} ({note.authorRole})</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{note.text}</p>
                </div>
              ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginBottom: 12 }}>No notes yet.</p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Add note, reference URL, or details..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            style={{ flex: 1, minHeight: 70 }}
          />
          <button className="btn btn-primary" onClick={addNote} disabled={addingNote || !newNoteText.trim()}>
            {addingNote ? "Adding..." : "Add Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
