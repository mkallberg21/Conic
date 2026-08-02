import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { AnthropicService, ParsedSearch } from '../../common/llm/anthropic.service';

const parsed = (over: Partial<ParsedSearch> = {}): ParsedSearch => ({
  entityType: 'both', niche: [], platforms: [], minFollowers: null, maxFollowers: null,
  minEngagement: null, budgetCents: null, sport: null, contentStyle: [], aestheticTags: [],
  languages: [], locations: [], audienceAgeRange: null, audienceGender: null,
  semanticQuery: 'luxury fashion creators', ...over,
});

const mockPrisma = {
  creator: { findMany: jest.fn() },
  athlete: { findMany: jest.fn() },
  embeddingRecord: { findMany: jest.fn() },
};
const mockEmbeddings = {
  embed: jest.fn().mockResolvedValue([1, 0, 0]),
  similarity: jest.fn().mockReturnValue(0.5),
};
const mockAnthropic = {
  parseSearchQuery: jest.fn(),
  explainMatches: jest.fn().mockResolvedValue({}),
};

const creatorRow = (id: string, perf: number) => ({
  id, niche: ['fashion'], contentStyle: ['luxury'], followersCount: 10000, engagementRate: 0.05,
  performanceScore: perf, audienceScore: 80, fraudScore: 10, isVerified: true,
  user: { firstName: 'Jane', lastName: 'Doe', avatarUrl: null },
});

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmbeddingsService, useValue: mockEmbeddings },
        { provide: AnthropicService, useValue: mockAnthropic },
      ],
    }).compile();
    service = module.get<DiscoveryService>(DiscoveryService);
    jest.clearAllMocks();
    mockAnthropic.parseSearchQuery.mockResolvedValue(parsed());
    mockAnthropic.explainMatches.mockResolvedValue({});
    mockPrisma.creator.findMany.mockResolvedValue([]);
    mockPrisma.athlete.findMany.mockResolvedValue([]);
    mockPrisma.embeddingRecord.findMany.mockResolvedValue([]);
  });

  it('ranks candidates by blended match score (higher performance ranks first)', async () => {
    mockPrisma.creator.findMany.mockResolvedValue([creatorRow('cr_low', 20), creatorRow('cr_high', 95)]);
    mockEmbeddings.similarity.mockReturnValue(0.5); // equal semantic → performance breaks the tie

    const { results } = await service.search({ query: 'luxury fashion' });

    expect(results.map((r) => r.id)).toEqual(['cr_high', 'cr_low']);
    expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
  });

  it('never exposes contact fields (email / social handles) in results', async () => {
    mockPrisma.creator.findMany.mockResolvedValue([creatorRow('cr_1', 80)]);
    const { results } = await service.search({ query: 'fashion' });
    const keys = Object.keys(results[0]);
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('handle');
    expect(keys).not.toContain('platforms');
    expect(keys).toContain('matchScore');
  });

  it('restricts to creators when entityType=creator (athletes not queried)', async () => {
    mockPrisma.creator.findMany.mockResolvedValue([creatorRow('cr_1', 80)]);
    await service.search({ query: 'x', entityType: 'creator' });
    expect(mockPrisma.creator.findMany).toHaveBeenCalled();
    expect(mockPrisma.athlete.findMany).not.toHaveBeenCalled();
  });

  it('passes parsed structured filters into the creator query', async () => {
    mockAnthropic.parseSearchQuery.mockResolvedValue(parsed({ niche: ['fitness'], minFollowers: 5000 }));
    mockPrisma.creator.findMany.mockResolvedValue([]);
    await service.search({ query: 'fit creators over 5k' });
    expect(mockPrisma.creator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ niche: { hasSome: ['fitness'] }, followersCount: { gte: 5000 } }),
      }),
    );
  });

  it('applies Claude match reasoning to the returned page', async () => {
    mockPrisma.creator.findMany.mockResolvedValue([creatorRow('cr_1', 80)]);
    mockAnthropic.explainMatches.mockResolvedValue({ cr_1: 'Great luxury aesthetic fit.' });
    const { results } = await service.search({ query: 'luxury' });
    expect(results[0].reason).toBe('Great luxury aesthetic fit.');
  });
});
