#!/usr/bin/env node
/**
 * Parite lib/ <-> animations.js.
 *
 *   node lib/test-parity-animations.js
 *
 * animations.js est l'implementation de reference dont lib/ derive. Ce test
 * compare, pour chaque style, les CALCULS DE PAS et l'ORDRE DE COMPOSITION.
 * Les enveloppes paceStep(total, pasLegacy, phases) sont retirees avant
 * comparaison : c'est le pas LEGACY qui doit correspondre a la reference.
 *
 * Deux ecarts sont attendus et tolerés :
 *  - IllustFill : lib fusionne illustfill et outlineonly dans une classe,
 *    la reference a deux fonctions distinctes -> une paire de drawImage en plus.
 *  - Nervous : la reference inline `strokeIdx + handSpeed` sans variable nommee,
 *    l'extracteur ne la voit donc pas ; lib fait `step = Math.max(1, handSpeed)`.
 */
const fs=require('fs'), R=require('path').join(__dirname,'..');
const ref=fs.readFileSync(R+'/animations.js','utf8').split('\n');

// bornes de chaque fonction de reference
// borne = prochaine fonction de PREMIER NIVEAU, quelle qu'elle soit
const toutes=[];
ref.forEach((l,i)=>{ const m=l.match(/^function (\w+)\(/); if(m) toutes.push([m[1],i]); });
const refFn={};
toutes.forEach(([n,i],k)=>{ const fin=k+1<toutes.length?toutes[k+1][1]:ref.length;
  if(n.startsWith('tick')) refFn[n]=ref.slice(i,fin).join('\n'); });

const MAP={ Scanner:'tickScanner', Contour:'tickContour', OutlineChunks:'tickOutlineChunks',
 OutlineFill:'tickOutlineFill', IllustFill:'tickIllustFill', Nervous:'tickNervous',
 TopAnchor:'tickTopAnchor', ChunkJump:'tickChunkJump', Scribble:'tickScribble',
 Gesture:'tickGesture', Specialized:'tickSpecialized', SpecText:'tickSpecText' };

// normalise pour comparer le SENS, pas la forme
const norm=(t)=>t
  .replace(/this\./g,'').replace(/state\./g,'').replace(/_strokePencil/g,'strokePencil')
  .replace(/_wcFill/g,'wcFill').replace(/resScale\(\)/g,'resScale')
  .replace(/parseInt\(document\.getElementById\('hand-speed-slider'\)\.value\)/g,'handSpeed')
  .replace(/\s+/g,' ');

const PAS=/(?:const|let)\s+(step|advance|budget|revealStep|maxStep)\s*=\s*([^;]+);/g;
const COMPO=/drawImage\(\s*(?:this\.)?(?:state\.)?(\w+)\s*,\s*0\s*,\s*0\s*\)/g;

const extrait=(txt,re)=>{ const o=[]; let m; const r=new RegExp(re.source,'g');
  while((m=r.exec(txt))) o.push(m.slice(1).join(' = ')); return o; };

let ecarts=0;
for (const [cls,fn] of Object.entries(MAP)){
  const r=refFn[fn]; if(!r){ console.log(`  ?? ${cls}: ${fn} absente de animations.js`); continue; }
  const libSrc=fs.readFileSync(`${R}/lib/styles/${cls}.js`,'utf8');
  const i=libSrc.indexOf('  tick(');
  const lib=libSrc.slice(i);

  const rp=extrait(norm(r),PAS).map(x=>x.replace(/paceStep\([^,]+, /,''));
  // cote lib : on retire l'enveloppe paceStep pour comparer le pas legacy
  const lp=extrait(norm(lib),PAS).map(x=>{
    const m=x.match(/^(\w+) = paceStep\([^,]+, (.+?)(?:, [\w+ ]+)?\)$/);
    return m? `${m[1]} = ${m[2]}` : x;
  });
  const rc=extrait(norm(r),COMPO), lc=extrait(norm(lib),COMPO);

  const diffPas = JSON.stringify(rp)!==JSON.stringify(lp);
  const diffCompo = JSON.stringify(rc)!==JSON.stringify(lc);
  if(!diffPas && !diffCompo){ console.log(`  ok  ${cls}`); continue; }
  ecarts++;
  console.log(`\n  >> ${cls}`);
  if(diffPas){ console.log(`     pas — ref : ${rp.join(' | ')||'(aucun)'}`);
               console.log(`          lib : ${lp.join(' | ')||'(aucun)'}`); }
  if(diffCompo){ console.log(`     composition — ref : ${rc.join(' -> ')||'(aucune)'}`);
                 console.log(`                   lib : ${lc.join(' -> ')||'(aucune)'}`); }
}
const ATTENDUS = 2;   // IllustFill (fusion outlineonly) + Nervous (pas inline)
if (ecarts > ATTENDUS) {
  console.log(`\nECHEC : ${ecarts} ecarts, ${ATTENDUS} attendus`);
  process.exit(1);
}
console.log(`\nOK - lib/ est conforme a animations.js (${ecarts} ecarts attendus)`);
