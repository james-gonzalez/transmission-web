import { useEffect, useState } from 'react'
import { TorrentCard } from './TorrentCard'
import { Button } from '@/components/ui/button'
import { filterTorrents, type FilterKey } from '@/lib/filters'
import type { Torrent } from '@/api/types'

const PAGE_SIZE = 25

interface TorrentListProps {
  torrents: Torrent[]
  filter: FilterKey
  search: string
  onRequestRemove: (torrent: Torrent) => void
}

export function TorrentList({ torrents, filter, search, onRequestRemove }: TorrentListProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const filtered = filterTorrents(torrents, filter, search)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [filter, search])

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
      {paged.map((torrent) => (
        <TorrentCard
          key={torrent.id}
          torrent={torrent}
          isOpen={openId === torrent.id}
          onToggleOpen={() => setOpenId((prev) => (prev === torrent.id ? null : torrent.id))}
          onRequestRemove={onRequestRemove}
        />
      ))}

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
