import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Code2, ArrowLeft, Clock, ChevronDown, ChevronUp, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { USER_ENDPOINTS, QUESTION_ENDPOINTS, SUPABASE_ENDPOINTS } from '@/lib/api';

interface HistoryEntry {
  id: string;
  question_id: string;
  session_id: string;
  created_at: string;
  solution?: string;
  question_title: string;
  question_description: string;
  question_difficulty: 'easy' | 'medium' | 'hard';
  question_topic: string[];
  peer_username?: string;
}

const topicColors: Record<string, string> = {
  arrays_and_hashing: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  two_pointers: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10',
  stack: 'text-violet-500 border-violet-500/30 bg-violet-500/10',
  binary_search: 'text-sky-500 border-sky-500/30 bg-sky-500/10',
  sliding_window: 'text-indigo-500 border-indigo-500/30 bg-indigo-500/10',
  linked_list: 'text-pink-500 border-pink-500/30 bg-pink-500/10',
  trees: 'text-teal-500 border-teal-500/30 bg-teal-500/10',
  tries: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
  heap_and_priority_queue: 'text-fuchsia-500 border-fuchsia-500/30 bg-fuchsia-500/10',
  intervals: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
  greedy: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  backtracking: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
  graphs: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  dynamic_programming: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
};

const difficultyColors = {
  easy: 'text-success border-success/30 bg-success/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  hard: 'text-destructive border-destructive/30 bg-destructive/10',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const History = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user == null) {
      navigate('/login');
      return;
    }
    fetchHistory(user.id);
  }, [user]);

  const fetchHistory = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(SUPABASE_ENDPOINTS.getHistory(userId), {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const rows = await response.json();
      if (!response.ok) throw new Error('Failed to fetch history');

      const enriched = await Promise.all(
        rows.map(async (row: any) => {
          const [question, partnerName] = await Promise.all([
            fetchQuestion(row.question_id, session?.access_token),
            fetchPartnerUsername(row.partner_id, session?.access_token),
          ]);

          return {
            id: String(row.id),
            question_id: String(row.question_id),
            session_id: String(row.session_id),
            created_at: row.created_at,
            solution: row.solution,
            question_title: question?.title ?? `Question #${row.question_id}`,
            question_description: question?.description ?? '',
            question_difficulty: question?.difficulty ?? 'easy',
            question_topic: question?.topic ?? [],
            peer_username: partnerName ?? 'Unknown',
          } as HistoryEntry;
        }),
      );

      setHistory(enriched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestion = async (questionId: number, accessToken?: string) => {
    try {
      const response = await fetch(QUESTION_ENDPOINTS.getQuestionById(String(questionId)), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  const fetchPartnerUsername = async (partnerId: string, accessToken?: string) => {
    try {
      if (!partnerId) return null;
      const response = await fetch(USER_ENDPOINTS.getNameById(partnerId), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.name ?? null;
    } catch {
      return null;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-4xl">
        {/* Title */}
        <div className="flex items-center justify-between mb-12 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Attempt <span className="text-gradient">History</span>
            </h1>
            <p className="text-muted-foreground">Your past collaborative sessions</p>
          </div>
          {/* Summary badge */}
          {!loading && history.length > 0 && (
            <div className="text-sm text-muted-foreground border border-border rounded-lg px-4 py-2 bg-card">
              {history.length} attempt{history.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* List */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">No attempts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete a session to see your history here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    {/* Row */}
                    <div className="p-6 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Title + difficulty */}
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-medium text-foreground truncate">
                            {entry.question_title ?? `Question #${entry.question_id}`}
                          </p>
                          {entry.question_difficulty && (
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full border capitalize shrink-0',
                                difficultyColors[entry.question_difficulty],
                              )}
                            >
                              {entry.question_difficulty}
                            </span>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(entry.created_at)}
                          </span>
                          {entry.peer_username && (
                            <>
                              <span>·</span>
                              <span>
                                with <span className="text-foreground">{entry.peer_username}</span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Topics */}
                        {entry.question_topic && entry.question_topic.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {entry.question_topic.map((t) => (
                              <span
                                key={t}
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full capitalize border shrink-0',
                                  topicColors[t] ?? 'text-muted-foreground border-border bg-muted',
                                )}
                              >
                                {t.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(entry.id)}
                        className="shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Expanded solution */}
                    {isExpanded && (
                      <div className="border-t border-border px-6 pb-6 pt-4">
                        <p className="text-sm mb-4">{entry.question_description}</p>
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                          Submitted solution
                        </p>
                        <pre className="rounded-lg border border-border bg-background p-4 text-sm text-foreground overflow-x-auto font-mono leading-relaxed whitespace-pre">
                          {entry.solution || '// No solution recorded.'}
                        </pre>
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span>
                            Session ID: <span className="font-mono">{entry.session_id}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
