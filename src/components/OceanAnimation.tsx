type OceanAnimationProps = {
  className?: string
}

function OceanAnimation({ className }: OceanAnimationProps) {
  return (
    <div
      aria-hidden="true"
      className={['ocean-animation', className].filter(Boolean).join(' ')}
      data-testid="ocean-animation"
      data-ocean-style="css-layered-ocean"
    >
      <div className="ocean-animation__sky" />
      <div className="ocean-animation__water ocean-animation__water--back" />
      <div className="ocean-animation__water ocean-animation__water--front" />
    </div>
  )
}

export default OceanAnimation
