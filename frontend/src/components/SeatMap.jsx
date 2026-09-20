// src/components/SeatMap.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Armchair, Clock, ShieldCheck, AlertCircle, Info } from "lucide-react";
import { useEventSeats } from "../hooks/useEventSeats";
import { useSocket } from "../context/SocketContext";
import SeatNode from "./SeatNode";
import { formatCountdown } from "../utils/time";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SeatMap({ eventId, onProceedToCheckout }) {
  const { isConnected } = useSocket();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { seats, isLoading, error, actionError, lockSeat, unlockSeat } =
    useEventSeats(eventId);

  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [pendingSeatIds, setPendingSeatIds] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = useCallback((message, tone = "info") => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (actionError) showToast(actionError, "warning");
  }, [actionError, showToast]);

  const markPending = useCallback((seatId, isPending) => {
    setPendingSeatIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(seatId);
      else next.delete(seatId);
      return next;
    });
  }, []);

  const handleSeatClick = useCallback(
    async (seat) => {
      if (!isAuthenticated) {
        showToast("Log in before selecting a seat", "warning");
        navigate("/login");
        return;
      }
      if (pendingSeatIds.has(seat._id)) return;
      markPending(seat._id, true);
      try {
        if (seat.displayStatus === "AVAILABLE") {
          const result = await lockSeat(seat._id);
          if (result.success) {
            showToast(`Row ${seat.row}, Seat ${seat.number} held for you`, "success");
          }
        } else if (seat.displayStatus === "LOCKED_BY_ME") {
          const result = await unlockSeat(seat._id);
          if (result.success) {
            showToast(`Row ${seat.row}, Seat ${seat.number} released`, "info");
          }
        }
      } finally {
        markPending(seat._id, false);
      }
    },
    [isAuthenticated, navigate, pendingSeatIds, lockSeat, unlockSeat, markPending, showToast]
  );

  const rows = useMemo(() => {
    const visibleSeats = statusFilter
      ? seats.filter((seat) => seat.displayStatus === statusFilter)
      : seats;
    const grouped = visibleSeats.reduce((result, seat) => {
      const row = seat.row || "?";
      if (!result[row]) result[row] = [];
      result[row].push(seat);
      return result;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([row, rowSeats]) => [
        row,
        rowSeats.sort((a, b) => a.number - b.number),
      ]);
  }, [seats, statusFilter]);

  const myHeldSeats = useMemo(
    () =>
      seats
        .filter((seat) => seat.displayStatus === "LOCKED_BY_ME")
        .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)),
    [seats]
  );

  const total = myHeldSeats.reduce((sum, seat) => sum + (seat.price || 0), 0);
  const earliestExpiry = useMemo(() => {
    if (myHeldSeats.length === 0) return null;
    return Math.min(...myHeldSeats.map((s) => new Date(s.lockedUntil).getTime()));
  }, [myHeldSeats]);
  const msRemaining = earliestExpiry ? earliestExpiry - now : 0;

  const handleProceedToCheckout = useCallback(() => {
    if (myHeldSeats.length === 0) return;
    onProceedToCheckout?.(myHeldSeats);
  }, [myHeldSeats, onProceedToCheckout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Loading seat map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-red-400 text-sm">
        <AlertCircle className="h-5 w-5" strokeWidth={1.75} />
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 pb-32">
      <style>{`
        @keyframes peerBreathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.45); }
          70% { box-shadow: 0 0 0 8px rgba(34, 211, 238, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes hudIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .seat-peer { animation: peerBreathe 1.8s ease-in-out infinite; }
        .seat-mine { animation: ringPulse 2s ease-out infinite; }
      `}</style>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8">
        {!isConnected && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            <Info className="h-4 w-4" strokeWidth={1.75} />
            Reconnecting to live updates — seat availability may lag briefly.
          </div>
        )}

        {/* Stage */}
        <div className="relative mb-12 flex justify-center">
          <div
            className="h-6 w-3/4 max-w-2xl rounded-t-full bg-linear-to-b from-emerald-500/40 to-emerald-500/5 border-t border-x border-emerald-400/30"
            style={{ boxShadow: "0 -12px 24px rgba(16,185,129,0.25)" }}
          />
        </div>
        <p className="text-center text-xs tracking-[0.3em] uppercase text-slate-500 -mt-9 mb-10">
          Stage
        </p>

        {/* Seating grid */}
        <div className="mb-10 overflow-x-auto pb-2">
          <div className="mx-auto flex min-w-max flex-col items-center gap-3 px-2">
            {rows.map(([row, rowSeats]) => (
              <div key={row} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs font-medium text-slate-500">{row}</span>
                <div className="flex gap-2">
                  {rowSeats.map((seat) => (
                    <SeatNode
                      key={seat._id}
                      seat={seat}
                      now={now}
                      onClick={handleSeatClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          <LegendItem active={!statusFilter} onClick={() => setStatusFilter(null)} colorClass="bg-slate-700 border border-slate-500" label="All seats" />
          <LegendItem active={statusFilter === "AVAILABLE"} onClick={() => setStatusFilter(statusFilter === "AVAILABLE" ? null : "AVAILABLE")} colorClass="bg-slate-800 border border-slate-700" label="Available" />
          <LegendItem active={statusFilter === "LOCKED_BY_ME"} onClick={() => setStatusFilter(statusFilter === "LOCKED_BY_ME" ? null : "LOCKED_BY_ME")} colorClass="bg-cyan-500 border border-cyan-300" label="Your hold" />
          <LegendItem active={statusFilter === "LOCKED_BY_PEER"} onClick={() => setStatusFilter(statusFilter === "LOCKED_BY_PEER" ? null : "LOCKED_BY_PEER")} colorClass="bg-amber-500/20 border border-amber-500/40" label="Reserved by peer" />
          <LegendItem active={statusFilter === "BOOKED"} onClick={() => setStatusFilter(statusFilter === "BOOKED" ? null : "BOOKED")} colorClass="bg-slate-900 border border-slate-800" label="Sold" />
        </div>
      </main>

      {toast && (
        <div
          key={toast.key}
          style={{ animation: "toastIn 0.2s ease-out forwards" }}
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : toast.tone === "warning"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-slate-700 bg-slate-900/95 text-slate-300"
          }`}
        >
          {toast.tone === "warning" ? (
            <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          )}
          {toast.message}
        </div>
      )}

      {myHeldSeats.length > 0 && (
        <div
          style={{ animation: "hudIn 0.25s ease-out forwards" }}
          className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-cyan-500/30 bg-slate-900/95 px-4 py-4 shadow-2xl shadow-cyan-500/10 backdrop-blur-md sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:px-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                <Armchair className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="flex max-h-14 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {myHeldSeats.map((seat) => (
                    <span
                      key={seat._id}
                      className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-medium text-cyan-300 whitespace-nowrap"
                    >
                      Row {seat.row} · Seat {seat.number}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-300/90">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Hold expires in {formatCountdown(msRemaining)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:shrink-0">
              <div className="text-left sm:text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
                <div className="text-lg font-semibold text-slate-100">${total}</div>
              </div>
              <button
                onClick={handleProceedToCheckout}
                className="flex-1 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.35)] transition-colors hover:bg-cyan-400 sm:flex-none sm:px-5"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ active, onClick, colorClass, label }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border px-2 py-1 transition-colors ${active ? "border-cyan-400/60 bg-slate-800 text-slate-100" : "border-transparent hover:border-slate-700 hover:bg-slate-900"}`}
    >
      <span className={`h-3.5 w-3.5 rounded ${colorClass}`} />
      {label}
    </button>
  );
}