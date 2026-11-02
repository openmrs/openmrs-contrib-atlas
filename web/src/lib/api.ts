import type { PublicMarker, Role } from "@openmrs-atlas/shared";
import { getToken } from "../auth/session.ts";
import { config } from "../config.ts";

export interface FieldError {
  field: string;
  reason: string;
}

export class ApiError extends Error {
  status: number;
  errors: FieldError[];

  constructor(status: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export interface MyMarker {
  id: string;
  name: string;
  role: Role;
  status: string;
  confirmed_at: string;
  problems?: string[];
}

export interface Offer {
  marker_id: string;
  name: string;
  from: string;
  expires_at: string;
}

export interface Me {
  username: string;
  admin: boolean;
  markers: MyMarker[];
  offers: Offer[];
}

export interface MarkerForm {
  id: string;
  role: Role;
  version: string;
  status: string;
  fields: Record<string, string | number>;
  problems: string[];
  contact?: { contact_name: string; contact_email: string };
  owner?: string;
  editors?: string[];
  offer_to?: string;
}

/** What the service says after a change that may have touched the public map. */
export interface MarkerResult {
  id?: string;
  version: string;
  status: string;
  marker: PublicMarker | null;
  published: boolean;
  editors?: string[];
  offer_to?: string;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = await getToken();
  if (token === undefined) throw new ApiError(401, "Please sign in.");
  const form = body instanceof FormData;
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    errors?: FieldError[];
  };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Something went wrong.", data.errors);
  }
  return data as T;
}

export const markerPath = (id: string) => `/markers/${encodeURIComponent(id)}`;

/** Told to whoever made a change: they see it now, others when the cached files expire. */
export function savedNotice(published: boolean): string {
  return published
    ? "Saved. Others will see this within 10 minutes."
    : "Saved. Others will see this after the next publish, within a day at most.";
}
