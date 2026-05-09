import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const photoCalls = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/api/github/contents/') && (u.includes('binary=1') || u.includes('.png') || u.includes('.jpg'))) {
    photoCalls.push(u);
  }
});
const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errs.push('ERR: ' + m.text().slice(0, 250));
  if (m.type() === 'warning' && m.text().toLowerCase().includes('image')) errs.push('WARN: ' + m.text().slice(0, 250));
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
if (await page.locator('input[placeholder="Identifiant"]').count()) {
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
}

const profilsTab = page.locator('.nav-item', { hasText: 'Profils' }).first();
await profilsTab.click();
await page.waitForSelector('.auteur-card-v2', { timeout: 15000 });
await page.waitForTimeout(2500);

// Find the React fiber on a card and inspect props of the auteurs array
const inspect = await page.evaluate(() => {
  const card = document.querySelector('.auteur-card-v2');
  if (!card) return { error: 'no card' };

  // Walk to find React fiber
  const key = Object.keys(card).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  if (!key) return { error: 'no react fiber' };

  // Walk up to find a fiber that has memoized state with auteurs
  let fiber = card[key];
  let foundAuteurs = null;
  let i = 0;
  while (fiber && i < 50) {
    const props = fiber.memoizedProps;
    if (props && Array.isArray(props.auteurs)) {
      foundAuteurs = props.auteurs;
      break;
    }
    if (props && Array.isArray(props.authors)) {
      foundAuteurs = props.authors;
      break;
    }
    fiber = fiber.return;
    i++;
  }
  if (!foundAuteurs) {
    // Try via memoizedState
    fiber = card[key];
    i = 0;
    while (fiber && i < 80) {
      let state = fiber.memoizedState;
      while (state) {
        const v = state.memoizedState;
        if (Array.isArray(v) && v.length > 50 && v[0] && v[0].firstName) { foundAuteurs = v; break; }
        state = state.next;
      }
      if (foundAuteurs) break;
      fiber = fiber.return;
      i++;
    }
  }
  if (!foundAuteurs) return { error: 'auteurs not found' };

  const sample = foundAuteurs.slice(0, 5).map(a => ({
    id: a.id,
    firstName: a.firstName,
    photo: a.photo,
    photoPath: a.photoPath,
    name: a.name,
  }));
  const withPhoto = foundAuteurs.filter(a => a.photo).length;
  const withPhotoPath = foundAuteurs.filter(a => a.photoPath).length;
  return { total: foundAuteurs.length, withPhoto, withPhotoPath, sample };
});

console.log('Inspect:', JSON.stringify(inspect, null, 2));
console.log('Photo API calls:', photoCalls.length);
if (photoCalls.length) console.log('First 3:', photoCalls.slice(0, 3));
if (errs.length) console.log('Errors/warns:', errs.slice(0, 8));

await browser.close();
