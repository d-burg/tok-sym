// Wall tile fragment shader
// Grid lines, Fresnel highlights, per-tile variation, depth shading, region coloring.

precision highp float;

uniform vec3 u_tileColor;
uniform vec2 u_gridSpacing;       // poloidal, toroidal
uniform vec2 u_inboardGridSpacing;
uniform vec2 u_limiterGridSpacing;
uniform vec2 u_divertorGridSpacing;
uniform float u_tileGridDarken;
uniform float u_fresnelStrength;
uniform float u_borderWidth;
uniform float u_totalArc;         // total poloidal arc length in metres
uniform float u_nSlices;          // number of toroidal slices
uniform float u_maxDepth;         // depth range for shading
uniform vec3 u_divertorColor;
uniform float u_hasDivertor;      // 0 or 1
uniform float u_inboardStyle;     // 0 = tiles, 1 = bands
uniform float u_bandWidth;
uniform float u_vertBandWidth;    // vertical (toroidal) banding width; 0 = off
uniform float u_vertBandContrast; // brightness variation between alternating bands

// Strike point illumination
uniform vec4 u_strikePoints[8];   // (x, y, z, intensity) — up to 8
uniform int u_nStrikePoints;
uniform vec3 u_strikeColor;       // per-device glow color for wall illumination

// Extra port positions: (x, y, z, radius) in Cartesian world space
uniform vec4 u_extraPorts[64];
// Extra port shape info: (shape, toroidalExtent, zRadius, 0)
// shape: 0=circle, 1=square, 2=stadium
uniform vec4 u_extraPortInfo[64];
uniform int u_nExtraPorts;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_viewDir;
varying vec3 v_worldPos;
varying float v_region;
varying float v_tileHash;
varying float v_depth;

// Test whether a fragment falls inside any extra port opening.
// Returns 0.0 outside all ports, 1.0 at the center of a port.
// Port centers are stored as uniform vec4(x, y, z, radius) in Cartesian.
// Iterates all 24 slots; empty ports have radius=0 and are skipped.
float portTest(vec3 worldPos) {
  float maxInside = 0.0;
  for (int i = 0; i < 64; i++) {
    vec4 port = u_extraPorts[i];
    float rr = port.w;
    if (rr < 0.001) continue; // empty slot
    vec3 center = port.xyz;
    float dist = length(worldPos - center);
    if (dist > rr * 1.5) continue; // quick reject
    float normDist = dist / rr;
    float inside = 1.0 - smoothstep(0.7, 1.0, normDist);
    maxInside = max(maxInside, inside);
  }
  return maxInside;
}

float gridProximity(vec2 pos, vec2 spacing) {
  vec2 cell = pos / spacing;
  vec2 f = fract(cell);
  vec2 dist = min(f, 1.0 - f) * spacing;
  float minDist = min(dist.x, dist.y);
  return smoothstep(0.0, u_borderWidth, minDist);
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(v_viewDir);

  // Region-based grid spacing
  int region = int(v_region + 0.5);
  vec2 spacing = u_gridSpacing;
  vec3 baseColor = u_tileColor;

  if (region == 1) { // Inboard
    spacing = u_inboardGridSpacing;
  } else if (region == 2) { // Limiter
    spacing = u_limiterGridSpacing;
  } else if (region == 5 && u_hasDivertor > 0.5) { // Divertor
    spacing = u_divertorGridSpacing;
    baseColor = u_divertorColor;
  } else if (region == 4) { // Antenna — metallic Faraday screen look
    baseColor = vec3(52.0, 50.0, 48.0);
    spacing = u_gridSpacing * 0.6;
  }

  // Poloidal/toroidal position in metres
  vec2 worldUV = vec2(v_uv.x * u_totalArc, v_uv.y * u_nSlices * spacing.y);

  // Grid proximity (0 at grid line, 1 between lines)
  float gp;
  if (region == 1 && u_inboardStyle > 0.5) {
    // JET-style horizontal bands
    float bandPos = v_uv.x * u_totalArc;
    float bandCell = bandPos / u_bandWidth;
    float bandF = fract(bandCell);
    float bandDist = min(bandF, 1.0 - bandF) * u_bandWidth;
    gp = smoothstep(0.0, u_borderWidth, bandDist);
  } else {
    gp = gridProximity(vec2(v_uv.x * u_totalArc, v_uv.y * u_nSlices * spacing.y), spacing);
  }

  // ── Vertical (toroidal) banding — JET-style octant panels ──
  // Wide vertical bands with alternating brightness and subtle relief lines
  // at band boundaries, extending all the way around poloidally.
  float bandMod = 1.0;
  if (u_vertBandWidth > 0.001) {
    float toroidalPos = v_uv.y * u_nSlices * spacing.y;
    float bandIndex = floor(toroidalPos / u_vertBandWidth);
    float bandFract = fract(toroidalPos / u_vertBandWidth);
    // Alternating brightness
    float isOdd = mod(bandIndex, 2.0);
    bandMod = mix(1.0, 1.0 - u_vertBandContrast, isOdd);
    // Subtle relief groove at band boundaries
    float edgeDist = min(bandFract, 1.0 - bandFract) * u_vertBandWidth;
    float groove = 1.0 - (1.0 - smoothstep(0.0, 0.012, edgeDist)) * 0.4;
    bandMod *= groove;
  }

  // Per-tile brightness variation
  float tileVar = 0.92 + v_tileHash * 0.16; // range 0.92 — 1.08

  // Depth-based ambient (darker tiles further from camera)
  // Much darker interior — divertor glow should be the primary light source
  float df = clamp(v_depth / u_maxDepth, 0.0, 1.0);
  float depthMod = 0.04 + (1.0 - df) * 0.36;

  // Fresnel (grazing angle brightening)
  // Use abs() so both normal orientations work correctly
  float NdotV = abs(dot(N, V));
  float fresnel = pow(1.0 - NdotV, 4.0) * u_fresnelStrength * 0.4;

  // Combine tile color
  vec3 color = baseColor / 255.0;
  color *= tileVar * depthMod * bandMod;

  // Grid line darkening
  color *= mix(1.0 - u_tileGridDarken, 1.0, gp);

  // Fresnel highlight
  color += vec3(fresnel);

  // Strike point wall illumination
  for (int i = 0; i < 8; i++) {
    if (i >= u_nStrikePoints) break;
    vec3 sp = u_strikePoints[i].xyz;
    float intensity = u_strikePoints[i].w;
    float dist = length(v_worldPos - sp);
    float falloff = intensity / (1.0 + dist * dist * 12.0);
    color += u_strikeColor * falloff * 0.35;
  }

  // ── Extra port openings ──
  // Each port: position (x,y,z,radius) + info (shape, toroidalExtent, zRadius, 0)
  // Decompose 3D offset into poloidal (Z) and toroidal (phi-arc) components
  // on the wall surface, then apply shape-specific distance functions.
  float fragR = length(v_worldPos.xy);
  float fragPhi = atan(v_worldPos.y, v_worldPos.x);
  float fragZ = v_worldPos.z;

  for (int i = 0; i < 64; i++) {
    vec4 port = u_extraPorts[i];
    if (port.w < 0.001) continue; // empty slot
    vec4 pinfo = u_extraPortInfo[i];

    // Quick 3D reject
    float dist3d = length(v_worldPos - port.xyz);
    if (dist3d > port.w * 3.0) continue;

    // Decompose into wall-surface coordinates
    float portR = length(port.xy);
    float portPhi = atan(port.y, port.x);
    float portZ = port.z;

    float dz = fragZ - portZ;       // poloidal (vertical) offset
    float dphi = fragPhi - portPhi;  // toroidal angle offset
    // Wrap phi to [-pi, pi]
    if (dphi > 3.14159) dphi -= 6.28318;
    if (dphi < -3.14159) dphi += 6.28318;
    float dtor = dphi * portR;       // toroidal arc-length offset

    float rr = port.w;              // radius (half-width in toroidal dir)
    float zR = pinfo.z;             // zRadius (half-height in poloidal dir)
    if (zR < 0.001) zR = rr;
    float shape = pinfo.x;          // 0=circle, 1=square, 2=stadium
    float ext = pinfo.y;            // toroidal half-extent for stadium

    float inside = 0.0;

    if (shape < 0.5) {
      // Circle: simple radial test
      float ellipDist = sqrt((dz * dz) / (zR * zR) + (dtor * dtor) / (rr * rr));
      inside = 1.0 - smoothstep(0.7, 1.0, ellipDist);
    } else if (shape < 1.5) {
      // Square/rectangle: box distance in (dz, dtor)
      float bx = abs(dtor) / rr;
      float by = abs(dz) / zR;
      float boxDist = max(bx, by);
      inside = 1.0 - smoothstep(0.7, 1.0, boxDist);
    } else {
      // Stadium/racetrack: rectangle with semicircle caps, vertically oriented.
      // The straight section extends in the Z (poloidal) direction by 'ext',
      // giving a tall narrow shape typical of DIII-D upper/lower diagnostic ports.
      float reducedZ = max(abs(dz) - ext, 0.0);
      float stadDist = sqrt((reducedZ * reducedZ) / (zR * zR) + (dtor * dtor) / (rr * rr));
      // Enforce outer bounding box
      float totalHalfH = zR + ext;
      if (abs(dz) > totalHalfH * 1.1) stadDist = 2.0;
      inside = 1.0 - smoothstep(0.7, 1.0, stadDist);
    }

    if (inside > 0.01) {
      float texType = pinfo.w;  // 0=dark, 1=rf

      if (texType > 0.5) {
        // ── RF emitter / Faraday screen texture ──
        // Modelled after JET A2 ICRH antennas: clusters of downward-angled
        // ridges in 3-4 vertical sections, darker matte gray finish.

        // Wide ridges: angled slightly downward (mix of Z and toroidal)
        // The angle creates a slight diagonal pattern like real Faraday screens
        float ridgeSpacing = 0.045;  // wider ridges to avoid aliasing
        float ridgeCoord = dz + dtor * 0.3;  // angled downward
        float ridgePhase = ridgeCoord / ridgeSpacing;
        float ridgeFract = fract(ridgePhase);
        // Wider, softer ridges
        float ridge = smoothstep(0.0, 0.25, ridgeFract) * (1.0 - smoothstep(0.55, 0.80, ridgeFract));

        // Cluster into 3-4 vertical sections within each port.
        // Use toroidal position to create vertical dividers between clusters.
        float clusterSpacing = rr * 0.55;  // ~3-4 clusters across port width
        float clusterPhase = dtor / clusterSpacing;
        float clusterFract = fract(clusterPhase + 0.5);
        // Narrow dark gap between clusters
        float clusterGap = 1.0 - smoothstep(0.0, 0.06, clusterFract)
                              - (1.0 - smoothstep(0.94, 1.0, clusterFract));
        ridge *= (1.0 - clusterGap);

        // Near-black matte base
        vec3 rfBase = vec3(0.016, 0.017, 0.019);
        // Ridge — very subtle lighter matte
        vec3 rfRidge = vec3(0.038, 0.040, 0.044);
        // Almost imperceptible view-angle highlight
        float rfSheen = pow(NdotV, 5.0) * 0.008;

        vec3 rfColor = mix(rfBase, rfRidge, ridge) + vec3(rfSheen * ridge);

        // Thin border frame
        float borderDist;
        if (shape < 0.5) {
          borderDist = sqrt((dz*dz)/(zR*zR) + (dtor*dtor)/(rr*rr));
        } else if (shape < 1.5) {
          borderDist = max(abs(dtor)/rr, abs(dz)/zR);
        } else {
          float rZ = max(abs(dz) - ext, 0.0);
          borderDist = sqrt((rZ*rZ)/(zR*zR) + (dtor*dtor)/(rr*rr));
        }
        float frame = smoothstep(0.85, 0.90, borderDist) * (1.0 - smoothstep(0.93, 1.0, borderDist));
        rfColor += vec3(0.06) * frame;

        color = mix(color, rfColor, inside);
      } else {
        // ── Dark recess (NBI ports, circular viewports) ──
        // Nearly black center, slightly lighter rim, thin metal lip
        float shade = mix(0.008, 0.03, inside * inside * 0.5);
        // Subtle rim highlight
        float borderDist;
        if (shape < 0.5) {
          borderDist = sqrt((dz*dz)/(zR*zR) + (dtor*dtor)/(rr*rr));
        } else if (shape < 1.5) {
          borderDist = max(abs(dtor)/rr, abs(dz)/zR);
        } else {
          float rZ = max(abs(dz) - ext, 0.0);
          borderDist = sqrt((rZ*rZ)/(zR*zR) + (dtor*dtor)/(rr*rr));
        }
        float rim = smoothstep(0.85, 0.92, borderDist) * (1.0 - smoothstep(0.92, 1.0, borderDist));
        shade += rim * 0.05 * NdotV;

        color = mix(color, vec3(shade), inside);
      }
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
