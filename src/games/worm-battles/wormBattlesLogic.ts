type Point = { x: number; y: number };
type Food = Point & { r: number; value: number; color: string };
type Worm = {
  id: string;
  name: string;
  isPlayer: boolean;
  segments: Point[];
  angle: number;
  length: number;
  radius: number;
  speed: number;
  color: string;
  accent: string;
  alive: boolean;
  turnBias: number;
  target?: Point;
};

type GameStatus = "playing" | "dead";

type HudState = {
  score: number;
  best: number;
  length: number;
  rank: number;
  worms: number;
  status: GameStatus;
};

const WORLD = { width: 2600, height: 1800 };
const SEGMENT_SPACING = 9;
const FOOD_COUNT = 420;
const AI_COUNT = 18;
const PLAYER_ID = "player";

const FOOD_COLORS = ["#facc15", "#fb717174", "#fa6060", "#34d399", "#c084fc", "#f97316"];
const WORM_PALETTE = [
  ["#c522b2", "#bbf7d0"],
  ["#c538f8", "#e0f2fe"],
  ["#d98bfa", "#ede9fe"],
  ["#eb71fb", "#ffe4e6"],
  ["#f916f5", "#ffedd5"],
  ["#a214b8", "#ccfbf1"], 
  ["#fa15bd", "#fef9c3"],
];

const AI_NAMES = [
  "Noodle",
  "Slinky",
  "Munch",
  "Wiggles",
  "Bitey",
  "Gobbler",
  "Andrew",
  "Chewy",
  "Squirm",
  "Ramen",
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distSq = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const lerpAngle = (from: number, to: number, amount: number) => {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * amount;
};
const randomPoint = (): Point => ({ x: rand(80, WORLD.width - 80), y: rand(80, WORLD.height - 80) });

function makeFood(): Food {
  const color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)];
  const value = Math.round(rand(3, 9));
  return { ...randomPoint(), r: rand(3.2, 6.5), value, color };
}

function makeWorm(id: string, isPlayer = false): Worm {
  const [color, accent] = isPlayer ? ["#c815e0", "#d1fae5"] : WORM_PALETTE[Math.floor(Math.random() * WORM_PALETTE.length)];
  const start = randomPoint();
  const length = isPlayer ? 180 : rand(90, 280);
  const radius = isPlayer ? 10.5 : rand(7.5, 12.5);
  const angle = rand(-Math.PI, Math.PI);
  const count = Math.max(10, Math.floor(length / SEGMENT_SPACING));
  const segments = Array.from({ length: count }, (_, index) => ({
    x: start.x - Math.cos(angle) * index * SEGMENT_SPACING,
    y: start.y - Math.sin(angle) * index * SEGMENT_SPACING,
  }));

  return {
    id,
    name: isPlayer ? "You" : AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)],
    isPlayer,
    segments,
    angle,
    length,
    radius,
    speed: isPlayer ? 3.35 : rand(2.15, 3.05),
    color,
    accent,
    alive: true,
    turnBias: rand(-0.02, 0.02),
    target: randomPoint(),
  };
}

function wrapPoint(point: Point): Point {
  let { x, y } = point;
  if (x < 0) x += WORLD.width;
  if (x > WORLD.width) x -= WORLD.width;
  if (y < 0) y += WORLD.height;
  if (y > WORLD.height) y -= WORLD.height;
  return { x, y };
}

function growWorm(worm: Worm, amount: number) {
  worm.length = clamp(worm.length + amount, 70, 1600);
}

function moveWorm(worm: Worm, angle: number, dtScale: number) {
  worm.angle = angle;
  const head = worm.segments[0];
  const nextHead = wrapPoint({
    x: head.x + Math.cos(worm.angle) * worm.speed * dtScale,
    y: head.y + Math.sin(worm.angle) * worm.speed * dtScale,
  });

  const desiredCount = Math.max(9, Math.floor(worm.length / SEGMENT_SPACING));
  const previous = worm.segments;
  const nextSegments: Point[] = [nextHead];

  for (let i = 1; i < desiredCount; i += 1) {
    const leader = nextSegments[i - 1];
    const current = previous[i] ?? previous[previous.length - 1] ?? leader;
    const dx = current.x - leader.x;
    const dy = current.y - leader.y;
    const distance = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    nextSegments.push({
      x: leader.x + (dx / distance) * SEGMENT_SPACING,
      y: leader.y + (dy / distance) * SEGMENT_SPACING,
    });
  }

  worm.segments = nextSegments;
}

function chooseAiAngle(worm: Worm, foods: Food[], player: Worm) {
  const head = worm.segments[0];
  const nearestFood = foods.reduce<Food | undefined>((best, food) => {
    if (!best) return food;
    return distSq(head, food) < distSq(head, best) ? food : best;
  }, undefined);

  const playerHead = player.segments[0];
  const playerDistance = Math.sqrt(distSq(head, playerHead));
  const canHuntPlayer = worm.length > player.length * 1.12 && playerDistance < 560;
  const shouldAvoidPlayer = player.length > worm.length * 1.05 && playerDistance < 430;

  let target = worm.target ?? randomPoint();

  if (canHuntPlayer) {
    target = playerHead;
  } else if (shouldAvoidPlayer) {
    target = { x: head.x + (head.x - playerHead.x), y: head.y + (head.y - playerHead.y) };
  } else if (nearestFood && distSq(head, nearestFood) < 520 * 520) {
    target = nearestFood;
  } else if (!worm.target || distSq(head, worm.target) < 80 * 80 || Math.random() < 0.006) {
    worm.target = randomPoint();
    target = worm.target;
  }

  const desired = Math.atan2(target.y - head.y, target.x - head.x) + worm.turnBias;
  return lerpAngle(worm.angle, desired, 0.035);
}

function createInitialGame() {
  const player = makeWorm(PLAYER_ID, true);
  player.segments = player.segments.map((segment) => ({
    x: WORLD.width / 2 + (segment.x - player.segments[0].x),
    y: WORLD.height / 2 + (segment.y - player.segments[0].y),
  }));

  return {
    worms: [player, ...Array.from({ length: AI_COUNT }, (_, index) => makeWorm(`ai-${index}`))],
    foods: Array.from({ length: FOOD_COUNT }, makeFood),
    score: 0,
    status: "playing" as GameStatus,
  };
}

function drawGrid(ctx: CanvasRenderingContext2D, camera: Point, width: number, height: number) {
  const gridSize = 80;
  const startX = Math.floor((camera.x - width / 2) / gridSize) * gridSize;
  const endX = camera.x + width / 2 + gridSize;
  const startY = Math.floor((camera.y - height / 2) / gridSize) * gridSize;
  const endY = camera.y + height / 2 + gridSize;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.13)";
  ctx.lineWidth = 1;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
}

function drawFood(ctx: CanvasRenderingContext2D, food: Food) {
  ctx.beginPath();
  ctx.shadowBlur = 14;
  ctx.shadowColor = food.color;
  ctx.fillStyle = food.color;
  ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawWorm(ctx: CanvasRenderingContext2D, worm: Worm) {
  const head = worm.segments[0];

  for (let i = worm.segments.length - 1; i >= 0; i -= 1) {
    const segment = worm.segments[i];
    const t = 1 - i / Math.max(1, worm.segments.length - 1);
    const r = worm.radius * (0.64 + t * 0.42);
    ctx.beginPath();
    ctx.fillStyle = worm.color;
    ctx.globalAlpha = worm.alive ? 0.82 + t * 0.18 : 0.35;
    ctx.arc(segment.x, segment.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.fillStyle = worm.accent;
  ctx.arc(head.x, head.y, worm.radius * 1.12, 0, Math.PI * 2);
  ctx.fill();

  const eyeOffset = worm.radius * 0.48;
  const eyeForward = worm.radius * 0.52;
  const leftEye = {
    x: head.x + Math.cos(worm.angle) * eyeForward + Math.cos(worm.angle - Math.PI / 2) * eyeOffset,
    y: head.y + Math.sin(worm.angle) * eyeForward + Math.sin(worm.angle - Math.PI / 2) * eyeOffset,
  };
  const rightEye = {
    x: head.x + Math.cos(worm.angle) * eyeForward + Math.cos(worm.angle + Math.PI / 2) * eyeOffset,
    y: head.y + Math.sin(worm.angle) * eyeForward + Math.sin(worm.angle + Math.PI / 2) * eyeOffset,
  };

  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.arc(leftEye.x, leftEye.y, Math.max(2, worm.radius * 0.19), 0, Math.PI * 2);
  ctx.arc(rightEye.x, rightEye.y, Math.max(2, worm.radius * 0.19), 0, Math.PI * 2);
  ctx.fill();

  if (!worm.isPlayer && worm.length > 240) {
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.86)";
    ctx.fillText(worm.name, head.x, head.y - worm.radius - 12);
  }
}

function explodeWormToFood(worm: Worm, foods: Food[], multiplier = 1) {
  const samples = worm.segments.filter((_, index) => index % 4 === 0).slice(0, 34);
  for (const segment of samples) {
    foods.push({
      x: segment.x + rand(-12, 12),
      y: segment.y + rand(-12, 12),
      r: rand(4, 7),
      value: Math.round(rand(5, 11) * multiplier),
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
    });
  }

  while (foods.length > FOOD_COUNT + 160) foods.shift();
}

export type { Point, Food, Worm, GameStatus, HudState };
export {
  WORLD,
  FOOD_COUNT,
  AI_COUNT,
  PLAYER_ID,
  createInitialGame,
  drawGrid,
  drawFood,
  drawWorm,
  chooseAiAngle,
  moveWorm,
  growWorm,
  explodeWormToFood,
  clamp,
  lerpAngle,
  distSq,
  makeFood,
  makeWorm,
};