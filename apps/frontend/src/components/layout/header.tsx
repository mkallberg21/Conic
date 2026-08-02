'use client';

import { Bell, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between rounded-none border-x-0 border-t-0 px-6">
      <div />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-glow-sm">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2.5 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/15 text-foreground">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">
            {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : ''}
          </span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{user?.role}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
