import { expect, test } from '@playwright/test';

const kpi = (page: import('@playwright/test').Page, nome: string) => page.locator('.kpi').filter({ has: page.locator('.k-lab', { hasText: new RegExp(`^${nome}`) }) });

test('a fábrica 3D anda: peças são produzidas e inspecionadas', async ({ page }) => {
  await page.goto('/fabrica');
  await expect(page.locator('.fab-cena canvas')).toBeVisible();
  await page.getByRole('button', { name: '20×' }).click();
  const placar = page.getByRole('list', { name: /Placar do turno/ });
  await expect(placar.getByRole('listitem')).toHaveCount(3);
  await expect.poll(async () => Number((await placar.locator('.fab-n').allTextContents()).map((t) => t.replace(/\D/g, '')).reduce((a, b) => a + Number(b), 0)), { timeout: 15_000 }).toBeGreaterThan(20);
});

test('pausar congela o relógio do turno', async ({ page }) => {
  await page.goto('/fabrica');
  await page.getByRole('button', { name: 'Pausar a simulação' }).click();
  const relogio = page.locator('.fab-relogio');
  await page.waitForTimeout(500); // o placar atualiza 4 vezes por segundo
  const a = await relogio.textContent();
  await page.waitForTimeout(1200);
  await expect(relogio).toHaveText(a!);
  await page.getByRole('button', { name: 'Continuar a simulação' }).click();
  await expect(relogio).not.toHaveText(a!, { timeout: 5000 });
});

test('"e se": menos setup melhora o OEE, e voltar para hoje desfaz', async ({ page }) => {
  await page.goto('/fabrica');
  const oee = kpi(page, 'OEE da fábrica');
  const antes = await oee.locator('.k-val').textContent();
  await page.getByLabel('Tempo de setup por turno').fill('10');
  await expect(oee.locator('.k-val')).not.toHaveText(antes!);
  await expect(oee.locator('.var-boa')).toContainText('vs hoje');
  await expect(page.locator('.manchete h2')).toContainText('Neste cenário');
  await page.getByRole('button', { name: 'Voltar para hoje' }).click();
  await expect(oee.locator('.k-val')).toHaveText(antes!);
});

test('"e se": sem troca de ferramenta, o defeito da usinagem sobe e a tabela diz por quê', async ({ page }) => {
  await page.goto('/fabrica');
  await page.getByRole('switch', { name: /Trocar a ferramenta/ }).click();
  await expect(page.getByRole('switch', { name: /Trocar a ferramenta/ })).toHaveAttribute('aria-checked', 'false');
  await expect(kpi(page, 'Defeito').locator('.var-ruim')).toBeVisible();
  await expect(page.getByRole('row', { name: /L1 Usinagem/ })).toContainText('ferramenta usada além da vida útil');
  await page.getByLabel('Umidade na cabine de pintura (L3)').fill('78');
  await expect(page.getByRole('row', { name: /L3 Pintura/ })).toContainText('umidade alta');
});

test('clicar numa linha do placar mostra os números da inspeção', async ({ page }) => {
  await page.goto('/fabrica');
  await page.getByRole('button', { name: /^L2 Montagem: .*Mostrar a inspeção/ }).click();
  const sel = page.getByRole('dialog', { name: /Inspeção, L2 Montagem/ });
  await expect(sel).toContainText('OEE da linha');
  await sel.getByRole('button', { name: 'Fechar' }).click();
  await expect(sel).toHaveCount(0);
});
