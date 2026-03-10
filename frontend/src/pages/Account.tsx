import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Code2, ArrowLeft, User, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const roleColors = {
  developer: 'text-primary',
  admin: 'text-warning',
  user: 'text-muted-foreground',
};

const Account = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-glow opacity-20" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient">PeerPrep</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/match')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-2xl">
        <div className="text-center mb-12 animate-fade-in">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center shadow-glow mx-auto mb-4">
            <span className="text-3xl font-bold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{user?.name}</h1>
          <p className="text-muted-foreground capitalize">{user?.role}</p>
        </div>

        {/* Details Card */}
        <div
          className="rounded-xl border border-border bg-card p-6 space-y-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Display Name</p>
              <p className="text-foreground font-medium">{user?.name}</p>
            </div>
          </div>

          <div className="border-t border-border/50" />

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-foreground font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-border/50" />

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className={`font-medium capitalize ${roleColors[user?.role ?? 'user']}`}>
                {user?.role}
              </p>
            </div>
          </div>
        </div>

        {/* Request Admin */}
        {user?.role === 'user' && (
          <div
            className="mt-6 rounded-xl border border-border bg-card p-6 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <h2 className="text-lg font-semibold mb-1">Request Admin Access</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Need elevated permissions? Submit a request to the development team.
            </p>
            <Button variant="outline" size="sm">
              Request Admin
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Account;
