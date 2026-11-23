import puppeteer from 'puppeteer-core'
const B = 'https://51-170-135-94.sslip.io'
let echecs = 0
const dire = (c, l) => { if (!c) echecs++; console.log(' ', c ? '✅' : '❌', l) }
const n = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] })

for (const [w, h, nom] of [[1440, 950, 'bureau'], [390, 844, 'mobile']]) {
  console.log(`── accueil · ${nom} ──`)
  const c = await n.createBrowserContext(); const p = await c.newPage()
  const err = []; p.on('pageerror', (e) => err.push(e.message))
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  await p.goto(B, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1500))
  const m = await p.evaluate(() => {
    const ruban = document.querySelector('.ruban-jour')
    const pills = ruban ? [...ruban.querySelectorAll('button')] : []
    return {
      titre: document.querySelector('h1')?.textContent?.trim() ?? '',
      ruban: !!ruban, pastilles: pills.length,
      libres: pills.filter((b) => !b.disabled).length,
      passees: pills.filter((b) => b.disabled).length,
      exemple: pills.slice(0, 3).map((b) => b.textContent.trim().replace(/\s+/g, ' ')),
      courant: !!ruban?.querySelector('[data-courant="true"]'),
      entete: document.querySelector('.ruban-jour')?.closest('div.rounded-3xl')?.querySelector('p')?.textContent?.trim() ?? '',
      largeur: document.documentElement.scrollWidth,
    }
  })
  dire(/à l'heure/.test(m.titre), `titre vivant : « ${m.titre.replace(/\n/g, ' ')} »`)
  dire(m.ruban && m.pastilles > 0, `ruban présent avec ${m.pastilles} heures (${m.libres} libres, ${m.passees} passées) — ${m.exemple.join(' | ')}`)
  console.log(`    en-tête du ruban : ${m.entete}`)
  dire(m.largeur <= w, `largeur ${m.largeur} px pour ${w}`)
  await p.screenshot({ path: `/tmp/audit/ruban-${nom}.png` })

  // toucher la première heure libre
  const libre = await p.$('.ruban-jour button:not([disabled])')
  if (libre) {
    const hh = await p.evaluate((b) => b.querySelector('.heure')?.textContent?.trim(), libre)
    await libre.click(); await new Promise((r) => setTimeout(r, 1800))
    const apres = await p.evaluate(() => ({
      texte: document.body.innerText,
      liens: [...document.querySelectorAll('a[href*="/reserver?date="]')].map((a) => a.getAttribute('href')),
    }))
    dire(new RegExp(`Libres à ${hh}`).test(apres.texte), `« Libres à ${hh} » s'affiche`)
    dire(apres.liens.length > 0, `${apres.liens.length} lien(s) « Réserver à ${hh} » : ${apres.liens[0] ?? '(aucun)'}`)
    await p.screenshot({ path: `/tmp/audit/ruban-${nom}-choisi.png` })
    if (apres.liens[0] && nom === 'bureau') {
      await p.goto(B + apres.liens[0], { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1200))
      const t = await p.evaluate(() => document.body.innerText)
      dire(/Quelle prestation|prestation/i.test(t), 'le tunnel s’ouvre (étape prestation, la date et l’heure sont dans l’adresse)')
    }
  } else {
    console.log('    (aucune heure libre à cet instant — le ruban montre peut-être demain sans créneau)')
  }
  dire(err.length === 0, `aucune erreur JS${err.length ? ' — ' + err[0].slice(0, 100) : ''}`)
  await c.close()
}
await n.close()
console.log(echecs === 0 ? '\n✅ tout est en place' : `\n❌ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
