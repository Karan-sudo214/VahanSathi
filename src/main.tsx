import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  CreditCard,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
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
  RotateCcw,
  AlertCircle,
  Edit2,
  Power,
  FileText,
  User as UserIcon,
  Car
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
  { id: 'usr-driver-1', name: 'Ramesh Kumar', city: 'Gurugram', rating: 4.9, trips: 684, phone: '+91 98765 43211', status: 'Verified', vehicle: 'Sedan', earnings: 18450 }
];

const DEMO_REVIEWS = [
  { id: 'r1', type: 'Driver review', name: 'Ananya Sharma', subject: 'Ramesh Kumar', city: 'Gurugram', stars: 5, note: 'Ramesh arrived 10 mins early, handled the traffic with ease, and was extremely courteous.', date: 'Today · 10:32 AM' },
  { id: 'r2', type: 'Customer review', name: 'Ramesh Kumar', subject: 'Ananya Sharma', city: 'Gurugram', stars: 5, note: 'Car was clean, pickup location was precise, and pleasant trip throughout.', date: 'Today · 11:14 AM' }
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
    `City        : ${b.city || 'Delhi'}`,
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
  const [city, setCity] = useState(localStorage.getItem('vs_city') === 'Gurugram' ? 'Gurugram' : 'Delhi');
  const [pickup, setPickup] = useState('Connaught Place, Delhi');
  const [destination, setDestination] = useState('Indira Gandhi International Airport, Delhi');
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState('08:00');
  const [hours, setHours] = useState(4);
  const [vehicle, setVehicle] = useState('Sedan');
  const [fare, setFare] = useState<any>(null);
  const [fareBusy, setFareBusy] = useState(false);
  const fareRequestId = useRef(0);
  const [filter, setFilter] = useState('Upcoming');
  const [rating, setRating] = useState(5);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>(readReceipts);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [fareError, setFareError] = useState('');
  const [voiceAgentOpen, setVoiceAgentOpen] = useState(false);

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
      Delhi: ['Connaught Place, Delhi', 'Indira Gandhi International Airport, Delhi'],
      Gurugram: ['Cyber City, Gurugram', 'Huda City Centre, Gurugram']
    };
    if (defaults[next]) {
      setPickup(defaults[next][0]);
      setDestination(defaults[next][1]);
    }
    clearFareEstimate();
    flash(`Service city switched to ${next}`);
  };

  const clearFareEstimate = () => {
    fareRequestId.current += 1;
    setFare(null);
    setFareError('');
    setFareBusy(false);
  };

  const estimateFare = async () => {
    const requestId = ++fareRequestId.current;
    setFare(null);
    setFareError('');
    setFareBusy(true);
    try {
      const response = await fetch('/api/fare/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripType, hours, date, time, vehicle, pickup, destination, city })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to estimate this route.');
      if (requestId === fareRequestId.current) setFare(result);
    } catch (error: any) {
      if (requestId === fareRequestId.current) setFareError(error.message || 'Location lookup is unavailable. Please try again.');
    } finally {
      if (requestId === fareRequestId.current) setFareBusy(false);
    }
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
      if (d.user.city === 'Delhi' || d.user.city === 'Gurugram') chooseCity(d.user.city);
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

  const register = async (name: string, email: string, password: string, accountCity: string, phone = '', role = 'customer', vehicle = 'Sedan', licenseNumber = '') => {
    setBusy(true);
    try {
      const d = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city: accountCity, role, phone, vehicle, licenseNumber })
      });
      localStorage.setItem('vs_token', d.token);
      localStorage.setItem('vs_user', JSON.stringify(d.user));
      setUser(d.user);
      chooseCity(accountCity);
      setPage(d.user.role === 'driver' ? 'Requests' : 'Home');
      setModal('');
      const msg = d.user.role === 'driver'
        ? `Driver account created! Your profile is under review — you'll be verified within 24 hours.`
        : `Account created! Welcome to VaahanSathi, ${d.user.name.split(' ')[0]}.`;
      flash(msg);
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

  const applyVoiceTrip = (intent: any) => {
    const supportedCities = ['Delhi', 'Gurugram'];
    const nextCity = supportedCities.includes(intent.city) ? intent.city : city;
    setCity(nextCity);
    localStorage.setItem('vs_city', nextCity);
    if (intent.tripType) setTripType(intent.tripType);
    if (intent.hours) setHours(Number(intent.hours));
    if (intent.pickup) setPickup(intent.pickup);
    if (intent.destination) setDestination(intent.destination);
    if (intent.date) setDate(intent.date);
    if (intent.time) setTime(intent.time);
    clearFareEstimate();
    setPage('Book a driver');
    flash('Trip details understood. Confirm the booking with the voice agent.');
  };

  const bookFromVoice = async (intent: any) => {
    if (!user) {
      applyVoiceTrip(intent);
      setVoiceAgentOpen(false);
      setModal('auth');
      flash('Sign in once to complete this voice booking. Your trip details are saved.');
      return;
    }
    setBusy(true);
    try {
      const d = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          tripType: intent.tripType || tripType,
          pickup: intent.pickup || pickup,
          destination: intent.destination || destination,
          date: intent.date || date,
          time: intent.time || time,
          hours: Number(intent.hours || hours),
          vehicle,
          city: intent.city || city
        })
      });
      await refresh();
      setVoiceAgentOpen(false);
      setPage('Your trips');
      flash(`Voice booking confirmed: ${d.booking.id}`);
    } catch (e: any) {
      flash(e.message || 'The booking could not be completed.');
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
          {nav.map((x, index) => {
            const adminSection = user?.role === 'admin' && ({ 0: 'Monitor', 2: 'Manage', 5: 'Money', 6: 'Resolve', 10: 'Workspace' } as Record<number, string>)[index];
            return <React.Fragment key={x}>
              {adminSection && <div className="nav-section-label">{adminSection}</div>}
              <button
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
                  {x === 'Bookings' && <CalendarDays size={18} />}
                  {x === 'Drivers' && <BadgeCheck size={18} />}
                  {x === 'Customers' && <Heart size={18} />}
                  {(x === 'Pricing' || x === 'Pricing & Revenue') && <IndianRupee size={18} />}
                  {(x === 'Payments & Payouts' || x === 'Wallet') && <CreditCard size={18} />}
                  {x === 'Disputes' && <Headphones size={18} />}
                  {x === 'Analytics' && <ArrowDownUp size={18} />}
                  {(x === 'Audit Logs' || x === 'Activity') && <Clock3 size={18} />}
                  {x === 'Settings' && <ShieldCheck size={18} />}
                  {x === 'Help' && <Headphones size={18} />}
                  {x === 'Profile' && <ShieldCheck size={18} />}
                </span>
                <span>{x === 'Requests' || x === 'Overview' ? 'Dashboard' : x}</span>
                {x === 'Your trips' && bookings.length > 0 && <em className="badge">{bookings.length}</em>}
                {x === 'Requests' && bookings.filter((b) => b.status === 'Searching').length > 0 && (
                  <em className="badge active">{bookings.filter((b) => b.status === 'Searching').length}</em>
                )}
              </button>
            </React.Fragment>;
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="db-indicator">
            <span className={`db-pulse ${storageReady ? 'online' : 'connecting'}`} />
            <div className="db-text">
              <b>{storageReady ? 'Cloud data connected' : 'Syncing workspace...'}</b>
              <small>{storageReady ? 'All systems operational' : 'Checking connection'}</small>
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
            <button className="voice-top-btn" onClick={() => setVoiceAgentOpen(true)} aria-label="Open voice booking">
              <Mic size={16} /> <span>Voice booking</span>
            </button>
            {/* Database indicator pill */}
            <div className={`db-pill ${storageReady ? 'connected' : 'connecting'}`} title="Neon DB status">
              <Database size={14} />
              <span>{storageReady ? 'System operational' : 'Syncing status...'}</span>
            </div>

            {/* City Selector */}
            <label className="city-pill">
              <MapPin size={15} className="city-pin" />
              <select value={city} onChange={(e) => chooseCity(e.target.value)}>
                <option value="Delhi">Delhi</option>
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
                  </div>
                  <div className="hero-highlights">
                    <span><ShieldCheck size={16} /> Thoroughly Police & Skill Verified</span>
                    <span><MapPin size={16} /> {city} Service Area</span>
                    <span><IndianRupee size={16} /> Transparent Fixed Fares</span>
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
                  { id: 'Hourly', title: 'Hourly Driver', desc: 'From ₹599 · 4 Hours', icon: '01' },
                  { id: 'Airport', title: 'Airport Transfer', desc: 'Stress-free terminal drops', icon: '02' },
                  { id: 'Night driver', title: 'Night Driver', desc: 'Party or late commute safely', icon: '03' },
                  { id: 'Full day', title: 'Full Day Chauffeur', desc: '8-12 hrs seamless city travel', icon: '04' },
                  { id: 'Outstation', title: 'Outstation Trip', desc: 'Highway experienced drivers', icon: '05' },
                  { id: 'Custom', title: 'Custom Duration', desc: 'Flexible schedule & stops', icon: '06' }
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
                      <span>Delhi</span>
                      <span>Gurugram</span>
                    </div>
                  </div>
                </section>
              </div>

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
              fareBusy={fareBusy}
              onEstimate={estimateFare}
              clearFare={clearFareEstimate}
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

          {page === 'Requests' && <DriverPage bookings={bookings} update={updateStatus} user={user} onDutyChange={(v: boolean) => setUser((u: any) => u ? {...u, available: v} : u)} flash={flash} />}
          {page === 'My trips' && <TripsPage bookings={bookings} filter={filter} setFilter={setFilter} update={updateStatus} onRate={(b: Booking) => setModal('rate:' + b.id)} onPay={(b: Booking) => setModal('payment:' + b.id)} onTrack={(b: Booking) => setModal('track:' + b.id)} onBook={() => setPage('Book a driver')} receipts={receipts} />}
          {page === 'Earnings' && <EarningsPage bookings={bookings} />}
          {page === 'Wallet' && <WalletPage receipts={receipts} bookings={bookings} onReceipt={downloadReceipt} />}
          {page === 'Help' && <HelpPage flash={flash} onDispute={() => setModal('dispute')} />}
          {page === 'Profile' && <DriverProfile user={user} onUpdate={(u: any) => { setUser(u); localStorage.setItem('vs_user', JSON.stringify(u)); }} flash={flash} />}
          {page === 'Overview' && <LiveAdminPage bookings={bookings} focus="Overview" flash={flash} />}
          {page === 'Live trips' && <LiveAdminPage bookings={bookings} focus="Trips" flash={flash} />}
          {page === 'Bookings' && <AdminModulePage module="bookings" bookings={bookings} flash={flash} />}
          {page === 'Drivers' && <AdminModulePage module="drivers" bookings={bookings} flash={flash} />}
          {page === 'Customers' && <AdminModulePage module="customers" bookings={bookings} flash={flash} />}
          {page === 'Payments & Payouts' && <AdminModulePage module="payments" bookings={bookings} flash={flash} />}
          {page === 'Disputes' && <AdminModulePage module="disputes" bookings={bookings} flash={flash} />}
          {page === 'Pricing & Revenue' && <LiveAdminPage bookings={bookings} focus="Pricing" flash={flash} />}
          {page === 'Analytics' && <AdminModulePage module="analytics" bookings={bookings} flash={flash} />}
          {page === 'Audit Logs' && <AdminModulePage module="audit" bookings={bookings} flash={flash} />}
          {page === 'Settings' && <AdminModulePage module="settings" bookings={bookings} flash={flash} />}
        </div>
      </main>

      {/* Modals */}
      {voiceAgentOpen && (
        <VoiceAgentModal onClose={() => setVoiceAgentOpen(false)} onApply={applyVoiceTrip} onBook={bookFromVoice} city={city} />
      )}
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

      {/* Dispute filing modal */}
      {modal === 'dispute' && (
        <DisputeModal
          bookings={bookings}
          onClose={() => setModal('')}
          onSubmit={async (bookingId: string, subject: string, description: string) => {
            try {
              await api('/disputes', {
                method: 'POST',
                body: JSON.stringify({ bookingId, subject, description })
              });
              setModal('');
              flash('Dispute filed. Our team will review and respond within 24 hours.');
            } catch (e: any) {
              flash(e.message);
            }
          }}
        />
      )}

      {/* Mobile bottom nav bar */}
      {user && (
        <nav className="bottom-nav">
          {(user.role === 'customer'
            ? [
                { label: 'Home', icon: <CarFront size={20} />, page: 'Home' },
                { label: 'Book', icon: <Plus size={20} />, page: 'Book a driver' },
                { label: 'Trips', icon: <CalendarDays size={20} />, page: 'Your trips', badge: bookings.filter(b => ['Searching','Driver assigned','Driver arriving','Trip started'].includes(b.status)).length },
                { label: 'Wallet', icon: <Wallet size={20} />, page: 'Wallet' },
                { label: 'Help', icon: <Headphones size={20} />, page: 'Help' },
              ]
            : user.role === 'driver'
            ? [
                { label: 'Dashboard', icon: <Navigation size={20} />, page: 'Requests', badge: bookings.filter(b => b.status === 'Searching').length },
                { label: 'My Trips', icon: <CalendarDays size={20} />, page: 'My trips' },
                { label: 'Earnings', icon: <Wallet size={20} />, page: 'Earnings' },
                { label: 'Profile', icon: <UserIcon size={20} />, page: 'Profile' },
              ]
            : [
                { label: 'Overview', icon: <Activity size={20} />, page: 'Overview' },
                { label: 'Bookings', icon: <CalendarDays size={20} />, page: 'Bookings' },
                { label: 'Drivers', icon: <BadgeCheck size={20} />, page: 'Drivers' },
                { label: 'Disputes', icon: <Headphones size={20} />, page: 'Disputes' },
              ]
          ).map((item) => (
            <button
              key={item.page}
              className={`bottom-nav-item ${page === item.page ? 'active' : ''}`}
              onClick={() => { setPage(item.page); setMobileOpen(false); }}
            >
              {(item as any).badge > 0 && <span className="bnav-badge">{(item as any).badge}</span>}
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
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
  const clearFare = () => p.clearFare?.();
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
                onClick={() => {
                  p.setTripType(t);
                  clearFare();
                }}
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
                onChange={(e) => {
                  p.setPickup(e.target.value);
                  clearFare();
                }}
                placeholder={`Enter any pickup address in ${p.city}`}
              />
            </label>

            <button
              className="swap-btn"
              title="Swap locations"
              onClick={() => {
                const temp = p.pickup;
                p.setPickup(p.destination);
                p.setDestination(temp);
                clearFare();
              }}
            >
              <ArrowDownUp size={16} />
            </button>

            <label className="field-group full">
              <span><Navigation size={15} /> Destination</span>
              <input
                value={p.destination}
                onChange={(e) => {
                  p.setDestination(e.target.value);
                  clearFare();
                }}
                placeholder={`Enter any destination in ${p.city}`}
              />
            </label>

            <label className="field-group">
              <span><CalendarDays size={15} /> Date</span>
              <input
                type="date"
                value={p.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  p.setDate(e.target.value);
                  clearFare();
                }}
              />
            </label>

            <label className="field-group">
              <span><Clock3 size={15} /> Pickup Time</span>
              <input type="time" value={p.time} onChange={(e) => {
                p.setTime(e.target.value);
                clearFare();
              }} />
            </label>

            {(p.tripType === 'Hourly' || p.tripType === 'Custom') && (
              <label className="field-group">
                <span><Clock3 size={15} /> Duration</span>
                <select value={p.hours} onChange={(e) => {
                  p.setHours(Number(e.target.value));
                  clearFare();
                }}>
                  {[4, 5, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>{n} Hours</option>
                  ))}
                </select>
              </label>
            )}

            <label className="field-group">
              <span><CarFront size={15} /> Your Car Type</span>
              <select value={p.vehicle} onChange={(e) => {
                p.setVehicle(e.target.value);
                clearFare();
              }}>
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
          <p className="location-lookup-note">
            When you estimate the fare, the pickup and destination are looked up with OpenStreetMap. © OpenStreetMap contributors.
          </p>
          <button
            type="button"
            className="estimate-fare-btn"
            onClick={p.onEstimate}
            disabled={p.fareBusy || !p.pickup.trim() || !p.destination.trim()}
          >
            {p.fareBusy ? 'Looking up locations…' : p.fare ? 'Refresh fare estimate' : 'Estimate fare'}
            <ArrowRight size={16} />
          </button>
          {p.fareError && <p className="fare-error" role="alert">{p.fareError}</p>}
        </div>

        {/* Fare Summary Card */}
        <aside className="fare-card panel">
          <span className="eyebrow">TRANSPARENT FARE</span>
          <h2>{p.fareBusy ? 'Calculating...' : p.fare ? money(p.fare.total) : '—'}</h2>
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
            disabled={p.busy || p.fareBusy || !p.fare}
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
function DriverPage({ bookings, update, user, onDutyChange, flash }: any) {
  const [available, setAvailable] = useState<boolean>(user?.available !== false);
  const [dutyBusy, setDutyBusy] = useState(false);

  const toggleDuty = async () => {
    setDutyBusy(true);
    try {
      const d = await api('/driver/duty', {
        method: 'PATCH',
        body: JSON.stringify({ available: !available })
      });
      setAvailable(d.available);
      onDutyChange?.(d.available);
      flash?.(d.available ? 'You are now Online — accepting ride requests.' : 'You are now Offline — no new requests.');
    } catch (e: any) {
      flash?.(e.message);
    } finally {
      setDutyBusy(false);
    }
  };

  const own = bookings.filter(
    (b: Booking) => b.driverId === user?.id || (available && ['Searching'].includes(b.status))
  );

  const completed = bookings.filter((b: Booking) => b.driverId === user?.id && b.status === 'Trip completed');
  const totalEarnings = completed.reduce((s: number, b: Booking) => s + b.payout, 0);

  return (
    <div className="driver-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">PARTNER PORTAL</span>
          <h1>Driver Dashboard</h1>
          <p>Welcome, {user?.name || 'Driver Partner'}. Manage your requests, trips, and earnings.</p>
        </div>
        {user?.verificationStatus === 'pending' && (
          <span className="pending-badge"><Clock3 size={12} /> Verification pending</span>
        )}
        {user?.verificationStatus === 'verified' && (
          <div className="service-market-pill">
            <BadgeCheck size={16} color="#087f72" /> Verified Partner ({user?.city || 'Delhi'})
          </div>
        )}
      </div>

      {/* Real duty toggle — wired to backend */}
      <div className="duty-toggle-row">
        <div>
          <b>{available ? '● Online — Accepting Requests' : '○ Offline — Not Accepting'}</b>
          <small>{available ? 'Customers in your city can assign trips to you.' : 'Go online to receive new ride requests.'}</small>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={available}
            disabled={dutyBusy}
            onChange={toggleDuty}
          />
          <span className="toggle-track" />
        </label>
      </div>

      <div className="stats-cards-grid">
        <div className="stat-card panel">
          <small>TOTAL EARNINGS</small>
          <b>{money(totalEarnings)}</b>
          <span>80% driver direct share</span>
        </div>
        <div className="stat-card panel">
          <small>COMPLETED TRIPS</small>
          <b>{completed.length}</b>
          <span>All time</span>
        </div>
        <div className="stat-card panel">
          <small>PARTNER RATING</small>
          <b>★ {user?.rating || '5.0'}</b>
          <span>Customer average</span>
        </div>
        <div className="stat-card panel">
          <small>DUTY STATUS</small>
          <b className={available ? 'status-online' : ''}>{available ? '● Online' : '○ Offline'}</b>
          <span>{available ? 'Accepting requests' : 'Duty off'}</span>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h3>Ride Requests & Active Duties</h3>
          <p>{available ? `Showing open requests in ${user?.city || 'your city'} and your assigned trips.` : 'Go online to see new ride requests.'}</p>
        </div>
      </div>

      {!available && own.filter((b: Booking) => b.driverId === user?.id).length === 0 ? (
        <div className="panel empty-state">
          <Power size={42} className="empty-icon" />
          <h3>You're offline</h3>
          <p>Toggle duty on above to start accepting ride requests in {user?.city || 'your city'}.</p>
        </div>
      ) : own.length === 0 ? (
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
      flash?.('Pricing configuration saved.');
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
          <h1>{focus === 'Overview' ? 'Admin Dashboard' : 'Network operations'}</h1>
          <p>Monitor bookings, drivers, revenue, and service operations across Delhi and Gurugram.</p>
        </div>
        <div className="service-market-pill">
          <Activity size={15} /> Operations live
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
        <div className="stat-card panel">
          <small>CUSTOMERS</small>
          <b>{summary.customers || 0}</b>
          <span>Registered accounts</span>
        </div>
        <div className="stat-card panel">
          <small>DRIVERS</small>
          <b>{summary.drivers || 0}</b>
          <span>Partner accounts</span>
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
function AdminModulePage({ module, bookings, flash }: { module: string; bookings: Booking[]; flash?: (s: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [driverRows, setDriverRows] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      if (module === 'customers') {
        const r = await api('/admin/users?role=customer');
        setRows(r.users || []);
      } else if (module === 'drivers') {
        const r = await api('/admin/users?role=driver');
        setDriverRows(r.users || []);
      } else if (module === 'audit') {
        const r = await api('/admin/audit-logs');
        setRows(r.logs || []);
      } else if (module === 'disputes') {
        const r = await api('/admin/disputes');
        setRows(r.disputes || []);
      } else if (module === 'payments') {
        const r = await api('/admin/payments');
        setRows(r.payments || []);
      }
      setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [module]);

  const updateDriverVerification = async (driverId: string, status: string) => {
    try {
      await api(`/admin/drivers/${driverId}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      flash?.(status === 'verified' ? 'Driver approved and verified.' : 'Driver rejected.');
      load();
    } catch (e: any) { flash?.(e.message); }
  };

  const resolveDispute = async (disputeId: string, status: string) => {
    const resolution = prompt('Enter resolution note:');
    if (!resolution) return;
    try {
      await api(`/admin/disputes/${disputeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolution })
      });
      flash?.('Dispute updated.');
      load();
    } catch (e: any) { flash?.(e.message); }
  };

  const title: Record<string, string> = {
    bookings: 'Booking management', customers: 'Customer management',
    drivers: 'Driver partner network', payments: 'Payments & driver payouts',
    disputes: 'Dispute resolution', analytics: 'Network analytics',
    audit: 'Immutable audit logs', settings: 'Operations settings'
  };
  const subtitle: Record<string, string> = {
    bookings: 'Search, filter, and inspect every trip in the network.',
    customers: 'Customer profiles, spend, activity, and support context.',
    drivers: 'Review, approve, and manage driver partner accounts.',
    payments: 'Customer GMV, platform revenue, refunds, and driver payouts.',
    disputes: 'Resolve complaints with an accountable, auditable workflow.',
    analytics: 'Growth, quality, utilisation, and unit economics.',
    audit: 'Every critical admin action is recorded and cannot be deleted.',
    settings: 'Configure role-aware operations controls and integrations.'
  };

  const filteredBookings = bookings.filter((b) =>
    `${b.id} ${b.customer || ''} ${b.driver || ''} ${b.pickup} ${b.destination}`.toLowerCase().includes(query.toLowerCase())
  );
  const filteredRows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const filteredDriverRows = driverRows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="admin-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">OPERATIONS CONSOLE</span>
          <h1>{title[module] || module}</h1>
          <p>{subtitle[module] || ''}</p>
        </div>
        <span className="service-market-pill"><Database size={15} /> Role-protected</span>
      </div>

      <div className="admin-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={module === 'audit' ? 'Search admin, action, target…' : 'Search by name, ID, route…'}
        />
        <button className="secondary-btn" onClick={() => setQuery('')}>Clear</button>
        <button className="secondary-btn" onClick={load}>Refresh</button>
      </div>

      {error && <div className="inline-error">{error}</div>}

      {module === 'analytics' ? (
        <div className="stats-cards-grid">
          <div className="stat-card panel"><small>COMPLETION RATE</small><b>{bookings.length ? Math.round(bookings.filter((b) => b.status === 'Trip completed').length / bookings.length * 100) : 0}%</b><span>Completed bookings</span></div>
          <div className="stat-card panel"><small>GMV</small><b>{money(bookings.reduce((n, b) => n + Number(b.total || 0), 0))}</b><span>Customer booking value</span></div>
          <div className="stat-card panel"><small>DRIVER PAYOUTS</small><b>{money(bookings.reduce((n, b) => n + Number(b.payout || 0), 0))}</b><span>Separate from platform revenue</span></div>
          <div className="stat-card panel"><small>TAKE RATE</small><b>{bookings.length ? Math.round(bookings.reduce((n, b) => n + Number(b.commission || 0), 0) / Math.max(1, bookings.reduce((n, b) => n + Number(b.total || 0), 0)) * 100) : 0}%</b><span>Platform commission</span></div>
          <div className="stat-card panel"><small>AVG BOOKING VALUE</small><b>{bookings.length ? money(Math.round(bookings.reduce((n, b) => n + Number(b.total || 0), 0) / bookings.length)) : '₹0'}</b><span>Per trip</span></div>
          <div className="stat-card panel"><small>TRIPS IN PROGRESS</small><b>{bookings.filter((b) => ['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status)).length}</b><span>Active right now</span></div>
        </div>
      ) : module === 'settings' ? (
        <section className="panel empty-state">
          <ShieldCheck size={28} />
          <h3>Protected operations workspace</h3>
          <p>Admin access is enforced by signed server sessions. Pricing changes, verification decisions, refunds, payout actions, and role changes must be handled through privileged API routes and are written to Audit Logs.</p>
        </section>
      ) : module === 'drivers' ? (
        <section className="panel">
          <div className="panel-header">
            <div><h3>Driver Partner Network</h3><p>{loading ? 'Loading…' : `${filteredDriverRows.length} drivers`}</p></div>
          </div>
          {loading ? <div className="data-loading">Loading driver accounts…</div> : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead><tr><th>DRIVER</th><th>CONTACT</th><th>CITY / VEHICLE</th><th>STATUS</th><th>TRIPS / RATING</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {filteredDriverRows.map((r: any) => (
                    <tr key={r.id}>
                      <td><b>{r.name}</b><small>{r.id}</small></td>
                      <td>{r.phone || '—'}<small>{r.email}</small></td>
                      <td>{r.city || '—'}<small>{r.vehicle || 'Sedan'}</small></td>
                      <td>
                        <span className={`status-pill ${r.verificationStatus === 'verified' ? 'done' : ''}`}>
                          {r.verificationStatus || 'pending'}
                        </span>
                      </td>
                      <td>{r.trips || 0} trips<small>★ {r.rating || '5.0'}</small></td>
                      <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {r.verificationStatus !== 'verified' && (
                          <button className="inline-action-btn success" onClick={() => updateDriverVerification(r.id, 'verified')}>
                            Approve
                          </button>
                        )}
                        {r.verificationStatus === 'verified' && (
                          <button className="inline-action-btn danger" onClick={() => updateDriverVerification(r.id, 'rejected')}>
                            Reject
                          </button>
                        )}
                        {r.verificationStatus === 'pending' && (
                          <button className="inline-action-btn danger" onClick={() => updateDriverVerification(r.id, 'rejected')}>
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDriverRows.length === 0 && <div className="empty-state"><p>No drivers match this search.</p></div>}
            </div>
          )}
        </section>
      ) : (
        <section className="panel bookings-table-panel">
          <div className="panel-header">
            <div>
              <h3>{module === 'bookings' ? 'Bookings' : module === 'customers' ? 'Customers' : module === 'payments' ? 'Payments and payouts' : module === 'disputes' ? 'Open cases' : 'Activity history'}</h3>
              <p>{loading ? 'Loading live records…' : `${(module === 'bookings' ? filteredBookings : filteredRows).length} records`}</p>
            </div>
            <span className="status-pill done">Live data</span>
          </div>
          {loading ? <div className="data-loading">Loading records…</div> : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    {module === 'bookings' ? <><th>BOOKING</th><th>ROUTE</th><th>CUSTOMER / DRIVER</th><th>FARE</th><th>STATUS</th></> :
                     module === 'customers' ? <><th>CUSTOMER</th><th>CONTACT</th><th>CITY</th><th>ACCOUNT</th></> :
                     module === 'payments' ? <><th>PAYMENT</th><th>BOOKING</th><th>AMOUNT</th><th>STATUS</th></> :
                     module === 'disputes' ? <><th>CASE</th><th>FILED BY</th><th>SUBJECT</th><th>STATUS</th><th>ACTIONS</th></> :
                     <><th>TIMESTAMP</th><th>ADMIN / ROLE</th><th>ACTION</th><th>TARGET</th></>}
                  </tr>
                </thead>
                <tbody>
                  {(module === 'bookings' ? filteredBookings : filteredRows).map((r: any, i: number) =>
                    module === 'bookings' ? (
                      <tr key={r.id}>
                        <td><b>{r.id}</b><small>{r.date} · {r.time}</small></td>
                        <td>{r.pickup} → {r.destination}<small>{r.city}</small></td>
                        <td>{r.customer || 'Customer'}<small>Driver: {r.driver || 'Unassigned'}</small></td>
                        <td><b>{money(r.total)}</b><small>Platform {money(r.commission)}</small></td>
                        <td><span className="status-pill">{r.status}</span></td>
                      </tr>
                    ) : module === 'customers' ? (
                      <tr key={r.id || i}>
                        <td><b>{r.name}</b><small>{r.id}</small></td>
                        <td>{r.phone || '—'}<small>{r.email}</small></td>
                        <td>{r.city || '—'}</td>
                        <td><span className="status-pill done">Active</span></td>
                      </tr>
                    ) : module === 'payments' ? (
                      <tr key={r.id || i}>
                        <td><b>{r.id || 'Payment'}</b></td>
                        <td>{r.bookingId || r.booking_id || '—'}</td>
                        <td>{money(r.amount || r.total || 0)}</td>
                        <td><span className="status-pill">{r.status || r.payment_status || 'Pending'}</span></td>
                      </tr>
                    ) : module === 'disputes' ? (
                      <tr key={r.id || i}>
                        <td><b>{String(r.id || 'Case').slice(0, 8)}…</b><small>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—'}</small></td>
                        <td>{r.userName || '—'}</td>
                        <td>{r.subject || 'General complaint'}<small>{r.bookingId || '—'}</small></td>
                        <td><span className={`status-pill ${r.status === 'resolved' ? 'done' : ''}`}>{r.status || 'open'}</span></td>
                        <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {r.status === 'open' && (
                            <>
                              <button className="inline-action-btn success" onClick={() => resolveDispute(r.id, 'resolved')}>Resolve</button>
                              <button className="inline-action-btn danger" onClick={() => resolveDispute(r.id, 'closed')}>Close</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id || i}>
                        <td>{r.timestamp ? new Date(r.timestamp).toLocaleString('en-IN') : '—'}</td>
                        <td>{r.adminName || 'Admin'}<small>{r.adminRole || 'operations_admin'}</small></td>
                        <td><b>{r.action || '—'}</b><small>{r.description}</small></td>
                        <td>{r.targetId || '—'}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              {!loading && (module === 'bookings' ? filteredBookings : filteredRows).length === 0 && (
                <div className="empty-state"><Activity size={24} /><p>No records match this search.</p></div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
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

function HelpPage({ flash, onDispute }: any) {
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

        <button className="panel help-action-card" onClick={onDispute}>
          <AlertCircle size={28} />
          <b>File a Dispute</b>
          <p>Report a problem with a trip, fare, or driver behaviour.</p>
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

function DriverProfile({ user, onUpdate, flash }: any) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [vehicle, setVehicle] = useState(user?.vehicle || 'Sedan');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone, vehicle })
      });
      onUpdate?.(d.user);
      setEditing(false);
      flash?.('Profile updated successfully.');
    } catch (e: any) {
      flash?.(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">PARTNER PROFILE</span>
          <h1>Driver Account</h1>
          <p>Personal and verification details.</p>
        </div>
        {!editing && (
          <button className="primary-btn" onClick={() => setEditing(true)}>
            <Edit2 size={15} /> Edit Profile
          </button>
        )}
      </div>

      <div className="panel profile-edit-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div className="profile-avatar-large">{user?.name ? user.name[0] : 'V'}</div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--navy)' }}>{user?.name || 'Driver Partner'}</h2>
            <p style={{ color: 'var(--slate-500)', fontSize: '14px' }}>{user?.email}</p>
            <span className={`status-pill ${user?.verificationStatus === 'verified' ? 'done' : ''}`} style={{ marginTop: '6px', display: 'inline-block' }}>
              {user?.verificationStatus === 'verified' ? '✓ Verified Partner' : user?.verificationStatus === 'pending' ? '⏳ Verification Pending' : 'Unverified'} · {user?.city || 'Delhi'}
            </span>
          </div>
        </div>

        {editing ? (
          <div>
            <div className="field-group" style={{ marginBottom: '14px' }}>
              <span>Full Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field-group" style={{ marginBottom: '14px' }}>
              <span>Phone Number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43211" />
            </div>
            <div className="field-group" style={{ marginBottom: '20px' }}>
              <span><Car size={13} /> Vehicle Class</span>
              <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Luxury">Luxury</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
              <button className="action-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--slate-500)' }}>Phone</span>
              <b>{user?.phone || '—'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--slate-500)' }}>Vehicle class</span>
              <b>{user?.vehicle || 'Sedan'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--slate-500)' }}>City</span>
              <b>{user?.city || 'Delhi'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--slate-500)' }}>Total trips</span>
              <b>{user?.trips || 0}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--slate-500)' }}>Rating</span>
              <b>★ {user?.rating || '5.0'}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------- Interactive Modals -----------------
function VoiceAgentModal({ onClose, onApply, onBook, city }: { onClose: () => void; onApply: (intent: any) => void; onBook: (intent: any) => void; city: string }) {
  const languages = [
    { label: 'English', code: 'en-IN', speech: 'Tell me your pickup, destination, duration, and preferred time.' },
    { label: 'हिन्दी', code: 'hi-IN', speech: 'पिकअप, गंतव्य, अवधि और समय बताइए।' },
    { label: 'Hinglish', code: 'en-IN', speech: 'Pickup, destination, duration aur time bataiye.' },
    { label: 'ಕನ್ನಡ', code: 'kn-IN', speech: 'ನಿಮ್ಮ ಪಿಕಪ್, ಗಮ್ಯಸ್ಥಾನ, ಅವಧಿ ಮತ್ತು ಸಮಯವನ್ನು ಹೇಳಿ.' },
    { label: 'தமிழ்', code: 'ta-IN', speech: 'பிக்கப், செல்லும் இடம், நேரம் மற்றும் கால அளவைச் சொல்லுங்கள்.' },
    { label: 'తెలుగు', code: 'te-IN', speech: 'పికప్, గమ్యం, వ్యవధి మరియు సమయం చెప్పండి.' }
  ];
  const [language, setLanguage] = useState(languages[0]);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [notice, setNotice] = useState('');
  const [stage, setStage] = useState<'capture' | 'confirm'>('capture');
  const [intent, setIntent] = useState<any>(null);
  const recognitionRef = React.useRef<any>(null);
  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.code;
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  };
  const startListening = (confirmation = false) => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setNotice('Voice capture is not available in this browser. Type your request below instead.'); return; }
    const recognition = new Recognition();
    recognition.lang = language.code;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => { setListening(true); setNotice(confirmation ? 'Listening for your confirmation…' : 'Listening…'); };
    recognition.onresult = (event: any) => {
      const value = Array.from(event.results).map((result: any) => result[0]?.transcript || '').join('');
      if (confirmation) {
        const accepted = /confirm|book|yes|okay|ok|हाँ|हां|पक्का|कर दो|ಹೌದು|சரி|అవును/i.test(value);
        setNotice(accepted ? 'Confirmed. Booking your trip…' : 'I heard that, but I need “confirm” to book.');
        if (accepted && intent) onBook(intent);
      } else {
        setTranscript(value);
      }
    };
    recognition.onerror = () => { setListening(false); setNotice('I could not hear that clearly. Please try again or type it below.'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };
  const stopListening = () => { recognitionRef.current?.stop(); setListening(false); };
  useEffect(() => {
    const timer = window.setTimeout(() => startListening(false), 250);
    return () => { window.clearTimeout(timer); recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); };
  }, []);
  const interpret = async () => {
    if (!transcript.trim()) { setNotice('Tell me where you are starting, where you are going, and when you need the driver.'); return; }
    setInterpreting(true); setNotice('Understanding your request…');
    try {
      const result = await api('/voice/intent', { method: 'POST', body: JSON.stringify({ text: transcript, language: language.code, city }) });
      setIntent(result);
      onApply(result);
      setStage('confirm');
      const confirmation = `${result.summary || 'I have understood your trip.'} Say confirm to book, or review the details first.`;
      setNotice(confirmation);
      speak(confirmation);
    } catch (e: any) { setNotice(e.message || 'I could not understand that request.'); }
    finally { setInterpreting(false); }
  };
  const confirmByVoice = () => startListening(true);
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal voice-agent-modal">
      <button className="modal-close-btn" onClick={onClose} aria-label="Close voice booking"><X size={18} /></button>
      <div className="voice-agent-header"><div className={`voice-agent-mark ${listening ? 'listening' : ''}`}><Mic size={22} /></div><div><span className="eyebrow">VOICE BOOKING</span><h2>{stage === 'capture' ? 'Tell me about your trip' : 'Ready to book?'}</h2><p className="modal-sub">{stage === 'capture' ? 'Speak naturally. I will listen and prepare the trip.' : 'I have filled the booking details. Confirm when ready.'}</p></div></div>
      {stage === 'capture' ? <>
        <label className="field-group"><span>Your language</span><select value={language.code + language.label} onChange={(e) => setLanguage(languages.find((item) => item.code + item.label === e.target.value) || languages[0])}>{languages.map((item) => <option key={item.code + item.label} value={item.code + item.label}>{item.label}</option>)}</select></label>
        <button className={`listen-btn ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : () => startListening(false)}><Mic size={18} /> {listening ? 'Stop listening' : 'Start speaking'}</button>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4} placeholder={`Example: “${language.speech}”`} aria-label="Trip request" />
        <div className="voice-agent-hint"><MapPin size={15} /> Service area: {city} · The agent will speak back in your selected language.</div>
        {notice && <p className="voice-agent-notice">{notice}</p>}
        <button className="primary-btn-wide" onClick={interpret} disabled={interpreting || !transcript.trim()}>{interpreting ? 'Understanding…' : 'Review trip details'} <ArrowRight size={17} /></button>
      </> : <>
        <div className="voice-confirm-card"><b>{intent?.tripType || 'Driver'} · {intent?.hours || 4} hours</b><span>{intent?.pickup || 'Pickup'} → {intent?.destination || 'Destination'}</span><small>{intent?.date || 'Date'} at {intent?.time || 'Time'}</small></div>
        {notice && <p className="voice-agent-notice">{notice}</p>}
        <button className={`listen-btn ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : confirmByVoice}><Mic size={18} /> {listening ? 'Listening for confirm' : 'Say confirm to book'}</button>
        <button className="primary-btn-wide" onClick={() => onBook(intent)} disabled={listening}>Confirm and book <ArrowRight size={17} /></button>
        <button className="link-btn voice-change-btn" onClick={() => { setStage('capture'); setNotice('Tell me the corrected trip details.'); }}>Change details</button>
      </>}
    </div>
  </div>;
}

function AuthModal({ onClose, onLogin, onRegister, busy, storageReady }: any) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerRole, setRegisterRole] = useState<'customer' | 'driver'>('customer');
  const [name, setName] = useState('');
  const [city, setCity] = useState('Delhi');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Sedan');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') onLogin(email, password);
    else onRegister(name, email, password, city, phone, registerRole, vehicle, licenseNumber);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal auth-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>

        <div className="modal-brand">
          <CarFront size={26} />
          <span>VaahanSathi</span>
        </div>

        <h2>{mode === 'login' ? 'Sign In to Your Account' : registerRole === 'driver' ? 'Join as Driver Partner' : 'Create Customer Account'}</h2>
        <p className="modal-sub">
          {mode === 'login' ? 'Access your rides and bookings' : registerRole === 'driver' ? 'Drive customers in your city and earn 80% of every fare' : 'Book verified drivers for your personal vehicle'}
        </p>

        {mode === 'login' && (
          <div className="quick-demo-box">
            <span className="quick-label">Quick demo sign-in · password: password123</span>
            <div className="quick-buttons">
              <button type="button" onClick={() => onLogin('ananya@vaahansathi.demo', 'password123')}>Customer</button>
              <button type="button" onClick={() => onLogin('ramesh@vaahansathi.demo', 'password123')}>Driver</button>
              <button type="button" onClick={() => onLogin('admin@vaahansathi.demo', 'password123')}>Admin</button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
              {/* Role selector */}
              <div className="role-switcher">
                <button
                  type="button"
                  className={`role-switcher-btn ${registerRole === 'customer' ? 'active' : ''}`}
                  onClick={() => setRegisterRole('customer')}
                >
                  <UserIcon size={20} />
                  Customer
                  <span>Book a driver for your car</span>
                </button>
                <button
                  type="button"
                  className={`role-switcher-btn ${registerRole === 'driver' ? 'active' : ''}`}
                  onClick={() => setRegisterRole('driver')}
                >
                  <Car size={20} />
                  Driver Partner
                  <span>Earn by driving customer cars</span>
                </button>
              </div>

              <label className="field-group">
                <span>Full Name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
              </label>

              <label className="field-group">
                <span>Phone Number</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </label>

              <label className="field-group">
                <span>City / Service Area</span>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="Delhi">Delhi</option>
                  <option value="Gurugram">Gurugram</option>
                </select>
              </label>

              {registerRole === 'driver' && (
                <>
                  <label className="field-group">
                    <span><Car size={13} /> Vehicle Class You Drive</span>
                    <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                      <option value="Hatchback">Hatchback</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </label>
                  <label className="field-group">
                    <span>Driving Licence Number</span>
                    <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="DL-1420110012345" />
                  </label>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px' }}>
                    <b style={{ color: '#92400e' }}>⏳ Manual verification required</b>
                    <br />Your account will be reviewed within 24 hours. You can log in and go online once approved.
                  </div>
                </>
              )}
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
            {busy ? 'Processing…' : mode === 'login' ? 'Sign In' : registerRole === 'driver' ? 'Apply as Driver Partner' : 'Create Account'}
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

// ----------------- Dispute Modal -----------------
function DisputeModal({ bookings, onClose, onSubmit }: any) {
  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setBusy(true);
    try {
      await onSubmit(bookingId, subject, description);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal dispute-modal">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div className="modal-brand"><AlertCircle size={22} /><span>File a Dispute</span></div>
        <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Report a Problem</h2>
        <p className="modal-sub">Our team reviews and responds within 24 hours.</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field-group">
            <span>Related Booking (optional)</span>
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">No specific booking</option>
              {bookings.map((b: Booking) => (
                <option key={b.id} value={b.id}>{b.id} — {b.pickup.split(',')[0]} → {b.destination.split(',')[0]}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Subject</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} required>
              <option value="">Select a subject…</option>
              <option value="Fare dispute">Fare dispute</option>
              <option value="Driver behaviour">Driver behaviour</option>
              <option value="Trip not completed">Trip not completed</option>
              <option value="OTP issue">OTP issue</option>
              <option value="Payment issue">Payment issue</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="field-group">
            <span>Description</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened in detail…"
              rows={4}
              style={{ width: '100%', padding: '12px', border: '1px solid var(--slate-200)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            />
          </label>
          <button className="primary-btn-wide" type="submit" disabled={busy || !subject || !description}>
            {busy ? 'Submitting…' : 'Submit Dispute'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReceiptIcon(props: any) {
  return <CreditCard {...props} />;
}

createRoot(document.getElementById('root')!).render(<App />);
