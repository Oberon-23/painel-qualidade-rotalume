import { expect, test } from '@playwright/test';

test('filtros mudam a manchete e ficam salvos', async ({ page }) => {
  await page.goto('/');
  const manchete = page.locator('.manchete h2');
  const antes = await manchete.textContent();
  await page.locator('label.campo', { hasText: 'Período' }).locator('select').selectOption({ index: 3 });
  await page.locator('label.campo', { hasText: 'Linha' }).locator('select').selectOption({ index: 2 });
  await expect(manchete).not.toHaveText(antes!);
  await page.reload();
  await expect(page.locator('label.campo', { hasText: 'Linha' }).locator('select')).toHaveValue('1');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(manchete).toHaveText(antes!);
});

test('dica do gráfico aparece com o mouse e com o teclado', async ({ page }) => {
  await page.goto('/');
  const graf = page.getByRole('img', { name: 'OEE mensal por linha' });
  const box = (await graf.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await expect(page.locator('.tt')).toBeVisible();
  await expect(page.locator('.tt')).toContainText('L1 Usinagem');
  await page.mouse.move(0, 0);
  await expect(page.locator('.tt')).toHaveCount(0);
  await graf.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tt .tt-t')).toHaveText('nov/25');
  await page.keyboard.press('End').catch(() => {});
});

test('clicar numa barra do Pareto mostra a evolução daquele defeito', async ({ page }) => {
  await page.goto('/defeitos');
  const titulo = page.getByRole('heading', { name: /Evolução do defeito/ });
  const antes = await titulo.textContent();
  const graf = page.getByRole('img', { name: 'Pareto dos defeitos' });
  await graf.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(titulo).not.toHaveText(antes!);
});

test('estabilidade troca a característica medida', async ({ page }) => {
  await page.goto('/estabilidade');
  await page.getByRole('button', { name: /L2 · Torque/ }).click();
  await expect(page.locator('.manchete h2')).toContainText(/torque/i);
  await expect(page.getByRole('img', { name: 'Histograma das medições' })).toBeVisible();
});

test('ações: busca na tabela e link para o SGQ', async ({ page }) => {
  await page.goto('/acoes');
  await page.getByLabel('Buscar não conformidades').fill('parafusos');
  await expect(page.locator('tbody tr').first()).toContainText(/parafusos/i);
  const link = page.getByRole('link', { name: 'Abrir NC-2026-065 no SGQ Rotalume (nova aba)' }).first();
  await expect(link).toHaveAttribute('href', 'https://sqgrotalume.vercel.app/nao-conformidades/nc-2026-065');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('quadro PDCA bate com o SGQ', async ({ page }) => {
  await page.goto('/acoes');
  const colunas = page.locator('.coluna');
  await expect(colunas.filter({ hasText: 'Executar' })).toContainText('NC-2026-065');
  await expect(colunas.filter({ hasText: 'Verificar' })).toContainText('NC-2026-070');
  await expect(colunas.filter({ hasText: 'Planejar' })).toContainText('NC-2026-069');
});

test('tema escuro fica salvo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tema escuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
