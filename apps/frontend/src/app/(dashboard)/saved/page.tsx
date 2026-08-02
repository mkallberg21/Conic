'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AreaMap } from '@/components/area-map';
import { toast } from '@/hooks/use-toast';
import { Bookmark, Trash2, TrendingUp, MapPin } from 'lucide-react';

interface SavedProfile {
  savedId: string;
  targetType: 'creator' | 'athlete';
  targetId: string;
  name: string;
  avatarUrl: string | null;
  subtitle: string | null;
  location: string | null;
  approxLat: number | null;
  approxLng: number | null;
  followersCount: number;
  performanceScore: number;
  note: string | null;
  savedAt: string;
}

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;
}

export default function SavedProfilesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SavedProfile[]>({
    queryKey: ['engagement', 'saved'],
    queryFn: () => api.get('/v1/engagement/saved').then((r) => r.data.data),
  });

  const remove = useMutation({
    mutationFn: (p: SavedProfile) => api.delete(`/v1/engagement/saved?targetType=${p.targetType}&targetId=${p.targetId}`),
    onSuccess: () => {
      toast({ title: 'Removed from saved' });
      qc.invalidateQueries({ queryKey: ['engagement', 'saved'] });
      qc.invalidateQueries({ queryKey: ['engagement', 'saved-keys'] });
    },
  });

  const withGeo = (data ?? []).filter((p) => p.approxLat != null && p.approxLng != null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bookmark className="h-6 w-6 text-primary" /> Saved profiles
        </h1>
        <p className="text-sm text-muted-foreground">
          Your shortlist of creators and athletes for current and future campaigns. Locations show a general
          area only.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {data && data.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No saved profiles yet. Use the bookmark on any result in <span className="font-medium">Discover</span> to add one.
        </CardContent></Card>
      )}

      {data && data.length > 0 && (
        <>
          {/* Where they are (general areas) */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> Where your shortlist is</CardTitle></CardHeader>
            <CardContent>
              {withGeo.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locations set on your saved profiles yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {withGeo.map((p) => (
                    <div key={p.savedId} className="space-y-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <AreaMap lat={p.approxLat} lng={p.approxLng} label={p.location} height={150} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* The shortlist */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((p) => (
              <div key={p.savedId} className="rounded-lg border bg-background p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatarUrl ?? undefined} />
                    <AvatarFallback>{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <Badge variant="outline" className="ml-auto shrink-0 capitalize">{p.targetType}</Badge>
                      <button aria-label="Remove" className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(p)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.subtitle}{p.location ? ` • ${p.location}` : ''}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{fmt(p.followersCount)} followers</span>
                  <span>Score {Math.round(p.performanceScore)}</span>
                </div>
                {p.note && <p className="mt-2 rounded bg-muted/50 p-2 text-xs">{p.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
