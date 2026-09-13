import React from "react";
import { Link } from "react-router-dom";
import {
  SchoolRounded,
  AccountCircleOutlined,
  GroupsOutlined,
  ArrowBackRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";
import "../ops/operations.css";
import "./homepage.css";
export default function ChooseUser() {
  return (
    <div className="cf-landing">
      <header className="cf-landing-nav">
        <Link to="/" className="cf-brand">
          <span className="cf-brand-mark">
            <SchoolRounded />
          </span>
          <span>
            Campus<span className="cf-purple">Flow</span>
          </span>
        </Link>
        <Link to="/" className="cf-text-link">
          <ArrowBackRounded />
          Back home
        </Link>
      </header>
      <main className="cf-choose">
        <p className="cf-kicker">THE ACADEMIC PORTAL</p>
        <h1>
          Welcome back.
          <br />
          Find your place.
        </h1>
        <p>Classes, attendance and the people who keep campus running.</p>
        {!process.env.REACT_APP_BASE_URL && (
          <p className="cf-footnote">
            Classes and attendance belong to a separate academic portal that is
            not connected to this website. Equipment workspace accounts are
            available now: sign in or create a workspace below.
          </p>
        )}
        {process.env.REACT_APP_BASE_URL && (
          <div className="cf-choose-grid">
            {[
              {
                role: "Admin",
                name: "Administrator",
                text: "Manage classes, people and campus notices.",
                Icon: AccountCircleOutlined,
              },
              {
                role: "Student",
                name: "Student",
                text: "Your subjects, attendance and progress.",
                Icon: SchoolRounded,
              },
              {
                role: "Teacher",
                name: "Teacher",
                text: "Support your students and manage your classes.",
                Icon: GroupsOutlined,
              },
            ].map(({ role, name, text, Icon }) => (
              <Link className="cf-choose-card" to={`/${role}login`} key={role}>
                <Icon />
                <h2>{name}</h2>
                <p>{text}</p>
                <span>
                  Sign in <ArrowForwardRounded />
                </span>
              </Link>
            ))}
          </div>
        )}
        <div className="cf-choose-demo">
          <strong>Your equipment workspace</strong>
          <p>
            Sign in to keep your bookings, create a team or join with an
            invitation. You can also explore a separate sample workspace.
          </p>
          <Link to="/ops/sign-in" className="cf-button primary">
            Sign in or create a workspace <ArrowForwardRounded />
          </Link>
          <p>
            <Link to="/ops" className="cf-button secondary">
              Explore the operations demo <ArrowForwardRounded />
            </Link>
          </p>
        </div>
        {process.env.REACT_APP_BASE_URL && (
          <p className="cf-footnote">
            The academic portal uses your existing campus account and its
            original service.
          </p>
        )}
      </main>
    </div>
  );
}
