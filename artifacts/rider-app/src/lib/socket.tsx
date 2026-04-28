import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { api, getApiBase } from "./api";
import { useAuth } from "./auth";

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  setRiderPosition: (lat: number, lng: number) => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  setRiderPosition: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  /* Cached position fed by Home.tsx / Active.tsx watchPosition — no separate GPS listener here */
  const lastLatRef = useRef<number | undefined>(undefined);
  const lastLngRef = useRef<number | undefined>(undefined);

  /* Called from watchPosition callbacks in Home.tsx and Active.tsx */
  const setRiderPosition = useCallback((lat: number, lng: number) => {
    lastLatRef.current = lat;
    lastLngRef.current = lng;
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token || !user?.id) return;

    /* PWA4: Use centralized getApiBase() helper (COMPLETED) */
    const apiBase = getApiBase();
    const socketOrigin = import.meta.env.VITE_CAPACITOR === "true" && import.meta.env.VITE_API_BASE_URL
      ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "")
      : window.location.origin;

    const s = io(socketOrigin, {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
    });
    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));

    /* S1: On token refresh, reconnect socket to send new auth token (COMPLETED) */
    const tokenRefreshInterval = setInterval(async () => {
      const freshToken = api.getToken();
      if (freshToken && freshToken !== (s.auth as { token?: string })?.token) {
        (s.auth as { token?: string }).token = freshToken;
        /* Reconnect to send new token on next handshake */
        s.disconnect();
        s.connect();
      }
    }, 10_000);

    return () => {
      clearInterval(tokenRefreshInterval);
      s.removeAllListeners(); /* S4: Remove all listeners on cleanup (COMPLETED) */
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id]);

  /* S2, S3, PF3: Battery listener and heartbeat at top level, not keyed on socket/user changes (COMPLETED) */
  const batteryLevelRef = useRef<number | undefined>(undefined);

  /* Initialize battery listener once at mount */
  useEffect(() => {
    type BatteryManager = { level: number; addEventListener: (event: string, cb: () => void) => void };
    (navigator as unknown as { getBattery?: () => Promise<BatteryManager> }).getBattery?.()
      .then((batt) => {
        batteryLevelRef.current = batt.level;
        batt.addEventListener("levelchange", () => { batteryLevelRef.current = batt.level; });
      }).catch(() => {});
  }, []);

  /* Heartbeat effect - keyed on user?.isOnline only, battery ref is stable */
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !user?.isOnline) return;

    const emitHeartbeat = () => {
      if (!s?.connected) return;
      s.emit("rider:heartbeat", {
        batteryLevel: batteryLevelRef.current,
        isOnline: true,
        timestamp: new Date().toISOString(),
        /* Use position cached from the page-level watchPosition — no duplicate GPS listener */
        ...(lastLatRef.current !== undefined && lastLngRef.current !== undefined
          ? { latitude: lastLatRef.current, longitude: lastLngRef.current }
          : {}),
      });
    };

    s.on("connect", emitHeartbeat);
    emitHeartbeat();
    const heartbeatInterval = setInterval(emitHeartbeat, 30_000);

    return () => {
      clearInterval(heartbeatInterval);
      s.off("connect", emitHeartbeat);
    };
  }, [user?.isOnline]);

  return (
    <SocketContext.Provider value={{ socket, connected, setRiderPosition }}>
      {children}
    </SocketContext.Provider>
  );
}
