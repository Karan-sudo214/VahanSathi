import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Camera,
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
  Video,
  Square,
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
  bookingMode?: 'immediate' | 'scheduled' | 'auto';
  amountDue?: number;
  expenseTotalDue?: number;
  expenses?: Array<{
    id: string;
    category: string;
    requestedAmount: number;
    approvedAmount?: number;
    actualAmount?: number;
    reason: string;
    litres?: number | null;
    stationName?: string | null;
    status: string;
    proofPhotoUrl?: string | null;
    receiptPhotoUrl?: string | null;
    proofPhotoCapturedAt?: string | null;
    gpsSnapshotDataUri?: string;
    gpsMapUrl?: string;
    gpsEmbedUrl?: string;
    gps?: { lat: number; lng: number; accuracy: number; deviceCapturedAt: string; serverReceivedAt: string; signature?: string };
    createdAt: string;
    customerNote?: string | null;
  }>;
  scheduledStartAt?: string;
  dispatchPriority?: { bucket: string; score: number; label: string; minutesUntilPickup: number };
  grossPayout?: number;
  earningsAdjustment?: number;
  smartMatch?: { score: number; tier: string; reasons: string[]; distanceKm: number | null; rank: number; poolSize: number } | null;
  driverMatch?: { score: number; tier: string; reasons: string[] } | null;
  carCarePassport?: { videoKey?: string; videoMimeType?: string; videoSizeBytes?: number; videoUploadedAt?: string; customerConfirmedAt?: string | null; driverConfirmedAt?: string | null } | null;
  driverLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null; speed?: number | null; updatedAt?: string };
  pickupCoordinates?: [number, number];
  destinationCoordinates?: [number, number];
  cashCollectedAt?: string;
  cashCollectedBy?: string;
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
  const refreshInFlightRef = useRef(false);
  const lastBookingsPayloadRef = useRef('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [bookingMode, setBookingMode] = useState<'immediate' | 'scheduled'>('scheduled');
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
    if (!user || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const d = await api('/bookings');
      const nextBookings = d.bookings || [];
      const payload = JSON.stringify(nextBookings);
      if (payload !== lastBookingsPayloadRef.current) {
        lastBookingsPayloadRef.current = payload;
        setBookings(nextBookings);
      }
    } catch (e: any) {
      console.warn('Booking refresh:', e.message);
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    lastBookingsPayloadRef.current = '';
    if (user) refresh();
  }, [user?.id]);

  // Push-first live updates with a lightweight polling fallback for restricted networks.
  // Fetch is used instead of EventSource so the authenticated bearer token stays in a header,
  // never in a URL or browser history.
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let retryTimer: number | undefined;
    let controller: AbortController | undefined;

    const connect = async () => {
      if (stopped) return;
      if (!navigator.onLine) {
        retryTimer = window.setTimeout(connect, 3000);
        return;
      }
      controller = new AbortController();
      try {
        const token = localStorage.getItem('vs_token');
        const response = await fetch('/api/events', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });
        if (response.status === 401) {
          window.dispatchEvent(new Event('vs-auth-expired'));
          stopped = true;
          return;
        }
        if (!response.ok || !response.body) throw new Error('Live updates are temporarily unavailable.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() || '';
          for (const frame of frames) {
            if (frame.includes('event: refresh') && document.visibilityState === 'visible') refresh();
          }
        }
      } catch (error: any) {
        if (!stopped && error?.name !== 'AbortError') console.warn('Live updates reconnecting:', error?.message || error);
      } finally {
        if (!stopped) retryTimer = window.setTimeout(connect, 2500);
      }
    };

    const fallbackTick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refresh();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onOnline = () => { refresh(); if (!controller || controller.signal.aborted) connect(); };
    connect();
    const fallback = window.setInterval(fallbackTick, 10000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      stopped = true;
      controller?.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      window.clearInterval(fallback);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [user?.id, user?.role]);

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
      if (!fare?.quoteToken) throw new Error('Please refresh your verified fare before confirming this booking.');
      const d = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({ tripType, pickup, destination, date, time, hours, vehicle, city, paymentMethod, driverStyle, bookingMode, fareQuoteToken: fare.quoteToken })
      });
      // Refresh immediately so both customer and driver see the new booking without waiting
      await refresh();
      setPage('Your trips');
      setModal('');
      flash(`Request sent! We're matching verified drivers. Reference: ${d.booking.id}`);
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
      const voiceInput = {
        tripType: intent.tripType || tripType,
        pickup: intent.pickup || pickup,
        destination: intent.destination || destination,
        date: intent.date || date,
        time: intent.time || time,
        hours: Number(intent.hours || hours),
        vehicle,
        city: intent.city || city
      };
      const quote = await api('/fare/estimate', {
        method: 'POST',
        body: JSON.stringify(voiceInput)
      });
      if (!quote?.quoteToken || !quote?.pricingAudit?.verified) {
        throw new Error('The voice trip could not receive a verified fare. Please review the trip details and try again.');
      }
      const d = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...voiceInput,
          paymentMethod,
          driverStyle,
          bookingMode,
          fareQuoteToken: quote.quoteToken
        })
      });
      await refresh();
      setVoiceAgentOpen(false);
      setPage('Your trips');
      flash(`Voice booking confirmed: ${d.booking.id}`);
    } catch (e: any) {
      flash(e.message || 'The booking could not be completed.');
      throw e;
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
          ? 'Trip completed. The driver can now mark the cash fare as collected.'
          : status === 'Trip completed'
          ? 'Trip completed! Invoice & receipt ready.'
          : `Booking updated: ${status}`
      );
      return true;
    } catch (e: any) {
      flash(e.message);
      return false;
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

  const markCashCollected = async (booking: Booking) => {
    try {
      const result = await api('/payments/cash/collect', { method: 'POST', body: JSON.stringify({ bookingId: booking.id }) });
      await refresh();
      flash(result.alreadyCollected ? 'Cash collection was already recorded.' : 'Cash collection marked successfully.');
      return true;
    } catch (error: any) {
      flash(error.message || 'Cash collection could not be recorded.');
      return false;
    }
  };

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
      ? ['Overview', 'Live trips', 'Bookings', 'Drivers', 'Customers', 'Payments & Payouts', 'Disputes', 'Support Desk', 'Pricing & Revenue', 'Analytics', 'Audit Logs', 'Settings']
      : user?.role === 'driver'
      ? ['Requests', 'My trips', 'Earnings', 'Help', 'Profile']
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
                  {x === 'Support Desk' && <Headphones size={18} />}
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
              bookingMode={bookingMode}
              setBookingMode={(mode: 'immediate' | 'scheduled') => {
                setBookingMode(mode);
                if (mode === 'immediate') {
                  const pickupAt = new Date(Date.now() + 15 * 60 * 1000);
                  const localValue = new Date(pickupAt.getTime() - pickupAt.getTimezoneOffset() * 60000).toISOString();
                  setDate(localValue.slice(0, 10));
                  setTime(localValue.slice(11, 16));
                }
                clearFareEstimate();
              }}
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
              onReportDriver={(b: Booking) => setModal('dispute:' + b.id)}
              cashRewardsPoints={Number(user?.cashRewardsPoints || 0)}
              onRefresh={refresh}
            />
          )}

          {page === 'Requests' && <DriverPage bookings={bookings} update={updateStatus} user={user} onDutyChange={(v: boolean) => setUser((u: any) => u ? {...u, available: v} : u)} flash={flash} onCashConfirm={markCashCollected} onRefresh={refresh} />}
          {page === 'My trips' && <TripsPage bookings={bookings} filter={filter} setFilter={setFilter} update={updateStatus} onRate={(b: Booking) => setModal('rate:' + b.id)} onPay={(b: Booking) => setModal('payment:' + b.id)} onTrack={(b: Booking) => setModal('track:' + b.id)} onBook={() => setPage('Book a driver')} receipts={receipts} cashRewardsPoints={Number(user?.cashRewardsPoints || 0)} onRefresh={refresh} />}
          {page === 'Earnings' && <EarningsPage bookings={bookings} />}
          {page === 'Wallet' && <WalletPage receipts={receipts} bookings={bookings} onReceipt={downloadReceipt} />}
          {page === 'Help' && <HelpPage bookings={bookings} flash={flash} onDispute={user?.role === 'customer' ? () => setModal('dispute') : undefined} />}
          {page === 'Profile' && <DriverProfile user={user} onUpdate={(u: any) => { setUser(u); localStorage.setItem('vs_user', JSON.stringify(u)); }} flash={flash} />}
          {page === 'Overview' && <LiveAdminPage bookings={bookings} focus="Overview" flash={flash} />}
          {page === 'Live trips' && <LiveAdminPage bookings={bookings} focus="Trips" flash={flash} />}
          {page === 'Bookings' && <AdminModulePage module="bookings" bookings={bookings} flash={flash} />}
          {page === 'Drivers' && <AdminModulePage module="drivers" bookings={bookings} flash={flash} />}
          {page === 'Customers' && <AdminModulePage module="customers" bookings={bookings} flash={flash} />}
          {page === 'Payments & Payouts' && <AdminModulePage module="payments" bookings={bookings} flash={flash} />}
          {page === 'Disputes' && <AdminModulePage module="disputes" bookings={bookings} flash={flash} />}
          {page === 'Support Desk' && <SupportDeskPage flash={flash} />}
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

      {(modal === 'dispute' || modal.startsWith('dispute:')) && (
        <DisputeModal
          bookings={bookings}
          defaultBookingId={modal.startsWith('dispute:') ? modal.slice(8) : ''}
          defaultSubject={modal.startsWith('dispute:') ? 'Driver demanded extra money' : ''}
          onClose={() => setModal('')}
          onSubmit={async (bookingId: string, subject: string, description: string, reportedExtraAmount?: number) => {
            try {
              await api('/disputes', { method: 'POST', body: JSON.stringify({ bookingId, subject, description, reportedExtraAmount }) });
              setModal('');
              flash('Report submitted. Customer Care will review the trip and the driver can respond before any action is taken.');
            } catch (e: any) { flash(e.message); throw e; }
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
                { label: 'Help', icon: 'help', page: 'Help' },
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

          <h3>2. Choose pickup priority</h3>
          <div className="trip-type-chips">
            <button type="button" className={`type-chip ${p.bookingMode === 'immediate' ? 'active' : ''}`} onClick={() => p.setBookingMode('immediate')}>Immediate pickup · ASAP</button>
            <button type="button" className={`type-chip ${p.bookingMode === 'scheduled' ? 'active' : ''}`} onClick={() => p.setBookingMode('scheduled')}>Schedule for later</button>
          </div>
          <p className="location-lookup-note">{p.bookingMode === 'immediate' ? 'Your request enters the urgent dispatch queue. Immediate long trips are prioritised over future reservations.' : 'Your selected date and time are saved as a scheduled request. Drivers with overlapping accepted trips are excluded.'}</p>

          <h3>3. Route & Schedule</h3>
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
            <p>Your preference is prioritised, then SmartMatch ranks verified, online partners by reliability, ratings, pickup proximity, experience and your past feedback. Availability and verification always come first.</p>
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
            {p.paymentMethod === 'cash' && <div className="cash-reward-note"><b>CashCircle rewards</b><span>Earn 1 reward point for every ₹100. The driver marks cash collected after receiving the trip fare; no cash PIN or customer confirmation is needed.</span></div>}
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

          {p.fare?.distanceKm !== null && p.fare?.distanceKm !== undefined && (
            <p className="fare-sub">
              {p.fare.distanceConfidence === 'road_route' ? 'Routed distance' : 'Approximate distance'}: {p.fare.distanceKm} km · {p.fare?.includedKm || 0} km included
              {p.fare.routeDurationMinutes ? ' · about ' + p.fare.routeDurationMinutes + ' min' : ''}
            </p>
          )}
          {p.fare?.pricingAudit && (
            <div style={{display:'grid',gap:5,margin:'10px 0',padding:'10px 11px',border:'1px solid #cfe8dd',borderRadius:11,background:'#f3fbf7'}}>
              <b style={{display:'flex',alignItems:'center',gap:7,color:'#18734f',fontSize:11}}><ShieldCheck size={14}/> Independently checked fare</b>
              <small style={{color:'#496b5b'}}>Calculation, GST, driver payout and platform share reconcile. Quote {p.fare.quoteId || ''} · valid until {p.fare.expiresAt ? new Date(p.fare.expiresAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'refresh required'}</small>
              {p.fare.pricingAudit.warnings?.map((warning: string, index: number) => <small key={index} style={{color:'#8a641f'}}>{warning}</small>)}
            </div>
          )}
          <FareLine name="Driver Service (before GST)" value={p.fare?.base || 0} />
          {p.fare?.night > 0 && <FareLine name="Night Driving Charge (before GST)" value={p.fare.night} />}
          {p.fare?.vehicleExtra > 0 && <FareLine name="Vehicle Class Add-on (before GST)" value={p.fare.vehicleExtra} />}
          {p.fare?.distanceCharge > 0 && <FareLine name={`Extra distance (${p.fare.extraDistanceKm} km, before GST)`} value={p.fare.distanceCharge} />}
          <FareLine name={`GST (${p.fare?.gstRate ?? 5}%)`} value={p.fare?.gst || 0} />

          <div className="fare-divider" />

          <div className="fare-total-row">
            <span>Total Payable</span>
            <b>{p.fare ? money(p.fare.total) : '—'}</b>
          </div>

          <div className="driver-share-box">
            <span className="share-icon"><IndianRupee size={16} /></span>
            <div>
              <b>{money(p.fare?.payout || 0)} goes directly to driver</b>
              <small>{p.fare?.driverSharePercent ?? 80}% driver payout share · {p.fare?.commissionRate ?? 20}% platform commission</small>
            </div>
          </div>

          <button
            className="primary-btn-wide"
            onClick={p.user ? p.onBook : p.onAuth}
            disabled={p.busy || p.fareBusy || !p.fare?.quoteToken}
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

function TripExpensePanel({ booking, role, onRefresh, flash }: any) {
  const expenses: any[] = Array.isArray(booking.expenses) ? booking.expenses : [];
  const [category, setCategory] = useState('fuel');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [litres, setLitres] = useState('');
  const [stationName, setStationName] = useState('');
  const [nozzlePhoto, setNozzlePhoto] = useState<File | null>(null);
  const [nozzlePhotoCapturedAt, setNozzlePhotoCapturedAt] = useState<string | null>(null);
  const [nozzlePhotoPreviewUrl, setNozzlePhotoPreviewUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [receipts, setReceipts] = useState<Record<string, File | null>>({});
  const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isDriver = role === 'driver';
  const canRequest = isDriver && booking.status === 'Trip started' &&
    !expenses.some((item) => ['pending_customer_approval', 'approved'].includes(item.status));

  const stopNozzleCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current || !cameraStreamRef.current) return;
    const video = cameraVideoRef.current;
    video.srcObject = cameraStreamRef.current;
    video.play().catch(() => setCameraError('The camera preview could not start. Close it and allow camera access.'));
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, [booking.id]);

  useEffect(() => () => {
    if (nozzlePhotoPreviewUrl) URL.revokeObjectURL(nozzlePhotoPreviewUrl);
  }, [nozzlePhotoPreviewUrl]);

  const openNozzleCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera capture is not supported by this browser. Use the latest Chrome or Safari on a secure connection.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (cameraFailure: any) {
      setCameraError(cameraFailure?.name === 'NotAllowedError'
        ? 'Camera permission is blocked. Allow camera access for VaahanSathi and try again.'
        : cameraFailure?.name === 'NotFoundError'
          ? 'No rear-facing camera was found on this device.'
          : 'The camera could not be opened. Check camera permissions and try again.');
    }
  };

  const captureNozzlePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError('The live camera is not ready yet. Wait for the preview and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Could not capture the camera frame. Please retry.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('The nozzle photo could not be created. Please retry.');
        return;
      }
      const capturedAt = new Date().toISOString();
      const photo = new File([blob], `vaahansathi-fuel-nozzle-${booking.id}-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      if (nozzlePhotoPreviewUrl) URL.revokeObjectURL(nozzlePhotoPreviewUrl);
      setNozzlePhoto(photo);
      setNozzlePhotoCapturedAt(capturedAt);
      setNozzlePhotoPreviewUrl(URL.createObjectURL(photo));
      setCameraError('');
      stopNozzleCamera();
    }, 'image/jpeg', 0.9);
  };

  const retakeNozzlePhoto = () => {
    if (nozzlePhotoPreviewUrl) URL.revokeObjectURL(nozzlePhotoPreviewUrl);
    setNozzlePhotoPreviewUrl('');
    setNozzlePhoto(null);
    setNozzlePhotoCapturedAt(null);
    void openNozzleCamera();
  };

  const captureDeviceLocation = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device does not provide GPS location. Please use a phone with location enabled.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (gpsError) => reject(new Error(gpsError.code === gpsError.PERMISSION_DENIED
        ? 'Location permission is blocked. Allow location access for VaahanSathi and try again.'
        : gpsError.code === gpsError.TIMEOUT
          ? 'The GPS fix took too long. Move to an area with a clearer GPS signal and retry.'
          : 'A current GPS fix is not available. Enable device location and retry.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 18000 }
    );
  });

  const uploadEvidence = async (
    file: File,
    kind: 'nozzle' | 'receipt',
    expenseId?: string,
    proof?: { category?: string; captureMode?: string; capturedAt?: string | null }
  ) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG or WebP photo.');
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Each expense photo must be smaller than 10 MB.');
    const ticket = await api(`/bookings/${booking.id}/expenses/evidence-upload-url`, {
      method: 'POST',
      body: JSON.stringify({
        kind, expenseId, mimeType: file.type,
        category: proof?.category || (kind === 'receipt' ? 'fuel' : 'other'),
        captureMode: proof?.captureMode || undefined,
        capturedAt: proof?.capturedAt || undefined
      })
    });
    const response = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!response.ok) throw new Error('The private evidence photo could not be uploaded. Please retry while you have a stable connection.');
    return { key: ticket.key, mimeType: file.type, sizeBytes: file.size, capturedAt: proof?.capturedAt || null };
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('request'); setError(''); setNotice('');
    try {
      const requestedAmount = Number(amount);
      if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1 || requestedAmount > 50000) {
        throw new Error('Enter an amount between ₹1 and ₹50,000.');
      }
      if (reason.trim().length < 5) throw new Error('Add a short reason for the unexpected expense.');
      if (category === 'fuel' && (!nozzlePhoto || !nozzlePhotoCapturedAt || !nozzlePhotoPreviewUrl)) {
        throw new Error('Capture a fresh photo from the in-app rear camera. Gallery photos are not accepted for petrol requests.');
      }

      // Obtain a fresh high-accuracy fix after the camera capture. The backend
      // timestamps and signs the GPS evidence card before it is shown to the customer.
      const position = await captureDeviceLocation();
      if (position.coords.accuracy > 100) throw new Error('GPS accuracy is too weak (over 100 m). Please retry where the GPS signal is clearer.');
      await api(`/bookings/${booking.id}/location`, {
        method: 'POST',
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          capturedAt: position.timestamp,
          source: 'expense_capture'
        })
      });

      let uploaded = { key: '', mimeType: '', sizeBytes: 0, capturedAt: null as string | null };
      if (nozzlePhoto) {
        uploaded = await uploadEvidence(nozzlePhoto, 'nozzle', undefined, {
          category,
          captureMode: category === 'fuel' ? 'live_camera' : 'file_picker',
          capturedAt: category === 'fuel' ? nozzlePhotoCapturedAt : null
        });
        uploaded.capturedAt = category === 'fuel' ? nozzlePhotoCapturedAt : null;
      }
      await api(`/bookings/${booking.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          category,
          amount: requestedAmount,
          reason: reason.trim(),
          litres: litres ? Number(litres) : null,
          stationName: stationName.trim(),
          photoKey: uploaded.key || undefined,
          mimeType: uploaded.mimeType || undefined,
          sizeBytes: uploaded.sizeBytes || undefined,
          photoCapturedAt: uploaded.capturedAt || undefined
        })
      });
      setAmount(''); setReason(''); setLitres(''); setStationName('');
      setNozzlePhoto(null); setNozzlePhotoCapturedAt(null);
      if (nozzlePhotoPreviewUrl) URL.revokeObjectURL(nozzlePhotoPreviewUrl);
      setNozzlePhotoPreviewUrl('');
      setNotice('Request sent. The customer will see the photo and app-generated GPS proof before approving it.');
      await onRefresh?.();
    } catch (submitError: any) {
      setError(submitError?.message || 'The expense request could not be submitted.');
    } finally { setBusy(''); }
  };

  const submitReceipt = async (expense: any) => {
    const file = receipts[expense.id];
    const actualAmount = Number(actualAmounts[expense.id] || 0);
    if (!file) { setError('Select a clear photo of the fuel receipt.'); return; }
    if (!Number.isSafeInteger(actualAmount) || actualAmount < 1 || actualAmount > Number(expense.approvedAmount || 0)) {
      setError(`Enter the actual amount, up to the approved limit of ${money(expense.approvedAmount)}.`);
      return;
    }
    setBusy(expense.id); setError(''); setNotice('');
    try {
      const uploaded = await uploadEvidence(file, 'receipt', expense.id);
      await api(`/bookings/${booking.id}/expenses/${expense.id}/receipt`, {
        method: 'POST',
        body: JSON.stringify({ actualAmount, receiptKey: uploaded.key, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes })
      });
      setNotice('Receipt submitted. The actual amount is attached to the booking and included in its final payment.');
      await onRefresh?.();
    } catch (receiptError: any) {
      setError(receiptError?.message || 'The receipt could not be submitted.');
    } finally { setBusy(''); }
  };

  const decide = async (expense: any, decision: 'approve' | 'decline') => {
    setBusy(expense.id); setError(''); setNotice('');
    try {
      await api(`/bookings/${booking.id}/expenses/${expense.id}/decision`, {
        method: 'POST', body: JSON.stringify({ decision })
      });
      setNotice(decision === 'approve'
        ? `Approved up to ${money(expense.requestedAmount)}. The driver must upload the fuel receipt after filling.`
        : 'Expense request declined. No amount has been added to your booking.');
      await onRefresh?.();
    } catch (decisionError: any) {
      setError(decisionError?.message || 'Your decision could not be saved.');
    } finally { setBusy(''); }
  };

  if (role === 'customer' && expenses.length === 0) return null;
  if (role === 'driver' && expenses.length === 0 && !canRequest) return null;

  return (
    <section className="panel" style={{ padding: 14, marginTop: 14, border: '1px solid var(--slate-200)' }}>
      <div className="panel-header" style={{ alignItems: 'center' }}>
        <div>
          <span className="eyebrow">TRIP EXPENSES</span>
          <h3 style={{ margin: '3px 0' }}>{isDriver ? 'Request an extra expense' : 'Expense approval & proof'}</h3>
          <p style={{ margin: 0 }}>{isDriver ? 'Ask the customer before spending. Fuel requests require a live GPS proof and nozzle photo.' : 'Only requests you approve and receipts uploaded afterwards are included in the final amount.'}</p>
        </div>
        {Number(booking.expenseTotalDue || 0) > 0 && <span className="status-pill">{money(booking.expenseTotalDue)} added</span>}
      </div>

      {expenses.map((expense: any) => (
        <div key={expense.id} style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <b>{({ fuel: 'Petrol / fuel', toll: 'Toll', parking: 'Parking', other: 'Other expense' } as any)[expense.category] || 'Trip expense'}</b>
            <span className="status-pill">{String(expense.status || '').replace(/_/g, ' ')}</span>
          </div>
          <p style={{ margin: '6px 0' }}>{expense.reason}</p>
          <p style={{ margin: '4px 0' }}><b>Requested:</b> {money(expense.requestedAmount)}{expense.litres ? ` · ${expense.litres} L` : ''}{expense.stationName ? ` · ${expense.stationName}` : ''}</p>
          {expense.proofPhotoUrl && (
            <div style={{ marginTop: 10 }}>
              <small className="eyebrow">DRIVER PHOTO EVIDENCE · LIVE CAMERA</small>
              <img src={expense.proofPhotoUrl} alt="Fresh live camera capture of the petrol nozzle and vehicle" style={{ width: '100%', maxHeight: 250, objectFit: 'contain', background: '#f1f5f9', borderRadius: 10, marginTop: 6 }} />
              {expense.proofPhotoCapturedAt && <small style={{ display: 'block', color: 'var(--slate-500)' }}>Camera capture time: {new Date(expense.proofPhotoCapturedAt).toLocaleString('en-IN')}</small>}
            </div>
          )}
          {expense.gpsSnapshotDataUri && (
            <div style={{ marginTop: 10 }}>
              <small className="eyebrow">SYSTEM-CAPTURED GPS SNAPSHOT</small>
              <img src={expense.gpsSnapshotDataUri} alt="VaahanSathi system-generated GPS location proof with server timestamp and signature" style={{ width: '100%', maxHeight: 230, objectFit: 'contain', background: '#f1f5f9', borderRadius: 10, marginTop: 6 }} />
              {expense.gpsEmbedUrl && (
                <iframe
                  title="System-captured fuel expense GPS map"
                  src={expense.gpsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: 220, border: 0, borderRadius: 10, marginTop: 8 }}
                />
              )}
              {expense.gpsMapUrl && <a href={expense.gpsMapUrl} target="_blank" rel="noreferrer" className="link-btn-inline">Open captured coordinates in OpenStreetMap</a>}
              {expense.gps && <small style={{ display: 'block', color: 'var(--slate-500)' }}>GPS accuracy ±{Math.round(expense.gps.accuracy)} m · Server time {new Date(expense.gps.serverReceivedAt).toLocaleString('en-IN')} · Server-signed evidence record</small>}
              <small className="muted">This is an app-generated GPS record, not a driver-uploaded screenshot. Device location can still be affected by weak signals or mock-location settings.</small>
            </div>
          )}

          {role === 'customer' && expense.status === 'pending_customer_approval' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="primary-btn" disabled={busy === expense.id} onClick={() => decide(expense, 'approve')}>Approve up to {money(expense.requestedAmount)}</button>
              <button className="secondary-btn" disabled={busy === expense.id} onClick={() => decide(expense, 'decline')}>Decline request</button>
            </div>
          )}
          {role === 'customer' && expense.status === 'approved' && <small className="muted">Approved up to {money(expense.approvedAmount)}. Waiting for the driver’s final pump receipt.</small>}
          {expense.receiptPhotoUrl && (
            <div style={{ marginTop: 10 }}>
              <small className="eyebrow">FINAL FUEL RECEIPT</small>
              <img src={expense.receiptPhotoUrl} alt="Uploaded petrol station receipt" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#f1f5f9', borderRadius: 10, marginTop: 6 }} />
            </div>
          )}
          {['confirmed', 'paid'].includes(expense.status) && (
            <p style={{ margin: '8px 0' }}><b>Actual amount:</b> {money(expense.actualAmount)} {expense.status === 'paid' ? '· included in paid booking amount' : '· added to final booking payment'}</p>
          )}
          {role === 'driver' && expense.status === 'pending_customer_approval' && (
            <div className="carcare-waiting" style={{ marginTop: 10 }}>
              <Clock3 size={15} /> Do not refuel yet. Wait until the customer approves this exact amount.
            </div>
          )}
          {role === 'driver' && expense.status === 'approved' && (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <label className="field-group"><span>Actual amount on fuel receipt (up to {money(expense.approvedAmount)})</span>
                <input type="number" min="1" max={expense.approvedAmount} step="1" value={actualAmounts[expense.id] || ''} onChange={(e) => setActualAmounts((current) => ({ ...current, [expense.id]: e.target.value }))} placeholder="Enter actual amount in rupees" />
              </label>
              <label className="field-group"><span>Upload fuel station receipt photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setReceipts((current) => ({ ...current, [expense.id]: e.target.files?.[0] || null }))} />
              </label>
              <button className="primary-btn" disabled={busy === expense.id || !receipts[expense.id] || !actualAmounts[expense.id]} onClick={() => submitReceipt(expense)}>
                {busy === expense.id ? 'Uploading receipt…' : 'Submit fuel receipt & actual amount'}
              </button>
            </div>
          )}
          {expense.status === 'declined' && <small className="muted">Customer declined this request. No expense has been charged.</small>}
        </div>
      ))}

      {canRequest && (
        <form onSubmit={submitRequest} style={{ display: 'grid', gap: 10, marginTop: 12, borderTop: '1px solid var(--slate-200)', paddingTop: 12 }}>
          <label className="field-group"><span>Expense type</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="fuel">Petrol / fuel</option>
              <option value="toll">Toll</option>
              <option value="parking">Parking</option>
              <option value="other">Other unexpected expense</option>
            </select>
          </label>
          <label className="field-group"><span>Amount requested (₹)</span>
            <input type="number" min="1" max="50000" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter exact amount you need" />
          </label>
          {category === 'fuel' && (
            <>
              <label className="field-group"><span>Fuel amount (litres, optional)</span>
                <input type="number" min="0.1" max="200" step="0.1" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="Example: 8.5" />
              </label>
              <label className="field-group"><span>Petrol station (optional)</span>
                <input maxLength={120} value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="Station name / area" />
              </label>
              <div className="field-group">
                <span>Live photo of the petrol nozzle (required)</span>
                {!cameraOpen && !nozzlePhotoPreviewUrl && (
                  <button type="button" className="secondary-btn" onClick={openNozzleCamera}>
                    <Camera size={16} /> Open rear camera & capture nozzle
                  </button>
                )}
                {cameraOpen && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      aria-label="Live rear camera preview for fuel nozzle proof"
                      style={{ width: '100%', maxHeight: 320, objectFit: 'cover', background: '#0f172a', borderRadius: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="primary-btn" onClick={captureNozzlePhoto}><Camera size={15} /> Capture live photo</button>
                      <button type="button" className="secondary-btn" onClick={stopNozzleCamera}>Cancel camera</button>
                    </div>
                  </div>
                )}
                {nozzlePhotoPreviewUrl && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <img src={nozzlePhotoPreviewUrl} alt="Fresh in-app camera capture of the car's petrol nozzle" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, background: '#0f172a' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <small className="muted">Captured by VaahanSathi camera · {nozzlePhotoCapturedAt ? new Date(nozzlePhotoCapturedAt).toLocaleString('en-IN') : ''}</small>
                      <button type="button" className="secondary-btn" onClick={retakeNozzlePhoto}>Retake photo</button>
                    </div>
                  </div>
                )}
                {cameraError && <small className="tripguard-error">{cameraError}</small>}
              </div>
              <small className="muted">Use the live rear camera. Keep the car’s fuel inlet, nozzle and pump area visible. The app attaches a fresh GPS fix, timestamp and system-generated location evidence. Do not use a saved gallery image.</small>
            </>
          )}
          {category !== 'fuel' && (
            <label className="field-group"><span>Supporting photo (optional)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setNozzlePhoto(e.target.files?.[0] || null)} />
            </label>
          )}
          <label className="field-group"><span>Why is this expense needed?</span>
            <textarea rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly explain why this extra spend is needed during the trip." />
          </label>
          <button className="primary-btn-wide" type="submit" disabled={busy === 'request' || cameraOpen || !amount || reason.trim().length < 5 || (category === 'fuel' && (!nozzlePhoto || !nozzlePhotoCapturedAt))}>
            {busy === 'request' ? 'Capturing GPS & submitting…' : 'Send proof for customer approval'}
          </button>
        </form>
      )}

      {notice && <p className="tripguard-status" role="status">{notice}</p>}
      {error && <p className="tripguard-error" role="alert">{error}</p>}
    </section>
  );
}

// ----------------- Trips Page -----------------
function TripsPage({ bookings, filter, setFilter, update, onRate, onPay, onTrack, onBook, receipts, onReportDriver, onRefresh, cashRewardsPoints = 0 }: any) {
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

      <div className="cashcircle-summary"><span className="cashcircle-icon">₹</span><div><b>CashCircle rewards</b><small>{cashRewardsPoints} points earned from cash trips marked as collected</small></div></div>
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

              <TripExpensePanel booking={b} role="customer" onRefresh={onRefresh} />

              {b.status === 'Driver arriving' && (
                <CarCarePassport booking={b} role="customer" onRefresh={onRefresh} />
              )}

              {/* Live, transparent trip progress */}
              {b.status !== 'Cancelled' && (() => {
                const stages = ['Searching', 'Driver assigned', 'Driver arriving', 'Trip started', 'Trip completed'];
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
                          <span>{stage === 'Searching' ? 'Finding a driver' : stage}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="trip-progress-note"><ShieldCheck size={14} /> Only share your start OTP when you are with your assigned driver.</p>
                  </section>
                );
              })()}

              {['Driver arriving', 'Trip started'].includes(b.status) && <TripGuardPanel booking={b} role="customer" onRefresh={onRefresh} />}

              {/* OTP Cards for active trips */}
              {['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status) && (
                <section className="trip-otp-panel" aria-label="Trip verification codes">
                  <div className="trip-otp-heading">
                    <span className="trip-otp-shield"><ShieldCheck size={19}/></span>
                    <div><b>Your trip security codes</b><small>Only share the code for the stage you are completing</small></div>
                    <span className="trip-otp-secure">SECURE</span>
                  </div>
                  <div className="trip-otp-grid">
                    <div className="trip-otp-card start">
                      <div className="trip-otp-card-top"><span className="trip-otp-step">01</span><small>START TRIP</small><span className={b.status === 'Trip started' ? 'trip-otp-state used' : 'trip-otp-state'}>{b.status === 'Trip started' ? 'VERIFIED' : 'PENDING'}</span></div>
                      <strong>{b.status === 'Trip started' ? '••••' : (b.start_otp || '----')}</strong>
                      <p>{b.status === 'Trip started' ? 'Your trip has started successfully' : 'Share when your assigned driver is with you and ready to begin'}</p>
                    </div>
                    {b.status === 'Trip started' && <div className="trip-otp-card end"><div className="trip-otp-card-top"><span className="trip-otp-step">02</span><small>END TRIP</small><span className="trip-otp-state">PENDING</span></div><strong>{b.end_otp || '----'}</strong><p>Share only after you have reached your destination and the trip is finished</p></div>}
                  </div>
                  <div className="trip-otp-safety"><LockKeyhole size={15}/><span>Never share an OTP over a call or before the correct trip stage. VaahanSathi will never ask you to disclose it for support.</span></div>
                </section>
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
                {b.driverMatch && (
                  <div className="customer-smart-match">
                    <span><BadgeCheck size={14}/> SmartMatch · {b.driverMatch.score}% fit</span>
                    <small>{b.driverMatch.reasons.join(' · ')}</small>
                  </div>
                )}

                <div className="trip-actions-row single">
                  {['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status) && (
                    <button className="action-btn track" onClick={() => onTrack(b)}>
                      <Navigation size={16} /> Track Driver Route
                    </button>
                  )}
                  {onReportDriver && b.driverId && !['Trip completed', 'Rated', 'Cancelled'].includes(b.status) && (
                    <button className="action-btn" onClick={() => onReportDriver(b)}>
                      <AlertCircle size={15} /> Report an extra-money request
                    </button>
                  )}
                </div>
                {['Trip completed', 'Rated'].includes(b.status) && (
                  <>
                    <div className="trip-actions-row">
                      {b.status === 'Trip completed' && <button className="action-btn rate" onClick={() => onRate(b)}><Star size={16} /> Rate Driver</button>}
                      {b.payment_status === 'Paid' || b.payment_status === 'Paid · Cash'
                        ? <span className="status-pill done">Paid · {b.payment_method === 'cash' ? 'Cash' : 'Online'}</span>
                        : b.payment_method === 'cash'
                          ? <span className="status-pill">Cash due · Pay your assigned driver directly</span>
                          : <button className="action-btn pay" onClick={() => onPay(b)}><CreditCard size={16} /> Pay {money(b.amountDue ?? b.total)}</button>}
                      {b.payment_method === 'cash' && b.payment_status !== 'Paid · Cash' && (
                        <small className="muted">No cash PIN or customer confirmation is required. The driver marks collection after receiving the trip fare.</small>
                      )}
                    </div>
                    <div className="trip-actions-row">
                      {onReportDriver && (
                        <button className="action-btn" onClick={() => onReportDriver(b)}>
                          <AlertCircle size={15} /> Report driver asking for extra money
                        </button>
                      )}
                      <button className="action-btn" onClick={() => downloadInvoice(b)}>
                        <FileText size={15} /> Download Invoice
                      </button>
                      {receipts.some((r: Receipt) => r.bookingId === b.id) && (
                        <button className="action-btn" onClick={() => downloadReceipt(b, receipts.find((r: Receipt) => r.bookingId === b.id)!)}>
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
function DriverComplaintsPanel({ user, flash }: any) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    try {
      const result = await api('/driver/complaints');
      setComplaints(result.complaints || []);
      setAdjustments(result.adjustments || []);
    } catch (error: any) { console.warn('Driver complaint refresh:', error.message); }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const submitResponse = async (item: any) => {
    const response = String(responses[item.id] || '').trim();
    if (response.length < 5) { flash?.('Please add a little more detail to your response.'); return; }
    setBusyId(item.id);
    try {
      await api(`/driver/complaints/${item.id}`, { method: 'PATCH', body: JSON.stringify({ response }) });
      setResponses((current) => ({ ...current, [item.id]: '' }));
      flash?.('Your response has been sent to Customer Care.');
      await load();
    } catch (error: any) { flash?.(error.message); }
    finally { setBusyId(''); }
  };

  if (!complaints.length && !adjustments.length) return null;
  return (
    <section className="panel driver-badges-panel">
      <div className="panel-header">
        <div><span className="eyebrow">CUSTOMER CARE</span><h3>Complaints & your responses</h3><p>Review reports linked to your trips and share your side of the story.</p></div>
        <span className="status-pill">{complaints.filter((c) => !['resolved','closed','unsubstantiated'].includes(c.status)).length} open</span>
      </div>
      {complaints.map((item) => (
        <div key={item.id} className="panel" style={{padding:14,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <b>{item.subject || 'Customer report'}</b><span className="status-pill">{String(item.status || 'under_review').replace(/_/g,' ')}</span>
          </div>
          <small>{item.bookingId || 'No booking reference'} · {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'Recently reported'}</small>
          {item.route && <p style={{margin:'8px 0'}}>{item.route}</p>}
          <p style={{margin:'8px 0'}}>{item.description}</p>
          {Number(item.reportedExtraAmount) > 0 && <p><b>Extra amount reported:</b> {money(item.reportedExtraAmount)}</p>}
          {item.resolution && <p><b>Customer Care note:</b> {item.resolution}</p>}
          {item.driverResponse && <p><b>Your last response:</b> {item.driverResponse}</p>}
          {!['resolved','closed','unsubstantiated'].includes(item.status) && (
            <div style={{display:'grid',gap:8,marginTop:10}}>
              <textarea rows={3} value={responses[item.id] || ''} onChange={(e) => setResponses((current) => ({...current,[item.id]:e.target.value.slice(0,1000)}))} placeholder="Share your explanation or supporting context…" style={{width:'100%',padding:10,border:'1px solid var(--slate-200)',borderRadius:8,fontFamily:'inherit'}} />
              <button className="primary-btn" disabled={busyId === item.id || String(responses[item.id] || '').trim().length < 5} onClick={() => submitResponse(item)}>{busyId === item.id ? 'Sending…' : 'Submit your response'}</button>
              <small className="muted">A report does not automatically reduce your earnings. Customer Care reviews both sides first.</small>
            </div>
          )}
          {item.earningsAdjustmentAmount > 0 && <p style={{color:'#b45309'}}><b>Reviewed earnings adjustment:</b> {money(item.earningsAdjustmentAmount)}. Contact Customer Care to ask for a review.</p>}
        </div>
      ))}
      {adjustments.length > 0 && (
        <div style={{marginTop:12}}>
          <b>Approved earnings adjustments</b>
          {adjustments.map((adjustment) => <div className="earning-item-row" key={adjustment.id}><span>{adjustment.bookingId || 'Trip'} · {adjustment.description}</span><strong>{money(adjustment.amount)}</strong></div>)}
        </div>
      )}
    </section>
  );
}

function DriverPage({ bookings, update, user, onDutyChange, flash, onCashConfirm, onRefresh }: any) {
  const [available, setAvailable] = useState<boolean>(user?.available === true);
  const [otpTarget, setOtpTarget] = useState<{ booking: Booking; status: 'Trip started' | 'Trip completed' } | null>(null);
  const [dutyBusy, setDutyBusy] = useState(false);
  const prevSearching = useRef(0);

  // Keep the dashboard's duty switch in sync with the latest server profile.
  useEffect(() => {
    if (typeof user?.available === 'boolean') setAvailable(user.available);
  }, [user?.available]);
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

  const completed = bookings.filter((b: Booking) => b.driverId === user?.id && ['Trip completed', 'Rated'].includes(b.status));
  const totalEarnings = completed.reduce((s: number, b: Booking) => s + b.payout, 0);

  // One GPS watcher per driver. Send meaningful movement at a controlled cadence
  // instead of opening a separate high-accuracy watcher for every active booking.
  const gpsLastSentRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const active = bookings.filter((b: Booking) => b.driverId === user?.id && ['Driver assigned', 'Driver arriving', 'Trip started'].includes(b.status));
    if (!active.length) return;
    let sending = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (document.visibilityState !== 'visible' || !navigator.onLine || sending) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const now = Date.now();
        const previous = gpsLastSentRef.current;
        const distanceMeters = previous
          ? Math.hypot((lat - previous.lat) * 111000, (lng - previous.lng) * 111000 * Math.cos(lat * Math.PI / 180))
          : Infinity;
        if (previous && now - previous.at < 4000 && distanceMeters < 10) return;
        gpsLastSentRef.current = { at: now, lat, lng };
        sending = true;
        const payload = {
          lat, lng, accuracy: position.coords.accuracy,
          heading: position.coords.heading, speed: position.coords.speed,
          capturedAt: position.timestamp
        };
        Promise.all(active.map((booking: Booking) => api(`/bookings/${booking.id}/location`, {
          method: 'POST', body: JSON.stringify(payload)
        }))).catch((error: any) => console.warn('GPS update:', error.message))
          .finally(() => { sending = false; });
      },
      (error) => console.warn('Driver GPS permission or signal:', error.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
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

      <DriverComplaintsPanel user={user} flash={flash} />

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

              {b.status === 'Searching' && b.dispatchPriority && (
                <div className="smart-match-card">
                  <div className="smart-match-topline">
                    <span className="smart-match-kicker"><Zap size={13}/> DISPATCH PRIORITY</span>
                    <b>{b.dispatchPriority.label}</b>
                  </div>
                  <div className="smart-match-meta">
                    <span>{b.bookingMode === 'immediate' ? 'Immediate request' : 'Scheduled request'}</span>
                    <span>{b.dispatchPriority.minutesUntilPickup <= 0 ? 'Pickup time reached' : `Pickup in ${b.dispatchPriority.minutesUntilPickup} min`}</span>
                  </div>
                </div>
              )}

              {b.status === 'Searching' && b.smartMatch && (
                <div className="smart-match-card">
                  <div className="smart-match-topline">
                    <span className="smart-match-kicker"><Zap size={13}/> SMARTMATCH</span>
                    <b>{b.smartMatch.score}% · {b.smartMatch.tier}</b>
                  </div>
                  <div className="smart-match-progress"><span style={{ width: b.smartMatch.score + '%' }} /></div>
                  <div className="smart-match-meta">
                    <span>{b.smartMatch.rank === 1 ? 'Top recommended match' : 'Match priority #' + b.smartMatch.rank + ' of ' + b.smartMatch.poolSize}</span>
                    {b.smartMatch.distanceKm !== null && <span>{b.smartMatch.distanceKm} km from pickup (last shared GPS)</span>}
                  </div>
                  <div className="smart-match-reasons">{b.smartMatch.reasons.map((reason: string) => <span key={reason}><Check size={12}/>{reason}</span>)}</div>
                </div>
              )}

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
                  {b.status === 'Driver arriving' && b.driverId === user?.id && (
                    <CarCarePassport booking={b} role="driver" onRefresh={onRefresh} />
                  )}
                  {b.status === 'Driver arriving' && (
                    <button
                      className="primary-btn"
                      style={{width:'100%',justifyContent:'center',background:'#0a7a6e'}}
                      disabled={!b.carCarePassport?.customerConfirmedAt || !b.carCarePassport?.driverConfirmedAt}
                      onClick={() => setOtpTarget({ booking: b, status: 'Trip started' })}
                    >
                      <ArrowRight size={18} /> {b.carCarePassport?.customerConfirmedAt && b.carCarePassport?.driverConfirmedAt ? 'Verify start OTP' : 'Complete CarCare Passport first'}
                    </button>
                  )}
                  {b.status === 'Trip completed' && b.payment_method === 'cash' && b.payment_status !== 'Paid · Cash' && (
                    <div className="driver-cash-action">
                      <div><b>Cash collection</b><small>After receiving the agreed fare, mark it as collected. No cash OTP or customer-side verification is required.</small></div>
                      <button className="primary-btn" style={{width:'100%',justifyContent:'center',background:'#0a7a6e'}} onClick={() => onCashConfirm(b)}><IndianRupee size={17}/> Mark {money(b.amountDue ?? b.total)} collected</button>
                    </div>
                  )}
                  {b.status === 'Trip started' && (
                    <button
                      className="primary-btn success"
                      style={{width:'100%',justifyContent:'center'}}
                      onClick={() => setOtpTarget({ booking: b, status: 'Trip completed' })}
                    >
                      <Check size={18} /> Verify end OTP & complete
                    </button>
                  )}
                </div>
              </div>
              {(b.status === 'Trip started' || (b.expenses || []).length > 0) && (
                <TripExpensePanel booking={b} role="driver" onRefresh={onRefresh} />
              )}
            </div>
          ))}
        </div>
      )}
      {otpTarget && (
        <OTPVerificationModal
          booking={otpTarget.booking}
          stage={otpTarget.status === 'Trip started' ? 'start' : 'end'}
          onClose={() => setOtpTarget(null)}
          onSubmit={async (code: string) => {
            const verified = await update(otpTarget.booking, otpTarget.status, code);
            if (verified !== false) setOtpTarget(null);
            else throw new Error('The code could not be verified. Please check it and try again.');
          }}
        />
      )}
    </div>
  );
}


function TripGuardPanel({ booking, role, onRefresh }: any) {
  const guard = booking.tripGuard || {};
  const consents = guard.consents || {};
  const sessions = guard.sessions || [];
  const activeSession = sessions.find((session: any) => session.status === 'recording');
  const latestSession = sessions.find((session: any) => session.status !== 'recording');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [playUrl, setPlayUrl] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadQueueRef = useRef<Promise<any>>(Promise.resolve());
  const nextIndexRef = useRef(0);
  const isCustomer = role === 'customer';
  const ownConsent = consents[role]?.consent === true;
  const bothConsented = consents.customer?.consent === true && consents.driver?.consent === true;

  const setConsent = async (consent: boolean) => {
    setBusy(true); setError('');
    try {
      await api(`/bookings/${booking.id}/tripguard/consent`, { method: 'POST', body: JSON.stringify({ consent }) });
      if (!consent && recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      await onRefresh?.();
    } catch (e: any) { setError(e?.message || 'Could not save consent.'); }
    finally { setBusy(false); }
  };


  useEffect(() => {
    if (!activeSession?.id || !recorderRef.current) return;
    const pollId = window.setInterval(async () => {
      try {
        const state = await api(`/bookings/${booking.id}/tripguard/state`);
        const live = state.bookingStatus === 'Trip started' &&
          state.tripGuard?.consents?.customer?.consent === true &&
          state.tripGuard?.consents?.driver?.consent === true &&
          state.tripGuard?.sessions?.some((session: any) => session.id === activeSession.id && session.status === 'recording');
        if (!live && recorderRef.current && recorderRef.current.state !== 'inactive') {
          setStatus('Recording stopped because the trip ended or a participant withdrew consent.');
          recorderRef.current.stop();
        }
      } catch {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      }
    }, 1000);
    return () => window.clearInterval(pollId);
  }, [activeSession?.id, booking.id]);

  const uploadSegment = async (recordingId: string, blob: Blob, index: number, mimeType: string) => {
    const signed = await api(`/bookings/${booking.id}/tripguard/recordings/${recordingId}/chunk-url`, {
      method: 'POST', body: JSON.stringify({ index, mimeType })
    });
    const uploaded = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type || 'video/webm' }, body: blob });
    if (!uploaded.ok) throw new Error('A video segment could not be securely uploaded. Stop and retry when your connection is stable.');
    await api(`/bookings/${booking.id}/tripguard/recordings/${recordingId}/chunk-saved`, {
      method: 'POST', body: JSON.stringify({ index, key: signed.key, bytes: blob.size })
    });
  };

  const startRecording = async () => {
    setBusy(true); setError(''); setStatus('');
    let sessionId: string | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('This browser does not support video recording. Your trip can continue without recording.');
      }
      const candidates = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const supportedMime = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const storageMime = supportedMime?.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      // Request camera access directly from the button gesture for iOS Safari compatibility.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      streamRef.current = stream;
      const started = await api(`/bookings/${booking.id}/tripguard/recordings/start`, {
        method: 'POST', body: JSON.stringify({ mimeType: storageMime })
      });
      sessionId = started.session.id;
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      nextIndexRef.current = 0;
      uploadQueueRef.current = Promise.resolve();
      recorder.ondataavailable = (event) => {
        if (!event.data || !event.data.size) return;
        const index = nextIndexRef.current++;
        uploadQueueRef.current = uploadQueueRef.current.then(() => uploadSegment(started.session.id, event.data, index, storageMime)).catch((e) => {
          setError(e?.message || 'A video segment could not be uploaded. Stop recording and check your connection.');
          throw e;
        });
      };
      recorder.onerror = () => setError('The browser interrupted video capture. Stop the recording and check camera permissions.');
      recorder.onstop = async () => {
        try {
          await uploadQueueRef.current;
          await api(`/bookings/${booking.id}/tripguard/recordings/${started.session.id}/stop`, { method: 'POST', body: JSON.stringify({ reason: 'Customer ended recording' }) });
          setStatus('Recording securely saved for this trip.');
          await onRefresh?.();
        } catch (e: any) { setError(e?.message || 'Recording could not be fully saved.'); }
        finally { stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; recorderRef.current = null; setBusy(false); }
      };
      recorder.start(5000);
      setStatus('Recording is live. Keep this screen open and your phone awake for the full trip.');
      setBusy(false);
      await onRefresh?.();
    } catch (e: any) {
      if (sessionId) {
        try { await api(`/bookings/${booking.id}/tripguard/recordings/${sessionId}/stop`, { method: 'POST', body: JSON.stringify({ reason: 'Recording could not start on this device' }) }); } catch {}
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(e?.message || 'Could not start TripGuard recording.');
      setBusy(false);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setBusy(true);
      recorder.stop();
    } else if (activeSession && isCustomer) {
      setBusy(true);
      api(`/bookings/${booking.id}/tripguard/recordings/${activeSession.id}/stop`, { method: 'POST', body: JSON.stringify({ reason: 'Customer stopped recording from trip dashboard' }) })
        .then(() => onRefresh?.()).catch((e: any) => setError(e?.message || 'Could not stop recording.')).finally(() => setBusy(false));
    }
  };

  const raiseAlert = async () => {
    if (!note.trim()) { setError('Tell us briefly what feels wrong so it is attached to the trip.'); return; }
    setBusy(true); setError('');
    try {
      await api(`/bookings/${booking.id}/tripguard/alerts`, { method: 'POST', body: JSON.stringify({ category: 'Customer safety concern', note }) });
      setNote(''); setStatus('Your safety concern has been recorded against this trip.');
      await onRefresh?.();
    } catch (e: any) { setError(e?.message || 'Could not submit your concern.'); }
    finally { setBusy(false); }
  };

  const viewRecording = async (session: any) => {
    setBusy(true); setError('');
    try {
      const access = await api(`/bookings/${booking.id}/tripguard/recordings/${session.id}/access`);
      const blobs: Blob[] = [];
      for (const chunk of access.chunks) {
        const response = await fetch(chunk.url);
        if (!response.ok) throw new Error('A saved video segment could not be loaded.');
        blobs.push(await response.blob());
      }
      const blob = new Blob(blobs, { type: access.session.mimeType || 'video/webm' });
      if (playUrl) URL.revokeObjectURL(playUrl);
      setPlayUrl(URL.createObjectURL(blob));
    } catch (e: any) { setError(e?.message || 'Could not open this trip recording.'); }
    finally { setBusy(false); }
  };

  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => () => { if (playUrl) URL.revokeObjectURL(playUrl); }, [playUrl]);

  return (
    <section className="tripguard-panel" aria-label="TripGuard customer safety controls">
      <div className="tripguard-heading">
        <span className="tripguard-shield"><ShieldCheck size={21}/></span>
        <div><b>TripGuard · Your journey, your control</b><small>Optional, consent-based cabin video and audio recording</small></div>
        <span className={activeSession ? 'tripguard-live' : 'tripguard-private'}>{activeSession ? '● RECORDING' : 'PRIVATE'}</span>
      </div>
      <p className="tripguard-copy">Recording is never hidden. Both you and your assigned driver must agree. You can withdraw consent or stop recording at any time; your trip will continue either way.</p>
      <div className="tripguard-consents">
        <div><b>Customer</b><span>{consents.customer?.consent ? '✓ Agreed' : 'Not agreed'}</span></div>
        <div><b>Driver</b><span>{consents.driver?.consent ? '✓ Agreed' : 'Waiting for driver'}</span></div>
      </div>
      {!ownConsent && <button className="tripguard-consent-btn" disabled={busy} onClick={() => setConsent(true)}>I agree to video & audio recording</button>}
      {ownConsent && <button className="tripguard-withdraw-btn" disabled={busy} onClick={() => setConsent(false)}>Withdraw my consent</button>}
      {isCustomer && booking.status === 'Trip started' && bothConsented && !activeSession && (
        <button className="tripguard-start-btn" disabled={busy || !r2ReadyPlaceholder()} onClick={startRecording}><Video size={17}/> Start whole-trip recording</button>
      )}
      {isCustomer && activeSession && <button className="tripguard-stop-btn" disabled={busy} onClick={stopRecording}><Square size={15}/> Stop recording now</button>}
      {role === 'driver' && bothConsented && !activeSession && <p className="tripguard-note">Both parties agreed. The customer can start recording from their trip screen after the start OTP is verified.</p>}
      {isCustomer && booking.status === 'Trip started' && (
        <div className="tripguard-alert">
          <b>Feel unsafe or notice something wrong?</b>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Describe what happened. This note will be attached to your trip record."/>
          <div><button disabled={busy} onClick={raiseAlert}>Send safety alert</button><a href="tel:112">Call emergency services · 112</a></div>
        </div>
      )}
      {Array.isArray(guard.alerts) && guard.alerts.length > 0 && <div className="tripguard-alert-history"><b>Trip safety notes</b>{guard.alerts.map((alert: any) => <p key={alert.id}>{alert.category}: {alert.note} <small>{new Date(alert.createdAt).toLocaleString()}</small></p>)}</div>}
      {latestSession && <div className="tripguard-saved"><span>Saved recording · {Math.max(1, Math.round((latestSession.durationSeconds || 0) / 60))} min</span><button disabled={busy} onClick={() => viewRecording(latestSession)}>View recording</button></div>}
      {playUrl && <video className="tripguard-video" controls playsInline src={playUrl}/>}
      {status && <p className="tripguard-status" role="status">{status}</p>}
      {error && <p className="tripguard-error" role="alert">{error}</p>}
      <small className="tripguard-foot">For uninterrupted capture, keep this page open, keep the phone awake, and allow camera and microphone access. If recording is unavailable, the trip continues normally. For immediate danger, call 112; a TripGuard alert is a trip record, not an emergency dispatch service.</small>
    </section>
  );
}
function r2ReadyPlaceholder() {
  return true;
}

function CarCarePassport({ booking, role, onRefresh }: any) {
  const passport = booking.carCarePassport || {};
  const driverMode = role === 'driver';
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const driverUploaded = Boolean(passport.videoKey && passport.driverConfirmedAt);
  const customerApproved = Boolean(passport.customerConfirmedAt);

  useEffect(() => {
    let active = true;
    if (driverUploaded) {
      setVideoReady(false);
      api(`/bookings/${booking.id}/car-care-passport/video-url`)
        .then((result) => { if (active) setVideoUrl(result.videoUrl); })
        .catch((e) => { if (active) setError(e?.message || 'Could not load the handover video.'); });
    } else setVideoUrl('');
    return () => { active = false; };
  }, [booking.id, passport.videoKey, driverUploaded]);

  const uploadVideo = async () => {
    if (!videoFile) { setError('Record or choose a short walkaround video first.'); return; }
    if (videoFile.size > 100 * 1024 * 1024) { setError('The video must be smaller than 100 MB.'); return; }
    const mimeType = videoFile.type || 'video/mp4';
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType)) {
      setError('Please use an MP4, WebM or iPhone video.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const signed = await api(`/bookings/${booking.id}/car-care-passport/video-upload-url`, {
        method: 'POST', body: JSON.stringify({ mimeType })
      });
      const uploaded = await fetch(signed.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': mimeType }, body: videoFile
      });
      if (!uploaded.ok) throw new Error('Video upload failed. Check your connection and try again.');
      await api(`/bookings/${booking.id}/car-care-passport`, {
        method: 'POST',
        body: JSON.stringify({ videoKey: signed.videoKey, mimeType, sizeBytes: videoFile.size })
      });
      setVideoFile(null);
      setNotice('Video uploaded securely. The customer can now review it.');
      await onRefresh?.();
    } catch (e: any) { setError(e?.message || 'Could not upload the vehicle video.'); }
    finally { setBusy(false); }
  };

  const approveVideo = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/bookings/${booking.id}/car-care-passport`, {
        method: 'POST', body: JSON.stringify({ confirm: true })
      });
      setNotice('Vehicle video approved. The customer’s start OTP is now available.');
      await onRefresh?.();
    } catch (e: any) { setError(e?.message || 'Could not approve the vehicle video.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="carcare-passport">
      <div className="carcare-head">
        <span className="carcare-mark"><ShieldCheck size={20}/></span>
        <div><b>CarCare Video Check</b><small>One short video. Customer approval. Then start OTP.</small></div>
        <span className="carcare-tag">TRIP PROTECTION</span>
      </div>
      <p className="carcare-intro">Before the trip starts, the driver records a quick walkaround showing the car’s current condition. The customer reviews that same video and approves it.</p>

      {driverMode && !driverUploaded && (
        <div className="carcare-form">
          <label className="carcare-video-label">
            Record vehicle walkaround video
            <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" capture="environment"
              onChange={(event) => { setVideoFile(event.target.files?.[0] || null); setError(''); }} />
          </label>
          <small className="carcare-help">Show the front, rear, both sides and any existing scratches or damage in one clear video. Keep it under 100 MB.</small>
          {videoFile && <div className="carcare-file-selected"><Video size={16}/><span>{videoFile.name}</span><small>{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</small></div>}
          <button className="carcare-action" disabled={busy || !videoFile} onClick={uploadVideo}>
            {busy ? 'Uploading secure video…' : 'Upload vehicle video'} <ArrowRight size={16}/>
          </button>
        </div>
      )}

      {driverMode && driverUploaded && (
        <div className="carcare-record">
          {videoUrl && <video className="carcare-review-video" src={videoUrl} controls playsInline preload="metadata" onCanPlay={() => setVideoReady(true)} onError={() => { setVideoReady(false); setError("The handover video could not be played. Ask the driver to upload it again."); }}/>}
          <div className="carcare-confirmations"><span><Check size={15}/> Driver video uploaded</span><span>{customerApproved ? <Check size={15}/> : <Clock3 size={15}/>} Customer {customerApproved ? 'approved' : 'review pending'}</span></div>
          {!customerApproved && <div className="carcare-waiting"><Clock3 size={15}/> Waiting for the customer to watch and approve the video. The trip cannot start yet.</div>}
          {customerApproved && <div className="carcare-success"><Check size={16}/> Video approved. Ask the customer for the start OTP.</div>}
        </div>
      )}

      {!driverMode && !driverUploaded && (
        <div className="carcare-waiting"><Clock3 size={15}/> Waiting for your driver to upload a short vehicle walkaround video. You will review it here.</div>
      )}

      {!driverMode && driverUploaded && (
        <div className="carcare-record">
          {videoUrl ? <video className="carcare-review-video" src={videoUrl} controls playsInline preload="metadata" onCanPlay={() => setVideoReady(true)} onError={() => { setVideoReady(false); setError("The handover video could not be played. Ask the driver to upload it again."); }}/> : <div className="carcare-waiting">Loading the driver’s vehicle video…</div>}
          <div className="carcare-confirmations"><span><Check size={15}/> Driver video uploaded</span><span>{customerApproved ? <Check size={15}/> : <Clock3 size={15}/>} {customerApproved ? 'You approved this video' : 'Your review required'}</span></div>
          {!customerApproved && <button className="carcare-action" disabled={busy || !videoUrl || !videoReady} onClick={approveVideo}>{busy ? 'Saving approval…' : 'I reviewed the video — approve & show OTP'} <ShieldCheck size={16}/></button>}
          {customerApproved && <div className="carcare-success"><Check size={16}/> Approved. Share your start OTP with the driver only when you are ready to depart.</div>}
        </div>
      )}

      {notice && <p className="carcare-success" role="status">{notice}</p>}
      {error && <p className="carcare-error" role="alert">{error}</p>}
    </section>
  );
}

function OTPVerificationModal({ booking, stage, onClose, onSubmit }: any) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isStart = stage === 'start';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) {
      setError('Enter all 4 digits to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(code);
    } catch (e: any) {
      setError(e?.message || 'Verification failed. Check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="otp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section className="otp-verification-modal" role="dialog" aria-modal="true" aria-labelledby="otp-modal-title">
        <button className="otp-modal-close" type="button" onClick={onClose} disabled={submitting} aria-label="Close verification"><X size={19}/></button>
        <div className={`otp-modal-icon ${isStart ? 'start' : 'end'}`}>{isStart ? <Navigation size={25}/> : <ShieldCheck size={25}/>}</div>
        <span className="otp-modal-eyebrow">{isStart ? 'PICKUP VERIFICATION' : 'TRIP COMPLETION'}</span>
        <h2 id="otp-modal-title">{isStart ? 'Verify before starting' : 'Confirm trip completion'}</h2>
        <p className="otp-modal-copy">{isStart ? 'Ask the customer for their start OTP only after you are physically with them and ready to begin the trip.' : 'Ask the customer for their end OTP only after the trip has genuinely finished.'}</p>
        <div className="otp-modal-trip"><span>BOOKING REFERENCE</span><b>{booking.id}</b><small>{booking.pickup} <ArrowRight size={12}/> {booking.destination}</small></div>
        <form onSubmit={submit}>
          <label className="otp-entry-label" htmlFor="driver-trip-otp">CUSTOMER’S 4-DIGIT {isStart ? 'START' : 'END'} OTP</label>
          <input id="driver-trip-otp" className="otp-entry-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0,4)); setError(''); }} placeholder="• • • •" autoFocus aria-describedby="otp-entry-hint" />
          <div className="otp-entry-hint" id="otp-entry-hint"><LockKeyhole size={14}/> Enter the code shared by the customer in person</div>
          {error && <p className="otp-entry-error" role="alert"><AlertCircle size={15}/>{error}</p>}
          <button className="otp-verify-submit" type="submit" disabled={submitting || code.length !== 4}>{submitting ? 'Verifying securely…' : isStart ? 'Verify & start trip' : 'Verify & complete trip'} <ArrowRight size={17}/></button>
        </form>
        <p className="otp-modal-foot"><ShieldCheck size={14}/> The trip status changes only after the server accepts the OTP.</p>
      </section>
    </div>
  );
}

// ----------------- Admin Operations Page -----------------
function LiveAdminPage({ bookings, focus = 'Overview', flash }: any) {
  const [summary, setSummary] = useState<any>({});
  const [filter, setFilter] = useState('All');
  const [pricingValues, setPricingValues] = useState<Record<string, number>>({
    package4h: 499, package8h: 899, package12h: 1299, extraKm: 12,
    extraHour: 100, outstationPerKm: 18, airport: 599, night: 200,
    commission: 20, gst: 5, suvMultiplier: 1.15, luxuryMultiplier: 1.25
  });
  const [pricingReason, setPricingReason] = useState('');

  const fetchSummary = async () => {
    try {
      const d = await api('/admin/summary');
      setSummary(d);
      const current = Object.fromEntries((d.pricing || []).map((item: any) => [item.key, Number(item.value)]));
      setPricingValues((previous) => ({ ...previous, ...current, package4h: Number(current.package4h ?? current.hourly ?? previous.package4h) }));
    } catch {}
  };

  useEffect(() => {
    fetchSummary();
  }, [bookings]);

  const updatePricingValue = (key: string, value: number) => setPricingValues((current) => ({ ...current, [key]: value }));
  const savePricing = async () => {
    try {
      await api('/admin/pricing', {
        method: 'PATCH',
        body: JSON.stringify({ ...pricingValues, hourly: pricingValues.package4h, pricingReason })
      });
      setPricingReason('');
      flash?.('Pricing saved after the Smart Fare guardrails passed. Existing quotes will be refreshed against the new tariff.');
      fetchSummary();
    } catch (e: any) { flash?.(e.message); }
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
          <h3>Delhi NCR driver-service tariff</h3>
          <p>Smart Fare uses verified trip inputs, a versioned tariff, independent arithmetic checks and market guardrails. It does not add hidden demand surcharges. Fuel, tolls and parking remain separate customer expenses.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0'}}>
            <span className="status-pill">Revision {summary.pricingRevision || 1}</span>
            <span className="status-pill">{summary.pricingValidation?.ok ? 'Tariff checks passed' : 'Review tariff settings'}</span>
          </div>
          {summary.pricingValidation?.issues?.length > 0 && <p className="tripguard-error">{summary.pricingValidation.issues.join(' ')}</p>}
          {summary.pricingValidation?.marketGuards && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,margin:'10px 0'}}>
              {Object.entries(summary.pricingValidation.marketGuards).map(([key, band]: [string, any]) => (
                <div key={key} style={{padding:9,border:'1px solid var(--slate-200)',borderRadius:9}}>
                  <small className="muted">{band.label}</small>
                  <b style={{display:'block',fontSize:12}}>₹{band.min}–₹{band.max}</b>
                  <small className="muted">Current: ₹{pricingValues[key] ?? 0}</small>
                </div>
              ))}
            </div>
          )}
          <div className="pricing-grid">
            {([
              ['package4h', '4 hours / 40 km package'],
              ['package8h', '8 hours / 80 km package'],
              ['package12h', '12 hours / 120 km package'],
              ['extraKm', 'Extra local distance (₹/km)'],
              ['extraHour', 'Extra hour (₹)'],
              ['outstationPerKm', 'Outstation distance (₹/km)'],
              ['airport', 'Airport package'],
              ['night', 'Night surcharge (10 PM–6 AM)'],
              ['commission', 'Platform commission (%)'],
              ['gst', 'GST (%)']
            ] as [string, string][]).map(([key, label]) => (
              <label className="field-group" key={key}>
                <span>{label}</span>
                <input type="number" min="0" step="1" value={pricingValues[key] ?? 0} onChange={(e) => updatePricingValue(key, Number(e.target.value))} />
              </label>
            ))}
          </div>
          <p className="muted">Vehicle upgrades: SUV {pricingValues.suvMultiplier}× · Luxury {pricingValues.luxuryMultiplier}×. Invalid GST/commission values, non-monotonic packages and rates above market guardrails are blocked by the server.</p>
          <label className="field-group"><span>Reason for tariff change (audit note)</span><textarea value={pricingReason} onChange={(e) => setPricingReason(e.target.value)} rows={2} maxLength={300} placeholder="Example: tariff review against current Delhi NCR driver rates" /></label>
          <button className="primary-btn" onClick={savePricing} disabled={pricingReason.trim().length < 8}>Save verified tariff to Neon DB <Check size={16} /></button>
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
    const resolution = prompt('Enter the investigation / resolution note:');
    if (!resolution) return;
    let penaltyAmount = 0;
    if (status === 'substantiated') {
      const rawPenalty = prompt('Optional driver earnings adjustment in INR (enter 0 for no adjustment):', '0');
      if (rawPenalty === null) return;
      penaltyAmount = Number(rawPenalty || 0);
      if (!Number.isSafeInteger(penaltyAmount) || penaltyAmount < 0) { flash?.('Enter a valid whole-rupee adjustment.'); return; }
    }
    try {
      await api(`/admin/disputes/${disputeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolution, penaltyAmount })
      });
      flash?.(penaltyAmount > 0 ? 'Complaint reviewed and earnings adjustment ledger updated.' : 'Complaint status updated.');
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
                        <td>{r.userName || '—'}<small>Driver: {r.driverName || r.driverId || 'Not assigned'}</small></td>
                        <td>{r.subject || 'General complaint'}<small>{r.bookingId || '—'}{r.reportedExtraAmount ? ` · asked ${money(r.reportedExtraAmount)} extra` : ''}</small><small>{r.description || ''}</small>{r.driverResponse && <small><b>Driver response:</b> {r.driverResponse}</small>}</td>
                        <td><span className={`status-pill ${['resolved','closed','unsubstantiated'].includes(r.status) ? 'done' : ''}`}>{String(r.status || 'open').replace(/_/g, ' ')}</span></td>
                        <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {!['resolved','closed','unsubstantiated'].includes(r.status) && (
                            <>
                              <button className="inline-action-btn success" onClick={() => resolveDispute(r.id, 'substantiated')}>Substantiate</button>
                              <button className="inline-action-btn danger" onClick={() => resolveDispute(r.id, 'unsubstantiated')}>Not substantiated</button>
                              <button className="inline-action-btn" onClick={() => resolveDispute(r.id, 'escalated')}>Escalate</button>
                            </>
                          )}
                          {r.earningsAdjustmentAmount > 0 && <small>Ledger adjustment: {money(r.earningsAdjustmentAmount)}</small>}
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
  const completed = bookings.filter((b: Booking) => ['Trip completed', 'Rated'].includes(b.status));
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

function SupportDeskPage({ flash }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState('in_progress');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const data = await api('/support/tickets');
      setTickets(data.tickets || []);
      if (!selectedId && data.tickets?.length) setSelectedId(data.tickets[0].id);
    } catch (e: any) { setError(e.message || 'Support tickets could not be loaded.'); }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);
  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || reply.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      await api('/support/tickets/' + encodeURIComponent(selected.id) + '/messages', { method: 'POST', body: JSON.stringify({ message: reply.trim(), status: nextStatus }) });
      setReply('');
      flash?.('Support ticket ' + selected.id + ' updated.');
      await load();
    } catch (e: any) { setError(e.message || 'Support response could not be sent.'); }
    finally { setBusy(false); }
  };
  const openCount = tickets.filter((ticket) => !['resolved','closed'].includes(ticket.status)).length;
  return (
    <div className="admin-view">
      <div className="section-head"><div><span className="eyebrow">CUSTOMER EXPERIENCE OPERATIONS</span><h1>Support Desk</h1><p>Review booking-linked tickets, respond, and track response and resolution targets.</p></div><span className="status-pill">{openCount} open tickets</span></div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(240px, .8fr) minmax(320px, 1.5fr)',gap:14,alignItems:'start'}}>
        <section className="panel" style={{padding:14}}>
          <div className="panel-header"><div><h3>Incoming tickets</h3><p>Refreshes every 15 seconds</p></div><button className="secondary-btn" onClick={load}>Refresh</button></div>
          {!tickets.length && <p className="muted">No support tickets have been received.</p>}
          {tickets.map((ticket) => <button key={ticket.id} onClick={() => {setSelectedId(ticket.id);setNextStatus(ticket.status === 'received' ? 'in_progress' : ticket.status);}} style={{width:'100%',textAlign:'left',padding:12,marginTop:8,border:selectedId === ticket.id ? '1px solid #168477' : '1px solid var(--slate-200)',borderRadius:11,background:selectedId === ticket.id ? '#f0faf6' : '#fff',cursor:'pointer'}}><b style={{display:'block',fontSize:12,color:'#183a55'}}>{ticket.id}</b><span style={{display:'block',fontSize:11,marginTop:4}}>{ticket.subject}</span><small className="muted">{ticket.userName} · {ticket.priority} · {ticket.status.replace(/_/g,' ')}</small></button>)}
        </section>
        <section className="panel" style={{padding:16}}>
          {!selected ? <p className="muted">Select a ticket to view the conversation.</p> : <>
            <div className="panel-header"><div><span className="eyebrow">{selected.category} · {selected.priority} priority</span><h3>{selected.subject}</h3><p>{selected.id} · {selected.userName} · {selected.userRole}</p></div><span className="status-pill">{selected.status.replace(/_/g,' ')}</span></div>
            {selected.bookingId && <p className="muted">Booking: {selected.bookingId}</p>}
            <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'10px 0',borderTop:'1px solid var(--slate-200)',borderBottom:'1px solid var(--slate-200)'}}><small>First response due: {selected.firstResponseDueAt ? new Date(selected.firstResponseDueAt).toLocaleString('en-IN') : '48 hours'}</small><small>Resolution target: {selected.resolutionDueAt ? new Date(selected.resolutionDueAt).toLocaleDateString('en-IN') : '30 days'}</small><small>Received: {new Date(selected.createdAt).toLocaleString('en-IN')}</small></div>
            <div style={{display:'grid',gap:9,maxHeight:390,overflowY:'auto',padding:'12px 0'}}>
              {(selected.messages || []).map((message: any) => <div key={message.id} style={{padding:11,borderRadius:10,background:message.senderRole === 'support' ? '#edf7f3' : '#f4f7fa'}}><b style={{fontSize:11}}>{message.senderName}</b><p style={{fontSize:12,margin:'5px 0'}}>{message.message}</p><small className="muted">{new Date(message.createdAt).toLocaleString('en-IN')}</small></div>)}
            </div>
            <form onSubmit={send} style={{display:'grid',gap:9,borderTop:'1px solid var(--slate-200)',paddingTop:12}}>
              <label className="field-group"><span>Update ticket status</span><select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}><option value="in_progress">In progress</option><option value="waiting_for_customer">Waiting for customer</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
              <label className="field-group"><span>Reply to customer / partner</span><textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={3000} placeholder="Explain what was checked, the next action, or the resolution…"/></label>
              <button className="primary-btn-wide" disabled={busy || reply.trim().length < 3}>{busy ? 'Sending response…' : 'Send reply & update ticket'}</button>
            </form>
          </>}
          {error && <p className="tripguard-error" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  );
}

function HelpPage({ flash, onDispute, bookings = [] }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [supportConfig, setSupportConfig] = useState<any>({});
  const [category, setCategory] = useState('Booking');
  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [replies, setReplies] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadTickets = async () => {
    try {
      const results = await Promise.all([api('/support/tickets'), api('/support/config')]);
      setTickets(results[0].tickets || []);
      setSupportConfig(results[1] || {});
    } catch (e: any) { setError(e.message || 'Support tickets could not be loaded.'); }
  };
  useEffect(() => {
    loadTickets();
    const timer = window.setInterval(loadTickets, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy('create'); setError('');
    try {
      const result = await api('/support/tickets', { method: 'POST', body: JSON.stringify({ category, bookingId: bookingId || undefined, subject, description }) });
      setSubject(''); setDescription(''); setBookingId('');
      flash('Support ticket ' + result.ticket.id + ' created and acknowledged.');
      await loadTickets();
    } catch (e: any) { setError(e.message || 'Ticket could not be submitted.'); }
    finally { setBusy(''); }
  };

  const sendReply = async (ticket: any) => {
    const message = String(replies[ticket.id] || '').trim();
    if (message.length < 3) return;
    setBusy(ticket.id); setError('');
    try {
      await api('/support/tickets/' + encodeURIComponent(ticket.id) + '/messages', { method: 'POST', body: JSON.stringify({ message }) });
      setReplies((current) => ({ ...current, [ticket.id]: '' }));
      flash('Your update was added to ticket ' + ticket.id + '.');
      await loadTickets();
    } catch (e: any) { setError(e.message || 'Reply could not be sent.'); }
    finally { setBusy(''); }
  };

  return (
    <div className="help-view">
      <div className="section-head">
        <div><span className="eyebrow">VAAHANSATHI CUSTOMER CARE</span><h1>Help that follows your trip</h1><p>Submit a booking-linked ticket, keep the reference number, and follow every reply from one place.</p></div>
      </div>
      <div className="help-cards-grid">
        <div className="panel help-action-card"><Headphones size={28}/><b>Tracked support tickets</b><p>Every request receives a ticket number and an acknowledgement immediately.</p><span>First human response target: 48 hours</span></div>
        <button className="panel help-action-card" onClick={() => window.location.assign('tel:112')}><ShieldCheck size={28}/><b>Emergency Assistance</b><p>For immediate danger or a medical or police emergency, call India's 112 helpline.</p><span>Call 112 Helpline <ArrowRight size={14}/></span></button>
        {onDispute && <button className="panel help-action-card" onClick={onDispute}><AlertCircle size={28}/><b>Report extra money demand</b><p>A report is investigated; it does not automatically reduce a driver's earnings.</p><span>Report a driver <ArrowRight size={14}/></span></button>}
      </div>
      <section className="panel" style={{padding:18,marginTop:14}}>
        <h3 style={{marginTop:0}}>Create a support ticket</h3>
        <p className="muted">Safety issues are prioritised. Include the booking reference and what happened so the team can investigate.</p>
        <form onSubmit={createTicket} style={{display:'grid',gap:10}}>
          <label className="field-group"><span>Issue category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Booking</option><option>Fare & pricing</option><option>Payment & refund</option><option>Driver behaviour</option><option>Safety concern</option><option>App / technical</option><option>Other</option></select></label>
          <label className="field-group"><span>Related booking (optional)</span><select value={bookingId} onChange={(e) => setBookingId(e.target.value)}><option value="">No specific booking</option>{bookings.map((b: any) => <option value={b.id} key={b.id}>{b.id} · {b.pickup.split(',')[0]} → {b.destination.split(',')[0]}</option>)}</select></label>
          <label className="field-group"><span>Subject</span><input required minLength={5} maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary of the problem"/></label>
          <label className="field-group"><span>Tell us what happened</span><textarea required minLength={15} maxLength={3000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Include the trip stage, time, what you expected, and what happened…"/></label>
          <button type="submit" className="primary-btn-wide" disabled={busy === 'create' || subject.trim().length < 5 || description.trim().length < 15}>{busy === 'create' ? 'Creating ticket…' : 'Submit support ticket'}</button>
        </form>
        {error && <p className="tripguard-error" role="alert">{error}</p>}
      </section>
      <section className="panel" style={{padding:18,marginTop:14}}>
        <div className="panel-header"><div><h3>My support tickets</h3><p>Statuses and replies refresh automatically.</p></div><button className="secondary-btn" onClick={loadTickets}>Refresh</button></div>
        {!tickets.length && <p className="muted">No support tickets yet. Your requests will appear here after submission.</p>}
        {tickets.map((ticket) => (
          <article key={ticket.id} style={{padding:'13px 0',borderTop:'1px solid var(--slate-200)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><b>{ticket.id} · {ticket.subject}</b><span className="status-pill">{String(ticket.status).replace(/_/g,' ')}</span></div>
            <small className="muted">{ticket.category} · {ticket.priority} priority · {ticket.bookingId || 'Not linked to a booking'}</small>
            <p style={{margin:'8px 0'}}>{ticket.description}</p>
            <small className="muted">Acknowledged {ticket.acknowledgedAt ? new Date(ticket.acknowledgedAt).toLocaleString('en-IN') : 'on receipt'} · Resolution target {ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleDateString('en-IN') : 'within 30 days'}</small>
            {(ticket.messages || []).slice(1).map((message: any) => <div key={message.id} style={{marginTop:8,padding:10,borderRadius:10,background:message.senderRole === 'support' ? '#eef7f4' : '#f5f7fa'}}><b style={{fontSize:11}}>{message.senderRole === 'support' ? 'VaahanSathi Support' : message.senderName}</b><p style={{margin:'4px 0',fontSize:12}}>{message.message}</p><small className="muted">{new Date(message.createdAt).toLocaleString('en-IN')}</small></div>)}
            {!['resolved','closed'].includes(ticket.status) && <div style={{display:'grid',gap:7,marginTop:10}}><textarea rows={2} value={replies[ticket.id] || ''} onChange={(e) => setReplies((current) => ({...current,[ticket.id]:e.target.value.slice(0,3000)}))} placeholder="Add more information to this ticket…"/><button className="secondary-btn" disabled={busy === ticket.id || String(replies[ticket.id] || '').trim().length < 3} onClick={() => sendReply(ticket)}>{busy === ticket.id ? 'Sending…' : 'Send update'}</button></div>}
          </article>
        ))}
      </section>
      <section className="panel faq-card" style={{marginTop:14}}>
        <h3>Grievance contact & response targets</h3>
        {supportConfig.grievanceContactConfigured ? <p><b>{supportConfig.grievanceOfficerName}</b> · {supportConfig.grievanceOfficerDesignation}<br/>{supportConfig.grievanceOfficerEmail} {supportConfig.grievanceOfficerPhone}</p> : <p className="muted">Official grievance officer contact details are not yet configured. The operator must add and publish them in Render settings; ticket tracking is available meanwhile.</p>}
        <p>Target acknowledgement: immediate ticket registration. First human response: within 48 hours. Target grievance resolution: within 30 days.</p>
      </section>
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
  type ChatMessage = { role: 'assistant' | 'user'; content: string };
  type Stage = 'idle' | 'listening' | 'processing';
  const [stage, setStage] = useState<Stage>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! Welcome to VaahanSathi. I can help you book a driver. Where should I pick you up, and where are you headed?' }
  ]);
  const [draft, setDraft] = useState('');
  const [intent, setIntent] = useState<any>({ city, tripType: 'Hourly', hours: 4 });
  const [lastQuestion, setLastQuestion] = useState('route');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [booking, setBooking] = useState(false);
  const [err, setErr] = useState('');
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('vs_language');
    return saved === 'hi' ? { label: 'हिन्दी', code: 'hi-IN', srv: 'hi-IN' }
      : saved === 'hinglish' ? { label: 'Hinglish', code: 'en-IN', srv: 'hi-hinglish' }
      : { label: 'English', code: 'en-IN', srv: 'en-IN' };
  });
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechTextRef = useRef('');

  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch {}
    try { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); } catch {}
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    recognitionRef.current = null;
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  function speak(text: string) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang.code;
      utterance.rate = 0.96;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  function addAssistantMessage(content: string) {
    setMessages(current => [...current, { role: 'assistant', content }]);
    speak(content);
  }

  async function confirmBook() {
    if (!intent || booking) return;
    setBooking(true);
    setStage('processing');
    setErr('');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try {
      await onBook(intent);
    } catch (error: any) {
      setErr(error?.message || 'I could not place the booking. Please try again.');
      setStage('idle');
    } finally {
      setBooking(false);
    }
  }

  async function sendTurn(value: string) {
    const utterance = value.trim();
    if (!utterance || stage === 'processing' || booking) return;
    setErr('');
    setDraft('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: utterance }];
    setMessages(nextMessages);

    if (awaitingConfirmation && /^(yes|yeah|yep|sure|confirm|book it|go ahead|haan|han|जी|हाँ|हां)(?:[, ]+(?:please|book it|go ahead|कर दो|बुक करो))?[.! ]*$/i.test(utterance)) {
      await confirmBook();
      return;
    }
    if (awaitingConfirmation && /^(no|nope|not yet|change|edit|नहीं|नही|मत करो)[.! ]*$/i.test(utterance)) {
      setAwaitingConfirmation(false);
      setLastQuestion('correction');
      addAssistantMessage(lang.srv === 'hi-IN'
        ? 'कोई बात नहीं। बताइए, किस जानकारी को बदलना है?'
        : 'No problem. Tell me what you would like to change, and I will update it.');
      return;
    }

    setStage('processing');
    try {
      const result = await api('/voice/conversation', {
        method: 'POST',
        body: JSON.stringify({
          messages: nextMessages,
          previousIntent: intent,
          lastQuestion,
          city,
          language: lang.srv
        })
      });
      const nextIntent = {
        ...intent,
        ...result,
        pickup: result.pickup || intent.pickup || '',
        destination: result.destination || intent.destination || '',
        date: result.date || intent.date || '',
        time: result.time || intent.time || '',
        city: result.city || intent.city || city,
        tripType: result.tripType || intent.tripType || 'Hourly',
        hours: result.hours || intent.hours || 4
      };
      setIntent(nextIntent);
      if (result.readyToConfirm) {
        setAwaitingConfirmation(true);
        onApply(nextIntent);
        const summary = result.summary || ('I have your trip from ' + nextIntent.pickup + ' to ' + nextIntent.destination + ' on ' + nextIntent.date + ' at ' + nextIntent.time + '.');
        addAssistantMessage(summary + ' Is everything correct? Say “yes, book it” to place the ride, or tell me what needs changing.');
      } else {
        setAwaitingConfirmation(false);
        setLastQuestion(result.nextQuestionKey || 'route');
        addAssistantMessage(result.nextQuestion || 'Could you tell me a little more about your pickup, destination, date, or time?');
      }
    } catch (error: any) {
      setErr(error?.message || 'I had trouble understanding that. Please say it another way.');
      addAssistantMessage('Sorry, I missed that. Could you repeat that detail?');
    } finally {
      setStage('idle');
    }
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setErr('Microphone access needs the secure HTTPS website. You can still type your reply.');
      return;
    }
    if (!SpeechRecognition) {
      if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
        void startMediaRecording();
        return;
      }
      setErr('This browser does not support voice capture. You can continue the same conversation by typing.');
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    try {
      setErr('');
      speechTextRef.current = '';
      setDraft('');
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = lang.code;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.onstart = () => setStage('listening');
      recognition.onresult = (event: any) => {
        let spoken = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript;
          if (transcript && result.isFinal) spoken += ' ' + transcript;
        }
        if (spoken.trim()) {
          speechTextRef.current = spoken.trim();
          setDraft(spoken.trim());
        } else {
          const interim = event.results?.[event.results.length - 1]?.[0]?.transcript;
          if (interim) setDraft(interim);
        }
      };
      recognition.onerror = (event: any) => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        if (event.error === 'aborted') return;
        const errorMessages: Record<string, string> = {
          'not-allowed': 'Microphone permission is blocked. Allow microphone access for this site in your browser settings.',
          'service-not-allowed': 'This browser does not allow its speech service. You can type your reply instead.',
          'no-speech': 'I did not hear anything. Please try again or type your reply.',
          'audio-capture': 'No microphone was detected. Check your device microphone or type your reply.',
          network: 'The speech service could not connect. Check your internet connection or type your reply.',
          'language-not-supported': 'This browser does not support that speech language. Choose another language or type your reply.'
        };
        setErr(errorMessages[event.error] || 'Voice recognition stopped. Please try again or type your reply.');
        setStage('idle');
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        const spoken = speechTextRef.current.trim();
        if (spoken) void sendTurn(spoken);
        else setStage(current => current === 'listening' ? 'idle' : current);
      };
      recognition.start();
    } catch (error: any) {
      recognitionRef.current = null;
      setStage('idle');
      setErr(error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'Microphone permission is blocked. Allow microphone access for this site.'
        : 'Could not start the microphone. Please type your reply instead.');
    }
  }

  async function startMediaRecording() {
    try {
      setErr('');
      speechTextRef.current = '';
      setDraft('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mediaStreamRef.current = stream;
      const preferred = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
      const mimeType = preferred.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setErr('The microphone recording failed. Please try again or type your reply.');
        setStage('idle');
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        try {
          if (blob.size < 1000) throw new Error('I did not get enough audio. Please speak for a little longer.');
          const response = await fetch('/api/voice/transcribe?language=' + encodeURIComponent(lang.srv), {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'audio/webm' },
            body: blob
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Voice transcription is not available. Please type your reply.');
          if (!result.text) throw new Error('I could not hear clear words. Please try again.');
          await sendTurn(result.text);
        } catch (error: any) {
          setErr(error?.message || 'Voice transcription failed. Please type your reply.');
          setStage('idle');
        }
      };
      recorder.start();
      setStage('listening');
    } catch (error: any) {
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setStage('idle');
      setErr(error?.name === 'NotAllowedError'
        ? 'Microphone permission is blocked. Allow microphone access for this site, then try again.'
        : 'Could not access the microphone. You can type your reply instead.');
    }
  }

  function stopListening() {
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch { setStage('idle'); }
      return;
    }
    try { recognitionRef.current?.stop(); }
    catch { setStage('idle'); setErr('Could not stop voice recognition. Please try again.'); }
  }

  const languageOptions = [
    { label: 'English', code: 'en-IN', srv: 'en-IN' },
    { label: 'हिन्दी', code: 'hi-IN', srv: 'hi-IN' },
    { label: 'Hinglish', code: 'en-IN', srv: 'hi-hinglish' }
  ];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal voice-agent-modal" role="dialog" aria-modal="true" aria-labelledby="voice-agent-title">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="va-header">
          <div className={'va-orb ' + (stage === 'listening' ? 'va-orb-pulse' : stage === 'processing' ? 'va-orb-spin' : '')}><Mic size={22} /></div>
          <div>
            <span className="eyebrow">VAAHANSATHI VOICE CONCIERGE</span>
            <h2 id="voice-agent-title" style={{fontSize:'18px',fontWeight:800,color:'var(--ink)',marginBottom:2}}>
              {stage === 'listening' ? 'I’m listening…' : stage === 'processing' ? 'One moment…' : awaitingConfirmation ? 'Ready to book?' : 'Let’s plan your ride'}
            </h2>
            <p style={{fontSize:'12px',color:'var(--t5)',lineHeight:1.4}}>Talk naturally. I’ll ask only for details I still need.</p>
          </div>
        </div>
        <div className="va-lang-row">
          {languageOptions.map(option => (
            <button key={option.label} type="button" className={'va-lang-btn' + (lang.label === option.label ? ' active' : '')}
              onClick={() => {
                if (recognitionRef.current) stopListening();
                setLang(option);
                setErr('');
              }}>{option.label}</button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:300,overflowY:'auto',padding:'12px 2px'}} aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth:'88%',
              padding:'10px 13px',
              borderRadius: message.role === 'user' ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
              background: message.role === 'user' ? 'var(--brand, #0f766e)' : 'var(--surface-2, #f1f5f9)',
              color: message.role === 'user' ? '#fff' : 'var(--ink)',
              fontSize:13,
              lineHeight:1.5,
              whiteSpace:'pre-wrap'
            }}>{message.content}</div>
          ))}
          {stage === 'listening' && <div className="va-placeholder" style={{fontSize:12}}>Listening for your answer…</div>}
          {stage === 'processing' && <div className="va-processing" role="status"><div className="va-spinner" /><span>Understanding your answer…</span></div>}
        </div>
        {intent?.pickup && intent?.destination && (
          <div className="va-confirm-card" style={{marginBottom:10}}>
            <div className="va-confirm-row"><span>Pickup</span><b>{intent.pickup}</b></div>
            <div className="va-confirm-row"><span>Destination</span><b>{intent.destination}</b></div>
            <div className="va-confirm-row"><span>Date & time</span><b>{intent.date || 'Not set'} · {intent.time || 'Not set'}</b></div>
          </div>
        )}
        {err && <p className="va-err" role="alert">{err}</p>}
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
          <button type="button" className={'va-mic-btn ' + (stage === 'listening' ? 'va-mic-active' : '')}
            disabled={stage === 'processing' || booking}
            onClick={stage === 'listening' ? stopListening : startListening}>
            <Mic size={20} /> {stage === 'listening' ? 'Finish speaking' : 'Talk to VaahanSathi'}
          </button>
          <textarea className="va-text-input" value={draft}
            onChange={(e) => { setDraft(e.target.value); setErr(''); }}
            placeholder="Or type your reply here…"
            rows={2} aria-label="Reply to the VaahanSathi voice assistant" />
          <button type="button" className="primary-btn-wide" style={{marginTop:0}}
            disabled={!draft.trim() || stage === 'processing' || booking}
            onClick={() => void sendTurn(draft)}>
            Send reply <ArrowRight size={16} />
          </button>
          {awaitingConfirmation && (
            <button type="button" className="primary-btn-wide" style={{marginTop:0,background:'#15803d'}}
              onClick={() => void confirmBook()} disabled={booking || stage === 'processing'}>
              {booking ? 'Booking…' : 'Yes, confirm and book'} <Check size={17} />
            </button>
          )}
        </div>
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
          <span>Trip fare + approved, receipted expenses</span>
          <b>{money(booking.amountDue ?? booking.total)}</b>
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
function DisputeModal({ bookings, onClose, onSubmit, defaultBookingId = '', defaultSubject = '' }: any) {
  const [bookingId, setBookingId] = useState(defaultBookingId);
  const [subject, setSubject] = useState(defaultSubject);
  const [description, setDescription] = useState('');
  const [reportedExtraAmount, setReportedExtraAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const isExtraMoneyReport = subject === 'Driver demanded extra money';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    if (isExtraMoneyReport && reportedExtraAmount && (!/^\\d{1,7}$/.test(reportedExtraAmount) || Number(reportedExtraAmount) > 1000000)) return;
    setBusy(true);
    try { await onSubmit(bookingId, subject, description, reportedExtraAmount ? Number(reportedExtraAmount) : undefined); }
    finally { setBusy(false); }
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal dispute-modal">
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div className="modal-brand"><AlertCircle size={22} /><span>Customer Care</span></div>
        <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Report a trip problem</h2>
        <p className="modal-sub">Our team reviews every report. Driver earnings adjustments are considered only after investigation.</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field-group">
            <span>Related Booking</span>
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">No specific booking</option>
              {bookings.map((b: Booking) => <option key={b.id} value={b.id}>{b.id} — {b.pickup.split(',')[0]} → {b.destination.split(',')[0]}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>What happened?</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} required>
              <option value="">Select a subject…</option>
              <option value="Driver demanded extra money">Driver demanded extra money</option>
              <option value="Fare dispute">Fare dispute</option>
              <option value="Driver behaviour">Driver behaviour</option>
              <option value="Trip not completed">Trip not completed</option>
              <option value="OTP issue">Trip OTP issue</option>
              <option value="Payment issue">Payment issue</option>
              <option value="Other">Other</option>
            </select>
          </label>
          {isExtraMoneyReport && <label className="field-group"><span>Extra amount requested (₹, optional)</span><input type="number" min="0" max="1000000" step="1" value={reportedExtraAmount} onChange={(e) => setReportedExtraAmount(e.target.value)} placeholder="Amount the driver asked for" /></label>}
          <label className="field-group">
            <span>Describe what happened</span>
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us what the driver said or what happened during the trip…" rows={4} style={{ width:'100%',padding:'12px',border:'1px solid var(--slate-200)',borderRadius:'8px',fontSize:'14px',resize:'vertical',outline:'none',fontFamily:'inherit' }} />
          </label>
          <button className="primary-btn-wide" type="submit" disabled={busy || !subject || !description.trim()}>{busy ? 'Submitting report…' : 'Submit to Customer Care'}</button>
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
