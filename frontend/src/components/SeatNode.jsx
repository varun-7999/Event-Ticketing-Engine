// src/components/SeatNode.jsx
import { formatCountdown } from "../utils/time";

export default function SeatNode({ seat, now, onClick }) {
  if (!seat) return null;

  const { displayStatus, seatNumber, lockedUntil, number, price } = seat;
  const isClickable = displayStatus === "AVAILABLE" || displayStatus === "LOCKED_BY_ME";
  const remaining = lockedUntil ? new Date(lockedUntil).getTime() - now : 0;

  let className =
    "relative h-9 w-9 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all duration-150";

  if (displayStatus === "AVAILABLE") {
    className +=
      " bg-slate-800 border border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-300 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] cursor-pointer";
  } else if (displayStatus === "LOCKED_BY_ME") {
    className += " seat-mine bg-cyan-500 border border-cyan-300 text-slate-950 cursor-pointer";
  } else if (displayStatus === "LOCKED_BY_PEER") {
    className +=
      " seat-peer bg-amber-500/10 border border-amber-500/30 text-amber-400 cursor-not-allowed";
  } else if (displayStatus === "BOOKED") {
    className += " bg-slate-900 border border-slate-800 text-slate-700 cursor-not-allowed";
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onClick(seat)}
      title={
        displayStatus === "LOCKED_BY_ME"
          ? `Held by you — ${formatCountdown(remaining)} left`
          : displayStatus === "LOCKED_BY_PEER"
          ? "Held by another guest"
          : displayStatus === "BOOKED"
          ? "Sold"
          : `Seat ${seatNumber} — $${price}`
      }
      className={className}
    >
      {displayStatus === "BOOKED" ? (
        <span className="text-red-500/70 text-xs leading-none">✕</span>
      ) : (
        number
      )}
      {displayStatus === "LOCKED_BY_ME" && (
        <span className="absolute -top-2 -right-2 rounded-full bg-slate-950 border border-cyan-400 px-1 text-[8px] font-bold text-cyan-300">
          {formatCountdown(remaining)}
        </span>
      )}
    </button>
  );
}