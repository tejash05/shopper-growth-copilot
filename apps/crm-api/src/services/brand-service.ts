import { prisma, Prisma, ImportJobStatus } from '@scp/db';

const NOVAWEAR_NAME = 'NovaWear';

export interface BrandSummary {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

function toSummary(brand: { id: string; name: string; industry: string; createdAt: Date }): BrandSummary {
  return {
    id: brand.id,
    name: brand.name,
    industry: brand.industry,
    createdAt: brand.createdAt.toISOString(),
  };
}

export async function listBrands(): Promise<BrandSummary[]> {
  const rows = await prisma.brand.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toSummary);
}

export async function createBrand(input: { name: string; industry: string }): Promise<BrandSummary> {
  try {
    const brand = await prisma.brand.create({
      data: { name: input.name.trim(), industry: input.industry.trim() },
    });
    return toSummary(brand);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw Object.assign(new Error('A workspace with this name already exists.'), { statusCode: 409 });
    }
    throw e;
  }
}

export async function deleteBrand(brandId: string): Promise<{ id: string; name: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw Object.assign(new Error('Workspace not found.'), { statusCode: 404 });
  }
  if (brand.name === NOVAWEAR_NAME) {
    throw Object.assign(new Error('Cannot delete default demo workspace.'), { statusCode: 403 });
  }

  const processingImport = await prisma.importJob.findFirst({
    where: { brandId, status: ImportJobStatus.PROCESSING },
  });
  if (processingImport) {
    throw Object.assign(
      new Error('An import is currently processing for this workspace. Wait for it to finish before deleting.'),
      { statusCode: 409 },
    );
  }

  await prisma.$transaction(
    async (tx) => {
      // Bulk SQL deletes are much faster than nested deleteMany on large workspaces.
      await tx.$executeRaw`
        DELETE FROM "AttributedOrder" ao
        USING "Campaign" c
        WHERE ao."campaignId" = c.id AND c."brandId" = ${brandId}
      `;
      await tx.$executeRaw`
        DELETE FROM "CommunicationEvent" ce
        USING "Communication" comm, "Campaign" c
        WHERE ce."communicationId" = comm.id
          AND comm."campaignId" = c.id
          AND c."brandId" = ${brandId}
      `;
      await tx.$executeRaw`
        DELETE FROM "Communication" comm
        USING "Campaign" c
        WHERE comm."campaignId" = c.id AND c."brandId" = ${brandId}
      `;
      await tx.$executeRaw`
        DELETE FROM "ChannelCallback" cb
        USING "Campaign" c
        WHERE cb."campaignId" = c.id AND c."brandId" = ${brandId}
      `;
      await tx.$executeRaw`
        DELETE FROM "CampaignVariant" cv
        USING "Campaign" c
        WHERE cv."campaignId" = c.id AND c."brandId" = ${brandId}
      `;

      await tx.campaign.deleteMany({ where: { brandId } });
      await tx.importJob.deleteMany({ where: { brandId } });
      await tx.aiAgentRun.deleteMany({ where: { brandId } });
      await tx.segment.deleteMany({ where: { brandId } });

      await tx.$executeRaw`
        DELETE FROM "OrderItem" oi
        USING "Order" o
        WHERE oi."orderId" = o.id AND o."brandId" = ${brandId}
      `;

      await tx.order.deleteMany({ where: { brandId } });
      await tx.product.deleteMany({ where: { brandId } });
      await tx.customer.deleteMany({ where: { brandId } });
      await tx.brand.delete({ where: { id: brandId } });
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  return { id: brand.id, name: brand.name };
}
