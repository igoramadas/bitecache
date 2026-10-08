// TEST: BITECACHE

import {after, before, describe, it} from "mocha"
import assert from "node:assert/strict"
require("chai").should()

describe("Bitecache Tests", function () {
    let bitecache = require("../src/index")

    it("Setup a collection with invalid expiresIn", function () {
        bitecache.setup("test", -5)
    })

    it("Setup other collections", function () {
        bitecache.setup("test-another", 1)
        bitecache.setup("test-complex", 60)
        bitecache.setup("test-long-expire", 99999)
    })

    it("Wait for expiration of items on test-another", function (done) {
        bitecache.set("test-another", "expire1", 1)
        bitecache.set("test-another", "expire2", 2)

        const check = () => {
            if (bitecache.totalSize == 0) {
                done()
            } else {
                done("Items on test-another did not expire")
            }
        }

        setTimeout(check, 3000)
    })

    it("Setup same test collection again with expiresIn 1", function () {
        bitecache.setup("test", 1)
    })

    it("Try getting invalid cache items, cache misses should be 3", function (done) {
        bitecache.get("test", "notexist1")
        bitecache.get("test", "notexist2")
        bitecache.get("test", "notexist3")

        const misses = bitecache.totalMisses

        if (misses == 3) {
            done()
        } else {
            done(`The total misses should be 3, but got ${misses}`)
        }
    })

    it("Add an item to the cache", function () {
        bitecache.set("test", "a", "First", 1)
    })

    it("Add an item to the cache with custom expiresIn 10", function () {
        bitecache.set("test", "b", "Second", 10)
    })

    it("Access the store directly", function (done) {
        if (bitecache.store?.test?.items?.get("b")?.data == "Second") {
            done()
        } else {
            done("Failed to access item b from store test (created on last step)")
        }
    })

    it("Get second added item", function (done) {
        const second = bitecache.get("test", "b")

        if (second == "Second") {
            done()
        } else {
            done("Did not return 'Second' for item 'b'")
        }
    })

    it("First item should have expired by now", function (done) {
        const checkFirst = () => {
            const first = bitecache.get("test", "a")

            if (!first) {
                done()
            } else {
                done("Item 'a' should have expired")
            }
        }

        setTimeout(checkFirst, 1100)
    })

    it("Fail to get expired item from long expiry collection", function (done) {
        const checkExpired = () => {
            const stillThere = bitecache.get("test-long-expire", "a")

            if (!stillThere) {
                done()
            } else {
                done("Item 'a' should have expired")
            }
        }

        bitecache.set("test-long-expire", "a", "still-here", 1)
        setTimeout(checkExpired, 1100)
    })

    it("Add 10 itens to another collection", function () {
        for (let i = 0; i < 10; i++) {
            bitecache.set("test-another", i.toString(), i * 10)
        }
    })

    it("Current size should be 11 (1 from test, 10 from test-another)", function (done) {
        const size = bitecache.totalSize

        if (size == 11) {
            done()
        } else {
            done(`Cache total size should be 11 but got ${size}`)
        }
    })

    it("Delete item from cache", function (done) {
        if (bitecache.del("test", "b")) {
            done()
        } else {
            done("Deleting 'b' item should return true, but got false")
        }
    })

    it("Deleting invalid item should return false, and current size 10", function (done) {
        const size = bitecache.totalSize

        if (bitecache.del("test", "b")) {
            done("Deleting 'b' item again should return false, but got true")
        } else if (size != 10) {
            done(`Cache total size should be now 10 but got ${size}`)
        } else {
            done()
        }
    })

    it("Clear test-another, size should now be 0", function (done) {
        bitecache.clear("test-another")

        const size = bitecache.totalSize

        if (size == 0) {
            done()
        } else {
            done(`Total size should now be 0 but got ${size}`)
        }
    })

    it("Get size used by cache", function (done) {
        const a = {a: "a"}
        const b = {b: "b"}
        bitecache.set("test-complex", "boolean", true)
        bitecache.set("test-complex", "string", "a")
        bitecache.set("test-complex", "number", 123)
        bitecache.set("test-complex", "date", new Date())
        bitecache.set("test-complex", "array", ["1", 1, null])
        bitecache.set("test-complex", "obj", {
            a: a,
            b: b,
            level0: {
                a: b
            }
        })

        const memsize = bitecache.totalMemSize
        if (memsize > 150) {
            done()
        } else {
            done(`Total estimated memory size should be at least 150 bytes, but got ${memsize}`)
        }
    })

    it("Merge data to existing cache item", function (done) {
        bitecache.set("test-complex", "to-merge", {a: "a", b: "a"})
        bitecache.merge("test-complex", "to-merge", {b: "b"})

        bitecache.set("test-complex", "to-merge-fail", 1)
        bitecache.merge("test-complex", "to-merge-fail", 2)

        if (bitecache.get("test-complex", "to-merge").b == "a") {
            done("Did not merge data")
        } else {
            done()
        }
    })

    it("Get stats for cache", function () {
        bitecache.stats("test-complex")
    })

    it("Throw error when calling methods on invalid collection", function (done) {
        try {
            bitecache.set("invalid")
            done("Calling set on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.get("invalid")
            done("Calling get on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.del("invalid")
            done("Calling del on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.merge("invalid")
            done("Calling merge on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.expire("invalid")
            done("Calling expire on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.clear("invalid")
            done("Calling clear on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.stats("invalid")
            done("Calling stats on invalid collection should throw an error")
        } catch (ex) {}

        try {
            bitecache.memSizeOf("invalid")
            done("Calling memSizeOf on invalid collection should throw an error")
        } catch (ex) {}

        done()
    })

    it("Do not throw is strict is false", function (done) {
        bitecache.strict = false

        try {
            bitecache.set("invalid")
        } catch (ex) {
            return done("Calling set on invalid collection should not throw an error")
        }

        try {
            bitecache.get("invalid")
        } catch (ex) {
            return done("Calling set on invalid collection should not throw an error")
        }

        try {
            bitecache.del("invalid")
        } catch (ex) {
            return done("Calling del on invalid collection should not throw an error")
        }

        try {
            bitecache.merge("invalid")
        } catch (ex) {
            return done("Calling merge on invalid collection should not throw an error")
        }

        try {
            bitecache.expire("invalid")
        } catch (ex) {
            return done("Calling expire on invalid collection should not throw an error")
        }

        try {
            bitecache.clear("invalid")
        } catch (ex) {
            return done("Calling clear on invalid collection should not throw an error")
        }

        try {
            bitecache.stats("invalid")
        } catch (ex) {
            return done("Calling stats on invalid collection should not throw an error")
        }

        try {
            bitecache.memSizeOf("invalid")
        } catch (ex) {
            return done("Calling memSizeOf on invalid collection should not throw an error")
        }

        done()
    })

    it("Setup a second instance which should have the same data", function (done) {
        let bitecache2 = require("../src/index")

        if (bitecache2.totalSize == 0) {
            done("Second instance should have the data from the first one")
        } else {
            done()
        }
    })

    it("Clear all", function () {
        bitecache.clear()
    })
})

describe("Bitecache Extended Tests", function () {
    const bitecache = require("../src/index")
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    before(function () {
        bitecache.strict = true
    })

    after(function () {
        bitecache.destroy()
    })

    it("Overwriting a key should not increase the size", function () {
        bitecache.setup("ext-size", 60)
        bitecache.set("ext-size", "a", 1)
        bitecache.set("ext-size", "a", 2)

        assert.equal(bitecache.stats("ext-size").size, 1)
        assert.equal(bitecache.get("ext-size", "a"), 2)
    })

    it("Keys named after Object.prototype members are regular keys", function () {
        assert.equal(bitecache.del("ext-size", "constructor"), false)
        assert.equal(bitecache.get("ext-size", "toString"), null)
        assert.equal(bitecache.stats("ext-size").size, 1)
    })

    it("Expiration timers do not keep the process alive", function () {
        const first = bitecache.store["ext-size"].expireTimer
        bitecache.setup("ext-size", 60)

        assert.notEqual(bitecache.store["ext-size"].expireTimer, first)
        assert.equal(bitecache.store["ext-size"].expireTimer.hasRef(), false)
    })

    it("Merge returns false for missing items and null data", function () {
        bitecache.set("ext-size", "null", null)

        assert.equal(bitecache.merge("ext-size", "null", {a: 1}), false)
        assert.equal(bitecache.merge("ext-size", "missing", {a: 1}), false)
    })

    it("Count hits, misses, and hit ratio (expired reads are misses, del is not)", async function () {
        bitecache.setup("ext-stats", 60)
        bitecache.set("ext-stats", "a", 1)
        bitecache.set("ext-stats", "short", 1, 0.1)

        bitecache.get("ext-stats", "a")
        bitecache.get("ext-stats", "nope")
        bitecache.del("ext-stats", "nope")
        await sleep(150)
        bitecache.get("ext-stats", "short")

        const stats = bitecache.stats("ext-stats")
        assert.equal(stats.hits, 1)
        assert.equal(stats.misses, 2)
        assert.equal(stats.hitRatio, 1 / 3)
        assert.equal(bitecache.totalHits >= 1, true)
    })

    it("Memory size accounts for dates, buffers, maps, sets and circular objects", function () {
        const circular: any = {a: "a"}
        circular.self = circular

        bitecache.setup("ext-mem", 60)
        bitecache.set("ext-mem", "empty", null)
        const base = bitecache.memSizeOf("ext-mem")

        bitecache.set("ext-mem", "buffer", Buffer.alloc(100))
        bitecache.set("ext-mem", "map", new Map([["k", "value"]]))
        bitecache.set("ext-mem", "set", new Set(["value"]))
        bitecache.set("ext-mem", "circular", circular)

        assert.equal(bitecache.memSizeOf("ext-mem") > base + 100, true)
    })

    it("getOrSet loads once, caches, and shares concurrent loads", async function () {
        bitecache.setup("ext-load", 60)
        let calls = 0
        const loader = async () => {
            calls++
            await sleep(20)
            return {calls}
        }

        const [a, b] = await Promise.all([bitecache.getOrSet("ext-load", "k", loader), bitecache.getOrSet("ext-load", "k", loader)])
        const c = await bitecache.getOrSet("ext-load", "k", loader)

        assert.equal(calls, 1)
        assert.equal(a, b)
        assert.equal(a, c)
    })

    it("getOrSet caches null results and does not cache failures", async function () {
        let calls = 0

        await bitecache.getOrSet("ext-load", "null", () => (calls++, null))
        await bitecache.getOrSet("ext-load", "null", () => (calls++, null))
        assert.equal(calls, 1)

        await assert.rejects(bitecache.getOrSet("ext-load", "fail", () => Promise.reject(new Error("fail"))), /fail/)
        assert.equal(bitecache.has("ext-load", "fail"), false)
        assert.equal(await bitecache.getOrSet("ext-load", "fail", () => "ok"), "ok")
    })

    it("getOrSet only runs the loader on invalid collections if strict is false", async function () {
        await assert.rejects(bitecache.getOrSet("ext-invalid", "k", () => 1), /Invalid collection/)

        bitecache.strict = false
        assert.equal(await bitecache.getOrSet("ext-invalid", "k", () => 1), 1)
        bitecache.strict = true
    })

    it("has, keys, values and entries ignore expired items and do not count as reads", async function () {
        bitecache.setup("ext-list", 60)
        bitecache.set("ext-list", "a", 1)
        bitecache.set("ext-list", 2, "b")
        bitecache.set("ext-list", "short", 3, 0.1)
        await sleep(150)

        assert.equal(bitecache.has("ext-list", "a"), true)
        assert.equal(bitecache.has("ext-list", "short"), false)
        assert.deepEqual(bitecache.keys("ext-list"), ["a", "2"])
        assert.deepEqual(bitecache.values("ext-list"), [1, "b"])
        assert.deepEqual(bitecache.entries("ext-list"), [["a", 1], ["2", "b"]])
        assert.equal(bitecache.stats("ext-list").hits, 0)
        assert.equal(bitecache.stats("ext-list").misses, 0)
    })

    it("maxItems evicts the least recently used item", function () {
        const evicted: string[] = []
        bitecache.setup("ext-lru", {expiresIn: 60, maxItems: 2, onEvict: (key: string) => evicted.push(key)})

        bitecache.set("ext-lru", "a", 1)
        bitecache.set("ext-lru", "b", 2)
        bitecache.get("ext-lru", "a")
        bitecache.set("ext-lru", "c", 3)

        assert.deepEqual(bitecache.keys("ext-lru"), ["a", "c"])
        assert.deepEqual(evicted, ["b"])
        assert.equal(bitecache.stats("ext-lru").evictions, 1)
        assert.equal(bitecache.stats("ext-lru").maxItems, 2)
    })

    it("Sliding expiration renews items on read, touch renews on demand", async function () {
        bitecache.setup("ext-slide", {expiresIn: 60, sliding: true})
        bitecache.set("ext-slide", "a", 1, 0.3)
        bitecache.set("ext-slide", "b", 2, 0.3)

        await sleep(200)
        assert.equal(bitecache.get("ext-slide", "a"), 1)
        assert.equal(bitecache.touch("ext-slide", "b"), true)
        await sleep(200)

        assert.equal(bitecache.get("ext-slide", "a"), 1)
        assert.equal(bitecache.get("ext-slide", "b"), 2)
        assert.equal(bitecache.touch("ext-slide", "b", 60), true)
        assert.equal(bitecache.touch("ext-slide", "missing"), false)
    })

    it("onExpire is called with key and data, callback errors are contained", async function () {
        const expired: any[] = []
        bitecache.setup("ext-expire", {
            expiresIn: 0.1,
            onExpire: (key: string, data: any) => {
                expired.push([key, data])
                throw new Error("callback error")
            }
        })
        bitecache.set("ext-expire", "a", 1)
        await sleep(250)

        assert.deepEqual(expired, [["a", 1]])
        assert.equal(bitecache.stats("ext-expire").size, 0)
    })

    it("clone isolates cached data from callers", function () {
        bitecache.setup("ext-clone", {expiresIn: 60, clone: true})
        const original = {a: {b: 1}}
        bitecache.set("ext-clone", "k", original)

        original.a.b = 2
        const first = bitecache.get("ext-clone", "k")
        first.a.b = 3

        assert.equal(bitecache.get("ext-clone", "k").a.b, 1)
    })

    it("A failed clone on set keeps the existing value", function () {
        bitecache.set("ext-clone", "keep", {a: 1})

        assert.throws(() => bitecache.set("ext-clone", "keep", {fn: () => 1}))
        assert.deepEqual(bitecache.get("ext-clone", "keep"), {a: 1})
    })

    it("Merge on a clone collection does not share the merged data with the caller", function () {
        const profile = {name: "A"}
        bitecache.set("ext-clone", "merge", {})
        bitecache.merge("ext-clone", "merge", {profile})

        profile.name = "B"
        assert.equal(bitecache.get("ext-clone", "merge").profile.name, "A")
    })

    it("Pending loads do not write to a collection that was replaced, cleared, or changed meanwhile", async function () {
        bitecache.setup("ext-stale", 60)
        const slow = (value: string) => async () => (await sleep(50), value)

        // Replaced collection.
        let load = bitecache.getOrSet("ext-stale", "a", slow("old"))
        bitecache.setup("ext-stale", 60)
        bitecache.set("ext-stale", "a", "new")
        assert.equal(await load, "old")
        assert.equal(bitecache.get("ext-stale", "a"), "new")

        // Cleared collection.
        load = bitecache.getOrSet("ext-stale", "b", slow("old"))
        bitecache.clear("ext-stale")
        await load
        assert.equal(bitecache.has("ext-stale", "b"), false)

        // Deleted key.
        load = bitecache.getOrSet("ext-stale", "c", slow("old"))
        bitecache.del("ext-stale", "c")
        await load
        assert.equal(bitecache.has("ext-stale", "c"), false)

        // Key set directly.
        load = bitecache.getOrSet("ext-stale", "d", slow("old"))
        bitecache.set("ext-stale", "d", "new")
        assert.equal(await load, "old")
        assert.equal(bitecache.get("ext-stale", "d"), "new")

        // Next load after a cancelled one works as usual.
        assert.equal(await bitecache.getOrSet("ext-stale", "b", () => "fresh"), "fresh")
        assert.equal(bitecache.get("ext-stale", "b"), "fresh")
    })

    it("getOrSet returns separate clones to concurrent callers on clone collections", async function () {
        const loader = async () => (await sleep(20), {a: 1})
        const [a, b] = await Promise.all([bitecache.getOrSet("ext-clone", "shared", loader), bitecache.getOrSet("ext-clone", "shared", loader)])

        assert.notEqual(a, b)
        a.a = 2
        assert.equal(b.a, 1)
        assert.equal(bitecache.get("ext-clone", "shared").a, 1)
    })

    it("Typed collection handle uses the named collection", async function () {
        bitecache.setup("ext-typed", 60)
        const users = bitecache.collection("ext-typed")

        users.set("a", {name: "A"})
        users.merge("a", {name: "B"})
        assert.equal(users.get("a").name, "B")
        assert.equal(users.has("a"), true)
        assert.equal(await users.getOrSet("b", () => ({name: "C"})).then((u: any) => u.name), "C")
        assert.deepEqual(users.keys(), ["a", "b"])
        assert.equal(users.stats().size, 2)
        assert.equal(users.del("a"), true)
        users.clear()
        assert.equal(users.stats().size, 0)
    })

    it("Destroy removes collections", function () {
        bitecache.destroy("ext-typed")

        assert.equal(bitecache.store["ext-typed"], undefined)
        assert.throws(() => bitecache.destroy("ext-typed"), /Invalid collection/)

        bitecache.destroy()
        assert.equal(Object.keys(bitecache.store).length, 0)
    })

    it("Setup with invalid expiresIn falls back to the minimum", function () {
        bitecache.setup("ext-min", undefined)
        assert.equal(bitecache.store["ext-min"].expiresIn, 0.1)
    })
})
