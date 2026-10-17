import about from '../../content/about-adepapay.json'

export default function AboutIntro(){
  return <section aria-labelledby="home-about-title" className="mx-auto my-12 max-w-7xl px-5 sm:px-8">
    <div className="grid gap-8 rounded-3xl border border-blue-100 bg-blue-50 p-7 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Get to know us</p><h2 id="home-about-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900">About AdepaPay</h2><p className="mt-3 text-sm text-slate-600">{about.subtitle}</p></div>
      <div><p className="leading-7 text-slate-700">{about.sections[0].paragraphs[0]}</p><a href="/about" className="mt-5 inline-flex items-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Discover AdepaPay <span aria-hidden="true">→</span></a></div>
    </div>
  </section>
}
