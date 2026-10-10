import { authRequest, type SMSVerification } from '../lib/auth'
import OTPVerification from './OTPVerification'
import { useState, useEffect, useRef } from 'react'
import { DEFAULT_PHONE_CODE, GHANA_REGIONS, formatCurrency, isValidGhanaPhoneNumber } from '../lib/localization'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  // Step 1
  firstName: string
  middleName: string
  lastName: string
  dob: string
  gender: string
  ghanaCard: string
  nationality: string
  // Step 2
  phone: string
  email: string
  region: string
  city: string
  address: string
  // Step 3
  password: string
  confirmPassword: string
  agreeTerms: boolean
  agreePrivacy: boolean
  receiveUpdates: boolean
}

type FieldErrors = Partial<Record<keyof FormData, string>>
type PageState = 'form' | 'loading' | 'success' | 'error'

const EMPTY: FormData = {
  firstName: '', middleName: '', lastName: '', dob: '', gender: '', ghanaCard: '', nationality: 'Ghana',
  phone: '', email: '', region: '', city: '', address: '',
  password: '', confirmPassword: '', agreeTerms: false, agreePrivacy: false, receiveUpdates: false,
}

const REGIONS = GHANA_REGIONS
const GENDERS = ['Male', 'Female']

const STEPS = ['Personal Info', 'Contact', 'Security', 'Review']

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: 'Weak', color: '#F04438' }
  if (score <= 2) return { level: 2, label: 'Medium', color: '#F79009' }
  return { level: 3, label: 'Strong', color: '#12B76A' }
}

// ─── Shared Input ─────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, error, type = 'text', placeholder = '', required = false,
  children, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string
  type?: string; placeholder?: string; required?: boolean; children?: React.ReactNode; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0

  return (
    <div className="relative">
      <div
        className="relative rounded-xl border transition-all duration-200"
        style={{ borderColor: error ? '#F04438' : focused ? '#0B5FFF' : '#E5E7EB', boxShadow: focused ? '0 0 0 3px rgba(11,95,255,0.1)' : 'none', background: '#fff' }}
      >
        <label
          className="absolute left-4 transition-all duration-200 pointer-events-none font-medium"
          style={{
            top: floated ? '7px' : '50%',
            transform: floated ? 'none' : 'translateY(-50%)',
            fontSize: floated ? '10px' : '14px',
            color: error ? '#F04438' : focused ? '#0B5FFF' : '#9CA3AF',
          }}
        >
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={floated ? placeholder : ''}
          className="w-full bg-transparent pt-6 pb-2.5 px-4 text-sm text-gray-900 focus:outline-none rounded-xl"
          style={{ paddingRight: children ? '48px' : '16px' }}
        />
        {children && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{children}</div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium flex items-center gap-1" style={{ color: '#F04438' }}>
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, error, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; options: string[]; required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  return (
    <div className="relative">
      <div className="relative rounded-xl border transition-all duration-200"
        style={{ borderColor: error ? '#F04438' : focused ? '#0B5FFF' : '#E5E7EB', boxShadow: focused ? '0 0 0 3px rgba(11,95,255,0.1)' : 'none', background: '#fff' }}>
        <label className="absolute left-4 transition-all duration-200 pointer-events-none font-medium"
          style={{ top: floated ? '7px' : '50%', transform: floated ? 'none' : 'translateY(-50%)', fontSize: floated ? '10px' : '14px', color: error ? '#F04438' : focused ? '#0B5FFF' : '#9CA3AF' }}>
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <select value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full bg-transparent pt-6 pb-2.5 px-4 text-sm text-gray-900 focus:outline-none rounded-xl appearance-none cursor-pointer">
          <option value=""/>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="6 9 12 15 18 9"/></svg>
      </div>
      {error && <p className="mt-1 text-xs font-medium flex items-center gap-1" style={{ color: '#F04438' }}>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
        {error}
      </p>}
    </div>
  )
}

function CheckboxField({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200"
        style={{ borderColor: checked ? '#0B5FFF' : '#D1D5DB', background: checked ? '#0B5FFF' : '#fff' }}
      >
        {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>}
      </div>
      <span className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">{children}</span>
    </label>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: done ? '#12B76A' : active ? '#0B5FFF' : '#F3F4F6',
                  color: done || active ? '#fff' : '#9CA3AF',
                  boxShadow: active ? '0 0 0 4px rgba(11,95,255,0.15)' : 'none',
                }}
              >
                {done
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>
                  : i + 1
                }
              </div>
              <span className="text-[10px] font-semibold hidden sm:block" style={{ color: active ? '#0B5FFF' : done ? '#12B76A' : '#9CA3AF' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 rounded-full transition-all duration-500" style={{ background: i < current ? '#12B76A' : '#E5E7EB' }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Personal Info ────────────────────────────────────────────────────
function Step1({ data, setData, errors }: { data: FormData; setData: (d: FormData) => void; errors: FieldErrors }) {
  const set = (k: keyof FormData) => (v: string) => setData({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First Name" value={data.firstName} onChange={set('firstName')} error={errors.firstName} required placeholder="e.g. Ama"/>
        <Field label="Middle Name" value={data.middleName} onChange={set('middleName')} placeholder="Optional"/>
      </div>
      <Field label="Last Name" value={data.lastName} onChange={set('lastName')} error={errors.lastName} required placeholder="e.g. Mensah"/>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date of Birth" value={data.dob} onChange={set('dob')} error={errors.dob} type="date" required/>
        <SelectField label="Gender" value={data.gender} onChange={set('gender')} error={errors.gender} options={GENDERS} required/>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
          <label htmlFor="signup-nationality" className="block text-[10px] font-medium text-gray-500">Nationality</label>
          <input id="signup-nationality" value="Ghana" readOnly className="w-full bg-transparent py-1 text-sm text-gray-900 outline-none" />
        </div>
        <Field label="Ghana Card Number" value={data.ghanaCard} onChange={set('ghanaCard')} placeholder="GHA-123456789-0" hint="Leave blank for now — required for hire-purchase approval"/>
      </div>
    </div>
  )
}

// ─── Step 2: Contact Info ─────────────────────────────────────────────────────
function Step2({ data, setData, errors }: { data: FormData; setData: (d: FormData) => void; errors: FieldErrors }) {
  const set = (k: keyof FormData) => (v: string) => setData({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="Mobile Number" value={data.phone} onChange={set('phone')} error={errors.phone} required type="tel" placeholder={`e.g. ${DEFAULT_PHONE_CODE} 24 123 4567`}
        hint="We will send an SMS verification code to this Ghanaian number."/>
      <Field label="Email Address" value={data.email} onChange={set('email')} error={errors.email} required type="email" placeholder="e.g. adaeze@email.com"/>
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField label="Region" value={data.region} onChange={set('region')} error={errors.region} options={REGIONS} required/>
        <Field label="City or Town" value={data.city} onChange={set('city')} error={errors.city} required placeholder="e.g. East Legon"/>
      </div>
      <Field label="Residential Address" value={data.address} onChange={set('address')} error={errors.address} required placeholder="e.g. 14 Liberation Road, Airport Residential Area"/>
    </div>
  )
}

// ─── Step 3: Security ─────────────────────────────────────────────────────────
function Step3({ data, setData, errors }: { data: FormData; setData: (d: FormData) => void; errors: FieldErrors }) {
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const strength = getStrength(data.password)

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
      {show
        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      }
    </button>
  )

  return (
    <div className="space-y-4">
      <Field label="Password" value={data.password} onChange={v => setData({ ...data, password: v })} error={errors.password} required
        type={showPw ? 'text' : 'password'} placeholder="At least 8 characters"
        hint="Use uppercase, numbers and symbols for a stronger password">
        <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)}/>
      </Field>

      {/* Password strength meter */}
      {data.password && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            {[1,2,3].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{ background: i <= strength.level ? strength.color : '#E5E7EB' }}/>
            ))}
          </div>
          <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label} password</p>
        </div>
      )}

      <Field label="Confirm Password" value={data.confirmPassword} onChange={v => setData({ ...data, confirmPassword: v })} error={errors.confirmPassword} required
        type={showCpw ? 'text' : 'password'} placeholder="Re-enter your password">
        <EyeBtn show={showCpw} toggle={() => setShowCpw(!showCpw)}/>
      </Field>

      <div className="space-y-3 pt-2 p-4 rounded-2xl" style={{ background: '#F8FAFC' }}>
        <CheckboxField checked={data.agreeTerms} onChange={v => setData({ ...data, agreeTerms: v })}>
          I agree to AdepaPay's{' '}
          <a href="#" className="font-semibold hover:underline" style={{ color: '#0B5FFF' }}>Terms and Conditions</a>
          <span className="text-red-400 ml-0.5">*</span>
        </CheckboxField>
        {errors.agreeTerms && <p className="text-xs font-medium" style={{ color: '#F04438' }}>You must accept the Terms to continue</p>}

        <CheckboxField checked={data.agreePrivacy} onChange={v => setData({ ...data, agreePrivacy: v })}>
          I agree to AdepaPay's{' '}
          <a href="#" className="font-semibold hover:underline" style={{ color: '#0B5FFF' }}>Privacy Policy</a>
          <span className="text-red-400 ml-0.5">*</span>
        </CheckboxField>
        {errors.agreePrivacy && <p className="text-xs font-medium" style={{ color: '#F04438' }}>You must accept the Privacy Policy to continue</p>}

        <CheckboxField checked={data.receiveUpdates} onChange={v => setData({ ...data, receiveUpdates: v })}>
          Receive product updates, offers and news from AdepaPay <span className="text-gray-400 text-xs">(Optional)</span>
        </CheckboxField>
      </div>
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────
function Step4({ data, onEdit }: { data: FormData; onEdit: (step: number) => void }) {
  const ReviewCard = ({ title, step, rows }: { title: string; step: number; rows: { label: string; value: string }[] }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
        <button onClick={() => onEdit(step)} className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#0B5FFF' }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Edit
        </button>
      </div>
      <div className="px-5 py-3 divide-y divide-gray-50">
        {rows.filter(r => r.value).map(r => (
          <div key={r.label} className="flex justify-between py-2.5 gap-4">
            <span className="text-xs text-gray-400 font-medium flex-shrink-0">{r.label}</span>
            <span className="text-xs text-gray-900 font-semibold text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: '#EAF2FF', color: '#0B5FFF' }}>
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span className="font-medium">Review your information before submitting. Click <strong>Edit</strong> on any section to make changes.</span>
      </div>

      <ReviewCard title="Personal Information" step={0} rows={[
        { label: 'Full Name', value: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ') },
        { label: 'Date of Birth', value: data.dob },
        { label: 'Gender', value: data.gender },
        { label: 'Nationality', value: data.nationality },
        { label: 'ID Number', value: data.ghanaCard || '—' },
      ]}/>

      <ReviewCard title="Contact Information" step={1} rows={[
        { label: 'Mobile', value: data.phone },
        { label: 'Email', value: data.email },
        { label: 'State', value: data.region },
        { label: 'City', value: data.city },
        { label: 'Address', value: data.address },
      ]}/>

      <ReviewCard title="Security" step={2} rows={[
        { label: 'Password', value: '••••••••' },
      ]}/>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Agreements</h3>
        <div className="space-y-2">
          {[
            { label: 'Terms & Conditions', agreed: data.agreeTerms },
            { label: 'Privacy Policy', agreed: data.agreePrivacy },
            { label: 'Marketing Updates', agreed: data.receiveUpdates },
          ].map(a => (
            <div key={a.label} className="flex items-center gap-2 text-sm">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${a.agreed ? '' : ''}`}
                style={{ background: a.agreed ? '#12B76A' : '#F3F4F6' }}>
                {a.agreed
                  ? <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>
                  : <svg className="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>
                }
              </div>
              <span className={a.agreed ? 'text-gray-700' : 'text-gray-400'}>{a.label}</span>
              <span className="text-xs ml-auto" style={{ color: a.agreed ? '#12B76A' : '#9CA3AF' }}>
                {a.agreed ? 'Agreed' : 'Declined'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <div className="flex flex-col gap-6">
      {/* Illustration */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B5FFF 0%, #1E3A8A 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}/>
        <div className="p-8 relative z-10">
          {/* Phone mockup SVG */}
          <div className="mx-auto w-40 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4 border border-white/20">
              <div className="bg-white rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#0B5FFF' }}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1"/></svg>
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#0B5FFF' }}>AdepaPay</span>
                </div>
                <div className="rounded-xl p-2.5 mb-2 text-white text-xs" style={{ background: 'linear-gradient(135deg,#0B5FFF,#1E3A8A)' }}>
                  <div className="opacity-70 text-[9px] mb-0.5">Available Credit</div>
                  <div className="font-bold text-base">{formatCurrency(500000)}</div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: 'iPhone 15 Pro', price: `${formatCurrency(50667)}/mo`, img: 'https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=32&h=32&fit=crop&auto=format' },
                    { name: 'MacBook Pro', price: `${formatCurrency(65333)}/mo`, img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=32&h=32&fit=crop&auto=format' },
                  ].map(p => (
                    <div key={p.name} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg">
                      <img src={p.img} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0"/>
                      <div>
                        <div className="text-[9px] font-semibold text-gray-800 truncate">{p.name}</div>
                        <div className="text-[9px] font-bold" style={{ color: '#12B76A' }}>{p.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-2 py-1.5 rounded-xl text-[10px] font-bold text-white" style={{ background: '#0B5FFF' }}>Apply Now</button>
              </div>
            </div>
          </div>
          <p className="text-center text-white font-semibold text-sm">Your products, your schedule.</p>
          <p className="text-center text-blue-200 text-xs mt-1">Shop smarter with AdepaPay installments.</p>
        </div>
      </div>

      {/* Trust cards */}
      {[
        { icon: '🛡️', title: 'Secure Registration', desc: 'Your information is protected with industry-standard encryption and Ghana Data Protection Act standards.' },
        { icon: '✅', title: 'Verified Marketplace', desc: 'Shop only from merchants who have passed our rigorous verification process.' },
        { icon: '💳', title: 'Flexible Payments', desc: 'Pay in affordable monthly installments that fit your income and lifestyle.' },
      ].map(t => (
        <div key={t.title} className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-2xl flex-shrink-0">{t.icon}</span>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-0.5">{t.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateStep(step: number, data: FormData): FieldErrors {
  const errs: FieldErrors = {}
  if (step === 0) {
    if (!data.firstName.trim()) errs.firstName = 'First name is required'
    if (!data.lastName.trim()) errs.lastName = 'Last name is required'
    if (!data.dob) errs.dob = 'Date of birth is required'
    if (!GENDERS.includes(data.gender)) errs.gender = 'Please select Male or Female'
  }
  if (step === 1) {
    if (!data.phone.trim()) errs.phone = 'Mobile number is required'
    else if (!isValidGhanaPhoneNumber(data.phone)) errs.phone = 'Enter a valid Ghanaian phone number'
    if (!data.email.trim()) errs.email = 'Email address is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'Enter a valid email address'
    if (!data.region) errs.region = 'Please select your state'
    if (!data.city.trim()) errs.city = 'City is required'
    if (!data.address.trim()) errs.address = 'Residential address is required'
  }
  if (step === 2) {
    if (!data.password) errs.password = 'Password is required'
    else if (data.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!data.confirmPassword) errs.confirmPassword = 'Please confirm your password'
    else if (data.password !== data.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    if (!data.agreeTerms) errs.agreeTerms = 'required'
    if (!data.agreePrivacy) errs.agreePrivacy = 'required'
  }
  return errs
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Register({ onBack, onBrowseStores, onBrowseProducts, onLogin, onRegisterStore }: {
  onBack: () => void
  onRegisterStore: () => void
  onLogin: () => void
  onBrowseStores: () => void
  onBrowseProducts: () => void
}) {
  const [serverError, setServerError] = useState('')
  const [confirmationRequired, setConfirmationRequired] = useState(true)
  const [verification, setVerification] = useState<SMSVerification | null>(null)
  const [welcomeSent, setWelcomeSent] = useState(true)
  const [step, setStep] = useState(0)
  const [data, setData] = useState<FormData>({ ...EMPTY })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pageState, setPageState] = useState<PageState>('form')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const next = () => {
    const errs = validateStep(step, data)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(s => s + 1)
    scrollToForm()
  }

  const prev = () => { setErrors({}); setStep(s => s - 1); scrollToForm() }

  const finishRegistration = async () => {
    const { confirmPassword, ghanaCard, ...payload } = data
    const result = await authRequest('signup', payload)
    if (result.verification_required && result.verification) {
      setVerification(result.verification)
      setPageState('form')
      return
    }
    setVerification(null)
    setWelcomeSent(result.welcome_sms_sent !== false)
    setConfirmationRequired(Boolean(result.confirmation_required))
    setData(current => ({ ...current, password: '', confirmPassword: '' }))
    setPageState('success')
  }
  const submit = async () => {
    if (pageState === 'loading') return
    for (let index = 0; index < 3; index++) {
      const errs = validateStep(index, data)
      if (Object.keys(errs).length) { setErrors(errs); setStep(index); return }
    }
    setPageState('loading')
    try {
      await finishRegistration()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Unable to create your account.')
      setPageState('error')
    }
  }

  const NAV_LINKS = ['Home', 'Browse Stores', 'Browse Products', 'How It Works']
  if (verification) return <OTPVerification verification={verification} onVerified={finishRegistration} onBack={() => { setVerification(null); setPageState('form') }} />

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: '#F8FAFC' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#ECFDF3' }}>
            <svg className="w-10 h-10" style={{ color: '#12B76A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#101828' }}>Registration successful</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Welcome to AdepaPay, <strong>{data.firstName}</strong>! Your phone number is verified. {confirmationRequired ? 'Check your email for a confirmation link, then return here to sign in.' : 'Your account is ready. Sign in to start shopping.'}
          </p>
          {!welcomeSent && <p role="status" className="mb-4 text-sm text-amber-700">Registration succeeded, but the welcome SMS could not be confirmed.</p>}
          <button onClick={onLogin} className="w-full py-3.5 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-all mb-3" style={{ background: '#0B5FFF' }}>
            Continue to sign in
          </button>
          <button onClick={onBrowseProducts} className="w-full py-3 rounded-xl font-semibold text-sm border-2 hover:bg-blue-50 transition-all" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>
            Browse Products
          </button>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="login-scene relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="login-grid absolute inset-0" />
        <div className="relative z-10 w-full max-w-md rounded-[30px] border border-white/60 bg-white/95 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600"><svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.8L2.5 17.3A2 2 0 004.2 20h15.6a2 2 0 001.7-2.7L13.7 3.8a2 2 0 00-3.4 0z"/></svg></div>
          <h2 className="text-2xl font-bold text-slate-900">Unable to create account</h2><p className="mt-2 text-sm text-slate-500">{serverError}</p>
          <button onClick={() => setPageState('form')} className="mt-6 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white">Try again</button>
        </div>
      </div>
    )
  }

  const isLoading = pageState === 'loading'

  return (
    <div className="login-scene relative min-h-screen overflow-hidden px-4 py-8 font-sans">
      <div className="login-grid absolute inset-0" />
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="login-orb login-orb-three" />
      <button onClick={onBack} className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:bg-white/15 hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>Back home
      </button>
      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div ref={formRef} className="w-full max-w-2xl scroll-mt-8">
          <div className="rounded-[30px] border border-white/60 bg-white/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
            <div className="text-center">
              <button type="button" onClick={onBack}><img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="mx-auto h-16 w-auto object-contain"/></button>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Create your customer account</h1>
              <p className="mt-1 text-sm text-slate-500">A few details and you’re ready to get started.</p>
            </div>
            <button type="button" onClick={onRegisterStore} disabled={isLoading} className="mt-5 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50">Register as a store</button>
            <div className="mx-auto mt-7 max-w-xl"><Stepper current={step}/></div>
            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  {step === 0 && <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M4 21a8 8 0 0116 0"/></svg>}
                  {step === 1 && <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4zM4 7l8 6 8-6"/></svg>}
                  {step === 2 && <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>}
                  {step === 3 && <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></svg>}
                </div>
                <div><h2 className="text-lg font-bold text-slate-900">{['Personal information','Contact details','Secure your account','Review and confirm'][step]}</h2><p className="mt-0.5 text-xs text-slate-500">{['Tell us who you are.','How can we reach you?','Choose a strong password.','Check your details before submitting.'][step]}</p></div>
              </div>
              {step === 0 && <Step1 data={data} setData={setData} errors={errors}/>} 
              {step === 1 && <Step2 data={data} setData={setData} errors={errors}/>} 
              {step === 2 && <Step3 data={data} setData={setData} errors={errors}/>} 
              {step === 3 && <Step4 data={data} onEdit={setStep}/>} 
              <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={step === 0 ? onBack : prev} disabled={isLoading} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>{step === 0 ? 'Cancel' : 'Back'}</button>
                {step < 3 ? <button type="button" onClick={next} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">Continue<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button> : <button type="button" onClick={submit} disabled={isLoading} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-70">{isLoading ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Creating account…</> : 'Create account'}</button>}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/50"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V7l8-4z"/></svg>Your information is encrypted and securely stored.</div>
        </div>
      </main>
    </div>
  )

}
