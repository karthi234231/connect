'use client'

import { useState } from 'react'
import { Button, Card, CardContent } from '@/components/ui'
import { MessageSquare, Send, Sparkles, User } from 'lucide-react'

export interface CommentItem {
  id: string
  authorName: string
  authorRole?: string
  content: string
  createdAt: string
  isOwner?: boolean
}

export interface IdeaFeedbackCommentsProps {
  ideaId: string
  initialComments?: CommentItem[]
}

const DEFAULT_SAMPLE_COMMENTS: CommentItem[] = [
  {
    id: 'c-1',
    authorName: 'Alex Morgan',
    authorRole: 'Product Designer',
    content: 'Love the core concept! Have you considered how this scales when multi-tenant features are introduced?',
    createdAt: '2 hours ago',
  },
  {
    id: 'c-2',
    authorName: 'Jordan Vance',
    authorRole: 'Fullstack Engineer',
    content: 'I would be interested in helping build the backend prototype for this. Let me know if you are open to collaborating!',
    createdAt: '1 day ago',
  },
]

export function IdeaFeedbackComments({
  ideaId,
  initialComments = DEFAULT_SAMPLE_COMMENTS,
}: IdeaFeedbackCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)

    setTimeout(() => {
      const added: CommentItem = {
        id: `c-${Date.now()}`,
        authorName: 'You',
        authorRole: 'Collaborator',
        content: newComment.trim(),
        createdAt: 'Just now',
        isOwner: true,
      }

      setComments((prev) => [added, ...prev])
      setNewComment('')
      setIsSubmitting(false)
    }, 200)
  }

  return (
    <Card className="mt-6 border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-[var(--cx-brand)]" />
            <h3 className="font-display text-base font-semibold text-[var(--cx-text-1)]">
              Feedback & Discussion
            </h3>
            <span className="rounded-full bg-[var(--cx-surface-2)] px-2 py-0.5 text-xs text-[var(--cx-text-3)] font-medium">
              {comments.length}
            </span>
          </div>
          <span className="text-[11px] text-[var(--cx-text-4)] flex items-center gap-1">
            <Sparkles className="size-3 text-[var(--cx-brand)]" /> Validation phase
          </span>
        </div>

        {/* Input box */}
        <form onSubmit={handleAddComment} className="space-y-3">
          <div className="relative">
            <textarea
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share constructive feedback, ideas, or partnership intent..."
              className="w-full resize-none rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3 text-xs leading-5 text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-4)] outline-none focus:border-[var(--cx-brand)] transition"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !newComment.trim()}
              icon={<Send className="size-3.5" />}
            >
              {isSubmitting ? 'Posting...' : 'Post feedback'}
            </Button>
          </div>
        </form>

        {/* Comments List */}
        <div className="space-y-3 pt-2">
          {comments.length === 0 ? (
            <p className="text-xs text-[var(--cx-text-4)] text-center py-4">
              No feedback yet. Be the first to share your thoughts!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5 space-y-2 transition hover:border-[var(--cx-border-2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full bg-[var(--cx-brand)]/20 text-[10px] font-semibold text-[var(--cx-brand-strong)]">
                      {comment.authorName === 'You' ? (
                        <User className="size-3" />
                      ) : (
                        comment.authorName.charAt(0)
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--cx-text-1)]">
                        {comment.authorName}
                      </span>
                      {comment.authorRole && (
                        <span className="ml-1.5 text-[10px] text-[var(--cx-text-4)] uppercase tracking-wider font-mono">
                          • {comment.authorRole}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--cx-text-4)]">
                    {comment.createdAt}
                  </span>
                </div>
                <p className="text-xs leading-5 text-[var(--cx-text-2)] pl-8">
                  {comment.content}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
