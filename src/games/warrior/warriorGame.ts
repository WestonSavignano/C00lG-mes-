type Player = {
  x: number
  y: number
  speed: number
  hp: number
  facing: 1 | -1
  attackTimer: number
  attackCooldown: number
  invuln: number
  isMoving: boolean
  walkCycle: number
}

type Monster = {
  id: string
  x: number
  y: number
  r: number
  speed: number
  hp: number
  maxHp: number
  hitCooldown: number
  knockbackX: number
  knockbackY: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

type ThrownCleaver = {
  active: boolean
  returning: boolean
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  distance: number
  maxDistance: number
  hitIds: Set<string>
}

type BananaBoss = {
  active: boolean
  triggerScore: number | null
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  hitCooldown: number
  knockbackX: number
  knockbackY: number
}

type Andrewsous = {
  active: boolean
  spawned: boolean
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  hitCooldown: number
  knockbackX: number
  knockbackY: number
}

export type WarriorGameController = {
  destroy: () => void
  restart: () => void
}

export function createWarriorGame(
  canvas: HTMLCanvasElement,
): WarriorGameController {
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Warrior requires a 2D canvas context')
  }

  const ctx: CanvasRenderingContext2D = context

  canvas.width = 1000
  canvas.height = 650

  let destroyed = false
  let animationFrameId = 0

  const keys: Record<string, boolean> = {}

  let gameOver = false
  let gameWon = false
  let score = 0
  let frame = 0

  function rand(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  const player: Player = {
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

  let monsters: Monster[] = []
  let particles: Particle[] = []

  const thrownCleaver: ThrownCleaver = {
    active: false,
    returning: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    distance: 0,
    maxDistance: 430,
    hitIds: new Set(),
  }

  const bananaMilestones = [100, 200, 300, 400, 500, 600, 700, 800]
  let completedBananaMilestones = new Set<number>()

  const bananaBoss: BananaBoss = {
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

  const andrewsous: Andrewsous = {
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

  function spawnMonster() {
    monsters.push({
      id: `dark-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

  for (let i = 0; i < 5; i += 1) {
    spawnMonster()
  }

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
    thrownCleaver.x = 0
    thrownCleaver.y = 0
    thrownCleaver.vx = 0
    thrownCleaver.vy = 0
    thrownCleaver.angle = 0
    thrownCleaver.distance = 0
    thrownCleaver.hitIds = new Set()

    completedBananaMilestones = new Set()

    bananaBoss.active = false
    bananaBoss.triggerScore = null
    bananaBoss.x = 0
    bananaBoss.y = 0
    bananaBoss.hp = 10
    bananaBoss.hitCooldown = 0
    bananaBoss.knockbackX = 0
    bananaBoss.knockbackY = 0

    andrewsous.active = false
    andrewsous.spawned = false
    andrewsous.x = 0
    andrewsous.y = 0
    andrewsous.hp = 20
    andrewsous.hitCooldown = 0
    andrewsous.knockbackX = 0
    andrewsous.knockbackY = 0

    for (let i = 0; i < 5; i += 1) {
      spawnMonster()
    }
  }

  function getCleaverHitbox() {
    if (player.attackTimer <= 7) {
      return null
    }

    if (player.facing === 1) {
      return {
        x: player.x + 5,
        y: player.y - 48,
        w: 70,
        h: 72,
      }
    }

    return {
      x: player.x - 75,
      y: player.y - 48,
      w: 70,
      h: 72,
    }
  }

  function createImpactParticles(x: number, y: number) {
    for (let i = 0; i < 12; i += 1) {
      particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-3, 3),
        life: 22,
        color: Math.random() > 0.5 ? '#111' : '#555',
      })
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
    if (!thrownCleaver.active) {
      return
    }

    thrownCleaver.angle += 0.42

    if (!thrownCleaver.returning) {
      thrownCleaver.x += thrownCleaver.vx
      thrownCleaver.y += thrownCleaver.vy

      thrownCleaver.distance += Math.hypot(
        thrownCleaver.vx,
        thrownCleaver.vy,
      )

      if (
        thrownCleaver.distance >= thrownCleaver.maxDistance ||
        thrownCleaver.x < 20 ||
        thrownCleaver.x > canvas.width - 20
      ) {
        thrownCleaver.returning = true
      }
    } else {
      const dx = player.x - thrownCleaver.x
      const dy = player.y - 10 - thrownCleaver.y
      const distance = Math.hypot(dx, dy)

      if (distance < 24) {
        thrownCleaver.active = false
        thrownCleaver.returning = false
        return
      }

      thrownCleaver.x += (dx / distance) * 11
      thrownCleaver.y += (dy / distance) * 11
    }

    if (
      bananaBoss.active &&
      bananaBoss.hitCooldown <= 0 &&
      Math.hypot(
        thrownCleaver.x - bananaBoss.x,
        thrownCleaver.y - bananaBoss.y,
      ) < 62
    ) {
      hitBananaBoss(
        thrownCleaver.x,
        thrownCleaver.y,
        14,
      )
    }

    if (
      andrewsous.active &&
      andrewsous.hitCooldown <= 0 &&
      Math.hypot(
        thrownCleaver.x - andrewsous.x,
        thrownCleaver.y - andrewsous.y,
      ) < 82
    ) {
      hitAndrewsous(
        thrownCleaver.x,
        thrownCleaver.y,
        12,
      )
    }

    for (const monster of monsters) {
      if (thrownCleaver.hitIds.has(monster.id)) {
        continue
      }

      const distance = Math.hypot(
        thrownCleaver.x - monster.x,
        thrownCleaver.y - monster.y,
      )

      if (distance < monster.r + 28) {
        thrownCleaver.hitIds.add(monster.id)

        monster.hp -= 1
        monster.hitCooldown = 18

        const knockAngle = Math.atan2(
          monster.y - thrownCleaver.y,
          monster.x - thrownCleaver.x,
        )

        const knockStrength = 11

        monster.knockbackX =
          Math.cos(knockAngle) * knockStrength

        monster.knockbackY =
          Math.sin(knockAngle) * knockStrength

        createImpactParticles(monster.x, monster.y)
      }
    }
  }

  function getNextBananaMilestone() {
    return bananaMilestones.find(
      (milestone) =>
        score >= milestone &&
        !completedBananaMilestones.has(milestone),
    )
  }

  function spawnBananaBoss(triggerScore: number) {
    if (
      bananaBoss.active ||
      andrewsous.active ||
      gameWon
    ) {
      return
    }

    completedBananaMilestones.add(triggerScore)

    bananaBoss.active = true
    bananaBoss.triggerScore = triggerScore
    bananaBoss.hp = bananaBoss.maxHp
    bananaBoss.x = canvas.width - 130
    bananaBoss.y = canvas.height / 2 + 50
    bananaBoss.hitCooldown = 0
    bananaBoss.knockbackX = 0
    bananaBoss.knockbackY = 0
  }

  function hitBananaBoss(
    hitX: number,
    hitY: number,
    knockStrength = 12,
  ) {
    if (
      !bananaBoss.active ||
      bananaBoss.hitCooldown > 0
    ) {
      return
    }

    bananaBoss.hp -= 1
    bananaBoss.hitCooldown = 18

    const knockAngle = Math.atan2(
      bananaBoss.y - hitY,
      bananaBoss.x - hitX,
    )

    bananaBoss.knockbackX =
      Math.cos(knockAngle) * knockStrength

    bananaBoss.knockbackY =
      Math.sin(knockAngle) * knockStrength

    createImpactParticles(
      bananaBoss.x,
      bananaBoss.y,
    )

    if (bananaBoss.hp <= 0) {
      bananaBoss.active = false

      // Every infected banana is worth
      // 100 Dark Matter defeated.
      score += 100

      for (let i = 0; i < 5; i += 1) {
        createImpactParticles(
          bananaBoss.x + rand(-35, 35),
          bananaBoss.y + rand(-45, 45),
        )
      }
    }
  }

  function updateBananaBoss() {
    if (!bananaBoss.active) {
      return
    }

    if (bananaBoss.hitCooldown > 0) {
      bananaBoss.hitCooldown -= 1
    }

    bananaBoss.x += bananaBoss.knockbackX
    bananaBoss.y += bananaBoss.knockbackY

    bananaBoss.knockbackX *= 0.84
    bananaBoss.knockbackY *= 0.84

    const dx = player.x - bananaBoss.x
    const dy = player.y - bananaBoss.y
    const distance = Math.max(
      1,
      Math.hypot(dx, dy),
    )

    if (
      Math.abs(bananaBoss.knockbackX) < 0.9 &&
      Math.abs(bananaBoss.knockbackY) < 0.9
    ) {
      bananaBoss.x +=
        (dx / distance) * bananaBoss.speed

      bananaBoss.y +=
        (dy / distance) * bananaBoss.speed
    }

    bananaBoss.x = Math.max(
      70,
      Math.min(
        canvas.width - 70,
        bananaBoss.x,
      ),
    )

    bananaBoss.y = Math.max(
      215,
      Math.min(
        canvas.height - 75,
        bananaBoss.y,
      ),
    )

    const cleaverHitbox = getCleaverHitbox()

    if (
      cleaverHitbox &&
      bananaBoss.hitCooldown <= 0
    ) {
      const closestX = Math.max(
        cleaverHitbox.x,
        Math.min(
          bananaBoss.x,
          cleaverHitbox.x + cleaverHitbox.w,
        ),
      )

      const closestY = Math.max(
        cleaverHitbox.y,
        Math.min(
          bananaBoss.y,
          cleaverHitbox.y + cleaverHitbox.h,
        ),
      )

      if (
        Math.hypot(
          bananaBoss.x - closestX,
          bananaBoss.y - closestY,
        ) < 54
      ) {
        hitBananaBoss(
          player.x,
          player.y,
          13,
        )
      }
    }

    const playerDistance = Math.hypot(
      player.x - bananaBoss.x,
      player.y - bananaBoss.y,
    )

    if (
      playerDistance < 58 &&
      player.invuln <= 0 &&
      Math.abs(bananaBoss.knockbackX) < 1.5 &&
      Math.abs(bananaBoss.knockbackY) < 1.5
    ) {
      player.hp -= 1
      player.invuln = 55

      if (player.hp <= 0) {
        gameOver = true
      }
    }
  }

  function spawnAndrewsous() {
    if (
      andrewsous.spawned ||
      andrewsous.active ||
      gameWon
    ) {
      return
    }

    andrewsous.spawned = true
    andrewsous.active = true
    andrewsous.hp = andrewsous.maxHp
    andrewsous.x = canvas.width - 150
    andrewsous.y = canvas.height / 2 + 50
    andrewsous.hitCooldown = 0
    andrewsous.knockbackX = 0
    andrewsous.knockbackY = 0
  }

  function hitAndrewsous(
    hitX: number,
    hitY: number,
    knockStrength = 10,
  ) {
    if (
      !andrewsous.active ||
      andrewsous.hitCooldown > 0
    ) {
      return
    }

    andrewsous.hp -= 1
    andrewsous.hitCooldown = 16

    const knockAngle = Math.atan2(
      andrewsous.y - hitY,
      andrewsous.x - hitX,
    )

    andrewsous.knockbackX =
      Math.cos(knockAngle) * knockStrength

    andrewsous.knockbackY =
      Math.sin(knockAngle) * knockStrength

    createImpactParticles(
      andrewsous.x,
      andrewsous.y,
    )

    if (andrewsous.hp <= 0) {
      andrewsous.active = false

      // Andrewsous supplies the final 100 points.
      score += 100
    }
  }

  function updateAndrewsous() {
    if (!andrewsous.active) {
      return
    }

    if (andrewsous.hitCooldown > 0) {
      andrewsous.hitCooldown -= 1
    }

    andrewsous.x += andrewsous.knockbackX
    andrewsous.y += andrewsous.knockbackY

    andrewsous.knockbackX *= 0.86
    andrewsous.knockbackY *= 0.86

    const dx = player.x - andrewsous.x
    const dy = player.y - andrewsous.y
    const distance = Math.max(
      1,
      Math.hypot(dx, dy),
    )

    if (
      Math.abs(andrewsous.knockbackX) < 0.8 &&
      Math.abs(andrewsous.knockbackY) < 0.8
    ) {
      andrewsous.x +=
        (dx / distance) * andrewsous.speed

      andrewsous.y +=
        (dy / distance) * andrewsous.speed
    }

    andrewsous.x = Math.max(
      95,
      Math.min(
        canvas.width - 95,
        andrewsous.x,
      ),
    )

    andrewsous.y = Math.max(
      220,
      Math.min(
        canvas.height - 90,
        andrewsous.y,
      ),
    )

    const cleaverHitbox = getCleaverHitbox()

    if (
      cleaverHitbox &&
      andrewsous.hitCooldown <= 0
    ) {
      const closestX = Math.max(
        cleaverHitbox.x,
        Math.min(
          andrewsous.x,
          cleaverHitbox.x + cleaverHitbox.w,
        ),
      )

      const closestY = Math.max(
        cleaverHitbox.y,
        Math.min(
          andrewsous.y,
          cleaverHitbox.y + cleaverHitbox.h,
        ),
      )

      if (
        Math.hypot(
          andrewsous.x - closestX,
          andrewsous.y - closestY,
        ) < 76
      ) {
        hitAndrewsous(
          player.x,
          player.y,
          11,
        )
      }
    }

    const playerDistance = Math.hypot(
      player.x - andrewsous.x,
      player.y - andrewsous.y,
    )

    if (
      playerDistance < 74 &&
      player.invuln <= 0 &&
      Math.abs(andrewsous.knockbackX) < 1.5 &&
      Math.abs(andrewsous.knockbackY) < 1.5
    ) {
      player.hp -= 1
      player.invuln = 55

      if (player.hp <= 0) {
        gameOver = true
      }
    }
  }

  function update() {
    if (gameOver || gameWon) {
      return
    }

    frame += 1

    let dx = 0
    let dy = 0

    if (keys.arrowleft || keys.a) {
      dx -= 1
    }

    if (keys.arrowright || keys.d) {
      dx += 1
    }

    if (keys.arrowup || keys.w) {
      dy -= 1
    }

    if (keys.arrowdown || keys.s) {
      dy += 1
    }

    player.isMoving =
      dx !== 0 || dy !== 0

    if (player.isMoving) {
      const length = Math.hypot(dx, dy)

      dx /= length
      dy /= length

      player.x += dx * player.speed
      player.y += dy * player.speed

      if (dx < 0) {
        player.facing = -1
      }

      if (dx > 0) {
        player.facing = 1
      }

      player.walkCycle += 0.24
    } else {
      player.walkCycle *= 0.85
    }

    player.x = Math.max(
      40,
      Math.min(
        canvas.width - 40,
        player.x,
      ),
    )

    player.y = Math.max(
      180,
      Math.min(
        canvas.height - 70,
        player.y,
      ),
    )

    if (player.attackCooldown > 0) {
      player.attackCooldown -= 1
    }

    if (
      keys.space &&
      player.attackCooldown <= 0 &&
      !thrownCleaver.active
    ) {
      player.attackTimer = 20
      player.attackCooldown = 24
    }

    if (player.attackTimer > 0) {
      player.attackTimer -= 1
    }

    if (player.invuln > 0) {
      player.invuln -= 1
    }

    const nextBananaMilestone =
      getNextBananaMilestone()

    if (
      nextBananaMilestone !== undefined &&
      !bananaBoss.active &&
      !andrewsous.active &&
      score < 900
    ) {
      spawnBananaBoss(
        nextBananaMilestone,
      )
    }

    if (
      score >= 900 &&
      !andrewsous.spawned &&
      !bananaBoss.active
    ) {
      spawnAndrewsous()
    }

    if (score >= 1000) {
      gameWon = true
    }

    updateThrownCleaver()
    updateBananaBoss()
    updateAndrewsous()

    if (score >= 1000) {
      gameWon = true
    }

    const cleaverHitbox =
      getCleaverHitbox()

    monsters.forEach((monster) => {
      if (monster.hitCooldown > 0) {
        monster.hitCooldown -= 1
      }

      monster.x += monster.knockbackX
      monster.y += monster.knockbackY

      monster.knockbackX *= 0.82
      monster.knockbackY *= 0.82

      const angle = Math.atan2(
        player.y - monster.y,
        player.x - monster.x,
      )

      if (
        Math.abs(monster.knockbackX) < 0.8 &&
        Math.abs(monster.knockbackY) < 0.8
      ) {
        monster.x +=
          Math.cos(angle) * monster.speed

        monster.y +=
          Math.sin(angle) * monster.speed
      }

      monster.x = Math.max(
        monster.r,
        Math.min(
          canvas.width - monster.r,
          monster.x,
        ),
      )

      monster.y = Math.max(
        185,
        Math.min(
          canvas.height - 45,
          monster.y,
        ),
      )

      if (
        cleaverHitbox &&
        monster.hitCooldown <= 0
      ) {
        const closestX = Math.max(
          cleaverHitbox.x,
          Math.min(
            monster.x,
            cleaverHitbox.x +
              cleaverHitbox.w,
          ),
        )

        const closestY = Math.max(
          cleaverHitbox.y,
          Math.min(
            monster.y,
            cleaverHitbox.y +
              cleaverHitbox.h,
          ),
        )

        const hitDistance = Math.hypot(
          monster.x - closestX,
          monster.y - closestY,
        )

        if (hitDistance < monster.r) {
          monster.hp -= 1
          monster.hitCooldown = 18

          const knockAngle = Math.atan2(
            monster.y - player.y,
            monster.x - player.x,
          )

          const knockStrength = 9

          monster.knockbackX =
            Math.cos(knockAngle) *
            knockStrength

          monster.knockbackY =
            Math.sin(knockAngle) *
            knockStrength

          createImpactParticles(
            monster.x,
            monster.y,
          )
        }
      }

      const playerDistance = Math.hypot(
        player.x - monster.x,
        player.y - monster.y,
      )

      if (
        playerDistance < monster.r + 14 &&
        player.invuln <= 0 &&
        Math.abs(monster.knockbackX) < 1.5 &&
        Math.abs(monster.knockbackY) < 1.5
      ) {
        player.hp -= 1
        player.invuln = 50

        if (player.hp <= 0) {
          gameOver = true
        }
      }
    })

    for (
      let i = monsters.length - 1;
      i >= 0;
      i -= 1
    ) {
      if (monsters[i].hp <= 0) {
        score += 1

        createImpactParticles(
          monsters[i].x,
          monsters[i].y,
        )

        createImpactParticles(
          monsters[i].x,
          monsters[i].y,
        )

        monsters.splice(i, 1)

        spawnMonster()
      }
    }

    particles.forEach(
      (particle, index) => {
        particle.x += particle.vx
        particle.y += particle.vy

        particle.vx *= 0.94
        particle.vy *= 0.94

        particle.life -= 1

        if (particle.life <= 0) {
          particles.splice(index, 1)
        }
      },
    )

    if (
      frame % 320 === 0 &&
      monsters.length < 7
    ) {
      spawnMonster()
    }
  }

  function drawPaperBackground() {
    ctx.fillStyle = '#fffdf7'

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    )

    ctx.strokeStyle =
      'rgba(120,170,255,0.25)'

    ctx.lineWidth = 1

    for (
      let y = 40;
      y < canvas.height;
      y += 28
    ) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    ctx.strokeStyle =
      'rgba(255,80,80,0.25)'

    ctx.beginPath()
    ctx.moveTo(80, 0)
    ctx.lineTo(80, canvas.height)
    ctx.stroke()

    drawCloud(180, 90, 55)
    drawCloud(420, 120, 45)
    drawCloud(770, 80, 60)
  }

  function drawCloud(
    x: number,
    y: number,
    size: number,
  ) {
    ctx.save()

    for (
      let pass = 0;
      pass < 5;
      pass += 1
    ) {
      ctx.strokeStyle =
        `rgba(75,135,235,${
          0.16 + pass * 0.05
        })`

      ctx.lineWidth = 1.5
      ctx.beginPath()

      for (
        let i = 0;
        i <= 34;
        i += 1
      ) {
        const angle =
          (i / 34) * Math.PI * 2

        const rough =
          rand(-3.5, 3.5)

        const px =
          x +
          Math.cos(angle) *
            (size + rough) +
          Math.sin(angle * 3) *
            size *
            0.12

        const py =
          y +
          Math.sin(angle) *
            (size * 0.45 + rough) +
          Math.sin(angle * 2) *
            size *
            0.08

        if (i === 0) {
          ctx.moveTo(px, py)
        } else {
          ctx.lineTo(px, py)
        }
      }

      ctx.closePath()
      ctx.stroke()
    }

    ctx.restore()
  }

  function drawPath() {
    ctx.save()

    ctx.fillStyle = '#d8b07a'

    ctx.beginPath()
    ctx.moveTo(0, 240)

    ctx.quadraticCurveTo(
      250,
      180,
      500,
      260,
    )

    ctx.quadraticCurveTo(
      760,
      340,
      1000,
      280,
    )

    ctx.lineTo(1000, 560)

    ctx.quadraticCurveTo(
      760,
      620,
      500,
      540,
    )

    ctx.quadraticCurveTo(
      240,
      470,
      0,
      560,
    )

    ctx.closePath()
    ctx.fill()

    for (
      let i = 0;
      i < 400;
      i += 1
    ) {
      const x =
        rand(0, canvas.width)

      const y =
        rand(230, 570)

      ctx.strokeStyle =
        `rgba(145,100,55,${
          rand(0.12, 0.3)
        })`

      ctx.lineWidth =
        rand(0.7, 1.6)

      ctx.beginPath()

      ctx.moveTo(
        x,
        y,
      )

      ctx.lineTo(
        x + rand(7, 25),
        y + rand(-5, 5),
      )

      ctx.stroke()
    }

    ctx.restore()

    drawGrassPatch(
      90,
      220,
      120,
      55,
    )

    drawGrassPatch(
      825,
      220,
      125,
      50,
    )

    drawGrassPatch(
      720,
      550,
      145,
      55,
    )

    drawGrassPatch(
      205,
      565,
      125,
      45,
    )
  }

  function drawGrassPatch(
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    ctx.save()

    ctx.fillStyle =
      'rgba(137,188,91,0.58)'

    ctx.beginPath()

    ctx.ellipse(
      x,
      y,
      width,
      height,
      0,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    for (
      let i = 0;
      i < 110;
      i += 1
    ) {
      const grassX =
        x -
        width +
        Math.random() *
          width *
          2

      const grassY =
        y -
        height / 2 +
        Math.random() *
          height

      ctx.strokeStyle =
        `rgba(54,115,42,${
          rand(0.18, 0.5)
        })`

      ctx.lineWidth =
        rand(0.8, 1.4)

      ctx.beginPath()

      ctx.moveTo(
        grassX,
        grassY,
      )

      ctx.lineTo(
        grassX + rand(-3, 3),
        grassY - rand(5, 15),
      )

      ctx.stroke()
    }

    ctx.restore()
  }

  function drawThrownCleaver() {
    if (!thrownCleaver.active) {
      return
    }

    ctx.save()

    ctx.translate(
      thrownCleaver.x,
      thrownCleaver.y,
    )

    ctx.rotate(
      thrownCleaver.angle,
    )

    ctx.fillStyle = '#070707'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.moveTo(-6, -12)
    ctx.lineTo(34, -20)
    ctx.lineTo(47, -10)
    ctx.lineTo(43, 14)
    ctx.lineTo(-1, 17)
    ctx.lineTo(-10, 6)
    ctx.closePath()

    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = '#151515'
    ctx.lineWidth = 6

    ctx.beginPath()
    ctx.moveTo(-15, 0)
    ctx.lineTo(-2, 0)
    ctx.stroke()

    ctx.strokeStyle =
      'rgba(160,160,160,0.5)'

    ctx.lineWidth = 1.5

    ctx.beginPath()
    ctx.moveTo(4, -4)
    ctx.lineTo(34, -11)
    ctx.stroke()

    ctx.restore()
  }

  function drawPlayer() {
    ctx.save()

    if (
      player.invuln > 0 &&
      Math.floor(
        player.invuln / 4,
      ) %
        2 ===
        0
    ) {
      ctx.globalAlpha = 0.48
    }

    const x = player.x
    const y = player.y

    ctx.strokeStyle = '#222'
    ctx.fillStyle = '#222'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'

    // Filled-in stick-guy head.
    ctx.beginPath()

    ctx.arc(
      x,
      y - 34,
      11,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    // Body.
    ctx.beginPath()
    ctx.moveTo(x, y - 23)
    ctx.lineTo(x, y + 8)
    ctx.stroke()

    // Moving legs.
    const legSwing =
      player.isMoving
        ? Math.sin(
            player.walkCycle,
          ) * 9
        : 0

    ctx.beginPath()

    ctx.moveTo(
      x,
      y + 8,
    )

    ctx.lineTo(
      x - 9 + legSwing,
      y + 29,
    )

    ctx.moveTo(
      x,
      y + 8,
    )

    ctx.lineTo(
      x + 9 - legSwing,
      y + 29,
    )

    ctx.stroke()

    // Back arm.
    ctx.beginPath()

    ctx.moveTo(
      x,
      y - 10,
    )

    ctx.lineTo(
      x -
        12 *
          player.facing,
      y + 2,
    )

    ctx.stroke()

    const handX =
      x +
      13 *
        player.facing

    const handY =
      y - 9

    // Cleaver arm.
    ctx.beginPath()

    ctx.moveTo(
      x,
      y - 10,
    )

    ctx.lineTo(
      handX,
      handY,
    )

    ctx.stroke()

    let cleaverAngle: number

    if (
      player.attackTimer > 0
    ) {
      const progress =
        1 -
        player.attackTimer /
          20

      const swing =
        -1.1 +
        progress *
          2.2

      cleaverAngle =
        player.facing === 1
          ? swing
          : Math.PI - swing
    } else {
      cleaverAngle =
        player.facing === 1
          ? -0.55
          : Math.PI + 0.55
    }

    if (
      !thrownCleaver.active
    ) {
      drawBlackCleaver(
        handX,
        handY,
        cleaverAngle,
      )
    }

    ctx.restore()
  }

  function drawBlackCleaver(
    handX: number,
    handY: number,
    angle: number,
  ) {
    ctx.save()

    ctx.translate(
      handX,
      handY,
    )

    ctx.rotate(angle)

    // Handle.
    ctx.strokeStyle = '#151515'
    ctx.lineWidth = 5

    ctx.beginPath()
    ctx.moveTo(-12, 0)
    ctx.lineTo(10, 0)
    ctx.stroke()

    // Guard.
    ctx.strokeStyle = '#050505'
    ctx.lineWidth = 6

    ctx.beginPath()
    ctx.moveTo(6, -9)
    ctx.lineTo(6, 9)
    ctx.stroke()

    // Black blade.
    ctx.fillStyle = '#070707'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.moveTo(8, -7)
    ctx.lineTo(53, -16)
    ctx.lineTo(66, -8)
    ctx.lineTo(63, 11)
    ctx.lineTo(15, 14)
    ctx.lineTo(8, 6)
    ctx.closePath()

    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle =
      'rgba(150,150,150,0.55)'

    ctx.lineWidth = 1.4

    ctx.beginPath()
    ctx.moveTo(17, -3)
    ctx.lineTo(55, -9)
    ctx.stroke()

    ctx.restore()
  }

  function drawBananaBoss() {
    if (!bananaBoss.active) {
      return
    }

    ctx.save()

    const x = bananaBoss.x
    const y = bananaBoss.y

    ctx.textAlign = 'center'
    ctx.font =
      'bold 18px Arial'

    ctx.fillStyle = '#111'

    ctx.fillText(
      'INFECTED BANANA',
      x,
      y - 92,
    )

    const barWidth = 140
    const barHeight = 10
    const barX =
      x - barWidth / 2
    const barY = y - 78

    ctx.fillStyle =
      'rgba(0,0,0,0.25)'

    ctx.fillRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.fillStyle = '#22c55e'

    ctx.fillRect(
      barX,
      barY,
      barWidth *
        Math.max(
          0,
          bananaBoss.hp /
            bananaBoss.maxHp,
        ),
      barHeight,
    )

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2

    ctx.strokeRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.font =
      'bold 12px Arial'

    ctx.fillStyle = '#111'

    ctx.fillText(
      `${bananaBoss.hp} / ${bananaBoss.maxHp}`,
      x,
      barY + 9,
    )

    // Three black Dark Matter legs.
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'

    for (
      let i = -1;
      i <= 1;
      i += 1
    ) {
      ctx.beginPath()

      ctx.moveTo(
        x + i * 24,
        y + 40,
      )

      ctx.lineTo(
        x + i * 30,
        y + 72,
      )

      ctx.stroke()
    }

    ctx.save()

    ctx.translate(x, y)
    ctx.rotate(-0.28)

    ctx.fillStyle =
      bananaBoss.hitCooldown >
      10
        ? '#facc15'
        : '#f7d33f'

    ctx.strokeStyle = '#8a6a12'
    ctx.lineWidth = 4

    ctx.beginPath()

    ctx.moveTo(
      -58,
      -18,
    )

    ctx.bezierCurveTo(
      -42,
      -62,
      34,
      -64,
      62,
      -10,
    )

    ctx.bezierCurveTo(
      37,
      34,
      -17,
      46,
      -54,
      22,
    )

    ctx.bezierCurveTo(
      -68,
      12,
      -69,
      -3,
      -58,
      -18,
    )

    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Banana tips.
    ctx.fillStyle = '#654c11'

    ctx.beginPath()

    ctx.ellipse(
      -58,
      1,
      8,
      14,
      -0.25,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.beginPath()

    ctx.ellipse(
      59,
      -8,
      7,
      13,
      0.2,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    const spots = [
      [-20, -20, 11],
      [9, -31, 8],
      [28, -8, 12],
      [-2, 17, 9],
      [-36, 8, 7],
    ]

    for (
      const [
        spotX,
        spotY,
        spotRadius,
      ] of spots
    ) {
      ctx.fillStyle = '#080808'

      ctx.beginPath()

      ctx.arc(
        spotX,
        spotY,
        spotRadius,
        0,
        Math.PI * 2,
      )

      ctx.fill()
    }

    // Dark Matter-style eyes.
    ctx.fillStyle = '#fff'

    ctx.beginPath()

    ctx.arc(
      -10,
      -8,
      9,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      15,
      -10,
      9,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.fillStyle = '#050505'

    ctx.beginPath()

    ctx.arc(
      -7,
      -5,
      4,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      12,
      -7,
      4,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.restore()
    ctx.restore()
  }

  function drawAndrewsous() {
    if (!andrewsous.active) {
      return
    }

    ctx.save()

    const x = andrewsous.x
    const y = andrewsous.y

    ctx.textAlign = 'center'

    ctx.font =
      'bold 20px Arial'

    ctx.fillStyle = '#111'

    ctx.fillText(
      'ANDREWSOUS',
      x,
      y - 112,
    )

    const barWidth = 180
    const barHeight = 12
    const barX =
      x - barWidth / 2
    const barY = y - 96

    ctx.fillStyle =
      'rgba(0,0,0,0.25)'

    ctx.fillRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.fillStyle = '#22c55e'

    ctx.fillRect(
      barX,
      barY,
      barWidth *
        Math.max(
          0,
          andrewsous.hp /
            andrewsous.maxHp,
        ),
      barHeight,
    )

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2

    ctx.strokeRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.fillStyle =
      andrewsous.hitCooldown >
      9
        ? '#4b5563'
        : '#596b4d'

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 4

    // Tail and body.
    ctx.beginPath()

    ctx.moveTo(
      x - 15,
      y + 15,
    )

    ctx.lineTo(
      x - 105,
      y + 48,
    )

    ctx.lineTo(
      x - 55,
      y + 3,
    )

    ctx.quadraticCurveTo(
      x - 15,
      y - 45,
      x + 48,
      y - 20,
    )

    ctx.lineTo(
      x + 62,
      y + 22,
    )

    ctx.quadraticCurveTo(
      x + 10,
      y + 48,
      x - 15,
      y + 15,
    )

    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Big T-Rex head.
    ctx.beginPath()

    ctx.ellipse(
      x + 55,
      y - 35,
      48,
      32,
      -0.1,
      0,
      Math.PI * 2,
    )

    ctx.fill()
    ctx.stroke()

    // Snout.
    ctx.beginPath()

    ctx.roundRect(
      x + 54,
      y - 38,
      62,
      31,
      10,
    )

    ctx.fill()
    ctx.stroke()

    // Powerful hind legs.
    ctx.lineWidth = 10
    ctx.beginPath()

    ctx.moveTo(
      x - 12,
      y + 30,
    )

    ctx.lineTo(
      x - 24,
      y + 80,
    )

    ctx.lineTo(
      x - 49,
      y + 86,
    )

    ctx.moveTo(
      x + 23,
      y + 28,
    )

    ctx.lineTo(
      x + 34,
      y + 80,
    )

    ctx.lineTo(
      x + 58,
      y + 84,
    )

    ctx.stroke()

    // Tiny T-Rex arms.
    ctx.lineWidth = 5
    ctx.beginPath()

    ctx.moveTo(
      x + 25,
      y - 4,
    )

    ctx.lineTo(
      x + 47,
      y + 8,
    )

    ctx.lineTo(
      x + 55,
      y + 2,
    )

    ctx.moveTo(
      x + 10,
      y + 3,
    )

    ctx.lineTo(
      x + 29,
      y + 17,
    )

    ctx.stroke()

    const trexSpots = [
      [-30, -10, 12],
      [8, -24, 9],
      [42, -42, 10],
      [74, -27, 8],
      [-5, 18, 7],
      [31, 18, 9],
    ]

    for (
      const [
        spotX,
        spotY,
        spotRadius,
      ] of trexSpots
    ) {
      ctx.fillStyle = '#050505'

      ctx.beginPath()

      ctx.arc(
        x + spotX,
        y + spotY,
        spotRadius,
        0,
        Math.PI * 2,
      )

      ctx.fill()
    }

    // Dark Matter eyes.
    ctx.fillStyle = '#fff'

    ctx.beginPath()

    ctx.arc(
      x + 73,
      y - 47,
      10,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      x + 95,
      y - 42,
      9,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.fillStyle = '#050505'

    ctx.beginPath()

    ctx.arc(
      x + 77,
      y - 44,
      4,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      x + 91,
      y - 39,
      4,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    // Teeth.
    ctx.fillStyle = '#fff'

    for (
      let i = 0;
      i < 5;
      i += 1
    ) {
      const toothX =
        x + 68 + i * 9

      ctx.beginPath()

      ctx.moveTo(
        toothX,
        y - 10,
      )

      ctx.lineTo(
        toothX + 4,
        y,
      )

      ctx.lineTo(
        toothX + 8,
        y - 10,
      )

      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  function drawMonster(
    monster: Monster,
  ) {
    ctx.save()

    ctx.fillStyle =
      monster.hitCooldown > 10
        ? '#353535'
        : '#090909'

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3

    ctx.beginPath()

    for (
      let i = 0;
      i < 16;
      i += 1
    ) {
      const angle =
        (Math.PI * 2 * i) /
        16

      const wobble =
        Math.sin(
          frame * 0.07 +
            i * 1.4,
        ) * 2.3

      const radius =
        monster.r + wobble

      const pointX =
        monster.x +
        Math.cos(angle) *
          radius

      const pointY =
        monster.y +
        Math.sin(angle) *
          radius

      if (i === 0) {
        ctx.moveTo(
          pointX,
          pointY,
        )
      } else {
        ctx.lineTo(
          pointX,
          pointY,
        )
      }
    }

    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // White eyes.
    ctx.fillStyle = '#fff'
    ctx.beginPath()

    ctx.arc(
      monster.x - 6,
      monster.y - 4,
      3.5,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      monster.x + 6,
      monster.y - 4,
      3.5,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    // Black pupils.
    ctx.fillStyle = '#000'
    ctx.beginPath()

    ctx.arc(
      monster.x - 6,
      monster.y - 4,
      1.5,
      0,
      Math.PI * 2,
    )

    ctx.arc(
      monster.x + 6,
      monster.y - 4,
      1.5,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    // Three scribbled legs.
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5

    for (
      let i = -1;
      i <= 1;
      i += 1
    ) {
      ctx.beginPath()

      ctx.moveTo(
        monster.x +
          i * 7,
        monster.y +
          monster.r *
            0.55,
      )

      ctx.lineTo(
        monster.x +
          i * 10,
        monster.y +
          monster.r +
          9,
      )

      ctx.stroke()
    }

    ctx.font =
      'bold 13px Arial'

    ctx.textAlign = 'center'
    ctx.fillStyle = '#1b1b1b'

    ctx.fillText(
      'Dark Matter',
      monster.x,
      monster.y -
        monster.r -
        13,
    )

    const healthBarWidth = 42
    const healthBarHeight = 6

    const healthPercent =
      Math.max(
        0,
        monster.hp /
          monster.maxHp,
      )

    const healthX =
      monster.x -
      healthBarWidth / 2

    const healthY =
      monster.y -
      monster.r -
      9

    ctx.fillStyle =
      'rgba(0,0,0,0.22)'

    ctx.fillRect(
      healthX,
      healthY,
      healthBarWidth,
      healthBarHeight,
    )

    ctx.fillStyle = '#22c55e'

    ctx.fillRect(
      healthX,
      healthY,
      healthBarWidth *
        healthPercent,
      healthBarHeight,
    )

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 1

    ctx.strokeRect(
      healthX,
      healthY,
      healthBarWidth,
      healthBarHeight,
    )

    ctx.restore()
  }

  function drawParticles() {
    particles.forEach(
      (particle) => {
        ctx.fillStyle =
          particle.color

        ctx.globalAlpha =
          Math.max(
            0,
            particle.life / 22,
          )

        ctx.fillRect(
          particle.x,
          particle.y,
          3.5,
          3.5,
        )

        ctx.globalAlpha = 1
      },
    )
  }

  function drawHUD() {
    ctx.fillStyle = '#222'
    ctx.textAlign = 'left'
    ctx.font = '24px Arial'

    ctx.fillText(
      `Dark Matter defeated: ${score}`,
      20,
      40,
    )

    const maxPlayerHp = 10
    const barWidth = 220
    const barHeight = 24

    const barX =
      canvas.width -
      barWidth -
      24

    const barY = 22

    const healthPercent =
      Math.max(
        0,
        player.hp /
          maxPlayerHp,
      )

    ctx.font =
      'bold 16px Arial'

    ctx.textAlign = 'right'
    ctx.fillStyle = '#222'

    ctx.fillText(
      'PLAYER HEALTH',
      barX + barWidth,
      barY - 6,
    )

    ctx.fillStyle =
      'rgba(0,0,0,0.2)'

    ctx.fillRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.fillStyle = '#22c55e'

    ctx.fillRect(
      barX,
      barY,
      barWidth *
        healthPercent,
      barHeight,
    )

    ctx.strokeStyle = '#111'
    ctx.lineWidth = 3

    ctx.strokeRect(
      barX,
      barY,
      barWidth,
      barHeight,
    )

    ctx.font =
      'bold 15px Arial'

    ctx.textAlign = 'center'
    ctx.fillStyle = '#111'

    ctx.fillText(
      `${player.hp} / ${maxPlayerHp}`,
      barX + barWidth / 2,
      barY + 17,
    )
  }

  function drawGooglyEye(
    x: number,
    y: number,
    radius: number,
    pupilOffsetX: number,
    pupilOffsetY: number,
  ) {
    ctx.save()

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 3

    ctx.beginPath()

    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI * 2,
    )

    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#111'
    ctx.beginPath()

    ctx.arc(
      x + pupilOffsetX,
      y + pupilOffsetY,
      radius * 0.42,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.restore()
  }

  function drawWinScreen() {
    ctx.globalAlpha = 1
    ctx.fillStyle = '#fffdf7'

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    )

    ctx.strokeStyle =
      'rgba(120,170,255,0.25)'

    ctx.lineWidth = 1

    for (
      let y = 40;
      y < canvas.height;
      y += 28
    ) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#111'

    ctx.font =
      'bold 58px Arial'

    ctx.fillText(
      'YOU WIN!',
      canvas.width / 2,
      canvas.height / 2 - 35,
    )

    ctx.font =
      'bold 26px Arial'

    ctx.fillText(
      '1000 Dark Matter defeated!',
      canvas.width / 2,
      canvas.height / 2 + 25,
    )

    ctx.font = '22px Arial'

    ctx.fillText(
      'Press R to play again',
      canvas.width / 2,
      canvas.height / 2 + 75,
    )

    ctx.textBaseline =
      'alphabetic'
  }

  function drawGameOverScreen() {
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    )

    const centerX =
      canvas.width / 2

    const centerY =
      canvas.height / 2

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#fff'

    ctx.font =
      'bold 48px Arial'

    const message =
      'The Dark Matter Wins'

    ctx.fillText(
      message,
      centerX,
      centerY,
    )

    const fullWidth =
      ctx.measureText(
        message,
      ).width

    const theWidth =
      ctx.measureText(
        'The',
      ).width

    const beforeWinsWidth =
      ctx.measureText(
        'The Dark Matter ',
      ).width

    const winsWidth =
      ctx.measureText(
        'Wins',
      ).width

    const leftEdge =
      centerX -
      fullWidth / 2

    const theCenterX =
      leftEdge +
      theWidth / 2

    const winsCenterX =
      leftEdge +
      beforeWinsWidth +
      winsWidth / 2

    const eyeY =
      centerY - 58

    drawGooglyEye(
      theCenterX,
      eyeY - 6,
      22,
      5,
      3,
    )

    drawGooglyEye(
      winsCenterX,
      eyeY - 6,
      22,
      -5,
      3,
    )

    ctx.font =
      '24px Arial'

    ctx.fillStyle = '#d1d5db'

    ctx.fillText(
      'Press R to restart',
      centerX,
      centerY + 58,
    )

    ctx.textBaseline =
      'alphabetic'
  }

  function draw() {
    if (gameWon) {
      drawWinScreen()
      return
    }

    if (gameOver) {
      drawGameOverScreen()
      return
    }

    drawPaperBackground()
    drawPath()

    monsters.forEach(
      drawMonster,
    )

    drawBananaBoss()
    drawAndrewsous()
    drawPlayer()
    drawThrownCleaver()
    drawParticles()
    drawHUD()
  }

  function loop() {
    if (destroyed) {
      return
    }

    update()
    draw()

    animationFrameId =
      requestAnimationFrame(
        loop,
      )
  }

  function handleKeyDown(
    event: KeyboardEvent,
  ) {
    keys[
      event.key.toLowerCase()
    ] = true

    if (
      event.code === 'Space'
    ) {
      keys.space = true
      event.preventDefault()
    }

    if (
      event.key.toLowerCase() ===
        't' &&
      !gameOver &&
      !gameWon &&
      !thrownCleaver.active
    ) {
      throwCleaver()
    }

    if (
      (gameOver ||
        gameWon) &&
      event.key.toLowerCase() ===
        'r'
    ) {
      resetGame()
    }
  }

  function handleKeyUp(
    event: KeyboardEvent,
  ) {
    keys[
      event.key.toLowerCase()
    ] = false

    if (
      event.code === 'Space'
    ) {
      keys.space = false
    }
  }

  window.addEventListener(
    'keydown',
    handleKeyDown,
  )

  window.addEventListener(
    'keyup',
    handleKeyUp,
  )

  loop()

  return {
    destroy() {
      destroyed = true

      cancelAnimationFrame(
        animationFrameId,
      )

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      window.removeEventListener(
        'keyup',
        handleKeyUp,
      )
    },

    restart: resetGame,
  }
}