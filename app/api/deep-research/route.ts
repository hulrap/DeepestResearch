import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.GEMINI_API_KEY) {
      return new Response(
        "Missing API keys for OpenAI or Gemini. Please make sure they are set in your environment variables.",
        { status: 500 }
      );
    }

    // Initialize clients inside the function to avoid build-time issues
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    const { prompt } = await req.json();

    // Start with Gemini
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const geminiResult = await geminiModel.generateContent(prompt);
    const geminiResponse = await geminiResult.response;
    const geminiText = geminiResponse.text();

    // Then, feed Gemini's response to OpenAI with streaming
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      stream: true,
      messages: [
        {
          role: 'system',
          content: `You are a world-class researcher. You have received an initial research summary from another AI. Your task is to analyze it, identify any gaps or potential areas for deeper investigation, and then provide a more comprehensive and well-structured final response. The user's original prompt was: "${prompt}"`,
        },
        {
          role: 'user',
          content: `Here is the initial research from the other AI: ${geminiText}`,
        },
      ],
    });
    
    // Create a custom streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of openaiResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = encoder.encode(`data: ${JSON.stringify({ content })}\n\n`);
              controller.enqueue(data);
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
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
    console.error('An error occurred:', error);
    return new Response(
      "An error occurred while processing the request.",
      { status: 500 }
    );
  }
} 