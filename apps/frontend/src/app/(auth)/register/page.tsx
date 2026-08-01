'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { register as apiRegister } from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/hooks/use-toast';

const INFLUENCER_ROLES = ['CREATOR', 'ATHLETE'];

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', role: 'BRAND',
    phone: '', dateOfBirth: '', sport: '', handle: '', guardianEmail: '', guardianRelationship: 'parent',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isInfluencer = INFLUENCER_ROLES.includes(form.role);
  const age = ageFromDob(form.dateOfBirth);
  const isMinor = isInfluencer && age !== null && age < 18;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 12) {
      toast({ title: 'Weak password', description: 'Password must be at least 12 characters with upper, lower, number and symbol.', variant: 'destructive' });
      return;
    }
    if (isMinor && !form.guardianEmail) {
      toast({ title: 'Guardian required', description: 'A parent/guardian email is required to sign up a minor.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = await apiRegister({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        phone: form.phone || undefined,
        dateOfBirth: isInfluencer && form.dateOfBirth ? form.dateOfBirth : undefined,
        sport: form.role === 'ATHLETE' ? form.sport || undefined : undefined,
        handle: form.role === 'CREATOR' ? form.handle || undefined : undefined,
        guardianEmail: isMinor ? form.guardianEmail : undefined,
        guardianRelationship: isMinor ? form.guardianRelationship : undefined,
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
      if (data.guardianRequired) {
        toast({ title: 'Guardian invited', description: 'We emailed your parent/guardian to approve your account and agreements.' });
      }
      // Influencers must verify email + phone before they can transact.
      router.push(data.verificationRequired ? '/verify' : '/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed';
      toast({ title: 'Error', description: Array.isArray(message) ? message.join(', ') : message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Get started with Conic for free</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" placeholder="Jane" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" placeholder="Smith" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
              <p className="text-xs text-muted-foreground">At least 12 characters, with upper &amp; lower case, a number and a symbol.</p>
            </div>
            <div className="space-y-2">
              <Label>I am a…</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRAND">Brand</SelectItem>
                  <SelectItem value="CREATOR">Creator / Influencer</SelectItem>
                  <SelectItem value="ATHLETE">Athlete</SelectItem>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                  <SelectItem value="GUARDIAN">Parent / Guardian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Mobile phone {isInfluencer && <span className="text-muted-foreground">(verified via SMS)</span>}</Label>
              <Input id="phone" type="tel" placeholder="+1 415 555 0123" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>

            {isInfluencer && (
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </div>
            )}
            {form.role === 'ATHLETE' && (
              <div className="space-y-2">
                <Label htmlFor="sport">Sport</Label>
                <Input id="sport" placeholder="e.g. Basketball" value={form.sport} onChange={(e) => set('sport', e.target.value)} />
              </div>
            )}
            {form.role === 'CREATOR' && (
              <div className="space-y-2">
                <Label htmlFor="handle">Handle</Label>
                <Input id="handle" placeholder="@yourhandle" value={form.handle} onChange={(e) => set('handle', e.target.value)} />
              </div>
            )}

            {isMinor && (
              <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  You’re under 18 — a parent or guardian must approve your account and every agreement.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="guardianEmail">Parent / guardian email</Label>
                  <Input id="guardianEmail" type="email" placeholder="parent@example.com" value={form.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Their relationship to you</Label>
                  <Select value={form.guardianRelationship} onValueChange={(v) => set('guardianRelationship', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="legal_guardian">Legal guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
