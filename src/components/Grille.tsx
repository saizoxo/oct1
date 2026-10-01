import type { RefObject } from 'react'

type Props = {
  body: RefObject<HTMLDivElement | null>
}

export function Grille({ body }: Props) {
  return (
    <div className="grille" ref={body} style={{ gridArea: 'grille' }}>
      <div className="grille-cone" aria-hidden="true">
        <span className="grille-dustcap" />
      </div>
      <div className="grille-cloth" aria-hidden="true" />
      <div className="grille-shade" aria-hidden="true" />
      <div className="grille-trim" aria-hidden="true" />
    </div>
  )
}

export function Hardware() {
  return (
    <div className="hardware" aria-hidden="true">
      <span className="screw screw--l" />
      <span className="screw screw--r" />
      <span className="vent">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    </div>
  )
}
