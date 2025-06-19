import { AnimatedTransition } from '@/components/AnimatedTransition';
import { Clock, AlertTriangle, TrendingDown } from 'lucide-react';

interface ProblemSectionProps {
  show: boolean;
}

export const ProblemSection = ({ show }: ProblemSectionProps) => {
  return (
    <AnimatedTransition show={show} animation="slide-up" duration={600}>
      <div className="py-16 md:py-24">
        <div className="flex flex-col items-center text-center gap-2 mb-12">
          <h2 className="text-4xl font-bold text-blue-600 md:text-6xl">Why linkdms exists</h2>
          <p className="text-foreground max-w-3xl text-xl md:text-2xl mt-2">
            LinkedIn is the best free lead channel on the planet—yet most founders still copy-paste the same DM 40 times every morning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Clock size={32} className="text-red-500" />
            </div>
            <h3 className="font-bold mb-2">Manual DMs waste 5h/week</h3>
            <p className="text-sm text-muted-foreground">Copy-pasting the same message to dozens of prospects every day</p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="font-bold mb-2">Still get flagged</h3>
            <p className="text-sm text-muted-foreground">LinkedIn's spam detection catches repetitive patterns</p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <TrendingDown size={32} className="text-red-500" />
            </div>
            <h3 className="font-bold mb-2">Low response rates</h3>
            <p className="text-sm text-muted-foreground">Generic messages fail to connect with prospects</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xl text-primary font-medium">
            linkdms turns that grind into a 10-minute review ritual, keeping your outreach human and your account safe.
          </p>
        </div>
      </div>
    </AnimatedTransition>
  );
};