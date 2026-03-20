import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { collections as collectionsApi } from '../api/client'
import type { CollectionResponse } from '../api/types'

interface CollectionsContextValue {
  collectionList: CollectionResponse[]
  loading: boolean
  refresh: () => void
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null)

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collectionList, setCollectionList] = useState<CollectionResponse[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    collectionsApi
      .list()
      .then(setCollectionList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <CollectionsContext.Provider value={{ collectionList, loading, refresh }}>
      {children}
    </CollectionsContext.Provider>
  )
}

export function useCollections() {
  const ctx = useContext(CollectionsContext)
  if (!ctx) throw new Error('useCollections must be used within CollectionsProvider')
  return ctx
}
