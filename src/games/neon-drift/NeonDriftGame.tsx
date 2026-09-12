import { useCallback, useEffect, useRef, useState } from 'react'
import GameViewport from '../shared/GameViewport'
import {
  damageTurret,
  increaseMultiplier,
  nearestWithinRange,
  NEON_DRIFT_RULES,
} from './neonDriftLogic'
import './neonDrift.css'

type Vec = { x: number; y: number }
type Drone = Vec & {
  id: number
  vx: number
  vy: number
  r: number
  speed: number
  hp: number
  spin: number
  near: boolean
  targetId: number | null
  attackCooldown: number
}
type Turret = Vec & {
  id: number
  hp: number
  maxHp: number
  r: number
  angle: number
  cooldown: number
  life: number
  flash: number
}
type Bullet = Vec & { vx: number; vy: number; life: number }
type Core = Vec & { life: number; phase: number }
type Obstacle = Vec & { w: number; h: number; life: number; phase: number }
type Particle = Vec & {
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

type OverlayCopy = { description: string; button: string }

const TAU = Math.PI * 2
const initialCopy: OverlayCopy = {
  description:
    'Pilot a hovercraft through a hostile neon arena. Collect energy cores, skim danger for bonus multiplier, and deploy turrets when the swarm closes in.',
  button: 'Launch Run',
}

function NeonDriftGame() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const multiplierRef = useRef<HTMLElement>(null)
  const bestRef = useRef<HTMLElement>(null)
  const boostRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<() => void>(() => undefined)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [copy, setCopy] = useState(initialCopy)

  const handleStart = useCallback(() => startRef.current(), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return

    let ctx: CanvasRenderingContext2D | null
    try {
      ctx = canvas.getContext('2d', { alpha: false })
    } catch {
      return
    }
    if (!ctx) return

    const keys = new Set<string>()
    const drones: Drone[] = []
    const turrets: Turret[] = []
    const bullets: Bullet[] = []
    const cores: Core[] = []
    const obstacles: Obstacle[] = []
    const particles: Particle[] = []
    const stars: Array<Vec & { size: number; alpha: number }> = []

    const player = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, boost: 1, invulnerable: 0 }
    let width = 1
    let height = 1
    let dpr = 1
    let running = false
    let paused = false
    let gameOver = false
    let lastTime = performance.now()
    let elapsed = 0
    let score = 0
    let multiplier = 1
    let droneTimer = 0
    let coreTimer = 0
    let obstacleTimer = 0
    let turretCooldown = 0
    let nextDroneId = 1
    let nextTurretId = 1
    let shake = 0
    let messageTimer = 0
    let raf = 0
    let gameOverTimer: ReturnType<typeof setTimeout> | null = null
    let audio: AudioContext | null = null
    let quality = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.65 : 1
    let fpsTime = 0
    let fpsFrames = 0

    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
    const circleHit = (a: Vec, ar: number, b: Vec, br: number) => distance(a, b) < ar + br

    const loadBest = () => {
      try {
        return Number(localStorage.getItem('neon-drift-best') || 0)
      } catch {
        return 0
      }
    }
    let best = loadBest()

    const saveBest = () => {
      try {
        localStorage.setItem('neon-drift-best', String(best))
      } catch {
        // Persistence is optional; gameplay remains available when storage is blocked.
      }
    }

    const beep = (frequency: number, duration = 0.05) => {
      if (!audio) return
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      const now = audio.currentTime
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.018, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.02)
    }

    const showMessage = (text: string) => {
      if (!messageRef.current) return
      messageRef.current.textContent = text
      messageRef.current.classList.add('neon-drift__message--show')
      messageTimer = 0.7
    }

    const addParticle = (x: number, y: number, color: string, speed = 120) => {
      if (particles.length > 360 * quality) return
      const angle = Math.random() * TAU
      const life = rand(0.25, 0.6)
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * rand(speed * 0.35, speed),
        vy: Math.sin(angle) * rand(speed * 0.35, speed),
        life,
        maxLife: life,
        size: rand(1.2, 3.8),
        color,
      })
    }

    const burst = (x: number, y: number, color: string, count = 12, speed = 120) => {
      for (let index = 0; index < Math.floor(count * quality); index += 1) {
        addParticle(x, y, color, speed)
      }
    }

    const updateHud = () => {
      if (scoreRef.current) scoreRef.current.textContent = Math.floor(score).toLocaleString()
      if (multiplierRef.current) multiplierRef.current.textContent = `x${multiplier.toFixed(1)}`
      if (bestRef.current) bestRef.current.textContent = best.toLocaleString()
      if (boostRef.current) boostRef.current.style.transform = `scaleX(${player.boost})`
    }

    const resize = () => {
      const rect = viewport.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars.length = 0
      const count = Math.min(150, Math.max(60, Math.floor((width * height) / 9500)))
      for (let index = 0; index < count; index += 1) {
        stars.push({ x: Math.random() * width, y: Math.random() * height, size: rand(0.4, 1.7), alpha: rand(0.15, 0.65) })
      }
      if (!running) {
        player.x = width * 0.5
        player.y = height * 0.58
      }
    }

    const reset = () => {
      drones.length = 0
      turrets.length = 0
      bullets.length = 0
      cores.length = 0
      obstacles.length = 0
      particles.length = 0
      player.x = width * 0.5
      player.y = height * 0.56
      player.vx = 0
      player.vy = 0
      player.angle = 0
      player.boost = 1
      player.invulnerable = 0.8
      elapsed = 0
      score = 0
      multiplier = 1
      droneTimer = 0.8
      coreTimer = 0.5
      obstacleTimer = 5
      turretCooldown = 0
      shake = 0
      paused = false
      gameOver = false
      updateHud()
    }

    const start = () => {
      if (!audio) audio = new AudioContext()
      if (audio.state === 'suspended') void audio.resume()
      if (gameOverTimer) clearTimeout(gameOverTimer)
      setCopy(initialCopy)
      setOverlayVisible(false)
      reset()
      running = true
      lastTime = performance.now()
      viewport.focus({ preventScroll: true })
      beep(430, 0.08)
    }
    startRef.current = start

    const finish = () => {
      if (gameOver) return
      running = false
      gameOver = true
      shake = 16
      burst(player.x, player.y, '#49f6ff', 28, 220)
      burst(player.x, player.y, '#ff4fd8', 20, 180)
      const finalScore = Math.floor(score)
      if (finalScore > best) {
        best = finalScore
        saveBest()
      }
      updateHud()
      beep(120, 0.18)
      gameOverTimer = setTimeout(() => {
        setCopy({
          description: `Run over. You scored ${finalScore.toLocaleString()}. Best: ${best.toLocaleString()}.`,
          button: 'Run It Back',
        })
        setOverlayVisible(true)
      }, 350)
    }

    const spawnDrone = () => {
      const edge = Math.floor(Math.random() * 4)
      const margin = 35
      const positions = [
        { x: -margin, y: Math.random() * height },
        { x: width + margin, y: Math.random() * height },
        { x: Math.random() * width, y: -margin },
        { x: Math.random() * width, y: height + margin },
      ]
      const position = positions[edge] ?? positions[0]!
      const speed = 72 + Math.min(150, elapsed * 2.4)
      drones.push({
        id: nextDroneId++,
        ...position,
        vx: 0,
        vy: 0,
        r: rand(10, 14),
        speed: rand(speed * 0.8, speed * 1.12),
        hp: 2,
        spin: Math.random() * TAU,
        near: false,
        targetId: null,
        attackCooldown: 0,
      })
    }

    const spawnCore = () => {
      const pad = 65
      cores.push({ x: rand(pad, width - pad), y: rand(85, height - pad), life: 9, phase: Math.random() * TAU })
    }

    const spawnObstacle = () => {
      if (width < 500 || height < 360) return
      const vertical = Math.random() < 0.5
      const obstacle: Obstacle = {
        x: rand(90, width - 90),
        y: rand(105, height - 80),
        w: vertical ? 18 : rand(100, 170),
        h: vertical ? rand(100, 170) : 18,
        life: rand(8, 13),
        phase: Math.random() * TAU,
      }
      if (distance(obstacle, player) > 170) obstacles.push(obstacle)
    }

    const destroyTurret = (turret: Turret, explode = true) => {
      const index = turrets.findIndex((candidate) => candidate.id === turret.id)
      if (index >= 0) turrets.splice(index, 1)
      if (explode) {
        burst(turret.x, turret.y, '#8dff72', 18, 150)
        burst(turret.x, turret.y, '#ff4fd8', 8, 110)
        shake = Math.max(shake, 5)
        beep(155, 0.08)
      }
      for (const drone of drones) if (drone.targetId === turret.id) drone.targetId = null
    }

    const deployTurret = () => {
      if (!running || paused || turretCooldown > 0) return
      if (turrets.length >= NEON_DRIFT_RULES.maxTurrets && turrets[0]) destroyTurret(turrets[0], false)
      turrets.push({
        id: nextTurretId++,
        x: player.x,
        y: player.y,
        hp: 100,
        maxHp: 100,
        r: 15,
        angle: player.angle,
        cooldown: 0.1,
        life: 22,
        flash: 0,
      })
      turretCooldown = 1.15
      burst(player.x, player.y, '#8dff72', 12, 90)
      showMessage('Defense turret deployed')
      beep(610, 0.07)
    }

    const updatePlayer = (dt: number) => {
      let ix = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'))
      let iy = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'))
      if (ix || iy) {
        const length = Math.hypot(ix, iy)
        ix /= length
        iy /= length
      }
      const boosting = keys.has('Space') && player.boost > 0.02 && Boolean(ix || iy)
      const acceleration = boosting ? 980 : 650
      const maxSpeed = boosting ? 520 : 305
      player.vx += ix * acceleration * dt
      player.vy += iy * acceleration * dt
      const speed = Math.hypot(player.vx, player.vy)
      if (speed > maxSpeed) {
        player.vx *= maxSpeed / speed
        player.vy *= maxSpeed / speed
      }
      const damping = Math.exp(-(ix || iy ? 0.8 : 4.2) * dt)
      player.vx *= damping
      player.vy *= damping
      player.x = clamp(player.x + player.vx * dt, 24, width - 24)
      player.y = clamp(player.y + player.vy * dt, 65, height - 42)
      if (speed > 20) {
        const angle = Math.atan2(player.vy, player.vx)
        const delta = ((angle - player.angle + Math.PI) % TAU) - Math.PI
        player.angle += delta * Math.min(1, dt * 11)
      }
      if (boosting) {
        player.boost = Math.max(0, player.boost - dt * 0.3)
        if (Math.random() < 0.7 * quality) addParticle(player.x - Math.cos(player.angle) * 13, player.y - Math.sin(player.angle) * 13, '#49f6ff', 100)
      } else {
        player.boost = Math.min(1, player.boost + dt * 0.095)
      }
      player.invulnerable = Math.max(0, player.invulnerable - dt)
    }

    const updateTurrets = (dt: number) => {
      turretCooldown = Math.max(0, turretCooldown - dt)
      for (let index = turrets.length - 1; index >= 0; index -= 1) {
        const turret = turrets[index]
        if (!turret) continue
        turret.life -= dt
        turret.cooldown -= dt
        turret.flash = Math.max(0, turret.flash - dt * 5)
        if (turret.life <= 0) {
          destroyTurret(turret, false)
          continue
        }
        const target = nearestWithinRange(turret, drones, 330)
        if (!target) continue
        turret.angle = Math.atan2(target.y - turret.y, target.x - turret.x)
        if (turret.cooldown <= 0) {
          const dx = target.x - turret.x
          const dy = target.y - turret.y
          const length = Math.max(1, Math.hypot(dx, dy))
          bullets.push({ x: turret.x, y: turret.y, vx: (dx / length) * 610, vy: (dy / length) * 610, life: 1 })
          turret.cooldown = 0.34
        }
      }
    }

    const updateDrones = (dt: number) => {
      for (let index = drones.length - 1; index >= 0; index -= 1) {
        const drone = drones[index]
        if (!drone) continue
        drone.attackCooldown = Math.max(0, drone.attackCooldown - dt)
        let turret = drone.targetId === null ? null : turrets.find((candidate) => candidate.id === drone.targetId) ?? null
        if (!turret) {
          turret = nearestWithinRange(drone, turrets, NEON_DRIFT_RULES.turretAggroRange)
          drone.targetId = turret?.id ?? null
        }
        const target = turret ?? player
        const dx = target.x - drone.x
        const dy = target.y - drone.y
        const length = Math.max(1, Math.hypot(dx, dy))
        const follow = 1 - Math.exp(-1.7 * dt)
        drone.vx += ((dx / length) * drone.speed - drone.vx) * follow
        drone.vy += ((dy / length) * drone.speed - drone.vy) * follow
        drone.x += drone.vx * dt
        drone.y += drone.vy * dt
        drone.spin += dt * 2.8

        if (turret) {
          if (circleHit(drone, drone.r * 0.7, turret, turret.r) && drone.attackCooldown <= 0) {
            turret.hp = damageTurret(turret.hp, NEON_DRIFT_RULES.turretDamagePerHit)
            turret.flash = 1
            drone.attackCooldown = 0.52
            drone.vx *= -0.4
            drone.vy *= -0.4
            burst(turret.x, turret.y, '#ff4fd8', 6, 90)
            if (turret.hp <= 0) destroyTurret(turret)
          }
        } else {
          const playerDistance = distance(drone, player)
          if (player.invulnerable <= 0 && playerDistance < drone.r * 0.72 + 12) {
            finish()
            return
          }
          if (!drone.near && playerDistance > drone.r + 16 && playerDistance < drone.r + 48) {
            drone.near = true
            multiplier = increaseMultiplier(multiplier, 0.25)
            score += 55 * multiplier
            player.boost = Math.min(1, player.boost + 0.08)
            showMessage('Near miss +0.25x')
            beep(250, 0.035)
          }
        }
      }
    }

    const updateBullets = (dt: number) => {
      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index]
        if (!bullet) continue
        bullet.x += bullet.vx * dt
        bullet.y += bullet.vy * dt
        bullet.life -= dt
        if (bullet.life <= 0) {
          bullets.splice(index, 1)
          continue
        }
        const hitIndex = drones.findIndex((drone) => circleHit(bullet, 3, drone, drone.r * 0.82))
        if (hitIndex < 0) continue
        const drone = drones[hitIndex]
        bullets.splice(index, 1)
        if (!drone) continue
        drone.hp -= 1
        burst(bullet.x, bullet.y, '#8dff72', 4, 75)
        if (drone.hp <= 0) {
          drones.splice(hitIndex, 1)
          score += 85 * multiplier
          multiplier = increaseMultiplier(multiplier, 0.06)
          burst(drone.x, drone.y, '#ff4fd8', 14, 130)
          beep(190, 0.04)
        }
      }
    }

    const updatePickupsAndObstacles = (dt: number) => {
      for (let index = cores.length - 1; index >= 0; index -= 1) {
        const core = cores[index]
        if (!core) continue
        core.life -= dt
        core.phase += dt * 4
        if (circleHit(core, 11, player, 12)) {
          cores.splice(index, 1)
          multiplier = increaseMultiplier(multiplier, 0.18)
          score += 125 * multiplier
          player.boost = Math.min(1, player.boost + 0.22)
          burst(core.x, core.y, '#8dff72', 16, 125)
          showMessage(`Core collected x${multiplier.toFixed(2)}`)
          beep(760, 0.06)
        } else if (core.life <= 0) cores.splice(index, 1)
      }

      for (let index = obstacles.length - 1; index >= 0; index -= 1) {
        const obstacle = obstacles[index]
        if (!obstacle) continue
        obstacle.life -= dt
        obstacle.phase += dt * 2
        const left = obstacle.x - obstacle.w / 2
        const top = obstacle.y - obstacle.h / 2
        const px = clamp(player.x, left, left + obstacle.w)
        const py = clamp(player.y, top, top + obstacle.h)
        if (player.invulnerable <= 0 && Math.hypot(player.x - px, player.y - py) < 11) {
          finish()
          return
        }
        if (obstacle.life <= 0) obstacles.splice(index, 1)
      }
    }

    const updateParticles = (dt: number) => {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        if (!particle) continue
        particle.life -= dt
        if (particle.life <= 0) {
          particles.splice(index, 1)
          continue
        }
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.vx *= Math.exp(-2.2 * dt)
        particle.vy *= Math.exp(-2.2 * dt)
      }
    }

    const update = (dt: number) => {
      if (!running || paused || gameOver) return
      elapsed += dt
      score += dt * 14 * multiplier
      multiplier = Math.max(1, multiplier - dt * 0.045)
      updatePlayer(dt)
      updateTurrets(dt)
      updateDrones(dt)
      updateBullets(dt)
      updatePickupsAndObstacles(dt)
      updateParticles(dt)
      droneTimer -= dt
      coreTimer -= dt
      obstacleTimer -= dt
      const intensity = Math.min(1, elapsed / 58)
      if (droneTimer <= 0 && drones.length < 22) {
        spawnDrone()
        if (elapsed > 26 && Math.random() < 0.15 + intensity * 0.2) spawnDrone()
        droneTimer = (1.45 - intensity * 0.86) * rand(0.8, 1.18)
      }
      if (coreTimer <= 0 && cores.length < 3) {
        spawnCore()
        coreTimer = rand(2.8, 4.2)
      }
      if (elapsed > 10 && obstacleTimer <= 0 && obstacles.length < 4) {
        spawnObstacle()
        obstacleTimer = rand(5.2, 8.2)
      }
      shake *= Math.exp(-10 * dt)
      if (messageTimer > 0 && (messageTimer -= dt) <= 0) messageRef.current?.classList.remove('neon-drift__message--show')
      updateHud()
    }

    const draw = (time: number) => {
      ctx.save()
      if (shake > 0.1) ctx.translate(rand(-shake, shake), rand(-shake, shake))
      const background = ctx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.5, Math.max(width, height) * 0.8)
      background.addColorStop(0, '#0b1733')
      background.addColorStop(0.55, '#071022')
      background.addColorStop(1, '#03050d')
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = '#c6f9ff'
      for (const star of stars) {
        ctx.globalAlpha = star.alpha
        ctx.fillRect(star.x, star.y, star.size, star.size)
      }
      ctx.globalAlpha = 1

      const horizon = height * 0.45
      const gap = Math.max(42, Math.min(70, width / 16))
      const scroll = (time * 28) % gap
      ctx.lineWidth = 1
      for (let y = horizon + scroll; y < height + gap; y += gap) {
        ctx.strokeStyle = 'rgba(73,246,255,.13)'
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }
      const center = width / 2
      for (let index = -18; index <= 18; index += 1) {
        ctx.strokeStyle = 'rgba(125,108,255,.10)'
        ctx.beginPath(); ctx.moveTo(center + index * gap * 0.18, horizon); ctx.lineTo(center + index * gap, height); ctx.stroke()
      }

      for (const obstacle of obstacles) {
        const alpha = 0.55 + Math.sin(obstacle.phase) * 0.12
        ctx.fillStyle = `rgba(255,79,216,${0.08 * alpha})`
        ctx.strokeStyle = `rgba(255,79,216,${alpha})`
        ctx.lineWidth = 2
        ctx.fillRect(obstacle.x - obstacle.w / 2, obstacle.y - obstacle.h / 2, obstacle.w, obstacle.h)
        ctx.strokeRect(obstacle.x - obstacle.w / 2, obstacle.y - obstacle.h / 2, obstacle.w, obstacle.h)
      }

      for (const core of cores) {
        const radius = 10 + Math.sin(core.phase) * 2
        ctx.save(); ctx.translate(core.x, core.y); ctx.rotate(core.phase * 0.4)
        ctx.shadowBlur = quality > 0.7 ? 18 : 5; ctx.shadowColor = '#8dff72'; ctx.strokeStyle = '#8dff72'; ctx.lineWidth = 2
        ctx.strokeRect(-radius, -radius, radius * 2, radius * 2); ctx.restore()
      }

      for (const turret of turrets) {
        ctx.save(); ctx.translate(turret.x, turret.y)
        ctx.shadowBlur = quality > 0.7 ? 15 : 4; ctx.shadowColor = turret.flash > 0 ? '#ff4fd8' : '#8dff72'
        ctx.fillStyle = '#102a2b'; ctx.strokeStyle = turret.flash > 0 ? '#ff8ce7' : '#8dff72'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(0, 0, turret.r, 0, TAU); ctx.fill(); ctx.stroke()
        ctx.rotate(turret.angle); ctx.fillStyle = '#eaffdf'; ctx.fillRect(0, -3, 22, 6); ctx.rotate(-turret.angle)
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-18, -26, 36, 4)
        ctx.fillStyle = turret.hp > 35 ? '#8dff72' : '#ff8a75'; ctx.fillRect(-18, -26, 36 * (turret.hp / turret.maxHp), 4)
        ctx.restore()
      }

      ctx.fillStyle = '#eaffdf'
      for (const bullet of bullets) {
        ctx.shadowBlur = quality > 0.7 ? 10 : 3; ctx.shadowColor = '#8dff72'
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 3, 0, TAU); ctx.fill()
      }
      ctx.shadowBlur = 0

      for (const drone of drones) {
        ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(drone.spin)
        ctx.shadowBlur = quality > 0.7 ? 12 : 4; ctx.shadowColor = '#ff4fd8'; ctx.strokeStyle = '#ff4fd8'; ctx.fillStyle = 'rgba(255,79,216,.12)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(drone.r, 0); ctx.lineTo(0, drone.r); ctx.lineTo(-drone.r, 0); ctx.lineTo(0, -drone.r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
      }

      for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife)
        ctx.fillStyle = particle.color
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill()
      }
      ctx.globalAlpha = 1

      if (!gameOver) {
        ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle)
        ctx.shadowBlur = quality > 0.7 ? 18 : 5; ctx.shadowColor = '#49f6ff'; ctx.fillStyle = '#0b1d32'; ctx.strokeStyle = '#8cfaff'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-9, -10); ctx.lineTo(-4, 0); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-2, -3); ctx.lineTo(-1, 3); ctx.closePath(); ctx.fill(); ctx.restore()
      }

      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.72)
      vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height)

      if (paused && running) {
        ctx.fillStyle = 'rgba(2,4,15,.65)'; ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#fff'; ctx.font = '900 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', width / 2, height / 2)
      }
      ctx.restore()
    }

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000
      lastTime = now
      const dt = clamp(rawDt, 0, 0.033)
      fpsTime += rawDt
      fpsFrames += 1
      if (fpsTime >= 2) {
        const fps = fpsFrames / fpsTime
        if (fps < 43) quality = Math.max(0.55, quality - 0.15)
        else if (fps > 57) quality = Math.min(1, quality + 0.08)
        fpsTime = 0
        fpsFrames = 0
      }
      update(dt)
      draw(now / 1000)
      raf = requestAnimationFrame(loop)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
      if (event.code === 'KeyP' && running) {
        paused = !paused
        if (!paused) lastTime = performance.now()
        return
      }
      if (event.code === 'KeyR' && !event.repeat) {
        deployTurret()
        return
      }
      keys.add(event.code)
      if (!running && (event.code === 'Enter' || event.code === 'Space')) start()
    }
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code)
    const onBlur = () => {
      keys.clear()
      if (running) paused = true
    }

    resize()
    reset()
    draw(0)
    raf = requestAnimationFrame(loop)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(viewport)
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (gameOverTimer) clearTimeout(gameOverTimer)
      startRef.current = () => undefined
      void audio?.close()
    }
  }, [])

  return (
    <GameViewport game="neon-drift" label="Neon Drift game" ref={viewportRef}>
      <div className="neon-drift">
        <canvas aria-label="Neon Drift arena" className="neon-drift__canvas" ref={canvasRef} />
        <div className="neon-drift__hud" aria-hidden={overlayVisible}>
          <div className="neon-drift__topbar">
            <div className="neon-drift__hud-card">Score<strong ref={scoreRef}>0</strong></div>
            <div className="neon-drift__hud-card">Multiplier<strong ref={multiplierRef}>x1.0</strong></div>
            <div className="neon-drift__hud-card neon-drift__hud-card--right">Best<strong ref={bestRef}>0</strong></div>
          </div>
          <div className="neon-drift__message" ref={messageRef}>Near miss +0.25x</div>
          <div className="neon-drift__boost-wrap">
            Boost — Space &nbsp; • &nbsp; Turret — R
            <div className="neon-drift__boost-track"><div className="neon-drift__boost-fill" ref={boostRef} /></div>
          </div>
        </div>
        {overlayVisible ? (
          <div className="neon-drift__overlay">
            <div className="neon-drift__panel">
              <div className="neon-drift__eyebrow">Arcade survival // Cool Games Plus</div>
              <h2 className="neon-drift__title">Neon Drift</h2>
              <p className="neon-drift__subtitle">{copy.description}</p>
              <div className="neon-drift__controls">
                <div className="neon-drift__control"><span>Move</span><b>WASD / Arrows</b></div>
                <div className="neon-drift__control"><span>Emergency thrust</span><b>Space — Boost</b></div>
                <div className="neon-drift__control"><span>Defense system</span><b>R — Deploy turret</b></div>
              </div>
              <button className="neon-drift__start" onClick={handleStart} type="button">{copy.button}</button>
              <p className="neon-drift__tip">Turrets draw nearby drone aggression. Skim drones for near-miss bonuses. Press P to pause.</p>
            </div>
          </div>
        ) : null}
      </div>
    </GameViewport>
  )
}

export default NeonDriftGame
