import { OpenAI } from 'openai';
import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function rateLimit(ip: string, limit = 10, windowSec = 3600) {
  const key = `rl:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec); // 1hr window
  }
  if (count > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - count };
}


export type ActionItem =
  | { type: 'choice'; label: string; options: string[] }
  | { type: 'multiselect'; label: string; options: string[] }
  | { type: 'input'; label: string; placeholder?: string }
  | { type: 'multientry'; label: string; placeholder?: string };


function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function systemPrompt_analyzePrompt(userPrompt: string): string {
  return `You are an expert prompt engineering analyst. Evaluate the given prompt for clarity, specificity, and effectiveness.

    Analyze this prompt:
    """
    ${userPrompt}
    """

    Scoring criteria:
    - Clarity and specificity (0-25 points)
    - Context and background information (0-25 points) 
    - Output format and structure requirements (0-25 points)
    - Role definition and constraints (0-25 points)

    Provide actionable feedback focusing on these common improvement areas:
    - Missing context or background information
    - Unclear output format requirements
    - Vague instructions or objectives
    - Missing role definition or persona
    - Lack of examples or constraints
    - Tone and style specifications
    - Target audience unclear

    Each action item must follow this exact TypeScript interface:

    type ActionItem =
      | { type: 'choice'; label: string; options: string[] }
      | { type: 'multiselect'; label: string; options: string[] }
      | { type: 'input'; label: string; placeholder?: string }
      | { type: 'multientry'; label: string; placeholder?: string };

    CRITICAL: 
    - Only use these exact fields: type, label, options (for choice/multiselect), placeholder (for input/multientry)
    - Do NOT add any other fields like "description"
    - Always include "options" for choice and multiselect
    - Always include "placeholder" for input and multientry types
    - Use meaningful, specific labels and placeholders based on the prompt's needs

    Return valid JSON only:

    For prompts needing improvement (score < 85):
    {
      "status": "needs_improvement",
      "score": [number 0-100],
      "critique": ["array of specific issues without emojis", "each item should be a clear, actionable point"],
      "actionItems": [array of 2-4 most impactful action items using ONLY the exact structure above]
    }

    For high-quality prompts (score >= 85):
    {
      "status": "ready", 
      "score": [number 85-100],
      "improvedPrompt": "[slightly enhanced version if minor improvements possible]"
    }`;
}

function systemPrompt_generatePrompt(userPrompt: string, enhancements: Record<string, any>) {
  return `You are an expert prompt engineer. Create a highly effective prompt based on the user's input and specifications.

    Original user input:
    """
    ${userPrompt}
    """

    User specifications:
    ${JSON.stringify(enhancements, null, 2)}

    Create a well-structured, professional prompt that follows these principles:

    STRUCTURE:
    1. Clear role definition and context
    2. Specific task description
    3. Detailed requirements and constraints
    4. Output format specifications
    5. Examples if helpful
    6. Quality criteria

    FORMATTING GUIDELINES:
    - Use clear section separators (like line breaks or simple text dividers)
    - Use plain text formatting with dashes (-) for lists instead of bullet points
    - Avoid markdown syntax (no #, ##, *, **, etc.)
    - Use simple line breaks and spacing for organization
    - Use ALL CAPS for section headers if needed
    - Use colons (:) and line breaks to separate sections clearly

    QUALITY STANDARDS:
    - Be specific and unambiguous
    - Include all necessary context
    - Define success criteria
    - Specify tone and style
    - Address edge cases if relevant

    Output the complete, professional prompt as plain formatted text ready for immediate use. Use simple text formatting only - no markdown, no special characters for formatting. Do not include meta-commentary or explanations about the prompt itself.`;
}

export default async function handler(req: Request): Promise<Response> {
  const body = await req.json();
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const { mode, prompt, enhancements } = body;


  if (!prompt) return jsonError(400, 'Missing prompt');
  

  if (mode === 'analyze') {
    const { allowed } = await rateLimit(`analyze:${ip}`, 10, 3600);
    if (!allowed) {
      return new Response("Rate limit exceeded for analysis (10 per hour)", { status: 429 });
    }

    const systemPrompt = systemPrompt_analyzePrompt(prompt);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || '';
      let output;

      try {
        output = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse GPT response:', raw);
        return jsonError(500, 'Failed to parse analysis response');
      }

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.error('GPT API error:', err);
      return jsonError(500, err.message || 'Analysis failed');
    }
  }

  if (mode === 'generate') {
    const { allowed } = await rateLimit(`generate:${ip}`, 10, 3600);
    if (!allowed) {
      return new Response("Rate limit exceeded for generation (10 per hour)", { status: 429 });
    }

    if (!enhancements) return jsonError(400, 'Missing enhancements');
    const systemPrompt = systemPrompt_generatePrompt(prompt, enhancements);

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: true,
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });

      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) {
              controller.enqueue(encoder.encode(token));
            }
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (err: any) {
      console.error('Streaming error:', err);
      return jsonError(500, err.message || 'Generation failed');
    }
  }

  return jsonError(400, 'Invalid mode');
}
