import { useEffect, useRef } from 'react'

type OceanAnimationProps = {
  className?: string
}

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  const int STEPS = 72;
  const float MAX_DISTANCE = 58.0;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float choppyLayer(vec2 p, float choppiness) {
    p += noise(p * 0.75) * 0.55;

    vec2 wave = 1.0 - abs(sin(p));
    vec2 swell = abs(cos(p * 0.82));
    vec2 crease = mix(wave, swell, wave);
    float ridge = pow(1.0 - pow(crease.x * crease.y, 0.45), choppiness);

    return ridge;
  }

  float oceanHeight(vec2 p) {
    float height = 0.0;
    float amplitude = 0.56;
    float frequency = 0.17;
    float choppiness = 3.2;
    vec2 drift = vec2(uTime * 0.44, uTime * 0.28);
    vec2 q = p;

    for (int i = 0; i < 6; i++) {
      vec2 forward = q * frequency + drift;
      vec2 cross = rotate2d(1.18) * q * frequency - drift.yx * 0.92;
      float layer = choppyLayer(forward, choppiness) + choppyLayer(cross, choppiness);

      height += (layer - 1.04) * amplitude;
      q = rotate2d(0.82) * q * 1.72;
      amplitude *= 0.47;
      frequency *= 1.84;
      choppiness = mix(choppiness, 1.25, 0.22);
      drift *= 1.12;
    }

    height += sin(p.x * 0.42 + uTime * 0.55) * 0.18;
    height += sin((p.x + p.y) * 0.24 - uTime * 0.38) * 0.16;

    return height;
  }

  float mapOcean(vec3 p) {
    return p.y - oceanHeight(p.xz);
  }

  vec3 skyColor(vec3 rd) {
    float horizon = pow(1.0 - max(rd.y, 0.0), 2.6);
    vec3 highSky = vec3(0.34, 0.72, 0.88);
    vec3 lowSky = vec3(0.70, 0.92, 0.98);
    vec3 deepSky = vec3(0.04, 0.17, 0.29);
    vec3 sky = mix(highSky, lowSky, horizon);
    sky = mix(deepSky, sky, smoothstep(-0.15, 0.75, rd.y));

    vec3 sunDir = normalize(vec3(-0.45, 0.42, -0.28));
    float sun = pow(max(dot(rd, sunDir), 0.0), 420.0);
    float glow = pow(max(dot(rd, sunDir), 0.0), 6.0) * 0.18;

    return sky + vec3(1.0, 0.78, 0.52) * sun + vec3(0.74, 0.92, 1.0) * glow;
  }

  bool traceOcean(vec3 ro, vec3 rd, out vec3 hit, out float travel) {
    float t = 0.0;
    float lastT = 0.0;
    float lastHeight = mapOcean(ro);

    for (int i = 0; i < STEPS; i++) {
      float stepSize = mix(0.08, 1.28, float(i) / float(STEPS));
      t += stepSize;
      vec3 p = ro + rd * t;
      float height = mapOcean(p);

      if (height < 0.0) {
        float low = lastT;
        float high = t;

        for (int j = 0; j < 6; j++) {
          float mid = mix(low, high, 0.5);
          vec3 midPoint = ro + rd * mid;
          float midHeight = mapOcean(midPoint);

          if (midHeight < 0.0) {
            high = mid;
          } else {
            low = mid;
          }
        }

        travel = high;
        hit = ro + rd * high;
        return true;
      }

      if (t > MAX_DISTANCE) {
        break;
      }

      lastT = t;
      lastHeight = height;
    }

    travel = MAX_DISTANCE;
    hit = ro + rd * MAX_DISTANCE;
    return lastHeight < 0.0;
  }

  vec3 oceanNormal(vec3 p, float distanceFromCamera) {
    float eps = mix(0.035, 0.18, clamp(distanceFromCamera / MAX_DISTANCE, 0.0, 1.0));
    float center = oceanHeight(p.xz);
    float x = oceanHeight(p.xz + vec2(eps, 0.0));
    float z = oceanHeight(p.xz + vec2(0.0, eps));

    return normalize(vec3(center - x, eps, center - z));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    float vignette = smoothstep(1.45, 0.35, length(vUv - 0.5));

    vec3 ro = vec3(0.0, 2.55, 5.8 + uTime * 0.12);
    vec3 rd = normalize(vec3(uv.x * 1.05, uv.y * 0.74 - 0.2, -1.36));
    rd.xz = rotate2d(sin(uTime * 0.05) * 0.035) * rd.xz;
    rd.yz = rotate2d(-0.18) * rd.yz;

    vec3 hit;
    float travel;
    vec3 color = skyColor(rd);

    if (traceOcean(ro, rd, hit, travel)) {
      vec3 normal = oceanNormal(hit, travel);
      vec3 lightDir = normalize(vec3(-0.46, 0.66, -0.42));
      vec3 viewDir = normalize(ro - hit);
      vec3 reflection = skyColor(reflect(rd, normal));

      float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
      float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
      float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
      float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 92.0);
      float crest = smoothstep(0.18, 0.78, oceanHeight(hit.xz));
      float foam = crest * (1.0 - smoothstep(0.24, 0.78, normal.y));
      float depthFade = smoothstep(0.0, 32.0, travel);

      vec3 deepWater = vec3(0.006, 0.075, 0.13);
      vec3 midWater = vec3(0.0, 0.34, 0.46);
      vec3 shallowWater = vec3(0.09, 0.62, 0.66);
      vec3 water = mix(deepWater, midWater, diffuse * 0.62 + 0.18);

      water = mix(water, shallowWater, pow(facing, 1.5) * 0.32);
      water = mix(water, reflection, fresnel * 0.68);
      water += vec3(0.92, 0.98, 1.0) * foam * 0.28;
      water += vec3(1.0, 0.86, 0.58) * specular * 0.9;
      water = mix(water, skyColor(rd), depthFade * 0.5);

      color = water;
    }

    color = mix(color * 0.72, color, vignette);
    gl_FragColor = vec4(color, 1.0);
  }
`

function OceanAnimation({ className }: OceanAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current

    if (!container || !canvas || typeof window.WebGLRenderingContext === 'undefined') {
      return
    }

    let disposeScene: (() => void) | undefined
    let didUnmount = false

    void import('three').then((THREE) => {
      if (didUnmount) {
        return
      }

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'high-performance',
      })
      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
      }
      const geometry = new THREE.PlaneGeometry(2, 2)
      const material = new THREE.ShaderMaterial({
        fragmentShader,
        transparent: true,
        uniforms,
        vertexShader,
      })
      const ocean = new THREE.Mesh(geometry, material)
      let frameId: number | undefined

      scene.add(ocean)

      renderer.setClearColor(0x000000, 0)

      const resize = () => {
        const { width, height } = container.getBoundingClientRect()

        if (width === 0 || height === 0) {
          return
        }

        const pixelRatio = Math.min(window.devicePixelRatio, 1.65)

        renderer.setPixelRatio(pixelRatio)
        renderer.setSize(width, height, false)
        uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio)
      }

      const renderFrame = (time = 1500) => {
        uniforms.uTime.value = time * 0.001
        ocean.rotation.z = Math.sin(uniforms.uTime.value * 0.12) * 0.05
        renderer.render(scene, camera)

        if (!reducedMotion) {
          frameId = window.requestAnimationFrame(renderFrame)
        }
      }

      const resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)
      resize()
      renderFrame()

      disposeScene = () => {
        if (frameId !== undefined) {
          window.cancelAnimationFrame(frameId)
        }

        resizeObserver.disconnect()
        geometry.dispose()
        material.dispose()
        renderer.dispose()
      }
    })

    return () => {
      didUnmount = true
      disposeScene?.()
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={['ocean-animation', className].filter(Boolean).join(' ')}
      data-testid="ocean-animation"
      data-ocean-style="raymarched-heightfield"
      ref={containerRef}
    >
      <canvas className="ocean-animation__canvas" ref={canvasRef} />
    </div>
  )
}

export default OceanAnimation
