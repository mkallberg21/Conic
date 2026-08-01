'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Search, ShieldCheck, Lock, TrendingUp } from 'lucide-react';

interface DiscoveryResult {
  id: string;
  type: 'creator' | 'athlete';
  displayName: string;
  avatarUrl: string | null;
  headline: string;
  followersCount: number;
  engagementRate: number;
  performanceScore: number;
  fraudScore: number;
  contentStyle: string[];
  isVerified: boolean;
  matchScore: number;
  reason: string;
}

const EXAMPLES = [
  'Micro fitness creators on TikTok with an authentic Gen-Z audience, budget $2k',
  'Luxury fashion athletes in basketball with high engagement',
  'Family-friendly food influencers, 50k-500k followers, minimalist style',
];

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;
}

export function AiSearchPanel() {
  const [query, setQuery] = useState('');
  const search = useMutation({
    mutationFn: (q: string) =>
      api.post('/v1/discovery/search', { query: q }).then((r) => r.data.data as { results: DiscoveryResult[] }),
  });

  const run = (q: string) => { if (q.trim()) { setQuery(q); search.mutate(q); } };
  const results = search.data?.results ?? [];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Describe who you&apos;re looking for</h2>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); run(query); }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. authentic outdoorsy creators for a hiking-gear launch, 20k-200k followers"
          />
          <Button type="submit" disabled={search.isPending || !query.trim()}>
            <Search className="mr-1 h-4 w-4" />{search.isPending ? 'Searching…' : 'Search'}
          </Button>
        </form>

        {!search.data && !search.isPending && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => run(ex)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">
                {ex}
              </button>
            ))}
          </div>
        )}

        {search.isError && <p className="text-sm text-destructive">Search failed. Please try again.</p>}

        {results.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((r) => (
              <div key={r.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.avatarUrl ?? undefined} />
                    <AvatarFallback>{r.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{r.displayName}</span>
                      {r.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
                      <Badge variant="outline" className="ml-auto shrink-0">{r.matchScore}% match</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.type} • {r.headline}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm">{r.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{fmt(r.followersCount)} followers</span>
                  <span>{(r.engagementRate * 100).toFixed(1)}% eng.</span>
                  {r.contentStyle.slice(0, 2).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                  <Lock className="h-3 w-3" /> Contact details unlock when you start a deal.
                </div>
              </div>
            ))}
          </div>
        )}
        {search.data && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No matches yet — try describing the audience, niche, or vibe differently.</p>
        )}
      </CardContent>
    </Card>
  );
}
