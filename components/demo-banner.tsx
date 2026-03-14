import { AlertTriangle } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 py-2 px-4 shadow-sm text-center sticky top-0 z-[100] backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-center gap-3 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 animate-pulse" />
        <span>
          <strong className="font-bold">Demo Mode Enabled:</strong> Search limit: 3 per hour | AI Chat limit: 10 per hour
        </span>
      </div>
    </div>
  )
}
