
(function(){
 'use strict';
 const engine=window.ZemToolsSourdoughEngine;
 if(!engine) throw new Error('Sourdough calculation engine failed to load.');
 const $=id=>document.getElementById(id);
 const state={mode:'build',unit:'g',last:null,lastRecipe:null,lastText:''};
 const unitNames={g:'g',kg:'kg',oz:'oz',lb:'lb'};
 const unitSelect=$('weight-unit');
 const error=$('error-status');
 const actionStatus=$('action-status');
 const resultCard=$('result-card');
 const resultStats=$('result-stats');
 const resultLines=$('result-lines');
 const resultExplanation=$('result-explanation');
 const scalePanel=$('scale-panel');

 function number(id){return Number($(id).value);}
 function grams(id){return engine.toGrams($(id).value,state.unit);}
 function fmt(value){return engine.fromGrams(value,state.unit).toLocaleString(undefined,{maximumFractionDigits:2});}
 function pct(value){return Number(value).toLocaleString(undefined,{maximumFractionDigits:2})+'%';}
 function esc(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
 function row(parent,html){parent.insertAdjacentHTML('beforeend',html);refreshRemoveButtons(parent);}
 function refreshRemoveButtons(parent){const buttons=parent.querySelectorAll('.remove-row');buttons.forEach(b=>b.disabled=parent.children.length<=1);}
 function flourRow(kind){return kind==='build'
  ? '<div class="ingredient-row flour-row"><div class="row-name"><label>Flour name</label><input class="flour-name" type="text" value="Whole wheat" maxlength="48" aria-label="Flour name"></div><div><label>Share (%)</label><input class="flour-share" type="number" min="0" max="100" step="0.1" value="0" aria-label="Flour share percent"></div><button class="secondary remove-row" type="button">Remove</button></div>'
  : '<div class="ingredient-row check-flour-row"><div class="row-name"><label>Flour name</label><input class="check-flour-name" type="text" value="Whole wheat" maxlength="48" aria-label="Flour name"></div><div><label>Weight (<span class="unit-label">'+unitNames[state.unit]+'</span>)</label><input class="check-flour-weight weight-input" type="number" min="0" step="any" value="0" aria-label="Flour weight"></div><button class="secondary remove-row" type="button">Remove</button></div>';
 }
 function liquidRow(){return '<div class="ingredient-row liquid-row"><div class="row-name"><label>Ingredient</label><input class="liquid-name" type="text" value="Milk" maxlength="48" aria-label="Liquid ingredient name"></div><div><label>Weight (<span class="unit-label">'+unitNames[state.unit]+'</span>)</label><input class="liquid-mass weight-input" type="number" min="0" step="any" value="0" aria-label="Liquid weight"></div><div><label>Water (%)</label><input class="liquid-water" type="number" min="0" max="100" step="any" value="87" aria-label="Water fraction percent"></div><button class="secondary remove-row" type="button">Remove</button></div>';}
 function readFlours(parent,kind){
  return [...parent.querySelectorAll(kind==='build'?'.flour-row':'.check-flour-row')].map(r=>kind==='build'
   ? {name:r.querySelector('.flour-name').value,sharePct:Number(r.querySelector('.flour-share').value)}
   : {name:r.querySelector('.check-flour-name').value,mass:engine.toGrams(r.querySelector('.check-flour-weight').value,state.unit),sharePct:100});
 }
 function readLiquids(parent){return [...parent.querySelectorAll('.liquid-row')].map(r=>({name:r.querySelector('.liquid-name').value,mass:engine.toGrams(r.querySelector('.liquid-mass').value,state.unit),waterFraction:Number(r.querySelector('.liquid-water').value)/100}));}
 function setStatus(message,isError){error.textContent=isError?message:'';error.classList.toggle('error',!!isError);if(!isError&&message)actionStatus.textContent=message;}
 function hideResult(){resultCard.classList.remove('visible');scalePanel.hidden=true;state.last=null;state.lastRecipe=null;state.lastText='';actionStatus.textContent='';}
 function stat(label,value){return '<div class="result-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>';}
 function line(label,value){return '<div class="recipe-line"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';}
 function buildIngredients(data){return [
  ...data.flourRows.map(x=>({name:x.name,mass:x.mass})),
  {name:'Water to add',mass:data.waterToAdd},
  {name:'Starter / levain',mass:data.starter.mass},
  {name:'Salt',mass:data.saltMass},
  ...data.liquidRows.map(x=>({name:x.name,mass:x.mass}))
 ];}
 function checkIngredients(input){return [
  ...input.flours.map(x=>({name:x.name,mass:x.mass})),
  {name:'Added water',mass:input.water},
  {name:'Starter / levain',mass:input.starterMass},
  {name:'Salt',mass:input.saltMass},
  ...input.liquids.map(x=>({name:x.name,mass:x.mass}))
 ];}
 function renderResult(title,stats,lines,explanation,ingredients,totalDough){
  resultCard.classList.add('visible');
  $('result-title').textContent=title;
  resultStats.innerHTML=stats.map(x=>stat(x[0],x[1])).join('');
  resultLines.innerHTML=lines.map(x=>line(x[0],x[1])).join('');
  resultExplanation.textContent=explanation;
  scalePanel.hidden=false;
  state.lastRecipe={totalDough,ingredients};
  state.lastText=[title,...stats.map(x=>x[0]+': '+x[1]),...lines.map(x=>x[0]+': '+x[1]),'Ingredients:',...ingredients.map(x=>x.name+': '+fmt(x.mass)+' '+state.unit)].join('\n');
  actionStatus.textContent='';
 }
 function calculateBuild(){
  hideResult();error.textContent='';
  const data=engine.calculateBuild({
   basis:$('build-basis').value,targetAmount:grams('build-target'),
   hydrationPct:number('build-hydration'),starterPct:number('build-starter-pct'),
   starterHydrationPct:number('build-starter-hydration'),saltPct:number('build-salt'),
   flours:readFlours($('build-flours'),'build'),liquids:readLiquids($('build-liquids'))
  });
  state.last=data;
  const stats=[['True hydration',pct(data.trueHydrationPct)],['Total dough',fmt(data.totalDough)+' '+state.unit],['Total flour',fmt(data.totalFlour)+' '+state.unit],['Total water',fmt(data.totalWater)+' '+state.unit]];
  const lines=[
   ...data.flourRows.map(x=>[x.name+' to add',fmt(x.mass)+' '+state.unit]),
   ['Water to add',fmt(data.waterToAdd)+' '+state.unit],
   ['Starter total',fmt(data.starter.mass)+' '+state.unit],
   ['Starter flour',fmt(data.starter.flour)+' '+state.unit],
   ['Starter water',fmt(data.starter.water)+' '+state.unit],
   ['Salt',fmt(data.saltMass)+' '+state.unit],
   ['Starter (% of total flour)',pct(data.starterPct)],
   ['Prefermented flour (% of total flour)',pct(data.prefermentedFlourPct)],
   ...data.liquidRows.map(x=>[x.name+' (total)',fmt(x.mass)+' '+state.unit])
  ];
  if(data.liquidRows.length) lines.push(['Water from added liquids',fmt(data.liquidWater)+' '+state.unit]);
  const ingredients=buildIngredients(data);
  renderResult('Your sourdough recipe',stats,lines,'True hydration includes the starter’s water and any water fraction declared for optional liquids. Starter percentage means starter mass ÷ total flour; prefermented flour is shown separately.',ingredients,data.totalDough);
  setStatus('Recipe calculated. Values are based on the full flour and water totals.',false);
  return data;
 }
 function calculateCheck(){
  hideResult();error.textContent='';
  const input={
   flours:readFlours($('check-flours'),'check'),water:grams('check-water'),
   starterMass:grams('check-starter'),starterHydrationPct:number('check-starter-hydration'),
   saltMass:grams('check-salt'),liquids:readLiquids($('check-liquids'))
  };
  const data=engine.calculateCheck(input);state.last=data;
  const stats=[['True hydration',pct(data.trueHydrationPct)],['Total dough',fmt(data.totalDough)+' '+state.unit],['Total flour',fmt(data.totalFlour)+' '+state.unit],['Total water',fmt(data.totalWater)+' '+state.unit]];
  const lines=[
   ['Flour you added',fmt(data.flourAdded)+' '+state.unit],
   ['Starter flour',fmt(data.starter.flour)+' '+state.unit],
   ['Starter water',fmt(data.starter.water)+' '+state.unit],
   ['Added water only',fmt(data.waterAdded)+' '+state.unit],
   ['Starter (% of total flour)',pct(data.starterPct)],
   ['Prefermented flour (% of total flour)',pct(data.prefermentedFlourPct)],
   ['Salt',fmt(data.saltMass)+' '+state.unit],
   ['Salt percentage',pct(data.saltPct)],
   ['Added-water hydration (not true hydration)',pct(data.addedWaterHydrationPct)]
  ];
  if(data.liquidRows.length)lines.push(['Water from added liquids',fmt(data.liquidWater)+' '+state.unit]);
  renderResult('Your recipe analysis',stats,lines,'True hydration uses all flour and water, including the starter. Added-water hydration is shown separately and should not be confused with total dough hydration.',checkIngredients(input),data.totalDough);
  setStatus('Recipe checked. Starter flour and water are included in the totals.',false);
  return data;
 }
 function calculateFeed(){
  hideResult();error.textContent='';
  const data=engine.calculateFeed({
   targetMass:grams('feed-target'),seedRatio:number('feed-seed'),
   flourRatio:number('feed-flour'),waterRatio:number('feed-water'),
   seedHydrationPct:number('feed-seed-hydration')
  });state.last=data;
  const stats=[['Target starter',fmt(data.targetMass)+' '+state.unit],['Resulting hydration',pct(data.resultingHydrationPct)],['Feed ratio',data.ratio.join(' : ')]];
  const lines=[
   ['Existing starter / seed',fmt(data.seed)+' '+state.unit],
   ['Flour in seed',fmt(data.seedFlour)+' '+state.unit],
   ['Water in seed',fmt(data.seedWater)+' '+state.unit],
   ['Fresh flour to add',fmt(data.flour)+' '+state.unit],
   ['Fresh water to add',fmt(data.water)+' '+state.unit],
   ['Total flour after feeding',fmt(data.totalFlour)+' '+state.unit],
   ['Total water after feeding',fmt(data.totalWater)+' '+state.unit]
  ];
  const ingredients=[{name:'Starter seed',mass:data.seed},{name:'Flour',mass:data.flour},{name:'Water',mass:data.water}];
  renderResult('Starter feeding amounts',stats,lines,'This is a weight ratio calculation only. It does not predict peak time, fermentation speed or starter readiness.',ingredients,data.targetMass);
  scalePanel.hidden=true;
  setStatus('Starter feeding ratio calculated.',false);
  return data;
 }
 function run(fn){try{setStatus('',false);fn();}catch(e){hideResult();setStatus(e.message||'Check the entered values.',true);}}
 function setMode(mode){
  state.mode=mode;
  ['build','check','feed'].forEach(name=>{
   $('panel-'+name).hidden=name!==mode;
   $('mode-'+name).setAttribute('aria-selected',String(name===mode));
  });
  hideResult();error.textContent='';
 }
 function resetBuild(){ $('build-basis').value='total-flour';$('build-target').value='500';$('build-hydration').value='75';$('build-starter-pct').value='20';$('build-starter-hydration').value='100';$('build-salt').value='2';$('build-flours').innerHTML=flourRow('build').replace('Whole wheat','Bread flour').replace('value="0" aria-label="Flour share','value="100" aria-label="Flour share');$('build-liquids').innerHTML='';refreshRemoveButtons($('build-flours'));$('build-target-hint').textContent='Total flour, including flour inside the starter.';hideResult();}
 function resetCheck(){$('check-water').value='325';$('check-starter').value='100';$('check-starter-hydration').value='100';$('check-salt').value='10';$('check-flours').innerHTML='<div class="ingredient-row check-flour-row"><div class="row-name"><label>Flour name</label><input class="check-flour-name" type="text" value="Bread flour" maxlength="48" aria-label="Flour name"></div><div><label>Weight (<span class="unit-label">'+state.unit+'</span>)</label><input class="check-flour-weight weight-input" type="number" min="0" step="any" value="'+fmt(450)+'" aria-label="Flour weight"></div><button class="secondary remove-row" type="button" disabled>Remove</button></div>';$('check-liquids').innerHTML='';hideResult();}
 function resetFeed(){$('feed-target').value=fmt(200);$('feed-seed').value='1';$('feed-flour').value='2';$('feed-water').value='2';$('feed-seed-hydration').value='100';hideResult();}
 function resetCurrent(){if(state.mode==='build')resetBuild();else if(state.mode==='check')resetCheck();else resetFeed();error.textContent='';}
 function updateBuildBasis(){const target=$('build-basis').value;$('build-target-hint').textContent=target==='total-dough'?'Finished dough weight, including salt and the non-water portion of optional additions.':(target==='added-flour'?'Flour weight you add outside the starter. Starter flour is calculated on top.':'Total flour, including flour inside the starter.');}
 function updateUnitLabels(){document.querySelectorAll('.unit-label').forEach(el=>el.textContent=state.unit);$('build-target').previousElementSibling.innerHTML='Target weight ('+state.unit+')';}
 function changeUnit(next){
  if(next===state.unit)return;
  const old=state.unit;document.querySelectorAll('.weight-input:not(#build-target)').forEach(input=>{
   if(input.value==='')return;
   const gramsValue=engine.toGrams(input.value,old);
   input.value=engine.fromGrams(gramsValue,next).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  });
  const target=$('build-target');target.value=engine.fromGrams(engine.toGrams(target.value,old),next).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  state.unit=next;updateUnitLabels();hideResult();
 }
 function formatRecipe(ingredients,totalDough){
  return ['Sourdough recipe — ZemTools','Total dough: '+fmt(totalDough)+' '+state.unit,'',...ingredients.map(x=>x.name+': '+fmt(x.mass)+' '+state.unit)].join('\n');
 }
 function copyText(text){
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard access is unavailable in this browser.'));
 }
 function share(){
  if(!state.lastRecipe)throw new Error('Calculate a recipe before creating a share link.');
  const payload={title:$('result-title').textContent,totalDough:state.lastRecipe.totalDough,unit:state.unit,ingredients:state.lastRecipe.ingredients};
  const url=new URL(location.href);url.searchParams.set('recipe',JSON.stringify(payload));
  if(url.href.length>7000)throw new Error('This recipe is too detailed for a share link. Copy or print it instead.');
  history.replaceState(null,'',url.pathname+url.search);
  copyText(url.href).then(()=>{actionStatus.textContent='Share link copied to clipboard.';}).catch(()=>{actionStatus.textContent='Share link created. Copy the page address from your browser.';});
 }
 function showShared(){
  const raw=new URL(location.href).searchParams.get('recipe');if(!raw)return;
  try{
   const data=JSON.parse(raw);if(!data||!Array.isArray(data.ingredients)||data.ingredients.length>100)return;
   if(unitNames[data.unit]){state.unit=data.unit;unitSelect.value=data.unit;updateUnitLabels();}
   const box=$('shared-recipe');box.textContent='Shared recipe link: '+String(data.title||'Sourdough recipe')+' — '+String(data.ingredients.length)+' ingredients. Calculate a new recipe below to replace these shared details.';
   box.classList.add('visible');
   const sharedText=formatRecipe(data.ingredients,data.totalDough||0);
   state.lastRecipe={totalDough:Number(data.totalDough)||0,ingredients:data.ingredients.map(x=>({name:String(x.name||'Ingredient'),mass:Number(x.mass)||0}))};
   state.lastText=sharedText;
   renderResult('Shared sourdough recipe', [['Total dough',fmt(state.lastRecipe.totalDough)+' '+state.unit]],state.lastRecipe.ingredients.map(x=>[x.name,fmt(x.mass)+' '+state.unit]),'This recipe was shared by link. Review ingredient amounts before using it.',state.lastRecipe.ingredients,state.lastRecipe.totalDough);
  }catch(_){}
 }
 function scale(){
  if(!state.lastRecipe)throw new Error('Calculate a recipe first.');
  const mode=$('scale-mode').value;const value=number('scale-value');
  const request={recipe:state.lastRecipe};
  if(mode==='target')request.targetDoughMass=engine.toGrams(value,state.unit);else request.multiplier=value;
  const scaled=engine.scaleRecipe(request);
  $('scale-status').textContent='Scaled total: '+fmt(scaled.targetDoughMass)+' '+state.unit+' ('+scaled.multiplier.toFixed(3)+'×). '+scaled.ingredients.map(x=>x.name+': '+fmt(x.mass)+' '+state.unit).join(' · ');
 }
 function updateScaleMode(){$('scale-value-label').textContent=$('scale-mode').value==='target'?'Target dough weight ('+state.unit+')':'Multiplier (×)';$('scale-value').value=$('scale-mode').value==='target'?fmt(state.lastRecipe?.totalDough||885):'2';}
 function downloadCsv(){
  if(!state.lastRecipe)throw new Error('Calculate a recipe before downloading a CSV.');
  const rows=[['Ingredient','Weight','Unit'],...state.lastRecipe.ingredients.map(x=>[x.name,fmt(x.mass),state.unit]),['Total dough',fmt(state.lastRecipe.totalDough),state.unit]];
  const csv=rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\\r\\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download='sourdough-recipe.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  actionStatus.textContent='CSV file prepared.';
 }
 function applyPreset(name){
  const presets={everyday:70,country:75,open:82};if(!presets[name])return;
  setMode('build');$('build-hydration').value=String(presets[name]);
  $('build-basis').value='total-flour';$('build-starter-pct').value='20';$('build-starter-hydration').value='100';$('build-salt').value='2';
  $('build-target').value=String(engine.fromGrams(500,state.unit));updateBuildBasis();hideResult();clearStatuses();
 }
 function clearStatuses(){error.textContent='';actionStatus.textContent='';$('scale-status').textContent='';}

 $('mode-build').addEventListener('click',()=>setMode('build'));
 $('mode-check').addEventListener('click',()=>setMode('check'));
 $('mode-feed').addEventListener('click',()=>setMode('feed'));
 $('build-basis').addEventListener('change',updateBuildBasis);
 $('add-build-flour').addEventListener('click',()=>row($('build-flours'),flourRow('build')));
 $('add-check-flour').addEventListener('click',()=>row($('check-flours'),flourRow('check')));
 $('add-build-liquid').addEventListener('click',()=>row($('build-liquids'),liquidRow()));
 $('add-check-liquid').addEventListener('click',()=>row($('check-liquids'),liquidRow()));
 document.addEventListener('click',event=>{const b=event.target.closest('.remove-row');if(!b||b.disabled)return;const parent=b.closest('.row-list');b.closest('.ingredient-row').remove();refreshRemoveButtons(parent);});
 $('calculate-build').addEventListener('click',()=>run(calculateBuild));
 $('calculate-check').addEventListener('click',()=>run(calculateCheck));
 $('calculate-feed').addEventListener('click',()=>run(calculateFeed));
 $('reset-build').addEventListener('click',resetBuild);
 $('reset-check').addEventListener('click',resetCheck);
 $('reset-feed').addEventListener('click',resetFeed);
 $('reset-current').addEventListener('click',()=>{resetCurrent();clearStatuses();});
 unitSelect.addEventListener('change',()=>changeUnit(unitSelect.value));
 $('scale-mode').addEventListener('change',updateScaleMode);
 document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>applyPreset(button.dataset.preset)));
 $('download-csv').addEventListener('click',()=>run(downloadCsv));
 $('scale-recipe').addEventListener('click',()=>run(scale));
 $('copy-recipe').addEventListener('click',()=>{try{if(!state.lastRecipe)throw new Error('Calculate a recipe first.');copyText(formatRecipe(state.lastRecipe.ingredients,state.lastRecipe.totalDough)).then(()=>{actionStatus.textContent='Recipe copied to clipboard.';}).catch(()=>{actionStatus.textContent='Select the recipe text after printing, or allow clipboard access in your browser.';});}catch(e){setStatus(e.message,true);}});
 $('share-recipe').addEventListener('click',()=>run(share));
 $('print-recipe').addEventListener('click',()=>{if(!state.lastRecipe){setStatus('Calculate a recipe before printing.',true);return;}window.print();});
 document.querySelectorAll('.faq button').forEach(button=>button.addEventListener('click',()=>{const item=button.closest('.faq');const open=item.classList.toggle('open');button.setAttribute('aria-expanded',String(open));button.querySelector('.faq-icon').textContent=open?'−':'+';}));
 updateBuildBasis();updateUnitLabels();resetBuild();resetCheck();resetFeed();showShared();
})();
