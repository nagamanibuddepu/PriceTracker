import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { isDemoModeEnabled, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limiting logic
  const adminKey = req.headers.get('x-admin-key');
  const isAdmin = adminKey === process.env.ADMIN_API_KEY && !!process.env.ADMIN_API_KEY;

  if (!isAdmin && await isDemoModeEnabled()) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    // 10 requests per hour (3600 seconds) for Chatbot
    const result = await checkRateLimit(ip, 'chat', 10, 3600);
    if (!result.success) {
      return NextResponse.json(
        { error: 'AI Chat limit reached.\nPlease try again later.' },
        { status: 429 }
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let genAI: GoogleGenerativeAI | null = null;
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  if (!apiKey || !genAI) {
    return NextResponse.json(
      { error: 'Gemini API Key is not configured in .env.local' },
      { status: 500 }
    );
  }

  try {
    const { message } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert personal shopping and styling assistant for a price comparison platform.
A user has asked: "${message}"

Provide a helpful, stylish, and professional response. 
Format your output as a JSON object with the following structure:
{
  "content": "Your markdown-formatted text response to the user's styling question or request. Use bullet points and appropriate emojis.",
  "products": [
    // Include 0 to 4 mock product recommendations if applicable
    {
      "name": "Example Structured Blazer",
      "price": 3299,
      "site": "amazon|flipkart|myntra",
      "url": "https://www.example.com",
      "imageUrl": "/placeholder.svg?height=200&width=200"
    }
  ]
}

Return ONLY valid JSON and no other text or explanation.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('Gemini raw response:', responseText);

    // Extract JSON if wrapped in markdown blocks
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
    const rawJson = jsonMatch ? jsonMatch[1] : responseText;
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawJson);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', rawJson);
      parsedResponse = {
        content: responseText, // Fallback to plain text
      };
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Error generating chat response:', error);
    return NextResponse.json(
      { error: 'An error occurred while generating a response.' },
      { status: 500 }
    );
  }
}
