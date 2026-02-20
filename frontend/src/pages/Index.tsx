import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header, Features } from '@/components/Header';
import { ArrowRight, Code2, Users, Zap, CheckCircle } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8 animate-fade-in">
              <Zap className="h-4 w-4" />
              <span>Practice coding interviews with peers</span>
            </div>

            <h1
              className="text-4xl md:text-6xl font-bold mb-6 leading-tight animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            >
              Ace your tech interviews with{' '}
              <span className="text-gradient">real-time collaboration</span>
            </h1>

            <p
              className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            >
              Match with fellow developers, solve coding problems together, and build the confidence
              you need to land your dream job.
            </p>

            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/signup">
                  Start Practicing Free
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/login">I have an account</Link>
              </Button>
            </div>

            <div
              className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground animate-fade-in"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>100+ Questions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Real-time Matching</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Live Collaboration</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-card/30">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Get started in minutes with our simple three-step process
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                title: 'Create Account',
                description: 'Sign up in seconds and set up your profile.',
              },
              {
                step: '02',
                title: 'Choose & Match',
                description: 'Select difficulty and topic, then get matched with a peer.',
              },
              {
                step: '03',
                title: 'Code Together',
                description: 'Collaborate in real-time to solve the problem.',
              },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl font-bold text-primary/20 mb-4 font-mono">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="absolute inset-0 gradient-glow opacity-20" />
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to start <span className="text-gradient">practicing</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of developers who are preparing for their interviews together.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/signup">
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Code2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-gradient">PeerPrep</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 PeerPrep. Built for developers, by developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
