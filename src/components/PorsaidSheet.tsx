import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  UserPlus,
  Clock,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  Building2,
  Hash,
  X,
} from 'lucide-react';
import type { SalesPerson } from '../lib/walkin';
import {
  type PorsaidClient,
  FRONT_DESK_ADMINS,
  DEFAULT_CONSULTANTS,
  emptyClientForm,
  loadPorsaidClients,
  savePorsaidClients,
  exportPorsaidExcel,
  createClientId,
} from '../lib/porsaidSheet';
import { cn } from '../utils/cn';
import { useToast } from './ui';

interface Props {
  account: string;
  sales: SalesPerson[];
  /** Prefill consultant when the rotation just assigned someone. */
  suggestedConsultant?: string;
}

type FormState = Omit<PorsaidClient, 'id' | 'createdAt'>;

const REQUIRED = ['clientName', 'mobile', 'propertyConsultant', 'arrivalTime', 'leavingTime'] as const;

export function PorsaidSheet({ account, sales, suggestedConsultant }: Props) {
  const toast = useToast();
  const [clients, setClients] = useState<PorsaidClient[]>(() => loadPorsaidClients(account));
  const [form, setForm] = useState<FormState>(() =>
    emptyClientForm({
      branch: account.toUpperCase() === 'RESTA' ? 'RESTA' : 'SITE',
      propertyConsultant: suggestedConsultant || DEFAULT_CONSULTANTS[0],
    }),
  );
  const [showSap, setShowSap] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<(typeof REQUIRED)[number], boolean>>>({});
  const [listOpen, setListOpen] = useState(true);

  const consultants = useMemo(() => {
    const fromSales = sales.map((s) => s.name);
    const set = new Set<string>([...DEFAULT_CONSULTANTS, ...fromSales]);
    return [...set];
  }, [sales]);

  useEffect(() => {
    savePorsaidClients(account, clients);
  }, [account, clients]);

  useEffect(() => {
    if (suggestedConsultant) {
      setForm((f) => ({ ...f, propertyConsultant: suggestedConsultant }));
    }
  }, [suggestedConsultant]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (REQUIRED.includes(key as (typeof REQUIRED)[number])) {
      setErrors((e) => ({ ...e, [key]: false }));
    }
  };

  const addExtraName = () => {
    setForm((f) => ({ ...f, extraNames: [...f.extraNames, ''] }));
  };

  const updateExtraName = (idx: number, value: string) => {
    setForm((f) => {
      const next = [...f.extraNames];
      next[idx] = value;
      return { ...f, extraNames: next };
    });
  };

  const removeExtraName = (idx: number) => {
    setForm((f) => ({ ...f, extraNames: f.extraNames.filter((_, i) => i !== idx) }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<(typeof REQUIRED)[number], boolean>> = {};
    let ok = true;
    for (const key of REQUIRED) {
      const val = String(form[key] ?? '').trim();
      if (!val) {
        next[key] = true;
        ok = false;
      }
    }
    setErrors(next);
    return ok;
  };

  const addClient = () => {
    if (!validate()) {
      toast('error', 'أكمل الحقول المطلوبة (*)');
      return;
    }
    const row: PorsaidClient = {
      id: createClientId(),
      ...form,
      clientName: form.clientName.trim(),
      mobile: form.mobile.trim(),
      extraNames: form.extraNames.map((n) => n.trim()).filter(Boolean),
      sap: form.sap.trim(),
      createdAt: new Date().toISOString(),
    };
    setClients((prev) => [...prev, row]);
    // Keep branch / consultant / admin / bump client number for next entry
    const nextNum = String((parseInt(form.clientNumber, 10) || 0) + 1);
    setForm(
      emptyClientForm({
        branch: form.branch,
        propertyConsultant: form.propertyConsultant,
        frontDeskAdmin: form.frontDeskAdmin,
        clientNumber: nextNum,
      }),
    );
    setShowSap(false);
    setErrors({});
    toast('success', `تمت إضافة ${row.clientName} إلى الملف`);
  };

  const removeClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast('info', 'تم حذف العميل من الملف');
  };

  const clearAll = () => {
    if (clients.length === 0) return;
    if (!confirm('مسح كل العملاء من الملف؟')) return;
    setClients([]);
    toast('info', 'تم تفريغ الملف');
  };

  const download = () => {
    if (clients.length === 0) {
      toast('error', 'أضف عميلاً واحداً على الأقل قبل التحميل');
      return;
    }
    exportPorsaidExcel(clients, 'Porsaid');
    toast('success', `تم تنزيل Excel (${clients.length})`);
  };

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      {/* ── Main card — matches the approved Porsaid form ── */}
      <section className="surface anim-fade-up overflow-hidden">
        <div className="brand-bar h-[3px] w-full" />

        {/* header row — Excel btn on the visual left, title+icon on the right (RTL) */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-4 pb-3.5 pt-4 sm:px-5">
          <button
            type="button"
            onClick={download}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(239,0,0,0.55)] transition',
              clients.length > 0
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-[#ff7a8a] hover:bg-brand-500',
            )}
            title="تنزيل ملف Excel بالتنسيق المعتمد"
          >
            <Download className="size-3.5" strokeWidth={2.4} />
            Excel ({clients.length})
          </button>

          <div className="flex min-w-0 flex-1 items-start justify-end gap-2.5">
            <div className="min-w-0 text-right">
              <h2 className="font-display text-[17px] font-black leading-tight text-ink-900 sm:text-[18px]">
                تقرير عملاء Porsaid
              </h2>
              <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-ink-400">
                أضف بيانات العملاء ثم نزّل ملف Excel بالتنسيق المعتمد
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <FileSpreadsheet className="size-5" strokeWidth={2.1} />
            </span>
          </div>
        </div>

        {/* form body */}
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {/* Client Name + Mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Client Name"
              required
              error={errors.clientName}
              dir="rtl"
            >
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <input
                  className={cn('field pr-10', errors.clientName && 'border-brand-500')}
                  placeholder="اسم العميل"
                  value={form.clientName}
                  onChange={(e) => set('clientName', e.target.value)}
                />
              </div>
            </Field>

            <Field label="Mobile" required error={errors.mobile} dir="ltr">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <input
                  className={cn('field pl-10 text-left', errors.mobile && 'border-brand-500')}
                  placeholder="01xxxxxxxxx"
                  inputMode="tel"
                  dir="ltr"
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                />
              </div>
            </Field>
          </div>

          {/* Extra names */}
          {form.extraNames.map((name, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="field flex-1"
                placeholder={`اسم إضافي ${idx + 1}`}
                value={name}
                onChange={(e) => updateExtraName(idx, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeExtraName(idx)}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-ink-200 text-ink-400 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                aria-label="حذف الاسم"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addExtraName}
            className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand-600 transition hover:text-brand-700"
          >
            <UserPlus className="size-3.5" strokeWidth={2.4} />
            إضافة اسم آخر
          </button>

          {/* Property consultant */}
          <Field label="Property consultant" required error={errors.propertyConsultant}>
            <div className="relative">
              <select
                className={cn(
                  'field appearance-none pr-3 pl-9 text-right',
                  errors.propertyConsultant && 'border-brand-500',
                )}
                value={form.propertyConsultant}
                onChange={(e) => set('propertyConsultant', e.target.value)}
              >
                {consultants.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            </div>
          </Field>

          {/* Arrival / Leaving */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Arrival time" required error={errors.arrivalTime} dir="ltr">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <input
                  type="time"
                  className={cn('field pl-10 text-left', errors.arrivalTime && 'border-brand-500')}
                  dir="ltr"
                  value={form.arrivalTime}
                  onChange={(e) => set('arrivalTime', e.target.value)}
                />
              </div>
            </Field>
            <Field label="Leaving time" required error={errors.leavingTime} dir="ltr">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <input
                  type="time"
                  className={cn('field pl-10 text-left', errors.leavingTime && 'border-brand-500')}
                  dir="ltr"
                  value={form.leavingTime}
                  onChange={(e) => set('leavingTime', e.target.value)}
                />
              </div>
            </Field>
          </div>

          {/* Branch · front desk · client number */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1.1fr_1fr_0.7fr]">
            <div>
              <span className="field-label">Branch</span>
              <div
                dir="ltr"
                className="flex overflow-hidden rounded-xl border border-ink-200 bg-ink-50 p-1"
              >
                {(['RESTA', 'SITE'] as const).map((b) => {
                  const active = form.branch === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => set('branch', b)}
                      className={cn(
                        'flex-1 rounded-lg py-2.5 text-[13px] font-black tracking-wide transition',
                        active
                          ? 'bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgba(239,0,0,0.55)]'
                          : 'bg-transparent text-ink-500 hover:text-ink-800',
                      )}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="front desk admin">
              <div className="relative">
                <select
                  className="field appearance-none pr-3 pl-9 text-right"
                  value={form.frontDeskAdmin}
                  onChange={(e) => set('frontDeskAdmin', e.target.value)}
                >
                  {FRONT_DESK_ADMINS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              </div>
            </Field>

            <Field label="client number" dir="ltr">
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <input
                  className="field pl-9 text-left"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.clientNumber}
                  onChange={(e) => set('clientNumber', e.target.value)}
                />
              </div>
            </Field>
          </div>

          {/* Optional SAP */}
          <div>
            <button
              type="button"
              onClick={() => setShowSap((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-400 transition hover:text-ink-600"
            >
              {showSap ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              إدخال SAP (اختياري — يترك فارغاً افتراضياً)
            </button>
            {showSap && (
              <div className="mt-2">
                <div className="relative">
                  <Building2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                  <input
                    className="field pr-10"
                    placeholder="SAP"
                    value={form.sap}
                    onChange={(e) => set('sap', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={addClient}
            className="btn btn-secondary w-full border-brand-600 py-3.5 text-[14.5px] font-extrabold text-brand-600 hover:bg-brand-50"
          >
            <Plus className="size-4" strokeWidth={2.6} />
            إضافة العميل إلى الملف
          </button>
        </div>
      </section>

      {/* ── Saved clients list ── */}
      {clients.length > 0 && (
        <section className="surface anim-fade-up overflow-hidden" style={{ animationDelay: '0.06s' }}>
          <div className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-4 py-3.5 text-right sm:px-5">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 text-right"
            >
              <span className="badge badge-red tnum">{clients.length}</span>
              <span className="text-[13px] font-extrabold text-ink-900">العملاء في الملف</span>
              {listOpen ? <ChevronUp className="size-4 text-ink-400" /> : <ChevronDown className="size-4 text-ink-400" />}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="btn btn-danger px-2.5 py-1.5 text-[11px]"
            >
              <Trash2 className="size-3" />
              مسح الكل
            </button>
          </div>

          {listOpen && (
            <ul className="max-h-[360px] divide-y divide-ink-100 overflow-y-auto">
              {[...clients].reverse().map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[14px] font-extrabold text-ink-900">{c.clientName}</p>
                      <span
                        className={cn(
                          'badge',
                          c.branch === 'SITE' ? 'badge-red' : 'badge-blue',
                        )}
                      >
                        {c.branch}
                      </span>
                      <span className="badge badge-gray tnum">#{c.clientNumber}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-400" dir="ltr">
                      {c.mobile}
                      {c.extraNames.length > 0 ? ` · +${c.extraNames.length} اسم` : ''}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-ink-500">
                      {c.propertyConsultant}
                      <span className="text-ink-300"> · </span>
                      <span dir="ltr">
                        {c.arrivalTime || '—'} → {c.leavingTime || '—'}
                      </span>
                      <span className="text-ink-300"> · </span>
                      FD: {c.frontDeskAdmin}
                      {c.sap ? (
                        <>
                          <span className="text-ink-300"> · </span>
                          SAP: {c.sap}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClient(c.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-300 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
  dir,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  children: ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <label
        dir="ltr"
        className={cn(
          'field-label flex items-center justify-end gap-1 text-right',
          error && 'text-brand-600',
        )}
      >
        {required && <span className="text-brand-600">*</span>}
        <span>{label}</span>
      </label>
      <div dir={dir}>{children}</div>
    </div>
  );
}
