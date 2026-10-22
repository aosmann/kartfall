/* Kartfall — kart racing quiz for the EduGames portal.
   Three.js r128 (pinned, local). Scenery props: Kenney Starter Kit Racing (CC0). Sounds: Kenney (CC0) + Web Audio synth.
   Sections: PORTAL EMBED · TRACKS · SETTINGS · MENUS · AUDIO · RENDERER · TRACK GEOMETRY · WORLD · KARTS · PADS/OBSTACLES/COINS ·
   LAYOUT · RACE · PEERS · INPUT · HUD · SPECTATE · LOOP · BOOT */
(()=>{
const $=id=>document.getElementById(id);
const {SUBJECTS,SICON,SHUE,DIFFNAME,stream}=EduQ;
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
const P=new URLSearchParams(location.search);
const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH=matchMedia('(pointer:coarse)').matches;
const PHONE=TOUCH&&Math.min(screen.width,screen.height)<700;
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return s[(v-20)%10]||s[v]||s[0]};
const fmtT=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return `${m}:${s<10?'0':''}${s.toFixed(1)}`};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hexStr=c=>'#'+new THREE.Color(c).getHexString();

/* ======================= PORTAL EMBED (edugames contract v1 + race extension) =======================
   ?topic=<id>&level=1-3&laps=2|3|5&track=meadow|desert|snow|beach&regions=eu,as&lock=1 → settings from the portal, race starts at once.
   lock=1 (class mode): no replay, no topic menu. Posts edu-ready, edu-progress after every answer, edu-result at the end.
   Race mode (embedded only): &race=1&seed=<n>[&me=<id>] → same track + layout for everyone, waits for {type:'edu-go'},
   posts {type:'edu-state',state:{d,x,lap,speed,fin}} ~6×/s, draws classmates from {type:'edu-peers',peers:[…]}. No bots.
   Teacher view: ?spectate=1&seed=<n>&laps=<n>&track=<id> → overview, live ranking, podium. */
const EMBED=(()=>{if(!P.get('topic'))return null;
  return{topic:P.get('topic'),level:+P.get('level')||0,laps:+P.get('laps')||0,track:P.get('track')||'',lock:P.get('lock')==='1'}})();
const EMBED_REG=EMBED?(EduQ.parseRegions?EduQ.parseRegions(P.get('regions'))||EduQ.REGIONS.map(r=>r.id):null):null;
let lastAns=null;/* the last answer rides on the next edu-progress, for the portal's mistakes report */
const toParent=m=>{try{if(m&&m.type==='edu-progress'&&lastAns){m.last=lastAns;lastAns=null}if(window.parent!==window)window.parent.postMessage(m,'*')}catch(e){}};
const SPECTATE=P.get('spectate')==='1';
const RACE=!!EMBED&&!SPECTATE&&P.get('race')==='1';
const SEED=Math.abs(parseInt(P.get('seed'),10)||0);
const ME=P.get('me');

/* ======================= TRACKS (hand-made; [x, z, height]) ======================= */
const TRACKS=[
 {id:'meadow',name:'Sunny Meadow',sub:'Rolling hills · big jump',jumps:[.42],
  pts:[[-60,-140,0],[60,-140,0],[160,-130,0],[220,-70,1],[210,10,3],[150,40,5],[100,90,6],[130,160,4],[60,210,2],[-40,190,1],[-90,120,2],[-170,110,1],[-230,40,0],[-200,-60,0],[-140,-130,0]]},
 {id:'desert',name:'Canyon Run',sub:'Red rocks · two jumps',jumps:[.3,.78],
  pts:[[-80,-160,0],[60,-160,0],[170,-150,0],[230,-90,2],[200,-20,6],[120,0,8],[70,60,5],[140,130,2],[110,210,0],[0,200,0],[-60,130,3],[-140,170,4],[-230,120,2],[-240,20,0],[-180,-60,0],[-160,-140,0]]},
 {id:'snow',name:'Frosty Peaks',sub:'Mountain climb · icy bends',jumps:[.62],
  pts:[[-100,-120,0],[30,-130,0],[140,-120,2],[205,-55,6],[175,25,11],[85,15,13],[35,75,10],[90,145,7],[25,215,4],[-80,212,6],[-160,185,8],[-170,115,9],[-120,60,7],[-160,0,4],[-205,-70,1]]},
 {id:'beach',name:'Beach Bay',sub:'Seaside bridge · easy',jumps:[.16],
  pts:[[-90,-120,0],[60,-125,0],[170,-110,0],[240,-40,3],[250,50,7],[190,115,7],[110,95,7],[40,140,7],[-50,120,6],[-130,160,3],[-215,110,1],[-240,20,0],[-190,-80,0]]},
];
const THEMES={
 meadow:{sky:[0x3d9cff,0xe3f5ff],fog:0xd9f0ff,ground:['#7bcb55','#70c04b'],verge:0x86d05e,skirt:0x5ea844,hills:[0x6fb86a,0x8fcf7f],kerb:[0xe63946,0xffffff],rail:0xf4f7fb,post:0x8f9db3,obst:'hay'},
 desert:{sky:[0x3a8de0,0xffe7c2],fog:0xf7e2bf,ground:['#ebc684','#e2b973'],verge:0xdcae68,skirt:0xc98b4b,hills:[0xc9693c,0xe08a52],kerb:[0xd62839,0xffffff],rail:0xfff3df,post:0x9e6b41,obst:'barrels'},
 snow:{sky:[0x5d9fe6,0xf0f7ff],fog:0xeaf3fc,ground:['#f6f9fd','#e9f0f8'],verge:0xe3ecf6,skirt:0xd2deea,hills:[0xc9d8ea,0xffffff],kerb:[0x2563eb,0xffffff],rail:0xffffff,post:0x74859b,obst:'snowman'},
 beach:{sky:[0x2c98ff,0xdaf6ff],fog:0xcfefff,ground:null,sand:0xf3d99d,verge:0xf0d394,skirt:0xe4c482,hills:[0x5aae78,0x7cc48f],kerb:[0xff7a1a,0xffffff],rail:0xffffff,post:0x7b8ea6,obst:'ball'},
};
const trackById=id=>TRACKS.find(t=>t.id===id)||TRACKS[0];

/* ======================= SETTINGS ======================= */
const LAP_OPTS=[2,3,5];
const cfg={subject:'math',topic:'times',diffs:{},laps:3,track:'meadow',cam:'chase'};
try{const s=JSON.parse(localStorage.getItem('kartfall-cfg2')||'{}');Object.assign(cfg,s);if(!cfg.diffs)cfg.diffs={}}catch(e){}
if(!LAP_OPTS.includes(+cfg.laps))cfg.laps=3;cfg.laps=+cfg.laps;cfg.track=trackById(cfg.track).id;if(cfg.cam!=='cockpit')cfg.cam='chase';
const saveCfg=()=>{if(EMBED)return;try{localStorage.setItem('kartfall-cfg2',JSON.stringify(cfg))}catch(e){}};
const saveCam=()=>{try{const s=JSON.parse(localStorage.getItem('kartfall-cfg2')||'{}');s.cam=cfg.cam;localStorage.setItem('kartfall-cfg2',JSON.stringify(s))}catch(e){}};
const curSubject=()=>SUBJECTS.find(s=>s.id===cfg.subject)||SUBJECTS[0];
const curTopic=()=>{const s=curSubject();return s.topics.find(t=>t.id===cfg.topic)||s.topics[0]};
const topicDiff=tp=>cfg.diffs[tp.id]||tp.d;
const DIFF=()=>topicDiff(curTopic());
let LAPS=cfg.laps,TRACK=trackById(cfg.track);
if(SPECTATE){LAPS=clamp(+P.get('laps')||3,1,9);TRACK=trackById(P.get('track'))}
if(EMBED){if(EMBED.laps)LAPS=clamp(Math.round(EMBED.laps),1,9);if(EMBED.track)TRACK=trackById(EMBED.track)}
const bestKey=(id,d)=>`kartfall-best-${id||curTopic().id}-d${d||DIFF()}`;
const getBest=(id,d)=>{try{return +localStorage.getItem(bestKey(id,d))||0}catch(e){return 0}};
function logResult(r){
  try{const k='edu-results',a=JSON.parse(localStorage.getItem(k)||'[]');a.push(r);localStorage.setItem(k,JSON.stringify(a.slice(-200)))}catch(e){}
  toParent({type:'edu-result',result:r});
}

/* ======================= MENUS ======================= */
function renderSubjects(){const box=$('subjects');box.innerHTML='';
  SUBJECTS.forEach(s=>{const b=el('button','tile');b.type='button';b.style.setProperty('--h',SHUE[s.id]||'#2f80ff');
    const tx=el('span','tx');tx.append(el('strong',null,s.name),el('span',null,`${s.topics.filter(x=>!x.unit).length} topics`));
    const ic=el('span','sicon');ic.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${SICON[s.id]||''}</svg>`;
    b.append(ic,tx);b.onclick=()=>{if(cfg.subject!==s.id){cfg.subject=s.id;cfg.topic=s.topics[0].id}saveCfg();go('stepTopic')};box.append(b)})}
function renderTopics(){const s=curSubject(),t=curTopic();cfg.topic=t.id;$('subName').textContent=s.name;
  const box=$('topics');box.innerHTML='';
  {const o=document.getElementById('topTabs');if(o)o.remove();const tb=EduQ.topicTabs&&EduQ.topicTabs(s,t,id=>{cfg.topic=id;saveCfg();renderTopics()});if(tb){tb.id='topTabs';box.before(tb)}}
  (EduQ.topicsOf?EduQ.topicsOf(s,t):s.topics).forEach(tp=>{const b=el('button','row');b.type='button';b.setAttribute('aria-pressed',tp.id===cfg.topic);
    const tx=el('span','tx');tx.append(el('strong',null,tp.name),el('span',null,tp.regions&&EduQ.regionLabel?EduQ.regionLabel(EduQ.getRegions(tp.id)):tp.bl));
    const side=el('span');const bs=getBest(tp.id,topicDiff(tp));if(bs)side.append(el('span','best',`best ${bs}`));
    b.append(el('span','radio'),tx,side);b.onclick=()=>{cfg.topic=tp.id;saveCfg();renderTopics()};box.append(b)});
  {const old=document.getElementById('regPick');if(old)old.remove();const pk=EduQ.regionPicker&&EduQ.regionPicker(t,{onChange:renderTopics});if(pk){pk.id='regPick';box.after(pk)}}
  document.querySelectorAll('#diffSeg button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.d===DIFF()))}
document.querySelectorAll('#diffSeg button').forEach(b=>b.onclick=()=>{cfg.diffs[curTopic().id]=+b.dataset.d;saveCfg();renderTopics()});
document.querySelectorAll('#lapSeg button').forEach(b=>b.onclick=()=>{cfg.laps=+b.dataset.l;saveCfg();renderTrackStep()});
function trackThumb(tr){const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d'),th=THEMES[tr.id];
  const g=x.createLinearGradient(0,0,0,240);g.addColorStop(0,hexStr(th.sky[1]));g.addColorStop(1,th.ground?th.ground[0]:'#3fb3e0');x.fillStyle=g;x.fillRect(0,0,320,240);
  if(!th.ground){x.fillStyle='#45bde6';x.fillRect(0,0,320,240)}
  const pts=sampleOutline(tr,240);let mx=1e9,Mx=-1e9,mz=1e9,Mz=-1e9;pts.forEach(([a,b])=>{mx=Math.min(mx,a);Mx=Math.max(Mx,a);mz=Math.min(mz,b);Mz=Math.max(Mz,b)});
  const s=Math.min(260/(Mx-mx),190/(Mz-mz)),ox=160-(mx+Mx)/2*s,oy=120-(mz+Mz)/2*s;
  if(!th.ground){x.fillStyle=hexStr(th.sand);x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a*s+ox,b*s+oy):x.moveTo(a*s+ox,b*s+oy));x.closePath();x.lineWidth=40;x.strokeStyle=hexStr(th.sand);x.stroke();x.fill()}
  x.lineJoin='round';x.lineCap='round';
  const path=()=>{x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a*s+ox,b*s+oy):x.moveTo(a*s+ox,b*s+oy));x.closePath()};
  path();x.lineWidth=17;x.strokeStyle=hexStr(th.kerb[0]);x.stroke();path();x.lineWidth=12;x.strokeStyle='#4b5160';x.stroke();
  path();x.setLineDash([6,8]);x.lineWidth=1.5;x.strokeStyle='rgba(255,255,255,.8)';x.stroke();x.setLineDash([]);
  const [a,b]=pts[0];x.fillStyle='#fff';x.beginPath();x.arc(a*s+ox,b*s+oy,7,0,7);x.fill();x.fillStyle='#111';x.beginPath();x.arc(a*s+ox,b*s+oy,4,0,7);x.fill();
  return c}
function renderTrackStep(){const box=$('trackList');box.innerHTML='';
  TRACKS.forEach(tr=>{const b=el('button','trk');b.type='button';b.setAttribute('aria-pressed',tr.id===cfg.track);
    b.append(trackThumb(tr),el('strong',null,tr.name),el('span',null,tr.sub));
    b.onclick=()=>{cfg.track=tr.id;saveCfg();if(TRACK.id!==tr.id){TRACK=tr;rebuildWorld()}renderTrackStep()};box.append(b)});
  document.querySelectorAll('#lapSeg button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.l===cfg.laps));
  $('startBtn').textContent=`Start · ${curTopic().name}`}
const SCREENS=['scrHome','stepSubj','stepTopic','stepTrack'];
function go(id){SCREENS.forEach(x=>$(x).hidden=x!==id);$('sheet').classList.toggle('peek',id==='scrHome');
  ({scrHome:()=>{},stepSubj:renderSubjects,stepTopic:renderTopics,stepTrack:renderTrackStep})[id]();$('sheet').scrollTop=0;
  if(id==='stepTrack'&&TRACK.id!==cfg.track){TRACK=trackById(cfg.track);rebuildWorld()}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)});
$('playBtn').onclick=()=>go('stepSubj');

/* ======================= AUDIO: Kenney engine/skid/impact samples + gentle synth cues ======================= */
const A={ctx:null,on:true};
try{const s=JSON.parse(localStorage.getItem('kartfall-audio')||'{}');if(s.on===false)A.on=false}catch(e){}
let C,master,sfxBus,noiseBuf,engSrc=null,engG,engLP,eng1=null,eng2=null;const BUF={};
function initAudio(){
  if(A.ctx){if(A.ctx.state!=='running')A.ctx.resume();return}
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  C=A.ctx=new AC();master=C.createGain();master.gain.value=A.on?.85:0;
  const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;master.connect(comp);comp.connect(C.destination);
  sfxBus=C.createGain();sfxBus.gain.value=.8;sfxBus.connect(master);
  noiseBuf=C.createBuffer(1,C.sampleRate*2,C.sampleRate);const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  engLP=C.createBiquadFilter();engLP.type='lowpass';engLP.frequency.value=1800;engG=C.createGain();engG.gain.value=0;engLP.connect(engG);engG.connect(master);
  // AAC for Safari/iOS, OGG for browsers without AAC, synth if neither decodes
  const dec=b=>new Promise((ok,no)=>{const pr=C.decodeAudioData(b,ok,no);if(pr&&pr.catch)pr.catch(()=>{})});
  const load=(n,ext)=>fetch(`sfx/${n}.${ext}`).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(dec);
  ['engine','skid','impact'].forEach(n=>load(n,'m4a').catch(()=>load(n,'ogg')).then(buf=>{BUF[n]=buf;if(n==='engine')startEngine()}).catch(()=>{if(n==='engine')startSynthEngine()}));
}
function startEngine(){if(engSrc)return;engSrc=C.createBufferSource();engSrc.buffer=BUF.engine;engSrc.loop=true;engSrc.loopStart=.08;engSrc.loopEnd=BUF.engine.duration-.08;engSrc.connect(engLP);engSrc.start()}
function startSynthEngine(){if(eng1)return;eng1=C.createOscillator();eng1.type='sawtooth';eng2=C.createOscillator();eng2.type='square';const g2=C.createGain();g2.gain.value=.4;
  const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=500;eng1.connect(lp);eng2.connect(g2);g2.connect(lp);const g=C.createGain();g.gain.value=.35;lp.connect(g);g.connect(engLP);eng1.start();eng2.start()}
['pointerdown','touchend','click','keydown'].forEach(ev=>document.addEventListener(ev,initAudio,{capture:true}));
document.addEventListener('visibilitychange',()=>{if(!A.ctx)return;document.hidden?A.ctx.suspend():A.ctx.resume()});
const mtof=m=>440*Math.pow(2,(m-69)/12);
function env(g,t,a,peak,dur){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+dur)}
function osc(type,f,t,dur,peak,f1,a=.01){const o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);env(g,t,a,peak,dur);o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+dur+.05)}
function noise(t,dur,peak,type,f0,f1,q=1,a=.005){const s=C.createBufferSource();s.buffer=noiseBuf;const f=C.createBiquadFilter();f.type=type;f.Q.value=q;
  f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=C.createGain();env(g,t,a,peak,dur);
  s.connect(f);f.connect(g);g.connect(sfxBus);s.start(t,Math.random());s.stop(t+dur+.05)}
function sample(n,vol=.6,rate=1,dur){if(!BUF[n])return false;const s=C.createBufferSource(),g=C.createGain();s.buffer=BUF[n];s.playbackRate.value=rate;g.gain.value=vol;s.connect(g);g.connect(sfxBus);
  s.start(0,0,dur||undefined);if(dur){g.gain.setValueAtTime(vol,C.currentTime+dur-.15);g.gain.linearRampToValueAtTime(0,C.currentTime+dur)}return true}
const ok=()=>A.ctx&&A.on&&C.state==='running';
const S={
  click(){if(ok())osc('sine',1200,C.currentTime,.05,.05,800)},
  lane(){if(ok())noise(C.currentTime,.12,.04,'bandpass',900,2200,1.4)},
  light(){if(ok())osc('square',440,C.currentTime,.3,.07,null,.005)},
  go(){if(!ok())return;const t=C.currentTime;osc('square',880,t,.6,.08,null,.005);osc('sine',1760,t,.5,.04)},
  bell(){if(!ok())return;const t=C.currentTime;osc('sine',mtof(84),t,.5,.045);osc('sine',mtof(91),t+.06,.45,.03)},
  coin(){if(!ok())return;const t=C.currentTime;osc('square',mtof(95),t,.07,.035);osc('square',mtof(100),t+.06,.18,.035)},
  correct(){if(!ok())return;const t=C.currentTime;[76,80,83,88].forEach((m,i)=>osc('triangle',mtof(m),t+i*.06,.4,.09))},
  boost(){if(!ok())return;const t=C.currentTime;noise(t,1.1,.22,'bandpass',300,4200,.9,.05);osc('sawtooth',90,t,.9,.05,260,.05)},
  wrong(){if(!ok())return;const t=C.currentTime;osc('triangle',330,t,.3,.08,196);osc('triangle',262,t+.12,.35,.07,165)},
  skid(){if(!ok())return;if(!sample('skid',.45,1,1.1))noise(C.currentTime,.6,.1,'bandpass',2600,1500,6,.02)},
  hit(){if(!ok())return;if(!sample('impact',.8,.9))osc('sine',140,C.currentTime,.25,.25,55,.003)},
  jump(){if(!ok())return;osc('triangle',300,C.currentTime,.25,.07,700)},
  land(){if(!ok())return;sample('impact',.35,1.3)||osc('sine',120,C.currentTime,.15,.15,60)},
  lap(){if(!ok())return;const t=C.currentTime;[72,79,84].forEach((m,i)=>osc('triangle',mtof(m),t+i*.09,.35,.07))},
  finish(){if(!ok())return;const t=C.currentTime;[[72,0],[76,.12],[79,.24],[84,.36],[79,.54],[84,.66]].forEach(([m,d])=>{osc('triangle',mtof(m),t+d,.35,.1);osc('sine',mtof(m+12),t+d,.25,.03)})},
};
document.addEventListener('click',e=>{if(e.target.closest('button'))S.click()});
function setEngine(v,on){if(!C||!engG)return;const t=C.currentTime,k=clamp(v/VBOOST,0,1.2);
  if(engSrc)engSrc.playbackRate.setTargetAtTime(.62+k*.95,t,.1);
  if(eng1){eng1.frequency.setTargetAtTime(40+v*2.4,t,.1);eng2.frequency.setTargetAtTime(20+v*1.2,t,.1)}
  engG.gain.setTargetAtTime(on?.16+k*.12:0,t,.25)}
function paintAudio(){['sndT','mute'].forEach(i=>$(i).setAttribute('aria-pressed',A.on));$('sndT2').textContent=`Sound: ${A.on?'on':'off'}`;
  if(master)master.gain.setTargetAtTime(A.on?.85:0,C.currentTime,.08);try{localStorage.setItem('kartfall-audio',JSON.stringify({on:A.on}))}catch(e){}}
['sndT','sndT2','mute'].forEach(i=>$(i).onclick=()=>{initAudio();A.on=!A.on;paintAudio()});

/* ======================= RENDERER ======================= */
const cv=$('gl');
const R=new THREE.WebGLRenderer({canvas:cv,antialias:!PHONE,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio,PHONE?1.5:2));
const SHADOWS=!PHONE&&!SPECTATE;
R.shadowMap.enabled=SHADOWS;R.shadowMap.type=THREE.PCFSoftShadowMap;
const W=()=>cv.clientWidth||innerWidth,H=()=>cv.clientHeight||innerHeight;
const scene=new THREE.Scene();
const FOG=new THREE.Fog(0xd9f0ff,120,560);scene.fog=FOG;scene.background=new THREE.Color(0xd9f0ff);
const cam=new THREE.PerspectiveCamera(62,1,.1,3000);scene.add(cam);
const portrait=()=>W()<H();
function baseFov(){return cfg.cam==='cockpit'?(portrait()?84:68):(portrait()?76:60)}
function fit(){R.setSize(W(),H(),false);cam.aspect=W()/H();cam.clearViewOffset();if(state!=='spec')cam.fov=baseFov();cam.updateProjectionMatrix();if(state==='spec')specCam()}
const hemi=new THREE.HemisphereLight(0xffffff,0x88aa77,.62);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3df,.82);sun.position.set(60,110,40);scene.add(sun);scene.add(sun.target);
if(SHADOWS){sun.castShadow=true;const sc=sun.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=10;sc.far=260;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;sun.shadow.normalBias=.03}
const ANISO=Math.min(8,R.capabilities.getMaxAnisotropy());

/* ---------- helpers: seeded RNG, canvas textures, merged vertex-coloured geometry ---------- */
function rng(a){a=a>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=ANISO;return t}
const _m=new THREE.Matrix4(),_v=new THREE.Vector3(),_v2=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new THREE.Vector3();
const MX=(x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
function part(geo,color,m){const g=geo.index?geo.toNonIndexed():geo.clone();if(m)g.applyMatrix4(m);const n=g.attributes.position.count,c=new Float32Array(n*3),col=new THREE.Color(color);
  for(let i=0;i<n;i++){c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g}
function merge(parts){let n=0;parts.forEach(p=>n+=p.attributes.position.count);const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  parts.forEach(p=>{pos.set(p.attributes.position.array,o*3);nor.set(p.attributes.normal.array,o*3);col.set(p.attributes.color.array,o*3);o+=p.attributes.position.count});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeBoundingSphere();return g}
const VC=new THREE.MeshLambertMaterial({vertexColors:true});
const BOX=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const RB=(w,h,d,r=.12,s=2)=>new THREE.RoundedBoxGeometry(w,h,d,s,Math.min(r,w/2-.001,h/2-.001,d/2-.001));
const CYL=(r1,r2,h,s=12)=>new THREE.CylinderGeometry(r1,r2,h,s);
function chequer(ctx,x,y,w,h,sz){for(let i=0;i*sz<w;i++)for(let j=0;j*sz<h;j++){ctx.fillStyle=(i+j)%2?'#111':'#fff';ctx.fillRect(x+i*sz,y+j*sz,sz,sz)}}
const FONT=(px)=>`800 ${px}px "Baloo 2",system-ui,sans-serif`;

/* ======================= TRACK GEOMETRY =======================
   Closed centripetal Catmull-Rom through hand-made points (x, height, z), resampled every STEP by arc length.
   Height is smoothed; jump ramps (a kicker that ends in a drop) are added on the straightest stretch near each jump mark. */
const STEP=1.25,ROAD=7.5,LW=4.2,LANES=[-LW,0,LW],KERB=1.6,RAIL=ROAD+KERB+.9;
let TL=0,TN=0,PX,PY,PZ,TX,TZ,CU,JUMPS=[];
function curveOf(def){const c=new THREE.CatmullRomCurve3(def.pts.map(p=>new THREE.Vector3(p[0],p[2],p[1])),true,'centripetal');c.arcLengthDivisions=6000;return c}
function sampleOutline(def,n){const c=curveOf(def);return c.getSpacedPoints(n).map(p=>[p.x,p.z])}
function genTrack(def){
  const c=curveOf(def);const L=c.getLength();TN=Math.round(L/STEP);TL=TN*STEP;const pts=c.getSpacedPoints(TN);
  PX=new Float32Array(TN);PY=new Float32Array(TN);PZ=new Float32Array(TN);TX=new Float32Array(TN);TZ=new Float32Array(TN);CU=new Float32Array(TN);
  for(let i=0;i<TN;i++){PX[i]=pts[i].x;PZ[i]=pts[i].z;PY[i]=pts[i].y}
  for(let i=0;i<TN;i++){const a=(i-1+TN)%TN,b=(i+1)%TN;let tx=PX[b]-PX[a],tz=PZ[b]-PZ[a];const l=Math.hypot(tx,tz)||1;TX[i]=tx/l;TZ[i]=tz/l}
  for(let i=0;i<TN;i++){const j=(i+2)%TN,k=(i-2+TN)%TN;CU[i]=(TX[k]*TZ[j]-TZ[k]*TX[j])/(4*STEP)} // >0 bends right
  for(let pass=0;pass<4;pass++){const cp=PY.slice();for(let i=0;i<TN;i++){let s=0;for(let k=-8;k<=8;k++)s+=cp[(i+k+TN)%TN];PY[i]=s/17}}
  JUMPS=[];
  (def.jumps||[]).forEach(f=>{const c0=Math.round(f*TN);let best=c0,bv=1e9;
    for(let d=-50;d<=50;d++){const i=(c0+d+TN)%TN;let v=0;for(let k=-28;k<=14;k++)v+=Math.abs(CU[(i+k+TN)%TN]);if(v<bv){bv=v;best=i}}
    const lip=best,len=Math.round(16/STEP);for(let k=0;k<=len;k++){const i=(lip-len+k+TN)%TN,u=k/len;PY[i]+=2.6*Math.pow(u,1.5)}
    JUMPS.push(lip*STEP)});
}
const TP={x:0,y:0,z:0,tx:0,tz:1,sl:0};
function at(s,lat,o=TP){s=((s%TL)+TL)%TL;const f=s/STEP,i=f|0,j=(i+1)%TN,u=f-i;
  let tx=TX[i]+(TX[j]-TX[i])*u,tz=TZ[i]+(TZ[j]-TZ[i])*u;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
  o.tx=tx;o.tz=tz;o.x=PX[i]+(PX[j]-PX[i])*u-tz*lat;o.z=PZ[i]+(PZ[j]-PZ[i])*u+tx*lat;o.y=PY[i]+(PY[j]-PY[i])*u;o.sl=(PY[j]-PY[i])/STEP;return o}
const groundY=s=>{s=((s%TL)+TL)%TL;const f=s/STEP,i=f|0,u=f-i;return PY[i]+(PY[(i+1)%TN]-PY[i])*u};
const yawOf=(tx,tz)=>Math.atan2(-tx,-tz);
const nearJump=(s,before,after)=>JUMPS.some(j=>{for(let k=-3;k<=12;k++){const jj=j+k*TL;if(s>jj-before&&s<jj+after)return true}return false});

/* ======================= WORLD (themed scenery; rebuilt when the track changes) ======================= */
let world=null,props=[],gantryLamps=[],water=null,snowPts=null,balloons=[],windmill=null,crowd=null,flagMeshes=[];
const GLTF=new THREE.GLTFLoader();const KN={};
function loadKenney(name){if(KN[name])return KN[name];KN[name]=new Promise(res=>GLTF.load(`kenney/${name}.glb`,g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=SHADOWS;o.receiveShadow=SHADOWS}});res(g.scene)},undefined,()=>res(null)));return KN[name]}
function disposeWorld(){if(!world)return;scene.remove(world);world.traverse(o=>{if(o.userData.kenney)return;if(o.geometry)o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m&&m!==VC){if(m.map)m.map.dispose();m.dispose&&m.dispose()}})});world=null}
// a strip between two lateral profile points, swept along the whole loop (per-segment colours → crisp kerb stripes)
function strip(fa,fb,colorOf,opts={}){const pos=[],col=[],c=new THREE.Color();const step=opts.step||1;
  const pt=(i,f)=>{const k=i%TN,[lat,y]=f(k),nx=-TZ[k],nz=TX[k];return[PX[k]+nx*lat,y,PZ[k]+nz*lat]};
  for(let i=0;i<TN;i+=step){const j=i+step;if(opts.skip&&opts.skip(i))continue;const a=pt(i,fa),b=pt(j,fa),d=pt(i,fb),e=pt(j,fb);c.setHex(colorOf(i));
    pos.push(...a,...d,...b,...b,...d,...e);for(let k=0;k<6;k++)col.push(c.r,c.g,c.b)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));m.receiveShadow=SHADOWS;return m}
function distToTrack(x,z){let b=1e9,bi=0;for(let i=0;i<TN;i+=4){const dx=x-PX[i],dz=z-PZ[i],d=dx*dx+dz*dz;if(d<b){b=d;bi=i}}return[Math.sqrt(b),bi]}
function insideLoop(x,z){let inside=false;for(let i=0,j=TN-4;i<TN;j=i,i+=4){const xi=PX[i],zi=PZ[i],xj=PX[j],zj=PZ[j];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside}return inside}

function buildWorld(){
  disposeWorld();world=new THREE.Group();scene.add(world);props=[];gantryLamps=[];water=null;snowPts=null;balloons=[];windmill=null;crowd=null;flagMeshes=[];
  const th=THEMES[TRACK.id],r=rng(TRACK.id.length*7919+TRACK.id.charCodeAt(0));
  scene.fog.color.setHex(th.fog);scene.background.setHex(th.fog);
  // sky dome
  {const g=new THREE.SphereGeometry(1800,32,16),c=[],p=g.attributes.position,top=new THREE.Color(th.sky[0]),hor=new THREE.Color(th.sky[1]);
    for(let i=0;i<p.count;i++){const y=p.getY(i)/1800,k=Math.pow(Math.max(0,y),.5);const col=hor.clone().lerp(top,k);c.push(col.r,col.g,col.b)}
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    const sky=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-3;world.add(sky);world.userData.sky=sky;
    const sunD=new THREE.Mesh(new THREE.CircleGeometry(60,24),new THREE.MeshBasicMaterial({color:0xfffbe8,fog:false,transparent:true,opacity:.9}));sunD.position.set(600,700,300).normalize().multiplyScalar(1500);sunD.lookAt(0,0,0);sky.add(sunD)}
  // far hills / mesas / peaks ring
  {const n=34,geo=TRACK.id==='snow'?new THREE.ConeGeometry(1,1,7):TRACK.id==='desert'?CYL(.85,1,1,7):new THREE.IcosahedronGeometry(1,1);
    const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:0xffffff,fog:false,flatShading:true}),n),cl=new THREE.Color();
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r()*.15,d=1000+r()*250,s=90+r()*150;
      if(TRACK.id==='snow')im.setMatrixAt(i,MX(Math.cos(a)*d,s*.45-20,Math.sin(a)*d,0,r()*6,0,s*.9,s*1.4,s*.9));
      else if(TRACK.id==='desert')im.setMatrixAt(i,MX(Math.cos(a)*d,s*.3-10,Math.sin(a)*d,0,r()*6,0,s,s*.7,s*.8));
      else im.setMatrixAt(i,MX(Math.cos(a)*d,-s*.3,Math.sin(a)*d,0,r()*6,0,s*1.6,s*(.45+r()*.3),s));
      cl.setHex(th.hills[i%2]);im.setColorAt(i,cl)}
    if(TRACK.id==='beach')im.count=10;world.add(im)}
  {const cg=new THREE.IcosahedronGeometry(1,2),n=48,im=new THREE.InstancedMesh(cg,new THREE.MeshLambertMaterial({color:0xffffff,emissive:0xd4e2f0,fog:false}),n);
    for(let i=0;i<n;i+=4){const a=r()*Math.PI*2,d=500+r()*700,y=170+r()*140,s=24+r()*22;
      for(let k=0;k<4;k++)im.setMatrixAt(i+k,MX(Math.cos(a)*d+(k-1.5)*s*1.1,y+(k===1||k===2?s*.4:0),Math.sin(a)*d+r()*8,0,0,0,s*(k===1||k===2?1.25:.9),s*.65,s))}
    world.add(im)}
  // ground
  if(th.ground){const gt=canvasTex(64,64,(x,w,h)=>{x.fillStyle=th.ground[0];x.fillRect(0,0,w,h);x.fillStyle=th.ground[1];x.fillRect(0,0,w,h/2);
      for(let i=0;i<60;i++){x.fillStyle=`rgba(${TRACK.id==='snow'?'160,180,210':'0,0,0'},${.03+Math.random()*.05})`;x.fillRect(Math.random()*w,Math.random()*h,2,2)}});
    gt.wrapS=gt.wrapT=THREE.RepeatWrapping;gt.repeat.set(110,110);
    const gm=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200),new THREE.MeshLambertMaterial({map:gt,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:8}));
    gm.rotation.x=-Math.PI/2;gm.position.y=-.08;gm.renderOrder=-1;gm.receiveShadow=SHADOWS;world.add(gm)}
  else{// beach: sea everywhere, a sand island around and inside the loop
    const wt=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#2bb3e3';x.fillRect(0,0,w,h);for(let i=0;i<70;i++){x.strokeStyle=`rgba(255,255,255,${.12+Math.random()*.18})`;x.lineWidth=2;const y=Math.random()*h,xx=Math.random()*w;x.beginPath();x.moveTo(xx,y);x.quadraticCurveTo(xx+8,y-4,xx+16,y);x.stroke()}});
    wt.wrapS=wt.wrapT=THREE.RepeatWrapping;wt.repeat.set(70,70);
    water=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200),new THREE.MeshLambertMaterial({map:wt,polygonOffset:true,polygonOffsetFactor:3,polygonOffsetUnits:10}));water.rotation.x=-Math.PI/2;water.position.y=-.6;water.renderOrder=-2;world.add(water);
    const sandM=new THREE.MeshLambertMaterial({color:th.sand,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:8});
    const shape=new THREE.Shape();for(let i=0;i<TN;i+=4){const x=PX[i],z=PZ[i];i?shape.lineTo(x,-z):shape.moveTo(x,-z)}
    const inner=new THREE.Mesh(new THREE.ShapeGeometry(shape),sandM);inner.rotation.x=-Math.PI/2;inner.position.y=-.08;inner.renderOrder=-1;inner.receiveShadow=SHADOWS;world.add(inner);
    const band=strip(i=>[-60,-.08],i=>[60,-.08],()=>th.sand);band.material=sandM;band.renderOrder=-1;world.add(band);
    const foam=strip(i=>[60,-.06],i=>[66,-.5],()=>0xfff7e0,{step:2});foam.renderOrder=-1;world.add(foam);
    const foam2=strip(i=>[-60,-.06],i=>[-66,-.5],()=>0xfff7e0,{step:2});foam2.renderOrder=-1;world.add(foam2)}
  // asphalt ribbon: dashed lane lines, yellow edge lines (one texture tile = 10 units)
  const uL=(-LW/2+ROAD)/(2*ROAD),uR=(LW/2+ROAD)/(2*ROAD);
  const roadT=canvasTex(256,256,(x,w,h)=>{x.fillStyle=TRACK.id==='desert'?'#5c5a5f':'#545866';x.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){const v=Math.random();x.fillStyle=v<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.09)';x.fillRect(Math.random()*w,Math.random()*h,2,2)}
    x.fillStyle='#ffd23f';x.fillRect(5,0,6,h);x.fillRect(w-11,0,6,h);
    x.fillStyle='rgba(255,255,255,.9)';[uL,uR].forEach(u=>x.fillRect(u*w-3,0,6,h*.42))});
  roadT.wrapT=THREE.RepeatWrapping;
  {const pos=[],uv=[],idx=[];for(let i=0;i<=TN;i++){const k=i%TN,nx=-TZ[k],nz=TX[k];
      pos.push(PX[k]-nx*ROAD,PY[k]+.02,PZ[k]-nz*ROAD,PX[k]+nx*ROAD,PY[k]+.02,PZ[k]+nz*ROAD);const v=i*STEP/10;uv.push(0,v,1,v);
      if(i<TN){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:roadT}));m.receiveShadow=SHADOWS;world.add(m)}
  // kerbs, verge, rail, embankment / bridge deck
  const Y=k=>PY[k];
  for(const sd of[-1,1]){
    world.add(strip(k=>[sd*ROAD,Y(k)+.03],k=>[sd*(ROAD+KERB),Y(k)+.16],i=>((i>>1)%2)?th.kerb[0]:th.kerb[1]));
    world.add(strip(k=>[sd*(ROAD+KERB),Y(k)+.16],k=>[sd*(RAIL+.6),Y(k)+.04],()=>th.verge));
    // rounded rail bar on short legs (Kenney style)
    world.add(strip(k=>[sd*RAIL,Y(k)+.55],k=>[sd*RAIL,Y(k)+1.05],()=>th.rail));
    world.add(strip(k=>[sd*RAIL,Y(k)+1.05],k=>[sd*(RAIL+.45),Y(k)+1.12],()=>th.rail));
    world.add(strip(k=>[sd*(RAIL+.45),Y(k)+1.12],k=>[sd*(RAIL+.45),Y(k)+.55],()=>0xd5dde8));
    world.add(strip(k=>[sd*RAIL,Y(k)+.55],k=>[sd*(RAIL+.45),Y(k)+.55],()=>0xc6cfdb));
    const bridge=k=>TRACK.id==='beach'&&PY[k]>1.6;
    world.add(strip(k=>[sd*(RAIL+.6),Y(k)+.04],k=>bridge(k)?[sd*(RAIL+.6),Y(k)-1.1]:[sd*(RAIL+.8+PY[k]*1.5),-.07],k=>bridge(k)?0xe8edf3:th.skirt,{step:1}));
  }
  {const posts=[];for(let i=0;i<TN;i+=3)for(const sd of[-1,1]){const lat=sd*(RAIL+.22),k=i;posts.push([PX[k]-TZ[k]*lat,PY[k]+.28,PZ[k]+TX[k]*lat])}
    const im=new THREE.InstancedMesh(BOX(.22,.56,.22),new THREE.MeshLambertMaterial({color:th.post}),posts.length);posts.forEach((p,i)=>im.setMatrixAt(i,MX(...p)));world.add(im)}
  if(TRACK.id==='beach'){const pl=[];for(let i=0;i<TN;i+=8)if(PY[i]>1.8)for(const sd of[-1,1])pl.push([PX[i]-TZ[i]*sd*5,PZ[i]+TX[i]*sd*5,PY[i]]);
    const im=new THREE.InstancedMesh(CYL(.7,.9,1,10),new THREE.MeshLambertMaterial({color:0xe6ebf2}),Math.max(1,pl.length));im.count=pl.length;
    pl.forEach(([x,z,h],i)=>im.setMatrixAt(i,MX(x,(h-1.2)/2-.6,z,0,0,0,1,h-.6+.6,1)));world.add(im)}
  // jump ramps: yellow/black chevrons painted on the kicker
  {const ct=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#ffc72c';x.fillRect(0,0,w,h);x.fillStyle='#1d2033';for(let k=0;k<2;k++){x.beginPath();const y=k*64;x.moveTo(0,y+64);x.lineTo(w/2,y+16);x.lineTo(w,y+64);x.lineTo(w,y+40);x.lineTo(w/2,y-8);x.lineTo(0,y+40);x.fill()}});
    ct.wrapT=THREE.RepeatWrapping;
    JUMPS.forEach(js=>{const len=16,n=Math.round(len/STEP),i0=Math.round((js-len)/STEP),pos=[],uv=[],idx=[];
      for(let k=0;k<=n;k++){const i=(i0+k+TN)%TN,nx=-TZ[i],nz=TX[i];pos.push(PX[i]-nx*ROAD,PY[i]+.05,PZ[i]-nz*ROAD,PX[i]+nx*ROAD,PY[i]+.05,PZ[i]+nz*ROAD);uv.push(0,k/n*3,1,k/n*3);
        if(k<n){const a=k*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
      const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:ct}));m.receiveShadow=SHADOWS;world.add(m);
      // the drop face
      const i=Math.round(js/STEP)%TN,face=new THREE.Mesh(BOX(ROAD*2,2.7,.3),new THREE.MeshLambertMaterial({color:0x1d2033}));
      face.position.set(PX[i],PY[(i+1)%TN]+1.25,PZ[i]);face.scale.y=2.5/2.7;face.rotation.y=yawOf(TX[i],TZ[i]);world.add(face)})}
  buildStart(th,r);
  buildProps(th,r);
  world.traverse(o=>{if(o.isInstancedMesh||o.isPoints)o.frustumCulled=false});
}

/* inflatable start arch, grid, chequered line, grandstand, flags */
function buildStart(th,r){
  const o=at(0,0,{}),yaw=yawOf(o.tx,o.tz),g=new THREE.Group();g.position.set(o.x,o.y,o.z);g.rotation.y=yaw;world.add(g);
  {const R0=RAIL+.6,tg=new THREE.TorusGeometry(R0,1.35,12,42,Math.PI).toNonIndexed(),p=tg.attributes.position,c=[],red=new THREE.Color(0xff5a3c),wh=new THREE.Color(0xffffff);
    for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;const seg=Math.floor(Math.atan2(y,x)/(Math.PI/7));const col=seg%2?wh:red;for(let k=0;k<3;k++)c.push(col.r,col.g,col.b)}
    tg.setAttribute('color',new THREE.Float32BufferAttribute(c,3));const arch=new THREE.Mesh(tg,new THREE.MeshLambertMaterial({vertexColors:true}));arch.castShadow=SHADOWS;g.add(arch);
    const bt=canvasTex(1024,192,(x,w,h)=>{x.fillStyle='#14213d';x.beginPath();x.roundRect?x.roundRect(0,0,w,h,40):x.rect(0,0,w,h);x.fill();chequer(x,40,14,w-80,22,22);chequer(x,40,h-36,w-80,22,22);
      x.fillStyle='#ffc72c';x.font=FONT(96);x.textAlign='center';x.textBaseline='middle';x.fillText('KARTFALL',w/2,h/2+8)});
    const ban=new THREE.Mesh(new THREE.PlaneGeometry(13,2.45),new THREE.MeshBasicMaterial({map:bt,side:THREE.DoubleSide,transparent:true}));ban.position.set(0,R0-1.2,1.0);g.add(ban);
    gantryLamps=[];for(let k=0;k<3;k++){const l=new THREE.Mesh(new THREE.SphereGeometry(.42,14,10),new THREE.MeshBasicMaterial({color:0x3a1416}));l.position.set((k-1)*1.3,R0-3.2,1.05);g.add(l);gantryLamps.push(l)}
    const pod=new THREE.Mesh(RB(4.4,1.2,.6,.25),new THREE.MeshLambertMaterial({color:0x1b1e2a}));pod.position.set(0,R0-3.2,.65);g.add(pod)}
  const ct=canvasTex(128,16,(x,w,h)=>chequer(x,0,0,w,h,8));
  const line=new THREE.Mesh(new THREE.PlaneGeometry(ROAD*2,2),new THREE.MeshLambertMaterial({map:ct}));line.rotation.x=-Math.PI/2;line.position.y=.06;line.receiveShadow=SHADOWS;g.add(line);
  // grid boxes
  const gb=[];GRID.forEach(([ds,l])=>{const p=at(ds,LANES[l],{}),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yawOf(p.tx,p.tz),0)),base=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y+.05,p.z),q,new THREE.Vector3(1,1,1));
    [-1.5,1.5].forEach(sx=>gb.push(part(BOX(.18,.02,3.4),0xffffff,base.clone().multiply(MX(sx,0,0)))));gb.push(part(BOX(3.2,.02,.2),0xffffff,base.clone().multiply(MX(0,0,-1.7))))});
  world.add(new THREE.Mesh(merge(gb),VC));
  // grandstand on the outside of the start straight
  const okAt=(s,lat,m)=>{const p=at(s,lat,{});const[d,bi]=distToTrack(p.x,p.z);const di=Math.abs(bi*STEP-((s%TL)+TL)%TL);return d>m||Math.min(di,TL-di)<60};
  const stand=(s,sd,len)=>{const o=at(s,sd*(RAIL+7),{}),gg=new THREE.Group();gg.position.set(o.x,o.y,o.z);gg.rotation.y=yawOf(o.tx,o.tz)+(sd<0?Math.PI:0);
    const ps=[];for(let k=0;k<6;k++)ps.push(part(BOX(1.7,.6+k*1.2,len),k%2?0xe7ecf3:0xd3dbe6,MX(k*1.7,(.6+k*1.2)/2,0)));
    ps.push(part(BOX(1.7*6+1,.35,len+1.5),th.kerb[0],MX(4.3,9.3,0,-.08)));
    for(const zz of[-len/2,len/2])for(const xx of[-.5,9.6])ps.push(part(BOX(.3,9.3,.3),0x2a3a66,MX(xx,4.65,zz)));
    ps.push(part(BOX(.2,1.1,len),0x2a3a66,MX(-.9,.55,0)));
    const m=new THREE.Mesh(merge(ps),VC);m.castShadow=SHADOWS;m.receiveShadow=SHADOWS;gg.add(m);world.add(gg);gg.updateMatrixWorld(true);
    const list=[];for(let k=0;k<6;k++)for(let zz=-len/2+.6;zz<len/2-.4;zz+=.8){if(r()<.15)continue;const v=new THREE.Vector3(k*1.7+.2,.6+k*1.2+.4,zz+(r()-.5)*.2).applyMatrix4(gg.matrixWorld);list.push([v.x,v.y,v.z,r()])}
    return list};
  let cl=[];if(okAt(30,1,RAIL+28))cl=cl.concat(stand(30,1,34));if(okAt(TL-26,1,RAIL+28))cl=cl.concat(stand(TL-26,1,24));
  if(cl.length){const body=new THREE.InstancedMesh(RB(.5,.65,.4,.12),new THREE.MeshLambertMaterial({color:0xffffff}),cl.length),head=new THREE.InstancedMesh(new THREE.SphereGeometry(.2,8,6),new THREE.MeshLambertMaterial({color:0xf2c9a0}),cl.length),c=new THREE.Color();
    const shirts=[0xe63946,0xffc72c,0x2f80ff,0x2fd47a,0xff7ac6,0xffffff,0xa259ff,0xff8a1f];
    cl.forEach(([x,y,z,k],i)=>{body.setMatrixAt(i,MX(x,y,z));head.setMatrixAt(i,MX(x,y+.5,z));c.setHex(shirts[(k*shirts.length)|0]);body.setColorAt(i,c)});
    world.add(body);world.add(head);crowd={body,head,list:cl}}
  // pit tents (Kenney) on the other side
  if(okAt(10,-1,RAIL+30)){const p=at(10,-(RAIL+16),{});loadKenney('decoration-tents').then(sc=>{if(!sc||!world)return;const t=sc.clone();t.userData.kenney=true;t.traverse(o=>o.userData.kenney=true);t.scale.setScalar(2.1);t.position.set(p.x,p.y-.04,p.z);t.rotation.y=yawOf(p.tx,p.tz)+Math.PI/2;world.add(t)})}
  // flags along the start straight
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,-1.1,0,1.8,-.55,0],3));fg.computeVertexNormals();
  const fc=[0xe63946,0xffc72c,0x2f80ff,0x2fd47a,0xa259ff];
  for(let k=0;k<10;k++){const s=-60+k*13;if(s>-8&&s<8)continue;const sd=k%2?1:-1,p=at(s,sd*(RAIL+1.6),{});
    const pole=new THREE.Mesh(CYL(.08,.08,6,6),new THREE.MeshLambertMaterial({color:0xdde3ec}));pole.position.set(p.x,p.y+3,p.z);world.add(pole);
    const f=new THREE.Mesh(fg,new THREE.MeshLambertMaterial({color:fc[k%fc.length],side:THREE.DoubleSide}));f.position.set(p.x,p.y+5.9,p.z);f.rotation.y=yawOf(p.tx,p.tz)+Math.PI/2;f.userData.ph=k;world.add(f);flagMeshes.push(f)}
}

/* themed props, scattered away from the asphalt (seeded, so every device sees the same world) */
function buildProps(th,r){
  const spots=(n,minD,maxD,tries=4000)=>{const out=[];const {minX,maxX,minZ,maxZ}=bounds();
    for(let a=0;a<tries&&out.length<n;a++){const x=minX-maxD+r()*(maxX-minX+2*maxD),z=minZ-maxD+r()*(maxZ-minZ+2*maxD);const[d,bi]=distToTrack(x,z);
      if(d<minD+PY[bi]*1.6||d>maxD)continue;if(TRACK.id==='beach'&&!insideLoop(x,z)&&d>52)continue;out.push([x,z,r(),bi])}return out};
  const inst=(geo,mat,list,mfn,cast=true)=>{if(!list.length)return null;const im=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((p,i)=>im.setMatrixAt(i,mfn(p,i)));im.castShadow=SHADOWS&&cast;im.receiveShadow=SHADOWS;world.add(im);return im};
  const treeN=PHONE?.6:1;
  if(TRACK.id==='meadow'){
    // Kenney forest tiles (CC0) in the open fields, procedural round trees, bushes, flowers, hay bales, balloons, a windmill
    const tiles=spots(Math.round(14*treeN),40,170);loadKenney('decoration-forest').then(sc=>{if(!sc||!world)return;tiles.forEach(([x,z,k])=>{const t=sc.clone();t.userData.kenney=true;t.traverse(o=>o.userData.kenney=true);t.scale.setScalar(2.2);t.position.set(x,-.05,z);t.rotation.y=Math.floor(k*4)*Math.PI/2;world.add(t)})});
    const tg=merge([part(CYL(.35,.5,2.6,7),0x9a6236,MX(0,1.3,0)),part(new THREE.IcosahedronGeometry(2.4,1),0x4fae4f,MX(0,4.2,0,0,0,0,1,1.05,1)),part(new THREE.IcosahedronGeometry(1.6,1),0x63c25e,MX(.9,5.4,.4))]);
    inst(tg,VC,spots(Math.round(120*treeN),20,260),([x,z,k])=>MX(x,0,z,0,k*6,0,.8+k*.7,.8+k*.7,.8+k*.7));
    inst(merge([part(new THREE.IcosahedronGeometry(1,1),0x5fb85a),part(new THREE.IcosahedronGeometry(.7,1),0x6fca63,MX(.8,.1,.2))]),VC,spots(80,15,200),([x,z,k])=>MX(x,.3,z,0,k*6,0,1+k,0.8+k*.5,1+k));
    const fl=spots(300,13,120);const fc=[0xff6b8a,0xffd23f,0xffffff,0xb57bff],flim=inst(new THREE.IcosahedronGeometry(.22,0),new THREE.MeshLambertMaterial({color:0xffffff}),fl,([x,z])=>MX(x,.15,z),false);
    if(flim){const c=new THREE.Color();fl.forEach((p,i)=>{c.setHex(fc[i%4]);flim.setColorAt(i,c)})}
    inst(merge([part(CYL(1,1,1.6,14),0xe8c35a,MX(0,1,0,0,0,Math.PI/2)),part(CYL(1.02,1.02,.3,14),0xc89c3a,MX(.5,1,0,0,0,Math.PI/2))]),VC,spots(26,18,90),([x,z,k])=>MX(x,0,z,0,k*6,0));
    // hot-air balloons
    for(let k=0;k<4;k++){const b=new THREE.Group();const cols=[0xe63946,0xffc72c,0x2f80ff,0xa259ff];
      const env=new THREE.SphereGeometry(6,16,12),c=[],p=env.attributes.position,c1=new THREE.Color(cols[k]),c2=new THREE.Color(0xffffff);
      for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i));const col=Math.floor((a+Math.PI)/(Math.PI/4))%2?c1:c2;c.push(col.r,col.g,col.b)}env.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
      const e=new THREE.Mesh(env,new THREE.MeshLambertMaterial({vertexColors:true}));e.scale.y=1.15;b.add(e);const bs=new THREE.Mesh(BOX(2,1.5,2),new THREE.MeshLambertMaterial({color:0x9a6236}));bs.position.y=-9;b.add(bs);
      const {minX,maxX,minZ,maxZ}=bounds();b.position.set(minX+(maxX-minX)*(.15+k*.25),45+k*12,minZ+(maxZ-minZ)*(k%2?.2:.75));b.userData.ph=k*1.7;world.add(b);balloons.push(b)}
    const ws=spots(1,40,90);if(ws.length){const[x,z]=ws[0],m=new THREE.Group();m.position.set(x,0,z);
      m.add(new THREE.Mesh(merge([part(CYL(2.2,3.4,14,8),0xf3efe6,MX(0,7,0)),part(new THREE.ConeGeometry(3,3.4,8),0xd0453c,MX(0,15.7,0)),part(BOX(1.4,2.4,.3),0x8a5530,MX(0,1.2,3.1))]),VC));
      const bl=new THREE.Mesh(merge([0,1,2,3].map(k=>part(BOX(1.2,9,.15),0xffffff,MX(Math.cos(k*Math.PI/2)*4.5,Math.sin(k*Math.PI/2)*4.5,0,0,0,k*Math.PI/2-Math.PI/2)))),VC);
      bl.position.set(0,12.5,2.8);m.add(bl);m.rotation.y=r()*6;windmill=bl;world.add(m)}
  }
  if(TRACK.id==='desert'){
    const mes=spots(Math.round(26*treeN),30,280);
    inst(merge([part(CYL(.85,1,1,8),0xc8673a),part(CYL(.8,.85,.25,8),0xe08a52,MX(0,.5,0)),part(CYL(1,1.05,.12,8),0xb85a30,MX(0,-.2,0))]),new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}),mes,([x,z,k])=>{const s=10+k*22;return MX(x,s*.35,z,0,k*6,0,s,s*.7*(.7+k*.6),s*(.7+k*.5))});
    const cac=merge([part(CYL(.45,.5,4.4,8),0x3f9b4f,MX(0,2.2,0)),part(CYL(.3,.3,1.8,8),0x3f9b4f,MX(.9,2.6,0,0,0,Math.PI/2)),part(CYL(.3,.3,1.5,8),0x3f9b4f,MX(1.6,3.2,0)),part(CYL(.28,.28,1.4,8),0x3f9b4f,MX(-.8,2.1,0,0,0,Math.PI/2)),part(CYL(.26,.26,1.2,8),0x3f9b4f,MX(-1.4,2.6,0))]);
    inst(cac,VC,spots(Math.round(110*treeN),15,230),([x,z,k])=>MX(x,0,z,0,k*6,0,.8+k*.6,.8+k*.6,.8+k*.6));
    inst(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xb7834f,flatShading:true}),spots(90,14,220),([x,z,k])=>MX(x,.4,z,k,k*5,0,1+k*2,.7+k,1+k*1.6));
    inst(new THREE.IcosahedronGeometry(.8,0),new THREE.MeshLambertMaterial({color:0x9c8a4a,flatShading:true}),spots(60,13,150),([x,z,k])=>MX(x,.5,z,k,k,k));
  }
  if(TRACK.id==='snow'){
    const pine=merge([part(CYL(.3,.45,1.6,6),0x8a5a33,MX(0,.8,0)),part(new THREE.ConeGeometry(2.6,3.4,8),0x2f8a57,MX(0,2.9,0)),part(new THREE.ConeGeometry(2.6,1.2,8),0xffffff,MX(0,3.5,0,0,0,0,.72,1,.72)),
      part(new THREE.ConeGeometry(2,3,8),0x34965e,MX(0,4.9,0)),part(new THREE.ConeGeometry(1.25,2.4,8),0x3aa165,MX(0,6.6,0)),part(new THREE.ConeGeometry(.75,1,8),0xffffff,MX(0,7.5,0))]);
    inst(pine,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}),spots(Math.round(170*treeN),15,260),([x,z,k])=>MX(x,0,z,0,k*6,0,.8+k*.8,.8+k*.8,.8+k*.8));
    const sm=merge([part(new THREE.SphereGeometry(1.2,12,10),0xffffff,MX(0,1.1,0)),part(new THREE.SphereGeometry(.85,12,10),0xffffff,MX(0,2.8,0)),part(new THREE.SphereGeometry(.6,12,10),0xffffff,MX(0,4,0)),
      part(new THREE.ConeGeometry(.12,.6,6),0xff7a1a,MX(0,4,-.8,-Math.PI/2)),part(CYL(.45,.45,.6,10),0x1d2033,MX(0,4.7,0)),part(CYL(.65,.65,.08,10),0x1d2033,MX(0,4.42,0)),part(new THREE.TorusGeometry(.75,.14,6,14),0xe63946,MX(0,3.4,0,Math.PI/2))]);
    inst(sm,VC,spots(14,14,70),([x,z,k])=>MX(x,0,z,0,k*6,0));
    inst(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xdfe8f2,flatShading:true}),spots(70,14,200),([x,z,k])=>MX(x,.3,z,k,k*5,0,1+k*2.5,.6+k,1+k*2));
    // falling snow around the camera
    const n=PHONE?400:900,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*120;pos[i*3+1]=Math.random()*50;pos[i*3+2]=(Math.random()-.5)*120}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    snowPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.35,transparent:true,opacity:.9,depthWrite:false}));world.add(snowPts)}
  if(TRACK.id==='beach'){
    const palm=merge([...[0,1,2,3,4,5].map(k=>part(CYL(.32-k*.02,.36-k*.02,1.6,7),k%2?0xb58450:0xa07040,MX(Math.sin(k*.35)*k*.25,.8+k*1.5,0,0,0,-.08*k))),
      ...[0,1,2,3,4,5,6].map(k=>part(BOX(.9,.12,4.6),k%2?0x3fae55:0x2f9a48,MX(Math.sin(1.75)*1.5+Math.cos(k*.9)*2,9.2,Math.sin(k*.9)*2,.35,k*.9+Math.PI/2,0)))]);
    inst(palm,VC,spots(Math.round(90*treeN),15,55),([x,z,k])=>MX(x,0,z,0,k*6,0,.9+k*.5,.9+k*.5,.9+k*.5));
    const umb=merge([part(CYL(.08,.08,3.2,6),0xffffff,MX(0,1.6,0)),part(new THREE.ConeGeometry(2.2,.9,10),0xff5a5a,MX(0,3.3,0)),part(new THREE.ConeGeometry(2.25,.92,10,1,true,0,Math.PI/5),0xffffff,MX(0,3.31,0)),part(BOX(1,.06,2.2),0x2f80ff,MX(1.4,.05,0))]);
    inst(umb,VC,spots(30,14,45),([x,z,k])=>MX(x,0,z,0,k*6,0));
    // boats + lighthouse on the sea
    const {minX,maxX,minZ,maxZ}=bounds();const boat=merge([part(RB(3,1.2,7,.4),0xffffff,MX(0,.4,0)),part(BOX(2.6,.2,6.4),0x2f80ff,MX(0,1,0)),part(CYL(.1,.1,6,6),0xdddddd,MX(0,4,0)),part(new THREE.ConeGeometry(2,5,3),0xffffff,MX(.9,4.5,0,0,Math.PI/2,0,.2,1,1))]);
    const boats=[];for(let k=0;k<8;k++){const a=k/8*Math.PI*2,d=Math.max(maxX-minX,maxZ-minZ)*.62+r()*60;boats.push([(minX+maxX)/2+Math.cos(a)*d,(minZ+maxZ)/2+Math.sin(a)*d,r()])}
    inst(boat,VC,boats,([x,z,k])=>MX(x,-.4,z,0,k*6,0,1.5,1.5,1.5));
    const lh=new THREE.Mesh(merge([part(CYL(2.2,3,4,12),0xffffff,MX(0,2,0)),part(CYL(1.9,2.2,4,12),0xe63946,MX(0,6,0)),part(CYL(1.6,1.9,4,12),0xffffff,MX(0,10,0)),part(CYL(1.7,1.7,2,12),0xffe9a0,MX(0,13,0)),part(new THREE.ConeGeometry(2,1.8,12),0xe63946,MX(0,14.9,0))]),VC);
    lh.position.set(maxX+70,-.5,(minZ+maxZ)/2);world.add(lh)}
}
function bounds(){let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;for(let i=0;i<TN;i++){minX=Math.min(minX,PX[i]);maxX=Math.max(maxX,PX[i]);minZ=Math.min(minZ,PZ[i]);maxZ=Math.max(maxZ,PZ[i])}return{minX,maxX,minZ,maxZ}}

/* ======================= KARTS ======================= */
const kartCache={};
function kartGeos(color){if(kartCache[color])return kartCache[color];
  const dark=0x2a2e3a,grey=0xa9b3c4,chrome=0xd8dee8,ps=[];
  const suit=new THREE.Color(color).lerp(new THREE.Color(0xffffff),.25).getHex();
  ps.push(part(RB(1.9,.2,3.0,.08),dark,MX(0,.34,0)));
  ps.push(part(RB(1.35,.55,1.35,.24),color,MX(0,.62,-1.0)));                  // nose
  ps.push(part(RB(.6,.36,.06,.04),0xffffff,MX(0,.8,-1.66,-.35)));              // number plate
  ps.push(part(RB(2.15,.24,.34,.12),grey,MX(0,.38,-1.68)));                    // front bumper
  for(const sx of[-1,1])ps.push(part(RB(.5,.46,1.45,.18),color,MX(sx*.98,.55,.12)));  // side pods
  ps.push(part(RB(.95,.9,.28,.12),0x1c1f29,MX(0,1.0,.66,.2)));                 // seat
  ps.push(part(RB(.95,.55,.7,.14),grey,MX(0,.78,1.28)));                       // engine
  for(const sx of[-1,1]){ps.push(part(CYL(.12,.14,.7,10),chrome,MX(sx*.32,.78,1.75,Math.PI/2)))}
  ps.push(part(RB(2.1,.14,.5,.06),color,MX(0,1.36,1.55)));                     // wing
  for(const sx of[-1,1])ps.push(part(BOX(.1,.5,.14),dark,MX(sx*.7,1.1,1.5)));
  ps.push(part(new THREE.TorusGeometry(.26,.05,8,20),0x1c1f29,MX(0,1.12,-.45,-.9)));   // steering wheel
  ps.push(part(CYL(.04,.04,.6,6),0x666c78,MX(0,.92,-.62,.9)));
  ps.push(part(RB(.82,.78,.6,.22),suit,MX(0,1.32,.36)));                       // driver body
  for(const sx of[-1,1])ps.push(part(RB(.2,.2,.72,.09),suit,MX(sx*.36,1.32,-.08,.45)));   // arms
  for(const sx of[-1,1])ps.push(part(new THREE.SphereGeometry(.12,8,6),0xffc72c,MX(sx*.24,1.16,-.42)));  // gloves
  const body=merge(ps);
  const wheel=(r,w,rim)=>merge([part(CYL(r,r,w,16),0x1c1c22,MX(0,0,0,0,0,Math.PI/2)),part(CYL(r*.55,r*.55,w+.04,12),rim,MX(0,0,0,0,0,Math.PI/2)),part(BOX(w+.06,.12,r*1.1),0x8d96a6)]);
  const front=merge([wheel(.42,.46,0xffc72c)].map((g,i)=>g).flatMap(g=>[-1,1].map(sx=>{const c=g.clone();c.applyMatrix4(MX(sx*1.06,0,0));return c})));
  const rear=merge([wheel(.52,.6,0xffc72c)].flatMap(g=>[-1,1].map(sx=>{const c=g.clone();c.applyMatrix4(MX(sx*1.1,0,0));return c})));
  return kartCache[color]={body,front,rear}}
const helmetGeo=new THREE.SphereGeometry(.42,16,12),visorGeo=RB(.56,.2,.2,.08);
const flameGeo=new THREE.ConeGeometry(.2,1.3,10);flameGeo.rotateX(Math.PI/2);flameGeo.translate(0,0,.65);
const flameMat=new THREE.MeshBasicMaterial({color:0x6af2ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false});
const flameMat2=new THREE.MeshBasicMaterial({color:0xffb12c,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
const blobT=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,4,32,32,31);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
const blobGeo=new THREE.PlaneGeometry(2.8,4);blobGeo.rotateX(-Math.PI/2);
const blobMat=new THREE.MeshBasicMaterial({map:blobT,transparent:true,depthWrite:false});
function makeKart(color,helmet){const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);inner.rotation.order='YXZ';
  const mat=new THREE.MeshLambertMaterial({vertexColors:true,transparent:true});const G=kartGeos(color);
  const body=new THREE.Mesh(G.body,mat);body.castShadow=SHADOWS;inner.add(body);
  const fw=new THREE.Mesh(G.front,mat);fw.position.set(0,.42,-1.02);fw.castShadow=SHADOWS;inner.add(fw);
  const rw=new THREE.Mesh(G.rear,mat);rw.position.set(0,.52,.95);rw.castShadow=SHADOWS;inner.add(rw);
  const hm=new THREE.MeshLambertMaterial({color:helmet,transparent:true});const hel=new THREE.Mesh(helmetGeo,hm);hel.position.set(0,2.08,.36);hel.castShadow=SHADOWS;
  const vis=new THREE.Mesh(visorGeo,new THREE.MeshLambertMaterial({color:0x111827,transparent:true}));vis.position.set(0,.02,-.32);hel.add(vis);inner.add(hel);
  const fl=[-1,1].map(sx=>{const f=new THREE.Mesh(flameGeo,flameMat);f.position.set(sx*.32,.78,2.05);f.visible=false;inner.add(f);const f2=new THREE.Mesh(flameGeo,flameMat2);f2.scale.set(.6,.6,.6);f.add(f2);return f});
  const sh=new THREE.Mesh(blobGeo,blobMat);sh.position.y=.04;g.add(sh);
  return{g,inner,body,fw,rw,hel,fl,sh,mats:[mat,hm,vis.material],face:null,tag:null,y:0,vy:0,air:false,wheelA:0,lean:0}}
function setOpacity(k,o){k.mats.forEach(m=>m.opacity=o);if(k.face)k.face.material.opacity=o;if(k.tag)k.tag.material.opacity=Math.max(o,.6)}

/* avatars: loaded with crossOrigin='anonymous'; on failure the coloured helmet stays */
const AV={};
function loadAvatar(url,cb){if(!url){cb(null);return}let e=AV[url];
  if(e){if(e.tex)cb(e);else if(e.failed)cb(null);else e.cbs.push(cb);return}
  e=AV[url]={tex:null,failed:false,cbs:[cb]};const im=new Image();im.crossOrigin='anonymous';im.decoding='async';
  im.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.beginPath();x.arc(80,80,78,0,7);x.closePath();x.fillStyle='#fff';x.fill();x.save();x.beginPath();x.arc(80,80,70,0,7);x.clip();
      const s=Math.min(im.naturalWidth,im.naturalHeight)||1;x.drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,10,10,140,140);x.restore();
      x.getImageData(0,0,1,1);e.canvas=c;e.tex=new THREE.CanvasTexture(c);e.cbs.forEach(f=>f(e))}catch(err){e.failed=true;e.cbs.forEach(f=>f(null))}e.cbs=[]};
  im.onerror=()=>{e.failed=true;e.cbs.forEach(f=>f(null));e.cbs=[]};im.src=url}
function tagTexture(name,colorHex){const c=document.createElement('canvas');c.width=512;c.height=112;const x=c.getContext('2d');
  x.font=FONT(58);let nm=String(name||'Racer');while(x.measureText(nm).width>420&&nm.length>3)nm=nm.slice(0,-2)+'…';
  const tw=x.measureText(nm).width,w=Math.min(500,tw+60),x0=(512-w)/2;
  x.fillStyle='rgba(20,33,61,.88)';x.beginPath();x.roundRect?x.roundRect(x0,10,w,92,46):x.rect(x0,10,w,92);x.fill();x.lineWidth=7;x.strokeStyle=colorHex;x.stroke();
  x.fillStyle='#fff';x.textBaseline='middle';x.textAlign='center';x.fillText(nm,256,62);
  const t=new THREE.CanvasTexture(c);t.anisotropy=ANISO;return t}
function setTag(k,name,color){const tex=tagTexture(name,hexStr(color));
  if(!k.tag){k.tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));k.tag.position.set(0,3.4,.3);k.tag.scale.set(3.4,.74,1);k.tag.renderOrder=3;k.inner.add(k.tag)}
  else{k.tag.material.map.dispose();k.tag.material.map=tex;k.tag.material.needsUpdate=true}}
function setFace(k,av){if(!av)return;if(!k.face){k.face=new THREE.Sprite(new THREE.SpriteMaterial({map:av.tex,transparent:true}));k.face.scale.set(1.25,1.25,1);k.face.position.set(0,2.15,.36);k.inner.add(k.face)}
  else{k.face.material.map=av.tex;k.face.material.needsUpdate=true}k.hel.visible=false}
const CATS=['cool','dj','party','fancy','sassy','artist','cheeky','hungry','cosy','sleepy','angry'];
const catUrl=c=>new URL(`avatars/cat-${c}.webp`,location.href).href;

/* ======================= FX: smoke puffs, dizzy stars, speed streaks ======================= */
const puffT=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(235,238,245,.55)');g.addColorStop(1,'rgba(235,238,245,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
const puffs=[];for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:puffT,transparent:true,depthWrite:false,color:0xe6e9ef}));s.visible=false;scene.add(s);puffs.push({s,life:0,v:new THREE.Vector3(),size:1})}
let puffI=0;
function puff(x,y,z,vx,vy,vz,size=1,color=0xe6e9ef){const p=puffs[puffI++%puffs.length];p.s.position.set(x,y,z);p.v.set(vx,vy,vz);p.life=1;p.size=size;p.s.material.color.setHex(color);p.s.visible=true;p.s.scale.setScalar(.5*size)}
function kartSmoke(k,n,spread=1,color){for(let i=0;i<n;i++){_v.set((i%2?1:-1)*1.1,.4,1+Math.random()*.4).applyMatrix4(k.inner.matrixWorld);puff(_v.x,_v.y,_v.z,(Math.random()-.5)*spread,1+Math.random()*1.2,(Math.random()-.5)*spread,1+Math.random()*.8,color)}}
const starT=canvasTex(64,64,(x,w,h)=>{x.fillStyle='#ffd23f';x.strokeStyle='#b77d00';x.lineWidth=3;x.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,rr=k%2?12:28;x.lineTo(32+Math.cos(a)*rr,32+Math.sin(a)*rr)}x.closePath();x.fill();x.stroke()});
const stars=[0,1,2].map(()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:starT,transparent:true,depthWrite:false}));s.scale.set(.6,.6,1);s.visible=false;scene.add(s);return s});
const streakGeo=BOX(.04,.04,4),streakMat=new THREE.MeshBasicMaterial({color:0xdffcff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false});
const streaks=[];for(let i=0;i<(PHONE?14:26);i++){const m=new THREE.Mesh(streakGeo,streakMat);m.visible=false;scene.add(m);streaks.push(m)}

/* ======================= ANSWER PADS (painted on the road), OBSTACLES, COINS ======================= */
const LANE_COL=['#2f80ff','#a259ff','#ff8a1f'];
const PAD_LEN=11,PAD_W=3.9;
function padDraw(p,text,state){const x=p.ctx,w=256,h=512;x.clearRect(0,0,w,h);
  const base=state==='ok'?'#2fd47a':state==='no'?'#ff5a4a':state==='dim'?'#7d8597':LANE_COL[p.l];
  x.fillStyle='rgba(255,255,255,.95)';x.beginPath();x.roundRect?x.roundRect(4,4,w-8,h-8,36):x.rect(4,4,w-8,h-8);x.fill();
  x.fillStyle=base;x.beginPath();x.roundRect?x.roundRect(16,16,w-32,h-32,28):x.rect(16,16,w-32,h-32);x.fill();
  x.fillStyle='rgba(255,255,255,.28)';for(let k=0;k<3;k++){const y=40+k*46;x.beginPath();x.moveTo(40,y+40);x.lineTo(w/2,y);x.lineTo(w-40,y+40);x.lineTo(w-40,y+58);x.lineTo(w/2,y+18);x.lineTo(40,y+58);x.fill()}
  // text stretched along the road so it reads upright from the driver's seat
  const t=String(text);x.save();x.translate(w/2,h*.66);x.scale(1,2.1);x.textAlign='center';x.textBaseline='middle';
  let fs=92,lines=[t];for(;fs>=26;fs-=4){x.font=FONT(fs);if(x.measureText(t).width<=w-48){lines=[t];break}
    const ws=t.split(' ');if(ws.length>1&&fs<=60){let best=null;for(let k=1;k<ws.length;k++){const a=ws.slice(0,k).join(' '),b=ws.slice(k).join(' ');const m=Math.max(x.measureText(a).width,x.measureText(b).width);if(!best||m<best[0])best=[m,a,b]}if(best[0]<=w-48){lines=[best[1],best[2]];break}}}
  x.font=FONT(fs);x.lineWidth=fs*.16;x.strokeStyle='rgba(10,18,40,.55)';x.fillStyle='#fff';
  const ys=lines.length===1?[0]:[-fs*.5,fs*.5];lines.forEach((ln,i)=>{x.strokeText(ln,0,ys[i]);x.fillText(ln,0,ys[i])});x.restore();
  p.tex.needsUpdate=true}
function makePadSet(){const g=new THREE.Group();const N=8;
  const pads=[0,1,2].map(l=>{const c=document.createElement('canvas');c.width=256;c.height=512;const tex=new THREE.CanvasTexture(c);tex.anisotropy=ANISO;
    const geo=new THREE.BufferGeometry(),pos=new Float32Array((N+1)*2*3),uv=[],idx=[];for(let k=0;k<=N;k++){uv.push(0,k/N,1,k/N);if(k<N){const a=k*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));m.renderOrder=1;g.add(m);
    return{m,geo,tex,ctx:c.getContext('2d'),l}});
  // inflatable "?" posts at the road sides mark the gate
  const post=merge([part(CYL(.55,.55,3.2,12),0xffc72c,MX(0,1.6,0)),part(new THREE.SphereGeometry(.9,14,10),0xffffff,MX(0,3.7,0)),part(new THREE.TorusGeometry(.56,.12,6,14),0x14213d,MX(0,2.9,0,Math.PI/2))]);
  const posts=[-1,1].map(()=>{const m=new THREE.Mesh(post,VC);m.castShadow=SHADOWS;g.add(m);return m});
  const qt=canvasTex(64,64,(x,w,h)=>{x.fillStyle='#14213d';x.font=FONT(58);x.textAlign='center';x.textBaseline='middle';x.fillText('?',32,38)});
  const qs=posts.map(p=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:qt,transparent:true}));s.scale.set(1.3,1.3,1);g.add(s);return s});
  g.visible=false;scene.add(g);return{g,pads,posts,qs,used:false}}
function placePads(set,s){set.pads.forEach(p=>{const a=p.geo.attributes.position.array;const N=8;
    for(let k=0;k<=N;k++){const ss=s-PAD_LEN/2+k*PAD_LEN/N;at(ss,LANES[p.l]-PAD_W/2,TP);a.set([TP.x,TP.y+.07,TP.z],k*6);at(ss,LANES[p.l]+PAD_W/2,TP);a.set([TP.x,TP.y+.07,TP.z],k*6+3)}
    p.geo.attributes.position.needsUpdate=true;p.geo.computeBoundingSphere()});
  [-1,1].forEach((sd,i)=>{at(s,sd*(ROAD+.9),TP);set.posts[i].position.set(TP.x,TP.y,TP.z);set.qs[i].position.set(TP.x,TP.y+3.7,TP.z)});set.g.visible=true}
const padSets=[0,1,2,3].map(makePadSet);
const OBS_GEO={
  cones:merge([...[[-.8,.5],[.8,.5],[0,-.7]].flatMap(([x,z])=>[part(new THREE.ConeGeometry(.42,1.2,10),0xff7a1a,MX(x,.62,z)),part(CYL(.27,.32,.2,10),0xffffff,MX(x,.58,z)),part(RB(.9,.1,.9,.04),0xff7a1a,MX(x,.05,z))])]),
  tyres:merge([...[-1.05,0,1.05].flatMap((x,i)=>[0,1].map(h=>part(new THREE.TorusGeometry(.38,.2,8,16),h&&i===1?0xe63946:h?0xffffff:0x2b2b2b,MX(x,.2+h*.42,0,Math.PI/2))))]),
  hay:merge([part(CYL(1,1,1.7,14),0xe8c35a,MX(0,1,0,0,0,Math.PI/2)),part(CYL(1.02,1.02,.18,14),0xc79a39,MX(.45,1,0,0,0,Math.PI/2)),part(CYL(1.02,1.02,.18,14),0xc79a39,MX(-.45,1,0,0,0,Math.PI/2))]),
  barrels:merge([...[-.7,.7].flatMap(x=>[part(CYL(.62,.62,1.4,14),0xff6b2c,MX(x,.7,0)),part(CYL(.64,.64,.12,14),0x3a3f4c,MX(x,.35,0)),part(CYL(.64,.64,.12,14),0x3a3f4c,MX(x,1.05,0))])]),
  snowman:merge([part(new THREE.SphereGeometry(1,12,10),0xffffff,MX(0,.9,0)),part(new THREE.SphereGeometry(.7,12,10),0xffffff,MX(0,2.3,0)),part(new THREE.ConeGeometry(.1,.5,6),0xff7a1a,MX(0,2.35,-.75,-Math.PI/2)),part(CYL(.35,.35,.5,10),0x1d2033,MX(0,3.1,0)),part(new THREE.TorusGeometry(.6,.12,6,14),0xe63946,MX(0,1.75,0,Math.PI/2))]),
  ball:merge([part(new THREE.SphereGeometry(1,16,12),0xffffff,MX(0,1,0)),part(new THREE.SphereGeometry(1.01,16,12,0,Math.PI/3),0xe63946,MX(0,1,0)),part(new THREE.SphereGeometry(1.01,16,12,2*Math.PI/3,Math.PI/3),0x2f80ff,MX(0,1,0)),part(new THREE.SphereGeometry(1.01,16,12,4*Math.PI/3,Math.PI/3),0xffc72c,MX(0,1,0))]),
};
const oilT=canvasTex(128,128,(x,w,h)=>{const g=x.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(12,10,20,.95)');g.addColorStop(.75,'rgba(20,16,32,.9)');g.addColorStop(1,'rgba(20,16,32,0)');
  x.fillStyle=g;x.beginPath();for(let a=0;a<7;a+=.35){const rr=48+Math.sin(a*3)*8+Math.cos(a*5)*5;x.lineTo(64+Math.cos(a)*rr,64+Math.sin(a)*rr)}x.fill();
  const sh=x.createLinearGradient(30,30,100,90);sh.addColorStop(0,'rgba(120,90,255,0)');sh.addColorStop(.45,'rgba(120,200,255,.35)');sh.addColorStop(.6,'rgba(255,120,220,.28)');sh.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=sh;x.beginPath();x.ellipse(64,62,36,22,.5,0,7);x.fill()});
const iceT=canvasTex(128,128,(x,w,h)=>{const g=x.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(200,240,255,.95)');g.addColorStop(.8,'rgba(150,215,250,.85)');g.addColorStop(1,'rgba(150,215,250,0)');x.fillStyle=g;x.beginPath();x.ellipse(64,64,60,52,0,0,7);x.fill();
  x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2;for(let k=0;k<6;k++){x.beginPath();x.moveTo(30+k*12,40);x.lineTo(40+k*10,90);x.stroke()}});
const slickGeo=new THREE.PlaneGeometry(3.4,4.6);slickGeo.rotateX(-Math.PI/2);
const obsPool={};
function getObs(type){(obsPool[type]=obsPool[type]||[]);let o=obsPool[type].find(x=>!x.used);
  if(!o){let m;if(type==='oil'||type==='ice'){m=new THREE.Mesh(slickGeo,new THREE.MeshBasicMaterial({map:type==='oil'?oilT:iceT,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));m.renderOrder=1}
    else{m=new THREE.Mesh(OBS_GEO[type],VC);m.castShadow=SHADOWS}scene.add(m);o={m,used:false};obsPool[type].push(o)}
  o.used=true;o.m.visible=true;o.m.scale.setScalar(1);o.fly=null;return o}
function freeObs(o){o.used=false;o.m.visible=false;o.fly=null}
const coinGeo=CYL(.62,.62,.16,18);coinGeo.rotateX(Math.PI/2);
const coinMesh=new THREE.InstancedMesh(coinGeo,new THREE.MeshLambertMaterial({color:0xffc72c,emissive:0x7a4b00}),80);coinMesh.count=0;coinMesh.castShadow=SHADOWS;coinMesh.frustumCulled=false;scene.add(coinMesh);

/* ======================= RACE LAYOUT (seeded: same for everyone with the same seed, track and laps) ======================= */
const GRID=[[-4,0],[-4,2],[-10,1],[-16,0],[-16,2],[-22,1]];
let D=1,layout={gates:[],obs:[],coins:[]};
function genLayout(seed,laps){const r=rng(seed*31+laps*977+TRACK.id.length*131+5);D=laps*TL;const gates=[],obs=[],coins=[];
  let s=95;while(s<D-70){if(nearJump(s,40,30)){s+=12;continue}gates.push({s,Q:null,done:false,set:null,pick:-1});s+=215+r()*30}
  const marks=[0,...gates.map(g=>g.s),D-25];
  // no obstacles: the whole stretch between questions is free, so kids can focus on the question
  for(let k=0;k<marks.length-1;k++){const b=marks[k+1]-30;
    // a row of coins in a free lane
    const cs=marks[k]+(k===0?30:20),ce=Math.min(b,cs+40);if(ce-cs>12){const lane=r()*3|0;for(let c=cs;c<ce;c+=4.2){if(obs.some(o=>o.lane===lane&&Math.abs(o.s-c)<6)||nearJump(c,4,6))continue;coins.push({s:c,lane,got:false})}}}
  return{gates,obs,coins}}

/* ======================= GAME STATE ======================= */
// states: menu · wait · count · run · paused · finish · over · spec
let state='menu',raceNo=0;
const VB=27,VBOOST=38,VSLOW=15,VSPIN=8,VFIN=17,KMH=3.2,GRAV=32;
const me={dist:0,v:0,lane:1,lx:0,boostT:0,slowT:0,spinT:0,spin:0,fin:false,finAt:0,k:null};
let raceT=0,countT=0,right=0,asked=0,streak=0,bestStreak=0,missed=[],coins=0,qNext=null,gLo=0,oLo=0,cLo=0,lastLap=1,finPos=0,finTime=0,finishT=0,score=0;
let shown=null,shownT=0,racers=6,menuBot=0;
const show=(id,on)=>$(id).classList.toggle('off',!on);
function panel(which){['menu','pauseP','over'].forEach(p=>$(p).hidden=p!==which);show('sheet',!!which);if(which!=='menu')$('sheet').classList.remove('peek');$('sheet').scrollTop=0}
function toast(big,small,ms=1500){const t=$('toast');t.innerHTML='';t.append(big);if(small)t.append(el('small',null,small));t.classList.remove('off');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.add('off'),ms)}
function flash(color,o=.22){const f=$('flash');f.style.background=color;f.style.transition='none';f.style.opacity=o;requestAnimationFrame(()=>requestAnimationFrame(()=>{f.style.transition='opacity .7s';f.style.opacity=0}))}

/* ---------- the player's kart ---------- */
me.k=makeKart(0xe63946,0xffffff);scene.add(me.k.g);
let myAvatar=null;{const u=P.get('avatar');loadAvatar(u||catUrl('cool'),av=>{myAvatar=av;if(av)setFace(me.k,av)})}

/* ---------- bots (solo only): cats from the EduGames avatar set ---------- */
const BOT_DEF=[{name:'DJ',cat:'dj',c:0x2f80ff,acc:.88,vb:26.4,hit:.12},{name:'Party',cat:'party',c:0xa259ff,acc:.74,vb:27.4,hit:.2},{name:'Fancy',cat:'fancy',c:0xff4fa3,acc:.66,vb:27,hit:.28},
  {name:'Sassy',cat:'sassy',c:0x14b87a,acc:.8,vb:26,hit:.16},{name:'Artist',cat:'artist',c:0xff8a1f,acc:.58,vb:27.8,hit:.32}];
const bots=BOT_DEF.map(d=>{const k=makeKart(d.c,0xffffff);setTag(k,d.name,d.c);scene.add(k.g);loadAvatar(catUrl(d.cat),av=>{if(av)setFace(k,av)});
  return Object.assign({k,dist:0,v:0,lane:1,lx:0,boostT:0,slowT:0,spinT:0,spin:0,gi:0,oi:0,fin:false,finAt:0,decided:-1,laneT:0},d)});
function speedTarget(o,vb){return o.spinT>0?VSPIN:o.slowT>0?VSLOW:o.boostT>0?VBOOST:vb}
function stepSpeed(o,target,dt){const a=target>o.v?(o.boostT>0?16:9):(o.spinT>0?40:20);o.v+=clamp(target-o.v,-a*dt,a*dt)}
function timers(o,dt){if(o.boostT>0)o.boostT-=dt;if(o.slowT>0)o.slowT-=dt;if(o.spinT>0){o.spinT-=dt;o.spin+=dt*Math.PI*2/.9}else o.spin=0}
function stepBot(b,dt,racing){timers(b,dt);
  if(racing&&!b.fin){const gap=b.dist-me.dist;let vb=b.vb+(gap>120?-1.6:gap<-120?1.4:0);stepSpeed(b,speedTarget(b,vb),dt);
    const prev=b.dist;b.dist+=b.v*dt;
    const G=layout.gates;while(b.gi<G.length&&G[b.gi].s<=b.dist){if(G[b.gi].s>prev){if(Math.random()<b.acc){b.boostT=2.4}else{b.slowT=1.5;kartSmoke(b.k,4)}}b.gi++}
    const O=layout.obs;while(b.oi<O.length&&O[b.oi].s<=b.dist){const o=O[b.oi];if(o.s>prev&&Math.abs(b.lx-LANES[o.lane])<2){b.spinT=.9;b.spin=0;knock(o,b)}b.oi++}
    const no=O[b.oi];if(no&&no.s-b.dist<30&&b.decided!==b.oi){b.decided=b.oi;if(b.lane===no.lane&&Math.random()>b.hit)b.lane=no.lane===1?(Math.random()<.5?0:2):1}
    b.laneT-=dt;if(b.laneT<=0){b.laneT=2+Math.random()*3;const nb=no&&no.s-b.dist<36?no.lane:-1;const n=Math.random()*3|0;if(n!==nb)b.lane=n}
    if(b.dist>=D){b.fin=true;b.finAt=raceT}}
  else{stepSpeed(b,racing||state==='menu'?VFIN+(state==='menu'?5:0):0,dt);b.dist+=b.v*dt;b.laneT-=dt;if(b.laneT<=0){b.laneT=2+Math.random()*4;b.lane=Math.random()*3|0}}
  b.lx+=(LANES[b.lane]-b.lx)*Math.min(1,dt*4)}
/* vertical motion: follow the ground, fly off jump lips, land with a bounce */
function vert(k,s,v,dt,fx){const g=groundY(s);
  if(k.air){k.vy-=GRAV*dt;k.y+=k.vy*dt;if(k.y<=g){k.y=g;k.air=false;k.land=.25;if(fx){S.land();kartSmoke(k,4,2,0xf3efe6)}}}
  else{const vy=(g-k.y)/Math.max(dt,1e-3);if(g<k.y-.35&&k.vy>2){k.air=true;k.vy=Math.min(k.vy,12);k.vy-=GRAV*dt;k.y+=k.vy*dt;if(fx)S.jump()}else{k.vy=clamp(vy,-20,20);k.y=g}}
  if(k.land>0)k.land-=dt}
function placeKart(k,s,lat,spin,v,dt,steer){const p=at(s,lat,TP);k.g.position.set(p.x,k.y,p.z);const yaw=yawOf(p.tx,p.tz);k.g.rotation.y=yaw;
  k.inner.rotation.y=(spin||0)-(steer||0)*.22;k.lean+=((steer||0)*.1-k.lean)*Math.min(1,dt*8);k.inner.rotation.z=-k.lean;
  const pitch=k.air?clamp(-k.vy*.03,-.35,.3):-Math.atan(p.sl);k.inner.rotation.x+=(pitch-k.inner.rotation.x)*Math.min(1,dt*10);
  k.inner.position.y=(k.land>0?-Math.sin(k.land/.25*Math.PI)*.18:0)+(REDUCE?0:Math.sin(performance.now()*.03+s)*.012*Math.min(1,v/10));
  k.wheelA-=v*dt/.5;k.fw.rotation.x=k.wheelA;k.rw.rotation.x=k.wheelA;k.sh.position.y=p.y-k.y+.04;k.sh.material.opacity=1;return p}

/* ---------- peers (race + spectate) ---------- */
const peers=new Map();let finCounter=0,gridIdx=0;
function peerColor(id){let h=2166136261;const s=String(id);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}const hue=(Math.imul(h,2654435761)>>>0)/4294967296;return new THREE.Color().setHSL(hue,.75,.52).getHex()}
function onPeers(list){const now=performance.now();
  for(const q of list){if(!q||q.id==null)continue;const id=String(q.id);if(ME&&id===String(ME))continue;
    let p=peers.get(id);
    if(!p){const c=peerColor(id);p={id,c,k:makeKart(c,new THREE.Color(c).offsetHSL(0,0,.2).getHex()),name:'',avatar:'',td:0,dd:0,tx:0,dx:0,lap:1,fin:false,finAt:0,vEst:0,lastT:now,seen:now};
      scene.add(p.k.g);peers.set(id,p);p.dd=+q.d||0;p.dx=+q.x||0}
    const nd=clamp(+q.d||0,0,1),dtm=(now-p.lastT)/1000;
    if(dtm>.04){const v=(nd-p.td)/dtm;p.vEst=p.vEst*.6+clamp(v,0,.05)*.4;p.lastT=now}
    p.td=nd;p.tx=clamp(+q.x||0,-1,1);p.lap=+q.lap||p.lap;p.seen=now;
    if(q.fin&&!p.fin){p.fin=true;p.finAt=++finCounter;p.td=1}
    const nm=String(q.name||'Racer').slice(0,24),avu=q.avatar?String(q.avatar):'';
    if(nm!==p.name||avu!==p.avatar){p.name=nm;p.avatar=avu;setTag(p.k,nm,p.c);
      loadAvatar(avu,av=>{if(p.avatar!==avu)return;if(av)setFace(p.k,av);else p.k.hel.visible=true})}}
  rankDirty=true}
function prunePeers(){const now=performance.now();for(const[id,p]of peers)if(now-p.seen>5000){scene.remove(p.k.g);if(p.stag)p.stag.remove();if(p.li)p.li.remove();peers.delete(id);rankDirty=true}}
addEventListener('message',e=>{if(e.source!==window.parent&&e.source!==window.opener)return;const m=e.data;if(!m||typeof m!=='object')return;
  if(m.type==='edu-go')onGo();
  else if(m.type==='edu-peers'&&Array.isArray(m.peers)&&(RACE||SPECTATE))onPeers(m.peers)});

/* ---------- race ---------- */
function rebuildWorld(){genTrack(TRACK);buildWorld();layout=genLayout(1,LAPS);D=LAPS*TL;drawMiniBase();
  bots.forEach((b,i)=>{b.dist=i*-34-12;b.lane=i%3;b.lx=LANES[b.lane];b.k.y=groundY(b.dist);b.k.air=false})}
function resetRace(){
  raceNo++;const lseed=RACE?SEED:(Math.random()*1e6|0)+raceNo;layout=genLayout(lseed,LAPS);
  padSets.forEach(a=>{a.used=false;a.g.visible=false});Object.values(obsPool).flat().forEach(freeObs);coinMesh.count=0;
  const top=curTopic();qNext=stream(top,DIFF(),EMBED_REG?{regions:EMBED_REG}:undefined);
  Object.assign(me,{dist:RACE?0:GRID[2][0],v:0,lane:1,lx:0,boostT:0,slowT:0,spinT:0,spin:0,fin:false,finAt:0});me.k.y=groundY(me.dist);me.k.air=false;me.k.vy=0;
  raceT=0;right=0;asked=0;streak=0;bestStreak=0;missed=[];coins=0;gLo=0;oLo=0;cLo=0;lastLap=1;finPos=0;finTime=0;score=0;shown=null;
  const slots=[0,1,3,4,5];bots.forEach((b,i)=>{Object.assign(b,{dist:GRID[slots[i]][0],lane:GRID[slots[i]][1],lx:LANES[GRID[slots[i]][1]],v:0,boostT:0,slowT:0,spinT:0,spin:0,gi:0,oi:0,fin:false,finAt:0,decided:-1,laneT:2+i});
    b.k.y=groundY(b.dist);b.k.air=false;b.k.g.visible=!RACE});
  if(RACE){finCounter=0;for(const p of peers.values())if(p.fin)p.finAt=++finCounter}
  $('lapT').textContent=LAPS;$('coinN').textContent='0';paintHud(true);
}
function start(){if(SPECTATE)return;if(!EMBED)LAPS=cfg.laps;
  if(!EMBED&&TRACK.id!==cfg.track){TRACK=trackById(cfg.track);rebuildWorld()}
  resetRace();panel(null);show('hud',true);show('dash',true);show('qbox',false);show('finishFx',false);$('pause').style.visibility=RACE?'hidden':'';
  me.k.g.visible=true;paintAudio();camSnap=true;
  if(RACE){state='wait';show('wait',true)}else beginCount()}
let countStep=-1;
function beginCount(){state='count';countT=3;show('wait',false);show('lights',true);[...document.querySelectorAll('#lights i')].forEach(i=>i.className='');gantryLamps.forEach(l=>l.material.color.setHex(0x3a1416));countStep=-1}
function onGo(){if(SPECTATE){specCountdown();return}if(RACE&&state==='wait')beginCount()}
function toMenu(){if(EMBED&&EMBED.lock)return;state='menu';['hud','dash','qbox','finishFx','lights','count'].forEach(i=>show(i,false));
  bots.forEach(b=>b.k.g.visible=true);go('stepTopic');panel('menu')}
let pausedFrom='run';
function pause(){if(RACE||(state!=='run'&&state!=='count'))return;pausedFrom=state;state='paused';
  $('pPos').textContent=`${posNow()}${ord(posNow())} of ${racers}`;$('pLine').textContent=`${curTopic().name} · ${TRACK.name} · Lap ${lapNow()}/${LAPS}`;paintCam();panel('pauseP');paintAudio()}
function resume(){if(state!=='paused')return;panel(null);state=pausedFrom}
$('startBtn').onclick=start;$('againBtn').onclick=start;$('menuBtn').onclick=toMenu;
$('pause').onclick=pause;$('resumeBtn').onclick=resume;$('quitBtn').onclick=()=>{if(state==='paused'){state='run';endRace('quit')}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
function paintCam(){$('camT2').textContent=cfg.cam==='cockpit'?'Camera: driver’s seat':'Camera: behind the kart'}
const toggleCam=()=>{cfg.cam=cfg.cam==='cockpit'?'chase':'cockpit';saveCam();paintCam();cam.fov=baseFov();cam.updateProjectionMatrix();camSnap=true};
$('camBtn').onclick=toggleCam;$('camT2').onclick=toggleCam;

const lapNow=()=>clamp(Math.floor(Math.max(0,me.dist)/TL)+1,1,LAPS);
function standings(){const list=[{me:true,fin:me.fin,finAt:me.finAt,d:me.dist/D}];
  if(RACE)for(const p of peers.values())list.push({fin:p.fin,finAt:p.finAt,d:p.td});
  else for(const b of bots)list.push({fin:b.fin,finAt:b.finAt,d:b.dist/D});
  list.sort((a,b)=>a.fin!==b.fin?(a.fin?-1:1):a.fin?a.finAt-b.finAt:b.d-a.d);return list}
function posNow(){const l=standings();racers=l.length;return l.findIndex(x=>x.me)+1}
const nearestLane=x=>LANES.reduce((b,v,i)=>Math.abs(v-x)<Math.abs(LANES[b]-x)?i:b,0);

function resolveGate(g){g.done=true;asked++;const li=nearestLane(me.lx);g.pick=li;const Q=g.Q,okk=li===Q.correct;
  if(g.set)g.set.pads.forEach((p,l)=>padDraw(p,Q.ans[l],l===Q.correct?'ok':l===li?'no':'dim'));
  if(okk){right++;lastAns={q:Q.img?'This flag':Q.q,img:Q.img||null,answer:Q.answer,picked:Q.answer,ok:1,tag:Q.tag||null};streak++;bestStreak=Math.max(bestStreak,streak);me.boostT=2.6;me.slowT=0;S.correct();S.boost();flash('#2fd47a',.16);
    $('qres').className='good';$('qres').textContent=streak>=3?`Turbo! ${streak} in a row`:'Right! Turbo boost!'}
  else{streak=0;me.slowT=1.6;me.boostT=0;missed.push({q:Q.img?'This flag':Q.q,img:Q.img,answer:Q.answer,picked:Q.ans[li]});lastAns=Object.assign({},missed[missed.length-1],{ok:0,tag:Q.tag||null});S.wrong();S.skid();flash('#ff5a4a',.14);kartSmoke(me.k,10,1.6);
    $('qres').className='bad';$('qres').textContent=`It's ${Q.answer}`}
  optEls.forEach((s,i)=>{s.className=i===Q.correct?'ok':i===li?'no':'dim'});
  shown=g;shownT=1.3;
  toParent({type:'edu-progress',game:'kartfall',score:right*10+coins*2,right,asked})}
function knock(o,by){if(o.type==='oil'||o.type==='ice'||!o.obj)return;o.gone=true;const k=by.k||by;_v.set(0,0,-1).applyQuaternion(k.g.quaternion);
  o.obj.fly={vx:_v.x*12+(Math.random()-.5)*8,vy:9+Math.random()*4,vz:_v.z*12+(Math.random()-.5)*8,rx:(Math.random()-.5)*10,rz:(Math.random()-.5)*10,t:0}}
function hitObs(o){o.hit=true;me.spinT=(o.type==='oil'||o.type==='ice')?.8:.9;me.spin=0;me.boostT=0;S.hit();if(o.type==='oil'||o.type==='ice')S.skid();knock(o,me);kartSmoke(me.k,8,2.4);if(!REDUCE)shake=.35}
let shake=0;
function finishRace(){me.fin=true;me.finAt=RACE?++finCounter:raceT;finTime=raceT;finPos=posNow();
  const bonus=[0,50,30,20,10,5][finPos]||0;score=right*10+coins*2+bonus;state='finish';finishT=0;
  show('qbox',false);$('speedfx').classList.remove('on');$('finBig').textContent=finPos===1?'1st! WINNER!':'FINISH!';$('finSmall').textContent=`${finPos}${ord(finPos)} of ${racers} · ${fmtT(finTime)}`;
  show('finishFx',true);S.finish();confetti(finPos<=3?240:130);endRace('finish')}
function endRace(cause){
  const sc=cause==='finish'?score:right*10+coins*2;const best=getBest();const isBest=sc>best&&sc>0;
  if(isBest)try{localStorage.setItem(bestKey(),sc)}catch(e){}
  logResult({game:'kartfall',subject:curSubject().id,topic:curTopic().id,topicName:curTopic().name,level:DIFF(),
    score:sc,right,asked,bestStreak,missed:missed.map(m=>({q:m.q,answer:m.answer,picked:m.picked})),at:new Date().toISOString(),
    cause,position:cause==='finish'?finPos:null,racers,laps:LAPS,track:TRACK.id,coins,duration:+raceT.toFixed(1),timeUsed:Math.round(raceT),mode:RACE?'race':'solo'});
  const fill=()=>{$('rCause').textContent=cause==='finish'?'Race finished':'Race ended';
    const rp=$('rPos');rp.innerHTML='';if(cause==='finish'){rp.append(String(finPos));rp.append(el('sup',null,ord(finPos)))}else rp.textContent='–';
    $('rOf').textContent=cause==='finish'?`of ${racers} racers`:`Lap ${lapNow()} of ${LAPS}`;$('rOf').classList.toggle('best',isBest);if(isBest)$('rOf').textContent+=' · new best';
    $('rTopic').textContent=`${curTopic().name} · ${DIFFNAME[DIFF()]} · ${TRACK.name} · ${LAPS} laps`;
    $('rTime').textContent=fmtT(cause==='finish'?finTime:raceT).replace(/\.\d$/,'');$('rRight').textContent=`${right}/${asked}`;$('rCoins').textContent=coins;$('rScore').textContent=sc;
    const rv=$('review');rv.innerHTML='';
    if(missed.length){rv.append(el('p','eyebrow','Review'));const ol=el('ol');
      missed.forEach(m=>{const li=el('li');const q=el('span');if(m.img){const im=el('img');im.src=m.img;im.alt='';q.append(im)}q.append(m.q);
        const a=el('div');a.append(el('s',null,m.picked),el('b',null,m.answer));li.append(q,a);ol.append(li)});rv.append(ol)}
    else if(asked)rv.append(el('p','perfect','Every answer right. Champion driving!'));
    show('hud',false);show('dash',false);show('finishFx',false);panel('over');state='over'};
  if(cause==='finish')setTimeout(fill,3600);else{state='over';fill()}}

/* ---------- input: swipe / drag on touch, arrows or A-D ---------- */
function move(d){if(state!=='run')return;const n=clamp(me.lane+d,0,2);if(n!==me.lane){me.lane=n;S.lane()}}
let pid=null,ax=0,swiped=false;
addEventListener('pointerdown',e=>{if(state!=='run'||e.target.closest('button,#sheet'))return;pid=e.pointerId;ax=e.clientX;swiped=false});
// one lane per swipe: a long swipe still moves only one lane; lift the finger to swipe again
addEventListener('pointermove',e=>{if(e.pointerId!==pid||swiped)return;const dx=e.clientX-ax,th=Math.max(26,Math.min(60,W()*.08));if(Math.abs(dx)>th){move(dx>0?1:-1);swiped=true}});
addEventListener('pointerup',e=>{if(e.pointerId===pid)pid=null});addEventListener('pointercancel',()=>pid=null);
addEventListener('keydown',e=>{if(e.repeat&&!/Arrow/.test(e.code))return;
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='paused')resume();else pause();return}
  if(e.code==='KeyC'&&(state==='run'||state==='count'||state==='wait')){toggleCam();return}
  if(e.code==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();if(!e.repeat)move(-1)}
  if(e.code==='ArrowRight'||e.code==='KeyD'){e.preventDefault();if(!e.repeat)move(1)}
  if(e.code==='Enter'&&state==='over'&&!(EMBED&&EMBED.lock)&&!RACE)start()});

/* ---------- HUD + minimap ---------- */
const optEls=[...document.querySelectorAll('#opts span')];
const mini=$('mini'),mx=mini.getContext('2d');let miniBase=null,miniT=null;
function drawMiniBase(){const dpr=Math.min(devicePixelRatio,2),w=mini.clientWidth||112,h=mini.clientHeight||112;mini.width=w*dpr;mini.height=h*dpr;
  let a=1e9,b=-1e9,c=1e9,d=-1e9;for(let i=0;i<TN;i+=4){a=Math.min(a,PX[i]);b=Math.max(b,PX[i]);c=Math.min(c,PZ[i]);d=Math.max(d,PZ[i])}
  const s=Math.min((w-18)/(b-a),(h-18)/(d-c))*dpr,ox=mini.width/2-(a+b)/2*s,oy=mini.height/2-(c+d)/2*s;miniT={s,ox,oy};
  const off=document.createElement('canvas');off.width=mini.width;off.height=mini.height;const x=off.getContext('2d');x.lineJoin=x.lineCap='round';
  const path=()=>{x.beginPath();for(let i=0;i<TN;i+=3){const X=PX[i]*s+ox,Y=PZ[i]*s+oy;i?x.lineTo(X,Y):x.moveTo(X,Y)}x.closePath()};
  path();x.lineWidth=7*dpr;x.strokeStyle='rgba(255,255,255,.9)';x.stroke();path();x.lineWidth=4*dpr;x.strokeStyle='#3c4252';x.stroke();
  const X=PX[0]*s+ox,Y=PZ[0]*s+oy;x.fillStyle='#fff';x.fillRect(X-4*dpr,Y-4*dpr,8*dpr,8*dpr);miniBase=off}
function drawMini(){if(!miniBase)return;const dpr=Math.min(devicePixelRatio,2);mx.clearRect(0,0,mini.width,mini.height);mx.drawImage(miniBase,0,0);const{s,ox,oy}=miniT;
  const dot=(dist,col,r,ring)=>{const f=((dist%TL)+TL)%TL/STEP,i=f|0;const X=PX[i%TN]*s+ox,Y=PZ[i%TN]*s+oy;mx.beginPath();mx.arc(X,Y,r*dpr,0,7);mx.fillStyle=col;mx.fill();if(ring){mx.lineWidth=2*dpr;mx.strokeStyle=ring;mx.stroke()}};
  if(RACE)for(const p of peers.values())dot(p.dd*D,hexStr(p.c),3.6);else bots.forEach(b=>dot(b.dist,hexStr(b.c),3.6));
  dot(me.dist,'#ffc72c',5.2,'#14213d')}
let hudT=0,lastPos=0;
function paintHud(force){
  const pos=posNow();if(String(racers)!==$('posT').textContent)$('posT').textContent=racers;if(pos!==lastPos||force){$('posN').textContent=pos;$('posSuf').textContent=ord(pos);
    if(pos<lastPos&&!force){const c=$('posBig');c.classList.remove('up');void c.offsetWidth;c.classList.add('up')}lastPos=pos}
  $('lapN').textContent=lapNow();
  const kmh=Math.round(me.v*KMH);$('spd').textContent=kmh;$('gArc').setAttribute('stroke-dasharray',`${clamp(kmh/130*100,0,100)} 100`);$('gauge').classList.toggle('boost',me.boostT>0);
  $('timeChip').textContent=fmtT(raceT);drawMini()}

/* ---------- confetti ---------- */
const cf=$('confetti'),cx=cf.getContext('2d');let conf=[],confOn=false;
function confetti(n){if(REDUCE)n=Math.round(n*.35);const w=cf.width=innerWidth*Math.min(devicePixelRatio,2),h=cf.height=innerHeight*Math.min(devicePixelRatio,2);
  const cols=['#ffc72c','#e63946','#2f80ff','#2fd47a','#ff7ac6','#ffffff'];
  for(let i=0;i<n;i++)conf.push({x:w*(.1+Math.random()*.8),y:-Math.random()*h*.4,vx:(Math.random()-.5)*w*.25,vy:h*(.15+Math.random()*.35),r:Math.random()*6,vr:(Math.random()-.5)*10,s:(6+Math.random()*8)*Math.min(devicePixelRatio,2),c:cols[i%cols.length]});
  if(!confOn){confOn=true;let last=performance.now();const tick=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;cx.clearRect(0,0,cf.width,cf.height);
    conf=conf.filter(p=>p.y<cf.height+40);for(const p of conf){p.vy+=cf.height*.25*dt*(REDUCE?.5:1);p.vx*=.99;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;
      cx.save();cx.translate(p.x,p.y);cx.rotate(p.r);cx.fillStyle=p.c;cx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);cx.restore()}
    if(conf.length)requestAnimationFrame(tick);else{confOn=false;cx.clearRect(0,0,cf.width,cf.height)}};requestAnimationFrame(tick)}}

/* ======================= SPECTATE (teacher view) ======================= */
let rankDirty=true,podiumShown=false,specCountT=-1;
function specCam(){const bb=bounds(),cxm=(bb.minX+bb.maxX)/2,czm=(bb.minZ+bb.maxZ)/2,ex=bb.maxX-bb.minX+50,ez=bb.maxZ-bb.minZ+50;
  const pt=W()<H(),panelW=pt?0:Math.min(W()*.34,460),panelH=pt?H()*.42:0,headH=70;
  const vw=W()-panelW,vh=H()-panelH-headH;cam.fov=40;const tf=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
  const tilt=THREE.MathUtils.degToRad(56);
  const needZ=(ez*Math.sin(tilt))/2/(tf*vh/H()),needX=ex/2/(tf*vw/H());const dist=Math.max(needZ,needX)*1.04+ez*Math.cos(tilt)*.25;
  cam.position.set(cxm,Math.sin(tilt)*dist,czm+Math.cos(tilt)*dist);cam.lookAt(cxm,0,czm);cam.aspect=W()/H();
  cam.setViewOffset(W(),H(),panelW/2,-headH/2+panelH/2,W(),H());cam.updateProjectionMatrix();FOG.near=dist*3;FOG.far=dist*6}
function specCountdown(){specCountT=3;show('lights',true);[...document.querySelectorAll('#lights i')].forEach(i=>i.className='');countStep=-1}
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
function avEl(p,cls){if(p.avatar&&!p.avBroken){const im=el('img',cls);im.alt='';im.src=p.avatar;im.onerror=()=>{p.avBroken=true;im.replaceWith(avEl(p,cls))};return im}return el('span','av'+(cls?' '+cls:''),initials(p.name))}
function specOrder(){return[...peers.values()].sort((a,b)=>a.fin!==b.fin?(a.fin?-1:1):a.fin?a.finAt-b.finAt:b.td-a.td)}
function renderRank(){rankDirty=false;const list=specOrder();const ol=$('rank');$('specEmpty').hidden=list.length>0;
  const nf=list.filter(p=>p.fin).length,leadLap=list.length?Math.max(...list.map(p=>p.fin?LAPS:clamp(p.lap||1,1,LAPS))):0;
  $('specStatus').textContent=!list.length?'Waiting for racers…':nf===list.length?'Everyone finished!':`${TRACK.name} · Lap ${leadLap}/${LAPS} · ${list.length} racing${nf?` · ${nf} finished`:''}`;
  list.forEach((p,i)=>{const key=p.name+'|'+p.avatar;
    if(!p.li||p.liKey!==key){if(p.li)p.li.remove();p.liKey=key;const li=p.li=el('li');li.style.setProperty('--c',hexStr(p.c));
      p.liP=el('span','p');p.liL=el('span','l');li.append(p.liP,avEl(p),el('span','n',p.name||'Racer'),p.liL)}
    p.li.classList.toggle('done',p.fin);p.liP.textContent=i+1;p.liL.textContent=p.fin?'✓':`Lap ${clamp(p.lap||1,1,LAPS)}/${LAPS}`;
    if(ol.children[i]!==p.li)ol.insertBefore(p.li,ol.children[i]||null);
    if(!p.stag||p.stagKey!==key){if(p.stag)p.stag.remove();p.stagKey=key;const d=p.stag=el('div','stag');d.style.setProperty('--c',hexStr(p.c));
      const ring=el('span','ring');p.stagN=el('i');ring.append(avEl(p),p.stagN);d.append(ring,el('b',null,p.name||'Racer'));$('specTags').append(d)}
    p.stagN.textContent=i+1;p.stag.classList.toggle('fin',p.fin);p.stag.style.zIndex=String(500-i)});
  const all=list.length>0&&nf===list.length;
  if(all&&!podiumShown){podiumShown=true;const st=$('steps');st.innerHTML='';
    [[1,'s2'],[0,'s1'],[2,'s3']].forEach(([k,cls])=>{const p=list[k];if(!p)return;const d=el('div','step '+cls);d.style.setProperty('--c',hexStr(p.c));
      d.append(avEl(p),el('span','nm',p.name||'Racer'),el('div','blk',String(k+1)));st.append(d)});
    show('podium',true);S.finish();confetti(260)}
  else if(!all&&podiumShown){podiumShown=false;show('podium',false)}}
function placeSpecTags(){const w=W(),h=H();
  for(const p of peers.values()){if(!p.stag)continue;_v.copy(p.k.g.position);_v.y+=7;_v.project(cam);
    p.stag.style.transform=`translate(${((_v.x+1)/2*w).toFixed(1)}px,${((1-_v.y)/2*h).toFixed(1)}px) translate(-50%,-100%)`}
  const o=at(0,0,{});_v.set(o.x,o.y,o.z).project(cam);$('startMk').style.transform=`translate(${((_v.x+1)/2*w).toFixed(1)}px,${((1-_v.y)/2*h).toFixed(1)}px) translate(-50%,-50%)`}

/* ======================= LOOP ======================= */
const clock=new THREE.Clock();let t=0,stateTick=0,camSnap=true;
const camF=new THREE.Vector3(0,0,-1),camLook=new THREE.Vector3();
function updateProps(){
  const lo=me.dist-16,hi=me.dist+320;const G=layout.gates,O=layout.obs,Cn=layout.coins;
  while(gLo<G.length&&G[gLo].s<lo){const g=G[gLo];if(g.set){g.set.used=false;g.set.g.visible=false;g.set=null}gLo++}
  for(let i=gLo;i<G.length&&G[i].s<hi;i++){const g=G[i];if(!g.set){const a=padSets.find(x=>!x.used);if(!a)break;a.used=true;g.set=a;if(!g.Q)g.Q=qNext();
      placePads(a,g.s);a.pads.forEach(p=>padDraw(p,g.Q.ans[p.l]))}}
  while(oLo<O.length&&O[oLo].s<lo){const o=O[oLo];if(o.obj){freeObs(o.obj);o.obj=null}oLo++}
  for(let i=oLo;i<O.length&&O[i].s<hi;i++){const o=O[i];if(!o.obj&&!o.gone){o.obj=getObs(o.type);const p=at(o.s,LANES[o.lane],TP);o.obj.m.position.set(p.x,p.y+(o.type==='oil'||o.type==='ice'?.06:0),p.z);o.obj.m.rotation.set(0,yawOf(p.tx,p.tz)+(o.type==='ball'||o.type==='oil'?o.s:0),0)}}
  while(cLo<Cn.length&&Cn[cLo].s<lo)cLo++;
  let n=0;for(let i=cLo;i<Cn.length&&Cn[i].s<hi&&n<80;i++){const c=Cn[i];if(c.got)continue;const p=at(c.s,LANES[c.lane],TP);
    coinMesh.setMatrixAt(n++,_m.compose(_v.set(p.x,p.y+1.1+Math.sin(t*3+c.s)*.15,p.z),_q.setFromEuler(_e.set(0,t*3+c.s,0)),_s.set(1,1,1)))}
  coinMesh.count=n;coinMesh.instanceMatrix.needsUpdate=true}
function showQuestion(g){const Q=g.Q,qt=$('qtext');qt.className=Q.code?'code':'';qt.textContent='';if(Q.code)qt.append(el('small',null,Q.code));qt.append(Q.q);
  const im=$('qimg');if(Q.img){im.src=Q.img;im.hidden=false}else im.hidden=true;optEls.forEach((s,i)=>{s.textContent=Q.ans[i];s.className=''});$('qres').textContent='';$('qres').className='';show('qbox',true);S.bell()}
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.1);t+=dt; // up to 10 fps the race keeps real time, so a slow device is never a slower kart
  if(state==='paused'){R.render(scene,cam);return}

  // ---- countdown lights (race + spectate) ----
  if(state==='count'||specCountT>=0){let ct=state==='count'?countT:specCountT;ct-=dt;const step=ct>2?0:ct>1?1:ct>0?2:3;
    if(step!==countStep){countStep=step;const ls=[...document.querySelectorAll('#lights i')],c=$('count');
      if(step<3){ls.forEach((l,i)=>l.className=i<=step?'r':'');gantryLamps.forEach((l,i)=>l.material.color.setHex(i<=step?0xff2a2a:0x3a1416));c.className='ui t-out';c.textContent=3-step;void c.offsetWidth;c.classList.add('tick');S.light()}
      else{ls.forEach(l=>l.className='g');gantryLamps.forEach(l=>l.material.color.setHex(0x29ff7a));c.className='ui go t-out';c.textContent='GO!';void c.offsetWidth;c.classList.add('tick');S.go();
        setTimeout(()=>{show('lights',false);show('count',false)},900);setTimeout(()=>gantryLamps.forEach(l=>l.material.color.setHex(0x3a1416)),4000)}}
    if(state==='count'){countT=ct;if(ct<=0){state='run';me.v=Math.max(me.v,6)}}else specCountT=ct<=0?-1:ct}

  // ---- player ----
  if(state==='run'||state==='finish'||state==='over'){
    timers(me,dt);
    if(state==='run'){raceT+=dt;stepSpeed(me,speedTarget(me,VB),dt)}else{stepSpeed(me,VFIN,dt);me.boostT=0}
    const prev=me.dist;me.dist+=me.v*dt;
    if(state==='run'){
      const G=layout.gates;for(let i=gLo;i<G.length&&G[i].s<=me.dist+1;i++){const g=G[i];if(!g.done&&g.s>prev-.01&&g.s<=me.dist&&g.Q)resolveGate(g)}
      const O=layout.obs;for(let i=oLo;i<O.length&&O[i].s<=me.dist+1.2;i++){const o=O[i];if(!o.hit&&!o.gone&&o.s>prev-1&&o.s<=me.dist+1&&Math.abs(me.lx-LANES[o.lane])<2.1&&me.spinT<=0&&!me.k.air)hitObs(o)}
      const Cn=layout.coins;for(let i=cLo;i<Cn.length&&Cn[i].s<=me.dist+1;i++){const c=Cn[i];if(!c.got&&c.s>prev-1&&Math.abs(me.lx-LANES[c.lane])<2.1){c.got=true;coins++;S.coin();$('coinN').textContent=coins;const cc=$('coinChip');cc.classList.remove('bump');void cc.offsetWidth;cc.classList.add('bump')}}
      const lp=lapNow();if(lp!==lastLap){lastLap=lp;S.lap();toast(lp===LAPS?'Final lap!':`Lap ${lp}`,lp===LAPS?'push for the flag':null,1300)}
      if(me.dist>=D)finishRace()}
    else if(state==='finish')finishT+=dt;
    me.lx+=(LANES[me.lane]-me.lx)*Math.min(1,dt*(me.spinT>0?3:7))}
  vert(me.k,me.dist,me.v,dt,state==='run');
  const steerMe=clamp((LANES[me.lane]-me.lx)/LW,-1,1);
  const spinMe=me.spinT>0?(REDUCE?Math.sin(me.spin*2)*.25:me.spin):0;
  placeKart(me.k,me.dist,me.lx,spinMe,me.v,dt,steerMe);
  me.k.fl.forEach(f=>{f.visible=me.boostT>0&&state==='run';if(f.visible)f.scale.z=.8+Math.random()*.7});
  me.k.g.visible=state!=='menu'&&state!=='spec';

  // ---- bots ----
  if(!RACE&&!SPECTATE)for(const b of bots){b.k.g.visible=true;if(!(state==='count'||state==='wait'||state==='paused'))stepBot(b,dt,state==='run'||state==='finish'||state==='over');
    vert(b.k,b.dist,b.v,dt,false);placeKart(b.k,b.dist,b.lx,b.spinT>0?b.spin:0,b.v,dt,clamp((LANES[b.lane]-b.lx)/LW,-1,1));
    b.k.fl.forEach(f=>{f.visible=b.boostT>0&&state!=='menu';if(f.visible)f.scale.z=.8+Math.random()*.6});
    if(b.slowT>0&&Math.random()<dt*12)kartSmoke(b.k,1,1);
    const dd=((b.dist-me.dist)%TL+TL*1.5)%TL-TL/2;const near=(state==='run'||state==='count'||state==='finish')&&Math.abs(b.lx-me.lx)<3;setOpacity(b.k,near&&dd>-13&&dd<3.5?.3:1);b.k.g.visible=!(cfg.cam==='cockpit'&&near&&Math.abs(dd)<4.5)}

  // ---- peers ----
  if(RACE||SPECTATE){for(const p of peers.values()){
      p.dd+=p.vEst*dt;const err=p.td-p.dd;if(Math.abs(err)*D>40)p.dd=p.td;else p.dd+=err*Math.min(1,dt*2.5);if(p.fin)p.dd=Math.min(p.dd,1);
      p.dx+=(p.tx-p.dx)*Math.min(1,dt*6);
      if(p.gi==null)p.gi=gridIdx++;let s=p.dd*D,lat=p.dx*LW;const gk=Math.max(0,1-s/40);
      if(gk>0){const row=Math.floor(p.gi/3);s+=gk*(SPECTATE?-5-row*9:7+row*6);lat+=(LANES[p.gi%3]-lat)*gk}
      const vv=p.vEst*D;vert(p.k,s,vv,dt,false);placeKart(p.k,s,lat,0,vv,dt,clamp((p.tx-p.dx)*1.5,-1,1));p.k.fl.forEach(f=>{f.visible=vv>32;if(f.visible)f.scale.z=.8+Math.random()*.6});
      if(SPECTATE){p.k.g.scale.setScalar(2.6);if(p.k.tag)p.k.tag.visible=false}
      else{const dd=((s-me.dist)%TL+TL*1.5)%TL-TL/2;const near=Math.abs(lat-me.lx)<3;p.k.g.visible=dd>-70&&dd<300&&!(cfg.cam==='cockpit'&&near&&Math.abs(dd)<4.5);setOpacity(p.k,near&&dd>-13&&dd<5?.3:1);
        if(p.k.tag){const k=clamp(Math.abs(dd)/18,1,3);p.k.tag.scale.set(3.4*k,.74*k,1);p.k.tag.position.y=3.4+(k-1)*.7}}}
    if((stateTick+=dt)>1){stateTick=0;prunePeers()}}

  // ---- props + question ----
  if(state==='run'||state==='count'||state==='wait'||state==='finish'||state==='over')updateProps();
  for(const list of Object.values(obsPool))for(const o of list){if(!o.fly||!o.used)continue;const f=o.fly;f.t+=dt;f.vy-=30*dt;o.m.position.x+=f.vx*dt;o.m.position.y+=f.vy*dt;o.m.position.z+=f.vz*dt;o.m.rotation.x+=f.rx*dt;o.m.rotation.z+=f.rz*dt;if(f.t>1.6){o.m.visible=false}}
  if(state==='run'){
    if(shown&&shown.done){shownT-=dt;if(shownT<=0)shown=null}
    if(!shown||!shown.done){const G=layout.gates;let g=null;for(let i=gLo;i<G.length;i++)if(!G[i].done){g=G[i];break}
      if(g&&g.Q&&g!==shown&&g.s-me.dist<300){shown=g;showQuestion(g)}else if(!g&&shown!==null){show('qbox',false);shown=null}}
    if(shown&&!shown.done){const li=nearestLane(me.lx);optEls.forEach((s,i)=>s.classList.toggle('sel',i===li))}
    if(!shown)show('qbox',false)}
  padSets.forEach(a=>{if(a.g.visible)a.qs.forEach((q,i)=>q.position.y+=Math.sin(t*3+i)*.004)});

  // ---- camera ----
  if(state==='spec'){}
  else{let k,s,lat;if(state==='menu'){const b=bots[menuBot];k=b.k;s=b.dist;lat=b.lx;if(Math.random()<dt*.06)menuBot=(menuBot+1)%bots.length}else{k=me.k;s=me.dist;lat=me.lx}
    const p=at(s,lat,TP),pos=k.g.position;
    const cockpit=cfg.cam==='cockpit'&&state!=='menu';
    if(cockpit){camF.set(-Math.sin(k.g.rotation.y+k.inner.rotation.y),0,-Math.cos(k.g.rotation.y+k.inner.rotation.y));
      k.inner.updateMatrixWorld(true);cam.position.set(0,2.02,.05).applyMatrix4(k.inner.matrixWorld);camLook.set(cam.position.x+camF.x*20,cam.position.y-1.6+p.sl*20,cam.position.z+camF.z*20);cam.lookAt(camLook);
      if(me.k.face)me.k.face.visible=false;me.k.hel.visible=false}
    else{if(me.k.face)me.k.face.visible=true;else me.k.hel.visible=true;
      const tgt=_v2.set(p.tx,0,p.tz);camF.lerp(tgt,camSnap?1:1-Math.exp(-dt*5)).normalize();
      const pt=portrait(),back=state==='menu'?11:(pt?10:8.6),up=state==='menu'?4.6:(pt?4.9:4.1);
      const want=_v.set(pos.x-camF.x*back,Math.max(pos.y,groundY(s-back))+up,pos.z-camF.z*back);
      if(camSnap){cam.position.copy(want);camSnap=false}else{cam.position.x+=(want.x-cam.position.x)*(1-Math.exp(-dt*8));cam.position.z+=(want.z-cam.position.z)*(1-Math.exp(-dt*8));cam.position.y+=(want.y-cam.position.y)*(1-Math.exp(-dt*4))}
      camLook.set(pos.x+camF.x*9,pos.y+1.5,pos.z+camF.z*9);
      if(shake>0){shake-=dt;cam.position.x+=(Math.random()-.5)*shake*.4;cam.position.y+=(Math.random()-.5)*shake*.4}
      cam.lookAt(camLook)}
    const fovT=baseFov()+(REDUCE?0:(me.boostT>0&&state==='run'?9:0)+me.v*.08-1.5);if(Math.abs(cam.fov-fovT)>.05){cam.fov+=(fovT-cam.fov)*Math.min(1,dt*3);cam.updateProjectionMatrix()}
    if(SHADOWS){sun.position.set(pos.x+50,pos.y+100,pos.z+35);sun.target.position.set(pos.x,pos.y,pos.z)}}

  // ---- boost streaks, smoke, dizzy stars ----
  const boosting=me.boostT>0&&state==='run';$('speedfx').classList.toggle('on',boosting&&!REDUCE);
  _v.set(0,0,-1).applyQuaternion(cam.quaternion);
  streaks.forEach((m,i)=>{if(!m.visible){if(!boosting||REDUCE)return;m.visible=true;m.userData.l=0;
      const sd=i%2?1:-1;m.userData.off=new THREE.Vector3(sd*(2+Math.random()*4),.2+Math.random()*3.5,0)}
    m.userData.l+=dt;const k=m.userData.l*2.2;if(k>1){m.visible=false;return}
    const p=me.k.g.position;m.position.set(p.x,p.y,p.z).addScaledVector(camF,22-k*34);m.position.x+=-camF.z*m.userData.off.x;m.position.z+=camF.x*m.userData.off.x;m.position.y+=m.userData.off.y;
    m.rotation.y=Math.atan2(camF.x,camF.z)});
  if(me.slowT>0&&state==='run'&&Math.random()<dt*22)kartSmoke(me.k,1,1);
  if(me.spinT>0&&Math.random()<dt*28)kartSmoke(me.k,1,2.2);
  puffs.forEach(p=>{if(!p.s.visible)return;p.life-=dt*1.1;if(p.life<=0){p.s.visible=false;return}p.s.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*1.5);
    p.s.scale.setScalar((.5+(1-p.life)*2.2)*p.size);p.s.material.opacity=p.life*.8});
  stars.forEach((s,i)=>{s.visible=me.spinT>0&&state==='run'&&cfg.cam!=='cockpit';if(s.visible){const a=t*7+i*2.1,p=me.k.g.position;s.position.set(p.x+Math.cos(a)*.9,p.y+3.1,p.z+Math.sin(a)*.9)}});

  // ---- ambient animation ----
  if(crowd&&!REDUCE&&(state==='finish'||state==='menu'||state==='spec'||state==='over'||state==='count')){const n=crowd.list.length;
    for(let i=0;i<n;i++){const[x,y,z,k]=crowd.list[i];const j=Math.max(0,Math.sin(t*8+k*20))*.22;crowd.body.setMatrixAt(i,_m.makeTranslation(x,y+j,z));crowd.head.setMatrixAt(i,_m.makeTranslation(x,y+.5+j,z))}
    crowd.body.instanceMatrix.needsUpdate=true;crowd.head.instanceMatrix.needsUpdate=true}
  if(!REDUCE){balloons.forEach(b=>{b.position.y+=Math.sin(t*.5+b.userData.ph)*.01;b.rotation.y+=dt*.05});if(windmill)windmill.rotation.z+=dt*.6;
    flagMeshes.forEach(f=>f.rotation.x=Math.sin(t*3+f.userData.ph)*.2);
    if(water&&water.material.map)water.material.map.offset.set(t*.004,t*.002)}
  if(snowPts){const a=snowPts.geometry.attributes.position.array;const c=cam.position;for(let i=0;i<a.length;i+=3){a[i+1]-=dt*(2+(i%7)*.3);a[i]+=Math.sin(t+i)*dt*.3;if(a[i+1]<c.y-12)a[i+1]+=50}
    snowPts.position.set(Math.round(c.x/120)*120,0,Math.round(c.z/120)*120);snowPts.geometry.attributes.position.needsUpdate=true;
    // keep flakes around the camera
    for(let i=0;i<a.length;i+=3){const wx=a[i]+snowPts.position.x;if(wx<c.x-60)a[i]+=120;else if(wx>c.x+60)a[i]-=120;const wz=a[i+2]+snowPts.position.z;if(wz<c.z-60)a[i+2]+=120;else if(wz>c.z+60)a[i+2]-=120;if(a[i+1]>c.y+40)a[i+1]-=50}}

  // ---- sky follows camera, engine sound, HUD ----
  if(world&&world.userData.sky){cam.getWorldPosition(_v);world.userData.sky.position.copy(_v)}
  setEngine(me.v,(state==='run'||state==='count'||state==='finish'||state==='wait')&&A.on);
  if(['run','finish','wait','count'].includes(state)){hudT-=dt;if(hudT<=0){hudT=.1;paintHud()}}
  if(state==='spec'){if((hudT-=dt)<=0){hudT=.25;if(rankDirty)renderRank()}placeSpecTags()}
  R.render(scene,cam);
}

/* ---------- multiplayer heartbeat: edu-state ~6×/s ---------- */
if(RACE)setInterval(()=>{if(!['wait','count','run','finish','over'].includes(state))return;
  toParent({type:'edu-state',state:{d:+clamp(Math.max(0,me.dist)/D,0,1).toFixed(4),x:+clamp(me.lx/LW,-1,1).toFixed(3),lap:lapNow(),speed:Math.round(me.v*KMH),fin:me.fin}})},166);

function applyEmbed(){if(!EMBED)return false;const s=SUBJECTS.find(s=>s.topics.some(t=>t.id===EMBED.topic));if(!s)return false;
  cfg.subject=s.id;cfg.topic=EMBED.topic;if([1,2,3].includes(EMBED.level))cfg.diffs[EMBED.topic]=EMBED.level;
  if(EMBED.lock||RACE){$('againBtn').hidden=true;$('menuBtn').hidden=true;$('againBtn').parentNode.prepend(el('p','sent','Result sent to your teacher.'))}
  return true}

/* test hook (only with ?dev=1) */
if(P.get('dev')==='1')window.__kf={me,bots,peers,scene,cam,THREE,R,get state(){return state},get D(){return D},get TL(){return TL},get layout(){return layout},get jumps(){return JUMPS},tp(d){me.dist=d;me.k.y=groundY(d);me.k.air=false;camSnap=true;gLo=0;oLo=0;cLo=0}};

/* ---------- boot ---------- */
rebuildWorld();
fit();addEventListener('resize',()=>{fit();drawMiniBase()});addEventListener('orientationchange',()=>setTimeout(()=>{fit();drawMiniBase()},300));setTimeout(()=>{fit();drawMiniBase()},500);
paintAudio();paintCam();go('scrHome');
if(SPECTATE){state='spec';panel(null);show('spec',true);$('specTags').hidden=false;bots.forEach(b=>b.k.g.visible=false);me.k.g.visible=false;specCam();toParent({type:'edu-ready',game:'kartfall',spectate:true})}
else{if(applyEmbed())start();toParent({type:'edu-ready',game:'kartfall',race:RACE})}
document.fonts&&document.fonts.ready.then(()=>{bots.forEach(b=>setTag(b.k,b.name,b.c));for(const p of peers.values())setTag(p.k,p.name,p.c)});
frame();
})();
