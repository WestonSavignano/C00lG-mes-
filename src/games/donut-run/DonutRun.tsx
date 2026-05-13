import { useCallback, useRef, useState } from 'react'
import type { GameObjects, Physics } from 'phaser'
import GameViewport from '../shared/GameViewport'
import usePhaserGame from '../shared/usePhaserGame'

const GAME_WIDTH = 960
const GAME_HEIGHT = 540
const FLOOR_Y = 456
const PLAYER_X = 180
const PLAYER_SIZE = 54
const GRAVITY = 2200
const JUMP_VELOCITY = -800
const START_SPEED = 430
const MAX_SPEED = 760
const BEST_SCORE_STORAGE_KEY = 'donutDashBestScore'

type GameStatus = 'menu' | 'running' | 'dead'

type PlatformObject = GameObjects.Rectangle & {
  body: Physics.Arcade.Body
  shine?: GameObjects.Rectangle
}

type GroundTile = GameObjects.Rectangle & {
  body: Physics.Arcade.Body
}

type PhysicsSprite = Physics.Arcade.Sprite & {
  usedUntil?: number
}

function DonutRun() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const createGame = useCallback(
    (PhaserRuntime: typeof import('phaser'), parent: HTMLDivElement) => {
      class DonutDashScene extends PhaserRuntime.Scene {
        private status: GameStatus = 'menu'
        private speed = START_SPEED
        private score = 0
        private bestScore = 0
        private distanceSinceLastSpawn = 0
        private nextSpawnDistance = 480
        private spawnIndex = 0

        private background!: GameObjects.Graphics
        private player!: Physics.Arcade.Sprite
        private ground!: Physics.Arcade.Group
        private floor?: Physics.Arcade.StaticBody
        private platforms!: Physics.Arcade.Group
        private hazards!: Physics.Arcade.Group
        private jumpPads!: Physics.Arcade.Group
        private decorations!: GameObjects.Group
        private crumbs!: GameObjects.Particles.ParticleEmitter

        private titleText!: GameObjects.Text
        private subtitleText!: GameObjects.Text
        private ctaText!: GameObjects.Text
        private scoreText!: GameObjects.Text
        private bestText!: GameObjects.Text
        private gameOverText!: GameObjects.Text
        private restartText!: GameObjects.Text

        constructor() {
          super('DonutDashScene')
        }

        create() {
          this.bestScore = this.readBestScore()

          this.createTextures()
          this.createWorld()
          this.createPlayer()
          this.createHud()
          this.createInput()
          this.showMenu()
        }

        update(_: number, deltaMs: number) {
          const deltaSeconds = deltaMs / 1000

          this.animateMenu(deltaSeconds)

          if (this.status !== 'running') {
            return
          }

          this.score += deltaSeconds * 10
          this.scoreText.setText(String(Math.floor(this.score)))
          this.speed = Math.min(MAX_SPEED, START_SPEED + this.score * 3.4)

          this.keepPlayerAnchored()
          this.updatePlayerRotation(deltaSeconds)
          this.updateScrollingObjects(deltaSeconds)
          this.recycleGround()
          this.spawnLevelPieces(deltaSeconds)
          this.cleanupObjects()
          this.checkFallDeath()
        }

        private readBestScore(): number {
          if (typeof window === 'undefined') {
            return 0
          }

          const rawScore = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY)
          const parsedScore = Number(rawScore ?? 0)

          return Number.isFinite(parsedScore) ? parsedScore : 0
        }

        private saveBestScore(score: number) {
          if (typeof window === 'undefined') {
            return
          }

          window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score))
        }

        private createTextures() {
          this.createDonutTexture()
          this.createSpikeTexture()
          this.createJumpPadTexture()
          this.createParticleTexture()
        }

        private createDonutTexture() {
          const graphics = this.make.graphics({ x: 0, y: 0 })

          graphics.fillStyle(0xc87b26, 1)
          graphics.fillCircle(64, 64, 54)
          graphics.fillStyle(0xf6b35a, 1)
          graphics.fillCircle(64, 64, 45)

          graphics.fillStyle(0xff7ab8, 1)
          graphics.beginPath()
          graphics.arc(64, 64, 42, PhaserRuntime.Math.DegToRad(205), PhaserRuntime.Math.DegToRad(345), false)
          graphics.arc(64, 64, 23, PhaserRuntime.Math.DegToRad(345), PhaserRuntime.Math.DegToRad(205), true)
          graphics.closePath()
          graphics.fillPath()

          graphics.fillStyle(0x151525, 1)
          graphics.fillCircle(64, 64, 20)
          graphics.lineStyle(4, 0x7a3e16, 0.55)
          graphics.strokeCircle(64, 64, 53)
          graphics.lineStyle(3, 0x8d4a1b, 0.45)
          graphics.strokeCircle(64, 64, 21)

          const sprinkles: Array<[number, number, number, number]> = [
            [42, 43, 0xffffff, 25],
            [55, 33, 0x49d7ff, -20],
            [78, 37, 0xfff166, 18],
            [91, 52, 0x91ff6e, -35],
            [38, 76, 0x91ff6e, -12],
            [50, 91, 0x49d7ff, 33],
            [81, 91, 0xffffff, -24],
            [96, 76, 0xfff166, 16],
            [35, 60, 0xfff166, -38],
          ]

          for (const [x, y, color, rotation] of sprinkles) {
            graphics.save()
            graphics.translateCanvas(x, y)
            graphics.rotateCanvas(PhaserRuntime.Math.DegToRad(rotation))
            graphics.fillStyle(color, 1)
            graphics.fillRoundedRect(-8, -2, 16, 4, 2)
            graphics.restore()
          }

          graphics.generateTexture('donut', 128, 128)
          graphics.destroy()
        }

        private createSpikeTexture() {
          const graphics = this.make.graphics({ x: 0, y: 0 })

          graphics.fillStyle(0xf4f4ff, 1)
          graphics.beginPath()
          graphics.moveTo(0, 64)
          graphics.lineTo(32, 0)
          graphics.lineTo(64, 64)
          graphics.closePath()
          graphics.fillPath()
          graphics.lineStyle(4, 0x0f1020, 0.55)
          graphics.strokeTriangle(0, 64, 32, 0, 64, 64)
          graphics.generateTexture('spike', 64, 64)
          graphics.destroy()
        }

        private createJumpPadTexture() {
          const graphics = this.make.graphics({ x: 0, y: 0 })

          graphics.fillStyle(0x2cf6ff, 1)
          graphics.fillRoundedRect(0, 12, 80, 24, 12)
          graphics.fillStyle(0xffffff, 0.85)
          graphics.fillRoundedRect(12, 18, 56, 8, 4)
          graphics.lineStyle(3, 0x0f1020, 0.4)
          graphics.strokeRoundedRect(0, 12, 80, 24, 12)
          graphics.generateTexture('jump-pad', 80, 48)
          graphics.destroy()
        }

        private createParticleTexture() {
          const graphics = this.make.graphics({ x: 0, y: 0 })

          graphics.fillStyle(0xffd166, 1)
          graphics.fillCircle(8, 8, 8)
          graphics.generateTexture('crumb', 16, 16)
          graphics.destroy()
        }

        private createWorld() {
          this.background = this.add.graphics()
          this.drawBackground()

          this.ground = this.physics.add.group({ allowGravity: false, immovable: true })
          this.platforms = this.physics.add.group({ allowGravity: false, immovable: true })
          this.hazards = this.physics.add.group({ allowGravity: false, immovable: true })
          this.jumpPads = this.physics.add.group({ allowGravity: false, immovable: true })
          this.decorations = this.add.group()

          this.createGroundTiles()

          const floor = this.add.rectangle(
            GAME_WIDTH / 2,
            FLOOR_Y + 36,
            GAME_WIDTH + 400,
            72,
            0x000000,
            0,
          )
          this.physics.add.existing(floor, true)
          this.floor = floor.body as Physics.Arcade.StaticBody
          this.floor.setSize(GAME_WIDTH + 400, 72, true)

          this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT)
        }

        private drawBackground() {
          this.background.clear()
          this.background.fillGradientStyle(0x191933, 0x191933, 0x302054, 0x151525, 1)
          this.background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

          this.background.lineStyle(1, 0xffffff, 0.06)
          for (let x = 0; x <= GAME_WIDTH; x += 48) {
            this.background.lineBetween(x, 0, x, GAME_HEIGHT)
          }

          for (let y = 0; y <= GAME_HEIGHT; y += 48) {
            this.background.lineBetween(0, y, GAME_WIDTH, y)
          }

          this.background.fillStyle(0xffffff, 0.08)
          for (let index = 0; index < 28; index += 1) {
            const x = (index * 149) % GAME_WIDTH
            const y = 42 + ((index * 73) % 240)
            this.background.fillCircle(x, y, 2 + (index % 3))
          }
        }

        private createGroundTiles() {
          for (let x = -64; x < GAME_WIDTH + 160; x += 64) {
            this.createGroundTile(x)
          }
        }

        private createGroundTile(x: number) {
          const tile = this.add.rectangle(x, FLOOR_Y + 36, 64, 72, 0x2bd4a8, 1) as GroundTile
          tile.setOrigin(0, 0.5)
          tile.setStrokeStyle(3, 0x111322, 0.7)

          this.physics.add.existing(tile)
          tile.body.allowGravity = false
          tile.body.immovable = true
          tile.body.setSize(64, 72, true)
          this.ground.add(tile)

          const stripe = this.add.rectangle(x + 32, FLOOR_Y + 6, 52, 10, 0x8fffe3, 0.45)
          stripe.setOrigin(0.5)
          this.decorations.add(stripe)
        }

        private createPlayer() {
          this.player = this.physics.add.sprite(PLAYER_X, FLOOR_Y - PLAYER_SIZE, 'donut')
          this.player.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
          this.player.setCircle(24, 15, 15)
          this.player.setBounce(0)
          this.player.setCollideWorldBounds(false)
          ;(this.player.body as Physics.Arcade.Body).setGravityY(GRAVITY)
          ;(this.player.body as Physics.Arcade.Body).maxVelocity.y = 1300

          this.crumbs = this.add.particles(0, 0, 'crumb', {
            lifespan: 320,
            speed: { min: 40, max: 180 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.85, end: 0 },
            quantity: 0,
            blendMode: 'ADD',
          })

          this.physics.add.collider(this.player, this.ground, () => this.handleLanding())
          if (this.floor) {
            this.physics.add.collider(this.player, this.floor.gameObject as GameObjects.Rectangle, () => this.handleLanding())
          }
          this.physics.add.collider(this.player, this.platforms, () => this.handleLanding())
          this.physics.add.overlap(this.player, this.hazards, () => this.die())
          this.physics.add.overlap(
            this.player,
            this.jumpPads,
            (_, pad) => this.hitJumpPad(pad as PhysicsSprite),
          )
        }

        private createHud() {
          this.titleText = this.add
            .text(GAME_WIDTH / 2, 108, 'DONUT DASH', {
              fontSize: '58px',
              fontStyle: '900',
              color: '#ffffff',
              stroke: '#111322',
              strokeThickness: 8,
            })
            .setOrigin(0.5)

          this.subtitleText = this.add
            .text(
              GAME_WIDTH / 2,
              176,
              'Tap, click, or press SPACE to hop the frosting gauntlet',
              {
                fontSize: '22px',
                color: '#d9ddff',
              },
            )
            .setOrigin(0.5)

          this.ctaText = this.add
            .text(GAME_WIDTH / 2, 264, 'START', {
              fontSize: '28px',
              fontStyle: '800',
              color: '#151525',
              backgroundColor: '#ffd166',
              padding: { x: 32, y: 14 },
            })
            .setOrigin(0.5)

          this.scoreText = this.add
            .text(28, 24, '0', {
              fontSize: '38px',
              fontStyle: '900',
              color: '#ffffff',
              stroke: '#111322',
              strokeThickness: 5,
            })
            .setVisible(false)

          this.bestText = this.add
            .text(28, 72, `BEST ${this.bestScore}`, {
              fontSize: '18px',
              fontStyle: '700',
              color: '#cfd4ff',
            })
            .setVisible(false)

          this.gameOverText = this.add
            .text(GAME_WIDTH / 2, 122, 'CRUMBLED', {
              fontSize: '56px',
              fontStyle: '900',
              color: '#ffffff',
              stroke: '#111322',
              strokeThickness: 8,
            })
            .setOrigin(0.5)
            .setVisible(false)

          this.restartText = this.add
            .text(
              GAME_WIDTH / 2,
              210,
              'Tap, click, or press SPACE to restart',
              {
                fontSize: '24px',
                color: '#d9ddff',
              },
            )
            .setOrigin(0.5)
            .setVisible(false)
        }

        private createInput() {
          this.input.on('pointerdown', () => this.handleAction())
          this.input.keyboard?.on('keydown-SPACE', () => this.handleAction())
          this.input.keyboard?.on('keydown-UP', () => this.handleAction())
        }

        private showMenu() {
          this.status = 'menu'
          this.physics.pause()

          this.player.setVisible(true)
          this.player.setPosition(PLAYER_X, FLOOR_Y - PLAYER_SIZE)
          this.player.setVelocity(0, 0)
          this.player.setRotation(0)

          this.titleText.setVisible(true)
          this.subtitleText.setVisible(true)
          this.ctaText.setVisible(true)
          this.scoreText.setVisible(false)
          this.bestText.setVisible(false)
          this.gameOverText.setVisible(false)
          this.restartText.setVisible(false)
        }

        private startGame() {
          this.status = 'running'
          this.physics.resume()
          this.speed = START_SPEED
          this.score = 0
          this.distanceSinceLastSpawn = 0
          this.nextSpawnDistance = 520
          this.spawnIndex = 0

          this.clearLevelObjects()

          this.player.setVisible(true)
          this.player.setAlpha(1)
          this.player.setScale(1)
          this.player.setPosition(PLAYER_X, FLOOR_Y - PLAYER_SIZE)
          this.player.setVelocity(0, 0)
          this.player.setRotation(0)
          ;(this.player.body as Physics.Arcade.Body).enable = true

          this.titleText.setVisible(false)
          this.subtitleText.setVisible(false)
          this.ctaText.setVisible(false)
          this.gameOverText.setVisible(false)
          this.restartText.setVisible(false)
          this.scoreText.setVisible(true).setText('0')
          this.bestText.setVisible(true).setText(`BEST ${this.bestScore}`)
        }

        private clearLevelObjects() {
          this.platforms.clear(true, true)
          this.hazards.clear(true, true)
          this.jumpPads.clear(true, true)

          for (const child of this.decorations.getChildren()) {
            const rectangle = child as GameObjects.Rectangle
            if (rectangle.width !== 52) {
              rectangle.destroy()
            }
          }
        }

        private handleAction() {
          if (this.status === 'menu' || this.status === 'dead') {
            this.startGame()
            return
          }

          this.jump()
        }

        private jump() {
          if (this.status !== 'running') {
            return
          }

          const onGround =
            (this.player.body as Physics.Arcade.Body).blocked.down ||
            (this.player.body as Physics.Arcade.Body).touching.down
          if (!onGround) {
            return
          }

          this.player.setVelocityY(JUMP_VELOCITY)
          this.crumbs.emitParticleAt(this.player.x - 18, this.player.y + 24, 12)
        }

        private handleLanding() {
          if (this.status !== 'running') {
            return
          }

          this.player.setAngularVelocity(0)
          this.player.rotation = PhaserRuntime.Math.Angle.Wrap(this.player.rotation)
        }

        private hitJumpPad(pad: PhysicsSprite) {
          if (this.status !== 'running') {
            return
          }

          if (pad.usedUntil && this.time.now < pad.usedUntil) {
            return
          }

          pad.usedUntil = this.time.now + 300
          this.player.setVelocityY(JUMP_VELOCITY * 1.18)
          this.crumbs.emitParticleAt(pad.x, pad.y, 18)

          this.tweens.add({
            targets: pad,
            scaleX: 1.18,
            scaleY: 0.72,
            duration: 80,
            yoyo: true,
            ease: 'Quad.easeOut',
          })
        }

        private die() {
          if (this.status !== 'running') {
            return
          }

          this.status = 'dead'
          this.physics.pause()
          ;(this.player.body as Physics.Arcade.Body).enable = false
          this.crumbs.emitParticleAt(this.player.x, this.player.y, 38)

          this.bestScore = Math.max(this.bestScore, Math.floor(this.score))
          this.saveBestScore(this.bestScore)
          this.bestText.setText(`BEST ${this.bestScore}`)

          this.tweens.add({
            targets: this.player,
            alpha: 0,
            scaleX: 1.35,
            scaleY: 1.35,
            angle: this.player.angle + 240,
            duration: 280,
            ease: 'Quad.easeOut',
          })

          this.gameOverText.setVisible(true)
          this.restartText.setVisible(true)
        }

        private animateMenu(deltaSeconds: number) {
          if (this.status !== 'menu') {
            return
          }

          this.player.rotation += deltaSeconds * 1.2
          this.player.y = FLOOR_Y - PLAYER_SIZE + Math.sin(this.time.now / 280) * 8
        }

        private keepPlayerAnchored() {
          this.player.x = PLAYER_X
          this.player.setVelocityX(0)
        }

        private updatePlayerRotation(deltaSeconds: number) {
          const onGround =
            (this.player.body as Physics.Arcade.Body).blocked.down ||
            (this.player.body as Physics.Arcade.Body).touching.down
          this.player.rotation += deltaSeconds * (onGround ? 3.4 : 8.8)
        }

        private updateScrollingObjects(deltaSeconds: number) {
          const dx = this.speed * deltaSeconds

          for (const group of [this.ground, this.platforms, this.hazards, this.jumpPads]) {
            for (const child of group.getChildren()) {
              const gameObject = child as GameObjects.GameObject & {
                x: number
                body?: Physics.Arcade.Body
              }

              gameObject.x -= dx
              gameObject.body?.updateFromGameObject()
            }
          }

          for (const child of this.decorations.getChildren()) {
            const decoration = child as GameObjects.GameObject & { x: number }
            decoration.x -= dx
          }
        }

        private recycleGround() {
          let maxTileX = -Infinity

          for (const child of this.ground.getChildren()) {
            const tile = child as GroundTile
            maxTileX = Math.max(maxTileX, tile.x)
          }

          for (const child of this.ground.getChildren()) {
            const tile = child as GroundTile

            if (tile.x < -96) {
              tile.x = maxTileX + 64
              tile.body.updateFromGameObject()
              maxTileX = tile.x
            }
          }

          let maxStripeX = -Infinity

          for (const child of this.decorations.getChildren()) {
            const decoration = child as GameObjects.Rectangle
            if (decoration.width === 52) {
              maxStripeX = Math.max(maxStripeX, decoration.x)
            }
          }

          for (const child of this.decorations.getChildren()) {
            const decoration = child as GameObjects.Rectangle

            if (decoration.width === 52 && decoration.x < -64) {
              decoration.x = maxStripeX + 64
              maxStripeX = decoration.x
            }
          }
        }

        private spawnLevelPieces(deltaSeconds: number) {
          this.distanceSinceLastSpawn += this.speed * deltaSeconds

          if (this.distanceSinceLastSpawn < this.nextSpawnDistance) {
            return
          }

          this.distanceSinceLastSpawn = 0
          this.nextSpawnDistance = PhaserRuntime.Math.Between(360, 660)
          this.spawnIndex += 1

          const pattern = this.spawnIndex % 8

          switch (pattern) {
            case 0:
              this.spawnSingleSpike()
              break
            case 1:
              this.spawnDoubleSpike()
              break
            case 2:
              this.spawnLowBlockWithSpike()
              break
            case 3:
              this.spawnJumpPadGap()
              break
            case 4:
              this.spawnTripleSpike()
              break
            case 5:
              this.spawnFloatingPlatformRun()
              break
            case 6:
              this.spawnStaggeredBlocks()
              break
            case 7:
              this.spawnMixedHazard()
              break
            default:
              this.spawnSingleSpike()
              break
          }
        }

        private spawnSingleSpike() {
          this.addSpike(GAME_WIDTH + 80, FLOOR_Y - 32)
        }

        private spawnDoubleSpike() {
          this.addSpike(GAME_WIDTH + 80, FLOOR_Y - 32)
          this.addSpike(GAME_WIDTH + 138, FLOOR_Y - 32)
        }

        private spawnTripleSpike() {
          this.addSpike(GAME_WIDTH + 80, FLOOR_Y - 32)
          this.addSpike(GAME_WIDTH + 138, FLOOR_Y - 32)
          this.addSpike(GAME_WIDTH + 196, FLOOR_Y - 32)
        }

        private spawnLowBlockWithSpike() {
          this.addPlatform(GAME_WIDTH + 100, FLOOR_Y - 34, 112, 52)
          this.addSpike(GAME_WIDTH + 248, FLOOR_Y - 32)
        }

        private spawnJumpPadGap() {
          this.addJumpPad(GAME_WIDTH + 86, FLOOR_Y - 20)
          this.addSpike(GAME_WIDTH + 250, FLOOR_Y - 32)
          this.addSpike(GAME_WIDTH + 308, FLOOR_Y - 32)
        }

        private spawnFloatingPlatformRun() {
          this.addPlatform(GAME_WIDTH + 80, FLOOR_Y - 126, 170, 34)
          this.addSpike(GAME_WIDTH + 318, FLOOR_Y - 32)
        }

        private spawnStaggeredBlocks() {
          this.addPlatform(GAME_WIDTH + 82, FLOOR_Y - 28, 78, 44)
          this.addPlatform(GAME_WIDTH + 220, FLOOR_Y - 88, 96, 34)
          this.addSpike(GAME_WIDTH + 390, FLOOR_Y - 32)
        }

        private spawnMixedHazard() {
          this.addSpike(GAME_WIDTH + 74, FLOOR_Y - 32)
          this.addPlatform(GAME_WIDTH + 186, FLOOR_Y - 72, 120, 42)
          this.addSpike(GAME_WIDTH + 370, FLOOR_Y - 32)
          this.addJumpPad(GAME_WIDTH + 470, FLOOR_Y - 20)
        }

        private addSpike(x: number, y: number) {
          const spike = this.physics.add.sprite(x, y, 'spike')
          spike.setOrigin(0.5, 0.5)
          spike.body.allowGravity = false
          spike.body.immovable = true
          spike.body.setSize(40, 50, true)
          this.hazards.add(spike)
        }

        private addPlatform(x: number, y: number, width: number, height: number) {
          const platform = this.add.rectangle(x, y, width, height, 0x7c5cff, 1) as PlatformObject
          platform.setOrigin(0.5, 0.5)
          platform.setStrokeStyle(3, 0x111322, 0.7)

          this.physics.add.existing(platform)
          platform.body.allowGravity = false
          platform.body.immovable = true
          platform.body.setSize(width, height, true)
          this.platforms.add(platform)

          const shine = this.add.rectangle(x, y - height / 2 + 7, width - 18, 7, 0xffffff, 0.22)
          shine.setOrigin(0.5, 0.5)
          this.decorations.add(shine)
          platform.shine = shine
        }

        private addJumpPad(x: number, y: number) {
          const pad = this.physics.add.sprite(x, y, 'jump-pad') as PhysicsSprite
          pad.setOrigin(0.5, 0.5)
          ;(pad.body as Physics.Arcade.Body).allowGravity = false
          ;(pad.body as Physics.Arcade.Body).immovable = true
          ;(pad.body as Physics.Arcade.Body).setSize(72, 24, true)
          this.jumpPads.add(pad)
        }

        private cleanupObjects() {
          for (const group of [this.platforms, this.hazards, this.jumpPads]) {
            for (const child of group.getChildren()) {
              const gameObject = child as GameObjects.GameObject & { x: number; destroy: () => void }

              if (gameObject.x < -180) {
                const maybePlatform = gameObject as PlatformObject
                maybePlatform.shine?.destroy()
                gameObject.destroy()
              }
            }
          }

          for (const child of this.decorations.getChildren()) {
            const decoration = child as GameObjects.Rectangle

            if (decoration.x < -180 && decoration.width !== 52) {
              decoration.destroy()
            }
          }
        }

        private checkFallDeath() {
          if (this.player.y > GAME_HEIGHT + 80) {
            this.die()
          }
        }
      }

      return new PhaserRuntime.Game({
        type: PhaserRuntime.AUTO,
        parent,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: '#151525',
        scale: {
          mode: PhaserRuntime.Scale.FIT,
          autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scene: DonutDashScene,
      })
    },
    [],
  )

  const handleReady = useCallback(() => {
    setEngineStatus('ready')
  }, [])

  const handleError = useCallback(() => {
    setEngineStatus('error')
  }, [])

  usePhaserGame(stageRef, createGame, {
    onError: handleError,
    onReady: handleReady,
  })

  return (
    <GameViewport game="donut-run" label="Donut Dash arcade game" ref={stageRef}>
      {engineStatus === 'loading' ? (
        <div className="game-loading">Loading Phaser engine...</div>
      ) : null}
      {engineStatus === 'error' ? (
        <div className="game-loading">Phaser could not start.</div>
      ) : null}
    </GameViewport>
  )
}

export default DonutRun
