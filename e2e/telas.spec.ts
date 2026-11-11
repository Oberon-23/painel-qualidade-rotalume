import { expect, test, type Page } from '@playwright/test';

const TELAS = [
  ['/', 'Visão geral da qualidade'], ['/estabilidade', 'Estabilidade do processo'], ['/defeitos', 'Defeitos'],
  ['/acoes', 'Ações corretivas'], ['/sobre', 'Sobre os dados'],
] as const;

function vigiar(page: Page) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('localhost')) erros.push(`HTTP ${r.status()}: ${r.url()}`); });
  return erros;
}

for (const [rota, titulo] of TELAS) {
  test(`${rota} abre sem erro, com gráficos e sem rolagem lateral`, async ({ page }) => {
    const erros = vigiar(page);
    await page.goto(rota);
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    if (rota !== '/sobre') await expect(page.locator('.graf svg').first()).toBeVisible();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, 'rolagem horizontal').toBeLessThanOrEqual(1);
    expect(erros).toEqual([]);
  });
}

test('menu mostra as cinco seções sem precisar rolar', async ({ page }) => {
  await page.goto('/');
  const links = page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('link');
  await expect(links).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    const box = (await links.nth(i).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
  await links.nth(3).click();
  await expect(page).toHaveURL(/\/acoes$/);
});

test('rota desconhecida volta para a visão geral', async ({ page }) => {
  await page.goto('/nao-existe');
  await expect(page).toHaveURL(/\/$/);
});
