# VaahanSathi

A hackathon presentation app for the idea: **your car, our verified driver, pay only for the driver's time.** It is designed to make the customer experience and business model easy to understand in a short investor demo.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Express API runs on port 4000. For a production build, use `npm run build`; with `NODE_ENV=production`, `npm start` serves the built site and API.

## 3–5 minute demo

Use the **Sign in** control in the left sidebar. Demo accounts share the password `demo1234`:

| Role | Email |
| --- | --- |
| Customer | `ananya@vaahansathi.demo` |
| Driver | `ramesh@vaahansathi.demo` |
| Admin | `admin@vaahansathi.demo` |

1. Sign in as the customer and book an hourly Sedan driver from Indiranagar to the airport. The four-hour demo estimate is ₹599 including service fee and GST; it shows ₹479 to the driver and ₹120 as VaahanSathi's share.
2. Open **Your trips**, advance the driver to arriving, and start the trip with the displayed OTP.
3. End the trip with the end OTP, rate the driver, then sign in as Ramesh or the admin to show earnings or the operations dashboard.

The demo state persists in `data/demo.json`. Stop the app, delete that file, then restart to reset all demo data and restore the seed accounts. Do not put personal or production customer data in this local demo database.

## Current demo scope

The Express API provides password authentication, role checks, fare estimates, unique bookings, driver assignment, OTP-gated trip transitions, ratings, driver earnings, and admin totals. When the Firebase service-account environment variables are configured, Express hydrates and persists users, bookings, ratings, booking history, and pricing in Cloud Firestore. The local JSON file remains a development fallback. Demo payment status is clearly labelled and is not a real charge. The map is a designed tracking illustration, not live GPS.

Razorpay order creation and signature verification routes are present but require Razorpay **test mode** credentials. The ElevenLabs server token route uses the supplied public Agent ID and requires an ElevenLabs API key. The voice assistant's text request path works without provider credentials. Google Routes is used for road distance when `GOOGLE_MAPS_SERVER_API_KEY` is set; otherwise, known Bengaluru landmarks use a clearly labelled straight-line route estimate. Never put server secrets in frontend variables.

## Optional environment settings

Copy `.env.example` to `.env` and set a strong `JWT_SECRET`. To connect Firestore, enable Cloud Firestore in Native mode, revoke the exposed service-account key, create a replacement service account key with Firestore access, and put its complete JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`; set `FIREBASE_PROJECT_ID` to `vahansathi-4ffae`. For exact live road distance, enable Google Routes API and set `GOOGLE_MAPS_SERVER_API_KEY` to a server-restricted key. Keep `.env` out of source control. Firestore access is server-side only; `firestore.rules` denies direct client access.

## Deployment

The project includes a Render Blueprint (`render.yaml`), a Vite production build, and an Express static-file fallback. Render supplies the port and generates `JWT_SECRET`. In the Render service Environment page, add `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` (the rotated service-account JSON), and optionally `GOOGLE_MAPS_SERVER_API_KEY`; redeploy and check `/api/health` for `integrations.firebase: true` and `integrations.maps: true`. Without those credentials, it deliberately runs in local-demo mode and JSON data may reset when the free service restarts.

## Credential safety

A Firebase service-account private key was pasted into the setup chat. It is not included in this project. Revoke that key in Google Cloud IAM and issue a replacement before connecting Firebase; treat the pasted value as exposed.

