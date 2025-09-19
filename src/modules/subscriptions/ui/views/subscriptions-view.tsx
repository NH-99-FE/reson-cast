'use client'

import { SubscriptionsSection } from '@/modules/subscriptions/ui/sections/subscriptions-section'

export const SubscriptionsView = () => {
  return (
    <div className="mx-auto mb-10 flex max-w-screen-md flex-col gap-y-6 px-4 pt-2.5">
      <div>
        <h1 className="text-2xl font-bold">订阅列表</h1>
        <p className="text-xs text-muted-foreground">查看和管理全部订阅</p>
      </div>
      <SubscriptionsSection />
    </div>
  )
}
