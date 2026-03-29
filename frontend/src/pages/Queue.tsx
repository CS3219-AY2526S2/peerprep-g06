import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useAuth } from '@/contexts/AuthContext';

const Queue = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        selectedDifficulty,
        selectedTopic,
        selectedLanguage,
        resetMatching,
    } = useAppStore();

    const { joinQueue, cancelQueue, status, matchData, error, timeLeft } = useMatchmaking();

    // join queue on mount
    useEffect(() => {
        if (!user || !selectedDifficulty || !selectedTopic || !selectedLanguage) {
            navigate('/match');
            return;
        }

        joinQueue({
            userId: user.id,
            difficulty: selectedDifficulty,
            topics: [selectedTopic],
            language: selectedLanguage,
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // navigate on match found
    useEffect(() => {
        if (status === 'matched' && matchData) {
            // TODO: navigate to collaboration session when implemented
            // For now, just log and stay on page
            console.log('Match found:', matchData);
        }
    }, [status, matchData]);

    const handleCancel = () => {
        cancelQueue();
        navigate('/match');
    };

    const handleRetry = () => {
        resetMatching();
        navigate('/match');
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
                {/* Connecting / Queued */}
                {(status === 'connecting' || status === 'queued') && (
                    <div className="animate-fade-in">
                        <div className="text-6xl font-bold text-primary mb-4">{timeLeft}</div>
                        <h2 className="text-xl font-semibold mb-2">Searching for a match...</h2>
                        <p className="text-muted-foreground mb-2">
                            {selectedDifficulty} / {selectedTopic} / {selectedLanguage}
                        </p>
                        <p className="text-sm text-muted-foreground mb-8">
                            Please wait while we find you a coding partner.
                        </p>
                        <Button variant="ghost" onClick={handleCancel}>
                            Cancel
                        </Button>
                    </div>
                )}

                {/* Matched */}
                {status === 'matched' && matchData && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-green-500 mb-4">Match Found!</h2>
                        <p className="text-muted-foreground mb-2">
                            Question: {matchData.question.title}
                        </p>
                        <p className="text-sm text-muted-foreground mb-8">
                            {matchData.difficulty} / {matchData.topic} / {matchData.language}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Collaboration session coming soon...
                        </p>
                    </div>
                )}

                {/* Timeout */}
                {status === 'timeout' && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-semibold mb-4">No match found</h2>
                        <p className="text-muted-foreground mb-8">
                            We couldn't find a match in time. Try again or adjust your preferences.
                        </p>
                        <Button variant="hero" onClick={handleRetry}>
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Error */}
                {status === 'error' && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-semibold text-red-500 mb-4">Something went wrong</h2>
                        <p className="text-muted-foreground mb-8">
                            {error || 'An unexpected error occurred.'}
                        </p>
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
