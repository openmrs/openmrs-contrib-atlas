import { useId, useState } from "react";
import { useEscape } from "./useEscape.ts";

interface Props {
  onSignIn: (keep: boolean) => void;
  onClose: () => void;
}

/** Says why someone would sign in before sending them to Keycloak. */
export function SignInPanel({ onSignIn, onClose }: Props) {
  useEscape(onClose);
  // Off unless the person ticks it (specs/user-sign-in, "Signing in explains itself").
  const [keep, setKeep] = useState(false);
  const hintId = useId();
  return (
    <aside className="panel compact" aria-label="Sign in">
      <div className="panel-header">
        <h2>Sign in to add or update your site</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="hint">Use your OpenMRS ID. You don't need to sign in to view the map.</p>
      <label className="checkbox keep-signed-in">
        <input
          type="checkbox"
          checked={keep}
          aria-describedby={hintId}
          onChange={(e) => setKeep(e.target.checked)}
        />
        Keep me signed in on this device
      </label>
      {/* Keycloak's offline idle time for both realms (service/README.md, "Keycloak"). */}
      <p className="hint" id={hintId}>
        Only on a device you don't share. You'll stay signed in until you sign out or don't visit
        for 30 days.
      </p>
      <div className="button-row sign-in-action">
        <button type="button" className="primary" onClick={() => onSignIn(keep)}>
          Sign in with OpenMRS ID
        </button>
      </div>
    </aside>
  );
}
