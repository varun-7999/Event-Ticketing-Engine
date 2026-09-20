import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Ticket } from "lucide-react";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("attendee");
  const [formError, setFormError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (isRegister && name.trim().length < 2) {
      setFormError("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    const result = isRegister
      ? await register(name.trim(), email.trim(), password, role)
      : await login(email, password);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    navigate(location.state?.from || "/events", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto flex max-w-md justify-center px-4 py-16">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-sm text-slate-400">
                {isRegister ? "Hold seats in real time." : "Continue to your event seats."}
              </p>
            </div>
          </div>

          {(formError || error) && (
            <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {formError || error}
            </p>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <label className="block text-sm text-slate-300">
                Name
                <input className="auth-input" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
            )}
            {isRegister && (
              <label className="block text-sm text-slate-300">
                Account type
                <select className="auth-input" value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="attendee">Attendee - book event seats</option>
                  <option value="organizer">Organizer - publish events</option>
                </select>
              </label>
            )}
            <label className="block text-sm text-slate-300">
              Email
              <input className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input className="auth-input" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading}>
              {isLoading ? "Please wait..." : isRegister ? "Create account" : "Log in"}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? "Already have an account? " : "New to TicketEngine? "}
            <Link className="text-cyan-300 hover:text-cyan-200" to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Log in" : "Sign up"}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}