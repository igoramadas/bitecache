# Bitecache

[![Version](https://img.shields.io/npm/v/bitecache.svg)](https://npmjs.com/package/bitecache)
[![Coverage Status](https://coveralls.io/repos/github/igoramadas/bitecache/badge.svg?branch=master)](https://coveralls.io/github/igoramadas/bitecache?branch=master)
[![Build Status](https://github.com/igoramadas/bitecache/actions/workflows/build.yml/badge.svg)](https://github.com/igoramadas/bitecache/actions)

A tiny, in-memory cache manager that won't bite you :-)

## Basic usage

```javascript
import cache from "bitecache"

// Create a "users" cache collection with 20 seconds expiration,
// and a "products" with expiration in 10 minutes.
cache.setup("users", 20)
cache.setup("products", 600)

// Add a new user with cache key "jdoe".
const user = {name: "John", surname: "Doe"}
cache.set("users", "jdoe", user)

// Get John Doe from cache.
const cachedUser = cache.get("users", "jdoe")

// You can also merge data to existing cached objects.
cache.merge("users", "jdoe", {surname: "New Doe"})

// A user that does not exist, will return null.
const invalidUser = cache.get("users", "invalid")

// Remove user from cache.
cache.del("users", "jdoe")

// Individual cache items can also have their own expiresIn, here we add
// a product that expires in 30 seconds instead of the 10 mminutes default.
cache.set("products", "myproduct", {title: "My Product"}, 30)

// Check if a key exists, and list keys, values or entries (expired items are skipped).
cache.has("users", "jdoe")
cache.keys("users")
cache.values("users")
cache.entries("users")

// Renew the expiration of an item, optionally with a new expiresIn.
cache.touch("users", "jdoe", 60)

// Log cache's total size, estimation of memory size, and cache misses.
console.log("Total size", cache.totalSize)
console.log("Total memory size", cache.totalMemSize)
console.log("Total misses", cache.totalMisses)

// Log individual cache collection stats.
console.dir(cache.stats("users"))

// Clear the users cache or all cache collections.
cache.clear("users")
cache.clear()

// By default, hitting an invalid collection will throw an exception.
try {
    const invalidCollection = cache.get("oops", "some-id")
} catch (ex) {
    console.error(ex)
}

// You can disable the strict mode and it won't throw an exception,
// but return undefined instead.
cache.strict = false
const invalidAgain = cache.get("oops", "some-id")
cache.set("oops", "another invalid", {})
```

## Loading missing data

`getOrSet()` returns the cached item or calls your loader (sync or async) and caches the result.
Concurrent calls for the same key share one loader call, and failures are not cached.

```javascript
const product = await cache.getOrSet("products", "myproduct", () => db.loadProduct("myproduct"), 30)
```

## Collection options

Instead of a number, `setup()` also accepts an options object:

```javascript
cache.setup("sessions", {
    expiresIn: 600,
    // Keep at most 1000 items, evicting the least recently used first.
    maxItems: 1000,
    // Reading an item renews its expiration.
    sliding: true,
    // Deep clone data when setting and getting, so callers can't change cached objects.
    clone: true,
    onExpire: (key, data) => console.log("Expired", key),
    onEvict: (key, data) => console.log("Evicted", key)
})
```

Stats include `size`, `memSize`, `hits`, `misses`, `hitRatio`, `evictions` and `maxItems`.

## TypeScript

Use `get<T>()` / `set<T>()`, or a typed handle to a single collection:

```typescript
import cache from "bitecache"

const users = cache.collection<{name: string}>("users")
users.set("jdoe", {name: "John"})
const name = users.get("jdoe")?.name
```

## Cleaning up

Expiration timers do not keep the process alive. To stop them and remove collections, call `cache.destroy("users")` or `cache.destroy()` for all.
