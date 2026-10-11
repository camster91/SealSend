import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
export const colors = { ink: '#1b2a4a', accent: '#b4233c', background: '#f4f5f8', muted: '#526078', line: '#d7dce5', sage: '#e5f0e7' };
export function Button({ label, onPress, disabled = false, secondary = false, quiet = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, quiet && styles.quiet, { opacity: disabled ? .5 : pressed ? .75 : 1 }]}><Text style={[styles.buttonText, (secondary || quiet) && { color: colors.ink }]}>{label}</Text></Pressable>;
}
export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && { minHeight: 104, textAlignVertical: 'top' }, style]} {...props} /></View>;
}
export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={{ gap: 10 }}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{subtitle && <Text style={styles.body}>{subtitle}</Text>}</View>;
}
export function Notice({ message }: { message: string }) { return <View accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.body}>{message}</Text></View>; }
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingBottom: 44, gap: 22, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '700', color: colors.ink, letterSpacing: -.8 }, body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink }, input: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, fontSize: 17, color: colors.ink },
  button: { minHeight: 52, padding: 16, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line }, quiet: { backgroundColor: 'transparent' }, buttonText: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.line }, notice: { padding: 16, borderRadius: 16, backgroundColor: '#fff3df' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.sage }, tagText: { fontSize: 13, fontWeight: '700', color: colors.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
});
