import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import api from "../services/api";

function formatDate(value) {
  if (!value) return "Date TBA";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/events")
      .then((response) => {
        if (!cancelled) setEvents(response.data?.events || []);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.response?.data?.message || "Unable to load events.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Live events</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Choose your next seat</h1>
          <p className="mt-2 text-sm text-slate-400">Select an event to open its real-time seating map.</p>
        </div>

        {isLoading && <p className="text-sm text-slate-500">Loading events...</p>}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {!isLoading && !error && events.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center">
            <Ticket className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-slate-300">No events have been published yet.</p>
            <p className="mt-1 text-sm text-slate-500">Create an event from the backend before opening a seat map.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <article key={event._id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20">
              <h2 className="text-xl font-semibold text-white">{event.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{event.description}</p>
              <div className="mt-5 space-y-2 text-sm text-slate-400">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-400" />{formatDate(event.date)}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-400" />{event.venue}</p>
              </div>
              <Link
                className="mt-5 flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
                to={`/events/${event._id}`}
              >
                View seats
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}