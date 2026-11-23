# VaahanSathi — Your Car, Our Driver 🚗

VaahanSathi is an on-demand driver booking platform for Indian car owners. Customers book verified, professional drivers who drive the customer’s personal car. Customers pay strictly for the driver's time and service — never for a rented vehicle.

---

## 🚀 Key Features

- **Full-Stack Application**: Node.js / Express backend + React 18, TypeScript, and Vite frontend.
- **Neon Serverless PostgreSQL Database**: High-performance, scalable cloud persistence using connection pooling and SSL encryption.
- **Role-Based Authentication**: Secure JWT + bcrypt authentication for Customers, Driver Partners, and Operations Admins.
- **Transparent Fare Engine**:
  - GST-inclusive Delhi NCR launch packages: 4 hours / 40 km ₹499, 8 hours / 80 km ₹899, and 12 hours / 120 km ₹1,299.
  - Configurable extra local distance (₹12/km), extra hour (₹100), outstation distance (₹18/km), airport package (₹599), and night surcharge (₹200).
  - Vehicle upgrades for SUV and Luxury, configurable GST and platform commission, with itemised fare lines that reconcile to the customer total.
  - Fuel, tolls and parking for the customer's own car are separate trip expenses and are not silently included in or added to the driver-service fare.
  - Free-form Delhi and Gurugram addresses with cached OpenStreetMap geocoding and approximate distance-based fares.
- **Cash Collection**: cash trips complete with the normal trip end OTP; the assigned driver then marks cash collected. There is no separate cash PIN, customer-side cash confirmation, or cash handover OTP.
- **Customer Care & Driver Accountability**: customers can report a driver demanding extra money; reports are tied to a booking, appear in the driver's dashboard for a response, and can be investigated by admins. An earnings adjustment is recorded only after a complaint is substantiated.
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

The booking form accepts addresses and landmarks across Delhi and Gurugram. On **Estimate fare**, the server geocodes the two entered locations through `GEOCODER_URL` (OpenStreetMap Nominatim by default), caches results, and limits lookup traffic to one request per second. It estimates road distance from the geocoded coordinates; this is not live turn-by-turn routing.

The booking form discloses the lookup and displays OpenStreetMap attribution. Nominatim must not be used for autocomplete and is subject to its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). For higher-volume production use, configure a compatible geocoding service you are authorized to use.

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
5. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the Render Environment tab to enable real online checkout. Configure the R2 variables in `.env.example` to enable private CarCare / TripGuard video storage. These credentials are not stored in Git or the Blueprint.
6. Health check endpoint: `/api/health`. CI runs `npm ci`, `node --check server/index.js`, and `npm run build` for pull requests targeting `main`.
