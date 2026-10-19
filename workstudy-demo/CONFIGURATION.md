# Configuration Guide — change the system without touching code

This app is **configuration-driven**. All business data and rules live in one
place, so you can run it for years and adapt it as the factory changes **without
editing component code**.

## Where the configuration lives

| File | When to use |
|---|---|
| `public/config/config.json` | **Runtime** — edit this on the deployed/built app, then reload the browser. **No rebuild needed.** This is the file you'll normally change. |
| `src/config.js` (`DEFAULTS`) | The built-in fallback/baseline, used if `config.json` is missing a section. |

On startup the app loads `config/config.json` and **deep-merges** it over the
defaults. You only need to include the sections you want to change.

## What you can change (and never need code for)

| Section | Controls |
|---|---|
| `engine` | Calculation constants: `minutesPerHour` (60), `matrixMinutesPerHour` (51 = 85% hour, used by Skill Matrix & efficiency), `uclFactor`/`lclFactor` (±10%), `planEfficiency`, `targetBasisPct`, `workingHours`. |
| `obLibrary` | The master operation library — `{ name, machine, smv }`. Add/remove/retitle operations, change SMVs. |
| `machineLegend` | Machine codes → full names. |
| `fieldOptions` | Master dropdown lists: needle type/size, thread, gauge, foot, pressure. |
| `machineCategory` + `narrowing` | How each field's options **narrow** for the selected machine. Map a machine to a category, define the category's narrowed lists. |
| `factories` | Factories → floors → lines, each line with a `shape` (`U`/`I`). Add floors, lines, or whole factories. |
| `steps` | The 10-step workflow — labels, order, which are gates / low-priority. |
| `permissions` | **RBAC** — which roles may `obApprove`, `obReject`, `layoutVerify`, `changeRequest`, `changeDecide`. Add/remove roles freely. |
| `categories` | Product categories in the New Order form. |
| `users` | Login accounts (demo). In production these come from the auth backend. |
| `operatorSeed` | How the starter operator list is generated; real operators are **uploaded** via the Operators page. |

## Examples

**Change the effective matrix hour from 51 to 54 minutes** — edit `config.json`:
```json
{ "engine": { "matrixMinutesPerHour": 54 } }
```

**Add a new machine + its narrowing** :
```json
{
  "machineLegend": { "CVR": "Cover Stitch" },
  "machineCategory": { "CVR": "chain" }
}
```

**Add a 6th floor to AGL** — replace the `AGL` entry's `floors` array (each line = `{ "no": 47, "shape": "U" }`).

**Let a new role approve OB** :
```json
{ "permissions": { "obApprove": ["ASST_MGR_CENTRAL", "ADMIN", "GM"] } }
```

## Regenerate the full config file

`public/config/config.json` was generated from the defaults. To regenerate a
full copy (e.g. after editing `DEFAULTS`):
```bash
node --input-type=module -e "import {DEFAULTS} from './src/config.js'; import fs from 'fs'; fs.writeFileSync('public/config/config.json', JSON.stringify(DEFAULTS,null,2))"
```

## Why this lasts

Components contain **no business data or rules** — they read everything from
`CONFIG`. Operations, machines, fields, factories, floors, lines, roles, the
workflow and every formula constant are data. Changing them is a config edit,
reviewed and deployed like any content change, with the code untouched.
