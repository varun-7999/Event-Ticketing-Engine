import { Mail, Shield, User } from "lucide-react";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Your profile</h1>
        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
              <User className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              <p className="text-sm capitalize text-slate-400">{user?.role || "attendee"}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4 text-sm">
            <p className="flex items-center gap-3 text-slate-300"><Mail className="h-4 w-4 text-cyan-400" />{user?.email}</p>
            <p className="flex items-center gap-3 text-slate-300"><Shield className="h-4 w-4 text-cyan-400" />Account role: {user?.role || "attendee"}</p>
          </div>
        </section>
      </main>
    </div>
  );
}