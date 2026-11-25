import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, RefreshControl, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Calendar from 'expo-calendar/legacy';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, usePathname, useGlobalSearchParams } from 'expo-router';
import { Api, ApiError, apiOrigin } from './api';
import { clearLocalIdentity } from './sign-out';
import { drafts } from './pending-draft';
import { draftForHost, readHostRecovery, type DraftBody, type PendingDraft } from './draft-store';
import { readSession, saveSession } from './session';
import * as Crypto from 'expo-crypto';
import { arrivalCounts, backFrom, checkInBody, eventTime, invitationLink, nextHour, qrToken, replyTotals, rsvpLabel, sortForDoor, walkInFor, type WalkIn, type Attendee, type Deletion, type Event, type Host, type Session } from './model';
import { Welcome } from './welcome';
import { Brand, Button, Field, Heading, Notice, styles, colors, fonts } from './ui';

const api = new Api(apiOrigin(process.env.EXPO_PUBLIC_API_URL || 'https://sealsend.app', __DEV__));
type Screen = 'welcome' | 'login' | 'events' | 'create' | 'edit' | 'event' | 'check-in' | 'account';
function useHostState() {
  const pathname = usePathname();
  const linkParams = useGlobalSearchParams<{ invite?: string }>();
  const routes = ['welcome', 'login', 'events', 'create', 'edit', 'event', 'check-in', 'account'];
  const screen: Screen = routes.includes(pathname.slice(1)) ? pathname.slice(1) as Screen : 'welcome';
  const setScreen = useCallback((value: Screen) => router.replace(`/${value}`), []);
  const [host, setHost] = useState<Host | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [notice, setNotice] = useState('');
  const [cleanupNeeded, setCleanupNeeded] = useState(false);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState('');
  const [useCode, setUseCode] = useState(false);
  const walkIn = useRef<{ eventId: string; item: WalkIn } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [selected, setSelected] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [filter, setFilter] = useState('');
  const [needsGuestRefresh, setNeedsGuestRefresh] = useState(false);
  const [scan, setScan] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [invite, setInvite] = useState('');
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [storedPendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const pendingDraft = draftForHost(storedPendingDraft, host?.id);
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(nextHour(new Date(Date.now() + 7 * 86400000)));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const clearHostView = useCallback(() => {
    api.session = null;
    setRecoveryUnavailable(false); setHost(null); setEvents([]); setEventsLoaded(false); setAttendees([]); setSelected(null); setPendingDraft(null);
    setEmail(''); setPassword(''); setUseCode(false); setCodeSent(false); setCode(''); walkIn.current = null; setTitle(''); setDescription(''); setLocation('');
    setFilter(''); setDeletion(null); setUncertainCreate(false); setNeedsGuestRefresh(false); setPicker(null); setScan(false);
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setNotice('');
    try { await action(); }
    catch (error) {
      // A wrong password is also a 401; only an already-signed-in host is being signed out.
      if (error instanceof ApiError && error.status === 401 && host) {
        clearHostView(); setScreen('login');
        await saveSession(null).catch(() => {});
      }
      setNotice(error instanceof Error ? error.message : 'Please try again.');
    } finally { locked.current = false; setBusy(false); }
  }, [clearHostView, host, setScreen]);
  const loadEvents = useCallback(async () => { const saved = await api.request<Event[]>('events'); setEvents(saved); setEventsLoaded(true); }, []);
  const enterHost = useCallback(async (user: Host) => {
    setHost(user);
    const recovery = await readHostRecovery(() => drafts.read(), user.id);
    setPendingDraft(recovery.draft); setRecoveryUnavailable(recovery.unavailable); setCode(''); setPassword('');
    setScreen('events');
    await loadEvents();
  }, [loadEvents, setScreen]);
  const restore = useCallback(async () => {
    try {
      const session = await readSession();
      if (!session) return;
      api.session = session;
      const result = await api.request<{ user: Host }>('me');
      await enterHost(result.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { clearHostView(); await saveSession(null); }
      setNotice(error instanceof Error ? error.message : 'Could not restore sign-in.');
    } finally { setBooting(false); }
  }, [clearHostView, enterHost]);
  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => { const safe = typeof linkParams.invite === 'string' ? invitationLink(linkParams.invite) : null; if (safe) { setInvite(safe); setNotice('Your invitation is ready to open. Guests do not need an account.'); } }, [linkParams.invite]);
  useEffect(() => { if (!booting && !host && !['welcome', 'login'].includes(screen)) setScreen('welcome'); }, [booting, host, screen, setScreen]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (scan) { setScan(false); return true; }
      if (screen === 'welcome' || screen === 'events') return false;
      if (screen === 'create' || screen === 'edit') { Alert.alert('Leave these changes?', 'Your changes have not been saved. Stay here to save them.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => { setScreen(backFrom(screen)); setNotice(''); } }]); } else { setScreen(backFrom(screen)); setNotice(''); } return true;
    });
    return () => back.remove();
  }, [host, screen, scan, setScreen]);
  useEffect(() => {
    const receive = (url: string | null | undefined) => {
      if (!url) return;
      const safe = invitationLink(url);
      if (safe) { setInvite(safe); setNotice('Your invitation is ready to open. Guests do not need an account.'); if (!host) setScreen('welcome'); }
    };
    void Linking.getInitialURL().then(receive);
    const listener = Linking.addEventListener('url', event => receive(event.url));
    return () => listener.remove();
  }, [host, setScreen]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') setScan(false); });
    return () => sub.remove();
  }, []);
  async function openEvent(event: Event) {
    const opened = await api.request<Event>(`events/${event.id}`);
    // Reply totals come from the guest list; the event still opens if that can't load.
    const guests = await api.request<Attendee[]>(`events/${event.id}/check-in`).catch(() => null);
    setSelected(opened); setAttendees(guests ?? []); setNeedsGuestRefresh(!guests); setScreen('event');
  }
  async function refreshGuests() { if (selected) { setAttendees(await api.request<Attendee[]>(`events/${selected.id}/check-in`)); setNeedsGuestRefresh(false); } }
  async function mark(guest: Attendee) {
    if (!selected) return;
    let updated: Attendee;
    try { updated = await api.request<Attendee>(`events/${selected.id}/check-in`, 'PATCH', checkInBody(guest)); } catch (error) { await refreshGuests().catch(() => setNeedsGuestRefresh(true)); throw error; }
    setAttendees(rows => rows.map(g => g.id === updated.id && g.source === updated.source ? updated : g));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  async function addWalkIn(name: string) {
    if (!selected) return;
    const current = walkIn.current?.eventId === selected.id ? walkIn.current.item : null;
    const next = walkInFor(current, name, () => Crypto.randomUUID());
    walkIn.current = { eventId: selected.id, item: next };
    let added: Attendee;
    try {
      added = await api.request<Attendee>(`events/${selected.id}/check-in`, 'POST', next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) walkIn.current = null;
      throw error;
    }
    walkIn.current = null;
    setAttendees(rows => [...rows.filter(g => g.id !== added.id), added]); setFilter('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  const go = (value: Screen) => { setScreen(value); setNotice(''); setScan(false); };
  const leave = () => { if (screen === 'create' || screen === 'edit') { Alert.alert('Leave these changes?', 'Your changes have not been saved.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => go(backFrom(screen)) }]); } else go(backFrom(screen)); };
  async function signOut() {
    let revoked = false;
    try { await api.request('session', 'DELETE'); revoked = true; } catch { /* Local sign-out still works offline. */ }
    const local = await clearLocalIdentity(() => drafts.clear(), () => saveSession(null), () => {
      clearHostView(); go('welcome');
    });
    setCleanupNeeded(!local.credentialsCleared || !local.draftCleared);
    if (!local.credentialsCleared || !local.draftCleared) setNotice('You’re signed out, but some saved data couldn’t be cleared. Unlock your phone and try again before sharing it.');
    else if (!revoked) setNotice('Signed out on this device. We couldn’t reach the server, so this sign-in ends by itself within seven days.');
  }
  return { enterHost, eventsLoaded, cleanupNeeded, setCleanupNeeded, recoveryUnavailable, setRecoveryUnavailable, pendingDraft, setPendingDraft, setHost, setNotice, setEvents, setAttendees, screen, host, busy, notice, booting, email, setEmail, code, setCode, codeSent, setCodeSent, events, selected, setSelected, attendees, filter, setFilter, scan, setScan, cameraPermission, requestCameraPermission, invite, setInvite, deletion, setDeletion, uncertainCreate, setUncertainCreate, title, setTitle, description, setDescription, location, setLocation, date, setDate, picker, setPicker, timezone, run, loadEvents, openEvent, refreshGuests, mark, go, leave, signOut, needsGuestRefresh, setNeedsGuestRefresh, password, setPassword, useCode, setUseCode, addWalkIn };
}
const HostContext = createContext<ReturnType<typeof useHostState> | null>(null);
export function HostProvider({ children }: { children: React.ReactNode }) {
  const state = useHostState();
  return <HostContext.Provider value={state}>{children}</HostContext.Provider>;
}
export function HostScreen() {
  const state = useContext(HostContext);
  if (!state) throw new Error('HostProvider missing');
  const { enterHost, eventsLoaded, cleanupNeeded, setCleanupNeeded, recoveryUnavailable, setRecoveryUnavailable, pendingDraft, setPendingDraft, setNotice, screen, host, busy, notice, booting, email, setEmail, code, setCode, codeSent, setCodeSent, events, selected, setSelected, attendees, filter, setFilter, scan, setScan, cameraPermission, requestCameraPermission, invite, setInvite, deletion, setDeletion, uncertainCreate, setUncertainCreate, title, setTitle, description, setDescription, location, setLocation, date, setDate, picker, setPicker, timezone, run, loadEvents, openEvent, refreshGuests, mark, go, leave, signOut, needsGuestRefresh, setNeedsGuestRefresh, password, setPassword, useCode, setUseCode, addWalkIn } = state;
  const arrivals = arrivalCounts(attendees);
  const totals = replyTotals(attendees);
  const query = filter.trim().toLocaleLowerCase();
  const shown = sortForDoor(attendees).filter(a => a.name.toLocaleLowerCase().includes(query));
  const statusLabel = (status: Event['status']) => status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  if (booting) return <View style={[styles.content, { marginTop: 100 }]}><ActivityIndicator size="large" accessibilityLabel="Restoring your session" /><Text style={styles.body}>Getting things ready…</Text></View>;
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ paddingHorizontal: 20, paddingVertical: 10, gap: 10, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
      <View style={styles.row}><Brand />{screen !== 'welcome' && !(screen === 'events' && host) && <Button label="Back" secondary disabled={busy} onPress={leave} />}</View>
      {/* Outside the scrolling area, so a problem is seen wherever the host has scrolled to. */}
      {Boolean(notice) && <Notice message={notice} />}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={screen === 'events' ? <RefreshControl refreshing={busy} onRefresh={() => void run(loadEvents)} /> : undefined}>
      {busy && <ActivityIndicator accessibilityLabel="Working" color={colors.ink} />}
      {screen === 'welcome' && <Welcome busy={busy} invite={invite} setInvite={setInvite} host={() => go('login')} openInvite={() => void run(async () => { const link = invitationLink(invite); if (!link) throw new Error('Paste a valid https://sealsend.app/e/ invitation link.'); await Linking.openURL(link); })}>
        {cleanupNeeded && <Button label="Retry device cleanup" secondary disabled={busy} onPress={() => void run(async () => { await Promise.all([drafts.clear(), saveSession(null)]); setCleanupNeeded(false); setNotice('Device storage cleared.'); })} />}
        {api.session && <Button label="Retry restoring sign-in" secondary disabled={busy} onPress={() => void run(async () => { const me = await api.request<{ user: Host }>('me'); await enterHost(me.user); })} />}
      </Welcome>}
      {screen === 'login' && <>
        <Heading title="Welcome back" subtitle="Sign in to manage your events and guests." />
        <Field label="Email" value={email} onChangeText={value => { setEmail(value); setCodeSent(false); setCode(''); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!busy} />
        {!useCode ? <>
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!busy} />
          <Button label="Sign in" disabled={busy || !emailOk || !password} onPress={() => void run(async () => { const session = await api.request<Session>('auth/password', 'POST', { email: email.trim(), password }); await saveSession(session); api.session = session; await enterHost(session.user); })} />
          <Button label="Email me a code instead" quiet disabled={busy} onPress={() => { setPassword(''); setUseCode(true); }} />
        </> : <>{!codeSent ? <Button label="Send sign-in code" disabled={busy || !emailOk} onPress={() => void run(async () => { await api.request('auth/code', 'POST', { method: 'email', email: email.trim() }); setCodeSent(true); setNotice('Check your email for the six-digit code. It expires in 15 minutes.'); })} /> : <><Field label="Six-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /><Button label="Continue" disabled={busy || !/^\d{6}$/.test(code)} onPress={() => void run(async () => { const session = await api.request<Session>('auth/verify', 'POST', { method: 'email', email: email.trim(), code }); await saveSession(session); api.session = session; await enterHost(session.user); })} /><Button label="Send another code" secondary disabled={busy} onPress={() => void run(async () => { await api.request('auth/code', 'POST', { method: 'email', email: email.trim() }); setCode(''); setNotice('A new code was sent. Use the latest email.'); })} /></>}<Button label="Use a password instead" quiet disabled={busy} onPress={() => { setUseCode(false); setCodeSent(false); setCode(''); }} /></>}
        <Button label="Create an account" quiet onPress={() => void Linking.openURL('https://sealsend.app/signup').catch(() => setNotice('Unable to open sign-up.'))} />
        <Text style={styles.body}>Continuing means you agree to SealSend’s Terms and Privacy Policy.</Text><Button label="Read terms" quiet onPress={() => void Linking.openURL('https://sealsend.app/terms').catch(() => setNotice('Unable to open terms.'))} /><Button label="Read privacy policy" quiet onPress={() => void Linking.openURL('https://sealsend.app/privacy').catch(() => setNotice('Unable to open privacy policy.'))} />
      </>}
      {screen === 'events' && <>
        <Heading title="Your events" />{recoveryUnavailable && <Notice message="We can’t read the draft saved on this phone. Check your events, then clear it in Account." />}{pendingDraft && <Notice message="Your last event may not have saved. Open it before starting another." />}
        <Button label={pendingDraft ? 'Open unsaved event' : 'Create event'} disabled={busy || recoveryUnavailable || !eventsLoaded} onPress={() => { setTitle(pendingDraft?.body.title || ''); setDescription(pendingDraft?.body.description || ''); setLocation(pendingDraft?.body.location_name || ''); setDate(pendingDraft ? new Date(pendingDraft.body.event_date) : nextHour(new Date(Date.now() + 7 * 86400000))); setUncertainCreate(false); go('create'); }} />
        {eventsLoaded && events.length === 0 && <View style={styles.card}><Heading title="No events yet" subtitle="Create your first event to write the invitation and track replies." /></View>}
        {!eventsLoaded && <Button label="Try again" secondary disabled={busy} onPress={() => void run(loadEvents)} />}
        {!eventsLoaded && <Notice message="Your events haven’t loaded yet." />}
        {events.map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.title}, ${statusLabel(event.status)}, ${eventTime(event)}`} disabled={busy} onPress={() => void run(() => openEvent(event))} style={({ pressed }) => [styles.card, { opacity: pressed ? .75 : 1 }]}><View style={styles.row}><Text style={[styles.label, { fontSize: 18, flexShrink: 1 }]}>{event.title}</Text><View style={styles.tag}><Text style={styles.tagText}>{statusLabel(event.status)}</Text></View></View><Text style={styles.body}>{eventTime(event)}{'\n'}{event.location_name || 'No place yet'}</Text></Pressable>)}
        <Button label="Account" secondary disabled={busy} onPress={() => { go('account'); void api.request<{ request: Deletion | null }>('account/deletion').then(result => setDeletion(result.request)).catch(() => {}); }} />
      </>}
      {(screen === 'create' || screen === 'edit') && <>
        <Heading title={screen === 'edit' ? 'Edit event' : 'Create event'} subtitle="Saving doesn’t message anyone." />
        <Field label="Event name" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline editable={!busy} />
        <Field label="Place" value={location} onChangeText={setLocation} maxLength={200} editable={!busy} />
        <Text style={styles.label}>When</Text><Text style={styles.body}>{date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>{screen === 'edit' && selected?.event_timezone !== timezone && <Notice message={`You’re choosing a time in ${timezone}. Guests see the same moment in ${selected?.event_timezone}.`} />}
        <View style={styles.row}><View style={{ flex: 1 }}><Button label="Change date" secondary disabled={busy} onPress={() => setPicker('date')} /></View><View style={{ flex: 1 }}><Button label="Change time" secondary disabled={busy} onPress={() => setPicker('time')} /></View></View>
        {picker && Platform.OS !== 'web' && <>
          <DateTimePicker value={date} timeZoneName={timezone} mode={picker} onChange={(_event, value) => { if (Platform.OS !== 'ios') setPicker(null); if (value) setDate(value); }} />
          {Platform.OS === 'ios' && <Button label="Done" secondary onPress={() => setPicker(null)} />}
        </>}
        {picker && Platform.OS === 'web' && <Notice message="Native date and time picking is available in the iOS and Android builds." />}
        {uncertainCreate && screen === 'create' && <Notice message="We lost the connection before knowing if this saved. Trying again can’t make a second copy." />}
        <Button label={screen === 'edit' ? 'Save changes' : 'Save draft'} disabled={busy || !title.trim() || (screen === 'create' && uncertainCreate)} onPress={() => void run(async () => {
          const editing = screen === 'edit' && selected;
          let event: Event;
          try {
            const details = { title: title.trim(), description, location_name: location.trim(), event_date: date.toISOString(), event_timezone: editing ? selected!.event_timezone : pendingDraft?.body.event_timezone || timezone };
            if (editing) event = await api.request<Event>(`events/${selected!.id}`, 'PATCH', details);
            else {
              if (!host) throw new Error('Sign in before saving.');
              const draft = await drafts.prepare(host.id, { ...details, status: 'draft' } as DraftBody); setPendingDraft(draft);
              event = await api.request<Event>('events', 'POST', draft.body, draft.key);
            }
          } catch (error) {
            if (!editing) {
              if (error instanceof ApiError && [400, 403, 410].includes(error.status)) { await drafts.clear(); setPendingDraft(null); setUncertainCreate(false); }
              else setUncertainCreate(true);
            }
            throw error;
          }
          setSelected(event); setTitle(''); setDescription(''); setLocation(''); go('event');
          if (!editing) { try { await drafts.clear(); setPendingDraft(null); } catch { setNotice('Saved. A copy stayed on this phone; you can clear it in Account.'); } }
          try { await loadEvents(); } catch { setNotice('Saved. The event list could not refresh; pull to refresh it later.'); }
        })} />
        {uncertainCreate && screen === 'create' && pendingDraft && <Button label="Try again safely" secondary disabled={busy} onPress={() => { setTitle(pendingDraft.body.title); setDescription(pendingDraft.body.description); setLocation(pendingDraft.body.location_name); setDate(new Date(pendingDraft.body.event_date)); setUncertainCreate(false); setNotice('Your event is back. Saving again can’t make a second copy.'); }} />}
        {uncertainCreate && screen === 'create' && <Button label="Check saved events" secondary disabled={busy} onPress={() => void run(async () => { await loadEvents(); setUncertainCreate(false); go('events'); })} />}
      </>}
      {screen === 'event' && selected && <>
        <View style={styles.tag}><Text style={styles.tagText}>{statusLabel(selected.status)}</Text></View><Heading title={selected.title} subtitle={`${eventTime(selected)}\n${selected.location_name || 'No place yet'}`} />
        {selected.status === 'draft' && <Button label="Publish event" disabled={busy} onPress={() => void run(async () => { const event = await api.request<Event>(`events/${selected.id}`, 'PATCH', { status: 'published' }); setSelected(event); await loadEvents(); setNotice('Published. Share the link when you’re ready; nothing was sent.'); })} />}
        {selected.status === 'published' && <Button label="Share invitation" disabled={busy} onPress={() => void run(async () => { const url = `https://sealsend.app/e/${selected.slug}`; await Share.share({ title: selected.title, message: `${selected.title}\n${url}`, ...(Platform.OS === 'ios' ? { url } : {}) }); })} />}
        {selected.status !== 'archived' && <Button label="Edit" secondary disabled={busy} onPress={() => { setTitle(selected.title); setDescription(selected.description || ''); setLocation(selected.location_name || ''); setDate(selected.event_date ? new Date(selected.event_date) : nextHour(new Date(Date.now() + 7 * 86400000))); go('edit'); }} />}

        {!needsGuestRefresh && <View style={styles.card} accessible accessibilityLabel={`${totals.yes} coming, ${totals.no} can’t come, ${totals.maybe} maybe, ${totals.waiting} waiting`}><View style={styles.row}>{([['Yes', totals.yes], ['No', totals.no], ['Maybe', totals.maybe], ['Waiting', totals.waiting]] as const).map(([label, value]) => <View key={label} style={{ alignItems: 'center', minWidth: 56 }}><Text style={{ fontFamily: fonts.medium, fontSize: 26, color: colors.ink }}>{value}</Text><Text style={styles.body}>{label}</Text></View>)}</View></View>}
        <Button label="Check-in" secondary disabled={busy} onPress={() => void run(async () => { setFilter(''); await refreshGuests(); go('check-in'); })} />
        {selected.event_date && (Platform.OS !== 'ios' || parseInt(String(Platform.Version), 10) >= 17) && <Button label="Add to my calendar" secondary disabled={busy} onPress={() => void run(async () => { if (Platform.OS === 'web') throw new Error('Calendar integration is available in the native builds.'); const start = new Date(selected.event_date!); await Calendar.createEventInCalendarAsync({ title: selected.title, startDate: start, endDate: selected.event_end_date ? new Date(selected.event_end_date) : new Date(start.getTime() + 2 * 3600000), location: selected.location_name ?? '', timeZone: selected.event_timezone }); })} />}
        {selected.status !== 'archived' && <Button label="Archive event" secondary disabled={busy} onPress={() => Alert.alert('Archive this event?', 'The invitation will close to new replies. You can create a new event afterwards. Archiving cannot be undone.', [{ text: 'Keep event', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void run(async () => { setSelected(await api.request<Event>(`events/${selected.id}`, 'PATCH', { status: 'archived' })); await loadEvents(); setNotice('Archived. You can now create your next gathering.'); }) }])} />}
      </>}
      {screen === 'check-in' && selected && <>
        <Heading title="Check-in" subtitle={`${arrivals.here} here · ${arrivals.toCome} still to come`} /><Text style={styles.label}>{selected.title}</Text>
        {needsGuestRefresh && <><Notice message="We couldn’t confirm that. Refresh the list before the next arrival." /><Button label="Refresh guest list" disabled={busy} onPress={() => void run(refreshGuests)} /></>}
        <Field label="Find a guest" value={filter} onChangeText={setFilter} autoCorrect={false} />
        <Button label={scan ? 'Close scanner' : 'Scan QR'} secondary disabled={busy || needsGuestRefresh} onPress={() => { if (Platform.OS === 'web') { setNotice('Camera check-in is available in the native builds. Use guest search here.'); return; } setScan(!scan); }} />
        {scan && !cameraPermission?.granted && <View style={styles.card}><Text style={styles.body}>Camera access is optional and used only while scanning a guest’s personal QR. You can always search by name.</Text><Button label="Allow camera for scanning" onPress={() => void run(async () => { const permission = await requestCameraPermission(); if (!permission.granted) { setNotice('Camera access is off. Use guest search or enable access in device Settings.'); setScan(false); } })} /></View>}
        {scan && cameraPermission?.granted && <CameraView style={{ height: 250, borderRadius: 24 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { if (busy) return; setScan(false); void run(async () => { const token = qrToken(data, selected.slug); if (!token) throw new Error('This isn’t a personal guest QR for this event. Use guest search.'); try { await api.request(`events/${selected.id}/check-in`, 'PATCH', { inviteToken: token, checkedIn: true }); } catch (error) { setNeedsGuestRefresh(true); throw error; }
          setNeedsGuestRefresh(true); try { await refreshGuests(); setNotice('Guest checked in.'); } catch { setNotice('Check-in was saved. Refresh the list before continuing.'); } }); }} />}
        {shown.map(guest => guest.checked_in_at
          ? <View key={`${guest.source}-${guest.id}`} style={[styles.guestRow, { backgroundColor: colors.sage }]}><View style={{ flex: 1 }}><Text style={styles.label}>{guest.name}</Text><Text style={[styles.body, { color: colors.ink }]}>Checked in{guest.headcount > 1 ? ` · ${guest.headcount} people` : ''}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Undo check-in for ${guest.name}`} disabled={busy || needsGuestRefresh} onPress={() => void run(() => mark(guest))} style={[styles.button, styles.secondary]}><Text style={[styles.buttonText, { color: colors.ink }]}>Undo</Text></Pressable></View>
          : <Pressable key={`${guest.source}-${guest.id}`} accessibilityRole="button" accessibilityLabel={`Check in ${guest.name}, ${rsvpLabel(guest)}`} disabled={busy || needsGuestRefresh} onPress={() => void run(() => mark(guest))} style={({ pressed }) => [styles.guestRow, { opacity: pressed ? .75 : 1 }]}><View style={{ flex: 1 }}><Text style={styles.label}>{guest.name}</Text><Text style={styles.body}>{rsvpLabel(guest)}</Text></View><Text style={styles.pill}>Check in</Text></Pressable>)}
        {Boolean(query) && selected.status === 'published' && !attendees.some(a => a.name.trim().toLocaleLowerCase() === query) && <Button label={`Add ${filter.trim()} and check in`} secondary disabled={busy || needsGuestRefresh} onPress={() => void run(() => addWalkIn(filter))} />}
        {!attendees.length && !query && <Notice message="No guests or replies yet. Type a name to add someone at the door." />}
        <Button label="Refresh guest list" quiet disabled={busy} onPress={() => void run(refreshGuests)} />
      </>}
      {screen === 'account' && <>
        <Heading title="Account" subtitle={host?.email || 'Signed in'} />
        <Button label="Sign out" disabled={busy} onPress={() => { if (pendingDraft) Alert.alert('Sign out with an unsaved event?', 'Signing out removes the unsaved draft from this phone. Check your events when you return.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Sign out', onPress: () => void run(signOut) }]); else void run(signOut); }} />
        <Button label="Privacy policy" secondary onPress={() => void Linking.openURL('https://sealsend.app/privacy').catch(() => setNotice('Unable to open privacy policy.'))} /><Button label="Get support" secondary onPress={() => void Linking.openURL('https://sealsend.app/support').catch(() => setNotice('Unable to open support.'))} />
        {(Boolean(pendingDraft) || recoveryUnavailable) && <>
        <Button label="Clear saved draft from this phone" secondary disabled={busy} onPress={() => Alert.alert('Clear the saved draft?', 'Check your events first. This removes the unsaved draft from this phone. Events you’ve saved aren’t changed.', [{ text: 'Keep draft', style: 'cancel' }, { text: 'Clear draft', style: 'destructive', onPress: () => void run(async () => { await drafts.clear(); setPendingDraft(null); setRecoveryUnavailable(false); setUncertainCreate(false); setNotice('Draft cleared. Your events aren’t changed.'); }) }])} />
        </>}
        {deletion?.status === 'pending' ? <><Notice message={`Account deletion is scheduled for ${new Date(deletion.scheduled_for).toLocaleDateString()}. You can cancel before then.`} /><Button label="Cancel scheduled deletion" secondary disabled={busy} onPress={() => void run(async () => { const result = await api.request<{ request: Deletion }>('account/deletion', 'DELETE'); setDeletion(result.request); })} /></> : <Button label="Delete my account" secondary disabled={busy} onPress={() => Alert.alert('Schedule account deletion?', 'Your account and associated data are scheduled for deletion after seven days. You can cancel during that period.', [{ text: 'Keep account', style: 'cancel' }, { text: 'Schedule deletion', style: 'destructive', onPress: () => void run(async () => { const result = await api.request<{ request: Deletion }>('account/deletion', 'POST'); setDeletion(result.request); }) }])} />}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
