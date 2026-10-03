'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachDrag, mountScene, steelMaterial } from './canvas';

type Props = { color?: string; className?: string; explodeOnHover?: boolean };

/**
 * A polished-steel dodecahedron cut into its twelve faces. The faces push out
 * along their normals on hover (or click on touch), then settle back — the
 * same thing Fix Lab does to a candidate: take it apart, look, put it back.
 */
export function MetalSolid({ color = '#C9CED4', className = '', explodeOnHover = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = new THREE.Group();
    const base = new THREE.DodecahedronGeometry(1, 0).toNonIndexed();
    const pos = base.getAttribute('position') as THREE.BufferAttribute;
    // 12 pentagons × 3 triangles × 3 vertices.
    const faces: { mesh: THREE.Mesh; normal: THREE.Vector3 }[] = [];
    const mat = steelMaterial(color, 0.2);
    for (let f = 0; f < 12; f++) {
      const verts: number[] = [];
      for (let v = f * 9; v < f * 9 + 9; v++) verts.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.computeVertexNormals();
      const n = new THREE.Vector3(verts[0], verts[1], verts[2]).add(new THREE.Vector3(verts[3], verts[4], verts[5])).add(new THREE.Vector3(verts[6], verts[7], verts[8])).normalize();
      const mesh = new THREE.Mesh(g, mat);
      root.add(mesh);
      faces.push({ mesh, normal: n });
    }
    // A dark core so the gaps read as depth, not holes.
    root.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.86, 0), new THREE.MeshStandardMaterial({ color: '#15181c', metalness: 0.6, roughness: 0.6 })));

    let target = 0;
    let open = 0;
    let toggled = false;
    const enter = () => explodeOnHover && (target = 1);
    const leave = () => explodeOnHover && !toggled && (target = 0);
    const click = () => {
      toggled = !toggled;
      target = toggled ? 1 : 0;
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('click', click);
    const drag = attachDrag(el, 0.005);

    const h = mountScene(el, {
      fov: 28,
      z: 5.2,
      onFrame(dt) {
        open += (target - open) * (1 - Math.exp(-dt * 6));
        faces.forEach(({ mesh, normal }) => mesh.position.copy(normal).multiplyScalar(open * 0.32));
        const d = drag.step(dt);
        root.rotation.y += d.y + (drag.isDragging() ? 0 : 0.18 * dt);
        root.rotation.x += d.x + (drag.isDragging() ? 0 : 0.07 * dt);
      },
    });
    h.scene.add(root);

    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('click', click);
      drag.dispose();
      h.dispose();
    };
  }, [color, explodeOnHover]);

  return <div ref={ref} className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className}`} aria-hidden />;
}
