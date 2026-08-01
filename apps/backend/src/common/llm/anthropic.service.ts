import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ParsedSearch {
  entityType: 'creator' | 'athlete' | 'both';
  niche: string[];
  platforms: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagement: number | null;
  budgetCents: number | null;
  sport: string | null;
  contentStyle: string[];
  aestheticTags: string[];
  languages: string[];
  locations: string[];
  audienceAgeRange: string | null;
  audienceGender: string | null;
  semanticQuery: string;
}

const EMPTY_PARSE = (query: string): ParsedSearch => ({
  entityType: 'both',
  niche: [], platforms: [], minFollowers: null, maxFollowers: null, minEngagement: null,
  budgetCents: null, sport: null, contentStyle: [], aestheticTags: [], languages: [],
  locations: [], audienceAgeRange: null, audienceGender: null, semanticQuery: query,
});

// Guardrail is part of the system prompt, not an afterthought: no filtering by a
// creator/athlete's physical or protected attributes, and athletes may be minors.
const PARSE_SYSTEM = `You convert a brand's natural-language influencer/athlete search into structured filters.
Return ONLY a JSON object (no prose, no markdown) with exactly these keys:
{
  "entityType": "creator" | "athlete" | "both",
  "niche": string[], "platforms": string[],
  "minFollowers": number|null, "maxFollowers": number|null, "minEngagement": number|null,
  "budgetCents": number|null, "sport": string|null,
  "contentStyle": string[], "aestheticTags": string[], "languages": string[], "locations": string[],
  "audienceAgeRange": string|null, "audienceGender": string|null,
  "semanticQuery": string
}
Rules:
- platforms are lowercase (instagram, tiktok, youtube, x, twitch, ...).
- "looks"/vibe requests map to contentStyle/aestheticTags (self-described creator style), NOT to physical or protected attributes.
- NEVER emit filters based on a creator's or athlete's race, ethnicity, body type, exact age, gender, disability, or religion. Demographic targeting is expressed only as *audience* fields (audienceAgeRange/audienceGender = who follows them).
- Athletes may be minors: never emit appearance-based filters for them.
- Convert budget dollars to cents. Convert "10k"/"1M" follower phrasing to integers.
- semanticQuery is a concise phrase capturing the qualitative intent for embedding search.`;

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client?: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ai.anthropicApiKey');
    this.model = this.config.get<string>('ai.anthropicModel', 'claude-opus-5');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — LLM features degrade to embeddings/heuristics.');
    }
  }

  get available(): boolean {
    return !!this.client;
  }

  /** Parse an NL search query into structured filters + a semantic query. Degrades to a no-filter parse. */
  async parseSearchQuery(query: string): Promise<ParsedSearch> {
    if (!this.client) return EMPTY_PARSE(query);
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        output_config: { effort: 'low' },
        system: PARSE_SYSTEM,
        messages: [{ role: 'user', content: query }],
      });
      const text = res.content.find((b) => b.type === 'text')?.text ?? '';
      const json = this.extractJson(text);
      return { ...EMPTY_PARSE(query), ...(json as Partial<ParsedSearch>) };
    } catch (err) {
      this.logger.warn(`parseSearchQuery failed, falling back: ${(err as Error).message}`);
      return EMPTY_PARSE(query);
    }
  }

  /** One short "why this matches" line per candidate. Degrades to a simple heuristic sentence. */
  async explainMatches(
    query: string,
    candidates: Array<{ id: string; summary: string }>,
  ): Promise<Record<string, string>> {
    const fallback = Object.fromEntries(
      candidates.map((c) => [c.id, 'Matches your niche, audience and performance filters.']),
    );
    if (!this.client || candidates.length === 0) return fallback;
    try {
      const list = candidates.map((c, i) => `${i + 1}. [id=${c.id}] ${c.summary}`).join('\n');
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        output_config: { effort: 'low' },
        system:
          'For each candidate, write ONE short sentence (max 20 words) explaining why they fit the brand brief. ' +
          'Return ONLY a JSON object mapping id -> reason. No prose.',
        messages: [{ role: 'user', content: `Brief: ${query}\n\nCandidates:\n${list}` }],
      });
      const text = res.content.find((b) => b.type === 'text')?.text ?? '';
      const json = this.extractJson(text) as Record<string, string> | null;
      return json ? { ...fallback, ...json } : fallback;
    } catch (err) {
      this.logger.warn(`explainMatches failed, falling back: ${(err as Error).message}`);
      return fallback;
    }
  }

  private extractJson(text: string): unknown {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
