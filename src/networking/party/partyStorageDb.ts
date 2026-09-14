const PARTY_DB_NAME = 'coolgamesplus-party-v1'
const PARTY_DB_VERSION = 1
export const HOST_PARTY_STORE_NAME = 'host-parties'
export const GUEST_PARTY_STORE_NAME = 'guest-parties'

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function openPartyStorageDb(factory: IDBFactory | undefined = globalThis.indexedDB) {
  if (!factory) {
    throw new Error('IndexedDB is unavailable in this browser')
  }

  const request = factory.open(PARTY_DB_NAME, PARTY_DB_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(HOST_PARTY_STORE_NAME)) {
      db.createObjectStore(HOST_PARTY_STORE_NAME, { keyPath: 'partyId' })
    }
    if (!db.objectStoreNames.contains(GUEST_PARTY_STORE_NAME)) {
      db.createObjectStore(GUEST_PARTY_STORE_NAME, { keyPath: 'partyId' })
    }
  }
  return requestResult(request)
}

export async function readPartyRecord<T>(db: IDBDatabase, storeName: string, partyId: string) {
  const transaction = db.transaction(storeName, 'readonly')
  const result = await requestResult(transaction.objectStore(storeName).get(partyId))
  return (result ?? null) as T | null
}

export async function writePartyRecord<T>(db: IDBDatabase, storeName: string, record: T) {
  const transaction = db.transaction(storeName, 'readwrite')
  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
  transaction.objectStore(storeName).put(record)
  await completion
}
