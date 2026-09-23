// src/lib/validation.ts
import { z } from 'zod'

// ─── Primitives ─────────────────────────────────────────────

// Normalise FIRST, then validate — otherwise a user typing "  Ana@Example.com "
// or an API client echoing a padded value is rejected by the format check before
// the lowercase/trim transform ever runs.
export const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(5, { message: 'Email must be at least 5 characters.' })
      .max(255, { message: 'Email must not exceed 255 characters.' })
      .email({ message: 'Please enter a valid email address.' }),
  )

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters.' })
  .max(128, { message: 'Password must not exceed 128 characters.' })
  .regex(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter.',
  })
  .regex(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter.',
  })
  .regex(/[0-9]/, { message: 'Password must contain at least one number.' })

export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid identifier format.' })

export const nonEmptyStringSchema = z
  .string()
  .min(1, { message: 'This field is required.' })
  .max(1000, { message: 'This field must not exceed 1000 characters.' })

export const nameSchema = z
  .string()
  .min(1, { message: 'Name is required.' })
  .max(100, { message: 'Name must not exceed 100 characters.' })
  .regex(/^[a-zA-Z\s\-']+$/, { message: 'Name contains invalid characters.' })

export const urlSchema = z
  .string()
  .url({ message: 'Please enter a valid URL.' })
  .or(z.literal(''))

// ─── Profile schemas ────────────────────────────────────────

export const roleSchema = z.enum([
  'founder',
  'engineer',
  'designer',
  'product',
  'growth',
  'operations',
  'data_ml',
  'other',
])

export const availabilitySchema = z
  .object({
    days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
    hours: z.object({
      start: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM format'),
      end: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM format'),
    }),
  })
  .refine(
    (data) => {
      const start = parseInt(data.hours.start.replace(':', ''))
      const end = parseInt(data.hours.end.replace(':', ''))
      return start < end
    },
    { message: 'Start time must be before end time.' },
  )

export const lookingForSchema = z.object({
  roles: z
    .array(roleSchema)
    .min(1, { message: "Select at least one role you're looking for." }),
})

export const profileVisibilitySchema = z.enum([
  'public',
  'recruiting',
  'private',
  'stealth',
])

// ─── Timezone & tag-list primitives (shared profile validation) ──────────
// Real IANA validation: the Intl.DateTimeFormat round-trip rejects zone names
// the platform ICU data does not recognize, so a stored timezone is always
// usable by scheduling code — there are no "valid-shaped but unusable" states.
// Single-term canonical zones (UTC, GMT, Etc/...) are accepted too.
function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const timezoneSchema = z
  .string()
  .trim()

  .refine(
    (value) => value.split('/').every((seg) => /^[A-Za-z0-9_+-]+$/u.test(seg)),
    'Invalid timezone format (use IANA)',
  )
  .refine(isIanaTimeZone, 'Invalid IANA timezone.')

// #102 — canonical ingestion for skill-like lists: trimmed + lowercased +
// deduped at the boundary so matchers/rankers never re-normalize per request
// and "React"/"react" are the same key.
export interface NormalizedTagListOptions {
  /** Hard cap on the number of accepted tags. */
  max: number
  /** Noun used in the "Maximum N <label>" message. */
  label: string
}

export function normalizedTagListSchema(options: NormalizedTagListOptions) {
  return z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .transform((tag) => tag.toLowerCase()),
    )
    .max(options.max, `Maximum ${options.max} ${options.label}`)
    .transform((values) => Array.from(new Set(values)))
}

export const interestsSchema = normalizedTagListSchema({
  max: 20,
  label: 'interests',
})

// ─── Match schemas ──────────────────────────────────────────

export const matchActionSchema = z.object({
  candidateId: uuidSchema,
  action: z.enum(['like', 'pass', 'spark']),
})

export const introRequestSchema = z.object({
  matchId: uuidSchema,
  message: z
    .string()
    .min(1, { message: 'Intro message is required.' })
    .max(500),
})

export const matchFiltersSchema = z
  .object({
    role: roleSchema.optional(),
    skill: z.string().optional(),
    minScore: z.number().int().min(0).max(100).default(55),
  })
  .optional()

// ─── Message schemas ────────────────────────────────────────

export const sendMessageSchema = z.object({
  matchId: uuidSchema,
  content: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(10000),
  clientMessageId: uuidSchema,
  // S034: storage path in the private match-attachments bucket — arbitrary
  // external URLs are rejected (path must be scoped to the sending matchId).
  attachmentUrl: z
    .string()
    .regex(
      /^match-attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/,
      'Invalid attachment path.',
    )
    .optional(),
})

// ─── Event schemas ──────────────────────────────────────────

export const eventTypeSchema = z.enum(['virtual', 'irl'])
export const eventFormatSchema = z.enum([
  'build_night',
  'coffee',
  'challenge',
  'office_hours',
  'workshop',
  'social',
])
export const eventRecurrenceSchema = z.enum([
  'none',
  'weekly',
  'biweekly',
  'monthly',
])

export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.').max(100),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters.')
    .max(1000),
  type: eventTypeSchema,
  format: eventFormatSchema,
  locationOrLink: z.string().min(1, 'Location or link is required.'),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  capacity: z.number().int().min(1).max(1000),
  tags: z.array(z.string()).max(10).optional(),
  recurrence: eventRecurrenceSchema.default('none'),
  recurrenceEnd: z.string().datetime().optional(),
})

export const rsvpSchema = z.object({
  eventId: uuidSchema,
  status: z.enum(['going', 'cancelled']),
})

// ─── Export helper ──────────────────────────────────────────

export type ValidationSchemas =
  typeof createEventSchema | typeof sendMessageSchema
