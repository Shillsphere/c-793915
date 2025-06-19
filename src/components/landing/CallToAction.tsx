import { Button } from '@/components/ui/button';
import { AnimatedTransition } from '@/components/AnimatedTransition';
interface CallToActionProps {
  show: boolean;
}
export const CallToAction = ({
  show
}: CallToActionProps) => {
  return <AnimatedTransition show={show} animation="slide-up" duration={600}>
      <div className="py-16 md:py-24 text-primary-foreground rounded-2xl text-center bg-blue-600">
        <h2 className="text-4xl font-bold mb-4 md:text-6xl">Join the 50-seat beta →</h2>
        <p className="text-xl mb-10">$59/mo starter pricing · Cancel anytime</p>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base font-medium bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10 transition-all duration-300">
            Join linkdms Waitlist
          </Button>
        </div>
      </div>
    </AnimatedTransition>;
};