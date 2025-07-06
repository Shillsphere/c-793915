import { Button } from '@/components/ui/button';
import { AnimatedTransition } from '@/components/AnimatedTransition';
import { useState } from 'react';
import { WaitlistModal } from '../waitlist/WaitlistModal';
import { CountdownTimer } from "@/components/CountdownTimer";
import { VideoPlayer } from "@/components/VideoPlayer";

interface HeroSectionProps {
  showTitle: boolean;
}
export const HeroSection = ({
  showTitle
}: HeroSectionProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Fixed launch date: 36 hours from July 6, 2025 03:58:57 UTC
  const launchDate = new Date('2025-07-07T15:58:57Z');
  
  return <div className="py-20 md:py-28 flex flex-col items-center text-center">
      {/* Hero content starts */}
      <AnimatedTransition show={showTitle} animation="slide-up" duration={600}>
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Title first */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 bg-clip-text text-blue-600 md:text-7xl leading-tight text-center">
            Instant LinkedIn outreach.<br className="hidden sm:block" /> Just tell us <em>who</em>, have AI do the rest.
          </h1>
          
          {/* Sub-headline second */}
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mt-4 mb-8 animate-fade-in text-center">
            Define your ideal audience once and watch connections, replies and meetings roll in automatically.
          </p>

          {/* Product demo video. Replace /demo.mp4 with your own recording in public/ */}
          <div className="w-full max-w-3xl aspect-video rounded-xl overflow-hidden mb-10 shadow-lg">
            <VideoPlayer src="/demo.mp4" className="w-full h-full object-cover" />
          </div>
          
          {/* Call-to-action */}
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full px-8 py-6 text-base font-medium bg-primary hover:bg-primary/90 transition-all duration-300"
          >
            Join Early Access – $59/month
          </Button>

          {/* Countdown directly beneath CTA */}
          <div className="mt-4 flex flex-col items-center">
            <p className="text-xs uppercase tracking-wider text-primary/80 mb-1">Product launches in</p>
            <CountdownTimer
              target={launchDate}
              className="text-2xl sm:text-3xl font-bold text-primary"
            />
          </div>
        </div>

        <WaitlistModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </AnimatedTransition>
    </div>;
};