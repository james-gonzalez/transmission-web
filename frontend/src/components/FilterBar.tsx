import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FILTERS, type FilterKey } from '@/lib/filters'
import type { Torrent } from '@/api/types'
import { countByFilter } from '@/lib/filters'

interface FilterBarProps {
  torrents: Torrent[]
  filter: FilterKey
  onFilterChange: (filter: FilterKey) => void
  search: string
  onSearchChange: (search: string) => void
}

export function FilterBar({ torrents, filter, onFilterChange, search, onSearchChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'ghost'}
            onClick={() => onFilterChange(key)}
          >
            {label}
            <Badge variant="secondary" className="ml-1">
              {countByFilter(torrents, key)}
            </Badge>
          </Button>
        ))}
      </div>
      <div className="relative min-w-56 flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search torrents..."
          className="pl-8"
        />
      </div>
    </div>
  )
}
