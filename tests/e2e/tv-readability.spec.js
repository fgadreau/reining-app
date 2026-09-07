const {test,expect}=require('@playwright/test');
const fs=require('fs');const path=require('path');
const {buildRobotShowStorageSeed,ASSOCIATION_ID,SHOW_ID}=require('./showRobotData');
const route=`/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`;
async function seed(page,names,live=false){
 const seed=buildRobotShowStorageSeed();
 if(!live){seed.json.reining_classes_v1=[];seed.json.reining_publication_states_v1={};seed.json.reining_days_v1=[];}
 seed.json['reiningApp.associations'][0].name=names==='long'?'[FICTIF] Association Méga Robot — 20260805133231-986218':'Association test';
 Object.assign(seed.json.reining_shows_v1[0],{name:names==='long'?'[FICTIF] Classique Préprod — 20260805133231-986218':'Show test',venue:'Centre équestre fictif',location:'Saint-Hyacinthe, QC'});
 await page.addInitScript(seed=>{for(const[k,v]of Object.entries(seed.raw))localStorage.setItem(k,v);for(const[k,v]of Object.entries(seed.json))localStorage.setItem(k,JSON.stringify(v));},seed);
 await page.goto(route);await expect(page.locator('.tv-header__title')).toHaveText(seed.json.reining_shows_v1[0].name);await page.evaluate(()=>document.fonts.ready);
}
async function captures(page,name){
 if(!process.env.TV_REVIEW_DIR)return;fs.mkdirSync(process.env.TV_REVIEW_DIR,{recursive:true});
 await page.screenshot({path:path.join(process.env.TV_REVIEW_DIR,name+'-signature.png'),animations:'disabled'});
 await page.locator('.tv-showscore-signature').evaluateAll(es=>es.forEach(e=>e.style.visibility='hidden'));
 await page.screenshot({path:path.join(process.env.TV_REVIEW_DIR,name+'-sans-signature.png'),animations:'disabled'});
 await page.locator('.tv-showscore-signature').evaluateAll(es=>es.forEach(e=>e.style.visibility=''));
}
async function fit(page){
 await expect.poll(()=>page.locator('.tv-welcome-panel').evaluate(p=>{const b=p.getBoundingClientRect();return [...p.children].every(e=>{if(!e.getClientRects().length)return true;const r=e.getBoundingClientRect();return r.top>=b.top && r.bottom<=b.bottom && r.left>=b.left && r.right<=b.right;});})).toBe(true);
 const qr=await page.locator('.tv-public-qr').boundingBox();expect(qr.x+qr.width).toBeLessThanOrEqual(page.viewportSize().width);
}
for(const [width,height] of [[1440,900],[1920,1080]])for(const names of ['short','long'])test(`waiting ${width} ${height} ${names}`,async({page})=>{
 await page.setViewportSize({width,height});await seed(page,names);await fit(page);
 await expect(page.locator('.tv-welcome-notice')).toContainText('The next block will appear');
 await expect(page.locator('.tv-center-logo')).toBeVisible();
 const logo=page.locator('.tv-showscore-signature');await expect(logo).toBeVisible();await logo.evaluate(i=>i.decode());
 if(width===1920 && names==='short')await expect(page.locator('.tv-welcome-panel')).not.toHaveAttribute('data-welcome-fit');
 await captures(page,`waiting-${width}-${height}-${names}`);
 await page.setViewportSize({width:width===1440?1920:1440,height:height===900?1080:900});await fit(page);
 await page.setViewportSize({width,height});await fit(page);
});
test('live preserves participants, scores and QR with a secondary signature',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await seed(page,'short',true);
 await expect(page.locator('.tv-display')).toContainText('Cavalier 3');await expect(page.locator('.tv-display')).toContainText('217½');
 await captures(page,'live-1920');
});
