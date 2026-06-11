import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@scp/db';
import {
  Channel,
  LoyaltyTier,
  ProductCategory,
  customerImportRowSchema,
  orderImportRowSchema,
  importPayloadSchema,
  type CustomerImportRow,
  type ImportCommitResult,
  type ImportJobSummary,
  type ImportPayload,
  type ImportPreviewResult,
  type ImportRowError,
  type OrderImportRow,
} from '@scp/shared';
import { parseCsv } from '../lib/csv.js';
import { recomputeCustomerMetrics } from './customer-metrics-service.js';

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_CUSTOMERS = 10_000;
export const MAX_IMPORT_ORDERS = 50_000;

const CUSTOMER_CREATE_CHUNK = 500;
const ORDER_CREATE_CHUNK = 500;
const ORDER_ITEM_CHUNK = 1000;
const UPDATE_CONCURRENCY = 15;

export interface ImportLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

const noopLogger: ImportLogger = {
  info: () => {},
  error: () => {},
};

function parseBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  return fallback;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

function mapCategory(input?: string, productName?: string): ProductCategory {
  const haystack = `${input ?? ''} ${productName ?? ''}`.toLowerCase();
  if (/beauty|serum|lipstick|makeup|skincare|moistur|fragrance|haircare|wellness/.test(haystack)) {
    return ProductCategory.BEAUTY;
  }
  if (/sneaker|shoe|footwear|trainer|running shoes/.test(haystack)) return ProductCategory.SNEAKERS;
  if (/bag|wallet|belt|accessor|jewel|watch|scarf|handbag/.test(haystack)) {
    return ProductCategory.ACCESSORIES;
  }
  const upper = input?.trim().toUpperCase();
  if (upper && Object.values(ProductCategory).includes(upper as ProductCategory)) {
    return upper as ProductCategory;
  }
  return ProductCategory.FASHION;
}

function resolveCustomerName(row: CustomerImportRow): string {
  const first = row.firstName?.trim() ?? '';
  const last = row.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (row.externalCustomerId) return row.externalCustomerId;
  if (row.email) return row.email.split('@')[0] ?? 'Imported Shopper';
  return 'Imported Shopper';
}

function resolveCustomerEmail(row: CustomerImportRow, brandSlug: string): string {
  if (row.email?.trim()) return row.email.trim().toLowerCase();
  const id = row.externalCustomerId?.trim() || row.phone?.trim() || randomUUID().slice(0, 8);
  return `${id}@${brandSlug}.import`.toLowerCase();
}

function resolveCustomerPhone(row: CustomerImportRow): string {
  if (row.phone?.trim()) return normalizePhone(row.phone.trim());
  const seed = row.externalCustomerId?.trim() || row.email?.trim() || randomUUID();
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `+9199${String(hash % 100_000_000).padStart(8, '0')}`;
}

function customerKey(row: CustomerImportRow): string {
  if (row.externalCustomerId?.trim()) return `ext:${row.externalCustomerId.trim()}`;
  if (row.email?.trim()) return `email:${row.email.trim().toLowerCase()}`;
  if (row.phone?.trim()) return `phone:${normalizePhone(row.phone.trim())}`;
  return randomUUID();
}

function orderCustomerKey(row: OrderImportRow): string {
  if (row.externalCustomerId?.trim()) return `ext:${row.externalCustomerId.trim()}`;
  if (row.customerEmail?.trim()) return `email:${row.customerEmail.trim().toLowerCase()}`;
  if (row.customerPhone?.trim()) return `phone:${normalizePhone(row.customerPhone.trim())}`;
  return '';
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current !== undefined) await fn(current);
    }
  });
  await Promise.all(workers);
}

async function chunkInsert<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

interface CustomerIndex {
  byExternalId: Map<string, string>;
  byEmail: Map<string, string>;
  byPhone: Map<string, string>;
}

async function loadCustomerIndex(brandId: string): Promise<CustomerIndex> {
  const rows = await prisma.customer.findMany({
    where: { brandId },
    select: { id: true, externalCustomerId: true, email: true, phone: true },
  });
  const byExternalId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const row of rows) {
    if (row.externalCustomerId) byExternalId.set(row.externalCustomerId, row.id);
    byEmail.set(row.email, row.id);
    byPhone.set(row.phone, row.id);
  }
  return { byExternalId, byEmail, byPhone };
}

function lookupCustomerId(index: CustomerIndex, row: {
  externalCustomerId?: string | null;
  email?: string | null;
  phone?: string | null;
}): string | undefined {
  if (row.externalCustomerId?.trim()) {
    const id = index.byExternalId.get(row.externalCustomerId.trim());
    if (id) return id;
  }
  if (row.email?.trim()) {
    const id = index.byEmail.get(row.email.trim().toLowerCase());
    if (id) return id;
  }
  if (row.phone?.trim()) {
    const id = index.byPhone.get(normalizePhone(row.phone.trim()));
    if (id) return id;
  }
  return undefined;
}

function registerCustomerId(index: CustomerIndex, id: string, row: CustomerImportRow): void {
  if (row.externalCustomerId?.trim()) index.byExternalId.set(row.externalCustomerId.trim(), id);
  index.byEmail.set(resolveCustomerEmail(row, ''), id);
  if (row.email?.trim()) index.byEmail.set(row.email.trim().toLowerCase(), id);
  if (row.phone?.trim()) index.byPhone.set(normalizePhone(row.phone.trim()), id);
}

function validateRows(
  customers: Record<string, unknown>[],
  orders: Record<string, unknown>[],
): { customers: CustomerImportRow[]; orders: OrderImportRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const validCustomers: CustomerImportRow[] = [];
  const validOrders: OrderImportRow[] = [];

  customers.forEach((raw, idx) => {
    const parsed = customerImportRowSchema.safeParse(raw);
    if (parsed.success) {
      validCustomers.push(parsed.data);
    } else {
      for (const issue of parsed.error.issues) {
        errors.push({
          rowNumber: idx + 2,
          entityType: 'CUSTOMER',
          field: issue.path.join('.') || null,
          message: issue.message,
          rawRow: raw,
        });
      }
    }
  });

  orders.forEach((raw, idx) => {
    const parsed = orderImportRowSchema.safeParse(raw);
    if (parsed.success) {
      const date = new Date(parsed.data.orderDate);
      if (Number.isNaN(date.getTime())) {
        errors.push({
          rowNumber: idx + 2,
          entityType: 'ORDER',
          field: 'orderDate',
          message: 'orderDate must be a valid date.',
          rawRow: raw,
        });
        return;
      }
      validOrders.push(parsed.data);
    } else {
      for (const issue of parsed.error.issues) {
        errors.push({
          rowNumber: idx + 2,
          entityType: 'ORDER',
          field: issue.path.join('.') || null,
          message: issue.message,
          rawRow: raw,
        });
      }
    }
  });

  return { customers: validCustomers, orders: validOrders, errors };
}

function parseJsonImport(text: string): { customers: Record<string, unknown>[]; orders: Record<string, unknown>[] } {
  const parsed = JSON.parse(text) as { customers?: unknown; orders?: unknown };
  if (!parsed || typeof parsed !== 'object') {
    throw Object.assign(new Error('JSON must be an object with customers and/or orders arrays.'), {
      statusCode: 400,
    });
  }
  return {
    customers: Array.isArray(parsed.customers) ? (parsed.customers as Record<string, unknown>[]) : [],
    orders: Array.isArray(parsed.orders) ? (parsed.orders as Record<string, unknown>[]) : [],
  };
}

export function parseImportFiles(input: {
  jsonText?: string;
  customersCsvText?: string;
  ordersCsvText?: string;
  fileName: string;
}): { customers: Record<string, unknown>[]; orders: Record<string, unknown>[]; sourceType: 'CSV' | 'JSON' } {
  if (input.jsonText) {
    const { customers, orders } = parseJsonImport(input.jsonText);
    return { customers, orders, sourceType: 'JSON' };
  }

  const customers = input.customersCsvText ? parseCsv(input.customersCsvText) : [];
  const orders = input.ordersCsvText ? parseCsv(input.ordersCsvText) : [];
  if (customers.length === 0 && orders.length === 0) {
    throw Object.assign(new Error('Upload a JSON file or at least one CSV file.'), { statusCode: 400 });
  }
  return { customers, orders, sourceType: 'CSV' };
}

export function buildImportPreview(input: {
  fileName: string;
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  sourceType: 'CSV' | 'JSON';
}): ImportPreviewResult {
  if (input.customers.length > MAX_IMPORT_CUSTOMERS) {
    throw Object.assign(
      new Error(`Too many customer rows (${input.customers.length}). Maximum is ${MAX_IMPORT_CUSTOMERS}.`),
      { statusCode: 400 },
    );
  }
  if (input.orders.length > MAX_IMPORT_ORDERS) {
    throw Object.assign(
      new Error(`Too many order rows (${input.orders.length}). Maximum is ${MAX_IMPORT_ORDERS}.`),
      { statusCode: 400 },
    );
  }

  const { customers, orders, errors } = validateRows(input.customers, input.orders);
  const valid = errors.length === 0;

  const payload: ImportPayload | undefined = valid
    ? importPayloadSchema.parse({
        fileName: input.fileName,
        sourceType: input.sourceType,
        customers,
        orders,
      })
    : undefined;

  return {
    fileName: input.fileName,
    sourceType: input.sourceType,
    valid,
    summary: {
      customerCount: customers.length,
      orderCount: orders.length,
      errorCount: errors.length,
    },
    preview: {
      customers: customers.slice(0, 10),
      orders: orders.slice(0, 10),
    },
    errors,
    payload,
  };
}

async function failImportJob(
  jobId: string,
  errorsCount: number,
  message: string,
  rawRow?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.importError.create({
    data: {
      importJobId: jobId,
      rowNumber: 0,
      entityType: 'IMPORT',
      field: null,
      message,
      rawRow: rawRow ?? { message },
    },
  });
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorsCount,
      completedAt: new Date(),
    },
  });
}

export async function commitImport(
  brandId: string,
  payload: ImportPayload,
  logger: ImportLogger = noopLogger,
): Promise<ImportCommitResult> {
  const startedAt = Date.now();
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw Object.assign(new Error('Brand not found.'), { statusCode: 404 });

  const parsed = importPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw Object.assign(new Error('Invalid import payload.'), { statusCode: 400 });
  }

  const job = await prisma.importJob.create({
    data: {
      brandId,
      fileName: parsed.data.fileName,
      sourceType: parsed.data.sourceType,
      status: 'VALIDATING',
    },
  });
  logger.info({ importJobId: job.id, brandId, fileName: parsed.data.fileName }, 'Import job created');

  const brandSlug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const customerIdByKey = new Map<string, string>();
  const affectedCustomerIds = new Set<string>();
  let customersImported = 0;
  let ordersImported = 0;
  let rowsSkipped = 0;
  let errorsCount = 0;

  try {
    await prisma.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

    const customerIndex = await loadCustomerIndex(brandId);
    logger.info({ importJobId: job.id, existingCustomers: customerIndex.byEmail.size }, 'Customer index loaded');

    const customersToCreate: Prisma.CustomerCreateManyInput[] = [];
    const customersToUpdate: { id: string; data: Prisma.CustomerUpdateInput }[] = [];

    for (const row of parsed.data.customers) {
      const existingId = lookupCustomerId(customerIndex, row);
      const data = {
        name: resolveCustomerName(row),
        email: resolveCustomerEmail(row, brandSlug),
        phone: resolveCustomerPhone(row),
        city: row.city?.trim() || 'Unknown',
        externalCustomerId: row.externalCustomerId?.trim() || null,
        preferredChannel: row.preferredChannel ?? Channel.WHATSAPP,
        loyaltyTier: row.loyaltyTier ?? LoyaltyTier.BRONZE,
        consentWhatsApp: parseBool(row.consentWhatsApp),
        consentSms: parseBool(row.consentSms),
        consentEmail: parseBool(row.consentEmail),
        consentRcs: parseBool(row.consentRcs, false),
      };

      if (existingId) {
        customersToUpdate.push({ id: existingId, data });
        customerIdByKey.set(customerKey(row), existingId);
        if (row.externalCustomerId?.trim()) {
          customerIdByKey.set(`ext:${row.externalCustomerId.trim()}`, existingId);
        }
        if (row.email?.trim()) {
          customerIdByKey.set(`email:${row.email.trim().toLowerCase()}`, existingId);
        }
        if (row.phone?.trim()) {
          customerIdByKey.set(`phone:${normalizePhone(row.phone.trim())}`, existingId);
        }
      } else {
        const id = randomUUID();
        customersToCreate.push({ id, brandId, ...data });
        customerIdByKey.set(customerKey(row), id);
        if (row.externalCustomerId?.trim()) {
          customerIdByKey.set(`ext:${row.externalCustomerId.trim()}`, id);
          customerIndex.byExternalId.set(row.externalCustomerId.trim(), id);
        }
        customerIndex.byEmail.set(data.email, id);
        customerIndex.byPhone.set(data.phone, id);
        if (row.email?.trim()) {
          customerIdByKey.set(`email:${row.email.trim().toLowerCase()}`, id);
        }
        if (row.phone?.trim()) {
          customerIdByKey.set(`phone:${normalizePhone(row.phone.trim())}`, id);
        }
      }
      customersImported++;
    }

    logger.info(
      {
        importJobId: job.id,
        create: customersToCreate.length,
        update: customersToUpdate.length,
      },
      'Customers upsert started',
    );

    await chunkInsert(customersToCreate, CUSTOMER_CREATE_CHUNK, (chunk) =>
      prisma.customer.createMany({ data: chunk, skipDuplicates: true }),
    );
    await runPool(customersToUpdate, UPDATE_CONCURRENCY, async ({ id, data }) => {
      await prisma.customer.update({ where: { id }, data });
    });

    logger.info({ importJobId: job.id, customersImported }, 'Customers upsert completed');

    const existingProducts = await prisma.product.findMany({
      where: { brandId },
      select: { id: true, name: true, category: true, price: true },
    });
    const productByName = new Map(existingProducts.map((p) => [p.name, p.id]));
    const pendingProducts = new Map<string, { name: string; category: ProductCategory; price: number }>();

    const existingOrders = await prisma.order.findMany({
      where: { brandId, externalOrderId: { not: null } },
      select: { id: true, externalOrderId: true },
    });
    const orderByExternalId = new Map(
      existingOrders
        .filter((o) => o.externalOrderId)
        .map((o) => [o.externalOrderId as string, o.id]),
    );

    let orderSeq = await prisma.order.count({ where: { brandId } });

    const ordersToCreate: Prisma.OrderCreateManyInput[] = [];
    const ordersToUpdate: {
      id: string;
      customerId: string;
      totalAmount: number;
      category: ProductCategory;
      placedAt: Date;
    }[] = [];
    const orderItemsToCreate: Prisma.OrderItemCreateManyInput[] = [];
    const orderIdsNeedingItemReset: string[] = [];
    const importErrors: Prisma.ImportErrorCreateManyInput[] = [];

    logger.info({ importJobId: job.id, orderCount: parsed.data.orders.length }, 'Orders upsert started');

    for (const row of parsed.data.orders) {
      const key = orderCustomerKey(row);
      let customerId = customerIdByKey.get(key);
      if (!customerId) {
        customerId = lookupCustomerId(customerIndex, {
          externalCustomerId: row.externalCustomerId,
          email: row.customerEmail,
          phone: row.customerPhone,
        });
      }

      if (!customerId) {
        rowsSkipped++;
        errorsCount++;
        importErrors.push({
          importJobId: job.id,
          rowNumber: 0,
          entityType: 'ORDER',
          field: 'externalCustomerId',
          message: 'Order could not be matched to a customer in this workspace.',
          rawRow: row as unknown as Prisma.InputJsonValue,
        });
        continue;
      }

      const category = mapCategory(row.category, row.productName);
      const quantity = row.quantity ?? 1;
      const unitPrice = Math.round(row.orderValue / quantity);
      const placedAt = new Date(row.orderDate);
      const productName = row.productName?.trim() || `${category} Item`;

      if (!productByName.has(productName) && !pendingProducts.has(productName)) {
        pendingProducts.set(productName, { name: productName, category, price: unitPrice });
      }

      const externalOrderId = row.externalOrderId?.trim() || null;
      const existingOrderId = externalOrderId ? orderByExternalId.get(externalOrderId) : undefined;

      if (existingOrderId) {
        ordersToUpdate.push({
          id: existingOrderId,
          customerId,
          totalAmount: row.orderValue,
          category,
          placedAt,
        });
        orderIdsNeedingItemReset.push(existingOrderId);
        orderItemsToCreate.push({
          id: randomUUID(),
          orderId: existingOrderId,
          productId: productName,
          quantity,
          unitPrice,
        });
      } else {
        orderSeq += 1;
        const orderId = randomUUID();
        ordersToCreate.push({
          id: orderId,
          brandId,
          customerId,
          orderNumber: `IMP-${String(orderSeq).padStart(7, '0')}`,
          externalOrderId,
          totalAmount: row.orderValue,
          discountAmount: 0,
          category,
          placedAt,
        });
        if (externalOrderId) orderByExternalId.set(externalOrderId, orderId);
        orderItemsToCreate.push({
          id: randomUUID(),
          orderId,
          productId: productName,
          quantity,
          unitPrice,
        });
      }

      affectedCustomerIds.add(customerId);
      ordersImported++;
    }

    if (pendingProducts.size > 0) {
      const productRows = [...pendingProducts.values()].map((p) => ({
        id: randomUUID(),
        brandId,
        name: p.name,
        category: p.category,
        price: p.price,
      }));
      await prisma.product.createMany({ data: productRows, skipDuplicates: true });
      for (const product of productRows) {
        productByName.set(product.name, product.id);
      }
      logger.info({ importJobId: job.id, productsCreated: productRows.length }, 'Products created');
    }

    for (const item of orderItemsToCreate) {
      const productName = item.productId;
      const productId = productByName.get(productName);
      if (!productId) {
        throw new Error(`Missing product mapping for ${productName}`);
      }
      item.productId = productId;
    }

    await chunkInsert(ordersToCreate, ORDER_CREATE_CHUNK, (chunk) =>
      prisma.order.createMany({ data: chunk, skipDuplicates: true }),
    );
    await runPool(ordersToUpdate, UPDATE_CONCURRENCY, async (order) => {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customer: { connect: { id: order.customerId } },
          totalAmount: order.totalAmount,
          category: order.category,
          placedAt: order.placedAt,
        },
      });
    });

    if (orderIdsNeedingItemReset.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIdsNeedingItemReset } } });
    }

    await chunkInsert(orderItemsToCreate, ORDER_ITEM_CHUNK, (chunk) =>
      prisma.orderItem.createMany({ data: chunk, skipDuplicates: true }),
    );

    if (importErrors.length > 0) {
      await prisma.importError.createMany({ data: importErrors });
    }

    logger.info(
      { importJobId: job.id, ordersImported, rowsSkipped, errorsCount },
      'Orders upsert completed',
    );

    logger.info(
      { importJobId: job.id, customerCount: affectedCustomerIds.size },
      'Customer intelligence recompute started',
    );
    await recomputeCustomerMetrics([...affectedCustomerIds]);
    logger.info({ importJobId: job.id }, 'Customer intelligence recompute completed');

    const finalStatus = errorsCount > 0 && ordersImported === 0 ? 'FAILED' : 'COMPLETED';
    const completed = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        customersImported,
        ordersImported,
        rowsSkipped,
        errorsCount,
        completedAt: new Date(),
      },
    });

    logger.info(
      {
        importJobId: job.id,
        status: finalStatus,
        durationMs: Date.now() - startedAt,
        customersImported,
        ordersImported,
      },
      'Import job completed',
    );

    return {
      importJobId: completed.id,
      brandId,
      brandName: brand.name,
      customersImported,
      ordersImported,
      rowsSkipped,
      errorsCount,
      status: completed.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    logger.error({ importJobId: job.id, err: message }, 'Import job failed');
    await failImportJob(job.id, errorsCount + 1, message);
    throw Object.assign(new Error(message), { statusCode: 500 });
  }
}

export async function listImportJobs(brandId: string): Promise<ImportJobSummary[]> {
  const rows = await prisma.importJob.findMany({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    sourceType: row.sourceType,
    status: row.status,
    customersImported: row.customersImported,
    ordersImported: row.ordersImported,
    rowsSkipped: row.rowsSkipped,
    errorsCount: row.errorsCount,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

export async function getImportJobErrors(importJobId: string, brandId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: importJobId, brandId } });
  if (!job) throw Object.assign(new Error('Import job not found.'), { statusCode: 404 });
  return prisma.importError.findMany({
    where: { importJobId },
    orderBy: { rowNumber: 'asc' },
    take: 100,
  });
}
