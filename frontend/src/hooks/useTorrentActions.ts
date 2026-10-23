import { useCallback } from 'react'
import { toast } from 'sonner'
import { postAction } from '@/api/client'
import type { Action } from '@/api/types'

function plural(count: number): string {
  return count === 1 ? '1 torrent' : `${count} torrents`
}

export function useTorrentActions() {
  const run = useCallback(async (action: Action, okMessage?: string) => {
    try {
      await postAction(action)
      if (okMessage) toast.success(okMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }, [])

  // The backend has no batch endpoint, so bulk actions fan out one request per
  // torrent and report a single toast for the whole set.
  const runMany = useCallback(async (actions: Action[], okMessage: string) => {
    if (actions.length === 0) return
    try {
      await Promise.all(actions.map(postAction))
      toast.success(okMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }, [])

  return {
    start: (id: number) => run({ action: 'start', id }),
    stop: (id: number) => run({ action: 'stop', id }),
    startMany: (ids: number[]) =>
      runMany(ids.map((id) => ({ action: 'start', id })), `Started ${plural(ids.length)}`),
    stopMany: (ids: number[]) =>
      runMany(ids.map((id) => ({ action: 'stop', id })), `Stopped ${plural(ids.length)}`),
    remove: (id: number, deleteData: boolean) =>
      run({ action: 'remove', id, deleteData }, 'Torrent removed'),
    reannounce: (id: number) => run({ action: 'reannounce', id }, 'Reannounce requested'),
    reannounceMany: (ids: number[]) =>
      runMany(ids.map((id) => ({ action: 'reannounce', id })), `Reannounce requested for ${plural(ids.length)}`),
    setRatio: (id: number, ratio: number, ratioMode: number) =>
      run({ action: 'set-ratio', id, ratio, ratioMode }, 'Ratio updated'),
  }
}
