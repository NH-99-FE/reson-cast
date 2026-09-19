// Independent server-side image provider configuration; never reuse the DeepSeek text key.
export function getImageAIConfig() {
  const endpoint = process.env.IMAGE_AI_API_URL?.trim()
  const apiKey = process.env.IMAGE_AI_API_KEY?.trim()
  const model = process.env.IMAGE_AI_MODEL?.trim()
  if (!endpoint || !apiKey || !model) throw new Error('AI 封面服务尚未配置，请先配置生图接口、密钥和模型')
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('生图接口地址无效')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('生图接口须使用不含凭据的 HTTPS 地址')
  return { endpoint, apiKey, model }
}

// Agnes image API adapter: other providers must support these size, ratio and URL-output parameters.
export function createImageAIRequest(prompt: string) {
  const { endpoint, apiKey, model } = getImageAIConfig()
  return {
    url: endpoint,
    method: 'POST' as const,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: {
      model,
      prompt,
      size: '1K',
      ratio: '16:9',
      extra_body: { response_format: 'url' },
    },
  }
}

export interface ImageAIResponse {
  data?: Array<{ url?: string }>
  images?: Array<{ url?: string }>
}

export function readImageAIResult(status: number, body: ImageAIResponse) {
  if (status < 200 || status >= 300) throw new Error(`封面生成失败（HTTP ${status}）`)
  const value = body?.data?.[0]?.url ?? body?.images?.[0]?.url
  if (!value) throw new Error('生图服务未返回图片 URL；请使用返回图片链接的接口')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('生图服务返回了无效图片地址')
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('生图服务必须返回 HTTPS 图片链接')
  return value
}
