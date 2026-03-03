// Push Notifications Service
// Handles local and remote push notifications for MemoryAisle

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number;
}

export type NotificationType =
  | 'list_shared'
  | 'item_added'
  | 'item_checked'
  | 'family_joined'
  | 'meal_plan_ready'
  | 'store_nearby'
  | 'reminder'
  | 'mira_suggestion'
  | 'glp1_injection_reminder'
  | 'glp1_daily_checkin'
  | 'glp1_protein_reminder'
  | 'weekly_digest';

interface ScheduledNotification {
  id: string;
  type: NotificationType;
  scheduledFor: Date;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  // Initialize notifications and register for push
  async initialize(): Promise<string | null> {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.log('Push notification permission denied');
        return null;
      }

      // Get push token (only on physical devices)
      if (Device.isDevice) {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '6224c734-c82d-4852-848b-3ef0fde9e8f4',
        });
        this.expoPushToken = tokenData.data;
        logger.log('Push token:', this.expoPushToken);
      } else {
        logger.log('Push notifications require a physical device');
      }

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00D4AA',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('family', {
          name: 'Family Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250],
          lightColor: '#7B2CBF',
        });

        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      logger.error('Error initializing notifications:', error);
      return null;
    }
  }

  // Register push token with backend
  async registerPushToken(userId: string): Promise<void> {
    if (!this.expoPushToken) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: this.expoPushToken,
          platform: Platform.OS,
          device_name: Device.deviceName || 'Unknown',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (error) throw error;
      logger.log('Push token registered');
    } catch (error) {
      logger.error('Error registering push token:', error);
    }
  }

  // Listen for incoming notifications
  addNotificationListeners(
    onReceived?: (notification: Notifications.Notification) => void,
    onResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Notification received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.log('Notification received:', notification);
        onReceived?.(notification);
      }
    );

    // User tapped on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        logger.log('Notification response:', response);
        const data = response.notification.request.content.data;
        this.handleNotificationTap(data);
        onResponse?.(response);
      }
    );
  }

  // Handle notification tap navigation
  private handleNotificationTap(data: Record<string, any>): void {
    // This would integrate with expo-router navigation
    // For now, log the action
    logger.log('Notification tap data:', data);

    // Example handling:
    // if (data.type === 'list_shared') router.push(`/list/${data.listId}`);
    // if (data.type === 'meal_plan_ready') router.push('/meal-plans');
  }

  // Remove listeners
  removeNotificationListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  // Send local notification immediately
  async sendLocalNotification(payload: NotificationPayload): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: payload.sound !== false,
        badge: payload.badge,
      },
      trigger: null, // Immediately
    });

    return notificationId;
  }

  // Schedule a notification
  async scheduleNotification(
    payload: NotificationPayload,
    trigger: Notifications.NotificationTriggerInput,
    type: NotificationType = 'reminder'
  ): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: { ...payload.data, type },
        sound: payload.sound !== false,
      },
      trigger,
    });

    // Track scheduled notification
    if (trigger && 'date' in trigger) {
      this.scheduledNotifications.set(notificationId, {
        id: notificationId,
        type,
        scheduledFor: trigger.date as Date,
      });
    }

    return notificationId;
  }

  // Schedule a reminder for a specific time
  async scheduleReminder(
    title: string,
    body: string,
    date: Date,
    data?: Record<string, any>
  ): Promise<string> {
    return this.scheduleNotification(
      { title, body, data },
      { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      'reminder'
    );
  }

  // Schedule recurring notification (e.g., daily shopping reminder)
  async scheduleRecurring(
    payload: NotificationPayload,
    hour: number,
    minute: number,
    weekdays: number[] = [1, 2, 3, 4, 5, 6, 7] // 1=Sunday
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const weekday of weekdays) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday,
          hour,
          minute,
          repeats: true,
        },
      });
      ids.push(id);
    }

    return ids;
  }

  // Cancel a scheduled notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    this.scheduledNotifications.delete(notificationId);
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.scheduledNotifications.clear();
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  // Notification builders for common scenarios
  async notifyListShared(listName: string, sharedBy: string, listId: string): Promise<string> {
    return this.sendLocalNotification({
      title: 'List Shared With You',
      body: `${sharedBy} shared "${listName}" with you`,
      data: { type: 'list_shared', listId },
    });
  }

  async notifyItemAdded(itemName: string, listName: string, addedBy: string): Promise<string> {
    return this.sendLocalNotification({
      title: 'Item Added',
      body: `${addedBy} added ${itemName} to ${listName}`,
      data: { type: 'item_added', itemName, listName },
    });
  }

  async notifyFamilyJoined(memberName: string, familyName: string): Promise<string> {
    return this.sendLocalNotification({
      title: 'New Family Member',
      body: `${memberName} joined ${familyName}!`,
      data: { type: 'family_joined', memberName },
    });
  }

  async notifyMealPlanReady(planName: string, days: number): Promise<string> {
    return this.sendLocalNotification({
      title: 'Meal Plan Ready!',
      body: `Your ${days}-day ${planName} is ready to view`,
      data: { type: 'meal_plan_ready', planName },
    });
  }

  async notifyStoreNearby(storeName: string, listCount: number): Promise<string> {
    return this.sendLocalNotification({
      title: `You're near ${storeName}!`,
      body: `You have ${listCount} item${listCount > 1 ? 's' : ''} to get here`,
      data: { type: 'store_nearby', storeName },
    });
  }

  async notifyMiraSuggestion(suggestion: string): Promise<string> {
    return this.sendLocalNotification({
      title: 'Mira Has a Suggestion',
      body: suggestion,
      data: { type: 'mira_suggestion' },
    });
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  // Get push token
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // ─── GLP-1 Notification Helpers ────────────────────────────

  /**
   * Schedule weekly injection reminder.
   * @param injectionDay 0=Sunday..6=Saturday
   */
  async scheduleInjectionReminder(injectionDay: number): Promise<string[]> {
    // expo-notifications uses 1=Sunday..7=Saturday
    const weekday = injectionDay + 1;
    return this.scheduleRecurring(
      {
        title: 'Injection Day',
        body: "It's your injection day. Don't forget to log it in MemoryAisle!",
        data: { type: 'glp1_injection_reminder' },
      },
      9, // 9 AM
      0,
      [weekday],
    );
  }

  /**
   * Schedule daily check-in reminder at 7 PM every day.
   */
  async scheduleDailyCheckinReminder(): Promise<string[]> {
    return this.scheduleRecurring(
      {
        title: 'Daily Check-in',
        body: 'Quick check-in: How are your appetite and energy today?',
        data: { type: 'glp1_daily_checkin' },
      },
      19, // 7 PM
      0,
    );
  }

  /**
   * Schedule daily protein reminder at 2 PM.
   */
  async scheduleProteinReminder(): Promise<string[]> {
    return this.scheduleRecurring(
      {
        title: 'Protein Check',
        body: "Have you hit your protein goal today? Aim for at least 60g — it's important on GLP-1 meds.",
        data: { type: 'glp1_protein_reminder' },
      },
      14, // 2 PM
      0,
    );
  }

  /**
   * Schedule all GLP-1 related notifications.
   */
  async scheduleGLP1Notifications(injectionDay?: number | null): Promise<void> {
    try {
      if (injectionDay != null) {
        await this.scheduleInjectionReminder(injectionDay);
      }
      await this.scheduleDailyCheckinReminder();
      await this.scheduleProteinReminder();
      logger.log('GLP-1 notifications scheduled');
    } catch (error) {
      logger.error('Error scheduling GLP-1 notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
