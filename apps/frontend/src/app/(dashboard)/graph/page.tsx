'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Search, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  label: string;
  tier: string;
  niche: string;
  followers: number;
  engagementRate: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'collaboration' | 'audience_overlap' | 'niche_affinity';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { id: string; label: string; color: string; nodeIds: string[] }[];
}

// ─── Colour palette ───────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  nano: '#10b981', micro: '#3b82f6', mid: '#8b5cf6',
  macro: '#f59e0b', mega: '#ef4444', celebrity: '#ec4899',
};

const NICHE_RING: Record<string, string> = {
  finance: '#f59e0b', tech: '#3b82f6', beauty: '#ec4899',
  fashion: '#8b5cf6', fitness: '#10b981', food: '#f97316',
  gaming: '#06b6d4', lifestyle: '#6b7280', travel: '#84cc16',
  education: '#a78bfa', b2b: '#14b8a6',
};

// ─── Force-directed layout (simple custom simulation) ─────────────────────────
function useForceLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!nodes.length) return;

    const W = 900, H = 600, REPEL = 3000, ATTRACT = 0.04, DAMP = 0.85, STEPS = 120;

    // Init positions randomly
    const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    nodes.forEach((n) => {
      pos[n.id] = {
        x: W / 2 + (Math.random() - 0.5) * 400,
        y: H / 2 + (Math.random() - 0.5) * 300,
        vx: 0, vy: 0,
      };
    });

    let step = 0;
    const edgeMap = edges.map((e) => ({ s: e.source, t: e.target, ideal: 120 * (1 - e.weight * 0.5) }));

    const tick = () => {
      if (step++ >= STEPS) { setPositions(Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, { x: p.x, y: p.y }]))); return; }

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos[nodes[i].id], b = pos[nodes[j].id];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist2 = Math.max(dx * dx + dy * dy, 1);
          const f = REPEL / dist2;
          const fx = f * dx / Math.sqrt(dist2), fy = f * dy / Math.sqrt(dist2);
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // Attraction along edges
      for (const e of edgeMap) {
        const a = pos[e.s], b = pos[e.t];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = ATTRACT * (dist - e.ideal);
        const fx = f * dx / dist, fy = f * dy / dist;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // Apply + clamp
      for (const n of nodes) {
        const p = pos[n.id];
        p.vx *= DAMP; p.vy *= DAMP;
        p.x = Math.max(40, Math.min(W - 40, p.x + p.vx));
        p.y = Math.max(40, Math.min(H - 40, p.y + p.vy));
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [nodes, edges]);

  return positions;
}

// ─── SVG Canvas ───────────────────────────────────────────────────────────────
function GraphCanvas({
  data, positions, selected, onSelect, zoom,
}: {
  data: GraphData;
  positions: Record<string, { x: number; y: number }>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
}) {
  const viewW = 900, viewH = 600;
  const nodeRadius = (n: GraphNode) => Math.max(8, Math.min(28, Math.log10(n.followers + 1) * 5));

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full h-full"
      style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
      onClick={() => onSelect(null)}
    >
      {/* Edges */}
      {data.edges.map((e, i) => {
        const a = positions[e.source], b = positions[e.target];
        if (!a || !b) return null;
        const opacity = selected && (e.source === selected || e.target === selected) ? 0.8 : 0.15;
        const stroke = e.type === 'collaboration' ? '#7c3aed' : e.type === 'audience_overlap' ? '#3b82f6' : '#6b7280';
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={stroke} strokeWidth={e.weight * 2 + 0.5} strokeOpacity={opacity} />
        );
      })}

      {/* Nodes */}
      {data.nodes.map((n) => {
        const p = positions[n.id];
        if (!p) return null;
        const r = nodeRadius(n);
        const isSelected = selected === n.id;
        const color = TIER_COLORS[n.tier] ?? '#6b7280';
        const ring = NICHE_RING[n.niche] ?? '#d1d5db';
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }}
            onClick={(ev) => { ev.stopPropagation(); onSelect(n.id); }}>
            {/* Outer ring (niche) */}
            <circle r={r + 4} fill="none" stroke={ring} strokeWidth={isSelected ? 3 : 1.5} strokeOpacity={0.6} />
            {/* Core */}
            <circle r={r} fill={color} fillOpacity={0.9}
              stroke={isSelected ? 'white' : color} strokeWidth={isSelected ? 2.5 : 0.5} />
            {/* Label */}
            {(isSelected || r > 14) && (
              <text y={r + 14} textAnchor="middle" fontSize={10} fill="currentColor" className="select-none">
                {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
              </text>
            )}
            {/* ER badge */}
            {isSelected && (
              <text y={-r - 6} textAnchor="middle" fontSize={9} fill="white"
                style={{ background: color }}>{n.engagementRate.toFixed(1)}% ER</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sidebar detail ───────────────────────────────────────────────────────────
function NodeDetail({ node, data }: { node: GraphNode; data: GraphData }) {
  const connections = data.edges.filter((e) => e.source === node.id || e.target === node.id);
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-muted-foreground">Tier</p>
        <Badge style={{ background: TIER_COLORS[node.tier], color: 'white' }}>{node.tier}</Badge>
      </div>
      <div>
        <p className="text-muted-foreground">Niche</p>
        <p className="font-medium capitalize">{node.niche}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Followers</p>
        <p className="font-medium">{node.followers.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Engagement Rate</p>
        <p className="font-medium">{node.engagementRate.toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-muted-foreground">Connections</p>
        <p className="font-medium">{connections.length}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1">Connection types</p>
        <div className="flex flex-wrap gap-1">
          {['collaboration', 'audience_overlap', 'niche_affinity'].map((t) => {
            const count = connections.filter((e) => e.type === t).length;
            if (!count) return null;
            return <Badge key={t} variant="outline" className="text-xs">{t.replace('_', ' ')}: {count}</Badge>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GraphPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const { data: graphData, isLoading, refetch } = useQuery<GraphData>({
    queryKey: ['creator-graph'],
    queryFn: () => api.get('/v1/analytics/creator-graph').then((r) => r.data.data),
    placeholderData: {
      nodes: [
        { id: '1', label: '@techcreator', tier: 'micro', niche: 'tech', followers: 45000, engagementRate: 5.2 },
        { id: '2', label: '@beautyglam', tier: 'mid', niche: 'beauty', followers: 220000, engagementRate: 3.8 },
        { id: '3', label: '@fitnessguru', tier: 'macro', niche: 'fitness', followers: 780000, engagementRate: 2.1 },
        { id: '4', label: '@foodlover', tier: 'micro', niche: 'food', followers: 92000, engagementRate: 4.6 },
        { id: '5', label: '@travelblog', tier: 'micro', niche: 'travel', followers: 67000, engagementRate: 6.1 },
        { id: '6', label: '@financecoach', tier: 'mid', niche: 'finance', followers: 155000, engagementRate: 4.3 },
        { id: '7', label: '@gamingpro', tier: 'mid', niche: 'gaming', followers: 310000, engagementRate: 5.9 },
        { id: '8', label: '@lifestylemom', tier: 'micro', niche: 'lifestyle', followers: 38000, engagementRate: 7.2 },
        { id: '9', label: '@luxuryfashion', tier: 'macro', niche: 'fashion', followers: 1200000, engagementRate: 1.8 },
        { id: '10', label: '@edutok', tier: 'mid', niche: 'education', followers: 430000, engagementRate: 4.8 },
      ],
      edges: [
        { source: '1', target: '6', weight: 0.8, type: 'niche_affinity' },
        { source: '1', target: '7', weight: 0.6, type: 'collaboration' },
        { source: '2', target: '9', weight: 0.9, type: 'audience_overlap' },
        { source: '2', target: '8', weight: 0.5, type: 'niche_affinity' },
        { source: '3', target: '4', weight: 0.4, type: 'audience_overlap' },
        { source: '3', target: '5', weight: 0.3, type: 'collaboration' },
        { source: '4', target: '8', weight: 0.7, type: 'audience_overlap' },
        { source: '5', target: '8', weight: 0.6, type: 'niche_affinity' },
        { source: '6', target: '10', weight: 0.7, type: 'niche_affinity' },
        { source: '7', target: '1', weight: 0.5, type: 'collaboration' },
        { source: '9', target: '5', weight: 0.3, type: 'audience_overlap' },
        { source: '10', target: '6', weight: 0.6, type: 'niche_affinity' },
      ],
      clusters: [
        { id: 'c1', label: 'Tech & Finance', color: '#3b82f6', nodeIds: ['1', '6', '10'] },
        { id: 'c2', label: 'Beauty & Fashion', color: '#ec4899', nodeIds: ['2', '9'] },
        { id: 'c3', label: 'Lifestyle & Food', color: '#10b981', nodeIds: ['4', '5', '8'] },
      ],
    },
  });

  const filtered = graphData
    ? {
        ...graphData,
        nodes: search
          ? graphData.nodes.filter(
              (n) =>
                n.label.toLowerCase().includes(search.toLowerCase()) ||
                n.niche.toLowerCase().includes(search.toLowerCase()),
            )
          : graphData.nodes,
      }
    : { nodes: [], edges: [], clusters: [] };

  const positions = useForceLayout(filtered.nodes, filtered.edges);
  const selectedNode = graphData?.nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creator Graph Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Visualise creator relationships, audience overlap, and niche clusters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search creators…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Graph canvas */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="relative h-full p-0">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading graph…
              </div>
            ) : (
              <GraphCanvas
                data={filtered}
                positions={positions}
                selected={selected}
                onSelect={setSelected}
                zoom={zoom}
              />
            )}
            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border bg-background/90 p-2 text-xs backdrop-blur">
              <p className="font-semibold text-muted-foreground">Tier (node fill)</p>
              {Object.entries(TIER_COLORS).map(([tier, color]) => (
                <span key={tier} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                  {tier}
                </span>
              ))}
            </div>
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border bg-background/90 p-2 text-xs backdrop-blur">
              <p className="font-semibold text-muted-foreground">Edge type</p>
              {[['#7c3aed', 'collaboration'], ['#3b82f6', 'audience overlap'], ['#6b7280', 'niche affinity']].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto">
          {/* Clusters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Clusters ({graphData?.clusters.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(graphData?.clusters ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.nodeIds.length} creators</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Node detail */}
          {selectedNode ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{selectedNode.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <NodeDetail node={selectedNode} data={graphData!} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-xs text-muted-foreground">
                Click a node to inspect creator details
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Graph stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nodes</span>
                <span className="font-medium">{graphData?.nodes.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edges</span>
                <span className="font-medium">{graphData?.edges.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg connections</span>
                <span className="font-medium">
                  {graphData && graphData.nodes.length
                    ? ((graphData.edges.length * 2) / graphData.nodes.length).toFixed(1)
                    : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
