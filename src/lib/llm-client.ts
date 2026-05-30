import OpenAI from "openai"
import { z, ZodSchema } from "zod"

const llmApiKey = process.env.LLM_API_KEY || "sk-placeholder"
const llmBaseUrl = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1"
const requestTimeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "180000", 10)

const client = new OpenAI({
  apiKey: llmApiKey,
  baseURL: llmBaseUrl,
  timeout: requestTimeoutMs,
})

export interface GenerateStructuredInput<T> {
  model: string
  systemPrompt: string
  userPrompt: string
  schema: ZodSchema<T>
  temperature: number
  timeoutMs?: number
}

export class LLMClient {
  /**
   * Generate structured JSON output from LLM with schema validation and one repair retry.
   */
  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
    const { model, systemPrompt, userPrompt, schema, temperature } = input

    const result = await this.tryGenerate(model, systemPrompt, userPrompt, schema, temperature)

    if (result.success) {
      return result.data
    }

    // One repair retry
    console.warn("First attempt failed, repairing...", result.error)
    const repairUserPrompt = `${userPrompt}\n\n[IMPORTANT] Your previous output failed validation with these errors:\n${result.error}\n\nPlease fix the JSON structure and try again. Return ONLY valid JSON that matches the schema.`

    const repairResult = await this.tryGenerate(
      model,
      systemPrompt,
      repairUserPrompt,
      schema,
      temperature
    )

    if (repairResult.success) {
      return repairResult.data
    }

    throw new Error(`Generation failed after repair retry: ${repairResult.error}`)
  }

  private async tryGenerate<T>(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: ZodSchema<T>,
    temperature: number
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      })

      const raw = response.choices[0]?.message?.content
      if (!raw) {
        return { success: false, error: "Empty response from LLM" }
      }

      // Extract JSON from markdown code blocks if present
      let jsonStr = raw
      const jsonBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)
      const validated = schema.parse(parsed)

      return { success: true, data: validated }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
}

export const llmClient = new LLMClient()
