// STRICT-FIX-V3 — typed Warrior engine for the React project
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
  shielding: boolean
}

type HelperPatrol = {
  minX: number
  maxX: number
  y: number
}

type Helper = {
  x: number
  y: number
  speed: number
  facing: 1 | -1
  attackTimer: number
  attackCooldown: number
  walkCycle: number
  isMoving: boolean
  shielding: boolean
  patrolMinX: number
  patrolMaxX: number
  patrolY: number
  patrolDirection: 1 | -1
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
  villageAttackCooldown: number
  shieldBumpCooldown: number
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
  villageAttackCooldown: number
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
  villageAttackCooldown: number
  knockbackX: number
  knockbackY: number
}

type EnemyTarget =
  | { type: 'monster'; target: Monster; distance: number }
  | { type: 'banana'; target: BananaBoss; distance: number }
  | { type: 'andrewsous'; target: Andrewsous; distance: number }

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

  const keys: Record<string, boolean> = {};
  let gameOver = false;
  let gameWon = false;
  let score = 0;
  let frame = 0;
  function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const VILLAGE_MAX_HP = 30;
  const villageTarget = { x: 145, y: 375 };
  let villageHp = VILLAGE_MAX_HP;

  const SHOP_ITEM_COST = 1000;
  const shopInteractionPoint = { x: 105, y: 555 };
  let coins = 0;
  let swordUpgradeOwned = false;
  let shieldUpgradeOwned = false;

  function damageVillage(amount: number) {
    if (gameOver || gameWon || villageHp <= 0) return;

    villageHp = Math.max(0, villageHp - amount);

    if (villageHp <= 0) {
      gameOver = true;
    }
  }

  function isPlayerNearShop() {
    return (
      Math.hypot(
        player.x - shopInteractionPoint.x,
        player.y - shopInteractionPoint.y
      ) < 95
    );
  }

  function buySwordUpgrade() {
    if (
      gameOver ||
      gameWon ||
      swordUpgradeOwned ||
      !isPlayerNearShop() ||
      coins < SHOP_ITEM_COST
    ) {
      return;
    }

    coins -= SHOP_ITEM_COST;
    swordUpgradeOwned = true;
  }

  function buyShieldUpgrade() {
    if (
      gameOver ||
      gameWon ||
      shieldUpgradeOwned ||
      !isPlayerNearShop() ||
      coins < SHOP_ITEM_COST
    ) {
      return;
    }

    coins -= SHOP_ITEM_COST;
    shieldUpgradeOwned = true;
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
    shielding: false
  };

  // Three invincible NPC helpers. Each patrols its own section of the
  // dirt path, stops to fight nearby enemies, then resumes patrolling.
  const helperPatrols: HelperPatrol[] = [
    { minX: 175, maxX: 385, y: 315 },
    { minX: 390, maxX: 610, y: 375 },
    { minX: 615, maxX: 830, y: 440 }
  ];

  const helpers: Helper[] = helperPatrols.map((patrol, index) => ({
    x: patrol.minX + 18,
    y: patrol.y,
    speed: 2.25,
    facing: 1,
    attackTimer: 0,
    attackCooldown: 0,
    walkCycle: index * 1.7,
    isMoving: true,
    shielding: false,
    patrolMinX: patrol.minX,
    patrolMaxX: patrol.maxX,
    patrolY: patrol.y,
    patrolDirection: 1
  }));

  let monsters: Monster[] = [];
  let particles: Particle[] = [];

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
    hitIds: new Set<string>()
  };

  const DARK_MATTER_PER_WAVE = 30;
  const WAVE_DELAY_MS = 30000;

  let waveNumber = 1;
  let waveActive = false;
  let intermission = false;
  let nextWaveAt = 0;

  const bananaBoss: BananaBoss = {
    active: false,
    triggerScore: null,
    x: 0,
    y: 0,
    hp: 10,
    maxHp: 10,
    speed: 0.38,
    hitCooldown: 0,
    villageAttackCooldown: 0,
    knockbackX: 0,
    knockbackY: 0
  };

  const andrewsous: Andrewsous = {
    active: false,
    spawned: false,
    x: 0,
    y: 0,
    hp: 20,
    maxHp: 20,
    speed: 0.32,
    hitCooldown: 0,
    villageAttackCooldown: 0,
    knockbackX: 0,
    knockbackY: 0
  };

  function spawnMonster() {
    monsters.push({
      id: "dark-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      x: rand(720, 960),
      y: rand(250, 520),
      r: rand(17, 24),

      // Slower than before.
      speed: rand(0.55, 0.9),

      // Exactly three cleaver hits.
      hp: 3,
      maxHp: 3,

      hitCooldown: 0,
      villageAttackCooldown: 0,
      shieldBumpCooldown: 0,

      // Knockback velocity.
      knockbackX: 0,
      knockbackY: 0
    });
  }

  function startWave(wave: number) {
    waveNumber = wave;
    waveActive = true;
    intermission = false;
    nextWaveAt = 0;

    for (let i = 0; i < DARK_MATTER_PER_WAVE; i++) {
      spawnMonster();
    }

    // Bosses are in addition to the 30 regular Dark Matter.
    if (wave % 3 === 0) {
      spawnBananaBoss();
    }

    if (wave % 10 === 0) {
      spawnAndrewsous();
    }
  }

  function isWaveCleared() {
    return (
      waveActive &&
      monsters.length === 0 &&
      !bananaBoss.active &&
      !andrewsous.active
    );
  }

  function updateWaveState(now: number) {
    if (gameOver || gameWon) return;

    if (isWaveCleared()) {
      waveActive = false;
      intermission = true;
      nextWaveAt = now + WAVE_DELAY_MS;
      return;
    }

    if (intermission && now >= nextWaveAt) {
      startWave(waveNumber + 1);
    }
  }

  startWave(1);

  function resetGame() {
    gameOver = false;
    gameWon = false;
    score = 0;
    frame = 0;
    villageHp = VILLAGE_MAX_HP;
    coins = 0;
    swordUpgradeOwned = false;
    shieldUpgradeOwned = false;

    player.x = 180;
    player.y = 360;
    player.hp = 10;
    player.facing = 1;
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player.invuln = 0;
    player.isMoving = false;
    player.walkCycle = 0;
    player.shielding = false;

    helpers.forEach((helper, index) => {
      const patrol = helperPatrols[index];

      helper.x = patrol.minX + 18;
      helper.y = patrol.y;
      helper.facing = 1;
      helper.attackTimer = 0;
      helper.attackCooldown = 0;
      helper.walkCycle = index * 1.7;
      helper.isMoving = true;
      helper.shielding = false;
      helper.patrolMinX = patrol.minX;
      helper.patrolMaxX = patrol.maxX;
      helper.patrolY = patrol.y;
      helper.patrolDirection = 1;
    });

    monsters = [];
    particles = [];

    thrownCleaver.active = false;
    thrownCleaver.returning = false;
    thrownCleaver.distance = 0;
    thrownCleaver.hitIds = new Set<string>();

    waveNumber = 1;
    waveActive = false;
    intermission = false;
    nextWaveAt = 0;

    bananaBoss.active = false;
    bananaBoss.triggerScore = null;
    bananaBoss.x = 0;
    bananaBoss.y = 0;
    bananaBoss.hp = 10;
    bananaBoss.hitCooldown = 0;
    bananaBoss.villageAttackCooldown = 0;
    bananaBoss.knockbackX = 0;
    bananaBoss.knockbackY = 0;

    andrewsous.active = false;
    andrewsous.spawned = false;
    andrewsous.x = 0;
    andrewsous.y = 0;
    andrewsous.hp = 20;
    andrewsous.hitCooldown = 0;
    andrewsous.villageAttackCooldown = 0;
    andrewsous.knockbackX = 0;
    andrewsous.knockbackY = 0;

    startWave(1);
  }

  function getCleaverHitbox() {
    if (player.attackTimer <= 7) return null;

    if (player.facing === 1) {
      return {
        x: player.x + 5,
        y: player.y - 48,
        w: 70,
        h: 72
      };
    }

    return {
      x: player.x - 75,
      y: player.y - 48,
      w: 70,
      h: 72
    };
  }

  function createImpactParticles(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-3, 3),
        life: 22,
        color: Math.random() > 0.5 ? "#111" : "#555"
      });
    }
  }

  function throwCleaver() {
    thrownCleaver.active = true;
    thrownCleaver.returning = false;
    thrownCleaver.x = player.x + player.facing * 26;
    thrownCleaver.y = player.y - 10;
    thrownCleaver.vx = player.facing * 9.5;
    thrownCleaver.vy = 0;
    thrownCleaver.angle = 0;
    thrownCleaver.distance = 0;
    thrownCleaver.hitIds = new Set<string>();
  }

  function updateThrownCleaver() {
    if (!thrownCleaver.active) return;

    thrownCleaver.angle += 0.42;

    if (!thrownCleaver.returning) {
      thrownCleaver.x += thrownCleaver.vx;
      thrownCleaver.y += thrownCleaver.vy;
      thrownCleaver.distance += Math.hypot(
        thrownCleaver.vx,
        thrownCleaver.vy
      );

      if (
        thrownCleaver.distance >= thrownCleaver.maxDistance ||
        thrownCleaver.x < 20 ||
        thrownCleaver.x > canvas.width - 20
      ) {
        thrownCleaver.returning = true;
      }
    } else {
      const dx = player.x - thrownCleaver.x;
      const dy = (player.y - 10) - thrownCleaver.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 24) {
        thrownCleaver.active = false;
        thrownCleaver.returning = false;
        return;
      }

      thrownCleaver.x += (dx / distance) * 11;
      thrownCleaver.y += (dy / distance) * 11;
    }

    // The thrown cleaver can also damage the infected banana boss.
    if (
      bananaBoss.active &&
      bananaBoss.hitCooldown <= 0 &&
      Math.hypot(
        thrownCleaver.x - bananaBoss.x,
        thrownCleaver.y - bananaBoss.y
      ) < 62
    ) {
      hitBananaBoss(
        thrownCleaver.x,
        thrownCleaver.y,
        14
      );
    }

    if (
      andrewsous.active &&
      andrewsous.hitCooldown <= 0 &&
      Math.hypot(
        thrownCleaver.x - andrewsous.x,
        thrownCleaver.y - andrewsous.y
      ) < 82
    ) {
      hitAndrewsous(
        thrownCleaver.x,
        thrownCleaver.y,
        12
      );
    }

    // The upgraded player sword takes a fresh regular Dark Matter down
    // in two player hits instead of three.
    const playerSwordDamage = swordUpgradeOwned ? 2 : 1;

    // The thrown cleaver damages each Dark Matter at most once per throw.
    for (const m of monsters) {
      if (thrownCleaver.hitIds.has(m.id)) continue;

      const distance = Math.hypot(
        thrownCleaver.x - m.x,
        thrownCleaver.y - m.y
      );

      if (distance < m.r + 28) {
        thrownCleaver.hitIds.add(m.id);
        m.hp -= playerSwordDamage;
        m.hitCooldown = 18;

        const knockAngle = Math.atan2(
          m.y - thrownCleaver.y,
          m.x - thrownCleaver.x
        );

        const knockStrength = 11;
        m.knockbackX = Math.cos(knockAngle) * knockStrength;
        m.knockbackY = Math.sin(knockAngle) * knockStrength;

        createImpactParticles(m.x, m.y);
      }
    }
  }

  function spawnBananaBoss() {
    if (bananaBoss.active || gameWon) return;

    bananaBoss.active = true;
    bananaBoss.triggerScore = null;
    bananaBoss.hp = bananaBoss.maxHp;
    bananaBoss.x = canvas.width - 130;
    bananaBoss.y = canvas.height / 2 + 50;
    bananaBoss.hitCooldown = 0;
    bananaBoss.villageAttackCooldown = 0;
    bananaBoss.knockbackX = 0;
    bananaBoss.knockbackY = 0;
  }

  function hitBananaBoss(hitX: number, hitY: number, knockStrength = 12) {
    if (!bananaBoss.active || bananaBoss.hitCooldown > 0) return;

    bananaBoss.hp--;
    bananaBoss.hitCooldown = 18;

    const knockAngle = Math.atan2(
      bananaBoss.y - hitY,
      bananaBoss.x - hitX
    );

    bananaBoss.knockbackX = Math.cos(knockAngle) * knockStrength;
    bananaBoss.knockbackY = Math.sin(knockAngle) * knockStrength;

    createImpactParticles(bananaBoss.x, bananaBoss.y);

    if (bananaBoss.hp <= 0) {
      bananaBoss.active = false;

      // Each infected banana is worth 100 Dark Matter defeated.
      score += 100;

      for (let i = 0; i < 5; i++) {
        createImpactParticles(
          bananaBoss.x + rand(-35, 35),
          bananaBoss.y + rand(-45, 45)
        );
      }
    }
  }

  function updateBananaBoss() {
    if (!bananaBoss.active) return;

    if (bananaBoss.hitCooldown > 0) {
      bananaBoss.hitCooldown--;
    }

    if (bananaBoss.villageAttackCooldown > 0) {
      bananaBoss.villageAttackCooldown--;
    }

    bananaBoss.x += bananaBoss.knockbackX;
    bananaBoss.y += bananaBoss.knockbackY;

    bananaBoss.knockbackX *= 0.84;
    bananaBoss.knockbackY *= 0.84;

    // The infected banana advances toward the village entrance.
    const dx = villageTarget.x - bananaBoss.x;
    const dy = villageTarget.y - bananaBoss.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const attackingVillage = distance < 72;

    if (
      !attackingVillage &&
      Math.abs(bananaBoss.knockbackX) < 0.9 &&
      Math.abs(bananaBoss.knockbackY) < 0.9
    ) {
      bananaBoss.x += (dx / distance) * bananaBoss.speed;
      bananaBoss.y += (dy / distance) * bananaBoss.speed;
    }

    if (
      attackingVillage &&
      bananaBoss.villageAttackCooldown <= 0
    ) {
      damageVillage(20);
      bananaBoss.villageAttackCooldown = 90;
    }

    bananaBoss.x = Math.max(70, Math.min(canvas.width - 70, bananaBoss.x));
    bananaBoss.y = Math.max(215, Math.min(canvas.height - 75, bananaBoss.y));

    const cleaverHitbox = getCleaverHitbox();

    if (cleaverHitbox && bananaBoss.hitCooldown <= 0) {
      const closestX = Math.max(
        cleaverHitbox.x,
        Math.min(bananaBoss.x, cleaverHitbox.x + cleaverHitbox.w)
      );

      const closestY = Math.max(
        cleaverHitbox.y,
        Math.min(bananaBoss.y, cleaverHitbox.y + cleaverHitbox.h)
      );

      if (
        Math.hypot(
          bananaBoss.x - closestX,
          bananaBoss.y - closestY
        ) < 54
      ) {
        hitBananaBoss(player.x, player.y, 13);
      }
    }

    const playerDistance = Math.hypot(
      player.x - bananaBoss.x,
      player.y - bananaBoss.y
    );

    if (
      !player.shielding &&
      playerDistance < 58 &&
      player.invuln <= 0 &&
      Math.abs(bananaBoss.knockbackX) < 1.5 &&
      Math.abs(bananaBoss.knockbackY) < 1.5
    ) {
      player.hp--;
      player.invuln = 55;

      if (player.hp <= 0) {
        gameOver = true;
      }
    }
  }

  function spawnAndrewsous() {
    if (andrewsous.active || gameWon) return;

    andrewsous.spawned = true;
    andrewsous.active = true;
    andrewsous.hp = andrewsous.maxHp;
    andrewsous.x = canvas.width - 150;
    andrewsous.y = canvas.height / 2 + 50;
    andrewsous.hitCooldown = 0;
    andrewsous.villageAttackCooldown = 0;
    andrewsous.knockbackX = 0;
    andrewsous.knockbackY = 0;
  }

  function hitAndrewsous(hitX: number, hitY: number, knockStrength = 10) {
    if (!andrewsous.active || andrewsous.hitCooldown > 0) return;

    andrewsous.hp--;
    andrewsous.hitCooldown = 16;

    const knockAngle = Math.atan2(
      andrewsous.y - hitY,
      andrewsous.x - hitX
    );

    andrewsous.knockbackX = Math.cos(knockAngle) * knockStrength;
    andrewsous.knockbackY = Math.sin(knockAngle) * knockStrength;

    createImpactParticles(andrewsous.x, andrewsous.y);

    if (andrewsous.hp <= 0) {
      andrewsous.active = false;

      // Andrewsous is worth the final 100 points.
      score += 100;
    }
  }

  function updateAndrewsous() {
    if (!andrewsous.active) return;

    if (andrewsous.hitCooldown > 0) {
      andrewsous.hitCooldown--;
    }

    if (andrewsous.villageAttackCooldown > 0) {
      andrewsous.villageAttackCooldown--;
    }

    andrewsous.x += andrewsous.knockbackX;
    andrewsous.y += andrewsous.knockbackY;

    andrewsous.knockbackX *= 0.86;
    andrewsous.knockbackY *= 0.86;

    // Andrewsous advances toward the village entrance.
    const dx = villageTarget.x - andrewsous.x;
    const dy = villageTarget.y - andrewsous.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const attackingVillage = distance < 92;

    if (
      !attackingVillage &&
      Math.abs(andrewsous.knockbackX) < 0.8 &&
      Math.abs(andrewsous.knockbackY) < 0.8
    ) {
      andrewsous.x += (dx / distance) * andrewsous.speed;
      andrewsous.y += (dy / distance) * andrewsous.speed;
    }

    if (
      attackingVillage &&
      andrewsous.villageAttackCooldown <= 0
    ) {
      damageVillage(20);
      andrewsous.villageAttackCooldown = 90;
    }

    andrewsous.x = Math.max(95, Math.min(canvas.width - 95, andrewsous.x));
    andrewsous.y = Math.max(220, Math.min(canvas.height - 90, andrewsous.y));

    const cleaverHitbox = getCleaverHitbox();

    if (cleaverHitbox && andrewsous.hitCooldown <= 0) {
      const closestX = Math.max(
        cleaverHitbox.x,
        Math.min(andrewsous.x, cleaverHitbox.x + cleaverHitbox.w)
      );

      const closestY = Math.max(
        cleaverHitbox.y,
        Math.min(andrewsous.y, cleaverHitbox.y + cleaverHitbox.h)
      );

      if (
        Math.hypot(
          andrewsous.x - closestX,
          andrewsous.y - closestY
        ) < 76
      ) {
        hitAndrewsous(player.x, player.y, 11);
      }
    }

    const playerDistance = Math.hypot(
      player.x - andrewsous.x,
      player.y - andrewsous.y
    );

    if (
      !player.shielding &&
      playerDistance < 74 &&
      player.invuln <= 0 &&
      Math.abs(andrewsous.knockbackX) < 1.5 &&
      Math.abs(andrewsous.knockbackY) < 1.5
    ) {
      player.hp--;
      player.invuln = 55;

      if (player.hp <= 0) {
        gameOver = true;
      }
    }
  }

  function getNearestEnemy(x: number, y: number): EnemyTarget | null {
    let nearest: EnemyTarget | null = null;
    let nearestDistance = Infinity;

    for (const monster of monsters) {
      if (monster.hp <= 0) continue;

      const distance = Math.hypot(monster.x - x, monster.y - y);
      if (distance < nearestDistance) {
        nearest = { type: "monster", target: monster, distance };
        nearestDistance = distance;
      }
    }

    if (bananaBoss.active) {
      const distance = Math.hypot(bananaBoss.x - x, bananaBoss.y - y);
      if (distance < nearestDistance) {
        nearest = { type: "banana", target: bananaBoss, distance };
        nearestDistance = distance;
      }
    }

    if (andrewsous.active) {
      const distance = Math.hypot(andrewsous.x - x, andrewsous.y - y);
      if (distance < nearestDistance) {
        nearest = { type: "andrewsous", target: andrewsous, distance };
      }
    }

    return nearest;
  }

  function hitMonsterFromHelper(monster: Monster, helper: Helper) {
    if (monster.hitCooldown > 0 || monster.hp <= 0) return;

    monster.hp--;
    monster.hitCooldown = 18;

    const knockAngle = Math.atan2(
      monster.y - helper.y,
      monster.x - helper.x
    );
    const knockStrength = 8;

    monster.knockbackX = Math.cos(knockAngle) * knockStrength;
    monster.knockbackY = Math.sin(knockAngle) * knockStrength;

    createImpactParticles(monster.x, monster.y);
  }

  function updateHelpers() {
    helpers.forEach((helper) => {
      if (helper.attackCooldown > 0) helper.attackCooldown--;
      if (helper.attackTimer > 0) helper.attackTimer--;

      const nearest = getNearestEnemy(helper.x, helper.y);

      if (nearest && nearest.distance < 165) {
        // Combat mode: stop patrolling and face the nearby threat.
        helper.facing = nearest.target.x >= helper.x ? 1 : -1;
        helper.isMoving = false;

        // Raise the shield when danger is very close.
        helper.shielding =
          Boolean(nearest.distance < 62 && helper.attackTimer <= 0);

        // Swing when the enemy is in cleaver range.
        if (
          nearest.distance < 82 &&
          helper.attackCooldown <= 0 &&
          !helper.shielding
        ) {
          helper.attackTimer = 20;
          helper.attackCooldown = 28;
        }

        // Apply one hit during the active part of the swing.
        if (helper.attackTimer === 12) {
          if (nearest.type === "monster") {
            hitMonsterFromHelper(nearest.target, helper);
          } else if (nearest.type === "banana") {
            hitBananaBoss(helper.x, helper.y, 9);
          } else if (nearest.type === "andrewsous") {
            hitAndrewsous(helper.x, helper.y, 8);
          }
        }
      } else {
        // Patrol mode: resume the helper's own left/right route.
        helper.shielding = false;
        helper.isMoving = true;

        const patrolTargetX =
          helper.patrolDirection === 1
            ? helper.patrolMaxX
            : helper.patrolMinX;

        const dx = patrolTargetX - helper.x;
        const dy = helper.patrolY - helper.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const step = Math.min(helper.speed, distance);

        helper.x += (dx / distance) * step;
        helper.y += (dy / distance) * step;
        helper.walkCycle += 0.22;
        helper.facing = helper.patrolDirection;

        if (
          helper.patrolDirection === 1 &&
          helper.x >= helper.patrolMaxX - 2
        ) {
          helper.patrolDirection = -1;
          helper.facing = -1;
        } else if (
          helper.patrolDirection === -1 &&
          helper.x <= helper.patrolMinX + 2
        ) {
          helper.patrolDirection = 1;
          helper.facing = 1;
        }
      }

      helper.x = Math.max(
        helper.patrolMinX,
        Math.min(helper.patrolMaxX, helper.x)
      );
      helper.y = Math.max(275, Math.min(470, helper.y));
    });
  }

  function update() {
    if (gameOver || gameWon) return;

    frame++;

    let dx = 0;
    let dy = 0;

    if (keys["arrowleft"] || keys["a"]) dx -= 1;
    if (keys["arrowright"] || keys["d"]) dx += 1;
    if (keys["arrowup"] || keys["w"]) dy -= 1;
    if (keys["arrowdown"]) dy += 1;

    player.shielding = Boolean(keys["s"]);

    player.isMoving = dx !== 0 || dy !== 0;

    if (player.isMoving) {
      const len = Math.hypot(dx, dy);

      dx /= len;
      dy /= len;

      player.x += dx * player.speed;
      player.y += dy * player.speed;

      if (dx < 0) player.facing = -1;
      if (dx > 0) player.facing = 1;

      player.walkCycle += 0.24;
    } else {
      player.walkCycle *= 0.85;
    }

    player.x = Math.max(40, Math.min(canvas.width - 40, player.x));
    player.y = Math.max(180, Math.min(canvas.height - 70, player.y));

    if (player.attackCooldown > 0) {
      player.attackCooldown--;
    }

    if (keys["space"] && player.attackCooldown <= 0 && !thrownCleaver.active) {
      player.attackTimer = 20;
      player.attackCooldown = 24;
    }

    if (player.attackTimer > 0) player.attackTimer--;
    if (player.invuln > 0) player.invuln--;

    updateThrownCleaver();
    updateBananaBoss();
    updateAndrewsous();
    updateHelpers();

    if (score >= 1000) {
      gameWon = true;
    }

    const cleaverHitbox = getCleaverHitbox();
    const playerSwordDamage = swordUpgradeOwned ? 2 : 1;

    monsters.forEach((m) => {
      if (m.hitCooldown > 0) {
        m.hitCooldown--;
      }

      if (m.villageAttackCooldown > 0) {
        m.villageAttackCooldown--;
      }

      if (m.shieldBumpCooldown > 0) {
        m.shieldBumpCooldown--;
      }

      // Knockback gets applied first and gradually slows down.
      m.x += m.knockbackX;
      m.y += m.knockbackY;

      m.knockbackX *= 0.82;
      m.knockbackY *= 0.82;

      // The upgraded shield forcefully knocks regular Dark Matter away
      // whenever the player blocks at close range.
      if (
        shieldUpgradeOwned &&
        player.shielding &&
        m.shieldBumpCooldown <= 0
      ) {
        const shieldDistance = Math.hypot(
          m.x - player.x,
          m.y - player.y
        );

        if (shieldDistance < m.r + 48) {
          const shieldAngle = Math.atan2(
            m.y - player.y,
            m.x - player.x
          );
          const shieldKnockStrength = 14;

          m.knockbackX =
            Math.cos(shieldAngle) * shieldKnockStrength;
          m.knockbackY =
            Math.sin(shieldAngle) * shieldKnockStrength;
          m.shieldBumpCooldown = 24;

          createImpactParticles(m.x, m.y);
        }
      }

      // Dark Matter targets the village instead of chasing the player.
      const villageDx = villageTarget.x - m.x;
      const villageDy = villageTarget.y - m.y;
      const villageDistance = Math.hypot(villageDx, villageDy);
      const angle = Math.atan2(villageDy, villageDx);
      const attackingVillage = villageDistance < m.r + 30;

      // Strong knockback briefly overwhelms normal movement.
      if (
        !attackingVillage &&
        Math.abs(m.knockbackX) < 0.8 &&
        Math.abs(m.knockbackY) < 0.8
      ) {
        m.x += Math.cos(angle) * m.speed;
        m.y += Math.sin(angle) * m.speed;
      }

      if (
        attackingVillage &&
        m.villageAttackCooldown <= 0
      ) {
        damageVillage(1);
        m.villageAttackCooldown = 45;
      }

      m.x = Math.max(m.r, Math.min(canvas.width - m.r, m.x));
      m.y = Math.max(185, Math.min(canvas.height - 45, m.y));

      if (cleaverHitbox && m.hitCooldown <= 0) {
        const closestX = Math.max(
          cleaverHitbox.x,
          Math.min(m.x, cleaverHitbox.x + cleaverHitbox.w)
        );

        const closestY = Math.max(
          cleaverHitbox.y,
          Math.min(m.y, cleaverHitbox.y + cleaverHitbox.h)
        );

        const hitDistance = Math.hypot(m.x - closestX, m.y - closestY);

        if (hitDistance < m.r) {
          m.hp -= playerSwordDamage;
          m.hitCooldown = 18;

          // Knock the monster away from the player.
          const knockAngle = Math.atan2(m.y - player.y, m.x - player.x);
          const knockStrength = 9;

          m.knockbackX = Math.cos(knockAngle) * knockStrength;
          m.knockbackY = Math.sin(knockAngle) * knockStrength;

          createImpactParticles(m.x, m.y);
        }
      }

      const playerDistance = Math.hypot(player.x - m.x, player.y - m.y);

      if (
        !player.shielding &&
        playerDistance < m.r + 14 &&
        player.invuln <= 0 &&
        Math.abs(m.knockbackX) < 1.5 &&
        Math.abs(m.knockbackY) < 1.5
      ) {
        player.hp--;
        player.invuln = 50;

        if (player.hp <= 0) {
          gameOver = true;
        }
      }
    });

    for (let i = monsters.length - 1; i >= 0; i--) {
      if (monsters[i].hp <= 0) {
        score++;
        coins += 10;

        createImpactParticles(monsters[i].x, monsters[i].y);
        createImpactParticles(monsters[i].x, monsters[i].y);

        monsters.splice(i, 1);
      }
    }

    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life--;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    });

    updateWaveState(performance.now());
  }

  function drawPaperBackground() {
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Blue notebook paper lines.
    ctx.strokeStyle = "rgba(120,170,255,0.25)";
    ctx.lineWidth = 1;

    for (let y = 40; y < canvas.height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Red notebook margin.
    ctx.strokeStyle = "rgba(255,80,80,0.25)";
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, canvas.height);
    ctx.stroke();

    drawCloud(180, 90, 55);
    drawCloud(420, 120, 45);
    drawCloud(770, 80, 60);
  }

  function drawCloud(x: number, y: number, size: number) {
    ctx.save();

    // Pencil-like blue cloud scribbles.
    for (let pass = 0; pass < 5; pass++) {
      ctx.strokeStyle = `rgba(75,135,235,${0.16 + pass * 0.05})`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();

      for (let i = 0; i <= 34; i++) {
        const angle = (i / 34) * Math.PI * 2;
        const rough = rand(-3.5, 3.5);

        const px =
          x +
          Math.cos(angle) * (size + rough) +
          Math.sin(angle * 3) * size * 0.12;

        const py =
          y +
          Math.sin(angle) * (size * 0.45 + rough) +
          Math.sin(angle * 2) * size * 0.08;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPath() {
    ctx.save();

    ctx.fillStyle = "#d8b07a";

    // Straight dirt path running left-to-right through the map.
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(canvas.width, 250);
    ctx.lineTo(canvas.width, 500);
    ctx.lineTo(0, 500);
    ctx.closePath();
    ctx.fill();

    // Tan/brown colored-pencil strokes stay inside the dirt path.
    for (let i = 0; i < 400; i++) {
      const x = rand(0, canvas.width);
      const y = rand(255, 495);

      ctx.strokeStyle = `rgba(145,100,55,${rand(0.12, 0.3)})`;
      ctx.lineWidth = rand(0.7, 1.6);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(7, 25), y + rand(-5, 5));
      ctx.stroke();
    }

    ctx.restore();

    // A couple of grass patches above the path.
    drawGrassPatch(90, 220, 120, 55);
    drawGrassPatch(825, 220, 125, 50);

    // Fill the bottom of the map with overlapping colored-pencil grass spots.
    drawGrassPatch(45, 550, 90, 42);
    drawGrassPatch(155, 595, 105, 46);
    drawGrassPatch(275, 555, 110, 44);
    drawGrassPatch(395, 600, 110, 48);
    drawGrassPatch(515, 552, 115, 44);
    drawGrassPatch(635, 598, 110, 48);
    drawGrassPatch(755, 555, 115, 44);
    drawGrassPatch(875, 598, 105, 48);
    drawGrassPatch(965, 550, 90, 42);
  }

  function drawGrassPatch(x: number, y: number, w: number, h: number) {
    ctx.save();

    ctx.fillStyle = "rgba(137,188,91,0.58)";
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 110; i++) {
      const gx = x - w + Math.random() * w * 2;
      const gy = y - h / 2 + Math.random() * h;

      ctx.strokeStyle = `rgba(54,115,42,${rand(0.18, 0.5)})`;
      ctx.lineWidth = rand(0.8, 1.4);

      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + rand(-3, 3), gy - rand(5, 15));
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawVillageEntrance() {
    ctx.save();

    // Stone wall on the left side of the path with a walk-through opening.
    const wallX = 0;
    const wallY = 250;
    const wallWidth = 165;
    const wallHeight = 250;
    const openingX = 58;
    const openingWidth = 54;
    const openingTop = 300;
    const openingBottom = 448;

    // Main wall shape.
    ctx.fillStyle = "#b8b1a5";
    ctx.fillRect(wallX, wallY, wallWidth, wallHeight);

    // Pencil-like wall texture.
    for (let i = 0; i < 240; i++) {
      const x = rand(wallX + 2, wallX + wallWidth - 2);
      const y = rand(wallY + 2, wallY + wallHeight - 2);

      ctx.strokeStyle = `rgba(125, 118, 108, ${rand(0.12, 0.28)})`;
      ctx.lineWidth = rand(0.8, 1.4);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(5, 15), y + rand(-3, 3));
      ctx.stroke();
    }

    // Brick lines.
    ctx.strokeStyle = "rgba(108, 100, 92, 0.45)";
    ctx.lineWidth = 1.4;

    for (let y = wallY + 20; y < wallY + wallHeight; y += 24) {
      ctx.beginPath();
      ctx.moveTo(wallX, y);
      ctx.lineTo(wallX + wallWidth, y);
      ctx.stroke();
    }

    for (let x = wallX + 18; x < wallX + wallWidth; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, wallY);
      ctx.lineTo(x, wallY + wallHeight);
      ctx.stroke();
    }

    // Cut out the walk-through opening.
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(openingX, openingTop, openingWidth, openingBottom - openingTop);

    // Draw a dirt lane visible through the opening, connecting to the path.
    ctx.fillStyle = "rgba(173,126,78,0.8)";
    ctx.beginPath();
    ctx.moveTo(openingX + 3, openingTop + 6);
    ctx.lineTo(openingX + openingWidth - 3, openingTop + 6);
    ctx.lineTo(154, 432);
    ctx.lineTo(20, 432);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 65; i++) {
      const x = rand(openingX + 2, 152);
      const y = rand(openingTop + 8, 430);

      ctx.strokeStyle = `rgba(128,89,48,${rand(0.14, 0.28)})`;
      ctx.lineWidth = rand(0.8, 1.2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(5, 12), y + rand(-3, 3));
      ctx.stroke();
    }

    // Outline the opening like a gateway.
    ctx.strokeStyle = "#6f665e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(openingX, openingTop, openingWidth, openingBottom - openingTop);
    ctx.stroke();

    // Rounded arch top above the opening.
    ctx.beginPath();
    ctx.moveTo(openingX, openingTop);
    ctx.quadraticCurveTo(openingX + openingWidth / 2, openingTop - 30, openingX + openingWidth, openingTop);
    ctx.stroke();

    // Sign above the opening.
    ctx.fillStyle = "#d6b27e";
    ctx.strokeStyle = "#7c4a22";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(38, 266, 95, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#5c3413";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Village Entrance", 85, 282);

    // Village health bar: 30 total health.
    const villageBarX = 14;
    const villageBarY = 218;
    const villageBarWidth = 142;
    const villageBarHeight = 16;
    const villageHealthPercent = Math.max(
      0,
      villageHp / VILLAGE_MAX_HP
    );

    ctx.fillStyle = "#222";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(
      "VILLAGE HEALTH",
      villageBarX,
      villageBarY - 6
    );

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(
      villageBarX,
      villageBarY,
      villageBarWidth,
      villageBarHeight
    );

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      villageBarX,
      villageBarY,
      villageBarWidth * villageHealthPercent,
      villageBarHeight
    );

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      villageBarX,
      villageBarY,
      villageBarWidth,
      villageBarHeight
    );

    ctx.fillStyle = "#111";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      villageHp + " / " + VILLAGE_MAX_HP,
      villageBarX + villageBarWidth / 2,
      villageBarY + 12
    );

    ctx.restore();
  }

  function drawShop() {
    ctx.save();

    const x = 16;
    const y = 510;
    const width = 154;
    const height = 126;

    // Wooden shop stall below the village.
    ctx.fillStyle = "#9a642f";
    ctx.strokeStyle = "#5c3413";
    ctx.lineWidth = 3;
    ctx.fillRect(x, y + 22, width, height - 22);
    ctx.strokeRect(x, y + 22, width, height - 22);

    // Pencil-style wood scratches.
    for (let i = 0; i < 65; i++) {
      const sx = rand(x + 4, x + width - 10);
      const sy = rand(y + 28, y + height - 6);

      ctx.strokeStyle = `rgba(75, 42, 18, ${rand(0.10, 0.24)})`;
      ctx.lineWidth = rand(0.8, 1.3);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + rand(8, 24), sy + rand(-2, 2));
      ctx.stroke();
    }

    // Awning.
    ctx.fillStyle = "#d7b06e";
    ctx.strokeStyle = "#5c3413";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 24);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x + width - 18, y);
    ctx.lineTo(x + width + 4, y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shopkeeper standing behind the counter.
    const keeperX = x + width - 28;
    const keeperY = y + 43;

    ctx.strokeStyle = "#202020";
    ctx.fillStyle = "#202020";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(keeperX, keeperY - 18, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(keeperX, keeperY - 10);
    ctx.lineTo(keeperX, keeperY + 10);
    ctx.moveTo(keeperX, keeperY - 3);
    ctx.lineTo(keeperX - 10, keeperY + 4);
    ctx.moveTo(keeperX, keeperY - 3);
    ctx.lineTo(keeperX + 10, keeperY + 2);
    ctx.moveTo(keeperX, keeperY + 10);
    ctx.lineTo(keeperX - 7, keeperY + 22);
    ctx.moveTo(keeperX, keeperY + 10);
    ctx.lineTo(keeperX + 7, keeperY + 22);
    ctx.stroke();

    // Blue apron to help the shopkeeper stand out.
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.moveTo(keeperX - 7, keeperY - 2);
    ctx.lineTo(keeperX + 7, keeperY - 2);
    ctx.lineTo(keeperX + 5, keeperY + 12);
    ctx.lineTo(keeperX - 5, keeperY + 12);
    ctx.closePath();
    ctx.fill();

    // Tiny wave hand.
    ctx.strokeStyle = "#202020";
    ctx.beginPath();
    ctx.moveTo(keeperX + 10, keeperY + 2);
    ctx.lineTo(keeperX + 15, keeperY - 8);
    ctx.stroke();

    ctx.fillStyle = "#3f260f";
    ctx.textAlign = "center";
    ctx.font = "bold 16px Arial";
    ctx.fillText("SHOP", x + width / 2, y + 43);

    ctx.font = "bold 11px Arial";
    ctx.fillText(
      swordUpgradeOwned
        ? "1  BLUE SWORD: OWNED"
        : "1  BLUE SWORD: 1000",
      x + width / 2,
      y + 66
    );

    ctx.fillText(
      shieldUpgradeOwned
        ? "2  BLUE SHIELD: OWNED"
        : "2  BLUE SHIELD: 1000",
      x + width / 2,
      y + 86
    );

    ctx.font = "10px Arial";
    ctx.fillText(
      "Walk close, then press 1 or 2",
      x + width / 2,
      y + 108
    );

    ctx.fillStyle = "#2b1b0d";
    ctx.font = "bold 9px Arial";
    ctx.fillText("Shopkeeper", keeperX, y + 61);

    if (isPlayerNearShop()) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
    }

    ctx.restore();
  }

  function drawDarkCloud() {
    ctx.save();

    // Much larger filled-in dark cloud at the right end of the path.
    const x = 915;
    const y = 372;

    // Main larger filled cloud mass.
    ctx.fillStyle = "rgba(28, 28, 34, 0.92)";
    ctx.beginPath();
    ctx.ellipse(x, y, 150, 78, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 96, y + 8, 74, 50, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42, y - 46, 78, 52, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38, y - 54, 86, 55, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 112, y - 4, 62, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scribbly outline to keep the colored-pencil style.
    for (let pass = 0; pass < 6; pass++) {
      ctx.strokeStyle = `rgba(15, 15, 20, ${0.18 + pass * 0.08})`;
      ctx.lineWidth = 1.6 + pass * 0.14;

      ctx.beginPath();

      for (let i = 0; i <= 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const rough = rand(-8, 8);

        const px =
          x +
          Math.cos(angle) * (150 + rough) +
          Math.sin(angle * 3) * 20;

        const py =
          y +
          Math.sin(angle) * (76 + rough * 0.35) +
          Math.cos(angle * 2) * 12;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      ctx.stroke();
    }

    // Extra dark shading inside the cloud.
    for (let i = 0; i < 90; i++) {
      const sx = rand(760, 1000);
      const sy = rand(300, 445);
      const length = rand(8, 22);

      ctx.strokeStyle = `rgba(12, 12, 16, ${rand(0.08, 0.18)})`;
      ctx.lineWidth = rand(1, 2);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + rand(-5, 5), sy + length);
      ctx.stroke();
    }

    // Dark drips / spooky streaks under the cloud.
    for (let i = 0; i < 12; i++) {
      const sx = rand(790, 992);
      const sy = rand(430, 452);
      const length = rand(18, 42);

      ctx.strokeStyle = `rgba(20, 20, 24, ${rand(0.18, 0.32)})`;
      ctx.lineWidth = rand(1.3, 2.3);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + rand(-4, 4), sy + length);
      ctx.stroke();
    }

    ctx.restore();
  }


  function drawThrownCleaver() {
    if (!thrownCleaver.active) return;

    ctx.save();
    ctx.translate(thrownCleaver.x, thrownCleaver.y);
    ctx.rotate(thrownCleaver.angle);

    const upgraded = swordUpgradeOwned;

    if (upgraded) {
      ctx.shadowColor = "rgba(59,130,246,0.9)";
      ctx.shadowBlur = 18;
    }

    // Spinning cleaver blade.
    ctx.fillStyle = upgraded ? "#4ea5ff" : "#070707";
    ctx.strokeStyle = upgraded ? "#1d4ed8" : "#000";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(34, -20);
    ctx.lineTo(47, -10);
    ctx.lineTo(43, 14);
    ctx.lineTo(-1, 17);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Handle.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = upgraded ? "#1e293b" : "#151515";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(-2, 0);
    ctx.stroke();

    // Light blade shine.
    ctx.strokeStyle = upgraded
      ? "rgba(219,234,254,0.95)"
      : "rgba(160,160,160,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(34, -11);
    ctx.stroke();

    ctx.restore();
  }

  function drawShield(x: number, y: number, facing: 1 | -1, raised: boolean, glowing = false) {
    ctx.save();

    const forward = raised ? 18 * facing : -12 * facing;
    ctx.translate(x + forward, y - 4);

    if (glowing) {
      ctx.shadowColor = "rgba(59,130,246,0.88)";
      ctx.shadowBlur = 16;
    }

    // A simple hand-drawn shield.
    ctx.fillStyle = glowing
      ? (raised ? "#60a5fa" : "#93c5fd")
      : (raised ? "#9ca3af" : "#b6bcc5");
    ctx.strokeStyle = glowing ? "#1d4ed8" : "#343a40";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(-15, -24);
    ctx.quadraticCurveTo(0, -32, 15, -24);
    ctx.lineTo(13, 8);
    ctx.quadraticCurveTo(0, 28, -13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pencil scratches.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = glowing
      ? "rgba(219,234,254,0.9)"
      : "rgba(55, 65, 81, 0.35)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(rand(-9, 3), rand(-18, 14));
      ctx.lineTo(rand(3, 10), rand(-18, 14));
      ctx.stroke();
    }

    // Shield boss.
    ctx.fillStyle = glowing ? "#dbeafe" : "#6b7280";
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHelper(helper: Helper) {
    ctx.save();

    const x = helper.x;
    const y = helper.y;

    ctx.strokeStyle = "#292929";
    ctx.fillStyle = "#292929";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Filled head.
    ctx.beginPath();
    ctx.arc(x, y - 34, 10, 0, Math.PI * 2);
    ctx.fill();

    // Body.
    ctx.beginPath();
    ctx.moveTo(x, y - 23);
    ctx.lineTo(x, y + 8);
    ctx.stroke();

    const legSwing =
      helper.isMoving ? Math.sin(helper.walkCycle) * 8 : 0;

    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x - 9 + legSwing, y + 28);
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x + 9 - legSwing, y + 28);
    ctx.stroke();

    // Shield arm.
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 12 * helper.facing, y + 1);
    ctx.stroke();

    // Cleaver arm.
    const handX = x + 13 * helper.facing;
    const handY = y - 9;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    let cleaverAngle;
    if (helper.attackTimer > 0) {
      const progress = 1 - helper.attackTimer / 20;
      const swing = -1.1 + progress * 2.2;
      cleaverAngle =
        helper.facing === 1 ? swing : Math.PI - swing;
    } else {
      cleaverAngle =
        helper.facing === 1 ? -0.55 : Math.PI + 0.55;
    }

    drawBlackCleaver(handX, handY, cleaverAngle, false);
    drawShield(x, y, helper.facing, helper.shielding, false);

    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();

    if (
      player.invuln > 0 &&
      Math.floor(player.invuln / 4) % 2 === 0
    ) {
      ctx.globalAlpha = 0.48;
    }

    const x = player.x;
    const y = player.y;

    ctx.strokeStyle = "#222";
    ctx.fillStyle = "#222";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // FILLED-IN stick guy head.
    ctx.beginPath();
    ctx.arc(x, y - 34, 11, 0, Math.PI * 2);
    ctx.fill();

    // Body.
    ctx.beginPath();
    ctx.moveTo(x, y - 23);
    ctx.lineTo(x, y + 8);
    ctx.stroke();

    // Animated walking legs.
    const legSwing = player.isMoving ? Math.sin(player.walkCycle) * 9 : 0;

    ctx.beginPath();

    ctx.moveTo(x, y + 8);
    ctx.lineTo(
      x - 9 + legSwing,
      y + 29
    );

    ctx.moveTo(x, y + 8);
    ctx.lineTo(
      x + 9 - legSwing,
      y + 29
    );

    ctx.stroke();

    // Back arm.
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 12 * player.facing, y + 2);
    ctx.stroke();

    const handX = x + 13 * player.facing;
    const handY = y - 9;

    // Sword arm.
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    let cleaverAngle;

    if (player.attackTimer > 0) {
      const progress = 1 - player.attackTimer / 20;
      const swing = -1.1 + progress * 2.2;

      cleaverAngle =
        player.facing === 1
          ? swing
          : Math.PI - swing;
    } else {
      cleaverAngle =
        player.facing === 1
          ? -0.55
          : Math.PI + 0.55;
    }

    if (!thrownCleaver.active) {
      drawBlackCleaver(handX, handY, cleaverAngle, swordUpgradeOwned);
    }

    drawShield(x, y, player.facing, player.shielding, shieldUpgradeOwned);

    ctx.restore();
  }

  function drawBlackCleaver(handX: number, handY: number, angle: number, glowing = false) {
    ctx.save();

    ctx.translate(handX, handY);
    ctx.rotate(angle);

    if (glowing) {
      ctx.shadowColor = "rgba(59,130,246,0.95)";
      ctx.shadowBlur = 18;
    }

    // Handle.
    ctx.strokeStyle = glowing ? "#1e293b" : "#151515";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    // Guard.
    ctx.strokeStyle = glowing ? "#1d4ed8" : "#050505";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(6, -9);
    ctx.lineTo(6, 9);
    ctx.stroke();

    // Large cleaver blade.
    ctx.fillStyle = glowing ? "#4ea5ff" : "#070707";
    ctx.strokeStyle = glowing ? "#1d4ed8" : "#000";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(53, -16);
    ctx.lineTo(66, -8);
    ctx.lineTo(63, 11);
    ctx.lineTo(15, 14);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blade shine.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = glowing
      ? "rgba(219,234,254,0.98)"
      : "rgba(150,150,150,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(17, -3);
    ctx.lineTo(55, -9);
    ctx.stroke();

    ctx.restore();
  }

  function drawBananaBoss() {
    if (!bananaBoss.active) return;

    ctx.save();

    const x = bananaBoss.x;
    const y = bananaBoss.y;

    // Boss name.
    ctx.textAlign = "center";
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#111";
    ctx.fillText("INFECTED BANANA", x, y - 92);

    // Green boss health bar.
    const barWidth = 140;
    const barHeight = 10;
    const barX = x - barWidth / 2;
    const barY = y - 78;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      barX,
      barY,
      barWidth * Math.max(0, bananaBoss.hp / bananaBoss.maxHp),
      barHeight
    );

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#111";
    ctx.fillText(
      bananaBoss.hp + " / " + bananaBoss.maxHp,
      x,
      barY + 9
    );

    // Three black Dark Matter legs.
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 24, y + 40);
      ctx.lineTo(x + i * 30, y + 72);
      ctx.stroke();
    }

    // Big curved yellow banana body.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.28);

    ctx.fillStyle = bananaBoss.hitCooldown > 10 ? "#facc15" : "#f7d33f";
    ctx.strokeStyle = "#8a6a12";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(-58, -18);
    ctx.bezierCurveTo(
      -42, -62,
      34, -64,
      62, -10
    );
    ctx.bezierCurveTo(
      37, 34,
      -17, 46,
      -54, 22
    );
    ctx.bezierCurveTo(
      -68, 12,
      -69, -3,
      -58, -18
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Banana tips.
    ctx.fillStyle = "#654c11";
    ctx.beginPath();
    ctx.ellipse(-58, 1, 8, 14, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(59, -8, 7, 13, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dark Matter infection spots.
    const spots = [
      [-20, -20, 11],
      [9, -31, 8],
      [28, -8, 12],
      [-2, 17, 9],
      [-36, 8, 7]
    ];

    for (const [sx, sy, sr] of spots) {
      ctx.fillStyle = "#080808";
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark Matter-style googly eyes.
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-10, -8, 9, 0, Math.PI * 2);
    ctx.arc(15, -10, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#050505";
    ctx.beginPath();
    ctx.arc(-7, -5, 4, 0, Math.PI * 2);
    ctx.arc(12, -7, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  function drawAndrewsous() {
    if (!andrewsous.active) return;

    ctx.save();

    const x = andrewsous.x;
    const y = andrewsous.y;

    // Boss title.
    ctx.textAlign = "center";
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#111";
    ctx.fillText("ANDREWSOUS", x, y - 112);

    // Green health bar.
    const barWidth = 180;
    const barHeight = 12;
    const barX = x - barWidth / 2;
    const barY = y - 96;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      barX,
      barY,
      barWidth * Math.max(0, andrewsous.hp / andrewsous.maxHp),
      barHeight
    );

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // T-Rex body, infected by Dark Matter.
    ctx.fillStyle = andrewsous.hitCooldown > 9 ? "#4b5563" : "#596b4d";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;

    // Tail and body.
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 15);
    ctx.lineTo(x - 105, y + 48);
    ctx.lineTo(x - 55, y + 3);
    ctx.quadraticCurveTo(x - 15, y - 45, x + 48, y - 20);
    ctx.lineTo(x + 62, y + 22);
    ctx.quadraticCurveTo(x + 10, y + 48, x - 15, y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Big head and snout.
    ctx.beginPath();
    ctx.ellipse(x + 55, y - 35, 48, 32, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(x + 54, y - 38, 62, 31, 10);
    ctx.fill();
    ctx.stroke();

    // Powerful hind legs.
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 30);
    ctx.lineTo(x - 24, y + 80);
    ctx.lineTo(x - 49, y + 86);

    ctx.moveTo(x + 23, y + 28);
    ctx.lineTo(x + 34, y + 80);
    ctx.lineTo(x + 58, y + 84);
    ctx.stroke();

    // Tiny T-Rex arms.
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 25, y - 4);
    ctx.lineTo(x + 47, y + 8);
    ctx.lineTo(x + 55, y + 2);

    ctx.moveTo(x + 10, y + 3);
    ctx.lineTo(x + 29, y + 17);
    ctx.stroke();

    // Dark Matter infection spots.
    const trexSpots = [
      [-30, -10, 12],
      [8, -24, 9],
      [42, -42, 10],
      [74, -27, 8],
      [-5, 18, 7],
      [31, 18, 9]
    ];

    for (const [sx, sy, sr] of trexSpots) {
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.arc(x + sx, y + sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark Matter eyes.
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + 73, y - 47, 10, 0, Math.PI * 2);
    ctx.arc(x + 95, y - 42, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#050505";
    ctx.beginPath();
    ctx.arc(x + 77, y - 44, 4, 0, Math.PI * 2);
    ctx.arc(x + 91, y - 39, 4, 0, Math.PI * 2);
    ctx.fill();

    // Teeth.
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 5; i++) {
      const tx = x + 68 + i * 9;
      ctx.beginPath();
      ctx.moveTo(tx, y - 10);
      ctx.lineTo(tx + 4, y);
      ctx.lineTo(tx + 8, y - 10);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMonster(m: Monster) {
    ctx.save();

    // Slight reaction flash when hit.
    if (m.hitCooldown > 10) {
      ctx.fillStyle = "#353535";
    } else {
      ctx.fillStyle = "#090909";
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;

    ctx.beginPath();

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const wobble = Math.sin(frame * 0.07 + i * 1.4) * 2.3;
      const rr = m.r + wobble;

      const px = m.x + Math.cos(angle) * rr;
      const py = m.y + Math.sin(angle) * rr;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // White eyes.
    ctx.fillStyle = "#fff";

    ctx.beginPath();
    ctx.arc(m.x - 6, m.y - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(m.x + 6, m.y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000";

    ctx.beginPath();
    ctx.arc(m.x - 6, m.y - 4, 1.5, 0, Math.PI * 2);
    ctx.arc(m.x + 6, m.y - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Scribbled Dark Matter legs.
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(m.x + i * 7, m.y + m.r * 0.55);
      ctx.lineTo(m.x + i * 10, m.y + m.r + 9);
      ctx.stroke();
    }

    // Name.
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1b1b1b";
    ctx.fillText("Dark Matter", m.x, m.y - m.r - 13);

    // Green Dark Matter health bar.
    const healthBarWidth = 42;
    const healthBarHeight = 6;
    const healthPercent = Math.max(0, m.hp / m.maxHp);
    const healthX = m.x - healthBarWidth / 2;
    const healthY = m.y - m.r - 9;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(healthX, healthY, healthBarWidth, healthBarHeight);

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      healthX,
      healthY,
      healthBarWidth * healthPercent,
      healthBarHeight
    );

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(healthX, healthY, healthBarWidth, healthBarHeight);

    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 22);
      ctx.fillRect(p.x, p.y, 3.5, 3.5);
      ctx.globalAlpha = 1;
    });
  }

  function drawHUD() {
    // Score stays in the top-left.
    ctx.fillStyle = "#222";
    ctx.textAlign = "left";
    ctx.font = "24px Arial";
    ctx.fillText("Dark Matter defeated: " + score, 20, 40);

    ctx.font = "bold 18px Arial";
    ctx.fillText("WAVE " + waveNumber, 20, 68);

    ctx.font = "bold 17px Arial";
    ctx.fillText("COINS: " + coins, 20, 94);

    if (intermission) {
      const remainingMs = Math.max(0, nextWaveAt - performance.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      ctx.font = "bold 16px Arial";
      ctx.fillText(
        "NEXT WAVE IN: " + remainingSeconds + "s",
        20,
        120
      );
    }

    // Player health bar in the top-right.
    const maxPlayerHp = 10;
    const barWidth = 220;
    const barHeight = 24;
    const barX = canvas.width - barWidth - 24;
    const barY = 22;
    const healthPercent = Math.max(0, player.hp / maxPlayerHp);

    ctx.font = "bold 16px Arial";
    ctx.textAlign = "right";
    ctx.fillStyle = "#222";
    ctx.fillText("PLAYER HEALTH", barX + barWidth, barY - 6);

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#111";
    ctx.fillText(
      player.hp + " / " + maxPlayerHp,
      barX + barWidth / 2,
      barY + 17
    );
  }

  function drawGooglyEye(x: number, y: number, radius: number, pupilOffsetX: number, pupilOffsetY: number) {
    ctx.save();

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(
      x + pupilOffsetX,
      y + pupilOffsetY,
      radius * 0.42,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  function drawWinScreen() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Notebook lines stay visible for the victory screen.
    ctx.strokeStyle = "rgba(120,170,255,0.25)";
    ctx.lineWidth = 1;

    for (let y = 40; y < canvas.height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#111";
    ctx.font = "bold 58px Arial";
    ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2 - 35);

    ctx.font = "bold 26px Arial";
    ctx.fillText(
      "1000 Dark Matter defeated!",
      canvas.width / 2,
      canvas.height / 2 + 25
    );

    ctx.font = "22px Arial";
    ctx.fillText(
      "Press R to play again",
      canvas.width / 2,
      canvas.height / 2 + 75
    );

    ctx.textBaseline = "alphabetic";
  }

  function drawGameOverScreen() {
    // The entire game turns black until the player restarts.
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Arial";

    const message = "The Dark Matter Wins";
    ctx.fillText(message, centerX, centerY);

    // Measure the words so each googly eye can sit above the requested word.
    const fullWidth = ctx.measureText(message).width;
    const theWidth = ctx.measureText("The").width;
    const beforeWinsWidth = ctx.measureText("The Dark Matter ").width;
    const winsWidth = ctx.measureText("Wins").width;

    const leftEdge = centerX - fullWidth / 2;

    const theCenterX = leftEdge + theWidth / 2;
    const winsCenterX = leftEdge + beforeWinsWidth + winsWidth / 2;
    const eyeY = centerY - 58;

    drawGooglyEye(theCenterX, eyeY - 6, 22, 5, 3);
    drawGooglyEye(winsCenterX, eyeY - 6, 22, -5, 3);

    ctx.font = "24px Arial";
    ctx.fillStyle = "#d1d5db";
    ctx.fillText("Press R to restart", centerX, centerY + 58);

    ctx.textBaseline = "alphabetic";
  }

  function draw() {
    if (gameWon) {
      drawWinScreen();
      return;
    }

    if (gameOver) {
      drawGameOverScreen();
      return;
    }

    drawPaperBackground();
    drawPath();
    drawVillageEntrance();
    drawShop();
    drawDarkCloud();

    monsters.forEach(drawMonster);
    drawBananaBoss();
    drawAndrewsous();

    helpers.forEach(drawHelper);
    drawPlayer();
    drawThrownCleaver();
    drawParticles();
    drawHUD();
  }

  function handleKeyDown(e: KeyboardEvent) {
    keys[e.key.toLowerCase()] = true;

    if (e.code === "Space") {
      keys["space"] = true;
      e.preventDefault();
    }

    if (
      e.key.toLowerCase() === "t" &&
      !gameOver &&
      !gameWon &&
      !thrownCleaver.active
    ) {
      throwCleaver();
    }

    if (e.key === "1") {
      buySwordUpgrade();
    }

    if (e.key === "2") {
      buyShieldUpgrade();
    }

    if ((gameOver || gameWon) && e.key.toLowerCase() === "r") {
      resetGame();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.key.toLowerCase()] = false;

    if (e.code === "Space") {
      keys["space"] = false;
    }
  }


  function loop() {
    if (destroyed) {
      return
    }

    update()
    draw()
    animationFrameId = requestAnimationFrame(loop)
  }

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

  loop()

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(animationFrameId)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    },
    restart: resetGame,
  }
}
