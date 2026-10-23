import { Scale, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatsBar } from '@/components/StatsBar'
import { ConnectionIndicator } from '@/components/ConnectionIndicator'
import type { ConnectionStatus } from '@/hooks/useTorrentStream'
import type { FreeSpace, SessionStats } from '@/api/types'

interface HeaderProps {
  status: ConnectionStatus
  stats: SessionStats | null
  libraryRatio: number
  freeSpace: FreeSpace | null
  portOpen: boolean | null
  onOpenStats: () => void
  onOpenGlobalRatio: () => void
}

export function Header({ status, stats, libraryRatio, freeSpace, portOpen, onOpenStats, onOpenGlobalRatio }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-primary">Transmission Web</h1>
        <ConnectionIndicator status={status} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <StatsBar stats={stats} libraryRatio={libraryRatio} freeSpace={freeSpace} portOpen={portOpen} />
        <Button variant="secondary" size="sm" onClick={onOpenGlobalRatio} title="Set the daemon-wide default seed ratio">
          <Scale /> Seed Ratio
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenStats} title="Daemon statistics">
          <BarChart3 /> Stats
        </Button>
      </div>
    </header>
  )
}
