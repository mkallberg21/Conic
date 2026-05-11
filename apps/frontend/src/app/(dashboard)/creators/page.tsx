'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Search } from 'lucide-react';

export default function CreatorsPage() {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['creators', search],
    queryFn: () => api.get('/v1/creators', { params: { search: search || undefined } }).then((r) => r.data.data),
  });

  const creators = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Creator Discovery</h1>
        <p className="text-muted-foreground">Find creators with AI-powered scoring</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, niche…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Creators ({creators.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>Followers</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Audience Score</TableHead>
                <TableHead>Fraud Score</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creators.map((c: Record<string, unknown>) => (
                <TableRow key={c.id as string}>
                  <TableCell className="font-medium">@{c.instagramHandle as string ?? (c.tiktokHandle as string) ?? 'N/A'}</TableCell>
                  <TableCell className="capitalize">{c.niche as string ?? '—'}</TableCell>
                  <TableCell>{(c.totalFollowers as number)?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell>{c.avgEngagementRate != null ? `${(c.avgEngagementRate as number).toFixed(1)}%` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={(c.audienceScore as number) >= 70 ? 'default' : 'secondary'}>
                      {c.audienceScore != null ? `${c.audienceScore}/100` : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={(c.fraudScore as number) > 50 ? 'destructive' : 'secondary'}>
                      {c.fraudScore != null ? `${c.fraudScore}/100` : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate((c.user as Record<string, string>)?.createdAt ?? '')}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline">View Profile</Button>
                  </TableCell>
                </TableRow>
              ))}
              {creators.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No creators found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
