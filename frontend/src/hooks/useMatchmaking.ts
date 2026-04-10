import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { MatchFoundPayload } from '../../../shared/types';

export type MatchmakingStatus = 'idle' | 'connecting' | 'queued' | 'matched' | 'timeout' | 'error';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';
const MATCHING_WS_PATH = import.meta.env.VITE_MATCHING_WS_PATH || '/socket.io';
const DEFAULT_TIMEOUT = 30;

interface JoinQueueParams {
  userId: string;
  difficulty: string;
  topics: string[];
  language: string;
}

export function useMatchmaking() {
  const [status, setStatus] = useState<MatchmakingStatus>('idle');
  const [matchData, setMatchData] = useState<MatchFoundPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_TIMEOUT);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      stopTimer();
      setTimeLeft(seconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stopTimer],
  );

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const joinQueue = useCallback(
    (params: JoinQueueParams) => {
      const { userId, difficulty, topics, language } = params;
      userIdRef.current = userId;

      setStatus('connecting');
      setMatchData(null);
      setError(null);

      const socket = io(GATEWAY_URL, {
        transports: ['websocket'],
        path: MATCHING_WS_PATH,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setStatus('queued');
        socket.emit('join_queue', { userId, difficulty, topics, language });
        startTimer(DEFAULT_TIMEOUT);
      });

      socket.on('match_found', (data: MatchFoundPayload) => {
        setStatus('matched');
        setMatchData(data);
        stopTimer();
        disconnectSocket();
      });

      socket.on('timeout', () => {
        setStatus('timeout');
        stopTimer();
        disconnectSocket();
      });

      socket.on('queue_rejoined', (data: { timeLeft: number }) => {
        setStatus('queued');
        startTimer(data.timeLeft > 0 ? data.timeLeft : 0);
      });

      socket.on('queue_error', (data: { message: string }) => {
        setStatus('error');
        setError(data.message);
        stopTimer();
        disconnectSocket();
      });

      socket.on('connect_error', () => {
        setStatus('error');
        setError('Failed to connect to matching service');
        stopTimer();
      });
    },
    [startTimer, stopTimer, disconnectSocket],
  );

  const cancelQueue = useCallback(() => {
    if (socketRef.current && userIdRef.current) {
      socketRef.current.emit('cancel_queue', { userId: userIdRef.current });
    }
    stopTimer();
    disconnectSocket();
    setStatus('idle');
    setTimeLeft(DEFAULT_TIMEOUT);
  }, [stopTimer, disconnectSocket]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      disconnectSocket();
    };
  }, [stopTimer, disconnectSocket]);

  return { joinQueue, cancelQueue, status, matchData, error, timeLeft };
}
