import { useState } from 'react';

export interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

interface Props {
  points: Point[];
  format: (v: number) => string;
  fmtDate: (iso: string) => string;
  /** For pace, lower is better: flip the axis so "up" still means improvement. */
  invert?: boolean;
}

const W = 340;
const H = 190;
const PAD = { l: 44, r: 12, t: 14, b: 26 };

export function Chart({ points, format, fmtDate, invert }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;

  const times = points.map((p) => new Date(p.date + 'T12:00:00').getTime());
  const vals = points.map((p) => p.value);
  const tMin = times[0];
  const tMax = times[times.length - 1];
  let vMin = Math.min(...vals);
  let vMax = Math.max(...vals);
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const span = vMax - vMin;
  vMin -= span * 0.08;
  vMax += span * 0.08;

  const x = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD.l - PAD.r);
  const yRaw = (v: number) => (v - vMin) / (vMax - vMin);
  const y = (v: number) => PAD.t + (invert ? yRaw(v) : 1 - yRaw(v)) * (H - PAD.t - PAD.b);

  const xy = points.map((p, i) => [x(times[i]), y(p.value)] as const);
  const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H - PAD.b} L${xy[0][0].toFixed(1)},${H - PAD.b} Z`;

  const ticks = [0, 0.5, 1].map((f) => vMin + f * (vMax - vMin));
  const sel = active ?? points.length - 1;

  return (
    <div className="chart">
      <div className="chart-readout">
        <strong>{format(points[sel].value)}</strong>
        <span>{fmtDate(points[sel].date)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onPointerLeave={() => setActive(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          xy.forEach(([cx], i) => { if (Math.abs(cx - px) < Math.abs(xy[best][0] - px)) best = i; });
          setActive(best);
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{format(v)}</text>
          </g>
        ))}
        <text className="axis" x={PAD.l} y={H - 6}>{fmtDate(points[0].date)}</text>
        <text className="axis" x={W - PAD.r} y={H - 6} textAnchor="end">{fmtDate(points[points.length - 1].date)}</text>
        <path className="area" d={area} />
        <path className="line" d={line} />
        {xy.map(([px, py], i) => (
          <circle key={i} className={i === sel ? 'dot dot-active' : 'dot'} cx={px} cy={py} r={i === sel ? 5 : 3} />
        ))}
      </svg>
    </div>
  );
}
