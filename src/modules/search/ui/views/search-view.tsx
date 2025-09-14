import { ResultsSection } from '@/modules/search/ui/sections/results-section'

import { CategoriesSection } from '../sections/categories-section'

interface SearchViewProps {
  query: string | undefined
  categoryId: string | undefined
}

export const SearchView = ({ query, categoryId }: SearchViewProps) => {
  return (
    <div className="mx-auto mb-10 flex max-w-[1300px] flex-col gap-y-4 px-4 pt-2.5">
      <CategoriesSection categoryId={categoryId} />
      <ResultsSection query={query} categoryId={categoryId} />
    </div>
  )
}
