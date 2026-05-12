'use client';
import { useState } from 'react';
import { Bell, CheckCheck, Filter, Inbox, AlertTriangle, FileText, DollarSign, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '@/hooks/use-api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Notification icon/colour map ─────────────────────────────────────────────

const NOTIF_META: Record<string, { icon: React.ReactNode; bg: string; label: string }> = {
  contract_created: { icon: <FileText className="h-4 w-4" />, bg: 'bg-blue-100 text-blue-600', label: 'Contract' },
  contract_signed: { icon: <FileText className="h-4 w-4" />, bg: 'bg-emerald-100 text-emerald-600', label: 'Contract' },
  contract_activated: { icon: <CheckCircle2 className="h-4 w-4" />, bg: 'bg-emerald-100 text-emerald-600', label: 'Contract' },
  deliverable_submitted: { icon: <Zap className="h-4 w-4" />, bg: 'bg-violet-100 text-violet-600', label: 'Deliverable' },
  deliverable_approved: { icon: <CheckCircle2 className="h-4 w-4" />, bg: 'bg-emerald-100 text-emerald-600', label: 'Deliverable' },
  deliverable_rejected: { icon: <XCircle className="h-4 w-4" />, bg: 'bg-rose-100 text-rose-600', label: 'Deliverable' },
  payment_initiated: { icon: <DollarSign className="h-4 w-4" />, bg: 'bg-amber-100 text-amber-600', label: 'Payment' },
  payment_released: { icon: <DollarSign className="h-4 w-4" />, bg: 'bg-emerald-100 text-emerald-600', label: 'Payment' },
  payment_failed: { icon: <AlertTriangle className="h-4 w-4" />, bg: 'bg-rose-100 text-rose-600', label: 'Payment' },
  fraud_detected: { icon: <AlertTriangle className="h-4 w-4" />, bg: 'bg-rose-100 text-rose-600', label: 'Alert' },
};

function notifMeta(type: string) {
  return NOTIF_META[type] ?? {
    icon: <Bell className="h-4 w-4" />,
    bg: 'bg-slate-100 text-slate-600',
    label: 'Notification',
  };
}

type FilterTab = 'all' | 'unread' | 'contracts' | 'deliverables' | 'payments' | 'alerts';

function matchesTab(type: string, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'unread') return false; // handled separately
  if (tab === 'contracts') return type.startsWith('contract');
  if (tab === 'deliverables') return type.startsWith('deliverable');
  if (tab === 'payments') return type.startsWith('payment');
  if (tab === 'alerts') return type === 'fraud_detected' || type.includes('alert');
  return true;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.read;
    return matchesTab(n.type, tab);
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="gap-1">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{notifications.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-1">
            Unread
            {unreadCount > 0 && (
              <Badge className="h-5 px-1.5 text-[11px] bg-rose-500">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1 text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Alerts
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notification list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">No notifications here</p>
              <p className="text-muted-foreground text-xs mt-1">Check back later or switch tabs</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((n, i) => {
                const meta = notifMeta(n.type);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 p-4 transition-colors hover:bg-muted/30 cursor-pointer',
                      !n.read && 'bg-primary/5',
                    )}
                    onClick={() => !n.read && markRead.mutate({ id: n.id })}
                  >
                    {/* Icon */}
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {!n.read && (
                              <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                            <p className="text-sm font-medium leading-none">{n.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meta.label}</Badge>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {i < filtered.length - 1 && <Separator className="absolute" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
