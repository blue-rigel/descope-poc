This is a Next.js proof of concept for Descope authentication, including a
custom Bring Your Own Screen (BYOS) Flow built with
`@descope/web-component`.

## BYOS Flow Setup

Create a Descope Flow and configure these public environment variables. Copy
the exact Flow ID from the Descope Console, ensure the Flow belongs to the
configured project, and activate it before running this page.

```dotenv
NEXT_PUBLIC_PROJECT_ID=<project-id>
NEXT_PUBLIC_DESCOPE_FLOW_ID=<exact-active-flow-id-from-descope-console>
# Optional for a custom Descope domain:
NEXT_PUBLIC_DESCOPE_BASE_URL=https://auth.example.com
```

The `/auth/login` route recognizes this explicit Flow contract:

| Screen name | Interaction IDs | Inputs |
| --- | --- | --- |
| `Welcome Screen` | `continue-with-password` | `email`, `password` |
| `Welcome Screen` | `continue-with-email` | `email` |
| `Welcome Screen` | `gSxXWXi6pr` | `provider: google` |
| `Magic Link Sent` | `resend`, `EbW8KMdjAx` | `email` for resend |

Use these exact, unique names in the Flow Builder or update the constants in
`app/auth/login/page.tsx`. The generated IDs above belong to the currently
active `headless-sign-up-or-in` Flow and must be updated if its interactions
are recreated. Configure Google OAuth for popup mode and allow
`http://localhost:3000/auth/login` plus the production `/auth/login` URL as
redirect URLs.

The web component owns Flow execution, polling, redirects, WebAuthn, and token
persistence. `/auth/login` uses its `onScreenUpdate` callback to replace the
two screens above with local React UI and calls the supplied `next` function
with the configured Interaction ID and inputs. Other screens fall back to the
Descope-rendered UI. Successful Flow responses are refreshed through the shared
web SDK so its `DS` cookie is available to `proxy.ts`.

## Native (iOS / Android) webview flow

`docs/ARCHITECTURE.md` and `docs/non-web-platform-flow.md` describe how native
apps authenticate: the app opens a webview on a standalone host, the host runs
the flow, and the finished session is handed back to the app as an OAuth
authorization `code` on a deep link. The same shape is implemented here.

**The apps run no authentication flow of their own.** Every screen the user sees
is this web interface inside their webview — the login form lives at
`/native/login` (`_components/native-login-form.tsx`: email + password, email
one-time code, Google). The webview also does all of the OAuth work, including
PKCE, so the app's only job is a single token call.

```dotenv
# Optional: CDN origin serving <base>/config/<pubId>/clientConfig.json
NEXT_PUBLIC_STATIC_BASE_URL=https://static.example.com
# The Descope Inbound (OIDC) Application whose client id mints the app's code
NEXT_PUBLIC_APP_ID=<inbound-app-id>
```

The app opens:

```
/native/login?pubId=st&platform=ios&redirectUrl=myapp%3A%2F%2Fauth%2Fcallback
             &deviceId=…&osVersion=…&appVersion=…&state=…&scope=…
```

| Hop | What happens |
| --- | --- |
| 1 | `/native/login` resolves the client config (query params → CDN by `pubId` → stored), captures `MobileParameters` and the app's `state`/`scope`, revokes any stale session, and renders the login form |
| 2 | On success `/native/handoff` generates a PKCE pair and calls `{baseUrl}/oauth2/v1/apps/authorize?…&prompt=none` with **this webview** as `redirect_uri` |
| 3 | `/native/callback` receives the code and redirects to the app: `myapp://auth/callback?code=…&code_verifier=…&state=…` |
| 4 | The app exchanges that pair at `{baseUrl}/oauth2/v1/apps/token` — no PKCE generation, no auth UI, no SDK flow |

Register **both** redirect URLs on the Inbound Application: this app's
`/native/callback`, and the app's deep link.

Carried over from the legacy flow, plus what this shape adds:

- **Clean-session pre-work** before the form renders (`prepareNativeLaunch`).
- **Redirect-in-flight guard** — `/native/login` renders nothing while a
  hand-off is navigating the webview away (expires after two minutes).
- **Android needs a user gesture** for a custom-scheme navigation, so the final
  deep link there sits behind a Finish button; iOS redirects immediately.
- **`prompt=none` is decided by the login form.** Password and one-time-code
  sign-ins happen as API calls from this origin, so the webview has no IdP
  cookie to present and the form drops `prompt=none`
  (`setSilentAuthorization(false)`) — the authorization goes straight to
  interactive instead of spending a round trip on `login_required`. Social
  sign-in navigates to the IdP, so it stays silent. Either way the callback
  still retries once interactively if a silent request comes back needing a
  prompt, which renders Descope's hosted login in the webview rather than
  failing.
- **Failures reach the app too** — an authorization error is deep-linked back as
  `?error=…` instead of stranding the user in the webview.
- **Google blocks OAuth in embedded webviews**, so the host app must open that
  leg in the system browser (Custom Tabs / `ASWebAuthenticationSession`).
- **The verifier travels with the code**, which means PKCE here is transport
  plumbing, not proof of possession: the deep link is the trust boundary, so
  claim it with App Links / Universal Links rather than a bare custom scheme.

> The orchestrator-side pieces in `docs/` — `/sessions/*`, `/credential/…`,
> `/proxy/…`, the quota engine and the Token/Session microservice clients — are
> server endpoints. This PoC is a static export (`output: "export"`, API routes
> disabled), so they are not implemented here; they would need the API routes
> re-enabled or a separate service.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
