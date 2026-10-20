import {test,expect} from '@playwright/test';
import path from 'node:path';

test('Docuteca processes a real image through MOTORE OCR',async({page})=>{
  await page.goto('/');
  const input=page.locator('input[type="file"]');
  await input.setInputFiles(path.resolve('tests/fixtures/receipt.svg'));
  await expect(page.getByText('receipt.svg')).toBeVisible();

  await page.getByRole('button',{name:/Elabora documento/i}).click();
  await expect(page.getByText(/Classificazione MOTORE/i)).toBeVisible({timeout:120000});
  await expect(page.getByText(/Ricevuta|Documento generico|Documento da verificare/i)).toBeVisible();
  await expect(page.getByText(/MOTORE 0.5.0-rc.1/i)).toBeVisible();
});
