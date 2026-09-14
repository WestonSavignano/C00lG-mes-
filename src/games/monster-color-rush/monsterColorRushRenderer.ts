import { getMonsterColorIndex, type WaveObject } from './monsterColorRushLogic'

export type RenderCircle = {
  x: number
  y: number
  radius: number
}

export type RenderMonster = RenderCircle & {
  speed: number
  shape: number
  wobble: number
}

export type RenderParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

type RenderFrameOptions = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  player: RenderCircle
  monster: RenderMonster
  objects: readonly WaveObject[]
  particles: readonly RenderParticle[]
  wave: number
  colors: readonly { hex: string }[]
  reducedMotion: boolean
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#29315b')
  gradient.addColorStop(0.55, '#171d3b')
  gradient.addColorStop(1, '#0d1021')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#ffffff'
  for (let x = 0; x < width; x += 55) {
    for (let y = 84; y < height; y += 55) {
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function drawArena(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,.18)'
  ctx.lineWidth = 3
  ctx.setLineDash([12, 18])
  ctx.strokeRect(30, 74, Math.max(0, width - 60), Math.max(0, height - 104))
  ctx.restore()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: RenderCircle,
  reducedMotion: boolean,
) {
  ctx.save()
  ctx.translate(player.x, player.y)
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = reducedMotion ? 7 : 18
  ctx.fillStyle = '#f5f5f5'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#303758'
  ctx.beginPath()
  ctx.arc(-7, -4, 4, 0, Math.PI * 2)
  ctx.arc(7, -4, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#303758'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 5, 9, 0, Math.PI)
  ctx.stroke()
  ctx.restore()
}

function drawMonsterShape(
  ctx: CanvasRenderingContext2D,
  monster: RenderMonster,
) {
  const r = monster.radius
  const number = monster.shape

  if (number === 1) {
    ctx.beginPath()
    ctx.moveTo(-r, 30)
    ctx.quadraticCurveTo(-r * 1.25, -20, -35, -r)
    ctx.quadraticCurveTo(0, -r * 1.3, 35, -r)
    ctx.quadraticCurveTo(r * 1.25, -20, r, 30)
    ctx.quadraticCurveTo(30, r * 1.2, 0, r)
    ctx.quadraticCurveTo(-30, r * 1.2, -r, 30)
    ctx.closePath()
  } else if (number === 2) {
    ctx.beginPath()
    for (let index = 0; index < 16; index += 1) {
      const angle = (index * Math.PI * 2) / 16
      const radius = index % 2 === 0 ? r * 1.3 : r * 0.75
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else if (number === 3) {
    ctx.beginPath()
    ctx.roundRect(-r, -r * 0.7, r * 2, r * 1.4, 20)
  } else if (number === 4) {
    ctx.beginPath()
    ctx.moveTo(-r, 0)
    ctx.quadraticCurveTo(-r * 1.7, -r, -r * 1.8, 0)
    ctx.quadraticCurveTo(-r * 1.7, r, -r, 25)
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.moveTo(r, 0)
    ctx.quadraticCurveTo(r * 1.7, -r, r * 1.8, 0)
    ctx.quadraticCurveTo(r * 1.7, r, r, 25)
  } else if (number === 5) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.moveTo(-r * 0.4, r)
    ctx.quadraticCurveTo(-r, r * 1.5, -r * 0.7, r * 2)
    ctx.quadraticCurveTo(-r * 0.3, r * 2.3, 0, r * 1.7)
  } else if (number === 6) {
    ctx.beginPath()
    ctx.moveTo(-r, 20)
    ctx.quadraticCurveTo(-r * 1.2, -r, 0, -r * 1.15)
    ctx.quadraticCurveTo(r * 1.2, -r, r, 20)
    ctx.quadraticCurveTo(0, r * 1.25, -r, 20)
    ctx.closePath()
  } else if (number === 7) {
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.4)
    ctx.lineTo(r * 0.9, -r * 0.4)
    ctx.lineTo(r * 0.7, r)
    ctx.lineTo(0, r * 1.35)
    ctx.lineTo(-r * 0.7, r)
    ctx.lineTo(-r * 0.9, -r * 0.4)
    ctx.closePath()
  } else if (number === 8) {
    ctx.beginPath()
    ctx.moveTo(-r, r)
    ctx.quadraticCurveTo(-r * 1.3, -r, 0, -r * 1.4)
    ctx.quadraticCurveTo(r * 1.3, -r, r, r)
    ctx.quadraticCurveTo(0, r * 0.7, -r, r)
    ctx.closePath()
  } else if (number === 9) {
    ctx.beginPath()
    ctx.moveTo(-r, r)
    ctx.lineTo(-r * 0.8, -r * 0.2)
    ctx.lineTo(-r * 0.4, -r * 0.8)
    ctx.lineTo(0, -r * 1.4)
    ctx.lineTo(r * 0.35, -r * 0.75)
    ctx.lineTo(r * 0.8, -r)
    ctx.lineTo(r, r)
    ctx.closePath()
  } else if (number === 10) {
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.8, r * 1.25, 0, 0, Math.PI * 2)
  } else if (number === 11) {
    ctx.beginPath()
    ctx.roundRect(-r * 1.25, -r, r * 2.5, r * 2, 28)
  } else {
    ctx.beginPath()
    for (let index = 0; index < 20; index += 1) {
      const angle = (index * Math.PI * 2) / 20
      const radius = index % 2 === 0 ? r * 1.45 : r * 0.8
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
}

function drawMonster(
  ctx: CanvasRenderingContext2D,
  monster: RenderMonster,
  wave: number,
  colors: readonly { hex: string }[],
  reducedMotion: boolean,
) {
  const color = colors[getMonsterColorIndex(wave)]?.hex ?? '#ff4054'
  const wobbleAmount = reducedMotion ? 1.25 : 4
  const wobbleX = Math.sin(monster.wobble) * wobbleAmount
  const wobbleY = Math.cos(monster.wobble * 0.8) * wobbleAmount

  ctx.save()
  ctx.translate(monster.x + wobbleX, monster.y + wobbleY)
  ctx.fillStyle = color
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 7
  ctx.shadowColor = color
  ctx.shadowBlur = reducedMotion ? 10 : 35
  drawMonsterShape(ctx, monster)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(-20, -10, 13, 0, Math.PI * 2)
  ctx.arc(20, -10, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.arc(-18, -8, 5, 0, Math.PI * 2)
  ctx.arc(18, -8, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#24101c'
  ctx.beginPath()
  ctx.arc(0, 22, 25, 0, Math.PI)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  object: WaveObject,
  colors: readonly { hex: string }[],
  reducedMotion: boolean,
) {
  const color = colors[object.colorIndex]?.hex ?? '#ffffff'
  const size = object.radius + Math.sin(object.pulse) * 3

  ctx.save()
  ctx.translate(object.x, object.y)
  ctx.rotate(object.rotation)
  ctx.fillStyle = color
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 5
  ctx.shadowColor = color
  ctx.shadowBlur = reducedMotion ? 7 : 22

  if (object.type === 0) {
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(size, -size / 2)
    ctx.lineTo(size * 0.7, size)
    ctx.lineTo(-size * 0.7, size)
    ctx.lineTo(-size, -size / 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (object.type === 1) {
    ctx.fillRect(-size, -size, size * 2, size * 2)
    ctx.strokeRect(-size, -size, size * 2, size * 2)
    ctx.beginPath()
    ctx.moveTo(-size, -size)
    ctx.lineTo(size, size)
    ctx.moveTo(size, -size)
    ctx.lineTo(-size, size)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.arc(-size / 3, -size / 3, size / 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly RenderParticle[],
  reducedMotion: boolean,
) {
  for (const particle of particles) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.life))
    ctx.fillStyle = particle.color
    if (!reducedMotion) {
      ctx.shadowColor = particle.color
      ctx.shadowBlur = 14
    }
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function drawMonsterColorRushFrame({
  ctx,
  width,
  height,
  player,
  monster,
  objects,
  particles,
  wave,
  colors,
  reducedMotion,
}: RenderFrameOptions) {
  drawBackground(ctx, width, height)
  drawArena(ctx, width, height)
  for (const object of objects) {
    if (!object.collected) drawObject(ctx, object, colors, reducedMotion)
  }
  drawMonster(ctx, monster, wave, colors, reducedMotion)
  drawPlayer(ctx, player, reducedMotion)
  drawParticles(ctx, particles, reducedMotion)
}
