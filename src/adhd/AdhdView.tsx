import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store/useStore'
import { AdhdHub } from './AdhdHub'
import { FocusRoom } from './FocusRoom'
import { MovementSnack } from './MovementSnack'
import { SoundLab } from './SoundLab'
import { TimeSense } from './TimeSense'
import { toolInfo } from './tools'
import { TreatMenu } from './TreatMenu'
import type { AdhdTool } from './types'
import { Unstuck } from './Unstuck'
import { WhatWorks } from './WhatWorks'
import './AdhdView.css'

function ToolPage({ tool }: { tool: AdhdTool }): ReactNode {
  const navigate = useStore((s) => s.navigate)
  const back = (): void => {
    navigate({ view: 'adhd', tool: null })
    // The break's buttons are gone with the page; land on the hub's title.
    requestAnimationFrame(() => document.getElementById('adhd-title')?.focus())
  }
  switch (tool) {
    case 'room':
      return <FocusRoom />
    case 'sounds':
      return <SoundLab />
    case 'unstuck':
      return <Unstuck />
    case 'time':
      return <TimeSense />
    case 'treats':
      return <TreatMenu />
    case 'move':
      return <MovementSnack onDone={back} />
    case 'learn':
      return <WhatWorks />
  }
}

/** #adhd: the toolkit hub, or one tool page with a way back. */
export function AdhdView() {
  const tool = useStore((s) => s.adhdTool)
  const navigate = useStore((s) => s.navigate)
  if (!tool) {
    return (
      <section className="adhd" aria-labelledby="adhd-title">
        <AdhdHub />
      </section>
    )
  }
  const info = toolInfo(tool)
  return (
    <section className="adhd adhd--tool" aria-labelledby="adhd-tool-title" data-tool={tool}>
      <div className="adhd__crumbs">
        <button type="button" className="adhd__back" onClick={() => navigate({ view: 'adhd', tool: null })}>
          <Icon name="chevron" size={16} /> ADHD toolkit
        </button>
      </div>
      <h1 className="adhd__title" id="adhd-tool-title" tabIndex={-1}>
        <Icon name={info.icon} size={24} /> {info.label}
      </h1>
      <ToolPage tool={tool} />
    </section>
  )
}
