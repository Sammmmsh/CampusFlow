import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, accountPreference } from "./api";
import "./operations.css";
import "./account.css";

export default function AccountPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body,
      });
      accountPreference(true);
      navigate("/ops", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      await api("/session", { method: "POST", body: { role: "student" } });
      accountPreference(false);
      navigate("/ops", { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="cf-account-page">
      <Link to="/" className="cf-account-brand">
        Campus<span>Flow</span>
      </Link>
      <section className="cf-account-card" aria-labelledby="account-title">
        <p className="cf-eyebrow">A PLACE FOR YOUR CAMPUS PLANS</p>
        <h1 id="account-title">
          {mode === "login"
            ? "Good to see you again."
            : mode === "join"
              ? "Your team is waiting."
              : "Make it your workspace."}
        </h1>
        <p>
          {mode === "login"
            ? "Sign in to pick up where you left off."
            : mode === "join"
              ? "Use the invitation code shared by your workspace owner."
              : "Create a workspace, then invite your team with the roles they need."}
        </p>
        <div className="cf-account-tabs" aria-label="Account options">
          {[
            ["login", "Sign in"],
            ["register", "Create workspace"],
            ["join", "Join a team"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={busy}
              onClick={() => {
                setMode(value);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p className="cf-account-error" role="alert">
            {error === "This origin is not allowed." ? (
              <>
                Please use the main CampusFlow site to sign in or create a
                workspace.{" "}
                <a href="https://campusflow-ops.vercel.app/ops/sign-in">
                  Open CampusFlow sign-in
                </a>
              </>
            ) : (
              error
            )}
          </p>
        )}
        <form key={mode} onSubmit={submit}>
          {mode !== "login" && (
            <label className="cf-field">
              Full name
              <input required name="name" autoComplete="name" maxLength={80} />
            </label>
          )}
          <label className="cf-field">
            Email address
            <input
              required
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
            />
          </label>
          <label className="cf-field">
            Password
            <input
              required
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? undefined : 12}
              maxLength={72}
              aria-describedby="password-help"
            />
          </label>
          <p id="password-help" className="cf-footnote">
            {mode === "login"
              ? "Use your workspace password. Email password recovery is not available yet."
              : "Use at least 12 characters. Email verification and password recovery are not available yet."}
          </p>
          {mode === "join" && (
            <label className="cf-field">
              Invitation code
              <input
                required
                name="invitation"
                autoComplete="off"
                minLength={64}
                maxLength={64}
              />
            </label>
          )}
          <button className="cf-button primary" type="submit" disabled={busy}>
            {busy
              ? "Connecting…"
              : mode === "login"
                ? "Sign in to workspace"
                : mode === "join"
                  ? "Join workspace"
                  : "Create my workspace"}
          </button>
        </form>
        {mode === "register" && (
          <p className="cf-footnote">
            New workspaces start with a sample equipment catalogue and no
            bookings. The owner can handle each workflow role; invited members
            get an assigned role.
          </p>
        )}
        <div className="cf-account-demo">
          <p>Just having a look around?</p>
          <button
            type="button"
            className="cf-button secondary"
            disabled={busy}
            onClick={demo}
          >
            Try the sample workspace
          </button>
        </div>
      </section>
    </main>
  );
}
