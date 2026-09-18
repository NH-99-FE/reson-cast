'use client'

import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { FilterCarousel } from '@/components/filter-carousel'
import { CategoryStripSkeleton } from '@/components/page-content-skeletons'
import { trpc } from '@/trpc/client'

interface CategorySectionProps {
  categoryId?: string
}

export const CategorySection = ({ categoryId }: CategorySectionProps) => {
  return (
    <Suspense fallback={<CategoryStripSkeleton />}>
      <ErrorBoundary fallback={<p>出错了！</p>}>
        <CategorySectionSuspense categoryId={categoryId}></CategorySectionSuspense>
      </ErrorBoundary>
    </Suspense>
  )
}

const CategorySectionSuspense = ({ categoryId }: CategorySectionProps) => {
  const [categories] = trpc.categories.getMany.useSuspenseQuery()
  const router = useRouter()
  const data = categories.map(({ name, id }) => ({
    value: id,
    label: name,
  }))

  const onSelect = (value: string | null) => {
    const url = new URL(window.location.href)
    if (value) {
      url.searchParams.set('categoryId', value)
    } else {
      url.searchParams.delete('categoryId')
    }

    router.push(url.toString())
  }
  return <FilterCarousel onSelect={onSelect} value={categoryId} data={data}></FilterCarousel>
}
