export type Idea = {
  id: string
  title: string
  author: string
  initials: string
  tone: string
  problem: string
  approach: string
  meta: string
  tag?: string
  teamNeeded?: string[]
  tags?: string[]
  joinEnabled?: boolean
  upvotesCount?: number
  isUpvoted?: boolean
  commentCount?: number
}

