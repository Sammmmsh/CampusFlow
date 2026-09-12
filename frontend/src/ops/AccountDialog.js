import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { api } from "./api";
import "./account.css";

export default function AccountDialog({ data, open, onClose, onRefresh }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invite, setInvite] = useState(null),
    [message, setMessage] = useState("");
  async function submit(event, path) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    try {
      const result = await api(path, {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      if (path === "/auth/invite") setInvite(result);
      else {
        setMessage("Password updated. Other sessions have been signed out.");
        form.reset();
        await onRefresh();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="account-dialog-title"
    >
      <DialogTitle id="account-dialog-title">Your account</DialogTitle>
      <DialogContent dividers tabIndex={0} className="cf-account-settings">
        <p>
          <strong>{data.name}</strong> ·{" "}
          {data.owner ? "Workspace owner" : "Team member"}
        </p>
        {error && (
          <p role="alert" className="cf-account-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {data.owner && (
          <section>
            <h2>Invite a teammate</h2>
            <p>
              The code works once, for the email and role below, and expires
              after 48 hours. Share it privately with that person.
            </p>
            <form onSubmit={(e) => submit(e, "/auth/invite")}>
              <label className="cf-field">
                Teammate email
                <input required type="email" name="email" maxLength={254} />
              </label>
              <label className="cf-field">
                Assigned role
                <select name="role">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty approver</option>
                  <option value="inventory">Inventory manager</option>
                </select>
              </label>
              <button className="cf-button primary" disabled={busy}>
                Create invitation
              </button>
            </form>
            {invite && (
              <div className="cf-invite-result" role="status">
                <p>
                  Invitation for {invite.email} · {invite.role}
                </p>
                <label className="cf-field">
                  Share this invitation code
                  <textarea
                    readOnly
                    rows={3}
                    value={invite.code}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p>Open /ops/sign-in and choose “Join a team”.</p>
              </div>
            )}
          </section>
        )}
        <section>
          <h2>Change password</h2>
          <form onSubmit={(e) => submit(e, "/auth/password")}>
            <label className="cf-field">
              Current password
              <input
                required
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={72}
              />
            </label>
            <label className="cf-field">
              New password
              <input
                required
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
              />
            </label>
            <p className="cf-footnote">
              At least 12 characters. Changing it signs out other sessions.
            </p>
            <button className="cf-button secondary" disabled={busy}>
              Update password
            </button>
          </form>
        </section>
      </DialogContent>
      <DialogActions>
        <button
          className="cf-button secondary"
          onClick={onClose}
          disabled={busy}
        >
          Close account settings
        </button>
      </DialogActions>
    </Dialog>
  );
}
