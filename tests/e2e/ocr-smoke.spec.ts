import {test,expect} from '@playwright/test';
import path from 'node:path';

test('Docuteca processes a real image through MOTORE OCR',async({page})=>{
  const browserErrors:string[]=[];
  page.on('console',message=>{
    if(message.type()==='error')browserErrors.push(message.text());
  });
  page.on('pageerror',error=>browserErrors.push(error.message));

  await page.goto('/');
  const input=page.locator('input[type="file"]');
  await input.setInputFiles(path.resolve('tests/fixtures/receipt.svg'));
  await expect(page.getByText('receipt.svg')).toBeVisible();

  await page.getByRole('button',{name:/Elabora documento/i}).click();

  const result=page.getByText(/Classificazione MOTORE/i);
  const error=page.locator('.errorBox');
  await Promise.race([
    result.waitFor({state:'visible',timeout:180000}),
    error.waitFor({state:'visible',timeout:180000})
  ]);

  if(await error.isVisible()){
    throw new Error(`Docuteca runtime error: ${await error.innerText()} | browser: ${browserErrors.join(' | ')}`);
  }

  await expect(result).toBeVisible();
  await expect(page.getByText(/Ricevuta|Documento generico|Documento da verificare/i)).toBeVisible();
  await expect(page.getByText(/MOTORE 0\.5\.0-rc\.1/i)).toBeVisible();

  if(browserErrors.length)console.log('browser errors:',browserErrors.join(' | '));
});
