import { useState, useEffect } from 'react';
import { useAnimateIn } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { Link, Upload, Edit, Play, Settings, MessageSquare, BarChart3, Shield } from 'lucide-react';
import { AnimatedTransition } from '@/components/AnimatedTransition';
import { WaitlistModal } from '@/components/waitlist/WaitlistModal';

const SetupStep = ({ 
  number, 
  title, 
  description,
  details 
}: { 
  number: number, 
  title: string, 
  description: string,
  details: string[]
}) => {
  return (
    <div className="relative mb-12">
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl z-10">
        {number}
      </div>
      <div className="pl-20">
        <h3 className="text-2xl font-bold mb-3 text-primary">{title}</h3>
        <p className="text-foreground/80 text-lg mb-4">{description}</p>
        <ul className="space-y-2">
          {details.map((detail, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary/60 mt-2 flex-shrink-0"></div>
              <span className="text-foreground/70">{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const FeatureCard = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode, 
  title: string, 
  description: string 
}) => {
  return (
    <div className="glass-panel p-6 rounded-lg">
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-foreground/80">{description}</p>
    </div>
  );
};

const HowPage = () => {
  const [loading, setLoading] = useState(true);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const showContent = useAnimateIn(false, 300);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent -z-10"></div>
      <div className="absolute top-1/3 right-0 w-[300px] h-[300px] rounded-full bg-primary/5 blur-3xl -z-10"></div>
      <div className="absolute bottom-1/3 left-0 w-[250px] h-[250px] rounded-full bg-accent/5 blur-3xl -z-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24">
        {/* Hero Section */}
        <AnimatedTransition show={showContent} animation="slide-up" duration={600}>
          <div className="flex flex-col items-center text-center mb-20">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-foreground">
              How linkdms Works
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              From zero to autopilot in three simple steps. Up to <strong>210 new connections and messages sent every week</strong> — no lists, no scraping.
            </p>
            
            <div className="glass-panel p-6 rounded-lg">
              <p className="text-lg text-primary font-medium">
                Top performing AI models for decision making and writing, Supabase for storage, Redis queue for send cadence, residential proxy rotation for safe login.
              </p>
            </div>
          </div>
        </AnimatedTransition>
        
        {/* Setup Process */}
        <AnimatedTransition show={showContent} animation="slide-up" duration={800}>
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">Getting Started with linkdms</h2>
            
            <div className="relative max-w-4xl mx-auto">
              <div className="absolute left-6 top-12 w-0.5 h-[calc(100%-60px)] bg-gradient-to-b from-primary via-primary/50 to-primary/20"></div>
              
              <SetupStep 
                number={1}
                title="Describe your audience"
                description="Say who you want to connect with — role, industry, location, seniority."
                details={[
                  "Example: 'FinTech founders in London'",
                  "No CSVs or manual lists required"
                ]}
              />
              
              <SetupStep 
                number={2}
                title="Press play"
                description="AI builds keyword variations, scans search pages and sends safe invites."
                details={[
                  "Random 3–12 min delays",
                  "30 connections per day (≈210 per week)",
                  "Local time-zone scheduling"
                ]}
              />
              
              <SetupStep 
                number={3}
                title="Relax & reply"
                description="When they accept, we wait 24 h then DM. Dashboard updates live."
                details={[
                  "Personalised follow-up with GPT-4o",
                  "Automatic pause on any reply",
                  "Full metrics: sent, accepted, replied, booked"
                ]}
              />
            </div>
          </div>
        </AnimatedTransition>
        
        {/* How It Works Under the Hood */}
        <AnimatedTransition show={showContent} animation="slide-up" duration={1000}>
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">What Happens Behind the Scenes</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon={<MessageSquare size={32} className="text-primary" />}
                title="AI Message Generation"
                description="Top performing AI models analyze each prospect's profile and recent activity to craft personalized messages that feel human-written."
              />
              
              <FeatureCard
                icon={<Settings size={32} className="text-primary" />}
                title="Smart Scheduling"
                description="Redis queue manages send timing with randomized delays and local timezone awareness to mimic natural behavior."
              />
              
              <FeatureCard
                icon={<Shield size={32} className="text-primary" />}
                title="Account Protection"
                description="Residential proxy rotation and behavioral mimicking keep your LinkedIn account safe from automated detection."
              />
              
              <FeatureCard
                icon={<BarChart3 size={32} className="text-primary" />}
                title="Real-time Analytics"
                description="Track sent, opened, replied, and booked metrics with live dashboard updates and CSV export capabilities."
              />
            </div>
          </div>
        </AnimatedTransition>
        
        {/* Safety Features */}
        <AnimatedTransition show={showContent} animation="slide-up" duration={1200}>
          <div className="glass-panel p-8 rounded-lg mb-20">
            <h2 className="text-3xl font-bold text-center mb-8">Built-in Safety Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-500">30</span>
                </div>
                <h3 className="font-bold text-lg mb-2">Daily Invite Limit</h3>
                <p className="text-foreground/80">Hard cap at 30 invites per day — that's 210 every week.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-500">3-12</span>
                </div>
                <h3 className="font-bold text-lg mb-2">Minute Delays</h3>
                <p className="text-foreground/80">Random delays between messages to simulate human typing and reading patterns</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-500">24h</span>
                </div>
                <h3 className="font-bold text-lg mb-2">Follow-up Delay</h3>
                <p className="text-foreground/80">Default 24-hour wait before the personalised DM — feels natural.</p>
              </div>
            </div>
          </div>
        </AnimatedTransition>
        
        {/* Call to Action */}
        <AnimatedTransition show={showContent} animation="slide-up" duration={1500}>
          <div className="py-16 md:py-24 text-primary-foreground rounded-2xl text-center bg-blue-600 mt-20">
            <h2 className="text-4xl font-bold mb-4 md:text-6xl">Ready to automate your outreach?</h2>
            <p className="text-xl mb-10">Join the waitlist to get early access.</p>
            <Button 
              size="lg" 
              className="rounded-full px-8 py-6 text-lg"
              onClick={() => setIsWaitlistModalOpen(true)}
            >
              Get Early Access
            </Button>
          </div>
        </AnimatedTransition>
      </div>
      
      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />
    </div>
  );
};

export default HowPage;