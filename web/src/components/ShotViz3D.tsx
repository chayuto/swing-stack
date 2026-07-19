import { useEffect, useRef, useState } from 'react'
import { GolfShotViz } from 'golf-shot-viz/react'
import type { GolfShotVizHandle } from 'golf-shot-viz/react'
import type { PlayOrder, SceneMode, ShotInput } from 'golf-shot-viz'

interface Props {
  shots: ShotInput[]
  onClose: () => void
}

// Full-screen 3D view of the currently filtered shots. The scene keeps
// its own dark stage in both themes, like a lightbox.
export function ShotViz3D({ shots, onClose }: Props) {
  const viz = useRef<GolfShotVizHandle>(null)
  const [mode, setMode] = useState<SceneMode>('studio')
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const play = (order: PlayOrder) => {
    viz.current?.scene?.play({ order, speed })
    setMode('showcase')
  }

  return (
    <div className="viz3d-overlay" data-testid="shot-viz-3d" role="dialog" aria-label="3D shot view">
      <div className="viz3d-header">
        <strong>
          3D view <span className="viz3d-count">{shots.length} shots</span>
        </strong>
        <button data-testid="close-3d" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="viz3d-stage">
        <GolfShotViz ref={viz} shots={shots} mode={mode} colorBy="club" />
      </div>
      <div className="viz3d-controls">
        <button aria-pressed={mode === 'studio'} onClick={() => setMode('studio')}>
          Studio
        </button>
        <button data-testid="play-volley" onClick={() => play('volley')}>
          Replay volley
        </button>
        <button data-testid="play-sequence" onClick={() => play('sequence')}>
          Replay sequence
        </button>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => {
            const v = Number(e.target.value)
            setSpeed(v)
            viz.current?.scene?.setSpeed(v)
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
        <span className="viz3d-hint">Drag to orbit. Scroll to zoom. Hover a tracer for details.</span>
      </div>
    </div>
  )
}
