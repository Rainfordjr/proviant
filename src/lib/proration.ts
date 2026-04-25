/**
 * Proration helpers.
 *
 * When a customer changes plans mid-cycle:
 *  1. Calculate unused days on the old plan → credit
 *  2. Calculate remaining days on the new plan → charge
 *  3. Net amount = charge - credit
 *  4. If positive, customer owes the difference
 *  5. If negative, customer has a credit applied to next invoice
 */

export interface ProrationResult {
  daysRemaining: number;
  daysInPeriod: number;
  oldDailyRate: number;
  newDailyRate: number;
  creditAmount: number;   // always >= 0
  chargeAmount: number;   // always >= 0
  netAmount: number;       // positive = owes, negative = credit
}

export function calculateProration(
  oldMonthlyRate: number,
  newMonthlyRate: number,
  periodStart: Date,
  periodEnd: Date,
  changeDate: Date = new Date()
): ProrationResult {
  const daysInPeriod = Math.max(
    1,
    Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  const daysRemaining = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const oldDailyRate = oldMonthlyRate / daysInPeriod;
  const newDailyRate = newMonthlyRate / daysInPeriod;

  // Credit for unused days on old plan
  const creditAmount = Math.round(oldDailyRate * daysRemaining * 100) / 100;

  // Charge for remaining days on new plan
  const chargeAmount = Math.round(newDailyRate * daysRemaining * 100) / 100;

  // Net: positive means they owe more, negative means they get a credit
  const netAmount = Math.round((chargeAmount - creditAmount) * 100) / 100;

  return {
    daysRemaining,
    daysInPeriod,
    oldDailyRate: Math.round(oldDailyRate * 100) / 100,
    newDailyRate: Math.round(newDailyRate * 100) / 100,
    creditAmount,
    chargeAmount,
    netAmount,
  };
}
