import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CollaborativeMonacoEditor } from '@/components/CollaborativeMonacoEditor';
import { useCollabSession } from '@/hooks/useCollabSession';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

function getConnectionPresentation(status: string, hasError: boolean, hasSessionEnded: boolean) {
  if (hasSessionEnded) {
    return {
      label: 'Session ended',
      message: 'This collaboration session has ended. Returning you to matching...',
      tone: 'warning',
    };
  }

  if (hasError) {
    return {
      label: 'Connection issue',
      message: 'We could not keep your collaboration session connected.',
      tone: 'error',
    };
  }

  switch (status) {
    case 'connected':
      return {
        label: 'Live',
        message: 'Connected. Changes sync automatically for both participants.',
        tone: 'success',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting',
        message: 'Your connection dropped. Rejoining your session automatically...',
        tone: 'warning',
      };
    case 'connecting':
      return {
        label: 'Joining',
        message: 'Preparing your collaboration session...',
        tone: 'neutral',
      };
    default:
      return {
        label: 'Disconnected',
        message: 'Your session is temporarily unavailable.',
        tone: 'warning',
      };
  }
}

function getPresencePresentation(status?: 'connected' | 'disconnected' | 'left') {
  if (status === 'connected') {
    return {
      label: 'Connected',
      tone: 'success',
    };
  }

  if (status === 'left') {
    return {
      label: 'Left session',
      tone: 'muted',
    };
  }

  return {
    label: 'Reconnecting',
    tone: 'warning',
  };
}

const toneStyles = {
  neutral: 'border-border bg-card text-foreground',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  error: 'border-destructive/20 bg-destructive/10 text-destructive',
  muted: 'border-border bg-secondary/60 text-muted-foreground',
} as const;

function formatTopic(topic: unknown): string {
  if (Array.isArray(topic)) {
    return topic
      .map((value) => String(value).split('_').join(' '))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof topic === 'string') {
    return topic.split('_').join(' ');
  }

  return 'General';
}

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

  const { sharedDoc, joinedSession, participantStatuses, sessionEnded, leaveSession } =
    useCollabSession(pendingSession);

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

  const participantIds = Array.from(
    new Set([
      pendingSession?.userId,
      ...(joinedSession?.participantIds ?? []),
      ...Object.keys(participantStatuses),
    ].filter((value): value is string => Boolean(value))),
  );

  if (!pendingSession || !sessionId || pendingSession.sessionId !== sessionId) {
    return null;
  }

  const handleLeave = () => {
    leaveSession();
    clearPendingSession();
    navigate('/match', { replace: true });
  };

  const connection = getConnectionPresentation(
    collabSessionStatus,
    Boolean(collabError),
    Boolean(sessionEnded),
  );

  const editorReadOnly =
    !sharedDoc || collabSessionStatus === 'connecting' || collabSessionStatus === 'reconnecting';

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-glow opacity-20" />

      <main className="relative z-10 container mx-auto max-w-7xl px-6 py-10">
        <div className="space-y-6">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                Pair Programming Session
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {pendingSession.question.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Collaborate in real time, keep the discussion in sync, and work through the
                  problem together.
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={handleLeave}>
              Leave session
            </Button>
          </header>

          <section
            className={cn(
              'rounded-2xl border p-4',
              toneStyles[connection.tone as keyof typeof toneStyles],
            )}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{connection.label}</p>
                <p className="text-sm opacity-90">{connection.message}</p>
                {collabError && <p className="mt-2 text-sm opacity-90">{collabError}</p>}
              </div>
              <span className="inline-flex rounded-full border border-current/20 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                {pendingSession.language}
              </span>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <CollaborativeMonacoEditor
                doc={sharedDoc}
                language={pendingSession.language}
                readOnly={editorReadOnly || Boolean(sessionEnded)}
                statusMessage={
                  sessionEnded
                    ? 'Session ended'
                    : editorReadOnly
                      ? 'Syncing shared editor...'
                      : 'Live shared editor'
                }
              />
            </section>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Problem</h2>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground">
                    {pendingSession.question.difficulty}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Topic</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatTopic(pendingSession.question.topic)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm leading-7 whitespace-pre-wrap text-foreground/90">
                      {pendingSession.question.description}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Participants</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Presence updates refresh automatically during the session.
                  </p>
                </div>

                <div className="space-y-3">
                  {participantIds.map((participantId) => {
                    const participant = participantStatuses[participantId];
                    const isCurrentUser = participantId === pendingSession.userId;
                    const derivedStatus =
                      participant?.status ??
                      (joinedSession?.participantIds.includes(participantId)
                        ? 'connected'
                        : isCurrentUser &&
                            (collabSessionStatus === 'connected' ||
                              collabSessionStatus === 'reconnecting')
                          ? 'connected'
                          : 'disconnected');
                    const presence = getPresencePresentation(derivedStatus);

                    return (
                      <div
                        key={participantId}
                        className="rounded-xl border border-border/80 bg-background/70 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {isCurrentUser ? 'You' : 'Partner'}
                            </p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {participantId}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'rounded-full px-3 py-1 text-xs font-medium',
                              toneStyles[presence.tone as keyof typeof toneStyles],
                            )}
                          >
                            {presence.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Session;
