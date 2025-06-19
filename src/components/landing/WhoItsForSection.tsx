import { AnimatedTransition } from '@/components/AnimatedTransition';
import { Users, Building, User, Target } from 'lucide-react';

interface WhoItsForSectionProps {
  show: boolean;
}

export const WhoItsForSection = ({ show }: WhoItsForSectionProps) => {
  const userTypes = [
    {
      icon: <User size={32} className="text-primary" />,
      title: "Solo coaches & creators",
      description: "Build your personal brand and get 5-10 warm conversations per week"
    },
    {
      icon: <Building size={32} className="text-primary" />,
      title: "Boutique agencies",
      description: "Scale your client acquisition without hiring a full-time outreach team"
    },
    {
      icon: <Target size={32} className="text-primary" />,
      title: "Startup founders",
      description: "Focus on product development while automating your lead generation"
    },
    {
      icon: <Users size={32} className="text-primary" />,
      title: "Anyone doing their own prospecting",
      description: "Purpose-built for anyone who hates manual outreach but needs results"
    }
  ];

  return (
    <AnimatedTransition show={show} animation="slide-up" duration={600}>
      <div className="py-16 md:py-24">
        <div className="flex flex-col items-center text-center gap-2 mb-12">
          <h2 className="text-4xl font-bold text-blue-600 md:text-6xl">Designed for Founders, Coaches & Agencies</h2>
          <p className="text-foreground max-w-3xl text-xl md:text-2xl mt-2">
            Purpose-built for anyone who needs 5–10 warm conversations per week but hates manual outreach.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {userTypes.map((type, index) => (
            <div key={index} className="flex items-start p-6 rounded-xl glass-panel hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mr-6 flex-shrink-0">
                {type.icon}
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">{type.title}</h3>
                <p className="text-muted-foreground">{type.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimatedTransition>
  );
};