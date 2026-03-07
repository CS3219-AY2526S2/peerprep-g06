import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Code2, Users, Zap } from 'lucide-react';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Code2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-gradient">PeerPrep</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button variant="hero" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export const Features = () => {
  const features = [
    {
      icon: Users,
      title: 'Peer Matching',
      description:
        'Get matched with developers at your skill level for collaborative practice sessions.',
    },
    {
      icon: Code2,
      title: 'Real-time Collaboration',
      description: 'Code together in a shared editor with live sync and instant feedback.',
    },
    {
      icon: Zap,
      title: 'Curated Questions',
      description: 'Practice with questions categorized by difficulty and topic.',
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 gradient-glow opacity-30" />
      <div className="container mx-auto px-6 relative">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Why <span className="text-gradient">PeerPrep</span>?
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          Practice makes perfect. Practice with peers makes it even better.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 shadow-card hover:shadow-glow"
            >
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
