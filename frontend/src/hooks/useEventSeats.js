// src/hooks/useEventSeats.js
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

const SEAT_NUMBER_REGEX = /^([A-Za-z]+)(\d+)$/;

function parseSeatNumber(seatNumber) {
  const match = SEAT_NUMBER_REGEX.exec(seatNumber || "");
  if (!match) return { row: null, number: null };
  return { row: match[1], number: Number(match[2]) };
}

// The API only tracks a single 'LOCKED' status; whether that lock is
// "mine" or a peer's is a client-side concern based on lockedBy.
function computeDisplayStatus(seat, currentUserId) {
  if (!seat) return null;
  if (seat.status === "BOOKED") return "BOOKED";
  if (seat.status === "LOCKED") {
    return seat.lockedBy && currentUserId && seat.lockedBy === currentUserId
      ? "LOCKED_BY_ME"
      : "LOCKED_BY_PEER";
  }
  return "AVAILABLE";
}

function normalizeSeat(rawSeat, currentUserId) {
  const { row, number } = parseSeatNumber(rawSeat.seatNumber);
  return {
    _id: rawSeat._id,
    eventId: rawSeat.eventId,
    seatNumber: rawSeat.seatNumber,
    row,
    number,
    price: rawSeat.price,
    status: rawSeat.status,
    lockedBy: rawSeat.lockedBy ?? null,
    lockedUntil: rawSeat.lockedUntil ?? null,
    version: rawSeat.version,
    displayStatus: computeDisplayStatus(rawSeat, currentUserId),
  };
}

export function useEventSeats(eventId) {
  const { socket, isConnected, joinEvent, leaveEvent } = useSocket();
  const { user } = useAuth();
  const currentUserId = user?._id ?? null;

  const [seatsByNumber, setSeatsByNumber] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Maps a seat's Mongo _id back to its seatNumber, used for O(1) lookups
  // if a future payload only gives us the id.
  const idToNumberRef = useRef({});

  // Fetch the full seat inventory once per event.
  useEffect(() => {
    if (!eventId) return;

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    api
      .get(`/events/${eventId}/seats`)
      .then((response) => {
        if (isCancelled) return;
        const rawSeats = response.data?.seats ?? [];
        const next = {};
        const idMap = {};
        rawSeats.forEach((rawSeat) => {
          const seat = normalizeSeat(rawSeat, currentUserId);
          next[seat.seatNumber] = seat;
          idMap[seat._id] = seat.seatNumber;
        });
        idToNumberRef.current = idMap;
        setSeatsByNumber(next);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err.response?.data?.message || "Unable to load the seat map.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [eventId, currentUserId]);

  // Join this event's room once the socket is connected; leave on cleanup.
  useEffect(() => {
    if (!eventId || !isConnected) return;
    joinEvent(eventId);
    return () => {
      leaveEvent(eventId);
    };
  }, [eventId, isConnected, joinEvent, leaveEvent]);

  // If the logged-in user changes, re-derive who "owns" each active lock.
  useEffect(() => {
    setSeatsByNumber((prev) => {
      const next = {};
      Object.values(prev).forEach((seat) => {
        next[seat.seatNumber] = {
          ...seat,
          displayStatus: computeDisplayStatus(seat, currentUserId),
        };
      });
      return next;
    });
  }, [currentUserId]);

  // Granular, targeted patches driven by the room's live broadcasts —
  // no full refetch on every event.
  useEffect(() => {
    if (!socket) return;

    const patchSeat = (seatNumber, patch) => {
      setSeatsByNumber((prev) => {
        const existing = prev[seatNumber];
        if (!existing) return prev;
        const merged = { ...existing, ...patch };
        return {
          ...prev,
          [seatNumber]: {
            ...merged,
            displayStatus: computeDisplayStatus(merged, currentUserId),
          },
        };
      });
    };

    const handleLocked = (payload) => {
      if (!payload?.seatNumber) return;
      setSeatsByNumber((prev) => {
        const existing = prev[payload.seatNumber];
        if (!existing) return prev;
        // Our own optimistic update from lockSeat() already applied this;
        // don't let the echoed broadcast demote it to a peer lock.
        if (existing.displayStatus === "LOCKED_BY_ME") return prev;
        const merged = {
          ...existing,
          status: "LOCKED",
          lockedUntil: payload.lockedUntil ?? existing.lockedUntil,
        };
        return {
          ...prev,
          [payload.seatNumber]: {
            ...merged,
            displayStatus: computeDisplayStatus(merged, currentUserId),
          },
        };
      });
    };

    const handleUnlocked = (payload) => {
      if (!payload?.seatNumber) return;
      patchSeat(payload.seatNumber, {
        status: "AVAILABLE",
        lockedBy: null,
        lockedUntil: null,
      });
    };

    const handleBooked = (payload) => {
      if (!payload?.seatNumber) return;
      patchSeat(payload.seatNumber, {
        status: "BOOKED",
        lockedBy: null,
        lockedUntil: null,
      });
    };

    socket.on("seat:locked", handleLocked);
    socket.on("seat:unlocked", handleUnlocked);
    socket.on("seat:booked", handleBooked);

    return () => {
      socket.off("seat:locked", handleLocked);
      socket.off("seat:unlocked", handleUnlocked);
      socket.off("seat:booked", handleBooked);
    };
  }, [socket, currentUserId]);

  const lockSeat = useCallback(
    async (seatId) => {
      setActionError(null);
      try {
        const response = await api.post(`/seats/${seatId}/lock`);
        const seat = normalizeSeat(response.data.seat, currentUserId);
        idToNumberRef.current[seat._id] = seat.seatNumber;
        setSeatsByNumber((prev) => ({ ...prev, [seat.seatNumber]: seat }));
        return { success: true, seat };
      } catch (err) {
        const message =
          err.response?.status === 409
            ? "That seat was just taken. Pick another one."
            : err.response?.data?.message || "Unable to hold that seat.";
        setActionError(message);
        return { success: false, error: message };
      }
    },
    [currentUserId]
  );

  const unlockSeat = useCallback(
    async (seatId) => {
      setActionError(null);
      try {
        const response = await api.post(`/seats/${seatId}/unlock`);
        const seat = normalizeSeat(response.data.seat, currentUserId);
        setSeatsByNumber((prev) => ({ ...prev, [seat.seatNumber]: seat }));
        return { success: true, seat };
      } catch (err) {
        const message = err.response?.data?.message || "Unable to release that seat.";
        setActionError(message);
        return { success: false, error: message };
      }
    },
    [currentUserId]
  );

  const seats = useMemo(() => Object.values(seatsByNumber), [seatsByNumber]);

  return {
    seats,
    seatsByNumber,
    isLoading,
    error,
    actionError,
    lockSeat,
    unlockSeat,
  };
}