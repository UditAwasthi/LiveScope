import { create } from 'zustand';

export interface ServiceCard {
  id: string;
  status: string;
  latency: number;
  errorRate: number;
  rps: number;
}

export interface DashboardState {
  cards: Record<string, ServiceCard>;
  alerts: { id: string; message: string }[];
  health: Record<string, boolean>;
  connected: boolean;
  divergence: Record<string, number>;
  seek: Record<string, number>;
  snapshot: (cards: ServiceCard[]) => void;
  applyPatch: (id: string, changes: Record<string, number | string>) => void;
  pushAlert: (id: string, message: string) => void;
  setHealth: (name: string, ok: boolean) => void;
  setConnected: (connected: boolean) => void;
  setDivergence: (id: string, count: number) => void;
  setSeek: (id: string, at: number) => void;
}

export const useDashboard = create<DashboardState>((set) => ({
  cards: {},
  alerts: [],
  health: {},
  connected: false,
  divergence: {},
  seek: {},
  snapshot: (cards) => set({ cards: Object.fromEntries(cards.map((card) => [card.id, card])) }),
  applyPatch: (id, changes) =>
    set((state) => {
      const current = state.cards[id] ?? { id, status: 'unknown', latency: 0, errorRate: 0, rps: 0 };
      return { cards: { ...state.cards, [id]: { ...current, ...changes, id } } };
    }),
  pushAlert: (id, message) => set((state) => ({ alerts: [...state.alerts, { id, message }] })),
  setHealth: (name, ok) => set((state) => ({ health: { ...state.health, [name]: ok } })),
  setConnected: (connected) => set({ connected }),
  setDivergence: (id, count) => set((state) => ({ divergence: { ...state.divergence, [id]: count } })),
  setSeek: (id, at) => set((state) => ({ seek: { ...state.seek, [id]: at } })),
}));

export function reconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000);
}
