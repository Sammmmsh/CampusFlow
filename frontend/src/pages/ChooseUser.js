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
            Academic sign-in is unavailable on this demo. Explore the equipment
            workspace below with sample campus data.
          </p>
        )}
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
        <div className="cf-choose-demo">
          <strong>Just looking around?</strong>
          <p>
            Our new equipment workspace has an isolated, working demo. No shared
            guest passwords.
          </p>
          <Link to="/ops" className="cf-button primary">
            Explore the operations demo <ArrowForwardRounded />
          </Link>
        </div>
        <p className="cf-footnote">
          The academic portal uses your existing campus account and its original
          service.
        </p>
      </main>
    </div>
  );
}
