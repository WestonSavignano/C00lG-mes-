class Spector {
  onCapture = {
    add: () => undefined,
  }

  captureCanvas() {
    return undefined
  }

  captureNextFrame() {
    return undefined
  }

  getFps() {
    return 0
  }

  getResultUI() {
    return {
      display: () => undefined,
    }
  }

  log() {
    return undefined
  }

  startCapture() {
    return undefined
  }

  stopCapture() {
    return undefined
  }
}

export { Spector }
export default { Spector }
