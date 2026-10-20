/**
 * Anatomy Figure: a question sheet inspected at four stations on a drafting bench.
 * Offline geometry only. Run: node src/lib/engagement-instrument-build.mjs --audit
 * Requires the installed Anatomy skill; no kit code reaches the browser.
 * Parts: four leveling pads + four risers; bed, inset mat, three paper sheets;
 * four sheet clamps + eight clamp screws; two rail seats + two towers + caps;
 * rail, ruler, two stops + two fasteners; four station registration plates;
 * inspection carriage, two bearing blocks, two bearing screws + two carriage screws, arm, head,
 * shoe, four shoe retainers, cap, stem, handwheel, eight grip teeth.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const kitRoot = process.env.ANATOMY_KIT_ROOT ?? join(homedir(), '.codex/skills/anatomy/kit');
const k = await import(pathToFileURL(join(kitRoot, 'iso-kit.mjs')).href);
const A = await import(pathToFileURL(join(kitRoot, 'audit.mjs')).href);
const W = 600, H = 370;
const base = {x:-150,y:-78,w:300,d:164,r:8};
const P = k.fitProjection(k.boxCorners(base,-15,73),W,H,{pad:32,azimuth:65,elevation:38});
const R = A.recorder(P);
// The export bakes the project's canonical tokens into standalone SVG assets.
const theme = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const token = name => {
 const found = theme.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
 if (!found) throw new Error(`Missing design token: ${name}`);
 return found[1];
};
const paper=token('--color-paper'),navy=token('--color-mecg-navy');
const orange=token('--color-mecg-orange'),orangeInk=token('--color-mecg-orange-ink');
const mix=(a,b,part)=>`color-mix(in srgb, ${a} ${part}%, ${b})`;
const colors = `.iso-fill{fill:${paper}}.iso-shade[data-shade="0"]{fill:${mix(paper,navy,72)}}.iso-shade[data-shade="1"]{fill:${mix(paper,navy,79)}}.iso-shade[data-shade="2"]{fill:${mix(paper,navy,85)}}.iso-shade[data-shade="3"]{fill:${mix(paper,navy,92)}}.iso-top{fill:${mix(paper,navy,95)}}.paper .iso-top{fill:${mix(paper,'white',32)}}.dark .iso-top{fill:${mix(navy,paper,86)}}.dark .iso-shade{fill:${mix(navy,paper,94)}}.dark .iso-line{stroke:${paper};stroke-opacity:.36}.lit .iso-top{fill:${orange}}.lit .iso-shade[data-shade="0"]{fill:${orangeInk}}.lit .iso-shade[data-shade="1"]{fill:${mix(orangeInk,orange,75)}}.lit .iso-shade[data-shade="2"]{fill:${mix(orangeInk,orange,45)}}.lit .iso-shade[data-shade="3"]{fill:${mix(orange,paper,85)}}.iso-line{fill:none;stroke:${navy};stroke-width:.65;stroke-linejoin:round;stroke-linecap:round;stroke-opacity:.62}.iso-line[data-tone="faint"]{stroke-opacity:.22}.iso-line[data-tone="lo"]{stroke-opacity:.38}.iso-line[data-tone="hi"]{stroke-opacity:.8}.iso-bevel{stroke-opacity:.25}`;
const rect=(x,y,w,d,r=1)=>({x,y,w,d,r});
let n=0;
function slab(name,plan,z,h,{cls='',extra='',moving=false,bevel=.4}={}) {
 const shape=R.solid(A.slab(plan,z,h,{name,ground:z===-15},5));
 const svg=k.solidSvg(k.slabOf(plan,z,h,P,5,Math.min(bevel,h/3)),{className:cls,inner:extra});
 R.put({name,at:[plan.x+plan.w/2,plan.y+plan.d/2,z+h/2],svg,shapes:[shape],piece:moving?'head':'bench',move:moving?[180,0,0]:[0,0,0]});n++;
}
const line=(points,z,free=false)=>k.lineSvg(k.onTop(points,z,P),{tone:'lo',free});
const outline=(plan,z)=>k.lineSvg(k.planOutline(plan,z,P,5),{tone:'faint'});
function screw(name,x,y,z,moving=false){ slab(name,rect(x-1.8,y-1.8,3.6,3.6,1.4),z,.8,{moving,extra:line([[x-1,y],[x+1,y]],z+.8,true)}); }
for(const [i,[x,y]] of k.corners(base,20).entries()){
 slab(`level-pad-${i}`,rect(x-8,y-7,16,14,4),-15,3,{cls:'dark'});
 slab(`level-riser-${i}`,rect(x-5,y-4,10,8,2),-12,5);
}
slab('cast-bed',base,-7,7,{bevel:1.2,extra:outline(k.insetPlan(base,5),0)});
for(const [i,[x,y]] of k.corners(base,11).entries())screw(`bed-screw-${i}`,x,y,0);
slab('drafting-mat',rect(-128,-29,256,97,3),0,1.2,{cls:'dark'});
for(let i=0;i<3;i++)slab(`question-sheet-${i}`,rect(-120+i*1.3,-21-i*1.3,240,81,1),1.2+i*.55,.55,{cls:'paper',bevel:0});
// Printed rules denote text; they are intentionally free-ended, not structural lines.
for(const [i,x] of [-90,-30,30,90].entries()){
 let rules='';
 for(let row=0;row<5;row++) rules+=line([[x-19,8+row*6],[x+([17,12,17,7,14][row]),8+row*6]],2.85,true);
 rules+=outline(rect(x-19,-12,38,12,.5),2.85);
 const sheet=R.items.find(item=>item.name==='question-sheet-2');
 sheet.svg=sheet.svg.replace('</g>',rules+'</g>');
 slab(`station-register-${i}`,rect(x-20,47,40,6,.5),2.85,.35,{cls:'paper',bevel:0});
}
for(const [i,[x,y]] of [[-114,-18],[114,-18],[-114,55],[114,55]].entries()){
 slab(`paper-clamp-${i}`,rect(x-6,y-3,12,6,1),2.85,2,{extra:outline(rect(x-4,y-1.3,8,2.6,.6),4.85)});
 screw(`clamp-fastener-${i}-a`,x-3,y,4.85);screw(`clamp-fastener-${i}-b`,x+3,y,4.85);
}
for(const [i,x] of [-135,135].entries()){
 slab(`rail-seat-${i}`,rect(x-8,-65,16,22,2),0,4);
 screw(`seat-screw-${i}`,x,-61,4);
 slab(`rail-tower-${i}`,rect(x-5,-56,10,12,1),4,36);
 slab(`rail-cap-${i}`,rect(x-8,-60,16,20,2),49,5);
 screw(`cap-screw-${i}`,x,-50,54);
}
slab('precision-rail',rect(-135,-55,270,9,1.4),40,9,{bevel:.8});
const ruler=rect(-124,-49,248,4,.3);
const ticks=k.topTicks(-120,120,4,5,-45,49.45,[-1.5,-3],P);
slab('ruler-strip',ruler,49,.45,{extra:k.lineSvg(ticks.minor,{tone:'faint'})+k.lineSvg(ticks.major,{tone:'lo'}),bevel:0});
for(const [i,x] of [-118,118].entries()){
 slab(`travel-stop-${i}`,rect(x-3,-58,6,20,1),49.45,4);
 screw(`stop-screw-${i}`,x,-49,53.45);
}
// Moving assembly rests at station 01 (x=-90); all pieces share one translation.
const x=-90;
for(const [i,bx] of [x-13,x+7].entries()){
 slab(`bearing-${i}`,rect(bx,-57,6,23,1),49.45,5,{moving:true});
 screw(`bearing-screw-${i}`,bx+3,-35,54.45,true);
}
slab('carriage',rect(x-16,-59,32,22,2),54.45,6,{moving:true,bevel:.8,extra:outline(rect(x-12,-55,24,14,1),60.45)});
for(const [i,bx] of [x-11,x+11].entries())screw(`carriage-screw-${i}`,bx,-53,60.45,true);
slab('inspection-arm',rect(x-4,-37,8,47,1),54.45,5,{moving:true,extra:outline(rect(x-2,-35,4,42,.7),59.45)});
slab('head-stem',rect(x-3,2,6,10,1),26,28.45,{moving:true});
slab('inspection-head',rect(x-12,-2,24,22,3),11,12,{moving:true,extra:outline(rect(x-9,1,18,16,2),23)});
slab('head-cap',rect(x-13,-3,26,24,3),23,3,{moving:true});
// A physical open inspection shoe: four edges, not a filled screen or a score.
for(const [i,p] of [rect(x-21,-10,42,3,1),rect(x-21,28,42,3,1),rect(x-21,-7,3,35,1),rect(x+18,-7,3,35,1)].entries())slab(`inspection-shoe-${i}`,p,7,4,{moving:true,cls:'lit'});
for(const [i,[sx,sy]] of [[x-19,-8],[x+19,-8],[x-19,29],[x+19,29]].entries())screw(`shoe-retainer-${i}`,sx,sy,11,true);
slab('shoe-neck',rect(x-4,17,8,11,1),7,4,{moving:true});
slab('wheel-neck',rect(x-2,-50,4,6,1),60.45,3,{moving:true});
slab('thumbwheel',rect(x-7,-54,14,14,0),63.45,5,{moving:true,extra:outline(rect(x-4,-51,8,8,3),68.45)});
for(let i=0;i<4;i++){
 slab(`grip-back-${i}`,rect(x-5+i*3,-56,1.5,2,.4),63.45,5,{moving:true});
 slab(`grip-front-${i}`,rect(x-5+i*3,-40,1.5,2,.4),63.45,5,{moving:true});
}
const states=Array.from({length:13},(_,i)=>({shares:{head:i/12,bench:0}}));
A.settle(R,P,{states});
// Explicitly group the two exported image layers, then audit their actual paint order.
// This does not excuse overlaps: auditOrExit still tests every overlap at every pose.
const movingKeys = R.items.filter(item => item.piece === 'head').map(item => item.key);
const benchKeys = R.items.filter(item => item.piece === 'bench').map(item => item.key);
const layerOffset = Math.max(...benchKeys) - Math.min(...movingKeys) + 1;
for (const item of R.items) if (item.piece === 'head') item.key += layerOffset;
const ordered=[...R.items].sort((a,b)=>a.key-b.key);
const moving=ordered.filter(i=>i.piece==='head');
const back=ordered.filter(i=>i.piece==='bench');
const svg=items=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>${colors}</style>${items.map(i=>i.svg).join('')}</svg>`;
const dir=new URL('../../public/images/engagement-instrument/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const [name,items] of [['bench',back],['head',moving]])writeFileSync(new URL(`${name}.svg`,dir),svg(items));
const origin=k.iso([0,0,0],P),shift=k.iso([60,0,0],P);
writeFileSync(new URL('./engagement-instrument-model.ts',import.meta.url),`// Generated by engagement-instrument-build.mjs; no runtime geometry.\nexport const STATION_SHIFT = { x: ${(shift[0]-origin[0]).toFixed(6)}, y: ${(shift[1]-origin[1]).toFixed(6)} };\nexport const INSTRUMENT_PARTS = ${n};\n`);
console.log(JSON.stringify({parts:n,layers:[back.length,moving.length],shift:[shift[0]-origin[0],shift[1]-origin[1]],orderRules:R.settled.solved.rules}));
A.auditOrExit(R,P,{frames:states,apart:false});
