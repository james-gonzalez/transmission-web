import { useCallback } from 'react'
import { toast } from 'sonner'
import { postAction } from '@/api/client'
import type { Action } from '@/api/types'

export function useTorrentActions() {
  const run = useCallback(async (action: Action, okMessage?: string) => {
    try {
      await postAction(action)
      if (okMessage) toast.success(okMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }, [])

  return {
    start: (id: number) => run({ action: 'start', id }),
    stop: (id: number) => run({ action: 'stop', id }),
    remove: (id: number, deleteData: boolean) =>
      run({ action: 'remove', id, deleteData }, 'Torrent removed'),
    reannounce: (id: number) => run({ action: 'reannounce', id }, 'Reannounce requested'),
    reannounceAll: () => run({ action: 'reannounce-all' }, 'Reannounce requested for all torrents'),
    setRatio: (id: number, ratio: number, ratioMode: number) =>
      run({ action: 'set-ratio', id, ratio, ratioMode }, 'Ratio updated'),
    setGlobalRatio: (ratio: number, enabled: boolean) =>
      run({ action: 'set-global-ratio', ratio, enabled }),
  }
}
