'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Star, Trash2, ShieldCheck, ShieldQuestion, Clock, Plus, Link2 } from 'lucide-react';

const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'X', 'FACEBOOK', 'TWITCH', 'LINKEDIN', 'SNAPCHAT', 'PINTEREST', 'THREADS', 'OTHER'] as const;
type Platform = (typeof PLATFORMS)[number];

interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string;
  url?: string | null;
  followerCount?: number | null;
  isPrimary: boolean;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
}
interface ProfileAttrs {
  bio?: string;
  niche?: string[];
  contentStyle?: string[];
  aestheticTags?: string[];
  languages?: string[];
  city?: string; region?: string; country?: string;
}
interface ProfileResponse { profile: ProfileAttrs; socialAccounts: SocialAccount[]; }

const csv = (a?: string[]) => (a ?? []).join(', ');
const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function VerifyBadge({ status }: { status: SocialAccount['verificationStatus'] }) {
  if (status === 'VERIFIED') return <Badge className="bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>;
  if (status === 'PENDING') return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
  return <Badge variant="outline"><ShieldQuestion className="mr-1 h-3 w-3" />Unverified</Badge>;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get('/v1/profile/me').then((r) => r.data.data),
  });

  // ── Profile attributes form ───────────────────────────────────────────────
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setForm({
      bio: p.bio ?? '', niche: csv(p.niche), contentStyle: csv(p.contentStyle),
      aestheticTags: csv(p.aestheticTags), languages: csv(p.languages),
      city: p.city ?? '', region: p.region ?? '', country: p.country ?? '',
    });
  }, [data?.profile]);

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/v1/profile', {
      bio: form.bio,
      niche: parseCsv(form.niche ?? ''),
      contentStyle: parseCsv(form.contentStyle ?? ''),
      aestheticTags: parseCsv(form.aestheticTags ?? ''),
      languages: parseCsv(form.languages ?? ''),
      city: form.city, region: form.region, country: form.country,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });

  // ── Social account add / actions ──────────────────────────────────────────
  const [platform, setPlatform] = useState<Platform>('INSTAGRAM');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [instructions, setInstructions] = useState<string | null>(null);

  const addAccount = useMutation({
    mutationFn: () => api.post('/v1/profile/social', { platform, handle, url: url || undefined }),
    onSuccess: () => { setHandle(''); setUrl(''); qc.invalidateQueries({ queryKey: ['profile', 'me'] }); },
  });
  const removeAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/profile/social/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });
  const setPrimary = useMutation({
    mutationFn: (id: string) => api.patch(`/v1/profile/social/${id}/primary`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });
  const verify = useMutation({
    mutationFn: (id: string) => api.post(`/v1/profile/social/${id}/verify`).then((r) => r.data.data),
    onSuccess: (res: { instructions?: string }) => { setInstructions(res?.instructions ?? null); qc.invalidateQueries({ queryKey: ['profile', 'me'] }); },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading your profile…</div>;

  const accounts = data?.socialAccounts ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Tell brands who you are and link your social accounts. Richer profiles rank higher in discovery search.
        </p>
      </div>

      {/* Profile attributes */}
      <Card>
        <CardHeader><CardTitle>About you</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="What you make and who it's for" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([['niche', 'Niches'], ['contentStyle', 'Content style'], ['aestheticTags', 'Aesthetic tags'], ['languages', 'Languages']] as const).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label} <span className="text-muted-foreground">(comma-separated)</span></Label>
                <Input id={key} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            {([['city', 'City'], ['region', 'Region / State'], ['country', 'Country']] as const).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>

      {/* Social accounts */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Linked social accounts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts linked yet.</p>}
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Badge variant="outline">{a.platform}</Badge>
              <span className="font-medium">@{a.handle}</span>
              {a.isPrimary && <Badge className="bg-amber-500"><Star className="mr-1 h-3 w-3" />Primary</Badge>}
              <VerifyBadge status={a.verificationStatus} />
              <div className="ml-auto flex gap-2">
                {!a.isPrimary && <Button size="sm" variant="ghost" onClick={() => setPrimary.mutate(a.id)}>Make primary</Button>}
                {a.verificationStatus !== 'VERIFIED' && <Button size="sm" variant="secondary" onClick={() => verify.mutate(a.id)}>Verify</Button>}
                <Button size="sm" variant="ghost" onClick={() => removeAccount.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}

          {instructions && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{instructions}</div>
          )}

          <Separator />

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="username" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="url">Profile URL (optional)</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            <Button onClick={() => addAccount.mutate()} disabled={!handle || addAccount.isPending}>
              <Plus className="mr-1 h-4 w-4" />Link account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
