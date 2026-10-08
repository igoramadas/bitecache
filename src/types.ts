// Bitecache Types

/**
 * Valid cache key types, all converted to string internally.
 */
export type CacheKey = string | number | Date

/**
 * Options to setup a cache collection.
 */
export interface CacheOptions {
    /** Default expiration in seconds (minimum 0.1). */
    expiresIn: number
    /** Max items on the collection, least recently used items are evicted first. */
    maxItems?: number
    /** If true, reading an item renews its expiration. */
    sliding?: boolean
    /** If true, data is deep cloned (structuredClone) when set and when read. */
    clone?: boolean
    /** Called when an item expires. */
    onExpire?: (key: string, data: any) => void
    /** Called when an item is evicted due to `maxItems`. */
    onEvict?: (key: string, data: any) => void
}

/**
 * A collection of cached items.
 */
export interface CacheCollection<T = any> extends CacheOptions {
    /** Cached items, least recently used first. */
    items: Map<string, CacheItem<T>>
    /** Timer to expire old items.  */
    expireTimer: any
    /** Items being loaded by getOrSet(). */
    pending: Map<string, Promise<T>>
    /** Cache hits (count). */
    hits: number
    /** Cache misses (count). */
    misses: number
    /** Evicted items (count). */
    evictions: number
}

/**
 * A cached item.
 */
export interface CacheItem<T = any> {
    /** Cached data. */
    data: T
    /** Expire timestamp (epoch). */
    expires: number
    /** Time to live (milliseconds). */
    ttl: number
}

/**
 * Cache collection stats.
 */
export interface CacheStats {
    /** How many items cached. */
    size: number
    /** Approx. memory used. */
    memSize: number
    /** Total of cache hits. */
    hits: number
    /** Total of cache misses. */
    misses: number
    /** Hits divided by hits + misses (0 if there were no reads). */
    hitRatio: number
    /** Total of items evicted due to maxItems. */
    evictions: number
    /** Expires in. */
    expiresIn: number
    /** Max items, if set. */
    maxItems?: number
}

/**
 * Handle to a single collection with typed data, created with `collection()`.
 */
export interface TypedCollection<T> {
    set(key: CacheKey, value: T, expiresIn?: number): void
    get(key: CacheKey): T | null
    getOrSet(key: CacheKey, loader: () => T | Promise<T>, expiresIn?: number): Promise<T>
    has(key: CacheKey): boolean
    del(key: CacheKey): boolean
    touch(key: CacheKey, expiresIn?: number): boolean
    merge(key: CacheKey, dataToMerge: Partial<T>): boolean
    keys(): string[]
    values(): T[]
    entries(): [string, T][]
    clear(): void
    stats(): CacheStats
}
