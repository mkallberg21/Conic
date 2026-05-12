'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Key, Plus, Trash2, AlertTriangle, Copy, Check, Clock,
} from 'lucide-react';

interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: string;
  expiresAt?: string;
  requestCount: number;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  'read:contracts', 'write:contracts',
  'read:campaigns', 'write:campaigns',
  'read:creators', 'read:analytics',
  'write:deliverables', 'read:payments',
  'read:nil', 'write:nil',
];

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:contracts', 'read:campaigns']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[] }) =>
      api.post('/api-keys', data) as Promise<{ key: string }>,
    onSuccess: (res: { key: string }) => {
      setCreatedKey(res.key);
      setShowCreate(false);
      setNewKeyName('');
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            API Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage API keys to integrate Conic with your own systems
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
          <Plus className="h-4 w-4 mr-2" /> New API Key
        </Button>
      </div>

      {/* Newly created key reveal */}
      {createdKey && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800 dark:text-green-200">
                  API key created — copy it now
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  This is the only time you will see this key. Store it securely.
                </p>
                <div className="flex items-center gap-2 font-mono text-sm bg-white dark:bg-black px-3 py-2 rounded border border-green-300">
                  <span className="flex-1 break-all">{createdKey}</span>
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setCreatedKey(null)}
            >
              I&apos;ve saved this key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create new API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Key name (e.g. My Integration)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <div>
              <p className="text-sm font-medium mb-2">Scopes</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => toggleScope(scope)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selectedScopes.includes(scope)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-muted-foreground/30 text-muted-foreground hover:border-primary'
                    }`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate({ name: newKeyName, scopes: selectedScopes })}
                disabled={!newKeyName || selectedScopes.length === 0 || createMutation.isPending}
              >
                Create Key
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keys table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your API keys ({keys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No API keys yet. Create one to get started.
            </p>
          ) : (
            <div className="divide-y">
              {keys.map((key) => (
                <div key={key.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{key.name}</p>
                      <Badge variant={key.isActive ? 'secondary' : 'outline'} className="text-xs">
                        {key.isActive ? 'Active' : 'Revoked'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {key.prefix}••••••••••••••••••••••••
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {key.scopes.map((s) => (
                        <span key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      Last used: {formatDate(key.lastUsedAt)}
                    </div>
                    <div>{Number(key.requestCount).toLocaleString()} requests</div>
                    {key.expiresAt && (
                      <div>Expires: {formatDate(key.expiresAt)}</div>
                    )}
                  </div>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        if (confirm('Revoke this API key? This cannot be undone.')) {
                          revokeMutation.mutate(key.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
