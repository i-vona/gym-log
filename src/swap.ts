import { db, type Exercise, type Plan, type PlanItem } from './db';
import { MUSCLES } from './anim/muscles';
import { DEFAULT_INPUT, hasEquip, metaOf, normalizeInput, type Equip, type GenInput } from './generator';
import type { Muscle } from './anim/figure';

export interface Alternative {
  ex: Exercise;
  sameMovement: boolean;
  /** Primary muscles it shares with the original. */
  shared: Muscle[];
}

/** Equipment the user has, as set in the workout builder (a full gym if never set). */
export async function userEquipment(): Promise<Equip[]> {
  const m = await db.meta.get('genInput');
  return m ? normalizeInput(m.value as GenInput).equip : DEFAULT_INPUT.equip;
}

/**
 * Built-in exercises that can replace `ex`: same kind of logging (reps / hold / carry), at
 * least one shared main muscle, and equipment that is available. Same movement first,
 * then more shared muscles, then closest difficulty.
 */
export function alternatives(ex: Exercise, all: Exercise[], equip: Equip[]): Alternative[] {
  const tg = ex.key ? MUSCLES[ex.key] : undefined;
  const meta = metaOf(ex.key);
  if (!tg) return [];
  const mains = tg.p.filter((m) => m !== 'cardio');
  const out: (Alternative & { lvlGap: number })[] = [];
  for (const c of all) {
    if (!c.key || c.id === ex.id || c.type !== ex.type) continue;
    const ct = MUSCLES[c.key];
    const cm = metaOf(c.key);
    if (!ct || !cm || !hasEquip(equip, cm.eq)) continue;
    const shared = ex.type === 'cardio' ? ['cardio' as Muscle] : mains.filter((m) => ct.p.includes(m));
    if (!shared.length) continue;
    out.push({ ex: c, sameMovement: !!meta && cm.p === meta.p, shared, lvlGap: Math.abs(cm.lvl - (meta?.lvl ?? 1)) });
  }
  return out
    .sort((a, b) => Number(b.sameMovement) - Number(a.sameMovement) || b.shared.length - a.shared.length || a.lvlGap - b.lvlGap)
    .slice(0, 8);
}

/** A swapped plan item remembers what it replaced. */
export type SwappedItem = PlanItem & { from?: { ex?: string; exId?: number } };

/** The plan with today's swaps applied (keys are "section-item" indices). */
export function applySwaps(plan: Plan, swaps: Record<string, { ex?: string; exId?: number }> | undefined): Plan {
  if (!swaps || !Object.keys(swaps).length) return plan;
  return {
    ...plan,
    sections: plan.sections.map((sec, si) => ({
      ...sec,
      items: sec.items.map((it, i): SwappedItem => {
        const s = swaps[`${si}-${i}`];
        return s ? { ...it, ex: s.ex, exId: s.exId, from: { ex: it.ex, exId: it.exId } } : it;
      }),
    })),
  };
}
