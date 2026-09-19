import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { type SQL, sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import {
  deleteGenerationBatch,
  generationCleanupCandidates,
  generationCleanupHealth,
  type GenerationCleanupPlanRow,
  generationCleanupPreview,
  generationCleanupSample,
} from './generation-cleanup-queries'

const DAY_MS = 86_400_000
const MAX_BATCHES = 10
const RUN_BUDGET_MS = 40_000
const REQUEST_TIMEOUT_MS = 8_000
export const CLEANUP_STATEMENT_TIMEOUT_MS = 5_000

export type CleanupExecutor = <Row extends Record<string, unknown>>(query: SQL<Row>, readOnly: boolean) => Promise<Row[]>

export class CleanupConfigurationError extends Error {}

export function generationCleanupPolicy(value = process.env.GENERATION_JOB_RETENTION_DAYS, now = new Date()) {
  const raw = value ?? '30'
  if (!/^[1-9]\d*$/.test(raw)) throw new CleanupConfigurationError('GENERATION_JOB_RETENTION_DAYS must be a positive integer')
  const retentionDays = Number(raw)
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS)
  if (!Number.isSafeInteger(retentionDays) || !Number.isFinite(cutoff.getTime()) || cutoff.getUTCFullYear() < 1) {
    throw new CleanupConfigurationError('GENERATION_JOB_RETENTION_DAYS is out of range')
  }
  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    // Diagnostic only: age does not prove that a workflow has stopped.
    staleCutoff: new Date(now.getTime() - DAY_MS).toISOString(),
  }
}

export type CleanupPolicy = ReturnType<typeof generationCleanupPolicy>

// Neon HTTP uses a new transaction per request. Set LOCAL timeouts in the SAME
// non-interactive transaction, before the query; never rely on session settings.
export function createCleanupExecutor(connectionString = process.env.DATABASE_URL): CleanupExecutor {
  if (!connectionString) throw new CleanupConfigurationError('Configure DATABASE_URL')
  let client: NeonQueryFunction<false, false>
  try {
    client = neon(connectionString)
  } catch {
    // The driver's validation error can contain the full connection string.
    throw new CleanupConfigurationError('DATABASE_URL must be a valid PostgreSQL connection URL')
  }
  const dialect = new PgDialect()
  return async <Row extends Record<string, unknown>>(query: SQL<Row>, readOnly: boolean) => {
    const compiled = dialect.sqlToQuery(query)
    const [, result] = await client.transaction(
      tx => [
        tx.query("SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', '500ms', true)", [
          `${CLEANUP_STATEMENT_TIMEOUT_MS}ms`,
        ]),
        tx.query(compiled.sql, compiled.params),
      ],
      { readOnly, isolationLevel: 'ReadCommitted', fetchOptions: { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } }
    )
    // Raw SQL bypasses Drizzle's row mapping. Keep the sole driver assertion here;
    // SQL<Row> declares the contract at the query, verified by database tests.
    return result as Row[]
  }
}

export async function previewGenerationCleanup(execute: CleanupExecutor, policy: CleanupPolicy, explain = false) {
  const [summary] = await execute(generationCleanupPreview(policy.cutoff), true)
  const sample = await execute(generationCleanupSample(policy.cutoff), true)
  const [health] = await execute(generationCleanupHealth(policy.staleCutoff), true)
  const plans = explain
    ? {
        // No ANALYZE: this is a read-only plan of the batch selection, without row locks.
        candidates: await execute(sql<GenerationCleanupPlanRow>`EXPLAIN (FORMAT JSON) ${generationCleanupCandidates(policy.cutoff)}`, true),
        count: await execute(sql<GenerationCleanupPlanRow>`EXPLAIN (FORMAT JSON) ${generationCleanupPreview(policy.cutoff)}`, true),
      }
    : undefined
  return {
    mode: 'preview' as const,
    ...policy,
    eligible: summary.eligible,
    oldestFinishedAt: summary.oldest_finished_at,
    health,
    sample,
    plans,
  }
}

export class GenerationCleanupError extends Error {
  constructor(
    public readonly progress: { deleted: number; batches: number },
    cause: unknown
  ) {
    super('Generation cleanup failed; earlier batches may already be committed', { cause })
  }
}

export function cleanupFailureDetails(error: unknown) {
  const cause = error instanceof GenerationCleanupError ? error.cause : error
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined
  return {
    ...(error instanceof GenerationCleanupError ? error.progress : {}),
    reason: error instanceof CleanupConfigurationError ? error.message : 'request_failed',
    // SQLSTATE helps distinguish missing migrations, lock contention and timeouts.
    code: code && /^[0-9A-Z]{5}$/.test(code) ? code : undefined,
  }
}

export async function runGenerationCleanup(execute: CleanupExecutor, policy: CleanupPolicy, clock = () => performance.now()) {
  const started = clock()
  const progress = { deleted: 0, batches: 0 }
  let stopReason: 'batch_limit' | 'time_budget' | 'no_unlocked_candidates' = 'batch_limit'
  try {
    const [health] = await execute(generationCleanupHealth(policy.staleCutoff), true)
    while (progress.batches < MAX_BATCHES) {
      // Leave enough room for one complete HTTP request before the route deadline.
      if (clock() - started >= RUN_BUDGET_MS - REQUEST_TIMEOUT_MS) {
        stopReason = 'time_budget'
        break
      }
      const rows = await execute(deleteGenerationBatch(policy.cutoff), false)
      progress.batches++
      progress.deleted += rows.length
      if (rows.length === 0) {
        // Locked candidates may still exist. Do not claim the backlog is empty.
        stopReason = 'no_unlocked_candidates'
        break
      }
    }
    return { mode: 'execute' as const, ...policy, ...progress, stopReason, elapsedMs: Math.round(clock() - started), health }
  } catch (error) {
    // Counts only acknowledged commits; a lost response can hide another commit.
    throw new GenerationCleanupError({ ...progress }, error)
  }
}
