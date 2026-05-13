'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  brief: z.string().min(20, 'Please describe your campaign in at least 20 characters'),
  targetNiche: z.string().optional(),
  targetPlatforms: z.string().optional(),
  targetMinFollowers: z.coerce.number().optional(),
  budgetCents: z.coerce.number().optional(),
  targetEntityType: z.enum(['creator', 'athlete', 'both']).default('creator'),
  maxResults: z.coerce.number().min(1).max(50).default(10),
});
type FormValues = z.infer<typeof schema>;

function ScorePill({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' :
    score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

export default function MatchPage() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submit = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/v1/matchmaking/requests', {
        ...values,
        targetNiche: values.targetNiche ? values.targetNiche.split(',').map((s) => s.trim()) : [],
        targetPlatforms: values.targetPlatforms ? values.targetPlatforms.split(',').map((s) => s.trim()) : [],
      }).then((r) => r.data),
    onSuccess: (data) => {
      setRequestId(data.id);
      setPollingEnabled(true);
      toast({ title: 'AI is finding matches…', description: 'Results will appear in seconds.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to submit match request', variant: 'destructive' }),
  });

  const { data: request } = useQuery({
    queryKey: ['matchmaking', requestId],
    queryFn: () => api.get(`/v1/matchmaking/requests/${requestId}`).then((r) => r.data),
    enabled: !!requestId,
    refetchInterval: pollingEnabled ? 3000 : false,
    select: (data) => {
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        setPollingEnabled(false);
      }
      return data;
    },
  });

  const results = request?.results ?? [];
  const isProcessing = request?.status === 'PROCESSING' || request?.status === 'PENDING';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Matchmaking
        </h1>
        <p className="text-muted-foreground">Describe your campaign and our AI finds the best-fit creators and athletes</p>
      </div>

      {/* Brief form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Campaign Brief *</label>
            <Textarea
              {...form.register('brief')}
              placeholder="e.g. We're launching a sustainable athletic wear line and need athletes and creators in the fitness space with an authentic, health-focused audience…"
              className="resize-none mt-1"
              rows={4}
            />
            {form.formState.errors.brief && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.brief.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <select
                {...form.register('targetEntityType')}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="creator">Creators</option>
                <option value="athlete">Athletes</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Niches (comma-sep)</label>
              <Input {...form.register('targetNiche')} placeholder="fitness, wellness" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Platforms (comma-sep)</label>
              <Input {...form.register('targetPlatforms')} placeholder="instagram, tiktok" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Budget per deal ($)</label>
              <Input type="number" {...form.register('budgetCents')} placeholder="5000" className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-32">
              <label className="text-sm font-medium">Max Results</label>
              <Input type="number" {...form.register('maxResults')} defaultValue={10} className="mt-1" />
            </div>
            <div className="flex-1 flex justify-end pt-5">
              <Button
                onClick={form.handleSubmit((v) => submit.mutate(v))}
                disabled={submit.isPending || isProcessing}
                className="gap-2"
              >
                {submit.isPending || isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Finding Matches…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Find Matches</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isProcessing && (
        <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          AI is analyzing {request?.targetEntityType === 'creator' ? 'creators' : 'candidates'}…
        </div>
      )}

      {request?.status === 'FAILED' && (
        <div className="text-center text-destructive py-8">
          Matching failed. Please try again.
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">
            {results.length} Match{results.length > 1 ? 'es' : ''} Found
          </h2>
          {results.map((r: {
            id: string; rank: number; matchScore: number; audienceAlignScore: number;
            performanceScore: number; fraudScore: number; suggestedRateCents: number;
            estimatedReach: number; reasoning: string; aiFlags?: { warning?: string };
            creator?: { user: { firstName: string; lastName: string; avatarUrl?: string } };
            athlete?: { user: { firstName: string; lastName: string; avatarUrl?: string }; sport: string };
          }) => {
            const entity = r.creator ?? r.athlete;
            const name = entity ? `${entity.user.firstName} ${entity.user.lastName}` : '—';
            const label = r.creator ? 'Creator' : `Athlete · ${r.athlete?.sport}`;

            return (
              <Card key={r.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                        #{r.rank}
                      </div>
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Match</span>
                      <ScorePill score={r.matchScore} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div className="rounded bg-muted p-2">
                      <p className="text-muted-foreground">Audience</p>
                      <p className="font-semibold">{r.audienceAlignScore}/100</p>
                    </div>
                    <div className="rounded bg-muted p-2">
                      <p className="text-muted-foreground">Performance</p>
                      <p className="font-semibold">{r.performanceScore}/100</p>
                    </div>
                    <div className="rounded bg-muted p-2">
                      <p className="text-muted-foreground">Est. Reach</p>
                      <p className="font-semibold">{r.estimatedReach?.toLocaleString() ?? '—'}</p>
                    </div>
                    <div className="rounded bg-muted p-2">
                      <p className="text-muted-foreground">Suggested Rate</p>
                      <p className="font-semibold">{formatCurrency(r.suggestedRateCents)}</p>
                    </div>
                  </div>

                  {r.reasoning && (
                    <p className="mt-2 text-xs text-muted-foreground">{r.reasoning}</p>
                  )}

                  {r.aiFlags?.warning && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> {r.aiFlags.warning}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" className="gap-1">
                      Create Contract <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
