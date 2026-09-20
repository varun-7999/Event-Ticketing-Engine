// src/components/TicketPass.jsx
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { CalendarDays, MapPin, CheckCircle2, XCircle, Clock3, Download, Loader2 } from "lucide-react";

function formatDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TicketPass({ booking }) {
  const ticketRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  if (!booking) return null;

  const { event, seats = [], totalAmount, paymentStatus, bookingReference } = booking;
  const seatLabel = seats.map((seat) => seat.seatNumber).join(", ");

  const downloadPass = async () => {
    if (!ticketRef.current || isDownloading || paymentStatus !== "PAID") return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      // html-to-image converts DOM with native OKLCH/modern CSS support
      const dataUrl = await toPng(ticketRef.current, {
        pixelRatio: 2,
        backgroundColor: "#020617",
        cacheBust: true,
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageRatio = img.width / img.height;
      const imageWidth = pageWidth - 20;
      const imageHeight = imageWidth / imageRatio;
      const finalHeight = Math.min(imageHeight, pageHeight - 20);
      const finalWidth = finalHeight * imageRatio;

      pdf.addImage(dataUrl, "PNG", (pageWidth - finalWidth) / 2, 10, finalWidth, finalHeight);

      const pdfBlob = pdf.output("blob");
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      const safeReference = (bookingReference || "pass").replace(/[^a-z0-9_-]/gi, "-");
      link.href = downloadUrl;
      link.download = `Ticket-${safeReference}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Ticket PDF download failed:", error);
      setDownloadError("Unable to create the PDF. Please try again or check your browser downloads.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div ref={ticketRef} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-black/30">
        {/* Ticket body */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-100 truncate">
                {event?.title || "Untitled Event"}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                {event?.venue || "Venue TBA"}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                {formatDate(event?.date)}
              </div>
            </div>

            {paymentStatus === "PAID" && (
              <StatusBadge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300" icon={<CheckCircle2 className="h-3 w-3" strokeWidth={2} />} label="Paid" />
            )}
            {paymentStatus === "FAILED" && (
              <StatusBadge className="border-rose-500/40 bg-rose-500/10 text-rose-300" icon={<XCircle className="h-3 w-3" strokeWidth={2} />} label="Payment failed" />
            )}
            {paymentStatus === "PENDING" && (
              <StatusBadge className="border-amber-500/40 bg-amber-500/10 text-amber-300" icon={<Clock3 className="h-3 w-3" strokeWidth={2} />} label="Payment pending" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-800/40 border border-slate-800 p-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Seats</div>
              <div className="text-sm font-medium text-slate-200">{seatLabel || "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Total</div>
              <div className="text-sm font-medium text-slate-200">
                ${totalAmount?.toFixed ? totalAmount.toFixed(2) : totalAmount}
              </div>
            </div>
          </div>
        </div>

        {/* Perforated tear line */}
        <div className="relative flex items-center px-5">
          <div className="absolute -left-2.5 h-5 w-5 rounded-full bg-slate-950" />
          <div className="flex-1 border-t border-dashed border-slate-700" />
          <div className="absolute -right-2.5 h-5 w-5 rounded-full bg-slate-950" />
        </div>

        {/* Stub */}
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Booking reference
            </div>
            <div className="font-mono text-sm font-semibold text-slate-200 truncate">
              {bookingReference}
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-white p-2">
            <QRCodeSVG value={bookingReference || ""} size={72} level="M" />
          </div>
        </div>
      </div>

      {paymentStatus === "PAID" && (
        <>
          <button
            type="button"
            onClick={downloadPass}
            disabled={isDownloading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? "Preparing PDF..." : "Download Pass (.PDF)"}
          </button>
          {downloadError && <p className="mt-2 text-center text-xs text-rose-300">{downloadError}</p>}
        </>
      )}
    </div>
  );
}

function StatusBadge({ className, icon, label }) {
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}>
      {icon}
      {label}
    </span>
  );
}