import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDuration = (duration: number) => {
  const seconds = Math.floor((duration % 60000) / 1000)
  const minutes = Math.floor(duration / 60000)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const formatVideoStatus = (status: string): string => {
  const map: Record<string, string> = {
    ready: '已就绪',
    preparing: '处理中',
    waiting: '等待中',
    error: '状态错误',
  }

  const lowerStatus = status.toLowerCase().trim()

  return map[lowerStatus] || '未知状态'
}

export const formatVideoVisiblity = (visiblity: string): string => {
  const map: Record<string, string> = {
    public: '所有人',
    private: '仅自己',
    error: '出错啦',
  }

  const lowervisiblity = visiblity.toLowerCase().trim()

  return map[lowervisiblity]
}
