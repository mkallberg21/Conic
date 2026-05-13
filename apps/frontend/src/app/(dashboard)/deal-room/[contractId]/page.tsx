'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, CheckCircle, XCircle, MessageSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const messageSchema = z.object({ content: z.string().min(1).max(5000) });
const proposalSchema = z.object({
  title: z.string().min(3).max(200),
  changes: z.string().min(10),
});

type MessageForm = z.infer<typeof messageSchema>;
type ProposalForm = z.infer<typeof proposalSchema>;

export default function DealRoomPage() {
  const params = useParams<{ contractId: string }>();
  const contractId = params.contractId;
  const qc = useQueryClient();
  const [showProposalForm, setShowProposalForm] = useState(false);

  const { data: room, isLoading } = useQuery({
    queryKey: ['deal-room', contractId],
    queryFn: () => api.get(`/v1/deal-room/${contractId}`).then((r) => r.data),
    refetchInterval: 10000, // poll every 10s for new messages
  });

  const msgForm = useForm<MessageForm>({ resolver: zodResolver(messageSchema) });
  const propForm = useForm<ProposalForm>({ resolver: zodResolver(proposalSchema) });

  const sendMessage = useMutation({
    mutationFn: (values: MessageForm) =>
      api.post(`/v1/deal-room/${contractId}/messages`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-room', contractId] });
      msgForm.reset();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' }),
  });

  const submitProposal = useMutation({
    mutationFn: (values: ProposalForm) =>
      api.post(`/v1/deal-room/${contractId}/proposals`, {
        title: values.title,
        changes: [values.changes],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-room', contractId] });
      propForm.reset();
      setShowProposalForm(false);
      toast({ title: 'Proposal submitted', description: 'AI is scoring the contract risk…' });
    },
  });

  const resolveProposal = useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; action: 'accept' | 'reject' }) =>
      api.patch(`/v1/deal-room/${contractId}/proposals/${proposalId}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-room', contractId] }),
  });

  const agreeRoom = useMutation({
    mutationFn: () => api.patch(`/v1/deal-room/${contractId}/agree`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-room', contractId] });
      toast({ title: 'Terms agreed', description: 'Both parties have agreed to the terms.' });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">Loading deal room…</div>;
  if (!room) return <div className="text-muted-foreground p-8">Deal room not found.</div>;

  const messages = room.messages ?? [];
  const proposals = room.proposals ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Room</h1>
          <p className="text-muted-foreground">{room.contract?.title}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={room.status === 'AGREED' ? 'default' : 'secondary'}>{room.status}</Badge>
          {room.status === 'OPEN' && (
            <Button size="sm" variant="outline" onClick={() => agreeRoom.mutate()}>
              <CheckCircle className="mr-1 h-4 w-4" /> Agree to Terms
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Messages ── */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Negotiation Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3 pb-0">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                No messages yet — start the conversation.
              </p>
            )}
            {messages.map((msg: { id: string; content: string; sentAt: string; sender: { firstName: string; lastName: string } }) => (
              <div key={msg.id} className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">
                  {msg.sender?.firstName} {msg.sender?.lastName} · {formatDate(msg.sentAt)}
                </p>
                <p>{msg.content}</p>
              </div>
            ))}
          </CardContent>
          <div className="p-4 border-t">
            <form onSubmit={msgForm.handleSubmit((v) => sendMessage.mutate(v))} className="flex gap-2">
              <Textarea
                {...msgForm.register('content')}
                placeholder="Type a message…"
                className="resize-none min-h-[60px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    msgForm.handleSubmit((v) => sendMessage.mutate(v))();
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>

        {/* ── Proposals ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Contract Proposals
            </h2>
            <Button size="sm" onClick={() => setShowProposalForm(!showProposalForm)}>
              + New Proposal
            </Button>
          </div>

          {showProposalForm && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input {...propForm.register('title')} placeholder="e.g. Adjust exclusivity period" />
                </div>
                <div>
                  <label className="text-sm font-medium">Proposed changes</label>
                  <Textarea
                    {...propForm.register('changes')}
                    placeholder="Describe the contract changes you're proposing…"
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowProposalForm(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={propForm.handleSubmit((v) => submitProposal.mutate(v))}
                    disabled={submitProposal.isPending}
                  >
                    Submit Proposal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {proposals.length === 0 && !showProposalForm && (
            <p className="text-muted-foreground text-sm text-center py-8">
              No proposals yet.
            </p>
          )}

          {proposals.map((p: {
            id: string; title: string; status: string; riskScore?: number;
            changes: string[]; proposer: { firstName: string; lastName: string };
          }) => (
            <Card key={p.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.proposer?.firstName} {p.proposer?.lastName}</p>
                  </div>
                  <Badge variant={
                    p.status === 'ACCEPTED' ? 'default' :
                    p.status === 'REJECTED' ? 'destructive' : 'secondary'
                  }>{p.status}</Badge>
                </div>
                {p.riskScore != null && (
                  <p className="text-xs text-muted-foreground">AI Risk Score: {p.riskScore}/100</p>
                )}
                {p.changes?.map((c: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground border-l-2 pl-3">{c}</p>
                ))}
                {p.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => resolveProposal.mutate({ proposalId: p.id, action: 'accept' })}>
                      <CheckCircle className="mr-1 h-3 w-3" /> Accept
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => resolveProposal.mutate({ proposalId: p.id, action: 'reject' })}>
                      <XCircle className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
