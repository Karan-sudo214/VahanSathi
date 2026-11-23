// Keep the customer-facing estimate intentionally small. Fare verification,
// payout allocation, pricing guards and reconciliation remain server-only.
export function toCustomerFareSummary(fare, quoteToken) {
  return {
    serviceCharge: Number(fare.subtotal),
    gst: Number(fare.gst),
    gstRate: Number(fare.gstRate),
    total: Number(fare.total),
    distanceKm: fare.distanceKm ?? null,
    includedKm: Number(fare.includedKm || 0),
    extraDistanceKm: Number(fare.extraDistanceKm || 0),
    distanceConfidence: fare.distanceConfidence || 'approximate',
    routeDurationMinutes: fare.routeDurationMinutes ?? null,
    currency: fare.currency || 'INR',
    quoteToken: String(quoteToken)
  };
}

const PRIVATE_FARE_FIELDS = [
  'pricingAudit', 'fareAudit', 'priceFactors', 'commission', 'commissionRate',
  'driverSharePercent', 'fareQuoteId', 'fareQuotedAt',
  'fareQuoteExpiresAt', 'farePricingRevision'
];

export function hideInternalFareDetails(booking, { includeDriverPayout = false } = {}) {
  const customerBooking = { ...booking };
  for (const field of PRIVATE_FARE_FIELDS) delete customerBooking[field];
  if (!includeDriverPayout) delete customerBooking.payout;
  return customerBooking;
}
