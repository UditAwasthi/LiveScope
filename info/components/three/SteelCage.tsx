'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = { color?: string; coreColor?: string; className?: string };

/**
 * Bounded capability: an accent core inside a steel icosahedral cage. The core
 * drifts and the cage turns, but the core never leaves it. Drag to turn.
 */
export function SteelCage({ color = '#C9CED4', coreColor = '#D97757', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const edges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.35, 1));
    const pos = edges.getAttribute('position') as THREE.BufferAttribute;
    const bar = steelMaterial(color, 0.22);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pos.count; i += 2) {
      const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const len = a.distanceTo(b);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 10), bar);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
      root.add(mesh);
    }
    // Joints.
    const seen = new Set<string>();
    const jointGeo = new THREE.SphereGeometry(0.045, 16, 12);
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const j = new THREE.Mesh(jointGeo, bar);
      j.position.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      root.add(j);
    }

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), new THREE.MeshStandardMaterial({ color: coreColor, metalness: 0.6, roughness: 0.28, emissive: new THREE.Color(coreColor), emissiveIntensity: 0.18 }));
    root.add(core);
    root.rotation.set(0.4, 0.3, 0);

    const drag = attachDrag(el, 0.005);
    let t = 0;
    const h = mountScene(el, {
      fov: 30,
      z: 6,
      onFrame(dt) {
        t += dt;
        core.position.set(Math.sin(t * 0.7) * 0.35, Math.sin(t * 0.9 + 1) * 0.3, Math.cos(t * 0.5) * 0.35);
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.12 * dt);
        root.rotation.x += d.x;
      },
    });
    h.scene.add(root);

    return () => {
      drag.dispose();
      h.dispose();
    };
  }, [color, coreColor]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
