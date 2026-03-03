// Weekly Digest — Generates and sends personalized weekly summaries
// Triggered via cron (pg_cron or external scheduler) every Sunday at 9 AM
// Aggregates: purchase_history, meal_plans, pantry_items, budgets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DigestData {
  userName: string;
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  itemsPurchased: number;
  mealsPlanned: number;
  recipesCooked: number;
  pantryExpiringSoon: number;
  pantryLowStock: number;
  budgetUsedPercent: number;
  budgetRemaining: number;
  topCategories: { name: string; amount: number }[];
  miraTip: string;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate week boundaries (last Mon-Sun)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - dayOfWeek); // Last Sunday
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6); // Last Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    // Get all users with their household info who have opted in
    // (default: opted in, users can disable in settings)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, household_id, profile')
      .not('household_id', 'is', null);

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        // Check if user has opted out of digest
        if (user.profile?.weekly_digest === false) continue;

        // Check if already sent this week
        const { data: existing } = await supabase
          .from('weekly_digests')
          .select('id')
          .eq('user_id', user.id)
          .eq('week_start', weekStartStr)
          .single();

        if (existing) continue; // Already sent

        const householdId = user.household_id;

        // 1. Purchase history for the week
        const { data: purchases } = await supabase
          .from('purchase_history')
          .select('price, category')
          .eq('household_id', householdId)
          .gte('purchased_at', weekStartISO)
          .lte('purchased_at', weekEndISO);

        const totalSpent = (purchases || []).reduce((sum, p) => sum + (p.price || 0), 0);
        const itemsPurchased = purchases?.length || 0;

        // Category breakdown
        const catMap = new Map<string, number>();
        for (const p of purchases || []) {
          const cat = p.category || 'Other';
          catMap.set(cat, (catMap.get(cat) || 0) + (p.price || 0));
        }
        const topCategories = Array.from(catMap.entries())
          .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        // 2. Meal plans for the week
        const { count: mealsPlanned } = await supabase
          .from('planned_meals')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .gte('planned_date', weekStartStr)
          .lte('planned_date', weekEndStr);

        // 3. Cookbook recipes created this week
        const { count: recipesCooked } = await supabase
          .from('cookbook_recipes')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .gte('created_at', weekStartISO)
          .lte('created_at', weekEndISO);

        // 4. Pantry status
        const threeDaysOut = new Date();
        threeDaysOut.setDate(threeDaysOut.getDate() + 3);
        const { count: pantryExpiringSoon } = await supabase
          .from('pantry_items')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .not('estimated_expiry', 'is', null)
          .lte('estimated_expiry', threeDaysOut.toISOString().split('T')[0]);

        const { count: pantryLowStock } = await supabase
          .from('pantry_items')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .eq('auto_replenish', true)
          .lte('quantity', 0);

        // 5. Budget status
        const { data: budget } = await supabase
          .from('budgets')
          .select('amount')
          .eq('household_id', householdId)
          .eq('is_active', true)
          .eq('period', 'monthly')
          .single();

        // Monthly spending for budget context
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: monthPurchases } = await supabase
          .from('purchase_history')
          .select('price')
          .eq('household_id', householdId)
          .gte('purchased_at', monthStart);

        const monthSpent = (monthPurchases || []).reduce((sum, p) => sum + (p.price || 0), 0);
        const budgetAmount = budget?.amount || 0;
        const budgetUsedPercent = budgetAmount > 0 ? Math.round((monthSpent / budgetAmount) * 100) : 0;
        const budgetRemaining = Math.max(0, budgetAmount - monthSpent);

        // Generate Mira tip
        const miraTip = generateMiraTip(totalSpent, mealsPlanned || 0, pantryExpiringSoon || 0, budgetUsedPercent);

        const digestData: DigestData = {
          userName: user.name || 'there',
          weekStart: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          weekEnd: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          totalSpent: Math.round(totalSpent * 100) / 100,
          itemsPurchased,
          mealsPlanned: mealsPlanned || 0,
          recipesCooked: recipesCooked || 0,
          pantryExpiringSoon: pantryExpiringSoon || 0,
          pantryLowStock: pantryLowStock || 0,
          budgetUsedPercent,
          budgetRemaining: Math.round(budgetRemaining * 100) / 100,
          topCategories,
          miraTip,
        };

        // Save digest to DB
        await supabase.from('weekly_digests').insert({
          user_id: user.id,
          household_id: householdId,
          week_start: weekStartStr,
          week_end: weekEndStr,
          digest_data: digestData,
          email_sent: false,
          push_sent: false,
        });

        // Send email via Brevo
        if (user.email) {
          const emailSent = await sendDigestEmail(user.email, digestData);

          if (emailSent) {
            await supabase
              .from('weekly_digests')
              .update({ email_sent: true, sent_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('week_start', weekStartStr);
          }
        }

        // Send push notification
        const { data: pushToken } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', user.id)
          .single();

        if (pushToken?.token) {
          await sendDigestPush(pushToken.token, digestData);

          await supabase
            .from('weekly_digests')
            .update({ push_sent: true })
            .eq('user_id', user.id)
            .eq('week_start', weekStartStr);
        }

        sentCount++;
      } catch (userError) {
        errors.push(`User ${user.id}: ${String(userError)}`);
      }
    }

    console.log(`Weekly digest: sent to ${sentCount} users, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors: errors.length > 0 ? errors : undefined }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Weekly digest error:', String(error));
    return new Response(
      JSON.stringify({ error: 'Failed to generate weekly digests' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function generateMiraTip(
  weeklySpend: number,
  mealsPlanned: number,
  expiring: number,
  budgetPercent: number
): string {
  if (expiring > 0) {
    return `You have ${expiring} items expiring soon in your pantry. Let me suggest some quick recipes to use them up!`;
  }
  if (budgetPercent >= 85) {
    return `You've used ${budgetPercent}% of your monthly budget. I can help plan some budget-friendly meals for the rest of the month.`;
  }
  if (mealsPlanned === 0) {
    return `No meals planned last week. Want me to create a quick meal plan? It could save you time and money.`;
  }
  if (weeklySpend > 200) {
    return `You spent $${weeklySpend.toFixed(0)} on groceries this week. I can help find savings with smarter meal planning.`;
  }
  return `Great week! You planned ${mealsPlanned} meals and spent $${weeklySpend.toFixed(0)} on groceries. Keep it up!`;
}

async function sendDigestEmail(email: string, data: DigestData): Promise<boolean> {
  try {
    const htmlContent = buildDigestEmailHTML(data);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'MemoryAisle',
          email: 'digest@memoryaisle.app',
        },
        to: [{ email, name: data.userName }],
        subject: `Your Week in Review: ${data.weekStart} - ${data.weekEnd}`,
        htmlContent,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending digest email:', String(error));
    return false;
  }
}

async function sendDigestPush(token: string, data: DigestData): Promise<boolean> {
  try {
    const body = data.totalSpent > 0
      ? `You spent $${data.totalSpent.toFixed(0)} on groceries and planned ${data.mealsPlanned} meals. ${data.pantryExpiringSoon > 0 ? `${data.pantryExpiringSoon} pantry items expiring soon!` : 'Check your full digest.'}`
      : `${data.mealsPlanned} meals planned this week. ${data.miraTip}`;

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `📊 Your Weekly Digest`,
        body,
        data: { type: 'weekly_digest', weekStart: data.weekStart },
        sound: 'default',
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function buildDigestEmailHTML(data: DigestData): string {
  const categoryRows = data.topCategories
    .map(c => `
      <tr>
        <td style="padding:6px 0;color:#4a4a4a;font-size:14px;">${c.name}</td>
        <td style="padding:6px 0;color:#2c2c2c;font-size:14px;font-weight:600;text-align:right;">$${c.amount.toFixed(2)}</td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="text-align:center;padding:24px 0;">
    <h1 style="margin:0;font-size:24px;color:#2c2c2c;">📊 Your Week in Review</h1>
    <p style="margin:4px 0 0;font-size:14px;color:#8a8a8a;">${data.weekStart} — ${data.weekEnd}</p>
  </div>

  <p style="font-size:16px;color:#4a4a4a;margin:0 0 20px;">Hey ${data.userName}! Here's how your week looked:</p>

  <!-- Stats Grid -->
  <div style="background:#ffffff;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid rgba(0,0,0,0.06);">
    <table width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td width="50%" style="text-align:center;padding:12px;">
          <div style="font-size:28px;font-weight:700;color:#d4a537;">$${data.totalSpent.toFixed(0)}</div>
          <div style="font-size:12px;color:#8a8a8a;margin-top:4px;">Grocery Spend</div>
        </td>
        <td width="50%" style="text-align:center;padding:12px;">
          <div style="font-size:28px;font-weight:700;color:#d4a537;">${data.itemsPurchased}</div>
          <div style="font-size:12px;color:#8a8a8a;margin-top:4px;">Items Purchased</div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="text-align:center;padding:12px;">
          <div style="font-size:28px;font-weight:700;color:#d4a537;">${data.mealsPlanned}</div>
          <div style="font-size:12px;color:#8a8a8a;margin-top:4px;">Meals Planned</div>
        </td>
        <td width="50%" style="text-align:center;padding:12px;">
          <div style="font-size:28px;font-weight:700;color:#d4a537;">${data.recipesCooked}</div>
          <div style="font-size:12px;color:#8a8a8a;margin-top:4px;">Recipes Saved</div>
        </td>
      </tr>
    </table>
  </div>

  ${data.topCategories.length > 0 ? `
  <!-- Category Breakdown -->
  <div style="background:#ffffff;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid rgba(0,0,0,0.06);">
    <h3 style="margin:0 0 12px;font-size:16px;color:#2c2c2c;">Spending by Category</h3>
    <table width="100%" cellspacing="0" cellpadding="0">${categoryRows}</table>
  </div>` : ''}

  ${data.budgetUsedPercent > 0 ? `
  <!-- Budget Status -->
  <div style="background:#ffffff;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid rgba(0,0,0,0.06);">
    <h3 style="margin:0 0 8px;font-size:16px;color:#2c2c2c;">Monthly Budget</h3>
    <div style="background:#f0f0f0;border-radius:8px;height:12px;overflow:hidden;">
      <div style="background:${data.budgetUsedPercent >= 85 ? '#e74c3c' : data.budgetUsedPercent >= 60 ? '#f39c12' : '#27ae60'};height:100%;width:${Math.min(data.budgetUsedPercent, 100)}%;border-radius:8px;"></div>
    </div>
    <p style="font-size:13px;color:#8a8a8a;margin:8px 0 0;">${data.budgetUsedPercent}% used · $${data.budgetRemaining.toFixed(0)} remaining</p>
  </div>` : ''}

  ${(data.pantryExpiringSoon > 0 || data.pantryLowStock > 0) ? `
  <!-- Pantry Alerts -->
  <div style="background:#fff3cd;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid #ffc107;">
    <h3 style="margin:0 0 8px;font-size:16px;color:#856404;">⚠️ Pantry Alerts</h3>
    ${data.pantryExpiringSoon > 0 ? `<p style="margin:4px 0;font-size:14px;color:#856404;">${data.pantryExpiringSoon} item${data.pantryExpiringSoon > 1 ? 's' : ''} expiring in the next 3 days</p>` : ''}
    ${data.pantryLowStock > 0 ? `<p style="margin:4px 0;font-size:14px;color:#856404;">${data.pantryLowStock} item${data.pantryLowStock > 1 ? 's' : ''} need restocking</p>` : ''}
  </div>` : ''}

  <!-- Mira Tip -->
  <div style="background:linear-gradient(135deg,#fdf8ef,#faf3e0);border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid #d4a537;">
    <p style="margin:0;font-size:14px;color:#8a6d1b;"><strong>💡 Mira says:</strong> ${data.miraTip}</p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;padding:16px 0;">
    <a href="https://memoryaisle.app" style="display:inline-block;background:#d4a537;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;">Open MemoryAisle</a>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0;border-top:1px solid rgba(0,0,0,0.06);margin-top:16px;">
    <p style="margin:0;font-size:12px;color:#8a8a8a;">You're receiving this because you have weekly digests enabled in MemoryAisle.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#8a8a8a;">Disable in Settings > Notifications > Weekly Digest</p>
  </div>

</div>
</body>
</html>`;
}
