import type { SemanticInputReader } from '../shared/input/semanticInput'
import {
  blendQuality,
  camouflageVisibilityMultiplier,
  nextGamePhase,
  rgbMatchScore,
  updateTeacherState,
  type BlendQuality,
  type GamePhase,
  type RGBColor,
  type TeacherStateSnapshot,
} from './schoolEscapeLogic'
import {
  DOOR_MARKERS,
  EXTERIOR_BOUNDS,
  HOUSE_TRIGGER,
  PATROL_NODES,
  SCHOOL_EXIT,
  SCHOOL_START,
  WALLS,
  hasLineOfSight,
  isInsideTrigger,
  nearestCamouflageWall,
  resolveCircleAgainstWalls,
  type Point2,
} from './schoolEscapeLevel'
import type { SchoolEscapeAction } from './schoolEscapeInput'

export const PLAYER_WALK_SPEED = 2.8
export const PLAYER_SPRINT_SPEED = 4.8
export const TEACHER_PATROL_SPEED = 2
export const TEACHER_CHASE_SPEED = 4.2
export const TEACHER_FINAL_SPEED = 4.4
export const CATCH_RADIUS = 0.72

const PLAYER_RADIUS = 0.42
const TEACHER_RADIUS = 0.46
const GRAVITY = -13
const JUMP_VELOCITY = 5.2
const MAX_FRAME_DELTA = 0.05
const SCHOOL_SIGHT_RANGE = 14
const CHASE_SIGHT_RANGE = 18
const FIELD_OF_VIEW = (100 * Math.PI) / 180
const DEFAULT_CAMOUFLAGE = { r: 30, g: 30, b: 34 } as const

type CharacterState = {
  x: number
  y: number
  z: number
  yaw: number
}

type PlayerState = CharacterState & {
  velocityY: number
  grounded: boolean
  horizontalSpeed: number
}

type TeacherRuntimeState = CharacterState & {
  mode: TeacherStateSnapshot
  patrolIndex: number
  lastSeen: Point2
}

export type SchoolEscapeSceneState = {
  phase: GamePhase
  player: PlayerState
  teacher: TeacherRuntimeState
  camouflage: RGBColor
  cameraYaw: number
  cameraPitch: number
}

export type SchoolEscapeSceneCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onBlendChange?: (quality: BlendQuality, score: number, wallColor: RGBColor | null) => void
  onTeacherStateChange?: (state: TeacherStateSnapshot['state']) => void
  onSubtitle?: (subtitle: string) => void
  onWebGLUnavailable?: () => void
}

export type SchoolEscapeSceneController = {
  setCameraDrag(deltaX: number, deltaY: number): void
  setCamouflageColor(color: RGBColor): void
  resize(): void
  restart(): void
  dispose(): void
}

type Color4 = readonly [number, number, number, number]

type Renderer = {
  gl: WebGLRenderingContext
  program: WebGLProgram
  buffer: WebGLBuffer
  positionLocation: number
  mvpLocation: WebGLUniformLocation
  colorLocation: WebGLUniformLocation
  fogLocation: WebGLUniformLocation
  projection: Float32Array
  view: Float32Array
  model: Float32Array
  temp: Float32Array
  mvp: Float32Array
}

const CUBE_VERTICES = new Float32Array([
  -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5,
  -0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
  0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5,0.5,-0.5,
  0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5,
  -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5,
  -0.5,-0.5,-0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5,
  0.5,-0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5,
  0.5,-0.5,0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5,
  -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5,
  -0.5,0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
  -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5,
  -0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
])

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeColor(color: RGBColor): RGBColor {
  return {
    r: clamp(Math.round(Number.isFinite(color.r) ? color.r : 0), 0, 255),
    g: clamp(Math.round(Number.isFinite(color.g) ? color.g : 0), 0, 255),
    b: clamp(Math.round(Number.isFinite(color.b) ? color.b : 0), 0, 255),
  }
}

function rgbToColor4(color: RGBColor, alpha = 1): Color4 {
  return [color.r / 255, color.g / 255, color.b / 255, alpha]
}

export function createInitialSceneState(): SchoolEscapeSceneState {
  return {
    phase: 'school',
    player: {
      x: SCHOOL_START.x,
      y: 0,
      z: SCHOOL_START.z,
      yaw: 0,
      velocityY: 0,
      grounded: true,
      horizontalSpeed: 0,
    },
    teacher: {
      x: PATROL_NODES[0]!.x,
      y: 0,
      z: PATROL_NODES[0]!.z,
      yaw: Math.PI,
      mode: {
        state: 'patrol',
        suspicion: 0,
        lostSightFor: 0,
        searchElapsed: 0,
      },
      patrolIndex: 1,
      lastSeen: { x: SCHOOL_START.x, z: SCHOOL_START.z },
    },
    camouflage: DEFAULT_CAMOUFLAGE,
    cameraYaw: 0,
    cameraPitch: 0.18,
  }
}

export function resolveScenePhase(
  phase: GamePhase,
  player: Point2,
  teacher: Point2,
): GamePhase {
  if (phase === 'failed' || phase === 'won') return phase

  if (Math.hypot(player.x - teacher.x, player.z - teacher.z) <= CATCH_RADIUS) {
    return nextGamePhase(phase, 'caught')
  }

  if (phase === 'school' && isInsideTrigger(player, SCHOOL_EXIT)) {
    return nextGamePhase(phase, 'exit')
  }

  if (phase === 'final-chase' && isInsideTrigger(player, HOUSE_TRIGGER)) {
    return nextGamePhase(phase, 'house')
  }

  return phase
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create School Escape shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown School Escape shader error.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec3 aPosition;
    uniform mat4 uMvp;
    varying float vFog;
    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      vFog = clamp((gl_Position.w - 8.0) / 28.0, 0.0, 0.72);
    }
  `)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec4 uColor;
    uniform vec4 uFogColor;
    varying float vFog;
    void main() {
      gl_FragColor = mix(uColor, uFogColor, vFog);
    }
  `)
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create School Escape WebGL program.')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown School Escape link error.'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: true,
    powerPreference: 'default',
  })
  if (!gl) return null

  const program = createProgram(gl)
  const buffer = gl.createBuffer()
  if (!buffer) {
    gl.deleteProgram(program)
    throw new Error('Unable to create School Escape geometry buffer.')
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTICES, gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, 'aPosition')
  const mvpLocation = gl.getUniformLocation(program, 'uMvp')
  const colorLocation = gl.getUniformLocation(program, 'uColor')
  const fogLocation = gl.getUniformLocation(program, 'uFogColor')
  if (!mvpLocation || !colorLocation || !fogLocation || positionLocation < 0) {
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    throw new Error('School Escape WebGL uniforms are unavailable.')
  }

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)

  return {
    gl,
    program,
    buffer,
    positionLocation,
    mvpLocation,
    colorLocation,
    fogLocation,
    projection: new Float32Array(16),
    view: new Float32Array(16),
    model: new Float32Array(16),
    temp: new Float32Array(16),
    mvp: new Float32Array(16),
  }
}

function perspective(
  out: Float32Array,
  fov: number,
  aspect: number,
  near: number,
  far: number,
) {
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
  let length = Math.hypot(zx, zy, zz) || 1
  zx /= length
  zy /= length
  zz /= length

  let xx = zz
  const xy = 0
  let xz = -zx
  length = Math.hypot(xx, xz) || 1
  xx /= length
  xz /= length

  const yx = zy * xz
  const yy = zz * xx - zx * xz
  const yz = -zy * xx

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
  const cosine = Math.cos(yaw)
  const sine = Math.sin(yaw)
  out[0] = cosine * sx
  out[1] = 0
  out[2] = -sine * sx
  out[3] = 0
  out[4] = 0
  out[5] = sy
  out[6] = 0
  out[7] = 0
  out[8] = sine * sz
  out[9] = 0
  out[10] = cosine * sz
  out[11] = 0
  out[12] = x
  out[13] = y
  out[14] = z
  out[15] = 1
}

function drawCube(
  renderer: Renderer,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: Color4,
  yaw = 0,
) {
  const { gl } = renderer
  modelMatrix(renderer.model, x, y, z, sx, sy, sz, yaw)
  multiply(renderer.temp, renderer.view, renderer.model)
  multiply(renderer.mvp, renderer.projection, renderer.temp)
  gl.uniformMatrix4fv(renderer.mvpLocation, false, renderer.mvp)
  gl.uniform4fv(renderer.colorLocation, color)
  gl.drawArrays(gl.TRIANGLES, 0, 36)
}

function angleDifference(a: number, b: number) {
  let difference = a - b
  while (difference > Math.PI) difference -= Math.PI * 2
  while (difference < -Math.PI) difference += Math.PI * 2
  return difference
}

function moveToward(
  character: CharacterState,
  target: Point2,
  speed: number,
  dt: number,
  collide: boolean,
) {
  const dx = target.x - character.x
  const dz = target.z - character.z
  const distance = Math.hypot(dx, dz)
  if (distance < 0.001) return distance

  const step = Math.min(distance, speed * dt)
  const next = {
    x: character.x + (dx / distance) * step,
    z: character.z + (dz / distance) * step,
  }
  const resolved = collide
    ? resolveCircleAgainstWalls(next, character === character ? TEACHER_RADIUS : TEACHER_RADIUS)
    : next
  character.x = resolved.x
  character.z = resolved.z
  character.yaw = Math.atan2(dx, dz)
  return distance
}

function nearestVisibleNavTarget(from: Point2, player: Point2) {
  let best = PATROL_NODES[0]!
  let bestScore = Number.POSITIVE_INFINITY
  for (const node of PATROL_NODES) {
    if (!hasLineOfSight(from, node)) continue
    const score = Math.hypot(node.x - player.x, node.z - player.z)
    if (score < bestScore) {
      best = node
      bestScore = score
    }
  }
  return best
}

function updatePlayer(
  state: SchoolEscapeSceneState,
  input: SemanticInputReader<SchoolEscapeAction>,
  dt: number,
) {
  const move = input.move
  const forwardAmount = -move.y
  const rightAmount = move.x
  const forwardX = Math.sin(state.cameraYaw)
  const forwardZ = Math.cos(state.cameraYaw)
  const rightX = Math.cos(state.cameraYaw)
  const rightZ = -Math.sin(state.cameraYaw)
  let dx = forwardX * forwardAmount + rightX * rightAmount
  let dz = forwardZ * forwardAmount + rightZ * rightAmount
  const magnitude = Math.hypot(dx, dz)
  if (magnitude > 1) {
    dx /= magnitude
    dz /= magnitude
  }

  const moving = magnitude > 0.02
  const speed = input.isHeld('sprint') ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED
  state.player.horizontalSpeed = moving ? speed * Math.min(1, magnitude) : 0

  if (moving) {
    state.player.yaw = Math.atan2(dx, dz)
    const next = {
      x: state.player.x + dx * speed * dt,
      z: state.player.z + dz * speed * dt,
    }
    if (state.phase === 'school') {
      const resolved = resolveCircleAgainstWalls(next, PLAYER_RADIUS)
      state.player.x = resolved.x
      state.player.z = resolved.z
    } else if (state.phase === 'final-chase') {
      state.player.x = clamp(next.x, EXTERIOR_BOUNDS.minX, EXTERIOR_BOUNDS.maxX)
      state.player.z = clamp(next.z, EXTERIOR_BOUNDS.minZ, EXTERIOR_BOUNDS.maxZ)
    }
  }

  if (input.consumePress('jump') && state.player.grounded) {
    state.player.velocityY = JUMP_VELOCITY
    state.player.grounded = false
  }

  if (!state.player.grounded) {
    state.player.velocityY += GRAVITY * dt
    state.player.y += state.player.velocityY * dt
    if (state.player.y <= 0) {
      state.player.y = 0
      state.player.velocityY = 0
      state.player.grounded = true
    }
  }
}

function teacherVisibility(state: SchoolEscapeSceneState) {
  const teacher = state.teacher
  const player = state.player
  const dx = player.x - teacher.x
  const dz = player.z - teacher.z
  const distance = Math.hypot(dx, dz)
  const range = teacher.mode.state === 'chase' ? CHASE_SIGHT_RANGE : SCHOOL_SIGHT_RANGE
  if (distance > range) return { visibility: 0, lineOfSight: false }

  const targetYaw = Math.atan2(dx, dz)
  const inFov = teacher.mode.state === 'chase'
    ? Math.abs(angleDifference(targetYaw, teacher.yaw)) <= Math.PI * 0.72
    : Math.abs(angleDifference(targetYaw, teacher.yaw)) <= FIELD_OF_VIEW / 2
  if (!inFov) return { visibility: 0, lineOfSight: false }

  const lineOfSight = hasLineOfSight(teacher, player)
  if (!lineOfSight) return { visibility: 0, lineOfSight: false }

  const nearest = nearestCamouflageWall(player)
  const match = nearest ? rgbMatchScore(state.camouflage, nearest.wall.color) : 0
  const camouflage = nearest
    ? camouflageVisibilityMultiplier({
        match,
        wallDistance: nearest.distance,
        horizontalSpeed: player.horizontalSpeed,
        grounded: player.grounded,
      })
    : 1
  const distanceFactor = clamp(1 - distance / range, 0, 1)
  const movementFactor = player.horizontalSpeed > PLAYER_WALK_SPEED + 0.2
    ? 1.5
    : player.horizontalSpeed > 0.18
      ? 1.22
      : 1
  const visibility = clamp((0.26 + distanceFactor * 0.84) * movementFactor * camouflage, 0, 1)
  return { visibility, lineOfSight }
}

function updateTeacher(
  state: SchoolEscapeSceneState,
  dt: number,
  callbacks: SchoolEscapeSceneCallbacks,
) {
  if (state.phase === 'final-chase') {
    const before = state.teacher.mode.state
    state.teacher.mode = {
      state: 'chase',
      suspicion: 1,
      lostSightFor: 0,
      searchElapsed: 0,
    }
    moveToward(state.teacher, state.player, TEACHER_FINAL_SPEED, dt, false)
    if (before !== 'chase') callbacks.onTeacherStateChange?.('chase')
    return
  }

  if (state.phase !== 'school') return

  const perception = teacherVisibility(state)
  const previousMode = state.teacher.mode.state
  state.teacher.mode = updateTeacherState(state.teacher.mode, {
    visibility: perception.visibility,
    hasLineOfSight: perception.lineOfSight,
    dt,
  })

  if (perception.lineOfSight && perception.visibility > 0.08) {
    state.teacher.lastSeen = { x: state.player.x, z: state.player.z }
  }

  if (state.teacher.mode.state !== previousMode) {
    callbacks.onTeacherStateChange?.(state.teacher.mode.state)
  }
  if (state.teacher.mode.shout) callbacks.onSubtitle?.('COME BACK HERE!')

  if (state.teacher.mode.state === 'patrol') {
    const target = PATROL_NODES[state.teacher.patrolIndex]!
    const distance = moveToward(state.teacher, target, TEACHER_PATROL_SPEED, dt, true)
    if (distance < 0.55) {
      state.teacher.patrolIndex = (state.teacher.patrolIndex + 1) % PATROL_NODES.length
    }
    return
  }

  if (state.teacher.mode.state === 'suspicious') {
    const dx = state.teacher.lastSeen.x - state.teacher.x
    const dz = state.teacher.lastSeen.z - state.teacher.z
    state.teacher.yaw = Math.atan2(dx, dz)
    return
  }

  const desired = state.teacher.mode.state === 'search'
    ? state.teacher.lastSeen
    : state.player
  const direct = hasLineOfSight(state.teacher, desired)
  const target = direct ? desired : nearestVisibleNavTarget(state.teacher, desired)
  const speed = state.teacher.mode.state === 'chase'
    ? TEACHER_CHASE_SPEED
    : TEACHER_PATROL_SPEED * 0.8
  moveToward(state.teacher, target, speed, dt, true)
}

function updateBlend(
  state: SchoolEscapeSceneState,
  callbacks: SchoolEscapeSceneCallbacks,
) {
  if (state.phase !== 'school') return
  const nearest = nearestCamouflageWall(state.player)
  if (!nearest) {
    callbacks.onBlendChange?.('poor', 0, null)
    return
  }
  const score = rgbMatchScore(state.camouflage, nearest.wall.color)
  callbacks.onBlendChange?.(blendQuality(score), score, nearest.wall.color)
}

function enterFinalChase(state: SchoolEscapeSceneState) {
  state.phase = 'final-chase'
  state.player.x = 8
  state.player.z = 19.2
  state.player.y = 0
  state.player.velocityY = 0
  state.player.grounded = true
  state.player.yaw = 0
  state.teacher.x = 8
  state.teacher.z = 16.1
  state.teacher.y = 0
  state.teacher.yaw = 0
  state.teacher.mode = {
    state: 'chase',
    suspicion: 1,
    lostSightFor: 0,
    searchElapsed: 0,
  }
  state.cameraYaw = 0
  state.cameraPitch = 0.13
}

function applyPhaseTransitions(
  state: SchoolEscapeSceneState,
  callbacks: SchoolEscapeSceneCallbacks,
) {
  const resolved = resolveScenePhase(state.phase, state.player, state.teacher)
  if (resolved === state.phase) return

  if (resolved === 'final-chase') {
    enterFinalChase(state)
    callbacks.onPhaseChange?.('final-chase')
    callbacks.onSubtitle?.('RUN HOME!')
    return
  }

  state.phase = resolved
  callbacks.onPhaseChange?.(resolved)
  if (resolved === 'failed') callbacks.onSubtitle?.('Caught! The principal is furious.')
  if (resolved === 'won') callbacks.onSubtitle?.('YOU ESCAPED!')
}

function drawPlayer(renderer: Renderer, state: SchoolEscapeSceneState) {
  const player = state.player
  const clothing = rgbToColor4(state.camouflage)
  const skin: Color4 = [0.68, 0.45, 0.28, 1]
  const hair: Color4 = [0.92, 0.76, 0.28, 1]
  const eye: Color4 = [0.2, 0.48, 0.82, 1]
  const shoe: Color4 = [0.05, 0.05, 0.06, 1]
  const baseY = player.y

  drawCube(renderer, player.x, baseY + 1.05, player.z, 0.68, 0.82, 0.36, clothing, player.yaw)
  drawCube(renderer, player.x, baseY + 1.68, player.z, 0.52, 0.52, 0.48, skin, player.yaw)
  drawCube(renderer, player.x, baseY + 1.96, player.z - 0.02, 0.56, 0.14, 0.5, hair, player.yaw)
  drawCube(renderer, player.x - 0.17, baseY + 1.72, player.z + 0.23, 0.08, 0.08, 0.05, eye, player.yaw)
  drawCube(renderer, player.x + 0.17, baseY + 1.72, player.z + 0.23, 0.08, 0.08, 0.05, eye, player.yaw)
  drawCube(renderer, player.x - 0.2, baseY + 0.37, player.z, 0.23, 0.7, 0.28, clothing, player.yaw)
  drawCube(renderer, player.x + 0.2, baseY + 0.37, player.z, 0.23, 0.7, 0.28, clothing, player.yaw)
  drawCube(renderer, player.x - 0.2, baseY + 0.04, player.z + 0.08, 0.27, 0.14, 0.42, shoe, player.yaw)
  drawCube(renderer, player.x + 0.2, baseY + 0.04, player.z + 0.08, 0.27, 0.14, 0.42, shoe, player.yaw)

  const paint: readonly [number, number, Color4][] = [
    [-0.24, 1.18, [0.9, 0.24, 0.2, 1]],
    [0.22, 0.95, [0.2, 0.72, 0.95, 1]],
    [-0.12, 0.55, [0.96, 0.75, 0.18, 1]],
  ]
  for (const [offsetX, y, color] of paint) {
    drawCube(renderer, player.x + offsetX, baseY + y, player.z + 0.2, 0.09, 0.12, 0.04, color, player.yaw)
  }
}

function drawTeacher(renderer: Renderer, teacher: TeacherRuntimeState) {
  const shirt: Color4 = [0.72, 0.72, 0.68, 1]
  const pants: Color4 = [0.12, 0.15, 0.19, 1]
  const redFace: Color4 = [0.82, 0.12, 0.08, 1]
  const badge: Color4 = [0.9, 0.9, 0.82, 1]
  drawCube(renderer, teacher.x, 1.08, teacher.z, 0.76, 0.92, 0.4, shirt, teacher.yaw)
  drawCube(renderer, teacher.x, 1.75, teacher.z, 0.52, 0.5, 0.48, redFace, teacher.yaw)
  drawCube(renderer, teacher.x - 0.22, 0.38, teacher.z, 0.23, 0.75, 0.28, pants, teacher.yaw)
  drawCube(renderer, teacher.x + 0.22, 0.38, teacher.z, 0.23, 0.75, 0.28, pants, teacher.yaw)
  drawCube(renderer, teacher.x + 0.22, 1.18, teacher.z + 0.22, 0.2, 0.23, 0.04, badge, teacher.yaw)
}

function drawSchool(renderer: Renderer, timeSeconds: number) {
  const floor: Color4 = [0.33, 0.34, 0.32, 1]
  const ceiling: Color4 = [0.42, 0.43, 0.4, 1]
  const door: Color4 = [0.28, 0.19, 0.12, 1]
  const bulletin: Color4 = [0.36, 0.16, 0.12, 1]
  drawCube(renderer, 0, -0.13, 1, 24, 0.25, 34, floor)
  drawCube(renderer, 0, 3.45, 1, 24, 0.15, 34, ceiling)

  for (const wall of WALLS) {
    drawCube(
      renderer,
      wall.x,
      wall.height / 2,
      wall.z,
      wall.width,
      wall.height,
      wall.depth,
      rgbToColor4(wall.color),
    )
  }

  for (const marker of DOOR_MARKERS) {
    const motion = Math.sin(timeSeconds * 0.9 + marker.x) > 0.93 ? 0.22 : 0
    drawCube(renderer, marker.x, 1.45, marker.z, 1.15, 2.75, 0.12, door, marker.yaw + motion)
  }

  for (let index = 0; index < 8; index += 1) {
    drawCube(renderer, 4.1 + index * 0.9, 1.15, -4.65, 0.78, 2.15, 0.35, [0.24, 0.31, 0.37, 1])
  }

  drawCube(renderer, -11.65, 1.6, 4.4, 0.08, 1.7, 3.4, bulletin)
  drawCube(renderer, -11.65, 1.6, 11.6, 0.08, 1.7, 3.4, [0.12, 0.24, 0.34, 1])

  const flicker = Math.sin(timeSeconds * 5.7) > 0.96 ? 0.58 : 0.9
  const light: Color4 = [flicker, flicker, flicker * 0.88, 1]
  for (const z of [-12, -4, 4, 12]) {
    drawCube(renderer, -5, 3.28, z, 2.6, 0.08, 0.4, light)
    drawCube(renderer, 6.5, 3.28, z, 2.6, 0.08, 0.4, light)
  }
}

function drawExterior(renderer: Renderer) {
  drawCube(renderer, 8, -0.12, 31, 7, 0.22, 32, [0.42, 0.42, 0.4, 1])
  drawCube(renderer, 2.7, -0.18, 31, 3.2, 0.2, 32, [0.16, 0.3, 0.14, 1])
  drawCube(renderer, 13.3, -0.18, 31, 3.2, 0.2, 32, [0.16, 0.3, 0.14, 1])
  for (const z of [25, 33, 39]) {
    drawCube(renderer, 5.2, 0.45, z, 0.45, 0.9, 0.45, [0.24, 0.18, 0.12, 1])
  }
  drawCube(renderer, 8, 2.1, 46, 7.2, 4.2, 4.5, [0.46, 0.36, 0.28, 1])
  drawCube(renderer, 8, 4.55, 46, 8.2, 0.65, 5.2, [0.24, 0.12, 0.1, 1])
  drawCube(renderer, 8, 1.2, 43.72, 1.25, 2.4, 0.12, [0.18, 0.12, 0.08, 1])
}

function drawPrincipalOffice(renderer: Renderer, timeSeconds: number) {
  drawCube(renderer, 0, -0.12, 0, 14, 0.22, 10, [0.3, 0.28, 0.24, 1])
  drawCube(renderer, 0, 1.1, 1.6, 5.2, 2.2, 1.3, [0.28, 0.17, 0.09, 1])
  drawCube(renderer, 0, 1.1, 3.1, 0.82, 0.95, 0.42, [0.18, 0.2, 0.22, 1])
  drawCube(renderer, 0, 1.82, 3.1, 0.56, 0.52, 0.5, [0.88, 0.1, 0.07, 1])
  const angryArm = Math.sin(timeSeconds * 7) * 0.35
  drawCube(renderer, 0.65, 1.2 + angryArm, 2.8, 0.22, 0.9, 0.22, [0.78, 0.68, 0.56, 1], -0.5)
  const teacher: TeacherRuntimeState = {
    x: 3.2,
    y: 0,
    z: 2.5,
    yaw: Math.PI,
    mode: { state: 'patrol', suspicion: 0, lostSightFor: 0, searchElapsed: 0 },
    patrolIndex: 0,
    lastSeen: { x: 0, z: 0 },
  }
  drawTeacher(renderer, teacher)
  const seated = createInitialSceneState()
  seated.player.x = 0
  seated.player.z = -1.4
  seated.player.yaw = Math.PI
  drawPlayer(renderer, seated)
}

function setCamera(renderer: Renderer, state: SchoolEscapeSceneState) {
  if (state.phase === 'failed') {
    lookAt(renderer.view, 0, 3.6, -6.4, 0, 1.3, 1.5)
    return
  }

  const player = state.player
  const distance = 5.5
  const horizontalDistance = Math.cos(state.cameraPitch) * distance
  const eyeX = player.x - Math.sin(state.cameraYaw) * horizontalDistance
  const eyeZ = player.z - Math.cos(state.cameraYaw) * horizontalDistance
  const eyeY = player.y + 2.2 + Math.sin(state.cameraPitch) * distance
  lookAt(renderer.view, eyeX, eyeY, eyeZ, player.x, player.y + 1.15, player.z)
}

function resizeRenderer(canvas: HTMLCanvasElement, renderer: Renderer, dprCap: number) {
  const { gl } = renderer
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  gl.viewport(0, 0, width, height)
  perspective(renderer.projection, Math.PI / 3.2, width / height, 0.1, 70)
}

function renderFrame(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  state: SchoolEscapeSceneState,
  timeSeconds: number,
  dprCap: number,
) {
  resizeRenderer(canvas, renderer, dprCap)
  const { gl } = renderer
  const exterior = state.phase === 'final-chase' || state.phase === 'won'
  const fog: Color4 = exterior ? [0.2, 0.23, 0.25, 1] : [0.07, 0.075, 0.08, 1]
  gl.clearColor(fog[0], fog[1], fog[2], 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.useProgram(renderer.program)
  gl.uniform4fv(renderer.fogLocation, fog)
  setCamera(renderer, state)

  if (state.phase === 'failed') {
    drawPrincipalOffice(renderer, timeSeconds)
    return
  }

  if (exterior) drawExterior(renderer)
  else drawSchool(renderer, timeSeconds)

  drawPlayer(renderer, state)
  if (state.phase !== 'won') drawTeacher(renderer, state.teacher)
}

export function createSchoolEscapeScene(
  canvas: HTMLCanvasElement,
  input: SemanticInputReader<SchoolEscapeAction>,
  callbacks: SchoolEscapeSceneCallbacks = {},
): SchoolEscapeSceneController | null {
  const renderer = createRenderer(canvas)
  if (!renderer) {
    callbacks.onWebGLUnavailable?.()
    return null
  }

  let state = createInitialSceneState()
  let disposed = false
  let animationFrame = 0
  let previousTime = performance.now()
  let blendAccumulator = 0
  let qualityAccumulator = 0
  let qualityFrames = 0
  let dprCap = 1.5

  const resize = () => resizeRenderer(canvas, renderer, dprCap)
  const handleVisibility = () => {
    previousTime = performance.now()
  }
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('resize', resize)
  resize()

  const loop = (time: number) => {
    if (disposed) return
    const elapsed = Math.max(0, (time - previousTime) / 1000)
    previousTime = time

    if (!document.hidden) {
      const dt = Math.min(elapsed, MAX_FRAME_DELTA)
      if (state.phase === 'school' || state.phase === 'final-chase') {
        updatePlayer(state, input, dt)
        updateTeacher(state, dt, callbacks)
        applyPhaseTransitions(state, callbacks)
      }

      blendAccumulator += dt
      if (blendAccumulator >= 0.12) {
        updateBlend(state, callbacks)
        blendAccumulator = 0
      }

      qualityAccumulator += elapsed
      qualityFrames += 1
      if (qualityAccumulator >= 3) {
        const fps = qualityFrames / qualityAccumulator
        if (fps < 38 && dprCap > 1) {
          dprCap = 1
          resize()
        }
        qualityAccumulator = 0
        qualityFrames = 0
      }

      renderFrame(canvas, renderer, state, time / 1000, dprCap)
    }

    animationFrame = requestAnimationFrame(loop)
  }

  animationFrame = requestAnimationFrame(loop)

  return {
    setCameraDrag(deltaX, deltaY) {
      if (state.phase === 'failed' || state.phase === 'won') return
      state.cameraYaw -= clamp(deltaX, -100, 100) * 0.0042
      state.cameraPitch = clamp(
        state.cameraPitch + clamp(deltaY, -100, 100) * 0.003,
        -0.1,
        0.58,
      )
    },
    setCamouflageColor(color) {
      state.camouflage = normalizeColor(color)
    },
    resize,
    restart() {
      state = createInitialSceneState()
      input.consumePress('jump')
      callbacks.onPhaseChange?.('school')
      callbacks.onTeacherStateChange?.('patrol')
      callbacks.onSubtitle?.('Match the wall color. Stay still. Find the exit.')
      updateBlend(state, callbacks)
      previousTime = performance.now()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(animationFrame)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('resize', resize)
      renderer.gl.deleteBuffer(renderer.buffer)
      renderer.gl.deleteProgram(renderer.program)
    },
  }
}
