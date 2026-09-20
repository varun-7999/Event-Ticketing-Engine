// src/components/CheckoutDrawer.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Clock, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import api from "../services/api";
import { formatCountdown } from "../utils/time";
const HOLD_DURATION_MS = 10 * 60 * 1000;

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

export default function CheckoutDrawer({ isOpen, onClose, selectedSeats, onPurchaseSuccess }) {
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expiryAlert, setExpiryAlert] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const expiresAt = useMemo(() => {
    if (!selectedSeats?.length) return null;
    const first = selectedSeats[0];
    return first?.lockedUntil
      ? new Date(first.lockedUntil).getTime()
      : Date.now() + HOLD_DURATION_MS;
  }, [selectedSeats]);

  // Reset transient state whenever the drawer opens with a fresh selection.
  useEffect(() => {
    if (isOpen) {
      setExpiryAlert(false);
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, selectedSeats]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const msRemaining = expiresAt ? expiresAt - now : 0;
  const isUrgent = msRemaining > 0 && msRemaining <= 60 * 1000;

  const releaseSeats = useCallback(async () => {
    if (!selectedSeats?.length) return;
    await Promise.allSettled(
      selectedSeats.map((seat) => api.post(`/seats/${seat._id}/unlock`))
    );
  }, [selectedSeats]);

  // Auto-expire: release the holds, surface an alert, and close.
  useEffect(() => {
    if (!isOpen || !expiresAt) return;
    if (msRemaining > 0 || expiryAlert) return;

    setExpiryAlert(true);
    releaseSeats().finally(() => {
      setTimeout(() => {
        onClose();
      }, 2200);
    });
  }, [isOpen, expiresAt, msRemaining, expiryAlert, releaseSeats, onClose]);

  const subtotal = useMemo(
    () => (selectedSeats || []).reduce((sum, seat) => sum + (seat.price || 0), 0),
    [selectedSeats]
  );
  const total = subtotal;

  const handleCancel = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await releaseSeats();
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  }, [releaseSeats, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!selectedSeats?.length || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const orderResponse = await api.post("/bookings/payment/order", {
        seatIds: selectedSeats.map((seat) => seat._id),
      });
      await loadRazorpay();
      await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: orderResponse.data.keyId,
          amount: orderResponse.data.order.amount,
          currency: orderResponse.data.order.currency,
          name: "TicketEngine",
          description: `Tickets for ${selectedSeats.length} seat${selectedSeats.length === 1 ? "" : "s"}`,
          order_id: orderResponse.data.order.id,
          prefill: { name: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")).name : "" },
          theme: { color: "#06b6d4" },
          handler: async (paymentResponse) => {
            try {
              const verification = await api.post("/bookings/payment/verify", {
                bookingId: orderResponse.data.bookingId,
                ...paymentResponse,
              });
              onPurchaseSuccess(verification.data.booking);
              onClose();
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment was cancelled.")) },
        });
        razorpay.on("payment.failed", (paymentFailure) => {
          const description = paymentFailure?.error?.description || "Razorpay could not complete the payment.";
          api.post("/bookings/payment/failed", {
            bookingId: orderResponse.data.bookingId,
            orderId: orderResponse.data.order.id,
            paymentId: paymentFailure?.error?.metadata?.payment_id,
            reason: description,
          }).catch(() => {});
          reject(new Error(`Payment failed: ${description}`));
        });
        razorpay.open();
      });
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || err.message || "Payment failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSeats, isSubmitting, onPurchaseSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : handleCancel}
      />

      {/* Drawer panel */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-base font-semibold text-slate-100">Confirm your seats</h2>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {expiryAlert && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 sm:mx-6 sm:mt-5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} />
            <div>
              Your hold expired and these seats were released. You'll need to
              select them again if they're still available.
            </div>
          </div>
        )}

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          {/* Countdown */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
              Hold expires in
            </div>
            <span
              className={`font-mono text-lg font-semibold ${
                isUrgent ? "text-rose-500 animate-pulse" : "text-cyan-400"
              }`}
            >
              {formatCountdown(Math.max(msRemaining, 0))}
            </span>
          </div>

          {/* Seat list */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Selected seats
            </h3>
            {(selectedSeats || []).map((seat) => (
              <div
                key={seat._id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">
                  Row {seat.row} · Seat {seat.number}
                </span>
                <span className="text-slate-400">${seat.price?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-base font-semibold text-slate-100">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {submitError}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-4 py-4 sm:flex-row sm:px-6 sm:py-5">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || expiryAlert || !selectedSeats?.length}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-[0_0_16px_rgba(34,211,238,0.35)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Processing…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                Confirm & Pay
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}