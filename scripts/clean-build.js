import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 构建项目
console.log("Building project...")
execSync("npm run build", { stdio: "inherit" })

// 删除大型缓存文件
console.log("Cleaning up large cache files...")
const cacheDir = path.join(path.dirname(__dirname), ".next", "cache")
if (fs.existsSync(cacheDir)) {
  console.log(`Removing ${cacheDir}...`)
  fs.rmSync(cacheDir, { recursive: true, force: true })
}

console.log("Build completed and cleaned!")
