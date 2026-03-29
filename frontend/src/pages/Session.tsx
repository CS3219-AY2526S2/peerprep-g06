import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCollabSession } from '@/hooks/useCollabSession';
import { useAppStore } from '@/store/useAppStore';

const Session = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    pendingSession,
    collabSessionStatus,
    collabError,
    setCurrentState,
    clearPendingSession,
  } = useAppStore();

  const {
    joinedSession,
    participantStatuses,
    latestDocSync,
    latestDocUpdate,
    sessionEnded,
    eventLog,
    reconnect,
    leaveSession,
    clearEventLog,
  } = useCollabSession(pendingSession);

  useEffect(() => {
    if (!pendingSession || !sessionId || pendingSession.sessionId !== sessionId) {
      navigate('/match', { replace: true });
      return;
    }

    setCurrentState('session');
  }, [navigate, pendingSession, sessionId, setCurrentState]);

  useEffect(() => {
    if (!sessionEnded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearPendingSession();
      navigate('/match', { replace: true });
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [clearPendingSession, navigate, sessionEnded]);

  if (!pendingSession || !sessionId || pendingSession.sessionId !== sessionId) {
    return null;
  }

  const handleLeave = () => {
    leaveSession();
    clearPendingSession();
    navigate('/match', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-glow opacity-20" />

      <main className="relative z-10 container mx-auto px-6 py-12 max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Collaboration <span className="text-gradient">Session Test</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Session {pendingSession.sessionId} / {pendingSession.language}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={reconnect}>
              Reconnect session socket
            </Button>
            <Button variant="outline" onClick={clearEventLog}>
              Clear debug log
            </Button>
            <Button variant="hero" onClick={handleLeave}>
              Leave session
            </Button>
          </div>
        </div>

        {sessionEnded && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
            <p className="font-medium text-foreground">Session ended</p>
            <p className="text-sm text-muted-foreground">
              All participants have left. Returning to matching...
            </p>
          </div>
        )}

        {collabError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
            {collabError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Question details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Payload from collaboration service session-ready
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">{pendingSession.question.title}</p>
              <p className="text-sm text-muted-foreground">
                {pendingSession.question.difficulty} / {pendingSession.question.topic}
              </p>
              <p className="text-sm leading-6 whitespace-pre-wrap">
                {pendingSession.question.description}
              </p>
            </div>
            <div className="rounded-lg bg-background/80 p-4 text-sm">
              <p>
                <span className="font-medium">Current user:</span> {pendingSession.userId}
              </p>
              <p>
                <span className="font-medium">WebSocket URL:</span> {pendingSession.websocketUrl}
              </p>
              <p>
                <span className="font-medium">Grace period:</span> {pendingSession.gracePeriodMs}ms
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Connection state</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Session join and socket lifecycle
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-background/80 p-4 text-sm">
                <p className="font-medium">Session socket</p>
                <p className="text-muted-foreground mt-1">{collabSessionStatus}</p>
              </div>
              <div className="rounded-lg bg-background/80 p-4 text-sm">
                <p className="font-medium">Join state</p>
                <p className="text-muted-foreground mt-1">
                  {joinedSession ? `Joined as ${joinedSession.userId}` : 'Waiting for session:joined'}
                </p>
              </div>
            </div>
            {joinedSession && (
              <pre className="overflow-x-auto rounded-lg bg-background/80 p-4 text-xs">
                {JSON.stringify(joinedSession, null, 2)}
              </pre>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Participant statuses</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Live participant:status events from the session room
              </p>
            </div>
            {Object.keys(participantStatuses).length === 0 ? (
              <p className="text-sm text-muted-foreground">No participant status updates yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.values(participantStatuses).map((participant) => (
                  <div key={participant.userId} className="rounded-lg bg-background/80 p-4 text-sm">
                    <p className="font-medium">{participant.userId}</p>
                    <p className="text-muted-foreground">
                      {participant.status} / {participant.reason}
                    </p>
                    <p className="text-muted-foreground">{participant.at}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Document sync and debug</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Latest doc:sync, doc:update, and session logs
              </p>
            </div>
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Latest doc:sync</p>
                <pre className="overflow-x-auto rounded-lg bg-background/80 p-4 text-xs">
                  {JSON.stringify(latestDocSync, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Latest doc:update</p>
                <pre className="overflow-x-auto rounded-lg bg-background/80 p-4 text-xs">
                  {JSON.stringify(latestDocUpdate, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Event log</p>
                <div className="max-h-80 overflow-y-auto rounded-lg bg-background/80 p-4 space-y-3">
                  {eventLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events yet.</p>
                  ) : (
                    eventLog.map((entry) => (
                      <div key={entry.id} className="text-sm">
                        <p className="font-medium">{entry.event}</p>
                        <p className="text-muted-foreground">{entry.summary}</p>
                        <p className="text-xs text-muted-foreground">{entry.at}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Session;
