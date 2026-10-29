import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 0.95 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.8, offset * 0.35, dist * (darkness + dist));
      gl_FragColor = color;
    }
  `,
};

const BLOOM_STRENGTH = 0.25;

/**
 * Mild cinematic post stack: scene render → UnrealBloom → vignette.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 */
export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_STRENGTH,
    0.4,
    0.85
  );
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(VignetteShader));

  if (!window.__ZFPS_FX) {
    window.__ZFPS_FX = { bloom: true };
  }

  return {
    composer,
    bloom,
    setSize(w, h) {
      composer.setSize(w, h);
    },
    render() {
      const enabled = window.__ZFPS_FX?.bloom !== false;
      bloom.strength = enabled ? BLOOM_STRENGTH : 0;
      composer.render();
    },
  };
}
