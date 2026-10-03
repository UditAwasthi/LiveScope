'use client';

import dynamic from 'next/dynamic';

const Skeleton = () => <div className="h-full w-full" aria-hidden />;
const lazy = <T extends object>(load: () => Promise<React.ComponentType<T>>) => dynamic(load, { ssr: false, loading: Skeleton });

/** Client-only, lazily loaded WebGL pieces. Server renders an empty slot. */
export const GyroRings = lazy(() => import('./GyroRings').then((m) => m.GyroRings));
export const MetalSolid = lazy(() => import('./MetalSolid').then((m) => m.MetalSolid));
export const SteelContours = lazy(() => import('./SteelContours').then((m) => m.SteelContours));
export const EventRiver = lazy(() => import('./EventRiver').then((m) => m.EventRiver));
export const LoopOrbit = lazy(() => import('./LoopOrbit').then((m) => m.LoopOrbit));
export const SteelCage = lazy(() => import('./SteelCage').then((m) => m.SteelCage));
export const PlaneStack = lazy(() => import('./PlaneStack').then((m) => m.PlaneStack));
export const PointGlobe = lazy(() => import('./PointGlobe').then((m) => m.PointGlobe));
