import { GoogleGenerativeAI } from '@google/generative-ai'

export async function validateGoogleApiKey(apiKey: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' })
    const result = await model.embedContent('hello')
    const values = result.embedding.values
    return Array.isArray(values) && values.length > 0
  } catch (err) {
    console.error('API key validation failed:', err)
    return false
  }
}

export async function validateOpenAiApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return res.ok
  } catch (err) {
    console.error('OpenAI API key validation failed:', err)
    return false
  }
}
