import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { connettiDrive, isDriveConnesso } from '@/lib/drive'

export default function ConnessioneDrive() {
  const [connesso, setConnesso] = useState<boolean | null>(null)

  useEffect(() => {
    isDriveConnesso().then(setConnesso)
  }, [])

  if (connesso === null) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3">
          <HardDrive size={20} className={connesso ? 'text-accent' : 'text-text-muted'} />
          <span className="font-medium">
            {connesso ? 'Google Drive collegato' : 'Google Drive non collegato'}
          </span>
        </span>
        {!connesso && (
          <button onClick={connettiDrive} className="text-accent text-sm font-semibold">
            Collega
          </button>
        )}
      </div>
      {!connesso && (
        <p className="text-text-muted text-xs mt-2">
          Serve solo se vuoi che le trasferte che crei tu abbiano una cartella foto automatica sul
          tuo Drive (15GB gratis).
        </p>
      )}
    </div>
  )
}
