import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import {
  SchoolRounded,
  DashboardRounded,
  AssignmentOutlined,
  Inventory2Outlined,
  HistoryRounded,
  HubOutlined,
  ArrowForwardRounded,
  AddRounded,
  SearchRounded,
  CloseRounded,
  CheckRounded,
  ArrowBackRounded,
  ScheduleRounded,
  PlaceOutlined,
  KeyboardArrowDownRounded,
  MenuRounded,
  CameraAltOutlined,
  SpeakerOutlined,
  VideocamOutlined,
  MemoryRounded,
  EastRounded,
  CheckCircleOutlineRounded,
  RefreshRounded,
  ErrorOutlineRounded,
} from "@mui/icons-material";
import Students from "../assets/students.svg";
import { api, ensureSession } from "./api";
import "./operations.css";

const theme = createTheme({
  palette: { primary: { main: "#6941c6" } },
  typography: { fontFamily: "'Poppins', sans-serif" },
  shape: { borderRadius: 18 },
});
const roleNames = {
  student: "Student",
  faculty: "Faculty approver",
  inventory: "Inventory manager",
};
const icons = {
  Photography: CameraAltOutlined,
  Presentation: VideocamOutlined,
  Audio: SpeakerOutlined,
  Electronics: MemoryRounded,
};
const statusNames = {
  pending: "Awaiting approval",
  approved: "Approved",
  allocated: "Ready to collect",
  collected: "Checked out",
  returned: "Returned",
  rejected: "Not approved",
  cancelled: "Cancelled",
};
const sections = [
  { path: "/ops", label: "Overview", icon: DashboardRounded },
  { path: "/ops/requests", label: "Requests", icon: AssignmentOutlined },
  { path: "/ops/equipment", label: "Equipment", icon: Inventory2Outlined },
  { path: "/ops/activity", label: "Activity", icon: HistoryRounded },
  { path: "/ops/integrations", label: "Integrations", icon: HubOutlined },
];
const steps = ["pending", "approved", "allocated", "collected", "returned"];
const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
const formatTime = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const localDate = (offset) => {
  const d = new Date(Date.now() + offset * 3600000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function Status({ value, label }) {
  return (
    <span className={`cf-status ${value}`}>
      {label || statusNames[value] || value}
    </span>
  );
}
function EquipmentIcon({ category, small }) {
  const Icon = icons[category] || Inventory2Outlined;
  return (
    <span
      className={`cf-equipment-icon ${category?.toLowerCase()} ${small ? "small" : ""}`}
    >
      <Icon />
    </span>
  );
}

export default function Operations() {
  const location = useLocation();
  const page = location.pathname.split("/")[2] || "overview";
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null),
    [newRequest, setNewRequest] = useState(false),
    [preselected, setPreselected] = useState("1"),
    [note, setNote] = useState("");
  const headingRef = useRef(null);
  const load = useCallback(async () => {
    setError("");
    try {
      await ensureSession();
      setData(await api("/dashboard"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    document.title = `${sections.find((s) => s.path === location.pathname)?.label || "Overview"} · CampusFlow`;
    setMenu(false);
    setFilter("all");
    setQuery("");
  }, [location.pathname]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const perform = async (task, message) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
      setData(await api("/dashboard"));
      if (message) setToast(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const switchRole = (role) =>
    perform(
      () => api("/session/role", { method: "POST", body: { role } }),
      `Now viewing as ${roleNames[role].toLowerCase()}.`,
    );
  const openNew = (equipment) => {
    setPreselected(String(equipment || 1));
    setNewRequest(true);
  };
  const requests = data?.requests || [],
    equipment = data?.equipment || [];
  const filtered = requests.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      `${r.title} ${r.equipment_name} ${r.requester}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const detail = requests.find((r) => r.id === selected);
  const pending = requests.filter((r) => r.status === "pending").length;
  const active = requests.filter((r) =>
    ["approved", "allocated", "collected"].includes(r.status),
  ).length;
  const overdue = requests.filter(
    (r) => r.status === "collected" && new Date(r.ends_at) < new Date(),
  ).length;
  const act = async (action) => {
    const ok = await perform(
      () =>
        api(`/requests/${detail.id}/${action}`, {
          method: "POST",
          body: { note },
        }),
      action === "approve"
        ? "Approved. Availability reserved and calendar sync queued."
        : "Request updated. The handoff is recorded.",
    );
    if (ok) setNote("");
  };
  const allowedActions = detail
    ? data.role === "faculty" && detail.status === "pending"
      ? [
          ["approve", "Approve request"],
          ["reject", "Decline with reason"],
        ]
      : data.role === "inventory"
        ? {
            approved: [["allocate", "Mark ready to collect"]],
            allocated: [["collect", "Record collection"]],
            collected: [["return", "Confirm return"]],
          }[detail.status] || []
        : data.role === "student" && detail.status === "pending"
          ? [["cancel", "Cancel request"]]
          : []
    : [];

  return (
    <ThemeProvider theme={theme}>
      <div className="cf-app">
        <a className="cf-skip" href="#workspace">
          Skip to workspace
        </a>
        <aside
          className={`cf-sidebar ${menu ? "open" : ""}`}
          aria-label="Main navigation"
        >
          <Link to="/" className="cf-brand">
            <span className="cf-brand-mark">
              <SchoolRounded />
            </span>
            <span>
              Campus<span className="cf-purple">Flow</span>
              <small>ROOM FOR YOUR IDEAS</small>
            </span>
          </Link>
          <div className="cf-workspace-label">
            <span className="cf-campus-avatar">C</span>
            <div>
              Campus workspace<small>Equipment & operations</small>
            </div>
            <KeyboardArrowDownRounded />
          </div>
          <p className="cf-nav-caption">WORKSPACE</p>
          <nav>
            {sections.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/ops"}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <Icon />
                <span>{label}</span>
                {label === "Requests" && pending > 0 && (
                  <span className="cf-count">{pending}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="cf-sidebar-bottom">
            <div className="cf-demo-note">
              <span className="cf-demo-dot" />
              Your own little campus
              <p>
                This is a private demo with sample people and equipment. Try
                every role; your changes stay in this workspace.
              </p>
            </div>
            <Link to="/choose" className="cf-portal-link">
              <SchoolRounded /> Academic portal <EastRounded />
            </Link>
            <Link to="/" className="cf-home-link">
              <ArrowBackRounded /> Back to CampusFlow
            </Link>
          </div>
        </aside>
        {menu && (
          <button
            className="cf-menu-shade"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="cf-main">
          <header className="cf-topbar">
            <div className="cf-breadcrumb">
              <button
                className="cf-icon-button cf-mobile-menu"
                aria-label="Open navigation"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <MenuRounded />
              </button>
              <span>Workspace</span>
              <span>/</span>
              <strong>
                {sections.find((s) => s.path === location.pathname)?.label ||
                  "Overview"}
              </strong>
            </div>
            <div className="cf-topbar-right">
              <span className="cf-demo-pill">Interactive demo</span>
              <span className="cf-avatar">
                {data?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2) || "CF"}
              </span>
            </div>
          </header>
          <main
            id="workspace"
            tabIndex="-1"
            className="cf-content"
            ref={headingRef}
          >
            {error && (
              <div className="cf-alert" role="alert">
                <ErrorOutlineRounded />
                <span>{error}</span>
                <button onClick={load} disabled={busy}>
                  Retry
                </button>
                <button
                  className="cf-icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <CloseRounded />
                </button>
              </div>
            )}
            {loading ? (
              <div className="cf-loading" role="status">
                <span className="cf-loading-orbit" />
                <h1>Opening your campus…</h1>
                <p>
                  Getting your equipment and requests ready. The demo may need a
                  minute to wake up on your first visit.
                </p>
              </div>
            ) : !data ? (
              <div className="cf-empty">
                <HubOutlined />
                <h1>Let’s get you connected.</h1>
                <p>
                  The operations service isn’t responding yet. Your academic
                  portal is separate and unchanged.
                </p>
                <button
                  className="cf-button primary"
                  onClick={() => {
                    setLoading(true);
                    load();
                  }}
                >
                  Try connection again
                </button>
                <Link to="/" className="cf-text-link">
                  Back to CampusFlow
                </Link>
              </div>
            ) : (
              <>
                <div className="cf-page-heading">
                  <div>
                    <p className="cf-eyebrow">
                      {new Date().toLocaleDateString("en-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <h1>
                      {page === "overview"
                        ? `Hey ${data.name.split(" ")[0]}, let’s make things happen.`
                        : {
                            requests: "A little less chasing.",
                            equipment: "Good ideas deserve good equipment.",
                            activity: "Every handoff, accounted for.",
                            integrations: "Keep everything in the loop.",
                          }[page]}
                    </h1>
                    <p className="cf-subtitle">
                      {
                        {
                          overview:
                            "Your campus plans, with all the moving parts in one place.",
                          requests:
                            "Follow each request from the first idea to the final return.",
                          equipment:
                            "Find what you need for the thing you’re planning.",
                          activity:
                            "A shared history of decisions, collections and returns.",
                          integrations:
                            "Approvals stay safe, even when the calendar has an off day.",
                        }[page]
                      }
                    </p>
                  </div>
                  <div className="cf-heading-controls">
                    <label className="cf-role-label">
                      Explore as
                      <select
                        aria-label="Demo role"
                        value={data.role}
                        onChange={(e) => switchRole(e.target.value)}
                        disabled={busy}
                      >
                        {Object.entries(roleNames).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {data.role === "student" && (
                      <button
                        className="cf-button primary"
                        onClick={() => openNew()}
                      >
                        <AddRounded /> New request
                      </button>
                    )}
                  </div>
                </div>
                {page === "overview" && (
                  <>
                    <section className="cf-welcome">
                      <div>
                        <span className="cf-kicker">
                          SMALL PLANS. BIG CAMPUS ENERGY.
                        </span>
                        <h2>
                          Make room for
                          <br />
                          your next big idea.
                        </h2>
                        <p>
                          A camera for your club. A mic for your first open
                          night.
                          <br className="cf-desktop" /> Find it, request it,
                          make it happen.
                        </p>
                        <Link to="/ops/equipment" className="cf-button white">
                          Explore equipment <ArrowForwardRounded />
                        </Link>
                      </div>
                      <img
                        src={Students}
                        alt="Students sharing ideas and learning together"
                      />
                    </section>
                    <section
                      className="cf-stats"
                      aria-label="Workspace at a glance"
                    >
                      {[
                        {
                          title: "Awaiting approval",
                          value: pending,
                          icon: ScheduleRounded,
                          text:
                            data.role === "faculty"
                              ? "Ready for your review"
                              : "With your faculty coordinator",
                          color: "amber",
                        },
                        {
                          title: "Active bookings",
                          value: active,
                          icon: Inventory2Outlined,
                          text: "Approved, ready or checked out",
                          color: "purple",
                        },
                        {
                          title: "Returns to follow up",
                          value: overdue,
                          icon: HistoryRounded,
                          text: overdue
                            ? "A friendly nudge goes a long way"
                            : "Everything is right on time",
                          color: "rose",
                        },
                      ].map(({ title, value, icon: Icon, text, color }) => (
                        <article className="cf-stat" key={title}>
                          <span className={`cf-stat-icon ${color}`}>
                            <Icon />
                          </span>
                          <div>
                            <p>{title}</p>
                            <strong>{value.toString().padStart(2, "0")}</strong>
                            <small>{text}</small>
                          </div>
                        </article>
                      ))}
                    </section>
                    <div className="cf-overview-grid">
                      <section className="cf-panel">
                        <div className="cf-panel-heading">
                          <div>
                            <h2>Your plans in motion</h2>
                            <p>A quick look at what’s happening.</p>
                          </div>
                          <Link to="/ops/requests" className="cf-text-link">
                            View all <EastRounded />
                          </Link>
                        </div>
                        <RequestList
                          requests={requests.slice(0, 4)}
                          onSelect={(id) => {
                            setSelected(id);
                            setNote("");
                          }}
                        />
                      </section>
                      <section className="cf-panel cf-how">
                        <span className="cf-kicker">FROM IDEA TO DONE</span>
                        <h2>
                          Good things happen
                          <br />
                          with a little flow.
                        </h2>
                        {[
                          [
                            "01",
                            "Make a request",
                            "Tell us what you need and when.",
                          ],
                          [
                            "02",
                            "Get the go-ahead",
                            "Faculty checks the plan and availability.",
                          ],
                          [
                            "03",
                            "Pick up & make it happen",
                            "The desk team handles the handoff.",
                          ],
                          [
                            "04",
                            "Bring it back",
                            "Leave it ready for the next big idea.",
                          ],
                        ].map(([num, title, text]) => (
                          <div className="cf-how-step" key={num}>
                            <span>{num}</span>
                            <div>
                              <h3>{title}</h3>
                              <p>{text}</p>
                            </div>
                          </div>
                        ))}
                      </section>
                    </div>
                  </>
                )}
                {page === "requests" && (
                  <section className="cf-panel">
                    <div className="cf-request-tools">
                      <div
                        className="cf-filter-tabs"
                        role="group"
                        aria-label="Filter requests"
                      >
                        {[
                          ["all", "All requests"],
                          ["pending", "Awaiting approval"],
                          ["allocated", "Ready to collect"],
                          ["collected", "Checked out"],
                          ["returned", "Returned"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            aria-pressed={filter === value}
                            className={filter === value ? "active" : ""}
                            onClick={() => setFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <label className="cf-search">
                        <SearchRounded />
                        <input
                          aria-label="Search requests"
                          placeholder="Find a request…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                    </div>
                    <RequestList
                      requests={filtered}
                      onSelect={(id) => {
                        setSelected(id);
                        setNote("");
                      }}
                    />
                    <div className="cf-list-footer">
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "request" : "requests"} · All
                      times shown in your local time zone.
                    </div>
                  </section>
                )}
                {page === "equipment" && (
                  <>
                    <div className="cf-equipment-tools">
                      <div
                        className="cf-filter-tabs"
                        role="group"
                        aria-label="Equipment category"
                      >
                        {[
                          "all",
                          "Presentation",
                          "Photography",
                          "Audio",
                          "Electronics",
                        ].map((category) => (
                          <button
                            key={category}
                            aria-pressed={filter === category}
                            className={filter === category ? "active" : ""}
                            onClick={() => setFilter(category)}
                          >
                            {category === "all" ? "All equipment" : category}
                          </button>
                        ))}
                      </div>
                      <label className="cf-search">
                        <SearchRounded />
                        <input
                          aria-label="Search equipment"
                          placeholder="Find your next essential…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="cf-equipment-grid">
                      {equipment
                        .filter(
                          (e) =>
                            (filter === "all" || e.category === filter) &&
                            `${e.name} ${e.description}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                        )
                        .map((e) => (
                          <article className="cf-equipment-card" key={e.id}>
                            <div
                              className={`cf-equipment-visual ${e.category.toLowerCase()}`}
                            >
                              <EquipmentIcon category={e.category} />
                              <span>{e.category}</span>
                            </div>
                            <div className="cf-equipment-body">
                              <div className="cf-equipment-title">
                                <h2>{e.name}</h2>
                                <span>
                                  {e.capacity}{" "}
                                  {e.capacity === 1 ? "unit" : "units"}
                                </span>
                              </div>
                              <p>{e.description}</p>
                              <div className="cf-location">
                                <PlaceOutlined />
                                {e.location}
                              </div>
                              <button
                                className="cf-button secondary"
                                disabled={data.role !== "student"}
                                onClick={() => openNew(e.id)}
                              >
                                {data.role === "student"
                                  ? "Request equipment"
                                  : "Switch to student to request"}
                                <EastRounded />
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                    <p className="cf-footnote">
                      Inventory totals are shown above. Availability for your
                      dates is checked again when faculty approves the request.
                    </p>
                  </>
                )}
                {page === "activity" && (
                  <section className="cf-panel">
                    <div className="cf-panel-heading">
                      <div>
                        <h2>The campus paper trail</h2>
                        <p>
                          Recorded by the service, with the person and time
                          attached.
                        </p>
                      </div>
                      <span className="cf-small-tag">
                        {data.events.length} events
                      </span>
                    </div>
                    <div className="cf-activity-list">
                      {data.events.map((event) => (
                        <article key={event.id} className="cf-activity-event">
                          <span className={`cf-event-icon ${event.action}`}>
                            <CheckRounded />
                          </span>
                          <div>
                            <h3>
                              {event.actor}{" "}
                              <span>
                                {{
                                  created: "submitted a request",
                                  approved: "approved a request",
                                  allocated: "prepared equipment",
                                  collected: "recorded a collection",
                                  returned: "confirmed a return",
                                  rejected: "declined a request",
                                  cancelled: "cancelled a request",
                                }[event.action] || event.action}
                              </span>
                            </h3>
                            <button
                              className="cf-inline-link"
                              onClick={() => setSelected(event.request_id)}
                            >
                              {event.title}
                            </button>
                            <p>{event.detail}</p>
                          </div>
                          <time dateTime={event.created_at}>
                            {formatDate(event.created_at)}
                            <br />
                            {formatTime(event.created_at)}
                          </time>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {page === "integrations" && (
                  <div className="cf-integration-layout">
                    <section className="cf-panel">
                      <div className="cf-panel-heading">
                        <div className="cf-integration-title">
                          <span className="cf-integration-logo">
                            <ScheduleRounded />
                          </span>
                          <div>
                            <h2>Campus calendar</h2>
                            <p>
                              {data.calendarMode === "google"
                                ? "Google Calendar API"
                                : "Demo calendar provider · no external events are sent"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`cf-status ${data.calendarFailure ? "rejected" : "returned"}`}
                        >
                          {data.calendarFailure
                            ? "Simulated outage"
                            : "Ready to sync"}
                        </span>
                      </div>
                      <div className="cf-integration-copy">
                        <h3>A hiccup shouldn’t lose a booking.</h3>
                        <p>
                          Approval saves the reservation and a calendar job
                          together. If the calendar is unavailable, the booking
                          stays approved and the job can safely retry.
                        </p>
                        {data.role !== "student" && (
                          <div className="cf-integration-actions">
                            {data.calendarMode === "demo" && (
                              <button
                                className="cf-button secondary"
                                disabled={busy}
                                onClick={() =>
                                  perform(
                                    () =>
                                      api("/integrations/failure", {
                                        method: "POST",
                                        body: {
                                          enabled: !data.calendarFailure,
                                        },
                                      }),
                                    data.calendarFailure
                                      ? "Demo calendar recovered. Retry pending jobs."
                                      : "Outage simulated. New approvals will still be saved.",
                                  )
                                }
                              >
                                <ErrorOutlineRounded />
                                {data.calendarFailure
                                  ? "Recover demo calendar"
                                  : "Simulate calendar outage"}
                              </button>
                            )}
                            <button
                              className="cf-button primary"
                              disabled={
                                busy ||
                                !data.jobs.some((j) => j.state !== "synced")
                              }
                              onClick={() =>
                                perform(
                                  () =>
                                    api("/integrations/retry", {
                                      method: "POST",
                                      body: {},
                                    }),
                                  "Sync attempted. Check each job’s result below.",
                                )
                              }
                            >
                              <RefreshRounded />
                              Retry pending jobs
                            </button>
                          </div>
                        )}
                        {data.role === "student" && (
                          <p className="cf-footnote">
                            Switch to faculty or inventory manager to try the
                            recovery controls.
                          </p>
                        )}
                      </div>
                      <div className="cf-jobs">
                        {data.jobs.length ? (
                          data.jobs.map((j) => (
                            <article key={j.id}>
                              <div>
                                <h3>{j.title}</h3>
                                <p>
                                  {j.attempts}{" "}
                                  {j.attempts === 1 ? "attempt" : "attempts"}
                                  {j.last_error && ` · ${j.last_error}`}
                                </p>
                                {j.provider_id && (
                                  <small>Event ID: {j.provider_id}</small>
                                )}
                              </div>
                              <Status
                                value={
                                  j.state === "synced"
                                    ? "returned"
                                    : j.state === "failed"
                                      ? "rejected"
                                      : "pending"
                                }
                                label={
                                  j.state === "synced"
                                    ? "Synced"
                                    : j.state === "failed"
                                      ? "Needs retry"
                                      : "Pending sync"
                                }
                              />
                            </article>
                          ))
                        ) : (
                          <div className="cf-empty compact">
                            <HubOutlined />
                            <h3>No calendar jobs yet.</h3>
                            <p>
                              Approve a new request to see the first one appear.
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                    <aside className="cf-panel cf-experiment">
                      <p className="cf-kicker">TRY THE FAILURE PATH</p>
                      <h2>
                        Break it.
                        <br />
                        Watch it recover.
                      </h2>
                      <ol>
                        <li>Switch to faculty and simulate an outage.</li>
                        <li>Approve a pending request.</li>
                        <li>
                          Retry the calendar job. The approval survives the
                          failure.
                        </li>
                        <li>Recover the calendar and retry again.</li>
                      </ol>
                      <p>
                        Retries use the same event ID. A repeated delivery won’t
                        create another event.
                      </p>
                    </aside>
                  </div>
                )}
                <footer className="cf-footer">
                  <span>Made for the people who make campus happen.</span>
                  <span>CampusFlow · Operations</span>
                </footer>
              </>
            )}
          </main>
        </div>
        <Dialog
          open={!!detail}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
          maxWidth="sm"
          fullWidth
          aria-labelledby="request-detail-title"
        >
          <DialogTitle id="request-detail-title" className="cf-dialog-title">
            <span>Request details</span>
            <button
              className="cf-icon-button"
              aria-label="Close request details"
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              <CloseRounded />
            </button>
          </DialogTitle>
          {detail && (
            <>
              <DialogContent tabIndex={0}>
                <div className="cf-detail-heading">
                  <EquipmentIcon category={detail.category} />
                  <Status value={detail.status} />
                </div>
                <h2 className="cf-detail-title">{detail.title}</h2>
                <p className="cf-detail-purpose">{detail.purpose}</p>
                <dl className="cf-detail-grid">
                  <div>
                    <dt>Equipment</dt>
                    <dd>
                      {detail.quantity} × {detail.equipment_name}
                    </dd>
                  </div>
                  <div>
                    <dt>Requested by</dt>
                    <dd>{detail.requester}</dd>
                  </div>
                  <div>
                    <dt>Collection</dt>
                    <dd>
                      {formatDate(detail.starts_at)},{" "}
                      {formatTime(detail.starts_at)}
                    </dd>
                  </div>
                  <div>
                    <dt>Return by</dt>
                    <dd>
                      {formatDate(detail.ends_at)}, {formatTime(detail.ends_at)}
                    </dd>
                  </div>
                  <div className="wide">
                    <dt>Collection point</dt>
                    <dd>{detail.location}</dd>
                  </div>
                </dl>
                {!["rejected", "cancelled"].includes(detail.status) && (
                  <ol className="cf-progress" aria-label="Request progress">
                    {steps.map((s, index) => (
                      <li
                        key={s}
                        className={
                          index <= steps.indexOf(detail.status)
                            ? "complete"
                            : ""
                        }
                      >
                        <span>
                          {index < steps.indexOf(detail.status) ? (
                            <CheckRounded />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <small>
                          {
                            [
                              "Request",
                              "Approval",
                              "Ready",
                              "Collected",
                              "Returned",
                            ][index]
                          }
                        </small>
                      </li>
                    ))}
                  </ol>
                )}
                {detail.decision_note && (
                  <div className="cf-detail-note">
                    <strong>Decision note</strong>
                    <p>{detail.decision_note}</p>
                  </div>
                )}
                <h3 className="cf-history-title">Request history</h3>
                <div className="cf-mini-history">
                  {(data?.events || [])
                    .filter((e) => e.request_id === detail.id)
                    .reverse()
                    .map((e) => (
                      <div key={e.id}>
                        <span className="cf-history-dot" />
                        <p>
                          <strong>{e.actor}</strong> · {e.action}
                          <small>
                            {formatDate(e.created_at)} at{" "}
                            {formatTime(e.created_at)}
                          </small>
                        </p>
                      </div>
                    ))}
                </div>
                {allowedActions.length > 0 && (
                  <label className="cf-field">
                    {data.role === "faculty"
                      ? "Note for the student (required if declining)"
                      : "Handoff note (optional)"}
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Keep the next person in the loop…"
                    />
                  </label>
                )}
                {error && (
                  <div className="cf-alert" role="alert">
                    {error}
                  </div>
                )}
              </DialogContent>
              <DialogActions className="cf-dialog-actions">
                {allowedActions.length ? (
                  allowedActions.map(([action, label]) => (
                    <button
                      key={action}
                      disabled={
                        busy || (action === "reject" && note.trim().length < 5)
                      }
                      className={`cf-button ${["reject", "cancel"].includes(action) ? "secondary" : "primary"}`}
                      onClick={() => act(action)}
                    >
                      {busy ? "Saving…" : label}
                    </button>
                  ))
                ) : (
                  <p className="cf-footnote">
                    {detail.status === "pending"
                      ? "Faculty will review this request."
                      : ["approved", "allocated", "collected"].includes(
                            detail.status,
                          )
                        ? "The inventory manager handles the next handoff."
                        : "This request is complete. Its history is kept here."}
                  </p>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>
        <RequestForm
          open={newRequest}
          onClose={() => setNewRequest(false)}
          equipment={equipment}
          selected={preselected}
          onSaved={async () => {
            setNewRequest(false);
            await load();
            setToast(
              "Request sent. Your faculty coordinator can now review it.",
            );
          }}
        />
        {toast && (
          <div className="cf-toast" role="status">
            <CheckCircleOutlineRounded />
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <CloseRounded />
            </button>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

function RequestList({ requests, onSelect }) {
  return requests.length ? (
    <div className="cf-request-list">
      {requests.map((r) => (
        <button
          className="cf-request-row"
          key={r.id}
          onClick={() => onSelect(r.id)}
        >
          <EquipmentIcon category={r.category} small />
          <div className="cf-request-name">
            <h3>{r.title}</h3>
            <p>
              {r.equipment_name} · {r.quantity}{" "}
              {r.quantity === 1 ? "unit" : "units"}
            </p>
          </div>
          <div className="cf-request-date">
            <span>{formatDate(r.starts_at)}</span>
            <small>{formatTime(r.starts_at)}</small>
          </div>
          <Status value={r.status} />
          <EastRounded className="cf-row-arrow" />
        </button>
      ))}
    </div>
  ) : (
    <div className="cf-empty compact">
      <SearchRounded />
      <h3>Nothing here just yet.</h3>
      <p>Try another filter or give your next idea a request.</p>
    </div>
  );
}
function RequestForm({ open, onClose, equipment, selected, onSaved }) {
  const [form, setForm] = useState({}),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const key = useRef("");
  useEffect(() => {
    if (open) {
      setForm({
        equipmentId: selected,
        title: "",
        purpose: "",
        quantity: 1,
        startsAt: localDate(24),
        endsAt: localDate(27),
      });
      setError("");
      key.current = crypto.randomUUID();
    }
  }, [open, selected]);
  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    key.current = crypto.randomUUID();
  };
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError("Return time must be after collection.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api("/requests", {
        method: "POST",
        key: key.current,
        body: {
          ...form,
          equipmentId: Number(form.equipmentId),
          quantity: Number(form.quantity),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        },
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="new-request-title"
    >
      <form onSubmit={submit}>
        <DialogTitle id="new-request-title" className="cf-dialog-title">
          <span>What are you planning?</span>
          <button
            type="button"
            className="cf-icon-button"
            aria-label="Close new request"
            onClick={onClose}
            disabled={saving}
          >
            <CloseRounded />
          </button>
        </DialogTitle>
        <DialogContent tabIndex={0}>
          <p className="cf-form-intro">
            A few details now. A smoother handoff later.
          </p>
          {error && (
            <div className="cf-alert" role="alert">
              {error}
            </div>
          )}
          <label className="cf-field">
            Equipment
            <select
              required
              name="equipmentId"
              value={form.equipmentId || ""}
              onChange={update}
            >
              {equipment.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name} · {e.capacity} total
                </option>
              ))}
            </select>
          </label>
          <div className="cf-form-grid">
            <label className="cf-field">
              Give your plan a name
              <input
                required
                name="title"
                maxLength={100}
                value={form.title || ""}
                onChange={update}
                placeholder="e.g. Design society showcase"
              />
            </label>
            <label className="cf-field">
              Quantity
              <input
                required
                name="quantity"
                type="number"
                min="1"
                max={
                  equipment.find((e) => e.id === Number(form.equipmentId))
                    ?.capacity || 1
                }
                value={form.quantity || 1}
                onChange={update}
              />
            </label>
          </div>
          <label className="cf-field">
            Tell us a little about it
            <textarea
              required
              name="purpose"
              minLength={10}
              maxLength={1000}
              rows={3}
              value={form.purpose || ""}
              onChange={update}
              placeholder="What’s happening, and how will you use the equipment?"
            />
          </label>
          <div className="cf-form-grid equal">
            <label className="cf-field">
              Collection date & time
              <input
                required
                name="startsAt"
                type="datetime-local"
                value={form.startsAt || ""}
                onChange={update}
              />
            </label>
            <label className="cf-field">
              Return date & time
              <input
                required
                name="endsAt"
                type="datetime-local"
                value={form.endsAt || ""}
                onChange={update}
              />
            </label>
          </div>
          <p className="cf-footnote">
            Times use your local time zone. Faculty checks availability before
            approval. Equipment is reserved only once approved.
          </p>
        </DialogContent>
        <DialogActions className="cf-dialog-actions">
          <button
            type="button"
            className="cf-button secondary"
            onClick={onClose}
            disabled={saving}
          >
            Not now
          </button>
          <button className="cf-button primary" type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send request"}
            <ArrowForwardRounded />
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
