import { useCallback, useEffect, useState } from "react";
import { ApiError, api, type Me } from "../lib/api.ts";
import { checkSession, hasSession, onSessionEnded, sessionEndsAt } from "./session.ts";

export type Session =
  | {
      status: "anonymous";
      error?: string;
      /** Set when a session ended on this page, so a form left open keeps its admin fields. */
      wasAdmin?: boolean;
    }
  | { status: "loading" }
  | { status: "signed-in"; me: Me };

/** A timer's longest wait; beyond this, browsers fire it at once. */
const MAX_WAIT_MS = 2 ** 31 - 1;

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

/** Failing to reach the service doesn't end a session, and an ended one is already recorded. */
function merge(current: Session, next: Session): Session {
  return next.status === "anonymous" && current.status !== "loading" ? current : next;
}

/** Who is signed in, what they hold on which markers, and a way to refresh that. */
export function useSession(onEnded: () => void) {
  const [session, setSession] = useState<Session>(() =>
    hasSession() ? { status: "loading" } : { status: "anonymous" },
  );

  const refresh = useCallback(
    () => loadSession().then((next) => setSession((current) => merge(current, next))),
    [],
  );

  useEffect(() => {
    // Only when a session exists: visitors never call the service.
    if (!hasSession()) return;
    let current = true;
    void loadSession().then(async (next) => {
      if (current) setSession((was) => merge(was, next));
      if (next.status !== "signed-in") return;
      // A session has started: the service confirms this person's recently confirmed markers
      // (specs/marker-editing). It never blocks signing in.
      try {
        const { confirmed } = await api<{ confirmed: string[] }>("/me/confirm-recent", "POST");
        if (confirmed.length > 0 && current) {
          const again = await loadSession();
          if (current) setSession((was) => merge(was, again));
        }
      } catch (err) {
        console.warn("Confirming recent markers failed", err);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(
    () =>
      onSessionEnded(() => {
        setSession((current) => ({
          status: "anonymous",
          wasAdmin: current.status === "signed-in" ? current.me.admin : undefined,
        }));
        onEnded();
      }),
    [onEnded],
  );

  // Nothing calls the service while a page sits idle, so look for the end of the session too.
  const signedIn = session.status === "signed-in";
  useEffect(() => {
    if (!signedIn) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const watchEnd = async () => {
      const endsAt = await sessionEndsAt();
      if (stopped || endsAt === undefined) return;
      const wait = endsAt - Date.now();
      if (wait <= 0) void checkSession();
      else timer = setTimeout(() => void watchEnd(), Math.min(wait, MAX_WAIT_MS));
    };
    void watchEnd();

    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [signedIn]);

  return { session, refresh };
}
