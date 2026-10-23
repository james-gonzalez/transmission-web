import { formatBytes, formatRatio, formatSpeed } from '@/lib/format'
import type { FreeSpace, SessionStats } from '@/api/types'
import { cn } from '@/lib/utils'

interface StatsBarProps {
  stats: SessionStats | null
  libraryRatio: number
  freeSpace: FreeSpace | null
  portOpen: boolean | null
}

const TEN_GIB = 10 * 1024 * 1024 * 1024

function Stat({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn('truncate text-sm font-semibold tabular-nums', valueClassName)}>{value}</div>
    </div>
  )
}

// Cells are separated by the 1px gap showing the border colour through, which
// keeps dividers correct however the grid wraps.
export function StatsBar({ stats, libraryRatio, freeSpace, portOpen }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-foreground/10 sm:grid-cols-6">
      <Stat label="Down" value={formatSpeed(stats?.downloadSpeed ?? 0)} valueClassName="text-downloading" />
      <Stat label="Up" value={formatSpeed(stats?.uploadSpeed ?? 0)} valueClassName="text-primary" />
      <Stat label="Torrents" value={String(stats?.torrentCount ?? 0)} />
      <Stat label="Ratio" value={formatRatio(libraryRatio)} />
      <Stat
        label={freeSpace ? `Free of ${formatBytes(freeSpace.total_size)}` : 'Free'}
        value={freeSpace ? formatBytes(freeSpace['size-bytes']) : '—'}
        valueClassName={freeSpace && freeSpace['size-bytes'] < TEN_GIB ? 'text-destructive' : undefined}
      />
      <Stat
        label="Port"
        value={portOpen === null ? '—' : portOpen ? 'Open' : 'Closed'}
        valueClassName={portOpen === null ? undefined : portOpen ? 'text-success' : 'text-destructive'}
      />
    </div>
  )
}
