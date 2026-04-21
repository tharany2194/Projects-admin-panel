## Crowfy Admin

Crowfy Admin is a business operations dashboard for client, project, task, quotation, invoice, and payment management.

## Environment Setup

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

### Web Push Setup (Admin + Staff Notifications)

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add generated values to:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WEB_PUSH_CONTACT_EMAIL`

Push notifications are triggered for:

- Task created
- Task updated / stage moved
- Invoice created
- Invoice payment status changed

The app registers a service worker (`public/sw.js`) and auto-subscribes logged-in users when notification permission is granted.

### Mobile Push (Android + iOS)

1. Android:
- Install app from Chrome menu (Add to Home Screen / Install app).
- Allow notifications for the site/PWA.

2. iOS:
- Open in Safari only.
- Add to Home Screen and launch from Home Screen icon.
- Allow notifications when prompted from inside installed app.

3. General requirements:
- Push notifications require HTTPS in production.
- For localhost development, restart server after changing `.env.local`.
- If notifications were previously blocked, reset site notification permission and try again.

## Getting Started

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

Open [http://localhost:3000](http://localhost:3000) with your browser.
