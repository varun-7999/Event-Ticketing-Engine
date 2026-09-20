import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import Navbar from "./Navbar";
import api from "../services/api";
import TicketPass from "./TicketPass";

export default function MyBookingsPage() {
	const [bookings, setBookings] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		const loadBookings = () => api
			.get("/bookings/my-bookings")
			.then((response) => {
				if (!cancelled) setBookings(response.data?.bookings || []);
			})
			.catch((requestError) => {
				if (!cancelled) {
					setError(requestError.response?.data?.message || "Unable to load bookings.");
				}
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		loadBookings();
		const refreshTimer = setInterval(loadBookings, 5000);

		return () => {
			cancelled = true;
			clearInterval(refreshTimer);
		};
	}, []);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			<Navbar />
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
				<div className="mb-8 flex items-end justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Your tickets</p>
						<h1 className="mt-2 text-3xl font-semibold text-white">My bookings</h1>
					</div>
					<Ticket className="h-8 w-8 text-cyan-400" strokeWidth={1.5} />
				</div>

				{isLoading && <p className="text-sm text-slate-500">Loading your bookings...</p>}
				{error && <p className="text-sm text-rose-400">{error}</p>}
				{!isLoading && !error && bookings.length === 0 && (
					<div className="rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
						You do not have any bookings yet.
					</div>
				)}

				<div className="grid gap-5 sm:grid-cols-2">
					{bookings.map((booking) => (
						<div key={booking._id}>
							<TicketPass booking={booking} />
						</div>
					))}
				</div>
			</main>
		</div>
	);
}
