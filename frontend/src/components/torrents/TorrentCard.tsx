import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RatioEditor } from './RatioEditor'
import { PeersPanel } from './PeersPanel'
import { TrackersPanel } from './TrackersPanel'
import { FilesPanel } from './FilesPanel'
import { useTorrentActions } from '@/hooks/useTorrentActions'
import { formatBytes, formatETA, formatPercent, formatRatio, formatSpeed, getStatusText } from '@/lib/format'
import { STATUS, type Torrent } from '@/api/types'
import { cn } from '@/lib/utils'

interface TorrentCardProps {
  torrent: Torrent
  isOpen: boolean
  onToggleOpen: () => void
  onRequestRemove: (torrent: Torrent) => void
}

export function TorrentCard({ torrent, isOpen, onToggleOpen, onRequestRemove }: TorrentCardProps) {
  const { start, stop, reannounce, setRatio } = useTorrentActions()
  const [ratioEditorOpen, setRatioEditorOpen] = useState(false)

  const isDownloading = torrent.status === STATUS.DOWNLOADING
  const isStopped = torrent.status === STATUS.STOPPED
  const isComplete = torrent.percentDone >= 1.0
  const hasError = torrent.error !== 0
  const percent = Math.round(torrent.percentDone * 100)

  return (
    <Card size="sm" className="transition-transform hover:translate-x-1">
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          className="cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={onToggleOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleOpen()
            }
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{torrent.name}</span>
            <Badge variant={isDownloading ? 'default' : isStopped ? 'secondary' : 'outline'}>
              {getStatusText(torrent.status)}
            </Badge>
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
              className={cn(
                'h-full rounded-full bg-primary transition-all duration-300',
                isDownloading && 'bg-downloading',
                isComplete && 'bg-success',
              )}
              style={{ width: `${torrent.percentDone * 100}%` }}
            />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="text-foreground">{formatPercent(torrent.percentDone)}</span>
            <span className="text-foreground">{formatBytes(torrent.sizeWhenDone)}</span>
            {torrent.status === STATUS.DOWNLOADING && (
              <span className="text-downloading">↓ {formatSpeed(torrent.rateDownload)}</span>
            )}
            {(torrent.status === STATUS.DOWNLOADING || torrent.status === STATUS.SEEDING) && (
              <span>↑ {formatSpeed(torrent.rateUpload)}</span>
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

        {hasError && torrent.errorString && (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>{torrent.errorString}</span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {isStopped ? (
            <Button size="xs" onClick={() => start(torrent.id)}>
              Start
            </Button>
          ) : (
            <Button size="xs" variant="secondary" onClick={() => stop(torrent.id)}>
              Stop
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={() => reannounce(torrent.id)}>
            Reannounce
          </Button>
          <Button size="xs" variant="outline" onClick={() => setRatioEditorOpen((v) => !v)}>
            Set Ratio
          </Button>
          <Button size="xs" variant="destructive" onClick={() => onRequestRemove(torrent)}>
            Remove
          </Button>
        </div>

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
