import { useCallback, useRef, useState } from 'react'
import GameViewport from '../shared/GameViewport'
import usePhaserGame from '../shared/usePhaserGame'
import {
  BIT_PLANES_COMBAT,
  createInitialCombatStats,
  damagePlayer,
  destroyEnemy,
  GAME_OVER_RESTART_PROMPT,
  getEnemySpawnLane,
  isGameOver,
  type CombatStats,
} from './bitPlanesCombat'
import {
  BIT_PLANES_PLANE_TEXTURES,
  createPlaneTextureDataUri,
} from './planeAssets'

type PhaserModule = typeof import('phaser')

function BitPlanesGame() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )

  const createGame = useCallback((PhaserRuntime: PhaserModule, parent: HTMLDivElement) => {
    class BitPlanesScene extends PhaserRuntime.Scene {
      private bullets: Phaser.GameObjects.Rectangle[] = []
      private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
      private enemies: Phaser.GameObjects.Image[] = []
      private enemyBullets: Phaser.GameObjects.Rectangle[] = []
      private enemySpawnIndex = 0
      private lastPlayerHitAt = -BIT_PLANES_COMBAT.playerHitCooldownMs
      private livesText?: Phaser.GameObjects.Text
      private nextEnemyFireAt = 900
      private nextEnemySpawnAt = 0
      private player?: Phaser.GameObjects.Image
      private restartKey?: Phaser.Input.Keyboard.Key
      private scoreText?: Phaser.GameObjects.Text
      private spaceKey?: Phaser.Input.Keyboard.Key
      private stats: CombatStats = createInitialCombatStats()
      private statusText?: Phaser.GameObjects.Text

      preload() {
        BIT_PLANES_PLANE_TEXTURES.forEach((texture) => {
          this.load.svg(texture.key, createPlaneTextureDataUri(texture), {
            height: texture.height,
            width: texture.width,
          })
        })
      }

      create() {
        const { height, width } = this.scale

        this.cameras.main.setBackgroundColor('#071421')
        this.add.rectangle(width / 2, height / 2, width, height, 0x071421)

        for (let index = 0; index < 54; index += 1) {
          this.add.circle(
            PhaserRuntime.Math.Between(18, width - 18),
            PhaserRuntime.Math.Between(18, height - 18),
            PhaserRuntime.Math.FloatBetween(1, 2.5),
            0xdbeafe,
            PhaserRuntime.Math.FloatBetween(0.25, 0.8),
          )
        }

        this.add.rectangle(width / 2, height - 54, width, 8, 0x1d4ed8, 0.35)

        this.scoreText = this.add
          .text(24, 20, 'Score 0', {
            color: '#dbeafe',
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
          })
          .setDepth(4)
        this.livesText = this.add
          .text(24, 44, 'Lives 3', {
            color: '#dbeafe',
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
          })
          .setDepth(4)
        this.statusText = this.add
          .text(width / 2, height / 2, '', {
            align: 'center',
            color: '#f8fafc',
            fontFamily: 'monospace',
            fontSize: '28px',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(4)
          .setPadding(18, 14, 18, 14)
          .setBackgroundColor('rgba(15, 23, 42, 0.84)')
          .setInteractive({ useHandCursor: true })
          .setVisible(false)
        this.statusText.on('pointerdown', () => {
          if (isGameOver(this.stats)) {
            this.restartRound()
          }
        })

        const player = this.add.image(
          160,
          height / 2,
          'player-f15',
        )
        player.setDepth(2)
        this.physics.add.existing(player)

        const body = player.body as Phaser.Physics.Arcade.Body
        body.setSize(80, 34)
        body.setCollideWorldBounds(true)
        body.setDamping(true)
        body.setDrag(0.985)
        body.setMaxVelocity(330)

        this.player = player
        this.cursors = this.input.keyboard?.createCursorKeys()
        this.spaceKey = this.input.keyboard?.addKey(
          PhaserRuntime.Input.Keyboard.KeyCodes.SPACE,
        )
        this.restartKey = this.input.keyboard?.addKey(
          PhaserRuntime.Input.Keyboard.KeyCodes.R,
        )

        this.restartRound()
      }

      update(time: number) {
        if (!this.player) {
          return
        }

        const body = this.player.body as Phaser.Physics.Arcade.Body
        const turnSpeed = 0.055

        if (isGameOver(this.stats)) {
          body.setAcceleration(0)
          body.setVelocity(0)

          if (
            this.restartKey &&
            PhaserRuntime.Input.Keyboard.JustDown(this.restartKey)
          ) {
            this.restartRound()
          }

          this.cleanupObjects()
          return
        }

        if (this.cursors?.left.isDown) {
          this.player.rotation -= turnSpeed
        }

        if (this.cursors?.right.isDown) {
          this.player.rotation += turnSpeed
        }

        if (this.cursors?.up.isDown) {
          this.physics.velocityFromRotation(this.player.rotation, 260, body.acceleration)
        } else if (this.cursors?.down.isDown) {
          this.physics.velocityFromRotation(this.player.rotation, -110, body.acceleration)
        } else {
          body.setAcceleration(0)
        }

        if (
          this.spaceKey &&
          PhaserRuntime.Input.Keyboard.JustDown(this.spaceKey)
        ) {
          this.fireBullet()
        }

        this.spawnEnemies(time)
        this.updateEnemies(time)
        this.checkCombatCollisions(time)
        this.cleanupObjects()
      }

      private fireBullet() {
        if (!this.player) {
          return
        }

        const bullet = this.add.rectangle(
          this.player.x + Math.cos(this.player.rotation) * 46,
          this.player.y + Math.sin(this.player.rotation) * 46,
          14,
          4,
          0xfef08a,
        )
        bullet.rotation = this.player.rotation
        bullet.setDepth(2)
        this.physics.add.existing(bullet)

        const body = bullet.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)
        this.physics.velocityFromRotation(this.player.rotation, 540, body.velocity)
        this.bullets.push(bullet)
      }

      private spawnEnemies(time: number) {
        if (
          isGameOver(this.stats) ||
          this.enemies.length >= BIT_PLANES_COMBAT.maxEnemies ||
          time < this.nextEnemySpawnAt
        ) {
          return
        }

        this.spawnEnemy()
        this.nextEnemySpawnAt = time + BIT_PLANES_COMBAT.enemySpawnDelayMs
      }

      private spawnEnemy(xOffset = 0) {
        const y = getEnemySpawnLane(this.scale.height, this.enemySpawnIndex)
        const enemy = this.add.image(
          this.scale.width + 72 + xOffset,
          y,
          'enemy-fighter',
        )
        enemy.setDepth(1)
        this.physics.add.existing(enemy)

        const body = enemy.body as Phaser.Physics.Arcade.Body
        const speedBonus = Math.min(this.stats.score / 80, 90)
        body.setAllowGravity(false)
        body.setSize(70, 28)
        body.setVelocity(-135 - speedBonus, PhaserRuntime.Math.Between(-20, 20))

        this.enemies.push(enemy)
        this.enemySpawnIndex += 1
      }

      private updateEnemies(time: number) {
        if (isGameOver(this.stats)) {
          return
        }

        this.enemies.forEach((enemy) => {
          if (!enemy.active || !this.player) {
            return
          }

          const body = enemy.body as Phaser.Physics.Arcade.Body
          const wobble = Math.sin((time + enemy.x * 8) * 0.002) * 40
          const targetY = this.player.y + wobble
          const verticalVelocity = PhaserRuntime.Math.Clamp(
            (targetY - enemy.y) * 0.38,
            -88,
            88,
          )

          body.setVelocityY(verticalVelocity)
          enemy.rotation = PhaserRuntime.Math.Clamp(verticalVelocity / 420, -0.2, 0.2)
        })

        if (time < this.nextEnemyFireAt || this.enemies.length === 0) {
          return
        }

        const firingEnemy =
          this.enemies[this.enemySpawnIndex % this.enemies.length] ?? this.enemies[0]
        this.fireEnemyBullet(firingEnemy)
        this.nextEnemyFireAt = time + BIT_PLANES_COMBAT.enemyFireDelayMs
      }

      private fireEnemyBullet(enemy: Phaser.GameObjects.Image) {
        if (!this.player || !enemy.active) {
          return
        }

        const angle = PhaserRuntime.Math.Angle.Between(
          enemy.x,
          enemy.y,
          this.player.x,
          this.player.y,
        )
        const bullet = this.add.rectangle(
          enemy.x - 30,
          enemy.y,
          14,
          4,
          0xfb923c,
        )
        bullet.rotation = angle
        bullet.setDepth(2)
        this.physics.add.existing(bullet)

        const body = bullet.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)
        this.physics.velocityFromRotation(angle, 310, body.velocity)
        this.enemyBullets.push(bullet)
      }

      private checkCombatCollisions(time: number) {
        if (!this.player || isGameOver(this.stats)) {
          return
        }

        this.bullets.forEach((bullet) => {
          this.enemies.forEach((enemy) => {
            if (!bullet.active || !enemy.active) {
              return
            }

            const distance = PhaserRuntime.Math.Distance.Between(
              bullet.x,
              bullet.y,
              enemy.x,
              enemy.y,
            )

            if (distance > 30) {
              return
            }

            bullet.destroy()
            enemy.destroy()
            this.stats = destroyEnemy(this.stats)
            this.updateHud()
            this.addHitSpark(enemy.x, enemy.y, 0xfef08a)
          })
        })

        this.enemyBullets.forEach((bullet) => {
          if (!bullet.active || !this.player) {
            return
          }

          const distance = PhaserRuntime.Math.Distance.Between(
            bullet.x,
            bullet.y,
            this.player.x,
            this.player.y,
          )

          if (distance <= 26) {
            bullet.destroy()
            this.hitPlayer(time)
          }
        })

        this.enemies.forEach((enemy) => {
          if (!enemy.active || !this.player) {
            return
          }

          const distance = PhaserRuntime.Math.Distance.Between(
            enemy.x,
            enemy.y,
            this.player.x,
            this.player.y,
          )

          if (distance <= 38) {
            enemy.destroy()
            this.hitPlayer(time)
          }
        })
      }

      private hitPlayer(time: number) {
        if (
          isGameOver(this.stats) ||
          time - this.lastPlayerHitAt < BIT_PLANES_COMBAT.playerHitCooldownMs
        ) {
          return
        }

        this.stats = damagePlayer(this.stats)
        this.lastPlayerHitAt = time
        this.updateHud()
        this.addHitSpark(this.player?.x ?? 0, this.player?.y ?? 0, 0x67e8f9)

        this.player?.setAlpha(0.45)
        this.time.delayedCall(180, () => {
          this.player?.setAlpha(this.stats.lives > 0 ? 1 : 0.35)
        })

        if (isGameOver(this.stats)) {
          this.showGameOverPrompt()
        }
      }

      private restartRound() {
        this.clearRoundObjects()
        this.stats = createInitialCombatStats()
        this.enemySpawnIndex = 0
        this.lastPlayerHitAt = this.time.now - BIT_PLANES_COMBAT.playerHitCooldownMs
        this.nextEnemyFireAt = this.time.now + 900
        this.nextEnemySpawnAt = this.time.now + BIT_PLANES_COMBAT.enemySpawnDelayMs
        this.statusText?.setVisible(false)
        this.updateHud()

        if (this.player) {
          const body = this.player.body as Phaser.Physics.Arcade.Body
          this.player.setAlpha(1)
          this.player.setPosition(160, this.scale.height / 2)
          this.player.setRotation(0)
          body.setAcceleration(0)
          body.setVelocity(0)
        }

        this.spawnEnemy()
        this.spawnEnemy(170)
        this.spawnEnemy(340)
      }

      private showGameOverPrompt() {
        this.statusText?.setText(GAME_OVER_RESTART_PROMPT).setVisible(true)
      }

      private clearRoundObjects() {
        this.bullets.forEach((bullet) => bullet.destroy())
        this.enemyBullets.forEach((bullet) => bullet.destroy())
        this.enemies.forEach((enemy) => enemy.destroy())
        this.bullets = []
        this.enemyBullets = []
        this.enemies = []
      }

      private addHitSpark(x: number, y: number, color: number) {
        const spark = this.add.circle(x, y, 14, color, 0.65)
        spark.setDepth(3)
        this.tweens.add({
          alpha: 0,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
          scale: 1.9,
          targets: spark,
        })
      }

      private updateHud() {
        this.scoreText?.setText(`Score ${this.stats.score}`)
        this.livesText?.setText(`Lives ${this.stats.lives}`)
      }

      private cleanupObjects() {
        this.bullets = this.cleanupProjectiles(this.bullets)
        this.enemyBullets = this.cleanupProjectiles(this.enemyBullets)
        this.enemies = this.enemies.filter((enemy) => {
          const inBounds =
            enemy.active &&
            enemy.x > -90 &&
            enemy.x < this.scale.width + 140 &&
            enemy.y > -90 &&
            enemy.y < this.scale.height + 90

          if (!inBounds && enemy.active) {
            enemy.destroy()
          }

          return inBounds
        })
      }

      private cleanupProjectiles(projectiles: Phaser.GameObjects.Rectangle[]) {
        return projectiles.filter((projectile) => {
          const inBounds =
            projectile.active &&
            projectile.x > -60 &&
            projectile.x < this.scale.width + 60 &&
            projectile.y > -60 &&
            projectile.y < this.scale.height + 60

          if (!inBounds && projectile.active) {
            projectile.destroy()
          }

          return inBounds
        })
      }
    }

    return new PhaserRuntime.Game({
      backgroundColor: '#071421',
      fps: {
        limit: 60,
      },
      parent,
      physics: {
        arcade: {
          debug: false,
          gravity: { x: 0, y: 0 },
        },
        default: 'arcade',
      },
      pixelArt: true,
      scale: {
        autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
        mode: PhaserRuntime.Scale.FIT,
      },
      scene: BitPlanesScene,
      type: PhaserRuntime.AUTO,
      width: 960,
      height: 540,
    })
  }, [])

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
    <GameViewport game="bit-planes" label="Bit Planes arcade game" ref={stageRef}>
      {engineStatus === 'loading' ? (
        <div className="game-loading">Loading Phaser engine...</div>
      ) : null}
      {engineStatus === 'error' ? (
        <div className="game-loading">Phaser could not start.</div>
      ) : null}
    </GameViewport>
  )
}

export default BitPlanesGame
