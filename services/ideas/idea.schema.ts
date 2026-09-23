// src/services/ideas/idea.schema.ts
// Zod .strict() schemas for the idea-first domain (W3.4).
// Single source of truth — export z.infer types, never hand-write duplicates.
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'

// ─── Enums ─────────────────────────────────────────────────

export const ideaStageSchema = z.enum(['idea', 'prototype', 'mvp', 'launched'])

export const ideaVisibilitySchema = z.enum(['published', 'draft', 'archived'])

export const joinRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
])

// ─── Idea schemas ──────────────────────────────────────────

export const submitIdeaSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters.')
      .max(120, 'Title must not exceed 120 characters.'),
    problem: z
      .string()
      .trim()
      .min(10, 'Describe the problem in at least 10 characters.')
      .max(1000, 'Problem must not exceed 1000 characters.'),
    solution: z
      .string()
      .trim()
      .min(10, 'Describe your solution in at least 10 characters.')
      .max(2000, 'Solution must not exceed 2000 characters.'),
    ask: z
      .string()
      .trim()
      .min(3, 'State what you need in at least 3 characters.')
      .max(500, 'Ask must not exceed 500 characters.'),
    stage: ideaStageSchema.default('idea'),
    teamNeeded: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
    visibility: ideaVisibilitySchema.default('published'),
    joinEnabled: z.boolean().default(false),
  })
  .strict()

export type SubmitIdeaInput = z.infer<typeof submitIdeaSchema>

export const updateIdeaSchema = submitIdeaSchema.partial().strict()

export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>

export const ideaIdSchema = z.object({ ideaId: uuidSchema }).strict()

export type IdeaIdInput = z.infer<typeof ideaIdSchema>

export const toggleJoinEnabledSchema = z
  .object({
    ideaId: uuidSchema,
    joinEnabled: z.boolean(),
  })
  .strict()

export type ToggleJoinEnabledInput = z.infer<typeof toggleJoinEnabledSchema>

// ─── Validation / interest ──────────────────────────────────

export const validateIdeaSchema = z
  .object({
    ideaId: uuidSchema,
    action: z.enum(['like', 'pass', 'spark']),
  })
  .strict()

export type ValidateIdeaInput = z.infer<typeof validateIdeaSchema>

// ─── Join request ──────────────────────────────────────────

export const requestJoinSchema = z
  .object({
    ideaId: uuidSchema,
    message: z
      .string()
      .trim()
      .max(500, 'Message must not exceed 500 characters.')
      .optional(),
  })
  .strict()

export type RequestJoinInput = z.infer<typeof requestJoinSchema>

export const reviewJoinSchema = z
  .object({
    ideaId: uuidSchema,
    joinRequestId: uuidSchema,
    decision: z.enum(['approve', 'reject']),
  })
  .strict()

export type ReviewJoinInput = z.infer<typeof reviewJoinSchema>

// ─── review_idea_join_request RPC result schema ──────────────────────────
// Postgres returns jsonb_build_object(...) — validate before trusting it.
export const ideaJoinReviewResultSchema = z
  .object({
    ok: z.boolean(),
    status: z.enum(['approved', 'rejected']).nullable(),
    membership_created: z.boolean().nullable(),
    reason: z.string().nullable(),
  })
  .strict()

export type IdeaJoinReviewResult = z.infer<typeof ideaJoinReviewResultSchema>

// ─── Data projections (DTOs) ───────────────────────────────
// Per Web plan §2.4 — narrow, approval-aware projections used at boundaries.

export interface IdeaCardDTO {
  id: string
  ownerId: string
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  teamNeeded: string[]
  tags: string[]
  validationCount: number
  joinEnabled: boolean
  createdAt: string
  imageUrl?: string | null
  // Browse-safe owner marker only — full identity is approval-gated (§7.2).
  owner: {
    role: string | null
    id: string
    // Deliberately absent: full_name, avatar, bio, contact → identity hidden.
  }
}

export interface IdeaDetailDTO extends IdeaCardDTO {
  canJoin: boolean
  joinStatus: 'none' | 'pending' | 'approved' | 'rejected'
  isOwner: boolean
  visibility: string
}

export interface JoinRequestDTO {
  id: string
  ideaId: string
  userId: string
  status: 'pending' | 'approved' | 'rejected'
  message?: string
  createdAt: string
  // Applicant profile is owner-visible only (RLS-enforced).
  applicant?: {
    id: string
    fullName: string
    avatarUrl: string | null
    role: string | null
  }
}

export type { z }
