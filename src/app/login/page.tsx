"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiMail, FiLock, FiArrowRight } from "react-icons/fi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ marginLeft: 0 }}>
      <div className="auth-card">
        <div className="auth-logo">
          
          <span className="auth-logo-text">Axelerawebtech</span>
        </div>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to manage your business</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div style={{ position: "relative" }}>
              <FiMail
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: 40 }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <FiLock
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: 40 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                Signing in...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Sign In <FiArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        <p className="auth-link">
          Don&apos;t have an account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
