'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = {
  rings?: number;
  color?: string;
  innerRadius?: number;
  gap?: number;
  thickness?: number;
  spin?: number;
  hoverBoost?: number;
  className?: string;
};

/**
 * Nested gimbal rings in polished steel. Each ring nests inside the previous
 * one on a perpendicular axis; hover speeds the spin; drag flings the assembly.
 */
export function GyroRings({ rings = 5, color = '#C9CED4', innerRadius = 0.6, gap = 0.26, thickness = 0.045, spin = 1, hoverBoost = 2.2, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const groups: THREE.Group[] = [];
    let parent: THREE.Object3D = root;
    for (let i = 0; i < rings; i++) {
      const g = new THREE.Group();
      const r = innerRadius + i * gap;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, thickness * (1 + i * 0.08), 24, 160), steelMaterial(color, 0.18 + i * 0.015));
      g.add(mesh);
      // Start mid-motion so the first frame already reads as a gimbal.
      if (i % 2 === 0) g.rotation.x = 0.9 * i + 0.4;
      else g.rotation.y = 0.9 * i + 0.4;
      parent.add(g);
      groups.push(g);
      parent = g;
    }
    root.rotation.set(0.55, -0.35, 0.1);

    let hover = 0;
    const onEnter = () => (hover = 1);
    const onLeave = () => (hover = 0);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    const drag = attachDrag(el, 0.004);

    const h = mountScene(el, {
      fov: 30,
      z: 2.2 + (innerRadius + rings * gap) * 2.1,
      onFrame(dt) {
        const boost = 1 + hover * (hoverBoost - 1);
        groups.forEach((g, i) => {
          const dir = i % 2 === 0 ? 1 : -1;
          const speed = spin * boost * (0.35 + 0.12 * (rings - i));
          if (i % 2 === 0) g.rotation.x += dir * speed * dt;
          else g.rotation.y += dir * speed * dt;
        });
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.04 * dt);
        root.rotation.x += d.x;
      },
    });
    h.scene.add(root);
    h.camera.position.y = 0.2;
    h.camera.lookAt(0, 0, 0);

    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      drag.dispose();
      h.dispose();
    };
  }, [rings, color, innerRadius, gap, thickness, spin, hoverBoost]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
