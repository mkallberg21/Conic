'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Shield, TrendingUp, Star, RefreshCw, Instagram, Youtube, Twitter,
  BarChart2, DollarSign, Users, Activity, AlertTriangle
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

function ScoreArc({ value, label, color }: { value: number; label: string; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 40;
  const circumference = Math.PI * radius; // semicircle
  const fill = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${fill} ${circumference}`}
          strokeLinecap="round"
        />
        <text x="50" y="52" textAnchor="middle" className="text-xs font-bold" fill="currentColor" fontSize="14">
          {clamped}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
};

export default function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: creator, isLoading } = useQuery({
    queryKey: ['creator', id],
    queryFn: () => api.get(`/v1/creators/${id}`).then((r) => r.data.data),
  });

  const scoreMutation = useMutation({
    mutationFn: () => api.post(`/v1/creators/${id}/score`),
    onSuccess: () => {
      toast({ title: 'Scoring queued', description: 'AI scores will update in a few seconds.' });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['creator', id] }), 5000);
    },
    onError: () => toast({ title: 'Error', description: 'Could not queue scoring.', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-xl bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!creator) return <div className="text-center py-20 text-muted-foreground">Creator not found.</div>;

  const name = creator.user ? `${creator.user.firstName} ${creator.user.lastName}` : creator.handle;
  const predictions = creator.predictions ?? [];
  const latest = predictions[0];

  const radarData = [
    { subject: 'Perf.', A: creator.performanceScore ?? 0 },
    { subject: 'Audience', A: creator.audienceScore ?? 0 },
    { subject: 'Trust', A: 100 - (creator.fraudScore ?? 100) },
    { subject: 'Influence', A: Math.min(100, (creator.graphNode?.influenceScore ?? 0) * 100) },
    { subject: 'Engagement', A: Math.min(100, (creator.engagementRate ?? 0) * 5) },
  ];

  const predictionHistory = predictions.slice(0, 10).reverse().map((p: Record<string, unknown>, i: number) => ({
    index: i + 1,
    roi: p.predictedRoi,
    reach: p.predictedReach,
  }));

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Hero card */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
              <AvatarImage src={creator.user?.avatarUrl} />
              <AvatarFallback className="text-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">@{creator.handle}</h1>
                {creator.isVerified && (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3 text-blue-500" /> Verified
                  </Badge>
                )}
                {creator.graphNode?.trending && (
                  <Badge variant="secondary" className="gap-1 bg-pink-50 text-pink-700 border-pink-200">
                    <TrendingUp className="h-3 w-3" /> Trending
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">{creator.pricingTier ?? 'Unclassified'}</Badge>
              </div>

              <p className="text-muted-foreground text-sm">{name}</p>

              <div className="flex flex-wrap gap-1.5 mt-1">
                {creator.niche?.map((n: string) => (
                  <Badge key={n} variant="secondary" className="text-xs capitalize">{n}</Badge>
                ))}
              </div>

              {creator.bio && <p className="text-sm text-muted-foreground max-w-lg">{creator.bio}</p>}

              <div className="flex gap-3 pt-1">
                {creator.platforms?.map((p: string) => (
                  <span key={p} className="text-muted-foreground" title={p}>
                    {PLATFORM_ICONS[p] ?? <Activity className="h-4 w-4" />}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" className="gap-2">
                <Star className="h-4 w-4" /> Invite to Campaign
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending}>
                <RefreshCw className={cn('h-4 w-4', scoreMutation.isPending && 'animate-spin')} />
                Refresh AI Score
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Followers</p>
              <p className="text-xl font-bold">{creator.followersCount?.toLocaleString() ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2"><Activity className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Engagement</p>
              <p className="text-xl font-bold">{creator.engagementRate != null ? `${creator.engagementRate.toFixed(1)}%` : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2"><BarChart2 className="h-5 w-5 text-violet-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Predicted ROI</p>
              <p className="text-xl font-bold">{latest?.predictedRoi != null ? `${latest.predictedRoi.toFixed(1)}x` : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><DollarSign className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Predicted Reach</p>
              <p className="text-xl font-bold">{latest?.predictedReach != null ? `${(latest.predictedReach / 1000).toFixed(0)}K` : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">AI Scores</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="ratecard">Rate Card</TabsTrigger>
          <TabsTrigger value="graph">Graph Position</TabsTrigger>
        </TabsList>

        {/* AI Scores */}
        <TabsContent value="scores" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Score Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-around gap-4">
                  <ScoreArc value={creator.performanceScore ?? 0} label="Performance" color="#6366f1" />
                  <ScoreArc value={creator.audienceScore ?? 0} label="Audience" color="#22c55e" />
                  <ScoreArc value={100 - (creator.fraudScore ?? 100)} label="Trust" color="#f59e0b" />
                </div>
                {creator.fraudScore != null && creator.fraudScore > 50 && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-rose-700 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    High fraud risk detected. Review carefully before contracting.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Radar View</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Predictions History */}
        <TabsContent value="predictions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">AI Prediction History</CardTitle>
                {latest && (
                  <Badge variant="outline" className="text-xs">
                    Confidence: {Math.round((latest.confidence ?? 0) * 100)}%
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {predictionHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={predictionHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="roi" stroke="#6366f1" name="ROI (x)" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="reach" stroke="#22c55e" name="Reach" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12 text-sm">No predictions yet. Click "Refresh AI Score" to generate one.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate Card */}
        <TabsContent value="ratecard" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Rate Card</CardTitle></CardHeader>
            <CardContent>
              {creator.rateCardJson ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(creator.rateCardJson as Record<string, number>).map(([format, price]) => (
                    <div key={format} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium capitalize">{format.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-bold text-emerald-600">${price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12 text-sm">No rate card set. Creator must update their profile.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Graph Position */}
        <TabsContent value="graph" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Creator Graph Position</CardTitle></CardHeader>
            <CardContent>
              {creator.graphNode ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Cluster</p>
                    <p className="font-semibold">{creator.graphNode.clusterLabel ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Influence Score</p>
                    <p className="font-semibold">{creator.graphNode.influenceScore?.toFixed(3) ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Centrality</p>
                    <p className="font-semibold">{creator.graphNode.centrality?.toFixed(3) ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Bot Network Score</p>
                    <p className={cn('font-semibold', (creator.graphNode.botNetworkScore ?? 0) > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>
                      {creator.graphNode.botNetworkScore?.toFixed(3) ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Trending</p>
                    <p className="font-semibold">{creator.graphNode.trending ? '🔥 Yes' : 'No'}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Last Analyzed</p>
                    <p className="font-semibold text-sm">{creator.graphNode.lastAnalyzedAt ? formatDate(creator.graphNode.lastAnalyzedAt) : '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12 text-sm">Not yet mapped in creator graph.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
