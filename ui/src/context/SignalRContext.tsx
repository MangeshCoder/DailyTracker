// ─────────────────────────────────────────────────────────────────────────────
//  FILE:  frontend/src/context/SignalRContext.tsx
//  ACTION: REPLACE entire file
//
//  TWO FIXES:
//
//  FIX 1 — Hub URL now reads from the same env variable as api.ts
//    Was: hardcoded 'https://localhost:7096/hubs/notifications'
//    Now: derived from import.meta.env.VITE_API_URL so it automatically
//         uses your PC IP when testing on mobile — zero manual changes needed
//
//  FIX 2 — SignalR only connects AFTER user is authenticated
//    Was: connects immediately on app mount → no cookie yet → 401 → redirect to login
//    Now: accepts `isAuthenticated` prop, useEffect has it as dependency
//         → connection only starts once login succeeds and cookie is set
//         → disconnects immediately on logout
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode
} from 'react';
import { useAuth } from './Authcontext';

interface SignalRContextType {
  isConnected: boolean;
  onEvent: (event: string, callback: (...args: unknown[]) => void) => () => void;
}

const SignalRContext = createContext<SignalRContextType>({
  isConnected: false,
  onEvent: () => () => {},
});

// ── Derive hub base URL from the same VITE_API_URL used in api.ts ────────────
// VITE_API_URL = 'http://192.168.1.244:5053/api'  →  hubBase = 'http://192.168.1.244:5053'
// VITE_API_URL not set (desktop)                  →  hubBase = 'https://localhost:7096'
function getHubBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    // Strip the trailing /api to get the server root
    return apiUrl.replace(/\/api\/?$/, '');
  }
  return 'https://localhost:7096';
}

export const SignalRProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();   // ← FIX 2: watch auth state
  const [isConnected, setIsConnected]  = useState(false);
  const connectionRef = useRef<import('@microsoft/signalr').HubConnection | null>(null);
  const listenersRef  = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());

  useEffect(() => {
    // ── Only connect when user is logged in ───────────────────────────────────
    if (!isAuthenticated) {
      // If user logged out, stop any existing connection
      connectionRef.current?.stop();
      connectionRef.current = null;
      setIsConnected(false);
      return;
    }

    const connect = async () => {
      try {
        const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');

        const hubUrl = `${getHubBaseUrl()}/hubs/notifications`;

        const conn = new HubConnectionBuilder()
          .withUrl(hubUrl, {
            withCredentials: true  // send auth cookie with hub connection
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(LogLevel.Warning)
          .build();

        conn.onreconnected(() => setIsConnected(true));
        conn.onclose(()     => setIsConnected(false));

        // Register all events — forward to any registered listeners
        const rawOn = conn.on.bind(conn);
        [
          'ReceiveNotification',
          'UserOnline', 'UserOffline', 'PresenceUpdated', 'UserActivity',
          'LeaveApplied', 'NewAnnouncement',
        ].forEach(event => {
          rawOn(event, (...args) => {
            listenersRef.current.get(event)?.forEach(cb => cb(...args));
          });
        });

        await conn.start();
        connectionRef.current = conn;
        setIsConnected(true);
      } catch (err) {
        console.warn('SignalR connection failed (offline?)', err);
      }
    };

    connect();

    return () => {
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
  }, [isAuthenticated]);   // ← re-runs on login AND logout

  const onEvent = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      if (!listenersRef.current.has(event))
        listenersRef.current.set(event, new Set());
      listenersRef.current.get(event)!.add(callback);
      return () => { listenersRef.current.get(event)?.delete(callback); };
    },
    []
  );

  return (
    <SignalRContext.Provider value={{ isConnected, onEvent }}>
      {children}
    </SignalRContext.Provider>
  );
};

export const useSignalR = () => useContext(SignalRContext);