import { useEffect, useRef } from 'react'

type OceanAnimationProps = {
  className?: string
}

const vertexShader = `
  uniform float uTime;
  varying float vWave;

  float wave(vec2 p) {
    float rolling = sin(p.x * 1.65 + uTime * 0.85) * 0.55;
    float cross = sin((p.x + p.y) * 1.15 - uTime * 0.72) * 0.38;
    float ripple = sin(length(p) * 2.1 - uTime * 1.25) * 0.22;
    return rolling + cross + ripple;
  }

  void main() {
    vec3 pos = position;
    float elevation = wave(pos.xy);
    pos.z += elevation;
    vWave = elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  varying float vWave;

  void main() {
    vec3 deepWater = vec3(0.012, 0.09, 0.18);
    vec3 blueWater = vec3(0.0, 0.42, 0.68);
    vec3 greenWater = vec3(0.05, 0.82, 0.78);
    vec3 foam = vec3(0.82, 0.97, 1.0);

    float shimmer = sin(vWave * 5.0 + uTime * 1.6) * 0.08;
    float crest = smoothstep(0.42, 0.92, vWave);
    vec3 water = mix(deepWater, blueWater, vWave * 0.38 + 0.52 + shimmer);
    water = mix(water, greenWater, 0.18 + crest * 0.18);
    water = mix(water, foam, crest * 0.42);

    gl_FragColor = vec4(water, 0.96);
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
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'high-performance',
      })
      const uniforms = {
        uTime: { value: 0 },
      }
      const geometry = new THREE.PlaneGeometry(26, 26, 160, 160)
      const material = new THREE.ShaderMaterial({
        fragmentShader,
        transparent: true,
        uniforms,
        vertexShader,
      })
      const ocean = new THREE.Mesh(geometry, material)
      let frameId: number | undefined

      ocean.rotation.x = -Math.PI / 2.18
      ocean.position.y = -1.6
      scene.add(ocean)

      camera.position.set(0, 4.3, 8.6)
      camera.lookAt(0, -1.2, 0)

      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      const resize = () => {
        const { width, height } = container.getBoundingClientRect()

        if (width === 0 || height === 0) {
          return
        }

        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
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
      ref={containerRef}
    >
      <canvas className="ocean-animation__canvas" ref={canvasRef} />
    </div>
  )
}

export default OceanAnimation
