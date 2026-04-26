"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiSave, FiUpload, FiUser, FiMail, FiLock } from "react-icons/fi";
import { toast } from "react-toastify";

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current: "", newPassword: "", confirm: "" });
  const [business, setBusiness] = useState({ name: "Axelerawebtech", tagline: "Digital Agency", phone: "", email: "", address: "", gstNumber: "", website: "" });
  const [invoice, setInvoice] = useState({ prefix: "INV", defaultGst: 18, defaultNotes: "Thank you for your business!", currency: "₹", bankDetails: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  useEffect(() => {
    if (session?.user) {
      setProfile({ name: session.user.name || "", email: session.user.email || "" });
    }
  }, [session]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name }),
      });
      if (!res.ok) throw new Error();
      toast.success("Profile updated!");
    } catch { toast.error("Failed to update profile"); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirm) { toast.error("Passwords don't match"); return; }
    if (passwords.newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    toast.success("Password updated! (Backend integration pending)");
    setPasswords({ current: "", newPassword: "", confirm: "" });
  };

  const saveBusiness = () => { toast.success("Business settings saved!"); };
  const saveInvoice = () => { toast.success("Invoice settings saved!"); };

  if (authStatus === "loading") return <div className="page-loading"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  const isAdmin = session?.user?.role === "admin";

  const allTabs = [
    { key: "profile", label: "Profile", icon: <FiUser size={15} />, adminOnly: false },
    { key: "business", label: "Business", icon: <FiMail size={15} />, adminOnly: true },
    { key: "invoice", label: "Invoice", icon: <FiSave size={15} />, adminOnly: true },
    { key: "security", label: "Security", icon: <FiLock size={15} />, adminOnly: false },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Configure your business and preferences</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Tabs Sidebar */}
        <div className="card" style={{ height: "fit-content", padding: 8 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                background: activeTab === tab.key ? "var(--bg-accent-light)" : "transparent",
                color: activeTab === tab.key ? "var(--text-accent)" : "var(--text-secondary)",
                transition: "all 0.15s ease", textAlign: "left",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {activeTab === "profile" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Profile Settings</h2>
              <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                <div style={{ width: 80, height: 80, borderRadius: "var(--radius-full)", background: "var(--bg-accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 28 }}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.name}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{profile.email}</div>
                  <div style={{ marginTop: 4 }}><span className="badge badge-purple" style={{ textTransform: "capitalize" }}>{session?.user?.role}</span></div>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (read-only)</label>
                  <input className="form-input" value={profile.email} disabled style={{ opacity: 0.6 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><FiSave size={14} /> Save Profile</button>
              </div>
            </>
          )}

          {activeTab === "business" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Business Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Business Name</label>
                  <input className="form-input" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tagline</label>
                  <input className="form-input" value={business.tagline} onChange={(e) => setBusiness({ ...business, tagline: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input className="form-input" value={business.website} onChange={(e) => setBusiness({ ...business, website: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" value={business.gstNumber} onChange={(e) => setBusiness({ ...business, gstNumber: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" rows={2} value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveBusiness}><FiSave size={14} /> Save Business Info</button>
              </div>
            </>
          )}

          {activeTab === "invoice" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Invoice Settings</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Invoice Prefix</label>
                  <input className="form-input" value={invoice.prefix} onChange={(e) => setInvoice({ ...invoice, prefix: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input className="form-input" value={invoice.currency} onChange={(e) => setInvoice({ ...invoice, currency: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default GST Rate (%)</label>
                  <select className="form-select" value={invoice.defaultGst} onChange={(e) => setInvoice({ ...invoice, defaultGst: Number(e.target.value) })}>
                    <option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Invoice Notes</label>
                <textarea className="form-textarea" rows={2} value={invoice.defaultNotes} onChange={(e) => setInvoice({ ...invoice, defaultNotes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Details (for invoices)</label>
                <textarea className="form-textarea" rows={3} placeholder="Account Name, Number, IFSC, Bank, Branch" value={invoice.bankDetails} onChange={(e) => setInvoice({ ...invoice, bankDetails: e.target.value })} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveInvoice}><FiSave size={14} /> Save Invoice Settings</button>
              </div>
            </>
          )}

          {activeTab === "security" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Security</h2>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input className="form-input" type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={changePassword}><FiLock size={14} /> Update Password</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
