import React from "react";
import { Link } from "react-router-dom";
import {
  SchoolRounded,
  ArrowForwardRounded,
  CheckCircleOutlineRounded,
  EastRounded,
} from "@mui/icons-material";
import Students from "../assets/students.svg";
import "../ops/operations.css";
import "./homepage.css";

export default function Homepage() {
  return (
    <div className="cf-landing">
      <a className="cf-skip" href="#welcome">
        Skip to content
      </a>
      <header className="cf-landing-nav">
        <Link to="/" className="cf-brand">
          <span className="cf-brand-mark">
            <SchoolRounded />
          </span>
          <span>
            Campus<span className="cf-purple">Flow</span>
            <small>ROOM FOR YOUR IDEAS</small>
          </span>
        </Link>
        <nav aria-label="CampusFlow navigation">
          <Link to="/ops/sign-in" className="cf-text-link">
            Sign in
          </Link>
          <Link to="/choose" className="cf-landing-portal">
            Academic portal
          </Link>
          <Link to="/ops" className="cf-button primary">
            Open workspace <ArrowForwardRounded />
          </Link>
        </nav>
      </header>
      <main id="welcome">
        <section className="cf-landing-hero">
          <div className="cf-landing-art">
            <div className="cf-art-caption">
              <span>Made for campus life</span>
              <small>And the people who make it happen.</small>
            </div>
            <img
              src={Students}
              alt="Students collaborating and sharing ideas on campus"
            />
            <div className="cf-art-note">
              <CheckCircleOutlineRounded />
              <span>
                A little less admin.
                <br />
                <strong>A lot more possibility.</strong>
              </span>
            </div>
          </div>
          <div className="cf-landing-copy">
            <span className="cf-landing-badge">
              YOUR CAMPUS. BETTER CONNECTED.
            </span>
            <h1>
              Less chasing.
              <br />
              More <span>campus life.</span>
            </h1>
            <p>
              From everyday classes to your next big club idea, keep the people,
              plans and equipment moving together.
            </p>
            <div className="cf-landing-actions">
              <Link to="/ops" className="cf-button primary">
                Explore the workspace <ArrowForwardRounded />
              </Link>
              <Link to="/ops/sign-in" className="cf-text-link">
                Create or join a team <EastRounded />
              </Link>
            </div>
            <p className="cf-landing-demo">
              <CheckCircleOutlineRounded />
              Try the full equipment workflow. No signup needed.
            </p>
          </div>
        </section>
        <section
          className="cf-landing-features"
          aria-label="What CampusFlow helps with"
        >
          {[
            [
              "01",
              "Find your next essential",
              "A camera for your club. A projector for your pitch. Equipment that helps ideas happen.",
            ],
            [
              "02",
              "Know what happens next",
              "Request, approval, collection, return. A clear next step for everyone involved.",
            ],
            [
              "03",
              "Keep the human connection",
              "A reason with every decision and a history of every handoff. Less guessing, more doing.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}>
              <span>{n}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="cf-landing-footer">
        <span>CampusFlow · Built around campus life.</span>
        <Link to="/ops">
          Let’s make things happen <EastRounded />
        </Link>
      </footer>
    </div>
  );
}
