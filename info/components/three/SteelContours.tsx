'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = { color?: string; opacity?: number; speed?: number; scale?: number; className?: string };

const frag = /* glsl */ `
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uScale;
  varying vec2 vUv;
  vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(dot(h2(i),f), dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x), mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)), dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02+vec2(17.3,9.1); a*=0.5;} return v; }
  void main(){
    vec2 uv = vUv; uv.x *= uRes.x/uRes.y;
    float t = uTime*0.03;
    float hgt = fbm(uv*uScale + vec2(t, -t*0.6)) * 0.5 + 0.5;
    float bands = 28.0;
    float f = fract(hgt*bands);
    float w = fwidth(hgt*bands) * 1.2;
    float line = 1.0 - smoothstep(0.0, w*1.6, min(f, 1.0-f));
    float idx = floor(hgt*bands);
    float heavy = mod(idx, 5.0) < 0.5 ? 1.0 : 0.45;  // every 5th line heavier
    float vignette = smoothstep(1.25, 0.25, length(vUv-0.5)*1.6);
    gl_FragColor = vec4(uColor, line * heavy * uOpacity * vignette);
  }
`;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Drifting topographic contour lines — telemetry as terrain. Pure shader. */
export function SteelContours({ color = '#8A9199', opacity = 0.35, speed = 1, scale = 2.4, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uScale: { value: scale },
    };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false }));
    scene.add(quad);

    const resize = () => {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      t += dt * speed;
      uniforms.uTime.value = t;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      quad.geometry.dispose();
      (quad.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [color, opacity, speed, scale]);

  return <div ref={ref} className={`pointer-events-none h-full w-full ${className}`} aria-hidden />;
}
