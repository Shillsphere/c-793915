
import { BrainCircuit, Search, FileText, LinkIcon, Database, Network, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedTransition } from '@/components/AnimatedTransition';

interface FeatureSectionProps {
  showFeatures: boolean;
}

export const FeatureSection = ({ showFeatures }: FeatureSectionProps) => {
  const features = [
    {
      icon: <BrainCircuit size={24} />,
      title: "Human-sounding AI copy",
      description: "Mentions their headline & last post.",
      color: "from-blue-400/60 to-blue-600/40"
    },
    {
      icon: <Search size={24} />,
      title: "Safe-send engine",
      description: "3-12 min random delay, local time zones, 20/day cap.",
      color: "from-purple-400/60 to-purple-600/40"
    },
    {
      icon: <FileText size={24} />,
      title: "Automatic follow-up pause",
      description: "Stops the sequence instantly on any reply.",
      color: "from-green-400/60 to-green-600/40"
    },
    {
      icon: <LinkIcon size={24} />,
      title: "Micro-dashboard",
      description: "Sent · Opened · Replied · Booked; export to CSV.",
      color: "from-amber-400/60 to-amber-600/40"
    },
    {
      icon: <Database size={24} />,
      title: "Lead-magnet short-link",
      description: "Track clicks on your freebie PDF.",
      color: "from-rose-400/60 to-rose-600/40"
    },
    {
      icon: <Network size={24} />,
      title: "Zero bloat",
      description: "No pipelines, no Kanban, no tagging rabbit hole.",
      color: "from-indigo-400/60 to-indigo-600/40"
    }
  ];

  return (
    <AnimatedTransition show={showFeatures} animation="slide-up" duration={600}>
      <div className="mt-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-1.5 bg-muted rounded-xl mb-4">
            <div className="bg-background px-4 py-2 rounded-lg shadow-sm">
              <Sparkles size={22} className="inline-block mr-2 text-primary" />
              <span className="font-semibold">Key Features</span>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            linkdms automates the boring 90% of LinkedIn outreach. Upload a list, approve the tone, and let our AI deliver 20 personalised messages a day—without triggering spam flags.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border bg-card/50 backdrop-blur-sm overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-4px] group">
              <div className={`h-1.5 w-full bg-gradient-to-r ${feature.color}`} />
              <CardHeader>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${feature.color} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <CardTitle className="mt-4 group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AnimatedTransition>
  );
};
