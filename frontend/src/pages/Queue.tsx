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
const SESSION_READY_TIMEOUT_MS = 10000;

const Queue = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedDifficulty,
    selectedTopics,
    selectedLanguage,
    pendingSession,
    setCurrentState,
    clearPendingSession,
    collabNotificationStatus,
    collabError,
  } = useAppStore();

  const { joinQueue, cancelQueue, status, matchData, error, timeLeft } = useMatchmaking();
  const { requestPendingNotifications } = useCollabNotifications(user?.id);

  const [phase, setPhase] = useState<QueuePhase>('queue');
  const [sessionReadyTimedOut, setSessionReadyTimedOut] = useState(false);
  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionReadyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Join queue on mount
  useEffect(() => {
    if (!user || !selectedDifficulty || selectedTopics.length === 0 || !selectedLanguage) {
      navigate('/match');
      return;
    }

    clearPendingSession();
    setSessionReadyTimedOut(false);
    joinQueue({
      userId: user.id,
      difficulty: selectedDifficulty,
      topics: selectedTopics,
      language: selectedLanguage,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When match is found, show ring burst for 2s then transition to entering-session
  useEffect(() => {
    if (status === 'matched' && phase === 'queue') {
      setSessionReadyTimedOut(false);
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
      if (sessionReadyTimerRef.current) {
        clearTimeout(sessionReadyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (status !== 'matched' && phase !== 'entering-session') {
      return;
    }

    requestPendingNotifications();
  }, [phase, requestPendingNotifications, status, user?.id]);

  useEffect(() => {
    if (phase !== 'entering-session' || pendingSession) {
      if (sessionReadyTimerRef.current) {
        clearTimeout(sessionReadyTimerRef.current);
        sessionReadyTimerRef.current = null;
      }
      return;
    }

    sessionReadyTimerRef.current = setTimeout(() => {
      setSessionReadyTimedOut(true);
    }, SESSION_READY_TIMEOUT_MS);

    return () => {
      if (sessionReadyTimerRef.current) {
        clearTimeout(sessionReadyTimerRef.current);
        sessionReadyTimerRef.current = null;
      }
    };
  }, [pendingSession, phase]);

  // Navigate to session once pendingSession arrives and ring burst has played
  useEffect(() => {
    if (pendingSession && phase === 'entering-session') {
      setSessionReadyTimedOut(false);
      setCurrentState('session');
      navigate(`/session/${pendingSession.sessionId}`);
    }
  }, [navigate, pendingSession, phase, setCurrentState]);

  const handleCancel = () => {
    cancelQueue();
    navigate('/match');
  };

  const handleRetry = () => {
    if (!user || !selectedDifficulty || selectedTopics.length === 0 || !selectedLanguage) {
      navigate('/match');
      return;
    }
    setPhase('queue');
    setSessionReadyTimedOut(false);
    joinQueue({
      userId: user.id,
      difficulty: selectedDifficulty,
      topics: selectedTopics,
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

  const showSessionReadyFailure =
    phase === 'entering-session' &&
    !pendingSession &&
    (sessionReadyTimedOut ||
      collabNotificationStatus === 'error' ||
      (collabNotificationStatus === 'disconnected' && status === 'matched'));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Searching */}
        {phase === 'queue' && (status === 'connecting' || status === 'queued') && (
          <div className="flex flex-col items-center animate-fade-in">
            <QueueRing state={ringState} timeLeft={timeLeft} />
            <h2 className="text-xl font-semibold mt-6 mb-2">Searching for a match...</h2>
            <p className="text-muted-foreground mb-8">
              {selectedDifficulty} / {selectedTopics.join(', ')} / {selectedLanguage}
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
        {phase === 'entering-session' && !showSessionReadyFailure && (
          <div className="flex flex-col items-center animate-fade-in">
            <QueueRing state={ringState} />
            <p className="text-muted-foreground mt-6">Setting up your workspace...</p>
          </div>
        )}

        {showSessionReadyFailure && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold text-red-500 mb-4">Unable to open your session</h2>
            <p className="text-muted-foreground mb-3">
              Your match was found, but this client did not receive the collaboration session
              handoff in time.
            </p>
            {collabError && <p className="text-muted-foreground mb-8">{collabError}</p>}
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={handleChangePreferences}>
                Return
              </Button>
              <Button variant="hero" onClick={handleRetry}>
                Retry Match
              </Button>
            </div>
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
