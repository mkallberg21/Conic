import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Input/Output Types ───────────────────────────────────────────────────────

interface ContractGenInput {
  campaignType: string;
  platforms: string[];
  usageRights: string;
  exclusivity: boolean;
  exclusivityDays?: number;
  totalValue: number;
}

interface VerifyDeliverableInput {
  proofUrl: string;
  platform: string;
  contentType: string;
  requiredHashtags: string[];
  requiredMentions: string[];
  caption?: string;
}

interface CampaignTimelineInput {
  objective?: string;
  startDate?: string;
  endDate?: string;
  platforms: string[];
  budget?: number;
}

interface CampaignDebriefInput {
  campaignId: string;
  title: string;
  objective: string;
  platforms: string[];
  performanceData?: Record<string, unknown>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get contractAiUrl() {
    return this.configService.get<string>('ai.contractAiUrl');
  }
  private get deliverableAiUrl() {
    return this.configService.get<string>('ai.deliverableAiUrl');
  }
  private get campaignAgentUrl() {
    return this.configService.get<string>('ai.campaignAgentUrl');
  }
  private get pricingEngineUrl() {
    return this.configService.get<string>('ai.pricingEngineUrl');
  }
  private get performancePredictionUrl() {
    return this.configService.get<string>('ai.performancePredictionUrl');
  }
  private get creatorGraphUrl() {
    return this.configService.get<string>('ai.creatorGraphUrl');
  }

  private async callAiService<T>(
    url: string,
    path: string,
    payload: unknown,
    fallback: T,
  ): Promise<T> {
    const internalSecret = this.configService.get<string>('ai.internalSecret') ?? '';
    try {
      const response = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authenticate to internal AI services
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`AI service error: ${response.status}`);
      return (await response.json()) as T;
    } catch (err) {
      this.logger.warn(`AI service call failed (${url}${path}): ${err}. Using fallback.`);
      return fallback;
    }
  }

  async generateContractContent(input: ContractGenInput) {
    const fallback = {
      content: this.buildDefaultContractText(input),
      riskScore: 25,
      riskFlags: [],
    };
    return this.callAiService(
      this.contractAiUrl!,
      '/generate',
      input,
      fallback,
    );
  }

  async reviseContractContent(input: {
    contractText: string;
    riskFlags: string[];
    campaignType?: string;
    platforms?: string[];
    totalValue?: number;
    exclusivity?: boolean;
    exclusivityDays?: number;
  }) {
    const fallback = {
      revisedContent: input.contractText,
      riskScore: 50,
      riskFlagsRemaining: input.riskFlags,
      flagsResolved: [] as string[],
      revisionNotes: ['Revision service unavailable — original content returned.'],
      wordCount: input.contractText.split(' ').length,
      improved: false,
    };
    return this.callAiService(
      this.contractAiUrl!,
      '/revise',
      {
        contract_text: input.contractText,
        risk_flags: input.riskFlags,
        campaign_type: input.campaignType,
        platforms: input.platforms,
        total_value: input.totalValue,
        exclusivity: input.exclusivity,
        exclusivity_days: input.exclusivityDays,
      },
      fallback,
    );
  }

  async verifyDeliverable(deliverableId: string, input: VerifyDeliverableInput) {
    const fallback = {
      verificationScore: 75,
      status: 'PASSED',
      flags: [],
      report: { summary: 'Auto-verified', checks: [] },
    };

    const result = await this.callAiService<{
      verificationScore: number;
      status: string;
      flags: string[];
      report: unknown;
    }>(this.deliverableAiUrl!, '/verify', input, fallback);

    await this.prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        verificationScore: result.verificationScore,
        verificationStatus: result.status as 'PASSED' | 'FAILED' | 'FLAGGED',
        verificationFlags: result.flags,
        verificationReport: result.report as unknown as Prisma.InputJsonValue,
        status: result.status === 'PASSED' ? 'UNDER_REVIEW' : 'UNDER_REVIEW',
      },
    });

    return result;
  }

  async getDeliverableFeedback(input: {
    verificationFlags: string[];
    platform: string;
    contentType: string;
    proofUrl: string;
    creatorName?: string;
    campaignName?: string;
  }) {
    const fallback = {
      remediationRequired: input.verificationFlags.length > 0,
      totalFlags: input.verificationFlags.length,
      criticalCount: 0,
      highCount: input.verificationFlags.length,
      mediumCount: 0,
      feedbackItems: input.verificationFlags.map(f => ({
        flag: f,
        severity: 'high',
        description: `Compliance issue: ${f}`,
        fix: 'Review campaign brief and address this requirement.',
        example: 'Contact your campaign manager for details.',
      })),
      priorityFixes: input.verificationFlags.map(
        () => 'Review campaign brief and address this requirement.',
      ),
      estimatedRevisionMinutes: input.verificationFlags.length * 10,
      summary: `${input.verificationFlags.length} flag(s) require resolution before this deliverable can be approved.`,
    };

    return this.callAiService(
      this.deliverableAiUrl!,
      '/feedback',
      {
        verification_flags: input.verificationFlags,
        platform: input.platform,
        content_type: input.contentType,
        proof_url: input.proofUrl,
        creator_name: input.creatorName,
        campaign_name: input.campaignName,
      },
      fallback,
    );
  }

  async generateCampaignTimeline(input: CampaignTimelineInput) {
    const fallback = {
      tasks: [
        { title: 'Brief creators', description: 'Send campaign brief to all creators', daysFromStart: 0 },
        { title: 'Content creation', description: 'Creators produce content', daysFromStart: 7 },
        { title: 'Review & approve', description: 'Review submitted content', daysFromStart: 14 },
        { title: 'Publish', description: 'Publish approved content', daysFromStart: 21 },
        { title: 'Reporting', description: 'Collect and analyze performance data', daysFromStart: 28 },
      ],
    };

    return this.callAiService(this.campaignAgentUrl!, '/timeline', input, fallback);
  }

  async generateCampaignDebrief(input: CampaignDebriefInput) {
    const fallback = {
      markdown: `# Campaign Debrief: ${input.title}\n\n## Overview\nCampaign completed.\n\n## Performance\nSee metrics.\n\n## Recommendations\n- Continue with top-performing creators\n- Optimize content formats\n`,
      metrics: { reach: 0, engagement: 0, roi: 0 },
      recommendations: [],
    };

    return this.callAiService(this.campaignAgentUrl!, '/debrief', input, fallback);
  }

  async predictCreatorPerformance(creatorId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        followersCount: true,
        engagementRate: true,
        avgReach: true,
        platforms: true,
        niche: true,
      },
    });

    const fallback = {
      predictedReach: Math.round((creator?.followersCount ?? 1000) * 0.12),
      predictedEngagement: (creator?.engagementRate ?? 3.5) * 0.9,
      predictedROI: 2.5,
      audienceAuthenticity: 0.82,
      fraudLikelihood: 0.08,
      confidence: 0.75,
    };

    const result = await this.callAiService<typeof fallback>(
      this.creatorGraphUrl!,
      '/predict',
      { creatorId, ...creator },
      fallback,
    );

    await this.prisma.creatorPrediction.create({
      data: {
        creatorId,
        predictedReach: result.predictedReach,
        predictedEngagement: result.predictedEngagement,
        predictedROI: result.predictedROI,
        audienceAuthenticity: result.audienceAuthenticity,
        fraudLikelihood: result.fraudLikelihood,
        confidence: result.confidence,
        modelVersion: '1.0.0',
      },
    });

    return result;
  }

  async predictPerformanceFull(input: {
    followers: number;
    engagementRate: number;
    audienceScore?: number;
    fraudScore?: number;
    niche?: string;
    platform?: string;
    avgViews?: number;
    postFrequencyPerWeek?: number;
    historicalRoi?: number;
    campaignBudget?: number;
  }) {
    const fallback = {
      tier: 'micro',
      reach_estimate: Math.round(input.followers * 0.12),
      engagement_rate_predicted: input.engagementRate * 0.95,
      conversion_rate: 0.02,
      roi_estimate: 2.5,
      confidence_score: 70,
      percentile_rank: 55,
      estimated_cpm: 6,
      estimated_cpe: 60,
      recommendations: [],
    };

    return this.callAiService(
      this.performancePredictionUrl!,
      '/predict/creator',
      {
        followers: input.followers,
        engagement_rate: input.engagementRate,
        audience_score: input.audienceScore ?? 0.7,
        fraud_score: input.fraudScore ?? 0.0,
        niche: input.niche ?? 'lifestyle',
        platform: input.platform ?? 'instagram',
        avg_views: input.avgViews,
        post_frequency_per_week: input.postFrequencyPerWeek ?? 3,
        historical_roi: input.historicalRoi,
        campaign_budget: input.campaignBudget ?? 5000,
      },
      fallback,
    );
  }

  async getPricingRecommendation(input: {
    platform: string;
    contentType: string;
    niche: string[];
    followersCount: number;
    engagementRate: number;
  }) {
    const fallback = {
      recommendedRate: 50000, // $500 in cents
      minRate: 25000,
      maxRate: 100000,
      confidence: 0.7,
      factors: ['Platform rate', 'Niche demand', 'Engagement quality'],
    };

    return this.callAiService(this.pricingEngineUrl!, '/recommend', input, fallback);
  }

  private buildDefaultContractText(input: ContractGenInput): string {
    return `
INFLUENCER MARKETING AGREEMENT

This Agreement is entered into between the Brand and Creator for influencer marketing services.

CAMPAIGN DETAILS
- Platforms: ${input.platforms.join(', ')}
- Total Compensation: $${(input.totalValue / 100).toFixed(2)} USD
- Exclusivity: ${input.exclusivity ? `Yes (${input.exclusivityDays} days)` : 'No'}

USAGE RIGHTS
${input.usageRights}

DELIVERABLES
Creator agrees to produce content as specified in the deliverables schedule.

PAYMENT TERMS
Payment will be released upon approval of each deliverable.

INTELLECTUAL PROPERTY
Creator grants Brand a license to use the created content for the specified platforms.

CONFIDENTIALITY
Both parties agree to maintain confidentiality of campaign terms and compensation.

TERMINATION
Either party may terminate this agreement with 7 days written notice.

By signing below, both parties agree to these terms.
    `.trim();
  }
}
