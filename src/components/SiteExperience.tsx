import { useEffect, useRef, useState } from 'react'

type Consent = { analytics: boolean }
declare global { interface Window { cbConfig?: { chatId: string } } }
const button='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50'
const publicPages=new Set(['home','services','browse-stores','store-details','browse-products','register','store-registration','login','forgot-password','info'])
async function consentRequest(data?:Consent){
  const response=await fetch('/api/public/consent',{method:data?'POST':'GET',credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Could not save your preferences.')
  return result.consent as Consent|null
}

export default function SiteExperience(){
  const [consent,setConsent]=useState<Consent|null>(null),[ready,setReady]=useState(false),[open,setOpen]=useState(false),[draft,setDraft]=useState<Consent>({analytics:false}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[chatError,setChatError]=useState(false),[retry,setRetry]=useState(0)
  const [chatEnabled,setChatEnabled]=useState(false)
  const [chatGreeting,setChatGreeting]=useState(true)
  const [route,setRoute]=useState({page:document.documentElement.dataset.sitePage||'',id:document.documentElement.dataset.sitePage?crypto.randomUUID():''})
  const analyticsAllowed=useRef(false)
  analyticsAllowed.current=consent?.analytics===true
  useEffect(()=>{
    let active=true
    consentRequest().then(value=>{if(active){setConsent(value);setDraft(value||{analytics:false});setReady(true);setOpen(!value)}}).catch(()=>{if(active){setReady(true);setOpen(true);setError('Cookie preferences could not be loaded. Analytics remains off.')}})
    const navigate=(event:Event)=>setRoute((event as CustomEvent).detail)
    const settings=()=>setOpen(true)
    window.addEventListener('site-navigation',navigate);window.addEventListener('cookie-settings',settings)
    return()=>{active=false;window.removeEventListener('site-navigation',navigate);window.removeEventListener('cookie-settings',settings)}
  },[])
  const save=async(value:Consent)=>{
    setBusy(true);setError('')
    try{
      const saved=await consentRequest(value)
      setConsent(saved);setDraft(value);setOpen(false)
      if(!value.analytics)analyticsAllowed.current=false
    }catch(error){setError(error instanceof Error?error.message:'Unable to save preferences.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(!ready||!consent?.analytics||!publicPages.has(route.page)||!route.id)return
    let source='Direct'
    try{const referrer=new URL(document.referrer);if(referrer.hostname!==location.hostname)source=referrer.hostname}catch{}
    const width=window.innerWidth
    let seconds=0,scrollSeconds=0,depth=0,lastTick=performance.now(),lastActivity=lastTick,lastScroll=-10000,recorded=false
    const measure=()=>{depth=Math.max(depth,Math.min(100,Math.round((window.scrollY+window.innerHeight)/Math.max(window.innerHeight,document.documentElement.scrollHeight)*100)))}
    const activity=()=>{lastActivity=performance.now()}
    const scrolling=()=>{activity();lastScroll=performance.now();measure()}
    const send=()=>{
      if(!recorded||!analyticsAllowed.current)return
      void fetch('/api/public/engagement',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:route.id,seconds:Math.floor(seconds),scrollSeconds:Math.floor(Math.min(seconds,scrollSeconds)),depth}),keepalive:true}).catch(()=>{})
    }
    measure()
    void fetch('/api/public/traffic',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:route.id,page:route.page,source,device:width<768?'Mobile':width<1024?'Tablet':'Desktop'}),keepalive:true}).then(async response=>{recorded=response.ok&&(await response.json()).recorded===true}).catch(()=>{})
    const tick=window.setInterval(()=>{
      const now=performance.now(),delta=Math.min(2,(now-lastTick)/1000);lastTick=now
      if(document.visibilityState==='visible'&&now-lastActivity<30000){seconds=Math.min(3600,seconds+delta);if(now-lastScroll<1200)scrollSeconds=Math.min(seconds,scrollSeconds+delta)}
    },1000)
    const heartbeat=window.setInterval(send,15000)
    const visibility=()=>{if(document.visibilityState==='hidden')send();else{lastTick=performance.now();activity()}}
    window.addEventListener('scroll',scrolling,{passive:true});window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity)
    window.addEventListener('pagehide',send);document.addEventListener('visibilitychange',visibility)
    return()=>{send();window.clearInterval(tick);window.clearInterval(heartbeat);window.removeEventListener('scroll',scrolling);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('pagehide',send);document.removeEventListener('visibilitychange',visibility)}
  },[consent,ready,route])
  useEffect(()=>{
    if(!chatEnabled)return
    if(document.getElementById('adepa-chatbit'))return
    window.cbConfig={chatId:'7bc20488-a6cf-4ebc-b6b3-dc10788bc520'}
    const script=document.createElement('script');script.id='adepa-chatbit';script.src='https://app.chatbit.co/embed.min.js';script.defer=true
    script.onload=()=>setChatError(false)
    script.onerror=()=>{script.remove();setChatError(true)}
    document.body.appendChild(script)
  },[retry,chatEnabled])
  return <>
    {!chatEnabled&&<aside aria-label="AdepaPay assistant" className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
      {chatGreeting&&<div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-lg"><button onClick={()=>setChatEnabled(true)}>👋 Hey, ask me anything!</button><button aria-label="Dismiss chat greeting" onClick={()=>setChatGreeting(false)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white">×</button></div>}
      <button aria-label="Open AI chat" onClick={()=>setChatEnabled(true)} className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-100 bg-white shadow-lg hover:shadow-xl"><img src="/images/favicon/favicon.svg" alt="" className="h-9 w-9"/></button>
    </aside>}
    {chatError&&<div role="alert" className="fixed bottom-6 right-6 z-[90] max-w-xs rounded-xl border bg-white p-4 text-sm shadow">AI chat could not load.<button className={`${button} mt-2`} onClick={()=>{setChatError(false);setRetry(value=>value+1)}}>Retry chat</button></div>}
    {ready&&open&&publicPages.has(route.page)&&<section role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl"><h2 id="cookie-title" className="font-bold">Your cookie preferences</h2><p className="text-sm text-slate-600">Essential cookies keep sign-in and your preferences working. Optional analytics help us understand visits.</p><p className="text-xs text-slate-500">Your choice is saved for 180 days. Analytics records active time, scrolling time, scroll depth, page names, device category and referral hostname with a pseudonymous browser identifier; no account details, IP address or full URL are saved in the analytics table. Reports cover up to 90 days. You can change your choice from the Privacy Policy page.</p><fieldset disabled={busy} className="flex flex-wrap gap-5 text-sm"><label className="flex gap-2"><input type="checkbox" checked disabled/>Essential (always on)</label><label className="flex gap-2"><input type="checkbox" checked={draft.analytics} onChange={event=>setDraft({...draft,analytics:event.target.checked})}/>Traffic analytics</label></fieldset>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>void save({analytics:false})}>Decline optional</button><button className={button} disabled={busy} onClick={()=>void save(draft)}>Save choices</button><button className={`${button} bg-blue-600 text-white`} disabled={busy} onClick={()=>void save({analytics:true})}>Accept all</button>{consent&&<button className={button} disabled={busy} onClick={()=>setOpen(false)}>Close</button>}</div></section>}
  </>
}
