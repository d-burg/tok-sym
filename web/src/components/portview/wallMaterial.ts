import * as THREE from 'three'
import type { PortConfig } from './types'
import wallVert from './shaders/wall.vert?raw'
import wallFrag from './shaders/wall.frag?raw'

export interface StrikePointUniform {
  x: number; y: number; z: number; intensity: number
}

/**
 * Create the custom ShaderMaterial for wall tiles.
 */
export function createWallMaterial(cfg: PortConfig, totalArc: number): THREE.ShaderMaterial {
  const gridSpacing = cfg.tileGridSpacing
  const inboardSpacing = cfg.tileRegions?.inboardGridSpacing ?? gridSpacing
  const limiterSpacing = cfg.tileRegions?.limiterGridSpacing ?? gridSpacing
  const divertorSpacing = cfg.divertorRegion?.gridSpacing ?? gridSpacing
  const divertorColor = cfg.divertorRegion?.tileColor ?? cfg.tileColor

  return new THREE.ShaderMaterial({
    vertexShader: wallVert,
    fragmentShader: wallFrag,
    side: THREE.DoubleSide,
    uniforms: {
      u_tileColor: { value: new THREE.Vector3(...cfg.tileColor) },
      u_gridSpacing: { value: new THREE.Vector2(gridSpacing.poloidal, gridSpacing.toroidal) },
      u_inboardGridSpacing: { value: new THREE.Vector2(inboardSpacing.poloidal, inboardSpacing.toroidal) },
      u_limiterGridSpacing: { value: new THREE.Vector2(limiterSpacing.poloidal, limiterSpacing.toroidal) },
      u_divertorGridSpacing: { value: new THREE.Vector2(divertorSpacing.poloidal, divertorSpacing.toroidal) },
      u_tileGridDarken: { value: cfg.tileGridDarken },
      u_fresnelStrength: { value: cfg.fresnelStrength ?? 0.3 },
      u_borderWidth: { value: 0.05 },
      u_totalArc: { value: totalArc },
      u_nSlices: { value: cfg.nWallSlices },
      u_maxDepth: { value: 6.0 },
      u_divertorColor: { value: new THREE.Vector3(...divertorColor) },
      u_hasDivertor: { value: cfg.divertorRegion ? 1.0 : 0.0 },
      u_inboardStyle: { value: cfg.inboardStyle === 'bands' ? 1.0 : 0.0 },
      u_bandWidth: { value: cfg.bandWidth ?? 0.06 },
      u_strikePoints: { value: Array(8).fill(null).map(() => new THREE.Vector4(0, 0, 0, 0)) },
      u_nStrikePoints: { value: 0 },
      u_strikeColor: { value: new THREE.Vector3(1.0, 0.4, 0.15) },  // default warm orange, overridden per-device
    },
  })
}

/**
 * Update strike point positions for wall illumination.
 */
export function updateStrikePoints(
  material: THREE.ShaderMaterial,
  points: StrikePointUniform[],
): void {
  const arr = material.uniforms.u_strikePoints.value as THREE.Vector4[]
  const n = Math.min(points.length, 8)
  for (let i = 0; i < 8; i++) {
    if (i < n) {
      arr[i].set(points[i].x, points[i].y, points[i].z, points[i].intensity)
    } else {
      arr[i].set(0, 0, 0, 0)
    }
  }
  material.uniforms.u_nStrikePoints.value = n
}

/**
 * Material for extra port decal discs — very dark circles that sit on
 * the wall surface, simulating recessed port openings.
 *
 * Uses polygonOffset to win the depth test against the coplanar wall
 * geometry (a standard decal technique). The radial gradient makes the
 * center nearly black (deep recess) with a slightly lighter rim and
 * a thin bright edge suggesting a metal lip.
 */
export function createExtraPortMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 v_uv;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      void main() {
        v_uv = uv;
        v_normal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        v_viewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 v_uv;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      void main() {
        // Distance from disc center (0 at center, 1 at edge)
        float dist = length(v_uv - 0.5) * 2.0;

        // Radial depth gradient: nearly black center, slightly lighter rim
        float shade = mix(0.008, 0.035, dist * dist);

        // Subtle rim highlight from viewing angle
        float NdotV = abs(dot(normalize(v_normal), normalize(v_viewDir)));
        shade *= 0.6 + 0.4 * NdotV;

        // Thin bright rim at the very edge to suggest a metal lip
        float rim = smoothstep(0.88, 0.95, dist) * (1.0 - smoothstep(0.95, 1.0, dist));
        shade += rim * 0.06 * NdotV;

        gl_FragColor = vec4(vec3(shade), 1.0);
      }
    `,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
}

/**
 * Simple material for the port cylinder (unlit, dark grey gradient).
 */
export function createPortMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying float v_ring;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      void main() {
        v_ring = uv.y;
        v_normal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        v_viewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float v_ring;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      void main() {
        float shade = mix(0.35, 0.80, v_ring);
        float NdotV = max(dot(normalize(v_normal), normalize(v_viewDir)), 0.0);
        shade *= 0.7 + 0.3 * NdotV;
        gl_FragColor = vec4(vec3(shade * 0.12), 1.0);
      }
    `,
    side: THREE.BackSide,
  })
}
