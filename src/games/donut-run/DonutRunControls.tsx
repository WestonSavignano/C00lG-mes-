import ActionButton from '../shared/input/ActionButton'
import type { SemanticInputWriter } from '../shared/input/semanticInput'
import type { DonutRunAction } from './donutRunInput'

function DonutRunControls({
  writer,
}: {
  writer: SemanticInputWriter<DonutRunAction>
}) {
  return (
    <div className="donut-run__controls" aria-label="Donut Run touch controls">
      <ActionButton
        action="jump"
        className="donut-run__jump"
        mode="press"
        sourceId="button:donut-run:jump"
        writer={writer}
      >
        Jump
      </ActionButton>
    </div>
  )
}

export default DonutRunControls
