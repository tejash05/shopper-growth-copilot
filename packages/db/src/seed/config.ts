/** Tunable knobs for the demo dataset. Override via env for lighter local runs. */
export const SEED_CONFIG = {
  brandName: 'NovaWear',
  brandIndustry: 'Fashion retail',
  customerCount: Number(process.env.SEED_CUSTOMERS ?? 10_000),
  targetOrderCount: Number(process.env.SEED_ORDERS ?? 50_000),
  productCount: Number(process.env.SEED_PRODUCTS ?? 48),
  insertChunkSize: 5_000,
  /** Reference "now" so churn/recency are deterministic within a seed run. */
  now: new Date(),
};
