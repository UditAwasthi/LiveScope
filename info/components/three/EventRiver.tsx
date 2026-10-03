'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mountScene, steelMaterial } from './canvas';

type Props = { count?: number; color?: string; failureColor?: string; className?: string };

/**
 * An event stream as metal: instanced steel capsules ride a shallow curve from
 * left to right. One in every ~40 is a failure and rides in red. Hover slows
 * the stream — the "rewind" gesture from the Observe beat.
 */
export function EventRiver({ count = 120, color = '#C9CED4', failureColor = '#D45A49', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const geo = new THREE.CapsuleGeometry(0.055, 0.3, 6, 14);
    geo.rotateZ(Math.PI / 2);
    const steel = new THREE.InstancedMesh(geo, steelMaterial(color, 0.25), count);
    const red = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: failureColor, metalness: 0.7, roughness: 0.35, emissive: new THREE.Color(failureColor), emissiveIntensity: 0.25 }), Math.ceil(count / 40) + 1);

    // Per-instance lane, phase and speed. Deterministic.
    const lanes = Array.from({ length: count }, (_, i) => {
      const r = Math.sin(i * 12.9898) * 43758.5453;
      const f = r - Math.floor(r);
      const r2 = Math.sin(i * 78.233) * 43758.5453;
      const f2 = r2 - Math.floor(r2);
      return { y: (f - 0.5) * 1.3, z: (f2 - 0.5) * 0.9, phase: (i / count) * 12 + f2, speed: 0.9 + f * 0.5, fail: i % 40 === 17 };
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const SPAN = 12;

    let slow = 1;
    let targetSlow = 1;
    const enter = () => (targetSlow = 0.18);
    const leave = () => (targetSlow = 1);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);

    let t0 = 0;
    const h = mountScene(el, {
      fov: 22,
      z: 8,
      onFrame(dt) {
        slow += (targetSlow - slow) * (1 - Math.exp(-dt * 5));
        t0 += dt * slow;
        let si = 0;
        let ri = 0;
        lanes.forEach((l) => {
          const x = ((l.phase + t0 * l.speed) % SPAN) - SPAN / 2;
          const y = l.y + Math.sin(x * 0.6 + l.z) * 0.12;
          p.set(x, y, l.z);
          q.setFromEuler(new THREE.Euler(0, 0, Math.cos(x * 0.6 + l.z) * 0.07));
          m.compose(p, q, s);
          if (l.fail) red.setMatrixAt(ri++, m);
          else steel.setMatrixAt(si++, m);
        });
        steel.count = si;
        red.count = ri;
        steel.instanceMatrix.needsUpdate = true;
        red.instanceMatrix.needsUpdate = true;
      },
    });
    h.scene.add(steel, red);
    h.camera.position.set(0, 0.5, 8);
    h.camera.lookAt(0, 0, 0);

    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      h.dispose();
    };
  }, [count, color, failureColor]);

  return <div ref={ref} className={`h-full w-full select-none ${className}`} aria-hidden />;
}
