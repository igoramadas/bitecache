# Changelog for Bitecache

## 2.0.0

- NEW: Native ESM support via package exports, alongside CommonJS.
- NEW: Collection options via `setup(name, {expiresIn, maxItems, sliding, clone, onExpire, onEvict})`, a plain number still works.
- NEW: `maxItems` evicts the least recently used items. `sliding` renews expiration on reads.
- NEW: Method `getOrSet()` loads and caches missing items, sharing concurrent loads of the same key.
- NEW: Methods `has()`, `keys()`, `values()`, `entries()`, `touch()`, `destroy()` and `collection()` (typed handle).
- NEW: Generic `get<T>()` and `set<T>()`, plus exported types `CacheOptions`, `CacheStats` and `TypedCollection`.
- NEW: Stats now include `hits`, `hitRatio`, `evictions` and `maxItems`, and there is a `totalHits` getter.
- BREAKING: Requires Node.js 22 or newer.
- BREAKING: `store[name].items` is now a `Map` (the `size` field was removed, use `items.size`).
- Overwriting a key no longer inflates the collection size.
- `merge()` no longer throws on null data, and returns whether data was merged.
- `memSizeOf()` now handles dates, buffers, maps and sets, much faster on large objects.
- Reading an expired item counts as a miss, and `del()` no longer counts misses.

## 1.3.3

- The store is now accessible from outside (flagged as readonly).

## 1.3.1

- Code refactoring.

## 1.3.0

- NEW: Option `strict` can be set to false to avoid throwing errors with invalid collections.
- Minor code refactoring.

## 1.1.2

- Make sure Anyhow's logging is set up.

## 1.1.0

- NEW: Method `merge()` to shallow merge data to existing cache.
- Cache keys now also accept any data type.

## 1.0.0

- Initial release!
