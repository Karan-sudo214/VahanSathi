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

The Express API provides password authentication, role checks, fare estimates, unique bookings, driver assignment, OTP-gated trip transitions, ratings, driver earnings, and admin totals. The local JSON store keeps the demo dependency-light and easy to reset. Demo payment status is clearly labelled and is not a real charge. The map is a designed tracking illustration, not live GPS.

Razorpay order creation and signature verification routes are present but require Razorpay **test mode** credentials. The ElevenLabs server token route uses the supplied public Agent ID and requires an ElevenLabs API key. The voice assistant's text request path works without provider credentials. Google Maps and Firebase are not connected in this lightweight presentation build; add those integrations before using the app for real dispatch, location, or customer data. Never put server secrets in frontend variables.

## Optional environment settings

Copy `.env.example` to `.env` and set a strong `JWT_SECRET`. Set provider credentials only if enabling the corresponding integration. Keep `.env` out of source control. For production, replace the local JSON store with Firestore or a managed database, add persistent session and account recovery flows, use an HTTPS deployment, restrict browser API keys by referrer, and configure provider webhooks before taking payments.

## Deployment

The project includes a Render Blueprint (`render.yaml`), a Vite production build, and an Express static-file fallback. Connect the project repository to Render and create a Blueprint instance to deploy. Render supplies the port and generates `JWT_SECRET`. The free demo uses local JSON storage, which can reset when the service restarts; use a persistent database for production. The local JSON store is not a production multi-user database.

## Credential safety

A Firebase service-account private key was pasted into the setup chat. It is not included in this project. Revoke that key in Google Cloud IAM and issue a replacement before connecting Firebase; treat the pasted value as exposed.
