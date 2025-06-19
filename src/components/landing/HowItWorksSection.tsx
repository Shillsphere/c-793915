import { AnimatedTransition } from '@/components/AnimatedTransition';
import { Link, Upload, Edit, Play } from 'lucide-react';

interface HowItWorksSectionProps {
  show: boolean;
}

export const HowItWorksSection = ({ show }: HowItWorksSectionProps) => {
  const steps = [
    {
      icon: <Link size={32} className="text-primary" />,
      title: "Connect",
      description: "Capture your LinkedIn session with one click."
    },
    {
      icon: <Upload size={32} className="text-primary" />,
      title: "Upload list",
      description: "Drag in a CSV or paste a search URL."
    },
    {
      icon: <Edit size={32} className="text-primary" />,
      title: "Personalise",
      description: "Drop your favourite opener; AI fills the details."
    },
    {
      icon: <Play size={32} className="text-primary" />,
      title: "Activate",
      description: "linkdms schedules ≤ 20 messages/day and stops on reply."
    }
  ];

  return (
    <AnimatedTransition show={show} animation="slide-up" duration={600}>
      <div className="py-16 md:py-24">
        <div className="flex flex-col items-center text-center gap-2 mb-12">
          <h2 className="text-4xl font-bold text-blue-600 md:text-6xl">How linkdms works</h2>
          <p className="text-foreground max-w-3xl text-xl md:text-2xl mt-2">
            Set it once, review replies over coffee, close your laptop. Outreach handled.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center text-center relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {step.icon}
              </div>
              <div className="absolute -top-2 -left-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                {index + 1}
              </div>
              <h3 className="font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-8 h-0.5 bg-primary/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </AnimatedTransition>
  );
};