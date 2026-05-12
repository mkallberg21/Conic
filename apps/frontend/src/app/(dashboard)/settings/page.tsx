'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Bell, Shield, CreditCard, Key, Building2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth.store';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// ─── Profile form ─────────────────────────────────────────────────────────────

interface ProfileFormData {
  firstName: string;
  lastName: string;
  avatarUrl: string;
}

function ProfileSettings() {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { isDirty } } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      avatarUrl: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ProfileFormData) => api.patch('/v1/users/me', data),
    onSuccess: () => toast({ title: 'Profile updated', description: 'Your changes have been saved.' }),
    onError: () => toast({ title: 'Update failed', description: 'Please try again.', variant: 'destructive' }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register('firstName')} placeholder="Jane" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register('lastName')} placeholder="Smith" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={user?.email ?? ''} disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">Contact support to change your email address.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatarUrl">Avatar URL</Label>
        <Input id="avatarUrl" {...register('avatarUrl')} placeholder="https://..." />
      </div>

      <Button type="submit" disabled={!isDirty || mutation.isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {mutation.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

// ─── Password form ────────────────────────────────────────────────────────────

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function SecuritySettings() {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordFormData>();
  const newPw = watch('newPassword');

  const mutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      api.post('/v1/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => {
      toast({ title: 'Password changed', description: 'Your password has been updated.' });
      reset();
    },
    onError: () => toast({ title: 'Failed', description: 'Current password may be incorrect.', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <h3 className="font-medium text-sm">Change password</h3>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" type="password" {...register('currentPassword', { required: true })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            {...register('newPassword', {
              required: true,
              minLength: { value: 8, message: 'Min 8 characters' },
              pattern: { value: /[A-Z]/, message: 'At least one uppercase letter' },
            })}
          />
          {errors.newPassword && <p className="text-xs text-rose-500">{errors.newPassword.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword', {
              validate: (v) => v === newPw || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && <p className="text-xs text-rose-500">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" disabled={mutation.isPending} className="gap-2">
          <Key className="h-4 w-4" />
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <Separator />

      <div className="space-y-3">
        <h3 className="font-medium text-sm">Two-factor authentication</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Authenticator app</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security with TOTP</p>
          </div>
          <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>
        </div>
      </div>
    </div>
  );
}

// ─── Notification settings ────────────────────────────────────────────────────

interface NotifPref {
  label: string;
  description: string;
  key: string;
  default: boolean;
}

const NOTIF_PREFS: NotifPref[] = [
  { label: 'Contract updates', description: 'New contract created, signed, or cancelled', key: 'contracts', default: true },
  { label: 'Deliverable updates', description: 'Submissions, approvals, and rejections', key: 'deliverables', default: true },
  { label: 'Payment notifications', description: 'Payment initiated, released, or failed', key: 'payments', default: true },
  { label: 'Campaign updates', description: 'Campaign activated, completed, or weekly summaries', key: 'campaigns', default: true },
  { label: 'Fraud alerts', description: 'AI-detected suspicious activity on your account', key: 'fraud', default: true },
  { label: 'AI insights', description: 'New performance predictions and recommendations', key: 'ai_insights', default: false },
  { label: 'Marketing emails', description: 'Platform updates, tips, and industry news', key: 'marketing', default: false },
];

function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map((p) => [p.key, p.default])),
  );

  const mutation = useMutation({
    mutationFn: (data: Record<string, boolean>) => api.patch('/v1/users/notification-preferences', data),
    onSuccess: () => toast({ title: 'Preferences saved' }),
  });

  return (
    <div className="space-y-4">
      {NOTIF_PREFS.map((pref) => (
        <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">{pref.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pref.description}</p>
          </div>
          <Switch
            checked={prefs[pref.key]}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, [pref.key]: v }))}
          />
        </div>
      ))}
      <Button onClick={() => mutation.mutate(prefs)} disabled={mutation.isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {mutation.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  );
}

// ─── Billing placeholder ──────────────────────────────────────────────────────

function BillingSettings() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed p-8 text-center">
        <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-sm">No payment method on file</p>
        <p className="text-muted-foreground text-xs mt-1">Platform fees are collected via Dwolla ACH</p>
        <Button className="mt-4" variant="outline" size="sm">Connect bank account</Button>
      </div>
      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Dwolla micro-deposit verification required</p>
          <p className="text-xs text-amber-700 mt-0.5">
            You must verify your bank account before receiving payments. This takes 1–2 business days.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your account, security, and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </CardTitle>
              <CardDescription>Update your public-facing information</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Security
              </CardTitle>
              <CardDescription>Manage your password and two-factor authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <SecuritySettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notifications
              </CardTitle>
              <CardDescription>Choose what events trigger notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Billing & Payments
              </CardTitle>
              <CardDescription>Manage your payment methods and billing history</CardDescription>
            </CardHeader>
            <CardContent>
              <BillingSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
