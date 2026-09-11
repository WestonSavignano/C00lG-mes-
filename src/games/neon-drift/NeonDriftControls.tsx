import ActionButton from '../shared/input/ActionButton'
import DirectionalControl from '../shared/input/DirectionalControl'
import type { SemanticInputWriter } from '../shared/input/semanticInput'
import type { NeonDriftAction } from './neonDriftInput'

type NeonDriftControlsProps = {
  writer: SemanticInputWriter<NeonDriftAction>
}

function NeonDriftControls({ writer }: NeonDriftControlsProps) {
  return (
    <div className="neon-drift__touch-controls" aria-label="Neon Drift touch controls">
      <DirectionalControl
        className="neon-drift__touch-stick"
        label="Move"
        sourceId="stick:neon-drift"
        writer={writer}
      />
      <div className="neon-drift__touch-actions">
        <ActionButton
          action="deploy"
          className="neon-drift__touch-action neon-drift__touch-action--deploy"
          mode="press"
          sourceId="button:neon-drift:deploy"
          writer={writer}
        >
          Deploy
        </ActionButton>
        <ActionButton
          action="boost"
          className="neon-drift__touch-action neon-drift__touch-action--boost"
          mode="hold"
          sourceId="button:neon-drift:boost"
          writer={writer}
        >
          Boost
        </ActionButton>
      </div>
    </div>
  )
}

export default NeonDriftControls
