import { useCallback, useEffect, useState } from "react";
import { ApiError, api, type Me } from "../lib/api.ts";
import { hasSession } from "./session.ts";

export type Session =
  { status: "anonymous"; error?: string } | { status: "loading" } | { status: "signed-in"; me: Me };

async function loadSession(): Promise<Session> {
  try {
    return { status: "signed-in", me: await api<Me>("/me") };
  } catch (err) {
    const ended = err instanceof ApiError && err.status === 401;
    return {
      status: "anonymous",
      error: ended ? undefined : "Sign-in is unavailable right now. The map still works.",
    };
  }
}

/** Who is signed in, what they hold on which markers, and a way to refresh that. */
export function useSession() {
  const [session, setSession] = useState<Session>(() =>
    hasSession() ? { status: "loading" } : { status: "anonymous" },
  );

  const refresh = useCallback(() => loadSession().then(setSession), []);

  useEffect(() => {
    // Only when a session exists: visitors never call the service.
    if (!hasSession()) return;
    let current = true;
    void loadSession().then((next) => {
      if (current) setSession(next);
    });
    return () => {
      current = false;
    };
  }, []);

  return { session, refresh };
}
