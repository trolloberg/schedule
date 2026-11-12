const { chromium } = require('playwright');
const URL = 'http://localhost:8099/stundenplan/';
(async () => {
  const b = await chromium.launch();
  let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
  for (const broken of [false, true]){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.route('**/stundenplan/', async r => { const res = await r.fetch(); let t = await res.text(); if (broken) t = t.replace("'use strict';", "'use strict'; throw new Error('kaputt');"); await r.fulfill({ response: res, body: t }); });
    await p.addInitScript(() => localStorage.setItem('sp.data.v1', JSON.stringify({ v: 3, slots: [], ov: {}, chk: {}, todos: [], set: { tut: 3 } })));
    await p.goto(URL); await p.waitForTimeout(6600);
    const txt = await p.locator('#page').innerText();
    if (broken) ok(/konnte nicht starten/.test(txt), 'kaputter Start zeigt Neu-laden-Knopf');
    else ok(!/konnte nicht starten/.test(txt) && txt.length > 20, 'normaler Start ohne Notbremse');
    await ctx.close();
  }
  console.log('pass', pass, 'fail', fail); await b.close();
})();
