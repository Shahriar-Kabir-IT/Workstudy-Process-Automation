// Role-based access control — the single server-side source of truth.
// The frontend mirrors this for UI affordances, but the server ENFORCES it.

export const ROLES = ['WSE', 'ASST_MGR_CENTRAL', 'SR_MGR', 'ADMIN', 'SYSADMIN']

// which roles may perform each action
export const PERMISSIONS = {
  orderCreate:   ['WSE', 'ADMIN'],                         // create a new order/style
  obPrepare:     ['WSE'],                                  // add/edit operations, build the OB
  sampleManage:  ['WSE'],                                  // upload / manage sample photos
  sampleDecide:  ['WSE', 'ASST_MGR_CENTRAL', 'ADMIN'],     // approve/reject the sample
  obApprove:     ['ASST_MGR_CENTRAL', 'ADMIN'],
  obReject:      ['ASST_MGR_CENTRAL', 'ADMIN'],
  layoutVerify:  ['SR_MGR', 'ASST_MGR_CENTRAL', 'ADMIN'],
  changeRequest: ['WSE'],
  changeDecide:  ['ASST_MGR_CENTRAL', 'ADMIN'],
  operatorManage:['WSE', 'ADMIN'],                        // upload / maintain the operator list
  systemAdmin:   ['SYSADMIN', 'ADMIN'],                   // view server / DB / system health
  userManage:    ['SYSADMIN', 'ADMIN'],                   // create / edit / delete user accounts
}

// presentation metadata (so the frontend need not hardcode it)
export const ROLE_META = {
  WSE:               { label: 'Work Study Executive', color: '#2563eb' },
  ASST_MGR_CENTRAL:  { label: 'Asst. Mgr. (Central)', color: '#7c3aed' },
  SR_MGR:            { label: 'Sr. Exec. / Mgr.',      color: '#16a34a' },
  ADMIN:             { label: 'Super Admin',           color: '#dc2626' },
  SYSADMIN:          { label: 'System Administrator',  color: '#7c3aed' },
}

export const can = (action, role) => (PERMISSIONS[action] || []).includes(role)
