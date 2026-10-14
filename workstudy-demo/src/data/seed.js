// ============================================================
//  SEED DATA  — fresh start.
//  The OB Library below is the master database the OB step
//  selects from (provided: Men's Trouser, Total SMV 29.60).
//  No pre-loaded styles — create orders via  ➕ New Order.
// ============================================================

export const MACHINE_LEGEND = {
  'SNLS': 'Single Needle Lock Stitch',
  'DNLS': 'Double Needle Lock Stitch',
  '4T O/L': '4 Thread Overlock',
  '3T O/L': '3 Thread Overlock',
  '3T F/L': '3 Thread Flat Lock',
  'MNCS': 'Multi Needle Chain Stitch (Kansai)',
  'B/T': 'Bartack',
  'SNAP': 'Snap Button Attach',
  'HEATSEAL': 'Heat Seal Press',
  'IRON': 'Ironer',
  'Manual': 'Manual / Helper',
}

// Master OB library — { name, machine, smv }.  (manual = non-machine)
export const OB_LIBRARY = [
  { name: 'Front Rise Overlock', machine: '4T O/L', smv: 0.30 },
  { name: 'Front Sewing', machine: 'SNLS', smv: 0.30 },
  { name: 'Front Rise Top Stitch', machine: 'SNLS', smv: 0.30 },
  { name: 'Fly Round Top Stitch', machine: 'DNLS', smv: 0.35 },
  { name: 'Bone Make', machine: 'SNLS', smv: 0.30 },
  { name: 'Bone Attach at Upper Pockting', machine: 'SNLS', smv: 0.30 },
  { name: 'Pockting Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Upper Pockting Attach', machine: 'SNLS', smv: 0.40 },
  { name: 'Pocket Opening Top Stitch', machine: 'SNLS', smv: 0.40 },
  { name: 'Facing Attach at Lower Pockting', machine: 'SNLS', smv: 0.35 },
  { name: 'Lower Pockting Mark', machine: 'Manual', smv: 0.30 },
  { name: 'Lower Pockting Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Lower Pockting Tuck', machine: 'SNLS', smv: 0.35 },
  { name: 'Pocket Bag Overlock', machine: '4T O/L', smv: 0.35 },
  { name: 'Pocket Bag Faulse Sewing', machine: 'SNLS', smv: 0.30 },
  { name: 'Inseam Facing Join', machine: '4T O/L', smv: 0.20 },
  { name: 'Inseam Facing Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Inseam Facing Attach', machine: '4T O/L', smv: 0.55 },
  { name: 'Inseam Facing Top Stitch', machine: 'SNLS', smv: 0.70 },
  { name: 'Heat Seal Label Attach', machine: 'HEATSEAL', smv: 0.30 },
  { name: 'Facing Attach at Pockting', machine: 'SNLS', smv: 0.30 },
  { name: 'Pockting Attach & Tab Attach', machine: 'SNLS', smv: 0.35 },
  { name: 'Pockting Top Stitch', machine: 'SNLS', smv: 0.30 },
  { name: 'Pocket Bag Overlock (2)', machine: '4T O/L', smv: 0.40 },
  { name: 'Velcro Attach', machine: 'SNLS', smv: 0.55 },
  { name: 'Back Yoke Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Back Yoke Join', machine: '4T O/L', smv: 0.35 },
  { name: 'Back Rise Join', machine: '4T O/L', smv: 0.30 },
  { name: 'Back Rise Top Stitch', machine: 'SNLS', smv: 0.30 },
  { name: 'Heat Seal Label Attach (2)', machine: 'HEATSEAL', smv: 0.30 },
  { name: 'Flap Mark', machine: 'Manual', smv: 0.30 },
  { name: 'Snap Attach at Flap', machine: 'SNAP', smv: 0.65 },
  { name: 'Flap Sewing', machine: 'SNLS', smv: 0.35 },
  { name: 'Flap Turn', machine: 'Manual', smv: 0.30 },
  { name: 'Flap Top Stitch', machine: 'SNLS', smv: 0.35 },
  { name: 'Flap Edge Cut', machine: '3T O/L', smv: 0.30 },
  { name: 'Cargo Pocket Rolling', machine: 'SNLS', smv: 0.35 },
  { name: 'Facing Attach at Cargo Pocket', machine: 'SNLS', smv: 0.35 },
  { name: 'Back Front Number Match', machine: 'Manual', smv: 0.35 },
  { name: 'Side Seam Join', machine: '4T O/L', smv: 0.70 },
  { name: 'Care Label Attach', machine: 'SNLS', smv: 0.30 },
  { name: 'Side Seam Top Stitch', machine: 'SNLS', smv: 0.95 },
  { name: 'Cargo Pkt Placement Mark', machine: 'Manual', smv: 0.65 },
  { name: 'Cargo Pocket Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Cargo Pocket Iron', machine: 'IRON', smv: 0.60 },
  { name: 'Cargo Pocket Attach Lower', machine: 'SNLS', smv: 0.35 },
  { name: 'Cargo Pocket Attach', machine: 'SNLS', smv: 0.70 },
  { name: 'Flap Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'Flap Attach', machine: 'SNLS', smv: 0.35 },
  { name: 'Flap 1/4 Top Stitch', machine: 'SNLS', smv: 0.35 },
  { name: 'W/B Ring Tuck & Mark', machine: 'SNLS', smv: 0.35 },
  { name: 'Elastic Measurment & Cut', machine: 'Manual', smv: 0.30 },
  { name: 'Elastic Ring Tuck & Mark', machine: 'SNLS', smv: 0.35 },
  { name: 'W/B Mark & Punch', machine: 'SNAP', smv: 0.35 },
  { name: 'Snap Attach At W/B', machine: 'SNAP', smv: 0.35 },
  { name: 'W/B & Elastic Tuck', machine: 'SNLS', smv: 0.70 },
  { name: 'W/B Rolling', machine: 'MNCS', smv: 0.65 },
  { name: 'Triming', machine: 'Manual', smv: 0.35 },
  { name: 'W/B Number Match', machine: 'Manual', smv: 0.30 },
  { name: 'W/B Attach', machine: '4T O/L', smv: 0.70 },
  { name: 'Tuck Remove', machine: 'Manual', smv: 0.70 },
  { name: 'Main Label Attach', machine: 'SNLS', smv: 0.30 },
  { name: 'Back & Front Bartack', machine: 'B/T', smv: 0.35 },
  { name: 'Cargo Flap Bartack', machine: 'B/T', smv: 0.35 },
  { name: 'Inseam Join', machine: '4T O/L', smv: 0.70 },
  { name: 'Inseam Top Stitch', machine: 'SNLS', smv: 0.70 },
  { name: 'Bottom Rib Ring Tuck', machine: 'SNLS', smv: 0.40 },
  { name: 'Rib Sewing', machine: 'SNLS', smv: 0.40 },
  { name: 'Rib Mark & Number Match', machine: 'Manual', smv: 0.35 },
  { name: 'Bottom Rib Attach', machine: '4T O/L', smv: 0.50 },
  { name: 'Bottom Rolling', machine: '3T F/L', smv: 0.50 },
  { name: 'Final Trimming', machine: 'Manual', smv: 0.70 },
]

// Full reference lists for every OB field (master lists — user will refine later)
export const OB_FIELDS = {
  needleType: ['DB', 'DPX5', 'DC', 'UY', 'UO', 'DO', 'DPX17'],
  needleSize: ['9', '10', '11', '14', '16', '18', '21'],
  threadNeedle: ['80', '60', '40', '27', '105'],
  threadBobbin: ['60', '40', '27', '105'],
  gauge: ['N/A', 'Plain', '1/16', '1/8', '3/16', '1/4', 'Zipper'],
  foot: ['Light', 'Medium', 'Heavy'],
  pressure: ['Regular', 'Compensation'],
}

// Picking a process (its machine) NARROWS each dropdown's options to the relevant ones.
export function narrowFor(machine) {
  const none = ['Manual', 'HEATSEAL', 'IRON', 'SNAP']
  const overlock = ['4T O/L', '3T O/L', '3T F/L']
  const chain = ['MNCS']
  const bartack = ['B/T']
  if (none.includes(machine)) return { needleType: ['N/A'], needleSize: ['N/A'], threadNeedle: ['N/A'], threadBobbin: ['N/A'], gauge: ['N/A'], foot: ['N/A'], pressure: ['N/A'] }
  if (overlock.includes(machine)) return { needleType: ['DC'], needleSize: ['14', '16'], threadNeedle: ['27'], threadBobbin: ['27'], gauge: ['N/A'], foot: ['Light', 'Medium'], pressure: ['Regular'] }
  if (chain.includes(machine)) return { needleType: ['UY', 'UO'], needleSize: ['16', '18'], threadNeedle: ['80'], threadBobbin: ['60'], gauge: ['Plain'], foot: ['Medium'], pressure: ['Regular'] }
  if (bartack.includes(machine)) return { needleType: ['DPX17'], needleSize: ['19', '21'], threadNeedle: ['27'], threadBobbin: ['27'], gauge: ['Plain'], foot: ['Light'], pressure: ['Regular'] }
  // lockstitch (SNLS / DNLS) default
  return { needleType: ['DB', 'DPX5'], needleSize: ['14', '16'], threadNeedle: ['80', '60'], threadBobbin: ['60'], gauge: ['Plain', '1/16', '1/8', '3/16', '1/4'], foot: ['Light', 'Medium'], pressure: ['Regular', 'Compensation'] }
}

export const FACTORIES = [
  { code: 'AGL', name: 'Ananta Garments Ltd', lines: Array.from({ length: 46 }, (_, i) => 'Line ' + (i + 1)) },
  { code: 'AJL', name: 'Ananta Jeanswear Ltd', lines: Array.from({ length: 20 }, (_, i) => 'Line ' + (i + 1)) },
  { code: 'ABM', name: 'Ananta Apparel (ABM)', lines: Array.from({ length: 12 }, (_, i) => 'Line ' + (i + 1)) },
]

export const USERS = [
  { id: 'u1', name: 'Rahim Uddin', initials: 'RU', role: 'WSE', roleLabel: 'Work Study Executive', factory: 'AGL', color: '#2563eb', crossFactory: false },
  { id: 'u2', name: 'Karim Hossain', initials: 'KH', role: 'WSE', roleLabel: 'Work Study Executive', factory: 'AJL', color: '#0891b2', crossFactory: false },
  { id: 'u3', name: 'Hanif Mahmud', initials: 'HM', role: 'ASST_MGR_CENTRAL', roleLabel: 'Asst. Mgr. (Central)', factory: 'AGL', color: '#7c3aed', crossFactory: true },
  { id: 'u4', name: 'Noman Chowdhury', initials: 'NC', role: 'SR_MGR', roleLabel: 'Sr. Exec. / Mgr.', factory: 'AGL', color: '#16a34a', crossFactory: false },
  { id: 'u5', name: 'Shahriar Kabir', initials: 'SK', role: 'ADMIN', roleLabel: 'Administrator', factory: 'AGL', color: '#dc2626', crossFactory: true },
]

export const OPERATORS = [
  { id: 'OP-101', name: 'Shanti Rani', grade: 'A', factory: 'AGL' },
  { id: 'OP-102', name: 'Sojib Mia', grade: 'A', factory: 'AGL' },
  { id: 'OP-103', name: 'Afroza Begum', grade: 'B', factory: 'AGL' },
  { id: 'OP-104', name: 'Lovely Akter', grade: 'A', factory: 'AGL' },
  { id: 'OP-105', name: 'Sorna Khatun', grade: 'B', factory: 'AGL' },
  { id: 'OP-106', name: 'Juli Akter', grade: 'C', factory: 'AGL' },
  { id: 'OP-201', name: 'Reshmi Akter', grade: 'A', factory: 'AJL' },
  { id: 'OP-202', name: 'Lipi Rani', grade: 'B', factory: 'AJL' },
]

// No pre-seeded styles — start fresh.
export const STYLES = []

export const STEPS = [
  { n: 1, key: 'order', label: 'Order Details', role: 'Planning Board' },
  { n: 2, key: 'sample', label: 'Approved Sample', role: 'Production Co-ordinator' },
  { n: 3, key: 'ob', label: 'Operation Breakdown', role: 'WSE' },
  { n: 4, key: 'approval', label: 'OB Approval', role: 'Asst. Mgr. (Central)', gate: true },
  { n: 5, key: 'layout', label: 'Line Layout', role: 'WSE' },
  { n: 6, key: 'verify', label: 'Layout Verification', role: 'Sr. Exec. / Mgr.', gate: true },
  { n: 7, key: 'plan', label: 'Production Plan', role: '—', low: true },
  { n: 8, key: 'changeover', label: 'Change Over Time', role: '—', low: true },
  { n: 9, key: 'cycle', label: 'Cycle Time', role: 'WSE' },
  { n: 10, key: 'skill', label: 'Skill Matrix', role: 'WSE' },
]

export const getFactory = (code) => FACTORIES.find(f => f.code === code)
export const operatorsForFactory = (code) => OPERATORS.filter(o => o.factory === code)
