import test from 'node:test';
import assert from 'node:assert/strict';
import { hideInternalFareDetails, toCustomerFareSummary } from '../shared/fare-view.js';

test('customer fare summary exposes only service charge, GST and trip context', () => {
  const fare = toCustomerFareSummary({
    subtotal: 570, gst: 29, gstRate: 5, total: 599,
    distanceKm: 19, includedKm: 40, extraDistanceKm: 0,
    distanceConfidence: 'approximate', routeDurationMinutes: 41,
    currency: 'INR', payout: 479, commission: 120, commissionRate: 20,
    driverSharePercent: 80, priceFactors: { package: 599 },
    pricingAudit: { verified: true, warnings: ['internal audit note'] }
  }, 'signed-quote');

  assert.equal(fare.serviceCharge, 570);
  assert.equal(fare.gst, 29);
  assert.equal(fare.gstRate, 5);
  assert.equal(fare.total, 599);
  assert.equal(fare.quoteToken, 'signed-quote');
  assert.deepEqual(Object.keys(fare).sort(), [
    'currency', 'distanceConfidence', 'distanceKm', 'extraDistanceKm',
    'gst', 'gstRate', 'includedKm', 'quoteToken',
    'routeDurationMinutes', 'serviceCharge', 'total'
  ].sort());
});

test('customer booking projection removes internal revenue and audit fields', () => {
  const booking = hideInternalFareDetails({
    id: 'booking-1', total: 599, status: 'Searching',
    fareAudit: { arithmeticVerified: true }, pricingAudit: { verified: true },
    priceFactors: { package: 599 }, commission: 120, commissionRate: 20,
    payout: 479, driverSharePercent: 80,
    fareQuoteId: 'internal-id', fareQuotedAt: 'now',
    fareQuoteExpiresAt: 'later', farePricingRevision: 4
  });
  assert.equal(booking.id, 'booking-1');
  assert.equal(booking.total, 599);
  for (const field of [
    'fareAudit', 'pricingAudit', 'priceFactors', 'commission', 'commissionRate',
    'payout', 'driverSharePercent', 'fareQuoteId', 'fareQuotedAt',
    'fareQuoteExpiresAt', 'farePricingRevision'
  ]) assert.equal(Object.hasOwn(booking, field), false, field + ' should stay private');
});


test('driver booking projection may retain only the driver payout amount', () => {
  const booking = hideInternalFareDetails({
    id: 'booking-2', payout: 479, commission: 120,
    pricingAudit: { verified: true }, fareAudit: { arithmeticVerified: true }
  }, { includeDriverPayout: true });
  assert.equal(booking.payout, 479);
  assert.equal(Object.hasOwn(booking, 'commission'), false);
  assert.equal(Object.hasOwn(booking, 'pricingAudit'), false);
  assert.equal(Object.hasOwn(booking, 'fareAudit'), false);
});
