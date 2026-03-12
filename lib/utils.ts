import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VizFilter, JoinFilter, Row } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 格式化日期为中文
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 生成随机 ID（时间戳 + 随机串）
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 生成随机 token（32字符十六进制）
export function generateToken(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// 应用过滤条件
export function applyFilters(rows: Row[], filters: VizFilter[] | JoinFilter[]): Row[] {
  return rows.filter((row) =>
    filters.every((f) => {
      const val = row[f.field] ?? ''
      const num = parseFloat(val)
      const filterNum = parseFloat(f.value)
      switch (f.op) {
        case 'eq':
          return val === f.value
        case 'neq':
          return val !== f.value
        case 'gt':
          return !isNaN(num) && !isNaN(filterNum) && num > filterNum
        case 'gte':
          return !isNaN(num) && !isNaN(filterNum) && num >= filterNum
        case 'lt':
          return !isNaN(num) && !isNaN(filterNum) && num < filterNum
        case 'lte':
          return !isNaN(num) && !isNaN(filterNum) && num <= filterNum
        case 'contains':
          return val.toLowerCase().includes(f.value.toLowerCase())
        default:
          return true
      }
    })
  )
}

// 默认中文日期案例名
export function defaultCaseName(): string {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return `案例 ${m}月${d}日`
}

// API 响应帮助函数
export function ok<T>(data: T): Response {
  return Response.json({ data, error: null })
}

export function err(message: string, status = 400, code?: string): Response {
  return Response.json({ data: null, error: { message, code } }, { status })
}
