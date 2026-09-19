import 'dotenv/config'

import { Client } from '@upstash/qstash'

import {
  CleanupConfigurationError,
  cleanupFailureDetails,
  createCleanupExecutor,
  generationCleanupPolicy,
  previewGenerationCleanup,
  runGenerationCleanup,
} from '../src/modules/videos/server/services/generation-cleanup'
import { createGenerationCleanupSchedule } from '../src/modules/videos/server/services/generation-cleanup-schedule'

async function main() {
  const args = process.argv.slice(2)
  const usage = 'Usage: pnpm jobs:cleanup [--explain | --execute | schedule <production|development>]'
  if (args.length === 1 && args[0] === '--help') {
    console.info(usage)
    return
  }
  if (args[0] === 'schedule' && args.length === 2) {
    // Explicit scheduling only. Preview/execute never create or change schedules.
    let schedule: ReturnType<typeof createGenerationCleanupSchedule>
    try {
      schedule = createGenerationCleanupSchedule(args[1], process.env.UPSTASH_WORKFLOW_URL)
    } catch {
      throw new CleanupConfigurationError('Specify production|development and a valid UPSTASH_WORKFLOW_URL; production cannot target ngrok')
    }
    generationCleanupPolicy()
    if (!process.env.QSTASH_TOKEN) throw new CleanupConfigurationError('Configure QSTASH_TOKEN')
    const result = await new Client({ token: process.env.QSTASH_TOKEN }).schedules.create(schedule)
    console.info('Generation cleanup schedule configured', { ...result, ...schedule })
    return
  }
  const execute = args.length === 1 && args[0] === '--execute'
  const explain = args.length === 1 && args[0] === '--explain'
  if (args.length !== 0 && !execute && !explain) {
    console.error(usage)
    process.exitCode = 1
    return
  }
  const policy = generationCleanupPolicy()
  const connection = process.env.DATABASE_URL
  const query = createCleanupExecutor(connection)
  const target = new URL(connection!)
  // Display the destination without credentials or connection query parameters.
  console.info('Generation cleanup target', { host: target.host, database: target.pathname.slice(1) })
  const result = execute ? await runGenerationCleanup(query, policy) : await previewGenerationCleanup(query, policy, explain)
  console.info(JSON.stringify(result, null, 2))
}

main().catch(error => {
  console.error('Generation cleanup command failed; check arguments, configuration and database availability', cleanupFailureDetails(error))
  process.exitCode = 1
})
