// src/App.jsx
import { Navigate, Route, Routes } from "react-router-dom";
import EventSeatMapPage from "./components/EventSeatMapPage";
import EventsPage from "./components/EventsPage";
import AuthPage from "./components/AuthPage";
import MyBookingsPage from "./components/MyBookingsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./components/ProfilePage";
import OrganizerDashboard from "./components/OrganizerDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventSeatMapPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/organizer/events/new" element={<ProtectedRoute><OrganizerDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}