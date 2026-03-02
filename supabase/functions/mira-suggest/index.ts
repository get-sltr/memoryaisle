// Mira Suggest - Pattern-based Predictions Edge Function
// Provides smart grocery suggestions based on purchase history

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

interface Suggestion {
  itemName: string;
  reason: string;
  confidence: number;
  daysPastDue: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Authenticate the user via JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use anon key + user JWT so RLS is enforced
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { householdId } = await req.json();

    if (!householdId) {
      return new Response(
        JSON.stringify({ success: false, suggestions: [], message: 'No household ID provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify user belongs to this household
    const { data: membership } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .eq('household_id', householdId)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ success: false, suggestions: [], message: 'Not a member of this household' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get patterns that are due or overdue
    const now = new Date().toISOString();
    const { data: patterns, error: patternsError } = await supabase
      .from('purchase_patterns')
      .select('*')
      .eq('household_id', householdId)
      .lte('next_predicted', now)
      .order('confidence', { ascending: false })
      .limit(10);

    if (patternsError) {
      console.error('Error fetching patterns:', patternsError);
      throw patternsError;
    }

    // Get current list items to exclude
    const { data: lists, error: listsError } = await supabase
      .from('grocery_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .limit(1)
      .single();

    let currentItemNames: string[] = [];
    if (lists && !listsError) {
      const { data: items } = await supabase
        .from('list_items')
        .select('name')
        .eq('list_id', lists.id)
        .eq('is_completed', false);

      currentItemNames = (items || []).map((i: { name: string }) => i.name.toLowerCase());
    }

    // Build suggestions, excluding items already on the list
    const suggestions: Suggestion[] = (patterns || [])
      .filter(pattern => !currentItemNames.includes(pattern.item_name.toLowerCase()))
      .map(pattern => {
        const nextPredicted = new Date(pattern.next_predicted);
        const daysPastDue = Math.floor((Date.now() - nextPredicted.getTime()) / (1000 * 60 * 60 * 24));

        let reason: string;
        if (daysPastDue === 0) {
          reason = `Usually buy today`;
        } else if (daysPastDue === 1) {
          reason = `Usually buy yesterday`;
        } else if (daysPastDue > 1) {
          reason = `${daysPastDue} days overdue`;
        } else {
          reason = `Due soon`;
        }

        return {
          itemName: pattern.item_name,
          reason,
          confidence: pattern.confidence,
          daysPastDue,
        };
      })
      .sort((a, b) => {
        // Sort by combination of days past due and confidence
        const aScore = a.daysPastDue * a.confidence;
        const bScore = b.daysPastDue * b.confidence;
        return bScore - aScore;
      })
      .slice(0, 5);

    // Generate a friendly message
    let message: string;
    if (suggestions.length === 0) {
      message = "You're all caught up! No suggestions right now.";
    } else if (suggestions.length === 1) {
      message = `You might need ${suggestions[0].itemName}!`;
    } else {
      message = `Found ${suggestions.length} items you might need.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions,
        message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Mira suggest error:', String(error));
    return new Response(
      JSON.stringify({
        success: false,
        suggestions: [],
        message: "Couldn't load suggestions right now.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
