// Bitecache

import type {CacheCollection, CacheItem, CacheKey, CacheOptions as CacheOptionsType, CacheStats as CacheStatsType, TypedCollection as TypedCollectionType} from "./types"
import logger from "anyhow"

/**
 * Bitecache wrapper.
 */
class Bitecache {
    private constructor() {}
    private static _instance: Bitecache
    static get Instance() {
        return this._instance || (this._instance = new this())
    }

    /**
     * Main holder of cached objects.
     */
    readonly store: {[collection: string]: CacheCollection} = {}

    /**
     * Total cache size.
     */
    get totalSize(): number {
        let result = 0
        for (let collection in this.store) {
            result += this.store[collection].items.size
        }
        return result
    }

    /**
     * Total memory used by the cache.
     */
    get totalMemSize(): number {
        let result = 0
        for (let collection in this.store) {
            result += this.memSizeOf(collection)
        }
        return result
    }

    /**
     * Total cache hits.
     */
    get totalHits(): number {
        let result = 0
        for (let collection in this.store) {
            result += this.store[collection].hits
        }
        return result
    }

    /**
     * Total cache misses.
     */
    get totalMisses(): number {
        let result = 0
        for (let collection in this.store) {
            result += this.store[collection].misses
        }
        return result
    }

    /**
     * If set to false, will not throw errors when trying to get
     * or set data from invalid cache collections. Default is true.
     */
    strict: boolean = true

    // SETUP
    // --------------------------------------------------------------------------

    /**
     * Setup a cache object with the specified name. Calling it again for the
     * same name replaces the collection (and its items).
     * @param collection The collection name.
     * @param options Default expiration in seconds, or an options object.
     */
    setup = (collection: string, options: number | CacheOptionsType): void => {
        const opts: CacheOptionsType = typeof options == "object" && options ? options : {expiresIn: options as number}

        // Also catches NaN and undefined.
        const expiresIn = opts.expiresIn >= 0.1 ? opts.expiresIn : 0.1

        // Make sure Anyhow was set up.
        if (!logger.isReady) {
            logger.setup()
        }

        // Replace current or create new collection?
        const current = this.store[collection]
        if (current) {
            clearInterval(current.expireTimer)
            logger.info("Bitecache.setup", collection, `Expires in ${expiresIn}s`, "Collection already exists, will overwrite it")
        } else {
            logger.info("Bitecache.setup", collection, `Expires in ${expiresIn}s`)
        }

        // Create and save the store collection.
        this.store[collection] = {
            ...opts,
            expiresIn: expiresIn,
            items: new Map(),
            pending: new Map(),
            expireTimer: setInterval(() => this.expire(collection), expiresIn * 1000).unref(),
            hits: 0,
            misses: 0,
            evictions: 0
        }
    }

    /**
     * Stop the expiration timer and remove the specified collection.
     * @param collection Optional collection, if not specified will destroy all collections.
     */
    destroy = (collection?: string): void => {
        try {
            for (const name of collection ? [collection] : Object.keys(this.store)) {
                const store = this.getStore(name)
                if (!store) continue

                clearInterval(store.expireTimer)
                delete this.store[name]
            }
        } catch (ex) {
            logger.error("Bitecache.destroy", collection, ex)
            throw ex
        }
    }

    /**
     * Get a handle to a single collection, with typed data.
     * @param collection Cache collection name.
     */
    collection = <T = any>(collection: string): TypedCollectionType<T> => {
        return {
            set: (key, value, expiresIn) => this.set<T>(collection, key, value, expiresIn),
            get: (key) => this.get<T>(collection, key),
            getOrSet: (key, loader, expiresIn) => this.getOrSet<T>(collection, key, loader, expiresIn),
            has: (key) => this.has(collection, key),
            del: (key) => this.del(collection, key),
            touch: (key, expiresIn) => this.touch(collection, key, expiresIn),
            merge: (key, dataToMerge) => this.merge(collection, key, dataToMerge),
            keys: () => this.keys(collection),
            values: () => this.values<T>(collection),
            entries: () => this.entries<T>(collection),
            clear: () => this.clear(collection),
            stats: () => this.stats(collection)
        }
    }

    // METHODS
    // --------------------------------------------------------------------------

    /**
     * Add an object to the specified cache collection.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @param value The actual object.
     * @param expiresIn Optional if object should expire on a specific interval.
     */
    set = <T = any>(collection: string, key: CacheKey, value: T, expiresIn?: number): void => {
        try {
            const store = this.getStore(collection)
            if (!store) return

            // Defaults to store's expiresIn if the value is not valid.
            const ttl = (expiresIn > 0 ? expiresIn : store.expiresIn) * 1000
            const id = key.toString()

            // Clone first so a failed clone keeps the existing value.
            const data = store.clone ? structuredClone(value) : value

            // Delete first so overwritten keys also become the most recently used.
            store.items.delete(id)
            store.items.set(id, {data: data, expires: Date.now() + ttl, ttl: ttl})

            // Evict least recently used items above the limit.
            if (store.maxItems > 0) {
                for (const [oldId, oldItem] of store.items) {
                    if (store.items.size <= store.maxItems) break

                    store.items.delete(oldId)
                    store.evictions++
                    this.notify(store.onEvict, oldId, oldItem.data)
                }
            }
        } catch (ex) {
            logger.error("Bitecache.set", collection, key, ex)
            throw ex
        }
    }

    /**
     * Get an object from the specified cache collection.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @returns The cached data, or null if not found or expired.
     */
    get = <T = any>(collection: string, key: CacheKey): T | null => {
        try {
            const store = this.getStore(collection)
            if (!store) return

            const item = this.lookup(store, key.toString())
            return item ? this.output(store, item.data) : null
        } catch (ex) {
            logger.error("Bitecache.get", collection, key, ex)
            throw ex
        }
    }

    /**
     * Get an object from the cache, or load and cache it if missing. Concurrent
     * calls for the same key share a single loader call. If the collection is
     * invalid and strict is false, the loader result is returned without caching.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @param loader Function (sync or async) that returns the data to be cached.
     * @param expiresIn Optional if object should expire on a specific interval.
     */
    getOrSet = async <T = any>(collection: string, key: CacheKey, loader: () => T | Promise<T>, expiresIn?: number): Promise<T> => {
        try {
            const store = this.getStore(collection)
            if (!store) return await loader()

            const id = key.toString()
            const pending = store.pending.get(id)
            if (pending) return await pending

            const item = this.lookup(store, id)
            if (item) return this.output(store, item.data)

            const loading = (async () => loader())()
                .then((value) => {
                    this.set(collection, id, value, expiresIn)
                    return value
                })
                .finally(() => store.pending.delete(id))

            store.pending.set(id, loading)
            return await loading
        } catch (ex) {
            logger.error("Bitecache.getOrSet", collection, key, ex)
            throw ex
        }
    }

    /**
     * Check if the key exists (and did not expire) on the specified cache collection.
     * Does not affect hits, misses or the least recently used order.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     */
    has = (collection: string, key: CacheKey): boolean => {
        try {
            const store = this.getStore(collection)
            return store ? !!this.peek(store, key.toString()) : false
        } catch (ex) {
            logger.error("Bitecache.has", collection, key, ex)
            throw ex
        }
    }

    /**
     * Remove an object from the specified cache collection.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @returns True if the object existed.
     */
    del = (collection: string, key: CacheKey): boolean => {
        try {
            const store = this.getStore(collection)
            return store ? store.items.delete(key.toString()) : false
        } catch (ex) {
            logger.error("Bitecache.del", collection, key, ex)
            throw ex
        }
    }

    /**
     * Renew the expiration of an object on the specified cache collection.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @param expiresIn Optional new expiration in seconds, defaults to the item's current one.
     * @returns True if the object exists and was renewed.
     */
    touch = (collection: string, key: CacheKey, expiresIn?: number): boolean => {
        try {
            const store = this.getStore(collection)
            const item = store ? this.peek(store, key.toString()) : null
            if (!item) return false

            if (expiresIn > 0) item.ttl = expiresIn * 1000
            item.expires = Date.now() + item.ttl
            return true
        } catch (ex) {
            logger.error("Bitecache.touch", collection, key, ex)
            throw ex
        }
    }

    /**
     * Merge (shallow copy) data to an existing object on the specified cache collection.
     * @param collection Cache collection name.
     * @param key The object's unique key.
     * @param dataToMerge The data to be merged.
     * @returns True if the data was merged (the cached item must be a non-null object).
     */
    merge = (collection: string, key: CacheKey, dataToMerge: any): boolean => {
        try {
            const store = this.getStore(collection)
            const item = store ? this.peek(store, key.toString()) : null
            if (!item || !item.data || typeof item.data != "object") return false

            Object.assign(item.data, dataToMerge)
            return true
        } catch (ex) {
            logger.error("Bitecache.merge", collection, key, ex)
            throw ex
        }
    }

    /**
     * List the [key, data] pairs of the specified cache collection, least recently used first.
     * @param collection Cache collection name.
     */
    entries = <T = any>(collection: string): [string, T][] => {
        try {
            const store = this.getStore(collection)
            if (!store) return []

            this.expire(collection)
            return Array.from(store.items, ([id, item]) => [id, this.output(store, item.data)])
        } catch (ex) {
            logger.error("Bitecache.entries", collection, ex)
            throw ex
        }
    }

    /**
     * List the keys of the specified cache collection.
     * @param collection Cache collection name.
     */
    keys = (collection: string): string[] => this.entries(collection).map(([id]) => id)

    /**
     * List the data of the specified cache collection.
     * @param collection Cache collection name.
     */
    values = <T = any>(collection: string): T[] => this.entries<T>(collection).map(([, data]) => data)

    /**
     * Remove old items from the specified cache collection.
     * @param collection Cache collection name.
     */
    expire = (collection: string): void => {
        try {
            const store = this.getStore(collection)
            if (!store) return

            const now = Date.now()
            for (const [id, item] of store.items) {
                if (item.expires <= now) this.drop(store, id, item)
            }
        } catch (ex) {
            logger.error("Bitecache.expire", collection, ex)
            throw ex
        }
    }

    /**
     * Clear the cache.
     * @param collection Optional collection, if not specified will clear all collections.
     */
    clear = (collection?: string): void => {
        try {
            for (const name of collection ? [collection] : Object.keys(this.store)) {
                const store = this.getStore(name)
                if (!store) continue

                store.items.clear()
                store.hits = store.misses = store.evictions = 0
            }
        } catch (ex) {
            logger.error("Bitecache.clear", collection, ex)
            throw ex
        }
    }

    /**
     * Get individual stats for the specified cache collection.
     * @param collection Cache collection name.
     */
    stats = (collection: string): CacheStatsType => {
        try {
            const store = this.getStore(collection)
            if (!store) return

            const reads = store.hits + store.misses

            return {
                size: store.items.size,
                memSize: this.memSizeOf(collection),
                hits: store.hits,
                misses: store.misses,
                hitRatio: reads ? store.hits / reads : 0,
                evictions: store.evictions,
                expiresIn: store.expiresIn,
                maxItems: store.maxItems
            }
        } catch (ex) {
            logger.error("Bitecache.stats", collection, ex)
            throw ex
        }
    }

    // HELPERS
    // --------------------------------------------------------------------------

    /**
     * Calculate (approximate) memory usage for the specified collection.
     * It walks all cached data, so avoid calling it on hot paths.
     * @param collection Cache collection name.
     */
    memSizeOf = (collection: string): number => {
        try {
            const store = this.getStore(collection)
            if (!store) return

            const seen = new Set<object>()
            const stack: any[] = []
            let bytes = 0

            // Item keys plus the expires and ttl numbers.
            for (const [id, item] of store.items) {
                bytes += id.length * 2 + 16
                stack.push(item.data)
            }

            while (stack.length) {
                const value = stack.pop()

                if (typeof value === "boolean") {
                    bytes += 4
                } else if (typeof value === "number" || typeof value === "bigint") {
                    bytes += 8
                } else if (typeof value === "string") {
                    bytes += value.length * 2
                } else if (typeof value === "object" && value !== null && !seen.has(value)) {
                    seen.add(value)

                    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
                        bytes += value.byteLength
                    } else if (value instanceof Date) {
                        bytes += 8
                    } else if (value instanceof Map) {
                        for (const [k, v] of value) stack.push(k, v)
                    } else if (value instanceof Set) {
                        for (const v of value) stack.push(v)
                    } else {
                        const isArray = Array.isArray(value)

                        for (const key in value) {
                            if (!isArray) bytes += 2 * key.length
                            stack.push(value[key])
                        }
                    }
                }
            }

            return bytes
        } catch (ex) {
            logger.error("Bitecache.memSizeOf", collection, ex)
            throw ex
        }
    }

    /**
     * Get the collection, or throw if invalid and strict is true.
     */
    private getStore = (collection: string): CacheCollection => {
        const store = this.store[collection]
        if (!store && this.strict) throw new Error(`Invalid collection: ${collection}`)
        return store
    }

    /**
     * Get a non-expired item without touching stats. Expired items are dropped.
     */
    private peek = (store: CacheCollection, id: string): CacheItem | null => {
        const item = store.items.get(id)

        if (item && item.expires <= Date.now()) {
            this.drop(store, id, item)
            return null
        }

        return item || null
    }

    /**
     * Read an item counting hits and misses, and applying sliding expiration and LRU order.
     */
    private lookup = (store: CacheCollection, id: string): CacheItem | null => {
        const item = this.peek(store, id)

        if (!item) {
            store.misses++
            return null
        }

        store.hits++
        if (store.sliding) item.expires = Date.now() + item.ttl

        // Re-insert so the item becomes the most recently used.
        if (store.maxItems > 0) {
            store.items.delete(id)
            store.items.set(id, item)
        }

        return item
    }

    /**
     * Remove an expired item and notify the collection's onExpire.
     */
    private drop = (store: CacheCollection, id: string, item: CacheItem): void => {
        store.items.delete(id)
        this.notify(store.onExpire, id, item.data)
    }

    /**
     * Call a collection callback, logging instead of throwing so it can't break the cache.
     */
    private notify = (callback: (key: string, data: any) => void, id: string, data: any): void => {
        try {
            callback?.(id, data)
        } catch (ex) {
            logger.error("Bitecache.callback", id, ex)
        }
    }

    /**
     * Data to return to callers, cloned if the collection requires it.
     */
    private output = (store: CacheCollection, data: any): any => {
        return store.clone ? structuredClone(data) : data
    }
}

// Exports...
const bitecache = Bitecache.Instance

// Type-only namespace merged with the instance, so types can be imported by name.
declare namespace bitecache {
    export type CacheOptions = CacheOptionsType
    export type CacheStats = CacheStatsType
    export type TypedCollection<T> = TypedCollectionType<T>
}

export = bitecache
