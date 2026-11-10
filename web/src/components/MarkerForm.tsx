import { Marker as MapPin, type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AtlasSnapshot, Role } from "@openmrs-atlas/shared";
import { OTHER, OTHER_MAX_LENGTH } from "@openmrs-atlas/shared/lookups";
import {
  ApiError,
  api,
  markerPath,
  type FieldError,
  type MarkerForm as FormData_,
  type MarkerResult,
} from "../lib/api.ts";
import { searchPlaces, type Place } from "../lib/places.ts";
import { AccountPicker } from "./AccountPicker.tsx";
import { SharingControls } from "./SharingControls.tsx";
import { useEscape } from "./useEscape.ts";

const LABELS: Record<string, string> = {
  name: "Name",
  organisation: "Organisation",
  latitude: "Latitude",
  longitude: "Longitude",
  type: "Type",
  distribution: "Distribution",
  openmrs_version: "OpenMRS version",
  site_count: "Number of sites",
  url: "Website",
  logo_url: "Logo",
  notes: "Notes",
  contact_name: "Contact name",
  contact_email: "Contact email",
  owner: "Owner",
  status: "Status",
};

/** The service words reasons by column; people read them by the form's labels. */
function friendly(error: FieldError): string {
  const label = LABELS[error.field];
  return label ? error.reason.replace(new RegExp(`\\b${error.field}\\b`), label) : error.reason;
}

const STATUSES = ["active", "hidden", "closed", "deleted"];
const DRAFT_KEY = "atlas.draft";

type Values = Record<string, string>;
const EMPTY: Values = {
  name: "",
  organisation: "",
  latitude: "",
  longitude: "",
  type: "",
  distribution: "",
  openmrs_version: "",
  site_count: "",
  url: "",
  logo_url: "",
  notes: "",
  contact_name: "",
  contact_email: "",
  owner: "",
  status: "",
};

interface Draft {
  key: string;
  values: Values;
  version?: string;
}

function takeDraft(key: string): Draft | undefined {
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY);
    if (!stored) return undefined;
    const draft = JSON.parse(stored) as Draft;
    if (draft.key !== key) return undefined;
    sessionStorage.removeItem(DRAFT_KEY);
    return draft;
  } catch {
    return undefined;
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Without storage, what was typed is lost on sign-in; nothing else depends on it.
  }
}

type Loaded = { form: FormData_ } | { error: string } | { expired: true };

async function loadForm(id: string): Promise<Loaded> {
  try {
    return { form: await api<FormData_>(markerPath(id)) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { expired: true };
    return { error: err instanceof ApiError ? err.message : "This marker could not be loaded." };
  }
}

function toValues(form: FormData_): Values {
  const values: Values = { ...EMPTY, status: form.status };
  for (const [field, value] of Object.entries(form.fields)) values[field] = String(value ?? "");
  if (form.contact) Object.assign(values, form.contact);
  values.owner = form.owner ?? "";
  return values;
}

interface Props {
  /** Undefined when adding a new marker. */
  markerId?: string;
  snapshot: AtlasSnapshot;
  admin: boolean;
  map: MapLibreMap | null;
  onSaved: (result: MarkerResult, id: string) => void;
  /** A change that keeps the form open, such as adding an editor. */
  onChanged: (result: MarkerResult, id: string) => void;
  onClose: () => void;
  onSignIn: () => void;
  /** The session ended with this form open. */
  sessionEnded: boolean;
}

export function MarkerForm({
  markerId,
  snapshot,
  admin,
  map,
  onSaved,
  onChanged,
  onClose,
  onSignIn,
  sessionEnded,
}: Props) {
  const draftKey = markerId ?? "add";
  const [values, setValues] = useState<Values>(() =>
    markerId ? EMPTY : (takeDraft("add")?.values ?? EMPTY),
  );
  const [initial, setInitial] = useState<Values>(EMPTY);
  const [form, setForm] = useState<FormData_>();
  const [loading, setLoading] = useState(Boolean(markerId));
  const [loadError, setLoadError] = useState<string>();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [expired, setExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [logoError, setLogoError] = useState<string>();

  const role: Role | undefined = form?.role;
  const canContact = !markerId || role === "owner" || role === "admin";
  // A marker that didn't load has no form to fill in, so no location to set.
  const ready = !markerId || Boolean(form);

  const applyLoaded = useCallback(
    (loaded: Loaded) => {
      if ("error" in loaded) {
        setLoadError(loaded.error);
      } else if ("expired" in loaded) {
        setExpired(true);
      } else {
        const fresh = toValues(loaded.form);
        const draft = takeDraft(draftKey);
        setForm(draft?.version ? { ...loaded.form, version: draft.version } : loaded.form);
        setInitial(fresh);
        setValues(draft?.values ?? fresh);
      }
      setLoading(false);
    },
    [draftKey],
  );

  useEffect(() => {
    if (!markerId) return;
    let current = true;
    void loadForm(markerId).then((loaded) => {
      if (current) applyLoaded(loaded);
    });
    return () => {
      current = false;
    };
  }, [markerId, applyLoaded]);

  function reload() {
    if (!markerId) return;
    setLoading(true);
    setLoadError(undefined);
    setConflict(false);
    void loadForm(markerId).then(applyLoaded);
  }

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));
  /** Distribution or version: true once "Other" is chosen, false once a list value is. */
  const [otherChosen, setOtherChosen] = useState<Record<string, boolean>>({});
  /** The field whose Other text input takes focus when it appears, after choosing "Other". */
  const focusOther = useRef<string>(undefined);

  const close = useCallback(() => {
    if (dirty) setDiscarding((showing) => !showing);
    else onClose();
  }, [dirty, onClose]);
  useEscape(close);

  // The question floats at the top of the panel wherever it is scrolled; focus goes to it so
  // keyboard and screen reader users meet it too.
  const keepEditing = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (discarding) keepEditing.current?.focus();
  }, [discarding]);

  // The location: a draggable pin, placed by clicking the map or choosing a search result.
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  const located =
    values.latitude !== "" &&
    values.longitude !== "" &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const pin = useRef<MapPin | null>(null);
  const place = useCallback((lat: number, lng: number) => {
    setValues((v) => ({ ...v, latitude: lat.toFixed(5), longitude: lng.toFixed(5) }));
  }, []);

  useEffect(() => {
    if (!map || !ready) return;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) =>
      place(e.lngLat.lat, e.lngLat.lng);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, ready, place]);

  useEffect(() => {
    if (!map || !located) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      pin.current = new MapPin({ draggable: true, color: "#f3a712" }).setLngLat([
        longitude,
        latitude,
      ]);
      pin.current.on("dragend", () => {
        const at = pin.current!.getLngLat();
        place(at.lat, at.lng);
      });
      pin.current.addTo(map);
    } else {
      pin.current.setLngLat([longitude, latitude]);
    }
  }, [map, located, latitude, longitude, place]);

  useEffect(
    () => () => {
      pin.current?.remove();
      pin.current = null;
    },
    [],
  );

  // Place search
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>();
  const [placeError, setPlaceError] = useState<string>();

  async function findPlace() {
    setPlaceError(undefined);
    try {
      setPlaces(await searchPlaces(placeQuery));
    } catch {
      setPlaces(undefined);
      setPlaceError("Place search isn't available right now. You can click the map instead.");
    }
  }

  function choosePlace(found: Place) {
    place(found.latitude, found.longitude);
    setPlaces(undefined);
    map?.easeTo({ center: [found.longitude, found.latitude], zoom: Math.max(map.getZoom(), 8) });
  }

  async function uploadLogo(file: File) {
    setLogoError(undefined);
    const body = new FormData();
    body.set("logo", file);
    try {
      const { url } = await api<{ url: string }>("/logos", "POST", body);
      set("logo_url", url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      else setLogoError(err instanceof ApiError ? err.message : "The logo could not be uploaded.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    setMessage(undefined);
    setConflict(false);
    const fields = Object.fromEntries(
      [
        "name",
        "organisation",
        "latitude",
        "longitude",
        "type",
        "distribution",
        "openmrs_version",
        "site_count",
        "url",
        "logo_url",
        "notes",
      ].map((f) => [f, values[f] ?? ""]),
    );
    const contact = canContact
      ? { contact_name: values.contact_name, contact_email: values.contact_email }
      : undefined;
    const owner = (values.owner ?? "").trim();
    const ownerChanged = admin && owner !== initial.owner;
    const statusChanged = admin && Boolean(markerId) && values.status !== initial.status;
    const body = {
      fields,
      ...(contact ? { contact } : {}),
      ...(ownerChanged ? { owner } : {}),
      ...(statusChanged ? { status: values.status } : {}),
      ...(markerId ? { version: form?.version } : {}),
    };
    try {
      const result = markerId
        ? await api<MarkerResult>(markerPath(markerId), "PATCH", body)
        : await api<MarkerResult>("/markers", "POST", body);
      onSaved(result, markerId ?? result.id!);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      else if (err instanceof ApiError && err.status === 409) setConflict(true);
      else if (err instanceof ApiError) {
        setErrors(err.errors);
        if (err.errors.length === 0) setMessage(err.message);
      } else setMessage("The marker could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function signInAgain() {
    saveDraft({ key: draftKey, values, version: form?.version });
    onSignIn();
  }

  const errorFor = (field: string) => errors.filter((e) => e.field === field).map(friendly);

  function textField(
    field: string,
    options: { required?: boolean; type?: string; inRequiredGroup?: boolean } = {},
  ) {
    const fieldErrors = errorFor(field);
    return (
      <label>
        {LABELS[field]}
        {options.required && !options.inRequiredGroup && " (required)"}
        <input
          type={options.type ?? "text"}
          value={values[field]}
          required={options.required}
          aria-invalid={fieldErrors.length > 0}
          onChange={(e) => set(field, e.target.value)}
        />
        {fieldErrors.map((reason) => (
          <span key={reason} className="error">
            {reason}
          </span>
        ))}
      </label>
    );
  }

  function selectField(field: string, options: string[], settings: { required?: boolean } = {}) {
    const current = values[field] ?? "";
    // A value the lists no longer hold stays visible, so it can be seen and corrected.
    const all = current && !options.includes(current) ? [current, ...options] : options;
    const fieldErrors = errorFor(field);
    return (
      <label>
        {LABELS[field]}
        {settings.required && " (required)"}
        <select
          value={current}
          required={settings.required}
          aria-invalid={fieldErrors.length > 0}
          onChange={(e) => set(field, e.target.value)}
        >
          <option value="">{settings.required ? "Choose…" : "Not set"}</option>
          {all.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {fieldErrors.map((reason) => (
          <span key={reason} className="error">
            {reason}
          </span>
        ))}
      </label>
    );
  }

  /**
   * A list plus "Other" with a free-text value (specs/marker-editing). The field's value is the
   * list entry, the text, or `Other` when the text is blank.
   */
  function choiceField(field: "distribution" | "openmrs_version", options: string[]) {
    const current = values[field] ?? "";
    const isOther = otherChosen[field] ?? (current !== "" && !options.includes(current));
    const text = isOther && current !== OTHER ? current : "";
    const fieldErrors = errorFor(field);
    const textId = `${field}-other`;
    return (
      <div className="choice-field">
        <label>
          {LABELS[field]}
          <select
            value={isOther ? OTHER : current}
            aria-invalid={fieldErrors.length > 0}
            onChange={(e) => {
              const chosen = e.target.value;
              if (chosen === OTHER) {
                setOtherChosen((o) => ({ ...o, [field]: true }));
                set(field, text || OTHER);
                focusOther.current = field;
              } else {
                setOtherChosen((o) => ({ ...o, [field]: false }));
                set(field, chosen);
              }
            }}
          >
            <option value="">Not set</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        </label>
        {isOther && (
          <label htmlFor={textId} className="other-value">
            {field === "distribution" ? "Distribution name" : "Version"} (optional)
            <input
              id={textId}
              ref={(el) => {
                if (el && focusOther.current === field) {
                  focusOther.current = undefined;
                  el.focus();
                }
              }}
              type="text"
              value={text}
              maxLength={OTHER_MAX_LENGTH[field]}
              aria-invalid={fieldErrors.length > 0}
              onChange={(e) => set(field, e.target.value.trim() === "" ? OTHER : e.target.value)}
            />
          </label>
        )}
        {fieldErrors.map((reason) => (
          <span key={reason} className="error">
            {reason}
          </span>
        ))}
      </div>
    );
  }

  const title = markerId ? "Edit marker" : "Add a site";

  return (
    <aside className="panel marker-form" aria-label={title}>
      <div className="panel-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close form" onClick={close}>
          ×
        </button>
      </div>

      {discarding && (
        <div role="alertdialog" aria-label="Discard your changes?" className="confirm floating">
          <p>Discard your changes?</p>
          <div className="button-row">
            <button type="button" className="primary" onClick={onClose}>
              Discard
            </button>
            <button
              ref={keepEditing}
              type="button"
              className="secondary"
              onClick={() => setDiscarding(false)}
            >
              Keep editing
            </button>
          </div>
        </div>
      )}

      {(expired || sessionEnded) && (
        <div role="alert" className="confirm">
          <p>
            {ready
              ? "Your session has ended. Sign in again to carry on; what you typed will be kept."
              : "Your session has ended. Sign in again to edit this marker."}
          </p>
          <button type="button" className="primary" onClick={signInAgain}>
            Sign in again
          </button>
        </div>
      )}

      {conflict && (
        <div role="alert" className="confirm">
          <p>
            Someone else has changed this marker since you opened it, so your changes weren't saved.
            What you typed is still here.
          </p>
          <button type="button" className="secondary" onClick={reload}>
            Load the latest version (replaces what you typed)
          </button>
        </div>
      )}

      {loading && <p role="status">Loading…</p>}
      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && ready && (
        <>
          {form && form.problems.length > 0 && (
            <p className="error">Needs fixing: {form.problems.join("; ")}</p>
          )}
          <form onSubmit={(e) => void save(e)} noValidate={false}>
            {textField("name", { required: true })}

            <fieldset>
              <legend>Location (required)</legend>
              <p className="hint">
                Search for a place or click the map, then drag the pin to adjust it.
              </p>
              <div className="place-search">
                <label>
                  Find a place
                  <input
                    type="search"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (placeQuery.trim()) void findPlace();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={!placeQuery.trim()}
                  onClick={() => void findPlace()}
                >
                  Search
                </button>
              </div>
              {placeError && <p className="error">{placeError}</p>}
              {places && (
                <>
                  {places.length === 0 && <p className="hint">No places found.</p>}
                  <ul className="place-results">
                    {places.map((p) => (
                      <li key={`${p.latitude},${p.longitude},${p.name}`}>
                        <button type="button" className="link" onClick={() => choosePlace(p)}>
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="hint">Place search by OpenStreetMap Nominatim.</p>
                </>
              )}
              <div className="coordinates">
                {textField("latitude", { required: true, inRequiredGroup: true })}
                {textField("longitude", { required: true, inRequiredGroup: true })}
              </div>
            </fieldset>

            {selectField(
              "type",
              snapshot.types.map((t) => t.name),
              { required: true },
            )}
            {textField("organisation")}
            {choiceField(
              "distribution",
              snapshot.distributions.map((d) => d.name),
            )}
            {choiceField(
              "openmrs_version",
              snapshot.versions.map((v) => v.version),
            )}
            {textField("site_count", { type: "number" })}
            {textField("url", { type: "url" })}

            <label>
              Logo (PNG, JPEG or WebP, up to 2 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
            </label>
            {values.logo_url && (
              <div className="logo-preview">
                <img className="logo" src={values.logo_url} alt="Logo preview" />
                <button type="button" className="link" onClick={() => set("logo_url", "")}>
                  Remove logo
                </button>
              </div>
            )}
            {logoError && (
              <p className="error" role="alert">
                {logoError}
              </p>
            )}

            <label>
              {LABELS.notes}
              <textarea
                rows={4}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
              {errorFor("notes").map((reason) => (
                <span key={reason} className="error">
                  {reason}
                </span>
              ))}
            </label>

            {canContact && (
              <fieldset>
                <legend>Contact</legend>
                <p className="hint">Contact details are private and are never published.</p>
                {textField("contact_name")}
                {textField("contact_email", { type: "email" })}
              </fieldset>
            )}

            {admin && (
              <fieldset>
                <legend>Admin</legend>
                <AccountPicker
                  label={LABELS.owner!}
                  value={values.owner ?? ""}
                  onChange={(username) => set("owner", username)}
                />
                {errorFor("owner").map((reason) => (
                  <span key={reason} className="error">
                    {reason}
                  </span>
                ))}
                {markerId && selectField("status", STATUSES, { required: true })}
              </fieldset>
            )}

            {errors
              .filter((e) => !(e.field in EMPTY))
              .map((e) => (
                <p key={e.reason} className="error" role="alert">
                  {friendly(e)}
                </p>
              ))}
            {errors.length > 0 && (
              <p className="error" role="alert">
                Please check the highlighted fields.
              </p>
            )}
            {message && (
              <p className="error" role="alert">
                {message}
              </p>
            )}
            <div className="button-row">
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>

          {markerId && form?.editors && (
            <SharingControls
              markerId={markerId}
              editors={form.editors}
              offerTo={form.offer_to}
              hasOwner={Boolean(form.owner)}
              onResult={(result) => {
                setForm((f) => (f ? { ...f, version: result.version } : f));
                onChanged(result, markerId);
              }}
              onEditors={(editors) => setForm((f) => (f ? { ...f, editors } : f))}
              onOffer={(to) => setForm((f) => (f ? { ...f, offer_to: to } : f))}
            />
          )}
        </>
      )}
    </aside>
  );
}
