// src/context/SocketContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["polling", "websocket"],
      auth: {
        token: token || null,
      },
    });

    socketRef.current = socket;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Room pattern per spec: server scopes broadcasts to `event:<eventId>`,
  // client requests membership via 'join:event' / 'leave:event'.
  const joinEvent = useCallback((eventId) => {
    if (!eventId) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("join:event", eventId);
    }
  }, []);

  const leaveEvent = useCallback((eventId) => {
    if (!eventId) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("leave:event", eventId);
    }
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    joinEvent,
    leaveEvent,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}