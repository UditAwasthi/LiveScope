'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = { color?: string; accent?: string; className?: string };

/**
 * Three planes, three trust levels: three bevelled steel plates — data,
 * control, AI — stacked with air between them. Telemetry rises through the
 * stack as small points. Hover lifts the plates apart.
 */
export function PlaneStack({ color = '#C9CED4', accent = '#D97757', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const plates: THREE.Mesh[] = [];
    const shades = ['#AEB5BC', color, '#E3E6EA'];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(2.6, 0.08, 1.8, 1, 1, 1);
      const m = new THREE.Mesh(g, steelMaterial(shades[i], 0.2 + i * 0.05));
      m.position.y = (i - 1) * 0.55;
      root.add(m);
      plates.push(m);
      // A thin accent inlay on the AI plane edge: bounded capability.
      if (i === 2) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 0.03), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(accent), emissiveIntensity: 0.25 }));
        strip.position.set(0, 0.046, 0.86);
        m.add(strip);
      }
    }

    // Points rising through the stack.
    const N = 140;
    const arr = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 2.2;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 2.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      seeds[i] = 0.3 + Math.random() * 0.5;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const points = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#E3E6EA', size: 0.028, transparent: true, opacity: 0.75, depthWrite: false }));
    root.add(points);
    root.rotation.set(0.5, -0.6, 0);

    let lift = 0;
    let target = 0;
    const enter = () => (target = 1);
    const leave = () => (target = 0);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    const drag = attachDrag(el, 0.004);

    const h = mountScene(el, {
      fov: 28,
      z: 7.2,
      onFrame(dt) {
        lift += (target - lift) * (1 - Math.exp(-dt * 5));
        plates.forEach((p, i) => (p.position.y = (i - 1) * (0.55 + lift * 0.45)));
        const a = pg.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < N; i++) {
          let y = a.getY(i) + dt * seeds[i];
          if (y > 1.3) y = -1.3;
          a.setY(i, y);
        }
        a.needsUpdate = true;
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.06 * dt);
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + d.x, 0.15, 1.1);
      },
    });
    h.scene.add(root);

    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      drag.dispose();
      h.dispose();
    };
  }, [color, accent]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
