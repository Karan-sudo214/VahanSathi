# VaahanSathi — Your Car, Our Driver 🚗

VaahanSathi is an on-demand driver booking platform for Indian car owners. Customers book verified, professional drivers who drive the customer’s personal car. Customers pay strictly for the driver's time and service — never for a rented vehicle.

---

## 🚀 Key Features

- **Full-Stack Application**: Node.js / Express backend + React 18, TypeScript, and Vite frontend.
- **Neon Serverless PostgreSQL Database**: High-performance, scalable cloud persistence using connection pooling and SSL encryption.
- **Role-Based Authentication**: Secure JWT + bcrypt authentication for Customers, Driver Partners, and Operations Admins.
- **Transparent Fare Engine**:
  - Base hourly rates, night charges (10 PM – 6 AM), vehicle class adjustments (Hatchback, Sedan, SUV, Luxury), 5% GST, and fixed platform fee.
  - Free-form Delhi and Gurugram addresses with cached OpenStreetMap geocoding and approximate distance-based fares.
  - Transparent 80% driver payout share prominently highlighted to customers.
- **Two-Step OTP Lifecycle**:
  - Secure 4-digit **Start OTP** shared only when entering the vehicle.
  - Secure 4-digit **End OTP** required to conclude the ride.
- **Interactive Trip Simulation**: Live animated route preview with ETA counter and status tracker.
- **Driver Partner Portal**: Manage duty status, accept local requests, enter trip OTPs, and track earnings.
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
3. Render runs `npm run build` and starts `node server/index.js`.
4. In Render, set `DATABASE_URL` to a newly rotated Neon connection string (the previous credential must be considered compromised), then redeploy. The server waits for Neon hydration before accepting authenticated requests and seeds the demo accounts only when the database is empty.
5. Health check endpoint: `/api/health`.
