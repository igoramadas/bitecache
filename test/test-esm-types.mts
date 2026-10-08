import bitecache from "bitecache"
import type {CacheOptions, CacheStats, TypedCollection} from "bitecache"

const options: CacheOptions = {expiresIn: 60, maxItems: 10, sliding: true}
bitecache.setup("esm-types", options)

const users: TypedCollection<{name: string}> = bitecache.collection<{name: string}>("esm-types")
users.set("a", {name: "A"})
const name: string = users.get("a").name
const stats: CacheStats = bitecache.stats("esm-types")
stats.hitRatio
name

bitecache.destroy()
