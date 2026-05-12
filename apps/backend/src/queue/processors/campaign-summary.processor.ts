import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { AiService } from '../../modules/ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface CampaignSummaryJobData {
  campaignId: string;
  period: 'weekly' | 'monthly' | 'final';
}

@Processor(QUEUE_NAMES.CAMPAIGN_SUMMARY)
export class CampaignSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignSummaryProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<CampaignSummaryJobData>): Promise<void> {
    const { campaignId, period } = job.data;
    this.logger.log(`Generating ${period} summary for campaign ${campaignId}`);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: { select: { tasks: true } },
      },
    });
    if (!campaign) return;

    const [deliverableStats, paymentStats] = await Promise.all([
      this.prisma.deliverable.groupBy({
        by: ['status'],
        where: { contract: { brandId: campaign.brandId } },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { contract: { brandId: campaign.brandId }, status: 'COMPLETED' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
    ]);

    const performanceData = {
      deliverableStats,
      paymentsCompleted: paymentStats._count,
      totalPaid: paymentStats._sum.amount ?? 0,
      reach: campaign.reach,
      impressions: campaign.impressions,
      engagements: campaign.engagements,
      conversions: campaign.conversions,
      roi: campaign.roi,
    };

    const debrief = await this.aiService.generateCampaignDebrief({
      campaignId,
      title: campaign.title,
      objective: campaign.objective ?? 'Brand awareness',
      platforms: campaign.platforms,
      performanceData,
    });

    await this.prisma.$transaction([
      this.prisma.campaignSummary.create({
        data: {
          campaignId,
          period,
          content: debrief.markdown ?? `# Campaign Summary\n\nPeriod: ${period}`,
          metrics: performanceData,
        },
      }),
      this.prisma.campaign.update({
        where: { id: campaignId },
        data: { aiInsights: debrief, performanceData },
      }),
    ]);

    this.logger.log(`Campaign ${campaignId} ${period} summary generated`);
  }
}
