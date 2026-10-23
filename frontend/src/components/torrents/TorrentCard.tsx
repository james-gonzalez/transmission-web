import { useState } from 'react'
import { AlertTriangle, ChevronRight, MoreHorizontal, Pause, Play, RefreshCw, Scale, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RatioEditor } from './RatioEditor'
import { PeersPanel } from './PeersPanel'
import { TrackersPanel } from './TrackersPanel'
import { FilesPanel } from './FilesPanel'
import { useTorrentActions } from '@/hooks/useTorrentActions'
import {
  formatBytes,
  formatETA,
  formatPercent,
  formatRatio,
  formatSpeed,
  getStatusText,
  getStatusTone,
  type StatusTone,
} from '@/lib/format'
import { STATUS, type Torrent } from '@/api/types'
import { cn } from '@/lib/utils'

// One colour per status, shared by the badge and the progress bar.
const TONE_CLASSES: Record<StatusTone, { badge: string; bar: string }> = {
  downloading: { badge: 'bg-downloading/15 text-downloading', bar: 'bg-downloading' },
  seeding: { badge: 'bg-primary/15 text-primary', bar: 'bg-primary' },
  queued: { badge: 'bg-warning/15 text-warning', bar: 'bg-warning' },
  stopped: { badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/50' },
}

interface TorrentCardProps {
  torrent: Torrent
  isOpen: boolean
  onToggleOpen: () => void
  onRequestRemove: (torrent: Torrent) => void
}

export function TorrentCard({ torrent, isOpen, onToggleOpen, onRequestRemove }: TorrentCardProps) {
  const { start, stop, reannounce, setRatio } = useTorrentActions()
  const [ratioEditorOpen, setRatioEditorOpen] = useState(false)

  const isStopped = torrent.status === STATUS.STOPPED
  const tone = TONE_CLASSES[getStatusTone(torrent.status)]
  const hasError = torrent.error !== 0
  const percent = Math.round(torrent.percentDone * 100)

  return (
    <Card size="sm" className="transition-shadow hover:ring-foreground/20">
      <CardContent>
        <div className="flex items-start gap-2">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            className="min-w-0 flex-1 cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onToggleOpen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleOpen()
              }
            }}
          >
            <div className="flex items-center gap-1.5">
              <ChevronRight
                className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
              />
              <span className="line-clamp-2 text-sm font-semibold break-all sm:line-clamp-1">{torrent.name}</span>
              <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', tone.badge)}>
                {getStatusText(torrent.status)}
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={`${torrent.name} progress`}
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full rounded-full transition-all duration-300', tone.bar)}
                style={{ width: `${torrent.percentDone * 100}%` }}
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span className="text-foreground">{formatPercent(torrent.percentDone)}</span>
              <span className="text-foreground">{formatBytes(torrent.sizeWhenDone)}</span>
              {torrent.status === STATUS.DOWNLOADING && (
                <span className="text-downloading">↓ {formatSpeed(torrent.rateDownload)}</span>
              )}
              {(torrent.status === STATUS.DOWNLOADING || torrent.status === STATUS.SEEDING) && (
                <span className="text-primary">↑ {formatSpeed(torrent.rateUpload)}</span>
              )}
              <span>
                Ratio <span className="text-foreground">{formatRatio(torrent.uploadRatio)}</span>
                {torrent.seedRatioMode === 1 && `/${torrent.seedRatioLimit.toFixed(2)}`}
              </span>
              <span>
                Peers <span className="text-foreground">{torrent.peersConnected}</span>
              </span>
              {torrent.percentDone < 1.0 && torrent.eta > 0 && (
                <span>
                  ETA <span className="text-foreground">{formatETA(torrent.eta)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => (isStopped ? start(torrent.id) : stop(torrent.id))}
              aria-label={isStopped ? 'Start' : 'Stop'}
              title={isStopped ? 'Start' : 'Stop'}
            >
              {isStopped ? <Play /> : <Pause />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="ghost" aria-label="More actions" title="More actions" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem onClick={() => reannounce(torrent.id)}>
                  <RefreshCw /> Reannounce
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRatioEditorOpen((v) => !v)}>
                  <Scale /> Set ratio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onRequestRemove(torrent)}>
                  <Trash2 /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasError && torrent.errorString && (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>{torrent.errorString}</span>
          </div>
        )}

        {ratioEditorOpen && (
          <RatioEditor
            seedRatioLimit={torrent.seedRatioLimit}
            seedRatioMode={torrent.seedRatioMode}
            onSave={(ratio, ratioMode) => {
              setRatio(torrent.id, ratio, ratioMode)
              setRatioEditorOpen(false)
            }}
            onClose={() => setRatioEditorOpen(false)}
          />
        )}
      </CardContent>

      {isOpen && (
        <div className="border-t border-border bg-peers-bg px-2 pb-2">
          <Tabs defaultValue="peers">
            <TabsList>
              <TabsTrigger value="peers">Peers</TabsTrigger>
              <TabsTrigger value="trackers">Trackers</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
            <TabsContent value="peers">
              <PeersPanel torrentId={torrent.id} />
            </TabsContent>
            <TabsContent value="trackers">
              <TrackersPanel torrentId={torrent.id} />
            </TabsContent>
            <TabsContent value="files">
              <FilesPanel torrentId={torrent.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  )
}
