'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FilterCarouselProps {
  value?: string | null
  isLoading?: boolean
  onSelect: (value: string | null) => void
  data: {
    value: string
    label: string
  }[]
}

export const FilterCarousel = ({ value, onSelect, data, isLoading }: FilterCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    // 监听滚动事件
    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }
    api.on('select', handleSelect)
    // 清理事件监听
    return () => {
      api.off('select', handleSelect)
    }
  }, [api])

  return (
    <div className="relative w-full">
      {/*左侧淡入*/}
      <div
        className={cn(
          'pointer-events-none absolute top-0 bottom-0 left-12 z-10 w-12 bg-gradient-to-r from-white to-transparent',
          current === 0 && 'hidden'
        )}
      />
      <Carousel setApi={setApi} opts={{ align: 'start', dragFree: true }} className="w-full px-12">
        <CarouselContent className="-ml-3">
          {!isLoading && (
            <CarouselItem className="basis-auto pl-3" onClick={() => onSelect(null)}>
              <Badge variant={!value ? 'default' : 'secondary'} className="cursor-pointer rounded-lg px-3 py-1 text-sm whitespace-nowrap">
                全部
              </Badge>
            </CarouselItem>
          )}
          {isLoading &&
            Array.from({ length: 30 }).map((_, index) => (
              <CarouselItem key={index} className="basis-auto pl-3">
                <Skeleton className="h-full w-[70px] rounded-lg px-3 py-1 text-sm font-semibold">&nbsp;</Skeleton>
              </CarouselItem>
            ))}
          {!isLoading &&
            data.map(item => (
              <CarouselItem key={item.value} className="basis-auto pl-3" onClick={() => onSelect(item.value)}>
                <Badge
                  variant={value === item.value ? 'default' : 'secondary'}
                  className="cursor-pointer rounded-lg px-3 py-1 text-sm whitespace-nowrap"
                >
                  {item.label}
                </Badge>
              </CarouselItem>
            ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 z-20" />
        <CarouselNext className="right-0 z-20" />
      </Carousel>
      {/*右侧淡出*/}
      <div
        className={cn(
          'pointer-events-none absolute top-0 right-12 bottom-0 z-10 w-12 bg-gradient-to-l from-white to-transparent',
          current === count - 1 && 'hidden'
        )}
      />
    </div>
  )
}
