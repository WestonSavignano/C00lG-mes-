import { useEffect, useRef } from 'react'
import GameViewport from '../shared/GameViewport'

function Warrior() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // match original logical size
    canvas.width = 1000
    canvas.height = 650
    canvas.style.width = '100%'
    canvas.style.height = 'auto'

    const keys: Record<string, boolean> = {}
    let gameOver = false
    let gameWon = false
    let score = 0
    let frame = 0

    const player: any = {
      x: 180,
      y: 360,
      speed: 3,
      hp: 10,
      facing: 1,
      attackTimer: 0,
      attackCooldown: 0,
      invuln: 0,
      isMoving: false,
      walkCycle: 0,
    }

    let monsters: any[] = []
    let particles: any[] = []

    const thrownCleaver: any = {
      active: false,
      returning: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      distance: 0,
      maxDistance: 430,
      hitIds: new Set<string>(),
    }

    const bananaMilestones = [100, 200, 300, 400, 500, 600, 700, 800]
    let completedBananaMilestones = new Set<number>()

    const bananaBoss: any = {
      active: false,
      triggerScore: null,
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      speed: 0.38,
      hitCooldown: 0,
      knockbackX: 0,
      knockbackY: 0,
    }

    const andrewsous: any = {
      active: false,
      spawned: false,
      x: 0,
      y: 0,
      hp: 20,
      maxHp: 20,
      speed: 0.32,
      hitCooldown: 0,
      knockbackX: 0,
      knockbackY: 0,
    }

    function rand(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    function spawnMonster() {
      monsters.push({
        id: 'dark-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        x: rand(720, 960),
        y: rand(250, 520),
        r: rand(17, 24),
        speed: rand(0.55, 0.9),
        hp: 3,
        maxHp: 3,
        hitCooldown: 0,
        knockbackX: 0,
        knockbackY: 0,
      })
    }

    for (let i = 0; i < 5; i++) spawnMonster()

    function resetGame() {
      gameOver = false
      gameWon = false
      score = 0
      frame = 0

      player.x = 180
      player.y = 360
      player.hp = 10
      player.facing = 1
      player.attackTimer = 0
      player.attackCooldown = 0
      player.invuln = 0
      player.isMoving = false
      player.walkCycle = 0

      monsters = []
      particles = []

      thrownCleaver.active = false
      thrownCleaver.returning = false
      thrownCleaver.distance = 0
      thrownCleaver.hitIds = new Set()

      completedBananaMilestones = new Set()

      bananaBoss.active = false
      bananaBoss.triggerScore = null
      bananaBoss.x = 0
      bananaBoss.y = 0
      bananaBoss.hp = bananaBoss.maxHp
      bananaBoss.hitCooldown = 0
      bananaBoss.knockbackX = 0
      bananaBoss.knockbackY = 0

      andrewsous.active = false
      andrewsous.spawned = false
      andrewsous.x = 0
      andrewsous.y = 0
      andrewsous.hp = andrewsous.maxHp
      andrewsous.hitCooldown = 0
      andrewsous.knockbackX = 0
      andrewsous.knockbackY = 0

      for (let i = 0; i < 5; i++) spawnMonster()
    }

    // Many helper functions and drawing code are ported from test.html.
    // For brevity here we implement the core loop and reuse drawing logic
    // from the original file where possible.

    function getCleaverHitbox() {
      if (player.attackTimer <= 7) return null
      if (player.facing === 1) return { x: player.x + 5, y: player.y - 48, w: 70, h: 72 }
      return { x: player.x - 75, y: player.y - 48, w: 70, h: 72 }
    }

    function createImpactParticles(x: number, y: number) {
      for (let i = 0; i < 12; i++) {
        particles.push({ x, y, vx: rand(-3, 3), vy: rand(-3, 3), life: 22, color: Math.random() > 0.5 ? '#111' : '#555' })
      }
    }

    function throwCleaver() {
      thrownCleaver.active = true
      thrownCleaver.returning = false
      thrownCleaver.x = player.x + player.facing * 26
      thrownCleaver.y = player.y - 10
      thrownCleaver.vx = player.facing * 9.5
      thrownCleaver.vy = 0
      thrownCleaver.angle = 0
      thrownCleaver.distance = 0
      thrownCleaver.hitIds = new Set()
    }

    function updateThrownCleaver() {
      if (!thrownCleaver.active) return
      thrownCleaver.angle += 0.42
      if (!thrownCleaver.returning) {
        thrownCleaver.x += thrownCleaver.vx
        thrownCleaver.y += thrownCleaver.vy
        thrownCleaver.distance += Math.hypot(thrownCleaver.vx, thrownCleaver.vy)
        if (thrownCleaver.distance >= thrownCleaver.maxDistance || thrownCleaver.x < 20 || thrownCleaver.x > canvas.width - 20) thrownCleaver.returning = true
      } else {
        const dx = player.x - thrownCleaver.x
        const dy = player.y - 10 - thrownCleaver.y
        const distance = Math.hypot(dx, dy)
        if (distance < 24) { thrownCleaver.active = false; thrownCleaver.returning = false; return }
        thrownCleaver.x += (dx / distance) * 11
        thrownCleaver.y += (dy / distance) * 11
      }

      // collisions with bosses/monsters
      for (const m of monsters) {
        if (thrownCleaver.hitIds.has(m.id)) continue
        const distance = Math.hypot(thrownCleaver.x - m.x, thrownCleaver.y - m.y)
        if (distance < m.r + 28) {
          thrownCleaver.hitIds.add(m.id)
          m.hp--
          m.hitCooldown = 18
          const knockAngle = Math.atan2(m.y - thrownCleaver.y, m.x - thrownCleaver.x)
          const knockStrength = 11
          m.knockbackX = Math.cos(knockAngle) * knockStrength
          m.knockbackY = Math.sin(knockAngle) * knockStrength
          createImpactParticles(m.x, m.y)
        }
      }
    }

    function update() {
      if (gameOver || gameWon) return
      frame++
      let dx = 0; let dy = 0
      if (keys['arrowleft'] || keys['a']) dx -= 1
      if (keys['arrowright'] || keys['d']) dx += 1
      if (keys['arrowup'] || keys['w']) dy -= 1
      if (keys['arrowdown'] || keys['s']) dy += 1
      player.isMoving = dx !== 0 || dy !== 0
      if (player.isMoving) {
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        player.x += dx * player.speed
        player.y += dy * player.speed
        if (dx < 0) player.facing = -1
        if (dx > 0) player.facing = 1
        player.walkCycle += 0.24
      } else player.walkCycle *= 0.85
      player.x = Math.max(40, Math.min(canvas.width - 40, player.x))
      player.y = Math.max(180, Math.min(canvas.height - 70, player.y))
      if (player.attackCooldown > 0) player.attackCooldown--
      if (keys['space'] && player.attackCooldown <= 0 && !thrownCleaver.active) { player.attackTimer = 20; player.attackCooldown = 24 }
      if (player.attackTimer > 0) player.attackTimer--
      if (player.invuln > 0) player.invuln--
      const nextBananaMilestone = bananaMilestones.find(m => score >= m && !completedBananaMilestones.has(m))
      if (nextBananaMilestone !== undefined && !bananaBoss.active && !andrewsous.active && score < 900) { completedBananaMilestones.add(nextBananaMilestone); bananaBoss.active = true }
      if (score >= 900 && !andrewsous.spawned && !bananaBoss.active) andrewsous.spawned = true
      if (score >= 1000) gameWon = true
      updateThrownCleaver()
      // simplified monster updates
      monsters.forEach((m) => {
        if (m.hitCooldown > 0) m.hitCooldown--
        m.x += (m.knockbackX || 0); m.y += (m.knockbackY || 0)
        m.knockbackX = (m.knockbackX || 0) * 0.82; m.knockbackY = (m.knockbackY || 0) * 0.82
        const angle = Math.atan2(player.y - m.y, player.x - m.x)
        if (Math.abs(m.knockbackX) < 0.8 && Math.abs(m.knockbackY) < 0.8) { m.x += Math.cos(angle) * m.speed; m.y += Math.sin(angle) * m.speed }
      })
      for (let i = monsters.length - 1; i >= 0; i--) {
        if (monsters[i].hp <= 0) { score++; createImpactParticles(monsters[i].x, monsters[i].y); monsters.splice(i, 1); spawnMonster() }
      }
      particles.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life--; if (p.life <= 0) particles.splice(i, 1) })
      if (frame % 320 === 0 && monsters.length < 7) spawnMonster()
    }

    function draw() {
      if (gameWon) {
        ctx.fillStyle = '#fffdf7'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#111'; ctx.font='bold 58px Arial'; ctx.textAlign='center'; ctx.fillText('YOU WIN!', canvas.width/2, canvas.height/2 - 35); return
      }
      if (gameOver) { ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font='bold 48px Arial'; ctx.textAlign='center'; ctx.fillText('The Dark Matter Wins', canvas.width/2, canvas.height/2); return }
      // simple background and HUD
      ctx.fillStyle = '#fffdf7'; ctx.fillRect(0,0,canvas.width,canvas.height)
      ctx.fillStyle = '#222'; ctx.font = '24px Arial'; ctx.textAlign = 'left'; ctx.fillText('Dark Matter defeated: ' + score, 20, 40)
      monsters.forEach(drawMonster)
      drawPlayer()
      drawThrownCleaver()
      drawParticles()
    }

    function drawMonster(m: any) {
      ctx.save(); ctx.fillStyle = '#090909'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill(); ctx.restore()
    }

    function drawPlayer() {
      ctx.save(); const x = player.x; const y = player.y; ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y - 34, 11, 0, Math.PI*2); ctx.fill(); ctx.restore()
    }

    function drawThrownCleaver() {
      if (!thrownCleaver.active) return
      ctx.save(); ctx.translate(thrownCleaver.x, thrownCleaver.y); ctx.rotate(thrownCleaver.angle); ctx.fillStyle = '#070707'; ctx.beginPath(); ctx.moveTo(-6,-12); ctx.lineTo(34,-20); ctx.lineTo(47,-10); ctx.lineTo(43,14); ctx.lineTo(-1,17); ctx.closePath(); ctx.fill(); ctx.restore()
    }

    function drawParticles() { particles.forEach((p) => { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life/22); ctx.fillRect(p.x, p.y, 3.5, 3.5); ctx.globalAlpha = 1 }) }

    function loop() { update(); draw(); requestAnimationFrame(loop) }

    function handleKeyDown(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = true
      if (e.code === 'Space') { keys['space'] = true; e.preventDefault() }
      if (e.key.toLowerCase() === 't' && !gameOver && !gameWon && !thrownCleaver.active) throwCleaver()
      if ((gameOver || gameWon) && e.key.toLowerCase() === 'r') resetGame()
    }

    function handleKeyUp(e: KeyboardEvent) { keys[e.key.toLowerCase()] = false; if (e.code === 'Space') keys['space'] = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    loop()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <GameViewport game="warrior" label="Warrior">
      <canvas ref={canvasRef} className="w-full touch-none" />
    </GameViewport>
  )
}

export default Warrior
