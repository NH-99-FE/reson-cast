'use client'
import { SearchIcon, XIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { APP_URL } from '@/constants'

export const SearchInput = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('query') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const [value, setValue] = useState('')
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const url = new URL('/search', APP_URL)
    const newQuery = value.trim()

    url.searchParams.set('query', encodeURIComponent(newQuery))

    if (categoryId) {
      url.searchParams.set('categoryId', categoryId)
    }

    if (newQuery === '') {
      url.searchParams.delete('query')
    }

    setValue(newQuery)

    router.push(url.toString())
  }

  return (
    <form className="flex w-full max-w-[600px]" onSubmit={handleSearch}>
      <div className="relative w-full">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          type="text"
          placeholder="搜索"
          className="w-full rounded-l-full border py-2 pr-12 pl-4 focus:border-blue-400 focus:outline-none"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setValue('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
          >
            <XIcon className="text-gray-500" />
          </Button>
        )}
      </div>
      <button
        type="submit"
        className="rounded-r-full border border-l-0 bg-gray-100 px-5 py-2.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  )
}
