import { useEffect, useId, useRef, useState } from "react";
import { ApiError, searchAccounts, type AccountSummary } from "../lib/api.ts";

interface Props {
  label: string;
  value: string;
  onChange: (username: string) => void;
  /** Enter with no suggestion open, for example to add the typed ID. */
  onSubmit?: () => void;
  disabled?: boolean;
}

export const MIN_SEARCH = 3;
const DEBOUNCE_MS = 300;

/**
 * An OpenMRS ID field that suggests accounts by username or name once 3 characters are typed.
 * Suggestions show usernames and names only. Typing an exact ID still works: the service
 * checks it either way. See specs/account-lookup.
 */
export function AccountPicker({ label, value, onChange, onSubmit, disabled }: Props) {
  // Suggestions and problems belong to the query they answered, so a stale answer never shows.
  const [answer, setAnswer] = useState<{ q: string; results: AccountSummary[]; problem?: string }>({
    q: "",
    results: [],
  });
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();
  const latest = useRef("");
  const q = value.trim();
  const current = q.length >= MIN_SEARCH && answer.q === q ? answer : undefined;
  const results = current?.results ?? [];
  const problem = current?.problem;

  useEffect(() => {
    latest.current = q;
    if (q.length < MIN_SEARCH) return;
    const timer = setTimeout(() => {
      searchAccounts(q)
        .then((found) => {
          if (latest.current !== q) return;
          setAnswer({ q, results: found.filter((a) => a.username !== q.toLowerCase()) });
          setActive(0);
        })
        .catch((err: unknown) => {
          if (latest.current !== q) return;
          // Without suggestions the typed ID still works, so only say why.
          setAnswer({
            q,
            results: [],
            problem:
              err instanceof ApiError && err.status !== 503
                ? err.message
                : "Suggestions aren't available just now; you can still type an OpenMRS ID.",
          });
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const open = results.length > 0 && !dismissed;

  function pick(account: AccountSummary) {
    onChange(account.username);
    setDismissed(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open) pick(results[active]!);
      else onSubmit?.();
    } else if (e.key === "Escape" && open) {
      // Close the suggestions, not the panel.
      e.stopPropagation();
      setDismissed(true);
    }
  }

  return (
    <div className="account-picker">
      <label>
        {label}
        <input
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder="Username or name"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setDismissed(false);
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setDismissed(true)}
          onFocus={() => setDismissed(false)}
        />
      </label>
      {open && (
        <ul id={listId} role="listbox" aria-label="Matching OpenMRS IDs" className="search-results">
          {results.map((account, i) => (
            <li
              key={account.username}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(account)}
            >
              <span className="result-name">{account.username}</span>
              {account.name && <span className="result-meta">{account.name}</span>}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="hint">{problem}</p>}
    </div>
  );
}
