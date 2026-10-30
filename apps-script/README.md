# Atlas sheet Apps Script

A script bound to the Atlas sheet, which keeps direct edits by admins in step with the public map.

- **On every edit to `markers`**, it gives new rows an `id` (a UUID), sets `updated_at`, and
  appends one row per edited marker to `changes`: time, editor, marker id, add/edit, and the
  columns edited.
- **On edits to `markers` or the lookup tabs**, it asks the publish service for a publish. Edits
  are debounced: the first one schedules a publish a minute later, and edits in that minute ride
  along with it. So publishing happens at most once a minute.
- **The Atlas menu** offers _Publish now_, _Force publish (skip safety check)_ and _Install
  triggers_.

Edits made through the Sheets API, by the service or the migration, don't fire the trigger, so
there are no loops. If a trigger is ever missed, the nightly publish catches up.

The code is plain JavaScript in [`src/Code.js`](src/Code.js), because Apps Script runs JavaScript.
`npm test` covers its row-handling logic (`planMarkerEdit`).

## Installing on a sheet

### Option A: copy and paste

1. In the sheet, open **Extensions › Apps Script**.
2. Replace `Code.gs` with the contents of `src/Code.js`.
3. Under **Project Settings**, tick "Show appsscript.json", then replace that file with
   `src/appsscript.json`.
4. Still in **Project Settings › Script Properties**, add:

   | Property         | Value                                                                                                                      |
   | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
   | `SERVICE_URL`    | The publish service, e.g. `https://atlas-service-stg-….run.app`, or an ngrok/cloudflared URL for a service on your laptop. |
   | `PUBLISH_SECRET` | The same value as the service's `PUBLISH_SECRET`.                                                                          |

5. Reload the sheet. Choose **Atlas › Install triggers** and approve the permissions.

### Option B: clasp

```sh
cd apps-script
npx @google/clasp@3.3.0 login
npx @google/clasp@3.3.0 clone <script-id> --rootDir src   # the script id is in Project Settings
npx @google/clasp@3.3.0 push
```

`.clasp.json` binds your checkout to one sheet's script and is git-ignored. Set the Script
Properties and install the triggers as in steps 4–5.

## Permissions it asks for

| Scope                      | Why                                                       |
| -------------------------- | --------------------------------------------------------- |
| `spreadsheets.currentonly` | Read and write this sheet only.                           |
| `script.external_request`  | Call the publish service.                                 |
| `script.scriptapp`         | Create the edit trigger and the one-off publish triggers. |
| `userinfo.email`           | Record who made an edit in `changes`.                     |

The editor's email is only available when the editor and the script owner are in the same
Google Workspace domain. Otherwise `changes` records `unknown`, and the sheet's own version
history still shows who edited.
