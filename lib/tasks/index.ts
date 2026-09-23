// src/lib/tasks/index.ts
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'

/**
 * Task result – used to track success/failure.
 */
export interface TaskResult<T = void> {
  success: boolean
  data?: T
  error?: Error
  durationMs: number
}

/**
 * Task options – context for logging and error handling.
 */
export interface TaskOptions {
  /** Unique identifier for this task (e.g., `send-email`, `log-analytics`). */
  id: string
  /** Whether to throw on failure. If false, failures are logged but not re‑thrown. */
  throwOnFailure?: boolean
  /** Additional context for logs. */
  context?: Record<string, unknown>
  /** If true, the task will be retried once on failure (only for non‑critical tasks). */
  retry?: boolean
  /**
   * #113 — idempotency key for this task. All side effects (emails, Slack,
   * notifications, payments) run through outbox tables keyed on
   * `dedupe_key`/`idempotency_key`; passing this key makes a retried task
   * reuse the same dedupe entry so replaying a completed task cannot
   * duplicate the external action.
   */
  idempotencyKey?: string
}

/**
 * Inline task runner – executes a function and logs its performance.
 *
 * This is the foundation for all side‑effects:
 * - Email sending (Resend)
 * - Analytics events (Redis buffer)
 * - Slack alerts
 * - Any non‑critical background work
 *
 * In the future, this can be swapped to use QStash or BullMQ without
 * changing the calling code – just replace the implementation.
 */
export async function runTask<T>(
  fn: () => Promise<T>,
  options: TaskOptions,
): Promise<TaskResult<T>> {
  const {
    id,
    throwOnFailure = false,
    context = {},
    retry = false,
    idempotencyKey,
  } = options
  const start = performance.now()

  // #113 — a stable idempotencyKey correlates every attempt (including the
  // retry) so operators can see one logical side-effect unit in the logs. It
  // is deliberately independent of `id`: `id` names the task type, while
  // `idempotencyKey` names THIS side-effect instance and must equal the
  // outbox `dedupe_key` so a retried enqueue collides (23505) and reuses the
  // existing row instead of duplicating the external action. Build it
  // conditionally so the key is fully absent (not `undefined`) when not set.
  const keyed: Record<string, unknown> = {}
  if (idempotencyKey !== undefined) keyed.idempotencyKey = idempotencyKey
  const logContext = {
    taskId: id,
    retry,
    ...keyed,
    ...context,
  }

  logger.debug(`Task started: ${id}`, logContext)

  try {
    // If retry is enabled, try once more on failure
    const execute = async (attempt: number): Promise<T> => {
      try {
        return await fn()
      } catch (error) {
        if (retry && attempt < 2) {
          // #112 — exponential backoff with jitter, not an immediate retry:
          // an immediate retry against a failing provider is a retry storm.
          const delayMs = Math.min(
            250 * 2 ** attempt + Math.floor(Math.random() * 100),
            2_000,
          )
          logger.warn(`Task ${id} failed, retrying...`, {
            ...logContext,
            attempt,
            delayMs,
          })
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          return await fn() // second attempt
        }
        throw error
      }
    }

    const data = await execute(1)
    const durationMs = Math.round(performance.now() - start)

    logger.info(`Task completed: ${id}`, {
      ...logContext,
      durationMs,
      success: true,
    })

    return {
      success: true,
      data,
      durationMs,
    }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    const appError = AppError.fromUnknown(error, ErrorCodes.EXTERNAL_SERVICE, {
      context: { taskId: id, idempotencyKey, ...context },
    })

    logger.error(`Task failed: ${id}`, { ...logContext, durationMs }, appError)

    if (throwOnFailure) {
      throw appError
    }

    return {
      success: false,
      error: appError,
      durationMs,
    }
  }
}

/**
 * Helper to run multiple tasks in parallel.
 * Useful for sending batch emails or recording multiple analytics events.
 */
export async function runTasks<T>(
  tasks: Array<{
    fn: () => Promise<T>
    id: string
    context?: Record<string, unknown>
    // #113 — per-task idempotency key; threaded through to runTask so batch
    // enqueues reuse outbox dedupe entries exactly like single tasks.
    idempotencyKey?: string
  }>,
  options?: { throwOnFailure?: boolean },
): Promise<TaskResult<T>[]> {
  const results = await Promise.allSettled(
    tasks.map(({ fn, id, context, idempotencyKey }) =>
      runTask(fn, {
        id,
        context,
        idempotencyKey,
        throwOnFailure: options?.throwOnFailure ?? false,
      }),
    ),
  )

  // Convert PromiseSettledResult to TaskResult
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      // Should never happen because runTask never throws unless throwOnFailure is true
      return {
        success: false,
        error: new Error('Task execution failed unexpectedly'),
        durationMs: 0,
      } as TaskResult<T>
    }
  })
}
