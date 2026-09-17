import type { z } from 'zod'

import type { videoUpdateSchema } from '@/db/schema'

export type VideoFormValues = z.infer<typeof videoUpdateSchema>
export const editableVideoFields = ['title', 'description', 'categoryId', 'visibility'] as const
export type EditableVideoField = (typeof editableVideoFields)[number]

export function dirtyVideoPatch(
  values: VideoFormValues,
  dirty: Partial<Record<EditableVideoField, boolean>>,
  locked: Partial<Record<EditableVideoField, boolean>>
) {
  return Object.fromEntries(
    editableVideoFields.filter(key => dirty[key] && !locked[key] && values[key] !== undefined).map(key => [key, values[key]])
  ) as Partial<Pick<VideoFormValues, EditableVideoField>>
}
