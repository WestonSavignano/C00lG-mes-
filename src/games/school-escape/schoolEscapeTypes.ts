export type PaintPigment = 'red' | 'yellow' | 'blue' | 'white' | 'black'

export type PaintMix = Readonly<Record<PaintPigment, number>>

export type SrgbColor = Readonly<{
  r: number
  g: number
  b: number
}>

export type OklabColor = Readonly<{
  l: number
  a: number
  b: number
}>

export type CamouflageSample = Readonly<{
  match: number
  surfaceDistance: number
  horizontalSpeed: number
  grounded: boolean
}>

export type TeacherState = 'patrol' | 'suspicious' | 'search' | 'chase' | 'recover'

export type TeacherSnapshot = Readonly<{
  state: TeacherState
  suspicion: number
  lostSightFor: number
  stateElapsed: number
  shout: boolean
}>

export type TeacherPerceptionSample = Readonly<{
  visibility: number
  hasLineOfSight: boolean
  dt: number
}>

export type TeacherVisibilitySample = Readonly<{
  distance: number
  sightRange: number
  viewAlignment: number
  speed: number
  sprinting: boolean
  camouflageMultiplier: number
  hasLineOfSight: boolean
}>

export const EMPTY_PAINT_MIX: PaintMix = {
  red: 0,
  yellow: 0,
  blue: 0,
  white: 0,
  black: 0,
}

export const BASE_OUTFIT_COLOR: SrgbColor = {
  r: 0.055,
  g: 0.065,
  b: 0.085,
}

export const PLAYER_MOVE_SPEED = 3.2
export const PLAYER_SPRINT_SPEED = 4.8
export const TEACHER_PATROL_SPEED = 2
export const TEACHER_CHASE_SPEED = 4.2
