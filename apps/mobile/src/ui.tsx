import brandMark from '../assets/brand-mark.png';
import React from 'react';
import { Image, Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
export const colors = { ink: '#1b2a4a', accent: '#b4233c', background: '#f4f5f8', muted: '#526078', line: '#d7dce5', edge: '#8a93a6', red: '#8f1b30', sage: '#e5f0e7' };
export const fonts = { display: 'LibreCaslonDisplay_400Regular', body: 'HankenGrotesk_400Regular', medium: 'HankenGrotesk_600SemiBold' };
export function Brand() {
  return <View accessible accessibilityRole="image" accessibilityLabel="SealSend" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Image source={brandMark} style={{ width: 34, height: 34 }} />
    <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>SealSend</Text>
  </View>;
}
export function Button({ label, onPress, disabled = false, secondary = false, quiet = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, quiet && styles.quiet, { opacity: disabled ? .5 : pressed ? .75 : 1 }]}><Text style={[styles.buttonText, (secondary || quiet) && { color: colors.ink }]}>{label}</Text></Pressable>;
}
export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && { minHeight: 104, textAlignVertical: 'top' }, style]} {...props} /></View>;
}
export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={{ gap: 10 }}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{subtitle && <Text style={styles.body}>{subtitle}</Text>}</View>;
}
export function Notice({ message }: { message: string }) { return <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}><Text style={[styles.body, { color: colors.ink }]}>{message}</Text></View>; }
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 44, gap: 18, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.ink }, body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink }, input: { fontFamily: fonts.body, backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 10, padding: 14, fontSize: 17, color: colors.ink },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge }, quiet: { backgroundColor: 'transparent' }, buttonText: { fontFamily: fonts.medium, color: 'white', fontSize: 16, textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 18, gap: 10, borderWidth: 1, borderColor: colors.line }, notice: { padding: 14, borderRadius: 10, backgroundColor: '#fff3df' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.sage }, tagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  guestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 64, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: 'white' },
  pill: { fontFamily: fonts.medium, fontSize: 14, color: 'white', backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
});
