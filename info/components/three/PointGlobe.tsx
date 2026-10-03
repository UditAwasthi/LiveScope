'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = { points?: number; color?: string; healthy?: string; failure?: string; className?: string };

/**
 * Status as a globe: a Fibonacci sphere of telemetry points around a small
 * steel core. Most points are steel; a scattering are healthy green and a few
 * blink failure red and recover. Drag to turn.
 */
export function PointGlobe({ points = 1400, color = '#9AA1A9', healthy = '#8FA66B', failure = '#D45A49', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const R = 1.6;
    const pos = new Float32Array(points * 3);
    const col = new Float32Array(points * 3);
    const base = new THREE.Color(color);
    const ok = new THREE.Color(healthy);
    const bad = new THREE.Color(failure);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const kinds: number[] = [];
    for (let i = 0; i < points; i++) {
      const y = 1 - (i / (points - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      const kind = i % 23 === 0 ? 1 : i % 311 === 7 ? 2 : 0;
      kinds.push(kind);
      const c = kind === 1 ? ok : base;
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const cloud = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, sizeAttenuation: true }));
    root.add(cloud);
    root.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), steelMaterial('#C9CED4', 0.15)));
    // A thin equator ring in steel.
    const eq = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.012, 10, 200), steelMaterial('#9AA1A9', 0.3));
    eq.rotation.x = Math.PI / 2;
    root.add(eq);
    root.rotation.x = 0.35;

    const drag = attachDrag(el, 0.005);
    let t = 0;
    const colorAttr = g.getAttribute('color') as THREE.BufferAttribute;
    const h = mountScene(el, {
      fov: 30,
      z: 8,
      onFrame(dt) {
        t += dt;
        // Failure points pulse red then recover to green over a 6 s cycle.
        for (let i = 0; i < points; i++) {
          if (kinds[i] !== 2) continue;
          const k = (Math.sin(t * 1.1 + i) + 1) / 2;
          const c = bad.clone().lerp(ok, k);
          colorAttr.setXYZ(i, c.r, c.g, c.b);
        }
        colorAttr.needsUpdate = true;
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.1 * dt);
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + d.x, -0.6, 0.9);
      },
    });
    h.scene.add(root);

    return () => {
      drag.dispose();
      h.dispose();
    };
  }, [points, color, healthy, failure]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
