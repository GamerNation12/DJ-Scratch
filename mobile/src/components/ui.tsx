import { StyleSheet, Text, View, ActivityIndicator, Pressable, Platform, type StyleProp, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#09090b',
  surface: '#18181b',
  border: 'rgba(255,255,255,0.10)',
  indigo: '#6366f1',
  indigoHover: '#4f46e5',
  fuchsia: '#d946ef',
  emerald: '#10b981',
  red: '#ef4444',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
};

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.indigo} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

export function Bubble({ text, mine, at }: { text: string; mine: boolean; at?: string }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowThem]}>
      <View style={[
        styles.bubble,
        mine ? styles.bubbleMine : styles.bubbleThem,
      ]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextThem]}>{text}</Text>
        {at && <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeThem]}>{at}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
  },
  bubbleRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowThem: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: colors.indigo,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  bubbleTextThem: {
    color: '#111827',
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.6,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.7)',
    alignSelf: 'flex-end',
  },
  bubbleTimeThem: {
    color: '#6b7280',
    alignSelf: 'flex-start',
  },
});
