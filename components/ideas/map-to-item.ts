import type { IdeaBrief } from '@/client/api/browse'
import type { IdeaCardDTO } from '@/services/ideas/idea.schema'
import { initialsForName } from '@/types/profile'
import type { Idea } from './idea'

const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea',
  prototype: 'Prototype',
  mvp: 'MVP',
  launched: 'Launched',
}

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return 'Idea'
  return (
    STAGE_LABELS[stage] ??
    stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase()
  )
}

function metaLine(stage: string | null, validations: number): string {
  return `${stageLabel(stage)} · ${validations} validations`
}

export function ideaCardToItem(idea: IdeaCardDTO): Idea {
  return {
    id: idea.id,
    title: idea.title,
    author: 'You',
    initials: 'YO',
    tone: '',
    problem: idea.problem,
    approach: idea.solution,
    meta: metaLine(idea.stage, idea.validationCount),
    tag: stageLabel(idea.stage),
    teamNeeded: idea.teamNeeded,
    tags: idea.tags,
    joinEnabled: idea.joinEnabled,
    upvotesCount: idea.validationCount,
  }
}

// Network deck variant: the viewer is NOT the author (unlike the "Your ideas"
// grid), so the avatar must not claim ownership. Identity stays approval-gated
// (§7.2) — only a neutral member marker is shown.
export function ideaCardToDeckItem(idea: IdeaCardDTO): Idea {
  return {
    id: idea.id,
    title: idea.title,
    author: 'Connect member',
    initials: 'CM',
    tone: '',
    problem: idea.problem,
    approach: idea.solution,
    meta: metaLine(idea.stage, idea.validationCount),
    tag: stageLabel(idea.stage),
    teamNeeded: idea.teamNeeded,
    tags: idea.tags,
    joinEnabled: idea.joinEnabled,
    upvotesCount: idea.validationCount,
  }
}

export function ideaBriefToItem(idea: IdeaBrief): Idea {
  const author = idea.authorName ?? 'Connect member'
  return {
    id: idea.id,
    title: idea.title,
    author,
    initials: initialsForName(author),
    tone: '',
    problem: idea.problem,
    approach: idea.solution,
    meta: metaLine(idea.stage, idea.validation_count),
    tag: stageLabel(idea.stage),
    teamNeeded: idea.team_needed ?? [],
    tags: idea.tags ?? [],
    joinEnabled: true,
    upvotesCount: idea.validation_count,
  }
}

