/**
 * Conic Platform — Database Seed Script
 *
 * Creates realistic demo data for development, QA, and investor demos.
 * Run with: npm run db:seed
 *
 * Idempotent: uses upsert so it can be re-run safely.
 */

import { PrismaClient, UserRole, ContractStatus, DeliverableStatus, PaymentStatus, CampaignStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding Conic database…');

  // ── 1. Users ───────────────────────────────────────────────────────────────

  const demoPassword = await argon2.hash('Demo@Conic2025!');

  const brandUser = await prisma.user.upsert({
    where: { email: 'brand@demo.conic.io' },
    update: {},
    create: {
      email: 'brand@demo.conic.io',
      passwordHash: demoPassword,
      role: UserRole.BRAND,
      firstName: 'Sarah',
      lastName: 'Mitchell',
      emailVerified: true,
      isActive: true,
    },
  });

  const creatorUser1 = await prisma.user.upsert({
    where: { email: 'creator1@demo.conic.io' },
    update: {},
    create: {
      email: 'creator1@demo.conic.io',
      passwordHash: demoPassword,
      role: UserRole.CREATOR,
      firstName: 'Jordan',
      lastName: 'Reyes',
      emailVerified: true,
      isActive: true,
    },
  });

  const creatorUser2 = await prisma.user.upsert({
    where: { email: 'creator2@demo.conic.io' },
    update: {},
    create: {
      email: 'creator2@demo.conic.io',
      passwordHash: demoPassword,
      role: UserRole.CREATOR,
      firstName: 'Maya',
      lastName: 'Chen',
      emailVerified: true,
      isActive: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.conic.io' },
    update: {},
    create: {
      email: 'admin@demo.conic.io',
      passwordHash: demoPassword,
      role: UserRole.ADMIN,
      firstName: 'Platform',
      lastName: 'Admin',
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('  ✓  Users created');

  // ── 2. Brand ───────────────────────────────────────────────────────────────

  const brand = await prisma.brand.upsert({
    where: { userId: brandUser.id },
    update: {},
    create: {
      userId: brandUser.id,
      companyName: 'Luminary Beauty Co.',
      website: 'https://luminarybeauty.com',
      industry: 'Beauty & Cosmetics',
      description: 'Clean beauty brand disrupting the skincare space with sustainable formulas.',
      totalSpend: 48_750_00, // $48,750 in cents
      creditBalance: 10_000_00,
    },
  });

  console.log('  ✓  Brand created');

  // ── 3. Creators ─────────────────────────────────────────────────────────────

  const creator1 = await prisma.creator.upsert({
    where: { userId: creatorUser1.id },
    update: {},
    create: {
      userId: creatorUser1.id,
      handle: '@jordanreyes',
      bio: 'Sustainable beauty & lifestyle content creator. 4 years building authentic community.',
      platforms: JSON.stringify(['instagram', 'tiktok', 'youtube']),
      primaryPlatform: 'instagram',
      niche: ['beauty', 'skincare', 'sustainability'],
      followersCount: 284_000,
      engagementRate: 4.7,
      avgReach: 62_000,
      audienceScore: 87,
      fraudScore: 3,
      performanceScore: 91,
      pricingTier: 'MID',
      isVerified: true,
      totalEarnings: 22_400_00,
    },
  });

  const creator2 = await prisma.creator.upsert({
    where: { userId: creatorUser2.id },
    update: {},
    create: {
      userId: creatorUser2.id,
      handle: '@mayachen',
      bio: 'K-beauty obsessed. Honest reviews, tutorials, and skincare science breakdowns.',
      platforms: JSON.stringify(['tiktok', 'youtube']),
      primaryPlatform: 'tiktok',
      niche: ['skincare', 'k-beauty', 'tutorials'],
      followersCount: 1_200_000,
      engagementRate: 6.2,
      avgReach: 380_000,
      audienceScore: 94,
      fraudScore: 1,
      performanceScore: 96,
      pricingTier: 'PREMIUM',
      isVerified: true,
      totalEarnings: 87_300_00,
    },
  });

  console.log('  ✓  Creators created');

  // ── 4. Contract Template ───────────────────────────────────────────────────

  const template = await prisma.contractTemplate.upsert({
    where: { id: 'seed-template-001' },
    update: {},
    create: {
      id: 'seed-template-001',
      name: 'Standard Sponsored Post Agreement',
      description: 'Industry-standard template for sponsored social media content partnerships.',
      content: `SPONSORED CONTENT PARTNERSHIP AGREEMENT

This Agreement ("Agreement") is entered into between the Brand and Creator identified on the Order Form.

1. SERVICES. Creator will create and publish sponsored content as described in the Deliverables Schedule.

2. COMPENSATION. Brand will pay Creator the amounts set forth in the Payment Schedule, subject to deliverable approval.

3. FTC COMPLIANCE. Creator must clearly disclose the paid partnership using platform-native tags and #ad / #sponsored hashtags.

4. CONTENT RIGHTS. Brand receives a 12-month license to repurpose approved content across owned channels.

5. EXCLUSIVITY. Creator agrees not to promote competing products for the exclusivity period specified in the Order Form.

6. APPROVAL PROCESS. Brand has 72 hours to approve or request revisions after deliverable submission.

7. PAYMENT TERMS. Payment due within 5 business days of deliverable approval via ACH transfer.`,
      category: 'SPONSORED_POST',
      isPublic: true,
      createdBy: adminUser.id,
      clauseCount: 7,
      usageCount: 0,
    },
  });

  console.log('  ✓  Contract template created');

  // ── 5. Active Contract ─────────────────────────────────────────────────────

  const contract1 = await prisma.contract.upsert({
    where: { id: 'seed-contract-001' },
    update: {},
    create: {
      id: 'seed-contract-001',
      brandId: brand.id,
      creatorId: creator1.id,
      templateId: template.id,
      title: 'Luminary x Jordan – Spring Glow Campaign',
      status: ContractStatus.ACTIVE,
      content: template.content,
      platforms: ['instagram'],
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      totalValue: 8_500_00, // $8,500 in cents
      currency: 'USD',
      riskScore: 12,
      riskFlags: JSON.stringify([]),
      versionNumber: 1,
      brandSignedAt: new Date('2025-03-28'),
      brandSignerIp: '10.0.0.1',
      creatorSignedAt: new Date('2025-03-29'),
      creatorSignerIp: '10.0.0.2',
      exclusivity: true,
      exclusivityDays: 30,
    },
  });

  const contract2 = await prisma.contract.upsert({
    where: { id: 'seed-contract-002' },
    update: {},
    create: {
      id: 'seed-contract-002',
      brandId: brand.id,
      creatorId: creator2.id,
      templateId: template.id,
      title: 'Luminary x Maya – TikTok Launch Series',
      status: ContractStatus.PENDING_SIGNATURE,
      content: template.content,
      platforms: ['tiktok', 'youtube'],
      startDate: new Date('2025-05-15'),
      endDate: new Date('2025-08-15'),
      totalValue: 24_000_00, // $24,000 in cents
      currency: 'USD',
      riskScore: 8,
      riskFlags: JSON.stringify([]),
      versionNumber: 1,
      brandSignedAt: new Date('2025-05-01'),
      brandSignerIp: '10.0.0.1',
      exclusivity: false,
    },
  });

  console.log('  ✓  Contracts created');

  // ── 6. Deliverables ────────────────────────────────────────────────────────

  await prisma.deliverable.upsert({
    where: { id: 'seed-del-001' },
    update: {},
    create: {
      id: 'seed-del-001',
      contractId: contract1.id,
      creatorId: creator1.id,
      title: '1× Instagram Reel (60s) – Product reveal',
      description: 'Hero reel showcasing the Luminary SPF Glow Serum with real skin transformation.',
      platform: 'instagram',
      contentType: 'REEL',
      dueDate: new Date('2025-04-15'),
      status: DeliverableStatus.APPROVED,
      proofUrl: 'https://www.instagram.com/reel/DEMO_REEL_001',
      proofType: 'URL',
      postUrl: 'https://www.instagram.com/reel/DEMO_REEL_001',
      submittedAt: new Date('2025-04-12'),
      approvedAt: new Date('2025-04-14'),
      verificationStatus: 'PASSED',
      verificationScore: 96,
      verificationFlags: JSON.stringify([]),
      paymentAmount: 3_500_00,
    },
  });

  await prisma.deliverable.upsert({
    where: { id: 'seed-del-002' },
    update: {},
    create: {
      id: 'seed-del-002',
      contractId: contract1.id,
      creatorId: creator1.id,
      title: '3× Instagram Stories – Tutorial series',
      description: 'Step-by-step AM skincare routine featuring 3 Luminary products.',
      platform: 'instagram',
      contentType: 'STORY',
      dueDate: new Date('2025-05-01'),
      status: DeliverableStatus.SUBMITTED,
      proofUrl: 'https://www.instagram.com/stories/DEMO_STORIES_001',
      proofType: 'URL',
      submittedAt: new Date('2025-04-29'),
      verificationStatus: 'PENDING',
      paymentAmount: 2_500_00,
    },
  });

  console.log('  ✓  Deliverables created');

  // ── 7. Payment ─────────────────────────────────────────────────────────────

  await prisma.payment.upsert({
    where: { id: 'seed-pay-001' },
    update: {},
    create: {
      id: 'seed-pay-001',
      contractId: contract1.id,
      deliverableId: 'seed-del-001',
      amount: 3_500_00,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      platformFeeRate: 0.05,
      platformFee: 175_00,
      netAmount: 3_325_00,
      description: 'Payment for Instagram Reel – Spring Glow Campaign',
      paidAt: new Date('2025-04-16'),
    },
  });

  console.log('  ✓  Payments created');

  // ── 8. Campaign ────────────────────────────────────────────────────────────

  const campaign = await prisma.campaign.upsert({
    where: { id: 'seed-campaign-001' },
    update: {},
    create: {
      id: 'seed-campaign-001',
      brandId: brand.id,
      title: 'Summer Glow 2025',
      description: 'Nationwide awareness push for the new SPF Glow Serum line via micro and macro creators.',
      status: CampaignStatus.ACTIVE,
      objective: 'Brand awareness + conversion for new product line launch',
      targetAudience: JSON.stringify({
        ageRange: '18-35',
        gender: 'all',
        interests: ['skincare', 'beauty', 'wellness'],
        locations: ['US', 'CA', 'UK'],
      }),
      budget: 48_000_00,
      spentBudget: 8_500_00,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-08-31'),
      platforms: ['instagram', 'tiktok', 'youtube'],
      niche: ['beauty', 'skincare', 'sustainability'],
      creatorCount: 2,
      deliverableCount: 5,
      contractIds: [contract1.id, contract2.id],
      roi: 3.2,
      reach: 1_200_000,
      impressions: 4_800_000,
      engagements: 287_000,
    },
  });

  console.log('  ✓  Campaign created');

  // ── 9. Creator Graph Nodes ─────────────────────────────────────────────────

  await prisma.creatorGraphNode.upsert({
    where: { creatorId: creator1.id },
    update: {},
    create: {
      creatorId: creator1.id,
      clusterId: 'beauty-mid-tier',
      clusterLabel: 'Sustainable Beauty',
      centrality: 0.72,
      influenceScore: 0.81,
      botNetworkScore: 0.04,
      audienceOverlap: JSON.stringify({ [creator2.id]: 0.18 }),
      trending: true,
      trendingScore: 0.86,
    },
  });

  await prisma.creatorGraphNode.upsert({
    where: { creatorId: creator2.id },
    update: {},
    create: {
      creatorId: creator2.id,
      clusterId: 'beauty-premium',
      clusterLabel: 'K-Beauty & Viral',
      centrality: 0.94,
      influenceScore: 0.97,
      botNetworkScore: 0.01,
      audienceOverlap: JSON.stringify({ [creator1.id]: 0.18 }),
      trending: true,
      trendingScore: 0.98,
    },
  });

  console.log('  ✓  Creator graph nodes created');

  // ── 10. Performance Predictions ────────────────────────────────────────────

  await prisma.creatorPrediction.create({
    data: {
      creatorId: creator1.id,
      predictedReach: 58_000,
      predictedEngagement: 0.044,
      predictedROI: 2.9,
      audienceAuthenticity: 0.96,
      fraudLikelihood: 0.03,
      confidence: 0.91,
      modelVersion: '1.0.0',
      inputFeatures: JSON.stringify({
        followersCount: 284000,
        engagementRate: 4.7,
        avgReach: 62000,
        historicalDeals: 12,
      }),
    },
  });

  console.log('  ✓  Creator predictions created');

  console.log(`
✅  Seed complete!

Demo credentials (all use password: Demo@Conic2025!)
  Brand:    brand@demo.conic.io
  Creator1: creator1@demo.conic.io
  Creator2: creator2@demo.conic.io
  Admin:    admin@demo.conic.io
`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
