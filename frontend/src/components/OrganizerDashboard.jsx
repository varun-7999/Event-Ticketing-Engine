import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Edit3, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import api from "../services/api";

const emptyForm = { title: "", description: "", date: "", venue: "", totalSeats: 50, ticketPrice: 45 };

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromEvent(event) {
  return { title: event.title || "", description: event.description || "", date: toDateInput(event.date), venue: event.venue || "", totalSeats: event.totalSeats || 1, ticketPrice: event.ticketPrice || 0 };
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingEvent, setEditingEvent] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadEvents = async () => {
    try {
      const response = await api.get("/events");
      setEvents(response.data?.events || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load events.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const manageableEvents = useMemo(() => {
    if (user?.role === "admin") return events;
    return events.filter((event) => (event.organizer?._id || event.organizer) === user?._id);
  }, [events, user]);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const beginEdit = (event) => { setEditingEvent(event); setForm(fromEvent(event)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setEditingEvent(null); setForm(emptyForm); setError(null); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = { ...form, totalSeats: Number(form.totalSeats), ticketPrice: Number(form.ticketPrice) };
      if (editingEvent) {
        const response = await api.put(`/events/${editingEvent._id}`, payload);
        setEvents((current) => current.map((item) => item._id === editingEvent._id ? { ...item, ...response.data.event } : item));
        cancelEdit();
      } else {
        await api.post("/events", payload);
        setForm(emptyForm);
        await loadEvents();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || (editingEvent ? "Unable to update event." : "Unable to publish event."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.delete(`/events/${event._id}`);
      setEvents((current) => current.filter((item) => item._id !== event._id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete event.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Organizer tools</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{editingEvent ? "Edit event" : "Publish an event"}</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
          {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
          <Field label="Event title" name="title" value={form.title} onChange={updateField} required />
          <label className="block text-sm text-slate-300">Description<textarea className="auth-input min-h-28" name="description" value={form.description} onChange={updateField} required /></label>
          <Field label="Venue" name="venue" value={form.venue} onChange={updateField} required />
          <Field label="Date and time" name="date" type="datetime-local" value={form.date} onChange={updateField} required />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Total seats" name="totalSeats" type="number" min="1" value={form.totalSeats} onChange={updateField} required /><Field label="Ticket price" name="ticketPrice" type="number" min="0" step="0.01" value={form.ticketPrice} onChange={updateField} required /></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button disabled={isSubmitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}{isSubmitting ? "Saving..." : editingEvent ? "Save changes" : "Publish event"}</button>
            {editingEvent && <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:border-slate-500">Cancel edit</button>}
          </div>
        </form>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-white">Manage events</h2><button type="button" onClick={() => navigate("/events")} className="text-sm text-cyan-300 hover:text-cyan-200">View public events</button></div>
          {isLoading && <p className="mt-4 text-sm text-slate-500">Loading events...</p>}
          {!isLoading && manageableEvents.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">No upcoming events to manage.</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">{manageableEvents.map((event) => <article key={event._id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><h3 className="font-semibold text-white">{event.title}</h3><p className="mt-1 text-sm text-slate-400">{new Date(event.date).toLocaleString()} · {event.venue}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => beginEdit(event)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400"><Edit3 className="h-4 w-4" />Edit</button><button type="button" onClick={() => handleDelete(event)} className="flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" />Delete</button></div></article>)}</div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, ...props }) { return <label className="block text-sm text-slate-300">{label}<input className="auth-input" {...props} /></label>; }
