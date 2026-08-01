'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Mail, Phone } from 'lucide-react';

interface Status {
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullyVerified: boolean;
  required: boolean;
}

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const r = await api.get('/v1/two-factor/status');
    const s: Status = r.data.data;
    setStatus(s);
    if (s.phone) setPhone(s.phone);
    return s;
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const err = (e: unknown) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';

  const requestEmail = async () => {
    setBusy('email-req');
    try { await api.post('/v1/two-factor/email/request'); setEmailSent(true); toast({ title: 'Code sent', description: 'Check your email for a 6-digit code.' }); }
    catch (e) { toast({ title: 'Error', description: err(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const verifyEmail = async () => {
    setBusy('email-ver');
    try { await api.post('/v1/two-factor/email/verify', { code: emailCode }); await load(); toast({ title: 'Email verified' }); }
    catch (e) { toast({ title: 'Error', description: err(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const requestPhone = async () => {
    setBusy('phone-req');
    try {
      const r = await api.post('/v1/two-factor/phone/request', { phone });
      setPhoneSent(true);
      toast({
        title: 'Code sent',
        description: r.data.data?.delivered ? 'Check your phone for a 6-digit code.' : 'SMS is not configured in this environment — ask an admin for the code (check server logs).',
      });
    } catch (e) { toast({ title: 'Error', description: err(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const verifyPhone = async () => {
    setBusy('phone-ver');
    try { await api.post('/v1/two-factor/phone/verify', { code: phoneCode }); const s = await load(); if (s.fullyVerified) finish(); toast({ title: 'Phone verified' }); }
    catch (e) { toast({ title: 'Error', description: err(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const finish = () => router.push('/dashboard');

  if (!status) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Verify your contact info</CardTitle>
          <CardDescription>
            Confirm your email and phone so brands reach the real you. You’ll need both before you can sign
            agreements or list publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4" /> Email
              {status.emailVerified && <span className="ml-auto flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Verified</span>}
            </div>
            {!status.emailVerified && (
              <>
                <p className="text-sm text-muted-foreground">{status.email}</p>
                {!emailSent ? (
                  <Button variant="outline" className="w-full" disabled={busy === 'email-req'} onClick={requestEmail}>
                    {busy === 'email-req' ? 'Sending…' : 'Send email code'}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="6-digit code" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} />
                    <Button disabled={busy === 'email-ver'} onClick={verifyEmail}>Verify</Button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Phone */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Phone className="h-4 w-4" /> Phone
              {status.phoneVerified && <span className="ml-auto flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Verified</span>}
            </div>
            {!status.phoneVerified && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile number</Label>
                  <Input id="phone" type="tel" placeholder="+1 415 555 0123" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                {!phoneSent ? (
                  <Button variant="outline" className="w-full" disabled={busy === 'phone-req' || !phone} onClick={requestPhone}>
                    {busy === 'phone-req' ? 'Sending…' : 'Send SMS code'}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="6-digit code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} maxLength={6} />
                    <Button disabled={busy === 'phone-ver'} onClick={verifyPhone}>Verify</Button>
                  </div>
                )}
              </>
            )}
          </section>

          <Button className="w-full" onClick={finish} variant={status.fullyVerified ? 'default' : 'ghost'}>
            {status.fullyVerified ? 'Continue to dashboard' : 'Skip for now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
