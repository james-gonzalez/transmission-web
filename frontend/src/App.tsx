import { useEffect, useState } from 'react'
import { Rss } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/Header'
import { AddTorrentForm } from '@/components/AddTorrentForm'
import { FilterBar } from '@/components/FilterBar'
import { BulkActionsMenu } from '@/components/BulkActionsMenu'
import { TorrentList } from '@/components/torrents/TorrentList'
import { FeedsSection } from '@/components/rss/FeedsSection'
import { RemoveTorrentDialog } from '@/components/RemoveTorrentDialog'
import { StatsDialog } from '@/components/StatsDialog'
import { GlobalRatioDialog } from '@/components/GlobalRatioDialog'
import { useTorrentStream } from '@/hooks/useTorrentStream'
import { useTorrentActions } from '@/hooks/useTorrentActions'
import { getStats } from '@/api/client'
import { libraryRatio } from '@/lib/format'
import { filterTorrents, type FilterKey } from '@/lib/filters'
import type { SortKey } from '@/lib/sort'
import type { FreeSpace, Torrent } from '@/api/types'

const META_REFRESH_MS = 60_000

function App() {
  const { torrents, stats, status } = useTorrentStream()
  const { remove } = useTorrentActions()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('added')
  const [tab, setTab] = useState('torrents')
  const [removeTarget, setRemoveTarget] = useState<Torrent | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [globalRatioOpen, setGlobalRatioOpen] = useState(false)

  const visibleIds = filterTorrents(torrents, filter, search).map((t) => t.id)

  const [version, setVersion] = useState('dev')
  const [freeSpace, setFreeSpace] = useState<FreeSpace | null>(null)
  const [portOpen, setPortOpen] = useState<boolean | null>(null)

  useEffect(() => {
    const load = () => {
      getStats().then((data) => {
        setVersion(data.version)
        setFreeSpace(data.freeSpace)
        setPortOpen(data.portOpen)
      })
    }
    load()
    const interval = setInterval(load, META_REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-5">
      <Header
        status={status}
        stats={stats}
        libraryRatio={libraryRatio(torrents)}
        freeSpace={freeSpace}
        portOpen={portOpen}
        onOpenStats={() => setStatsOpen(true)}
        onOpenGlobalRatio={() => setGlobalRatioOpen(true)}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
        <TabsList>
          <TabsTrigger value="torrents">Torrents</TabsTrigger>
          <TabsTrigger value="rss">
            <Rss /> RSS Feeds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="torrents" className="flex flex-col gap-4">
          <AddTorrentForm />
          <FilterBar
            torrents={torrents}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            actions={<BulkActionsMenu ids={visibleIds} total={torrents.length} />}
          />
          <TorrentList torrents={torrents} filter={filter} search={search} sort={sort} onRequestRemove={setRemoveTarget} />
        </TabsContent>

        <TabsContent value="rss">
          <FeedsSection />
        </TabsContent>
      </Tabs>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Created by{' '}
        <a
          href="https://github.com/james-gonzalez/transmission-web"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          James Gonzalez
        </a>{' '}
        <span>v{version}</span>
      </footer>

      <RemoveTorrentDialog
        torrent={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={(id, deleteData) => {
          remove(id, deleteData)
          setRemoveTarget(null)
        }}
      />
      <StatsDialog open={statsOpen} onClose={() => setStatsOpen(false)} />
      <GlobalRatioDialog open={globalRatioOpen} onClose={() => setGlobalRatioOpen(false)} />
      <Toaster />
    </div>
  )
}

export default App
