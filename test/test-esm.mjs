import assert from "node:assert/strict"
import {createRequire} from "node:module"
import bitecache from "bitecache"

const require = createRequire(import.meta.url)

assert.strictEqual(bitecache, require("bitecache"))
bitecache.setup("esm", 60)
bitecache.set("esm", "key", "value")
assert.equal(bitecache.get("esm", "key"), "value")
clearInterval(bitecache.store.esm.expireTimer)
