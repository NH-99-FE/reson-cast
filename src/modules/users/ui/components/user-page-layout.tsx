import type { ComponentProps } from 'react'

export const USER_VIDEOS_GRID_CLASS_NAME = 'grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

export function UserPageLayout(props: ComponentProps<'div'>) {
  return <div {...props} className="mx-auto mb-10 flex max-w-[1300px] flex-col gap-y-6 px-4 pt-2.5" />
}
