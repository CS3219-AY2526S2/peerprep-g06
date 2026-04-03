import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CollaborativeMonacoEditor } from '@/components/CollaborativeMonacoEditor';
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
    sharedDoc,
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
      clearPendingSession();
      navigate('/match', { replace: true });
      return;
    }

    setCurrentState('session');
  }, [clearPendingSession, navigate, pendingSession, sessionId, setCurrentState]);

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

  const participantCards = Object.values(participantStatuses);

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-glow opacity-20" />

      <main className="relative z-10 container mx-auto px-6 py-12 max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Collaboration <span className="text-gradient">Session</span>
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

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Session socket: <span className="text-primary">{collabSessionStatus}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {joinedSession
                  ? `Joined as ${joinedSession.userId} with ${joinedSession.participantIds.length} participants`
                  : 'Waiting for session:joined'}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Grace period: {pendingSession.gracePeriodMs}ms
            </div>
          </div>
          {collabError && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {collabError}
            </p>
          )}
          {sessionEnded && (
            <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
              Session ended. Returning to matching...
            </p>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Question</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Session payload from collaboration service
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
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Participants</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Live participant:status updates
                </p>
              </div>
              {participantCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No participant status updates yet.</p>
              ) : (
                <div className="space-y-3">
                  {participantCards.map((participant) => (
                    <div
                      key={participant.userId}
                      className="rounded-lg border border-border bg-background/80 p-4 text-sm"
                    >
                      <p className="font-medium">{participant.userId}</p>
                      <p className="text-muted-foreground">
                        {participant.status} / {participant.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">{participant.at}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="space-y-4">
            <CollaborativeMonacoEditor
              doc={sharedDoc}
              language={pendingSession.language}
              readOnly={!sharedDoc}
            />

            <div className="rounded-2xl border border-border bg-card p-4">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Debug panel
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                  <div className="lg:col-span-2">
                    <p className="text-sm font-medium mb-2">Event log</p>
                    <div className="max-h-72 overflow-y-auto rounded-lg bg-background/80 p-4 space-y-3">
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
              </details>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Session;
