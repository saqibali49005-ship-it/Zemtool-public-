import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const failures=[];let passed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){failures.push({name,error:error.message});console.error('FAIL',name,error.message);}}
async function fresh(){await page.goto(baseUrl+'/mulch-calculator/',{waitUntil:'domcontentloaded'});await page.locator('#zoneList .zone-card').waitFor();await page.locator('header.site-header[data-zem-unified="1"]').waitFor();await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>sheet.href&&sheet.href.includes('master-header.css')));}

try{
 await fresh();
 await check('canonical SEO, indexability, structured data and category navigation are present',async()=>{
  assert.match(await page.title(),/Mulch Calculator.*Bags.*Cubic Yards/i);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://zemtools.com/mulch-calculator/');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'index,follow');
  const data=await page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.textContent)));
  assert.ok(data.some(x=>x['@type']==='WebApplication'));
  assert.ok(data.some(x=>x['@type']==='BreadcrumbList'));
  assert.equal(await page.locator('#toolHeaderMenuPanel a[href="/home-construction/"]').count(),1);
  assert.match(await page.locator('body').innerText(),/Mulches for Home Gardens/i);
 });
 await check('catalog, category, homepage fallback, All Tools directory schema and sitemap are synchronized',async()=>{
  const homepage=await page.request.get(baseUrl+'/');const homepageHtml=await homepage.text();
  assert.equal(homepage.status(),200);assert.ok(homepageHtml.includes('href="/mulch-calculator/"'));assert.ok(homepageHtml.includes('<h3>Mulch Calculator</h3>'));assert.ok(homepageHtml.includes('10 tools · Explore →'));
  const category=await page.request.get(baseUrl+'/home-construction/');const categoryHtml=await category.text();
  assert.equal(category.status(),200);assert.ok(categoryHtml.includes('href="mulch-calculator/"')||categoryHtml.includes('href="/mulch-calculator/"'));
  assert.ok(categoryHtml.includes('Mulch Calculator'));
  const directory=await page.request.get(baseUrl+'/tools/');const directoryHtml=await directory.text();
  assert.equal(directory.status(),200);assert.ok(directoryHtml.includes('href="/mulch-calculator/"'));
  const schemaStart=directoryHtml.indexOf('<script type="application/ld+json">');const schemaEnd=directoryHtml.indexOf('</script>',schemaStart);
  assert.ok(schemaStart>=0&&schemaEnd>schemaStart);
  const schema=JSON.parse(directoryHtml.slice(schemaStart+'<script type="application/ld+json">'.length,schemaEnd));
  const directoryItems=schema.mainEntity.itemListElement;
  assert.equal(schema.mainEntity.numberOfItems,directoryItems.length);
  assert.ok(directoryHtml.includes(`All ${directoryItems.length} tools are linked directly above.`));
  const directoryUrls=new Set(directoryItems.map(item=>item.url));
  for(const url of [
   'https://zemtools.com/raised-bed-soil-calculator/',
   'https://zemtools.com/mulch-calculator/',
   'https://zemtools.com/spreader-calibration-calculator/'
  ]) assert.ok(directoryUrls.has(url),'Missing directory schema URL: '+url);
  const sitemap=await page.request.get(baseUrl+'/sitemap.xml');assert.equal(sitemap.status(),200);assert.ok((await sitemap.text()).includes('https://zemtools.com/mulch-calculator/'));
 });
 await check('all user inputs and selects have accessible names and valid label targets',async()=>{
  assert.equal(await page.locator('label:not([for])').count(),0);
  const broken=await page.locator('label[for]').evaluateAll(labels=>labels.filter(label=>!document.getElementById(label.htmlFor)).map(label=>label.textContent));
  assert.deepEqual(broken,[]);
  const unlabeled=await page.locator('input:not([type="hidden"]),select,textarea').evaluateAll(nodes=>nodes.filter(node=>!(node.labels&&node.labels.length)&&!node.getAttribute('aria-label')&&!node.getAttribute('aria-labelledby')).map(node=>({tag:node.tagName,id:node.id,name:node.name})));
  assert.deepEqual(unlabeled,[]);
 });
 await check('one rectangular bed calculates volume without inventing package weight or prices',async()=>{
  await fresh();await page.locator('#calculateProject').click();
  assert.equal(await page.locator('#projectError').isVisible(),false);
  const result=await page.locator('#projectResults').innerText();
  assert.match(result,/10(?:\.00)? ft³/);
  assert.match(result,/No complete priced supplier offer/i);
  assert.doesNotMatch(result,/US tons|kg weight|lbs weight/i);
 });
 await check('labelled bag volume rounds up to whole packages and quote totals include delivery/tax',async()=>{
  await fresh();
  const product=page.locator('.product-card').first();
  await product.locator('[data-product="volume"]').fill('2');
  const offer=product.locator('.offer-card').first();
  await offer.locator('[data-offer="supplier"]').fill('Garden Shop');
  await offer.locator('[data-offer="price"]').fill('6');
  await offer.locator('[data-offer="deliveryFee"]').fill('3');
  await offer.locator('[data-offer="taxPercent"]').fill('5');
  await page.locator('#calculateProject').click();
  const result=await page.locator('#projectResults').innerText();
  assert.match(result,/5 bags/);
  assert.match(result,/Garden Shop/);
  assert.match(result,/34\.65/);
 });
 await check('user-entered currency text is rendered as text, not interpreted as HTML',async()=>{
  await fresh();
  const product=page.locator('.product-card').first();
  await product.locator('[data-product="volume"]').fill('2');
  const offer=product.locator('.offer-card').first();
  await offer.locator('[data-offer="currency"]').fill('<em>');
  await offer.locator('[data-offer="price"]').fill('6');
  await page.locator('#calculateProject').click();
  const result=await page.locator('#projectResults').innerText();
  assert.match(result,/<EM> 30(?:\\.00)?/);
  assert.equal(await page.locator('#projectResults em').count(),0);
 });
 await check('bulk minimum and order increment are read independently from bag order rules',async()=>{
  await fresh();
  const product=page.locator('.product-card').first();
  await product.locator('[data-product="volume"]').fill('2');
  const offers=product.locator('.offer-card');
  await offers.first().locator('[data-offer="price"]').fill('6');
  await product.locator('.add-offer').click();
  const bulk=product.locator('.offer-card').nth(1);
  await bulk.locator('[data-offer="supplier"]').fill('Bulk Yard');
  await bulk.locator('[data-offer="mode"]').selectOption('bulk');
  await bulk.locator('[data-offer="price"]').fill('12');
  await bulk.locator('[data-offer="minimumVolume"]').fill('0.5');
  await bulk.locator('[data-offer="orderIncrementBulk"]').fill('0.25');
  await bulk.locator('[data-offer="deliveryFee"]').fill('40');
  await page.locator('#calculateProject').click();
  const result=await page.locator('#projectResults').innerText();
  assert.match(result,/Bulk Yard/);
  assert.match(result,/0\.5 yd³/);
  assert.match(result,/USD 46(?:\.00)?/);
 });
 await check('multiple zones can use different products and a tree ring excludes its centre',async()=>{
  await fresh();await page.locator('#addProduct').click();await page.locator('.product-card').nth(1).locator('[data-product="name"]').fill('Cedar mulch');
  await page.locator('#addZone').click();
  const second=page.locator('.zone-card').nth(1);
  await second.locator('[data-zone="shape"]').selectOption('ring');
  await second.locator('[data-zone="outerDiameter"]').fill('6');
  await second.locator('[data-zone="innerDiameter"]').fill('2');
  await second.locator('[data-zone="productId"]').selectOption('product-2');
  await page.locator('#calculateProject').click();
  assert.equal(await page.locator('#projectError').isVisible(),false);
  const result=await page.locator('#projectResults').innerText();
  assert.match(result,/Bed 1/);
  assert.match(result,/Garden area 2|Bed 2/);
  assert.match(result,/Cedar mulch/);
  assert.match(result,/Separate product lines\s*2/);
 });
 await check('reverse coverage calculates area from four labelled bags at two inches',async()=>{
  await fresh();await page.locator('.product-card').first().locator('[data-product="volume"]').fill('2');
  await page.locator('#coverageQuantity').fill('4');await page.locator('#coverageDepth').fill('2');
  await page.locator('#calculateCoverage').click();
  const result=await page.locator('#coverageResult').innerText();
  assert.match(result,/48(?:\.0)? sq ft/);
 });
 await check('invalid tree-ring diameters are rejected instead of returning negative or misleading area',async()=>{
  await fresh();const zone=page.locator('.zone-card').first();
  await zone.locator('[data-zone="shape"]').selectOption('ring');
  await zone.locator('[data-zone="outerDiameter"]').fill('3');
  await zone.locator('[data-zone="innerDiameter"]').fill('4');
  await page.locator('#calculateProject').click();
  assert.match(await page.locator('#projectError').innerText(),/outer diameter and a smaller/i);
 });
 await check('project JSON export is available only after a valid calculation',async()=>{
  await fresh();assert.equal(await page.locator('#downloadJson').isDisabled(),true);
  await page.locator('#calculateProject').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#downloadJson').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'zemtools-mulch-project.json');
 });
 await check('mobile viewport has no horizontal page overflow',async()=>{
  await page.setViewportSize({width:390,height:844});await fresh();
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(size.scroll<=size.client+1,JSON.stringify(size));
  await page.setViewportSize({width:1365,height:900});
 });
}finally{await browser.close();}
console.log('Mulch calculator browser checks: '+passed+' passed, '+failures.length+' failed');
if(failures.length)process.exitCode=1;
