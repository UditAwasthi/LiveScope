'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = { stages?: number; coveredByOthers?: number; color?: string; accent?: string; className?: string };

/**
 * The reliability loop as an object: a steel track with one node per stage.
 * The first `coveredByOthers` nodes are the part every tool does; the rest are
 * finished in the accent. A small chrome carriage runs the whole loop.
 */
export function LoopOrbit({ stages = 11, coveredByOthers = 2, color = '#C9CED4', accent = '#D97757', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const R = 1.5;
    root.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.028, 16, 220), steelMaterial('#9AA1A9', 0.3)));

    // Detection (what every tool does) in dull steel; the rest of the loop in polished chrome.
    const nodeGeo = new THREE.SphereGeometry(0.11, 32, 24);
    const dull = new THREE.MeshStandardMaterial({ color: '#5F666E', metalness: 0.9, roughness: 0.55 });
    const chrome = steelMaterial(color, 0.14);
    for (let i = 0; i < stages; i++) {
      const a = (i / stages) * Math.PI * 2;
      const n = new THREE.Mesh(nodeGeo, i < coveredByOthers ? dull : chrome);
      n.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      root.add(n);
    }

    // The carriage — LiveScope — runs the whole loop in the accent.
    const carriage = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 12, 48), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.28 }));
    root.add(carriage);
    root.rotation.x = 1.05;

    const drag = attachDrag(el, 0.005);
    let phase = 0;
    const h = mountScene(el, {
      fov: 30,
      z: 6.2,
      onFrame(dt) {
        phase += dt * 0.35;
        carriage.position.set(Math.cos(phase) * R, 0, Math.sin(phase) * R);
        carriage.rotation.set(0, -phase, 0);
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.08 * dt);
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + d.x, 0.4, 1.5);
      },
    });
    h.scene.add(root);
    h.camera.position.y = 0.4;
    h.camera.lookAt(0, 0, 0);

    return () => {
      drag.dispose();
      h.dispose();
    };
  }, [stages, coveredByOthers, color, accent]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
