import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QueueRing } from '@/components/QueueRing';
import { useCollabNotifications } from '@/hooks/useCollabNotifications';
import { useAppStore } from '@/store/useAppStore';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useAuth } from '@/contexts/AuthContext';

type QueuePhase = 'queue' | 'matched' | 'entering-session';

const MATCH_FOUND_DELAY_MS = 2000;

const Queue = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedDifficulty,
    selectedTopic,
    selectedLanguage,
    pendingSession,
    setCurrentState,
    clearPendingSession,
    resetMatching,
  } = useAppStore();

  const { joinQueue, cancelQueue, status, matchData, error, timeLeft } = useMatchmaking();
  useCollabNotifications(user?.id);

  const [phase, setPhase] = useState<QueuePhase>('queue');
  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Join queue on mount
  useEffect(() => {
    if (!user || !selectedDifficulty || !selectedTopic || !selectedLanguage) {
      navigate('/match');
      return;
    }

    clearPendingSession();
    joinQueue({
      userId: user.id,
      difficulty: selectedDifficulty,
      topics: [selectedTopic],
      language: selectedLanguage,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When match is found, show ring burst for 2s then transition to entering-session
  useEffect(() => {
    if (status === 'matched' && phase === 'queue') {
      setPhase('matched');
      matchTimerRef.current = setTimeout(() => {
        setPhase('entering-session');
      }, MATCH_FOUND_DELAY_MS);
    }
  }, [status, phase]);

  // Clean up match timer on unmount only
  useEffect(() => {
    return () => {
      if (matchTimerRef.current) {
        clearTimeout(matchTimerRef.current);
      }
    };
  }, []);

  // Navigate to session once pendingSession arrives and ring burst has played
  useEffect(() => {
    if (pendingSession && phase === 'entering-session') {
      setCurrentState('session');
      navigate(`/session/${pendingSession.sessionId}`);
    }
  }, [navigate, pendingSession, phase, setCurrentState]);

  const handleCancel = () => {
    cancelQueue();
    navigate('/match');
  };

  const handleRetry = () => {
    if (!user || !selectedDifficulty || !selectedTopic || !selectedLanguage) {
      navigate('/match');
      return;
    }
    setPhase('queue');
    joinQueue({
      userId: user.id,
      difficulty: selectedDifficulty,
      topics: [selectedTopic],
      language: selectedLanguage,
    });
  };

  const handleChangePreferences = () => {
    navigate('/match');
  };

  // Map status + phase to QueueRing state
  const ringState = (() => {
    if (phase === 'matched') return 'matched' as const;
    if (phase === 'entering-session') return 'entering-session' as const;
    if (status === 'connecting' || status === 'queued') return 'searching' as const;
    return 'idle' as const;
  })();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Searching */}
        {phase === 'queue' && (status === 'connecting' || status === 'queued') && (
          <div className="flex flex-col items-center animate-fade-in">
            <QueueRing state={ringState} timeLeft={timeLeft} />
            <h2 className="text-xl font-semibold mt-6 mb-2">Searching for a match...</h2>
            <p className="text-muted-foreground mb-8">
              {selectedDifficulty} / {selectedTopic} / {selectedLanguage}
            </p>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}

        {/* Match Found */}
        {phase === 'matched' && matchData && (
          <div className="flex flex-col items-center animate-fade-in">
            <QueueRing state={ringState} />
            {matchData.question && (
              <p className="text-muted-foreground mt-6">{matchData.question.title}</p>
            )}
          </div>
        )}

        {/* Entering Session */}
        {phase === 'entering-session' && (
          <div className="flex flex-col items-center animate-fade-in">
            <QueueRing state={ringState} />
            <p className="text-muted-foreground mt-6">Setting up your workspace...</p>
          </div>
        )}

        {/* Timeout */}
        {status === 'timeout' && phase === 'queue' && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">No match found</h2>
            <p className="text-muted-foreground mb-8">
              Try changing your preferences or retry with the same settings.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={handleChangePreferences}>
                Cancel
              </Button>
              <Button variant="hero" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && phase === 'queue' && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold text-red-500 mb-4">Something went wrong</h2>
            <p className="text-muted-foreground mb-8">{error || 'An unexpected error occurred.'}</p>
            <Button variant="hero" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Queue;
