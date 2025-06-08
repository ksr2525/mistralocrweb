"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  FileImage,
  Copy,
  History,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HistoryItem {
  id: number
  timestamp: string
  model: string
  imageName: string
  originalImageDataUrl: string
  resultHTML: string
}

export default function MistralOCRTool() {
  const [apiKey, setApiKey] = useState("")
  const [selectedModel, setSelectedModel] = useState("mistral-ocr-latest")
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [currentImageDataUrl, setCurrentImageDataUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("请上传图片并点击提取文本。")
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MISTRAL_API_URL = "https://api.mistral.ai/v1/ocr"

  // Load saved data on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("mistralOcrApiKey")
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }

    const savedHistory = localStorage.getItem("mistralOcrHistory")
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {
        console.error("Failed to parse history:", e)
      }
    }
  }, [])

  // Auto-save API key
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("mistralOcrApiKey", apiKey)
    }
  }, [apiKey])

  const showFeedback = (message: string, type: "success" | "error" = "error", duration = 4000) => {
    setFeedback({ message, type })
    if (duration > 0) {
      setTimeout(() => setFeedback(null), duration)
    }
  }

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof Blob)) {
        reject(new Error("提供的对象不是有效的文件或Blob。"))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
      reader.readAsDataURL(file)
    })
  }

  const handleFile = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      showFeedback("请选择有效的图片文件 (JPG, PNG)。")
      setCurrentFile(null)
      setCurrentImageDataUrl(null)
      return
    }

    setCurrentFile(file)
    setFeedback(null)
    setResult("图片已选择，请点击提取文本。")

    try {
      const dataUrl = await readFileAsDataURL(file)
      setCurrentImageDataUrl(dataUrl)
    } catch (error) {
      console.error("读取预览图片错误:", error)
      showFeedback(`读取预览图片失败: ${error instanceof Error ? error.message : "未知错误"}`)
      setCurrentFile(null)
      setCurrentImageDataUrl(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          handleFile(file)
        }
        break
      }
    }
  }

  useEffect(() => {
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [])

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      showFeedback("请输入 API 密钥。")
      return
    }

    if (!currentFile && !currentImageDataUrl) {
      showFeedback("请选择或拖放要识别的图片文件。")
      return
    }

    setIsLoading(true)
    setFeedback(null)
    setResult("正在转换图片并识别中，请稍候...")

    try {
      let imageDataUrl = currentImageDataUrl
      if (currentFile && !imageDataUrl) {
        imageDataUrl = await readFileAsDataURL(currentFile)
      }

      if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
        throw new Error("图片数据准备失败或格式无效。")
      }

      const payload = {
        model: selectedModel,
        document: {
          type: "image_url",
          image_url: imageDataUrl,
        },
        include_image_base64: true,
      }

      const response = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get("content-type")

      if (response.ok && contentType?.includes("application/json")) {
        const data = await response.json()

        let htmlResultContent = ""
        if (data?.pages && Array.isArray(data.pages)) {
          data.pages.forEach((page: any) => {
            let pageMarkdown = page.markdown || ""

            if (page.images && Array.isArray(page.images)) {
              page.images.forEach((img: any) => {
                if (img.id && img.image_base64) {
                  const escapedImgId = img.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                  const imgRegex = new RegExp(`!\\[([^\\]]*?)\\]\$$${escapedImgId}\$$`, "g")

                  const altTextMatch = pageMarkdown.match(new RegExp(`!\\[([^\\]]*?)\\]\$$${escapedImgId}\$$`))
                  const altText = altTextMatch?.[1] || img.id

                  const imgHtmlTag = `<img src="${img.image_base64}" alt="${altText}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />`
                  pageMarkdown = pageMarkdown.replace(imgRegex, imgHtmlTag)
                }
              })
            }

            htmlResultContent += pageMarkdown.replace(/\n/g, "<br>") + "<br><br>"
          })
          htmlResultContent = htmlResultContent.trim()
        } else if (data?.choices?.[0]?.message?.content) {
          htmlResultContent = data.choices[0].message.content.replace(/\n/g, "<br>")
        }

        if (htmlResultContent) {
          setResult(htmlResultContent)
          showFeedback("文本提取成功！", "success")

          // Save to history
          const historyEntry: HistoryItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            model: selectedModel,
            imageName: currentFile?.name || "pasted_or_unknown_image",
            originalImageDataUrl: imageDataUrl,
            resultHTML: htmlResultContent,
          }

          const newHistory = [historyEntry, ...history].slice(0, 10)
          setHistory(newHistory)
          localStorage.setItem("mistralOcrHistory", JSON.stringify(newHistory))
        } else {
          setResult("未能提取到文本或图片中无文本。")
          showFeedback("未能提取到文本内容。", "error")
        }
      } else {
        const errorText = await response.text()
        throw new Error(`API 请求失败，状态码: ${response.status} ${response.statusText}. ${errorText}`)
      }
    } catch (error) {
      console.error("OCR 处理出错:", error)
      const errorMessage = error instanceof Error ? error.message : "未知错误"
      showFeedback(`发生错误: ${errorMessage}`)
      setResult("识别失败。")
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (content: string) => {
    if (!content || content === "请上传图片并点击提取文本。" || content === "识别失败。") {
      showFeedback("无内容可复制", "error")
      return
    }

    try {
      const textContent = new DOMParser().parseFromString(content, "text/html").body.textContent || ""

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textContent)
        showFeedback("内容已复制到剪贴板！", "success")
      } else {
        showFeedback("剪贴板 API 不可用", "error")
      }
    } catch (error) {
      showFeedback("复制失败", "error")
    }
  }

  const restoreFromHistory = (item: HistoryItem) => {
    setResult(item.resultHTML)
    setCurrentImageDataUrl(item.originalImageDataUrl)
    setCurrentFile(null)
    setIsHistoryOpen(false)
    showFeedback("记录已恢复到主界面", "success")
  }

  const deleteHistoryItem = (id: number) => {
    const newHistory = history.filter((item) => item.id !== id)
    setHistory(newHistory)
    localStorage.setItem("mistralOcrHistory", JSON.stringify(newHistory))
    showFeedback("记录已删除", "success")
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem("mistralOcrHistory")
    showFeedback("历史记录已清空", "success")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mistral AI OCR 工具
          </h1>
          <p className="text-gray-600">智能图片文字识别，支持多种格式</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <Alert
            className={cn(
              "border-l-4",
              feedback.type === "success"
                ? "border-l-green-500 bg-green-50 text-green-800"
                : "border-l-red-500 bg-red-50 text-red-800",
            )}
          >
            {feedback.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* API Key Card */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-blue-600" />
                  API 配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API 密钥</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="请输入您的 Mistral AI API 密钥"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">OCR 模型</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mistral-ocr-latest">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            最新
                          </Badge>
                          mistral-ocr-latest
                        </div>
                      </SelectItem>
                      <SelectItem value="mistral-ocr-2503">mistral-ocr-2503</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Image Upload Card */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileImage className="h-5 w-5 text-purple-600" />
                  图片上传
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer",
                    isDragOver
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {currentImageDataUrl ? (
                    <div className="space-y-4">
                      <img
                        src={currentImageDataUrl || "/placeholder.svg"}
                        alt="预览图片"
                        className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                      />
                      <p className="text-sm text-gray-600">{currentFile?.name || "已粘贴图片"}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-lg font-medium text-gray-700">拖放图片到此处</p>
                        <p className="text-sm text-gray-500 mt-1">或点击选择文件，支持 JPG、PNG 格式</p>
                        <p className="text-xs text-gray-400 mt-2">也可以直接粘贴图片 (Ctrl+V)</p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !apiKey || (!currentFile && !currentImageDataUrl)}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      识别中...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      提取文本
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Results Card */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileImage className="h-5 w-5 text-green-600" />
                    识别结果
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(result)}
                      disabled={result === "请上传图片并点击提取文本。" || result === "识别失败。"}
                      className="transition-all duration-200"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      复制
                    </Button>
                    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={history.length === 0}
                          className="transition-all duration-200"
                        >
                          <History className="h-4 w-4 mr-1" />
                          历史
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <div className="flex items-center justify-between">
                            <DialogTitle>识别历史记录 (最近10条)</DialogTitle>
                            <Button variant="outline" size="sm" onClick={clearHistory} disabled={history.length === 0}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              清空
                            </Button>
                          </div>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh]">
                          {history.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">暂无历史记录</p>
                          ) : (
                            <div className="space-y-4">
                              {history.map((item) => (
                                <Card key={item.id} className="p-4">
                                  <div className="flex gap-4">
                                    <img
                                      src={item.originalImageDataUrl || "/placeholder.svg"}
                                      alt={item.imageName}
                                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm text-gray-600">
                                          <p>
                                            <strong>时间:</strong> {new Date(item.timestamp).toLocaleString("zh-CN")}
                                          </p>
                                          <p>
                                            <strong>模型:</strong> {item.model}
                                          </p>
                                          <p>
                                            <strong>文件:</strong> {item.imageName}
                                          </p>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button variant="outline" size="sm" onClick={() => restoreFromHistory(item)}>
                                            <Download className="h-4 w-4 mr-1" />
                                            恢复
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyToClipboard(item.resultHTML)}
                                          >
                                            <Copy className="h-4 w-4 mr-1" />
                                            复制
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => deleteHistoryItem(item.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="max-h-32 overflow-y-auto text-sm bg-gray-50 p-3 rounded border">
                                        <div dangerouslySetInnerHTML={{ __html: item.resultHTML }} />
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 bg-gray-50 rounded-lg border">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: result }} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Mistral AI OCR 前端工具 - 智能文字识别解决方案</p>
        </div>
      </div>
    </div>
  )
}
