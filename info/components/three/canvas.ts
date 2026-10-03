import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type SceneHandle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  size: { w: number; h: number };
  dispose: () => void;
};

type Options = {
  fov?: number;
  z?: number;
  /** Add a studio environment so metal has something to reflect. */
  environment?: boolean;
  onFrame: (dt: number, t: number, h: SceneHandle) => void;
};

/**
 * Minimal three.js mount: transparent renderer, DPR-capped, resize-observed,
 * paused when off-screen or when the tab is hidden. Returns a dispose().
 */
export function mountScene(container: HTMLElement, opts: Options): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 32, 1, 0.1, 100);
  camera.position.set(0, 0, opts.z ?? 7);

  let pmrem: THREE.PMREMGenerator | null = null;
  if (opts.environment !== false) {
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  const size = { w: 1, h: 1 };
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    size.w = w;
    size.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
  io.observe(container);

  const handle: SceneHandle = { renderer, scene, camera, size, dispose: () => undefined };

  let raf = 0;
  let last = performance.now();
  let t = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    t += dt;
    opts.onFrame(dt, t, handle);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  handle.dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    pmrem?.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
  return handle;
}

/** Pointer drag → angular velocity with inertial decay. */
export function attachDrag(el: HTMLElement, sensitivity = 0.005) {
  const vel = { x: 0, y: 0 };
  let dragging = false;
  let lx = 0;
  let ly = 0;
  const down = (e: PointerEvent) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    vel.y = (e.clientX - lx) * sensitivity;
    vel.x = (e.clientY - ly) * sensitivity;
    lx = e.clientX;
    ly = e.clientY;
  };
  const up = () => (dragging = false);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return {
    vel,
    isDragging: () => dragging,
    /** Call once per frame; returns the rotation delta to apply and decays. */
    step(dt: number) {
      const out = { x: vel.x, y: vel.y };
      if (!dragging) {
        const k = Math.exp(-dt * 2.2);
        vel.x *= k;
        vel.y *= k;
      } else {
        vel.x *= 0.6;
        vel.y *= 0.6;
      }
      return out;
    },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    },
  };
}

export const steelMaterial = (color: string, roughness = 0.22) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 1, roughness, envMapIntensity: 1.2 });
