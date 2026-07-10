import { useCallback, useEffect, useState } from 'react'

export type NotificationWorkflowStatus = 'started' | 'replied' | 'resolved'

export type NotificationWorkflowRecord = {
  status: NotificationWorkflowStatus
  updatedAt: string
}

const STORAGE_KEY = 'checkmark-notification-workflow-v1'
const CHANGE_EVENT = 'checkmark-notification-workflow-change'
const RETAIN_MS = 7 * 24 * 60 * 60 * 1000

function isFresh(record: NotificationWorkflowRecord): boolean {
  return Date.now() - new Date(record.updatedAt).getTime() <= RETAIN_MS
}

function readStore(): Record<string, NotificationWorkflowRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, NotificationWorkflowRecord>
    const fresh = Object.fromEntries(
      Object.entries(parsed).filter(([, record]) => record?.updatedAt && isFresh(record)),
    )
    if (Object.keys(fresh).length !== Object.keys(parsed).length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    }
    return fresh
  } catch {
    return {}
  }
}

function writeStore(next: Record<string, NotificationWorkflowRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function notificationWorkflowKey(kind: 'dm' | 'forum' | 'assignment', id: string): string {
  return `${kind}:${id}`
}

export function useNotificationWorkflow() {
  const [records, setRecords] = useState<Record<string, NotificationWorkflowRecord>>(() => readStore())

  useEffect(() => {
    const bump = () => setRecords(readStore())
    window.addEventListener(CHANGE_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(CHANGE_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const getRecord = useCallback((key: string): NotificationWorkflowRecord | null => {
    return records[key] ?? null
  }, [records])

  const setStatus = useCallback((key: string, status: NotificationWorkflowStatus) => {
    const current = readStore()
    const next = {
      ...current,
      [key]: { status, updatedAt: new Date().toISOString() },
    }
    setRecords(next)
    writeStore(next)
  }, [])

  return {
    records,
    getRecord,
    setStarted: (key: string) => setStatus(key, 'started'),
    setReplied: (key: string) => setStatus(key, 'replied'),
    setResolved: (key: string) => setStatus(key, 'resolved'),
  }
}
