import { ShieldCheck, Lock, KeyRound, Eye, Sparkles } from 'lucide-react';
import { AnimatedTransition } from '@/components/AnimatedTransition';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
interface SecuritySectionProps {
  show: boolean;
}
export const SecuritySection = ({
  show
}: SecuritySectionProps) => {
  const securityFeatures = [{
    icon: <Lock size={24} />,
    title: "Encrypted LinkedIn Session",
    description: "Your LinkedIn session cookie is encrypted at rest."
  }, {
    icon: <KeyRound size={24} />,
    title: "No Data Storage",
    description: "We never store or sell prospect data."
  }, {
    icon: <Eye size={24} />,
    title: "Safe Daily Limits",
    description: "Built-in daily limits and randomised timing keep your profile in the green."
  }];
  const securityFAQs = [{
    question: "Will this get my LinkedIn account banned?",
    answer: "No. We built linkdms after getting warnings ourselves. Our system mimics human behavior with randomized timing, local time zones, and hard caps under LinkedIn's limits."
  }, {
    question: "How many messages can I send per day?",
    answer: "linkdms caps at 30 messages per day with randomized 3-12 minute delays to stay well under LinkedIn's detection thresholds."
  }, {
    question: "Do you store my LinkedIn data?",
    answer: "No. We only store encrypted session cookies to maintain your connection. All prospect data is processed in real-time and never stored on our servers."
  }, {
    question: "What happens if someone replies?",
    answer: "The sequence automatically stops for that prospect the moment they reply, ensuring only human conversations continue."
  }];
  return <AnimatedTransition show={show} animation="slide-up" duration={600}>
      <div className="mt-24 mb-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-1.5 bg-muted rounded-xl mb-4">
            <div className="bg-background px-4 py-2 rounded-lg shadow-sm">
              <ShieldCheck size={22} className="inline-block mr-2 text-primary" />
              <span className="font-semibold">Security & Privacy</span>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Privacy & account safety</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            We built linkdms for ourselves after getting a "Slow down" warning from LinkedIn. Since switching, none of our beta users have been throttled or restricted.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-12">
          <div>
            <h3 className="text-2xl font-bold mb-4 flex items-center">
              <Sparkles size={22} className="text-primary mr-2" />
              Automation that plays nice with LinkedIn
            </h3>
            <p className="text-muted-foreground mb-6">
              linkdms never spams. It personalises with the prospect's headline and last post, sends during local business hours, and pauses the moment a human replies.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 text-primary flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium mb-1">SOC 2 Type II Certified</h4>
                  <p className="text-sm text-muted-foreground">Our infrastructure and processes meet rigorous security standards</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 text-primary flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium mb-1">GDPR & CCPA Compliant</h4>
                  <p className="text-sm text-muted-foreground">We respect your rights and comply with global privacy regulations</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 text-primary flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Regular Security Audits</h4>
                  <p className="text-sm text-muted-foreground">We conduct regular penetration testing and security reviews</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 text-primary flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Data Export & Portability</h4>
                  <p className="text-sm text-muted-foreground">Download your data at any time in standard formats</p>
                </div>
              </div>
            </div>
            
            
          </div>
          
          <div className="glass-panel rounded-xl p-6 md:p-8">
            <h3 className="text-xl font-bold mb-6">Security FAQ</h3>
            
            <Accordion type="single" collapsible className="w-full">
              {securityFAQs.map((faq, idx) => <AccordionItem key={idx} value={`item-${idx}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>)}
            </Accordion>
          </div>
        </div>
        
        
      </div>
    </AnimatedTransition>;
};