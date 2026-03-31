import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Code2, ArrowLeft, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { USER_ENDPOINTS } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface AdminRequest {
  id: string;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    email: string;
    display_name: string;
  };
}

const DevPanel = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [demoteRequests, setDemoteRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoteLoading, setDemoteLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoteError, setDemoteError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not developer
    if (user?.role !== 'developer') {
      navigate('/match');
      return;
    }
    fetchRequests();
    fetchDemoteRequests();
  }, [user]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.getAdminRequests, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoteRequests = async () => {
    setDemoteLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.getDemoteRequests, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch demote requests');
      const data = await response.json();
      setDemoteRequests(data);
    } catch (err: any) {
      setDemoteError(err.message);
    } finally {
      setDemoteLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.approveAdmin(requestId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to approve request');
      await fetchRequests(); // Refresh the requests list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.rejectAdmin(requestId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to reject request');
      await fetchRequests(); // Refresh the requests list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveDemote = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.approveDemote(requestId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to approve demote request');
      await fetchDemoteRequests(); // Refresh the demote requests list
    } catch (err: any) {
      setDemoteError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDemote = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(USER_ENDPOINTS.rejectDemote(requestId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to reject demote request');
      await fetchDemoteRequests(); // Refresh the demote requests list
    } catch (err: any) {
      setDemoteError(err.message);
    } finally {
      setActionLoading(null);
    }
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
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-3xl">
        <div className="text-center mb-12 animate-fade-in">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center shadow-glow mx-auto mb-4">
            <Users className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Developer <span className="text-gradient">Panel</span>
          </h1>
          <p className="text-muted-foreground">
            Review and manage admin access and demote requests
          </p>
        </div>

        {/* Requests */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-4" />
              <p className="text-foreground font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending admin requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-border bg-card p-6 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shadow-glow shrink-0">
                      <span className="text-sm font-bold text-primary-foreground">
                        {request.profiles.display_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{request.profiles.display_name}</p>
                      <p className="text-sm text-muted-foreground">{request.profiles.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={actionLoading === request.id}
                      className="text-success border-success/50 hover:bg-success/10"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(request.id)}
                      disabled={actionLoading === request.id}
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demote Requests */}
        <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl font-semibold mb-6">Demote Requests</h2>
          {demoteLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : demoteError ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="text-destructive text-sm">{demoteError}</p>
            </div>
          ) : demoteRequests.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-4" />
              <p className="text-foreground font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending demote requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {demoteRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-border bg-card p-6 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shadow-glow shrink-0">
                      <span className="text-sm font-bold text-primary-foreground">
                        {request.profiles.display_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{request.profiles.display_name}</p>
                      <p className="text-sm text-muted-foreground">{request.profiles.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApproveDemote(request.id)}
                      disabled={actionLoading === request.id}
                      className="text-success border-success/50 hover:bg-success/10"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectDemote(request.id)}
                      disabled={actionLoading === request.id}
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DevPanel;
