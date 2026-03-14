import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppStore, Difficulty } from '@/store/useAppStore';
import { topics, languages } from '@/lib/mockData';
import { Code2, LogOut, CheckCircle2, Shield, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DIFFICULTIES } from '../../../shared/constants';

export const MatchingSetup = () => {
  const navigate = useNavigate();
  const {
    user,
    logout,
    selectedDifficulty,
    selectedTopic,
    selectedLanguage,
    setDifficulty,
    setTopic,
    setLanguage,
    setCurrentState,
  } = useAppStore();
  const { signOut } = useAuth();
  const [localDifficulty, setLocalDifficulty] = useState<Difficulty | null>(selectedDifficulty);
  const [localTopic, setLocalTopic] = useState<string | null>(selectedTopic);
  const [localLanguage, setLocalLanguage] = useState<string | null>(selectedLanguage);

  const handleLogout = async () => {
    await signOut(); // ← sign out from Supabase
    logout();
    navigate('/');
  };

  const handleStartMatching = () => {
    if (localDifficulty && localTopic && localLanguage) {
      setDifficulty(localDifficulty);
      setTopic(localTopic);
      setLanguage(localLanguage);
      setCurrentState('queue');
      navigate('/queue');
    }
  };

  const canProceed = localDifficulty && localTopic && localLanguage;

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
          <div className="flex items-center gap-4">
            {user?.role === 'developer' && (
              <button
                onClick={() => navigate('/dev-panel')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-200"
              >
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Dev Panel</span>
              </button>
            )}

            {/* Admin + Developer */}
            {(user?.role === 'admin' || user?.role === 'developer') && (
              <button
                onClick={() => navigate('/questions')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-200"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Questions</span>
              </button>
            )}
            <span
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => navigate('/account')}
            >
              Welcome, <span className="text-foreground font-medium">{user?.name}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-4xl">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to <span className="text-gradient">practice</span>?
          </h1>
          <p className="text-muted-foreground text-lg">
            Select your preferences and we'll find you a perfect match.
          </p>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-semibold mb-4">Choose difficulty</h2>
          <div className="grid grid-cols-3 gap-4">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setLocalDifficulty(diff.id as Difficulty)}
                className={cn(
                  'p-6 rounded-xl border transition-all duration-200 text-left',
                  localDifficulty === diff.id
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-card hover:border-primary/50',
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-lg font-semibold', diff.color)}>{diff.label}</span>
                  {localDifficulty === diff.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">{diff.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Selection */}
        <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl font-semibold mb-4">Choose topic</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setLocalTopic(topic.id)}
                className={cn(
                  'p-4 rounded-xl border transition-all duration-200 text-left',
                  localTopic === topic.id
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-card hover:border-primary/50',
                )}
              >
                <div className="text-2xl mb-2">{topic.icon}</div>
                <span className="text-sm font-medium">{topic.label}</span>
                {localTopic === topic.id && <CheckCircle2 className="h-4 w-4 text-primary mt-2" />}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection */}
        <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <h2 className="text-xl font-semibold mb-4">Choose language</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLocalLanguage(lang.id)}
                className={cn(
                  'p-4 rounded-xl border transition-all duration-200 text-left',
                  localLanguage === lang.id
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-card hover:border-primary/50',
                )}
              >
                <div className="text-2xl mb-2">{lang.icon}</div>
                <span className="text-sm font-medium">{lang.label}</span>
                {localLanguage === lang.id && (
                  <CheckCircle2 className="h-4 w-4 text-primary mt-2" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Button
            variant="hero"
            size="xl"
            onClick={handleStartMatching}
            disabled={!canProceed}
            className="min-w-[200px]"
          >
            Find a Match
          </Button>
          {!canProceed && (
            <p className="text-sm text-muted-foreground mt-3">
              Please select difficulty, topic, and language to continue
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
