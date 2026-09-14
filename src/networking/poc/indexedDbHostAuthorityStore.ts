import type { HostAuthorityState } from './hostAuthorityModel'
import type { HostAuthorityStore } from './hostAuthoritySession'

const DB_NAME = 'c00lgames-poc-host-authority'
const DB_VERSION = 1
const STORE_NAME = 'parties'

export class IndexedDbHostAuthorityStore implements HostAuthorityStore {
  private readonly factory: IDBFactory | null
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(factory: IDBFactory | null = globalThis.indexedDB ?? null) {
    this.factory = factory
  }

  async load(partyId: string): Promise<unknown> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(partyId)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB read aborted'))
    })
  }

  async save(state: HostAuthorityState): Promise<void> {
    const database = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(state)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'))
    })
  }

  close() {
    void this.databasePromise?.then((database) => database.close()).catch(() => undefined)
    this.databasePromise = null
  }

  private open() {
    if (!this.factory) {
      return Promise.reject(new Error('IndexedDB is unavailable in this browser context'))
    }
    if (!this.databasePromise) {
      this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory!.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const database = request.result
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'partyId' })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
        request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'))
      })
    }
    return this.databasePromise
  }
}
