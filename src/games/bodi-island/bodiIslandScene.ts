import {
  canCraftShadowBoots,
  collectDarkFuzz,
  craftShadowBoots,
  movementSpeed,
  type EnemyKind,
  type ProgressionState,
} from './bodiIslandLogic'

export const FOREST_HALF_WIDTH = 11
export const FOREST_START_Z = -4
export const FOREST_END_Z = 48

const SHADOW_START_Z = 23
const SHADOW_END_Z = 29
const SIGNAL_Z = 43
const BLAZE_X = -4.6
const BLAZE_Z = 0.5

export type EnemySpawn = {
  id: string
  kind: EnemyKind
  x: number
  z: number
}

export type EnemyState = {
  kind: EnemyKind
  health: number
}

export type EnemyHitResult = {
  enemy: EnemyState
  defeated: boolean
  drop: 'dark-fuzz' | null
}

export const FOREST_ENEMY_SPAWNS: EnemySpawn[] = [
  { id: 'bug-1', kind: 'shadow-bug', x: 0, z: 5.5 },
  { id: 'bug-2', kind: 'shadow-bug', x: -5.4, z: 13.5 },
  { id: 'bug-3', kind: 'shadow-bug', x: 5.8, z: 18.5 },
  { id: 'matter-1', kind: 'dark-matter', x: -4.6, z: 7.8 },
  { id: 'matter-2', kind: 'dark-matter', x: 4.4, z: 8.8 },
  { id: 'matter-3', kind: 'dark-matter', x: -1.8, z: 10.6 },
  { id: 'matter-4', kind: 'dark-matter', x: 6.2, z: 11.8 },
  { id: 'matter-5', kind: 'dark-matter', x: -6.6, z: 12.4 },
  { id: 'matter-6', kind: 'dark-matter', x: 1.4, z: 14.2 },
  { id: 'matter-7', kind: 'dark-matter', x: -4.1, z: 15.4 },
  { id: 'matter-8', kind: 'dark-matter', x: 5.1, z: 16.2 },
  { id: 'matter-9', kind: 'dark-matter', x: -0.8, z: 17.5 },
  { id: 'matter-10', kind: 'dark-matter', x: 3.1, z: 19.1 },
  { id: 'matter-11', kind: 'dark-matter', x: -6.1, z: 20.3 },
  { id: 'matter-12', kind: 'dark-matter', x: 6.4, z: 21.2 },
]

export function applyEnemyHit(enemy: EnemyState): EnemyHitResult {
  const nextHealth = Math.max(0, enemy.health - 1)
  const defeated = nextHealth === 0

  return {
    enemy: { ...enemy, health: nextHealth },
    defeated,
    drop: defeated && enemy.kind === 'dark-matter' ? 'dark-fuzz' : null,
  }
}

type InputState = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

export type BodiIslandSceneCallbacks = {
  onDarkFuzzChange?: (darkFuzz: number) => void
  onShadowBootsChange?: (hasShadowBoots: boolean) => void
  onHealthChange?: (health: number) => void
  onMessage?: (message: string) => void
  onComplete?: () => void
}

export type BodiIslandSceneController = {
  setInput: (next: Partial<InputState>) => void
  attack: () => void
  dodge: () => void
  interact: () => void
  resize: () => void
  dispose: () => void
}

type RuntimeEnemy = EnemySpawn & {
  health: number
  active: boolean
  hitFlash: number
  phase: number
}

type Particle = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
}

type Color = readonly [number, number, number, number]

const COLORS = {
  sky: [0.48, 0.78, 0.78, 1] as Color,
  grass: [0.29, 0.58, 0.28, 1] as Color,
  grassDark: [0.18, 0.43, 0.19, 1] as Color,
  path: [0.59, 0.45, 0.28, 1] as Color,
  trunk: [0.32, 0.2, 0.1, 1] as Color,
  leaves: [0.12, 0.43, 0.2, 1] as Color,
  leavesLight: [0.2, 0.56, 0.25, 1] as Color,
  shadow: [0.08, 0.04, 0.13, 1] as Color,
  shadowPulse: [0.2, 0.08, 0.31, 1] as Color,
  skin: [0.72, 0.48, 0.29, 1] as Color,
  hair: [0.95, 0.78, 0.23, 1] as Color,
  shirt: [0.08, 0.33, 0.8, 1] as Color,
  pants: [0.45, 0.33, 0.2, 1] as Color,
  shoes: [0.25, 0.14, 0.07, 1] as Color,
  steel: [0.72, 0.78, 0.82, 1] as Color,
  captainBody: [0.18, 0.2, 0.19, 1] as Color,
  captainScreen: [0.06, 0.24, 0.12, 1] as Color,
  captainSignal: [0.2, 1, 0.32, 1] as Color,
  blazeShirt: [0.68, 0.2, 0.07, 1] as Color,
  blazeApron: [0.23, 0.17, 0.12, 1] as Color,
  darkMatter: [0.025, 0.02, 0.03, 1] as Color,
  darkMatterHit: [0.22, 0.11, 0.26, 1] as Color,
  eye: [0.96, 0.96, 0.91, 1] as Color,
  pupil: [0.03, 0.03, 0.03, 1] as Color,
  bug: [0.12, 0.04, 0.18, 1] as Color,
  bugHit: [0.48, 0.1, 0.55, 1] as Color,
  signal: [0.18, 1, 0.36, 1] as Color,
  mountain: [0.31, 0.35, 0.34, 1] as Color,
} as const

const TREE_LAYOUT = [
  [-9, 2], [-7.5, 5], [8.7, 4], [6.8, 7], [-9.5, 9], [9.2, 10],
  [-7.8, 13], [8.4, 14], [-9, 17], [9.4, 18], [-7.5, 21], [7.8, 21.5],
  [-9.2, 31], [9, 31.5], [-7.8, 34], [8.1, 35], [-9.4, 38], [9.3, 39],
  [-7.6, 42], [7.6, 43], [-9.1, 46], [9.2, 46.5],
  [-4.8, 4], [4.9, 3], [-3.7, 12], [3.8, 13], [-5, 18], [5.2, 20],
  [-4.5, 34], [4.2, 36], [-5.5, 40], [5.1, 41],
] as const

const CUBE_VERTICES = new Float32Array([
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
   0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
  -0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5,
  -0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
])

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create WebGL shader.')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader error.'
    gl.deleteShader(shader)
    throw new Error(message)
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec3 aPosition;
    uniform mat4 uMvp;
    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }
  `)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `)

  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create WebGL program.')

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program error.'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

function perspective(out: Float32Array, fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2)
  const nf = 1 / (near - far)
  out.fill(0)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
}

function lookAt(
  out: Float32Array,
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
) {
  let zx = eyeX - targetX
  let zy = eyeY - targetY
  let zz = eyeZ - targetZ
  let len = Math.hypot(zx, zy, zz) || 1
  zx /= len
  zy /= len
  zz /= len

  let xx = zz
  let xy = 0
  let xz = -zx
  len = Math.hypot(xx, xz) || 1
  xx /= len
  xz /= len

  const yx = xy * zz - xz * zy
  const yy = xz * zx - xx * zz
  const yz = xx * zy - xy * zx

  out[0] = xx
  out[1] = yx
  out[2] = zx
  out[3] = 0
  out[4] = xy
  out[5] = yy
  out[6] = zy
  out[7] = 0
  out[8] = xz
  out[9] = yz
  out[10] = zz
  out[11] = 0
  out[12] = -(xx * eyeX + xy * eyeY + xz * eyeZ)
  out[13] = -(yx * eyeX + yy * eyeY + yz * eyeZ)
  out[14] = -(zx * eyeX + zy * eyeY + zz * eyeZ)
  out[15] = 1
}

function multiply(out: Float32Array, a: Float32Array, b: Float32Array) {
  for (let column = 0; column < 4; column += 1) {
    const b0 = b[column * 4]
    const b1 = b[column * 4 + 1]
    const b2 = b[column * 4 + 2]
    const b3 = b[column * 4 + 3]
    out[column * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3
    out[column * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3
    out[column * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3
    out[column * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3
  }
}

function modelMatrix(
  out: Float32Array,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  out[0] = c * sx
  out[1] = 0
  out[2] = -s * sx
  out[3] = 0
  out[4] = 0
  out[5] = sy
  out[6] = 0
  out[7] = 0
  out[8] = s * sz
  out[9] = 0
  out[10] = c * sz
  out[11] = 0
  out[12] = x
  out[13] = y
  out[14] = z
  out[15] = 1
}

function rotatedOffset(x: number, z: number, yaw: number) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return {
    x: x * c + z * s,
    z: -x * s + z * c,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function createBodiIslandScene(
  canvas: HTMLCanvasElement,
  callbacks: BodiIslandSceneCallbacks = {},
): BodiIslandSceneController {
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: 'high-performance',
  })

  if (!gl) {
    throw new Error('Bodi Island needs WebGL to run in this browser.')
  }

  const program = createProgram(gl)
  const positionLocation = gl.getAttribLocation(program, 'aPosition')
  const mvpLocation = gl.getUniformLocation(program, 'uMvp')
  const colorLocation = gl.getUniformLocation(program, 'uColor')
  const buffer = gl.createBuffer()

  if (!buffer || !mvpLocation || !colorLocation || positionLocation < 0) {
    gl.deleteProgram(program)
    throw new Error('Unable to initialize Bodi Island graphics.')
  }

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTICES, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)
  gl.clearColor(...COLORS.sky)

  const projection = new Float32Array(16)
  const view = new Float32Array(16)
  const projectionView = new Float32Array(16)
  const model = new Float32Array(16)
  const mvp = new Float32Array(16)

  const input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  }

  const player = {
    x: 0,
    z: 0,
    yaw: 0,
    health: 5,
  }
  const captain = {
    x: 1.15,
    z: -1.15,
    bob: 0,
  }
  const camera = {
    x: 0,
    y: 5.2,
    z: -9,
  }

  let progression: ProgressionState = {
    darkFuzz: 0,
    hasShadowBoots: false,
  }
  let attackTimer = 0
  let attackCooldown = 0
  let dodgeTimer = 0
  let dodgeCooldown = 0
  let hurtCooldown = 0
  let completed = false
  let disposed = false
  let frameHandle = 0
  let lastTime = performance.now()
  let audioContext: AudioContext | null = null

  const enemies: RuntimeEnemy[] = FOREST_ENEMY_SPAWNS.map((spawn, index) => ({
    ...spawn,
    health: spawn.kind === 'dark-matter' ? 2 : 1,
    active: true,
    hitFlash: 0,
    phase: index * 1.37,
  }))
  const particles: Particle[] = []

  const getAudioContext = () => {
    if (audioContext) return audioContext
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return null
    audioContext = new AudioContextClass()
    return audioContext
  }

  const playMatterNoise = (pitch = 180) => {
    try {
      const context = getAudioContext()
      if (!context) return
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(pitch, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(pitch * 1.7, context.currentTime + 0.08)
      gain.gain.setValueAtTime(0.035, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.11)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.12)
    } catch {
      // Audio is playful feedback only; gameplay must not depend on it.
    }
  }

  const drawBox = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    yaw = 0,
  ) => {
    modelMatrix(model, x, y, z, sx, sy, sz, yaw)
    multiply(mvp, projectionView, model)
    gl.uniformMatrix4fv(mvpLocation, false, mvp)
    gl.uniform4fv(colorLocation, color)
    gl.drawArrays(gl.TRIANGLES, 0, 36)
  }

  const drawPersonPart = (
    originX: number,
    originZ: number,
    yaw: number,
    localX: number,
    y: number,
    localZ: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    localYaw = 0,
  ) => {
    const offset = rotatedOffset(localX, localZ, yaw)
    drawBox(originX + offset.x, y, originZ + offset.z, sx, sy, sz, color, yaw + localYaw)
  }

  const drawBodi = () => {
    const walk = input.forward || input.backward || input.left || input.right
    const step = walk ? Math.sin(performance.now() * 0.012) * 0.12 : 0

    drawPersonPart(player.x, player.z, player.yaw, 0, 1.45, 0, 0.75, 0.85, 0.5, COLORS.shirt)
    drawPersonPart(player.x, player.z, player.yaw, 0, 2.18, 0, 0.72, 0.62, 0.62, COLORS.skin)
    drawPersonPart(player.x, player.z, player.yaw, 0, 2.52, -0.02, 0.78, 0.18, 0.67, COLORS.hair)
    drawPersonPart(player.x, player.z, player.yaw, -0.24, 0.72 + step, 0, 0.28, 0.9, 0.32, COLORS.pants)
    drawPersonPart(player.x, player.z, player.yaw, 0.24, 0.72 - step, 0, 0.28, 0.9, 0.32, COLORS.pants)
    drawPersonPart(player.x, player.z, player.yaw, -0.24, 0.2 + step, 0.1, 0.34, 0.2, 0.56, COLORS.shoes)
    drawPersonPart(player.x, player.z, player.yaw, 0.24, 0.2 - step, 0.1, 0.34, 0.2, 0.56, COLORS.shoes)

    const swing = attackTimer > 0 ? 0.8 : 0
    drawPersonPart(player.x, player.z, player.yaw, 0.62, 1.46, 0.18 + swing, 0.13, 1.45, 0.13, COLORS.steel, swing)
    drawPersonPart(player.x, player.z, player.yaw, 0.62, 0.78, 0.18 + swing, 0.34, 0.12, 0.16, COLORS.shoes, swing)
  }

  const drawCaptain = (time: number) => {
    const bob = Math.sin(time * 0.004) * 0.06
    const signalPulse = 0.65 + Math.sin(time * 0.006) * 0.25
    drawBox(captain.x, 0.55 + bob, captain.z, 0.92, 0.55, 1.25, COLORS.captainBody)
    drawBox(captain.x, 1.2 + bob, captain.z + 0.25, 0.95, 0.78, 0.72, COLORS.captainBody)
    drawBox(captain.x, 1.2 + bob, captain.z - 0.13, 0.72, 0.54, 0.03, COLORS.captainScreen)
    drawBox(
      captain.x,
      1.2 + bob,
      captain.z - 0.155,
      0.22 + signalPulse * 0.08,
      0.22 + signalPulse * 0.08,
      0.02,
      COLORS.captainSignal,
    )
    drawBox(captain.x - 0.28, 0.17 + bob, captain.z - 0.28, 0.16, 0.35, 0.18, COLORS.captainBody)
    drawBox(captain.x + 0.28, 0.17 + bob, captain.z - 0.28, 0.16, 0.35, 0.18, COLORS.captainBody)
    drawBox(captain.x - 0.28, 0.17 + bob, captain.z + 0.3, 0.16, 0.35, 0.18, COLORS.captainBody)
    drawBox(captain.x + 0.28, 0.17 + bob, captain.z + 0.3, 0.16, 0.35, 0.18, COLORS.captainBody)
  }

  const drawBlaze = () => {
    drawBox(BLAZE_X, 1.45, BLAZE_Z, 0.9, 1, 0.55, COLORS.blazeShirt)
    drawBox(BLAZE_X, 2.22, BLAZE_Z, 0.78, 0.62, 0.66, COLORS.skin)
    drawBox(BLAZE_X, 1.25, BLAZE_Z - 0.31, 0.66, 0.65, 0.08, COLORS.blazeApron)
    drawBox(BLAZE_X - 1.2, 0.42, BLAZE_Z, 0.95, 0.35, 0.62, COLORS.steel)
    drawBox(BLAZE_X - 1.2, 0.2, BLAZE_Z, 0.22, 0.45, 0.22, COLORS.blazeApron)
  }

  const drawTree = (x: number, z: number, index: number) => {
    const height = 2.3 + (index % 4) * 0.28
    const tint = index % 2 === 0 ? COLORS.leaves : COLORS.leavesLight
    drawBox(x, height * 0.5, z, 0.5, height, 0.5, COLORS.trunk)
    drawBox(x, height + 0.65, z, 2.15, 1.35, 2.15, tint, index * 0.22)
    drawBox(x + 0.28, height + 1.45, z - 0.18, 1.45, 1.1, 1.45, tint, index * 0.31)
  }

  const drawDarkMatter = (enemy: RuntimeEnemy, time: number) => {
    const bob = 0.62 + Math.sin(time * 0.006 + enemy.phase) * 0.08
    const color = enemy.hitFlash > 0 ? COLORS.darkMatterHit : COLORS.darkMatter
    const wobble = Math.sin(time * 0.004 + enemy.phase) * 0.09
    drawBox(enemy.x, bob, enemy.z, 1.05, 0.9, 1.05, color, wobble)
    drawBox(enemy.x - 0.3, bob + 0.18, enemy.z - 0.52, 0.24, 0.27, 0.08, COLORS.eye)
    drawBox(enemy.x + 0.3, bob + 0.18, enemy.z - 0.52, 0.24, 0.27, 0.08, COLORS.eye)
    drawBox(enemy.x - 0.3, bob + 0.18, enemy.z - 0.57, 0.08, 0.11, 0.03, COLORS.pupil)
    drawBox(enemy.x + 0.3, bob + 0.18, enemy.z - 0.57, 0.08, 0.11, 0.03, COLORS.pupil)
    for (let leg = 0; leg < 3; leg += 1) {
      const angle = enemy.phase + (leg / 3) * Math.PI * 2
      drawBox(
        enemy.x + Math.cos(angle) * 0.36,
        0.2,
        enemy.z + Math.sin(angle) * 0.36,
        0.17,
        0.55,
        0.17,
        color,
        angle,
      )
    }
  }

  const drawShadowBug = (enemy: RuntimeEnemy, time: number) => {
    const bob = 0.28 + Math.sin(time * 0.01 + enemy.phase) * 0.03
    const color = enemy.hitFlash > 0 ? COLORS.bugHit : COLORS.bug
    drawBox(enemy.x, bob, enemy.z, 0.9, 0.38, 1.25, color, enemy.phase)
    drawBox(enemy.x, bob + 0.2, enemy.z - 0.54, 0.6, 0.32, 0.45, color, enemy.phase)
    for (let leg = 0; leg < 3; leg += 1) {
      const offset = (leg - 1) * 0.34
      drawBox(enemy.x - 0.58, 0.15, enemy.z + offset, 0.72, 0.1, 0.1, color, -0.45)
      drawBox(enemy.x + 0.58, 0.15, enemy.z + offset, 0.72, 0.1, 0.1, color, 0.45)
    }
  }

  const drawWorld = (time: number) => {
    drawBox(0, -0.28, 22, 24, 0.55, 56, COLORS.grass)
    drawBox(0, 0.02, 11, 4.4, 0.08, 27, COLORS.path)
    drawBox(0, 0.05, (SHADOW_START_Z + SHADOW_END_Z) / 2, 22.2, 0.12, SHADOW_END_Z - SHADOW_START_Z, COLORS.shadow)

    const pulse = 0.5 + Math.sin(time * 0.004) * 0.5
    drawBox(0, 0.13, (SHADOW_START_Z + SHADOW_END_Z) / 2, 16 + pulse, 0.04, 1.1, COLORS.shadowPulse)

    TREE_LAYOUT.forEach(([x, z], index) => drawTree(x, z, index))

    drawBox(-6.2, 2.2, 52, 8.2, 4.6, 5.8, COLORS.mountain, 0.18)
    drawBox(3.6, 3.6, 54, 11, 7.5, 6.5, COLORS.mountain, -0.1)
    drawBox(8.2, 2.5, 51, 5.2, 5.2, 4.8, COLORS.mountain, -0.3)

    const signalPulse = 0.85 + Math.sin(time * 0.007) * 0.22
    drawBox(0, 1.1, SIGNAL_Z, 0.45 * signalPulse, 2.2, 0.45 * signalPulse, COLORS.signal)
    drawBox(0, 2.45, SIGNAL_Z, 1.15 * signalPulse, 0.18, 1.15 * signalPulse, COLORS.signal, time * 0.001)
  }

  const burstDarkFuzz = (x: number, z: number) => {
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2
      particles.push({
        x,
        y: 0.65,
        z,
        vx: Math.cos(angle) * (1.1 + (index % 3) * 0.25),
        vy: 1.2 + (index % 4) * 0.18,
        vz: Math.sin(angle) * (1.1 + (index % 2) * 0.3),
        life: 0.7,
      })
    }
  }

  const resetAfterKnockout = () => {
    player.x = 0
    player.z = 0
    player.health = 5
    callbacks.onHealthChange?.(player.health)
    callbacks.onMessage?.('Captain got Bodi safely back to the forest entrance.')
  }

  const updateEnemies = (dt: number, time: number) => {
    for (const enemy of enemies) {
      if (!enemy.active) continue
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt)

      const dx = player.x - enemy.x
      const dz = player.z - enemy.z
      const distance = Math.hypot(dx, dz)
      const wakeDistance = enemy.kind === 'dark-matter' ? 6.4 : 7.4
      const moveSpeed = enemy.kind === 'dark-matter' ? 1.05 : 1.45

      if (distance < wakeDistance && distance > 1.1) {
        enemy.x += (dx / distance) * moveSpeed * dt
        enemy.z += (dz / distance) * moveSpeed * dt
      }

      if (distance < 1.12 && hurtCooldown <= 0 && dodgeTimer <= 0) {
        player.health = Math.max(0, player.health - 1)
        hurtCooldown = 0.85
        callbacks.onHealthChange?.(player.health)
        callbacks.onMessage?.(enemy.kind === 'dark-matter' ? 'BWOOP! A Dark Matter bonked Bodi.' : 'A Shadow Bug got too close!')
        if (enemy.kind === 'dark-matter') playMatterNoise(135 + (time % 90))
        if (player.health === 0) resetAfterKnockout()
      }
    }
  }

  const updateParticles = (dt: number) => {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index]
      particle.life -= dt
      if (particle.life <= 0) {
        particles.splice(index, 1)
        continue
      }
      particle.vy -= 3.2 * dt
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.z += particle.vz * dt
    }
  }

  const updateMovement = (dt: number) => {
    let dx = Number(input.right) - Number(input.left)
    let dz = Number(input.forward) - Number(input.backward)
    const length = Math.hypot(dx, dz)

    if (length > 0) {
      dx /= length
      dz /= length
      player.yaw = Math.atan2(dx, dz)
    }

    let speed = movementSpeed(progression.hasShadowBoots)
    if (dodgeTimer > 0) speed *= 2.45

    const nextX = clamp(player.x + dx * speed * dt, -FOREST_HALF_WIDTH + 0.8, FOREST_HALF_WIDTH - 0.8)
    let nextZ = clamp(player.z + dz * speed * dt, FOREST_START_Z, FOREST_END_Z)

    if (!progression.hasShadowBoots && player.z < SHADOW_START_Z && nextZ >= SHADOW_START_Z) {
      nextZ = SHADOW_START_Z - 0.35
      callbacks.onMessage?.('Captain flashes a warning: the shadow ground is not safe yet.')
    }
    if (!progression.hasShadowBoots && player.z > SHADOW_END_Z && nextZ <= SHADOW_END_Z) {
      nextZ = SHADOW_END_Z + 0.35
    }

    player.x = nextX
    player.z = nextZ

    const captainTargetX = player.x + 1.25
    const captainTargetZ = player.z - 1.25
    const follow = 1 - Math.exp(-dt * 5.2)
    captain.x += (captainTargetX - captain.x) * follow
    captain.z += (captainTargetZ - captain.z) * follow
    captain.bob += dt

    const cameraTargetX = player.x * 0.68
    const cameraTargetZ = player.z - 8.8
    const cameraFollow = 1 - Math.exp(-dt * 4.5)
    camera.x += (cameraTargetX - camera.x) * cameraFollow
    camera.z += (cameraTargetZ - camera.z) * cameraFollow
  }

  const render = (time: number) => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    lookAt(view, camera.x, camera.y, camera.z, player.x * 0.55, 1.1, player.z + 3.1)
    multiply(projectionView, projection, view)

    drawWorld(time)
    drawBlaze()
    drawBodi()
    drawCaptain(time)

    for (const enemy of enemies) {
      if (!enemy.active) continue
      if (enemy.kind === 'dark-matter') drawDarkMatter(enemy, time)
      else drawShadowBug(enemy, time)
    }

    for (const particle of particles) {
      drawBox(particle.x, Math.max(0.05, particle.y), particle.z, 0.16, 0.16, 0.16, COLORS.darkMatter)
    }
  }

  const frame = (time: number) => {
    if (disposed) return
    const dt = Math.min(0.033, Math.max(0, (time - lastTime) / 1000))
    lastTime = time

    attackTimer = Math.max(0, attackTimer - dt)
    attackCooldown = Math.max(0, attackCooldown - dt)
    dodgeTimer = Math.max(0, dodgeTimer - dt)
    dodgeCooldown = Math.max(0, dodgeCooldown - dt)
    hurtCooldown = Math.max(0, hurtCooldown - dt)

    updateMovement(dt)
    updateEnemies(dt, time)
    updateParticles(dt)
    render(time)
    frameHandle = requestAnimationFrame(frame)
  }

  const attack = () => {
    if (attackCooldown > 0 || completed) return
    attackCooldown = 0.34
    attackTimer = 0.23

    const forwardX = Math.sin(player.yaw)
    const forwardZ = Math.cos(player.yaw)
    let target: RuntimeEnemy | null = null
    let targetDistance = Number.POSITIVE_INFINITY

    for (const enemy of enemies) {
      if (!enemy.active) continue
      const dx = enemy.x - player.x
      const dz = enemy.z - player.z
      const distance = Math.hypot(dx, dz)
      if (distance > 2.35 || distance >= targetDistance) continue
      const facing = (dx * forwardX + dz * forwardZ) / (distance || 1)
      if (facing < -0.05) continue
      target = enemy
      targetDistance = distance
    }

    if (!target) return

    const result = applyEnemyHit({ kind: target.kind, health: target.health })
    target.health = result.enemy.health
    target.hitFlash = 0.12

    if (target.kind === 'dark-matter') playMatterNoise(210)
    if (!result.defeated) return

    target.active = false
    if (target.kind === 'dark-matter') {
      burstDarkFuzz(target.x, target.z)
    }

    if (result.drop === 'dark-fuzz') {
      const next = collectDarkFuzz(progression.darkFuzz, target.kind)
      progression = { ...progression, darkFuzz: next }
      callbacks.onDarkFuzzChange?.(next)
      callbacks.onMessage?.(next >= 10 ? 'Ten Dark Fuzz! Return to Blaze.' : `Dark Fuzz collected: ${next}/10`)
    } else {
      callbacks.onMessage?.('Shadow Bug defeated. Captain looks very proud.')
    }
  }

  const dodge = () => {
    if (dodgeCooldown > 0 || completed) return
    dodgeCooldown = 0.9
    dodgeTimer = 0.24
  }

  const interact = () => {
    if (completed) return

    const blazeDistance = Math.hypot(player.x - BLAZE_X, player.z - BLAZE_Z)
    if (blazeDistance < 3) {
      if (canCraftShadowBoots(progression)) {
        progression = craftShadowBoots(progression)
        callbacks.onDarkFuzzChange?.(progression.darkFuzz)
        callbacks.onShadowBootsChange?.(true)
        callbacks.onMessage?.('Blaze made the Shadow Boots! Bodi can cross shadow ground now.')
      } else if (progression.hasShadowBoots) {
        callbacks.onMessage?.('Blaze: Those Shadow Boots should get you across the dark ground.')
      } else {
        callbacks.onMessage?.(`Blaze needs 10 Dark Fuzz. Bodi has ${progression.darkFuzz}.`)
      }
      return
    }

    const signalDistance = Math.hypot(player.x, player.z - SIGNAL_Z)
    if (signalDistance < 2.5 && progression.hasShadowBoots) {
      completed = true
      callbacks.onComplete?.()
      callbacks.onMessage?.('Captain found the signal! Something deeper in Bodi Island is waking up...')
      return
    }

    callbacks.onMessage?.('Captain chirps. There is nothing to use here yet.')
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 960))
    const height = Math.max(240, Math.floor(rect.height || canvas.clientHeight || 540))
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const pixelWidth = Math.floor(width * dpr)
    const pixelHeight = Math.floor(height * dpr)

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    perspective(projection, Math.PI / 3.15, canvas.width / canvas.height, 0.1, 120)
  }

  resize()
  callbacks.onHealthChange?.(player.health)
  callbacks.onDarkFuzzChange?.(progression.darkFuzz)
  callbacks.onShadowBootsChange?.(progression.hasShadowBoots)
  frameHandle = requestAnimationFrame(frame)

  return {
    setInput(next) {
      Object.assign(input, next)
    },
    attack,
    dodge,
    interact,
    resize,
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frameHandle)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      if (audioContext) {
        void audioContext.close()
        audioContext = null
      }
    },
  }
}
