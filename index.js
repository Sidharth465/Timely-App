/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, {
  AndroidImportance,
  EventType,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native';

AppRegistry.registerComponent(appName, () => App);

const CHANNEL_ID = 'work-reminders-zomato';

async function ensureAndroidChannel() {
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Work Reminders (Zomato)',
      importance: AndroidImportance.HIGH,
      sound: 'zomato_tone',
      vibration: true,
    });
  } catch (e) {}
}

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;

  if (type === EventType.ACTION_PRESS) {
    if (pressAction.id === 'snooze') {
      await ensureAndroidChannel();
      const settings = await notifee.getNotificationSettings();
      if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
        return;
      }
      const timestamp = Date.now() + 10 * 60 * 1000;
      await notifee.cancelNotification(notification?.id);
      await notifee.createTriggerNotification(
        {
          title: notification?.title || 'Work session',
          body: 'Snoozed for 10 minutes.',
          android: {
            channelId: CHANNEL_ID,
            sound: 'zomato_tone',
            smallIcon: 'clock_reminder',
            pressAction: { id: 'default' },
            actions: [
              { title: 'Snooze 10m', pressAction: { id: 'snooze' } },
              { title: 'Dismiss', pressAction: { id: 'dismiss' } },
            ],
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp,
          alarmManager: { allowWhileIdle: true },
        },
      );
      return;
    }
    if (pressAction.id === 'dismiss') {
      await notifee.cancelNotification(notification?.id);
      return;
    }
  }
});
