export * from './enums.js';

/** Default attribution control group fraction (10%). */
export const DEFAULT_CONTROL_GROUP_RATIO = 0.1;

/** A customer messaged within this window is considered "recently messaged". */
export const RECENT_CONTACT_WINDOW_DAYS = 7;

/** Days of inactivity before a previously-active customer is "dormant". */
export const DORMANT_THRESHOLD_DAYS = 45;

/** Currency formatting locale + symbol used across the product. */
export const CURRENCY = { locale: 'en-IN', code: 'INR', symbol: '₹' } as const;
