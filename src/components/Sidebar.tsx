"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  FiHome, FiUsers, FiBriefcase, FiFileText, FiCheckSquare,
  FiUserPlus, FiBarChart2, FiSettings, FiLogOut, FiMenu, FiX,
  FiSun, FiMoon, FiBell, FiCreditCard,
} from "react-icons/fi";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import WebPushRegistrar from "./WebPushRegistrar";

const adminNavSections = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: FiHome },
      { href: "/clients", label: "Clients", icon: FiUsers },
      { href: "/projects", label: "Projects", icon: FiBriefcase },
      { href: "/quotations", label: "Quotations", icon: FiFileText },
      { href: "/invoices", label: "Invoices", icon: FiCreditCard },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/tasks", label: "Tasks", icon: FiCheckSquare },
      { href: "/team", label: "Team", icon: FiUserPlus },
      { href: "/notifications", label: "Notifications", icon: FiBell },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: FiBarChart2 },
      { href: "/settings", label: "Settings", icon: FiSettings },
    ],
  },
];

const staffNavSections = [
  {
    title: "Work",
    items: [
      { href: "/tasks", label: "My Tasks", icon: FiCheckSquare },
      { href: "/projects", label: "My Projects", icon: FiBriefcase },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: FiSettings },
    ],
  },
];

const salesNavSections = [
  {
    title: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: FiHome },
      { href: "/clients", label: "My Clients", icon: FiUsers },
      { href: "/projects", label: "My Projects", icon: FiBriefcase },
      { href: "/quotations", label: "My Quotations", icon: FiFileText },
      { href: "/invoices", label: "My Invoices", icon: FiCreditCard },
      { href: "/tasks", label: "My Tasks", icon: FiCheckSquare },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: FiSettings },
    ],
  },
];

const clientNavSections = [
  {
    title: "Portal",
    items: [
      { href: "/client/dashboard", label: "Dashboard", icon: FiHome },
      { href: "/client/projects", label: "Projects", icon: FiBriefcase },
      { href: "/client/quotations", label: "Quotations", icon: FiFileText },
      { href: "/client/invoices", label: "Invoices", icon: FiCreditCard },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!session) return null;

  const navSections =
    session.user?.role === "admin"
      ? adminNavSections
      : session.user?.role === "client"
        ? clientNavSections
        : session.user?.role === "sales"
          ? salesNavSections
        : staffNavSections;

  const navContent = (
    <>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">C</div>
        <div>
          <h1 className="sidebar-title">{session.user?.role === "client" ? "Crowfy Client" : "Crowfy Admin"}</h1>
          <p className="sidebar-subtitle">{session.user?.role || "Admin"}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <span className="sidebar-section-title">{section.title}</span>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="sidebar-indicator"
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{session.user?.name}</span>
            <span className="sidebar-user-email">{session.user?.email}</span>
          </div>
        </div>
        <div className="sidebar-actions">
          <button onClick={toggleTheme} className="sidebar-action-btn">
            {theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="sidebar-action-btn danger"
          >
            <FiLogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <WebPushRegistrar />

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* Desktop sidebar */}
      <aside className="desktop-sidebar">{navContent}</aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="sidebar-overlay"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="mobile-sidebar"
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
