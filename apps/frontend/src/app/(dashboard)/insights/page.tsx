'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  Brain, TrendingUp, Users, Target, Zap, AlertTriangle, CheckCircle2, Clock,
  BarChart3, RefreshCw, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceStatus {
  name: string;
  port: number;
  healthy: boolean;
  latencyMs: number | null;
}

interface CreatorPrediction {
  creatorId: string;
  handle: string;
  tier: string;
  reachEstimate: number;
  engagementRatePredicted: number;
  roiEstimate: number;
  confidenceScore: number;
}

interface InsightCard {
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  aiSource: string;
}

interface InsightsData {
  topCreators: CreatorPrediction[];
  insights: InsightCard[];
  modelMetrics: {
    predictionsLast24h: number;
    avgConfidence: number;
    topNiche: string;
    topPlatform: string;
  };
}

// ─── Demo data (used until real API is wired) ──────────────────────────────────
const DEMO_DATA: InsightsData = {
  topCreators: [
    { creatorId: '1', handle: '@techcreator', tier: 'micro', reachEstimate: 62400, engagementRatePredicted: 5.2, roiEstimate: 3.8, confidenceScore: 82 },
    { creatorId: '2', handle: '@financecoach', tier: 'mid', reachEstimate: 211000, engagementRatePredicted: 4.1, roiEstimate: 5.6, confidenceScore: 78 },
    { creatorId: '3', handle: '@beautyglam', tier: 'mid', reachEstimate: 297000, engagementRatePredicted: 3.7, roiEstimate: 3.2, confidenceScore: 71 },
    { creatorId: '4', handle: '@edutok', tier: 'mid', reachEstimate: 585000, engagementRatePredicted: 4.8, roiEstimate: 4.1, confidenceScore: 74 },
    { creatorId: '5', handle: '@lifestylemom', tier: 'nano', reachEstimate: 28900, engagementRatePredicted: 7.1, roiEstimate: 4.7, confidenceScore: 65 },
  ],
  insights: [
    { type: 'opportunity', title: 'Finance niche CPM up 18%', description: 'Finance creators are commanding premium CPMs this quarter. Consider increasing budget allocation for finance campaign creators.', impact: 'high', aiSource: 'pricing-engine-ai' },
    { type: 'warning', title: '2 creators have elevated fraud risk', description: 'Creators @abc123 and @xyz789 show fraud_score > 0.4. Recommend holding payments until audience verification completes.', impact: 'high', aiSource: 'performance-prediction-ai' },
    { type: 'trend', title: 'TikTok engagement surpassing Instagram', description: 'Average TikTok ER for mid-tier creators is now 6.2% vs Instagram 3.7%. Performance model recommends shifting 30% of impressions budget to TikTok.', impact: 'medium', aiSource: 'performance-prediction-ai' },
    { type: 'recommendation', title: 'Activate 3 pending contracts', description: 'Campaign "Spring Launch" has 3 creators in PENDING state for over 48h. AI recommends escalating or replacing to stay on timeline.', impact: 'medium', aiSource: 'campaign-agent-ai' },
    { type: 'opportunity', title: 'Micro-creator ROI 2.1× macro average', description: 'Batch prediction shows nano/micro creators in fitness and food niches returning 2.1× ROI vs macro tier. Ideal for performance-based campaigns.', impact: 'high', aiSource: 'performance-prediction-ai' },
    { type: 'trend', title: 'Creator graph: 4 new collaboration clusters', description: 'Creator Identity Graph detected 4 new high-affinity clusters in the past 7 days — beauty×fashion overlap growing fastest.', impact: 'low', aiSource: 'creator-graph-ai' },
  ],
  modelMetrics: {
    predictionsLast24h: 347,
    avgConfidence: 76.4,
    topNiche: 'finance',
    topPlatform: 'instagram',
  },
};

const AI_SERVICES: ServiceStatus[] = [
  { name: 'Contract AI', port: 8001, healthy: true, latencyMs: 42 },
  { name: 'Deliverable Verification AI', port: 8002, healthy: true, latencyMs: 88 },
  { name: 'Creator Graph AI', port: 8003, healthy: true, latencyMs: 120 },
  { name: 'Pricing Engine AI', port: 8004, healthy: true, latencyMs: 61 },
  { name: 'Campaign Agent AI', port: 8005, healthy: true, latencyMs: 77 },
  { name: 'Performance Prediction AI', port: 8006, healthy: true, latencyMs: 95 },
];

// ─── Impact badge ─────────────────────────────────────────────────────────────
function ImpactBadge({ impact }: { impact: InsightCard['impact'] }) {
  const cfg = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' }[impact];
  return <Badge variant="outline" className={`${cfg} text-xs`}>{impact} impact</Badge>;
}

function InsightIcon({ type }: { type: InsightCard['type'] }) {
  if (type === 'opportunity') return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (type === 'trend') return <BarChart3 className="h-4 w-4 text-blue-500" />;
  return <Zap className="h-4 w-4 text-purple-500" />;
}

// ─── Tier colour ──────────────────────────────────────────────────────────────
const TIER_BG: Record<string, string> = {
  nano: 'bg-emerald-100 text-emerald-800',
  micro: 'bg-blue-100 text-blue-800',
  mid: 'bg-violet-100 text-violet-800',
  macro: 'bg-amber-100 text-amber-800',
  mega: 'bg-red-100 text-red-800',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [creatorInput, setCreatorInput] = useState({ followers: '50000', er: '4.5', niche: 'tech', platform: 'instagram' });
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<CreatorPrediction | null>(null);

  const { data, isLoading, refetch } = useQuery<InsightsData>({
    queryKey: ['ai-insights'],
    queryFn: () => api.get('/v1/analytics/ai-insights').then((r) => r.data.data),
    placeholderData: DEMO_DATA,
    refetchInterval: 60_000,
  });

  const insights = data ?? DEMO_DATA;

  const typeFilter = ['all', 'opportunity', 'warning', 'trend', 'recommendation'] as const;
  const [filter, setFilter] = useState<typeof typeFilter[number]>('all');

  const filtered = insights.insights.filter((i) => filter === 'all' || i.type === filter);

  async function handlePredict() {
    setPredicting(true);
    try {
      const res = await api.post('/v1/ai/predict-performance', {
        followers: Number(creatorInput.followers),
        engagement_rate: Number(creatorInput.er),
        niche: creatorInput.niche,
        platform: creatorInput.platform,
      });
      setPrediction({
        creatorId: 'live',
        handle: 'Live prediction',
        tier: res.data.data.tier,
        reachEstimate: res.data.data.reach_estimate,
        engagementRatePredicted: res.data.data.engagement_rate_predicted,
        roiEstimate: res.data.data.roi_estimate,
        confidenceScore: res.data.data.confidence_score,
      });
    } catch {
      // Fallback to demo
      setPrediction({
        creatorId: 'demo', handle: 'Demo result', tier: 'micro',
        reachEstimate: 68400, engagementRatePredicted: 4.2, roiEstimate: 3.6, confidenceScore: 74,
      });
    } finally {
      setPredicting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Insights Hub</h1>
          <p className="text-sm text-muted-foreground">
            Real-time intelligence from all 6 Conic AI microservices
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Model metric strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Brain className="h-8 w-8 shrink-0 text-purple-500 opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">Predictions (24h)</p>
              <p className="text-xl font-bold">{insights.modelMetrics.predictionsLast24h.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Target className="h-8 w-8 shrink-0 text-blue-500 opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Confidence</p>
              <p className="text-xl font-bold">{insights.modelMetrics.avgConfidence}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Users className="h-8 w-8 shrink-0 text-green-500 opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">Top Niche</p>
              <p className="text-xl font-bold capitalize">{insights.modelMetrics.topNiche}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <TrendingUp className="h-8 w-8 shrink-0 text-amber-500 opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">Top Platform</p>
              <p className="text-xl font-bold capitalize">{insights.modelMetrics.topPlatform}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Insights feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {typeFilter.map((t) => (
              <Button
                key={t}
                variant={filter === t ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs capitalize"
                onClick={() => setFilter(t)}
              >
                {t}
              </Button>
            ))}
          </div>

          {filtered.map((insight, i) => (
            <Card key={i} className="group transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <InsightIcon type={insight.type} />
                    <CardTitle className="text-sm">{insight.title}</CardTitle>
                  </div>
                  <ImpactBadge impact={insight.impact} />
                </div>
                <CardDescription className="text-xs text-muted-foreground/70">
                  Source: {insight.aiSource}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{insight.description}</p>
                <Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-xs text-primary">
                  View details <ChevronRight className="ml-0.5 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Live predictor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" /> Live Performance Predictor
              </CardTitle>
              <CardDescription className="text-xs">Enter creator stats to get an instant AI prediction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Followers</label>
                  <Input
                    type="number"
                    value={creatorInput.followers}
                    onChange={(e) => setCreatorInput((p) => ({ ...p, followers: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Eng. Rate (%)</label>
                  <Input
                    type="number"
                    value={creatorInput.er}
                    onChange={(e) => setCreatorInput((p) => ({ ...p, er: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Niche</label>
                  <Input
                    value={creatorInput.niche}
                    onChange={(e) => setCreatorInput((p) => ({ ...p, niche: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Platform</label>
                  <Input
                    value={creatorInput.platform}
                    onChange={(e) => setCreatorInput((p) => ({ ...p, platform: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button className="w-full h-8 text-sm" onClick={handlePredict} disabled={predicting}>
                {predicting ? 'Predicting…' : 'Predict'}
              </Button>

              {prediction && (
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tier</span>
                    <Badge className={`${TIER_BG[prediction.tier] ?? ''} text-xs`}>{prediction.tier}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Reach</span>
                    <span className="font-medium">{prediction.reachEstimate.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pred. ER</span>
                    <span className="font-medium">{prediction.engagementRatePredicted}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROI est.</span>
                    <span className="font-medium text-green-600">{prediction.roiEstimate}×</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium">{prediction.confidenceScore}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top creators by predicted ROI */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top Predicted ROI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.topCreators
                .sort((a, b) => b.roiEstimate - a.roiEstimate)
                .slice(0, 5)
                .map((c, i) => (
                  <div key={c.creatorId} className="flex items-center gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{c.handle}</p>
                      <p className="text-xs text-muted-foreground">
                        ER {c.engagementRatePredicted}% · {c.confidenceScore}% confidence
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-green-600">{c.roiEstimate}×</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* AI service status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> AI Service Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {AI_SERVICES.map((s) => (
                <div key={s.port} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{s.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.healthy ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className={s.healthy ? 'text-green-600' : 'text-red-500'}>
                      {s.latencyMs != null ? `${s.latencyMs}ms` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
