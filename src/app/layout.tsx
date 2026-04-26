import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Sidebar from "@/components/Sidebar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata: Metadata = {
  title: "Axelerawebtech Admin — Business Management",
  description: "Manage clients, projects, invoices and your entire business from one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Axelerawebtech Admin",
  },
  icons: {
    apple: "/axelera-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Sidebar />
          <main className="main-content">{children}</main>
          <ToastContainer position="bottom-right" theme="colored" autoClose={3000} />
        </Providers>
      </body>
    </html>
  );
}
