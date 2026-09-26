import * as XLSX from 'xlsx';

/** One client row in the Porsaid walk-in Excel report. */
export interface PorsaidClient {
  id: string;
  clientName: string;
  /** Extra name lines (إضافة اسم آخر). */
  extraNames: string[];
  mobile: string;
  propertyConsultant: string;
  arrivalTime: string;
  leavingTime: string;
  branch: 'SITE' | 'RESTA';
  frontDeskAdmin: string;
  clientNumber: string;
  sap: string;
  createdAt: string;
}

export const FRONT_DESK_ADMINS = [
  'Amira',
  'Nourseen',
  'Manar',
  'Sara',
  'Mariam',
  'Nada',
  'Reem',
  'Nourhan',
] as const;

export const DEFAULT_CONSULTANTS = [
  'Nourseen',
  'Ebrahim',
  'Abdelrahman',
  'Omar',
  'Eslam',
  'Youssef Shehata',
  'Manar',
  "Mo'men",
  'Sara',
  'Mariam',
  'Zezo',
  'Fouad',
  'Nourhan',
  'Nada Katarya',
  'Reem Magdy',
  'Amira',
  'Tarek Osman',
  'Ahmed Yossry',
  'Rewaida',
] as const;

const SHEET_STORAGE_KEY = 'amer-porsaid-sheet-v1';

export function loadPorsaidClients(account: string): PorsaidClient[] {
  try {
    const raw = localStorage.getItem(`${SHEET_STORAGE_KEY}:${account.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PorsaidClient[]) : [];
  } catch {
    return [];
  }
}

export function savePorsaidClients(account: string, clients: PorsaidClient[]): void {
  try {
    localStorage.setItem(`${SHEET_STORAGE_KEY}:${account.toLowerCase()}`, JSON.stringify(clients));
  } catch {
    /* ignore quota */
  }
}

export function emptyClientForm(defaults?: {
  branch?: 'SITE' | 'RESTA';
  propertyConsultant?: string;
  frontDeskAdmin?: string;
  clientNumber?: string;
}): Omit<PorsaidClient, 'id' | 'createdAt'> {
  return {
    clientName: '',
    extraNames: [],
    mobile: '',
    propertyConsultant: defaults?.propertyConsultant || DEFAULT_CONSULTANTS[0],
    arrivalTime: '',
    leavingTime: '',
    branch: defaults?.branch || 'SITE',
    frontDeskAdmin: defaults?.frontDeskAdmin || FRONT_DESK_ADMINS[0],
    clientNumber: defaults?.clientNumber || '1',
    sap: '',
  };
}

/** Excel column headers matching the approved Porsaid walk-in template. */
const HEADERS = [
  '#',
  'Client Name',
  'Mobile',
  'Property Consultant',
  'Arrival Time',
  'Leaving Time',
  'Branch',
  'Front Desk Admin',
  'Client Number',
  'SAP',
  'Date',
] as const;

const colWidth = (wch: number) => ({ wch });

/** Build and download the approved Excel sheet for Porsaid clients. */
export function exportPorsaidExcel(clients: PorsaidClient[], fileLabel = 'Porsaid'): void {
  const wb = XLSX.utils.book_new();

  const body = clients.map((c, i) => {
    const names = [c.clientName, ...c.extraNames.filter(Boolean)].filter(Boolean).join(' / ');
    const date = c.createdAt ? c.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    return [
      i + 1,
      names,
      c.mobile,
      c.propertyConsultant,
      c.arrivalTime || '',
      c.leavingTime || '',
      c.branch,
      c.frontDeskAdmin,
      c.clientNumber,
      c.sap || '',
      date,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    ['تقرير عملاء Porsaid — Amer Group'],
    [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
    [],
    [...HEADERS],
    ...body,
  ]);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } },
  ];

  ws['!cols'] = [
    colWidth(5),
    colWidth(28),
    colWidth(16),
    colWidth(22),
    colWidth(14),
    colWidth(14),
    colWidth(10),
    colWidth(18),
    colWidth(14),
    colWidth(14),
    colWidth(14),
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Porsaid Clients');

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `تقرير-عملاء-${fileLabel}-${stamp}.xlsx`);
}

export function createClientId(): string {
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
