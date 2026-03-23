import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { kases as kasesApi } from '../api/client'
import type { KaseResponse } from '../api/types'

interface KasesContextValue {
  kaseList: KaseResponse[]
  loading: boolean
  refresh: () => void
  /** Optimistically patch a single kase in the list without a full re-fetch. */
  updateKase: (updated: KaseResponse) => void
}

const KasesContext = createContext<KasesContextValue | null>(null)

export function KasesProvider({ children }: { children: ReactNode }) {
  const [kaseList, setKaseList] = useState<KaseResponse[]>([])
  const [loading, setLoading] = useState(true)

  /** Patch a single entry in the list — instant, no network call. */
  const updateKase = useCallback((updated: KaseResponse) => {
    setKaseList(prev => prev.map(k => k.id === updated.id ? updated : k))
  }, [])

  /**
   * Background re-fetch.  Does NOT flip loading to true so the list
   * stays visible while the network round-trip completes.
   */
  const refresh = useCallback(() => {
    kasesApi
      .list()
      .then(setKaseList)
      .catch(() => {})
  }, [])

  /** Initial load — shows the loading spinner once on mount. */
  useEffect(() => {
    setLoading(true)
    kasesApi
      .list()
      .then(setKaseList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <KasesContext.Provider value={{ kaseList, loading, refresh, updateKase }}>
      {children}
    </KasesContext.Provider>
  )
}

export function useKases() {
  const ctx = useContext(KasesContext)
  if (!ctx) throw new Error('useKases must be used within KasesProvider')
  return ctx
}
