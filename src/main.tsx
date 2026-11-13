import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  CreditCard,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Headphones,
  Heart,
  IndianRupee,
  MapPin,
  Menu,
  Mic,
  MoreHorizontal,
  Navigation,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  Wallet,
  X,
  Zap,
  RotateCcw
} from 'lucide-react';
import './style.css';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  city?: string;
  vehicle?: string;
  rating?: number;
  trips?: number;
  verificationStatus?: string;
};

type Booking = {
  id: string;
  userId?: string;
  customer?: string;
  driverId?: string;
  trip_type: string;
  pickup: string;
  destination: string;
  city?: string;
  date: string;
  time: string;
  hours: number;
  total: number;
  payout: number;
  commission?: number;
  status: string;
  start_otp: string;
  end_otp: string;
  payment_status: string;
  driver?: string;
  vehicle?: string;
  createdAt?: string;
};

type Receipt = {
  bookingId: string;
  amount: number;
  method: string;
  paidAt: string;
  customer: string;
};

const DEMO_DRIVERS = [
  { id: 'usr-driver-1', name: 'Ramesh Kumar', city: 'Bengaluru', rating: 4.9, trips: 684, phone: '+91 98765 43211', status: 'Verified', vehicle: 'Sedan', earnings: 18450 },
  { id: 'usr-driver-2', name: 'Kavita Singh', city: 'Delhi NCR', rating: 4.8, trips: 512, phone: '+91 98765 43213', status: 'Verified', vehicle: 'SUV', earnings: 16200 },
  { id: 'demo-arjun', name: 'Arjun Malik', city: 'Gurugram', rating: 4.9, trips: 391, phone: '+91 98765 43214', status: 'Verified', vehicle: 'Sedan', earnings: 13750 }
];

const DEMO_REVIEWS = [
  { id: 'r1', type: 'Driver review', name: 'Ananya Sharma', subject: 'Ramesh Kumar', city: 'Bengaluru', stars: 5, note: 'Ramesh arrived 10 mins early, handled Bangalore traffic with ease, and was extremely courteous.', date: 'Today · 10:32 AM' },
  { id: 'r2', type: 'Customer review', name: 'Ramesh Kumar', subject: 'Ananya Sharma', city: 'Bengaluru', stars: 5, note: 'Car was clean, pickup location was precise, and pleasant trip throughout.', date: 'Today · 11:14 AM' },
  { id: 'r3', type: 'Driver review', name: 'Meera Kapoor', subject: 'Kavita Singh', city: 'Delhi NCR', stars: 5, note: 'Excellent night driving skills on the expressway. Felt completely safe.', date: 'Yesterday · 8:40 PM' }
];

const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

const api = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('vs_token');
  const r = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const d = await r.json();
  if (r.status === 401) {
    localStorage.removeItem('vs_user');
    localStorage.removeItem('vs_token');
    window.dispatchEvent(new Event('vs-auth-expired'));
  }
  if (!r.ok) throw new Error(d.error || 'Something went wrong.');
  return d;
};

const readReceipts = (): Receipt[] => {
  try {
    return JSON.parse(localStorage.getItem('vs_receipts') || '[]');
  } catch {
    return [];
  }
};

function downloadReceipt(b: Booking, r: Receipt) {
  const body = [
    '====================================================',
    '             VAAHANSATHI · PAYMENT RECEIPT          ',
    '====================================================',
    '',
    `Receipt ID  : VS-RCP-${r.bookingId}`,
    `Booking ID  : ${b.id}`,
    `Customer    : ${r.customer}`,
    `Date & Time : ${new Date(r.paidAt).toLocaleString('en-IN')}`,
    `Payment Mode: ${r.method}`,
    `Trip Type   : ${b.trip_type}`,
    `Route       : ${b.pickup} → ${b.destination}`,
    `City        : ${b.city || 'Bengaluru'}`,
    `Vehicle     : ${b.vehicle || 'Sedan'} (Customer Owned)`,
    `Driver      : ${b.driver || 'Verified Partner'}`,
    '----------------------------------------------------',
    `TOTAL PAID  : ${money(r.amount)}`,
    '----------------------------------------------------',
    '',
    'Service Note: VaahanSathi provides professional verified drivers.',
    'Customers provide their own vehicles.',
    'Thank you for traveling with VaahanSathi!'
  ];
  const blob = new Blob([body.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${b.id}-receipt.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadInvoice(b: Booking) {
  const lines = [
    '====================================================',
    '            VAAHANSATHI · TAX INVOICE               ',
    '====================================================',
    '',
    `Invoice No   : INV-${b.id}`,
    `Booking Ref  : ${b.id}`,
    `Service Date : ${b.date} at ${b.time}`,
    `Customer     : ${b.customer || 'Customer'}`,
    `Driver       : ${b.driver || 'Assigned Driver'}`,
    `Vehicle Type : ${b.vehicle || 'Sedan'} (Customer Car)`,
    `Trip Type    : ${b.trip_type} (${b.hours} hours)`,
    '',
    `Pickup       : ${b.pickup}`,
    `Destination  : ${b.destination}`,
    '----------------------------------------------------',
    `Driver Service Fee : ${money(Math.round(b.total * 0.8))}`,
    `Platform & Mgmt Fee: ${money(Math.round(b.total * 0.15))}`,
    `GST (5%)           : ${money(Math.round(b.total * 0.05))}`,
    '----------------------------------------------------',
    `TOTAL AMOUNT       : ${money(b.total)}`,
    `PAYMENT STATUS     : ${b.payment_status}`,
    '----------------------------------------------------',
    '',
    'VaahanSathi Mobility Technologies Pvt. Ltd.',
    'Transparent Driver Services Across India.'
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${b.id}-tax-invoice.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  let savedUser: User | null = null;
  try {
    savedUser = JSON.parse(localStorage.getItem('vs_user') || 'null');
  } catch {
    localStorage.removeItem('vs_user');
    localStorage.removeItem('vs_token');
  }

  const [user, setUser] = useState<User | null>(savedUser);
  const [page, setPage] = useState<string>(savedUser ? (savedUser.role === 'admin' ? 'Overview' : savedUser.role === 'driver' ? 'Requests' : 'Home') : 'Home');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [tripType, setTripType] = useState('Hourly');
  const [city, setCity] = useState(localStorage.getItem('vs_city') || 'Bengaluru');
  const [pickup, setPickup] = useState('Indiranagar, Bengaluru');
  const [destination, setDestination] = useState('Kempegowda International Airport, Bengaluru');
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState('08:00');
  const [hours, setHours] = useState(4);
  const [vehicle, setVehicle] = useState('Sedan');
  const [fare, setFare] = useState<any>(null);
  const [filter, setFilter] = useState('Upcoming');
  const [rating, setRating] = useState(5);
  const [voice, setVoice] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>(readReceipts);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [fareError, setFareError] = useState('');

  const flash = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 3500);
  };

  const checkHealth = async () => {
    try {
      const r = await fetch('/api/health');
      const d = await r.json();
      setStorageReady(!!(d.database || d.integrations?.database));
    } catch {
      setStorageReady(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setBookings([]);
      setPage('Home');
      setModal('auth');
    };
    window.addEventListener('vs-auth-expired', expired);
    return () => window.removeEventListener('vs-auth-expired', expired);
  }, []);

  const chooseCity = (next: string) => {
    setCity(next);
    localStorage.setItem('vs_city', next);
    const defaults: Record<string, [string, string]> = {
      Bengaluru: ['Indiranagar, Bengaluru', 'Kempegowda International Airport, Bengaluru'],
      'Delhi NCR': ['Connaught Place, New Delhi', 'Indira Gandhi International Airport, New Delhi'],
      Gurugram: ['Cyber City, Gurugram', 'Huda City Centre, Gurugram']
    };
    if (defaults[next]) {
      setPickup(defaults[next][0]);
      setDestination(defaults[next][1]);
    }
    setFare(null);
    flash(`Service city switched to ${next}`);
  };

  const refresh = async () => {
    if (!user) return;
    try {
      const d = await api('/bookings');
      setBookings(d.bookings || []);
    } catch (e: any) {
      console.warn('Booking refresh:', e.message);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => refresh(), 12000);
    return () => window.clearInterval(timer);
  }, [user]);

  // Fare estimation
  useEffect(() => {
    if (pickup.trim() && destination.trim()) {
      const timer = window.setTimeout(() => {
        fetch('/api/fare/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripType, hours, date, time, vehicle, pickup, destination, city })
        })
          .then((r) => r.json())
          .then((d) => {
            setFare(d);
            setFareError('');
          })
          .catch(() => {
            setFareError('Using local estimation model');
          });
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [tripType, hours, date, time, vehicle, pickup, destination, city]);

  const login = async (email: string, password: string) => {
    setBusy(true);
    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('vs_token', d.token);
      localStorage.setItem('vs_user', JSON.stringify(d.user));
      setUser(d.user);
      if (d.user.role === 'admin') setPage('Overview');
      else if (d.user.role === 'driver') setPage('Requests');
      else setPage('Home');
      setModal('');
      flash(`Welcome back, ${d.user.name.split(' ')[0]}!`);
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const register = async (name: string, email: string, password: string, accountCity: string, role = 'customer') => {
    setBusy(true);
    try {
      const d = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city: accountCity, role })
      });
      localStorage.setItem('vs_token', d.token);
      localStorage.setItem('vs_user', JSON.stringify(d.user));
      setUser(d.user);
      chooseCity(accountCity);
      setPage(d.user.role === 'driver' ? 'Requests' : 'Home');
      setModal('');
      flash(`Account created! Welcome to VaahanSathi, ${d.user.name.split(' ')[0]}.`);
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    if (!user) {
      setModal('auth');
      return;
    }
    setBusy(true);
    try {
      const d = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({ tripType, pickup, destination, date, time, hours, vehicle, city })
      });
      await refresh();
      setPage('Your trips');
      setModal('');
      flash(`Booking confirmed! Reference: ${d.booking.id}`);
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (b: Booking, status: string, otp?: string) => {
    try {
      await api(`/bookings/${b.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, otp })
      });
      await refresh();
      flash(
        status === 'Trip started'
          ? 'Trip started! Have a pleasant journey.'
          : status === 'Trip completed'
          ? 'Trip completed! Invoice & receipt ready.'
          : `Booking updated: ${status}`
      );
    } catch (e: any) {
      flash(e.message);
    }
  };

  const completePayment = (b: Booking, method: string) => {
    const receipt: Receipt = {
      bookingId: b.id,
      amount: b.total,
      method,
      paidAt: new Date().toISOString(),
      customer: user?.name || 'Customer'
    };
    const next = [receipt, ...readReceipts().filter((x) => x.bookingId !== b.id)];
    localStorage.setItem('vs_receipts', JSON.stringify(next));
    setReceipts(next);
    setModal('');
    flash('Payment received! Receipt generated.');
  };

  const logout = () => {
    localStorage.removeItem('vs_user');
    localStorage.removeItem('vs_token');
    setUser(null);
    setBookings([]);
    setPage('Home');
    flash('You have safely signed out.');
  };

  const nav =
    user?.role === 'admin'
      ? ['Overview', 'Live trips', 'Bookings', 'Drivers', 'Customers', 'Payments & Payouts', 'Disputes', 'Pricing & Revenue', 'Analytics', 'Audit Logs', 'Settings']
      : user?.role === 'driver'
      ? ['Requests', 'My trips', 'Earnings', 'Profile']
      : ['Home', 'Book a driver', 'Your trips', 'Wallet', 'Help'];

  return (
    <div className="app">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && <div className="drawer-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brandmark">
            <CarFront size={22} />
          </div>
          <div className="brand-text">
            <span>VaahanSathi</span>
            <small>YOUR CAR · OUR DRIVER</small>
          </div>
          <button className="close-menu" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="profile-mini" onClick={() => (user ? null : setModal('auth'))}>
          <div className="avatar">{user?.name?.split(' ').map((x) => x[0]).slice(0, 2).join('') || 'VS'}</div>
          <div className="profile-details">
            <b>{user?.name || 'Guest User'}</b>
            <small>
              {user?.role === 'driver' ? 'Driver Partner' : user?.role === 'admin' ? 'Operations Admin' : user ? 'Car Owner' : 'Tap to sign in'}
            </small>
          </div>
          {user && <span className="role-tag">{user.role}</span>}
        </div>

        <div className="side-label">NAVIGATION</div>
        <nav>
          {nav.map((x) => (
            <button
              key={x}
              className={`navitem ${page === x ? 'selected' : ''}`}
              onClick={() => {
                setPage(x);
                setMobileOpen(false);
              }}
            >
              <span className="nav-icon">
                {x === 'Home' && <CarFront size={18} />}
                {x === 'Book a driver' && <Plus size={18} />}
                {x === 'Your trips' && <CalendarDays size={18} />}
                {x === 'Requests' && <Navigation size={18} />}
                {x === 'My trips' && <CalendarDays size={18} />}
                {x === 'Earnings' && <Wallet size={18} />}
                {x === 'Overview' && <Activity size={18} />}
                {x === 'Live trips' && <Navigation size={18} />}
                {x === 'Drivers' && <BadgeCheck size={18} />}
                {x === 'Pricing' && <IndianRupee size={18} />}
                {x === 'Activity' && <Clock3 size={18} />}
                {x === 'Wallet' && <CreditCard size={18} />}
                {x === 'Help' && <Headphones size={18} />}
                {x === 'Profile' && <ShieldCheck size={18} />}
              </span>
              <span>{x}</span>
              {x === 'Your trips' && bookings.length > 0 && <em className="badge">{bookings.length}</em>}
              {x === 'Requests' && bookings.filter((b) => b.status === 'Searching').length > 0 && (
                <em className="badge active">{bookings.filter((b) => b.status === 'Searching').length}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="db-indicator">
            <span className={`db-pulse ${storageReady ? 'online' : 'connecting'}`} />
            <div className="db-text">
              <b>{storageReady ? 'Neon PostgreSQL' : 'Database syncing...'}</b>
              <small>{storageReady ? 'Live Cloud Datastore' : 'Connecting'}</small>
            </div>
          </div>

          <button className="auth-btn" onClick={() => (user ? logout() : setModal('auth'))}>
            {user ? 'Sign Out' : 'Sign In / Register'} <ArrowRight size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button className="hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <div className="crumb">
              <span>VaahanSathi</span>
              <span className="crumb-sep">/</span>
              <b>{page}</b>
            </div>
          </div>

          <div className="top-actions">
            {/* Database indicator pill */}
            <div className={`db-pill ${storageReady ? 'connected' : 'connecting'}`} title="Neon DB status">
              <Database size={14} />
              <span>{storageReady ? 'Neon PostgreSQL' : 'Connecting...'}</span>
            </div>

            {/* City Selector */}
            <label className="city-pill">
              <MapPin size={15} className="city-pin" />
              <select value={city} onChange={(e) => chooseCity(e.target.value)}>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Gurugram">Gurugram</option>
              </select>
              <ChevronDown size={14} />
            </label>

            <button className="icon-btn" title="Emergency Help" onClick={() => setPage('Help')}>
              <Headphones size={18} />
            </button>

            {user ? (
              <div className="user-avatar-btn" onClick={() => flash(`Signed in as ${user.name} (${user.role})`)}>
                {user.name[0]}
              </div>
            ) : (
              <button className="signin-header-btn" onClick={() => setModal('auth')}>
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {page === 'Home' && (
            <>
              <div className="welcome-banner">
                <div>
                  <span className="eyebrow">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                  </span>
                  <h1>Good day{user ? `, ${user.name.split(' ')[0]}` : ''}!</h1>
                  <p className="subhead">Professional, verified drivers for your own car on-demand.</p>
                </div>
                <div className="quick-action-btns">
                  <button className="primary-btn" onClick={() => setPage('Book a driver')}>
                    <Plus size={17} /> Book a Driver
                  </button>
                </div>
              </div>

              {/* Hero Showcase */}
              <section className="hero-card">
                <div className="hero-content">
                  <span className="hero-badge">YOUR CAR · OUR VERIFIED DRIVER</span>
                  <h2>Professional Drivers For Your Own Vehicle.</h2>
                  <p>
                    Pay only for the driver's skilled time. Never pay for rental cars or expensive taxis. Hourly, airport, night trips,
                    and outstation journeys.
                  </p>
                  <div className="hero-cta-row">
                    <button className="hero-btn" onClick={() => setPage('Book a driver')}>
                      Book Driver Now <ArrowRight size={17} />
                    </button>
                    {!user && (
                      <button className="hero-btn-outline" onClick={() => setModal('auth')}>
                        Sign in / Quick Demo
                      </button>
                    )}
                  </div>
                  <div className="hero-highlights">
                    <span><ShieldCheck size={16} /> Thoroughly Police & Skill Verified</span>
                    <span><MapPin size={16} /> {city} Service Area</span>
                    <span><IndianRupee size={16} /> Transparent Fixed Fares</span>
                  </div>
                </div>
                <div className="hero-graphic">
                  <div className="car-circle">
                    <CarFront size={80} strokeWidth={1.5} />
                  </div>
                </div>
              </section>

              {/* Service Grid */}
              <div className="section-head">
                <div>
                  <h3>Choose a Driver Service</h3>
                  <p>Transparent pricing tailored for every journey need.</p>
                </div>
              </div>

              <div className="services-grid">
                {[
                  { id: 'Hourly', title: 'Hourly Driver', desc: 'From ₹599 · 4 Hours', icon: '⏱' },
                  { id: 'Airport', title: 'Airport Transfer', desc: 'Stress-free terminal drops', icon: '✈' },
                  { id: 'Night driver', title: 'Night Driver', desc: 'Party or late commute safely', icon: '🌙' },
                  { id: 'Full day', title: 'Full Day Chauffeur', desc: '8-12 hrs seamless city travel', icon: '📅' },
                  { id: 'Outstation', title: 'Outstation Trip', desc: 'Highway experienced drivers', icon: '🛣' },
                  { id: 'Custom', title: 'Custom Duration', desc: 'Flexible schedule & stops', icon: '⚡' }
                ].map((s) => (
                  <button
                    key={s.id}
                    className={`service-card ${tripType === s.id ? 'active' : ''}`}
                    onClick={() => {
                      setTripType(s.id);
                      setPage('Book a driver');
                    }}
                  >
                    <span className="service-emoji">{s.icon}</span>
                    <b className="service-title">{s.title}</b>
                    <small className="service-desc">{s.desc}</small>
                    <ArrowUpRight size={16} className="service-arrow" />
                  </button>
                ))}
              </div>

              {/* Bottom Quick Panels */}
              <div className="home-panels-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Active / Upcoming Trips</h3>
                      <p>Track your driver or view trip details</p>
                    </div>
                    {bookings.length > 0 && (
                      <button className="link-btn" onClick={() => setPage('Your trips')}>
                        View all <ArrowRight size={14} />
                      </button>
                    )}
                  </div>

                  {bookings.filter((b) => b.status !== 'Trip completed' && b.status !== 'Cancelled').length > 0 ? (
                    <BookingRow
                      booking={bookings.filter((b) => b.status !== 'Trip completed' && b.status !== 'Cancelled')[0]}
                      onClick={() => setPage('Your trips')}
                    />
                  ) : (
                    <div className="empty-panel">
                      <CalendarDays size={32} className="empty-icon" />
                      <h4>No rides scheduled right now</h4>
                      <p>Book a professional driver whenever you need to commute in your own car.</p>
                      <button className="primary-btn-sm" onClick={() => setPage('Book a driver')}>
                        Schedule a Ride
                      </button>
                    </div>
                  )}
                </section>

                <section className="panel promise-panel">
                  <div className="promise-icon">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <span className="eyebrow green">VAAHANSATHI COMMITMENT</span>
                    <h3>Arrive Safely, Relax Comfortably</h3>
                    <p>
                      Every driver is background-checked, vetted for manual and automatic transmissions, and arrives in uniform at your
                      doorstep.
                    </p>
                    <div className="service-tags">
                      <span>Bengaluru</span>
                      <span>Delhi NCR</span>
                      <span>Gurugram</span>
                    </div>
                  </div>
                </section>
              </div>

              <VoiceWidget onClick={() => setVoice(true)} />
            </>
          )}

          {page === 'Book a driver' && (
            <BookingPage
              tripType={tripType}
              setTripType={setTripType}
              pickup={pickup}
              setPickup={setPickup}
              destination={destination}
              setDestination={setDestination}
              date={date}
              setDate={setDate}
              time={time}
              setTime={setTime}
              hours={hours}
              setHours={setHours}
              vehicle={vehicle}
              setVehicle={setVehicle}
              fare={fare}
              city={city}
              onBack={() => setPage('Home')}
              onBook={book}
              busy={busy}
              user={user}
              onAuth={() => setModal('auth')}
              storageReady={storageReady}
              fareError={fareError}
            />
          )}

          {page === 'Your trips' && (
            <TripsPage
              bookings={bookings}
              filter={filter}
              setFilter={setFilter}
              update={updateStatus}
              onRate={(b: Booking) => setModal('rate:' + b.id)}
              onPay={(b: Booking) => setModal('payment:' + b.id)}
              onTrack={(b: Booking) => setModal('track:' + b.id)}
              onBook={() => setPage('Book a driver')}
              receipts={receipts}
            />
          )}

          {page === 'Requests' && <DriverPage bookings={bookings} update={updateStatus} user={user} />}
          {page === 'My trips' && <TripsPage bookings={bookings} filter={filter} setFilter={setFilter} update={updateStatus} onRate={(b: Booking) => setModal('rate:' + b.id)} onPay={(b: Booking) => setModal('payment:' + b.id)} onTrack={(b: Booking) => setModal('track:' + b.id)} onBook={() => setPage('Book a driver')} receipts={receipts} />}
          {page === 'Earnings' && <EarningsPage bookings={bookings} />}
          {page === 'Wallet' && <WalletPage receipts={receipts} bookings={bookings} onReceipt={downloadReceipt} />}
          {page === 'Help' && <HelpPage flash={flash} />}
          {page === 'Profile' && <DriverProfile user={user} />}
          {page === 'Overview' && <LiveAdminPage bookings={bookings} focus="Overview" />}
          {page === 'Live trips' && <LiveAdminPage bookings={bookings} focus="Trips" />}
          {page === 'Bookings' && <AdminModulePage module="bookings" bookings={bookings} />}
          {page === 'Drivers' && <LiveAdminPage bookings={bookings} focus="Drivers" />}
          {page === 'Customers' && <AdminModulePage module="customers" bookings={bookings} />}
          {page === 'Payments & Payouts' && <AdminModulePage module="payments" bookings={bookings} />}
          {page === 'Disputes' && <AdminModulePage module="disputes" bookings={bookings} />}
          {page === 'Pricing & Revenue' && <LiveAdminPage bookings={bookings} focus="Pricing" flash={flash} />}
          {page === 'Analytics' && <AdminModulePage module="analytics" bookings={bookings} />}
          {page === 'Audit Logs' && <AdminModulePage module="audit" bookings={bookings} />}
          {page === 'Settings' && <AdminModulePage module="settings" bookings={bookings} />}
        </div>
      </main>

      {/* Modals */}
      {modal === 'auth' && (
        <AuthModal
          onClose={() => setModal('')}
          onLogin={login}
          onRegister={register}
          busy={busy}
          storageReady={storageReady}
        />
      )}

      {modal.startsWith('payment:') && (
        <CheckoutModal
          booking={bookings.find((b) => b.id === modal.slice(8))}
          onClose={() => setModal('')}
          onPay={completePayment}
        />
      )}

      {modal.startsWith('track:') && (
        <TrackingModal
          booking={bookings.find((b) => b.id === modal.slice(6))}
          onClose={() => setModal('')}
        />
      )}

      {modal.startsWith('rate:') && (
        <RatingModal
          stars={rating}
          setStars={setRating}
          onClose={() => setModal('')}
          onSubmit={async () => {
            const id = modal.split(':')[1];
            try {
              await api(`/bookings/${id}/rating`, {
                method: 'POST',
                body: JSON.stringify({ stars: rating })
              });
              await refresh();
              setModal('');
              flash('Thank you for rating your driver!');
            } catch (e: any) {
              flash(e.message);
            }
          }}
        />
      )}

      {voice && (
        <VoiceModal
          onClose={() => setVoice(false)}
          text={voiceText}
          setText={setVoiceText}
          onConfirm={async () => {
            try {
              const intent = await api('/voice/intent', {
                method: 'POST',
                body: JSON.stringify({ text: voiceText })
              });
              setTripType(intent.tripType);
              setHours(intent.hours);
              setVoice(false);
              setPage('Book a driver');
              flash(`Trip details understood: ${intent.tripType} for ${intent.hours} hours.`);
            } catch (e: any) {
              flash(e.message);
            }
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-notification">
          <Check size={18} className="toast-icon" />
          <span>{toast}</span>
          <button onClick={() => setToast('')} className="toast-close">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------- Booking Page Component -----------------
function BookingPage(p: any) {
  return (
    <div className="booking-view">
      <button className="back-link-btn" onClick={p.onBack}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="booking-head">
        <div>
          <span className="eyebrow">YOUR CAR · PROFESSIONAL CHAUFFEUR</span>
          <h1>Book a Verified Driver</h1>
          <p>Tell us where you are headed. We will match you with a trusted partner.</p>
        </div>
        <div className="service-market-pill">
          <MapPin size={15} /> {p.city} Area
        </div>
      </div>

      <div className="booking-layout">
        <div className="booking-form-card panel">
          <h3>1. Select Service Type</h3>
          <div className="trip-type-chips">
            {['Hourly', 'Airport', 'Night driver', 'Full day', 'Outstation', 'Custom'].map((t) => (
              <button
                key={t}
                className={`type-chip ${p.tripType === t ? 'active' : ''}`}
                onClick={() => p.setTripType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="notice-car">
            <CarFront size={20} />
            <div>
              <b>Your Car, Our Driver</b>
              <p>You provide the vehicle. Our verified driver takes the wheel so you can relax.</p>
            </div>
          </div>

          <h3>2. Route & Schedule</h3>
          <div className="form-fields-grid">
            <label className="field-group full">
              <span><MapPin size={15} /> Pickup Location</span>
              <input
                value={p.pickup}
                onChange={(e) => p.setPickup(e.target.value)}
                placeholder="Enter pickup address or landmark"
              />
            </label>

            <button
              className="swap-btn"
              title="Swap locations"
              onClick={() => {
                const temp = p.pickup;
                p.setPickup(p.destination);
                p.setDestination(temp);
              }}
            >
              <ArrowDownUp size={16} />
            </button>

            <label className="field-group full">
              <span><Navigation size={15} /> Destination</span>
              <input
                value={p.destination}
                onChange={(e) => p.setDestination(e.target.value)}
                placeholder="Enter destination address or landmark"
              />
            </label>

            <label className="field-group">
              <span><CalendarDays size={15} /> Date</span>
              <input
                type="date"
                value={p.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => p.setDate(e.target.value)}
              />
            </label>

            <label className="field-group">
              <span><Clock3 size={15} /> Pickup Time</span>
              <input type="time" value={p.time} onChange={(e) => p.setTime(e.target.value)} />
            </label>

            {(p.tripType === 'Hourly' || p.tripType === 'Custom') && (
              <label className="field-group">
                <span><Clock3 size={15} /> Duration</span>
                <select value={p.hours} onChange={(e) => p.setHours(Number(e.target.value))}>
                  {[4, 5, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>{n} Hours</option>
                  ))}
                </select>
              </label>
            )}

            <label className="field-group">
              <span><CarFront size={15} /> Your Car Type</span>
              <select value={p.vehicle} onChange={(e) => p.setVehicle(e.target.value)}>
                {['Hatchback', 'Sedan', 'SUV', 'Luxury'].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="booking-policy-box">
            <ShieldCheck size={18} />
            <div>
              <b>Zero Hidden Charges</b>
              <p>Transparent driver hourly and distance charges. Fuel, tolls, and parking are handled by the car owner.</p>
            </div>
          </div>
        </div>

        {/* Fare Summary Card */}
        <aside className="fare-card panel">
          <span className="eyebrow">TRANSPARENT FARE</span>
          <h2>{p.fare ? money(p.fare.total) : 'Calculating...'}</h2>
          <p className="fare-sub">For professional driver time · {p.vehicle}</p>

          <div className="fare-divider" />

          {p.fare?.distanceKm && (
            <FareLine name={`Estimated Distance (${p.fare.distanceKm} km)`} value={p.fare.distanceCharge || 0} />
          )}
          <FareLine name="Driver Service" value={p.fare?.base || 0} />
          {p.fare?.night > 0 && <FareLine name="Night Driving Charge" value={p.fare.night} />}
          {p.fare?.vehicleExtra > 0 && <FareLine name="Vehicle Class Add-on" value={p.fare.vehicleExtra} />}
          <FareLine name="Platform & Safety Fee" value={p.fare?.serviceFee || 0} />
          <FareLine name="GST (5%)" value={p.fare?.gst || 0} />

          <div className="fare-divider" />

          <div className="fare-total-row">
            <span>Total Payable</span>
            <b>{p.fare ? money(p.fare.total) : '—'}</b>
          </div>

          <div className="driver-share-box">
            <span className="share-icon"><IndianRupee size={16} /></span>
            <div>
              <b>{money(p.fare?.payout || 0)} goes directly to driver</b>
              <small>80% driver payout share</small>
            </div>
          </div>

          <button
            className="primary-btn-wide"
            onClick={p.user ? p.onBook : p.onAuth}
            disabled={p.busy || !p.fare}
          >
            {p.busy ? 'Dispatching driver...' : p.user ? 'Confirm & Book Driver' : 'Sign in to Book Driver'} <ArrowRight size={17} />
          </button>

          <small className="payment-terms-note">
            <ShieldCheck size={14} /> Pay securely after completion. No advance deposit required.
          </small>
        </aside>
      </div>
    </div>
  );
}

function FareLine({ name, value }: { name: string; value: number }) {
  return (
    <div className="fare-line-row">
      <span>{name}</span>
      <b>{money(value || 0)}</b>
    </div>
  );
}

function BookingRow({ booking: b, onClick }: any) {
  if (!b) return null;
  return (
    <div className="booking-item-row" onClick={onClick}>
      <div className="date-tile">
        <b>{new Date(b.date + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit' })}</b>
        <small>{new Date(b.date + 'T00:00').toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</small>
      </div>
      <div className="route-info">
        <b>
          {b.trip_type} · {b.pickup.split(',')[0]} <ArrowRight size={13} /> {b.destination.split(',')[0]}
        </b>
        <small>
          {b.time} · {b.hours} hrs · {b.vehicle || 'Sedan'}
        </small>
      </div>
      <span className={`status-pill ${b.status === 'Trip completed' ? 'done' : b.status === 'Trip started' ? 'active' : ''}`}>
        {b.status}
      </span>
      <b className="fare-amount">{money(b.total)}</b>
      <ArrowRight size={16} className="arrow-icon" />
    </div>
  );
}

// ----------------- Trips Page -----------------
function TripsPage({ bookings, filter, setFilter, update, onRate, onPay, onTrack, onBook, receipts }: any) {
  const filters = ['Upcoming', 'Completed', 'Cancelled'];
  const list = bookings.filter((b: Booking) =>
    filter === 'Upcoming'
      ? ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status)
      : filter === 'Completed'
      ? ['Trip completed', 'Rated'].includes(b.status)
      : b.status === 'Cancelled'
  );

  return (
    <div className="trips-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">YOUR TRAVEL LOG</span>
          <h1>My Rides & Bookings</h1>
          <p>Real-time trip management and ride history.</p>
        </div>
        <button className="primary-btn" onClick={onBook}>
          <Plus size={16} /> Book Driver
        </button>
      </div>

      <div className="tabs-row">
        {filters.map((f) => (
          <button
            key={f}
            className={`tab-btn ${f === filter ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
            <span className="tab-count">
              {
                bookings.filter((b: Booking) =>
                  f === 'Upcoming'
                    ? ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status)
                    : f === 'Completed'
                    ? ['Trip completed', 'Rated'].includes(b.status)
                    : b.status === 'Cancelled'
                ).length
              }
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="panel empty-state">
          <CalendarDays size={42} className="empty-icon" />
          <h3>{filter === 'Upcoming' ? 'No rides in progress' : 'No completed rides yet'}</h3>
          <p>Book a driver for your daily commute, airport runs, or weekend outstations.</p>
          <button className="primary-btn" onClick={onBook}>
            Book a Driver Now <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="trips-cards-list">
          {list.map((b: Booking) => (
            <div className="trip-card panel" key={b.id}>
              <div className="trip-card-header">
                <div>
                  <span className="trip-id-tag">{b.id}</span>
                  <span className="trip-date">{b.date} at {b.time}</span>
                </div>
                <span className={`status-pill ${b.status === 'Trip completed' ? 'done' : b.status === 'Trip started' ? 'active' : ''}`}>
                  {b.status}
                </span>
              </div>

              <div className="trip-route-display">
                <div className="route-point">
                  <span className="dot green" />
                  <div>
                    <small>PICKUP</small>
                    <b>{b.pickup}</b>
                  </div>
                </div>
                <div className="route-point">
                  <span className="dot blue" />
                  <div>
                    <small>DESTINATION</small>
                    <b>{b.destination}</b>
                  </div>
                </div>
              </div>

              {/* OTP Cards for active trips */}
              {['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status) && (
                <div className="otp-banner">
                  <div className="otp-box">
                    <small>START OTP</small>
                    <b>{b.start_otp || '----'}</b>
                  </div>
                  {b.status === 'Trip started' && (
                    <div className="otp-box end">
                      <small>END OTP</small>
                      <b>{b.end_otp || '----'}</b>
                    </div>
                  )}
                  <div className="otp-hint">
                    <ShieldCheck size={16} />
                    <span>Share OTP with driver only when you are in your car.</span>
                  </div>
                </div>
              )}

              <div className="trip-card-footer">
                <div className="driver-assigned-info">
                  <span className="driver-avatar">{b.driver ? b.driver[0] : 'V'}</span>
                  <div>
                    <small>ASSIGNED DRIVER</small>
                    <b>{b.driver || 'Matching nearby driver...'}</b>
                  </div>
                </div>

                <div className="trip-actions-row">
                  {['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status) && (
                    <button className="action-btn track" onClick={() => onTrack(b)}>
                      <Navigation size={15} /> Track Route
                    </button>
                  )}
                  {b.status === 'Trip completed' && (
                    <>
                      <button className="action-btn" onClick={() => onRate(b)}>
                        <Star size={15} /> Rate Driver
                      </button>
                      <button className="action-btn pay" onClick={() => onPay(b)}>
                        <CreditCard size={15} /> Pay {money(b.total)}
                      </button>
                      <button className="action-btn" onClick={() => downloadInvoice(b)}>
                        Invoice
                      </button>
                      {receipts.some((r: Receipt) => r.bookingId === b.id) && (
                        <button
                          className="action-btn"
                          onClick={() => downloadReceipt(b, receipts.find((r: Receipt) => r.bookingId === b.id)!)}
                        >
                          Receipt
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------- Driver Partner Page -----------------
function DriverPage({ bookings, update, user }: any) {
  const own = bookings.filter(
    (b: Booking) => b.driverId === user?.id || ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status)
  );

  return (
    <div className="driver-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">PARTNER PORTAL</span>
          <h1>Welcome, {user?.name || 'Driver Partner'}</h1>
          <p>Manage your daily bookings, accept passenger rides, and track earnings.</p>
        </div>
        <div className="service-market-pill">
          <BadgeCheck size={16} color="#087f72" /> Verified Partner ({user?.city || 'Bengaluru'})
        </div>
      </div>

      <div className="stats-cards-grid">
        <div className="stat-card panel">
          <small>TODAY'S EARNINGS</small>
          <b>
            {money(
              bookings
                .filter((b: Booking) => b.driverId === user?.id && b.status === 'Trip completed')
                .reduce((s: number, b: Booking) => s + b.payout, 0)
            )}
          </b>
          <span>80% driver direct share</span>
        </div>
        <div className="stat-card panel">
          <small>COMPLETED TRIPS</small>
          <b>{bookings.filter((b: Booking) => b.driverId === user?.id && b.status === 'Trip completed').length}</b>
          <span>This week</span>
        </div>
        <div className="stat-card panel">
          <small>PARTNER RATING</small>
          <b>★ 4.9</b>
          <span>Top rated partner</span>
        </div>
        <div className="stat-card panel">
          <small>DUTY STATUS</small>
          <b className="status-online">● Online</b>
          <span>Accepting requests</span>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h3>Ride Requests & Active Duties</h3>
          <p>Pick up requests in your approved zone.</p>
        </div>
      </div>

      {own.length === 0 ? (
        <div className="panel empty-state">
          <CarFront size={42} className="empty-icon" />
          <h3>All caught up!</h3>
          <p>New booking requests in {user?.city || 'your city'} will show up here automatically.</p>
        </div>
      ) : (
        <div className="trips-cards-list">
          {own.map((b: Booking) => (
            <div className="panel trip-card" key={b.id}>
              <div className="trip-card-header">
                <div>
                  <span className="trip-id-tag">{b.id}</span>
                  <span className="trip-date">{b.trip_type} · {b.vehicle || 'Sedan'}</span>
                </div>
                <b className="payout-highlight">Earn: {money(b.payout)}</b>
              </div>

              <div className="trip-route-display">
                <div className="route-point">
                  <span className="dot green" />
                  <div>
                    <small>PICKUP</small>
                    <b>{b.pickup}</b>
                  </div>
                </div>
                <div className="route-point">
                  <span className="dot blue" />
                  <div>
                    <small>DESTINATION</small>
                    <b>{b.destination}</b>
                  </div>
                </div>
              </div>

              <div className="driver-action-footer">
                <span>Customer: <b>{b.customer || 'Car Owner'}</b></span>

                <div className="action-buttons-group">
                  {b.status === 'Searching' && (
                    <button className="primary-btn" onClick={() => update(b, 'Driver assigned')}>
                      Accept Booking <Check size={16} />
                    </button>
                  )}
                  {b.status === 'Driver assigned' && (
                    <button className="primary-btn" onClick={() => update(b, 'Driver arriving')}>
                      Mark On the Way <Navigation size={16} />
                    </button>
                  )}
                  {b.status === 'Driver arriving' && (
                    <button
                      className="primary-btn"
                      onClick={() => {
                        const code = prompt('Ask the customer for their 4-digit START OTP:');
                        if (code) update(b, 'Trip started', code);
                      }}
                    >
                      Start Trip (Enter OTP) <ArrowRight size={16} />
                    </button>
                  )}
                  {b.status === 'Trip started' && (
                    <button
                      className="primary-btn success"
                      onClick={() => {
                        const code = prompt('Ask the customer for their 4-digit END OTP:');
                        if (code) update(b, 'Trip completed', code);
                      }}
                    >
                      Complete Trip (Enter OTP) <Check size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------- Admin Operations Page -----------------
function LiveAdminPage({ bookings, focus = 'Overview', flash }: any) {
  const [summary, setSummary] = useState<any>({});
  const [filter, setFilter] = useState('All');
  const [hourlyRate, setHourlyRate] = useState(599);

  const fetchSummary = async () => {
    try {
      const d = await api('/admin/summary');
      setSummary(d);
      const h = d.pricing?.find((p: any) => p.key === 'hourly');
      if (h) setHourlyRate(h.value);
    } catch {}
  };

  useEffect(() => {
    fetchSummary();
  }, [bookings]);

  const savePricing = async () => {
    try {
      await api('/admin/pricing', {
        method: 'PATCH',
        body: JSON.stringify({ hourly: Number(hourlyRate) })
      });
      flash?.('Pricing updated in Neon DB!');
      fetchSummary();
    } catch (e: any) {
      flash?.(e.message);
    }
  };

  const t = summary.totals || {};

  return (
    <div className="admin-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">OPERATIONS CONSOLE</span>
          <h1>VaahanSathi Network Control</h1>
          <p>Real-time city bookings, driver verification, revenue, and pricing engine.</p>
        </div>
        <div className="service-market-pill">
          <Database size={15} /> Neon DB Live
        </div>
      </div>

      <div className="stats-cards-grid">
        <div className="stat-card panel">
          <small>TOTAL BOOKINGS</small>
          <b>{t.bookings || bookings.length}</b>
          <span>All recorded trips</span>
        </div>
        <div className="stat-card panel">
          <small>GROSS REVENUE</small>
          <b>{money(t.revenue || 0)}</b>
          <span>Total customer billings</span>
        </div>
        <div className="stat-card panel">
          <small>PLATFORM REVENUE</small>
          <b>{money(t.commission || 0)}</b>
          <span>20% platform share</span>
        </div>
        <div className="stat-card panel">
          <small>ACTIVE TRIPS</small>
          <b className="status-online">{t.active || 0}</b>
          <span>Currently in progress</span>
        </div>
      </div>

      {focus === 'Pricing' ? (
        <section className="panel pricing-panel">
          <h3>Pricing Engine Configuration</h3>
          <p>Update base rates and commission stored in Neon DB.</p>
          <div className="pricing-grid">
            <label className="field-group">
              <span>Hourly Base Fare (4 Hours) · INR</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
              />
            </label>
            <div className="pricing-breakdown">
              <div><span>Airport Drop Base</span><b>₹599</b></div>
              <div><span>Night Surcharge (10PM - 6AM)</span><b>₹120</b></div>
              <div><span>Platform Commission</span><b>20%</b></div>
              <div><span>GST Rate</span><b>5%</b></div>
            </div>
          </div>
          <button className="primary-btn" onClick={savePricing}>
            Save New Pricing to Neon DB <Check size={16} />
          </button>
        </section>
      ) : focus === 'Drivers' ? (
        <section className="panel drivers-admin-panel">
          <h3>Driver Partner Network</h3>
          <div className="drivers-list">
            {DEMO_DRIVERS.map((d) => (
              <div className="driver-admin-row" key={d.id}>
                <span className="driver-avatar">{d.name[0]}</span>
                <div className="driver-admin-info">
                  <b>{d.name}</b>
                  <small>{d.city} · {d.vehicle} · {d.phone}</small>
                  <span>★ {d.rating} · {d.trips} completed trips</span>
                </div>
                <span className="status-pill done">Verified</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel bookings-table-panel">
          <div className="panel-header">
            <div>
              <h3>Live Network Bookings</h3>
              <p>Real-time booking and dispatch status</p>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All Bookings</option>
              <option value="Driver assigned">Driver assigned</option>
              <option value="Trip started">Trip started</option>
              <option value="Trip completed">Trip completed</option>
            </select>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>BOOKING ID</th>
                  <th>ROUTE</th>
                  <th>CUSTOMER / DRIVER</th>
                  <th>SERVICE</th>
                  <th>TOTAL</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {bookings
                  .filter((b: Booking) => filter === 'All' || b.status === filter)
                  .map((b: Booking) => (
                    <tr key={b.id}>
                      <td><b>{b.id}</b><small>{b.date} · {b.time}</small></td>
                      <td>{b.pickup.split(',')[0]} → {b.destination.split(',')[0]}<small>{b.city}</small></td>
                      <td>{b.customer || 'Customer'}<small>Driver: {b.driver || 'Searching...'}</small></td>
                      <td>{b.trip_type}</td>
                      <td><b>{money(b.total)}</b></td>
                      <td><span className="status-pill">{b.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ----------------- Admin modules -----------------
function AdminModulePage({ module, bookings }: { module: string; bookings: Booking[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const endpoint = module === 'customers' ? '/admin/users?role=customer' : module === 'audit' ? '/admin/audit-logs' : module === 'disputes' ? '/admin/disputes' : module === 'payments' ? '/admin/payments' : null;
        if (endpoint) {
          const result = await api(endpoint);
          if (mounted) setRows(result.users || result.logs || result.disputes || result.payments || []);
        }
        setError('');
      } catch (e: any) { if (mounted) setError(e.message); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [module]);
  const title: Record<string, string> = { bookings: 'Booking management', customers: 'Customer management', payments: 'Payments & driver payouts', disputes: 'Dispute resolution', analytics: 'Network analytics', audit: 'Immutable audit logs', settings: 'Operations settings' };
  const subtitle: Record<string, string> = { bookings: 'Search, filter, and inspect every trip in the network.', customers: 'Customer profiles, spend, activity, and support context.', payments: 'Separate customer GMV, platform revenue, refunds, and driver payouts.', disputes: 'Resolve complaints with an accountable, auditable workflow.', analytics: 'Growth, quality, utilisation, and unit economics.', audit: 'Every critical admin action is recorded and cannot be deleted.', settings: 'Configure role-aware operations controls and integrations.' };
  const filteredBookings = bookings.filter((b) => `${b.id} ${b.customer || ''} ${b.driver || ''} ${b.pickup} ${b.destination}`.toLowerCase().includes(query.toLowerCase()));
  const filteredRows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  return <div className="admin-view">
    <div className="section-head"><div><span className="eyebrow">OPERATIONS CONSOLE</span><h1>{title[module]}</h1><p>{subtitle[module]}</p></div><span className="service-market-pill"><Database size={15} /> Role-protected</span></div>
    <div className="admin-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={module === 'audit' ? 'Search admin, action, target…' : 'Search by name, ID, phone, route…'} /><button className="secondary-btn" onClick={() => setQuery('')}>Clear</button></div>
    {error && <div className="inline-error">{error}</div>}
    {module === 'analytics' ? <div className="stats-cards-grid"><div className="stat-card panel"><small>COMPLETION RATE</small><b>{bookings.length ? Math.round(bookings.filter((b) => b.status === 'Trip completed').length / bookings.length * 100) : 0}%</b><span>Completed bookings</span></div><div className="stat-card panel"><small>GMV</small><b>{money(bookings.reduce((n, b) => n + Number(b.total || 0), 0))}</b><span>Customer booking value</span></div><div className="stat-card panel"><small>DRIVER PAYOUTS</small><b>{money(bookings.reduce((n, b) => n + Number(b.payout || 0), 0))}</b><span>Separate from platform revenue</span></div><div className="stat-card panel"><small>TAKE RATE</small><b>{bookings.length ? Math.round(bookings.reduce((n, b) => n + Number(b.commission || 0), 0) / Math.max(1, bookings.reduce((n, b) => n + Number(b.total || 0), 0)) * 100) : 0}%</b><span>Platform commission</span></div></div> : module === 'settings' ? <section className="panel empty-state"><ShieldCheck size={28} /><h3>Protected operations workspace</h3><p>Admin access is enforced by signed server sessions. Pricing changes, verification decisions, refunds, payout actions, and role changes must be handled through privileged API routes and are written to Audit Logs.</p></section> : <section className="panel bookings-table-panel"><div className="panel-header"><div><h3>{module === 'bookings' ? 'Bookings' : module === 'customers' ? 'Customers' : module === 'payments' ? 'Payments and payouts' : module === 'disputes' ? 'Open cases' : 'Activity history'}</h3><p>{loading ? 'Loading live records…' : `${(module === 'bookings' ? filteredBookings : filteredRows).length} records`}</p></div><span className="status-pill done">Live data</span></div><div className="table-responsive"><table className="admin-table"><thead><tr>{module === 'bookings' ? <><th>BOOKING</th><th>ROUTE</th><th>CUSTOMER / DRIVER</th><th>FARE</th><th>STATUS</th></> : module === 'customers' ? <><th>CUSTOMER</th><th>CONTACT</th><th>CITY</th><th>ACCOUNT</th></> : module === 'payments' ? <><th>PAYMENT</th><th>BOOKING</th><th>AMOUNT</th><th>STATUS</th></> : module === 'disputes' ? <><th>CASE</th><th>BOOKING</th><th>TYPE</th><th>STATUS</th></> : <><th>TIMESTAMP</th><th>ADMIN / ROLE</th><th>ACTION</th><th>TARGET</th></>}</tr></thead><tbody>{(module === 'bookings' ? filteredBookings : filteredRows).map((r: any, i) => module === 'bookings' ? <tr key={r.id}><td><b>{r.id}</b><small>{r.date} · {r.time}</small></td><td>{r.pickup} → {r.destination}<small>{r.city}</small></td><td>{r.customer || 'Customer'}<small>Driver: {r.driver || 'Unassigned'}</small></td><td><b>{money(r.total)}</b><small>Platform {money(r.commission)}</small></td><td><span className="status-pill">{r.status}</span></td></tr> : module === 'customers' ? <tr key={r.id || i}><td><b>{r.name}</b><small>{r.id}</small></td><td>{r.phone || '—'}<small>{r.email}</small></td><td>{r.city || '—'}</td><td><span className="status-pill done">Active</span></td></tr> : module === 'payments' ? <tr key={r.id || i}><td><b>{r.id || 'Payment'}</b></td><td>{r.bookingId || r.booking_id || '—'}</td><td>{money(r.amount || r.total)}</td><td><span className="status-pill">{r.status || r.payment_status || 'Pending'}</span></td></tr> : module === 'disputes' ? <tr key={r.id || i}><td><b>{r.id || 'Case'}</b><small>{r.createdAt || r.created_at || '—'}</small></td><td>{r.bookingId || r.booking_id || '—'}</td><td>{r.type || r.disputeType || 'General complaint'}</td><td><span className="status-pill">{r.status || 'Open'}</span></td></tr> : <tr key={r.id || i}><td>{r.timestamp || '—'}</td><td>{r.adminName || 'Admin'}<small>{r.adminRole || 'operations_admin'}</small></td><td><b>{r.action || '—'}</b><small>{r.description}</small></td><td>{r.targetId || '—'}</td></tr>)}</tbody></table></div>{!loading && (module === 'bookings' ? filteredBookings : filteredRows).length === 0 && <div className="empty-state"><Activity size={24} /><p>No records match this search.</p></div>}</section>}
  </div>;
}

// ----------------- Other Support Pages -----------------
function EarningsPage({ bookings }: any) {
  const completed = bookings.filter((b: Booking) => b.status === 'Trip completed');
  const total = completed.reduce((s: number, b: Booking) => s + b.payout, 0);

  return (
    <div className="earnings-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">DRIVER WALLET</span>
          <h1>Earnings Summary</h1>
          <p>Transparent breakdown of every completed ride.</p>
        </div>
      </div>

      <div className="panel earnings-hero-card">
        <span className="eyebrow white">TOTAL EARNINGS</span>
        <h2>{money(total)}</h2>
        <p>Direct bank settlements processed weekly.</p>
      </div>

      <div className="panel recent-earnings-card">
        <h3>Trip Payout History</h3>
        {completed.length === 0 ? (
          <p className="subhead">Completed trip payouts will show here.</p>
        ) : (
          completed.map((b: Booking) => (
            <div className="earning-item-row" key={b.id}>
              <div>
                <b>{b.trip_type} · {b.pickup.split(',')[0]}</b>
                <small>{b.date} · {b.id}</small>
              </div>
              <strong className="green-text">+{money(b.payout)}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WalletPage({ receipts, bookings, onReceipt }: any) {
  return (
    <div className="wallet-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">CUSTOMER RECEIPTS</span>
          <h1>Trip Payments & Receipts</h1>
          <p>Official tax invoices and payment vouchers.</p>
        </div>
      </div>

      <section className="panel receipts-panel">
        <h3>Payment Receipts</h3>
        {receipts.length === 0 ? (
          <div className="empty-state">
            <ReceiptIcon size={38} className="empty-icon" />
            <p>Receipts will appear once you pay for a completed trip.</p>
          </div>
        ) : (
          receipts.map((r: Receipt) => {
            const b = bookings.find((x: Booking) => x.id === r.bookingId);
            return (
              <div className="receipt-item-row" key={r.bookingId}>
                <div>
                  <b>{b?.trip_type || 'Driver Service'} · {r.bookingId}</b>
                  <small>{new Date(r.paidAt).toLocaleString('en-IN')} · Mode: {r.method}</small>
                </div>
                <b>{money(r.amount)}</b>
                {b && (
                  <button className="primary-btn-sm" onClick={() => onReceipt(b, r)}>
                    Download Receipt
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function HelpPage({ flash }: any) {
  return (
    <div className="help-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">SUPPORT & ASSISTANCE</span>
          <h1>How Can We Help You?</h1>
          <p>24x7 safety and ride assistance across all active cities.</p>
        </div>
      </div>

      <div className="help-cards-grid">
        <button className="panel help-action-card" onClick={() => flash('Connecting with priority customer care...')}>
          <Headphones size={28} />
          <b>Ride Support</b>
          <p>Assistance with bookings, route changes, or driver coordination.</p>
          <span>Contact Support <ArrowRight size={14} /></span>
        </button>

        <button className="panel help-action-card" onClick={() => window.location.assign('tel:112')}>
          <ShieldCheck size={28} />
          <b>Emergency Assistance</b>
          <p>Immediate connection to 112 national emergency helpline.</p>
          <span>Call 112 Helpline <ArrowRight size={14} /></span>
        </button>

        <button className="panel help-action-card" onClick={() => flash('Dispute review request logged.')}>
          <Activity size={28} />
          <b>Fare Clarification</b>
          <p>Submit questions about tolls, parking, or night charges.</p>
          <span>Raise Ticket <ArrowRight size={14} /></span>
        </button>
      </div>

      <div className="panel faq-card">
        <h3>Frequently Asked Questions</h3>
        <details>
          <summary>Does VaahanSathi provide the car? <ChevronDown size={16} /></summary>
          <p>No. VaahanSathi is exclusively an on-demand professional driver service for your own car. You provide the car; we provide the verified chauffeur.</p>
        </details>
        <details>
          <summary>How are fuel, tolls, and parking handled? <ChevronDown size={16} /></summary>
          <p>Fuel, fastag tolls, and parking fees are paid directly by the car owner and are never included in driver service billing.</p>
        </details>
        <details>
          <summary>What if I need to cancel my booking? <ChevronDown size={16} /></summary>
          <p>You can cancel without any charge before a driver partner begins traveling to your pickup location.</p>
        </details>
      </div>
    </div>
  );
}

function DriverProfile({ user }: any) {
  return (
    <div className="profile-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">PARTNER PROFILE</span>
          <h1>Driver Account</h1>
          <p>Personal and verification details.</p>
        </div>
      </div>

      <div className="panel profile-hero-card">
        <div className="profile-avatar-large">{user?.name ? user.name[0] : 'V'}</div>
        <div>
          <h2>{user?.name || 'Driver Partner'}</h2>
          <p>{user?.email} · {user?.phone || '+91 98765 43211'}</p>
          <span className="status-pill done">Verified Partner · {user?.city || 'Bengaluru'}</span>
        </div>
      </div>
    </div>
  );
}

function VoiceWidget({ onClick }: any) {
  return (
    <button className="voice-float-btn" onClick={onClick} title="Voice Assistant">
      <Mic size={20} />
      <span>Trip Assistant</span>
    </button>
  );
}

// ----------------- Interactive Modals -----------------
function AuthModal({ onClose, onLogin, onRegister, busy, storageReady }: any) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') onLogin(email, password);
    else onRegister(name, email, password, city);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal auth-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>

        <div className="modal-brand">
          <CarFront size={26} />
          <span>VaahanSathi</span>
        </div>

        <h2>{mode === 'login' ? 'Sign In to Your Account' : 'Create Customer Account'}</h2>
        <p className="modal-sub">
          {mode === 'login' ? 'Access your rides and bookings' : 'Book verified drivers for your personal vehicle'}
        </p>

        {/* 1-Click Quick Demo Sign-In */}
        <div className="quick-demo-box">
          <span className="quick-label">⚡ 1-Click Quick Sign-In (Neon DB Connected):</span>
          <div className="quick-buttons">
            <button type="button" onClick={() => onLogin('ananya@vaahansathi.demo', 'password123')}>
              👤 Customer (Ananya)
            </button>
            <button type="button" onClick={() => onLogin('ramesh@vaahansathi.demo', 'password123')}>
              🚗 Driver (Ramesh)
            </button>
            <button type="button" onClick={() => onLogin('admin@vaahansathi.demo', 'password123')}>
              🛡️ Admin (Ops)
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
              <label className="field-group">
                <span>Full Name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
              </label>
              <label className="field-group">
                <span>City / Service Area</span>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                  <option value="Gurugram">Gurugram</option>
                </select>
              </label>
            </>
          )}

          <label className="field-group">
            <span>Email Address</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>

          <label className="field-group">
            <span>Password</span>
            <input type="password" required minLength={mode === 'register' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>

          <button className="primary-btn-wide" type="submit" disabled={busy}>
            {busy ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle-row">
          {mode === 'login' ? (
            <span>
              New to VaahanSathi?{' '}
              <button className="link-btn-inline" onClick={() => setMode('register')}>
                Create Account
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button className="link-btn-inline" onClick={() => setMode('login')}>
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({ booking, onClose, onPay }: any) {
  const [method, setMethod] = useState('UPI');
  if (!booking) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal checkout-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">SECURE CHECKOUT</span>
        <h2>Complete Trip Payment</h2>
        <p className="checkout-route">{booking.pickup} → {booking.destination}</p>

        <div className="total-due-banner">
          <span>Total Fare Amount</span>
          <b>{money(booking.total)}</b>
        </div>

        <div className="payment-options-list">
          {['UPI / GooglePay / PhonePe', 'Credit / Debit Card', 'Net Banking'].map((m) => (
            <button
              key={m}
              className={`payment-method-row ${method === m ? 'selected' : ''}`}
              onClick={() => setMethod(m)}
            >
              <CreditCard size={18} />
              <span>{m}</span>
              {method === m && <Check size={16} className="selected-check" />}
            </button>
          ))}
        </div>

        <button className="primary-btn-wide" onClick={() => onPay(booking, method)}>
          Pay {money(booking.total)} Securely <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function TrackingModal({ booking, onClose }: any) {
  const [progress, setProgress] = useState(35);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 4));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  if (!booking) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tracking-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">LIVE RIDE TRACKING</span>
        <h2>Your Driver is on the Move</h2>
        <p className="subhead">{booking.driver || 'Ramesh Kumar'} is driving your car to destination.</p>

        <div className="simulated-map-container">
          <div className="map-road-line">
            <div className="map-car-icon" style={{ left: `${progress}%` }}>
              <CarFront size={20} />
            </div>
          </div>
          <div className="map-labels">
            <span><MapPin size={14} /> {booking.pickup.split(',')[0]}</span>
            <span><Navigation size={14} /> {booking.destination.split(',')[0]}</span>
          </div>
        </div>

        <div className="eta-counter-box">
          <div>
            <b>{Math.max(1, Math.round((100 - progress) * 0.25))} mins</b>
            <small>Estimated Arrival</small>
          </div>
          <div className="otp-pill">Start OTP: {booking.start_otp || '4821'}</div>
        </div>
      </div>
    </div>
  );
}

function RatingModal({ stars, setStars, onClose, onSubmit }: any) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal rating-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">RIDE FEEDBACK</span>
        <h2>Rate Your Driver Partner</h2>
        <p>Your feedback ensures high quality and safety standards.</p>

        <div className="stars-picker-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setStars(n)}>
              <Star size={32} fill={n <= stars ? '#f59e0b' : 'none'} color={n <= stars ? '#f59e0b' : '#cbd5e1'} />
            </button>
          ))}
        </div>

        <button className="primary-btn-wide" onClick={onSubmit}>
          Submit Rating <Check size={16} />
        </button>
      </div>
    </div>
  );
}

function VoiceModal({ onClose, text, setText, onConfirm }: any) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal voice-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div className="voice-mic-circle">
          <Mic size={28} />
        </div>
        <h2>Trip Voice Assistant</h2>
        <p>Speak or type your request: "Book a driver for 4 hours to airport in Bengaluru."</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I need an airport driver tomorrow at 8am from Indiranagar..."
          rows={3}
        />

        <button className="primary-btn-wide" onClick={onConfirm} disabled={!text.trim()}>
          Process Request <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ReceiptIcon(props: any) {
  return <CreditCard {...props} />;
}

createRoot(document.getElementById('root')!).render(<App />);
