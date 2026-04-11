interface QueueRingProps {
  state: 'searching' | 'matched' | 'entering-session' | 'idle';
  timeLeft?: number;
}

const RING_SIZE = 200;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 85;
const STROKE_WIDTH = 3;

export function QueueRing({ state, timeLeft }: QueueRingProps) {
  if (state === 'idle') return null;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      {state === 'searching' && <SearchingRing timeLeft={timeLeft} />}
      {state === 'matched' && <MatchedRing />}
      {state === 'entering-session' && <EnteringSessionRing />}
    </div>
  );
}

function EnteringSessionRing() {
  return (
    <>
      {/* Pulsing green ring */}
      <div
        className="absolute rounded-full border-2 border-green-500/50 animate-[pulse-ring_2s_ease-in-out_infinite]"
        style={{ inset: 0 }}
      />
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-base font-medium text-green-500">Entering session...</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function MatchedRing() {
  return (
    <>
      {/* Ring burst — outer */}
      <div
        className="absolute rounded-full border-[3px] border-green-500/60 animate-[ring-burst_1s_ease-out_forwards]"
        style={{ inset: 0 }}
      />
      {/* Ring burst — inner (staggered) */}
      <div
        className="absolute rounded-full border-2 border-green-500/30 animate-[ring-burst_1s_ease-out_0.15s_forwards]"
        style={{ inset: 20 }}
      />
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-green-500 uppercase tracking-[3px] font-semibold animate-[scale-in_0.3s_ease-out_0.2s_both]">
            Match
          </div>
          <div className="text-3xl font-extrabold text-green-500 animate-[scale-in_0.3s_ease-out_0.35s_both]">
            FOUND
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ring-burst {
          0% { transform: scale(0.3); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(1); opacity: 0.3; }
        }
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function SearchingRing({ timeLeft }: { timeLeft?: number }) {
  const minutes = Math.floor((timeLeft ?? 0) / 60);
  const seconds = (timeLeft ?? 0) % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <>
      {/* Spinning arc */}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="absolute inset-0 animate-[spin_3s_linear_infinite]"
      >
        {/* Background track */}
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(245, 158, 11, 0.15)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Active arc */}
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="120 415"
          strokeLinecap="round"
        />
      </svg>

      {/* Inner ring border */}
      <div
        className="absolute rounded-full border border-amber-500/20 flex items-center justify-center"
        style={{ inset: 20 }}
      >
        {/* Center text */}
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-500">{display}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            Searching
          </div>
        </div>
      </div>
    </>
  );
}
