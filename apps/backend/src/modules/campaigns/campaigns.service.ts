import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AiService } from '../ai/ai.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly aiService: AiService,
  ) {}

  async create(brandUserId: string, dto: CreateCampaignDto) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    if (!brand) throw new ForbiddenException('Brand profile required');

    // Generate AI timeline
    const aiTimeline = await this.aiService.generateCampaignTimeline({
      objective: dto.objective,
      startDate: dto.startDate,
      endDate: dto.endDate,
      platforms: dto.platforms ?? [],
      budget: dto.budget,
    });

    return this.prisma.campaign.create({
      data: {
        brandId: brand.id,
        title: dto.title,
        description: dto.description,
        objective: dto.objective,
        budget: dto.budget,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        platforms: dto.platforms ?? [],
        niche: dto.niche ?? [],
        targetAudience: dto.targetAudience as Prisma.InputJsonValue | undefined,
        aiTimeline,
        tasks: {
          createMany: {
            data: (aiTimeline.tasks ?? []).map(
              (task: { title: string; description: string; daysFromStart: number }, i: number) => ({
                title: task.title,
                description: task.description,
                aiGenerated: true,
                position: i,
                dueDate: dto.startDate
                  ? new Date(
                      new Date(dto.startDate).getTime() + task.daysFromStart * 86400000,
                    )
                  : undefined,
              }),
            ),
          },
        },
      },
      include: { tasks: true },
    });
  }

  async findAll(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    return this.prisma.campaign.findMany({
      where: { brandId: brand?.id },
      include: {
        _count: { select: { tasks: true, summaries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { position: 'asc' } },
        summaries: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async generateDebrief(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { tasks: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const debrief = await this.aiService.generateCampaignDebrief({
      campaignId,
      title: campaign.title,
      objective: campaign.objective ?? '',
      platforms: campaign.platforms,
      performanceData: campaign.performanceData as Record<string, unknown>,
    });

    const summary = await this.prisma.campaignSummary.create({
      data: {
        campaignId,
        period: 'final',
        content: debrief.markdown,
        metrics: debrief.metrics,
      },
    });

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { aiDebrief: debrief },
    });

    this.eventBus.emit(EVENTS.CAMPAIGN_SUMMARY_GENERATED, {
      campaignId,
      summaryId: summary.id,
      period: 'final',
    });

    return { summary, debrief };
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generateWeeklySummaries() {
    this.logger.log('Running weekly campaign summary generation...');
    const activeCampaigns = await this.prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, title: true, objective: true, platforms: true, performanceData: true },
    });

    const results = await Promise.allSettled(
      activeCampaigns.map(async (campaign) => {
        const summary = await this.aiService.generateCampaignDebrief({
          campaignId: campaign.id,
          title: campaign.title,
          objective: campaign.objective ?? '',
          platforms: campaign.platforms,
          performanceData: campaign.performanceData as Record<string, unknown>,
        });

        return this.prisma.campaignSummary.create({
          data: {
            campaignId: campaign.id,
            period: 'weekly',
            content: summary.markdown,
            metrics: summary.metrics,
          },
        });
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      this.logger.error(
        `Weekly summaries: ${results.length - failed.length} succeeded, ${failed.length} failed`,
      );
    } else {
      this.logger.log(`Weekly summaries generated for ${results.length} campaigns`);
    }
  }
}
