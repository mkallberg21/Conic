'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Heart } from 'lucide-react';

function AcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await api.post('/v1/guardian/accept-invite', { token });
      setDone(true);
      toast({ title: 'Linked!', description: 'You can now review and approve agreements.' });
      setTimeout(() => router.push('/guardian'), 1200);
    } catch (e) {
      toast({
        title: 'Could not accept invite',
        description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'The invite may have expired.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl"><Heart className="h-6 w-6 text-primary" /> Guardian invite</CardTitle>
          <CardDescription>
            Accept to link your account as the parent/guardian. You’ll approve every agreement and receive a
            copy of every brand message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!token && <p className="text-sm text-destructive">This link is missing its invite token.</p>}
          <Button className="w-full" disabled={!token || busy || done} onClick={accept}>
            {done ? 'Linked ✓' : busy ? 'Linking…' : 'Accept &amp; link'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GuardianAcceptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <AcceptInner />
    </Suspense>
  );
}
