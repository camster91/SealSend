import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Calendar from 'expo-calendar/legacy';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, usePathname, useGlobalSearchParams } from 'expo-router';
import { Api, ApiError, apiOrigin } from './api';
import { clearLocalIdentity } from './sign-out';
import { drafts } from './pending-draft';
import { draftForHost, type DraftBody, type PendingDraft } from './draft-store';
import { readSession, saveSession } from './session';
import { checkInBody, eventTime, invitationLink, qrToken, type Attendee, type Deletion, type Event, type Host, type Session } from './model';
import { Welcome } from './welcome';
import { Button, Field, Heading, Notice, styles, colors } from './ui';

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
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
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
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 7 * 86400000));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const clearHostView = useCallback(() => {
    api.session = null;
    setHost(null); setEvents([]); setAttendees([]); setSelected(null); setPendingDraft(null);
    setEmail(''); setCodeSent(false); setCode(''); setTitle(''); setDescription(''); setLocation('');
    setFilter(''); setDeletion(null); setUncertainCreate(false); setNeedsGuestRefresh(false); setPicker(null); setScan(false);
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setNotice('');
    try { await action(); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostView(); setScreen('login');
        await saveSession(null).catch(() => {});
      }
      setNotice(error instanceof Error ? error.message : 'Please try again.');
    } finally { locked.current = false; setBusy(false); }
  }, [clearHostView, setScreen]);
  const loadEvents = useCallback(async () => { setEvents(await api.request<Event[]>('events')); }, []);
  const restore = useCallback(async () => {
    try {
      const session = await readSession();
      if (!session) return;
      api.session = session;
      const result = await api.request<{ user: Host }>('me');
      setHost(result.user); const pending = await drafts.read(); setPendingDraft(draftForHost(pending, result.user.id)); await loadEvents(); setScreen('events');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { clearHostView(); await saveSession(null); }
      setNotice(error instanceof Error ? error.message : 'Could not restore sign-in.');
    } finally { setBooting(false); }
  }, [clearHostView, loadEvents, setScreen]);
  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => { const safe = typeof linkParams.invite === 'string' ? invitationLink(linkParams.invite) : null; if (safe) { setInvite(safe); setNotice('Your invitation is ready to open. Guests do not need an account.'); } }, [linkParams.invite]);
  useEffect(() => { if (!booting && !host && !['welcome', 'login'].includes(screen)) setScreen('welcome'); }, [booting, host, screen, setScreen]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (scan) { setScan(false); return true; }
      if (screen === 'welcome' || screen === 'events') return false;
      if (screen === 'create' || screen === 'edit') { Alert.alert('Leave these changes?', 'Your changes have not been saved. Stay here to save them.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => { setScreen(host ? 'events' : 'welcome'); setNotice(''); } }]); } else { setScreen(host ? 'events' : 'welcome'); setNotice(''); } return true;
    });
    return () => back.remove();
  }, [host, screen, scan, setScreen]);
  useEffect(() => {
    const receive = (url: string | null) => {
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
  async function openEvent(event: Event) { setSelected(await api.request<Event>(`events/${event.id}`)); setScreen('event'); }
  async function refreshGuests() { if (selected) { setAttendees(await api.request<Attendee[]>(`events/${selected.id}/check-in`)); setNeedsGuestRefresh(false); } }
  async function mark(guest: Attendee) {
    if (!selected) return;
    let updated: Attendee;
    try { updated = await api.request<Attendee>(`events/${selected.id}/check-in`, 'PATCH', checkInBody(guest)); } catch (error) { setNeedsGuestRefresh(true); throw error; }
    setAttendees(rows => rows.map(g => g.id === updated.id && g.source === updated.source ? updated : g));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  const go = (value: Screen) => { setScreen(value); setNotice(''); setScan(false); };
  const leave = () => { if (screen === 'create' || screen === 'edit') { Alert.alert('Leave these changes?', 'Your changes have not been saved.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => go(host ? 'events' : 'welcome') }]); } else go(host ? 'events' : 'welcome'); };
  async function signOut() {
    let revoked = false;
    try { await api.request('session', 'DELETE'); revoked = true; } catch { /* Local sign-out still works offline. */ }
    const local = await clearLocalIdentity(() => drafts.clear(), () => saveSession(null), () => {
      clearHostView(); go('welcome');
    });
    if (!local.credentialsCleared || !local.draftCleared) setNotice('The view is signed out, but device storage could not be fully cleared. Unlock your device and retry cleanup before sharing it.');
    else if (!revoked) setNotice('Signed out on this device. Server revocation could not be confirmed; the session expires automatically within seven days.');
  }
  return { pendingDraft, setPendingDraft, setHost, setNotice, setEvents, setAttendees, screen, host, busy, notice, booting, email, setEmail, code, setCode, codeSent, setCodeSent, events, selected, setSelected, attendees, filter, setFilter, scan, setScan, cameraPermission, requestCameraPermission, invite, setInvite, deletion, setDeletion, uncertainCreate, setUncertainCreate, title, setTitle, description, setDescription, location, setLocation, date, setDate, picker, setPicker, timezone, run, loadEvents, openEvent, refreshGuests, mark, go, leave, signOut, needsGuestRefresh, setNeedsGuestRefresh };
}
const HostContext = createContext<ReturnType<typeof useHostState> | null>(null);
export function HostProvider({ children }: { children: React.ReactNode }) {
  const state = useHostState();
  return <HostContext.Provider value={state}>{children}</HostContext.Provider>;
}
export function HostScreen() {
  const state = useContext(HostContext);
  if (!state) throw new Error('HostProvider missing');
  const { pendingDraft, setPendingDraft, setHost, setNotice, screen, host, busy, notice, booting, email, setEmail, code, setCode, codeSent, setCodeSent, events, selected, setSelected, attendees, filter, setFilter, scan, setScan, cameraPermission, requestCameraPermission, invite, setInvite, deletion, setDeletion, uncertainCreate, setUncertainCreate, title, setTitle, description, setDescription, location, setLocation, date, setDate, picker, setPicker, timezone, run, loadEvents, openEvent, refreshGuests, mark, go, leave, signOut, needsGuestRefresh, setNeedsGuestRefresh } = state;
  if (booting) return <View style={[styles.content, { marginTop: 100 }]}><ActivityIndicator size="large" accessibilityLabel="Restoring your session" /><Text style={styles.body}>Getting things ready…</Text></View>;
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={screen === 'events' ? <RefreshControl refreshing={busy} onRefresh={() => void run(loadEvents)} /> : undefined}>
      <View style={styles.row}><Text style={{ color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -1 }}>SealSend<Text style={{ color: colors.accent }}>●</Text></Text>{screen !== 'welcome' && <Button label={host ? 'My events' : 'Back'} secondary disabled={busy} onPress={leave} />}</View>
      {notice && <Notice message={notice} />}
      {busy && <ActivityIndicator accessibilityLabel="Working" color={colors.ink} />}
      {screen === 'welcome' && <Welcome busy={busy} invite={invite} setInvite={setInvite} host={() => go('login')} openInvite={() => void run(async () => { const link = invitationLink(invite); if (!link) throw new Error('Paste a valid https://sealsend.app/e/ invitation link.'); await Linking.openURL(link); })}>
        {notice.includes('device storage could not be fully cleared') && <Button label="Retry device cleanup" secondary disabled={busy} onPress={() => void run(async () => { await Promise.all([drafts.clear(), saveSession(null)]); setNotice('Device storage cleared.'); })} />}
        {api.session && <Button label="Retry restoring sign-in" secondary disabled={busy} onPress={() => void run(async () => { const me = await api.request<{ user: Host }>('me'); setHost(me.user); await loadEvents(); go('events'); })} />}
      </Welcome>}
      {screen === 'login' && <>
        <Heading title="Welcome, host." subtitle="Use your email to sign in or create a host account. Your guests won’t need one." />
        <Field label="Email address" value={email} onChangeText={value => { setEmail(value); setCodeSent(false); setCode(''); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!busy} />
        {!codeSent ? <Button label="Send sign-in code" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onPress={() => void run(async () => { await api.request('auth/code', 'POST', { method: 'email', email: email.trim() }); setCodeSent(true); setNotice('Check your email for the six-digit code. It expires in 15 minutes.'); })} /> : <><Field label="Six-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /><Button label="Continue" disabled={busy || !/^\d{6}$/.test(code)} onPress={() => void run(async () => { const session = await api.request<Session>('auth/verify', 'POST', { method: 'email', email: email.trim(), code }); await saveSession(session); api.session = session; setHost(session.user); const pending = await drafts.read(); setPendingDraft(draftForHost(pending, session.user.id)); setCode(''); await loadEvents(); go('events'); })} /><Button label="Send another code" secondary disabled={busy} onPress={() => void run(async () => { await api.request('auth/code', 'POST', { method: 'email', email: email.trim() }); setCode(''); setNotice('A new code was sent. Use the latest email.'); })} /></>}
        <Text style={styles.body}>Continuing means you agree to SealSend’s Terms and Privacy Policy.</Text><Button label="Read terms" quiet onPress={() => void Linking.openURL('https://sealsend.app/terms').catch(() => setNotice('Unable to open terms.'))} /><Button label="Read privacy policy" quiet onPress={() => void Linking.openURL('https://sealsend.app/privacy').catch(() => setNotice('Unable to open privacy policy.'))} />
      </>}
      {screen === 'events' && <>
        <Heading title="Your gatherings" subtitle="A little less organizing. A lot more showing up." />{pendingDraft && <Notice message="A draft save was not confirmed. Recover it safely before starting another event." />}
        <Button label={pendingDraft ? 'Recover original draft' : 'Create an event'} disabled={busy} onPress={() => { setTitle(pendingDraft?.body.title || ''); setDescription(pendingDraft?.body.description || ''); setLocation(pendingDraft?.body.location_name || ''); setDate(pendingDraft ? new Date(pendingDraft.body.event_date) : new Date(Date.now() + 7 * 86400000)); setUncertainCreate(false); go('create'); }} />
        {events.length === 0 && <View style={styles.card}><Heading title="Bring people together." subtitle="Your first invitation starts here. Create a draft before you share anything." /></View>}
        {events.map(event => <View key={event.id} style={styles.card}><View style={styles.tag}><Text style={styles.tagText}>{event.status === 'published' ? 'Ready to share' : event.status === 'archived' ? 'Archived' : 'Draft · just for you'}</Text></View><Text accessibilityRole="header" style={[styles.title, { fontSize: 25 }]}>{event.title}</Text><Text style={styles.body}>{eventTime(event)}{'\n'}{event.location_name || 'Location to be decided'}</Text><Button label={`Manage ${event.title}`} secondary disabled={busy} onPress={() => void run(() => openEvent(event))} /></View>)}
        <Button label="Account and privacy" secondary disabled={busy} onPress={() => void run(async () => { const result = await api.request<{ request: Deletion | null }>('account/deletion'); setDeletion(result.request); go('account'); })} />
      </>}
      {(screen === 'create' || screen === 'edit') && <>
        <Heading title={screen === 'edit' ? 'Fine-tune your plan.' : 'Make a good plan.'} subtitle="Saving changes doesn’t notify anyone automatically." />
        <Field label="Event name" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
        <Field label="What’s the occasion?" value={description} onChangeText={setDescription} maxLength={2000} multiline editable={!busy} />
        <Field label="Where is it happening?" value={location} onChangeText={setLocation} maxLength={200} editable={!busy} />
        <Text style={styles.label}>When · device time ({timezone})</Text><Text style={styles.body}>{date.toLocaleString()}</Text>{screen === 'edit' && selected?.event_timezone !== timezone && <Notice message={`You are choosing time in your device timezone. The invitation keeps ${selected?.event_timezone} and displays the equivalent time.`} />}
        <Button label="Choose date" secondary disabled={busy} onPress={() => setPicker('date')} /><Button label="Choose time" secondary disabled={busy} onPress={() => setPicker('time')} />
        {picker && Platform.OS !== 'web' && <DateTimePicker value={date} timeZoneName={timezone} mode={picker} onChange={(_event, value) => { setPicker(null); if (value) setDate(value); }} />}
        {picker && Platform.OS === 'web' && <Notice message="Native date and time picking is available in the iOS and Android builds." />}
        {uncertainCreate && screen === 'create' && <Notice message="The connection ended before saving was confirmed. Retry the original draft safely, or check My events. Its saved key prevents a duplicate even after restarting the app." />}
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
          if (!editing) { try { await drafts.clear(); setPendingDraft(null); } catch { setNotice('Saved. The device recovery record could not be cleared; retrying it remains safe.'); } }
          try { await loadEvents(); } catch { setNotice('Saved. The event list could not refresh; pull to refresh it later.'); }
        })} />
        {uncertainCreate && screen === 'create' && pendingDraft && <Button label="Retry original draft safely" secondary disabled={busy} onPress={() => { setTitle(pendingDraft.body.title); setDescription(pendingDraft.body.description); setLocation(pendingDraft.body.location_name); setDate(new Date(pendingDraft.body.event_date)); setUncertainCreate(false); setNotice('Original draft restored. Save draft reuses its key and cannot create another copy.'); }} />}
        {uncertainCreate && screen === 'create' && <Button label="Check saved events" secondary disabled={busy} onPress={() => void run(async () => { await loadEvents(); setUncertainCreate(false); go('events'); })} />}
      </>}
      {screen === 'event' && selected && <>
        <Heading title={selected.title} subtitle={`${eventTime(selected)}\n${selected.location_name || 'Location to be decided'}`} /><View style={styles.tag}><Text style={styles.tagText}>{selected.status === 'published' ? 'Ready to share' : selected.status === 'archived' ? 'Archived' : 'Draft · just for you'}</Text></View><Text style={styles.body}>{selected.description}</Text>
        {selected.status === 'draft' && <Button label="Publish invitation" disabled={busy} onPress={() => void run(async () => { const event = await api.request<Event>(`events/${selected.id}`, 'PATCH', { status: 'published' }); setSelected(event); await loadEvents(); setNotice('Published. You can now share the link; no invitations were sent automatically.'); })} />}
        {selected.status === 'published' && <Button label="Share invitation" disabled={busy} onPress={() => void run(async () => { const url = `https://sealsend.app/e/${selected.slug}`; await Share.share({ title: selected.title, message: `${selected.title}\n${url}`, ...(Platform.OS === 'ios' ? { url } : {}) }); })} />}
        {selected.status !== 'archived' && <Button label="Edit event" secondary disabled={busy} onPress={() => { setTitle(selected.title); setDescription(selected.description || ''); setLocation(selected.location_name || ''); setDate(selected.event_date ? new Date(selected.event_date) : new Date(Date.now() + 7 * 86400000)); go('edit'); }} />}

        <Button label="Guest list and check-in" secondary disabled={busy} onPress={() => void run(async () => { await refreshGuests(); go('check-in'); })} />
        {selected.event_date && (Platform.OS !== 'ios' || Number(Platform.Version) >= 17) && <Button label="Add to my calendar" secondary disabled={busy} onPress={() => void run(async () => { if (Platform.OS === 'web') throw new Error('Calendar integration is available in the native builds.'); const start = new Date(selected.event_date!); await Calendar.createEventInCalendarAsync({ title: selected.title, startDate: start, endDate: selected.event_end_date ? new Date(selected.event_end_date) : new Date(start.getTime() + 2 * 3600000), location: selected.location_name ?? '', timeZone: selected.event_timezone }); })} />}
        {selected.status !== 'archived' && <Button label="Archive event" secondary disabled={busy} onPress={() => Alert.alert('Archive this event?', 'The invitation will close to new replies. You can create a new event afterwards. Archiving cannot be undone.', [{ text: 'Keep event', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void run(async () => { setSelected(await api.request<Event>(`events/${selected.id}`, 'PATCH', { status: 'archived' })); await loadEvents(); setNotice('Archived. You can now create your next gathering.'); }) }])} />}
      </>}
      {screen === 'check-in' && selected && <>
        <Heading title="Hello, everyone." subtitle={`${attendees.filter(a => a.checked_in_at).reduce((n, a) => n + a.headcount, 0)} people checked in. Refresh before making arrival decisions.`} />
        {needsGuestRefresh && <Notice message="A check-in could not be confirmed. Refresh the guest list before changing another arrival." />}
        <Field label="Find a guest" value={filter} onChangeText={setFilter} autoCorrect={false} /><Button label="Refresh guest list" secondary disabled={busy} onPress={() => void run(refreshGuests)} />
        <Button label={scan ? 'Close scanner' : 'Scan guest QR'} secondary disabled={busy || needsGuestRefresh} onPress={() => { if (Platform.OS === 'web') { setNotice('Camera check-in is available in the native builds. Use guest search here.'); return; } setScan(!scan); }} />
        {scan && !cameraPermission?.granted && <View style={styles.card}><Text style={styles.body}>Camera access is optional and used only while scanning a guest’s personal QR. You can always search by name.</Text><Button label="Allow camera for scanning" onPress={() => void run(async () => { const permission = await requestCameraPermission(); if (!permission.granted) { setNotice('Camera access is off. Use guest search or enable access in device Settings.'); setScan(false); } })} /></View>}
        {scan && cameraPermission?.granted && <CameraView style={{ height: 250, borderRadius: 24 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { if (busy) return; setScan(false); void run(async () => { const token = qrToken(data, selected.slug); if (!token) throw new Error('This isn’t a personal guest QR for this event. Use guest search.'); try { await api.request(`events/${selected.id}/check-in`, 'PATCH', { inviteToken: token, checkedIn: true }); } catch (error) { setNeedsGuestRefresh(true); throw error; }
          setNeedsGuestRefresh(true); try { await refreshGuests(); setNotice('Guest checked in.'); } catch { setNotice('Check-in was saved. Refresh the list before continuing.'); } }); }} />}
        {attendees.filter(a => a.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(guest => <View key={`${guest.source}-${guest.id}`} style={styles.card}><Text style={styles.label}>{guest.name}</Text><Text style={styles.body}>{guest.rsvp_status} · {guest.headcount} {guest.headcount === 1 ? 'person' : 'people'}{guest.checked_in_at ? ' · checked in' : ''}</Text><Button label={guest.checked_in_at ? `Undo check-in for ${guest.name}` : `Check in ${guest.name}`} secondary disabled={busy || needsGuestRefresh} onPress={() => void run(() => mark(guest))} /></View>)}
        {attendees.length > 0 && !attendees.some(a => a.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) && <Notice message="No matching guests. Try a different name." />}
        {!attendees.length && <Notice message="No guests or RSVP responses yet. Share your published invitation to collect replies." />}
        <Text style={styles.body}>Check-in needs a connection. Changes are confirmed by the server; no guest list is stored offline.</Text>
      </>}
      {screen === 'account' && <>
        <Heading title="Your account" subtitle={host?.email || 'Signed in as host'} /><Text style={styles.body}>No contact-book upload. No advertising tracker. Session credentials use your device’s secure storage. This beta has no in-app purchases.</Text>
        <Button label="Privacy policy" secondary onPress={() => void Linking.openURL('https://sealsend.app/privacy').catch(() => setNotice('Unable to open privacy policy.'))} /><Button label="Get support" secondary onPress={() => void Linking.openURL('https://sealsend.app/support').catch(() => setNotice('Unable to open support.'))} />
        {deletion?.status === 'pending' ? <><Notice message={`Account deletion is scheduled for ${new Date(deletion.scheduled_for).toLocaleDateString()}. You can cancel before then.`} /><Button label="Cancel scheduled deletion" secondary disabled={busy} onPress={() => void run(async () => { const result = await api.request<{ request: Deletion }>('account/deletion', 'DELETE'); setDeletion(result.request); })} /></> : <Button label="Delete my account" secondary disabled={busy} onPress={() => Alert.alert('Schedule account deletion?', 'Your account and associated data are scheduled for deletion after seven days. You can cancel during that period.', [{ text: 'Keep account', style: 'cancel' }, { text: 'Schedule deletion', style: 'destructive', onPress: () => void run(async () => { const result = await api.request<{ request: Deletion }>('account/deletion', 'POST'); setDeletion(result.request); }) }])} />}
        <Button label="Sign out" disabled={busy} onPress={() => { if (pendingDraft) Alert.alert('Sign out with an unconfirmed draft?', 'Signing out removes the draft recovery details from this device. Check My events before starting another event when you return.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Sign out', onPress: () => void run(signOut) }]); else void run(signOut); }} />
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
