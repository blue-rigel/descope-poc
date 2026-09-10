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
| `Welcome Screen` | `ygSMAX5_SA`, `gSxXWXi6pr` | `email`, or `provider: google` |
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
