import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomInt, createHmac, createHash, timingSafeEqual, createPublicKey, verify as verifySignature } from 'node:crypto';
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

const DEFAULT_PRICING = Object.freeze({
  version: 2, hourly: 499, package4h: 499, package8h: 899, package12h: 1299,
  extraKm: 12, extraHour: 100, outstationPerKm: 18, night: 200, airport: 599,
  commission: 20, gst: 5, suvMultiplier: 1.15, luxuryMultiplier: 1.25
});
function normalizePricing(pricing = {}) {
  if (Number(pricing.version) === 2) return { ...DEFAULT_PRICING, ...pricing };
  return {
    ...DEFAULT_PRICING,
    commission: Number.isFinite(Number(pricing.commission)) ? Number(pricing.commission) : DEFAULT_PRICING.commission,
    gst: Number.isFinite(Number(pricing.gst)) ? Number(pricing.gst) : DEFAULT_PRICING.gst
  };
}
const blank = () => ({
  users: [], bookings: [], ratings: [], history: [], auditLogs: [],
  disputes: [], payments: [], payouts: [], pricing: { ...DEFAULT_PRICING }
});

let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch {
  data = blank();
}
data = { ...blank(), ...data };
data.pricing = normalizePricing(data.pricing);

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

const realtimeClients = new Set();

function publishRealtimeRefresh() {
  for (const client of realtimeClients) {
    if (!client.writableEnded) client.write('event: refresh\ndata: {}\n\n');
  }
}

async function save() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    publishRealtimeRefresh();
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
  data.pricing = { ...DEFAULT_PRICING };

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

    data.pricing = normalizePricing(pricingResult.rows[0]?.payload || data.pricing);
    databaseReady = true;
    databaseError = '';
    await persistPricing(data.pricing);

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
const normalizeServiceCity = (value) => {
  const city = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (['gurgaon', 'gurugram', 'gurugram city'].includes(city)) return 'gurugram';
  if (['delhi', 'new delhi', 'nct of delhi', 'delhi ncr'].includes(city)) return 'delhi';
  return city;
};

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
    available: u.role === 'driver' ? u.available === true : undefined,
    rating: averageRating || u.rating,
    trips: completedTrips,
    driverStyleTags: Array.isArray(u.driverStyleTags) ? u.driverStyleTags : ['friendly'],
    cashRewardsPoints: Number(u.cashRewardsPoints || 0),
    driverBatch: u.role === 'driver' ? (() => {
      const levels = [
        { name: 'Starter', trips: 0, rating: 0, benefits: ['Profile listed as a new partner'] },
        { name: 'Silver', trips: 15, rating: 4.3, benefits: ['Silver performance recognition', 'Eligible for quality-partner highlights'] },
        { name: 'Gold', trips: 50, rating: 4.6, benefits: ['Gold performance recognition', 'Priority consideration in suitable driver matches'] },
        { name: 'Platinum', trips: 150, rating: 4.8, benefits: ['Platinum performance recognition', 'Higher visibility in suitable driver matches'] },
        { name: 'Elite', trips: 500, rating: 4.9, benefits: ['Elite partner recognition', 'Top-tier quality profile highlight'] }
      ];
      const eligibleIndex = levels.reduce((best, level, index) =>
        completedTrips >= level.trips && averageRating >= level.rating ? index : best, 0);
      const current = levels[eligibleIndex];
      const next = levels[eligibleIndex + 1] || null;
      const progressPercent = next
        ? Math.max(0, Math.min(100, Math.round((completedTrips / next.trips) * 100)))
        : 100;
      return {
        name: current.name,
        completedTrips,
        averageRating,
        nextMilestone: next?.trips ?? null,
        ratingRequired: next?.rating ?? current.rating,
        progressPercent,
        tripsRemaining: next ? Math.max(0, next.trips - completedTrips) : 0,
        benefits: current.benefits
      };
    })() : undefined,
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

const r2Config = () => ({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET_NAME,
  endpoint: process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '')
});
const r2Ready = () => {
  const c = r2Config();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.endpoint);
};
const awsEncode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
const awsHash = (value) => createHmac('sha256', Buffer.from(value, 'utf8')).digest('hex');
const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');
function r2Presign(method, objectKey, expiresSeconds = 900) {
  const cfg = r2Config();
  const endpoint = new URL(cfg.endpoint);
  const region = 'auto';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const host = endpoint.host;
  const canonicalUri = `/${awsEncode(cfg.bucket)}/${objectKey.split('/').map(awsEncode).join('/')}`;
  const params = [
    ['X-Amz-Algorithm','AWS4-HMAC-SHA256'],
    ['X-Amz-Credential',`${cfg.accessKeyId}/${scope}`],
    ['X-Amz-Date',amzDate],
    ['X-Amz-Expires',String(expiresSeconds)],
    ['X-Amz-SignedHeaders','host']
  ].sort((a,b) => a[0].localeCompare(b[0]));
  const canonicalQuery = params.map(([k,v]) => `${awsEncode(k)}=${awsEncode(v)}`).join('&');
  const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = createHmac('sha256', 'AWS4' + cfg.secretAccessKey).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
function tripGuardFor(booking) {
  if (!booking.tripGuard) booking.tripGuard = { consents: {}, sessions: [], alerts: [] };
  if (!booking.tripGuard.consents) booking.tripGuard.consents = {};
  if (!Array.isArray(booking.tripGuard.sessions)) booking.tripGuard.sessions = [];
  if (!Array.isArray(booking.tripGuard.alerts)) booking.tripGuard.alerts = [];
  return booking.tripGuard;
}
function tripGuardParticipant(req, booking) {
  return (req.user.role === 'customer' && booking.userId === req.user.id) ||
    (req.user.role === 'driver' && booking.driverId === req.user.id);
}

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
  const pricing = normalizePricing(data.pricing);
  const h = Math.max(1, Math.min(24, Number(hours) || 1));
  const km = Number.isFinite(Number(distanceKm)) ? Math.max(0, Number(distanceKm)) : 0;
  const taxRate = Math.max(0, Number(pricing.gst) || 0) / 100;
  const toPreTax = (value) => Math.round(Number(value || 0) / (1 + taxRate));
  let packagePrice = 0;
  let includedKm = 0;

  if (tripType === 'Outstation') {
    packagePrice = 0;
  } else if (tripType === 'Airport') {
    packagePrice = Number(pricing.airport); includedKm = 40;
  } else if (tripType === 'Night driver') {
    packagePrice = Number(pricing.package8h); includedKm = 80;
  } else if (tripType === 'Full day') {
    packagePrice = Number(pricing.package12h); includedKm = 120;
  } else if (h <= 4) {
    packagePrice = Number(pricing.package4h); includedKm = 40;
  } else if (h <= 8) {
    packagePrice = Number(pricing.package8h); includedKm = 80;
  } else if (h <= 12) {
    packagePrice = Number(pricing.package12h); includedKm = 120;
  } else {
    packagePrice = Number(pricing.package12h) + (h - 12) * Number(pricing.extraHour);
    includedKm = 120 + (h - 12) * 10;
  }

  // Public package rates are GST-inclusive. Convert each displayed component to
  // its taxable amount so the customer-facing itemisation adds up exactly.
  const extraDistanceKm = tripType === 'Outstation' ? km : Math.max(0, km - includedKm);
  const ratePerKm = tripType === 'Outstation' ? Number(pricing.outstationPerKm) : Number(pricing.extraKm);
  const distanceChargeGross = Math.round(extraDistanceKm * ratePerKm);
  const hour = Number(String(time).slice(0, 2));
  const nightGross = hour >= 22 || hour < 6 || tripType === 'Night driver' ? Number(pricing.night) : 0;
  const multiplier = vehicle === 'SUV' ? Number(pricing.suvMultiplier) : vehicle === 'Luxury' ? Number(pricing.luxuryMultiplier) : 1;
  const vehicleExtraGross = Math.round(packagePrice * Math.max(0, multiplier - 1));

  const base = toPreTax(packagePrice);
  const night = toPreTax(nightGross);
  const vehicleExtra = toPreTax(vehicleExtraGross);
  const distanceCharge = toPreTax(distanceChargeGross);
  const subtotal = base + night + vehicleExtra + distanceCharge;
  const gstRate = Number(pricing.gst) || 0;
  const gst = Math.round(subtotal * taxRate);
  const total = subtotal + gst;
  const commissionRate = Math.max(0, Math.min(100, Number(pricing.commission) || 0));
  const commission = Math.round(total * commissionRate / 100);
  return {
    base, night, airport: tripType === 'Airport' ? base : 0,
    outstation: tripType === 'Outstation' ? distanceCharge : 0,
    vehicleExtra, distanceKm: distanceKm ?? null, includedKm, extraDistanceKm,
    distanceCharge, serviceFee: 0, gst, gstRate, total,
    payout: total - commission, commission, commissionRate,
    driverSharePercent: 100 - commissionRate,
    currency: 'INR', pricingVersion: 2,
    distanceSource: distanceSource || 'calculated'
  };
}

// Authenticated Server-Sent Events: notify dashboards immediately after persisted changes.
app.get('/api/events', auth, (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  realtimeClients.add(res);
  res.write('event: refresh\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 20000);

  res.on('close', () => {
    clearInterval(heartbeat);
    realtimeClients.delete(res);
  });
});

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
      videoStorageConfigured: r2Ready(),
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
    actorName: actor.name || 'Account user',
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

app.post('/api/payments/cash/collect', auth, roles('driver'), asyncRoute(async (req, res) => {
  const booking = data.bookings.find((item) => item.id === String(req.body?.bookingId || ''));
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can mark this cash fare as collected.' });
  if (booking.payment_method !== 'cash') return res.status(409).json({ error: 'This booking is not a cash booking.' });
  if (!['Trip completed', 'Rated'].includes(booking.status)) return res.status(409).json({ error: 'Cash can be marked collected only after the end-trip OTP completes the trip.' });
  if (booking.payment_status === 'Paid · Cash') return res.json({ ok: true, payment_status: booking.payment_status, alreadyCollected: true });

  const now = new Date().toISOString();
  booking.payment_status = 'Paid · Cash';
  booking.paidAt = now;
  booking.cashCollectedAt = now;
  booking.cashCollectedBy = req.user.id;
  booking.cashCollectionAmount = Number(booking.total || 0);
  booking.cashCollectionMethod = 'driver_marked_collected';
  booking.cashEvents = Array.isArray(booking.cashEvents) ? booking.cashEvents : [];
  const event = {
    id: randomUUID(), bookingId: booking.id, actorId: req.user.id,
    actorRole: req.user.role, actorName: req.user.name || 'Driver partner',
    action: 'driver_marked_cash_collected', amount: Number(booking.total || 0),
    currency: 'INR', createdAt: now
  };
  booking.cashEvents.push(event);
  data.payments.push({ ...event, provider: 'cash', status: 'collected' });

  const customer = data.users.find((u) => u.id === booking.userId);
  if (customer && !booking.cashRewardAwarded) {
    const points = Math.max(1, Math.floor(Number(booking.total || 0) / 100));
    customer.cashRewardsPoints = Number(customer.cashRewardsPoints || 0) + points;
    booking.cashRewardAwarded = true;
    booking.cashRewardPoints = points;
    await persistItem('app_users', customer.id, customer);
  }
  await persistItem('app_payments', event.id, { ...event, provider: 'cash', status: 'collected' });
  await persistItem('app_bookings', booking.id, booking);
  await save();
  res.json({ ok: true, payment_status: booking.payment_status, paidAt: booking.paidAt });
}));

// Admin-only cash ledger: amounts, confirmations, mismatches and timestamps are visible for reconciliation.
app.get('/api/admin/cash-ledger', auth, adminOnly, (req, res) => {
  const rows = data.bookings.filter((b) => b.payment_method === 'cash').map((b) => ({
    bookingId: b.id, customer: b.customer, driver: b.driver, fare: b.total,
    collected: b.payment_status === 'Paid · Cash', collectedAt: b.cashCollectedAt || b.paidAt || null,
    collectedBy: b.cashCollectedBy || null, status: b.payment_status, events: b.cashEvents || []
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
  // Neon is the production source of truth; avoid a synchronous full-file write for every GPS ping.
  if (!databaseReady) await save();
  else publishRealtimeRefresh();
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


const distanceBetweenKm = (a, b) => {
  if (!a || !b || !Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lng)) || !Number.isFinite(Number(b.lat)) || !Number.isFinite(Number(b.lng))) return null;
  const rad = (value) => Number(value) * Math.PI / 180;
  const dLat = rad(Number(b.lat) - Number(a.lat));
  const dLng = rad(Number(b.lng) - Number(a.lng));
  const lat1 = rad(Number(a.lat));
  const lat2 = rad(Number(b.lat));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Explainable SmartMatch: hard safety/availability gates, then weighted fit.
// Customer history is used only through the customer's own prior ratings of this driver.
const getSmartDriverMatch = (booking, driver, customer, requireAvailable = true) => {
  if (!driver || driver.role !== 'driver' || driver.verificationStatus !== 'verified') return null;
  if (requireAvailable && driver.available !== true) return null;
  if (normalizeServiceCity(driver.city) !== normalizeServiceCity(booking.city)) return null;
  if (requireAvailable && driverHasScheduleConflict(driver, booking)) return null;

  const driverBookings = data.bookings.filter((item) => item.driverId === driver.id && item.id !== booking.id);
  const completed = driverBookings.filter((item) => ['Trip completed', 'Rated'].includes(item.status));
  const cancelled = driverBookings.filter((item) => item.status === 'Cancelled');
  const resolvedCount = completed.length + cancelled.length;
  const reliability = resolvedCount >= 3
    ? Math.round((completed.length / resolvedCount) * 100)
    : 78;
  const ratings = data.ratings.filter((item) => item.driverId === driver.id);
  const averageRating = ratings.length
    ? ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / ratings.length
    : Number(driver.rating || 4.2);
  const ratingScore = Math.max(0, Math.min(100, averageRating * 20));

  const styleTags = Array.isArray(driver.driverStyleTags) ? driver.driverStyleTags : ['friendly'];
  const requestedStyle = booking.requestedDriverStyle || 'any';
  const styleMatch = requestedStyle === 'any' ? 76 : styleTags.includes(requestedStyle) ? 100 : 35;

  const pickup = Array.isArray(booking.pickupCoordinates)
    ? { lat: booking.pickupCoordinates[0], lng: booking.pickupCoordinates[1] }
    : null;
  const lastPositionBooking = data.bookings
    .filter((item) => item.driverId === driver.id && item.driverLocation?.updatedAt)
    .sort((a, b) => String(b.driverLocation.updatedAt).localeCompare(String(a.driverLocation.updatedAt)))[0];
  const driverPosition = lastPositionBooking?.driverLocation || driver.lastLocation || null;
  const distanceKm = distanceBetweenKm(pickup, driverPosition);
  const proximityScore = distanceKm === null ? 60
    : distanceKm <= 2 ? 100
    : distanceKm <= 5 ? 90
    : distanceKm <= 10 ? 78
    : distanceKm <= 20 ? 62 : 40;

  const priorTrips = data.bookings.filter((item) => item.userId === customer?.id && item.driverId === driver.id && item.id !== booking.id);
  const priorRatings = data.ratings.filter((item) => item.userId === customer?.id && item.driverId === driver.id);
  const latestPriorRating = priorRatings.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
  const repeatScore = latestPriorRating
    ? Number(latestPriorRating.stars) >= 4 ? 100
      : Number(latestPriorRating.stars) <= 2 ? 20 : 55
    : priorTrips.length ? 65 : 65;

  const experienceScore = Math.min(100, 45 + completed.length / 5);
  const score = Math.round(
    styleMatch * 0.20 +
    ratingScore * 0.20 +
    reliability * 0.25 +
    proximityScore * 0.15 +
    repeatScore * 0.10 +
    experienceScore * 0.10
  );

  const reasons = [];
  if (requestedStyle !== 'any' && styleTags.includes(requestedStyle)) reasons.push('Matches your communication preference');
  if (averageRating >= 4.7 && ratings.length >= 3) reasons.push('Consistently high customer ratings');
  if (resolvedCount >= 3 && reliability >= 90) reasons.push('Strong trip completion record');
  if (distanceKm !== null && distanceKm <= 10) reasons.push('Currently near your pickup');
  if (latestPriorRating && Number(latestPriorRating.stars) >= 4) reasons.push('You rated this driver highly before');
  if (completed.length >= 50) reasons.push('Experienced driver partner');
  if (!reasons.length) reasons.push('Verified and eligible for your service area');

  return {
    score,
    tier: score >= 90 ? 'Excellent fit' : score >= 80 ? 'Great fit' : score >= 70 ? 'Good fit' : 'Available match',
    reasons: reasons.slice(0, 3),
    distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(1))
  };
};

function bookingWindow(booking) {
  const start = Number.isFinite(Date.parse(booking?.scheduledStartAt || ''))
    ? Date.parse(booking.scheduledStartAt)
    : Date.parse(`${booking?.date || ''}T${booking?.time || '10:00'}:00+05:30`);
  if (!Number.isFinite(start)) return null;
  const safeStart = ['Driver arriving', 'Trip started'].includes(booking?.status) ? Date.now() : start;
  const hours = Math.max(1, Math.min(24, Number(booking?.hours) || 1));
  return { start: safeStart, end: safeStart + hours * 60 * 60 * 1000 + 30 * 60 * 1000 };
}
function dispatchPriorityFor(booking) {
  const window = bookingWindow(booking);
  const minutesUntil = window ? (window.start - Date.now()) / 60000 : 24 * 60;
  const longTrip = booking?.trip_type === 'Outstation' || Number(booking?.distanceKm || 0) >= 40;
  const immediate = booking?.bookingMode === 'immediate' || minutesUntil <= 90;
  const bucket = immediate ? (longTrip ? 'immediate_long' : 'immediate') : (longTrip ? 'scheduled_long' : 'scheduled');
  const score = bucket === 'immediate_long' ? 4000 : bucket === 'immediate' ? 3500 : bucket === 'scheduled_long' ? 2500 : 2000;
  return { bucket, score, label: bucket === 'immediate_long' ? 'Urgent long trip' : bucket === 'immediate' ? 'Immediate pickup' : bucket === 'scheduled_long' ? 'Scheduled long trip' : 'Scheduled pickup', minutesUntilPickup: Math.round(minutesUntil) };
}
function driverHasScheduleConflict(driver, booking) {
  const target = bookingWindow(booking);
  if (!target) return false;
  return data.bookings.some((other) => {
    if (other.id === booking.id || other.driverId !== driver.id) return false;
    if (!['Driver assigned', 'Driver arriving', 'Trip started'].includes(other.status)) return false;
    const assigned = bookingWindow(other);
    return !!assigned && target.start < assigned.end && assigned.start < target.end;
  });
}
const getRankedSmartMatches = (booking, customer) => data.users
  .filter((driver) => driver.role === 'driver')
  .map((driver) => ({ driver, match: getSmartDriverMatch(booking, driver, customer, true), dispatch: dispatchPriorityFor(booking) }))
  .filter((entry) => entry.match && !driverHasScheduleConflict(entry.driver, booking))
  .sort((a, b) => b.dispatch.score - a.dispatch.score || b.match.score - a.match.score || Number(b.driver.rating || 0) - Number(a.driver.rating || 0));

app.get('/api/bookings', auth, (req, res) => {
  let rows = [...data.bookings];
  const currentUser = data.users.find((u) => u.id === req.user.id);

  if (req.user.role === 'customer') {
    rows = rows.filter((b) => b.userId === req.user.id);
  } else if (req.user.role === 'driver') {
    rows = rows.filter(
      (b) => b.driverId === req.user.id || (
        b.status === 'Searching' &&
        normalizeServiceCity(b.city) === normalizeServiceCity(currentUser?.city)
      )
    );
  }

  const enriched = rows.map((b) => {
    const driverUser = data.users.find((u) => u.id === b.driverId);
    const customerUser = data.users.find((u) => u.id === b.userId);
    const { cashPin, cashPinEncrypted, cashPinHash, cashPinAttempts, cashCustomerAmount, cashDriverAmount, ...safeBooking } = b;
    return {
      ...safeBooking,
      // Legacy cash PIN values are never exposed. Start/end trip OTPs remain stage-gated.
      start_otp: req.user.role === 'customer' && b.userId === req.user.id && b.status === 'Driver arriving' && b.carCarePassport?.videoKey && b.carCarePassport?.customerConfirmedAt && b.carCarePassport?.driverConfirmedAt ? b.start_otp : undefined,
      end_otp: req.user.role === 'customer' && b.userId === req.user.id && b.status === 'Trip started' ? b.end_otp : undefined,
      cashEvents: req.user.role === 'admin' ? (b.cashEvents || []) : undefined,
      driver: driverUser ? driverUser.name : b.driver || null,
      customer: customerUser ? customerUser.name : b.customer || null,
      ...(req.user.role === 'driver' ? (() => {
        const adjustment = data.payouts
          .filter((item) => item.driverId === req.user.id && item.bookingId === b.id && item.type === 'complaint_adjustment' && item.status === 'approved')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        return adjustment > 0 ? {
          grossPayout: Number(b.payout || 0),
          earningsAdjustment: adjustment,
          payout: Math.max(0, Number(b.payout || 0) - adjustment)
        } : {};
      })() : {}),
      ...(req.user.role === 'driver' && b.status === 'Searching' ? (() => {
        const ranked = getRankedSmartMatches(b, customerUser);
        const rank = ranked.findIndex((entry) => entry.driver.id === req.user.id);
        const match = rank >= 0 ? ranked[rank].match : null;
        return { smartMatch: match ? { ...match, rank: rank + 1, poolSize: ranked.length } : null, dispatchPriority: rank >= 0 ? ranked[rank].dispatch : dispatchPriorityFor(b) };
      })() : {}),
      ...(req.user.role === 'customer' && driverUser ? (() => {
        const match = getSmartDriverMatch(b, driverUser, customerUser, false);
        return { driverMatch: match ? { score: match.score, tier: match.tier, reasons: match.reasons } : null };
      })() : {})
    };
  });

  const sorted = enriched.sort((a, b) => {
    if (req.user.role === 'driver' && a.status === 'Searching' && b.status === 'Searching') {
      return Number(b.dispatchPriority?.score || 0) - Number(a.dispatchPriority?.score || 0)
        || Number(b.smartMatch?.score || 0) - Number(a.smartMatch?.score || 0)
        || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  res.json({ bookings: sorted });
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

    // Create every customer request as an open dispatch offer. Explicit immediate and scheduled
    // modes are retained so the driver queue can prioritize urgent work without losing reservations.
    const requestedMode = String(req.body?.bookingMode || 'auto');
    if (!['auto', 'immediate', 'scheduled'].includes(requestedMode)) return res.status(400).json({ error: 'Choose immediate or scheduled booking.' });
    const localStart = Date.parse(`${date}T${time}:00+05:30`);
    if (!Number.isFinite(localStart)) return res.status(400).json({ error: 'Enter a valid booking date and time.' });
    const bookingMode = requestedMode === 'auto'
      ? (localStart <= Date.now() + 90 * 60 * 1000 ? 'immediate' : 'scheduled')
      : requestedMode;
    if (bookingMode === 'scheduled' && localStart < Date.now() + 30 * 60 * 1000) {
      return res.status(400).json({ error: 'Scheduled bookings must be at least 30 minutes ahead. Choose immediate booking for an urgent pickup.' });
    }
    if (bookingMode === 'immediate' && (localStart < Date.now() - 10 * 60 * 1000 || localStart > Date.now() + 90 * 60 * 1000)) {
      return res.status(400).json({ error: 'Immediate pickup must be scheduled within the next 90 minutes. Choose scheduled pickup for a later time.' });
    }
    const bookingId = `VS-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
    const b = {
      id: bookingId,
      userId: req.user.id,
      customer: customerUser?.name || 'Customer',
      driverId: null,
      driver: null,
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
      bookingMode,
      scheduledStartAt: new Date(localStart).toISOString(),
      status: 'Searching',
      // Codes are issued just-in-time: start after customer handover approval,
      // end only after the driver has successfully verified the start code.
      start_otp: null,
      startOtpGeneratedAt: null,
      startOtpVerifiedAt: null,
      end_otp: null,
      endOtpGeneratedAt: null,
      createdAt: new Date().toISOString()
    };

    data.bookings.push(b);
    const historyItem = { id: randomUUID(), booking_id: b.id, status: b.status, at: b.createdAt };
    data.history.unshift(historyItem);

    await persistItem('app_bookings', b.id, b);
    await persistItem('app_history', historyItem.id, historyItem);
    await save();

    const customerBooking = {
      ...b,
      start_otp: undefined,
      end_otp: undefined,
    };
    res.status(201).json({
      booking: customerBooking,
      message: 'Your request is now available to verified, online drivers in your city. A driver must accept it before assignment.'
    });
  })
);



app.get('/api/bookings/:id/tripguard/state', auth, (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'TripGuard session not found.' });
  res.json({ bookingStatus: b.status, tripGuard: tripGuardFor(b) });
});

app.post('/api/bookings/:id/tripguard/consent', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (!tripGuardParticipant(req, b)) return res.status(403).json({ error: 'Only this trip’s customer and assigned driver can manage TripGuard consent.' });
  if (!['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status)) return res.status(409).json({ error: 'TripGuard consent is available only for an active booking.' });
  const consent = req.body?.consent === true;
  const guard = tripGuardFor(b);
  const role = req.user.role;
  guard.consents[role] = { consent, at: new Date().toISOString(), userId: req.user.id };
  if (!consent) {
    for (const session of guard.sessions) {
      if (session.status === 'recording') {
        session.status = 'stopped';
        session.stoppedAt = new Date().toISOString();
        session.stopReason = 'A participant withdrew consent';
      }
    }
  }
  await persistItem('app_bookings', b.id, b); await save();
  res.json({ success: true, tripGuard: guard });
}));

app.post('/api/bookings/:id/tripguard/alerts', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role !== 'customer' || b.userId !== req.user.id) return res.status(403).json({ error: 'Only the customer can raise a customer safety alert.' });
  if (b.status !== 'Trip started') return res.status(409).json({ error: 'Safety alerts can be attached once the trip has started.' });
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  const category = String(req.body?.category || 'Safety concern').slice(0, 80);
  if (!note && !category) return res.status(400).json({ error: 'Add a short description of your concern.' });
  const guard = tripGuardFor(b);
  const alert = { id: randomUUID(), category, note, createdAt: new Date().toISOString(), userId: req.user.id, status: 'recorded' };
  guard.alerts.unshift(alert);
  await persistItem('app_bookings', b.id, b); await save();
  res.status(201).json({ success: true, alert, message: 'Your safety concern has been attached to this trip.' });
}));

app.post('/api/bookings/:id/tripguard/recordings/start', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role !== 'customer' || b.userId !== req.user.id) return res.status(403).json({ error: 'The customer controls the trip recording.' });
  if (b.status !== 'Trip started') return res.status(409).json({ error: 'Recording can start only after the start OTP has been verified.' });
  const guard = tripGuardFor(b);
  if (guard.consents.customer?.consent !== true || guard.consents.driver?.consent !== true) return res.status(409).json({ error: 'Both the customer and assigned driver must explicitly consent before recording.' });
  if (!r2Ready()) return res.status(503).json({ error: 'Private video storage is not configured yet. Ask the VaahanSathi administrator to finish the Cloudflare R2 setup.' });
  if (guard.sessions.some((session) => session.status === 'recording')) return res.status(409).json({ error: 'A TripGuard recording is already active for this trip.' });
  const mimeType = String(req.body?.mimeType || 'video/webm').split(';')[0];
  if (!['video/webm', 'video/mp4'].includes(mimeType)) return res.status(400).json({ error: 'This browser video format is not supported for secure storage.' });
  const session = { id: randomUUID(), status: 'recording', startedAt: new Date().toISOString(), startedBy: req.user.id, mimeType, chunks: [], durationSeconds: 0 };
  guard.sessions.unshift(session);
  await persistItem('app_bookings', b.id, b); await save();
  res.status(201).json({ session });
}));

app.post('/api/bookings/:id/tripguard/recordings/:recordingId/chunk-url', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'Trip recording not found.' });
  const guard = tripGuardFor(b);
  const session = guard.sessions.find((item) => item.id === req.params.recordingId);
  if (!session || session.status !== 'recording' || b.status !== 'Trip started') return res.status(409).json({ error: 'This recording is no longer active.' });
  if (!r2Ready()) return res.status(503).json({ error: 'Private video storage is not configured.' });
  const index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0 || index > 20000) return res.status(400).json({ error: 'Invalid video segment number.' });
  const mimeType = String(req.body?.mimeType || session.mimeType || 'video/webm').split(';')[0];
  if (mimeType !== session.mimeType) return res.status(400).json({ error: 'Video segment format does not match this recording.' });
  const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
  const key = `tripguard/${b.id}/${session.id}/${String(index).padStart(6,'0')}.${extension}`;
  res.json({ uploadUrl: r2Presign('PUT', key, 900), key, expiresIn: 900 });
}));

app.post('/api/bookings/:id/tripguard/recordings/:recordingId/chunk-saved', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'Trip recording not found.' });
  const guard = tripGuardFor(b);
  const session = guard.sessions.find((item) => item.id === req.params.recordingId);
  if (!session || session.status !== 'recording' || b.status !== 'Trip started') return res.status(409).json({ error: 'This recording is no longer active.' });
  const index = Number(req.body?.index);
  const key = String(req.body?.key || '');
  const expectedPrefix = `tripguard/${b.id}/${session.id}/`;
  const extension = session.mimeType === 'video/mp4' ? '.mp4' : '.webm';
  if (!Number.isInteger(index) || index < 0 || !key.startsWith(expectedPrefix) || !key.endsWith(extension)) return res.status(400).json({ error: 'Invalid uploaded segment.' });
  if (!session.chunks.some((chunk) => chunk.index === index)) session.chunks.push({ index, key, bytes: Math.max(0, Number(req.body?.bytes || 0)), uploadedAt: new Date().toISOString() });
  session.chunks.sort((a, z) => a.index - z.index);
  await persistItem('app_bookings', b.id, b); await save();
  res.json({ success: true, saved: session.chunks.length });
}));

app.post('/api/bookings/:id/tripguard/recordings/:recordingId/stop', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'Trip recording not found.' });
  const guard = tripGuardFor(b);
  const session = guard.sessions.find((item) => item.id === req.params.recordingId);
  if (!session) return res.status(404).json({ error: 'Trip recording not found.' });
  if (session.status === 'recording') {
    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();
    session.durationSeconds = Math.max(0, Math.round((Date.parse(session.stoppedAt) - Date.parse(session.startedAt)) / 1000));
    session.stopReason = String(req.body?.reason || 'Customer stopped recording').slice(0, 120);
  }
  await persistItem('app_bookings', b.id, b); await save();
  res.json({ success: true, session });
}));

app.get('/api/bookings/:id/tripguard/recordings/:recordingId/access', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'Trip recording not found.' });
  const session = tripGuardFor(b).sessions.find((item) => item.id === req.params.recordingId);
  if (!session) return res.status(404).json({ error: 'Trip recording not found.' });
  if (!r2Ready()) return res.status(503).json({ error: 'Private video storage is not configured.' });
  const chunks = session.chunks.map((chunk) => ({ index: chunk.index, url: r2Presign('GET', chunk.key, 300) }));
  res.json({ session: { id: session.id, status: session.status, mimeType: session.mimeType || 'video/webm', startedAt: session.startedAt, stoppedAt: session.stoppedAt, durationSeconds: session.durationSeconds }, chunks });
}));

app.post('/api/bookings/:id/car-care-passport/video-upload-url', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || req.user.role !== 'driver' || b.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can upload the vehicle walkaround video.' });
  if (b.status !== 'Driver arriving') return res.status(409).json({ error: 'The vehicle video can only be uploaded at pickup before the trip starts.' });
  if (!r2Ready()) return res.status(503).json({ error: 'Secure video storage is not configured yet. Please contact support; do not start the trip without the customer’s approval.' });
  const mimeType = String(req.body?.mimeType || '');
  const extensions = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  if (!extensions[mimeType]) return res.status(400).json({ error: 'Please select an MP4, WebM or iPhone video file.' });
  const key = `carcare/${b.id}/${randomUUID()}.${extensions[mimeType]}`;
  res.json({ uploadUrl: r2Presign('PUT', key, 600), videoKey: key });
}));

app.get('/api/bookings/:id/car-care-passport/video-url', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b || !tripGuardParticipant(req, b)) return res.status(404).json({ error: 'Vehicle handover video not found.' });
  const passport = b.carCarePassport;
  if (!passport?.videoKey || !passport?.driverConfirmedAt || !r2Ready()) return res.status(404).json({ error: 'The driver has not uploaded a vehicle video yet.' });
  res.json({ videoUrl: r2Presign('GET', passport.videoKey, 600), mimeType: passport.videoMimeType || 'video/mp4' });
}));

app.post('/api/bookings/:id/car-care-passport', auth, asyncRoute(async (req, res) => {
  const b = data.bookings.find((item) => item.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.status !== 'Driver arriving') return res.status(409).json({ error: 'Vehicle handover verification is available only at pickup before the trip starts.' });
  const passport = b.carCarePassport || {};
  if (req.user.role === 'driver') {
    if (b.driverId !== req.user.id) return res.status(403).json({ error: 'Only the assigned driver can upload this vehicle video.' });
    const videoKey = String(req.body?.videoKey || '');
    const mimeType = String(req.body?.mimeType || '');
    const sizeBytes = Number(req.body?.sizeBytes || 0);
    if (!r2Ready()) return res.status(503).json({ error: 'Secure video storage is not configured.' });
    if (!videoKey.startsWith(`carcare/${b.id}/`) || !/\.(mp4|webm|mov)$/.test(videoKey) || !['video/mp4','video/webm','video/quicktime'].includes(mimeType) || !Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'The uploaded handover video is invalid or exceeds 100 MB.' });
    }
    b.carCarePassport = { ...passport, videoKey, videoMimeType: mimeType, videoSizeBytes: sizeBytes, videoUploadedAt: new Date().toISOString(), driverConfirmedAt: new Date().toISOString(), customerConfirmedAt: null };
  } else if (req.user.role === 'customer') {
    if (b.userId !== req.user.id) return res.status(403).json({ error: 'Only the car owner can verify this vehicle video.' });
    if (!passport.videoKey || !passport.driverConfirmedAt) return res.status(409).json({ error: 'Wait for the assigned driver to upload the vehicle walkaround video.' });
    if (req.body?.confirm !== true) return res.status(400).json({ error: 'Review the driver’s video and confirm it to continue.' });
    const storedVideo = await fetch(r2Presign('HEAD', passport.videoKey, 60));
    if (!storedVideo.ok) return res.status(409).json({ error: 'The vehicle video is not available in secure storage yet. Ask the driver to upload it again.' });
    const approvedAt = new Date().toISOString();
    // Issue the start code at the moment the customer approves the uploaded video.
    // The generatedAt marker makes retries idempotent and repairs legacy bookings
    // that were created before just-in-time OTP issuance.
    if (!passport.customerConfirmedAt || !b.startOtpGeneratedAt || !b.start_otp) {
      b.start_otp = String(randomInt(1000, 9999));
      b.startOtpGeneratedAt = approvedAt;
      b.startOtpVerifiedAt = null;
    }
    b.end_otp = null;
    b.endOtpGeneratedAt = null;
    b.carCarePassport = { ...passport, customerConfirmedAt: passport.customerConfirmedAt || approvedAt };
  } else {
    return res.status(403).json({ error: 'Only the customer and assigned driver can complete this handover.' });
  }
  await persistItem('app_bookings', b.id, b);
  await save();
  res.json({ success: true, carCarePassport: b.carCarePassport });
}));

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
        if (currentUser?.verificationStatus !== 'verified' || currentUser?.available !== true || normalizeServiceCity(currentUser?.city) !== normalizeServiceCity(b.city)) {
          return res.status(403).json({ error: 'Your driver account must be verified and on duty to accept rides.' });
        }
        if (driverHasScheduleConflict(currentUser, b)) {
          return res.status(409).json({ error: 'This pickup overlaps another trip you have already accepted. Please accept another request instead.' });
        }
        // Communication style is a customer preference shown on the offer, not a hard
        // dispatch gate. Do not strand a customer if no exact-style driver is online.
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
      if (!b.carCarePassport?.videoKey || !b.carCarePassport?.customerConfirmedAt || !b.carCarePassport?.driverConfirmedAt) {
        return res.status(409).json({ error: 'Wait until the driver’s vehicle video has been uploaded and approved by the customer before starting the trip.' });
      }
      if (!b.start_otp || !b.startOtpGeneratedAt || String(otp || '').trim() !== String(b.start_otp)) {
        return res.status(400).json({ error: 'Start OTP is invalid or has not been issued yet. Ask the customer to approve the vehicle video and show the latest 4-digit code.' });
      }
      // Consume the start code exactly once and issue the end code only after
      // the server accepts the start transition.
      b.startOtpVerifiedAt = new Date().toISOString();
      b.start_otp = null;
      b.end_otp = String(randomInt(1000, 9999));
      b.endOtpGeneratedAt = new Date().toISOString();
    }
    if (req.user.role === 'driver' && status === 'Trip completed') {
      if (!b.end_otp || !b.endOtpGeneratedAt || String(otp || '').trim() !== String(b.end_otp)) {
        return res.status(400).json({ error: 'End OTP is invalid or has not been issued yet. Ask the customer for the current 4-digit end code.' });
      }
      b.endOtpVerifiedAt = new Date().toISOString();
      b.end_otp = null;
      b.payment_status = b.payment_method === 'cash' ? 'Cash due after trip' : 'Payment due';
    }

    const effectiveStatus = status;
    b.status = effectiveStatus;
    if (effectiveStatus !== 'Trip started' && b.tripGuard?.sessions) {
      for (const session of b.tripGuard.sessions) if (session.status === 'recording') {
        session.status = 'stopped'; session.stoppedAt = new Date().toISOString(); session.stopReason = 'Trip ended or was cancelled';
      }
    }
    const historyItem = { id: randomUUID(), booking_id: b.id, status: effectiveStatus, at: new Date().toISOString() };
    data.history.unshift(historyItem);

    await persistItem('app_bookings', b.id, b);
    await persistItem('app_history', historyItem.id, historyItem);
    await save();

    // Never echo OTPs or private payment credentials back to the driver/admin action caller.
    res.json({ booking: { id: b.id, status: b.status, payment_status: b.payment_status, updatedAt: new Date().toISOString() } });
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
      whatWorked: Array.isArray(req.body.whatWorked) ? req.body.whatWorked.map((item) => String(item).slice(0, 80)).slice(0, 10) : [],
      improvement: String(req.body.improvement || '').slice(0, 100),
      safety: String(req.body.safety || '').slice(0, 40),
      punctuality: String(req.body.punctuality || '').slice(0, 60),
      communication: String(req.body.communication || '').slice(0, 60),
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
  const mine = data.bookings.filter((b) => b.driverId === driverId && ['Trip completed', 'Rated'].includes(b.status));
  const approvedAdjustments = data.payouts.filter((item) => item.driverId === driverId && item.type === 'complaint_adjustment' && item.status === 'approved');
  const adjustmentTotal = approvedAdjustments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const grossEarnings = mine.reduce((sum, booking) => sum + Number(booking.payout || 0), 0);
  const myRatings = data.ratings.filter((r) => r.driverId === driverId);
  const avgRating = myRatings.length
    ? Number((myRatings.reduce((s, r) => s + r.stars, 0) / myRatings.length).toFixed(1))
    : 4.9;

  res.json({
    summary: {
      trips: mine.length,
      earnings: Math.max(0, grossEarnings - adjustmentTotal),
      grossEarnings,
      approvedAdjustments: adjustmentTotal,
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
    const allowed = ['package4h', 'package8h', 'package12h', 'extraKm', 'extraHour', 'outstationPerKm', 'night', 'airport', 'commission', 'gst', 'suvMultiplier', 'luxuryMultiplier'];
    for (const key of allowed) {
      if (req.body[key] !== undefined && Number.isFinite(Number(req.body[key])) && Number(req.body[key]) >= 0) data.pricing[key] = Number(req.body[key]);
    }
    if (req.body.hourly !== undefined && Number.isFinite(Number(req.body.hourly)) && Number(req.body.hourly) >= 0) data.pricing.package4h = Number(req.body.hourly);
    data.pricing.hourly = data.pricing.package4h;
    data.pricing.version = 2;
    data.pricing = normalizePricing(data.pricing);
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
  const booking = bookingId ? data.bookings.find((b) => b.id === String(bookingId)) : null;
  if (bookingId && !booking) return res.status(404).json({ error: 'The selected booking could not be found.' });
  if (booking && req.user.role === 'customer' && booking.userId !== req.user.id) return res.status(403).json({ error: 'You can only report a problem on your own booking.' });
  const isExtraMoneyReport = String(subject).toLowerCase().includes('extra money') || String(subject).toLowerCase().includes('extra fare');
  const reportedExtraAmount = req.body?.reportedExtraAmount === undefined || req.body?.reportedExtraAmount === '' ? null : Number(req.body.reportedExtraAmount);
  if (reportedExtraAmount !== null && (!Number.isSafeInteger(reportedExtraAmount) || reportedExtraAmount < 0 || reportedExtraAmount > 1000000)) return res.status(400).json({ error: 'Enter a valid extra amount in whole rupees.' });
  const dispute = {
    id: randomUUID(), bookingId: bookingId || null, userId: req.user.id, userName: req.user.name,
    driverId: booking?.driverId || null, driverName: booking?.driver || null,
    subject: String(subject).slice(0, 120), description: String(description).slice(0, 1000),
    reportedExtraAmount: isExtraMoneyReport ? reportedExtraAmount : null,
    status: 'under_review', createdAt: new Date().toISOString(),
    route: booking ? `${booking.pickup} → ${booking.destination}` : null,
    responseHistory: []
  };
  data.disputes.push(dispute);
  await persistItem('app_disputes', dispute.id, dispute);
  await audit(req, 'customer_complaint_filed', 'disputes', dispute.id, null, { bookingId: dispute.bookingId, driverId: dispute.driverId, subject: dispute.subject }, 'Customer complaint submitted for review');
  await save();
  res.status(201).json({ dispute });
}));

app.get('/api/driver/complaints', auth, roles('driver'), (req, res) => {
  const complaints = data.disputes.filter((item) => item.driverId === req.user.id)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const adjustments = data.payouts.filter((item) => item.driverId === req.user.id && item.type === 'complaint_adjustment' && item.status === 'approved');
  res.json({ complaints, adjustments });
});

app.patch('/api/driver/complaints/:id', auth, roles('driver'), asyncRoute(async (req, res) => {
  const complaint = data.disputes.find((item) => item.id === req.params.id && item.driverId === req.user.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found for your driver account.' });
  if (['resolved', 'closed', 'unsubstantiated'].includes(complaint.status)) return res.status(409).json({ error: 'This complaint is closed. Contact support to request a review.' });
  const response = String(req.body?.response || '').trim().slice(0, 1000);
  if (response.length < 5) return res.status(400).json({ error: 'Please enter at least 5 characters so the review team can understand your response.' });
  const now = new Date().toISOString();
  complaint.driverResponse = response; complaint.driverRespondedAt = now; complaint.status = 'driver_response_submitted';
  complaint.responseHistory = Array.isArray(complaint.responseHistory) ? complaint.responseHistory : [];
  complaint.responseHistory.push({ actorId: req.user.id, actorRole: 'driver', response, createdAt: now });
  await persistItem('app_disputes', complaint.id, complaint);
  await audit(req, 'driver_complaint_response', 'disputes', complaint.id, null, { status: complaint.status }, 'Driver submitted a response');
  await save();
  res.json({ complaint });
}));

app.patch('/api/admin/disputes/:id', auth, adminOnly, asyncRoute(async (req, res) => {
  const d = data.disputes.find((x) => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Dispute not found.' });
  const allowedStatuses = ['under_review', 'driver_response_submitted', 'substantiated', 'unsubstantiated', 'resolved', 'closed', 'escalated'];
  const nextStatus = allowedStatuses.includes(req.body.status) ? req.body.status : d.status;
  const resolution = String(req.body.resolution || '').trim().slice(0, 500);
  const penaltyAmount = req.body.penaltyAmount === undefined || req.body.penaltyAmount === '' ? 0 : Number(req.body.penaltyAmount);
  if (!Number.isSafeInteger(penaltyAmount) || penaltyAmount < 0 || penaltyAmount > 1000000) return res.status(400).json({ error: 'Enter a valid penalty amount in whole rupees.' });
  if (penaltyAmount > 0 && nextStatus !== 'substantiated') return res.status(409).json({ error: 'A driver earnings adjustment is allowed only after the complaint is marked substantiated.' });
  d.status = nextStatus;
  if (resolution) d.resolution = resolution;
  if (['resolved', 'closed', 'unsubstantiated'].includes(nextStatus)) { d.resolvedAt = new Date().toISOString(); d.resolvedBy = req.user.name; }
  if (penaltyAmount > 0 && !d.earningsAdjustmentId) {
    if (!d.driverId) return res.status(409).json({ error: 'No assigned driver is linked to this complaint.' });
    const linkedBooking = data.bookings.find((b) => b.id === d.bookingId);
    const maxAdjustment = Math.max(0, Number(linkedBooking?.payout || 0));
    if (penaltyAmount > maxAdjustment) return res.status(400).json({ error: 'Adjustment cannot exceed the driver payout for this booking.' });
    const adjustment = {
      id: randomUUID(), type: 'complaint_adjustment', provider: 'internal_ledger',
      bookingId: d.bookingId, disputeId: d.id, driverId: d.driverId, amount: penaltyAmount,
      currency: 'INR', status: 'approved',
      description: 'Admin-approved adjustment after complaint investigation',
      createdAt: new Date().toISOString(), createdBy: req.user.id
    };
    data.payouts.push(adjustment); d.earningsAdjustmentId = adjustment.id; d.earningsAdjustmentAmount = penaltyAmount;
    await persistItem('app_payouts', adjustment.id, adjustment);
  }
  await persistItem('app_disputes', d.id, d);
  await audit(req, 'dispute_updated', 'disputes', d.id, null, { status: d.status, penaltyAmount: d.earningsAdjustmentAmount || 0 }, resolution || 'Dispute updated');
  await save();
  res.json({ dispute: d });
}));

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

// Expanded locality gazetteer. This intentionally covers neighbourhoods, colonies,
// villages, sectors, industrial areas, metro hubs and commonly spoken variants.
// Unknown user-spoken place names are still preserved as free-form locations below.
const VOICE_EXTRA_AREAS = {
  Delhi: [
    'Adarsh Nagar','Ashok Vihar','Azadpur','Bawana','Begumpur','Burari','Chhatarpur','Chirag Delhi','Civil Lines','Daryaganj','Defence Colony','Delhi Cantt','Derawal Nagar','Dhaula Kuan','Dilshad Colony','East of Kailash','Gandhi Nagar','Govindpuri','Green Park','Hari Nagar','Hastsal','Jaitpur','Jangpura','Jasola Vihar','Jharoda Majra','Kalkaji','Kapashera','Keshav Puram','Kirti Nagar','Kondli','Kotla Mubarakpur','Krishna Nagar','Madangir','Mahipalpur','Malviya Nagar','Mangolpuri','Model Town','Mohan Garden','Moti Nagar','Mukherjee Nagar','Munirka','Najafgarh','Nangloi','Narela','Nirman Vihar','Okhla','Palam','Pandav Nagar','Paschim Vihar','Patel Nagar','Punjabi Bagh','Pushp Vihar','R K Puram','Raja Garden','Rani Bagh','Rithala','Sadar Bazar','Sainik Farm','Sangam Vihar','Sarita Vihar','Shalimar Bagh','Shastri Nagar','Shastri Park','Shivaji Park','Sonia Vihar','Subhash Nagar','Tagore Garden','Tilak Nagar','Timarpur','Tri Nagar','Uttam Nagar','Vikas Puri','Vikaspuri','Vishwas Nagar','Wazirabad','Yamuna Vihar','Zakir Nagar','Zakir Bagh',
    'Alaknanda','Amar Colony','Anand Parbat','Anand Niketan','Arjun Nagar','Brij Puri','Chander Nagar','Chawri Bazar','Dakshinpuri','Devli','East Patel Nagar','Fateh Nagar','Gagan Vihar','Gokalpuri','Govindpuri Extension','Jagatpuri','Jheel Khurenja','Johripur','Kailash Colony','Kalyan Vihar','Kanjhawala','Karkardooma Extension','Khajuri Khas','Khirki Extension','Lado Sarai','Lal Kuan','Lodhi Colony','Loni Road','Madanpur Khadar','Maujpur','Maya Enclave','Mehrauli','Mithapur','Nehru Nagar','New Ashok Nagar','New Friends Colony','Nizamuddin','Panchsheel Park','Pul Prahladpur','Qutub Vihar','Raghu Nagar','Raj Nagar','Ramesh Nagar','Rana Pratap Bagh','Sadh Nagar','Sarai Rohilla','Shahpur Jat','Shakti Nagar','Sultanpuri','Tughlakabad','Vijay Nagar','West Patel Nagar',
    'Dwarka Sector 1','Dwarka Sector 2','Dwarka Sector 3','Dwarka Sector 4','Dwarka Sector 5','Dwarka Sector 6','Dwarka Sector 7','Dwarka Sector 8','Dwarka Sector 9','Dwarka Sector 10','Dwarka Sector 11','Dwarka Sector 12','Dwarka Sector 13','Dwarka Sector 14','Dwarka Sector 15','Dwarka Sector 16','Dwarka Sector 17','Dwarka Sector 18','Dwarka Sector 19','Dwarka Sector 20','Dwarka Sector 21','Dwarka Sector 22','Dwarka Sector 23','Dwarka Sector 24','Dwarka Sector 25','Dwarka Sector 26','Dwarka Sector 27','Dwarka Sector 28','Dwarka Sector 29',
    'Rohini Sector 1','Rohini Sector 2','Rohini Sector 3','Rohini Sector 4','Rohini Sector 5','Rohini Sector 6','Rohini Sector 7','Rohini Sector 8','Rohini Sector 9','Rohini Sector 10','Rohini Sector 11','Rohini Sector 12','Rohini Sector 13','Rohini Sector 14','Rohini Sector 15','Rohini Sector 16','Rohini Sector 17','Rohini Sector 18','Rohini Sector 19','Rohini Sector 20','Rohini Sector 21','Rohini Sector 22','Rohini Sector 23','Rohini Sector 24','Rohini Sector 25','Rohini Sector 26','Rohini Sector 27','Rohini Sector 28','Rohini Sector 29','Rohini Sector 30','Rohini Sector 31','Rohini Sector 32','Rohini Sector 33','Rohini Sector 34','Rohini Sector 35','Rohini Sector 36','Rohini Sector 37'
  ],
  Gurugram: [
    'Ashok Vihar Gurugram','Atul Kataria Chowk','Bajghera','Basai','Basai Enclave','Basai Road','Bhim Nagar','Bhondsi','Carterpuri','Chakkarpur','Damdama','Dharampur','Dundahera','Farrukhnagar','Fazilpur','Garauli Kalan','Garauli Khurd','Ghatta','Ghosi','Gwal Pahari','Haiderpur','Hamirpur','Hayatpur','Kadipur','Kankrola','Kasan','Kherki Daula','Khandsa','Manesar','Maruti Kunj','Moulsari Avenue','Nathupur','Naurangpur','Palam Vihar Extension','Pataudi','Raisina','Sakatpur','Sikanderpur','Sikohpur','Sihi','Sidhrawali','Sikandarpur Ghosi','Tikri','Wazirabad Gurugram',
    'Sector 1 Gurugram','Sector 2 Gurugram','Sector 3 Gurugram','Sector 4 Gurugram','Sector 6 Gurugram','Sector 8 Gurugram','Sector 9A Gurugram','Sector 10A Gurugram','Sector 12 Gurugram','Sector 12A Gurugram','Sector 13 Gurugram','Sector 15 Part 1 Gurugram','Sector 15 Part 2 Gurugram','Sector 16 Gurugram','Sector 19 Gurugram','Sector 20 Gurugram','Sector 21 Gurugram','Sector 22 Gurugram','Sector 23 Gurugram','Sector 23A Gurugram','Sector 24 Gurugram','Sector 25 Gurugram','Sector 26 Gurugram','Sector 30 Gurugram','Sector 32 Gurugram','Sector 33 Gurugram','Sector 34 Gurugram','Sector 35 Gurugram','Sector 36 Gurugram','Sector 36A Gurugram','Sector 37 Gurugram','Sector 37C Gurugram','Sector 37D Gurugram','Sector 38 Gurugram','Sector 40 Gurugram','Sector 41 Gurugram','Sector 42 Gurugram','Sector 52A Gurugram','Sector 58 Gurugram','Sector 59 Gurugram','Sector 60 Gurugram','Sector 63A Gurugram','Sector 66 Gurugram','Sector 70 Gurugram','Sector 71 Gurugram','Sector 72 Gurugram','Sector 73 Gurugram','Sector 74 Gurugram','Sector 75A Gurugram','Sector 76 Gurugram','Sector 77 Gurugram','Sector 78 Gurugram','Sector 79 Gurugram','Sector 82A Gurugram','Sector 83 Gurugram','Sector 84 Gurugram','Sector 85 Gurugram','Sector 86 Gurugram','Sector 90 Gurugram','Sector 91 Gurugram','Sector 92 Gurugram','Sector 93 Gurugram','Sector 95A Gurugram','Sector 95B Gurugram','Sector 96 Gurugram','Sector 97 Gurugram','Sector 98 Gurugram','Sector 100 Gurugram','Sector 102A Gurugram','Sector 104 Gurugram','Sector 105 Gurugram','Sector 106 Gurugram','Sector 107 Gurugram','Sector 108 Gurugram','Sector 109 Gurugram','Sector 110 Gurugram','Sector 111 Gurugram','Sector 112 Gurugram','Sector 113 Gurugram','Sector 114 Gurugram','Sector 115 Gurugram','Sector 116 Gurugram','Sector 117 Gurugram','Sector 118 Gurugram','Sector 119 Gurugram','Sector 120 Gurugram','Sector 121 Gurugram','Sector 122 Gurugram','Sector 123 Gurugram','Sector 124 Gurugram','Sector 125 Gurugram','Sector 126 Gurugram','Sector 127 Gurugram','Sector 128 Gurugram','Sector 129 Gurugram','Sector 130 Gurugram','Sector 131 Gurugram','Sector 132 Gurugram','Sector 133 Gurugram','Sector 134 Gurugram','Sector 135 Gurugram','Sector 136 Gurugram','Sector 137 Gurugram','Sector 138 Gurugram','Sector 139 Gurugram','Sector 140 Gurugram','Sector 141 Gurugram','Sector 142 Gurugram','Sector 143 Gurugram','Sector 144 Gurugram','Sector 145 Gurugram','Sector 146 Gurugram','Sector 147 Gurugram','Sector 148 Gurugram','Sector 149 Gurugram','Sector 150 Gurugram'
  ]
};
for (const [city, areas] of Object.entries(VOICE_EXTRA_AREAS)) {
  for (const area of areas) {
    const name = area + ', ' + city;
    if (!VOICE_PLACE_ALIASES.some((place) => place.name.toLowerCase() === name.toLowerCase())) {
      const aliases = [area.toLowerCase()];
      if (city === 'Gurugram') aliases.push(area.toLowerCase().replace(/\bgurugram\b/g, '').trim());
      VOICE_PLACE_ALIASES.push({ city, name, aliases });
    }
  }
}

// Add every numbered Gurugram sector as a recognition candidate; the user can
// still give a more precise block, society, tower, street or landmark in free text.
for (let sector = 1; sector <= 150; sector++) {
  const name = 'Sector ' + sector + ', Gurugram';
  if (!VOICE_PLACE_ALIASES.some((place) => place.name === name)) {
    VOICE_PLACE_ALIASES.push({ city: 'Gurugram', name, aliases: ['sector ' + sector + ' gurugram', 'sector number ' + sector + ' gurugram'] });
  }
}

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
  // Do not reject or erase unlisted micro-localities: retain the spoken place.
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


// Multi-turn voice concierge. OpenAI is used when OPENAI_API_KEY is configured;
// a deterministic multilingual parser remains available as a no-key fallback.
app.post('/api/voice/conversation', asyncRoute(async (req, res) => {
  const history = Array.isArray(req.body?.messages)
    ? req.body.messages.filter((m) => m && ['assistant', 'user'].includes(m.role) && typeof m.content === 'string')
      .slice(-18).map((m) => ({ role: m.role, content: m.content.slice(0, 900) }))
    : [];
  const latestUser = [...history].reverse().find((m) => m.role === 'user')?.content?.trim() || '';
  if (!latestUser) return res.status(400).json({ error: 'Please tell me what you need for your ride.' });
  const previous = req.body?.previousIntent && typeof req.body.previousIntent === 'object' ? req.body.previousIntent : {};
  const lastQuestion = String(req.body?.lastQuestion || 'route');
  const language = String(req.body?.language || 'en-IN');
  const requestedCity = String(req.body?.city || previous.city || 'Delhi');
  const todayIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  let ai = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      const systemPrompt = [
        'You are VaahanSathi, a warm, natural, highly accurate human-like driver-booking concierge for India.',
        'Understand English, Hindi, and Hinglish, including informal speech, corrections, incomplete phrases, and details spread across multiple turns.',
        'Use the conversation history and prior extracted fields. Extract only facts the user actually stated. Never invent or guess a pickup, destination, date, or exact time.',
        'CRITICAL LOCATION RULE: Delhi and Gurugram contain thousands of named colonies, villages, sectors, blocks, societies, roads, markets, metro stations, gates and local landmarks. The built-in locality list is NOT exhaustive. NEVER tell the user a place is not found, unavailable, invalid, or unsupported merely because its name is absent from that list. Accept and preserve any clearly spoken locality, colony, sector, block, society, street, building, gate or landmark as a free-form pickup/destination exactly as spoken, including Hindi/Hinglish spellings. Do not replace a specific small locality with a nearby famous locality. Ask a short clarification only when the spoken words are genuinely ambiguous (for example, "Sector 5" without a city/area qualifier), or ask for a nearby landmark/house or society name when the user says only "home" or "office".',
        'Required before preparing a booking: pickup, destination, date (YYYY-MM-DD), and exact time (HH:mm, 24-hour). Ask one short, natural follow-up question for the most important missing or ambiguous detail. If the user says a vague place such as "home", ask for an area, sector, or landmark instead of pretending it is an address.',
        'Supported service cities are Delhi and Gurugram only. Infer city from the route when clear; otherwise use the selected city. If the requested city is outside these areas, do not pretend it is supported.',
        'Resolve relative dates using India local date ' + todayIndia + '. Interpret "kal" as tomorrow unless context clearly says otherwise. Do not infer AM/PM when ambiguous; ask.',
        'tripType must be one of Hourly, Airport, Outstation, Night driver, Full day. hours is an integer 1-24; default 4 for Hourly and 8 for Full day when the user did not specify.',
        'Respond in the user language: ' + language + '. Be conversational, concise, and reassuring.',
        'Return ONLY valid JSON with keys: pickup, destination, city, date, time, tripType, hours, nextQuestionKey, nextQuestion, summary. Use null for unknown pickup/destination/date/time. nextQuestionKey is pickup, destination, date, time, route, or correction.'
      ].join(' ');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_VOICE_MODEL || 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: systemPrompt }, ...history,
            { role: 'system', content: 'Previously extracted trip fields: ' + JSON.stringify(previous) + '. Last field requested by the assistant: ' + lastQuestion + '. Selected city: ' + requestedCity + '. Return the complete updated field set, retaining earlier confirmed values unless the user corrects them.' }]
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Voice understanding service unavailable.');
      const content = payload?.choices?.[0]?.message?.content;
      if (content) ai = JSON.parse(content);
    } catch (error) {
      console.warn('Voice AI unavailable; using multilingual fallback parser:', error?.message || 'unknown error');
    }
  }

  let pickup = ai?.pickup ?? previous.pickup ?? null;
  let destination = ai?.destination ?? previous.destination ?? null;
  let city = ['Delhi', 'Gurugram'].includes(ai?.city) ? ai.city : (['Delhi', 'Gurugram'].includes(previous.city) ? previous.city : requestedCity);
  let date = ai?.date ?? previous.date ?? null;
  let time = ai?.time ?? previous.time ?? null;
  let tripType = ['Hourly', 'Airport', 'Outstation', 'Night driver', 'Full day'].includes(ai?.tripType) ? ai.tripType : (previous.tripType || 'Hourly');
  let hours = Number(ai?.hours || previous.hours || (tripType === 'Full day' ? 8 : 4));
  const allUserText = history.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  const lower = allUserText.toLocaleLowerCase('en-IN');
  const latestLower = latestUser.toLocaleLowerCase('en-IN');

  if (!ai) {
    const routePatterns = [
      /(?:from|pickup(?: point)?(?: is| at)?|pick me up from)\s+(.+?)\s+(?:to|and drop(?: me)?(?: at)?|drop(?: me)? at|destination(?: is)?|going to|towards)\s+(.+?)(?:\s+(?:at|on|tomorrow|today|kal|aaj|abhi|subah|morning|evening|shaam|raat)|[,.]|$)/i,
      /(?:mujhe|mujhko|please|bhai|yaar)?\s*(.+?)\s+se\s+(.+?)\s+(?:le jao|jaana hai|jana hai|jaana|chalna hai|drop karo|chhod do|pahuncha do)/i,
      /(.+?)\s+से\s+(.+?)\s+(?:जाना है|जाना|तक|के लिए|छोड़ दो|पहुँचाओ)/i
    ];
    for (const pattern of routePatterns) {
      const match = allUserText.match(pattern);
      if (match?.[1] && match?.[2]) {
        const clean = (value) => String(value).replace(/^(mujhe|mujhko|please|bhai|yaar|मुझे|मुझको)\s+/i, '')
          .replace(/\s+(tomorrow|today|kal|aaj|abhi|कल|आज|सुबह|शाम|रात)\s*.*$/i, '')
          .replace(/[,.?।]+$/, '').trim();
        pickup = normaliseVoicePlace(clean(match[1]));
        destination = normaliseVoicePlace(clean(match[2]));
        break;
      }
    }
    const simplePlace = (value) => {
      const cleaned = String(value || '').replace(/^(please|bhai|yaar|at|from|to|it's|it is|mera pickup|pickup|destination|drop)\s+/i, '')
        .replace(/[,.?।]+$/, '').trim();
      if (!cleaned || cleaned.length > 180 || /^(yes|no|haan|han|okay|ok|sure|thanks|thank you)$/i.test(cleaned)) return null;
      return normaliseVoicePlace(cleaned);
    };
    if (lastQuestion === 'pickup' && !pickup) pickup = simplePlace(latestUser);
    if (lastQuestion === 'destination' && !destination) destination = simplePlace(latestUser);
    if (lastQuestion === 'route' && !pickup && !destination) {
      const from = latestUser.match(/(?:from|pickup(?: at)?)\s+(.+?)(?:\s+to\s+|$)/i);
      if (from?.[1] && latestUser.match(/\bto\b/i)) {
        pickup = simplePlace(from[1]);
        destination = simplePlace(latestUser.split(/\bto\b/i).slice(1).join(' to ').replace(/\b(tomorrow|today|at|on)\b.*$/i, ''));
      }
    }
    if (!city || !['Delhi', 'Gurugram'].includes(city)) city = requestedCity;
    if (/gurugram|gurgaon|गुरुग्राम/.test(lower)) city = 'Gurugram';
    else if (/delhi|दिल्ली/.test(lower)) city = 'Delhi';
    else {
      const placeMatch = VOICE_PLACE_ALIASES.find((place) => place.aliases.some((alias) => lower.includes(alias.toLocaleLowerCase('en-IN'))));
      if (placeMatch) city = placeMatch.city;
    }
    if (/airport|एयरपोर्ट|हवाई अड्डा|igi/.test(lower)) tripType = 'Airport';
    else if (/outstation|out of town|दूसरे शहर/.test(lower)) tripType = 'Outstation';
    else if (/night driver|raat ko|रात में|late night/.test(lower)) tripType = 'Night driver';
    else if (/full day|whole day|poora din|पूरा दिन/.test(lower)) tripType = 'Full day';
    const hourMatch = lower.match(/(\d{1,2})\s*(?:hours?|hrs?|ghante|ghanta|घंटे|घंटा)/i);
    if (hourMatch) hours = Math.max(1, Math.min(24, Number(hourMatch[1])));
    else if (tripType === 'Full day' && !previous.hours) hours = 8;

    const dateText = latestLower;
    if (lastQuestion === 'date' || /today|aaj|आज|tomorrow|kal|कल|day after tomorrow|parso|परसों/.test(dateText)) {
      if (/day after tomorrow|parso|परसों/.test(dateText)) {
        const d = new Date(todayIndia + 'T00:00:00+05:30'); d.setDate(d.getDate() + 2); date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } else if (/tomorrow|kal|कल/.test(dateText)) {
        const d = new Date(todayIndia + 'T00:00:00+05:30'); d.setDate(d.getDate() + 1); date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } else if (/today|aaj|आज/.test(dateText)) date = todayIndia;
      const explicitDate = latestUser.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
      if (explicitDate) {
        const year = explicitDate[3].length === 2 ? '20' + explicitDate[3] : explicitDate[3];
        date = year + '-' + String(explicitDate[2]).padStart(2,'0') + '-' + String(explicitDate[1]).padStart(2,'0');
      }
    }
    const timeText = latestLower;
    const timeMatch = latestUser.match(/(?:at|around|by|ko|subah|savere|morning|afternoon|dopahar|shaam|evening|raat|night)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:baje|बजे)?/i);
    if (lastQuestion === 'time' || /\b(am|pm|morning|afternoon|evening|night|subah|shaam|raat|baje)\b|सुबह|शाम|रात|बजे/.test(timeText)) {
      if (timeMatch) {
        let h = Number(timeMatch[1]);
        const minute = Number(timeMatch[2] || 0);
        const suffix = (timeMatch[3] || '').toLowerCase();
        const isPm = suffix === 'pm' || /afternoon|evening|shaam|raat|night|dopahar|शाम|रात|दोपहर/.test(timeText);
        const isAm = suffix === 'am' || /morning|subah|savere|सुबह|सवेरे/.test(timeText);
        if (h >= 0 && h <= 23 && minute <= 59) {
          if (h <= 12 && !suffix && !isPm && !isAm) time = null;
          else {
            if (h === 12 && isAm) h = 0;
            else if (h < 12 && isPm) h += 12;
            time = String(h).padStart(2,'0') + ':' + String(minute).padStart(2,'0');
          }
        }
      }
    }
  }

  if (!['Delhi', 'Gurugram'].includes(city)) city = requestedCity;
  if (pickup && pickup.length > 180) pickup = null;
  if (destination && destination.length > 180) destination = null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) date = null;
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time))) time = null;
  hours = Math.max(1, Math.min(24, Number(hours) || 4));

  const missing = [];
  if (!pickup) missing.push('pickup');
  if (!destination) missing.push('destination');
  if (!date) missing.push('date');
  if (!time) missing.push('time');
  const questionMap = {
    pickup: 'Where should the driver pick you up? Please share an address, sector, or nearby landmark.',
    destination: 'And where would you like to go? A place name, sector, or landmark is fine.',
    date: 'What date do you need the driver? You can say today, tomorrow, or a calendar date.',
    time: 'What exact time should the driver arrive? Please include AM or PM.',
  };
  const nextQuestionKey = missing[0] || 'confirmation';
  const readyToConfirm = missing.length === 0 && pickup.toLowerCase() !== destination.toLowerCase();
  const summary = 'I have your trip from ' + pickup + ' to ' + destination + ', in ' + city + ', on ' + date + ' at ' + time + '.';
  const nextQuestion = readyToConfirm
    ? 'I have all the details. Let me read them back so you can check everything.'
    : questionMap[nextQuestionKey] || ai?.nextQuestion || 'Could you clarify that detail for me?';
  res.json({
    pickup, destination, city, date, time, tripType, hours,
    readyToConfirm, missing, nextQuestionKey, nextQuestion, summary,
    understandingMode: ai ? 'ai' : 'multilingual-fallback'
  });
}));

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

  // One-time cleanup of the retired cash-PIN workflow. Normal start/end trip OTPs are untouched.
  let migratedLegacyCash = false;
  for (const booking of data.bookings) {
    let bookingChanged = false;
    if (booking.status === 'Awaiting cash confirmation') {
      booking.status = 'Trip completed';
      if (booking.payment_method === 'cash' && booking.payment_status !== 'Paid · Cash') booking.payment_status = 'Cash due after trip';
      bookingChanged = true;
    }
    for (const key of ['cashPin', 'cashPinEncrypted', 'cashPinHash', 'cashPinAttempts', 'cashPinLockedAt', 'cashCustomerConfirmed', 'cashDriverConfirmed', 'cashCustomerAmount', 'cashDriverAmount', 'cashBalanceDue', 'cashDispute']) {
      if (Object.prototype.hasOwnProperty.call(booking, key)) {
        delete booking[key];
        bookingChanged = true;
      }
    }
    if (bookingChanged) {
      migratedLegacyCash = true;
      if (databaseReady) await persistItem('app_bookings', booking.id, booking);
    }
  }
  if (migratedLegacyCash) await save();

  if (!neonPool && data.users.length === 0) await seedDefaultAccounts();
  await ensureDemoAccounts();
  app.listen(port, () => {
    console.log(`VaahanSathi server listening on port ${port}...`);
    console.log(`VaahanSathi is active [Mode: ${databaseReady ? 'Neon PostgreSQL' : 'Local Storage'}]`);
  });
}
start().catch((err) => { console.error('Fatal startup error:', err); process.exitCode = 1; });
