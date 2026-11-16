import type { DrillingPlan, EdgeId, PlanFace } from '@/domain';
import { useT } from '@/i18n/useT';

const BAND_STROKE_FACTOR = 4;

/** Edge of the view (left/right/bottom/top) for each part edge; face B is mirrored along u. */
function viewSides(face: 'A' | 'B'): Record<'left' | 'right' | 'bottom' | 'top', EdgeId> {
  return face === 'A' ? { left: 'u0', right: 'u1', bottom: 'v0', top: 'v1' } : { left: 'u1', right: 'u0', bottom: 'v0', top: 'v1' };
}

/** To-scale view of one face; y grows upwards like the plan coordinates (origin bottom-left, plan F.10). */
export function DrillingPlanSvg({ plan, face, partName }: { plan: DrillingPlan; face: PlanFace; partName: string }) {
  const { t, formatMm } = useT();
  const L = plan.lengthMm;
  const W = plan.widthMm;
  const unit = Math.max(L, W) / 60;
  const margin = unit * 5;
  const sides = viewSides(face.face);
  const banded = new Set(plan.bandedEdges);
  const line = unit / 8;
  const Y = (y: number) => W - y;
  const faceName = t(`face.${face.semantic}`);

  const edges = [
    { side: 'bottom', x1: 0, y1: W, x2: L, y2: W, lx: L / 2, ly: W + unit * 2.2, anchor: 'middle' },
    { side: 'top', x1: 0, y1: 0, x2: L, y2: 0, lx: L / 2, ly: -unit * 1.2, anchor: 'middle' },
    { side: 'left', x1: 0, y1: 0, x2: 0, y2: W, lx: -unit * 0.8, ly: W / 2, anchor: 'end' },
    { side: 'right', x1: L, y1: 0, x2: L, y2: W, lx: L + unit * 0.8, ly: W / 2, anchor: 'start' },
  ] as const;

  return (
    <svg
      className="drilling-svg"
      viewBox={`${String(-margin * 2.2)} ${String(-margin)} ${String(L + margin * 4.4)} ${String(W + margin * 2)}`}
      role="img"
      aria-label={t('drilling.svgLabel', { name: partName, face: faceName })}
      data-face={face.face}
    >
      <rect x={0} y={0} width={L} height={W} className="part-outline" strokeWidth={line} />
      {edges.map((e) => {
        const edgeId = sides[e.side];
        return (
          <g key={e.side} data-edge={edgeId}>
            {banded.has(edgeId) && (
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="banded-edge" strokeWidth={line * BAND_STROKE_FACTOR} />
            )}
            <text x={e.lx} y={e.ly} fontSize={unit} textAnchor={e.anchor} dominantBaseline="middle" className="edge-label">
              {t(`edge.${face.edgeNames[edgeId]}`)}
            </text>
          </g>
        );
      })}
      <circle cx={0} cy={W} r={unit / 3} className="origin" />
      <text x={-unit * 0.5} y={W + unit * 1.1} fontSize={unit * 0.8} textAnchor="end" className="origin-label">
        0,0
      </text>

      {face.holes.map((h) => {
        const r = Math.max(h.diameterMm / 2, unit / 6);
        const cy = Y(h.yMm);
        return (
          <g key={h.ref} data-ref={h.ref}>
            {h.countersinkDiameterMm !== null && (
              <circle cx={h.xMm} cy={cy} r={h.countersinkDiameterMm / 2} className="hole-countersink" strokeWidth={line / 2} />
            )}
            <circle cx={h.xMm} cy={cy} r={r} className="hole" strokeWidth={line / 2} />
            {h.depth === 'through' && (
              <path d={`M ${String(h.xMm - r)} ${String(cy - r)} L ${String(h.xMm + r)} ${String(cy + r)} M ${String(h.xMm - r)} ${String(cy + r)} L ${String(h.xMm + r)} ${String(cy - r)}`} className="hole-through" strokeWidth={line / 2} />
            )}
            <text x={h.xMm + r + unit * 0.2} y={cy - r - unit * 0.1} fontSize={unit * 0.7} className="hole-label">
              {h.ref}
            </text>
          </g>
        );
      })}
      {face.marks.map((m) => {
        const s = unit / 3;
        const cy = Y(m.yMm);
        return (
          <g key={m.ref} data-ref={m.ref}>
            <path d={`M ${String(m.xMm - s)} ${String(cy)} L ${String(m.xMm + s)} ${String(cy)} M ${String(m.xMm)} ${String(cy - s)} L ${String(m.xMm)} ${String(cy + s)}`} className="mark" strokeWidth={line} />
            <text x={m.xMm + s} y={cy - s} fontSize={unit * 0.6} className="hole-label">
              {m.ref}
            </text>
          </g>
        );
      })}
      <title>{`${t('drilling.svgLabel', { name: partName, face: faceName })} – ${formatMm(L)} × ${formatMm(W)} mm`}</title>
    </svg>
  );
}
