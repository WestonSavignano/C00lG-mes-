import type { TeacherState } from './schoolEscapeLogic'

export type SchoolEscapeSoundCue =
  | 'teacher-step'
  | 'door'
  | 'mutter'
  | 'detection'
  | 'win'
  | 'fail'

export type SoundProfile = Readonly<{
  frequency: number
  endFrequency: number
  duration: number
  gain: number
  wave: OscillatorType
}>

export function footstepCadence(state: TeacherState) {
  if (state === 'chase') return 0.27
  if (state === 'search') return 0.52
  if (state === 'suspicious') return 0.58
  return 0.64
}

export function teacherStateCue(
  previous: TeacherState,
  next: TeacherState,
): SchoolEscapeSoundCue | null {
  return previous !== 'chase' && next === 'chase' ? 'detection' : null
}

export function soundProfile(cue: SchoolEscapeSoundCue): SoundProfile {
  switch (cue) {
    case 'teacher-step':
      return {
        frequency: 76,
        endFrequency: 55,
        duration: 0.08,
        gain: 0.07,
        wave: 'sine',
      }
    case 'door':
      return {
        frequency: 190,
        endFrequency: 82,
        duration: 0.32,
        gain: 0.055,
        wave: 'sawtooth',
      }
    case 'mutter':
      return {
        frequency: 118,
        endFrequency: 103,
        duration: 0.24,
        gain: 0.025,
        wave: 'triangle',
      }
    case 'detection':
      return {
        frequency: 360,
        endFrequency: 690,
        duration: 0.24,
        gain: 0.12,
        wave: 'square',
      }
    case 'win':
      return {
        frequency: 520,
        endFrequency: 820,
        duration: 0.4,
        gain: 0.1,
        wave: 'triangle',
      }
    case 'fail':
      return {
        frequency: 210,
        endFrequency: 78,
        duration: 0.45,
        gain: 0.11,
        wave: 'sawtooth',
      }
  }
}

export type SchoolEscapeAudioController = {
  activate(): void
  play(cue: SchoolEscapeSoundCue): void
  speakComeBackHere(): void
  suspend(): void
  dispose(): void
}

export function createSchoolEscapeAudio(): SchoolEscapeAudioController {
  let context: AudioContext | null = null
  let activated = false
  let disposed = false

  const getContext = () => {
    if (disposed || !activated || typeof window.AudioContext !== 'function') {
      return null
    }
    context ??= new AudioContext()
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
    return context
  }

  return {
    activate() {
      if (disposed) return
      activated = true
      getContext()
    },
    play(cue) {
      const audio = getContext()
      if (!audio) return

      const profile = soundProfile(cue)
      const now = audio.currentTime
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()

      oscillator.type = profile.wave
      oscillator.frequency.setValueAtTime(profile.frequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, profile.endFrequency),
        now + profile.duration,
      )
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration)

      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(now)
      oscillator.stop(now + profile.duration + 0.02)
    },
    speakComeBackHere() {
      if (
        !activated ||
        disposed ||
        typeof window.speechSynthesis === 'undefined' ||
        typeof SpeechSynthesisUtterance === 'undefined'
      ) {
        return
      }

      const utterance = new SpeechSynthesisUtterance('COME BACK HERE!')
      utterance.rate = 0.92
      utterance.pitch = 0.72
      utterance.volume = 0.72
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    suspend() {
      if (context?.state === 'running') {
        void context.suspend().catch(() => undefined)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel()
      }
      if (context) {
        void context.close().catch(() => undefined)
        context = null
      }
    },
  }
}
