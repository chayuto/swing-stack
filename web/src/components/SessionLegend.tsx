import type { SessionSlot } from '../sessionGroups'

// Legend for session-grouped charts. Hovering an entry highlights that
// session in every chart that takes hoverSessionId.

interface Props {
  slots: SessionSlot[]
  hovered: string | null
  onHover: (id: string | null) => void
  testId: string
  /** Club symbol key, e.g. "▲ Driver", appended after the sessions */
  extras?: { glyph: string; label: string }[]
}

export function SessionLegend({ slots, hovered, onHover, testId, extras }: Props) {
  return (
    <div className="fan-legend session-legend" data-testid={testId}>
      {slots.map((s) => (
        <span
          className={`entry${hovered && hovered !== s.id ? ' dim' : ''}`}
          key={s.id}
          title={s.title}
          onMouseEnter={() => onHover(s.id)}
          onMouseLeave={() => onHover(null)}
        >
          <span className="dot" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
      {extras?.map((e) => (
        <span className="entry glyph-entry" key={e.label}>
          <span className="glyph">{e.glyph}</span>
          {e.label}
        </span>
      ))}
    </div>
  )
}
