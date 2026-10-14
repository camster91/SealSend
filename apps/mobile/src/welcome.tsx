import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { invitationLink } from './model';
import { Button, colors, Field, Heading, styles } from './ui';

/** A gathering of people around one shared plan. No raster assets or extra SDKs. */
export function GatheringGraphic() {
  return <View aria-hidden={true} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={art.stage}>
    <View style={art.orbit} />
    <View style={[art.connector, { transform: [{ rotate: '-24deg' }] }]} />
    <View style={[art.connector, { transform: [{ rotate: '34deg' }] }]} />
    <View style={art.hub}><View style={art.hubDot} /><Text style={art.hubText} allowFontScaling={false}>Let’s get together</Text></View>
    <View style={[art.person, art.one]}><View style={[art.head, { backgroundColor: '#b4233c' }]} /><View style={[art.shoulders, { backgroundColor: '#b4233c' }]} /></View>
    <View style={[art.person, art.two]}><View style={[art.head, { backgroundColor: '#2b6350' }]} /><View style={[art.shoulders, { backgroundColor: '#2b6350' }]} /></View>
    <View style={[art.person, art.three]}><View style={[art.head, { backgroundColor: '#5965a0' }]} /><View style={[art.shoulders, { backgroundColor: '#5965a0' }]} /></View>
    <View style={art.spark} /><View style={art.smallSpark} />
  </View>;
}
export function Welcome({ busy, invite, setInvite, openInvite, host, children }: {
  busy: boolean; invite: string; setInvite: (value: string) => void; openInvite: () => void; host: () => void; children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [touched, setTouched] = useState(false);
  const invalid = Boolean(invite.trim()) && !invitationLink(invite);
  const showInvite = expanded || Boolean(invite);
  return <>
    <View style={welcome.hero}>
      <GatheringGraphic />
      <Heading title="Good plans. Great company." subtitle="Bring your people together. We’ll help with the invitation." />
      <Button label="Host a gathering" disabled={busy} onPress={host} />
    </View>
    <View style={welcome.promise}><View style={welcome.dot} /><Text style={welcome.promiseText}>Free host beta · 1 active event · up to 100 guests</Text></View>
    {children}
    <View style={welcome.guest}>
      {!showInvite ? <Button label="Got an invite? Open it here" secondary disabled={busy} onPress={() => setExpanded(true)} /> : <>
        <Text accessibilityRole="header" style={welcome.guestTitle}>You’re invited.</Text>
        <Text style={styles.body}>Paste your link to reply in your browser. No account needed.</Text>
        <Field label="Invitation link" value={invite} onChangeText={setInvite} onBlur={() => setTouched(true)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://sealsend.app/e/…" editable={!busy} />
        {touched && invalid && <Text accessibilityLiveRegion="polite" style={welcome.error}>Use the full SealSend invitation link, starting with https://sealsend.app/e/.</Text>}
        <Button label="Open my invitation" secondary disabled={busy || !invite.trim()} onPress={() => { if (invalid) setTouched(true); else openInvite(); }} />
        {!invite && <Button label="Close invitation entry" quiet disabled={busy} onPress={() => setExpanded(false)} />}
      </>}
    </View>
    <Text style={welcome.footer}>A little less organizing. A lot more showing up.</Text>
  </>;
}
const welcome = StyleSheet.create({
  hero: { backgroundColor: '#e9edf7', borderRadius: 30, padding: 24, gap: 24, overflow: 'hidden' },
  promise: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 6 },
  dot: { width: 7, height: 7, backgroundColor: '#2b6350', borderRadius: 4, marginTop: 7 },
  promiseText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 21 },
  guest: { gap: 14 }, guestTitle: { fontSize: 24, fontWeight: '700', color: colors.ink, letterSpacing: -.5 },
  error: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 14, lineHeight: 22, paddingHorizontal: 12 },
});
const art = StyleSheet.create({
  stage: { height: 146, width: '100%', maxWidth: 340, alignSelf: 'center' },
  orbit: { position: 'absolute', width: '78%', height: 116, top: 13, left: '11%', borderRadius: 70, borderWidth: 1, borderColor: '#cdd5e9', transform: [{ rotate: '-12deg' }] },
  connector: { position: 'absolute', width: '80%', height: 1, top: 72, left: '10%', backgroundColor: '#c0cbe3' },
  hub: { position: 'absolute', left: '17%', right: '17%', top: 53, height: 44, borderRadius: 22, backgroundColor: colors.ink, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  hubDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#efb4bc' },
  hubText: { color: 'white', fontSize: 12, fontWeight: '700' },
  person: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: '#d4dcec' },
  one: { top: 4, left: '5%', transform: [{ rotate: '-9deg' }] }, two: { top: 16, right: '4%', transform: [{ rotate: '10deg' }] }, three: { bottom: 0, left: '36%' },
  head: { width: 10, height: 10, borderRadius: 5 }, shoulders: { width: 22, height: 11, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  spark: { position: 'absolute', width: 10, height: 10, backgroundColor: '#b4233c', borderRadius: 5, bottom: 13, right: '8%' },
  smallSpark: { position: 'absolute', width: 6, height: 6, backgroundColor: '#5965a0', borderRadius: 3, top: 9, left: '51%' },
});
