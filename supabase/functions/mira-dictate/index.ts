// Mira Dictate - Fast item entry via voice
// Optimized for speed: Whisper → Quick Parse → Done
// No conversation, just fast item extraction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://memoryaisle.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fast parsing prompt - optimized for speed
const FAST_PARSE_PROMPT = `Extract grocery items from this text. Return JSON only:
{"items": [{"name": "Item", "quantity": 1}]}

Rules:
- Capitalize properly (Milk, not milk)
- dozen=12, couple=2, few=3, some=3
- Default quantity=1
- Keep names simple (2% Milk → Milk)
- Ignore filler words (um, uh, like, so)

Text: `;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { audio, filename = 'audio.m4a' } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    // Step 1: Transcribe with Whisper (fastest settings)
    const audioBytes = decode(audio);
    const audioBlob = new Blob([audioBytes], { type: 'audio/m4a' });

    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'text'); // Faster than JSON

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      throw new Error(`Whisper error: ${whisperResponse.status}`);
    }

    const transcription = (await whisperResponse.text()).trim();
    const whisperTime = Date.now() - startTime;

    if (!transcription || transcription.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          transcription: '',
          message: "Didn't catch that",
          timing: { whisper: whisperTime, total: Date.now() - startTime },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Quick parse with GPT-4o-mini
    const parseStart = Date.now();

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: FAST_PARSE_PROMPT + transcription }
        ],
        temperature: 0.1, // Very low for consistent parsing
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    const parseTime = Date.now() - parseStart;

    if (!gptResponse.ok) {
      // Fallback: just use transcription as item name
      const words = transcription.split(/\s+/).filter(w =>
        !['um', 'uh', 'like', 'so', 'and', 'add', 'get', 'need', 'want', 'please'].includes(w.toLowerCase())
      );

      return new Response(
        JSON.stringify({
          success: true,
          items: [{ name: words.join(' '), quantity: 1 }],
          transcription,
          message: 'Added!',
          timing: { whisper: whisperTime, parse: parseTime, total: Date.now() - startTime },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gptResult = await gptResponse.json();
    const content = gptResult.choices[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback parsing
      parsed = { items: [{ name: transcription, quantity: 1 }] };
    }

    const items = parsed.items || [];
    const itemCount = items.length;

    // Generate quick response
    let message: string;
    if (itemCount === 0) {
      message = "Didn't catch any items";
    } else if (itemCount === 1) {
      message = `Added ${items[0].name}!`;
    } else if (itemCount === 2) {
      message = `Added ${items[0].name} and ${items[1].name}!`;
    } else {
      message = `Added ${itemCount} items!`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        items,
        transcription,
        message,
        timing: {
          whisper: whisperTime,
          parse: parseTime,
          total: Date.now() - startTime
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dictation error:', String(error));
    return new Response(
      JSON.stringify({
        success: false,
        items: [],
        message: 'Something went wrong',
        timing: { total: Date.now() - startTime },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
