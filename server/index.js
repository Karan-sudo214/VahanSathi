import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomInt, createHmac, timingSafeEqual, createPublicKey, verify as verifySignature } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 4000;
const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'local-development-secret-change-before-deploy');
if (!secret) throw new Error('JWT_SECRET must be configured before production startup.');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));

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
      city: 'Delhi',
      createdAt: now
    },
    {
      id: 'usr-driver-1',
      name: 'Ramesh Kumar',
      email: 'ramesh@vaahansathi.demo',
      password: pwHash,
      role: 'driver',
      phone: '+91 98765 43211',
      city: 'Gurugram',
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
      name: 'Priya Sharma',
      email: 'priya@vaahansathi.demo',
      password: pwHash,
      role: 'driver',
      phone: '+91 98765 43213',
      city: 'Delhi',
      vehicle: 'Sedan',
      rating: 4.8,
      trips: 312,
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
      city: 'Delhi',
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
      pickup: 'Cyber City, Gurugram',
      destination: 'Sector 56, Gurugram',
      city: 'Gurugram',
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
      pickup: 'Golf Course Road, Gurugram',
      destination: 'IGI Airport, Delhi',
      city: 'Gurugram',
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
      payment_status: 'Paid Â· Razorpay',
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
      review: 'Ramesh was punctual, polite, and navigated the route smoothly!'
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

async function ensureDemoAccounts() {
  const password = await bcrypt.hash('password123', 10);
  const now = new Date().toISOString();
  const accounts = [
    { id: 'usr-customer-1', name: 'Ananya Sharma', email: 'ananya@vaahansathi.demo', role: 'customer', phone: '+91 98765 43210', city: 'Delhi' },
    { id: 'usr-driver-1', name: 'Ramesh Kumar', email: 'ramesh@vaahansathi.demo', role: 'driver', phone: '+91 98765 43211', city: 'Gurugram', vehicle: 'Sedan', adminRole: undefined, rating: 4.9, trips: 684, verificationStatus: 'verified', available: true },
    { id: 'usr-driver-2', name: 'Priya Sharma', email: 'priya@vaahansathi.demo', role: 'driver', phone: '+91 98765 43213', city: 'Delhi', vehicle: 'Sedan', rating: 4.8, trips: 312, verificationStatus: 'verified', available: true },
    { id: 'usr-admin-1', name: 'Ops Admin', email: 'admin@vaahansathi.demo', role: 'admin', adminRole: 'super_admin', phone: '+91 98765 43212', city: 'Delhi' }
  ];

  for (const account of accounts) {
    const existing = data.users.find((u) => u.email === account.email);
    const user = { ...existing, ...account, id: existing?.id || account.id, password, createdAt: existing?.createdAt || now };
    if (existing) Object.assign(existing, user);
    else data.users.push(user);
    await persistItem('app_users', user.id, user);
  }

  const demoCustomer = data.users.find((u) => u.email === 'ananya@vaahansathi.demo');
  const demoDriver = data.users.find((u) => u.email === 'ramesh@vaahansathi.demo');
  const demoRoutes = [
    { id: 'VS-2026-408215', city: 'Gurugram', pickup: 'Cyber City, Gurugram', destination: 'Sector 56, Gurugram' },
    { id: 'VS-2026-408216', city: 'Gurugram', pickup: 'Golf Course Road, Gurugram', destination: 'IGI Airport, Delhi' }
  ];
  for (const routeDetails of demoRoutes) {
    const booking = data.bookings.find((b) => b.id === routeDetails.id);
    if (!booking) continue;
    const route = await routeDistance(routeDetails.pickup, routeDetails.destination, routeDetails.city);
    const fare = calculateFare({ ...booking, ...route });
    Object.assign(booking, routeDetails, {
      userId: demoCustomer?.id || booking.userId,
      customer: demoCustomer?.name || booking.customer,
      driverId: demoDriver?.id || booking.driverId,
      driver: demoDriver?.name || booking.driver
    }, route, fare);
    await persistItem('app_bookings', booking.id, booking);
  }

  const sampleRating = data.ratings.find((r) => r.id === 'rate-1');
  if (sampleRating) {
    sampleRating.review = 'Ramesh was punctual, polite, and navigated the route smoothly!';
    await persistItem('app_ratings', sampleRating.id, sampleRating);
  }

  const retiredDriver = data.users.find((u) => u.email === 'kavita@vaahansathi.demo');
  if (retiredDriver) {
    data.users = data.users.filter((u) => u.email !== 'kavita@vaahansathi.demo');
    if (neonPool && databaseReady) {
      await neonPool.query('DELETE FROM app_users WHERE id = $1', [String(retiredDriver.id)]);
    }
  }
  await save();
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
const safe = (u) => {
  const completedTrips = u.role === 'driver'
    ? data.bookings.filter((booking) => booking.driverId === u.id && ['Trip completed', 'Rated'].includes(booking.status)).length
    : Number(u.trips || 0);
  const driverRatings = u.role === 'driver' ? data.ratings.filter((rating) => rating.driverId === u.id) : [];
  const averageRating = driverRatings.length
    ? Number((driverRatings.reduce((sum, rating) => sum + Number(rating.stars || 0), 0) / driverRatings.length).toFixed(1))
    : Number(u.rating || 0);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    city: u.city,
    vehicle: u.vehicle,
    rating: averageRating || u.rating,
    trips: completedTrips,
    driverStyleTags: Array.isArray(u.driverStyleTags) ? u.driverStyleTags : ['friendly'],
    cashRewardsPoints: Number(u.cashRewardsPoints || 0),
    driverBatch: u.role === 'driver' ? {
      name: completedTrips >= 150 && averageRating >= 4.8 ? 'Platinum' : completedTrips >= 50 && averageRating >= 4.6 ? 'Gold' : completedTrips >= 15 && averageRating >= 4.3 ? 'Silver' : 'Starter',
      completedTrips,
      averageRating,
      nextMilestone: completedTrips < 15 ? 15 : completedTrips < 50 ? 50 : completedTrips < 150 ? 150 : null
    } : undefined,
    driverBadges: u.role === 'driver' ? [
      ...(completedTrips >= 500 ? ['Elite Partner'] : completedTrips >= 100 ? ['Trusted Partner'] : []),
      ...(averageRating >= 4.8 ? ['5-Star Service'] : []),
      ...(completedTrips >= 25 ? ['Road Ready'] : [])
    ] : [],
    verificationStatus: u.verificationStatus || 'verified',
    adminRole: u.adminRole || (u.role === 'admin' ? 'operations_admin' : undefined)
  };
};

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
  Delhi: {
    'igi airport': [28.5562, 77.1],
    'indira gandhi international': [28.5562, 77.1],
    'international airport': [28.5562, 77.1],
    'connaught place': [28.6315, 77.2167],
    'central delhi': [28.6315, 77.2167],
    'india gate': [28.6129, 77.2295],
    'new delhi railway station': [28.6431, 77.2197],
    'old delhi railway station': [28.6619, 77.2274],
    dwarka: [28.5921, 77.046],
    saket: [28.5244, 77.2066],
    'new delhi': [28.6139, 77.209],
    rohini: [28.7495, 77.0565],
    'karol bagh': [28.6514, 77.1907],
    vasant: [28.5672, 77.1593],
    'lajpat nagar': [28.5677, 77.2433],
    'hauz khas': [28.5494, 77.2001],
    janakpuri: [28.6219, 77.0878],
    pitampura: [28.7033, 77.1322],
    'chandni chowk': [28.6506, 77.2303],
    'sadar bazar': [28.658, 77.207]
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
    'sector 14': [28.4687, 77.0305],
    'sector 31': [28.4508, 77.043]
  }
};

const geocodeCache = new Map();
let geocodeQueue = Promise.resolve();
let lastGeocodeRequestAt = 0;
const cityBounds = {
  Delhi: '76.82,28.90,77.37,28.40',
  Gurugram: '76.82,28.56,77.20,28.30'
};

function findLandmark(city, location) {
  const regions = cityLandmarks[city];
  if (!regions) return null;
  const query = String(location || '').toLowerCase();
  return Object.entries(regions)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([name]) => query.includes(name))?.[1] || null;
}

async function geocodeLocation(city, location) {
  const key = `${city.toLowerCase()}|${location.trim().toLowerCase()}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const lookup = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGeocodeRequestAt = Date.now();

    const endpoint = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
    endpoint.searchParams.set('format', 'jsonv2');
    endpoint.searchParams.set('limit', '1');
    endpoint.searchParams.set('countrycodes', 'in');
    endpoint.searchParams.set('viewbox', cityBounds[city]);
    endpoint.searchParams.set('bounded', '1');
    endpoint.searchParams.set('q', `${location}, ${city}, India`);

    const headers = {
      'User-Agent': `VaahanSathi/1.0${process.env.GEOCODER_CONTACT ? ` (${process.env.GEOCODER_CONTACT})` : ''}`,
      'Accept-Language': 'en'
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, { headers, signal: controller.signal });
      if (!response.ok) {
        throw Object.assign(new Error(`Location lookup is unavailable (HTTP ${response.status}). Please try again.`), { statusCode: 503 });
      }
      const results = await response.json();
      const match = results[0];
      return match ? [Number(match.lat), Number(match.lon)] : null;
    } catch (error) {
      if (error.statusCode) throw error;
      throw Object.assign(new Error('Location lookup is unavailable. Please try again.'), { statusCode: 503 });
    } finally {
      clearTimeout(timeout);
    }
  });
  geocodeQueue = lookup.then(() => undefined, () => undefined);
  geocodeCache.set(key, lookup);
  if (geocodeCache.size > 1000) geocodeCache.delete(geocodeCache.keys().next().value);

  try {
    return await lookup;
  } catch (error) {
    geocodeCache.delete(key);
    throw error;
  }
}

async function resolveLocation(city, location) {
  return findLandmark(city, location) || geocodeLocation(city, location);
}

async function routeDistance(pickup, destination, city) {
  const a = await resolveLocation(city, pickup);
  const b = await resolveLocation(city, destination);
  if (!a || !b) {
    throw Object.assign(
      new Error(`We could not find both locations in ${city}. Add a nearby landmark or check the spelling.`),
      { statusCode: 422 }
    );
  }
  const rad = (n) => (n * Math.PI) / 180;
  const lat = rad(b[0] - a[0]);
  const lon = rad(b[1] - a[1]);
  const x = Math.sin(lat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(lon / 2) ** 2;
  const distanceKm = Math.max(1, Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 1.35));
  return {
    distanceKm,
    duration: `${Math.max(1, Math.round((distanceKm / 28) * 60))} mins`,
    distanceSource: `${city} approximate road distance based on OpenStreetMap location data`
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
    mode: databaseReady ? 'neon-postgres' : DATABASE_URL ? 'database-unavailable' : process.env.NODE_ENV === 'production' ? 'local-json-fallback' : 'local-development',
    database: databaseReady,
    databaseConfigured: !!neonPool,
    persistentStorage: databaseReady,
    degraded: !databaseReady,
    error: databaseError || null,
    integrations: {
      database: databaseReady,
      databaseConfigured: !!neonPool,
      razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      voice: true,
      voiceMode: 'browser-native'
    }
  });
});

// Auth Routes
app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    const { name, email, password, phone, role = 'customer', city = 'Delhi', vehicle = 'Sedan', licenseNumber = '' } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Enter your name, email, and a password with at least 8 characters.' });
    }
    if (!['Delhi', 'Gurugram'].includes(city)) {
      return res.status(400).json({ error: 'Please choose Delhi or Gurugram.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (data.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    }
    if (role !== 'driver') {
      return res.status(403).json({ error: 'Customer accounts must be created through Firebase Authentication.' });
    }
    const resolvedRole = 'driver';
    const u = {
      id: randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password: await bcrypt.hash(password, 10),
      phone: phone || '',
      role: resolvedRole,
      city,
      vehicle: resolvedRole === 'driver' ? (vehicle || 'Sedan') : undefined,
      licenseNumber: resolvedRole === 'driver' ? (licenseNumber || '') : undefined,
      verificationStatus: resolvedRole === 'driver' ? 'pending' : undefined,
      available: resolvedRole === 'driver' ? false : undefined,
      trips: resolvedRole === 'driver' ? 0 : undefined,
      rating: resolvedRole === 'driver' ? 5.0 : undefined,
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
    if (u?.role === 'customer') {
      return res.status(403).json({ error: 'Customer sign-in is handled by Firebase Authentication. Please use the customer sign-in option.' });
    }
    if (!u || !(await bcrypt.compare(password || '', u.password))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = jwt.sign({ id: u.id, role: u.role, adminRole: u.adminRole, name: u.name }, secret, { expiresIn: '14d' });
    res.json({ token, user: safe(u) });
  })
);

// Firebase Authentication for customer accounts only. Driver/admin auth stays on the existing login routes.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vahansathi-4ffae';
let firebaseJwksCache = { keys: [], expiresAt: 0 };

async function verifyFirebaseIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Firebase returned an invalid sign-in token.'), { status: 401 });
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw Object.assign(new Error('Firebase returned an invalid sign-in token.'), { status: 401 });
  }
  if (header.alg !== 'RS256' || !header.kid) {
    throw Object.assign(new Error('Firebase sign-in token is not valid.'), { status: 401 });
  }
  if (firebaseJwksCache.expiresAt < Date.now()) {
    const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!response.ok) throw Object.assign(new Error('Firebase sign-in verification is temporarily unavailable.'), { status: 503 });
    const cacheControl = response.headers.get('cache-control') || '';
    const maxAge = Number((cacheControl.match(/max-age=(\d+)/i) || [])[1] || 300);
    firebaseJwksCache = { keys: (await response.json()).keys || [], expiresAt: Date.now() + maxAge * 1000 };
  }
  const jwk = firebaseJwksCache.keys.find((key) => key.kid === header.kid && key.use === 'sig');
  if (!jwk) throw Object.assign(new Error('Firebase signing key could not be verified. Please try again.'), { status: 401 });
  const validSignature = verifySignature(
    'RSA-SHA256',
    Buffer.from(parts[0] + '.' + parts[1]),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(parts[2], 'base64url')
  );
  const now = Math.floor(Date.now() / 1000);
  const issuerValid = claims.iss === `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  const audienceValid = claims.aud === FIREBASE_PROJECT_ID;
  const timeValid = Number(claims.exp) > now && Number(claims.iat) <= now + 60 && Number(claims.auth_time) <= now + 60;
  if (!validSignature || !issuerValid || !audienceValid || !claims.sub || claims.sub.length > 128 || !claims.email || !timeValid) {
    throw Object.assign(new Error('Firebase could not verify this account. Please sign in again.'), { status: 401 });
  }
  return claims;
}

app.post('/api/auth/firebase', asyncRoute(async (req, res) => {
  await databaseReadyPromise;
  const claims = await verifyFirebaseIdToken(req.body?.idToken);
  const email = String(claims.email).toLowerCase().trim();
  const firebaseUid = String(claims.sub);
  let u = data.users.find((user) => user.firebaseUid === firebaseUid);
  if (!u) {
    u = data.users.find((user) => user.email === email);
    if (u && u.role !== 'customer') {
      return res.status(403).json({ error: 'Firebase sign-in is only available for customer accounts. Please use the existing partner/admin sign-in.' });
    }
    if (u?.firebaseUid && u.firebaseUid !== firebaseUid) {
      return res.status(409).json({ error: 'This customer account is linked to a different Firebase identity. Please contact support.' });
    }
    if (u && claims.email_verified !== true) {
      return res.status(403).json({ error: 'Please verify your email address with Firebase before linking this existing VaahanSathi account.' });
    }
    if (u) {
      u.firebaseUid = firebaseUid;
      if (!u.name && claims.name) u.name = String(claims.name).trim();
      if (!u.phone && req.body?.phone) u.phone = String(req.body.phone).trim();
      await persistItem('app_users', u.id, u);
      await save();
    } else {
      const city = ['Delhi', 'Gurugram'].includes(req.body?.city) ? req.body.city : 'Delhi';
      u = {
        id: randomUUID(),
        name: String(req.body?.name || claims.name || email.split('@')[0]).trim(),
        email,
        password: await bcrypt.hash(randomUUID(), 10),
        firebaseUid,
        phone: String(req.body?.phone || '').trim(),
        role: 'customer',
        city,
        createdAt: new Date().toISOString()
      };
      data.users.push(u);
      await persistItem('app_users', u.id, u);
      await save();
    }
  }
  if (u.role !== 'customer') {
    return res.status(403).json({ error: 'Firebase sign-in is available for customer accounts only.' });
  }
  const token = jwt.sign({ id: u.id, role: u.role, adminRole: u.adminRole, name: u.name }, secret, { expiresIn: '14d' });
  res.json({ token, user: safe(u) });
}));

app.get('/api/me', auth, (req, res) => {
  const u = data.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: safe(u) });
});

// Fare Calculation
app.post('/api/fare/estimate', asyncRoute(async (req, res) => {
  const pickup = String(req.body?.pickup || '').trim();
  const destination = String(req.body?.destination || '').trim();
  const city = req.body?.city;
  if (!pickup || !destination || pickup.length > 250 || destination.length > 250 || !['Delhi', 'Gurugram'].includes(city)) {
    return res.status(400).json({ error: 'Choose Delhi or Gurugram and enter both route locations.' });
  }
  const route = await routeDistance(pickup, destination, city);
  res.json(calculateFare({ ...req.body, ...route }));
}));

// Bookings
// Razorpay Checkout: create orders on the server and verify every payment before marking a booking paid.
// Cash settlement is a two-sided receipt: both parties enter the amount, and the driver
// must also enter the customer's trip-specific cash PIN. Never accept a one-sided "paid" flag.
async function recordCashEvent(booking, actor, action, amount, details = {}) {
  const event = {
    id: randomUUID(),
    bookingId: booking.id,
    actorId: actor.id,
    actorRole: actor.role,
    action,
    amount: Number(amount),
    currency: 'INR',
    details,
    createdAt: new Date().toISOString()
  };
  booking.cashEvents = Array.isArray(booking.cashEvents) ? booking.cashEvents : [];
  booking.cashEvents.push(event);
  data.payments.push({ ...event, provider: 'cash', status: 'event' });
  await persistItem('app_payments', event.id, { ...event, provider: 'cash', status: 'event' });
  return event;
}

function finalizeCashSettlement(booking) {
  const customerAmount = Number(booking.cashCustomerAmount);
  const driverAmount = Number(booking.cashDriverAmount);
  if (!booking.cashCustomerConfirmed || !booking.cashDriverConfirmed) {
    booking.payment_status = 'Cash confirmation pending';
    return false;
  }
  if (customerAmount !== driverAmount) {
    booking.payment_status = 'Cash amount mismatch · under review';
    booking.cashDispute = { customerAmount, driverAmount, detectedAt: new Date().toISOString() };
    return false;
  }
  if (customerAmount < Number(booking.total || 0)) {
    booking.payment_status = 'Partially paid · Cash';
    booking.cashBalanceDue = Number(booking.total || 0) - customerAmount;
    return false;
  }
  booking.payment_status = 'Paid · Cash';
  booking.paidAt = new Date().toISOString();
  booking.cashBalanceDue = 0;
  return true;
}

app.post('/api/payments/cash/customer-confirm', auth, roles('customer'), asyncRoute(async (req, res) => {
  const booking = data.bookings.find((item) => item.id === String(req.body?.bookingId || ''));
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.userId !== req.user.id) return res.status(403).json({ error: 'You can only confirm your own cash payment.' });
  if (booking.payment_method !== 'cash' || !['Trip completed', 'Rated'].includes(booking.status)) return res.status(409).json({ error: 'Cash confirmation is available only after your cash trip is completed.' });
  if (booking.payment_status === 'Paid · Cash') return res.json({ ok: true, payment_status: booking.payment_status });
  const amount = Number(req.body?.amountGiven);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) return res.status(400).json({ error: 'Enter the exact cash amount you handed to the driver in whole rupees.' });
  if (booking.cashCustomerConfirmed) return res.status(409).json({ error: 'Your cash amount has already been submitted. Contact support if it is incorrect.' });
  booking.cashCustomerAmount = amount;
  booking.cashCustomerConfirmed = true;
  await recordCashEvent(booking, req.user, 'customer_declared_cash_handed_over', amount);
  const paid = finalizeCashSettlement(booking);
  if (paid) {
    const customer = data.users.find((u) => u.id === booking.userId);
    if (customer && !booking.cashRewardAwarded) {
      const points = Math.max(1, Math.floor(amount / 100));
      customer.cashRewardsPoints = Number(customer.cashRewardsPoints || 0) + points;
      booking.cashRewardAwarded = true;
      booking.cashRewardPoints = points;
      await persistItem('app_users', customer.id, customer);
    }
  }
  await persistItem('app_bookings', booking.id, booking);
  await save();
  res.json({ ok: true, payment_status: booking.payment_status, cashBalanceDue: booking.cashBalanceDue || 0 });
}));

app.post('/api/payments/cash/driver-confirm', auth, roles('driver'), asyncRoute(async (req, res) => {
  const booking = data.bookings.find((item) => item.id === String(req.body?.bookingId || ''));
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can confirm this cash handover.' });
  if (booking.payment_method !== 'cash' || !['Trip completed', 'Rated'].includes(booking.status)) return res.status(409).json({ error: 'Cash confirmation is available only after the assigned trip is completed.' });
  if (booking.payment_status === 'Paid · Cash') return res.json({ ok: true, payment_status: booking.payment_status });
  const amount = Number(req.body?.amountReceived);
  const pin = String(req.body?.cashPin || '').trim();
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) return res.status(400).json({ error: 'Enter the exact amount of cash received in whole rupees.' });
  if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'Enter the customer's 6-digit cash confirmation PIN.' });
  if (booking.cashDriverConfirmed) return res.status(409).json({ error: 'Your cash receipt has already been submitted.' });
  const expected = createHmac('sha256', secret).update(String(booking.cashPin || '')).digest();
  const supplied = createHmac('sha256', secret).update(pin).digest();
  if (!booking.cashPin || !timingSafeEqual(expected, supplied)) {
    booking.cashPinAttempts = Number(booking.cashPinAttempts || 0) + 1;
    if (booking.cashPinAttempts >= 5) booking.cashPinLockedAt = new Date().toISOString();
    await persistItem('app_bookings', booking.id, booking);
    await save();
    return res.status(booking.cashPinAttempts >= 5 ? 423 : 400).json({ error: booking.cashPinAttempts >= 5 ? 'Cash PIN locked after too many attempts. Contact support.' : 'Cash PIN is incorrect.' });
  }
  if (booking.cashPinLockedAt) return res.status(423).json({ error: 'Cash PIN is locked. Contact support.' });
  booking.cashDriverAmount = amount;
  booking.cashDriverConfirmed = true;
  booking.cashPinVerifiedAt = new Date().toISOString();
  await recordCashEvent(booking, req.user, 'driver_declared_cash_received', amount, { cashPinVerified: true });
  const paid = finalizeCashSettlement(booking);
  if (paid) {
    const customer = data.users.find((u) => u.id === booking.userId);
    if (customer && !booking.cashRewardAwarded) {
      const points = Math.max(1, Math.floor(amount / 100));
      customer.cashRewardsPoints = Number(customer.cashRewardsPoints || 0) + points;
      booking.cashRewardAwarded = true;
      booking.cashRewardPoints = points;
      await persistItem('app_users', customer.id, customer);
    }
  }
  await persistItem('app_bookings', booking.id, booking);
  await save();
  res.json({ ok: true, payment_status: booking.payment_status, cashBalanceDue: booking.cashBalanceDue || 0, cashAmountMatch: booking.cashCustomerConfirmed ? Number(booking.cashCustomerAmount) === amount : null });
}));

// Admin-only cash ledger: amounts, confirmations, mismatches and timestamps are visible for reconciliation.
app.get('/api/admin/cash-ledger', auth, adminOnly, (req, res) => {
  const rows = data.bookings.filter((b) => b.payment_method === 'cash').map((b) => ({
    bookingId: b.id, customer: b.customer, driver: b.driver, fare: b.total,
    customerAmount: b.cashCustomerAmount ?? null, driverAmount: b.cashDriverAmount ?? null,
    customerConfirmed: !!b.cashCustomerConfirmed, driverConfirmed: !!b.cashDriverConfirmed,
    status: b.payment_status, balanceDue: b.cashBalanceDue || 0,
    events: b.cashEvents || [], dispute: b.cashDispute || null
  }));
  res.json({ cashBookings: rows });
});

app.post('/api/payments/razorpay/order', auth, roles('customer', 'admin'), asyncRoute(async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ error: 'Razorpay is not configured yet. Please contact VaahanSathi support.' });
  const booking = data.bookings.find((item) => item.id === String(req.body?.bookingId || ''));
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role !== 'admin' && booking.userId !== req.user.id) return res.status(403).json({ error: 'You can only pay for your own booking.' });
  if (!['Trip completed', 'Rated'].includes(booking.status)) return res.status(409).json({ error: 'Payment is available after the trip is completed.' });
  if (booking.payment_status === 'Paid') return res.status(409).json({ error: 'This booking is already paid.' });
  const amount = Math.round(Number(booking.total) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ error: 'The booking amount is invalid.' });

  const existing = data.payments.find((p) => p.bookingId === booking.id && p.provider === 'razorpay' && p.status === 'created');
  if (existing && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 10 * 60 * 1000) {
    return res.json({ keyId, order: { id: existing.orderId, amount: existing.amount, currency: existing.currency } });
  }

  const providerResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: booking.id.slice(0, 40),
      notes: { booking_id: booking.id, customer_id: req.user.id }
    })
  });
  const order = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok || !order.id) {
    console.error('Razorpay order creation failed:', providerResponse.status, order?.error?.description || 'unknown provider error');
    return res.status(502).json({ error: 'Razorpay could not create the payment order. Please try again.' });
  }
  const paymentRecord = {
    id: randomUUID(),
    provider: 'razorpay',
    bookingId: booking.id,
    userId: req.user.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    status: 'created',
    createdAt: new Date().toISOString()
  };
  data.payments.push(paymentRecord);
  await persistItem('app_payments', paymentRecord.id, paymentRecord);
  await save();
  res.status(201).json({ keyId, order: { id: order.id, amount: order.amount, currency: order.currency } });
}));

// Razorpay webhooks provide a server-to-server confirmation if the customer closes the browser.
app.post('/api/payments/razorpay/webhook', asyncRoute(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ error: 'Razorpay webhook is not configured.' });
  const supplied = String(req.headers['x-razorpay-signature'] || '');
  const expected = createHmac('sha256', webhookSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  if (!supplied || expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity;
  if (!entity?.order_id) return res.json({ ok: true, ignored: true });
  const record = data.payments.find((p) => p.provider === 'razorpay' && p.orderId === entity.order_id);
  if (!record) return res.json({ ok: true, ignored: true });
  const booking = data.bookings.find((item) => item.id === record.bookingId);
  if (!booking) return res.json({ ok: true, ignored: true });

  if (event === 'payment.captured' || event === 'order.paid') {
    const payment = req.body?.payload?.payment?.entity;
    if (payment && Number(payment.amount) === Number(record.amount) && payment.currency === 'INR') {
      record.status = 'paid';
      record.paymentId = payment.id;
      record.paidAt = new Date().toISOString();
      record.method = payment.method || 'Razorpay';
      booking.payment_status = 'Paid';
      booking.paidAt = record.paidAt;
      booking.payment_method = record.method;
      await persistItem('app_payments', record.id, record);
      await persistItem('app_bookings', booking.id, booking);
      await save();
    }
  } else if (event === 'payment.failed' && record.status !== 'paid') {
    record.status = 'failed';
    record.failureAt = new Date().toISOString();
    await persistItem('app_payments', record.id, record);
    await save();
  }
  res.json({ ok: true });
}));

app.post('/api/payments/razorpay/verify', auth, roles('customer', 'admin'), asyncRoute(async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ error: 'Razorpay is not configured yet.' });
  const { bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (![bookingId, orderId, paymentId, signature].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Payment verification details are incomplete.' });
  }
  const booking = data.bookings.find((item) => item.id === bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role !== 'admin' && booking.userId !== req.user.id) return res.status(403).json({ error: 'You can only verify your own booking payment.' });
  const record = data.payments.find((p) => p.provider === 'razorpay' && p.bookingId === booking.id && p.orderId === orderId);
  if (!record) return res.status(404).json({ error: 'Payment order was not found for this booking.' });
  if (record.status === 'paid' && booking.payment_status === 'Paid') return res.json({ ok: true, payment_status: 'Paid' });

  const expected = createHmac('sha256', keySecret).update(orderId + '|' + paymentId).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(400).json({ error: 'Payment signature could not be verified.' });
  }

  const providerResponse = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), {
    headers: { Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') }
  });
  const payment = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok || payment.order_id !== orderId || Number(payment.amount) !== Number(record.amount) || payment.currency !== 'INR' || payment.status !== 'captured') {
    return res.status(409).json({ error: 'Razorpay has not confirmed a captured payment for this booking yet. Do not pay again; contact support if your bank was debited.' });
  }

  record.status = 'paid';
  record.paymentId = paymentId;
  record.paidAt = new Date().toISOString();
  record.method = payment.method || 'Razorpay';
  booking.payment_status = 'Paid';
  booking.paidAt = record.paidAt;
  booking.payment_method = record.method;
  await persistItem('app_payments', record.id, record);
  await persistItem('app_bookings', booking.id, booking);
  await save();
  res.json({ ok: true, payment_status: 'Paid', bookingId: booking.id });
}));

// Live GPS is shared only by the assigned driver during an active booking.
app.post('/api/bookings/:id/location', auth, roles('driver'), asyncRoute(async (req, res) => {
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can share this trip location.' });
  if (!['Driver assigned', 'Driver arriving', 'Trip started'].includes(booking.status)) return res.status(409).json({ error: 'Location sharing is only active during an assigned trip.' });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const accuracy = Number(req.body?.accuracy || 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || accuracy > 250) {
    return res.status(400).json({ error: 'A valid GPS position with acceptable accuracy is required.' });
  }
  booking.driverLocation = {
    lat, lng, accuracy: Math.max(0, accuracy),
    heading: Number.isFinite(Number(req.body?.heading)) ? Number(req.body.heading) : null,
    speed: Number.isFinite(Number(req.body?.speed)) ? Number(req.body.speed) : null,
    updatedAt: new Date().toISOString()
  };
  await persistItem('app_bookings', booking.id, booking);
  await save();
  res.json({ ok: true, updatedAt: booking.driverLocation.updatedAt });
}));

app.get('/api/bookings/:id/location', auth, asyncRoute(async (req, res) => {
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role === 'customer' && booking.userId !== req.user.id) return res.status(403).json({ error: 'You can only view your own trip location.' });
  if (req.user.role === 'driver' && booking.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can view this trip.' });
  if (!['customer', 'driver', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'You cannot view this trip location.' });
  res.json({
    driverLocation: ['Driver assigned', 'Driver arriving', 'Trip started'].includes(booking.status) ? booking.driverLocation || null : null,
    pickupCoordinates: booking.pickupCoordinates || null,
    destinationCoordinates: booking.destinationCoordinates || null,
    status: booking.status,
    updatedAt: booking.driverLocation?.updatedAt || null
  });
}));

app.get('/api/bookings', auth, (req, res) => {
  let rows = [...data.bookings];
  const currentUser = data.users.find((u) => u.id === req.user.id);

  if (req.user.role === 'customer') {
    rows = rows.filter((b) => b.userId === req.user.id);
  } else if (req.user.role === 'driver') {
    rows = rows.filter(
      (b) => b.driverId === req.user.id || (
        b.status === 'Searching' && b.city === currentUser?.city &&
        (!b.requestedDriverStyle || b.requestedDriverStyle === 'any' ||
          (Array.isArray(currentUser?.driverStyleTags) ? currentUser.driverStyleTags : ['friendly']).includes(b.requestedDriverStyle))
      )
    );
  }

  const enriched = rows.map((b) => {
    const driverUser = data.users.find((u) => u.id === b.driverId);
    const customerUser = data.users.find((u) => u.id === b.userId);
    return {
      ...b,
      start_otp: req.user.role === 'customer' || req.user.role === 'admin' ? b.start_otp : undefined,
      end_otp: (req.user.role === 'customer' && b.status === 'Trip started') || req.user.role === 'admin' ? b.end_otp : undefined,
      cashPin: req.user.role === 'customer' && b.payment_method === 'cash' && ['Trip completed', 'Rated'].includes(b.status) && !b.cashPinLockedAt ? b.cashPin : undefined,
      cashEvents: req.user.role === 'admin' ? (b.cashEvents || []) : undefined,
      cashCustomerAmount: req.user.role === 'customer' ? b.cashCustomerAmount : undefined,
      cashDriverAmount: req.user.role === 'driver' ? b.cashDriverAmount : undefined,
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
    const { tripType = 'Hourly', pickup, destination, city = 'Delhi', vehicle = 'Sedan', date, time = '10:00', hours = 4, paymentMethod = 'online', driverStyle = 'any' } = req.body || {};
    const allowedStyles = ['any', 'friendly', 'talkative', 'humorous', 'professional', 'quiet'];
    if (!['online', 'cash'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose online or cash payment.' });
    if (!allowedStyles.includes(driverStyle)) return res.status(400).json({ error: 'Choose a valid driver communication preference.' });
    if (!String(pickup || '').trim() || !String(destination || '').trim() || !date) {
      return res.status(400).json({ error: 'Pickup location, destination, and date are required.' });
    }
    if (!['Delhi', 'Gurugram'].includes(city)) {
      return res.status(400).json({ error: 'VaahanSathi is currently operational in Delhi and Gurugram.' });
    }

    const route = await routeDistance(String(pickup).trim(), String(destination).trim(), city);
    const [pickupCoordinates, destinationCoordinates] = await Promise.all([
      resolveLocation(city, String(pickup).trim()),
      resolveLocation(city, String(destination).trim())
    ]);
    const f = calculateFare({ tripType, hours, time, vehicle, ...route });
    const customerUser = data.users.find((u) => u.id === req.user.id);

    // Match only verified, online drivers who have declared the customer's requested communication style.
    const eligibleDrivers = data.users.filter((u) =>
      u.role === 'driver' && u.city === city && u.available === true && u.verificationStatus === 'verified' &&
      (driverStyle === 'any' || (Array.isArray(u.driverStyleTags) ? u.driverStyleTags : ['friendly']).includes(driverStyle))
    );
    const availableDriver = eligibleDrivers.sort((a, b) =>
      Number(b.rating || 0) - Number(a.rating || 0) || Number(b.trips || 0) - Number(a.trips || 0)
    )[0] || null;

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
      pickupCoordinates,
      destinationCoordinates,
      requestedDriverStyle: driverStyle,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'cash' ? 'Cash due after trip' : 'Payment due after trip',
      cashCustomerConfirmed: false,
      cashDriverConfirmed: false,
      cashPin: paymentMethod === 'cash' ? String(randomInt(100000, 999999)) : null,
      cashPinAttempts: 0,
      status: availableDriver ? 'Driver assigned' : 'Searching',
      start_otp: String(randomInt(1000, 9999)),
      end_otp: String(randomInt(1000, 9999)),
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
    const allowedStatuses = ['Driver assigned', 'Driver arriving', 'Trip started', 'Trip completed', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid booking status.' });
    }

    // Customers may only cancel their own booking before the trip begins.
    if (req.user.role === 'customer') {
      if (b.userId !== req.user.id) {
        return res.status(403).json({ error: 'You can only update your own bookings.' });
      }
      if (status !== 'Cancelled' || !['Searching', 'Driver assigned', 'Driver arriving'].includes(b.status)) {
        return res.status(409).json({ error: 'This booking can no longer be cancelled.' });
      }
    } else if (req.user.role === 'driver') {
      if (status === 'Driver assigned' && b.status === 'Searching' && !b.driverId) {
        if (currentUser?.verificationStatus !== 'verified' || currentUser?.available !== true) {
          return res.status(403).json({ error: 'Your driver account must be verified and on duty to accept rides.' });
        }
        if (b.requestedDriverStyle && b.requestedDriverStyle !== 'any' &&
            !(Array.isArray(currentUser?.driverStyleTags) ? currentUser.driverStyleTags : ['friendly']).includes(b.requestedDriverStyle)) {
          return res.status(403).json({ error: 'This customer requested a different communication style. Update your driver style tags to receive matching requests.' });
        }
        b.driverId = req.user.id;
        b.driver = currentUser.name || 'Driver';
      } else {
        if (b.driverId !== req.user.id) {
          return res.status(403).json({ error: 'This booking is not assigned to you.' });
        }
        const nextByCurrent = {
          'Driver assigned': 'Driver arriving',
          'Driver arriving': 'Trip started',
          'Trip started': 'Trip completed'
        };
        if (nextByCurrent[b.status] !== status) {
          return res.status(409).json({ error: 'This status change is not allowed for the current trip stage.' });
        }
      }
    } else if (req.user.role === 'admin') {
      // Admins can manage operational statuses, but cannot resurrect a cancelled booking.
      if (b.status === 'Cancelled' || b.status === 'Rated') {
        return res.status(409).json({ error: 'This booking is closed and cannot be changed.' });
      }
    } else {
      return res.status(403).json({ error: 'You do not have permission to update bookings.' });
    }

    // OTPs are required for driver trip start/completion. Admin corrections are audited separately.
    if (req.user.role === 'driver' && status === 'Trip started') {
      if (String(otp || '').trim() !== String(b.start_otp)) {
        return res.status(400).json({ error: 'Start OTP is invalid. Ask the car owner for their 4-digit start OTP.' });
      }
    }
    if (req.user.role === 'driver' && status === 'Trip completed') {
      if (String(otp || '').trim() !== String(b.end_otp)) {
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

// â”€â”€ Driver duty toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.patch('/api/driver/duty', auth, roles('driver'), asyncRoute(async (req, res) => {
  const u = data.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  u.available = req.body.available === true || req.body.available === 'true';
  await persistItem('app_users', u.id, u);
  await save();
  res.json({ available: u.available });
}));

// â”€â”€ Profile update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.patch('/api/me', auth, asyncRoute(async (req, res) => {
  const u = data.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const allowed = ['name', 'phone', 'city', 'vehicle'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) u[k] = String(req.body[k]).trim();
  }
  if (u.role === 'driver' && Array.isArray(req.body.driverStyleTags)) {
    const allowedStyles = ['friendly', 'talkative', 'humorous', 'professional', 'quiet'];
    u.driverStyleTags = [...new Set(req.body.driverStyleTags.filter((tag) => allowedStyles.includes(tag)))].slice(0, 5);
  }
  await persistItem('app_users', u.id, u);
  await save();
  res.json({ user: safe(u) });
}));

// â”€â”€ Customer dispute filing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/disputes', auth, roles('customer', 'admin'), asyncRoute(async (req, res) => {
  const { bookingId, subject, description } = req.body || {};
  if (!subject || !description) return res.status(400).json({ error: 'Subject and description are required.' });
  const booking = data.bookings.find((b) => b.id === bookingId);
  const dispute = {
    id: randomUUID(),
    bookingId: bookingId || null,
    userId: req.user.id,
    userName: req.user.name,
    subject: String(subject).slice(0, 120),
    description: String(description).slice(0, 1000),
    status: 'open',
    createdAt: new Date().toISOString(),
    route: booking ? `${booking.pickup} â†’ ${booking.destination}` : null,
  };
  data.disputes.push(dispute);
  await persistItem('app_disputes', dispute.id, dispute);
  await save();
  res.status(201).json({ dispute });
}));

// â”€â”€ Admin: resolve/close dispute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.patch('/api/admin/disputes/:id', auth, adminOnly, asyncRoute(async (req, res) => {
  const d = data.disputes.find((x) => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Dispute not found.' });
  d.status = ['resolved', 'closed', 'escalated'].includes(req.body.status) ? req.body.status : d.status;
  d.resolution = String(req.body.resolution || '').slice(0, 500);
  d.resolvedAt = new Date().toISOString();
  d.resolvedBy = req.user.name;
  await persistItem('app_disputes', d.id, d);
  await audit(req, 'dispute_updated', 'disputes', d.id, null, { status: d.status }, req.body.resolution || 'Dispute updated');
  await save();
  res.json({ dispute: d });
}));

// â”€â”€ Admin: cancel any booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.patch('/api/admin/bookings/:id/cancel', auth, adminOnly, asyncRoute(async (req, res) => {
  const b = data.bookings.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  b.status = 'Cancelled';
  b.cancelledBy = req.user.name;
  b.cancelledAt = new Date().toISOString();
  await persistItem('app_bookings', b.id, b);
  await audit(req, 'booking_cancelled', 'bookings', b.id, null, { status: 'Cancelled' }, req.body.reason || 'Admin cancelled');
  await save();
  res.json({ booking: b });
}));

// â”€â”€ Admin: update pricing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (already exists above; keeping alias here for clarity)

// Cross-browser voice transcription. The client uploads a short recording; the API key stays on the server.
app.post('/api/voice/transcribe', express.raw({
  type: ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/x-m4a'],
  limit: '12mb'
}), asyncRoute(async (req, res) => {
  const audio = req.body;
  if (!Buffer.isBuffer(audio) || audio.length < 1000) {
    return res.status(400).json({ error: 'No usable audio was received. Please record your trip again.' });
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'Voice transcription is not configured on the server yet. Please type your trip or ask the administrator to configure the voice service.' });
  }
  const mime = String(req.headers['content-type'] || 'audio/webm').split(';')[0].toLowerCase();
  const extension = mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
    : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav'
    : mime.includes('mpeg') ? 'mp3' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mime }), 'vaahansathi-recording.' + extension);
  form.append('model_id', 'scribe_v1');
  const language = String(req.query.language || '');
  if (language === 'en-IN') form.append('language_code', 'eng');
  else if (language === 'hi-IN') form.append('language_code', 'hin');
  // Hinglish is left to automatic language detection to avoid forcing Hindi or English.
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    body: form
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Voice transcription provider error:', response.status, result?.detail?.message || result?.detail || result?.message || 'unknown error');
    return res.status(response.status === 429 ? 503 : 502).json({
      error: response.status === 429
        ? 'The voice service is busy or its quota is exhausted. Please try again shortly or type your trip.'
        : 'We could not transcribe this recording. Please try again or type your trip.'
    });
  }
  const transcript = typeof result.text === 'string' ? result.text.trim() : '';
  if (!transcript) return res.status(422).json({ error: 'We could not hear clear words. Please speak a little closer to the microphone and try again.' });
  res.json({ text: transcript });
}));

// Voice place vocabulary: canonical labels plus common spoken/transcribed variants.
// Deterministic normalisation improves known Delhi-NCR landmark matching; it is not model training.
const VOICE_PLACE_ALIASES = [
  { city: 'Delhi', name: 'Jhilmil Colony, Shahdara, Delhi', aliases: ['jhilmil colony shahdara', 'jhilmil colony', 'jhilmil', 'झिलमिल कॉलोनी', 'झिलमिल'] },
  { city: 'Delhi', name: 'Jhilmil Industrial Area, Delhi', aliases: ['jhilmil industrial area', 'jhilmil industrial'] },
  { city: 'Delhi', name: 'Shahdara, Delhi', aliases: ['shahdara', 'शाहदरा'] },
  { city: 'Delhi', name: 'Dilshad Garden, Delhi', aliases: ['dilshad garden', 'dilshad'] },
  { city: 'Delhi', name: 'Vivek Vihar, Delhi', aliases: ['vivek vihar'] },
  { city: 'Delhi', name: 'Surajmal Vihar, Delhi', aliases: ['surajmal vihar'] },
  { city: 'Delhi', name: 'GTB Enclave, Delhi', aliases: ['gtb enclave', 'guru teg bahadur enclave'] },
  { city: 'Delhi', name: 'Mansarovar Park, Delhi', aliases: ['mansarovar park'] },
  { city: 'Delhi', name: 'Seemapuri, Delhi', aliases: ['seemapuri'] },
  { city: 'Delhi', name: 'Naveen Shahdara, Delhi', aliases: ['naveen shahdara'] },
  { city: 'Delhi', name: 'Bhola Nath Nagar, Delhi', aliases: ['bhola nath nagar', 'bholanath nagar'] },
  { city: 'Delhi', name: 'Welcome, Shahdara, Delhi', aliases: ['welcome shahdara', 'welcome metro', 'welcome'] },
  { city: 'Delhi', name: 'Krishna Nagar, Delhi', aliases: ['krishna nagar'] },
  { city: 'Delhi', name: 'Karkardooma, Delhi', aliases: ['karkardooma'] },
  { city: 'Delhi', name: 'Yamuna Vihar, Delhi', aliases: ['yamuna vihar'] },
  { city: 'Delhi', name: 'Babarpur, Delhi', aliases: ['babarpur'] },
  { city: 'Delhi', name: 'Gandhi Nagar, Delhi', aliases: ['gandhi nagar delhi'] },
  { city: 'Delhi', name: 'Geeta Colony, Delhi', aliases: ['geeta colony'] },
  { city: 'Delhi', name: 'Connaught Place, Delhi', aliases: ['connaught place', 'cp delhi', 'कनॉट प्लेस'] },
  { city: 'Delhi', name: 'India Gate, Delhi', aliases: ['india gate'] },
  { city: 'Delhi', name: 'IGI Airport Terminal 3, Delhi', aliases: ['igi airport terminal 3', 'igi terminal 3', 'terminal 3 airport', 'indira gandhi airport', 'igi airport'] },
  { city: 'Delhi', name: 'New Delhi Railway Station, Delhi', aliases: ['new delhi railway station', 'ndls'] },
  { city: 'Delhi', name: 'Old Delhi Railway Station, Delhi', aliases: ['old delhi railway station', 'delhi junction'] },
  { city: 'Delhi', name: 'Kashmere Gate ISBT, Delhi', aliases: ['kashmere gate'] },
  { city: 'Delhi', name: 'Anand Vihar, Delhi', aliases: ['anand vihar'] },
  { city: 'Delhi', name: 'Sarai Kale Khan ISBT, Delhi', aliases: ['sarai kale khan'] },
  { city: 'Delhi', name: 'Karol Bagh, Delhi', aliases: ['karol bagh'] },
  { city: 'Delhi', name: 'Rajouri Garden, Delhi', aliases: ['rajouri garden'] },
  { city: 'Delhi', name: 'Dwarka, Delhi', aliases: ['dwarka delhi', 'द्वारका'] },
  { city: 'Delhi', name: 'Rohini, Delhi', aliases: ['rohini delhi', 'रोहिणी'] },
  { city: 'Delhi', name: 'Pitampura, Delhi', aliases: ['pitampura'] },
  { city: 'Delhi', name: 'Janakpuri, Delhi', aliases: ['janakpuri'] },
  { city: 'Delhi', name: 'Vasant Kunj, Delhi', aliases: ['vasant kunj'] },
  { city: 'Delhi', name: 'Saket, Delhi', aliases: ['saket delhi', 'साकेत'] },
  { city: 'Delhi', name: 'Hauz Khas, Delhi', aliases: ['hauz khas'] },
  { city: 'Delhi', name: 'Greater Kailash, Delhi', aliases: ['greater kailash', 'gk one', 'gk two'] },
  { city: 'Delhi', name: 'Lajpat Nagar, Delhi', aliases: ['lajpat nagar'] },
  { city: 'Delhi', name: 'Nehru Place, Delhi', aliases: ['nehru place'] },
  { city: 'Delhi', name: 'Chandni Chowk, Delhi', aliases: ['chandni chowk'] },
  { city: 'Delhi', name: 'Laxmi Nagar, Delhi', aliases: ['laxmi nagar', 'lakshmi nagar'] },
  { city: 'Delhi', name: 'Preet Vihar, Delhi', aliases: ['preet vihar'] },
  { city: 'Delhi', name: 'Mayur Vihar, Delhi', aliases: ['mayur vihar'] },
  { city: 'Delhi', name: 'Aerocity, Delhi', aliases: ['aerocity', 'aero city'] },
  { city: 'Delhi', name: 'AIIMS, Delhi', aliases: ['aiims delhi', 'aiims'] },
  { city: 'Delhi', name: 'Pragati Maidan, Delhi', aliases: ['pragati maidan'] },
  { city: 'Delhi', name: 'Jasola, Delhi', aliases: ['jasola'] },
  { city: 'Gurugram', name: 'Cyber City, Gurugram', aliases: ['cyber city', 'dlf cyber city', 'साइबर सिटी'] },
  { city: 'Gurugram', name: 'Millennium City Centre, Gurugram', aliases: ['huda city centre', 'huda city center', 'millennium city centre', 'millennium city center'] },
  { city: 'Gurugram', name: 'MG Road, Gurugram', aliases: ['mg road gurugram', 'mg road gurgaon'] },
  { city: 'Gurugram', name: 'Golf Course Road, Gurugram', aliases: ['golf course road'] },
  { city: 'Gurugram', name: 'Golf Course Extension Road, Gurugram', aliases: ['golf course extension road', 'gcer'] },
  { city: 'Gurugram', name: 'Sohna Road, Gurugram', aliases: ['sohna road'] },
  { city: 'Gurugram', name: 'Udyog Vihar Phase 1, Gurugram', aliases: ['udyog vihar phase 1', 'udyog vihar one'] },
  { city: 'Gurugram', name: 'Udyog Vihar Phase 2, Gurugram', aliases: ['udyog vihar phase 2', 'udyog vihar two'] },
  { city: 'Gurugram', name: 'Udyog Vihar Phase 3, Gurugram', aliases: ['udyog vihar phase 3', 'udyog vihar three'] },
  { city: 'Gurugram', name: 'Sector 14, Gurugram', aliases: ['sector 14'] },
  { city: 'Gurugram', name: 'Sector 29, Gurugram', aliases: ['sector 29'] },
  { city: 'Gurugram', name: 'Sector 31, Gurugram', aliases: ['sector 31'] },
  { city: 'Gurugram', name: 'Sector 43, Gurugram', aliases: ['sector 43'] },
  { city: 'Gurugram', name: 'Sector 45, Gurugram', aliases: ['sector 45'] },
  { city: 'Gurugram', name: 'Sector 46, Gurugram', aliases: ['sector 46'] },
  { city: 'Gurugram', name: 'Sector 47, Gurugram', aliases: ['sector 47'] },
  { city: 'Gurugram', name: 'Sector 48, Gurugram', aliases: ['sector 48'] },
  { city: 'Gurugram', name: 'Sector 49, Gurugram', aliases: ['sector 49'] },
  { city: 'Gurugram', name: 'Sector 50, Gurugram', aliases: ['sector 50'] },
  { city: 'Gurugram', name: 'Sector 56, Gurugram', aliases: ['sector 56'] },
  { city: 'Gurugram', name: 'Sector 57, Gurugram', aliases: ['sector 57'] },
  { city: 'Gurugram', name: 'Sector 62, Gurugram', aliases: ['sector 62'] },
  { city: 'Gurugram', name: 'Sector 65, Gurugram', aliases: ['sector 65'] },
  { city: 'Gurugram', name: 'Sector 67, Gurugram', aliases: ['sector 67'] },
  { city: 'Gurugram', name: 'Sector 69, Gurugram', aliases: ['sector 69'] },
  { city: 'Gurugram', name: 'DLF Phase 1, Gurugram', aliases: ['dlf phase 1', 'dlf one'] },
  { city: 'Gurugram', name: 'DLF Phase 2, Gurugram', aliases: ['dlf phase 2', 'dlf two'] },
  { city: 'Gurugram', name: 'DLF Phase 3, Gurugram', aliases: ['dlf phase 3', 'dlf three'] },
  { city: 'Gurugram', name: 'DLF Phase 4, Gurugram', aliases: ['dlf phase 4', 'dlf four'] },
  { city: 'Gurugram', name: 'Palam Vihar, Gurugram', aliases: ['palam vihar'] },
  { city: 'Gurugram', name: 'South City 1, Gurugram', aliases: ['south city 1', 'south city one'] },
  { city: 'Gurugram', name: 'South City 2, Gurugram', aliases: ['south city 2', 'south city two'] },
  { city: 'Gurugram', name: 'Nirvana Country, Gurugram', aliases: ['nirvana country'] },
  { city: 'Gurugram', name: 'Ambience Mall, Gurugram', aliases: ['ambience mall'] },
  { city: 'Gurugram', name: 'Medanta Hospital, Gurugram', aliases: ['medanta', 'medanta hospital'] },
  { city: 'Gurugram', name: 'Artemis Hospital, Gurugram', aliases: ['artemis', 'artemis hospital'] },
  { city: 'Gurugram', name: 'Gurugram Railway Station, Gurugram', aliases: ['gurugram railway station', 'gurgaon railway station'] },
  { city: 'Gurugram', name: 'Dwarka Expressway, Gurugram', aliases: ['dwarka expressway'] },
  { city: 'Gurugram', name: 'Badshahpur, Gurugram', aliases: ['badshahpur'] },
  { city: 'Gurugram', name: 'IMT Manesar, Gurugram', aliases: ['imt manesar', 'manesar'] },
  { city: 'Gurugram', name: 'Gwal Pahari, Gurugram', aliases: ['gwal pahari'] },
  { city: 'Gurugram', name: 'Sushant Lok Phase 1, Gurugram', aliases: ['sushant lok phase 1', 'sushant lok'] },
  { city: 'Gurugram', name: 'New Palam Vihar, Gurugram', aliases: ['new palam vihar'] },
  { city: 'Gurugram', name: 'Sector 70A, Gurugram', aliases: ['sector 70a'] },
  { city: 'Gurugram', name: 'Sector 72A, Gurugram', aliases: ['sector 72a'] },
  { city: 'Gurugram', name: 'Sector 74A, Gurugram', aliases: ['sector 74a'] },
  { city: 'Gurugram', name: 'Sector 75, Gurugram', aliases: ['sector 75'] },
  { city: 'Gurugram', name: 'Sector 87, Gurugram', aliases: ['sector 87'] },
  { city: 'Gurugram', name: 'Sector 88, Gurugram', aliases: ['sector 88'] },
  { city: 'Gurugram', name: 'Sector 89, Gurugram', aliases: ['sector 89'] },
  { city: 'Gurugram', name: 'Sector 95, Gurugram', aliases: ['sector 95'] },
  { city: 'Gurugram', name: 'Sector 99, Gurugram', aliases: ['sector 99'] },
  { city: 'Gurugram', name: 'Sector 110A, Gurugram', aliases: ['sector 110a'] },
  { city: 'Gurugram', name: 'Sector 113, Gurugram', aliases: ['sector 113'] },
  { city: 'Gurugram', name: 'Sector 115, Gurugram', aliases: ['sector 115'] },
  { city: 'Gurugram', name: 'Sector 5, Gurugram', aliases: ['sector 5 gurugram'] },
  { city: 'Gurugram', name: 'Sector 7, Gurugram', aliases: ['sector 7 gurugram'] },
  { city: 'Gurugram', name: 'Sector 17, Gurugram', aliases: ['sector 17 gurugram'] },
  { city: 'Gurugram', name: 'Sector 18, Gurugram', aliases: ['sector 18 gurugram'] },
  { city: 'Gurugram', name: 'Sector 27, Gurugram', aliases: ['sector 27 gurugram'] },
  { city: 'Gurugram', name: 'Sector 28, Gurugram', aliases: ['sector 28 gurugram'] },
  { city: 'Gurugram', name: 'Sector 39, Gurugram', aliases: ['sector 39 gurugram'] },
  { city: 'Gurugram', name: 'Sector 44, Gurugram', aliases: ['sector 44 gurugram'] },
  { city: 'Gurugram', name: 'Sector 51, Gurugram', aliases: ['sector 51 gurugram'] },
  { city: 'Gurugram', name: 'Sector 61, Gurugram', aliases: ['sector 61 gurugram'] },
  { city: 'Gurugram', name: 'Sector 64, Gurugram', aliases: ['sector 64 gurugram'] },
  { city: 'Gurugram', name: 'Sector 68, Gurugram', aliases: ['sector 68 gurugram'] },
  { city: 'Gurugram', name: 'Sector 80, Gurugram', aliases: ['sector 80 gurugram'] },
  { city: 'Gurugram', name: 'Sector 81, Gurugram', aliases: ['sector 81 gurugram'] },
  { city: 'Gurugram', name: 'Sector 94, Gurugram', aliases: ['sector 94 gurugram'] },
  { city: 'Gurugram', name: 'Sector 101, Gurugram', aliases: ['sector 101 gurugram'] },
  { city: 'Gurugram', name: 'Sector 114, Gurugram', aliases: ['sector 114 gurugram'] },
];

// Add the commonly used Gurugram sectors to voice place matching.
for (const sector of [9, 10, 14, 15, 21, 22, 23, 29, 31, 38, 40, 41, 42, 43, 45, 46, 47, 48, 49, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 65, 66, 67, 69, 70, 71, 72, 73, 74, 76, 77, 78, 79, 82, 83, 84, 85, 86, 90, 91, 92, 93, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]) {
  const name = 'Sector ' + sector + ', Gurugram';
  if (!VOICE_PLACE_ALIASES.some((place) => place.name === name)) {
    VOICE_PLACE_ALIASES.push({ city: 'Gurugram', name, aliases: ['sector ' + sector, 'sector number ' + sector] });
  }
}

function normaliseVoicePlace(value) {
  if (!value) return value;
  const input = ' ' + String(value).toLocaleLowerCase('en-IN').replace(/[^a-z0-9\u0900-\u097F]+/gi, ' ').trim() + ' ';
  const matches = [];
  for (const place of VOICE_PLACE_ALIASES) {
    for (const alias of place.aliases) {
      const needle = ' ' + alias.toLocaleLowerCase('en-IN').replace(/[^a-z0-9\u0900-\u097F]+/gi, ' ').trim() + ' ';
      if (input.includes(needle)) matches.push({ name: place.name, length: needle.length });
    }
  }
  matches.sort((a, b) => b.length - a.length);
  return matches[0]?.name || String(value).trim();
}

// Voice booking intent parser. The browser handles listening; this endpoint normalises
// the transcript into the same fields used by the real booking form.
app.post('/api/voice/intent', (req, res) => {
  const raw = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!raw) return res.status(400).json({ error: 'Please speak or type your pickup and destination.' });
  if (raw.length > 500) return res.status(413).json({ error: 'Trip description is too long. Please keep it under 500 characters.' });
  const text = raw.toLowerCase();
  const language = String(req.body.language || 'en-IN');
  const requestedCity = String(req.body.city || 'Delhi');

  // ── City detection ───────────────────────────────────────────────────────
  const matchedPlace = VOICE_PLACE_ALIASES.find((place) =>
    place.aliases.some((alias) => text.includes(alias.toLocaleLowerCase('en-IN')))
  );
  const city =
    /gurugram|gurgaon|गुरुग्राम/.test(text) || matchedPlace?.city === 'Gurugram' ? 'Gurugram' :
    /delhi|दिल्ली/.test(text) || matchedPlace?.city === 'Delhi' ? 'Delhi' :
    requestedCity;

  // ── Trip type ────────────────────────────────────────────────────────────
  const tripType =
    /airport|एयरपोर्ट|हवाई अड्डा|airport drop|airport jaana|igi/.test(text) ? 'Airport' :
    /outstation|bahar|शहर के बाहर|outstaion|दूसरे शहर/.test(text) ? 'Outstation' :
    /night|रात|rat ko|raat ko|late night|रात में/.test(text) ? 'Night driver' :
    /full day|poora din|पूरा दिन|sara din|सारा दिन|whole day/.test(text) ? 'Full day' :
    'Hourly';

  // ── Hours ────────────────────────────────────────────────────────────────
  const numberMap = {
    one:1,ek:1,एक:1, two:2,do:2,दो:2, three:3,teen:3,तीन:3,
    four:4,chaar:4,char:4,चार:4, five:5,paanch:5,पांच:5,
    six:6,chhe:6,छः:6, seven:7,saat:7,सात:7, eight:8,aath:8,आठ:8,
    nine:9,nau:9,नौ:9, ten:10,das:10,दस:10
  };
  const hourMatch = text.match(/(\d+)\s*(?:hours?|ghante|घंटे|घंटा|hr)/i);
  let hours = 4;
  if (hourMatch) {
    hours = Number(hourMatch[1]);
  } else {
    for (const [word, val] of Object.entries(numberMap)) {
      if (new RegExp(`\\b${word}\\b.*(?:hour|ghanta|ghante|घंटे)`).test(text)) { hours = val; break; }
    }
  }
  hours = Math.max(1, Math.min(24, hours || (tripType === 'Full day' ? 8 : 4)));

  // ── Route extraction — English, Hindi, Hinglish ──────────────────────────
  // English:  from X to Y
  // Hindi:    X से Y (जाना है / तक)
  // Hinglish: X se Y jaana / X se Y le jao / mujhe X se Y jaana
  const routePatterns = [
    /(?:from|pickup at|pick me up from|pick up from)\s+(.+?)\s+(?:to|drop at|drop me at|going to|towards)\s+(.+?)(?:\s+(?:at|on|tomorrow|today|kal|aaj|abhi)|[,.]|$)/i,
    /(?:mujhe|mujhko|please|bhai|yaar)\s+(.+?)\s+se\s+(.+?)\s+(?:le jao|jaana hai|jaana|chalna hai|drop karo|chhod do|pahuncha do)/i,
    /(.+?)\s+se\s+(.+?)\s+(?:jaana hai|jana hai|drop|lena hai|jaana|jana)/i,
    /(.+?)\s+से\s+(.+?)\s+(?:जाना है|जाना|तक|के लिए|छोड़ दो|पहुँचाओ)/i,
    /(.+?)\s+से\s+(.+?)(?:\s+(?:कल|आज|सुबह|शाम|रात)|[,.]|$)/i,
  ];
  let pickup = null, destination = null;
  for (const pat of routePatterns) {
    const m = raw.match(pat);
    if (m && m[1] && m[2]) {
      const clean = (s) => s
        .replace(/^(mujhe|mujhko|please|bhai|yaar|मुझे|मुझको)\s+/i, '')
        .replace(/\s+(kal|aaj|abhi|tomorrow|today|कल|आज)\s*.*$/i, '')
        .replace(/\s+(at|around|ko)\s+\d.*/i, '')
        .replace(/[,.?।]+$/, '').trim();
      pickup = normaliseVoicePlace(clean(m[1]));
      destination = normaliseVoicePlace(clean(m[2]));
      if (pickup && destination) break;
    }
  }

  if (pickup && destination && pickup.toLocaleLowerCase('en-IN') === destination.toLocaleLowerCase('en-IN')) {
    return res.status(422).json({ error: 'Pickup and destination were recognised as the same place. Please say both locations clearly, for example: from Jhilmil Colony to Cyber City.' });
  }

  // ── Time parsing — English + Hindi + Hinglish ────────────────────────────
  const timeMap = { subah:'AM', morning:'AM', savere:'AM', dopahar:'PM', dopahar:'PM', shaam:'PM', evening:'PM', raat:'PM', night:'PM', raat_ko:'PM' };
  let time = null;
  const tMatch = raw.match(/(?:at|around|ko|baje|बजे|सुबह|शाम|रात)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM|baje|बजे)?/i)
    || raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b/i);
  if (tMatch) {
    let h = Number(tMatch[1]);
    const min = tMatch[2] || '00';
    const suf = (tMatch[3] || '').toLowerCase();
    if ((suf === 'pm' || suf === 'shaam' || suf === 'raat' || suf === 'रात' || suf === 'शाम') && h < 12) h += 12;
    if ((suf === 'am' || suf === 'subah' || suf === 'morning' || suf === 'सुबह') && h === 12) h = 0;
    time = `${String(h).padStart(2,'0')}:${min}`;
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  const date =
    /tomorrow|kal|parso.*?nahi|कल/.test(text) ? new Date(Date.now() + 86400000).toISOString().slice(0,10) :
    /today|aaj|अभी|आज/.test(text) ? new Date().toISOString().slice(0,10) :
    null;

  // ── Summary in the user's language ───────────────────────────────────────
  const fromTo = pickup && destination ? `${pickup} से ${destination}` : city;
  const fromToEn = pickup && destination ? `${pickup} to ${destination}` : `in ${city}`;
  const typeHi = { Airport:'एयरपोर्ट ड्रॉप', Outstation:'आउटस्टेशन', 'Night driver':'नाइट ड्राइवर', 'Full day':'फुल डे', Hourly:'ड्राइवर सर्विस' };
  const summaries = {
    'hi-IN': `ठीक है! ${typeHi[tripType] || 'ड्राइवर'} बुकिंग समझ आई — ${fromTo}, ${hours} घंटे। कन्फर्म करें।`,
    'hi-hinglish': `Got it! ${tripType} booking — ${fromToEn}, ${hours} hours. Confirm karo.`,
    'en-IN': `Got it! ${tripType} booking — ${fromToEn}, ${hours} hour${hours>1?'s':''}. Tap confirm to book.`,
  };
  const summary = summaries[language] || summaries[language === 'hi-IN' ? 'hi-IN' : 'en-IN'] || summaries['en-IN'];

  res.json({ tripType, hours, city, pickup, destination, date, time, language, requiresConfirmation: true, summary });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Request failed:', err.message);
  res.status(err.statusCode || 500).json({
    error: err.statusCode ? err.message : 'An unexpected server error occurred.'
  });
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
  await ensureDemoAccounts();
  app.listen(port, () => {
    console.log(`VaahanSathi server listening on port ${port}...`);
    console.log(`VaahanSathi is active [Mode: ${databaseReady ? 'Neon PostgreSQL' : 'Local Storage'}]`);
  });
}
start().catch((err) => { console.error('Fatal startup error:', err); process.exitCode = 1; });
