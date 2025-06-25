import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

// Pricing constants (as of 2024)
const PRICING = {
  GEMINI_FLASH_INPUT: 0.00000075, // $0.00000075 per token
  GEMINI_FLASH_OUTPUT: 0.000003, // $0.000003 per token
  GPT4_TURBO_INPUT: 0.00001, // $0.01 per 1K tokens
  GPT4_TURBO_OUTPUT: 0.00003, // $0.03 per 1K tokens
};

interface UsageMetrics {
  gemini: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  openai: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  total: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.GEMINI_API_KEY) {
      return new Response(
        "Missing API keys for OpenAI or Gemini. Please make sure they are set in your environment variables.",
        { status: 500 }
      );
    }

    // Initialize clients
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    const { prompt } = await req.json();

    // Initialize usage tracking
    const usage: UsageMetrics = {
      gemini: { inputTokens: 0, outputTokens: 0, cost: 0 },
      openai: { inputTokens: 0, outputTokens: 0, cost: 0 },
      total: { inputTokens: 0, outputTokens: 0, cost: 0 }
    };

    // Step 1: Get initial research from Gemini
    const geminiModel = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      }
    });

    const geminiResult = await geminiModel.generateContent(prompt);
    const geminiResponse = await geminiResult.response;
    const geminiText = geminiResponse.text();

    // Capture Gemini usage
    const geminiUsage = geminiResponse.usageMetadata;
    if (geminiUsage) {
      usage.gemini.inputTokens = geminiUsage.promptTokenCount || 0;
      usage.gemini.outputTokens = geminiUsage.candidatesTokenCount || 0;
      usage.gemini.cost = 
        (usage.gemini.inputTokens * PRICING.GEMINI_FLASH_INPUT) +
        (usage.gemini.outputTokens * PRICING.GEMINI_FLASH_OUTPUT);
    }

    // Step 2: Refine with OpenAI (streaming)
    const systemMessage = `You are a world-class researcher. You have received an initial research summary from Gemini AI. Your task is to analyze it, identify any gaps or potential areas for deeper investigation, and then provide a more comprehensive and well-structured final response. 

The user's original prompt was: "${prompt}"

Please provide a thorough, well-researched response that builds upon and improves the initial analysis.`;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      stream: true,
      stream_options: { include_usage: true }, // This enables usage tracking with streaming
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        {
          role: 'user',
          content: `Here is the initial research from Gemini: ${geminiText}`,
        },
      ],
    });
    
    // Create streaming response with usage tracking
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let openaiUsageData: { prompt_tokens?: number; completion_tokens?: number } | null = null;
          
          for await (const chunk of openaiResponse) {
            // Capture usage data when it arrives
            if (chunk.usage) {
              openaiUsageData = chunk.usage;
            }
            
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = encoder.encode(`data: ${JSON.stringify({ 
                type: 'content',
                content 
              })}\n\n`);
              controller.enqueue(data);
            }
          }

          // Calculate OpenAI costs
          if (openaiUsageData) {
            usage.openai.inputTokens = openaiUsageData.prompt_tokens || 0;
            usage.openai.outputTokens = openaiUsageData.completion_tokens || 0;
            usage.openai.cost = 
              (usage.openai.inputTokens * PRICING.GPT4_TURBO_INPUT) +
              (usage.openai.outputTokens * PRICING.GPT4_TURBO_OUTPUT);
          }

          // Calculate totals
          usage.total.inputTokens = usage.gemini.inputTokens + usage.openai.inputTokens;
          usage.total.outputTokens = usage.gemini.outputTokens + usage.openai.outputTokens;
          usage.total.cost = usage.gemini.cost + usage.openai.cost;

          // Send usage data
          const usageData = encoder.encode(`data: ${JSON.stringify({ 
            type: 'usage',
            usage
          })}\n\n`);
          controller.enqueue(usageData);

          // End stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: "An error occurred while processing the request." }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 