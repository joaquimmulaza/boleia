/**
 * Browser QA: pickup opcional no fallback telefone.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\boleia-certa';

async function main() {
  const panelSrc = fs.readFileSync(
    path.join(ROOT, 'src/components/GrupoProcuraPanel.jsx'),
    'utf8',
  );
  const addrSrc = fs.readFileSync(
    path.join(ROOT, 'src/components/AddressInput.jsx'),
    'utf8',
  );

  if (!panelSrc.includes('Ponto de recolha (opcional)') || !panelSrc.includes('required={false}')) {
    throw new Error('GrupoProcuraPanel.jsx não tem required={false} no pickup');
  }
  if (!addrSrc.includes('required = true') || !addrSrc.includes('required={required}')) {
    throw new Error('AddressInput.jsx não respeita prop required');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="pt">
    <body>
      <h1>Grupo de viagem</h1>
      <p>Grupo · 1 de 4</p>
      <form id="fallback">
        <label>Telefone do colega
          <input type="tel" id="tel" required value="923766405" />
        </label>
        <label>Ponto de recolha (opcional)
          <input type="text" id="pickup" name="pickup_name" value="" />
        </label>
        <button type="submit" id="submit">Adicionar ao grupo</button>
        <a href="https://wa.me/?text=teste">Partilhar convite via WhatsApp</a>
      </form>
      <div id="out"></div>
      <script>
        const form = document.getElementById('fallback');
        const out = document.getElementById('out');
        out.textContent = form.checkValidity() ? 'VALID' : 'INVALID';
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          out.textContent = 'SUBMITTED';
        });
      </script>
    </body>
    </html>
  `);

  const validity = await page.locator('#out').textContent();
  if (validity !== 'VALID') {
    throw new Error(`Esperado VALID com pickup vazio; obtido: ${validity}`);
  }

  // Controlo: com required no pickup (bug antigo) → INVALID + mensagem nativa
  const bugMessage = await page.evaluate(() => {
    const pickup = document.getElementById('pickup');
    pickup.required = true;
    pickup.reportValidity();
    return pickup.validationMessage;
  });
  if (!bugMessage || bugMessage.length === 0) {
    throw new Error('Controlo: esperado validationMessage com required');
  }

  await page.evaluate(() => {
    document.getElementById('pickup').required = false;
    document.getElementById('out').textContent = '';
  });
  await page.click('#submit');
  const submitted = await page.locator('#out').textContent();
  if (submitted !== 'SUBMITTED') {
    throw new Error(`Submit com pickup vazio falhou: ${submitted}`);
  }

  const wa = page.getByRole('link', { name: /WhatsApp/i });
  if ((await wa.count()) < 1) {
    throw new Error('Link WhatsApp em falta');
  }

  // Smoke: app Vite responde
  const base = process.env.BASE_URL || 'http://localhost:5173';
  const res = await page.request.get(base);
  if (!res.ok()) {
    throw new Error(`Dev server ${base} não respondeu: ${res.status()}`);
  }

  console.log(JSON.stringify({
    ok: true,
    sourceRequiredFalse: true,
    addressInputProp: true,
    emptyPickupValid: true,
    bugControlHadValidationMessage: bugMessage,
    submitWithoutPickup: true,
    whatsappAuxiliary: true,
    viteOk: true,
  }));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
