# VaahanSathi — Your Car, Our Driver 🚗

VaahanSathi is an on-demand driver booking platform for Indian car owners. Customers book verified, professional drivers who drive the customer’s personal car. Customers pay strictly for the driver's time and service — never for a rented vehicle.

---

## 🚀 Key Features

- **Full-Stack Application**: Node.js / Express backend + React 18, TypeScript, and Vite frontend.
- **Neon Serverless PostgreSQL Database**: High-performance, scalable cloud persistence using connection pooling and SSL encryption.
- **Role-Based Authentication**: Secure JWT + bcrypt authentication for Customers, Driver Partners, and Operations Admins.
- **Smart Fare Engine**:
  - GST-inclusive Delhi NCR baseline packages: 4 hours / 40 km ₹499, 8 hours / 80 km ₹899, and 12 hours / 120 km ₹1,299.
  - Configurable local extra distance, overtime, outstation, airport and night tariffs, with vehicle-class multipliers.
  - Every quote is independently reconciled across itemised charges, GST, platform commission and driver payout. An eight-minute signed quote locks the exact amount reviewed by the customer to the booking request.
  - Admin price changes require an audit reason and pass server-side rules for monotonic package tiers, valid tax/commission limits, and upper market guardrails. High or inconsistent rates are blocked.
  - No hidden demand-based surge is applied. The engine changes the amount only for disclosed trip, duration, vehicle, distance and night factors; driver availability is used for dispatch, not arbitrary customer price inflation.
  - A configured OSRM-compatible routing provider can return road distance/duration. Without one, the app clearly labels the distance as approximate rather than claiming live traffic routing.
  - Fuel, tolls and parking for the customer's own car remain separate approved trip expenses.
- **Cash Collection**: cash trips complete with the normal trip end OTP; the assigned driver then marks cash collected. There is no separate cash PIN, customer-side cash confirmation, or cash handover OTP.
- **Customer Support Desk & Driver Accountability**: customers and drivers can open booking-linked support tickets, receive an immediate ticket acknowledgement, follow ticket replies and statuses, and add more information. Safety concerns receive urgent priority. The support desk tracks a 48-hour first-response target and a 30-day resolution target; admins can reply, escalate, wait for the customer, resolve or close tickets. Separate driver-misconduct complaints remain auditable, and earnings adjustments are recorded only after a complaint is substantiated.
- **Smart Dispatch Priority**: immediate and scheduled requests are separated; immediate long trips rank ahead of future scheduled requests, while server-side overlap checks protect trips a driver has already accepted.
- **Customer-Approved Trip Expenses**: during an active trip, drivers can request unexpected fuel, toll, parking or other expenses. Petrol requests require a fresh nozzle-at-fuel-inlet photo, app-captured GPS with accuracy/timestamps, and a server-generated GPS proof snapshot. Customers approve or decline before the driver spends. The driver then uploads the station receipt; only the receipted amount up to the approved limit is added to the final booking payment. Private photos use the existing Cloudflare R2 bucket.
- **Two-Step OTP Lifecycle**:
  - Secure 4-digit **Start OTP** shared only when entering the vehicle.
  - Secure 4-digit **End OTP** required to conclude the ride.
- **Interactive Trip Simulation**: Live animated route preview with ETA counter and status tracker.
- **Driver Partner Portal**: Manage duty status, review dispatch priority, accept local requests, enter trip OTPs, mark cash collected, respond to customer complaints, and track net earnings after approved adjustments.
- **Admin Operations Console**: Live network metrics, active trips monitor, driver partner approvals, and dynamic pricing controls.
- **Voice Assistant**: Natural language booking request parser.
- **Modern UI / UX**: World-class typography with Google Fonts `Plus Jakarta Sans` and `Inter`, accessible contrast ratios, and responsive mobile drawer.

---

## 🔑 Demo Accounts

The server creates or refreshes these accounts in local storage and Neon DB:

| Role | Email | Password | Default City |
| :--- | :--- | :--- | :--- |
| **Customer** | `ananya@vaahansathi.demo` | `password123` | Delhi |
| **Driver Partner** | `ramesh@vaahansathi.demo` | `password123` | Gurugram |
| **Operations Admin** | `admin@vaahansathi.demo` | `password123` | Delhi |

*(You can also use the 1-Click Quick Sign-In buttons directly on the login modal!)*

## Location lookup and fares

The booking form accepts addresses and landmarks across Delhi and Gurugram. On **Estimate fare**, the server geocodes both locations through `GEOCODER_URL` (OpenStreetMap Nominatim by default), caches results, and limits lookup traffic to one request per second. When `ROUTING_URL` points to an authorized OSRM-compatible router, fare quotes use its driving distance and duration. If it is not configured or unavailable, the app uses a clearly labelled approximate road-distance estimate; this must not be presented as live traffic or exact navigation.

The quote is signed server-side, valid for eight minutes, tied to the trip inputs and current tariff revision, and rechecked when the booking is created. An expired quote or a tariff revision change requires a fresh estimate. The booking price is never accepted from a client-supplied amount.

The booking form discloses the lookup and displays OpenStreetMap attribution. Nominatim must not be used for autocomplete and is subject to its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). For higher-volume production use, configure a compatible geocoding and routing service you are authorized to use.

---

## 🛠️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=your-secure-jwt-secret-key-here
DATA_PATH=./data/app.json
GEOCODER_URL=https://nominatim.openstreetmap.org/search
# Optional contact detail included in the geocoder User-Agent
GEOCODER_CONTACT=you@example.com
# Optional OSRM-compatible routing provider. Leave blank to use a labelled approximate distance estimate.
ROUTING_URL=https://your-authorized-routing-provider.example

# Neon PostgreSQL connection string (optional; local JSON storage is used otherwise)
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require
```

---

## 📦 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build and Run**:
   - Dev mode (concurrent server + client):
     ```bash
     npm run dev
     ```
   - Build for production:
     ```bash
     npm run build
     ```
   - Start production server:
     ```bash
     npm start
     ```

Frontend runs at `http://localhost:5173`, Express API runs at `http://localhost:4000`.

---

## 🌐 Deploying on Render

1. Connect the GitHub repository [`Karan-sudo214/VahanSathi`](https://github.com/Karan-sudo214/VahanSathi) to your Render Web Service.
2. Under the Render **Environment** tab, set:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `JWT_SECRET`: Random secure string (or let Render auto-generate).
   - `NODE_ENV`: `production`.
3. Render uses Node.js `24.14.1`, runs `npm ci --include=dev && npm run build`, and starts `npm start`.
4. In Render, configure `DATABASE_URL` (Neon PostgreSQL) and keep `JWT_SECRET` generated by Render. The production health check returns HTTP 503 until Neon is connected, so the service is not marked ready while it would fall back to ephemeral local JSON.
5. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the Render Environment tab to enable real online checkout. Configure the R2 variables in `.env.example` to enable private CarCare / TripGuard / support evidence storage. These credentials are not stored in Git.
6. For more accurate route distance, configure an authorized OSRM-compatible `ROUTING_URL`. Otherwise, the user interface explicitly labels the route distance as approximate.
7. Configure official and monitored `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `GRIEVANCE_OFFICER_NAME`, `GRIEVANCE_OFFICER_DESIGNATION`, and the grievance email/phone variables. Do not leave placeholder contacts in a production deployment. The in-app ticket desk immediately acknowledges tickets, tracks a 48-hour first-response target, and a 30-day resolution target.
8. Health check endpoint: `/api/health`. CI runs `npm ci`, `node --check server/index.js`, and `npm run build` for pull requests targeting `main`.


## Fare market review references

The Smart Fare market guardrails are seeded from Delhi NCR driver-only service rate cards checked on 23 November 2026: [Vahanik Driver](https://vahanikdriver.com/pricing) listed ₹399 / ₹699 / ₹999 for 4 / 8 / 12-hour packages, while [KaamEasy](https://www.kaameasy.in/pricing) listed ₹500 / ₹870 / ₹1,225 for the same hourly slabs. These are comparison references, not a live competitor feed, an independent audit of competitor quality, or a guarantee that a competitor quote applies to a particular route or vehicle. Guardrails are manually maintained. The app blocks rates above configured upper limits and flags below-band tariffs for admin review.

## Tax configuration note

Smart Fare independently checks the arithmetic at the GST rate configured by an authorised admin; it does not determine the legal classification of the underlying driver service. The app defaults to the existing 5% configuration, which must not be treated as legally confirmed. A Karnataka advance ruling involving a DriveU-style platform distinguishes the platform's intermediary service from the independent driver's driving/manpower service, and notes that the driver's own taxability is separate from the platform determination ([Humble Mobile Solutions Pvt. Ltd., Advance Ruling No. KAR ADRG 58/2019](https://www.casemine.com/judgement/in/5ffe98519fca1917ab0ed4f4)). Obtain advice for VaahanSathi's actual contracts, payment collection, supplier registration and tax-credit position before confirming the GST rate. Set `GST_RATE_APPROVED=true` only after that review; this flag records an operator attestation, not an automated legal determination.

## Customer support workflow

Support tickets are stored in Neon PostgreSQL, linked to a customer/driver account and optionally to one of that user's bookings. Tickets are acknowledged immediately by the app, prioritise safety reports, support threaded replies, allow optional private R2 image evidence, and track grievance-officer acknowledgement within 48 hours and redress within one month. Users can download a copy of their original complaint from the ticket view. Text-only tickets remain available if R2 evidence storage is not configured.

The Consumer Protection (E-Commerce) Rules, 2020 require an adequate grievance mechanism and the 48-hour / one-month grievance time limits. The Consumer Protection (E-Commerce) (Amendment) Rules, 2026 were notified in September 2026 and take effect on 1 January 2027; the amendment adds, among other things, prominent legal entity, address, website, customer-care and grievance-officer contact disclosures, and a copy of the recorded complaint. See the [official Gazette notification](https://egazette.gov.in/WriteReadData/2026/276125.pdf?v=20261117060048) and the [Department of Consumer Affairs PIB release](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2308759&lang=2&reg=48). The official grievance officer, operator identity and support contact fields are intentionally blank in `.env.example`; configure actual monitored contacts before publishing production grievance information.
