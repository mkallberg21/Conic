/**
 * Conic Platform — Database Seed Script
 *
 * Creates realistic demo data for development, QA, and investor demos.
 * Run with: npm run db:seed
 *
 * Idempotent: uses upsert so it can be re-run safely.
 */

import { PrismaClient, UserRole, ContractStatus, DeliverableStatus, PaymentStatus, CampaignStatus, DealSource, BriefStatus, ApplicationStatus } from '@prisma/client';
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  BULK DEMO DATA — many brands, creators, athletes, and deals for a rich demo.
  //  Idempotent: deterministic ids + upsert, safe to re-run.
  // ═══════════════════════════════════════════════════════════════════════════

  const pick = <T,>(arr: T[], n: number): T => arr[n % arr.length];

  // ── Brands ─────────────────────────────────────────────────────────────────
  const BRAND_DATA: [string, string, string, string, string][] = [
    ['Vireo Athletics', 'Sportswear', 'vireoathletics.com', 'Performance apparel for the next generation of athletes.', 'Devin'],
    ['Nomad Nutrition', 'Health & Wellness', 'nomadnutrition.co', 'Plant-based fuel for endurance athletes and creators.', 'Priya'],
    ['Halcyon Skincare', 'Beauty & Cosmetics', 'halcyonskin.com', 'Dermatologist-backed clean skincare.', 'Elena'],
    ['Circuit Energy', 'Beverage', 'circuitenergy.com', 'Zero-sugar energy drinks for gamers and lifters.', 'Marcus'],
    ['Meridian Travel', 'Travel & Hospitality', 'meridiantravel.com', 'Boutique stays and creator travel partnerships.', 'Sofia'],
    ['Foundry Apparel', 'Fashion', 'foundryapparel.com', 'Streetwear built with recycled materials.', 'Theo'],
    ['Pulse Audio', 'Consumer Electronics', 'pulseaudio.io', 'Wireless audio engineered for creators.', 'Nina'],
    ['Verdant Coffee', 'Food & Beverage', 'verdantcoffee.com', 'Single-origin roasts, sustainably sourced.', 'Owen'],
    ['Atlas Fitness', 'Fitness', 'atlasfitness.app', 'AI-powered training app and gear.', 'Grace'],
    ['Lumen Home', 'Home & Lifestyle', 'lumenhome.com', 'Smart lighting and cozy home essentials.', 'Isaac'],
  ];

  const demoBrands: { id: string; userId: string }[] = [];
  for (let i = 0; i < BRAND_DATA.length; i++) {
    const [company, industry, domain, description, first] = BRAND_DATA[i];
    const email = `brand${i + 1}@demo.conic.io`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: demoPassword, role: UserRole.BRAND, firstName: first, lastName: company.split(' ')[0], emailVerified: true, isActive: true },
    });
    const b = await prisma.brand.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        companyName: company,
        website: `https://${domain}`,
        industry,
        description,
        totalSpend: (12_000 + i * 7_500) * 100,
        creditBalance: (2_000 + i * 500) * 100,
      },
    });
    demoBrands.push({ id: b.id, userId: u.id });
  }
  console.log(`  ✓  ${demoBrands.length} brands created`);

  // ── Creators ────────────────────────────────────────────────────────────────
  // first,last,handle,platform,niche[],followers,engagement,tier,city,region,style[]
  const CREATOR_DATA: [string, string, string, string, string[], number, number, string, string, string, string[]][] = [
    ['Ava', 'Thompson', 'avathompson', 'instagram', ['fashion', 'lifestyle'], 540_000, 3.9, 'MID', 'Austin', 'TX', ['minimalist', 'editorial']],
    ['Liam', 'Foster', 'liamfosterfit', 'youtube', ['fitness', 'nutrition'], 820_000, 5.1, 'PREMIUM', 'San Diego', 'CA', ['energetic', 'authentic']],
    ['Noah', 'Kim', 'noahkimtech', 'youtube', ['tech', 'gaming'], 1_450_000, 4.4, 'PREMIUM', 'Seattle', 'WA', ['clean', 'informative']],
    ['Emma', 'Rodriguez', 'emmacooks', 'tiktok', ['food', 'recipes'], 690_000, 7.2, 'MID', 'Miami', 'FL', ['warm', 'homey']],
    ['Olivia', 'Bennett', 'oliviatravels', 'instagram', ['travel', 'lifestyle'], 310_000, 4.8, 'MID', 'Denver', 'CO', ['wanderlust', 'bright']],
    ['Ethan', 'Walsh', 'ethanwalsh', 'tiktok', ['comedy', 'lifestyle'], 2_100_000, 8.6, 'PREMIUM', 'Chicago', 'IL', ['playful', 'bold']],
    ['Sophia', 'Nguyen', 'sophiabeauty', 'instagram', ['beauty', 'skincare'], 470_000, 5.5, 'MID', 'Los Angeles', 'CA', ['glossy', 'soft']],
    ['Mason', 'Carter', 'masonoutdoors', 'youtube', ['outdoors', 'adventure'], 260_000, 4.1, 'EMERGING', 'Boulder', 'CO', ['rugged', 'cinematic']],
    ['Isabella', 'Rossi', 'bellastyle', 'instagram', ['fashion', 'luxury'], 980_000, 3.6, 'PREMIUM', 'New York', 'NY', ['luxury', 'editorial']],
    ['Jayden', 'Brooks', 'jaydengames', 'twitch', ['gaming', 'esports'], 1_750_000, 6.9, 'PREMIUM', 'Dallas', 'TX', ['high-energy', 'streetwear']],
    ['Mia', 'Patel', 'miawellness', 'instagram', ['wellness', 'yoga'], 380_000, 5.2, 'MID', 'Portland', 'OR', ['calm', 'natural']],
    ['Lucas', 'Meyer', 'lucasmeyer', 'youtube', ['finance', 'lifestyle'], 540_000, 4.0, 'MID', 'Boston', 'MA', ['sharp', 'polished']],
    ['Harper', 'Diaz', 'harperdiaz', 'tiktok', ['dance', 'music'], 3_200_000, 9.1, 'PREMIUM', 'Atlanta', 'GA', ['vibrant', 'trendy']],
    ['Benjamin', 'Cole', 'bencoleauto', 'youtube', ['automotive', 'tech'], 720_000, 4.3, 'MID', 'Detroit', 'MI', ['bold', 'cinematic']],
    ['Charlotte', 'Evans', 'charlottehome', 'instagram', ['home', 'diy'], 290_000, 5.7, 'EMERGING', 'Nashville', 'TN', ['cozy', 'rustic']],
    ['Amara', 'Okafor', 'amaraskincare', 'tiktok', ['skincare', 'beauty'], 1_100_000, 6.4, 'PREMIUM', 'Houston', 'TX', ['clinical', 'honest']],
  ];

  const demoCreators: { id: string; userId: string }[] = [];
  for (let i = 0; i < CREATOR_DATA.length; i++) {
    const [first, last, handle, platform, niche, followers, engagement, tier, city, region, style] = CREATOR_DATA[i];
    const email = `creator.${handle}@demo.conic.io`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: demoPassword, role: UserRole.CREATOR, firstName: first, lastName: last, emailVerified: true, isActive: true },
    });
    const c = await prisma.creator.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        handle: `@${handle}`,
        bio: `${niche.join(' & ')} creator based in ${city}. Partnering with brands that fit my community.`,
        platforms: JSON.stringify(platform === 'youtube' ? ['youtube', 'instagram'] : [platform, 'instagram']),
        primaryPlatform: platform,
        niche,
        contentStyle: style,
        aestheticTags: style,
        languages: ['en'],
        city,
        region,
        country: 'US',
        followersCount: followers,
        engagementRate: engagement,
        avgReach: Math.round(followers * (engagement / 100) * 3),
        audienceScore: 70 + ((i * 7) % 28),
        fraudScore: (i * 3) % 8,
        performanceScore: 72 + ((i * 5) % 26),
        pricingTier: tier,
        isVerified: i % 3 !== 0,
        totalEarnings: (5_000 + i * 3_200) * 100,
      },
    });
    demoCreators.push({ id: c.id, userId: u.id });
  }
  console.log(`  ✓  ${demoCreators.length} creators created`);

  // ── Athletes (adults only, to keep the demo free of guardian gating) ─────────
  // first,last,sport,school,position,classYear,followers,city,region
  const ATHLETE_DATA: [string, string, string, string, string, string, number, string, string][] = [
    ['Marcus', 'Johnson', 'Football', 'Ohio State University', 'QB', 'Junior', 420_000, 'Columbus', 'OH'],
    ['Tyler', 'Washington', 'Basketball', 'Duke University', 'Guard', 'Sophomore', 680_000, 'Durham', 'NC'],
    ['Destiny', 'Carter', 'Track & Field', 'University of Oregon', 'Sprinter', 'Senior', 210_000, 'Eugene', 'OR'],
    ['Jalen', 'Robinson', 'Football', 'University of Alabama', 'WR', 'Junior', 510_000, 'Tuscaloosa', 'AL'],
    ['Sophia', 'Martinez', 'Soccer', 'Stanford University', 'Forward', 'Senior', 340_000, 'Stanford', 'CA'],
    ['Aaliyah', 'Bryant', 'Gymnastics', 'UCLA', 'All-Around', 'Sophomore', 890_000, 'Los Angeles', 'CA'],
    ['Cameron', 'Lee', 'Basketball', 'University of Kentucky', 'Forward', 'Junior', 450_000, 'Lexington', 'KY'],
    ['Brianna', 'Scott', 'Volleyball', 'University of Texas', 'Outside Hitter', 'Senior', 180_000, 'Austin', 'TX'],
    ['Nathan', 'Hughes', 'Baseball', 'LSU', 'Pitcher', 'Junior', 150_000, 'Baton Rouge', 'LA'],
    ['Kayla', 'Reed', 'Swimming', 'University of Florida', 'Freestyle', 'Sophomore', 120_000, 'Gainesville', 'FL'],
    ['Malik', 'Turner', 'Football', 'University of Georgia', 'RB', 'Senior', 620_000, 'Athens', 'GA'],
    ['Zoe', 'Campbell', 'Softball', 'University of Oklahoma', 'Shortstop', 'Junior', 230_000, 'Norman', 'OK'],
  ];

  const demoAthletes: { id: string; userId: string }[] = [];
  for (let i = 0; i < ATHLETE_DATA.length; i++) {
    const [first, last, sport, school, position, classYear, followers, city, region] = ATHLETE_DATA[i];
    const email = `athlete${i + 1}@demo.conic.io`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: demoPassword, role: UserRole.ATHLETE, firstName: first, lastName: last, emailVerified: true, isActive: true },
    });
    const a = await prisma.athlete.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        sport,
        position,
        classYear,
        dateOfBirth: new Date(2003 - (i % 3), (i * 2) % 12, ((i * 5) % 27) + 1),
        isMinor: false,
        nilActive: true,
        followersCount: followers,
        engagementRate: 4 + ((i * 6) % 40) / 10,
        primaryPlatform: i % 2 === 0 ? 'instagram' : 'tiktok',
        contentStyle: ['authentic', 'competitive'],
        aestheticTags: ['gameday', 'behind-the-scenes'],
        languages: ['en'],
        city,
        region,
        country: 'US',
        audienceScore: 68 + ((i * 5) % 30),
        fraudScore: (i * 2) % 6,
        performanceScore: 70 + ((i * 4) % 28),
        isVerified: i % 2 === 0,
        totalEarningsNilCents: (3_000 + i * 2_100) * 100,
        marketplaceListing: {
          create: {
            headline: `${first} ${last} — ${sport} · ${school}`,
            bio: `${classYear} ${position} at ${school}. Open to NIL partnerships that resonate with my community.`,
            sport,
            preferredDealTypes: ['social_post', 'appearance', 'autograph'],
            minDealValueCents: (500 + i * 150) * 100,
            socialFollowersTotal: followers,
            engagementRatePct: 4 + ((i * 6) % 40) / 10,
            topAudienceLocations: [region, 'US'],
            verifiedByPlatform: i % 2 === 0,
            viewCount: 40 + i * 13,
            inquiryCount: i % 5,
          },
        },
      },
    });
    demoAthletes.push({ id: a.id, userId: u.id });
  }
  console.log(`  ✓  ${demoAthletes.length} athletes created (with marketplace listings)`);

  // ── Deals (contracts) — brand × creator, varied status + sourcing ────────────
  const allBrands = [{ id: brand.id, userId: brandUser.id }, ...demoBrands];
  const allCreators = [{ id: creator1.id, userId: creatorUser1.id }, { id: creator2.id, userId: creatorUser2.id }, ...demoCreators];

  const STATUS_CYCLE = [ContractStatus.ACTIVE, ContractStatus.COMPLETED, ContractStatus.PENDING_SIGNATURE, ContractStatus.ACTIVE, ContractStatus.DRAFT];
  const SOURCE_CYCLE = [DealSource.MATCHMAKING, DealSource.DIRECT, DealSource.SELF_SERVE, DealSource.MATCHMAKING];

  let dealsCreated = 0;
  let deliverablesCreated = 0;
  let paymentsCreated = 0;
  const DEAL_COUNT = 26;
  for (let i = 0; i < DEAL_COUNT; i++) {
    const b = pick(allBrands, i);
    const c = pick(allCreators, i * 3 + 1);
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const source = SOURCE_CYCLE[i % SOURCE_CYCLE.length];
    const value = (2_500 + ((i * 1_700) % 22_000)) * 100;
    const id = `demo-contract-${String(i + 1).padStart(3, '0')}`;
    const signed = status === ContractStatus.ACTIVE || status === ContractStatus.COMPLETED;

    await prisma.contract.upsert({
      where: { id },
      update: {},
      create: {
        id,
        brandId: b.id,
        creatorId: c.id,
        templateId: template.id,
        title: `Deal #${i + 1} — Sponsored content partnership`,
        status,
        dealSource: source,
        content: template.content,
        platforms: pick([['instagram'], ['tiktok', 'youtube'], ['youtube'], ['instagram', 'tiktok']], i),
        startDate: new Date(2025, (i % 8) + 1, 1),
        endDate: new Date(2025, (i % 8) + 4, 28),
        totalValue: value,
        currency: 'USD',
        riskScore: 5 + (i % 20),
        riskFlags: JSON.stringify([]),
        versionNumber: 1,
        brandSignedAt: signed ? new Date(2025, i % 8, 20) : null,
        creatorSignedAt: signed ? new Date(2025, i % 8, 21) : null,
        exclusivity: i % 4 === 0,
        exclusivityDays: i % 4 === 0 ? 30 : null,
      },
    });
    dealsCreated++;

    // Deliverable + payment for the money-bearing statuses
    if (status === ContractStatus.ACTIVE || status === ContractStatus.COMPLETED) {
      const delId = `demo-del-${String(i + 1).padStart(3, '0')}`;
      const delStatus = status === ContractStatus.COMPLETED ? DeliverableStatus.APPROVED : DeliverableStatus.SUBMITTED;
      await prisma.deliverable.upsert({
        where: { id: delId },
        update: {},
        create: {
          id: delId,
          contractId: id,
          creatorId: c.id,
          title: '1× Sponsored Reel + 2× Stories',
          description: 'Hero reel plus supporting stories per the campaign brief.',
          platform: 'instagram',
          contentType: 'REEL',
          dueDate: new Date(2025, (i % 8) + 2, 15),
          status: delStatus,
          proofType: 'URL',
          proofUrl: `https://www.instagram.com/reel/DEMO_${i + 1}`,
          submittedAt: new Date(2025, (i % 8) + 2, 12),
          approvedAt: status === ContractStatus.COMPLETED ? new Date(2025, (i % 8) + 2, 14) : null,
          verificationStatus: status === ContractStatus.COMPLETED ? 'PASSED' : 'PENDING',
          paymentAmount: value,
        },
      });
      deliverablesCreated++;

      if (status === ContractStatus.COMPLETED) {
        // Brand-side fee: 10% when matchmaking sourced the deal, else 5%. Creator nets 100%.
        const feeRate = source === DealSource.MATCHMAKING ? 0.1 : 0.05;
        const platformFee = Math.round(value * feeRate);
        const payId = `demo-pay-${String(i + 1).padStart(3, '0')}`;
        await prisma.payment.upsert({
          where: { id: payId },
          update: {},
          create: {
            id: payId,
            contractId: id,
            deliverableId: delId,
            amount: value,
            currency: 'USD',
            status: PaymentStatus.COMPLETED,
            platformFeeRate: feeRate,
            platformFee,
            netAmount: value,
            brandChargeCents: value + platformFee,
            description: `Payout for ${id} (${source} sourced)`,
            paidAt: new Date(2025, (i % 8) + 2, 16),
          },
        });
        paymentsCreated++;
      }
    }
  }
  console.log(`  ✓  ${dealsCreated} deals, ${deliverablesCreated} deliverables, ${paymentsCreated} payments created`);

  // ── Campaigns (one per first several brands) ─────────────────────────────────
  let campaignsCreated = 0;
  for (let i = 0; i < 5; i++) {
    const b = demoBrands[i];
    const id = `demo-campaign-${String(i + 1).padStart(3, '0')}`;
    await prisma.campaign.upsert({
      where: { id },
      update: {},
      create: {
        id,
        brandId: b.id,
        title: `${BRAND_DATA[i][0]} — Q${(i % 4) + 1} Creator Push`,
        description: 'Multi-creator awareness and conversion campaign.',
        status: pick([CampaignStatus.ACTIVE, CampaignStatus.ACTIVE, CampaignStatus.COMPLETED, CampaignStatus.DRAFT], i),
        objective: 'Awareness + conversion across social platforms',
        targetAudience: JSON.stringify({ ageRange: '18-34', gender: 'all', interests: [BRAND_DATA[i][1]] }),
        budget: (30_000 + i * 10_000) * 100,
        spentBudget: (8_000 + i * 3_000) * 100,
        startDate: new Date(2025, i + 1, 1),
        endDate: new Date(2025, i + 5, 28),
        platforms: ['instagram', 'tiktok', 'youtube'],
        niche: [BRAND_DATA[i][1].toLowerCase()],
        creatorCount: 3 + i,
        deliverableCount: 6 + i,
        reach: (500_000 + i * 250_000),
        impressions: (2_000_000 + i * 900_000),
        engagements: (120_000 + i * 45_000),
        roi: 2.4 + i * 0.3,
      },
    });
    campaignsCreated++;
  }
  console.log(`  ✓  ${campaignsCreated} campaigns created`);

  // ── Marketplace briefs + applications ────────────────────────────────────────
  const BRIEF_DATA: [number, string, number, string[], string, string][] = [
    [0, 'Spring drop — 3 creators for launch reels', 6_000, ['instagram', 'tiktok'], 'creator', 'both'],
    [1, 'Endurance athletes for a 30-day challenge', 4_500, ['instagram'], 'athlete', 'athlete'],
    [2, 'Skincare routine UGC — clinical honesty', 8_000, ['tiktok', 'youtube'], 'creator', 'creator'],
    [3, 'Gaming creators for energy-drink integration', 12_000, ['twitch', 'youtube'], 'creator', 'creator'],
    [4, 'Travel creators for boutique-stay series', 9_500, ['instagram', 'youtube'], 'both', 'both'],
  ];
  let briefsCreated = 0;
  let appsCreated = 0;
  for (let i = 0; i < BRIEF_DATA.length; i++) {
    const [brandIdx, title, budgetK, platforms, , targetType] = BRIEF_DATA[i];
    const id = `demo-brief-${String(i + 1).padStart(3, '0')}`;
    await prisma.marketplaceBrief.upsert({
      where: { id },
      update: {},
      create: {
        id,
        brandId: demoBrands[brandIdx].id,
        title,
        description: 'Looking for authentic creators who fit our brand voice. Rate negotiable based on scope and deliverables.',
        budgetCents: budgetK * 100,
        currency: 'USD',
        deliverableType: 'reel',
        platforms,
        niche: [BRAND_DATA[brandIdx][1].toLowerCase()],
        targetType,
        minFollowers: 50_000,
        status: i % 4 === 3 ? BriefStatus.FILLED : BriefStatus.OPEN,
      },
    });
    briefsCreated++;

    // 3 applications per brief from a rotating set of creators/athletes
    for (let j = 0; j < 3; j++) {
      const applicant = targetType === 'athlete' ? demoAthletes[(i + j) % demoAthletes.length] : demoCreators[(i * 2 + j) % demoCreators.length];
      const isAthlete = targetType === 'athlete';
      const appId = `demo-app-${String(i + 1).padStart(3, '0')}-${j}`;
      await prisma.briefApplication.upsert({
        where: { id: appId },
        update: {},
        create: {
          id: appId,
          briefId: id,
          creatorId: isAthlete ? null : applicant.id,
          athleteId: isAthlete ? applicant.id : null,
          pitch: 'I love this brand and my audience aligns perfectly. Here is how I would approach the campaign…',
          proposedRateCents: (1_500 + j * 800) * 100,
          status: pick([ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED, ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED], i + j),
        },
      });
      appsCreated++;
    }
  }
  console.log(`  ✓  ${briefsCreated} marketplace briefs + ${appsCreated} applications created`);

  const totalBrands = allBrands.length;
  const totalCreators = allCreators.length;
  const totalAthletes = demoAthletes.length;

  console.log(`
✅  Seed complete!

Data: ${totalBrands} brands · ${totalCreators} creators · ${totalAthletes} athletes · ${dealsCreated + 2} deals · ${campaignsCreated + 1} campaigns · ${briefsCreated} briefs

Primary demo logins (password: Demo@Conic2025!)
  Brand:    brand@demo.conic.io
  Creator:  creator1@demo.conic.io  /  creator2@demo.conic.io
  Athlete:  athlete1@demo.conic.io
  Admin:    admin@demo.conic.io

More brands: brand1@…brand10@demo.conic.io   |   more athletes: athlete1@…athlete12@demo.conic.io
Creators also at creator.<handle>@demo.conic.io (e.g. creator.avathompson@demo.conic.io)
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
