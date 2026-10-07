"use client";
import { useEffect, useState } from 'react';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome:string }> }
export function InstallButton() {
  const [prompt,setPrompt] = useState<InstallPrompt>();
  const [message,setMessage] = useState('');
  useEffect(() => {
    const show = (event:Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener('beforeinstallprompt',show);
    return () => window.removeEventListener('beforeinstallprompt',show);
  },[]);
  const install = async () => {
    if (!prompt) return;
    try { await prompt.prompt(); const choice = await prompt.userChoice; setMessage(choice.outcome === 'accepted' ? 'SealSend has been added to your device.' : 'You can install SealSend later.'); }
    catch { setMessage('Use your browser menu to add SealSend to your home screen.'); }
    finally { setPrompt(undefined); }
  };
  return <div>{prompt && <button type="button" onClick={()=>void install()} className="min-h-11 rounded-lg bg-ink px-5 py-3 font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wax">Install SealSend</button>}<p role="status" className="mt-3 text-sm">{message}</p></div>;
}
