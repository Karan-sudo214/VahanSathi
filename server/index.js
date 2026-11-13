import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 4000;
const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'local-development-secret-change-before-deploy');
if (!secret) throw new Error('JWT_SECRET must be configured before production startup.');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

const dataPath = path.resolve(process.env.DATA_PATH || './data/app.json');
fs.mkdirSync(path.dirname(dataPath), { recursive: true });

const blank = () => ({
  users: [],
  bookings: [],
  ratings: [],
  history: [],
  auditLogs: [],
  disputes: [],
  payments: [],
  payouts: [],
  pricing: { hourly: 599, night: 120, airport: 599, commission: 20, gst: 5 }
});

let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch {
  data = blank();
}

// ----------------- Neon PostgreSQL Database -----------------
const DATABASE_URL = process.env.DATABASE_URL;
let neonPool = null;
let databaseReady = false;
let databaseError = '';
let databaseReadyPromise = Promise.resolve();

if (DATABASE_URL) {
  try {
    neonPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    neonPool.on('error', (err) => {
      console.error('Unexpected Neon pool idle client error:', err.message);
    });
  } catch (err) {
    console.error('Failed to initialize Neon pool:', err.message);
    databaseError = err.message;
  }
}

const postgresTables = {
  users: 'app_users',
  bookings: 'app_bookings',
  ratings: 'app_ratings',
  history: 'app_history',
  auditLogs: 'app_audit_logs',
  disputes: 'app_disputes',
  payments: 'app_payments',
  payouts: 'app_payouts',
};

async function persistItem(tableName, id, payload) {
  if (!neonPool || !databaseReady) return;
  try {
    await neonPool.query(
      `INSERT INTO ${tableName}(id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT(id) DO UPDATE SET payload = EXCLUDED.payload`,
      [String(id), JSON.stringify(payload)]
    );
  } catch (e) {
    console.error(`Failed to persist ${id} to ${tableName}:`, e.message);
  }
}

async function persistPricing(pricing) {
  if (!neonPool || !databaseReady) return;
  try {
    await neonPool.query(
      `INSERT INTO app_pricing(id, payload, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT(id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      ['current', JSON.stringify(pricing)]
    );
  } catch (e) {
    console.error('Failed to persist pricing to Neon:', e.message);
  }
}

async function save() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Local JSON save error:', e.message);
  }
}

async function seedDefaultAccounts() {
  console.log('Seeding initial demo accounts in Neon DB...');
  const pwHash = await bcrypt.hash('password123', 10);
  const now = new Date().toISOString();

  const seedUsers = [
    {
      id: 'usr-customer-1',
      name: 'Ananya Sharma',
      email: 'ananya@vaahansathi.demo',
      password: pwHash,
      role: 'customer',
      phone: '+91 98765 43210',
      city: 'Bengaluru',
      createdAt: now
    },
    {
      id: 'usr-driver-1',
      name: 'Ramesh Kumar',
      email: 'ramesh@vaahansathi.demo',
      password: pwHash,
      role: 'driver',
      phone: '+91 98765 43211',
      city: 'Bengaluru',
      vehicle: 'Sedan',
      adminRole: 'super_admin',
      rating: 4.9,
      trips: 684,
      verificationStatus: 'verified',
      available: true,
      createdAt: now
    },
    {
      id: 'usr-driver-2',
      name: 'Kavita Singh',
      email: 'kavita@vaahansathi.demo',
      password: pwHash,
      role: 'driver',
      phone: '+91 98765 43213',
      city: 'Delhi NCR',
      vehicle: 'SUV',
      rating: 4.8,
      trips: 512,
      verificationStatus: 'verified',
      available: true,
      createdAt: now
    },
    {
      id: 'usr-admin-1',
      name: 'Ops Admin',
      email: 'admin@vaahansathi.demo',
      password: pwHash,
      role: 'admin',
      adminRole: 'super_admin',
      phone: '+91 98765 43212',
      city: 'Bengaluru',
      createdAt: now
    }
  ];

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const seedBookings = [
    {
      id: 'VS-2026-408215',
      userId: 'usr-customer-1',
      customer: 'Ananya Sharma',
      driverId: 'usr-driver-1',
      driver: 'Ramesh Kumar',
      trip_type: 'Hourly',
      pickup: 'Indiranagar, Bengaluru',
      destination: 'MG Road, Bengaluru',
      city: 'Bengaluru',
      vehicle: 'Sedan',
      date: todayStr,
      time: '10:00',
      hours: 4,
      base: 510,
      night: 0,
      vehicleExtra: 0,
      distanceKm: 8,
      distanceCharge: 0,
      serviceFee: 60,
      gst: 29,
      total: 599,
      payout: 479,
      commission: 120,
      status: 'Driver assigned',
      start_otp: '4821',
      end_otp: '7305',
      payment_status: 'Payment due after trip',
      createdAt: now
    },
    {
      id: 'VS-2026-408216',
      userId: 'usr-customer-1',
      customer: 'Ananya Sharma',
      driverId: 'usr-driver-1',
      driver: 'Ramesh Kumar',
      trip_type: 'Airport',
      pickup: 'Koramangala, Bengaluru',
      destination: 'Kempegowda International Airport, Bengaluru',
      city: 'Bengaluru',
      vehicle: 'Sedan',
      date: yesterdayStr,
      time: '18:30',
      hours: 2,
      base: 599,
      night: 0,
      vehicleExtra: 0,
      distanceKm: 38,
      distanceCharge: 224,
      serviceFee: 60,
      gst: 44,
      total: 927,
      payout: 742,
      commission: 185,
      status: 'Trip completed',
      start_otp: '1428',
      end_otp: '8613',
      payment_status: 'Paid · Razorpay',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const seedRatings = [
    {
      id: 'rate-1',
      bookingId: 'VS-2026-408216',
      userId: 'usr-customer-1',
      driverId: 'usr-driver-1',
      stars: 5,
      review: 'Ramesh was punctual, polite, and navigated Bangalore peak hour airport traffic smoothly!'
    }
  ];

  const seedHistory = [
    { id: randomUUID(), booking_id: 'VS-2026-408215', status: 'Searching', at: now },
    { id: randomUUID(), booking_id: 'VS-2026-408215', status: 'Driver assigned', at: now },
    { id: randomUUID(), booking_id: 'VS-2026-408216', status: 'Trip completed', at: yesterdayStr }
  ];

  data.users = seedUsers;
  data.bookings = seedBookings;
  data.ratings = seedRatings;
  data.history = seedHistory;
  data.pricing = { hourly: 599, night: 120, airport: 599, commission: 20, gst: 5 };

  for (const u of seedUsers) await persistItem('app_users', u.id, u);
  for (const b of seedBookings) await persistItem('app_bookings', b.id, b);
  for (const r of seedRatings) await persistItem('app_ratings', r.id, r);
  for (const h of seedHistory) await persistItem('app_history', h.id, h);
  await persistPricing(data.pricing);
  await save();
  console.log('Neon DB successfully initialized with seed data.');
}

async function loadNeon() {
  if (!neonPool) return;
  try {
    const testResult = await neonPool.query('SELECT NOW()');
    console.log('Connected to Neon PostgreSQL at:', testResult.rows[0].now);

    // Create tables in parallel
    await Promise.all([
      ...Object.values(postgresTables).map((table) =>
        neonPool.query(`
          CREATE TABLE IF NOT EXISTS ${table} (
            id text PRIMARY KEY,
            payload jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `)
      ),
      neonPool.query(`
        CREATE TABLE IF NOT EXISTS app_pricing (
          id text PRIMARY KEY,
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
    ]);

    // Load data from Neon in parallel
    const [tableResults, pricingResult] = await Promise.all([
      Promise.all(
        Object.entries(postgresTables).map(async ([name, table]) => {
          const res = await neonPool.query(`SELECT payload FROM ${table}`);
          return [name, res.rows.map((r) => r.payload), res.rowCount];
        })
      ),
      neonPool.query("SELECT payload FROM app_pricing WHERE id='current'")
    ]);

    const loaded = {};
    let totalRows = 0;
    for (const [name, rows, count] of tableResults) {
      loaded[name] = rows;
      totalRows += count;
    }

    if (pricingResult.rows[0]) {
      data.pricing = pricingResult.rows[0].payload;
    }

    databaseReady = true;
    databaseError = '';

    if (totalRows > 0 && loaded.users?.length > 0) {
      for (const name of Object.keys(postgresTables)) {
        data[name] = loaded[name] || [];
      }
      console.log(`Loaded ${loaded.users.length} users, ${loaded.bookings.length} bookings from Neon DB.`);
    } else {
      await seedDefaultAccounts();
    }
  } catch (e) {
    databaseError = e.message;
    databaseReady = false;
    console.error('Neon connection/setup error:', e.message);
  }
}

// ----------------- Helpers & Routes -----------------
const safe = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  city: u.city,
  vehicle: u.vehicle,
  rating: u.rating,
  trips: u.trips,
  verificationStatus: u.verificationStatus || 'verified',
  adminRole: u.adminRole || (u.role === 'admin' ? 'operations_admin' : undefined)
});

async function auth(req, res, next) {
  try {
    await databaseReadyPromise;
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    req.user = jwt.verify(token, secret);
    if (!data.users.some((u) => u.id === req.user.id)) {
      return res.status(401).json({ error: 'Your account is no longer active. Please sign in again.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
}

const roles = (...allowed) => (req, res, next) =>
  allowed.includes(req.user.role) || (req.user.role === 'admin' && allowed.includes(req.user.adminRole))
    ? next()
    : res.status(403).json({ error: 'You do not have permission for this action.' });
const audit = async (req, action, module, targetId, previousValue = null, newValue = null, description = '') => {
  const entry = { id: randomUUID(), timestamp: new Date().toISOString(), adminId: req.user.id, adminName: req.user.name, adminRole: req.user.adminRole || 'operations_admin', action, module, targetId, description, previousValue, newValue, status: 'success' };
  data.auditLogs.unshift(entry);
  await persistItem('app_audit_logs', entry.id, entry);
  await save();
};

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const adminOnly = roles('admin', 'super_admin', 'operations_admin');

const cityLandmarks = {
  Bengaluru: {
    airport: [13.1986, 77.7066],
    kempegowda: [13.1986, 77.7066],
    indiranagar: [12.9784, 77.6408],
    koramangala: [12.9352, 77.6245],
    whitefield: [12.9698, 77.75],
    jayanagar: [12.925, 77.5938],
    'mg road': [12.9758, 77.6066],
    electronic: [12.8399, 77.677],
    hebbal: [13.0358, 77.597],
    yelahanka: [13.1007, 77.5963],
    majestic: [12.9767, 77.5713],
    hsr: [12.9116, 77.6389],
    marathahalli: [12.9591, 77.6974],
    banashankari: [12.925, 77.5468],
    yeshwanthpur: [13.0285, 77.5407]
  },
  'Delhi NCR': {
    'igi airport': [28.5562, 77.1],
    'indira gandhi international': [28.5562, 77.1],
    'connaught place': [28.6315, 77.2167],
    'central delhi': [28.6315, 77.2167],
    dwarka: [28.5921, 77.046],
    saket: [28.5244, 77.2066],
    noida: [28.5708, 77.3261],
    'sector 18': [28.5708, 77.3261],
    faridabad: [28.4089, 77.3178],
    'new delhi': [28.6139, 77.209],
    rohini: [28.7495, 77.0565],
    'karol bagh': [28.6514, 77.1907],
    vasant: [28.5672, 77.1593],
    gurugram: [28.4595, 77.0266],
    gurgaon: [28.4595, 77.0266]
  },
  Gurugram: {
    'igi airport': [28.5562, 77.1],
    'cyber city': [28.495, 77.089],
    cybercity: [28.495, 77.089],
    'golf course road': [28.4595, 77.0945],
    'sohna road': [28.4145, 77.043],
    'udyog vihar': [28.5044, 77.0845],
    'sector 56': [28.4269, 77.103],
    'mg road': [28.4796, 77.08],
    'sector 29': [28.4691, 77.063],
    'huda city centre': [28.4595, 77.072],
    'millennium city centre': [28.4595, 77.072],
    gurugram: [28.4595, 77.0266],
    gurgaon: [28.4595, 77.0266],
    dwarka: [28.5921, 77.046]
  }
};

function localDistance(city, pickup, destination) {
  const regions = cityLandmarks[city] || cityLandmarks.Bengaluru;
  const find = (s) =>
    Object.entries(regions)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([k]) => String(s || '').toLowerCase().includes(k))?.[1];
  const a = find(pickup);
  const b = find(destination);
  if (!a || !b) return null;
  const rad = (n) => (n * Math.PI) / 180;
  const lat = rad(b[0] - a[0]);
  const lon = rad(b[1] - a[1]);
  const x = Math.sin(lat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(lon / 2) ** 2;
  return Math.max(1, Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 1.35));
}

function routeDistance(pickup, destination, city = 'Bengaluru') {
  const distanceKm = localDistance(city, pickup, destination);
  return {
    distanceKm,
    duration: distanceKm ? `${Math.max(1, Math.round((distanceKm / 28) * 60))} mins` : null,
    distanceSource: distanceKm ? `${city.toLowerCase()} approximate zone distance` : 'location estimate'
  };
}

function calculateFare({ tripType = 'Hourly', hours = 4, time = '08:00', vehicle = 'Sedan', distanceKm = null, distanceSource = null }) {
  const h = Math.max(1, Math.min(24, Number(hours) || 1));
  const hourlyTotal = Number(data.pricing.hourly) || 599;
  const base =
    tripType === 'Hourly' || tripType === 'Custom'
      ? Math.max(100, Math.floor(hourlyTotal / 1.05) - 60) + Math.max(0, h - 4) * 120
      : {
          Airport: Number(data.pricing.airport) > 0 ? Number(data.pricing.airport) : 599,
          'Night driver': 699,
          'Full day': 999,
          Outstation: 1499
        }[tripType] || 599;

  const hour = Number(String(time).slice(0, 2));
  const night = hour >= 22 || hour < 6 ? Number(data.pricing.night) || 120 : 0;
  const vehicleExtra = { Hatchback: 0, Sedan: 0, SUV: 100, Luxury: 350 }[vehicle] || 0;
  const distanceCharge = distanceKm && distanceKm > 10 ? Math.round((distanceKm - 10) * 8) : 0;
  const serviceFee = 60;
  const subtotal = base + night + vehicleExtra + distanceCharge + serviceFee;
  const gst = Math.round(subtotal * (Number(data.pricing.gst ?? 5) / 100));
  const total = subtotal + gst;
  const commissionRate = Number(data.pricing.commission ?? 20);
  const commission = Math.round((total * commissionRate) / 100);
  const payout = total - commission;

  return {
    base,
    night,
    airport: tripType === 'Airport' ? base : 0,
    outstation: tripType === 'Outstation' ? distanceCharge : 0,
    vehicleExtra,
    distanceKm,
    distanceCharge,
    serviceFee,
    gst,
    total,
    payout,
    commission,
    currency: 'INR',
    distanceSource: distanceSource || 'calculated'
  };
}

// ----------------- API Endpoints -----------------

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    service: 'VaahanSathi',
    mode: databaseReady ? 'neon-postgres' : process.env.NODE_ENV === 'production' ? 'storage-initializing' : 'local-development',
    database: databaseReady,
    databaseConfigured: !!neonPool,
    error: databaseError || null,
    integrations: {
      database: databaseReady,
      databaseConfigured: !!neonPool,
      razorpay: !!process.env.RAZORPAY_KEY_ID,
      voice: !!process.env.ELEVENLABS_API_KEY
    }
  });
});

// Auth Routes
app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    const { name, email, password, phone, role = 'customer', city = 'Bengaluru' } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Enter your name, email, and a password with at least 8 characters.' });
    }
    if (!['Bengaluru', 'Delhi NCR', 'Gurugram'].includes(city)) {
      return res.status(400).json({ error: 'Please choose Bengaluru, Delhi NCR, or Gurugram.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (data.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    }
    const u = {
      id: randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password: await bcrypt.hash(password, 10),
      phone: phone || '',
      role: role === 'driver' ? 'driver' : 'customer',
      city,
      createdAt: new Date().toISOString()
    };
    data.users.push(u);
    await persistItem('app_users', u.id, u);
    await save();

    const token = jwt.sign({ id: u.id, role: u.role, adminRole: u.adminRole, name: u.name }, secret, { expiresIn: '14d' });
    res.status(201).json({ token, user: safe(u) });
  })
);

app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').toLowerCase().trim();
    const u = data.users.find((x) => x.email === cleanEmail);
    if (!u || !(await bcrypt.compare(password || '', u.password))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = jwt.sign({ id: u.id, role: u.role, adminRole: u.adminRole, name: u.name }, secret, { expiresIn: '14d' });
    res.json({ token, user: safe(u) });
  })
);

app.get('/api/me', auth, (req, res) => {
  const u = data.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: safe(u) });
});

// Fare Calculation
app.post('/api/fare/estimate', (req, res) => {
  const route = routeDistance(req.body?.pickup, req.body?.destination, req.body?.city);
  res.json(calculateFare({ ...req.body, ...route }));
});

// Bookings
app.get('/api/bookings', auth, (req, res) => {
  let rows = [...data.bookings];
  const currentUser = data.users.find((u) => u.id === req.user.id);

  if (req.user.role === 'customer') {
    rows = rows.filter((b) => b.userId === req.user.id);
  } else if (req.user.role === 'driver') {
    rows = rows.filter(
      (b) => b.driverId === req.user.id || (b.status === 'Searching' && b.city === currentUser?.city)
    );
  }

  const enriched = rows.map((b) => {
    const driverUser = data.users.find((u) => u.id === b.driverId);
    const customerUser = data.users.find((u) => u.id === b.userId);
    return {
      ...b,
      start_otp: req.user.role === 'customer' || req.user.role === 'admin' ? b.start_otp : undefined,
      end_otp: (req.user.role === 'customer' && b.status === 'Trip started') || req.user.role === 'admin' ? b.end_otp : undefined,
      driver: driverUser ? driverUser.name : b.driver || null,
      customer: customerUser ? customerUser.name : b.customer || null
    };
  });

  res.json({ bookings: enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

app.post(
  '/api/bookings',
  auth,
  roles('customer', 'admin'),
  asyncRoute(async (req, res) => {
    const { tripType = 'Hourly', pickup, destination, city = 'Bengaluru', vehicle = 'Sedan', date, time = '10:00', hours = 4 } = req.body || {};
    if (!pickup || !destination || !date) {
      return res.status(400).json({ error: 'Pickup location, destination, and date are required.' });
    }
    if (!['Bengaluru', 'Delhi NCR', 'Gurugram'].includes(city)) {
      return res.status(400).json({ error: 'VaahanSathi is currently operational in Bengaluru, Delhi NCR, and Gurugram.' });
    }

    const route = routeDistance(pickup, destination, city);
    const f = calculateFare({ tripType, hours, time, vehicle, ...route });
    const customerUser = data.users.find((u) => u.id === req.user.id);

    // Auto-match an available driver in the city if any
    const availableDriver = data.users.find(
      (u) => u.role === 'driver' && u.city === city && u.available !== false
    );

    const bookingId = `VS-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
    const b = {
      id: bookingId,
      userId: req.user.id,
      customer: customerUser?.name || 'Customer',
      driverId: availableDriver ? availableDriver.id : null,
      driver: availableDriver ? availableDriver.name : null,
      trip_type: tripType,
      pickup: pickup.trim(),
      destination: destination.trim(),
      city,
      vehicle,
      date,
      time,
      hours: Number(hours),
      ...f,
      status: availableDriver ? 'Driver assigned' : 'Searching',
      start_otp: String(randomInt(1000, 9999)),
      end_otp: String(randomInt(1000, 9999)),
      payment_status: 'Payment due after trip',
      createdAt: new Date().toISOString()
    };

    data.bookings.push(b);
    const historyItem = { id: randomUUID(), booking_id: b.id, status: b.status, at: b.createdAt };
    data.history.unshift(historyItem);

    await persistItem('app_bookings', b.id, b);
    await persistItem('app_history', historyItem.id, historyItem);
    await save();

    res.status(201).json({
      booking: b,
      message: availableDriver
        ? `${availableDriver.name} has been assigned to your ride.`
        : 'Your request is dispatched to verified drivers in your city.'
    });
  })
);

app.patch(
  '/api/bookings/:id/status',
  auth,
  asyncRoute(async (req, res) => {
    const b = data.bookings.find((x) => x.id === req.params.id);
    const { status, otp } = req.body || {};
    if (!b) return res.status(404).json({ error: 'Booking not found.' });

    const currentUser = data.users.find((u) => u.id === req.user.id);

    // Permission checks
    if (req.user.role === 'customer' && b.userId !== req.user.id && status !== 'Cancelled') {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    if (req.user.role === 'driver') {
      if (b.status === 'Searching' && status === 'Driver assigned') {
        b.driverId = req.user.id;
        b.driver = currentUser?.name || 'Driver';
      } else if (b.driverId !== req.user.id) {
        return res.status(403).json({ error: 'This booking is not assigned to you.' });
      }
    }

    // OTP validation
    if (status === 'Trip started') {
      if (String(otp).trim() !== String(b.start_otp)) {
        return res.status(400).json({ error: 'Start OTP is invalid. Ask the car owner for their 4-digit start OTP.' });
      }
    }
    if (status === 'Trip completed') {
      if (String(otp).trim() !== String(b.end_otp)) {
        return res.status(400).json({ error: 'End OTP is invalid. Ask the car owner for their 4-digit end OTP.' });
      }
      b.payment_status = 'Payment due';
    }

    b.status = status;
    const historyItem = { id: randomUUID(), booking_id: b.id, status, at: new Date().toISOString() };
    data.history.unshift(historyItem);

    await persistItem('app_bookings', b.id, b);
    await persistItem('app_history', historyItem.id, historyItem);
    await save();

    res.json({ booking: b });
  })
);

app.post(
  '/api/bookings/:id/rating',
  auth,
  roles('customer'),
  asyncRoute(async (req, res) => {
    const b = data.bookings.find((x) => x.id === req.params.id && x.userId === req.user.id);
    if (!b) return res.status(404).json({ error: 'Booking not found.' });

    const ratingItem = {
      id: randomUUID(),
      bookingId: b.id,
      userId: req.user.id,
      driverId: b.driverId,
      stars: Math.max(1, Math.min(5, Number(req.body.stars) || 5)),
      review: String(req.body.review || '').slice(0, 500),
      createdAt: new Date().toISOString()
    };
    data.ratings.push(ratingItem);
    b.status = 'Rated';

    await persistItem('app_ratings', ratingItem.id, ratingItem);
    await persistItem('app_bookings', b.id, b);
    await save();

    res.json({ ok: true });
  })
);

// Driver & Admin Stats
app.get('/api/driver/summary', auth, roles('driver', 'admin'), (req, res) => {
  const driverId = req.user.id;
  const mine = data.bookings.filter((b) => b.driverId === driverId && b.status === 'Trip completed');
  const myRatings = data.ratings.filter((r) => r.driverId === driverId);
  const avgRating = myRatings.length
    ? Number((myRatings.reduce((s, r) => s + r.stars, 0) / myRatings.length).toFixed(1))
    : 4.9;

  res.json({
    summary: {
      trips: mine.length,
      earnings: mine.reduce((s, b) => s + b.payout, 0),
      rating: avgRating
    },
    available: true
  });
});

app.get('/api/admin/summary', auth, roles('admin'), (_, res) => {
  const b = data.bookings;
  const revenue = b.reduce((s, x) => s + x.total, 0);
  const commission = b.reduce((s, x) => s + x.commission, 0);
  const active = b.filter((x) => ['Driver assigned', 'Driver arriving', 'Trip started'].includes(x.status)).length;

  res.json({
    totals: {
      bookings: b.length,
      revenue,
      commission,
      active
    },
    customers: data.users.filter((u) => u.role === 'customer').length,
    drivers: data.users.filter((u) => u.role === 'driver').length,
    onlineDrivers: data.users.filter((u) => u.role === 'driver' && u.available !== false).length,
    pendingVerifications: data.users.filter((u) => u.role === 'driver' && u.verificationStatus !== 'verified').length,
    openDisputes: data.disputes.filter((d) => !['resolved', 'closed'].includes(d.status)).length,
    failedPayments: data.payments.filter((p) => p.status === 'failed').length,
    history: data.history.slice(0, 50),
    auditLogs: data.auditLogs.slice(0, 50),
    pricing: Object.entries(data.pricing).map(([key, value]) => ({ key, value }))
  });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const role = String(req.query.role || 'all');
  const users = data.users.filter((u) => (role === 'all' || u.role === role) && (!q || `${u.name} ${u.email} ${u.phone || ''} ${u.city || ''}`.toLowerCase().includes(q))).map(safe);
  res.json({ users });
});
app.get('/api/admin/audit-logs', auth, adminOnly, (req, res) => res.json({ logs: data.auditLogs.slice(0, 200) }));
app.get('/api/admin/disputes', auth, adminOnly, (req, res) => res.json({ disputes: data.disputes }));
app.get('/api/admin/payments', auth, adminOnly, (req, res) => res.json({ payments: data.payments, payouts: data.payouts }));
app.patch('/api/admin/drivers/:id/verification', auth, roles('admin', 'super_admin'), asyncRoute(async (req, res) => {
  const driver = data.users.find((u) => u.id === req.params.id && u.role === 'driver');
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });
  const previous = driver.verificationStatus || 'pending';
  driver.verificationStatus = req.body.status === 'rejected' ? 'rejected' : req.body.status === 'verified' ? 'verified' : 'pending';
  await persistItem('app_users', driver.id, driver);
  await audit(req, `driver_${driver.verificationStatus}`, 'drivers', driver.id, { verificationStatus: previous }, { verificationStatus: driver.verificationStatus }, req.body.reason || 'Driver verification updated');
  res.json({ user: safe(driver) });
}));

app.patch(
  '/api/admin/pricing',
  auth,
  roles('admin'),
  asyncRoute(async (req, res) => {
    for (const k of ['hourly', 'night', 'airport', 'commission', 'gst']) {
      if (Number.isFinite(Number(req.body[k]))) {
        data.pricing[k] = Number(req.body[k]);
      }
    }
    await persistPricing(data.pricing);
    await audit(req, 'pricing_updated', 'pricing', 'current', null, data.pricing, 'Pricing configuration updated');
    res.json({ ok: true, pricing: data.pricing });
  })
);

// Voice booking intent parser. The browser handles listening; this endpoint normalises
// the transcript into the same fields used by the real booking form.
app.post('/api/voice/intent', (req, res) => {
  const raw = String(req.body.text || '').trim();
  const text = raw.toLowerCase();
  const language = String(req.body.language || 'en-IN');
  const city = text.includes('delhi') || text.includes('दिल्ली') ? 'Delhi NCR' : text.includes('gurugram') || text.includes('gurgaon') || text.includes('गुरुग्राम') ? 'Gurugram' : 'Bengaluru';
  const tripType = /airport|aeropuerto|एयरपोर्ट|विमानतळ|ವಿಮಾನ ನಿಲ್ದಾಣ|விமான நிலையம்|విమానాశ్రయం/.test(text)
    ? 'Airport'
    : /outstation|outside city|बाहर|ಔಟ್ ಸ್ಟೇಷನ್|வெளியூர்|అవుట్ స్టేషన్/.test(text)
    ? 'Outstation'
    : /night|रात|ರಾತ್ರಿ|இரவு|రాత్రి/.test(text)
    ? 'Night driver'
    : /full day|whole day|पूरा दिन|ಪೂರ್ಣ ದಿನ|முழு நாள்|పూర్తి రోజు/.test(text)
    ? 'Full day'
    : 'Hourly';
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, सात: 7, आठ: 8, चार: 4, पांच: 5 };
  const hourMatch = text.match(/(\d+)\s*(?:hours?|घंटे|ಗಂಟೆ|மணி|గంట)/i);
  const wordHour = Object.entries(numberWords).find(([word]) => text.includes(`${word} hour`) || text.includes(`${word} घंटे`));
  const hours = Math.max(1, Math.min(24, Number(hourMatch?.[1] || wordHour?.[1] || (tripType === 'Full day' ? 8 : 4))));
  const routeMatch = text.match(/(?:from|pickup|pick me)\s+(.+?)\s+(?:to|destination)\s+(.+?)(?:,|\.|$)/i) || text.match(/(.+?)\s+से\s+(.+?)(?=\s+(?:जाना|तक|कल|आज|सुबह|शाम|रात)|$)/i) || text.match(/से\s+(.+?)\s+(?:तक|जाना है|जाना|जाने)\s+(.+?)(?=\s+(?:कल|आज|सुबह|शाम|रात)|$)/i);
  const cleanPlace = (value) => value?.replace(/^(?:मुझे|मुझको)\s+.*?(?:के लिए|के वास्ते)\s+/i, '').replace(/^(?:i need|please take me|मुझे)\s+/i, '').replace(/\s+(?:tomorrow|today|कल|आज|सुबह|शाम|रात).*$/i, '').replace(/\s+at\s+\d.*$/i, '').replace(/[,.]+$/, '').trim() || null;
  const pickup = cleanPlace(routeMatch?.[1]);
  const destination = cleanPlace(routeMatch?.[2]);
  const explicitTime = text.match(/(?:at|around|on|बजे|सुबह|शाम|रात)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|बजे|सुबह|शाम|रात)?/i);
  const allTimes = [...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi)];
  const timeMatch = explicitTime || allTimes[allTimes.length - 1];
  let time = null;
  if (timeMatch) {
    const hourValue = explicitTime ? timeMatch[1] : timeMatch[1];
    let hour = Number(hourValue);
    const suffix = String(timeMatch[3] || '').toLowerCase();
    if ((suffix === 'pm' || suffix === 'शाम' || suffix === 'रात') && hour < 12) hour += 12;
    if ((suffix === 'am' || suffix === 'सुबह') && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, '0')}:${timeMatch[2] || '00'}`;
  }
  const date = /tomorrow|कल|ನಾಳೆ|நாளை|రేపు/.test(text) ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : null;
  const labels = {
    'hi-IN': `मैंने ${city} में ${hours} घंटे की ${tripType === 'Airport' ? 'एयरपोर्ट' : 'ड्राइवर'} यात्रा समझी है। विवरण जांचकर बुकिंग पूरी करें।`,
    'kn-IN': `${city} ನಲ್ಲಿ ${hours} ಗಂಟೆಗಳ ಡ್ರೈವರ್ ಸೇವೆಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.`,
    'ta-IN': `${city} நகரில் ${hours} மணி நேர டிரைவர் சேவையைப் புரிந்துகொண்டேன். விவரங்களைச் சரிபார்க்கவும்.`,
    'te-IN': `${city} లో ${hours} గంటల డ్రైవర్ సేవను అర్థం చేసుకున్నాను. వివరాలను తనిఖీ చేయండి.`
  };
  const summary = labels[language] || `I understood a ${hours}-hour ${tripType.toLowerCase()} booking in ${city}. Review the details before confirming.`;
  res.json({ tripType, hours, city, pickup, destination, date, time, language, requiresConfirmation: true, summary });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
}

async function start() {
  if (process.env.NODE_ENV === 'production' && !DATABASE_URL) {
    console.error('DATABASE_URL is missing. Configure the Neon connection string in Render before accepting traffic.');
  }
  databaseReadyPromise = neonPool ? loadNeon() : Promise.resolve();
  await databaseReadyPromise;
  if (!neonPool && data.users.length === 0) await seedDefaultAccounts();
  app.listen(port, () => {
    console.log(`VaahanSathi server listening on port ${port}...`);
    console.log(`VaahanSathi is active [Mode: ${databaseReady ? 'Neon PostgreSQL' : 'Local Storage'}]`);
  });
}
start().catch((err) => { console.error('Fatal startup error:', err); process.exitCode = 1; });
