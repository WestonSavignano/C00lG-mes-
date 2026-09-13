import { useEffect, useRef, useState } from 'react'
import GameViewport from '../shared/GameViewport'
import { useSemanticInput } from '../shared/input/useSemanticInput'
import MonsterColorRushControls from './MonsterColorRushControls'
import {
  REQUIRED_MATCH_COUNT,
  REST_DURATION_SECONDS,
  TOTAL_WAVES,
  WAVE_DURATION_SECONDS,
  createWaveObjects,
  getMonsterColorIndex,
  selectFarthestSpawn,
  type WaveObject,
} from './monsterColorRushLogic'
import {
  drawMonsterColorRushFrame,
  type RenderCircle,
  type RenderMonster,
  type RenderParticle,
} from './monsterColorRushRenderer'
import {
  monsterColorRushKeyboardBindings,
  type MonsterColorRushAction,
} from './monsterColorRushInput'
import './monsterColorRush.css'

const COLORS = [
  { name: 'RED', hex: '#ff4054' },
  { name: 'ORANGE', hex: '#ff8a27' },
  { name: 'YELLOW', hex: '#ffdc36' },
  { name: 'GREEN', hex: '#42df6b' },
  { name: 'BLUE', hex: '#3b9dff' },
  { name: 'VIOLET', hex: '#b45cff' },
] as const

const MAX_HEALTH = 10
const PLAYER_SPEED = 285
const MAX_PARTICLES = 220

type Mode = 'ready' | 'wave' | 'rest' | 'game-over' | 'win'

type Overlay = {
  kind: Mode
  title: string
  lines: string[]
  buttonLabel?: string
}

type RuntimeControls = { start(): void }

const INTRO_OVERLAY: Overlay = {
  kind: 'ready',
  title: 'Monster Color Rush',
  lines: [
    'Collect all six shapes that match the monster before the 45-second timer expires.',
    'Wrong colors cost health. Touching the monster ends the run.',
  ],
  buttonLabel: 'Start game',
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function MonsterColorRushGame() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const waveRef = useRef<HTMLSpanElement | null>(null)
  const stateRef = useRef<HTMLSpanElement | null>(null)
  const timeRef = useRef<HTMLSpanElement | null>(null)
  const healthRef = useRef<HTMLSpanElement | null>(null)
  const matchesRef = useRef<HTMLSpanElement | null>(null)
  const scoreRef = useRef<HTMLSpanElement | null>(null)
  const colorDotRef = useRef<HTMLSpanElement | null>(null)
  const runtimeRef = useRef<RuntimeControls | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(INTRO_OVERLAY)
  const [touchControlsVisible, setTouchControlsVisible] = useState(false)
  const input = useSemanticInput<MonsterColorRushAction>(
    monsterColorRushKeyboardBindings,
  )

  useEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!viewport || !canvas || !ctx) return

    const player: RenderCircle = { x: 0, y: 0, radius: 21 }
    const monster: RenderMonster = {
      x: 0,
      y: 0,
      radius: 58,
      speed: 60,
      shape: 1,
      wobble: 0,
    }

    let width = 1
    let height = 1
    let mode: Mode = 'ready'
    let wave = 1
    let timer = WAVE_DURATION_SECONDS
    let health = MAX_HEALTH
    let score = 0
    let lastTime = performance.now()
    let monsterHitCooldown = 0
    let objects: WaveObject[] = []
    let particles: RenderParticle[] = []
    let raf = 0
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
    }
    mediaQuery.addEventListener?.('change', onReducedMotionChange)

    const requiredCollected = () =>
      objects.filter((object) => object.required && object.collected).length

    const updateHud = () => {
      if (waveRef.current) waveRef.current.textContent = `${wave} / ${TOTAL_WAVES}`
      if (stateRef.current) {
        const labels: Record<Mode, string> = {
          ready: 'READY',
          wave: 'CHASE',
          rest: 'REST',
          'game-over': 'OVER',
          win: 'WIN',
        }
        stateRef.current.textContent = labels[mode]
      }
      if (timeRef.current) timeRef.current.textContent = String(Math.max(0, Math.ceil(timer)))
      if (healthRef.current) healthRef.current.textContent = `${health} / ${MAX_HEALTH}`
      if (matchesRef.current) {
        matchesRef.current.textContent = `${requiredCollected()} / ${REQUIRED_MATCH_COUNT}`
      }
      if (scoreRef.current) scoreRef.current.textContent = String(score)
      if (colorDotRef.current) {
        colorDotRef.current.style.backgroundColor = COLORS[getMonsterColorIndex(wave)].hex
      }
    }

    const clampEntity = (entity: RenderCircle, topInset = 88) => {
      const minX = entity.radius + 8
      const maxX = Math.max(minX, width - entity.radius - 8)
      const minY = Math.min(height - entity.radius - 8, entity.radius + topInset)
      const maxY = Math.max(minY, height - entity.radius - 8)
      entity.x = Math.max(minX, Math.min(maxX, entity.x))
      entity.y = Math.max(minY, Math.min(maxY, entity.y))
    }

    const resize = () => {
      const rect = viewport.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      clampEntity(player)
      clampEntity(monster)
      for (const object of objects) clampEntity(object, 96)
    }

    const createSpawnCandidates = () => {
      const minX = monster.radius + 8
      const maxX = Math.max(minX, width - monster.radius - 8)
      const minY = Math.min(height - monster.radius - 8, monster.radius + 88)
      const maxY = Math.max(minY, height - monster.radius - 8)
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ]
    }

    const createObjects = () => {
      const horizontalInset = Math.min(80, Math.max(38, width * 0.09))
      const minX = horizontalInset
      const maxX = Math.max(minX + 1, width - horizontalInset)
      const minY = Math.min(
        Math.max(112, height * 0.26),
        Math.max(112, height - 100),
      )
      const maxY = Math.max(minY + 1, height - 72)
      objects = createWaveObjects({
        monsterColorIndex: getMonsterColorIndex(wave),
        minX,
        maxX,
        minY,
        maxY,
      })
    }

    const beginWave = () => {
      mode = 'wave'
      timer = WAVE_DURATION_SECONDS
      health = MAX_HEALTH
      monster.shape = wave
      monster.speed = 60 + (wave - 1) * 17
      const spawn = selectFarthestSpawn(player, createSpawnCandidates())
      monster.x = spawn.x
      monster.y = spawn.y
      monsterHitCooldown = 0
      createObjects()
      setOverlay(null)
      setTouchControlsVisible(true)
      updateHud()
    }

    const startGame = () => {
      wave = 1
      score = 0
      particles = []
      player.x = width / 2
      player.y = Math.max(player.radius + 96, height - 92)
      clampEntity(player)
      beginWave()
      lastTime = performance.now()
    }

    runtimeRef.current = { start: startGame }

    const showGameOver = (reason: 'timeout' | 'caught' | 'health') => {
      mode = 'game-over'
      setTouchControlsVisible(false)
      const reasonLine =
        reason === 'timeout'
          ? 'Time ran out before you collected all six matching shapes.'
          : reason === 'health'
            ? 'Too many wrong colors drained your health.'
            : 'The monster caught you.'
      setOverlay({
        kind: 'game-over',
        title: 'Game over',
        lines: [reasonLine, `You reached Wave ${wave}. Final score: ${score}.`],
        buttonLabel: 'Try again',
      })
      updateHud()
    }

    const showWin = () => {
      mode = 'win'
      setTouchControlsVisible(false)
      setOverlay({
        kind: 'win',
        title: 'You win!',
        lines: [`You survived all ${TOTAL_WAVES} waves.`, `Final score: ${score}.`],
        buttonLabel: 'Play again',
      })
      updateHud()
    }

    const finishWave = () => {
      if (wave >= TOTAL_WAVES) {
        showWin()
        return
      }
      mode = 'rest'
      timer = REST_DURATION_SECONDS
      setTouchControlsVisible(false)
      setOverlay({
        kind: 'rest',
        title: `Wave ${wave} complete!`,
        lines: [
          'All six monster-color shapes collected.',
          `${REST_DURATION_SECONDS}-second rest before the next chase.`,
        ],
      })
      updateHud()
    }

    const createParticles = (x: number, y: number, color: string, amount: number) => {
      const particleAmount = reducedMotion ? Math.ceil(amount * 0.35) : amount
      for (let index = 0; index < particleAmount; index += 1) {
        if (particles.length >= MAX_PARTICLES) break
        particles.push({
          x,
          y,
          vx: random(-180, 180),
          vy: random(-180, 180),
          life: random(0.4, 1.2),
          color,
          size: random(3, 8),
        })
      }
    }

    const movePlayer = (dt: number) => {
      const move = input.reader.move
      player.x += move.x * PLAYER_SPEED * dt
      player.y += move.y * PLAYER_SPEED * dt
      clampEntity(player)
    }

    const chasePlayer = (dt: number) => {
      const dx = player.x - monster.x
      const dy = player.y - monster.y
      const distance = Math.hypot(dx, dy)
      if (distance > 1) {
        monster.x += (dx / distance) * monster.speed * dt
        monster.y += (dy / distance) * monster.speed * dt
      }
      clampEntity(monster)
    }

    const checkMonsterCollision = () => {
      if (monsterHitCooldown > 0) return
      const distance = Math.hypot(player.x - monster.x, player.y - monster.y)
      if (distance < player.radius + monster.radius * 0.72) showGameOver('caught')
    }

    const checkObjectCollisions = () => {
      for (const object of objects) {
        if (object.collected) continue
        const distance = Math.hypot(player.x - object.x, player.y - object.y)
        if (distance >= player.radius + object.radius) continue

        object.collected = true
        if (object.required) {
          score += 100 * wave
          createParticles(object.x, object.y, COLORS[object.colorIndex].hex, 28)
        } else {
          health -= 1
          score = Math.max(0, score - 25)
          monsterHitCooldown = 0.5
          createParticles(player.x, player.y, '#ffffff', 18)
          const dx = player.x - object.x
          const dy = player.y - object.y
          const safeDistance = Math.max(1, Math.hypot(dx, dy))
          player.x += (dx / safeDistance) * 35
          player.y += (dy / safeDistance) * 35
          clampEntity(player)
          if (health <= 0) {
            showGameOver('health')
            return
          }
        }

        updateHud()
        if (requiredCollected() === REQUIRED_MATCH_COUNT) {
          finishWave()
          return
        }
      }
    }

    const updateParticles = (dt: number) => {
      for (const particle of particles) {
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.vy += 160 * dt
        particle.life -= dt
      }
      particles = particles.filter((particle) => particle.life > 0)
    }

    const update = (dt: number) => {
      monster.wobble += dt * (reducedMotion ? 1.4 : 5)
      monsterHitCooldown = Math.max(0, monsterHitCooldown - dt)

      if (mode === 'wave') {
        timer -= dt
        movePlayer(dt)
        chasePlayer(dt)
        checkMonsterCollision()
        if (mode !== 'wave') return
        checkObjectCollisions()
        if (mode !== 'wave') return
        if (timer <= 0) {
          timer = 0
          showGameOver('timeout')
          return
        }
      } else if (mode === 'rest') {
        timer -= dt
        if (timer <= 0) {
          wave += 1
          beginWave()
        }
      }

      updateParticles(dt)
      updateHud()
    }

    const draw = () => {
      drawMonsterColorRushFrame({
        ctx,
        width,
        height,
        player,
        monster,
        objects,
        particles,
        wave,
        colors: COLORS,
        reducedMotion,
      })
    }

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      if (
        input.reader.consumePress('start') &&
        (mode === 'ready' || mode === 'game-over' || mode === 'win')
      ) {
        startGame()
      }

      update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }

    resize()
    player.x = width / 2
    player.y = Math.max(player.radius + 96, height - 92)
    monster.x = width / 2
    monster.y = monster.radius + 88
    clampEntity(player)
    clampEntity(monster)
    updateHud()
    draw()
    lastTime = performance.now()
    raf = requestAnimationFrame(loop)

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(viewport)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      mediaQuery.removeEventListener?.('change', onReducedMotionChange)
      runtimeRef.current = null
      input.writer.reset()
    }
  }, [input])

  return (
    <GameViewport
      game="monster-color-rush"
      inputOverlay={
        touchControlsVisible ? <MonsterColorRushControls writer={input.writer} /> : null
      }
      label="Monster Color Rush game"
      ref={viewportRef}
    >
      <div className="monster-color-rush">
        <canvas
          aria-label="Monster Color Rush arena"
          className="monster-color-rush__canvas"
          ref={canvasRef}
        />

        <div className="monster-color-rush__hud" aria-hidden={overlay !== null}>
          <div className="monster-color-rush__panel"><span>Wave</span><strong ref={waveRef}>1 / {TOTAL_WAVES}</strong></div>
          <div className="monster-color-rush__panel"><span>State</span><strong ref={stateRef}>READY</strong></div>
          <div className="monster-color-rush__panel monster-color-rush__panel--timer"><span>Time</span><strong ref={timeRef}>{WAVE_DURATION_SECONDS}</strong></div>
          <div className="monster-color-rush__panel"><span>Health</span><strong ref={healthRef}>{MAX_HEALTH} / {MAX_HEALTH}</strong></div>
          <div className="monster-color-rush__panel monster-color-rush__panel--matches">
            <span>Matches</span>
            <strong><i aria-hidden="true" className="monster-color-rush__color-dot" ref={colorDotRef} /><span ref={matchesRef}>0 / {REQUIRED_MATCH_COUNT}</span></strong>
          </div>
          <div className="monster-color-rush__panel"><span>Score</span><strong ref={scoreRef}>0</strong></div>
        </div>

        {overlay ? (
          <div className="monster-color-rush__overlay">
            <div className="monster-color-rush__message" data-kind={overlay.kind}>
              <p className="monster-color-rush__eyebrow">Color chase // Cool Games Plus</p>
              <h2>{overlay.title}</h2>
              {overlay.lines.map((line) => <p key={line}>{line}</p>)}
              {overlay.buttonLabel ? (
                <button type="button" onClick={() => runtimeRef.current?.start()}>
                  {overlay.buttonLabel}
                </button>
              ) : null}
              {overlay.kind === 'ready' ? (
                <p className="monster-color-rush__hint">WASD / arrows · touch stick · Space or Enter to start</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </GameViewport>
  )
}

export default MonsterColorRushGame
