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
    <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      {state === 'searching' && <SearchingRing timeLeft={timeLeft} />}
    </div>
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
