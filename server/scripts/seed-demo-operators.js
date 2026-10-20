// Demo data: 100 random operators per line, for every line of every factory.
import 'dotenv/config'
import { pool, query } from '../src/db.js'

const U = (names, n) => names.map(x => [String(x), 'U', n])
const I = (names, n) => names.map(x => [String(x), 'I', n])
const seq = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i))

const FACTORIES = {
  AGL: [...U(seq('A', 'O'), 95), ...I(['New-01', 'New-02', 'New-10', 'New-11', 'New-12', 'New-15'], 66)],
  ASL: [...U([...seq('P', 'Z'), 'New-04', 'New-05', 'New-06', 'New-07'], 95), ...I(['New-03', 'New-08', 'New-09', 'New-13', 'New-14', 'New-16'], 66)],
  AJL: [...U(seq('A', 'R'), 80), ...I(['S', 'T', 'U', 'V', 'W'], 62)],
  ABM: [...U(['6', '7', '8', '14', '15', '16'], 75), ...I(['1', '2', '3', '4', '5', '9', '10', '11', '12', '13', '17', '18', '19', '20', '21'], 75)],
}

const FIRST = ['Shanti', 'Sojib', 'Afroza', 'Lovely', 'Sorna', 'Juli', 'Mukta', 'Bristy', 'Masuma', 'Hasna', 'Reshmi', 'Lipi', 'Archana', 'Nazma', 'Rina', 'Mina', 'Peyara', 'Sefali', 'Sharmin', 'Honufa', 'Sabina', 'Rabeya', 'Taslima', 'Anwara', 'Marzia', 'Rahim', 'Karim', 'Jalal', 'Sumon', 'Rasel', 'Parvin', 'Rozina', 'Shilpi', 'Monira', 'Nasrin', 'Jesmin', 'Ruma', 'Beauty', 'Shiuli', 'Morjina']
const LAST = ['Akter', 'Begum', 'Khatun', 'Rani', 'Das', 'Yasmin', 'Roy', 'Khanom', 'Uddin', 'Hossain', 'Ahmed', 'Islam', 'Chowdhury', 'Mia', 'Sarkar']
// real OB machine types (so Assign-Worker machine matching finds operators)
const MACHINES = ['SNLS', 'SNLS', 'SNLS', 'DNLS', 'DNLS', '3THOL', '4THOL', '5THOL', 'MNCS', 'B/T', 'BTK', 'SNEC', 'HP', 'HP', 'IM', 'APW', 'FL', 'BH', 'SNP', 'PS']
const GRADES = ['A', 'B', 'B', 'C']

async function main() {
  const { rowCount } = await query('DELETE FROM operators')
  console.log(`cleared ${rowCount} existing operators`)
  let total = 0
  for (const [factory, lines] of Object.entries(FACTORIES)) {
    for (const [line] of lines) {
      await query(
        `INSERT INTO operators (factory_code, line_label, op_code, name, grade, machine)
         SELECT $1, $2,
           $1 || '-' || $2 || '-' || lpad(g::text, 3, '0'),
           ($3::text[])[1 + floor(random() * array_length($3::text[], 1))::int] || ' ' ||
           ($4::text[])[1 + floor(random() * array_length($4::text[], 1))::int],
           ($5::text[])[1 + floor(random() * array_length($5::text[], 1))::int],
           ($6::text[])[1 + floor(random() * array_length($6::text[], 1))::int]
         FROM generate_series(1, 100) g`,
        [factory, line, FIRST, LAST, GRADES, MACHINES],
      )
      total += 100
    }
    console.log(`  ${factory}: ${lines.length} lines × 100 = ${lines.length * 100} operators`)
  }
  console.log(`\nSeeded ${total} demo operators across ${Object.values(FACTORIES).reduce((s, l) => s + l.length, 0)} lines.`)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
