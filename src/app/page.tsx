"use client";

import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="page-loading">
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (session) {
    if (session.user.role === "client") {
      redirect("/client/dashboard");
    }
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
