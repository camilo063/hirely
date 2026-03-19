import {
  HeroSection,
  ProblemSection,
  HowItWorksSection,
  ModulesSection,
  ScoringSection,
  IntegrationsSection,
  PublicPortalsSection,
  TestimonialsSection,
  CtaSection,
  Navbar,
  FooterSection,
} from '@/components/landing';

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <div id="problem"><ProblemSection /></div>
      <HowItWorksSection />
      <div id="modules"><ModulesSection /></div>
      <ScoringSection />
      <div id="integrations"><IntegrationsSection /></div>
      <PublicPortalsSection />
      <TestimonialsSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
