// src/pages/EventSeatMapPage.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import SeatMap from "../components/SeatMap";
import CheckoutDrawer from "../components/CheckoutDrawer";

export default function EventSeatMapPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutSeats, setCheckoutSeats] = useState([]);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <SeatMap
        eventId={eventId}
        onProceedToCheckout={(seats) => {
          setCheckoutSeats(seats);
          setIsCheckoutOpen(true);
        }}
      />
      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        selectedSeats={checkoutSeats}
        onPurchaseSuccess={(booking) => navigate("/bookings")}
      />
    </div>
  );
}