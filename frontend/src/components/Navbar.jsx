// src/components/Navbar.jsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ticket, CalendarDays, User, LogOut, ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Shared row style for every action inside the mobile drawer.
const mobileNavItemClass =
  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuRef = useRef(null);
  const mobileNavRef = useRef(null);
  const mobileToggleRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }

      // The toggle itself counts as "inside", otherwise its own mousedown would
      // close the panel before the click handler could toggle it back open.
      const clickedToggle = mobileToggleRef.current?.contains(event.target);
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target) && !clickedToggle) {
        setIsMobileNavOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the drawer if the viewport grows into the desktop breakpoint.
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const handleBreakpointChange = (event) => {
      if (event.matches) setIsMobileNavOpen(false);
    };
    desktopQuery.addEventListener("change", handleBreakpointChange);
    return () => desktopQuery.removeEventListener("change", handleBreakpointChange);
  }, []);

  const closeMobileNav = () => setIsMobileNavOpen(false);

  const handleLogout = () => {
    setIsMenuOpen(false);
    setIsMobileNavOpen(false);
    logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Ticket className="h-6 w-6 text-indigo-400" strokeWidth={1.75} />
            <span className="text-lg font-semibold tracking-tight text-slate-100">
              TicketEngine
            </span>
          </Link>

          {/* Primary nav links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/events"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
            >
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              Events
            </Link>
            <Link
              to="/bookings"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
            >
              <Ticket className="h-4 w-4" strokeWidth={1.75} />
              My Bookings
            </Link>
          </div>

          {/* Right cluster: socket status + auth */}
          <div className="flex items-center gap-3">
            {/* Live socket status badge */}
            <div
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-800/50 px-2.5 py-1.5 sm:px-3"
              title={isConnected ? "Live updates connected" : "Live updates offline"}
            >
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isConnected ? "bg-emerald-400" : "bg-red-500"
                  }`}
                />
              </span>
              <span className="hidden sm:inline text-xs font-medium text-slate-400">
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>

            {/* Auth area — desktop/tablet only; on mobile these actions live in the drawer */}
            {isAuthenticated ? (
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-800/50 py-1 pl-1 pr-3 transition-colors hover:bg-slate-800"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300">
                    {initials}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-slate-200 max-w-[120px] truncate">
                    {user?.name || "Account"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                      isMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/95 backdrop-blur-md shadow-lg shadow-black/40">
                    <Link
                      to="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    >
                      <User className="h-4 w-4" strokeWidth={1.75} />
                      Profile
                    </Link>
                    {(user?.role === "organizer" || user?.role === "admin") && (
                      <Link
                        to="/organizer/events/new"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      >
                        <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                        Publish event
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-800/60 hover:text-red-300"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile navigation toggle — only rendered below the md breakpoint */}
            <button
              type="button"
              ref={mobileToggleRef}
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-nav-panel"
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              className="md:hidden flex items-center justify-center rounded-lg border border-slate-800 bg-slate-800/50 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {isMobileNavOpen ? (
                <X className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer: primary links + account actions. Hidden from md upwards. */}
      {isMobileNavOpen && (
        <div
          id="mobile-nav-panel"
          ref={mobileNavRef}
          className="md:hidden max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-800 bg-slate-900/95 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            <Link to="/events" onClick={closeMobileNav} className={mobileNavItemClass}>
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              Events
            </Link>
            <Link to="/bookings" onClick={closeMobileNav} className={mobileNavItemClass}>
              <Ticket className="h-4 w-4" strokeWidth={1.75} />
              My Bookings
            </Link>

            <div className="my-2 border-t border-slate-800" />

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-200">
                      {user?.name || "Account"}
                    </div>
                    <div className="text-xs capitalize text-slate-500">
                      {user?.role || "attendee"}
                    </div>
                  </div>
                </div>
                <Link to="/profile" onClick={closeMobileNav} className={mobileNavItemClass}>
                  <User className="h-4 w-4" strokeWidth={1.75} />
                  Profile
                </Link>
                {(user?.role === "organizer" || user?.role === "admin") && (
                  <Link
                    to="/organizer/events/new"
                    onClick={closeMobileNav}
                    className={mobileNavItemClass}
                  >
                    <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                    Publish event
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${mobileNavItemClass} w-full text-red-400 hover:text-red-300`}
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.75} />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeMobileNav} className={mobileNavItemClass}>
                  <User className="h-4 w-4" strokeWidth={1.75} />
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMobileNav}
                  className="flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
                >
                  <Ticket className="h-4 w-4" strokeWidth={1.75} />
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}