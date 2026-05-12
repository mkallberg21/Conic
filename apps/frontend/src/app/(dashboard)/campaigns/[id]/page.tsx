'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Megaphone, DollarSign, Calendar, CheckCircle2, Circle,
  Sparkles, TrendingUp, Users, BarChart2, Loader2
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  PLANNING: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/v1/campaigns/${id}`).then((r) => r.data.data),
  });

  const debriefMutation = useMutation({
    mutationFn: () => api.post(`/v1/campaigns/${id}/debrief`),
    onSuccess: () => {
      toast({ title: 'Debrief queued', description: 'AI is generating campaign insights. Check back in a moment.' });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['campaign', id] }), 8000);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to generate debrief.', variant: 'destructive' }),
  });

  const taskMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      api.patch(`/v1/campaigns/${id}/tasks/${taskId}`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-32 rounded bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!campaign) return <div className="text-center py-20 text-muted-foreground">Campaign not found.</div>;

  const tasks = campaign.tasks ?? [];
  const completedTasks = tasks.filter((t: Record<string, unknown>) => t.completed).length;
  const latestSummary = campaign.summaries?.[0];
  const perf = campaign.performanceData as Record<string, number> | null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </Button>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                <p className="text-muted-foreground text-sm mt-1 max-w-xl">{campaign.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[campaign.status] ?? 'bg-muted')}>
                    {campaign.status}
                  </span>
                  {campaign.targetNiches?.map((n: string) => (
                    <Badge key={n} variant="outline" className="text-xs capitalize">{n}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => debriefMutation.mutate()}
              disabled={debriefMutation.isPending}
            >
              {debriefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AI Debrief
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-xl font-bold">{formatCurrency(campaign.budget ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Calendar className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Timeline</p>
              <p className="text-sm font-semibold">
                {campaign.startDate ? formatDate(campaign.startDate) : '—'} → {campaign.endDate ? formatDate(campaign.endDate) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2"><BarChart2 className="h-5 w-5 text-violet-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="text-xl font-bold">{completedTasks}/{tasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Reach</p>
              <p className="text-xl font-bold">
                {perf?.totalReach != null ? `${(perf.totalReach / 1000).toFixed(0)}K` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">AI Task List</TabsTrigger>
          <TabsTrigger value="debrief">AI Debrief</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Campaign Checklist</CardTitle>
                <span className="text-sm text-muted-foreground">{completedTasks} of {tasks.length} complete</span>
              </div>
              {tasks.length > 0 && (
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(completedTasks / tasks.length) * 100}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No tasks yet. The AI will generate them when the campaign is activated.</p>
              ) : (
                tasks.map((task: Record<string, unknown>) => (
                  <div
                    key={task.id as string}
                    className={cn('flex items-start gap-3 rounded-lg border p-3 transition-colors', task.completed ? 'bg-muted/40 border-transparent' : 'hover:bg-muted/20')}
                  >
                    <button
                      className="mt-0.5 shrink-0 text-primary hover:scale-110 transition-transform"
                      onClick={() => taskMutation.mutate({ taskId: task.id as string, completed: !task.completed })}
                    >
                      {task.completed
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('text-sm font-medium', (task.completed as boolean) && 'line-through text-muted-foreground')}>
                          {task.title as string}
                        </p>
                        {(task.aiGenerated as boolean) && (
                          <Badge variant="secondary" className="text-[10px] gap-1 py-0">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </Badge>
                        )}
                        {(task.priority as string | undefined) && (
                          <Badge
                            className={cn('text-[10px] py-0', task.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' : task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}
                            variant="secondary"
                          >
                            {task.priority as string}
                          </Badge>
                        )}
                      </div>
                      {(task.description as string | undefined) && <p className="text-xs text-muted-foreground mt-0.5">{task.description as string}</p>}
                      {(task.dueDate as string | undefined) && <p className="text-[11px] text-muted-foreground mt-1">Due: {formatDate(task.dueDate as string)}</p>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Debrief */}
        <TabsContent value="debrief" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <CardTitle className="text-base">AI Campaign Debrief</CardTitle>
              </div>
              {latestSummary && (
                <p className="text-xs text-muted-foreground">Generated {formatDate(latestSummary.createdAt)}</p>
              )}
            </CardHeader>
            <CardContent>
              {latestSummary ? (
                <div className="prose prose-sm max-w-none">
                  <div className="space-y-4">
                    {latestSummary.executiveSummary && (
                      <div className="rounded-lg bg-violet-50 border border-violet-100 p-4">
                        <h4 className="font-semibold text-sm text-violet-900 mb-1">Executive Summary</h4>
                        <p className="text-sm text-violet-800">{latestSummary.executiveSummary}</p>
                      </div>
                    )}
                    {latestSummary.keyInsights?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Insights</h4>
                        <ul className="space-y-1.5">
                          {latestSummary.keyInsights.map((insight: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {latestSummary.recommendations?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Recommendations</h4>
                        <ul className="space-y-1.5">
                          {latestSummary.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No debrief generated yet.</p>
                  <Button size="sm" onClick={() => debriefMutation.mutate()} disabled={debriefMutation.isPending}>
                    {debriefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate AI Debrief
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Performance Metrics</CardTitle></CardHeader>
            <CardContent>
              {perf ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(perf).map(([key, val]) => (
                    <div key={key} className="rounded-lg border p-4 space-y-1">
                      <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-lg font-bold">
                        {typeof val === 'number' && val > 1000 ? `${(val / 1000).toFixed(1)}K` : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 gap-3">
                  <BarChart2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No performance data yet. Generate an AI debrief to populate metrics.</p>
                </div>
              )}

              {campaign.aiInsights && (
                <>
                  <Separator className="my-4" />
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-semibold">AI Insights</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{campaign.aiInsights}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
