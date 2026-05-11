import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, FileText, CheckSquare, CreditCard, BarChart2, Stars } from 'lucide-react';

const features = [
  { icon: FileText, title: 'AI-Powered Contracts', description: 'Generate contracts instantly with GPT-4o. Auto-risk scoring, e-signatures, and version history.' },
  { icon: CheckSquare, title: 'Deliverable Verification', description: 'AI automatically verifies hashtags, mentions, URLs, and content quality against contract terms.' },
  { icon: CreditCard, title: 'Stripe Connect Payments', description: 'Milestone-based payment release with fraud detection and instant creator payouts.' },
  { icon: BarChart2, title: 'ROI Analytics', description: 'Real-time campaign analytics with AI-generated debriefs and performance predictions.' },
  { icon: Stars, title: 'Creator Graph', description: 'ML-powered creator discovery with audience authenticity scoring and influence clustering.' },
  { icon: Zap, title: 'Campaign Automation', description: 'AI agent generates campaign timelines, assigns tasks, and sends automated weekly summaries.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Conic</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Get started</Link></Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-8 py-24 text-center">
        <Badge className="mb-4">AI-Powered Creator Platform</Badge>
        <h1 className="mb-6 text-5xl font-bold tracking-tight">
          The Operating System for<br />Creator Partnerships
        </h1>
        <p className="mb-8 text-xl text-muted-foreground max-w-2xl mx-auto">
          Conic automates contracts, deliverables, payments, and analytics for brands and creators — powered by 5 specialized AI microservices.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild><Link href="/register">Start free trial</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/login">Sign in</Link></Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-8 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">Everything you need, automated</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 px-8 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold">Ready to automate your creator ops?</h2>
        <p className="mb-8 text-muted-foreground">Join brands and creators using Conic to close deals faster.</p>
        <Button size="lg" asChild><Link href="/register">Create free account</Link></Button>
      </section>

      <footer className="border-t px-8 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Conic. All rights reserved.
      </footer>
    </div>
  );
}
