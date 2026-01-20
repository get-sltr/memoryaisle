// Admin Service
// Provides admin dashboard data and management functions

import { supabase } from './supabase';

export interface AdminStats {
  total_users: number;
  users_today: number;
  users_this_week: number;
  users_this_month: number;
  total_premium: number;
  premium_monthly: number;
  premium_yearly: number;
  mrr: number;
  errors_today: number;
  errors_this_week: number;
  critical_errors: number;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  subscription_tier: string;
  subscription_status: string;
}

export interface AdminSubscription {
  id: string;
  user_id: string;
  user_email: string;
  tier: string;
  status: string;
  billing_interval: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

export interface ErrorLog {
  id: string;
  user_id: string | null;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  component: string | null;
  metadata: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface AdminInfo {
  id: string;
  user_id: string;
  email: string;
  role: 'founder' | 'admin' | 'support';
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

class AdminService {
  // Check if current user is an admin
  async isAdmin(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) return false;
      return data === true;
    } catch {
      return false;
    }
  }

  // Check if current user is a founder
  async isFounder(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_founder');
      if (error) return false;
      return data === true;
    } catch {
      return false;
    }
  }

  // Get current admin info
  async getAdminInfo(): Promise<AdminInfo | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return data as AdminInfo;
  }

  // Get dashboard statistics
  async getDashboardStats(): Promise<AdminStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
      if (error) {
        console.error('Error fetching admin stats:', error);
        return null;
      }
      return data as AdminStats;
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      return null;
    }
  }

  // Get recent users
  async getRecentUsers(limit: number = 50): Promise<AdminUser[]> {
    try {
      const { data, error } = await supabase.rpc('get_admin_recent_users', {
        limit_count: limit,
      });
      if (error) {
        console.error('Error fetching recent users:', error);
        return [];
      }
      return (data || []) as AdminUser[];
    } catch (error) {
      console.error('Error in getRecentUsers:', error);
      return [];
    }
  }

  // Get recent subscriptions
  async getRecentSubscriptions(limit: number = 50): Promise<AdminSubscription[]> {
    try {
      const { data, error } = await supabase.rpc('get_admin_recent_subscriptions', {
        limit_count: limit,
      });
      if (error) {
        console.error('Error fetching recent subscriptions:', error);
        return [];
      }
      return (data || []) as AdminSubscription[];
    } catch (error) {
      console.error('Error in getRecentSubscriptions:', error);
      return [];
    }
  }

  // Get error logs
  async getErrorLogs(options?: {
    limit?: number;
    severity?: string;
    resolved?: boolean;
    errorType?: string;
  }): Promise<ErrorLog[]> {
    try {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(100);
      }

      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }

      if (options?.resolved !== undefined) {
        query = query.eq('resolved', options.resolved);
      }

      if (options?.errorType) {
        query = query.eq('error_type', options.errorType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching error logs:', error);
        return [];
      }

      return (data || []) as ErrorLog[];
    } catch (error) {
      console.error('Error in getErrorLogs:', error);
      return [];
    }
  }

  // Mark error as resolved
  async resolveError(errorId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', errorId);

    return !error;
  }

  // Get user signups by day (for chart)
  async getSignupsByDay(days: number = 30): Promise<{ date: string; count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('admin_daily_signups')
        .select('signup_date, signups')
        .order('signup_date', { ascending: false })
        .limit(days);

      if (error) {
        console.error('Error fetching signup data:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.signup_date,
        count: row.signups,
      }));
    } catch (error) {
      console.error('Error in getSignupsByDay:', error);
      return [];
    }
  }

  // Get subscription stats
  async getSubscriptionStats(): Promise<{
    tier: string;
    billing_interval: string;
    status: string;
    count: number;
    canceling: number;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('admin_subscription_stats')
        .select('*');

      if (error) {
        console.error('Error fetching subscription stats:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSubscriptionStats:', error);
      return [];
    }
  }

  // Get error summary
  async getErrorSummary(): Promise<{
    error_date: string;
    error_type: string;
    severity: string;
    error_count: number;
    affected_users: number;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('admin_error_summary')
        .select('*');

      if (error) {
        console.error('Error fetching error summary:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getErrorSummary:', error);
      return [];
    }
  }

  // Add another admin (founder only)
  async addAdmin(email: string, role: 'admin' | 'support' = 'admin'): Promise<boolean> {
    const isFounder = await this.isFounder();
    if (!isFounder) {
      console.error('Only founders can add admins');
      return false;
    }

    const { error } = await supabase
      .from('admin_users')
      .insert({
        email,
        role,
        permissions: {
          view_users: true,
          view_subscriptions: true,
          view_errors: true,
          manage_users: role === 'admin',
        },
        is_active: true,
      });

    return !error;
  }

  // Remove admin (founder only)
  async removeAdmin(adminId: string): Promise<boolean> {
    const isFounder = await this.isFounder();
    if (!isFounder) {
      console.error('Only founders can remove admins');
      return false;
    }

    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: false })
      .eq('id', adminId);

    return !error;
  }
}

export const adminService = new AdminService();
