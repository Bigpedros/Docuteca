import {test,expect} from '@playwright/test';
import path from 'node:path';

test('Docuteca processes a real PNG through MOTORE OCR',async({page})=>{
  const browserErrors:string[]=[];
  page.on('console',message=>{
    if(message.type()==='error')browserErrors.push(message.text());
  });
  page.on('pageerror',error=>browserErrors.push(error.message));

  const fixturePath=path.resolve('test-results/receipt-smoke.png');
  await page.setViewportSize({width:700,height:960});
  await page.setContent(`
    <html><body style="margin:0;background:white;font-family:Arial,sans-serif;color:black">
      <div style="padding:55px;width:590px">
        <div style="font-size:32px;margin-bottom:55px">DOCUMENTO COMMERCIALE</div>
        <div style="font-size:28px;margin-bottom:65px">NEGOZIO TEST</div>
        <div style="font-size:28px;margin-bottom:35px">ARTICOLO A 10,00</div>
        <div style="font-size:28px;margin-bottom:35px">ARTICOLO B 11,50</div>
        <div style="font-size:36px;margin:70px 0 35px">TOTALE 21,50</div>
        <div style="font-size:28px;margin-bottom:35px">IVA 1,95</div>
        <div style="font-size:28px">PAGAMENTO BANCOMAT</div>
      </div>
    </body></html>
  `);
  await page.screenshot({path:fixturePath,fullPage:true});

  await page.goto('/');
  const input=page.locator('input[type="file"]');
  await input.setInputFiles(fixturePath);
  await expect(page.getByText('receipt-smoke.png')).toBeVisible();

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
