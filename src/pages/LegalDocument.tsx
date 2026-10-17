import { useEffect } from 'react'
import documents from '../../content/legal-documents.json'

type Block = { type: string; text?: string; level?: number; items?: string[] }

export default function LegalDocument({slug}:{slug:'privacy'|'terms'}) {
  const document=documents[slug]
  useEffect(()=>{
    window.document.title=document.title+' | AdepaPay'
    window.dispatchEvent(new CustomEvent('site-navigation',{detail:{page:'info',id:crypto.randomUUID()}}))
  },[document])
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white px-5 py-5"><nav className="mx-auto flex max-w-4xl flex-wrap gap-5" aria-label="Main navigation"><a className="mr-auto font-bold text-blue-700" href="/">AdepaPay</a><a href="/register">Customer signup</a><a href="/store-registration">Store signup</a></nav></header>
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <h1 className="text-3xl font-bold">{document.blocks[0].text}</h1>
      <article aria-label={document.title} className="space-y-5 rounded-2xl border bg-white p-6 sm:p-8">
        {(document.blocks as Block[]).slice(1).map((block,i)=>block.type==='heading'
          ?block.level===3?<h3 key={i} className="pt-4 text-lg font-bold">{block.text}</h3>:<h2 key={i} className="pt-6 text-xl font-bold">{block.text}</h2>
          :block.type==='list'?<ul key={i} className="list-disc space-y-3 pl-6 leading-7 text-slate-700">{block.items?.map((item,j)=><li key={j} className="whitespace-pre-line">{item}</li>)}</ul>
          :<p key={i} className="whitespace-pre-line break-words leading-7 text-slate-700">{block.text}</p>)}
        <a className="inline-block border-t pt-5 font-semibold text-blue-700 underline" href={slug==='privacy'?'/terms':'/privacy'}>Read the {slug==='privacy'?'Terms and Conditions':'Privacy Policy'}</a>
      </article>
      {slug==='privacy'&&<button className="rounded-xl border bg-white px-5 py-3 font-semibold" onClick={()=>window.dispatchEvent(new Event('cookie-settings'))}>Change cookie preferences</button>}
    </main>
  </div>
}
