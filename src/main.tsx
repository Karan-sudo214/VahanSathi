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
  LockKeyhole,
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
import { LanguageSwitcher } from './i18n';
import {
  firebaseCustomerCreate,
  firebaseCustomerSignIn,
  firebaseGoogleSignIn,
  firebaseSignOut
} from './firebase';

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
  driverStyleTags?: string[];
  driverBadges?: string[];
  driverBatch?: { name: string; completedTrips: number; averageRating: number; nextMilestone: number | null; ratingRequired: number; progressPercent: number; tripsRemaining: number; benefits: string[] };
  cashRewardsPoints?: number;
  available?: boolean;
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
  payment_method?: string;
  requestedDriverStyle?: string;
  driverLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null; speed?: number | null; updatedAt?: string };
  pickupCoordinates?: [number, number];
  destinationCoordinates?: [number, number];
  cashCustomerConfirmed?: boolean;
  cashDriverConfirmed?: boolean;
  cashCustomerAmount?: number;
  cashDriverAmount?: number;
  cashPin?: string;
  cashRewardPoints?: number;
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
    'Service Note: VaahanSathi provides driver-booking services for customer-owned vehicles.',
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
    'VaahanSathi · Driver booking service',
    'Service area and fare details are shown in the booking.'
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
  const [cashHandover, setCashHandover] = useState<{ booking: Booking; mode: 'customer' | 'driver' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tripType, setTripType] = useState('Hourly');
  const [city, setCity] = useState(localStorage.getItem('vs_city') === 'Gurugram' ? 'Gurugram' : 'Delhi');
  const [pickup, setPickup] = useState('Connaught Place, Delhi');
  const [destination, setDestination] = useState('Indira Gandhi International Airport, Delhi');
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState('08:00');
  const [hours, setHours] = useState(4);
  const [vehicle, setVehicle] = useState('Sedan');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [driverStyle, setDriverStyle] = useState('any');
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

  // Drivers poll every 2s for near-realtime incoming requests.
  // Customers poll every 5s to see driver accepted/status updates.
  // Admins poll every 10s.
  useEffect(() => {
    if (!user) return;
    const interval = user.role === 'driver' ? 2000 : user.role === 'customer' ? 5000 : 10000;
    const timer = window.setInterval(() => refresh(), interval);
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

  const completeFirebaseLogin = async (firebaseUser: any, accountCity = 'Delhi', phone = '') => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        city: accountCity,
        phone,
        name: firebaseUser.displayName || ''
      })
    });
    const d = await response.json();
    if (!response.ok) throw new Error(d.error || 'Firebase sign-in could not be completed.');
    localStorage.setItem('vs_token', d.token);
    localStorage.setItem('vs_user', JSON.stringify(d.user));
    setUser(d.user);
    if (d.user.city === 'Delhi' || d.user.city === 'Gurugram') chooseCity(d.user.city);
    setPage('Home');
    setModal('');
    flash(`Welcome to VaahanSathi, ${d.user.name.split(' ')[0]}!`);
  };

  const firebaseCustomerLogin = async (email: string, password: string) => {
    setBusy(true);
    try {
      const credential = await firebaseCustomerSignIn(email, password);
      await completeFirebaseLogin(credential.user);
    } catch (e: any) {
      flash(e.message || 'Customer sign-in failed. Please check your details.');
    } finally {
      setBusy(false);
    }
  };

  const firebaseCustomerRegister = async (name: string, email: string, password: string, accountCity: string, phone = '') => {
    setBusy(true);
    try {
      const credential = await firebaseCustomerCreate(name, email, password);
      await completeFirebaseLogin(credential.user, accountCity, phone);
    } catch (e: any) {
      flash(e.message || 'Customer account could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const firebaseGoogleLogin = async (accountCity = 'Delhi') => {
    setBusy(true);
    try {
      const credential = await firebaseGoogleSignIn();
      await completeFirebaseLogin(credential.user, accountCity);
    } catch (e: any) {
      flash(e.message || 'Google sign-in could not be completed.');
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
        body: JSON.stringify({ tripType, pickup, destination, date, time, hours, vehicle, city, paymentMethod, driverStyle })
      });
      // Refresh immediately so both customer and driver see the new booking without waiting
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
          : status === 'Trip completed' && b.payment_method === 'cash'
          ? 'Trip ended. Waiting for customer and driver cash confirmations before marking it completed.'
          : status === 'Trip completed'
          ? 'Trip completed! Invoice & receipt ready.'
          : `Booking updated: ${status}`
      );
    } catch (e: any) {
      flash(e.message);
    }
  };

  const completePayment = async (b: Booking) => {
    if (!b) return;
    setBusy(true);
    try {
      const orderData = await api('/payments/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({ bookingId: b.id })
      });
      if (!orderData?.keyId || !orderData?.order?.id) throw new Error('Secure checkout could not be started. Please try again.');
      const loadCheckout = () => new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) return resolve();
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Razorpay Checkout could not load. Check your connection and try again.'));
        document.body.appendChild(script);
      });
      await loadCheckout();
      setBusy(false);
      const checkout = new (window as any).Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'VaahanSathi',
        description: 'Driver service booking ' + b.id,
        order_id: orderData.order.id,
        prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
        theme: { color: '#0f766e' },
        handler: async (response: any) => {
          try {
            await api('/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                bookingId: b.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            await refresh();
            setModal('');
            flash('Payment verified successfully. Your booking is paid.');
          } catch (error: any) {
            flash(error?.message || 'Payment verification is pending. Please contact support before paying again.');
          }
        },
        modal: { ondismiss: () => flash('Checkout closed. No payment was confirmed.') }
      });
      checkout.on('payment.failed', (event: any) => {
        flash(event?.error?.description || 'Payment failed. No paid status was recorded.');
      });
      checkout.open();
    } catch (error: any) {
      setBusy(false);
      flash(error?.message || 'Could not start secure payment.');
    }
  };

  const confirmCashAsCustomer = async (booking: Booking, amountGiven: number) => {
    try {
      const result = await api('/payments/cash/customer-confirm', { method: 'POST', body: JSON.stringify({ bookingId: booking.id, amountGiven }) });
      await refresh();
      flash(result.payment_status === 'Paid · Cash' ? 'Cash handover verified. Your receipt is ready.' : result.payment_status);
      return true;
    } catch (error: any) { flash(error.message || 'Cash confirmation could not be saved.'); return false; }
  };

  const confirmCashAsDriver = async (booking: Booking, amountReceived: number, cashPin: string) => {
    try {
      const result = await api('/payments/cash/driver-confirm', { method: 'POST', body: JSON.stringify({ bookingId: booking.id, amountReceived, cashPin }) });
      await refresh();
      flash(result.payment_status === 'Paid · Cash' ? 'Cash receipt verified and recorded.' : result.payment_status);
      return true;
    } catch (error: any) { flash(error.message || 'Cash receipt could not be verified.'); return false; }
  };

  const openCustomerCashHandover = (booking: Booking) => setCashHandover({ booking, mode: 'customer' });
  const openDriverCashHandover = (booking: Booking) => setCashHandover({ booking, mode: 'driver' });

  const logout = () => {
    if (user?.role === 'customer') {
      firebaseSignOut().catch(() => {});
    }
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
      <LanguageSwitcher />
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
            <span className={`db-pulse ${storageReady === null ? 'connecting' : storageReady ? 'online' : 'offline'}`} />
            <div className="db-text">
              <b>{storageReady === null ? 'Checking cloud storage…' : storageReady ? 'Cloud data connected' : 'Cloud storage unavailable'}</b>
              <small>{storageReady === null ? 'Checking connection' : storageReady ? 'Changes sync to the database' : 'Demo data may reset after a restart'}</small>
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
            <div className="topbar-brand">
              <div className="topbar-logo"><CarFront size={16} /></div>
              <span className="topbar-title">VaahanSathi</span>
            </div>
          </div>

          <div className="top-actions">
            <button className="voice-top-btn" onClick={() => setVoiceAgentOpen(true)} aria-label="Voice booking">
              <Mic size={15} /> <span>Voice</span>
            </button>

            {/* City pill — hidden on mobile to save space */}
            <label className="city-pill" title="Select city">
              <MapPin size={13} className="city-pin" />
              <select value={city} onChange={(e) => chooseCity(e.target.value)}>
                <option value="Delhi">Delhi</option>
                <option value="Gurugram">Gurugram</option>
              </select>
            </label>

            {user ? (
              <button className="user-avatar-btn" onClick={() => flash(`${user.name} · ${user.role}`)}>
                {user.name[0].toUpperCase()}
              </button>
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
                  <p className="subhead">Professional drivers for your own car, with clear booking details at every step.</p>
                </div>
              </div>

              {/* Hero Showcase */}
              <section className="hero-card">
                <div className="hero-content">
                  <span className="hero-badge">YOUR CAR · OUR DRIVER</span>
                  <h2>Professional Drivers For Your Own Vehicle</h2>
                  <p>Pay for driver service for your own vehicle across Delhi & Gurugram. Review your fare estimate before booking.</p>
                  <div className="hero-cta-row">
                    <button className="hero-btn" onClick={() => setPage('Book a driver')}>
                      Book a Driver <ArrowRight size={16} />
                    </button>
                    {!user && (
                      <button className="hero-btn-outline" onClick={() => setModal('auth')}>
                        Sign In
                      </button>
                    )}
                  </div>
                  <div className="hero-highlights">
                    <span><ShieldCheck size={14} /> Driver review process</span>
                    <span><MapPin size={14} /> {city}</span>
                    <span><IndianRupee size={14} /> From ₹599</span>
                  </div>
                </div>
              </section>

              {/* Service Grid */}
              <div className="section-head">
                <div>
                  <h3>Choose a Service</h3>
                  <p>Tap to book instantly</p>
                </div>
              </div>

              <div className="services-grid">
                {[
                  { id: 'Hourly',      title: 'Hourly',      desc: 'From ₹599 · 4 hrs', icon: 'hourly' },
                  { id: 'Airport',     title: 'Airport',     desc: 'Fixed fare drop',    icon: 'airport' },
                  { id: 'Night driver',title: 'Night',        desc: 'Safe late trips',    icon: 'night' },
                  { id: 'Full day',    title: 'Full Day',    desc: '8–12 hrs city',      icon: 'fullday' },
                  { id: 'Outstation',  title: 'Outstation',  desc: 'Highway trips',      icon: 'outstation' },
                  { id: 'Custom',      title: 'Custom',      desc: 'Your schedule',      icon: 'custom' }
                ].map((s) => (
                  <button
                    key={s.id}
                    className={`service-card ${tripType === s.id ? 'active' : ''}`}
                    onClick={() => { setTripType(s.id); setPage('Book a driver'); }}
                  >
                    <span className="service-emoji" aria-hidden="true">{s.icon === 'hourly' && <Clock3 size={25} />}{s.icon === 'airport' && <Navigation size={25} />}{s.icon === 'night' && <Clock3 size={25} />}{s.icon === 'fullday' && <CalendarDays size={25} />}{s.icon === 'outstation' && <CarFront size={25} />}{s.icon === 'custom' && <Edit2 size={25} />}</span>
                    <b className="service-title">{s.title}</b>
                    <small className="service-desc">{s.desc}</small>
                  </button>
                ))}
              </div>

              {/* Trust is earned through clear information, not big promises. */}
              <section className="trust-strip trust-experience" aria-label="The VaahanSathi experience">
                <div className="trust-strip-heading">
                  <span className="eyebrow">BUILT AROUND YOUR PEACE OF MIND</span>
                  <h3>Know what to expect. Stay in control.</h3>
                  <p>A professional driver for your own car, with the important trip details kept clear at every step.</p>
                  <button className="trust-learn-link" onClick={() => setPage('Help')}>Questions before you book? Visit Help <ArrowRight size={14} /></button>
                </div>
                <div className="trust-points">
                  <article className="trust-point">
                    <span className="trust-point-icon"><ShieldCheck size={19} /></span>
                    <div><b>Driver review process</b><small>New driver accounts are reviewed before they can accept trips</small></div>
                  </article>
                  <article className="trust-point">
                    <span className="trust-point-icon"><IndianRupee size={19} /></span>
                    <div><b>See the estimate first</b><small>Review the available fare estimate before placing a booking</small></div>
                  </article>
                  <article className="trust-point">
                    <span className="trust-point-icon"><LockKeyhole size={19} /></span>
                    <div><b>OTP-led trip stages</b><small>Use your trip OTP at the appropriate start and completion steps</small></div>
                  </article>
                </div>
              </section>

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
                    <h3>Your journey, with clearer expectations.</h3>
                    <p>
                      VaahanSathi connects car owners with professional drivers. Review your trip details, driver assignment and booking
                      status in the app. We will keep improving the experience with clear information at every step.
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
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              driverStyle={driverStyle}
              setDriverStyle={setDriverStyle}
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
              onDemoPayment={() => setModal('payment-demo')}
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
              onCashConfirm={openCustomerCashHandover}
              cashRewardsPoints={Number(user?.cashRewardsPoints || 0)}
            />
          )}

          {page === 'Requests' && <DriverPage bookings={bookings} update={updateStatus} user={user} onDutyChange={(v: boolean) => setUser((u: any) => u ? {...u, available: v} : u)} flash={flash} onCashConfirm={openDriverCashHandover} />}
          {page === 'My trips' && <TripsPage bookings={bookings} filter={filter} setFilter={setFilter} update={updateStatus} onRate={(b: Booking) => setModal('rate:' + b.id)} onPay={(b: Booking) => setModal('payment:' + b.id)} onTrack={(b: Booking) => setModal('track:' + b.id)} onBook={() => setPage('Book a driver')} receipts={receipts} onCashConfirm={confirmCashAsCustomer} cashRewardsPoints={Number(user?.cashRewardsPoints || 0)} />}
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

      {cashHandover && (
        <CashHandoverModal
          booking={cashHandover.booking}
          mode={cashHandover.mode}
          onClose={() => setCashHandover(null)}
          onSubmit={async (amount: number, pin?: string) => {
            const ok = cashHandover.mode === 'customer'
              ? await confirmCashAsCustomer(cashHandover.booking, amount)
              : await confirmCashAsDriver(cashHandover.booking, amount, pin || '');
            if (ok) setCashHandover(null);
            return ok;
          }}
        />
      )}

      {/* Modals */}
      {voiceAgentOpen && (
        <VoiceAgentModal onClose={() => setVoiceAgentOpen(false)} onApply={applyVoiceTrip} onBook={bookFromVoice} city={city} />
      )}
      {modal === 'auth' && (
        <AuthModal
          onClose={() => setModal('')}
          onLogin={login}
          onRegister={register}
          onCustomerLogin={firebaseCustomerLogin}
          onCustomerRegister={firebaseCustomerRegister}
          onGoogleLogin={firebaseGoogleLogin}
          busy={busy}
          storageReady={storageReady}
        />
      )}

      {modal === 'payment-demo' && <DemoPaymentModal onClose={() => setModal('')} />}

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
          onSubmit={async (feedback: any) => {
            const id = modal.split(':')[1];
            try {
              await api(`/bookings/${id}/rating`, {
                method: 'POST',
                body: JSON.stringify(feedback)
              });
              await refresh();
              setModal('');
              flash('Thank you. Your feedback will help us improve VaahanSathi.');
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

      {/* Mobile bottom nav — floating pill, not a bar */}
      {(
        <nav className="bottom-nav">
          {(!user || user.role === 'customer'
            ? [
                { label: 'Home', icon: 'home', page: 'Home' },
                { label: 'Book', icon: 'book', page: 'Book a driver' },
                { label: 'Trips', icon: 'trips', page: 'Your trips', badge: bookings.filter(b => ['Searching','Driver assigned','Driver arriving','Trip started'].includes(b.status)).length },
                { label: 'Wallet', icon: 'wallet', page: 'Wallet' },
                { label: 'Help', icon: 'help', page: 'Help' },
              ]
            : user.role === 'driver'
            ? [
                { label: 'Rides', icon: 'rides', page: 'Requests', badge: bookings.filter(b => b.status === 'Searching').length },
                { label: 'History', icon: 'trips', page: 'My trips' },
                { label: 'Earnings', icon: 'earnings', page: 'Earnings' },
                { label: 'Profile', icon: 'profile', page: 'Profile' },
              ]
            : [
                { label: 'Overview', icon: 'overview', page: 'Overview' },
                { label: 'Bookings', icon: 'trips', page: 'Bookings' },
                { label: 'Drivers', icon: 'drivers', page: 'Drivers' },
                { label: 'Disputes', icon: 'help', page: 'Disputes' },
              ]
          ).map((item) => (
            <button
              key={item.page}
              className={`bottom-nav-item ${page === item.page ? 'active' : ''}`}
              onClick={() => { setPage(item.page); setMobileOpen(false); }}
            >
              {(item as any).badge > 0 && <span className="bnav-badge">{(item as any).badge}</span>}
              <NavIcon name={item.icon} />
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

function SearchingTimer({ createdAt }) {
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    const start = createdAt ? new Date(createdAt).getTime() : Date.now();
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  const m = Math.floor(secs / 60), s = secs % 60;
  return React.createElement('div', {className:'searching-timer'},
    React.createElement('span', {className:'searching-dot'}),
    React.createElement('span', null, 'Searching' + (m>0?' '+m+'m ':' ') + s + 's')
  );
}

// Curated searchable landmark suggestions for the two active service cities.
const SERVICE_LOCATIONS: Record<string, string[]> = {
  Delhi: [
    "Connaught Place, Delhi", "India Gate, Delhi", "New Delhi Railway Station, Delhi", "Old Delhi Railway Station, Delhi",
    "IGI Airport Terminal 1, Delhi", "IGI Airport Terminal 2, Delhi", "IGI Airport Terminal 3, Delhi",
    "Kashmere Gate ISBT, Delhi", "Anand Vihar ISBT, Delhi", "Sarai Kale Khan ISBT, Delhi",
    "Karol Bagh, Delhi", "Rajouri Garden, Delhi", "Dwarka Sector 10, Delhi", "Dwarka Sector 21, Delhi",
    "Rohini Sector 10, Delhi", "Pitampura, Delhi", "Janakpuri, Delhi", "Vasant Kunj, Delhi",
    "Saket, Delhi", "Hauz Khas, Delhi", "Greater Kailash, Delhi", "Lajpat Nagar, Delhi",
    "South Extension, Delhi", "Defence Colony, Delhi", "Nehru Place, Delhi", "Okhla, Delhi",
    "Chandni Chowk, Delhi", "Laxmi Nagar, Delhi", "Preet Vihar, Delhi", "Mayur Vihar, Delhi",
    "Shahdara, Delhi", "Jhilmil Colony, Shahdara, Delhi", "Jhilmil Industrial Area, Delhi",
    "Dilshad Garden, Delhi", "Vivek Vihar, Delhi", "Surajmal Vihar, Delhi", "Anand Vihar, Delhi",
    "GTB Enclave, Delhi", "Mansarovar Park, Delhi", "Seemapuri, Delhi", "Naveen Shahdara, Delhi",
    "Bhola Nath Nagar, Delhi", "Welcome, Shahdara, Delhi", "Krishna Nagar, Delhi", "Karkardooma, Delhi",
    "Yamuna Vihar, Delhi", "Babarpur, Delhi", "Gandhi Nagar, Delhi", "Geeta Colony, Delhi",
    "Civil Lines, Delhi", "Model Town, Delhi", "Punjabi Bagh, Delhi",
    "Aerocity, Delhi", "AIIMS, Delhi", "Pragati Maidan, Delhi", "Jasola, Delhi"
  ],
  Gurugram: [
    "Cyber City, Gurugram", "HUDA City Centre (Millennium City Centre), Gurugram", "MG Road, Gurugram",
    "Golf Course Road, Gurugram", "Golf Course Extension Road, Gurugram", "Sohna Road, Gurugram",
    "Udyog Vihar Phase 1, Gurugram", "Udyog Vihar Phase 2, Gurugram", "Udyog Vihar Phase 3, Gurugram",
    "Sector 14, Gurugram", "Sector 15, Gurugram", "Sector 29, Gurugram", "Sector 31, Gurugram",
    "Sector 43, Gurugram", "Sector 45, Gurugram", "Sector 46, Gurugram", "Sector 47, Gurugram",
    "Sector 48, Gurugram", "Sector 49, Gurugram", "Sector 50, Gurugram", "Sector 56, Gurugram",
    "Sector 57, Gurugram", "Sector 62, Gurugram", "Sector 65, Gurugram", "Sector 67, Gurugram",
    "Sector 69, Gurugram", "Sector 70, Gurugram", "Sector 70A, Gurugram", "Sector 71, Gurugram",
    "Sector 72, Gurugram", "Sector 73, Gurugram", "Sector 74, Gurugram", "Sector 76, Gurugram",
    "Sector 77, Gurugram", "Sector 78, Gurugram", "Sector 79, Gurugram", "Sector 82, Gurugram",
    "Sector 83, Gurugram", "Sector 84, Gurugram", "Sector 85, Gurugram", "Sector 86, Gurugram",
    "Sector 90, Gurugram", "Sector 91, Gurugram", "Sector 92, Gurugram", "Sector 93, Gurugram",
    "Sector 102, Gurugram", "Sector 103, Gurugram", "Sector 104, Gurugram", "Sector 105, Gurugram",
    "Sector 106, Gurugram", "Sector 107, Gurugram", "Sector 108, Gurugram", "Sector 109, Gurugram",
    "Sector 110, Gurugram", "Sector 111, Gurugram", "Sector 112, Gurugram",
    "Sushant Lok Phase 1, Gurugram", "DLF Phase 1, Gurugram",
    "DLF Phase 2, Gurugram", "DLF Phase 3, Gurugram", "DLF Phase 4, Gurugram",
    "Palam Vihar, Gurugram", "New Palam Vihar, Gurugram", "South City 1, Gurugram", "South City 2, Gurugram",
    "Sector 9, Gurugram", "Sector 10, Gurugram", "Sector 21, Gurugram", "Sector 22, Gurugram",
    "Sector 23, Gurugram", "Sector 38, Gurugram", "Sector 40, Gurugram", "Sector 41, Gurugram",
    "Sector 42, Gurugram", "Sector 52, Gurugram", "Sector 53, Gurugram", "Sector 54, Gurugram",
    "Sector 55, Gurugram", "Sector 58, Gurugram", "Sector 59, Gurugram", "Sector 60, Gurugram",
    "Sector 63, Gurugram", "Sector 66, Gurugram", "Sector 72A, Gurugram", "Badshahpur, Gurugram",
    "Basai, Gurugram", "IMT Manesar, Gurugram", "Manesar, Gurugram", "Gwal Pahari, Gurugram",
    "Nirvana Country, Gurugram", "Ambience Mall, Gurugram", "Artemis Hospital, Gurugram",
    "Medanta Hospital, Gurugram", "Gurugram Railway Station, Gurugram", "Dwarka Expressway, Gurugram"
  ]
};

// ----------------- Booking Page Component -----------------

function DemoPaymentModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('599');
  const [method, setMethod] = useState('UPI');
  const [scenario, setScenario] = useState('success');
  const [result, setResult] = useState('');
  const [reference, setReference] = useState('');
  const numericAmount = Math.max(0, Math.min(500000, Math.round(Number(amount) || 0)));
  const driverShare = Math.round(numericAmount * 0.8);
  const platformShare = numericAmount - driverShare;

  const runDemo = () => {
    if (numericAmount < 1) return;
    setReference('VS-DEMO-' + Date.now().toString().slice(-8));
    setResult(scenario);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="demo-payment-title" style={{width:'min(560px, 100%)',maxHeight:'90vh',overflowY:'auto'}}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18}/></button>
        <div className="modal-brand"><CreditCard size={24}/><span>VaahanSathi Payments</span></div>
        <span className="eyebrow">INTERACTIVE PAYMENT SANDBOX</span>
        <h2 id="demo-payment-title" style={{marginTop:8}}>Online payment demo</h2>
        <p className="modal-sub">Preview how a payment amount is recorded and how an illustrative driver/platform split is calculated.</p>
        <div style={{padding:12,borderRadius:12,background:'#fff7ed',border:'1px solid #fed7aa',color:'#9a3412',fontSize:12,fontWeight:700,marginBottom:16}}>
          DEMO ONLY — no money is charged, transferred, settled or sent to a bank account. This does not connect to Razorpay.
        </div>
        <div className="field-group" style={{marginBottom:12}}>
          <span>Choose a sample amount</span>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {['599','927','1500','2500'].map((v) => <button key={v} type="button" className={amount===v?'primary-btn-sm':'action-btn'} onClick={() => {setAmount(v);setResult('');}}>{money(Number(v))}</button>)}
          </div>
          <input aria-label="Custom payment amount in rupees" type="number" min="1" max="500000" value={amount} onChange={(e) => {setAmount(e.target.value);setResult('');}} placeholder="Enter custom amount" />
          <small>Enter any amount from ₹1 to ₹5,00,000.</small>
        </div>
        <div className="field-group" style={{marginBottom:12}}>
          <span>Demo payment method</span>
          <select value={method} onChange={(e) => {setMethod(e.target.value);setResult('');}}>
            <option>UPI</option><option>Debit card</option><option>Credit card</option><option>Net banking</option><option>Wallet</option>
          </select>
        </div>
        <div className="field-group" style={{marginBottom:14}}>
          <span>Simulate gateway response</span>
          <select value={scenario} onChange={(e) => {setScenario(e.target.value);setResult('');}}>
            <option value="success">Payment successful</option>
            <option value="pending">Payment pending</option>
            <option value="failed">Payment failed</option>
          </select>
        </div>
        <div style={{border:'1px solid var(--line, #e2e8f0)',borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:12}}><b>Illustrative transfer breakdown</b><strong>{money(numericAmount)}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #e5e7eb'}}><span>Driver partner · 80%</span><b>{money(driverShare)}</b></div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'9px 0'}}><span>VaahanSathi · remaining 20%</span><b>{money(platformShare)}</b></div>
          <div style={{height:10,display:'flex',overflow:'hidden',borderRadius:20,background:'#e5e7eb',marginTop:8}}>
            <div style={{width:'80%',background:'#0d9488'}}/><div style={{width:'20%',background:'#64748b'}}/>
          </div>
          <small style={{display:'block',marginTop:8,color:'var(--t5,#64748b)'}}>Illustrative split only. Actual taxes, gateway fees, commissions and payout rules may differ.</small>
        </div>
        <button type="button" className="primary-btn-wide" style={{width:'100%',justifyContent:'center'}} disabled={numericAmount<1} onClick={runDemo}>
          <Zap size={17}/> Run demo payment
        </button>
        {result && (
          <div style={{marginTop:14,borderRadius:14,padding:14,border:'1px solid '+(result==='success'?'#86efac':result==='pending'?'#fcd34d':'#fca5a5'),background:result==='success'?'#f0fdf4':result==='pending'?'#fffbeb':'#fef2f2'}}>
            <b style={{color:result==='success'?'#166534':result==='pending'?'#92400e':'#991b1b'}}>
              {result==='success'?'Demo payment successful':result==='pending'?'Demo payment pending':'Demo payment failed'}
            </b>
            <p style={{fontSize:13,margin:'6px 0 10px',color:'#334155'}}>
              {result==='success'?'The sandbox has simulated a successful gateway response. The split below is illustrative and no real settlement occurred.':result==='pending'?'The sandbox is waiting for a simulated gateway confirmation. No amount is treated as paid and no payout is released.':'The sandbox simulated a declined payment. No amount is treated as paid and no payout is released.'}
            </p>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>Demo reference</span><b>{reference}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:6}}><span>Method</span><b>{method}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:6}}><span>Gateway amount</span><b>{money(numericAmount)}</b></div>
            {result==='success' && <>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:6}}><span>Driver payout (simulated)</span><b>{money(driverShare)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:6}}><span>Platform share (simulated)</span><b>{money(platformShare)}</b></div>
            </>}
          </div>
        )}
        <button type="button" className="action-btn" style={{width:'100%',justifyContent:'center',marginTop:12}} onClick={() => {setResult('');setReference('');}}>Reset demo</button>
      </div>
    </div>
  );
}

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
          <h1>Book a Professional Driver</h1>
          <p>Share your route and schedule. You can review the driver assignment and trip details before your journey.</p>
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
              <p>You provide the vehicle. Your assigned driver takes the wheel so you can focus on the journey.</p>
            </div>
          </div>

          <h3>2. Route & Schedule</h3>
          <datalist id="service-locations-delhi">
            {SERVICE_LOCATIONS.Delhi.map((place) => <option key={place} value={place} />)}
          </datalist>
          <datalist id="service-locations-gurugram">
            {SERVICE_LOCATIONS.Gurugram.map((place) => <option key={place} value={place} />)}
          </datalist>
          <div className="form-fields-grid">
            <label className="field-group full">
              <span><MapPin size={15} /> Pickup Location</span>
              <input
                list={p.city === "Gurugram" ? "service-locations-gurugram" : "service-locations-delhi"}
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
                list={p.city === "Gurugram" ? "service-locations-gurugram" : "service-locations-delhi"}
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

          <section className="booking-preferences-panel">
            <h3>3. Your Driver, Your Comfort</h3>
            <p>Choose the communication style you prefer. We'll match verified, online drivers who have selected the same style.</p>
            <div className="driver-style-options">
              {[
                { value: 'any', title: 'Best available', desc: 'Any communication style' },
                { value: 'friendly', title: 'Friendly', desc: 'Warm and polite' },
                { value: 'talkative', title: 'Talkative', desc: 'Enjoys conversation' },
                { value: 'humorous', title: 'Fun & humorous', desc: 'Light-hearted company' },
                { value: 'professional', title: 'Professional', desc: 'Formal and focused' },
                { value: 'quiet', title: 'Quiet ride', desc: 'Minimal conversation' }
              ].map((style) => <button type="button" key={style.value} className={`driver-style-option ${p.driverStyle === style.value ? 'selected' : ''}`} onClick={() => p.setDriverStyle(style.value)}><b>{style.title}</b><small>{style.desc}</small></button>)}
            </div>
            <h3>4. Choose Payment Method</h3>
            <div className="payment-choice-grid">
              <button type="button" className={`payment-choice ${p.paymentMethod === 'online' ? 'selected' : ''}`} onClick={() => p.setPaymentMethod('online')}><CreditCard size={19}/><span><b>Pay online</b><small>UPI, cards and net banking after your trip</small></span></button>
              <button type="button" className={`payment-choice ${p.paymentMethod === 'cash' ? 'selected' : ''}`} onClick={() => p.setPaymentMethod('cash')}><IndianRupee size={19}/><span><b>Pay by cash</b><small>Pay the driver after your trip and earn CashCircle points</small></span></button>
            </div>
            {p.paymentMethod === 'online' && <button type="button" className="secondary-btn" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={p.onDemoPayment}><CreditCard size={16}/> Preview online payment demo</button>}
            {p.paymentMethod === 'cash' && <div className="cash-reward-note"><b>CashCircle rewards</b><span>Earn 1 reward point for every ₹100 paid in cash. Points are added after both you and your driver confirm payment.</span></div>}
          </section>

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
function TripsPage({ bookings, filter, setFilter, update, onRate, onPay, onTrack, onBook, receipts, onCashConfirm, cashRewardsPoints = 0 }: any) {
  const filters = ['Upcoming', 'Completed', 'Cancelled'];
  const list = bookings.filter((b: Booking) =>
    filter === 'Upcoming'
      ? ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started', 'Awaiting cash confirmation'].includes(b.status)
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

      <div className="cashcircle-summary"><span className="cashcircle-icon">₹</span><div><b>CashCircle rewards</b><small>{cashRewardsPoints} points earned from confirmed cash trips</small></div></div>
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
                    ? ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started', 'Awaiting cash confirmation'].includes(b.status)
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

              {/* Live, transparent trip progress */}
              {b.status !== 'Cancelled' && (() => {
                const stages = ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started', 'Awaiting cash confirmation', 'Trip completed'];
                const current = Math.max(0, stages.indexOf(b.status));
                return (
                  <section className="trip-progress" aria-label="Trip progress">
                    <div className="trip-progress-heading">
                      <div><b>Trip progress</b><small>Updates as your booking moves forward</small></div>
                      <span>{b.status === 'Trip completed' ? 'Completed' : `${current + 1} of ${stages.length}`}</span>
                    </div>
                    <ol className="trip-progress-steps">
                      {stages.map((stage, index) => (
                        <li key={stage} className={index < current ? 'complete' : index === current ? 'current' : ''}>
                          <span className="trip-progress-dot">{index < current ? <Check size={12} /> : index + 1}</span>
                          <span>{stage === 'Searching' ? 'Finding a driver' : stage === 'Awaiting cash confirmation' ? 'Cash settlement pending' : stage}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="trip-progress-note"><ShieldCheck size={14} /> Only share your start OTP when you are with your assigned driver.</p>
                  </section>
                );
              })()}

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
                {b.status === 'Searching' ? (
                  <SearchingTimer createdAt={b.createdAt} />
                ) : (
                  <div className="driver-assigned-info">
                    <span className="driver-avatar">{b.driver ? b.driver[0] : 'V'}</span>
                    <div><small>ASSIGNED DRIVER</small><b>{b.driver}</b></div>
                  </div>
                )}

                <div className="trip-actions-row single">
                  {['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status) && (
                    <button className="action-btn track" onClick={() => onTrack(b)}>
                      <Navigation size={16} /> Track Driver Route
                    </button>
                  )}
                </div>
                {['Trip completed', 'Awaiting cash confirmation'].includes(b.status) && (
                  <>
                    <div className="trip-actions-row">
                      {b.status === 'Trip completed' && <button className="action-btn rate" onClick={() => onRate(b)}><Star size={16} /> Rate Driver</button>}
                      {b.payment_status === 'Paid' || b.payment_status === 'Paid · Cash' ? <span className="status-pill done">Paid · {b.payment_method === 'cash' ? 'Cash' : 'Online'}</span> :
                        b.payment_method === 'cash' ? <button className="action-btn pay" onClick={() => onCashConfirm(b)} disabled={b.cashCustomerConfirmed}><IndianRupee size={16}/>{b.cashCustomerConfirmed ? 'Amount confirmation sent' : 'Confirm amount handed over'}</button> :
                        <button className="action-btn pay" onClick={() => onPay(b)}><CreditCard size={16} /> Pay {money(b.total)}</button>}
                      {b.payment_method === 'cash' && b.cashPin && b.payment_status !== 'Paid · Cash' && <div className="cash-pin-card">
                        <div className="cash-pin-heading"><span className="cash-pin-icon"><ShieldCheck size={17}/></span><span><b>Secure cash handover</b><small>Share this code only after the driver has returned any change and you have confirmed the final fare.</small></span><span className="cash-pin-live">ONE-TIME</span></div>
                        <div className="cash-pin-digits" aria-label={`Cash handover PIN ${b.cashPin}`}>{String(b.cashPin).split('').map((digit, index) => <span key={index}>{digit}</span>)}</div>
                        <small className="cash-pin-foot"><LockKeyhole size={13}/> Your driver needs this PIN to verify the receipt. Never share it over a call or chat.</small>
                      </div>}
                      {b.payment_method === 'cash' && b.cashCustomerConfirmed && <small className="muted">You confirmed {money(Number(b.cashCustomerAmount || 0))}. Waiting for driver verification.</small>}
                    </div>
                    <div className="trip-actions-row">
                      <button className="action-btn" onClick={() => downloadInvoice(b)}>
                        <FileText size={15} /> Download Invoice
                      </button>
                      {receipts.some((r: Receipt) => r.bookingId === b.id) && (
                        <button
                          className="action-btn"
                          onClick={() => downloadReceipt(b, receipts.find((r: Receipt) => r.bookingId === b.id)!)}
                        >
                          <Check size={15} /> View Receipt
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------- Driver Partner Page -----------------
function DriverPage({ bookings, update, user, onDutyChange, flash, onCashConfirm }: any) {
  const [available, setAvailable] = useState<boolean>(user?.available !== false);
  const [dutyBusy, setDutyBusy] = useState(false);
  const prevSearching = useRef(0);
  const newRequestRef = useRef<HTMLDivElement>(null);

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
  const newRequests = own.filter((b: Booking) => b.status === 'Searching');

  // Flash notification and scroll when a new Searching request arrives
  useEffect(() => {
    const count = newRequests.length;
    if (count > prevSearching.current && prevSearching.current >= 0) {
      flash?.('New ride request! Tap Accept to accept it.');
      setTimeout(() => newRequestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
    prevSearching.current = count;
  }, [newRequests.length]);

  const completed = bookings.filter((b: Booking) => b.driverId === user?.id && b.status === 'Trip completed');
  const totalEarnings = completed.reduce((s: number, b: Booking) => s + b.payout, 0);

  // Share precise GPS only for assigned active trips. The browser asks the driver for location permission.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const active = bookings.filter((b: Booking) => b.driverId === user?.id && ['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status));
    if (!active.length) return;
    const watchers = active.map((booking: Booking) => navigator.geolocation.watchPosition(
      (position) => api(`/bookings/${booking.id}/location`, {
        method: 'POST',
        body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading, speed: position.coords.speed })
      }).catch((error: any) => console.warn('GPS update:', error.message)),
      (error) => console.warn('Driver GPS permission or signal:', error.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    ));
    return () => watchers.forEach((watchId) => navigator.geolocation.clearWatch(watchId));
  }, [bookings.map((b: Booking) => `${b.id}:${b.status}:${b.driverId}`).join('|'), user?.id]);

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
      <div className={`duty-toggle-row ${available ? 'online' : 'offline'}`}>
        <div>
          <b>{available ? 'Online — Accepting requests' : 'Offline — Not accepting requests'}</b>
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

      <section className="panel driver-badges-panel">
        <div className="panel-header"><div><span className="eyebrow">PARTNER GROWTH</span><h3>Your Driver Performance Batch</h3><p>Transparent levels based on completed rides and verified customer ratings.</p></div><span className="driver-achievement-badge"><BadgeCheck size={14}/>{user?.driverBatch?.name || 'Starter'} Batch</span></div>
        <div className="stats-cards-grid">
          <div className="stat-card"><small>QUALIFYING TRIPS</small><b>{user?.driverBatch?.completedTrips ?? completed.length}</b><span>Completed rides</span></div>
          <div className="stat-card"><small>AVERAGE RATING</small><b>★ {user?.driverBatch?.averageRating ? user.driverBatch.averageRating.toFixed(1) : 'New'}</b><span>Customer feedback</span></div>
          <div className="stat-card"><small>NEXT LEVEL</small><b>{user?.driverBatch?.nextMilestone ? user.driverBatch.tripsRemaining : '—'}</b><span>{user?.driverBatch?.nextMilestone ? 'quality trips remaining' : 'Top batch reached'}</span></div>
        </div>
        {user?.driverBatch?.nextMilestone ? <div className="batch-progress-wrap"><div className="batch-progress-copy"><b>{user.driverBatch.progressPercent}% progress</b><span>{user.driverBatch.completedTrips} / {user.driverBatch.nextMilestone} trips</span></div><div className="batch-progress-track"><span style={{width: user.driverBatch.progressPercent + '%'}} /></div><small>Next level requires at least {user.driverBatch.ratingRequired.toFixed(1)}★ average rating and {user.driverBatch.nextMilestone} completed trips.</small></div> : <div className="batch-progress-wrap batch-top-level"><b>Top performance level achieved</b><span>Keep delivering safe, reliable and highly rated rides.</span></div>}
        <div className="batch-levels-grid">
          {([{name:'Starter',trips:0,rating:0},{name:'Silver',trips:15,rating:4.3},{name:'Gold',trips:50,rating:4.6},{name:'Platinum',trips:150,rating:4.8},{name:'Elite',trips:500,rating:4.9}]).map((level) => <div className={`batch-level-card ${user?.driverBatch?.name === level.name ? 'current' : ''}`} key={level.name}><b>{level.name}</b><span>{level.trips.toLocaleString('en-IN')} trips</span><small>{level.rating ? `Rating ${level.rating.toFixed(1)}★+` : 'Starting level'}</small>{user?.driverBatch?.name === level.name && <em>Current</em>}</div>)}
        </div>
        <div className="driver-badge-list">{(user?.driverBadges || []).length ? user.driverBadges.map((badge: string) => <span className="driver-achievement-badge" key={badge}><BadgeCheck size={14}/>{badge}</span>) : <span className="muted-note">Complete quality trips and earn positive ratings to unlock badges.</span>}</div>
        <small>Communication styles: {(user?.driverStyleTags || ['friendly']).join(' · ')}</small>
      </section>
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
          <b className={available ? 'status-online' : ''}>{available ? 'Online' : 'Offline'}</b>
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
          <p>New booking requests in {user?.city || 'your city'} will appear here automatically.</p>
        </div>
      ) : (
        <div className="trips-cards-list" ref={newRequestRef}>
          {own.map((b: Booking) => (
            <div className={`panel trip-card ${b.status === 'Searching' ? 'new-request-card' : ''}`} key={b.id}>
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
                {b.requestedDriverStyle && b.requestedDriverStyle !== 'any' && <span className="requested-style-pill">Customer prefers: <b>{b.requestedDriverStyle}</b></span>}
                <div className="action-buttons-group">
                  {b.status === 'Searching' && (
                    <button className="primary-btn success" style={{width:'100%',justifyContent:'center'}} onClick={() => update(b, 'Driver assigned')}>
                      <Check size={18} /> Accept This Booking
                    </button>
                  )}
                  {b.status === 'Driver assigned' && (
                    <button className="primary-btn" style={{width:'100%',justifyContent:'center',background:'#1d4ed8'}} onClick={() => update(b, 'Driver arriving')}>
                      <Navigation size={18} /> I Am On My Way
                    </button>
                  )}
                  {b.status === 'Driver arriving' && (
                    <button
                      className="primary-btn"
                      style={{width:'100%',justifyContent:'center',background:'#0a7a6e'}}
                      onClick={() => {
                        const code = prompt('Enter the 4-digit START OTP from the customer:');
                        if (code) update(b, 'Trip started', code);
                      }}
                    >
                      <ArrowRight size={18} /> Start Trip — Enter OTP
                    </button>
                  )}
                  {b.status === 'Awaiting cash confirmation' && b.payment_method === 'cash' && b.payment_status !== 'Paid · Cash' && (
                    <div className="driver-cash-action">
                      <div><b>Cash collection verification</b><small>Enter the amount you retained after returning any change, then verify the customer's one-time PIN.</small></div>
                      <button className="primary-btn" style={{width:'100%',justifyContent:'center',background:'#0a7a6e'}} onClick={() => onCashConfirm(b)} disabled={b.cashDriverConfirmed}><ShieldCheck size={17}/>{b.cashDriverConfirmed ? 'Receipt submitted' : 'Verify cash handover'}</button>
                      {b.cashDriverConfirmed && <small className="muted">You reported {money(Number(b.cashDriverAmount || 0))}. Waiting for customer confirmation.</small>}
                    </div>
                  )}
                  {b.status === 'Trip started' && (
                    <button
                      className="primary-btn success"
                      style={{width:'100%',justifyContent:'center'}}
                      onClick={() => {
                        const code = prompt('Enter the 4-digit END OTP from the customer:');
                        if (code) update(b, 'Trip completed', code);
                      }}
                    >
                      <Check size={18} /> Complete Trip — Enter OTP
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
                     module === 'payments' ? <><th>PAYMENT / EVENT</th><th>BOOKING</th><th>AMOUNT</th><th>CONFIRMED BY</th><th>TIME</th><th>STATUS</th></> :
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
                        <td><b>{r.provider === 'cash' ? (r.action || 'Cash event').replace(/_/g, ' ') : r.provider || 'Payment'}</b><small>{r.id || '—'}</small></td>
                        <td>{r.bookingId || r.booking_id || '—'}</td>
                        <td>{money(r.amount || r.total || 0)}</td>
                        <td>{r.actorName || r.actorRole || r.method || '—'}<small>{r.actorRole || ''}</small></td>
                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : r.paidAt ? new Date(r.paidAt).toLocaleString('en-IN') : '—'}</td>
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
          <p>No. VaahanSathi connects car owners with drivers for the customer's own vehicle. Review the assigned driver's details in your booking before the trip.</p>
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
  const [selectedStyles, setSelectedStyles] = useState<string[]>(user?.driverStyleTags || ['friendly']);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone, vehicle, driverStyleTags: selectedStyles })
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
        <section className="driver-style-profile">
          <h3>Communication style tags</h3>
          <p>Select the styles that genuinely describe how you interact with customers.</p>
          <div className="driver-style-options">
            {[
              { value: 'friendly', title: 'Friendly', desc: 'Warm and polite' },
              { value: 'talkative', title: 'Talkative', desc: 'Enjoys conversation' },
              { value: 'humorous', title: 'Fun & humorous', desc: 'Light-hearted company' },
              { value: 'professional', title: 'Professional', desc: 'Formal and focused' },
              { value: 'quiet', title: 'Quiet ride', desc: 'Minimal conversation' }
            ].map((style) => <button type="button" key={style.value} className={`driver-style-option ${selectedStyles.includes(style.value) ? 'selected' : ''}`} onClick={() => setSelectedStyles((current) => current.includes(style.value) ? current.filter((tag) => tag !== style.value) : [...current, style.value])}><b>{style.title}</b><small>{style.desc}</small></button>)}
          </div>
          {!editing && <button className="secondary-btn" type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save communication preferences'}</button>}
        </section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div className="profile-avatar-large">{user?.name ? user.name[0] : 'V'}</div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--navy)' }}>{user?.name || 'Driver Partner'}</h2>
            <p style={{ color: 'var(--slate-500)', fontSize: '14px' }}>{user?.email}</p>
            <span className={`status-pill ${user?.verificationStatus === 'verified' ? 'done' : ''}`} style={{ marginTop: '6px', display: 'inline-block' }}>
              {user?.verificationStatus === 'verified' ? 'Verified Partner' : user?.verificationStatus === 'pending' ? '⏳ Verification Pending' : 'Unverified'} · {user?.city || 'Delhi'}
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
  type Stage = 'idle' | 'listening' | 'processing' | 'confirm';
  const [stage, setStage] = useState<Stage>('idle');
  const [final, setFinal] = useState('');
  const [intent, setIntent] = useState<any>(null);
  const [err, setErr] = useState('');
  const [booking, setBooking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const LANGS = [
    { label: 'English', code: 'en-IN', srv: 'en-IN', ph: 'Example: Take me from Connaught Place to IGI Airport tomorrow at 6 AM' },
    { label: 'हिन्दी', code: 'hi-IN', srv: 'hi-IN', ph: 'उदाहरण: कल सुबह कनॉट प्लेस से एयरपोर्ट जाना है' },
    { label: 'Hinglish', code: 'en-IN', srv: 'hi-hinglish', ph: 'Example: Kal subah Connaught Place se airport jaana hai' },
  ];
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('vs_language');
    return LANGS[saved === 'hi' ? 1 : saved === 'hinglish' ? 2 : 0];
  });

  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  function stopListening() {
    try { recognitionRef.current?.stop(); }
    catch {
      recognitionRef.current = null;
      setStage('idle');
      setErr('Could not stop voice recognition. Please type your trip instead.');
    }
  }

  function startListening() {
    // SpeechRecognition is optional: Safari/iOS and some embedded browsers do not expose it.
    // Keep the typed route path available in every browser rather than blocking booking.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setErr('Microphone features require the secure HTTPS website. You can still type your trip below.');
      return;
    }
    if (!SpeechRecognition) {
      setErr('Voice dictation is not available in this browser version. Type your trip below to continue booking.');
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    try {
      setErr('');
      setFinal('');
      setIntent(null);
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = lang.code;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setStage('listening');
      recognition.onresult = (event: any) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript;
          if (transcript) parts.push(transcript);
        }
        if (parts.length) setFinal(parts.join(' ').replace(/\s+/g, ' ').trim());
      };
      recognition.onerror = (event: any) => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        if (event.error === 'aborted') {
          setStage('idle');
          return;
        }
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone permission is blocked. Allow microphone access for this site in your browser settings, then try again.',
          'service-not-allowed': 'Your browser or device does not allow its speech service. Type your trip below to continue.',
          'no-speech': 'No speech was detected. Tap the microphone and speak clearly, or type your trip.',
          'audio-capture': 'No microphone is available. Check your device microphone or type your trip.',
          network: 'The browser speech service could not connect. Check your internet connection or type your trip.',
          'language-not-supported': 'This browser does not support the selected recognition language. Choose English or type your trip.'
        };
        setErr(messages[event.error] || 'Voice dictation stopped. You can try again or type your trip below.');
        setStage('idle');
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setStage(current => current === 'listening' ? 'idle' : current);
      };
      // start() must run directly from the user's tap for mobile browser permission policies.
      recognition.start();
      setStage('listening');
    } catch (error: any) {
      if (recognitionRef.current) recognitionRef.current = null;
      setStage('idle');
      setErr(error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'Microphone permission is blocked. Allow microphone access for this site, then try again.'
        : 'Could not start voice dictation on this device. Type your trip below to continue.');
    }
  }

  async function interpretTrip() {
    if (!final.trim()) {
      setErr('Please speak or type your pickup and destination first.');
      return;
    }
    setErr('');
    setStage('processing');
    try {
      const result = await api('/voice/intent', {
        method: 'POST',
        body: JSON.stringify({ text: final.trim(), language: lang.srv, city })
      });
      if (!result || typeof result !== 'object') throw new Error('The trip could not be understood. Please try again.');
      if (!result.pickup || !result.destination) {
        setErr('I could not identify both locations. Please edit your trip text to include where you are starting and where you are going.');
        setStage('idle');
        return;
      }
      setIntent(result);
      onApply(result);
      setStage('confirm');
    } catch (error: any) {
      setErr(error?.message || 'Could not understand your trip. Please try again.');
      setStage('idle');
    }
  }

  function speakSummary() {
    if (!intent || !('speechSynthesis' in window)) {
      setErr('Spoken playback is not supported on this browser. The trip details are shown below.');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(intent.summary || ('Trip understood. From ' + intent.pickup + ' to ' + intent.destination + '.'));
      utterance.lang = lang.code;
      utterance.rate = 0.95;
      utterance.onerror = () => setErr('Audio playback is unavailable on this device. Please review the trip details shown on screen.');
      window.speechSynthesis.speak(utterance);
    } catch {
      setErr('Audio playback is unavailable on this device. Please review the trip details shown on screen.');
    }
  }

  async function confirmBook() {
    if (!intent || booking) return;
    setBooking(true);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try { await onBook(intent); }
    finally { setBooking(false); }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal voice-agent-modal" role="dialog" aria-modal="true" aria-labelledby="voice-agent-title">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="va-header">
          <div className={'va-orb ' + (stage === 'listening' ? 'va-orb-pulse' : stage === 'processing' ? 'va-orb-spin' : '')}><Mic size={22} /></div>
          <div>
            <span className="eyebrow">VOICE BOOKING</span>
            <h2 id="voice-agent-title" style={{fontSize:'18px',fontWeight:800,color:'var(--ink)',marginBottom:2}}>
              {stage === 'idle' && 'Speak or type your trip'}
              {stage === 'listening' && 'Listening…'}
              {stage === 'processing' && 'Understanding your trip…'}
              {stage === 'confirm' && 'Review your trip'}
            </h2>
            <p style={{fontSize:'12px',color:'var(--t5)',lineHeight:1.4}}>If your browser supports voice dictation, tap the microphone. Otherwise, type your trip below — booking works either way.</p>
          </div>
        </div>
        <div className="va-lang-row">
          {LANGS.map(option => (
            <button key={option.label} type="button" className={'va-lang-btn' + (lang.label === option.label ? ' active' : '')}
              onClick={() => {
                if (recognitionRef.current) stopListening();
                setLang(option); setErr(''); setFinal(''); setIntent(null);
              }}>{option.label}</button>
          ))}
        </div>
        <div className="va-transcript" aria-live="polite">
          {!final && <span className="va-placeholder">{lang.ph}</span>}
          {final && <span>{final}</span>}
        </div>
        {err && <p className="va-err" role="alert">{err}</p>}
        {(stage === 'idle' || stage === 'listening') && (
          <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
            <button type="button" className={'va-mic-btn ' + (stage === 'listening' ? 'va-mic-active' : '')}
              onClick={stage === 'listening' ? stopListening : startListening}>
              <Mic size={20} /> {stage === 'listening' ? 'Stop recording' : 'Tap to speak'}
            </button>
            <textarea className="va-text-input" value={final}
              onChange={(e) => { setFinal(e.target.value); setErr(''); }}
              placeholder="Or type: From Connaught Place to IGI Airport tomorrow at 6 AM"
              rows={3} aria-label="Enter your pickup and destination" />
            {final.trim() && stage !== 'listening' && (
              <button type="button" className="primary-btn-wide" style={{marginTop:0}} onClick={interpretTrip}>
                Understand my trip <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
        {stage === 'processing' && (
          <div className="va-processing" role="status"><div className="va-spinner" /><span>Transcribing and checking your trip…</span></div>
        )}
        {stage === 'confirm' && intent && (
          <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:4}}>
            <div className="va-confirm-card">
              <div className="va-confirm-row"><span>Service</span><b>{intent.tripType || 'Hourly'} · {intent.hours || 4} hrs</b></div>
              <div className="va-confirm-row"><span>From</span><b>{intent.pickup}</b></div>
              <div className="va-confirm-row"><span>To</span><b>{intent.destination}</b></div>
              <div className="va-confirm-row"><span>Date</span><b>{intent.date || 'Please select date'}</b></div>
              <div className="va-confirm-row"><span>Time</span><b>{intent.time || 'Please select time'}</b></div>
              <div className="va-confirm-row"><span>City</span><b>{intent.city || city}</b></div>
            </div>
            <button type="button" className="secondary-btn" style={{width:'100%',justifyContent:'center'}} onClick={speakSummary}>
              <Headphones size={17} /> Read trip aloud
            </button>
            <button type="button" className="primary-btn-wide" style={{marginTop:0,background:'#15803d'}} onClick={confirmBook} disabled={booking}>
              {booking ? 'Booking…' : 'Confirm and Book Now'} <ArrowRight size={17} />
            </button>
            <button type="button" className="secondary-btn" style={{width:'100%',justifyContent:'center'}}
              onClick={() => { setStage('idle'); setIntent(null); setErr(''); setFinal(''); }}>Edit trip details</button>
          </div>
        )}
      </div>
    </div>
  );
}
function AuthModal({ onClose, onLogin, onRegister, onCustomerLogin, onCustomerRegister, onGoogleLogin, busy, storageReady }: any) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginRole, setLoginRole] = useState<'customer' | 'partner'>('customer');
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
    if (mode === 'login') {
      if (loginRole === 'customer') onCustomerLogin(email, password);
      else onLogin(email, password);
    } else if (registerRole === 'customer') {
      onCustomerRegister(name, email, password, city, phone);
    } else {
      onRegister(name, email, password, city, phone, registerRole, vehicle, licenseNumber);
    }
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
          {mode === 'login' ? 'Access your rides and bookings' : registerRole === 'driver' ? 'Drive customers in your city and earn 80% of every fare' : 'Book professional drivers for your personal vehicle'}
        </p>

        {mode === 'login' && (
          <label className="field-group">
            <span>Account Type</span>
            <select value={loginRole} onChange={(e) => setLoginRole(e.target.value as 'customer' | 'partner')}>
              <option value="customer">Customer</option>
              <option value="partner">Driver / Admin</option>
            </select>
          </label>
        )}

        {mode === 'login' && (
          <div className="quick-demo-box">
            <span className="quick-label">Quick demo sign-in · password: password123</span>
            <div className="quick-buttons">
              <button type="button" onClick={() => onLogin('ramesh@vaahansathi.demo', 'password123')}>Driver (Gurugram)</button>
              <button type="button" onClick={() => onLogin('priya@vaahansathi.demo', 'password123')}>Driver (Delhi)</button>
              <button type="button" onClick={() => onLogin('admin@vaahansathi.demo', 'password123')}>Admin</button>
            </div>
          </div>
        )}

        {((mode === 'register' && registerRole === 'customer') || (mode === 'login' && loginRole === 'customer')) && (
          <div className="google-auth-section">
            <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
            <button
              type="button"
              className="firebase-google-btn"
              onClick={() => onGoogleLogin(city)}
              disabled={busy}
            >
              <span className="firebase-google-mark">G</span>
              Continue with Google
            </button>
            <p className="google-auth-note">Secure sign-in powered by Firebase Authentication.</p>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
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
function CashHandoverModal({ booking, mode, onClose, onSubmit }: { booking: Booking; mode: 'customer' | 'driver'; onClose: () => void; onSubmit: (amount: number, pin?: string) => Promise<boolean> }) {
  const [amount, setAmount] = useState(String(Math.round(Number(booking.total || 0))));
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isCustomer = mode === 'customer';
  const validAmount = /^\d{1,7}$/.test(amount.trim()) && Number.isSafeInteger(Number(amount)) && Number(amount) >= 0;
  const submit = async () => {
    if (!validAmount) { setError('Enter a valid amount in whole rupees.'); return; }
    if (!isCustomer && !/^\d{6}$/.test(pin)) { setError('Enter all 6 digits of the customer PIN.'); return; }
    setSubmitting(true); setError('');
    try { const ok = await onSubmit(Number(amount), isCustomer ? undefined : pin); if (!ok) setError('Please review the details and try again.'); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="overlay cash-handover-overlay" onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <div className="modal cash-handover-modal">
        <button className="modal-close-btn" onClick={onClose} disabled={submitting}><X size={18}/></button>
        <div className="cash-modal-emblem"><ShieldCheck size={25}/></div>
        <span className="eyebrow">{isCustomer ? 'CUSTOMER PAYMENT CONFIRMATION' : 'DRIVER RECEIPT VERIFICATION'}</span>
        <h2>{isCustomer ? 'Confirm cash handed over' : 'Verify cash received'}</h2>
        <p className="cash-modal-intro">{isCustomer ? 'If you paid the exact trip fare, the amount is already filled in. Just confirm. Change the amount only if your final payment was different.' : 'Enter the amount you kept after returning change, then verify the customer’s one-time PIN.'}</p>
        <div className="cash-fare-summary"><span>Trip fare</span><b>{money(booking.total)}</b><small>Booking #{String(booking.id).slice(-8)} · {isCustomer ? 'Quick confirmation' : 'One-time secure verification'}</small></div>
        <label className="cash-field-label" htmlFor="cash-handover-amount">{isCustomer ? 'Final amount paid after change (₹)' : 'Amount retained / received (₹)'}</label>
        <div className="cash-amount-input"><IndianRupee size={20}/><input id="cash-handover-amount" type="text" inputMode="numeric" autoComplete="off" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setError(''); }} placeholder="Enter amount"/></div>
        {!isCustomer && <>
          <label className="cash-field-label" htmlFor="cash-handover-pin">Customer’s 6-digit secure PIN</label>
          <input id="cash-handover-pin" className="cash-pin-input" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="• • • • • •" aria-label="Six digit cash handover PIN"/>
          <small className="cash-pin-hint"><LockKeyhole size={13}/> PIN is verified securely and can only be used once.</small>
        </>}
        {error && <p className="cash-form-error"><AlertCircle size={15}/>{error}</p>}
        <div className="cash-modal-assurance"><ShieldCheck size={16}/><span>Both parties must confirm the same amount. Any mismatch is flagged for admin review—never silently marked as paid.</span></div>
        <button className="primary-btn-wide cash-submit-btn" onClick={submit} disabled={submitting || !validAmount || (!isCustomer && pin.length !== 6)}>{submitting ? 'Verifying securely…' : isCustomer ? `Confirm ${money(Number(amount || 0))} paid` : 'Verify PIN & confirm cash'} <ArrowRight size={17}/></button>
        <button className="cash-cancel-btn" onClick={onClose} disabled={submitting}>Cancel</button>
      </div>
    </div>
  );
}

function CheckoutModal({ booking, onClose, onPay }: any) {
  if (!booking) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal checkout-modal-box">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">RAZORPAY SECURE CHECKOUT</span>
        <h2>Complete Trip Payment</h2>
        <p className="checkout-route">{booking.pickup} → {booking.destination}</p>
        <div className="total-due-banner">
          <span>Total Fare Amount</span>
          <b>{money(booking.total)}</b>
        </div>
        <p className="modal-sub">Pay securely using UPI, cards, or net banking through Razorpay. VaahanSathi records payment only after server verification.</p>
        <button className="primary-btn-wide" onClick={() => onPay(booking)}>
          Continue to secure payment <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function TrackingModal({ booking, onClose }: any) {
  const [location, setLocation] = useState<any>(booking?.driverLocation || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  useEffect(() => {
    if (!booking?.id) return;
    let active = true;
    const load = async () => {
      try {
        const result = await api(`/bookings/${booking.id}/location`);
        if (!active) return;
        setLocation(result.driverLocation || null);
        setLastUpdated(result.updatedAt || '');
        setError('');
      } catch (e: any) { if (active) setError(e.message || 'Live location is not available yet.'); }
      finally { if (active) setLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [booking?.id]);
  if (!booking) return null;
  const lat = location ? Number(location.lat) : Number(booking.pickupCoordinates?.[0]);
  const lng = location ? Number(location.lng) : Number(booking.pickupCoordinates?.[1]);
  const mapUrl = Number.isFinite(lat) && Number.isFinite(lng) ? (() => {
    const delta = 0.025;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-delta}%2C${lat-delta}%2C${lng+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lng}`;
  })() : '';
  const age = lastUpdated ? Math.max(0, Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000)) : null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tracking-modal-box real-tracking-modal">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">LIVE DRIVER LOCATION</span>
        <h2>{booking.status === 'Trip started' ? 'Your trip is in progress' : 'Your driver is on the way'}</h2>
        <p className="subhead">{booking.driver || 'Your assigned driver'} · {booking.status}</p>
        {mapUrl ? <iframe title="Live driver location map" className="live-location-map" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> :
          <div className="live-map-placeholder"><MapPin size={30}/><b>Waiting for driver GPS</b><span>The map will show the driver's real position when location sharing starts.</span></div>}
        <div className="live-location-meta"><span><i className="gps-live-dot"/> {location ? 'GPS location received' : loading ? 'Connecting to driver GPS…' : 'Waiting for GPS signal'}</span><small>{age !== null ? (age < 60 ? `Updated ${age}s ago` : `Updated ${Math.floor(age/60)}m ago`) : 'No GPS update yet'}</small></div>
        {location && <p className="gps-accuracy-note">GPS accuracy ±{Math.round(location.accuracy || 0)}m · Location refreshes every 5 seconds.</p>}
        {error && <p className="fare-error">{error}</p>}
        <div className="tracking-route-meta"><div><small>PICKUP</small><b>{booking.pickup}</b></div><div><small>DESTINATION</small><b>{booking.destination}</b></div></div>
        {booking.start_otp && ['Driver assigned', 'Driver arriving'].includes(booking.status) && <div className="otp-pill">Start OTP: {booking.start_otp}</div>}
        <p className="gps-privacy-note"><ShieldCheck size={14}/> Driver GPS is shared only during this assigned active booking.</p>
      </div>
    </div>
  );
}
function RatingModal({ stars, setStars, onClose, onSubmit }: any) {
  const [whatWorked, setWhatWorked] = useState<string[]>([]);
  const [improvement, setImprovement] = useState('');
  const [safety, setSafety] = useState('Good');
  const [punctuality, setPunctuality] = useState('On time');
  const [communication, setCommunication] = useState('Just right');
  const [additional, setAdditional] = useState('');
  const [busy, setBusy] = useState(false);
  const toggleWorked = (value: string) => setWhatWorked((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  const submit = async () => {
    setBusy(true);
    try { await onSubmit({ stars, whatWorked, improvement, safety, punctuality, communication, review: additional.trim() }); }
    finally { setBusy(false); }
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal rating-modal-box detailed-feedback-modal">
        <button className="modal-close-btn" onClick={onClose} disabled={busy}><X size={18} /></button>
        <span className="eyebrow">HELP US GET BETTER</span>
        <h2>How was your ride?</h2>
        <p>Your honest feedback helps us improve driver quality, safety and the overall experience.</p>
        <div className="feedback-rating-label">Overall experience</div>
        <div className="stars-picker-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setStars(n)} aria-label={`Rate ${n} out of 5 stars`}>
              <Star size={32} fill={n <= stars ? '#f59e0b' : 'none'} color={n <= stars ? '#f59e0b' : '#cbd5e1'} />
            </button>
          ))}
        </div>
        <div className="feedback-question"><b>What did we do well?</b><small>Select all that apply</small>
          <div className="feedback-chip-list">{['Driver was polite','Safe driving','On-time pickup','Clean vehicle','Good communication','Smooth trip'].map((item) => <button type="button" key={item} className={whatWorked.includes(item) ? 'selected' : ''} onClick={() => toggleWorked(item)}>{whatWorked.includes(item) && <Check size={13} />}{item}</button>)}</div>
        </div>
        <label className="feedback-field"><b>Where can we improve?</b><select value={improvement} onChange={(e) => setImprovement(e.target.value)}><option value="">Choose an area (optional)</option><option>Pickup punctuality</option><option>Driver behaviour</option><option>Driving comfort and safety</option><option>Communication</option><option>Vehicle cleanliness</option><option>Booking and app experience</option><option>Fare or payment experience</option><option>Nothing — everything was good</option></select></label>
        <div className="feedback-select-grid">
          <label className="feedback-field"><b>Was the driving safe?</b><select value={safety} onChange={(e) => setSafety(e.target.value)}><option>Good</option><option>Average</option><option>Needs improvement</option></select></label>
          <label className="feedback-field"><b>Pickup experience</b><select value={punctuality} onChange={(e) => setPunctuality(e.target.value)}><option>On time</option><option>5–10 minutes late</option><option>More than 10 minutes late</option></select></label>
          <label className="feedback-field"><b>Communication</b><select value={communication} onChange={(e) => setCommunication(e.target.value)}><option>Just right</option><option>Too much talking</option><option>Too little communication</option><option>Unprofessional</option></select></label>
        </div>
        <label className="feedback-field"><b>Anything else you’d like us to know?</b><textarea value={additional} onChange={(e) => setAdditional(e.target.value.slice(0, 500))} placeholder="Tell us what happened or what would make your next ride better…" rows={3}/><small>{additional.length}/500 characters</small></label>
        <button className="primary-btn-wide" onClick={submit} disabled={busy}>{busy ? 'Submitting feedback…' : 'Submit feedback'} <Check size={16} /></button>
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

// Hand-coded SVG icons — no library
function NavIcon({ name }: { name: string }) {
  const s = { width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <svg {...s} viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z"/><path d="M9 22V12h6v10"/></svg>;
    case 'book':
      return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M12 7v-1" strokeWidth={1.5}/></svg>;
    case 'trips':
      return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h4m-4 4h8" strokeWidth={1.6}/></svg>;
    case 'wallet':
      return <svg {...s} viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>;
    case 'help':
      return <svg {...s} viewBox="0 0 24 24"><path d="M18 8.5a6 6 0 10-9.33 4.99L6 21l5.5-2.5a6 6 0 006.5-10z"/><path d="M12 11v.5m0 3v.01" strokeWidth={2}/></svg>;
    case 'rides':
      return <svg {...s} viewBox="0 0 24 24"><path d="M5 17H3v-5l2.5-5h11l2.5 5v5h-2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M5 12h14"/></svg>;
    case 'earnings':
      return <svg {...s} viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 10v6m-2-4h4m-4-2a2 2 0 014 0" strokeWidth={1.6}/></svg>;
    case 'profile':
      return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
    case 'overview':
      return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>;
    case 'drivers':
      return <svg {...s} viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M18 7l-1 4h-2l-1-4"/><circle cx="17" cy="6" r="1.5" fill="currentColor" stroke="none"/><path d="M20 20c0-2.5-1.3-4.5-3-5.3"/></svg>;
    default:
      return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>;
  }
}

createRoot(document.getElementById('root')!).render(<App />);
