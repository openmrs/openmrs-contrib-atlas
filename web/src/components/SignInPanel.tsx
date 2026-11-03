import { useEscape } from "./useEscape.ts";

interface Props {
  onSignIn: () => void;
  onClose: () => void;
}

/** Says why someone would sign in before sending them to Keycloak. */
export function SignInPanel({ onSignIn, onClose }: Props) {
  useEscape(onClose);
  return (
    <aside className="panel compact" aria-label="Sign in">
      <div className="panel-header">
        <h2>Sign in to add or update your site</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="hint">Use your OpenMRS ID. You don't need to sign in to view the map.</p>
      <div className="button-row sign-in-action">
        <button type="button" className="primary" onClick={onSignIn}>
          Sign in with OpenMRS ID
        </button>
      </div>
    </aside>
  );
}
