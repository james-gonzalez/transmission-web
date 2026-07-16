import { useState } from 'react'
import { TorrentCard } from './TorrentCard'
import { filterTorrents, type FilterKey } from '@/lib/filters'
import type { Torrent } from '@/api/types'

interface TorrentListProps {
  torrents: Torrent[]
  filter: FilterKey
  search: string
  onRequestRemove: (torrent: Torrent) => void
}

export function TorrentList({ torrents, filter, search, onRequestRemove }: TorrentListProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const filtered = filterTorrents(torrents, filter, search)

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl bg-card py-16 text-center">
        <h2 className="text-lg font-semibold">No Torrents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {torrents.length === 0 ? 'Add a magnet link or upload a .torrent file to get started' : 'No torrents match the current filter'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((torrent) => (
        <TorrentCard
          key={torrent.id}
          torrent={torrent}
          isOpen={openId === torrent.id}
          onToggleOpen={() => setOpenId((prev) => (prev === torrent.id ? null : torrent.id))}
          onRequestRemove={onRequestRemove}
        />
      ))}
    </div>
  )
}
