'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Store, Users, Star, TrendingUp, Filter } from 'lucide-react';

interface Athlete {
  id: string;
  sport: string;
  position?: string;
  classYear?: string;
  eligibilityStatus: string;
  performanceScore: number;
  fmvMinCents?: number;
  fmvMaxCents?: number;
  isVerified: boolean;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  university?: { name: string; state: string };
}

interface Listing {
  id: string;
  athleteId: string;
  headline: string;
  bio?: string;
  sport: string;
  preferredDealTypes: string[];
  minDealValueCents: number;
  socialFollowersTotal: number;
  engagementRatePct?: number;
  verifiedByPlatform: boolean;
  viewCount: number;
  athlete: Athlete;
}

interface SearchResult {
  data: Listing[];
  meta: { total: number; page: number; limit: number; pageCount: number };
}

const SPORTS = ['All', 'Football', 'Basketball', 'Soccer', 'Baseball', 'Volleyball', 'Track', 'Swimming', 'Golf', 'Tennis'];
const DEAL_TYPES = ['All', 'endorsement', 'social_post', 'appearance', 'licensing', 'ambassador'];

export default function MarketplacePage() {
  const queryClient = useQueryClient();
  const [sport, setSport] = useState('');
  const [dealType, setDealType] = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [page, setPage] = useState(1);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const params = new URLSearchParams();
  if (sport) params.set('sport', sport);
  if (dealType) params.set('dealType', dealType);
  if (minFollowers) params.set('minFollowers', minFollowers);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['nil-marketplace', sport, dealType, minFollowers, page],
    queryFn: () => api.get(`/nil-marketplace/search?${params.toString()}`),
  });

  const inquireMutation = useMutation({
    mutationFn: (athleteId: string) =>
      api.post(`/nil-marketplace/athletes/${athleteId}/inquire`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nil-marketplace'] });
    },
  });

  const formatFollowers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const formatFmv = (min?: number, max?: number) => {
    if (!min && !max) return 'Not assessed';
    const fmt = (cents: number) => `$${(cents / 100).toLocaleString()}`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            NIL Marketplace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Discover college athletes available for NIL partnerships
          </p>
        </div>
        {data && (
          <Badge variant="secondary" className="text-sm">
            {data.meta.total.toLocaleString()} athletes available
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" /> Filters:
            </div>

            <select
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
              value={sport}
              onChange={(e) => { setSport(e.target.value === 'All' ? '' : e.target.value); setPage(1); }}
            >
              {SPORTS.map((s) => <option key={s} value={s === 'All' ? '' : s}>{s}</option>)}
            </select>

            <select
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
              value={dealType}
              onChange={(e) => { setDealType(e.target.value === 'All' ? '' : e.target.value); setPage(1); }}
            >
              {DEAL_TYPES.map((d) => <option key={d} value={d === 'All' ? '' : d}>{d}</option>)}
            </select>

            <div className="flex items-center gap-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Min followers"
                className="w-32 h-8 text-sm"
                type="number"
                value={minFollowers}
                onChange={(e) => { setMinFollowers(e.target.value); setPage(1); }}
              />
            </div>

            {(sport || dealType || minFollowers) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSport(''); setDealType(''); setMinFollowers(''); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No athletes found matching your filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((listing) => (
              <Card
                key={listing.id}
                className={`cursor-pointer transition-shadow hover:shadow-lg border ${
                  selectedListing?.id === listing.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedListing(listing)}
              >
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {listing.athlete.user.firstName} {listing.athlete.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {listing.sport} · {listing.athlete.university?.name ?? 'Unknown University'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {listing.verifiedByPlatform && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" /> Verified
                        </Badge>
                      )}
                      <Badge
                        variant={listing.athlete.eligibilityStatus === 'ELIGIBLE' ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {listing.athlete.eligibilityStatus}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">{listing.headline}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <span>{formatFollowers(listing.socialFollowersTotal)} followers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">FMV:</span>
                      <span>{formatFmv(listing.athlete.fmvMinCents, listing.athlete.fmvMaxCents)}</span>
                    </div>
                  </div>

                  {listing.preferredDealTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {listing.preferredDealTypes.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      inquireMutation.mutate(listing.athleteId);
                    }}
                    disabled={inquireMutation.isPending}
                  >
                    Send Inquiry
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data.meta.pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.meta.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.meta.pageCount, p + 1))}
                disabled={page === data.meta.pageCount}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
