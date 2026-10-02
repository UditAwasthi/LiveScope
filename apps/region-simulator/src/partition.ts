import { compare, type VectorClock } from '@livescope/vector-clock';

export interface RegionEvent {
  region: string;
  entityId: string;
  clock: VectorClock;
}

export function deliver(event: RegionEvent, localRegion: string, partitioned: boolean): { deliver: boolean; delayMs: number } {
  if (!partitioned || event.region === localRegion) return { deliver: true, delayMs: 0 };
  return { deliver: false, delayMs: 0 };
}

export function concurrentCount(clocks: VectorClock[]): number {
  let count = 0;
  for (let i = 0; i < clocks.length; i += 1) {
    for (let j = i + 1; j < clocks.length; j += 1) {
      const left = clocks[i];
      const right = clocks[j];
      if (left && right && compare(left, right) === 'CONCURRENT') count += 1;
    }
  }
  return count;
}
