import { Button } from '@/components/ui/button';
import { AnimatedTransition } from '@/components/AnimatedTransition';
import { useState } from 'react';
import { WaitlistModal } from '../waitlist/WaitlistModal';
interface HeroSectionProps {
  showTitle: boolean;
}
export const HeroSection = ({
  showTitle
}: HeroSectionProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return <div className="py-20 md:py-28 flex flex-col items-center text-center">
      <AnimatedTransition show={showTitle} animation="slide-up" duration={600}>
        {/* Title first */}
        <h1 className="text-4xl sm:text-5xl font-bold mb-6 bg-clip-text text-blue-600 md:text-7xl">
          The AI DM Engine for LinkedIn
        </h1>
        
        {/* Interactive text second */}
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in">
          linkdms writes, personalises and drip-sends 20 warm LinkedIn messages a day while you focus on real work.
        </p>
        
        {/* Call to action last */}
        <Button size="lg" onClick={() => setIsModalOpen(true)} className="rounded-full px-8 py-6 text-base font-medium bg-primary hover:bg-primary/90 transition-all duration-300">
          Get Early Access
        </Button>

        <WaitlistModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </AnimatedTransition>
    </div>;
};