import { useEffect, useState } from 'react'
import type { SessionStats, StreamPayload, Torrent } from '@/api/types'

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

export function useTorrentStream() {
  const [torrents, setTorrents] = useState<Torrent[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    const source = new EventSource('/api/stream')

    source.addEventListener('open', () => setStatus('live'))
    source.onerror = () => setStatus('offline')
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as StreamPayload
      // Go marshals a nil torrents slice as `null` rather than `[]`.
      setTorrents(payload.torrents ?? [])
      setStats(payload.stats)
    }

    return () => source.close()
  }, [])

  return { torrents, stats, status }
}
