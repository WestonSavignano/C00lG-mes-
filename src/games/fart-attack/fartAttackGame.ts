import {
  BOSS_REWARD,
  ENEMY_REWARD,
  SHOP_DURATION_MS,
  SHOP_ITEM_COST,
  applyDamage,
  buyArmor,
  createInitialProgress,
  type ArmorId,
} from './fartAttackLogic'

const GAME_WIDTH = 800
const GAME_HEIGHT = 500
const PLAYER_START_X = GAME_WIDTH / 2
const PLAYER_START_Y = GAME_HEIGHT / 2
const MAX_BLOOD_PUDDLES = 120
const MAX_PARTICLES = 420

type Point = {
  x: number
  y: number
}

type Person = Point & {
  alive: boolean
  speed: number
  fartTimer: number
  bodyAngle: number
}

type Boss = Point & {
  health: number
  maxHealth: number
  speed: number
  direction: 1 | -1
  fartTimer: number
  fartCooldown: number
}

type FartCloud = Point & {
  radius: number
  life: number
  damage: number
  color: string
  text: string
}

type BloodPuddle = Point & {
  size: number
}

type Particle = Point & {
  vx: number
  vy: number
  life: number
}

type Player = Point & {
  speed: number
  health: number
  fartCooldown: number
  invincible: number
  hasBossFart: boolean
}

export type MovementDirection = 'up' | 'down' | 'left' | 'right'

export type FartAttackGameController = {
  destroy: () => void
  fart: () => void
  restart: () => void
  setMovement: (direction: MovementDirection, active: boolean) => void
}

const ARMOR_ITEMS: ReadonlyArray<{
  id: ArmorId
  name: string
  description: string
}> = [
  { id: 'gas-mask', name: 'Gas Mask', description: 'Take 20% less damage' },
  { id: 'hazmat-suit', name: 'Hazmat Suit', description: 'Take 20% less damage' },
  { id: 'hazmat-pants', name: 'Hazmat Pants', description: 'Take 20% less damage' },
]

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function createPlayer(): Player {
  return {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    speed: 4,
    health: 100,
    fartCooldown: 0,
    invincible: 0,
    hasBossFart: false,
  }
}

export function createFartAttackGame(canvas: HTMLCanvasElement): FartAttackGameController {
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Fart Attack requires a 2D canvas context')
  }

  const ctx: CanvasRenderingContext2D = context
  canvas.width = GAME_WIDTH
  canvas.height = GAME_HEIGHT

  const movement: Record<MovementDirection, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  let score = 0
  let wave = 1
  let gameOver = false
  let messageTimer = 100
  let gameTime = 0
  let deathStartedAt: number | null = null
  let player = createPlayer()
  let progress = createInitialProgress()
  let people: Person[] = []
  let boss: Boss | null = null
  let playerFarts: FartCloud[] = []
  let enemyFarts: FartCloud[] = []
  let bloodPuddles: BloodPuddle[] = []
  let particles: Particle[] = []
  let shopActive = false
  let shopEndsAt = 0
  let shopMessage = ''
  let shopMessageUntil = 0
  let animationFrame = 0
  let destroyed = false
  let lastFrameAt = performance.now()

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function ownsArmor(armorId: ArmorId): boolean {
    return progress.ownedArmor.includes(armorId)
  }

  function clearMovement() {
    movement.up = false
    movement.down = false
    movement.left = false
    movement.right = false
  }

  function createWave() {
    people = []
    boss = null
    enemyFarts = []
    messageTimer = 100

    const amount = Math.min(30, 5 + wave * 2)

    for (let index = 0; index < amount; index += 1) {
      let x = 0
      let y = 0

      do {
        x = 35 + Math.random() * 730
        y = 90 + Math.random() * 350
      } while (Math.hypot(x - player.x, y - player.y) < 140)

      people.push({
        x,
        y,
        alive: true,
        speed: 0.55 + wave * 0.08,
        fartTimer: 80 + Math.random() * 180,
        bodyAngle: (Math.random() - 0.5) * 0.8,
      })
    }
  }

  function createBoss() {
    const health = Math.min(14, 3 + Math.floor(wave / 2))

    boss = {
      x: GAME_WIDTH / 2,
      y: 110,
      health,
      maxHealth: health,
      speed: 1 + wave * 0.15,
      direction: 1,
      fartTimer: 80,
      fartCooldown: Math.max(45, 105 - wave * 3),
    }
    messageTimer = 120
  }

  function makeBlood(x: number, y: number) {
    bloodPuddles.push({ x, y, size: 16 + Math.random() * 14 })
    if (bloodPuddles.length > MAX_BLOOD_PUDDLES) {
      bloodPuddles.splice(0, bloodPuddles.length - MAX_BLOOD_PUDDLES)
    }

    for (let index = 0; index < 10; index += 1) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 35,
      })
    }

    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES)
    }
  }

  function killPerson(person: Person) {
    if (!person.alive) {
      return
    }

    person.alive = false
    person.bodyAngle = (Math.random() - 0.5) * 1.4
    score += 1
    progress = { ...progress, coins: progress.coins + ENEMY_REWARD }
    makeBlood(person.x, person.y)
  }

  function onBlood(person: Person): boolean {
    return bloodPuddles.some((puddle) => distance(person, puddle) < puddle.size)
  }

  function hurtPlayer(amount: number) {
    if (player.invincible > 0 || shopActive || gameOver) {
      return
    }

    player.health = applyDamage(player.health, amount, progress.damageReduction)
    player.invincible = 25

    if (player.health <= 0) {
      player.health = 0
      gameOver = true
      deathStartedAt ??= performance.now()
      clearMovement()
    }
  }

  function startShop(now: number) {
    shopActive = true
    shopEndsAt = now + SHOP_DURATION_MS
    shopMessage = `Boss defeated! +${BOSS_REWARD} coins`
    shopMessageUntil = now + 1_800
    enemyFarts = []
    playerFarts = []
    clearMovement()
  }

  function finishShop() {
    shopActive = false
    wave += 1
    createWave()
  }

  function buyShopItem(index: number, now: number) {
    if (!shopActive) {
      return
    }

    const item = ARMOR_ITEMS[index]
    if (!item) {
      return
    }

    if (ownsArmor(item.id)) {
      shopMessage = `${item.name} is already owned`
      shopMessageUntil = now + 1_200
      return
    }

    if (progress.coins < SHOP_ITEM_COST) {
      shopMessage = `You need ${SHOP_ITEM_COST - progress.coins} more coins`
      shopMessageUntil = now + 1_200
      return
    }

    progress = buyArmor(progress, item.id)
    shopMessage = `${item.name} purchased!`
    shopMessageUntil = now + 1_400
  }

  function getShopCard(index: number) {
    return {
      x: 55 + index * 235,
      y: 370,
      width: 220,
      height: 100,
    }
  }

  function createFart(x: number, y: number, type: 'player' | 'enemy' | 'boss') {
    if (type === 'player') {
      playerFarts.push({
        x,
        y,
        radius: player.hasBossFart ? 28 : 20,
        life: player.hasBossFart ? 55 : 42,
        damage: 0,
        color: player.hasBossFart ? '#f2ff40' : '#b7e35b',
        text: player.hasBossFart ? 'MEGA PFFFT!' : 'PFFFT!',
      })
      return
    }

    if (type === 'enemy') {
      enemyFarts.push({
        x,
        y,
        radius: 13,
        life: 45,
        damage: 1.5 + wave * 0.08,
        color: '#9ccc65',
        text: 'PFFT!',
      })
      return
    }

    enemyFarts.push({
      x,
      y,
      radius: 38,
      life: 70,
      damage: 4 + wave * 0.25,
      color: '#eaff55',
      text: 'BOSS PFFT!',
    })
  }

  function playerFart() {
    if (gameOver || shopActive || player.fartCooldown > 0) {
      return
    }

    const radius = player.hasBossFart ? 190 : 125
    player.fartCooldown = player.hasBossFart ? 12 : 25
    createFart(player.x, player.y, 'player')

    for (const person of people) {
      if (person.alive && distance(player, person) < radius) {
        killPerson(person)
      }
    }

    if (boss && distance(player, boss) < radius) {
      boss.health -= 1
      makeBlood(boss.x, boss.y)

      if (boss.health <= 0) {
        boss = null
        progress = { ...progress, coins: progress.coins + BOSS_REWARD }
        player.hasBossFart = true
        startShop(performance.now())
      }
    }
  }

  function updatePeople(frameScale: number) {
    for (const person of people) {
      if (!person.alive) {
        continue
      }

      person.fartTimer -= frameScale
      if (person.fartTimer <= 0) {
        person.fartTimer = 100 + Math.random() * 180
        createFart(person.x, person.y + 12, 'enemy')
      }

      const bloodDeathChance = Math.min(1, (0.012 + wave * 0.002) * frameScale)
      if (onBlood(person) && Math.random() < bloodDeathChance) {
        killPerson(person)
        continue
      }

      const playerDistance = distance(person, player)
      if (playerDistance > 42) {
        const angle = Math.atan2(player.y - person.y, player.x - person.x)
        person.x += Math.cos(angle) * person.speed * frameScale
        person.y += Math.sin(angle) * person.speed * frameScale
      } else {
        hurtPlayer(0.45 + wave * 0.04)
      }
    }
  }

  function updateBoss(frameScale: number) {
    if (!boss) {
      return
    }

    boss.x += boss.direction * boss.speed * frameScale
    if (boss.x < 60 || boss.x > GAME_WIDTH - 60) {
      boss.direction = boss.direction === 1 ? -1 : 1
      boss.x = Math.max(60, Math.min(GAME_WIDTH - 60, boss.x))
    }

    if (distance(boss, player) < 65) {
      hurtPlayer(0.8 + wave * 0.08)
    }

    boss.fartTimer -= frameScale
    if (boss.fartTimer <= 0) {
      boss.fartTimer = boss.fartCooldown
      createFart(boss.x, boss.y + 25, 'boss')
    }
  }

  function updateFarts(frameScale: number) {
    for (const fart of playerFarts) {
      fart.radius += 4 * frameScale
      fart.life -= frameScale
    }
    playerFarts = playerFarts.filter((fart) => fart.life > 0)

    for (const fart of enemyFarts) {
      fart.radius += 2 * frameScale
      fart.life -= frameScale
      if (distance(player, fart) < fart.radius + 15) {
        hurtPlayer(fart.damage)
      }
    }
    enemyFarts = enemyFarts.filter((fart) => fart.life > 0)
  }

  function update(frameScale: number, now: number) {
    if (gameOver) {
      return
    }

    gameTime += frameScale

    if (shopActive) {
      if (now >= shopEndsAt) {
        finishShop()
      }
      return
    }

    if (movement.up) player.y -= player.speed * frameScale
    if (movement.down) player.y += player.speed * frameScale
    if (movement.left) player.x -= player.speed * frameScale
    if (movement.right) player.x += player.speed * frameScale

    player.x = Math.max(25, Math.min(GAME_WIDTH - 25, player.x))
    player.y = Math.max(45, Math.min(GAME_HEIGHT - 25, player.y))

    player.fartCooldown = Math.max(0, player.fartCooldown - frameScale)
    player.invincible = Math.max(0, player.invincible - frameScale)

    updatePeople(frameScale)
    updateBoss(frameScale)
    updateFarts(frameScale)

    for (const particle of particles) {
      particle.x += particle.vx * frameScale
      particle.y += particle.vy * frameScale
      particle.life -= frameScale
    }
    particles = particles.filter((particle) => particle.life > 0)

    const peopleDefeated = people.length > 0 && people.every((person) => !person.alive)
    if (peopleDefeated && boss === null) {
      createBoss()
    }

    messageTimer = Math.max(0, messageTimer - frameScale)
  }

  function drawPerson(person: Person) {
    if (!person.alive) {
      ctx.save()
      ctx.translate(person.x, person.y)
      ctx.rotate(person.bodyAngle)

      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(0, 18, 31, 10, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#111'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-7, 8)
      ctx.lineTo(-28, 25)
      ctx.moveTo(7, 8)
      ctx.lineTo(28, 25)
      ctx.stroke()

      ctx.fillStyle = '#315fa8'
      ctx.fillRect(-14, -5, 28, 32)

      ctx.strokeStyle = '#111'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(-12, 0)
      ctx.lineTo(-29, 16)
      ctx.moveTo(12, 0)
      ctx.lineTo(29, 16)
      ctx.stroke()

      ctx.fillStyle = '#d99b72'
      ctx.beginPath()
      ctx.arc(0, -18, 12, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#111'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-7, -20)
      ctx.lineTo(-3, -18)
      ctx.moveTo(3, -18)
      ctx.lineTo(7, -20)
      ctx.stroke()
      ctx.restore()
      return
    }

    const breathing = reducedMotion ? 0 : Math.sin(gameTime * 0.08 + person.x) * 2
    const moving = distance(person, player) > 42
    const walk = reducedMotion || !moving ? 0 : Math.sin(gameTime * 0.22 + person.x * 0.05)
    const armSwing = walk * 11
    const legSwing = walk * 9

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(person.x - 11, person.y + breathing)
    ctx.lineTo(person.x - 20 - armSwing, person.y + 18 + breathing)
    ctx.moveTo(person.x + 11, person.y + breathing)
    ctx.lineTo(person.x + 20 + armSwing, person.y + 18 + breathing)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(person.x - 6, person.y + 25)
    ctx.lineTo(person.x - 10 + legSwing, person.y + 42)
    ctx.moveTo(person.x + 6, person.y + 25)
    ctx.lineTo(person.x + 10 - legSwing, person.y + 42)
    ctx.stroke()

    ctx.fillStyle = '#3976d3'
    ctx.fillRect(person.x - 12, person.y - 5 + breathing, 24, 30)

    ctx.fillStyle = '#ffd1a4'
    ctx.beginPath()
    ctx.arc(person.x, person.y - 18 + breathing, 12, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(person.x - 4, person.y - 20 + breathing, 2.2, 0, Math.PI * 2)
    ctx.arc(person.x + 4, person.y - 20 + breathing, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawPlayer() {
    const moving = movement.up || movement.down || movement.left || movement.right
    const walk = reducedMotion || !moving ? 0 : Math.sin(gameTime * 0.35)
    const armSwing = walk * 10
    const legSwing = walk * 8

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(player.x - 7, player.y + 17)
    ctx.lineTo(player.x - 10 + legSwing, player.y + 34)
    ctx.moveTo(player.x + 7, player.y + 17)
    ctx.lineTo(player.x + 10 - legSwing, player.y + 34)
    ctx.stroke()

    if (ownsArmor('hazmat-pants')) {
      ctx.strokeStyle = '#f3d84a'
      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.moveTo(player.x - 7, player.y + 16)
      ctx.lineTo(player.x - 10 + legSwing, player.y + 33)
      ctx.moveTo(player.x + 7, player.y + 16)
      ctx.lineTo(player.x + 10 - legSwing, player.y + 33)
      ctx.stroke()
    }

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(player.x - 13, player.y - 5)
    ctx.lineTo(player.x - 22 - armSwing, player.y + 11)
    ctx.moveTo(player.x + 13, player.y - 5)
    ctx.lineTo(player.x + 22 + armSwing, player.y + 11)
    ctx.stroke()

    ctx.fillStyle = player.invincible > 0
      ? '#ff3333'
      : player.hasBossFart
        ? '#e67e22'
        : '#8b45c6'
    ctx.fillRect(player.x - 14, player.y - 12, 28, 30)

    if (ownsArmor('hazmat-suit')) {
      ctx.fillStyle = '#f3d84a'
      ctx.fillRect(player.x - 16, player.y - 13, 32, 32)
      ctx.fillStyle = '#1f5d3b'
      ctx.fillRect(player.x - 2, player.y - 13, 4, 32)
    }

    ctx.fillStyle = '#ffd1a4'
    ctx.beginPath()
    ctx.arc(player.x, player.y - 25, 13, 0, Math.PI * 2)
    ctx.fill()

    if (ownsArmor('hazmat-suit')) {
      ctx.strokeStyle = '#f3d84a'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(player.x, player.y - 25, 15, Math.PI * 0.9, Math.PI * 2.1)
      ctx.stroke()
    }

    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(player.x - 4, player.y - 27, 2.4, 0, Math.PI * 2)
    ctx.arc(player.x + 4, player.y - 27, 2.4, 0, Math.PI * 2)
    ctx.fill()

    if (ownsArmor('gas-mask')) {
      ctx.fillStyle = '#2a3330'
      ctx.beginPath()
      ctx.arc(player.x, player.y - 23, 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#9be57c'
      ctx.beginPath()
      ctx.arc(player.x - 4, player.y - 26, 3.2, 0, Math.PI * 2)
      ctx.arc(player.x + 4, player.y - 26, 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#111'
      ctx.fillRect(player.x - 4, player.y - 21, 8, 8)
    }

    ctx.fillStyle = '#fff'
    ctx.font = '14px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('YOU', player.x, player.y + 50)
    ctx.textAlign = 'left'
  }

  function drawBoss() {
    if (!boss) {
      return
    }

    const walk = reducedMotion ? 0 : Math.sin(gameTime * 0.18) * 10

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(boss.x - 15, boss.y + 55)
    ctx.lineTo(boss.x - 20 + walk, boss.y + 77)
    ctx.moveTo(boss.x + 15, boss.y + 55)
    ctx.lineTo(boss.x + 20 - walk, boss.y + 77)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(boss.x - 27, boss.y + 5)
    ctx.lineTo(boss.x - 48 - walk, boss.y + 30)
    ctx.moveTo(boss.x + 27, boss.y + 5)
    ctx.lineTo(boss.x + 48 + walk, boss.y + 30)
    ctx.stroke()

    ctx.fillStyle = '#a83280'
    ctx.fillRect(boss.x - 28, boss.y - 5, 56, 65)

    ctx.fillStyle = '#ffadad'
    ctx.beginPath()
    ctx.arc(boss.x, boss.y - 30, 25, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(boss.x - 9, boss.y - 34, 4, 0, Math.PI * 2)
    ctx.arc(boss.x + 9, boss.y - 34, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('BOSS', boss.x, boss.y + 96)

    ctx.fillStyle = '#222'
    ctx.fillRect(boss.x - 45, boss.y - 70, 90, 12)
    ctx.fillStyle = '#e63946'
    ctx.fillRect(boss.x - 45, boss.y - 70, 90 * boss.health / boss.maxHealth, 12)
    ctx.textAlign = 'left'
  }

  function drawFart(fart: FartCloud) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, fart.life / 45))
    ctx.fillStyle = fart.color

    for (let index = 0; index < 9; index += 1) {
      const angle = index * 0.7
      ctx.beginPath()
      ctx.arc(
        fart.x + Math.cos(angle) * fart.radius * 0.5,
        fart.y + Math.sin(angle) * fart.radius * 0.5,
        Math.max(8, fart.radius * 0.32),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }

    ctx.fillStyle = '#315c27'
    ctx.font = 'bold 16px Arial, sans-serif'
    ctx.fillText(fart.text, fart.x - 35, fart.y - fart.radius - 8)
    ctx.restore()
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(17, 24, 18, 0.82)'
    ctx.fillRect(12, 10, 340, 32)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 15px Arial, sans-serif'
    ctx.fillText(`Defeated: ${score}   Coins: ${progress.coins}   Wave: ${wave}`, 22, 31)

    ctx.fillStyle = '#222'
    ctx.fillRect(15, 50, 170, 18)
    ctx.fillStyle = '#e63946'
    ctx.fillRect(15, 50, 170 * player.health / 100, 18)
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(15, 50, 170, 18)
    ctx.fillStyle = '#fff'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillText(`Health: ${Math.ceil(player.health)}`, 22, 64)

    if (player.hasBossFart) {
      ctx.fillStyle = '#fff200'
      ctx.font = 'bold 16px Arial, sans-serif'
      ctx.fillText('BOSS FART POWER!', 205, 64)
    }
  }

  function drawShop(now: number) {
    if (!shopActive) {
      return
    }

    const secondsLeft = Math.max(0, Math.ceil((shopEndsAt - now) / 1_000))

    ctx.fillStyle = '#17211a'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = '#4d6937'
    ctx.fillRect(0, 350, GAME_WIDTH, 150)

    ctx.fillStyle = '#6a432b'
    ctx.fillRect(185, 105, 430, 255)
    ctx.fillStyle = '#43291d'
    ctx.beginPath()
    ctx.moveTo(150, 115)
    ctx.lineTo(400, 25)
    ctx.lineTo(650, 115)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffd76a'
    ctx.fillRect(225, 155, 105, 85)
    ctx.strokeStyle = '#3d281d'
    ctx.lineWidth = 6
    ctx.strokeRect(225, 155, 105, 85)
    ctx.beginPath()
    ctx.moveTo(277, 155)
    ctx.lineTo(277, 240)
    ctx.moveTo(225, 197)
    ctx.lineTo(330, 197)
    ctx.stroke()

    ctx.fillStyle = '#3a281c'
    ctx.fillRect(510, 175, 72, 185)
    ctx.fillStyle = '#d0a44d'
    ctx.beginPath()
    ctx.arc(566, 270, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#25331e'
    ctx.fillRect(315, 98, 170, 48)
    ctx.strokeStyle = '#d8be63'
    ctx.lineWidth = 3
    ctx.strokeRect(315, 98, 170, 48)
    ctx.fillStyle = '#f4e7a0'
    ctx.font = 'bold 24px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('GAS SHOP', 400, 130)

    ctx.fillStyle = '#5b3723'
    ctx.fillRect(190, 292, 420, 48)

    const keeperX = 400
    const keeperY = 250
    const keeperBob = reducedMotion ? 0 : Math.sin(gameTime * 0.08) * 2

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(keeperX - 6, keeperY + 26)
    ctx.lineTo(keeperX - 11, keeperY + 42)
    ctx.moveTo(keeperX + 6, keeperY + 26)
    ctx.lineTo(keeperX + 11, keeperY + 42)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(keeperX - 12, keeperY)
    ctx.lineTo(keeperX - 24, keeperY + 15)
    ctx.moveTo(keeperX + 12, keeperY)
    ctx.lineTo(keeperX + 24, keeperY + 15)
    ctx.stroke()

    ctx.fillStyle = '#2db64a'
    ctx.fillRect(keeperX - 14, keeperY - 7 + keeperBob, 28, 34)
    ctx.fillStyle = '#ffd1a4'
    ctx.beginPath()
    ctx.arc(keeperX, keeperY - 22 + keeperBob, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(keeperX - 4, keeperY - 24 + keeperBob, 2.3, 0, Math.PI * 2)
    ctx.arc(keeperX + 4, keeperY - 24 + keeperBob, 2.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px Arial, sans-serif'
    ctx.fillText('SHOPKEEPER', keeperX, keeperY + 58)
    ctx.font = 'bold 30px Arial, sans-serif'
    ctx.fillText('INTERMISSION SHOP', 400, 46)
    ctx.fillStyle = '#ffd84d'
    ctx.font = 'bold 20px Arial, sans-serif'
    ctx.fillText(`Next wave in ${secondsLeft}s`, 400, 73)
    ctx.fillStyle = '#fff'
    ctx.font = '16px Arial, sans-serif'
    ctx.fillText(
      `Coins: ${progress.coins}   •   Protection: ${Math.round(progress.damageReduction * 100)}%`,
      400,
      94,
    )

    ARMOR_ITEMS.forEach((item, index) => {
      const card = getShopCard(index)
      const owned = ownsArmor(item.id)
      const affordable = progress.coins >= SHOP_ITEM_COST

      ctx.fillStyle = owned ? '#20392a' : affordable ? '#243047' : '#2c2c2c'
      ctx.fillRect(card.x, card.y, card.width, card.height)
      ctx.strokeStyle = owned ? '#7cff9a' : '#777'
      ctx.lineWidth = 3
      ctx.strokeRect(card.x, card.y, card.width, card.height)

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 17px Arial, sans-serif'
      ctx.fillText(item.name, card.x + card.width / 2, card.y + 24)
      ctx.font = '13px Arial, sans-serif'
      ctx.fillText(item.description, card.x + card.width / 2, card.y + 45)
      ctx.fillStyle = owned ? '#7cff9a' : '#ffd84d'
      ctx.font = 'bold 15px Arial, sans-serif'
      ctx.fillText(owned ? 'EQUIPPED' : '500 COINS', card.x + card.width / 2, card.y + 68)
      ctx.fillStyle = '#c2c7d0'
      ctx.font = '12px Arial, sans-serif'
      ctx.fillText(`Tap or press ${index + 1}`, card.x + card.width / 2, card.y + 88)
    })

    if (shopMessage && now < shopMessageUntil) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px Arial, sans-serif'
      ctx.fillText(shopMessage, 400, 345)
    }

    ctx.textAlign = 'left'
  }

  function drawDeath(now: number) {
    if (!gameOver) {
      return
    }

    const deathElapsed = deathStartedAt === null ? 0 : now - deathStartedAt
    const gasProgress = Math.min(1, deathElapsed / 3_500)

    ctx.fillStyle = `rgba(72, 150, 55, ${0.18 + gasProgress * 0.52})`
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const cloudCount = reducedMotion ? 7 : 12
    for (let index = 0; index < cloudCount; index += 1) {
      const phase = deathElapsed * 0.001 + index * 0.7
      const drift = reducedMotion ? 0 : Math.sin(phase) * 45
      const cx = (index * 83 + drift) % (GAME_WIDTH + 120) - 60
      const cy = 60 + ((index * 47) % 390)
      const radius = 28 + gasProgress * 75 + (index % 3) * 12

      ctx.fillStyle = `rgba(145, 210, 75, ${0.12 + gasProgress * 0.22})`
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx + radius * 0.6, cy + 10, radius * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx - radius * 0.55, cy - 5, radius * 0.75, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 + gasProgress * 0.35})`
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#dfff74'
    ctx.font = 'bold 52px Arial, sans-serif'
    ctx.fillText('GASSED OUT', GAME_WIDTH / 2, 220)
    ctx.fillStyle = '#fff'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText(`You reached wave ${wave}`, GAME_WIDTH / 2, 265)
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillText('Press R or tap Restart', GAME_WIDTH / 2, 310)
    ctx.textAlign = 'left'
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = '#78b84b'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = '#6cab42'
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      ctx.fillRect(x, 0, 20, GAME_HEIGHT)
    }

    for (const puddle of bloodPuddles) {
      ctx.fillStyle = '#8f1020'
      ctx.globalAlpha = 0.75
      ctx.beginPath()
      ctx.ellipse(puddle.x, puddle.y + 10, puddle.size, puddle.size * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    people.forEach(drawPerson)

    for (const particle of particles) {
      ctx.globalAlpha = particle.life / 35
      ctx.fillStyle = '#b51225'
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    drawBoss()
    drawPlayer()
    enemyFarts.forEach(drawFart)
    playerFarts.forEach(drawFart)
    drawHud()

    if (messageTimer > 0 && !gameOver && !shopActive) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 28px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(boss ? 'BOSS BATTLE!' : `WAVE ${wave}`, GAME_WIDTH / 2, 450)
      ctx.textAlign = 'left'
    }

    drawShop(now)
    drawDeath(now)
  }

  function resetGame() {
    score = 0
    wave = 1
    gameOver = false
    messageTimer = 100
    gameTime = 0
    deathStartedAt = null
    player = createPlayer()
    progress = createInitialProgress()
    people = []
    boss = null
    playerFarts = []
    enemyFarts = []
    bloodPuddles = []
    particles = []
    shopActive = false
    shopEndsAt = 0
    shopMessage = ''
    shopMessageUntil = 0
    clearMovement()
    createWave()
    lastFrameAt = performance.now()
  }

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase()
    const directionByKey: Partial<Record<string, MovementDirection>> = {
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
    }
    const direction = directionByKey[key]

    if (direction || ['f', 'r', '1', '2', '3'].includes(key)) {
      event.preventDefault()
    }

    if (direction) {
      movement[direction] = true
      return
    }

    if (event.repeat) {
      return
    }

    if (key === 'f') {
      playerFart()
    } else if (key === 'r') {
      resetGame()
    } else if (shopActive && ['1', '2', '3'].includes(key)) {
      buyShopItem(Number(key) - 1, performance.now())
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    const directionByKey: Partial<Record<string, MovementDirection>> = {
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
    }
    const direction = directionByKey[event.key.toLowerCase()]
    if (direction) {
      movement[direction] = false
    }
  }

  function handleCanvasPointerDown(event: PointerEvent) {
    if (!shopActive) {
      return
    }

    event.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * GAME_WIDTH / rect.width
    const y = (event.clientY - rect.top) * GAME_HEIGHT / rect.height

    ARMOR_ITEMS.forEach((_, index) => {
      const card = getShopCard(index)
      if (
        x >= card.x &&
        x <= card.x + card.width &&
        y >= card.y &&
        y <= card.y + card.height
      ) {
        buyShopItem(index, performance.now())
      }
    })
  }

  function gameLoop(now: number) {
    if (destroyed) {
      return
    }

    const frameScale = Math.max(0, Math.min(2, (now - lastFrameAt) / (1_000 / 60)))
    lastFrameAt = now
    update(frameScale, now)
    draw(now)
    animationFrame = requestAnimationFrame(gameLoop)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', clearMovement)
  canvas.addEventListener('pointerdown', handleCanvasPointerDown)

  resetGame()
  draw(performance.now())
  animationFrame = requestAnimationFrame(gameLoop)

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearMovement)
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown)
      clearMovement()
    },
    fart: playerFart,
    restart: resetGame,
    setMovement(direction, active) {
      movement[direction] = active
    },
  }
}
