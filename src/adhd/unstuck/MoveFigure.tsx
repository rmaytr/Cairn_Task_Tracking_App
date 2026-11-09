import type { Move } from './breakMoves'

/** A simple stick figure. CSS animates the parts that matter for each move (see unstuck.css). */
export function MoveFigure({ id, still }: { id: Move['id']; still: boolean }) {
  return (
    <svg className={`mvfig mvfig--${id}${still ? ' is-still' : ''}`} viewBox="0 0 120 120" role="img" aria-label={`Illustration: ${id}`}>
      <g className="mvfig__body" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <circle className="mvfig__head" cx="60" cy="24" r="9" />
        <path d="M60 36v36" />
        <path className="mvfig__arm mvfig__arm--l" d="M60 44L40 62" />
        <path className="mvfig__arm mvfig__arm--r" d="M60 44L80 62" />
        <path className="mvfig__leg mvfig__leg--l" d="M60 72L48 104" />
        <path className="mvfig__leg mvfig__leg--r" d="M60 72L72 104" />
      </g>
      {id === 'breath' && <circle className="mvfig__ring" cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="2" />}
    </svg>
  )
}
