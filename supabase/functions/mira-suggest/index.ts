// Mira Suggest - Pattern-based Predictions Edge Function
// Provides smart grocery suggestions based on purchase history

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Suggestion {
  itemName: string;
  reason: string;
  confidence: number;
  daysPastDue: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role for RLS bypass
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create client with user's JWT for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { householdId } = await req.json();

    if (!householdId) {
      throw new Error('No household ID provided');
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
    console.error('Mira suggest error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        suggestions: [],
        message: "Couldn't load suggestions right now.",
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
