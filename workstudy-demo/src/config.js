// ============================================================
//  SINGLE SOURCE OF TRUTH — all business data & rules.
//
//  To change the system (operations, machines, fields, factories,
//  floors/lines, roles, workflow, calculation constants) you edit
//  CONFIG — NOT the component code.
//
//  Two ways to change it, both without touching logic/components:
//   1. Edit DEFAULTS below (rebuild), OR
//   2. Edit  public/config/config.json  at runtime (NO rebuild) —
//      it is fetched on startup and deep-merged over DEFAULTS.
//      Put only the sections you want to override in that file.
// ============================================================

// a line has a name, a shape (U/I) and a fixed machine (workstation) count
const L = (name, shape, machines) => ({ name: String(name).trim(), shape, machines })
const mk = (names, shape, machines) => names.map(n => L(n, shape, machines))
const seq = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i))

export const DEFAULTS = {
  // ---- calculation engine constants (tune without code) ----
  engine: {
    minutesPerHour: 60,         // standard working minute
    matrixMinutesPerHour: 51,   // effective minute for Skill Matrix & efficiency (85%)
    uclFactor: 1.10,            // UCL = Bpt × this
    lclFactor: 0.90,            // LCL = Bpt × this
    planEfficiency: 0.80,       // default plan efficiency
    targetBasisPct: 65,         // secondary target basis shown in OB
    workingHours: 10,           // hours/day
  },

  // NNVA (Necessary Non-Value-Added) process library — selectable when building the OB.
  // No SMV (they take time but add no standard value); they flow into layout & cycle time.
  nnvaLibrary: [
    'ASSEMBLY (FRONT & BACK PART MATCH)',
    'SINGLE FLY FUSING SPREADING',
    'BODY TURNOVER',
    'WAIST LOOP & BELT MATCH TACK TO BODY',
    'THIGH POCKET & FLAP ASSEMBLY',
    'BODY TURN OVER BEFORE INSEAM TOP STITCH',
    'BODY TURN OVER BEFORE FRONT TO BACK RISE JOIN OL',
    'BODY TURN OVER BEFORE HEM',
    'COLLAR ASSEMBLY',
    'SLEEVE & CUFF ASSEMBLY',
  ],

  // Product categories — mirror the OB Library (Excel). Loaded live from the API at runtime;
  // this list is the offline fallback.
  categories: ['MENS', 'WOMENS', 'BOYS', 'KIDS', 'OVERSIZE'],

  // ---- 10-step workflow (relabel / reorder here) ----
  steps: [
    { n: 1, key: 'order', label: 'Order Details', role: 'Planning Board' },
    { n: 2, key: 'sample', label: 'Sample Photos', role: 'Production Co-ordinator' },
    { n: 3, key: 'ob', label: 'Operation Breakdown', role: 'WSE' },
    { n: 4, key: 'approval', label: 'OB Approval', role: 'Asst. Mgr. (Central)', gate: true },
    { n: 5, key: 'layout', label: 'Line Layout', role: 'WSE' },
    { n: 6, key: 'verify', label: 'Layout Verification', role: 'Sr. Exec. / Mgr.', gate: true },
    { n: 7, key: 'plan', label: 'Production Plan', role: '—', low: true },
    { n: 8, key: 'changeover', label: 'Change Over Time', role: '—', low: true },
    { n: 9, key: 'cycle', label: 'Cycle Time', role: 'WSE' },
    { n: 10, key: 'skill', label: 'Skill Matrix', role: 'WSE' },
  ],

  // ---- RBAC: which roles may do each action (add/remove roles freely) ----
  permissions: {
    obPrepare: ['WSE'],                 // may add/edit operations & build the OB
    sampleManage: ['WSE'],              // may upload / manage sample photos
    sampleDecide: ['WSE', 'ASST_MGR_CENTRAL', 'ADMIN'],
    obApprove: ['ASST_MGR_CENTRAL', 'ADMIN'],
    obReject: ['ASST_MGR_CENTRAL', 'ADMIN'],
    layoutVerify: ['SR_MGR', 'ASST_MGR_CENTRAL', 'ADMIN'],
    changeRequest: ['WSE'],
    changeDecide: ['ASST_MGR_CENTRAL', 'ADMIN'],
  },

  // ---- machines ----
  machineLegend: {
    'SNLS': 'Single Needle Lock Stitch', 'DNLS': 'Double Needle Lock Stitch',
    '4T O/L': '4 Thread Overlock', '3T O/L': '3 Thread Overlock', '3T F/L': '3 Thread Flat Lock',
    'MNCS': 'Multi Needle Chain Stitch (Kansai)', 'B/T': 'Bartack', 'SNAP': 'Snap Button Attach',
    'HEATSEAL': 'Heat Seal Press', 'IRON': 'Ironer', 'Manual': 'Manual / Helper',
  },

  // ---- OB field option lists (full master) ----
  fieldOptions: {
    needleType: ['DB', 'DPX5', 'DC', 'UY', 'UO', 'DO', 'DPX17'],
    needleSize: ['9', '10', '11', '14', '16', '18', '21'],
    threadNeedle: ['80', '60', '40', '27', '105'],
    threadBobbin: ['60', '40', '27', '105'],
    gauge: ['N/A', 'Plain', '1/16', '1/8', '3/16', '1/4', 'Zipper'],
    foot: ['Light', 'Medium', 'Heavy'],
    pressure: ['Regular', 'Compensation'],
  },

  // ---- machine → category, and category → narrowed options ----
  machineCategory: {
    'SNLS': 'lock', 'DNLS': 'lock',
    '4T O/L': 'overlock', '3T O/L': 'overlock', '3T F/L': 'overlock',
    'MNCS': 'chain', 'B/T': 'bartack',
    'Manual': 'none', 'HEATSEAL': 'none', 'IRON': 'none', 'SNAP': 'none',
  },
  narrowing: {
    lock: { needleType: ['DB', 'DPX5'], needleSize: ['14', '16'], threadNeedle: ['80', '60'], threadBobbin: ['60'], gauge: ['Plain', '1/16', '1/8', '3/16', '1/4'], foot: ['Light', 'Medium'], pressure: ['Regular', 'Compensation'] },
    overlock: { needleType: ['DC'], needleSize: ['14', '16'], threadNeedle: ['27'], threadBobbin: ['27'], gauge: ['N/A'], foot: ['Light', 'Medium'], pressure: ['Regular'] },
    chain: { needleType: ['UY', 'UO'], needleSize: ['16', '18'], threadNeedle: ['80'], threadBobbin: ['60'], gauge: ['Plain'], foot: ['Medium'], pressure: ['Regular'] },
    bartack: { needleType: ['DPX17'], needleSize: ['19', '21'], threadNeedle: ['27'], threadBobbin: ['27'], gauge: ['Plain'], foot: ['Light'], pressure: ['Regular'] },
    none: { needleType: ['N/A'], needleSize: ['N/A'], threadNeedle: ['N/A'], threadBobbin: ['N/A'], gauge: ['N/A'], foot: ['N/A'], pressure: ['N/A'] },
  },

  // ---- OB library (master operations) ----
  obLibrary: [],  // OB library now lives in PostgreSQL (served by the API)

  // ---- factories → lines (each line: name, shape U/I, and workstation/machine count) ----
  //      Source: "Factory wise Line Workstation" (19-10-2026).
  factories: [
    {
      code: 'AGL', name: 'Ananta Garments Ltd', lines: [
        ...mk(seq('A', 'O'), 'U', 95),
        ...mk(['New-01', 'New-02', 'New-10', 'New-11', 'New-12', 'New-15'], 'I', 66),
      ],
    },
    {
      code: 'ASL', name: 'Ananta ASL', lines: [
        ...mk([...seq('P', 'Z'), 'New-04', 'New-05', 'New-06', 'New-07'], 'U', 95),
        ...mk(['New-03', 'New-08', 'New-09', 'New-13', 'New-14', 'New-16'], 'I', 66),
      ],
    },
    {
      code: 'AJL', name: 'Ananta Jeanswear Ltd', lines: [
        ...mk(seq('A', 'R'), 'U', 80),
        ...mk(['S', 'T', 'U', 'V', 'W'], 'I', 62),
      ],
    },
    {
      code: 'ABM', name: 'Ananta Apparel (ABM)', lines: [
        ...mk(['6', '7', '8', '14', '15', '16'], 'U', 75),
        ...mk(['1', '2', '3', '4', '5', '9', '10', '11', '12', '13', '17', '18', '19', '20', '21'], 'I', 75),
      ],
    },
  ],

  // ---- demo login accounts ----
  users: [
    { id: 'u1', name: 'Rahim Uddin', initials: 'RU', role: 'WSE', roleLabel: 'Work Study Executive', factory: 'AGL', color: '#2563eb', crossFactory: false },
    { id: 'u2', name: 'Karim Hossain', initials: 'KH', role: 'WSE', roleLabel: 'Work Study Executive', factory: 'AJL', color: '#0891b2', crossFactory: false },
    { id: 'u3', name: 'Hanif Mahmud', initials: 'HM', role: 'ASST_MGR_CENTRAL', roleLabel: 'Asst. Mgr. (Central)', factory: 'AGL', color: '#7c3aed', crossFactory: true },
    { id: 'u4', name: 'Noman Chowdhury', initials: 'NC', role: 'SR_MGR', roleLabel: 'Sr. Exec. / Mgr.', factory: 'AGL', color: '#16a34a', crossFactory: false },
    { id: 'u5', name: 'Shahriar Kabir', initials: 'SK', role: 'ADMIN', roleLabel: 'Super Admin', factory: 'AGL', color: '#dc2626', crossFactory: true },
  ],

  // ---- seed operators (replaced by uploaded list at runtime) ----
  operatorSeed: {
    factory: 'AGL', floor: '4th Floor', count: 50, lineStart: 25, lineSpan: 10,
    firstNames: ['Shanti', 'Sojib', 'Afroza', 'Lovely', 'Sorna', 'Juli', 'Mukta', 'Bristy', 'Masuma', 'Hasna', 'Reshmi', 'Lipi', 'Archana', 'Nazma', 'Rina', 'Mina', 'Peyara', 'Sefali', 'Sharmin', 'Honufa', 'Sabina', 'Rabeya', 'Taslima', 'Anwara', 'Marzia'],
    lastNames: ['Akter', 'Begum', 'Khatun', 'Rani', 'Das', 'Yasmin', 'Roy', 'Khanom'],
    machines: ['SNLS', 'DNLS', '4T O/L', '3T O/L', 'MNCS', 'B/T', 'SNAP', 'IRON', '3T F/L', 'Manual'],
    grades: ['A', 'B', 'C'],
  },
}

// working copy (mutated by loadConfig)
export const CONFIG = JSON.parse(JSON.stringify(DEFAULTS))

function deepMerge(target, src) {
  for (const k in src) {
    const v = src[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) target[k] = deepMerge(target[k] || {}, v)
    else target[k] = v
  }
  return target
}

// Fetch public/config/config.json (runtime override, no rebuild) and merge over DEFAULTS.
export async function loadConfig() {
  try {
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/'
    const res = await fetch(base + 'config/config.json', { cache: 'no-store' })
    if (res.ok) deepMerge(CONFIG, await res.json())
  } catch { /* keep DEFAULTS */ }
  return CONFIG
}
