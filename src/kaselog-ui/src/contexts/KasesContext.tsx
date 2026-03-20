import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { kases as kasesApi } from '../api/client'
import type { KaseResponse } from '../api/types'

interface KasesContextValue {
  kaseList: KaseResponse[]
  loading: boolean
  refresh: () => void
}

const KasesContext = createContext<KasesContextValue | null>(null)

export function KasesProvider({ children }: { children: ReactNode }) {
  const [kaseList, setKaseList] = useState<KaseResponse[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    kasesApi
      .list()
      .then(setKaseList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <KasesContext.Provider value={{ kaseList, loading, refresh }}>
      {children}
    </KasesContext.Provider>
  )
}

export function useKases() {
  const ctx = useContext(KasesContext)
  if (!ctx) throw new Error('useKases must be used within KasesProvider')
  return ctx
}
