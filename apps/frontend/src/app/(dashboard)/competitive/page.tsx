'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, XCircle, AlertTriangle, Sparkles, ShieldCheck,
  DollarSign, BarChart2, Lock, Zap, ClipboardList,
  Link as LinkIcon,
} from 'lucide-react';
import Link from 'next/link';

// ─── Competitor data ────────────────────────────────────────────────────────────

const competitors = [
  {
    name: 'Opendorse',
    url: 'https://opendorse.com',
    tagline: 'NIL deals platform for athletes, fans & brands',
    pitch: 'Athlete influencer marketing at scale. Discovery, social publishing, deal execution, compliance reporting. Widely adopted across D1 programs.',
    featured: [<Badge variant="outline" key="f1">Marketplace</Badge>, <Badge variant="outline" key="f2">Compliance reporting</Badge>],
    absent: [<Badge variant="secondary" key="a1">Real-time negotiation</Badge>, <Badge variant="secondary" key="a2">AI contract risk pre-signature</Badge>, <Badge variant="secondary" key="a3">Fraud detection service</Badge>, <Badge variant="secondary" key="a4">Migration from Opendorse</Badge>],
    conicKiller: 'Opendorse is a marketplace with a compliance reporting surface. Conic discovers the deal, AI-risk-scores it before signature, negotiates clause-by-clause, and pays out via Dwolla — and imports your Opendorse roster on day one.',
    owned: ['Marketplace discovery', 'Contract execution', 'Payments', 'Compliance reporting'],
    killEdge: ['Real-time deal-room negotiation with AI risk scoring on every clause change', 'AI contract generation + clause library', 'Fraud detection (fake followers, engagement pods, payment structuring, identity)', 'OPENDORSE_EXPORT importer — bring your existing roster'],
    conicHas: true,
  },
  {
    name: 'Teamworks / INFLCR',
    url: 'https://teamworks.com',
    tagline: 'The Operating System for Sports',
    pitch: 'Compliance ledgers, disclosure mechanisms, brand-matching. Embedded in the broader Teamworks OS. 520+ collegiate athletic departments.',
    featured: [<Badge variant="outline" key="f3">Compliance ledger</Badge>, <Badge variant="outline" key="f4">Disclosure mechanisms</Badge>, <Badge variant="outline" key="f5">Brand-matching</Badge>],
    absent: [<Badge variant="secondary" key="a5">Real-time negotiation</Badge>, <Badge variant="secondary" key="a6">AI contract risk</Badge>, <Badge variant="secondary" key="a7">Fraud detection</Badge>, <Badge variant="secondary" key="a8">AI matchmaking with fraud weighting</Badge>, <Badge variant="secondary" key="a9">Migration from Teamworks</Badge>],
    conicKiller: 'INFLCR gives compliance officers a ledger. Conic gives them a ledger plus a fraud layer plus an AI contract risk scorer plus real-time negotiation — and imports your INFLCR data on day one.',
    owned: ['Compliance ledger', 'Disclosure mechanisms'],
    killEdge: ['Fraud detection service (port 8008) — 3 engines, 7 signals', 'AI matchmaking with 30% fraud weighting + CPM rate estimates', 'AI contract risk scoring with validated flags whitelist', 'TEAMWORKS_EXPORT importer'],
    conicHas: true,
  },
  {
    name: 'MOGL',
    url: 'https://mogl.online',
    tagline: 'The AI platform redefining athlete influencer marketing',
    pitch: 'AI-powered athlete matching, built-in contracts & payments, deliverable review, real-time ROI. "Keep 100% of what you earn."',
    featured: [<Badge variant="outline" key="f6">AI matching</Badge>, <Badge variant="outline" key="f7">Contracts & payments</Badge>, <Badge variant="outline" key="f8">ROI tracking</Badge>, <Badge variant="outline" key="f9">Keep 100%</Badge>],
    absent: [<Badge variant="secondary" key="a10">Fraud detection service</Badge>, <Badge variant="secondary" key="a11">Deal-room negotiation</Badge>, <Badge variant="secondary" key="a12">AI contract generation</Badge>, <Badge variant="secondary" key="a13">Earnings intelligence</Badge>, <Badge variant="secondary" key="a14">Collective fund lifecycle</Badge>],
    conicKiller: 'MOGL\'s hero claim is "keep 100% of what you earn." Conic matches that on payout and adds a fraud detection service that separately scores fake followers, engagement pods, payment structuring, and identity — so the brand knows the reach is real before it pays.',
    owned: ['AI matching', 'Contracts & payments', 'ROI tracking'],
    killEdge: ['Dedicated fraud-detection-ai service (port 8008)', 'Deal-room clause-level negotiation with AI risk scoring', 'AI contract generation (contract-ai port 8001)', 'Earnings intelligence (YTD, pipeline, 15.3% tax estimate, role-aware)', 'Collective portal with atomic fund-availability validation on distributions'],
    conicHas: true,
  },
  {
    name: 'Athliance',
    url: 'https://athliance.com',
    tagline: 'The leading NIL compliance solution',
    pitch: 'Automated compliance safeguard for universities, collectives, and agencies. Fair market value tracking. Compliance violation prevention. "Athletes don\'t need to do anything."',
    featured: [<Badge variant="outline" key="f10">Automated compliance</Badge>, <Badge variant="outline" key="f11">FMV tracking</Badge>, <Badge variant="outline" key="f12">Safeguard</Badge>],
    absent: [<Badge variant="secondary" key="a15">AI-generated compliance reports (3 audiences)</Badge>, <Badge variant="secondary" key="a16">Guardian approval with IP capture</Badge>, <Badge variant="secondary" key="a17">AI contract risk scoring</Badge>, <Badge variant="secondary" key="a18">Zero-login deal intake (DealLink)</Badge>, <Badge variant="secondary" key="a19">50-state rules database</Badge>],
    conicKiller: 'Athliance\'s headline is "athletes don\'t need to do anything." Conic delivers that same hands-off compliance — guardian approval, disclosure workflow, AI risk flags, cap enforcement — and adds AI-generated compliance reports written for three audiences (officer, AD, NCAA submission) from the same data.',
    owned: ['Automated compliance', 'FMV tracking'],
    killEdge: ['AI compliance reports for 3 audiences: compliance_officer, athletic_director, ncaa_submission', 'Guardian approval with email invite, expiry, IP capture, auto-apply to deals + contracts', 'University compliance command center with compliance rate %', 'AI contract risk scoring (0-100) before signature'],
    conicHas: true,
    partial: ['Zero-login deal intake (DealLink-style) — spec written, not built', '50-state NIL legislation database — AI-prompt-based today'],
  },
  {
    name: 'Spry',
    url: 'https://spry.so',
    tagline: 'All-in-one intercollegiate athletics management',
    pitch: 'Compliance, scheduling, roster, paperwork, communication. "75% tasks completed faster." Trusted by hundreds of athletic departments.',
    featured: [<Badge variant="outline" key="f13">Compliance</Badge>, <Badge variant="outline" key="f14">Scheduling</Badge>, <Badge variant="outline" key="f15">Roster</Badge>, <Badge variant="outline" key="f16">Paperwork</Badge>, <Badge variant="outline" key="f17">Communication</Badge>],
    absent: [<Badge variant="secondary" key="a20">NIL deal execution depth</Badge>, <Badge variant="secondary" key="a21">Contract negotiation</Badge>, <Badge variant="secondary" key="a22">Fraud detection</Badge>, <Badge variant="secondary" key="a23">AI matchmaking</Badge>, <Badge variant="secondary" key="a24">Earnings intelligence</Badge>],
    conicKiller: 'Spry wins on breadth — it\'s the athletic department\'s everything-app. Conic is narrower and deeper on the NIL money flow: discovery, negotiation, compliance, fraud, payments, earnings intelligence. If your priority is NIL deal execution and athlete monetization, Spry doesn\'t touch the contract negotiation or fraud layer.',
    owned: ['Compliance (broader athletic ops)', 'Scheduling', 'Roster', 'Paperwork', 'Communication'],
    killEdge: ['Real-time deal negotiation with AI risk scoring', 'Fraud detection service', 'AI matchmaking with fraud-weighted scoring', 'Earnings intelligence dashboard (YTD, pipeline, tax estimate)', 'FMV assessment with methodology + confidence + comparable deals'],
    conicHas: false,
    partial: ['Spry covers non-NIL athletic operations Conic does not target — deliberate scope difference, not a gap'],
  },
  {
    name: 'TheLinkU',
    url: 'https://thelinku.com',
    tagline: 'All-in-one NIL ecosystem',
    pitch: 'Revenue sharing, contract management, membership programs, GM platform for fund distribution, athlete shop, opportunities platform. LinkSuite is their engine.',
    featured: [<Badge variant="outline" key="f18">RevShare execution</Badge>, <Badge variant="outline" key="f19">Revenue tracking</Badge>, <Badge variant="outline" key="f20">Fund distribution</Badge>, <Badge variant="outline" key="f21">Athlete shop</Badge>],
    absent: [<Badge variant="secondary" key="a25">Deal-room negotiation</Badge>, <Badge variant="secondary" key="a26">AI contract risk</Badge>, <Badge variant="secondary" key="a27">Fraud detection</Badge>, <Badge variant="secondary" key="a28">Earnings intelligence</Badge>, <Badge variant="secondary" key="a29">AI matchmaking</Badge>],
    conicKiller: 'TheLinkU built a solid revshare and fund-distribution story. Conic\'s collective portal does that plus real-time deal negotiation, AI risk scoring on every deal, fraud detection, and a full earnings intelligence dashboard — and imports your roster via CSV on day one.',
    owned: ['RevShare execution', 'Revenue tracking', 'Fund distribution (partial)'],
    killEdge: ['Collective portal — full lifecycle, atomic fund-availability validation on distributions', 'Real-time deal negotiation with AI risk scoring', 'Fraud detection service', 'Earnings intelligence (YTD, pipeline, tax estimate, role-aware)', 'AI matchmaking with fraud-weighted scoring'],
    conicHas: true,
    partial: ['Athlete shop / e-commerce — not yet built (deferred)', 'Membership / patron program — not yet built'],
  },
  {
    name: 'Framework NIL',
    url: 'https://frameworknil.com',
    tagline: 'NIL compliance infrastructure',
    pitch: 'Education, disclosures, reporting. One platform for high school, NAIA, NCAA. DealLink (zero-login), AI Assist (Claude contract review with risk scoring), versioned disclosures, 50-state laws database, SCORM courses, multi-org hierarchy, audit trail.',
    featured: [<Badge variant="outline" key="f22">DealLink (zero-login)</Badge>, <Badge variant="outline" key="f23">AI contract review</Badge>, <Badge variant="outline" key="f24">Versioned disclosures</Badge>, <Badge variant="outline" key="f25">50-state laws DB</Badge>, <Badge variant="outline" key="f26">SCORM courses</Badge>, <Badge variant="outline" key="f27">Multi-org hierarchy</Badge>, <Badge variant="outline" key="f28">Audit trail</Badge>],
    absent: [<Badge variant="secondary" key="a30">Real-time deal negotiation</Badge>, <Badge variant="secondary" key="a31">Fraud detection service</Badge>, <Badge variant="secondary" key="a32">Collective fund management</Badge>, <Badge variant="secondary" key="a33">Earnings intelligence</Badge>, <Badge variant="secondary" key="a34">Athlete discovery marketplace</Badge>, <Badge variant="secondary" key="a35">AI contract generation</Badge>, <Badge variant="secondary" key="a36">Data import from competitors</Badge>],
    conicKiller: 'Framework NIL owns the compliance-only conversation. Conic has the compliance engine — disclosures, AI risk scoring, FMV, eligibility, audit trail, guardian approval, compliance reports — and layers on everything compliance-only tools can\'t offer: real-time deal negotiation, AI contract generation, fraud detection, collective fund management, earnings intelligence, and athlete discovery. For a school that wants compliance AND a path to actual deals, Framework NIL is a compliance tool; Conic is the platform.',
    owned: ['AI contract review (risk scoring)', 'Audit trail', 'Role-based access', 'Automated reporting'],
    killEdge: ['Deal-room real-time negotiation with AI risk scoring on every clause change', 'Fraud detection service (port 8008)', 'AI contract generation (contract-ai)', 'Collective portal with atomic fund-availability validation', 'Earnings intelligence dashboard', 'NIL marketplace with FMV display + verified badges', 'Data importers from Opendorse + Teamworks'],
    conicHas: true,
    partial: [
      'Zero-login deal intake (DealLink) — spec written; Conic\'s version fans out to guardian approval + AI re-analysis on every contribution',
      '50-state NIL legislation database — AI-prompt-based today; explicit rules DB is the next build',
      'Versioned disclosures — DealLinkContribution snapshot gives immutable per-version records; full NilDisclosureVersion model is broader',
      'SCORM learning courses — not yet built',
      'Multi-org hierarchy (state association → school → athlete) — not yet built',
    ],
  },
];

// ─── Kill-stat cards ────────────────────────────────────────────────────────────

const killCards = [
  {
    icon: Sparkles,
    title: 'Real-time deal-room negotiation',
    body: 'Clause-level proposals, accept/reject/counter, AI risk-scores every change against the contract before anyone agrees. No competitor has a deal room — everyone else is sign-or-nothing.',
    endpoint: 'POST /deal-room/open · PATCH .../proposals/:id/accept|reject|counter',
    existing: true,
  },
  {
    icon: ShieldCheck,
    title: 'AI contract risk scoring before signature',
    body: 'Every contract is generated and risk-scored by contract-ai (port 8001). The risk endpoint validates flags against a whitelist and raises 502 on failure — no silent fallback. No competitor scores a contract before the athlete signs it.',
    endpoint: 'POST /contract-ai/generate · POST /contract-ai/risk',
    existing: true,
  },
  {
    icon: Lock,
    title: 'Dedicated fraud detection service',
    body: 'Three independent engines combine into a single 0-100 fraud score: fake followers (engagement rate vs benchmark, F/F ratio, spikes), engagement pods (CoV < 0.2), payment structuring (clustered below $10k BSA threshold), round-dollar clustering (>70%), identity mismatch, bot-pattern handles. No competitor exposes a fraud score.',
    endpoint: 'POST /fraud/analyze · POST /identity/check · POST /engagement/analyze',
    existing: true,
  },
  {
    icon: ClipboardList,
    title: 'Data importers from Opendorse & Teamworks',
    body: 'OPENDORSE_EXPORT and TEAMWORKS_EXPORT job types, per-row error tracking, GENERIC_CSV with mapping config. A school on any competitor can bring its roster to Conic without manual re-entry. No competitor offers migration from a competitor.',
    endpoint: 'POST /imports · GET /imports/:id',
    existing: true,
  },
  {
    icon: BarChart2,
    title: 'Compliance reports for 3 audiences',
    body: 'One data set, three AI-narrated reports: compliance_officer (detailed, flags concerns), athletic_director (strategic, institutional risk), ncaa_submission (formal regulatory language). Framework NIL can\'t generate an NCAA-submission narrative from the same data.',
    endpoint: 'POST /nil/reports · GET /nil/reports',
    existing: true,
  },
  {
    icon: DollarSign,
    title: 'Collective fund lifecycle with atomic safety',
    body: 'Create collectives, add/remove members with share %, donor deduplication via upsert, proportional distributions that validate fund availability before distributing — all inside atomic Prisma transactions. No partial writes if a distribution fails mid-way.',
    endpoint: 'POST /collectives · POST /collectives/:id/distributions',
    existing: true,
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CompetitivePage() {
  const [activeTab, setActiveTab] = useState('all');

  const filtered = competitors.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'dead') return c.conicHas === true;
    if (activeTab === 'alive') return c.conicHas !== true || (c.partial && c.partial.length > 0);
    if (activeTab === 'framework') return c.name === 'Framework NIL';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
            <Zap className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Conic vs. the NIL Incumbents</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Every other player in NIL software owns one slice of the stack — compliance, marketplace, or operations.
          None of them combine deal discovery, real-time contract negotiation, AI risk scoring before signature, fraud
          detection, collective fund management, and athlete earnings intelligence in one platform. And none of them will
          migrate your existing data from a competitor.
        </p>
        <p className="text-sm text-muted-foreground">
          Source: audited code in{' '}
          <Link href="https://github.com/mkallberg21/Conic" target="_blank" className="text-accent underline underline-offset-2">
            mkallberg21/Conic
          </Link>
          . Competitor claims from public sites as of Sept 2026. Gaps reflect code audit, not README claims.
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All competitors</TabsTrigger>
          <TabsTrigger value="dead">Already beaten on tech</TabsTrigger>
          <TabsTrigger value="alive">Still have angles</TabsTrigger>
          <TabsTrigger value="framework">Framework NIL (closest threat)</TabsTrigger>
        </TabsList>

        {/* ── All competitors ──────────────────────────────────────────────────── */}
        <TabsContent value="all" className="space-y-6 mt-6">
          {competitors.map((c) => (
            <CompetitorCard key={c.name} competitor={c} />
          ))}
        </TabsContent>

        {/* ── Already beaten ───────────────────────────────────────────────────── */}
        <TabsContent value="dead" className="space-y-6 mt-6">
          <p className="text-muted-foreground -mt-4">
            These competitors are already exposed on every dimension that matters. Conic has deeper feature sets
            plus a migration importer from each one — which is the switch they can't defend against.
          </p>
          {competitors.filter((c) => c.conicHas === true).map((c) => (
            <CompetitorCard key={c.name} competitor={c} />
          ))}
        </TabsContent>

        {/* ── Still alive ──────────────────────────────────────────────────────── */}
        <TabsContent value="alive" className="space-y-6 mt-6">
          <p className="text-muted-foreground -mt-4">
            These competitors still own a narrative Conic hasn't fully claimed yet. The gaps are real — fix them
            in order and each one falls.
          </p>
          {competitors.filter((c) => c.conicHas !== true || (c.partial && c.partial.length > 0)).map((c) => (
            <CompetitorCard key={c.name} competitor={c} />
          ))}
        </TabsContent>

        {/* ── Framework NIL ────────────────────────────────────────────────────── */}
        <TabsContent value="framework" className="space-y-6 mt-6">
          <FrameworkNILCard />
        </TabsContent>
      </Tabs>

      {/* ── Kill cards ──────────────────────────────────────────────────────────── */}
      <Separator />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">What Conic has that no competitor can claim</h2>
        <p className="text-sm text-muted-foreground">All of these are implemented in code, not aspirational.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {killCards.map((card) => (
            <KillCard key={card.title} card={card} />
          ))}
        </div>
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────────────────── */}
      <Card className="bg-accent/5 border-accent/20">
        <CardHeader>
          <CardTitle className="text-lg">What to do with this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-3">
            <li>
              Put this on a page — a <code className="rounded bg-muted px-1 py-0.5 text-xs">/competitive</code> route or a standalone marketing page that names each competitor and maps the kill shots.
              Right now the README leads with "the creator & athlete partnership OS" — a buyer searching for "NIL compliance software" never finds the compliance engine.
            </li>
            <li>
              Close the Framework NIL gaps first if schools are the target buyer — zero-login deal intake and the 50-state rules database are the two features that make a compliance officer pick Framework over anyone else.
            </li>
            <li>
              Submit the mobile app. CONIC by ALC already has 10 reviews and a 4.5★ rating in the Finance category on iOS. The Conic repo has a React Native + Expo app at 80% EAS readiness. That store presence is a marketing asset the repo doesn't currently claim.
            </li>
            <li>
              Get Dwolla live keys and apply the Terraform. These are the two "pending" items that make every "enterprise-ready" claim real.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function CompetitorCard({ competitor }: { competitor: (typeof competitors)[0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden transition-all hover:border-accent/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{competitor.name}</h3>
              {competitor.conicHas === true && (
                <Badge variant="destructive" className="text-xs">Already beaten on tech</Badge>
              )}
              {competitor.conicHas === false && (
                <Badge variant="outline" className="text-xs">Different market</Badge>
              )}
              {competitor.partial && competitor.partial.length > 0 && (
                <Badge variant="secondary" className="text-xs">Partial — gaps remain</Badge>
              )}
            </div>
            <CardDescription className="text-sm">
              <a
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:text-accent/80"
              >
                {competitor.url.replace(/https?:\/\//, '')}
              </a>
              {' · '}{competitor.tagline}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-accent"
          >
            {expanded ? 'Hide' : 'Read'} kill line
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{competitor.pitch}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              They have / we match
            </div>
            <div className="flex flex-wrap gap-1.5">
              {competitor.owned.map((o) => (
                <Badge variant="outline" key={o} className="text-xs">{o}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              They don&apos;t have
            </div>
            <div className="flex flex-wrap gap-1.5">
              {competitor.absent.map((a) => (
                <Badge variant="secondary" key={a.props.children as string} className="text-xs">{a.props.children as string}</Badge>
              ))}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-3 border-t">
            <div className="bg-accent/5 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-accent mb-1">
                <Zap className="h-3.5 w-3.5" />
                Conic kill line
              </div>
              <p className="text-sm text-foreground">{competitor.conicKiller}</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">Conic&apos;s edge on this competitor:</div>
              <ul className="space-y-1">
                {competitor.killEdge.map((e) => (
                  <li key={e} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>

            {competitor.partial && competitor.partial.map((p) => (
              <div key={p} className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/20">
                <div className="flex items-center gap-2 text-xs font-medium text-yellow-600 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Gap — Conic doesn&apos;t have this yet
                </div>
                <p className="text-sm text-foreground">{p}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FrameworkNILCard() {
  const gaps = [
    {
      title: 'Zero-login deal intake (DealLink)',
      status: 'Spec written · not built',
      color: 'text-yellow-600',
      icon: AlertTriangle,
      detail: 'Conic\'s DealLink spec fans out to guardian approval and AI re-analysis on every contribution — more powerful than Framework\'s form-only collection. See <a href="/competitive" className="text-accent underline underline-offset-2">/competitive</a> and the deallink-spec.',
    },
    {
      title: '50-state NIL legislation database',
      status: 'AI-prompt-based today',
      color: 'text-yellow-600',
      icon: AlertTriangle,
      detail: 'analyze-disclosure receives <code className="rounded bg-muted px-1 py-0.5 text-xs">state</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">division</code> but the AI prompt only says "Analyze for state-specific rules" — the AI knows the law from training data, not from a maintained rules table. Framework maintains an explicit searchable database.',
    },
    {
      title: 'Versioned disclosures (immutable snapshot)',
      status: 'Partial — DealLinkContribution snapshot',
      color: 'text-yellow-600',
      icon: AlertTriangle,
      detail: 'ContractVersion exists for contracts. NilDisclosure has no version history model. DealLink contributions snapshot fields per contribution, giving immutable records for DealLink-driven disclosures. A full NilDisclosureVersion model is a broader change.',
    },
    {
      title: 'SCORM learning courses',
      status: 'Not built',
      color: 'text-red-400',
      icon: XCircle,
      detail: 'Framework ships financial literacy curriculum with SCORM completion tracking. Conic has tax-documents but no athlete education curriculum.',
    },
    {
      title: 'Multi-org hierarchy',
      status: 'Not built',
      color: 'text-red-400',
      icon: XCircle,
      detail: 'University module manages universities, but there\'s no org-hierarchy model (state association → region → school → athletes). ScimToken exists for provisioning but hierarchy is flat. Framework sells this for state-wide rollouts.',
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">Framework NIL</h3>
              <Badge variant="secondary" className="text-xs">Closest pure-play threat</Badge>
            </div>
            <CardDescription className="text-sm">
              <a href="https://frameworknil.com" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80">
                frameworknil.com
              </a>
              {' · '}Education, disclosures, reporting. One platform for high school, NAIA, NCAA.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Framework NIL has deliberately built the compliance narrative that schools and orgs buy into. They are the closest
          competitor to Conic on compliance specifically — but they are a compliance-only tool. Every feature Framework sells
          that Conic also has is a point of differentiation; every gap is a real reason a compliance officer might still pick them.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Conic matches or beats
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['AI contract review with 0-100 risk scoring', 'Immutable audit trail', 'Role-based access (9 roles)', 'Automated reporting', 'AI compliance Q&A (recommendations per check)', 'Contract analysis for officers', 'Reasonableness / FMV check'].map((o) => (
                <Badge variant="outline" key={o} className="text-xs">{o}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              Framework has / Conic doesn&apos;t
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <Badge variant="secondary" key={g.title} className="text-xs">{g.title}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-accent/5 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-accent mb-2">
            <Zap className="h-3.5 w-3.5" />
            Why Conic still wins this head-to-head
          </div>
          <p className="text-sm text-foreground">
            Framework NIL is a compliance tool. A school that buys Framework NIL gets compliance and nothing else — no deal
            discovery, no negotiation, no fraud detection, no payments, no earnings intelligence. A school that buys Conic
            gets the compliance engine (with AI disclosure analysis, FMV, eligibility, audit trail, guardian approval, and
            compliance reports) <em>and</em> everything a compliance-only tool can't offer. For a school that wants compliance
            AND a path to actual deals, Framework NIL is a compliance tool; Conic is the platform.
          </p>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="text-xs font-medium text-foreground">Gaps to close (real reasons a compliance officer might still pick Framework NIL):</div>
          <div className="space-y-2">
            {gaps.map((g) => (
              <div key={g.title} className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <g.icon className={`h-3.5 w-3.5 ${g.color} mt-0.5 shrink-0`} />
                    <span className="text-sm font-medium text-foreground">{g.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{g.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: g.detail }} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KillCard({ card }: { card: (typeof killCards)[0] }) {
  const Icon = card.icon;
  return (
    <Card className="bg-muted/30 border-muted/50">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{card.title}</CardTitle>
            {card.endpoint && (
              <code className="text-xs text-muted-foreground mt-1 block rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                {card.endpoint}
              </code>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{card.body}</p>
        {!card.existing && (
          <Badge variant="destructive" className="mt-2 text-xs">Not yet built — gap</Badge>
        )}
      </CardContent>
    </Card>
  );
}
