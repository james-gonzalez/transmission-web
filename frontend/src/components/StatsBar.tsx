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
    <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn('font-semibold text-primary', valueClassName)}>{value}</span>
    </div>
  )
}

export function StatsBar({ stats, libraryRatio, freeSpace, portOpen }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Stat label="Down" value={formatSpeed(stats?.downloadSpeed ?? 0)} valueClassName="text-downloading" />
      <Stat label="Up" value={formatSpeed(stats?.uploadSpeed ?? 0)} />
      <Stat label="Torrents" value={String(stats?.torrentCount ?? 0)} />
      <Stat
        label="Ratio"
        value={formatRatio(libraryRatio)}
        valueClassName="text-foreground"
      />
      {freeSpace && (
        <>
          <Stat
            label="Disk"
            value={`${formatBytes(freeSpace.total_size - freeSpace['size-bytes'])} / ${formatBytes(freeSpace.total_size)}`}
          />
          <Stat
            label="Free"
            value={formatBytes(freeSpace['size-bytes'])}
            valueClassName={freeSpace['size-bytes'] < TEN_GIB ? 'text-destructive' : undefined}
          />
        </>
      )}
      {portOpen !== null && (
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold uppercase',
            portOpen ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
          )}
        >
          Port {portOpen ? 'Open' : 'Closed'}
        </span>
      )}
    </div>
  )
}
