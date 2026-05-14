import { useEffect, useRef, useState } from "react";
import GameViewport from "../shared/GameViewport";
import type { HudState, Point } from "./wormBattlesLogic";
import {
  AI_COUNT,
  PLAYER_ID,
  WORLD,
  clamp,
  chooseAiAngle,
  createInitialGame,
  distSq,
  drawFood,
  drawGrid,
  drawWorm,
  explodeWormToFood,
  growWorm,
  lerpAngle,
  makeFood,
  makeWorm,
  moveWorm,
} from "./wormBattlesLogic";

function WormBattles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef(createInitialGame());
  const pointerRef = useRef<Point>({ x: 0, y: 0 });
  const cameraRef = useRef<Point>({ x: WORLD.width / 2, y: WORLD.height / 2 });
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastHudRef = useRef<number>(0);
  const bestRef = useRef<number>(Number(localStorage.getItem("worm-arena-best") ?? 0));

  const [hud, setHud] = useState<HudState>({
    score: 0,
    best: bestRef.current,
    length: 180,
    rank: 1,
    worms: AI_COUNT + 1,
    status: "playing",
  });

  const resetGame = () => {
    gameRef.current = createInitialGame();
    cameraRef.current = { x: WORLD.width / 2, y: WORLD.height / 2 };
    setHud((current) => ({ ...current, score: 0, length: 180, status: "playing", worms: AI_COUNT + 1 }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    };

    const handlePointerMove = (event: PointerEvent) => updatePointer(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updatePointer(touch.clientX, touch.clientY);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r" || event.key === " ") resetGame();
    };

    resize();
    const rect = canvas.getBoundingClientRect();
    pointerRef.current = { x: rect.width / 2 + 160, y: rect.height / 2 };

    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    const frame = (now: number) => {
      const game = gameRef.current;
      const dtScale = clamp((now - lastTimeRef.current) / 16.67, 0.35, 2.1);
      lastTimeRef.current = now;

      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const player = game.worms.find((worm) => worm.id === PLAYER_ID)!;
      const aliveWorms = game.worms.filter((worm) => worm.alive);

      if (game.status === "playing") {
        for (const worm of aliveWorms) {
          let angle = worm.angle;

          if (worm.isPlayer) {
            const pointer = pointerRef.current;
            const targetScreen = { x: pointer.x - canvasWidth / 2, y: pointer.y - canvasHeight / 2 };
            const desired = Math.atan2(targetScreen.y, targetScreen.x);
            angle = lerpAngle(worm.angle, desired, 0.13);
          } else {
            angle = chooseAiAngle(worm, game.foods, player);
          }

          moveWorm(worm, angle, dtScale);
        }

        for (const worm of aliveWorms) {
          const head = worm.segments[0];
          for (let index = game.foods.length - 1; index >= 0; index -= 1) {
            const food = game.foods[index];
            const eatDistance = worm.radius + food.r + 2;
            if (distSq(head, food) <= eatDistance * eatDistance) {
              growWorm(worm, food.value * (worm.isPlayer ? 1.55 : 1.05));
              if (worm.isPlayer) game.score += food.value;
              game.foods[index] = makeFood();
            }
          }
        }

        const defeated = new Set<string>();
        const currentAlive = game.worms.filter((worm) => worm.alive);

        for (const attacker of currentAlive) {
          if (defeated.has(attacker.id)) continue;
          const head = attacker.segments[0];

          for (const defender of currentAlive) {
            if (attacker.id === defender.id || defeated.has(defender.id)) continue;

            const sampleEvery = defender.isPlayer ? 3 : 4;
            for (let i = 2; i < defender.segments.length; i += sampleEvery) {
              const segment = defender.segments[i];
              const collisionDistance = attacker.radius + defender.radius * 0.76;

              if (distSq(head, segment) <= collisionDistance * collisionDistance) {
                const attackerWins = attacker.length > defender.length * 1.06;

                if (attackerWins) {
                  defeated.add(defender.id);
                  defender.alive = false;
                  growWorm(attacker, defender.length * 0.42);
                  explodeWormToFood(defender, game.foods, attacker.isPlayer ? 1.15 : 0.85);
                  if (attacker.isPlayer) game.score += Math.round(defender.length / 4);
                } else {
                  defeated.add(attacker.id);
                  attacker.alive = false;
                  explodeWormToFood(attacker, game.foods, defender.isPlayer ? 1.15 : 0.85);
                  if (attacker.isPlayer) {
                    game.status = "dead";
                    bestRef.current = Math.max(bestRef.current, game.score);
                    localStorage.setItem("worm-arena-best", String(bestRef.current));
                  } else if (defender.isPlayer) {
                    game.score += Math.round(attacker.length / 5);
                    growWorm(defender, attacker.length * 0.24);
                  }
                }
                break;
              }
            }
          }
        }

        game.worms = game.worms.filter((worm) => worm.alive || worm.isPlayer);
        while (game.worms.filter((worm) => !worm.isPlayer).length < AI_COUNT) {
          game.worms.push(makeWorm(`ai-${Date.now()}-${Math.random().toString(16).slice(2)}`));
        }
      }

      const playerHead = player.segments[0];
      cameraRef.current = {
        x: cameraRef.current.x + (playerHead.x - cameraRef.current.x) * 0.08,
        y: cameraRef.current.y + (playerHead.y - cameraRef.current.y) * 0.08,
      };

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.save();
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.translate(canvasWidth / 2 - cameraRef.current.x, canvasHeight / 2 - cameraRef.current.y);

      drawGrid(ctx, cameraRef.current, canvasWidth, canvasHeight);
      for (const food of game.foods) drawFood(ctx, food);
      for (const worm of [...game.worms].sort((a, b) => a.length - b.length)) drawWorm(ctx, worm);

      ctx.restore();

      if (game.status === "dead") {
        ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.textAlign = "center";
        ctx.fillStyle = "#f8fafc";
        ctx.font = "800 42px Inter, system-ui, sans-serif";
        ctx.fillText("You got eaten", canvasWidth / 2, canvasHeight / 2 - 30);
        ctx.font = "600 17px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText("Press R or Space to restart", canvasWidth / 2, canvasHeight / 2 + 12);
      }

      if (now - lastHudRef.current > 150) {
        lastHudRef.current = now;
        const sorted = [...game.worms].sort((a, b) => b.length - a.length);
        const rank = sorted.findIndex((worm) => worm.id === PLAYER_ID) + 1;
        const nextBest = Math.max(bestRef.current, game.score);
        if (nextBest !== bestRef.current) {
          bestRef.current = nextBest;
          localStorage.setItem("worm-arena-best", String(bestRef.current));
        }
        setHud({
          score: game.score,
          best: bestRef.current,
          length: Math.round(player.length),
          rank,
          worms: game.worms.filter((worm) => worm.alive).length,
          status: game.status,
        });
      }

      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (

          <GameViewport game="worm-battles" label="Worm Arena">
            <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" />
          </GameViewport>

  );
}

export default WormBattles
