import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';

type Segment = {
  label: string;
  color: string;
  weight?: number;
};

type RewardWheelSpinnerProps = {
  segments?: Segment[];
  size?: number;
  spinDurationMs?: number;
  fullTurns?: number;
  disabled?: boolean;
  onSpinEnd?: (result: Segment, index: number) => void;
};

function pickWeightedIndex(items: Array<Segment>): number {
  const weights = items.map(s => (typeof s.weight === 'number' ? s.weight : 1));
  const total = weights.reduce((acc, w) => acc + w, 0);
  let r = Math.random() * (total <= 0 ? 1 : total);
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return items.length - 1;
}

const DEFAULT_SEGMENTS: Segment[] = [
  { label: '10', color: '#FF6B6B' },
  { label: '20', color: '#4D96FF' },
  { label: '30', color: '#FFD93D' },
  { label: '40', color: '#6BCB77' },
  { label: '50', color: '#845EC2' },
  { label: '60', color: '#FF9671' },
  { label: '70', color: '#2BB9BB' },
  { label: '80', color: '#B39CD0' },
];

const RewardWheelSpinner = ({
  segments = DEFAULT_SEGMENTS,
  size = 280,
  spinDurationMs = 4500,
  fullTurns = 6,
  disabled,
  onSpinEnd,
}: RewardWheelSpinnerProps) => {
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const baseRotationDegRef = useRef<number>(0);
  const lastTickIndexRef = useRef<number | null>(null);
  const pointerWiggle = useRef(new Animated.Value(0)).current;
  const [confetti, setConfetti] = useState<
    Array<{
      id: number;
      left: number;
      size: number;
      color: string;
      translateY: Animated.Value;
      rotate: Animated.Value;
    }>
  >([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const highlightPulse = useRef(new Animated.Value(0)).current;

  const segmentAngle = useMemo(
    () => 360 / Math.max(1, segments.length),
    [segments.length],
  );
  const radius = size / 2;
  const hubSize = radius * 0.32;
  const segmentBaseWidth = useMemo(() => {
    const halfAngleRad = (segmentAngle * Math.PI) / 360;
    return Math.max(8, 2 * radius * Math.tan(halfAngleRad));
  }, [radius, segmentAngle]);

  function normalizeDeg(deg: number): number {
    const m = deg % 360;
    return m < 0 ? m + 360 : m;
  }

  function computeIndexFromRotation(finalDeg: number): number {
    const pointerAngle = normalizeDeg(360 - normalizeDeg(finalDeg));
    const raw = Math.floor(pointerAngle / segmentAngle);
    const idx = Math.max(0, Math.min(segments.length - 1, raw));
    return idx;
  }

  function handleSpin() {
    if (isSpinning || segments.length === 0 || disabled) return;
    setIsSpinning(true);
    lastTickIndexRef.current = computeIndexFromRotation(
      baseRotationDegRef.current,
    );

    const chosenIndex = pickWeightedIndex(segments);
    const margin = Math.max(2, segmentAngle * 0.15);
    const randomOffsetWithin =
      margin + Math.random() * Math.max(0, segmentAngle - 2 * margin);

    const targetWithinSeg = chosenIndex * segmentAngle + randomOffsetWithin;
    const targetDelta = fullTurns * 360 + (360 - targetWithinSeg);
    const target = baseRotationDegRef.current + targetDelta;

    const overshoot = Math.min(8, segmentAngle * 0.2);
    Animated.sequence([
      Animated.timing(rotation, {
        toValue: target + overshoot,
        duration: Math.max(300, spinDurationMs * 0.15),
        easing: Easing.bezier(0.2, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: target,
        duration: Math.max(500, spinDurationMs * 0.25),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      const normalized = normalizeDeg(target);
      baseRotationDegRef.current = normalized;
      rotation.setValue(normalized);
      setIsSpinning(false);
      const idx = computeIndexFromRotation(normalized);
      setSelectedIndex(idx);
      if (finished) {
        try {
          Vibration.vibrate(40);
        } catch {}
        if (onSpinEnd) onSpinEnd(segments[idx], idx);
        launchConfetti();
        triggerHighlightPulse();
      }
    });
  }

  function triggerPointerWiggle() {
    pointerWiggle.stopAnimation();
    pointerWiggle.setValue(0);
    Animated.sequence([
      Animated.timing(pointerWiggle, {
        toValue: 1,
        duration: 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pointerWiggle, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function launchConfetti() {
    const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#845EC2'];
    const count = 18;
    const pieces: Array<{
      id: number;
      left: number;
      size: number;
      color: string;
      translateY: Animated.Value;
      rotate: Animated.Value;
    }> = [];
    for (let i = 0; i < count; i += 1) {
      const sizePx = 6 + Math.floor(Math.random() * 6);
      const left = Math.floor(Math.random() * size);
      const color = colors[i % colors.length];
      const translateY = new Animated.Value(-20);
      const rotate = new Animated.Value(0);
      pieces.push({
        id: Date.now() + i,
        left,
        size: sizePx,
        color,
        translateY,
        rotate,
      });
    }
    setConfetti(pieces);
    Animated.stagger(
      40,
      pieces.map(p =>
        Animated.parallel([
          Animated.timing(p.translateY, {
            toValue: size + 40,
            duration: 1100 + Math.random() * 700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: 1,
            duration: 1200 + Math.random() * 500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start(() => {
      setTimeout(() => setConfetti([]), 300);
    });
  }

  function triggerHighlightPulse() {
    highlightPulse.stopAnimation();
    highlightPulse.setValue(0);
    Animated.sequence([
      Animated.timing(highlightPulse, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(highlightPulse, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }

  // Tick haptics when crossing slice boundaries
  React.useEffect(() => {
    const id = rotation.addListener(({ value }) => {
      const deg = typeof value === 'number' ? value : Number(value);
      const idx = computeIndexFromRotation(deg);
      if (lastTickIndexRef.current === null) {
        lastTickIndexRef.current = idx;
        return;
      }
      if (idx !== lastTickIndexRef.current) {
        lastTickIndexRef.current = idx;
        try {
          Vibration.vibrate(10);
        } catch {}
        triggerPointerWiggle();
      }
    });
    return () => {
      rotation.removeListener(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentAngle, segments.length]);

  const animatedWheelStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }) as unknown as string,
      },
    ],
  } as const;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      />
      <Animated.View
        style={[
          styles.wheel,
          { width: size, height: size },
          animatedWheelStyle,
        ]}
      >
        {/* Outer rim */}
        <View
          style={[
            StyleSheet.absoluteFillObject as unknown as object,
            {
              borderRadius: size / 2,
              borderWidth: Math.max(4, Math.floor(size * 0.02)),
              borderColor: '#1e293b',
              backgroundColor: '#0f172a',
              opacity: 0.85,
            },
          ]}
        />
        {segments.map((seg, i) => {
          const angle = i * segmentAngle;
          return (
            <View
              key={String(i)}
              style={[
                styles.slice,
                {
                  left: radius,
                  top: radius,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            >
              <View
                style={[
                  styles.triangle,
                  {
                    borderLeftWidth: segmentBaseWidth / 2,
                    borderRightWidth: segmentBaseWidth / 2,
                    borderBottomWidth: radius,
                    borderBottomColor: seg.color,
                    transform: [{ translateX: -segmentBaseWidth / 2 }],
                  },
                ]}
              />
            </View>
          );
        })}
        {/* Slice separators */}
        {segments.map((_, i) => {
          const angle = i * segmentAngle;
          return (
            <View
              key={`sep-${i}`}
              style={[
                styles.separator,
                {
                  left: radius,
                  top: radius,
                  transform: [
                    { rotate: `${angle}deg` },
                    { translateY: -radius },
                  ],
                  height: radius,
                },
              ]}
            />
          );
        })}
        {segments.map((seg, i) => {
          const midAngle = i * segmentAngle + segmentAngle / 2;
          const labelRadius = radius * 0.7;
          return (
            <View
              key={`label-${i}`}
              style={[
                styles.labelContainer,
                {
                  left: radius,
                  top: radius,
                  transform: [
                    { rotate: `${midAngle}deg` },
                    { translateY: -labelRadius },
                  ],
                },
              ]}
            >
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.labelText,
                  {
                    transform: [
                      { rotate: `${-midAngle}deg` },
                      {
                        rotate: rotation.interpolate({
                          inputRange: [0, 360],
                          outputRange: ['0deg', '-360deg'],
                        }) as unknown as string,
                      },
                    ],
                  },
                ]}
              >
                {seg.label}
              </Animated.Text>
            </View>
          );
        })}
        {/* Selected slice highlight overlay */}
        {selectedIndex !== null && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slice,
              {
                left: radius,
                top: radius,
                transform: [{ rotate: `${selectedIndex * segmentAngle}deg` }],
              },
            ]}
          >
            <Animated.View
              style={{
                width: 0,
                height: 0,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderLeftWidth: segmentBaseWidth / 2,
                borderRightWidth: segmentBaseWidth / 2,
                borderBottomWidth: radius,
                borderBottomColor: 'rgba(255,255,255,0.22)',
                transform: [{ translateX: -segmentBaseWidth / 2 }],
                opacity: highlightPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.75],
                }) as unknown as number,
              }}
            />
          </Animated.View>
        )}
      </Animated.View>

      <Pressable
        onPress={handleSpin}
        disabled={isSpinning || !!disabled}
        style={[
          styles.hub,
          {
            width: hubSize,
            height: hubSize,
            left: radius - hubSize / 2,
            top: radius - hubSize / 2,
            opacity: isSpinning || disabled ? 0.7 : 1,
          },
        ]}
      >
        <Text style={styles.hubText}>
          {isSpinning ? 'Spinning' : 'Tap to Spin'}
        </Text>
      </Pressable>

      <View
        pointerEvents="none"
        style={[styles.pointerContainer, { width: size, height: size }]}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: radius - 12,
            top: -2,
            transform: [
              {
                rotate: pointerWiggle.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-8deg'],
                }) as unknown as string,
              },
            ],
          }}
        >
          <View
            style={[
              styles.pointer,
              {
                borderLeftWidth: 12,
                borderRightWidth: 12,
                borderTopWidth: 18,
              },
            ]}
          />
        </Animated.View>
        <View
          style={{
            position: 'absolute',
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#1f2937',
            borderWidth: 2,
            borderColor: '#111827',
            left: radius - 10,
            top: 10,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        />
      </View>

      {/* Confetti overlay */}
      {confetti.length > 0 && (
        <View
          pointerEvents="none"
          style={[styles.confettiLayer, { width: size, height: size }]}
        >
          {confetti.map(p => (
            <Animated.View
              key={p.id}
              style={{
                position: 'absolute',
                left: p.left,
                transform: [
                  { translateY: p.translateY },
                  {
                    rotate: p.rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        '0deg',
                        `${Math.random() > 0.5 ? '' : '-'}540deg`,
                      ],
                    }) as unknown as string,
                  },
                ],
              }}
            >
              <View
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: 2,
                }}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
};

export default RewardWheelSpinner;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  separator: {
    position: 'absolute',
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  slice: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#eee',
    borderStyle: 'solid',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'transparent',
  },
  hub: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hubText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 12,
  },
  pointerContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  confettiLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  pointer: {
    position: 'absolute',
    top: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#333',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
