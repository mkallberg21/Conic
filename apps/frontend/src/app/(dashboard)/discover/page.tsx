'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { Search, TrendingUp, Shield, Star, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { AiSearchPanel } from './ai-search-panel';

const NICHES = ['fashion', 'beauty', 'fitness', 'food', 'travel', 'tech', 'gaming', 'lifestyle', 'parenting', 'finance', 'music', 'sports'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
const PRICING_TIERS = ['NANO', 'MICRO', 'MID', 'MACRO', 'MEGA'];

interface Creator {
  id: string;
  handle: string;
  bio?: string;
  niche: string[];
  platforms: string[];
  followersCount: number;
  engagementRate: number;
  performanceScore?: number;
  audienceScore?: number;
  fraudScore?: number;
  pricingTier?: string;
  isVerified?: boolean;
  user?: { firstName: string; lastName: string; avatarUrl?: string };
  graphNode?: { trending: boolean; influenceScore: number };
  predictions?: { predictedRoi: number; confidence: number }[];
}

function ScoreBadge({ value, inverted = false, label }: { value?: number; inverted?: boolean; label: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const good = inverted ? value < 30 : value >= 70;
  const mid = inverted ? value < 60 : value >= 40;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-sm font-bold', good ? 'text-emerald-600' : mid ? 'text-amber-600' : 'text-rose-600')}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function CreatorCard({ creator, onSelect }: { creator: Creator; onSelect: () => void }) {
  const handle = creator.handle ?? '—';
  const name = creator.user ? `${creator.user.firstName} ${creator.user.lastName}` : handle;
  const roi = creator.predictions?.[0]?.predictedRoi;
  const confidence = creator.predictions?.[0]?.confidence;

  return (
    <Card className="group cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={onSelect}>
      <CardContent className="p-0">
        {/* Top accent bar */}
        <div
          className={cn('h-1.5 w-full', creator.graphNode?.trending ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-gradient-to-r from-primary/50 to-primary')}
        />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={creator.user?.avatarUrl} />
                <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm">@{handle}</p>
                  {creator.isVerified && <Shield className="h-3 w-3 text-blue-500" />}
                  {creator.graphNode?.trending && <TrendingUp className="h-3 w-3 text-pink-500" />}
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{name}</p>
              </div>
            </div>
            {creator.pricingTier && (
              <Badge variant="outline" className="text-[10px] shrink-0">{creator.pricingTier}</Badge>
            )}
          </div>

          {/* Niche tags */}
          <div className="flex flex-wrap gap-1">
            {creator.niche?.slice(0, 3).map((n) => (
              <Badge key={n} variant="secondary" className="text-[10px] py-0">{n}</Badge>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex justify-between text-center border rounded-lg py-2 px-3">
            <div>
              <p className="text-sm font-semibold">{creator.followersCount?.toLocaleString() ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">Followers</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <p className="text-sm font-semibold">{creator.engagementRate != null ? `${creator.engagementRate.toFixed(1)}%` : '—'}</p>
              <p className="text-[10px] text-muted-foreground">Engagement</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            {roi != null ? (
              <div>
                <p className="text-sm font-semibold text-emerald-600">{roi.toFixed(1)}x</p>
                <p className="text-[10px] text-muted-foreground">Pred. ROI</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">Pred. ROI</p>
              </div>
            )}
          </div>

          {/* AI Scores */}
          <div className="flex justify-around pt-1">
            <ScoreBadge value={creator.performanceScore ?? undefined} label="Perf." />
            <Separator orientation="vertical" className="h-8" />
            <ScoreBadge value={creator.audienceScore ?? undefined} label="Audience" />
            <Separator orientation="vertical" className="h-8" />
            <ScoreBadge value={creator.fraudScore ?? undefined} inverted label="Fraud" />
            {confidence != null && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-bold text-violet-600">{Math.round(confidence * 100)}%</span>
                  <span className="text-[10px] text-muted-foreground">Conf.</span>
                </div>
              </>
            )}
          </div>

          <Button size="sm" className="w-full mt-1 group-hover:bg-primary/90">View Profile</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [platform, setPlatform] = useState<string>('');
  const [pricingTier, setPricingTier] = useState<string>('');
  const [followerRange, setFollowerRange] = useState([0, 1000000]);
  const [engagementRange, setEngagementRange] = useState([0, 20]);
  const [minPerformance, setMinPerformance] = useState(0);
  const [maxFraud, setMaxFraud] = useState(100);
  const [isVerified, setIsVerified] = useState(false);
  const [trending, setTrending] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const params: Record<string, unknown> = {
    page,
    take: 12,
    ...(debouncedSearch && { q: debouncedSearch }),
    ...(selectedNiches.length > 0 && { niche: selectedNiches.join(',') }),
    ...(platform && { platform }),
    ...(pricingTier && { pricingTier }),
    ...(followerRange[0] > 0 && { minFollowers: followerRange[0] }),
    ...(followerRange[1] < 1000000 && { maxFollowers: followerRange[1] }),
    ...(engagementRange[0] > 0 && { minEngagement: engagementRange[0] }),
    ...(engagementRange[1] < 20 && { maxEngagement: engagementRange[1] }),
    ...(minPerformance > 0 && { minPerformanceScore: minPerformance }),
    ...(maxFraud < 100 && { maxFraudScore: maxFraud }),
    ...(isVerified && { isVerified: true }),
    ...(trending && { trending: true }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['discover', params],
    queryFn: () => api.get('/v1/creators', { params }).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });

  const creators: Creator[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  const toggleNiche = useCallback((n: string) => {
    setSelectedNiches((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]);
    setPage(1);
  }, []);

  const clearFilters = () => {
    setSearch(''); setSelectedNiches([]); setPlatform(''); setPricingTier('');
    setFollowerRange([0, 1000000]); setEngagementRange([0, 20]);
    setMinPerformance(0); setMaxFraud(100); setIsVerified(false); setTrending(false);
    setPage(1);
  };

  const hasActiveFilters = selectedNiches.length > 0 || platform || pricingTier || followerRange[0] > 0 ||
    followerRange[1] < 1000000 || engagementRange[0] > 0 || engagementRange[1] < 20 ||
    minPerformance > 0 || maxFraud < 100 || isVerified || trending;

  return (
    <div className="space-y-5">
      <AiSearchPanel />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discover Creators</h1>
          <p className="text-muted-foreground text-sm">{total.toLocaleString()} creators match your filters</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Filter Sidebar */}
        {showFilters && (
          <aside className="w-64 shrink-0 space-y-5">
            <Card>
              <CardContent className="p-4 space-y-5">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search creators…" className="pl-8 h-8 text-sm" value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>

                <Separator />

                {/* Platform */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</Label>
                  <Select value={platform} onValueChange={(v) => { setPlatform(v === 'all' ? '' : v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any platform" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any platform</SelectItem>
                      {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Niches */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Niche</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {NICHES.map((n) => (
                      <button key={n} onClick={() => toggleNiche(n)}
                        className={cn('px-2 py-0.5 rounded-full text-xs border transition-colors capitalize',
                          selectedNiches.includes(n) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary')}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pricing Tier */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing tier</Label>
                  <Select value={pricingTier} onValueChange={(v) => { setPricingTier(v === 'all' ? '' : v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any tier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any tier</SelectItem>
                      {PRICING_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Followers */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Followers ({(followerRange[0] / 1000).toFixed(0)}K – {followerRange[1] >= 1000000 ? '1M+' : `${(followerRange[1] / 1000).toFixed(0)}K`})
                  </Label>
                  <Slider min={0} max={1000000} step={10000} value={followerRange}
                    onValueChange={(v) => { setFollowerRange(v); setPage(1); }} className="py-1" />
                </div>

                {/* Engagement */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Engagement ({engagementRange[0].toFixed(1)}% – {engagementRange[1].toFixed(1)}%)
                  </Label>
                  <Slider min={0} max={20} step={0.5} value={engagementRange}
                    onValueChange={(v) => { setEngagementRange(v); setPage(1); }} className="py-1" />
                </div>

                {/* Performance Score */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Min Performance ({minPerformance})
                  </Label>
                  <Slider min={0} max={100} step={5} value={[minPerformance]}
                    onValueChange={([v]) => { setMinPerformance(v); setPage(1); }} className="py-1" />
                </div>

                {/* Fraud Score */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Max Fraud Score ({maxFraud})
                  </Label>
                  <Slider min={0} max={100} step={5} value={[maxFraud]}
                    onValueChange={([v]) => { setMaxFraud(v); setPage(1); }} className="py-1" />
                </div>

                <Separator />

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="verified" className="text-sm cursor-pointer">Verified only</Label>
                    <Switch id="verified" checked={isVerified} onCheckedChange={(v) => { setIsVerified(v); setPage(1); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="trending" className="text-sm cursor-pointer flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-pink-500" /> Trending
                    </Label>
                    <Switch id="trending" checked={trending} onCheckedChange={(v) => { setTrending(v); setPage(1); }} />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> Clear all filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>
        )}

        {/* Main Grid */}
        <div className="flex-1 space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : creators.length === 0 ? (
            <Card className="flex items-center justify-center h-64">
              <div className="text-center space-y-2">
                <Star className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-semibold">No creators match</p>
                <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            </Card>
          ) : (
            <>
              <div className={cn('grid gap-4', showFilters ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
                {creators.map((c) => (
                  <CreatorCard key={c.id} creator={c} onSelect={() => router.push(`/creators/${c.id}`)} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total.toLocaleString()} results
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
