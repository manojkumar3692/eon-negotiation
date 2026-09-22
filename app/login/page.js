"use client";
import { useState } from "react";
import { authClient } from "../../lib/auth-client.js";
import { getAuthErrorMessage } from "../../lib/auth-error.js";
import { ArrowUpRight, ArrowRight, ShieldCheck } from "lucide-react";
export default function Login() {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = signup
        ? await authClient.signUp.email({
            name: d.name,
            email: d.email,
            password: d.password,
          })
        : await authClient.signIn.email({
            email: d.email,
            password: d.password,
          });
      if (result.error) {
        setMessage(result.error.message || "Unable to sign in.");
      } else {
        const session = await authClient.getSession();
        if (session.data?.user) window.location.assign("/dashboard");
        else
          setMessage(
            "Account created. Complete the verification instructions sent by the identity provider, then sign in.",
          );
      }
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <ArrowUpRight />
          </span>{" "}
          negotiation<span className="brand-dot">.</span>
        </div>
        <span className="eyebrow">YOUR TERMS. BETTER CONVERSATIONS.</span>
        <h1>
          A better offer
          <br />
          starts with
          <br />
          <em>your rules.</em>
        </h1>
        <p>
          One workspace for your catalog, commerce connections and
          merchant-controlled negotiation.
        </p>
        <div className="login-foot">
          <ShieldCheck size={18} />
          Your data. Your margins. Your decision.
        </div>
      </div>
      <div className="login-form">
        <div className="form-wrap">
          <span className="eyebrow">MERCHANT WORKSPACE</span>
          <h2>{signup ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">
            {signup
              ? "Start with a company. Connect your store when you’re ready."
              : "Sign in to manage your companies and negotiation rules."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Work email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            {message && (
              <p role="alert" className="notice">
                {message}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setSignup(!signup);
              setMessage("");
            }}
          >
            {signup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
          <a className="demo-link" href="/demo">
            Explore the interactive preview <ArrowUpRight size={15} />
          </a>
          <p className="fine">
            Preview uses sample data in this browser session. Merchant records
            require sign-in.
          </p>
        </div>
      </div>
    </main>
  );
}
