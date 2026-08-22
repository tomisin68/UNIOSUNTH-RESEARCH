# Firebase Setup — UNIOSUNTH Nursing Research Tool

The tool stores every completed assessment in **Cloud Firestore**. There is
**no user authentication** — nurses fill in the assessment anonymously on shared
ward devices. Security is enforced by `firestore.rules`, which validate the
*shape* of every write instead of the identity of the writer.

Until you complete step 3, the app runs fine in **local-only mode**: assessments
save to `localStorage`, and every cloud button stays hidden.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Firestore Database → Create database**.
   Choose **Production mode** and a region close to Osun State
   (`europe-west1` or `eur3` are the usual picks).

## 2. Register the web app

1. **Project settings** (gear icon) → **Your apps** → **Add app** → **Web** `</>`.
2. Give it a nickname (e.g. `nursing-tool`). You do **not** need Firebase Hosting here.
3. Copy the `firebaseConfig` values it shows you.

## 3. Fill in `.env`

```bash
cp .env.example .env
```

Then paste your values:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

These values are **public by design** — a Firebase web config is not a secret.
What protects the data is `firestore.rules`, not hiding these keys.

Vite inlines env vars at build time, so **rebuild after editing `.env`**:

```bash
npm run build
```

## 4. Deploy the security rules

```bash
npm install -g firebase-tools     # once
firebase login
firebase use --add                # pick your project, alias it "default"
firebase deploy --only firestore:rules
```

Without this step Firestore keeps the console's default rules, which after 30
days deny **all** access and every submission will fail.

## 5. (Recommended) Turn on App Check

Because there is no login, Firestore rules cannot tell your app apart from any
other client holding the public config. **App Check** fixes that without adding
a sign-in step — it attests that the request came from *this* app.

1. **Build → App Check → Apps → your web app → reCAPTCHA v3 → Register.**
2. Copy the reCAPTCHA v3 **site key** into `.env`:
   `VITE_FIREBASE_APPCHECK_SITE_KEY=6Lc...`
3. `npm run build`, deploy, confirm requests appear as *verified* in the App
   Check dashboard, and only **then** switch Firestore to **Enforced**.

Enforcing before a verified build is live will lock out your own app.

---

## Data model

One document per assessment, in the `assessment_records` collection.
**The document id is the record id**, which makes re-submits idempotent — a
retried upload overwrites its own document instead of creating a duplicate.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as the document id |
| `nurseCode` | string | Pseudonym, e.g. `NRS-K4M2XP` |
| `ward` | string | |
| `shift` | string | `Morning` \| `Afternoon` \| `Night` |
| `qualification` | string | `RN` \| `BNSc` \| `RN+BNSc` \| `MSc` \| `PhD` |
| `yearsExperience` | string | |
| `patientLoad` | string | |
| `assessmentDate` | string | |
| `timestamp` | string | Local time the assessment was completed |
| `workloadScore` | number | 0–100 |
| `ipcScore` | number | 0–100 |
| `workloadCategory` | string | `Low` \| `Moderate` \| `High` \| `Very High` |
| `ipcCategory` | string | `Poor` \| `Suboptimal` \| `Satisfactory` \| `Optimal` |
| `subscoreWorkload` | map | subscale → 0–100 |
| `subscoreIPC` | map | subscale → 0–100 |
| `workloadResponses` | map | item id → 1–5 |
| `ipcResponses` | map | item id → 1–4 |
| `submittedAt` | timestamp | Server clock; rules reject client-supplied values |

No composite indexes are needed — `orderBy('submittedAt')` is covered by the
automatic single-field index.

## What the rules allow

| Operation | Allowed | Why |
|---|---|---|
| `read` | yes | The coordinator's sync/export runs in the browser with no login |
| `create` | only valid records | Exact field set, enumerated categories, scores 0–100, bounded map sizes, server timestamp |
| `update` | idempotent re-submit only | `id` and `nurseCode` must be unchanged |
| `delete` | never | Records are append-only; a participant's data cannot be wiped remotely |
| anything else | never | Catch-all denies every other path |

**Known limitation:** with no authentication, `read` is open to anyone who has
the project id. Records are pseudonymised (nurse codes, no names), which is what
the ethics protocol assumes — but if the protocol later requires restricted
read access, the fix is a coordinator login via Firebase Auth and a rule of
`allow read: if request.auth != null;`. The in-app coordinator PIN is a UI
gate only; it does not protect the database.

## How the app uses the database

| Feature | Where | What happens |
|---|---|---|
| Submit an assessment | `Results` → *Submit to Study Database* | `setDoc` with the record id, merged |
| Submit an older record | `DataManager` → *Submit* in the row | Same path, with inline status feedback |
| Offline submit | Anywhere | Detected up front; record is queued in `localStorage` |
| Auto-upload | On `online` event and at app start | `flushQueue()` retries every queued record |
| Coordinator download | `DataManager` → *Sync from cloud* | `getDocs`, ordered by `submittedAt` desc, merged into local storage |
| Live updates | `subscribeToRecords()` in `src/utils/sync.ts` | `onSnapshot` helper, available for dashboards |
| Offline reads | Automatic | Firestore persistent IndexedDB cache, multi-tab safe |

## Optional: host the app on Firebase

`firebase.json` already contains a Hosting block pointing at `dist/` with an
SPA rewrite:

```bash
npm run build
firebase deploy --only hosting
```
