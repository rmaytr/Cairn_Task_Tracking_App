import type { IconName } from '../components/Icon'
import type { AdhdTool } from './types'

export interface ToolInfo {
  id: AdhdTool
  label: string
  icon: IconName
  /** One line under the label on the hub. */
  blurb: string
}

/** Hub order. The hub (AdhdHub) owns how these are laid out. */
export const TOOLS: readonly ToolInfo[] = [
  { id: 'room', label: 'Focus room', icon: 'door', blurb: 'One task, a timer, sound and quiet company, all on one screen.' },
  { id: 'unstuck', label: "I'm stuck", icon: 'lifebuoy', blurb: 'Tell it why, get one move that fits.' },
  { id: 'sounds', label: 'Focus sounds', icon: 'headphones', blurb: 'White, pink, brown noise or rain. Test if it helps you.' },
  { id: 'time', label: 'Time sense', icon: 'hourglass', blurb: 'Learn how your guesses compare with the clock.' },
  { id: 'treats', label: 'Reward menu', icon: 'gift', blurb: 'Small rewards, close to the effort.' },
  { id: 'move', label: 'Move break', icon: 'walk', blurb: 'Ninety seconds of movement between blocks.' },
  { id: 'learn', label: 'What works', icon: 'book', blurb: 'Research in plain words. Keep what helps you.' },
]

export const toolInfo = (id: AdhdTool): ToolInfo => TOOLS.find((t) => t.id === id) ?? TOOLS[0]
