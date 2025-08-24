/**
 * ClockReminder - Single screen UI
 * Lightweight UI to set start time and work duration, auto-selects current time
 * when duration is chosen, and shows computed end time.
 *
 * Native scheduling will be added in a follow-up step.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  Modal,
} from 'react-native';
import notifee, {
  AndroidImportance,
  EventType,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Card } from './src/components/Card';
import { PrimaryButton } from './src/components/PrimaryButton';
import { SmallButton } from './src/components/SmallButton';
import { useThemeColors, type ThemeColors } from './src/theme/theme';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [startHourInput, setStartHourInput] = useState<string>('');
  const [startMinuteInput, setStartMinuteInput] = useState<string>('');
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [isStartModalVisible, setIsStartModalVisible] =
    useState<boolean>(false);
  const [durationHours, setDurationHours] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [notifAuth, setNotifAuth] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ start: Date; end: Date }>>([]);

  const theme = useThemeColors();

  const totalDurationMinutes: number = useMemo(() => {
    const hours = Number.parseInt(durationHours || '0', 10);
    const mins = Number.parseInt(durationMinutes || '0', 10);
    const validMins = Math.max(0, Math.min(59, Number.isNaN(mins) ? 0 : mins));
    const validHours = Math.max(0, Number.isNaN(hours) ? 0 : hours);
    return validHours * 60 + validMins;
  }, [durationHours, durationMinutes]);

  const computedEndTime: Date | null = useMemo(() => {
    if (!startTime || totalDurationMinutes <= 0) return null;
    const end = new Date(startTime);
    end.setMinutes(end.getMinutes() + totalDurationMinutes);
    return end;
  }, [startTime, totalDurationMinutes]);

  const startTimeDisplay: string = useMemo(() => {
    return startTime ? formatTime(startTime as Date) : 'Not set';
  }, [startTime]);

  // Default start time to current when screen loads to avoid confusion
  useEffect(() => {
    setStartTime(new Date());
  }, []);

  useEffect(() => {
    // Ensure Android channel exists
    async function initChannel() {
      try {
        await notifee.createChannel({
          id: 'work-reminders-zomato',
          name: 'Work Reminders (Zomato)',
          importance: AndroidImportance.HIGH,
          sound: 'zomato_tone',
          vibration: true,
        });
      } catch (e) {}
    }
    initChannel();
  }, []);

  useEffect(() => {
    async function loadNotifSettings() {
      try {
        const s = await notifee.getNotificationSettings();
        setNotifAuth(s.authorizationStatus);
      } catch {}
    }
    loadNotifSettings();
  }, []);

  // Handle notification actions while app is in foreground
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      if (type === EventType.ACTION_PRESS && pressAction) {
        if (pressAction.id === 'snooze') {
          if (notification?.id) {
            await notifee.cancelNotification(notification.id);
          }
          const ts = Date.now() + 10 * 60 * 1000;
          await notifee.createTriggerNotification(
            {
              title: notification?.title || 'Work session',
              body: 'Snoozed for 10 minutes.',
              android: {
                channelId: 'work-reminders-zomato',
                sound: 'zomato_tone',
                smallIcon: 'clock_reminder',
                pressAction: { id: 'default' },
                actions: [
                  { title: 'Snooze 10m', pressAction: { id: 'snooze' } },
                  { title: 'Dismiss', pressAction: { id: 'dismiss' } },
                ],
                importance: AndroidImportance.HIGH,
              },
            },
            {
              type: TriggerType.TIMESTAMP,
              timestamp: ts,
              alarmManager: { allowWhileIdle: true },
            },
          );
        }
        if (pressAction.id === 'dismiss') {
          if (notification?.id) {
            await notifee.cancelNotification(notification.id);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  function handlePickNowIfNeeded() {
    if (!startTime) setStartTime(new Date());
  }

  function handleChangeHours(text: string) {
    // Auto-pick current time when user selects total working hours
    handlePickNowIfNeeded();
    const sanitized = text.replace(/[^0-9]/g, '');
    setDurationHours(sanitized);
  }

  function handleChangeMinutes(text: string) {
    handlePickNowIfNeeded();
    const sanitized = text.replace(/[^0-9]/g, '');
    setDurationMinutes(sanitized);
  }

  function setPresetDuration(totalMinutes: number) {
    handlePickNowIfNeeded();
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    setDurationHours(String(hours));
    setDurationMinutes(String(mins));
  }

  function bumpStartTimeByMinutes(delta: number) {
    const base = startTime ?? new Date();
    const next = new Date(base);
    next.setMinutes(next.getMinutes() + delta);
    setStartTime(next);
  }

  function syncManualInputsFromDate(date: Date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const am = h < 12;
    const h12 = ((h + 11) % 12) + 1;
    setStartHourInput(String(h12));
    setStartMinuteInput(m.toString().padStart(2, '0'));
    setStartAmPm(am ? 'AM' : 'PM');
  }

  function applyManualStartFromInputs(
    nextHourStr?: string,
    nextMinuteStr?: string,
    nextAmPm?: 'AM' | 'PM',
  ) {
    const hourStr = (nextHourStr ?? startHourInput).replace(/[^0-9]/g, '');
    const minuteStr = (nextMinuteStr ?? startMinuteInput).replace(
      /[^0-9]/g,
      '',
    );
    const ampm = nextAmPm ?? startAmPm;
    let hour = Math.max(1, Math.min(12, Number.parseInt(hourStr || '0', 10)));
    let minute = Math.max(
      0,
      Math.min(59, Number.parseInt(minuteStr || '0', 10)),
    );
    const base = new Date();
    let hour24 = hour % 12;
    if (ampm === 'PM') hour24 += 12;
    base.setHours(hour24, minute, 0, 0);
    setStartTime(base);
  }

  function openStartModal() {
    syncManualInputsFromDate(startTime ?? new Date());
    setIsStartModalVisible(true);
  }

  function closeStartModal() {
    setIsStartModalVisible(false);
  }

  function confirmStartModal() {
    applyManualStartFromInputs();
    setIsStartModalVisible(false);
  }

  async function requestNotificationsNow() {
    try {
      await notifee.requestPermission();
      const s = await notifee.getNotificationSettings();
      setNotifAuth(s.authorizationStatus);
      if (s.authorizationStatus === AuthorizationStatus.DENIED) {
        await notifee.openNotificationSettings();
      }
    } catch {}
  }

  function handleSchedule() {
    const baseStart = startTime ?? new Date();
    if (!startTime) setStartTime(baseStart);
    if (totalDurationMinutes <= 0) {
      Alert.alert('Incomplete', 'Please enter a valid duration.');
      return;
    }
    const endLocal = new Date(baseStart);
    endLocal.setMinutes(endLocal.getMinutes() + totalDurationMinutes);
    if (endLocal.getTime() <= Date.now()) {
      Alert.alert(
        'End time passed',
        'The computed end time is in the past. Adjust start time or duration.',
      );
      return;
    }
    // Record recent reminder (cap at 10)
    setHistory(prev =>
      [{ start: baseStart, end: endLocal }, ...prev].slice(0, 10),
    );
    scheduleNotification(endLocal).catch(() => {
      Alert.alert('Error', 'Failed to schedule notification.');
    });
  }

  async function scheduleNotification(when: Date) {
    try {
      if (Platform.OS === 'android') {
        // Android 13+ needs runtime permission
        await notifee.requestPermission();
        const settings = await notifee.getNotificationSettings();
        if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
          Alert.alert(
            'Notifications disabled',
            'Enable notifications in settings to receive reminders.',
            [
              {
                text: 'Open settings',
                onPress: () => notifee.openNotificationSettings(),
              },
              { text: 'OK' },
            ],
          );
          return;
        }
        // Ensure channel exists before scheduling
        await notifee.createChannel({
          id: 'work-reminders-zomato',
          name: 'Work Reminders (Zomato)',
          importance: AndroidImportance.HIGH,
          sound: 'zomato_tone',
          vibration: true,
        });
        const isBlocked = await notifee.isChannelBlocked(
          'work-reminders-zomato',
        );
        if (isBlocked) {
          Alert.alert(
            'Channel blocked',
            'Enable sound/alerts for the Work Reminders channel.',
            [
              {
                text: 'Open settings',
                onPress: () => notifee.openNotificationSettings(),
              },
              { text: 'OK' },
            ],
          );
          return;
        }
      }

      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: when.getTime(),
        alarmManager: { allowWhileIdle: true },
      } as const;

      await notifee.createTriggerNotification(
        {
          title: 'Work session complete',
          body: 'Time’s up. Ready to wrap?',
          android: {
            channelId: 'work-reminders-zomato',
            sound: 'zomato_tone',
            smallIcon: 'clock_reminder',
            // Keep sound as default via channel
            pressAction: { id: 'default' },
            actions: [
              { title: 'Snooze 10m', pressAction: { id: 'snooze' } },
              { title: 'Dismiss', pressAction: { id: 'dismiss' } },
            ],
            // Make sure it shows prominently
            importance: AndroidImportance.HIGH,
            // Allow heads-up on supported devices
            asForegroundService: false,
          },
        },
        trigger,
      );

      const pretty = formatTime(when);
      Alert.alert('Scheduled', `Reminder set for ${pretty}.`);
    } catch (e) {
      throw e;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: safeAreaInsets.top + 24,
          paddingBottom: safeAreaInsets.bottom + 28,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Clock Reminder
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Set your work window and we’ll remind you when it ends.
          </Text>
          {Platform.OS === 'android' &&
          notifAuth !== AuthorizationStatus.AUTHORIZED ? (
            <View style={{ marginTop: 8 }}>
              <SmallButton
                label="Enable notifications"
                onPress={requestNotificationsNow}
                theme={theme}
              />
            </View>
          ) : null}
        </View>

        <Card>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Start time
          </Text>
          {false ? (
            <View style={styles.rowCenter}>
              <Text style={[styles.timeDisplay, { color: theme.textPrimary }]}>
                {startTimeDisplay}
              </Text>
              <View style={styles.rowRight}>
                <SmallButton
                  label="Edit"
                  onPress={openStartModal}
                  theme={theme}
                />
                <SmallButton
                  label="Now"
                  onPress={() => {
                    const now = new Date();
                    setStartTime(now);
                  }}
                  theme={theme}
                />
                <SmallButton
                  label="-15m"
                  onPress={() => bumpStartTimeByMinutes(-15)}
                  theme={theme}
                />
                <SmallButton
                  label="+15m"
                  onPress={() => bumpStartTimeByMinutes(15)}
                  theme={theme}
                />
              </View>
            </View>
          ) : (
            <View style={styles.rowCenter}>
              <Text style={[styles.timeDisplay, { color: theme.textPrimary }]}>
                {startTimeDisplay}
              </Text>
              <View style={styles.rowRight}>
                <SmallButton
                  label="Edit"
                  onPress={openStartModal}
                  theme={theme}
                />
                <SmallButton
                  label="Now"
                  onPress={() => {
                    const now = new Date();
                    setStartTime(now);
                  }}
                  theme={theme}
                />
                <SmallButton
                  label="-15m"
                  onPress={() => bumpStartTimeByMinutes(-15)}
                  theme={theme}
                />
                <SmallButton
                  label="+15m"
                  onPress={() => bumpStartTimeByMinutes(15)}
                  theme={theme}
                />
              </View>
            </View>
          )}
        </Card>

        <Card>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Work duration
          </Text>
          <View style={styles.rowInputs}>
            <LabeledNumberInput
              label="Hours"
              value={durationHours}
              onChangeText={handleChangeHours}
              placeholder="0"
              theme={theme}
              maxLength={3}
            />
            <LabeledNumberInput
              label="Minutes"
              value={durationMinutes}
              onChangeText={handleChangeMinutes}
              placeholder="0"
              theme={theme}
              maxLength={2}
            />
          </View>
          <View style={styles.chipsRow}>
            {PRESET_DURATIONS.map(d => (
              <Chip
                key={d.key}
                label={d.label}
                onPress={() => setPresetDuration(d.totalMinutes)}
                theme={theme}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            End time
          </Text>
          <Text style={[styles.endTime, { color: theme.textPrimary }]}>
            {computedEndTime ? formatTime(computedEndTime) : '—'}
          </Text>
        </Card>

        {history.length > 0 ? (
          <Card>
            <View style={styles.rowCenter}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Recent reminders
              </Text>
              <SmallButton
                label="Clear"
                onPress={() => setHistory([])}
                theme={theme}
              />
            </View>
            {history.map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <Text
                  style={[styles.historyText, { color: theme.textPrimary }]}
                >
                  {formatTime(h.start)} → {formatTime(h.end)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.section}>
          <PrimaryButton
            label="Schedule Reminder"
            onPress={handleSchedule}
            disabled={!computedEndTime}
          />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            The reminder will play a sound at the end time, even in the
            background. (Next step)
          </Text>
        </View>
      </ScrollView>
      <Modal
        visible={isStartModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeStartModal}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalHeader, { color: theme.textPrimary }]}>
              Set start time
            </Text>
            <View style={styles.rowInputs}>
              <View style={styles.stepperWrap}>
                <Text
                  style={[styles.inputLabel, { color: theme.textSecondary }]}
                >
                  Hour
                </Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => {
                      const h = Math.max(
                        1,
                        Math.min(
                          12,
                          Number.parseInt(startHourInput || '12', 10),
                        ),
                      );
                      const nh = ((h + 10) % 12) + 1;
                      const s = String(nh);
                      setStartHourInput(s);
                      applyManualStartFromInputs(s, undefined, undefined);
                    }}
                    style={[styles.stepperBtn, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.textPrimary }}>-</Text>
                  </Pressable>
                  <Text
                    style={[styles.stepperValue, { color: theme.textPrimary }]}
                  >
                    {startHourInput || '—'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const h = Math.max(
                        1,
                        Math.min(
                          12,
                          Number.parseInt(startHourInput || '12', 10),
                        ),
                      );
                      const nh = (h % 12) + 1;
                      const s = String(nh);
                      setStartHourInput(s);
                      applyManualStartFromInputs(s, undefined, undefined);
                    }}
                    style={[styles.stepperBtn, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.textPrimary }}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.stepperWrap}>
                <Text
                  style={[styles.inputLabel, { color: theme.textSecondary }]}
                >
                  Minute
                </Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => {
                      const m = Math.max(
                        0,
                        Math.min(
                          59,
                          Number.parseInt(startMinuteInput || '0', 10),
                        ),
                      );
                      const nm = (m + 59) % 60;
                      const s = nm.toString().padStart(2, '0');
                      setStartMinuteInput(s);
                      applyManualStartFromInputs(undefined, s, undefined);
                    }}
                    style={[styles.stepperBtn, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.textPrimary }}>-</Text>
                  </Pressable>
                  <Text
                    style={[styles.stepperValue, { color: theme.textPrimary }]}
                  >
                    {startMinuteInput || '—'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const m = Math.max(
                        0,
                        Math.min(
                          59,
                          Number.parseInt(startMinuteInput || '0', 10),
                        ),
                      );
                      const nm = (m + 1) % 60;
                      const s = nm.toString().padStart(2, '0');
                      setStartMinuteInput(s);
                      applyManualStartFromInputs(undefined, s, undefined);
                    }}
                    style={[styles.stepperBtn, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.textPrimary }}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.stepperWrap}>
                <Text
                  style={[styles.inputLabel, { color: theme.textSecondary }]}
                >
                  AM/PM
                </Text>
                <View style={styles.rowRight}>
                  <SmallButton
                    label={startAmPm === 'AM' ? 'AM ✓' : 'AM'}
                    onPress={() => {
                      setStartAmPm('AM');
                      applyManualStartFromInputs(undefined, undefined, 'AM');
                    }}
                    theme={theme}
                  />
                  <SmallButton
                    label={startAmPm === 'PM' ? 'PM ✓' : 'PM'}
                    onPress={() => {
                      setStartAmPm('PM');
                      applyManualStartFromInputs(undefined, undefined, 'PM');
                    }}
                    theme={theme}
                  />
                </View>
              </View>
            </View>
            <View style={styles.modalActions}>
              <SmallButton
                label="Cancel"
                onPress={closeStartModal}
                theme={theme}
              />
              <SmallButton
                label="Now"
                onPress={() => {
                  const now = new Date();
                  setStartTime(now);
                  syncManualInputsFromDate(now);
                }}
                theme={theme}
              />
              <SmallButton
                label="Done"
                onPress={confirmStartModal}
                theme={theme}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Theme is now imported from src/theme/theme

function formatTime(date: Date): string {
  try {
    if (typeof Intl !== 'undefined' && (Intl as any).DateTimeFormat) {
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    const hours = date.getHours();
    const mins = date.getMinutes();
    const h12 = ((hours + 11) % 12) + 1;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${h12}:${mins.toString().padStart(2, '0')} ${ampm}`;
  }
}

const PRESET_DURATIONS: Array<{
  key: string;
  label: string;
  totalMinutes: number;
}> = [
  { key: '25m', label: '25m', totalMinutes: 25 },
  { key: '30m', label: '30m', totalMinutes: 30 },
  { key: '45m', label: '45m', totalMinutes: 45 },
  { key: '1h', label: '1h', totalMinutes: 60 },
  { key: '90m', label: '1h 30m', totalMinutes: 90 },
  { key: '2h', label: '2h', totalMinutes: 120 },
  { key: '8h', label: '8h', totalMinutes: 480 },
  { key: '8h30', label: '8h 30m', totalMinutes: 510 },
];

// SmallButton now imported from components

function Chip({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.chipBg, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.chipText, { color: theme.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LabeledNumberInput({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  theme: ThemeColors;
  maxLength?: number;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            color: theme.textPrimary,
            borderColor: theme.border,
          },
        ]}
        keyboardType={Platform.select({
          ios: 'number-pad',
          android: 'numeric',
        })}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        maxLength={maxLength}
        returnKeyType="done"
      />
    </View>
  );
}

// PrimaryButton now imported from components

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowRight: {
    flexDirection: 'row',
    gap: 8,
  },
  timeDisplay: {
    fontSize: 22,
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
    fontSize: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepperWrap: {
    flex: 1,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  endTime: {
    fontSize: 28,
    fontWeight: '700',
  },
  primaryBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    ...Platform.select({
      ios: {
        shadowColor: '#2563eb',
        shadowOpacity: 0.2,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  note: {
    marginTop: 10,
    marginHorizontal: 20,
    fontSize: 12,
  },
  historyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyText: {
    fontSize: 14,
  },
  bgWrap: {},
  scroll: {},
  blob: {},
});

export default App;
