const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// 构建项目
console.log("Building project...")
execSync("npm run build", { stdio: "inherit" })

// 删除大型缓存文件
console.log("Cleaning up large cache files...")
const cacheDir = path.join(process.cwd(), ".next", "cache")
if (fs.existsSync(cacheDir)) {
  console.log(`Removing ${cacheDir}...`)
  fs.rmSync(cacheDir, { recursive: true, force: true })
}

console.log("Build completed and cleaned!")
