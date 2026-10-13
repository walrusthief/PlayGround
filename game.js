/* Gates of the Sword Coast — 5e pocket CRPG (homage to BG1). Vanilla JS + Canvas. */
'use strict';
/* ============ 0. HELPERS / DICE / AUDIO ============ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const d=(n,s)=>{let t=0;for(let i=0;i<n;i++)t+=rnd(1,s);return t;};
const d20=()=>rnd(1,20);
const mod=score=>Math.floor((score-10)/2);
const profBonus=lvl=>lvl>=5?3:2;
const fmtMod=m=>(m>=0?'+':'')+m;
function toast(msg,ms=2600){const w=$('toast-wrap');const el=document.createElement('div');el.className='toast';el.innerHTML=msg;w.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .4s';setTimeout(()=>el.remove(),400);},ms);while(w.children.length>3)w.firstChild.remove();}
function clog(msg,cls=''){const b=$('log-body');const dv=document.createElement('div');if(cls)dv.className=cls;dv.innerHTML=msg;b.appendChild(dv);b.scrollTop=b.scrollHeight;while(b.children.length>80)b.firstChild.remove();}
let ACtx=null;
function beep(f=440,t=.08,type='square',v=.05){try{if(!ACtx)ACtx=new (window.AudioContext||window.webkitAudioContext)();const o=ACtx.createOscillator(),g=ACtx.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(ACtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,ACtx.currentTime+t);o.stop(ACtx.currentTime+t);}catch(e){}}
const sfx={hit:()=>beep(160,.12,'sawtooth'),miss:()=>beep(220,.07,'sine'),crit:()=>{beep(120,.15,'sawtooth');setTimeout(()=>beep(300,.15,'square'),80);},heal:()=>beep(520,.15,'sine'),spell:()=>beep(660,.2,'triangle'),coin:()=>beep(880,.09,'square'),level:()=>{[440,554,659,880].forEach((f,i)=>setTimeout(()=>beep(f,.18,'triangle'),i*120));},talk:()=>beep(330,.06,'sine'),quest:()=>{[523,784].forEach((f,i)=>setTimeout(()=>beep(f,.15,'triangle'),i*130));}};
/* ============ 1. SRD DATA ============ */
const RACES={
 Human:{name:'Human',icon:'🧑',desc:'+1 all abilities. Extra skill. Versatile, ambitious.',mods:{STR:1,DEX:1,CON:1,INT:1,WIS:1,CHA:1},speed:30},
 Elf:{name:'Elf',icon:'🧝',desc:'+2 DEX, +1 INT. Darkvision, Fey Ancestry (charm resist), keen senses.',mods:{DEX:2,INT:1},speed:30},
 Dwarf:{name:'Dwarf',icon:'🧙',desc:'+2 CON, +1 STR. Darkvision, poison resist, tough.',mods:{CON:2,STR:1},speed:25},
 Halfling:{name:'Halfling',icon:'🧒',desc:'+2 DEX, +1 CHA. Lucky (reroll 1s), Brave, Nimble.',mods:{DEX:2,CHA:1},speed:25}};
const CLASSES={
 Fighter:{name:'Fighter',icon:'⚔️',hd:10,desc:'d10 HD · Longsword 1d8 · Chain AC16 · Second Wind, Action Surge.',hp:10,ac:16,atk:['STR'],spellcasting:null,features:['Second Wind (1/rest): heal 1d10+lvl','Action Surge (1/rest): extra attack burst']},
 Rogue:{name:'Rogue',icon:'🗡️',hd:8,desc:'d8 HD · Shortsword 1d6+Shortbow · Sneak Attack +1d6, Cunning Hide.',hp:8,ac:14,atk:['DEX'],spellcasting:null,features:['Sneak Attack: +1d6 (2d6 at lvl3) when ally near or hidden','Cunning Action: Hide as bonus action']},
 Wizard:{name:'Wizard',icon:'🔮',hd:6,desc:'d6 HD · Fire Bolt 1d10 · Spells: Magic Missile, Burning Hands, Shield.',hp:6,ac:11,atk:['INT'],spellcasting:'INT',features:['Spellbook: INT-based, spell slots','Arcane Recovery: 1 slot back on short rest']},
 Cleric:{name:'Cleric',icon:'✨',hd:8,desc:'d8 HD · Mace 1d6 · Sacred Flame 1d8 · Cure Wounds, Bless, Guiding Bolt.',hp:8,ac:15,atk:['WIS'],spellcasting:'WIS',features:['Channel: Bless & heals','Divine: WIS-based slots']},
 Ranger:{name:'Ranger',icon:'🏹',hd:10,desc:'d10 HD · Shortbow 1d6 · Hide, Favored Enemy (+2 vs beasts).',hp:10,ac:15,atk:['DEX'],spellcasting:null,features:['Favored Enemy: +2 damage vs beasts','Cunning Hide: vanish as bonus action']}};
const BACKGROUNDS=['Acolyte','Folk Hero','Noble','Urchin','Sage'];
const PORTRAITS=['🧑','🧝','🧙','🧒','👩','🧔','👵','🧛'];
const SPELLS={
 firebolt:{name:'Fire Bolt',icon:'🔥',type:'cantrip',atk:'INT',dmg:'1d10',range:5,desc:'Ranged spell attack, 1d10 fire.'},
 sacred:{name:'Sacred Flame',icon:'🌟',type:'cantrip',atk:'WIS',save:'DEX',dmg:'1d8',range:5,desc:'DEX save or 1d8 radiant.'},
 magicmissile:{name:'Magic Missile',icon:'💫',type:'L1',dmg:'3x(1d4+1)',range:6,desc:'Auto-hit 3 darts.'},
 burning:{name:'Burning Hands',icon:'🔥',type:'L1',save:'DEX',dmg:'3d6',range:2.5,desc:'15ft cone, DEX save half, 3d6 fire.'},
 cure:{name:'Cure Wounds',icon:'💚',type:'L1',heal:'1d8+mod',range:1.6,desc:'Touch heal 1d8 + spell mod.'},
 bless:{name:'Bless',icon:'🙏',type:'L1',buff:true,range:6,desc:'+1d4 to attacks & saves, 1 min.'},
 guiding:{name:'Guiding Bolt',icon:'☄️',type:'L1',atk:'WIS',dmg:'4d6',range:6,desc:'Spell attack, 4d6 radiant, next attack adv.'},
 shield:{name:'Shield',icon:'🛡️',type:'L1',buff:true,desc:'+5 AC until next round.'}};
const WEAPONS={
 Longsword:{dmg:[1,8],ab:'STR'},Shortsword:{dmg:[1,6],ab:'DEX'},Shortbow:{dmg:[1,6],ab:'DEX',ranged:true},
 Mace:{dmg:[1,6],ab:'STR'},Quarterstaff:{dmg:[1,6],ab:'STR'},Dagger:{dmg:[1,4],ab:'DEX'},Greataxe:{dmg:[1,12],ab:'STR'},
 'Longsword +1':{dmg:[1,8],ab:'STR',bonus:1},'Shortsword +1':{dmg:[1,6],ab:'DEX',bonus:1},
 'Shortbow +1':{dmg:[1,6],ab:'DEX',ranged:true,bonus:1},'Mace +1':{dmg:[1,6],ab:'STR',bonus:1},
 'Dagger +1':{dmg:[1,4],ab:'DEX',bonus:1},'Greataxe +1':{dmg:[1,12],ab:'STR',bonus:1}};
const ARMOR_BONUS={'Cloth':0,'Leather +1':1,'Chain Shirt +1':1,'Chain Shirt +2':2,'Plate +1':3};
const GEM_VALUE={'Quartz':15,'Jade':30,'Ruby':50,'Diamond':120,'Iron Throne Signet':0};
/* ============ 2. STATE ============ */
let G=null;
const SAVE_KEY='gates-sword-coast-5e-v2';
function defaultState(){return{hero:null,party:[],zone:0,pos:{x:5,y:5},gold:25,inv:[{n:'Potion of Healing',t:'potion',q:3},{n:'Rations',t:'food',q:2}],quests:{q1:'active',q2:'locked',q3:'locked',q4:'locked',q5:'locked',q6:'locked'},side:{},sideKills:{},flags:{},unlocked:[true,false,false,false,false,false,false,false,false,false],visited:[],bountyTier:0,bounties:[],xp:0,xo:0,log:[],kills:0,rests:0,chestsDone:0,questsDone:0};}
function save(){try{if(G&&G.hero){G.pos={x:leader().x,y:leader().y};localStorage.setItem(SAVE_KEY,JSON.stringify(G));}}catch(e){}}
function load(){try{const s=localStorage.getItem(SAVE_KEY);if(!s)return null;const o=JSON.parse(s);if(!o.hero||!o.party||!o.party.length)return null;return o;}catch(e){return null;}}
function hasSave(){return !!load();}
function leader(){return G.party[0];}
function selected(){return G.party[G.sel||0]||G.party[0];}
function partyAlive(){return G.party.some(p=>p.hp>0);}
/* ---- character factory ---- */
function makeChar(o){
 const race=RACES[o.race],cls=CLASSES[o.class];
 const pb=2;
 const maxhp=cls.hp+mod(o.abil.CON)+(o.class==='Fighter'?2:0);
 const c={id:'c'+Math.random().toString(36).slice(2,7),name:o.name,race:o.race,cls:o.class,bg:o.bg||'Folk Hero',face:o.face||race.icon,
  abil:{...o.abil},lvl:1,xp:0,maxhp,hp:maxhp,ac:cls.ac+(o.class==='Rogue'?mod(o.abil.DEX):0)+(o.race==='Dwarf'?1:0),
  speed:race.speed,weapon:o.weapon||(o.class==='Fighter'?'Longsword':o.class==='Rogue'?'Shortsword':o.class==='Ranger'?'Shortbow':o.class==='Cleric'?'Mace':'Quarterstaff'),
  slots:{1:(o.class==='Wizard'||o.class==='Cleric')?2:0},slotsMax:{1:(o.class==='Wizard'||o.class==='Cleric')?2:0},
  hd:1,hdMax:1,hdSize:cls.hd,death:{s:0,f:0},cond:{},featUsed:{},x:0,y:0,tx:null,ty:null,cool:0,isHero:!!o.isHero,skills:o.skills||[],
  baseAc:0,armorBonus:0,armorName:'Cloth'};
 if(o.class==='Fighter'){c.ac=16;c.weapon='Longsword';}
 c.baseAc=c.ac;c.ac=c.baseAc;
 return c;
}
function recalcAc(p){p.ac=p.baseAc+(p.armorBonus||0);}
function abilForAttack(ch){const w=WEAPONS[ch.weapon]||WEAPONS.Longsword;if(CLASSES[ch.cls].spellcasting&&ch.weapon==='Quarterstaff'&&ch.cls==='Wizard')return mod(ch.abil.INT);return mod(ch.abil[w.ab]);}
function attackBonus(ch){const w=WEAPONS[ch.weapon]||{};let b=profBonus(ch.lvl)+abilForAttack(ch)+(w.bonus||0);if(ch.cond.bless)b+=2;return b;}
function spellDC(ch){const sc=CLASSES[ch.cls].spellcasting;if(!sc)return 10;return 8+profBonus(ch.lvl)+mod(ch.abil[sc]);}
function spellMod(ch){const sc=CLASSES[ch.cls].spellcasting;if(!sc)return 0;return mod(ch.abil[sc]);}
/* companions */
function makeLia(){const c=makeChar({name:'Lia',race:'Halfling',class:'Rogue',bg:'Urchin',face:'🦹',abil:{STR:8,DEX:16,CON:12,INT:12,WIS:13,CHA:14},weapon:'Shortsword'});c.weapon='Shortsword';return c;}
function makeMaren(){const c=makeChar({name:'Maren',race:'Human',class:'Cleric',bg:'Acolyte',face:'🧕',abil:{STR:13,DEX:10,CON:14,INT:10,WIS:16,CHA:12},weapon:'Mace'});return c;}
/* ============ 3. MAPS (ASCII, hand-crafted BG1 homage) ============ */
const TILE=34;
const ZONES=[
 {name:'📚 Candlekeep — Library Fortress',sub:'Prologue · Murder in the Cloisters',
  map:[
  "########################################",
  "#......................................#",
  "#..####..######......######..####......#",
  "#..#......#....#......#....#...#.......#",
  "#..#......#....#..TT..#....#...#.BBB...#",
  "#..####...######..TT..######...####....#",
  "#...........................TT.....B...#",
  "#..LLL.......TT......TT..........B.....#",
  "#..LLL.....TTTTTT..TTTTTT....TT........#",
  "#..LLL.......TT......TT....TTTT...CC...#",
  "#......................................#",
  "#.....TT....................TT.........#",
  "#....TTTT...######.......TTTTTT........#",
  "#.....TT....#....#.........TT......TT..#",
  "#...........#.AA.#................TTT..#",
  "#....SS.....#.AA.#....TT..........TT...#",
  "#...........######....TT...............#",
  "#......................................#",
  "#..TT.......E..........................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🍺 Coast Way Crossing — Inn',sub:'Ch.1 · The Friendly Rest',
  map:[
  "########################################",
  "#..TTT..........................TTT....#",
  "#..TTTT..TT................TT...TTTT...#",
  "#...TTT........................TT......#",
  "#......#####......RRRRR................#",
  "#......#...#.....RRRRRRR.....TT........#",
  "#..E...#...#.....RRRRRRR...TTTTT..TT...#",
  "#......#...#......RRRRR.....TT.........#",
  "#......#####...........................#",
  "#..........TT..............TTTTT.......#",
  "#...TT.....................TTTT....C...#",
  "#..TTTTT....SS....TT..............TT...#",
  "#...TT............TTTT.....TT..........#",
  "#.................TTTT.................#",
  "#..TT......TT..........................#",
  "#..........TTTT....AA.....TT......TT...#",
  "#..................AA.............TT...#",
  "#...C..................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🌲 The Wilds — Gnoll Country',sub:'Ch.2 · Trail of Iron',
  map:[
  "########################################",
  "#.TTTTTT....................TTTTTTT....#",
  "#.TTTTTTT..TT....TTTT....TT..TTTTTT....#",
  "#.TTTTT......TT........TT....TTTTT.....#",
  "#.TTT..........................TT......#",
  "#....TT......TTTTTT.....TT.............#",
  "#..E........TTTTTTTT..........TTTTT....#",
  "#....TT......TTTTTT....TT.....TTTTTT...#",
  "#........................TT....TTTT....#",
  "#..TTTTT...........TT..................#",
  "#..TTTTTT...SS....TTTT....TTTTT........#",
  "#..TTTTT..........TTTT....TTTTTT...C...#",
  "#.............TT.............TTT.......#",
  "#....TT......TTTT.....TT.........TT....#",
  "#.............TT......TTTT.............#",
  "#..TT.................TTTT.....AA......#",
  "#.............................AA.......#",
  "#...TT......TT....................TT...#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'⛏️ The Iron Mines — Depths',sub:'Ch.3 · The Rotting Iron',
  map:[
  "########################################",
  "#......................................#",
  "#..####...######.....######....####....#",
  "#..#......#....#.....#....#....#.......#",
  "#..#..E...#....#.....#....#....#.......#",
  "#..####...######.....######....####....#",
  "#......................................#",
  "#.....AAAA......TTTT......AAAA.........#",
  "#.....AAAA................AAAA.....B...#",
  "#......................................#",
  "#..TT.......................TT.........#",
  "#......................................#",
  "#......AAAA..........AAAA......CC......#",
  "#......AAAA..KK......AAAA..............#",
  "#......................................#",
  "#..####............................TT..#",
  "#..#...............................TT..#",
  "#..#...SS..............................#",
  "#..####................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🏕️ Bandit Camp — The Black Hand',sub:'Ch.4 · Cut Off the Hand',
  map:[
  "########################################",
  "#.TTTT..........................TTTT...#",
  "#..TTT......TTTT..........TTTT...TTT...#",
  "#................TT....................#",
  "#.....PPPPPPPPPPPPPPP..................#",
  "#.....P.............P.....TT...........#",
  "#.....P...TT....TT..P..................#",
  "#.....P....TTTTT....P....TTTTT.........#",
  "#.....P....TTTTT....P....TTTTTT........#",
  "#.....P.........BB..P..................#",
  "#.....P...SS....BB..P....C.............#",
  "#.....P.............P..................#",
  "#.....PPPPPPPDDDPPPPPPP................#",
  "#................TT...SS...............#",
  "#..TT......TT..........TT......TT......#",
  "#......................................#",
  "#....TT........................TT......#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:"🏰 Baldur's Gate — The Iron Throne",sub:'Finale · Throne of Blood',
  map:[
  "########################################",
  "#..HHHH...HHHH.....HHHH....HHHH........#",
  "#..H..H...H..H.....H..H....H..H........#",
  "#..H..H...H..H..SS.H..H....H..H...BB...#",
  "#..HHHH...HHHH.....HHHH....HHHH........#",
  "#......................................#",
  "#..TTTT..........DDDD...........TTTT...#",
  "#..TTTT..........DDDD...........TTTT...#",
  "#......................................#",
  "#.....HHHHH..........HHHHH.............#",
  "#.....H...H..........H...H.........C...#",
  "#.....H.T.H...TT.....H.T.H.............#",
  "#.....H...H..........H...H.............#",
  "#.....HHHHH..........HHHHH.............#",
  "#......................................#",
  "#..........TT..........TT..............#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🐄 Nashkel Village — Mill & Market',sub:'Hub · Trouble on the Farms',
  map:[
  "########################################",
  "#..HHHH...HHHH.....MMMM................#",
  "#..H..H...H..H.....MMMM.....TT.........#",
  "#..H..H...H..H..SS........TTT..........#",
  "#..HHHH...HHHH.........................#",
  "#......................................#",
  "#.....WW...............................#",
  "#......................................#",
  "#..TTTT........................TT......#",
  "#......................................#",
  "#.....HHHHH..........TTTTT.............#",
  "#.....H...H..........TTTTT.....C.......#",
  "#.....H...H............................#",
  "#.....HHHHH............................#",
  "#......................................#",
  "#..........TT..........TT..............#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🐺 Gnoll Stronghold — Dark Warrens',sub:'Dungeon · The Chieftain',
  map:[
  "########################################",
  "#..####..........######................#",
  "#..#..........TT..#....#...............#",
  "#..#.E........TT..#....#..BB...........#",
  "#..#.............#####.................#",
  "#..####..DDD.....#.....................#",
  "#........DDD.................TT........#",
  "#..TT....DDD.....AA.....TT.............#",
  "#..........SS....AA....................#",
  "#..AA........................TT........#",
  "#......................................#",
  "#..TT......KK......TT..................#",
  "#......................................#",
  "#..####............................TT..#",
  "#..#...............................TT..#",
  "#......................................#",
  "#..####................................#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:'🕷️ Cloakwood Forest — Spider Wood',sub:'Wilds · Blight & Silk',
  map:[
  "########################################",
  "#.TTTTT........................TTTT....#",
  "#.TTTTTT..TTT..........TTT...TTTTTT....#",
  "#..TTTT........................TTTT....#",
  "#......TTTTTT......TTTTTT..............#",
  "#..E.......TTTTTTTTTT..........TT......#",
  "#......TT...TTTTTT....TT.....TTTTT.....#",
  "#..TT.....................TTTTTT.......#",
  "#..TTTTTT...SS....TT......TTTT.........#",
  "#..TTTTT..........TTTT....TTTTT..C.....#",
  "#.............TT.............TTT.......#",
  "#....TTTT....TTTT.....TT........TT.....#",
  "#.............TT......TTTT.............#",
  "#..TTTT..............TTTT.....AA.......#",
  "#.............................AA.......#",
  "#...TT......TT....................TT...#",
  "#......................................#",
  "#..TT..........................TT......#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
 {name:"🕳️ City Sewers — Thieves' War",sub:"Dungeon · Below Baldur's Gate",
  map:[
  "########################################",
  "#..RRRR.....RRRR......RRRR....RRR......#",
  "#..R.......R........R.......R..........#",
  "#..R...E...R...SS...R...C...R...BB.....#",
  "#..RRRR.....RRRR......RRRR....RRR......#",
  "#......................................#",
  "#......~~~~..........~~~~..............#",
  "#......~~~~..........~~~~..............#",
  "#......................................#",
  "#.....RRRRR..........RRRRR.............#",
  "#.....R...R..........R...R.............#",
  "#.....R...R...TT.....R...R.............#",
  "#.....R...R..........R...R.............#",
  "#.....RRRRR..........RRRRR.............#",
  "#......................................#",
  "#..........~~~~........~~~~............#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "#......................................#",
  "########################################",
 ]},
];
function zoneGrid(zi){const rows=ZONES[zi].map;const W=Math.max(...rows.map(r=>r.length));return rows.map(r=>r.padEnd(W,'#').split(''));}
let grid=[],GW=0,GH=0,npcs=[],enemies=[],loots=[],exits=[],props=[],chests=[];
const SOLID_TILES=new Set(['#','T','~','L','H','P']);
function tileAt(x,y){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=GW||y>=GH)return'#';return grid[y][x];}
function solidAt(x,y){return SOLID_TILES.has(tileAt(x,y));}
function walkable(x,y){return !SOLID_TILES.has(tileAt(x,y));}
/* BFS snap: never spawn anything inside a wall/tree again */
function snapFloor(x,y,rMax=8){
 if(walkable(x,y))return{x,y};
 for(let r=1;r<=rMax;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  if(walkable(x+dx,y+dy))return{x:x+dx,y:y+dy};
 }
 for(let yy=1;yy<GH-1;yy++)for(let xx=1;xx<GW-1;xx++)if(walkable(xx,yy))return{x:xx,y:yy};
 return{x:2,y:2};
}
function snapAll(){
 for(const a of[...npcs,...enemies,...loots,...props,...exits,...chests]){const s=snapFloor(a.x,a.y);a.x=s.x;a.y=s.y;}
 for(const e of enemies){e.homeX=e.x;e.homeY=e.y;if(/wolf|rat|spider|dog|warg|bat|beetle|snake/i.test(e.name))e.beast=true;}
}
function findTiles(ch){const out=[];for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(grid[y][x]===ch)out.push({x:x+.5,y:y+.5});return out;}
/* ---- zone setup ---- */
function addNPC(name,face,role,x,y,extra){npcs.push({name,face,role,x,y,...(extra||{})});}
function spawnEnemy(name,face,abil,maxhp,ac,lvl,weapon,x,y,xp,id,boss,tag){enemies.push({id:id||('e'+Math.random().toString(36).slice(2)),name,face,abil,lvl:lvl||1,maxhp,hp:maxhp,ac,weapon:weapon||'Dagger',xp:xp||40,x,y,cool:rnd(10,30)/10,alive:true,boss:!!boss,sq:tag||null,aggroR:boss?9:6.5,homeX:x,homeY:y});}
function addLoot(x,y,loot){loots.push({x,y,loot,taken:false});}
function addChest(x,y,o){chests.push({x,y,name:o.name||'Old Chest',dc:o.dc||13,trap:!!o.trap,disarmed:false,loot:o.loot||{gold:30},opened:false,key:o.key||null});}
function addProp(t,x,y,label,use){props.push({t,x,y,label:label||t,use:use||null});}
/* ---- side-quest catalog (30 authored + infinite bounties) ---- */
const SIDEQUESTS={
 s_rats:{n:'Rats in the Cellar',z:0,h:'Kill 3 cellar rats (Pellan, Candlekeep).'},
 s_tome:{n:'The Lost Tome',z:0,h:'Find Wynne\'s tome in the stacks.'},
 s_spar:{n:'Trial of the Yard',z:0,h:'Best Gren\'s squire in practice.'},
 s_candle:{n:'Candles for the Vigil',z:0,h:'Gather 3 vigil candles.'},
 s_bully:{n:'Bully of the Stacks',z:0,h:'Deal with Drest the bully.'},
 s_ring:{n:"Obe's Missing Ring",z:1,h:'Find Obe\'s ring in the Wilds.'},
 s_bard:{n:"The Bard's Debt",z:1,h:'Collect Raler\'s debt for Tess.'},
 s_pelts:{n:'Wolf Pelts',z:1,h:'Bring Kess 3 wolf pelts.'},
 s_herbs:{n:'Feverfew',z:1,h:'Gather 3 feverfew herbs.'},
 s_board:{n:'Bounties',z:1,h:'Contracts from the notice board.'},
 s_patrol:{n:"Dell's Patrol",z:2,h:'Find the lost patrol\'s letter.'},
 s_cache:{n:'The Old Stump',z:2,h:'Search the old stump (Wilds east).'},
 s_snare:{n:'Gnoll Snares',z:2,h:'Break 3 gnoll snares.'},
 s_hermit:{n:'The Hermit',z:2,h:'Earn Vesper\'s wisdom.'},
 s_wolfpack:{n:'The Wolf Pack',z:2,h:'Slay the dire wolf.'},
 s_miners:{n:'Trapped Miners',z:3,h:'Free 2 caged miners.'},
 s_valve:{n:'Flood the Forge',z:3,h:'Turn both forge valves.'},
 s_ledger:{n:'Ledger of Names',z:3,h:'Find the hidden ledger.'},
 s_canary:{n:'The Canary',z:3,h:'Find Dain\'s canary.'},
 s_prison:{n:'Free the Prisoners',z:4,h:'Release Bramm and Wren.'},
 s_barrels:{n:'Poisoned Stores',z:4,h:'Burn 3 poison barrels.'},
 s_desert:{n:'The Deserter',z:4,h:'Get Tam to talk.'},
 s_banner:{n:'Cut Down the Banner',z:4,h:'Tear down the war banner (STR).'},
 s_dogs:{n:'War Dogs',z:4,h:'Put down 3 war dogs.'},
 s_heirloom:{n:"The Widow's Locket",z:5,h:'Recover the locket from the HQ.'},
 s_rats2:{n:'Guild of Rats',z:5,h:'Catch the wererat (city alley).'},
 s_temple:{n:'Alms for the Temple',z:5,h:'Donate 50 gp at the temple.'},
 s_arena:{n:'The Pit',z:5,h:'Survive 3 pit rounds.'},
 s_inform:{n:'The Informant',z:5,h:'Buy Vex\'s information.'},
 s_orphan:{n:"Orphan's Penny",z:5,h:'Help the orphan Nib.'},
 s_goat:{n:"Bess the Goat",z:6,h:'Find Bess\'s bell in Cloakwood.'},
 s_well:{n:'The Well Horror',z:6,h:'Kill 3 well horrors (village well).'},
 s_mill:{n:'The Mill Wheel',z:6,h:'Fetch a mill wheel from Cloakwood.'},
 s_caravan:{n:'The Caravan',z:6,h:'Fund and defend the caravan (30 gp).'},
 s_gnome:{n:'The Caged Tinker',z:7,h:'Free Tink in the stronghold.'},
 s_chief:{n:'The Chieftain',z:7,h:'Slay the gnoll chieftain.'},
 s_blight:{n:'Blight of Cloakwood',z:8,h:'Burn 3 blight growths.'},
 s_spiders:{n:'The Spider Queen',z:8,h:'Slay the Spider Queen.'},
 s_riddle:{n:"Hunter's Riddle",z:8,h:'Solve Sarella\'s riddle.'},
 s_guild:{n:"Thieves' War",z:9,h:'Pick a side in the sewers.'},
 s_beast:{n:'The Sewer Beast',z:9,h:'Slay the sewer beast.'}};
function sqState(id){return G.side[id]||'locked';}
function startSide(id){if(!G.side[id]){G.side[id]='active';sfx.quest();const q=SIDEQUESTS[id];toast('📜 Side quest: <b>'+q.n+'</b><br><small>'+q.h+'</small>');clog('📜 Side quest: <b>'+q.n+'</b>','info');$('journal-dot').classList.remove('hidden');save();}}
function finishSide(id,reward){
 if(G.side[id]==='done')return;G.side[id]='done';G.questsDone++;
 const q=SIDEQUESTS[id];sfx.quest();sfx.coin();
 if(reward&&reward.gold){G.gold+=reward.gold;}
 if(reward&&reward.item){const ex=G.inv.find(i=>i.n===reward.item.n&&i.t===reward.item.t);if(ex)ex.q+=reward.item.q||1;else G.inv.push({...reward.item});}
 if(reward&&reward.xp)gainXP(reward.xp,true);
 toast('✅ Quest complete: <b>'+q.n+'</b>'+(reward&&reward.gold?'<br>+'+reward.gold+' gp':''));
 clog('✅ <b>'+q.n+'</b> complete!'+(reward&&reward.gold?' +'+reward.gold+' gp':''),'good');
 $('journal-dot').classList.remove('hidden');updateTracker();refreshActions();save();
}
function makeBramm(){const c=makeChar({name:'Bramm',race:'Dwarf',class:'Fighter',bg:'Folk Hero',face:'🧔',abil:{STR:16,DEX:10,CON:16,INT:9,WIS:12,CHA:10},weapon:'Greataxe'});c.ac=16;recalcAc(c);return c;}
function makeElowen(){const c=makeChar({name:'Elowen',race:'Elf',class:'Wizard',bg:'Sage',face:'👩',abil:{STR:8,DEX:14,CON:12,INT:17,WIS:12,CHA:10},weapon:'Quarterstaff'});recalcAc(c);return c;}
function makeSorrel(){const c=makeChar({name:'Sorrel',race:'Elf',class:'Ranger',bg:'Folk Hero',face:'🏹',abil:{STR:12,DEX:17,CON:13,INT:10,WIS:15,CHA:8},weapon:'Shortbow'});recalcAc(c);return c;}
/* ---- generals for bounties ---- */
const BOUNTY_FOES=[
 {n:'Giant Rats',face:'🐀',abil:{STR:8,DEX:14,CON:10,INT:3,WIS:10,CHA:4},hp:8,ac:12,weapon:'Dagger',xp:25},
 {n:'Wolves',face:'🐺',abil:{STR:13,DEX:14,CON:12,INT:3,WIS:12,CHA:6},hp:14,ac:13,weapon:'Dagger',xp:50},
 {n:'Bandits',face:'🔪',abil:{STR:12,DEX:13,CON:12,INT:9,WIS:10,CHA:9},hp:16,ac:12,weapon:'Shortsword',xp:60},
 {n:'Gnolls',face:'🐺',abil:{STR:15,DEX:12,CON:11,INT:6,WIS:10,CHA:7},hp:22,ac:13,weapon:'Greataxe',xp:80},
 {n:'Kobolds',face:'🐀',abil:{STR:10,DEX:14,CON:10,INT:8,WIS:8,CHA:8},hp:12,ac:13,weapon:'Dagger',xp:40},
 {n:'Giant Spiders',face:'🕷️',abil:{STR:13,DEX:15,CON:12,INT:3,WIS:10,CHA:4},hp:18,ac:14,weapon:'Dagger',xp:70}];
function genBounties(){
 const seed=G.rests+G.kills+G.bountyTier*7;
 const out=[];
 const bz=[1,2,2,3,4,6,7,8];
 for(let i=0;i<3;i++){
  const f=BOUNTY_FOES[(seed+i*2)%BOUNTY_FOES.length];
  const n=2+((seed+i)%3);
  const zones=bz[(seed+i*3)%bz.length];
  out.push({key:'b'+G.bountyTier+'_'+i,foe:f,count:n,zone:zones,reward:30+n*20+f.xp});
 }
 return out;
}
/* ---- bounties: rotating notice-board contracts (effectively infinite quests) ---- */
function spawnBountiesFor(zi){
 for(const b of G.bounties){
  if(b.state!=='hunting'||b.zone!==zi)continue;
  if(enemies.some(e=>e.bountyKey===b.key&&e.alive))continue;
  const cx=8+((b.key.length*7)%20),cy=8+((b.key.length*5)%8);
  for(let i=0;i<b.left;i++){
   const f=b.foe,s=snapFloor(cx+i*1.5,cy+(i%2));
   spawnEnemy(b.foeN,f.face,{...f.abil},f.hp,f.ac,2,f.weapon,s.x,s.y,f.xp,b.key+'_'+i,false,null);
   enemies[enemies.length-1].bountyKey=b.key;
  }
 }
}
function acceptBounty(b){
 b.state='hunting';b.left=b.count;
 toast('🎯 Bounty accepted: <b>'+b.name+'</b><br><small>'+b.count+'× '+b.foeN+' in '+ZONES[b.zone].name+'</small>');
 clog('🎯 Bounty accepted: <b>'+b.name+'</b>','info');
 if(b.zone===G.zone)setupZoneFixed(G.zone,{x:leader().x,y:leader().y});
 save();
}
function completeBounty(b){
 b.state='done';G.bountyTier++;G.questsDone++;
 G.gold+=b.reward;gainXP(b.reward,false);
 sfx.quest();sfx.coin();
 toast('✅ Bounty complete: <b>'+b.name+'</b><br>+'+b.reward+' gp — new contracts posted!');
 clog('✅ Bounty <b>'+b.name+'</b> complete! +'+b.reward+' gp','good');
 $('journal-dot').classList.remove('hidden');updateTracker();save();
}
function arenaWaveCleared(){
 const wv=(G.flags.arenaWave||0)+1;
 if(wv>3){G.flags.arenaDone=true;finishSide('s_arena',{gold:200,xp:200,item:{n:'Plate +1',t:'armor',q:1}});}
 else{G.flags.arenaWave=wv;toast('🥊 Round '+(wv-1)+' survived! Talk to the <b>Pitmaster</b> for round '+wv+'!');save();}
}
/* quest-giver markers (! active turn-in / ? quest available) */
const QUEST_GIVERS={guard:['s_rats'],wynne:['s_tome'],gren:['s_spar'],fenn:['s_candle'],pip:['s_bully'],raler:['s_bard'],kess:['s_pelts','s_wolfpack'],ava:['s_herbs'],dell:['s_patrol','s_snare'],vesper:['s_hermit'],dain:['s_valve','s_canary'],miner1:['s_miners'],miner2:['s_miners'],bramm:['s_prison','s_barrels'],wren:['s_prison'],tam:['s_desert'],ria:['s_rats2','s_ledger'],widow:['s_heirloom'],alden:['s_temple'],pit:['s_arena'],vex:['s_inform'],nib:['s_orphan'],tess:['s_bard'],traveler:['s_ring'],henn:['s_goat','s_well','s_mill','s_caravan'],tilda:['s_goat'],lanna:['s_well'],tink:['s_gnome'],ash:['s_blight','s_spiders'],sarella:['s_riddle'],mara:['s_guild'],dunn:['s_guild'],pell:[],skiv:[]};
function markQuestGivers(){
 for(const n of npcs){
  const qs=QUEST_GIVERS[n.q]||[];
  n.mark=null;
  for(const q of qs){
   if(G.side[q]==='active'&&sideReadyToTurn(q)){n.mark='❗';break;}
  }
  if(!n.mark)for(const q of qs){if(!G.side[q]){n.mark='❓';break;}}
 }
}
function sideReadyToTurn(q){
 if(q==='s_rats')return!!G.flags.ratsDead;
 if(q==='s_spar')return!!G.flags.sparDone;
 if(q==='s_pelts'||q==='s_wolfpack')return!!(G.flags.peltsDone||G.flags.direDead);
 if(q==='s_tome')return!!G.flags.tomeFound;
 if(q==='s_candle')return(G.inv.filter(i=>i.t==='quest_candle').reduce((a,i)=>a+i.q,0))>=3;
 if(q==='s_ring')return!!G.flags.ringFound;
 if(q==='s_bard')return!!G.flags.bardGold;
 if(q==='s_herbs')return(G.inv.filter(i=>i.t==='quest_herb').reduce((a,i)=>a+i.q,0))>=3;
 if(q==='s_patrol')return!!G.flags.letterFound;
 if(q==='s_snare')return['sn1','sn2','sn3'].every(k=>G.flags['snare_'+k]);
 if(q==='s_hermit')return!!G.flags.hermitDone;
 if(q==='s_cache')return!!G.flags.cacheOpened;
 if(q==='s_miners')return!!(G.flags.miner1Free&&G.flags.miner2Free);
 if(q==='s_valve')return!!(G.flags.valve1&&G.flags.valve2);
 if(q==='s_ledger')return!!G.flags.ledgerFound;
 if(q==='s_canary')return!!G.flags.canaryFound;
 if(q==='s_prison')return!!(G.flags.brammFree&&G.flags.wrenFree);
 if(q==='s_barrels')return['barrel1','barrel2','barrel3'].every(k=>G.flags[k]);
 if(q==='s_desert')return!!G.flags.tamTalk;
 if(q==='s_banner')return!!G.flags.bannerTorn;
 if(q==='s_dogs')return!!G.flags.dogsDead;
 if(q==='s_heirloom')return!!G.flags.locketFound;
 if(q==='s_rats2')return!!G.flags.wereratDead;
 if(q==='s_temple')return!!G.flags.templeGift;
 if(q==='s_arena')return!!G.flags.arenaDone;
 if(q==='s_inform')return!!G.flags.informDone;
 if(q==='s_orphan')return!!G.flags.orphanDone;
 if(q==='s_bully')return!!G.flags.bullyDone;
 if(q==='s_goat')return!!G.flags.bellFound;
 if(q==='s_well')return!!G.flags.wellDone;
 if(q==='s_mill')return!!G.flags.wheelFound;
 if(q==='s_caravan')return!!G.flags.caravanDone;
 if(q==='s_gnome')return!!G.flags.tinkFree;
 if(q==='s_chief')return!!G.flags.chiefDead;
 if(q==='s_blight')return['bl1','bl2','bl3'].every(k=>G.flags[k]);
 if(q==='s_spiders')return!!G.flags.queenDead;
 if(q==='s_riddle')return!!G.flags.riddleDone;
 if(q==='s_guild')return!!G.flags.guildDone;
 if(q==='s_beast')return!!G.flags.beastDead;
 return false;
}
function setupZoneFixed(zi,spawnTag){
 G.zone=zi;grid=zoneGrid(zi);GH=grid.length;GW=grid[0].length;
 npcs=[];enemies=[];loots=[];exits=[];props=[];chests=[];
 if(!G.visited.includes(zi))G.visited.push(zi);
 G.unlocked[zi]=true;
 if(zi===0){
  /* --- Candlekeep --- */
  addNPC('Gorion','🧙','fatherly mentor',6.5,16.5,{q:'greet'});
  addNPC('Pellan','💂','gatewarden',24.5,17.5,{q:'guard'});
  addNPC('Scribe Wynne','📜','keeper of tomes',15.5,15.5,{q:'wynne'});
  addNPC('Gren','🛡️','arms-master',18.5,16.5,{q:'gren'});
  addNPC('Acolyte Fenn','🕯️','keeper of the vigil',4.5,10.5,{q:'fenn'});
  addNPC('Novice Pip','🧒','scared novice',3.5,9.5,{q:'pip'});
  addNPC('Trainee Drest','😤','yard bully',12.5,16.5,{q:'drest'});
  spawnEnemy('Candlekeep Assassin','🗡️',{STR:14,DEX:14,CON:12,INT:10,WIS:10,CHA:8},16,13,2,'Shortsword',11.5,8.5,60,'q1a');
  if(sqState('s_rats')==='active'&&!G.flags.ratsDead){
   spawnEnemy('Cellar Rat','🐀',{STR:8,DEX:14,CON:10,INT:3,WIS:10,CHA:4},8,12,1,'Dagger',30.5,6.5,25,'rat1',false,'s_rats');
   spawnEnemy('Cellar Rat','🐀',{STR:8,DEX:14,CON:10,INT:3,WIS:10,CHA:4},8,12,1,'Dagger',32.5,7.5,25,'rat2',false,'s_rats');
   spawnEnemy('Cellar Rat','🐀',{STR:8,DEX:14,CON:10,INT:3,WIS:10,CHA:4},8,12,1,'Dagger',29.5,8.5,25,'rat3',false,'s_rats');
  }
  if(sqState('s_spar')==='active'&&!G.flags.sparDone)spawnEnemy('Training Squire','🤺',{STR:12,DEX:11,CON:12,INT:9,WIS:10,CHA:9},14,12,1,'Longsword',22.5,16.5,40,'spar1',false,'s_spar');
  addLoot(22.5,10.5,{gold:15,n:'Healing Potion',t:'potion'});
  if(sqState('s_tome')==='active'&&!G.flags.tomeFound)addLoot(3.5,7.5,{gold:0,n:"Wynne's Tome",t:'quest_tome'});
  for(const[wx,wy]of[[5.5,8.5],[8.5,11.5],[12.5,7.5]])if(sqState('s_candle')==='active'&&!G.flags['candle'+wx])addLoot(wx,wy,{gold:0,n:'Vigil Candle',t:'quest_candle'});
  exits.push({x:20.5,y:19.5,to:1,label:'➡️ South Gate · Coast Way'});
  if(!G.flags.intro){G.flags.intro=true;setTimeout(()=>startDialog('greet'),700);}
 }else if(zi===1){
  /* --- Coast Way Inn --- */
  if(!G.flags.liaJoined)addNPC('Lia','🦹','quick-fingered halfling',9.5,6.5,{q:'lia'});
  if(!G.flags.marenJoined)addNPC('Sister Maren','🧕','shield of the temple',7.5,6.5,{q:'maren'});
  addNPC('Innkeep Tess','🍺','warm smile, tired eyes',9.5,5.5,{q:'tess'});
  addNPC('Traveler Obe','🧳','road gossip',20.5,8.5,{q:'traveler'});
  addNPC('Raler the Bard','🎻','lute, debts, excuses',14.5,6.5,{q:'raler'});
  addNPC('Hunter Kess','🏹','pelts and patience',24.5,8.5,{q:'kess'});
  addNPC('Pilgrim Ava','🧎','sickly pilgrim',12.5,12.5,{q:'ava'});
  addNPC('Notice Board','📌','contracts & bounties',6.5,9.5,{q:'board'});
  if(!G.flags.q2ambush&&G.flags.liaJoined&&G.flags.marenJoined){/* ambush spawns via recruit */}
  else if(!G.flags.thugsDead){spawnEnemy('Roadside Thug','🔪',{STR:13,DEX:12,CON:12,INT:8,WIS:9,CHA:9},14,12,1,'Dagger',18.5,17.5,45,'q2a');spawnEnemy('Roadside Thug','🔪',{STR:13,DEX:12,CON:12,INT:8,WIS:9,CHA:9},14,12,1,'Dagger',21.5,17.5,45,'q2b');}
  spawnBountiesFor(1);
  addLoot(24.5,13.5,{gold:20,n:'Potion of Healing',t:'potion'});
  for(const[hx,hy]of[[16.5,13.5],[22.5,5.5],[10.5,15.5]])if(sqState('s_herbs')==='active')addLoot(hx,hy,{gold:0,n:'Feverfew',t:'quest_herb'});
  props.push({t:'C',x:28.5,y:10.5,label:'Campfire'});
  exits.push({x:2.5,y:6.5,to:0,label:'⬅️ Candlekeep'},{x:30.5,y:18.5,to:2,label:'➡️ The Wilds'},{x:10.5,y:19.5,to:6,label:'⬇️ Nashkel Village'});
 }else if(zi===2){
  /* --- The Wilds --- */
  addNPC('Scout Dell','🏹','wounded scout',14.5,9.5,{q:'dell'});
  addNPC('Hermit Vesper','🧙','mad? wise? both?',33.5,16.5,{q:'vesper'});
  if(!G.flags.wildsClear){spawnEnemy('Gnoll','🐺',{STR:15,DEX:12,CON:11,INT:6,WIS:10,CHA:7},22,13,2,'Greataxe',20.5,8.5,80,'w1');spawnEnemy('Gnoll','🐺',{STR:15,DEX:12,CON:11,INT:6,WIS:10,CHA:7},22,13,2,'Greataxe',23.5,12.5,80,'w2');spawnEnemy('Gnoll Alpha','👹',{STR:16,DEX:12,CON:13,INT:7,WIS:10,CHA:8},34,14,3,'Greataxe',29.5,16.5,140,'w3');spawnEnemy('Iron Mercenary','🛡️',{STR:14,DEX:11,CON:13,INT:10,WIS:10,CHA:10},26,14,2,'Longsword',10.5,13.5,90,'w4');}
  if(sqState('s_pelts')==='active')for(const[wx,wy,id]of[[12.5,6.5,'pw1'],[14.5,16.5,'pw2'],[26.5,6.5,'pw3']])if(!G.flags['pelt_'+id])spawnEnemy('Wild Wolf','🐺',{STR:13,DEX:14,CON:12,INT:3,WIS:12,CHA:6},14,13,1,'Dagger',wx,wy,50,id,false,'s_pelts');
  if(sqState('s_wolfpack')==='active'&&!G.flags.direDead)spawnEnemy('Dire Wolf','🐺',{STR:17,DEX:13,CON:14,INT:3,WIS:12,CHA:7},40,14,3,'Greataxe',8.5,5.5,160,'dire1',false,'s_wolfpack');
  spawnBountiesFor(2);
  addLoot(31.5,11.5,{gold:40,n:'Potion of Greater Healing',t:'gpotion'});
  addLoot(8.5,15.5,{gold:10,n:"Patrol's Letter",t:'quest_letter'});
  if(sqState('s_ring')==='active'&&!G.flags.ringFound)addLoot(24.5,6.5,{gold:0,n:"Obe's Ring",t:'quest_ring'});
  for(const[sx,sy,id]of[[9.5,11.5,'sn1'],[17.5,14.5,'sn2'],[27.5,9.5,'sn3']])if(sqState('s_snare')==='active'&&!G.flags['snare_'+id])addLoot(sx,sy,{gold:0,n:'Gnoll Snare',t:'quest_snare',sq:id});
  addChest(33.5,14.5,{name:'Old Stump Cache',dc:12,trap:true,loot:{gold:60,n:'Jade',t:'gem'}});
  props.push({t:'C',x:2.5,y:17.5,label:'Campfire'});
  exits.push({x:2.5,y:6.5,to:1,label:'⬅️ Coast Way'},{x:30.5,y:18.5,to:3,label:'➡️ Iron Mines'},{x:20.5,y:19.5,to:4,label:'⬇️ Bandit Camp'},{x:20.5,y:1.5,to:7,label:'⬆️ Gnoll Stronghold'});
 }else if(zi===3){
  /* --- Iron Mines --- */
  addNPC('Foreman Dain','⛏️','dust and fury',10.5,16.5,{q:'dain'});
  addNPC('Miner Hobb','🧑‍🏭','caged miner',7.5,12.5,{q:'miner1'});
  addNPC('Miner Sella','👷','caged miner',8.5,13.5,{q:'miner2'});
  if(!G.flags.minesClear){spawnEnemy('Kobold Guard','🐀',{STR:10,DEX:14,CON:10,INT:8,WIS:8,CHA:8},12,13,1,'Dagger',12.5,8.5,40,'m1');spawnEnemy('Kobold Guard','🐀',{STR:10,DEX:14,CON:10,INT:8,WIS:8,CHA:8},12,13,1,'Dagger',24.5,8.5,40,'m2');spawnEnemy('Iron Enforcer','🦍',{STR:16,DEX:10,CON:14,INT:8,WIS:9,CHA:8},38,14,3,'Greataxe',13.5,18.5,150,'m3');spawnEnemy('Iron Priest Malach','🧛',{STR:12,DEX:12,CON:14,INT:14,WIS:14,CHA:14},52,15,4,'Mace',28.5,8.5,220,'boss',true);}
  spawnBountiesFor(3);
  addLoot(11.5,17.5,{gold:60,n:'Potion of Greater Healing',t:'gpotion'});
  if(!G.flags.canaryFound)addLoot(32.5,6.5,{gold:0,n:"Dain's Canary",t:'quest_canary'});
  addChest(33.5,13.5,{name:'Hidden Ledger Cache',dc:14,trap:true,loot:{gold:40,n:'Ledger of Names',t:'quest_ledger'}});
  addProp('⚙️',30.5,13.5,'Forge Valve (west)','valve1');
  addProp('⚙️',24.5,13.5,'Forge Valve (east)','valve2');
  props.push({t:'C',x:26.5,y:12.5,label:'Campfire'});
  exits.push({x:8.5,y:4.5,to:2,label:'⬅️ The Wilds'});
 }else if(zi===4){
  /* --- Bandit Camp --- */
  if(!G.flags.brammJoined)addNPC('Bramm (captive)','🧔','chained dwarf',10.5,10.5,{q:'bramm'});
  addNPC('Wren (captive)','🧒','frightened scribe',12.5,10.5,{q:'wren'});
  addNPC('Tam the Deserter','🥷','shifty, scared',26.5,13.5,{q:'tam'});
  if(!G.flags.campClear){
   spawnEnemy('Bandit Chief Karg','👹',{STR:17,DEX:13,CON:15,INT:10,WIS:11,CHA:12},48,15,4,'Greataxe',16.5,8.5,240,'chief',true);
   spawnEnemy('Black Hand Shaman','🔮',{STR:9,DEX:12,CON:12,INT:14,WIS:15,CHA:11},30,13,3,'Quarterstaff',19.5,9.5,150,'shaman');
   spawnEnemy('Bandit','🔪',{STR:13,DEX:13,CON:12,INT:9,WIS:10,CHA:9},18,13,2,'Shortsword',9.5,7.5,70,'b1');
   spawnEnemy('Bandit','🔪',{STR:13,DEX:13,CON:12,INT:9,WIS:10,CHA:9},18,13,2,'Shortsword',21.5,7.5,70,'b2');
   if(sqState('s_dogs')==='active')for(const[dx,dy,id]of[[7.5,13.5,'dog1'],[22.5,11.5,'dog2'],[15.5,15.5,'dog3']])spawnEnemy('War Dog','🐕',{STR:14,DEX:14,CON:12,INT:3,WIS:12,CHA:6},16,13,2,'Dagger',dx,dy,60,id,false,'s_dogs');
  }
  spawnBountiesFor(4);
  addChest(17.5,10.5,{name:"Chief's Strongbox",dc:15,trap:true,key:'tamkey',loot:{gold:120,n:'Ruby',t:'gem'}});
  addProp('🛢️',8.5,8.5,'Poison Barrel','barrel1');
  addProp('🛢️',20.5,8.5,'Poison Barrel','barrel2');
  addProp('🛢️',15.5,6.5,'Poison Barrel','barrel3');
  addProp('🚩',13.5,5.5,'War Banner','banner');
  props.push({t:'C',x:24.5,y:14.5,label:'Campfire'});
  exits.push({x:2.5,y:13.5,to:2,label:'⬅️ The Wilds'},{x:30.5,y:15.5,to:5,label:'➡️ Baldur\'s Gate'});
  }else if(zi===5){
  /* --- Baldur's Gate --- */
  if(!G.flags.elowenJoined)addNPC('Elowen','👩','elven mage, impatient',12.5,5.5,{q:'elowen'});
  addNPC('Merchant Miri','🏪','everything, for a price',20.5,8.5,{q:'miri'});
  addNPC('Captain Ria','💂','city guard captain',8.5,8.5,{q:'ria'});
  addNPC('Widow Bell','🧕','grieving widow',8.5,5.5,{q:'widow'});
  addNPC('Vex the Informant','🎭','knows things',27.5,8.5,{q:'vex'});
  addNPC('Priest Alden','⛪','temple priest',30.5,10.5,{q:'alden'});
  addNPC('Pitmaster','🥊','keeper of the pit',25.5,16.5,{q:'pit'});
  addNPC('Orphan Nib','🧒','small, quick, hungry',6.5,12.5,{q:'nib'});
  if(sqState('s_rats2')==='active'&&!G.flags.wereratDead)spawnEnemy('Wererat Thief','🐀',{STR:12,DEX:16,CON:13,INT:10,WIS:11,CHA:9},34,14,3,'Shortsword',33.5,5.5,150,'wererat',false,'s_rats2');
  if(sqState('s_arena')==='active'&&!G.flags['arenaDone']){const wv=G.flags.arenaWave||0;if(wv>0){for(let i=0;i<wv+1;i++)spawnEnemy('Pit Fighter '+['I','II','III','IV'][i],'🥊',{STR:15+i,DEX:12,CON:14,INT:8,WIS:10,CHA:8},20+i*10,13,2+i,'Greataxe',23.5+i*2,16.5,100,'pit'+i,false,'s_arena');}}
  if(!G.flags.cityClear){
   const weak=G.flags.sarevWeak?0:2;
   spawnEnemy('Lord Sarev','👑',{STR:18,DEX:14,CON:16,INT:14,WIS:12,CHA:16},70,G.flags.sarevWeak?15:17,5,'Longsword +1',16.5,11.5,400,'sarev',true);
   const guards=G.flags.guardsDesert?2:4;
   const gp=[[14.5,10.5],[18.5,10.5],[14.5,12.5],[18.5,12.5]];
   for(let i=0;i<guards;i++)spawnEnemy('Iron Honor Guard','🛡️',{STR:15-weak,DEX:12,CON:14,INT:9,WIS:10,CHA:9},32,15,3,'Longsword',gp[i][0],gp[i][1],130,'hg'+i);
  }
  spawnBountiesFor(5);
  addChest(21.5,12.5,{name:'HQ Strongbox',dc:15,trap:true,key:'hqkey',loot:{gold:100,n:"Widow's Locket",t:'quest_locket'}});
  addProp('⛪',30.5,10.5,'Temple Altar','temple');
  props.push({t:'C',x:10.5,y:17.5,label:'Campfire'});
  exits.push({x:2.5,y:10.5,to:4,label:'⬅️ Bandit Camp'},{x:33.5,y:18.5,to:9,label:'🕳️ Sewers'});
 }
 else if(zi===6){
  /* --- Nashkel Village --- */
  addNPC('Mayor Henn','🧔','worried mayor',10.5,5.5,{q:'henn'});
  addNPC('Shopkeep Pell','🏪','flour, feed & blades',20.5,3.5,{q:'pell'});
  addNPC('Priest Lanna','⛪','gentle healer',8.5,11.5,{q:'lanna'});
  if(!G.flags.sorrelJoined)addNPC('Sorrel','🏹','hooded archer',14.5,14.5,{q:'sorrel'});
  addNPC('Kid Tilda','🧒','tearful goatherd',24.5,8.5,{q:'tilda'});
  addNPC('Notice Board','📌','contracts & bounties',6.5,8.5,{q:'board'});
  if(sqState('s_well')==='active'&&!G.flags.wellDone){
   spawnEnemy('Well Horror','🕷️',{STR:12,DEX:14,CON:12,INT:3,WIS:10,CHA:4},16,13,2,'Dagger',5.5,5.5,60,'wh1',false,'s_well');
   spawnEnemy('Well Horror','🕷️',{STR:12,DEX:14,CON:12,INT:3,WIS:10,CHA:4},16,13,2,'Dagger',7.5,7.5,60,'wh2',false,'s_well');
   spawnEnemy('Well Horror','🕷️',{STR:12,DEX:14,CON:12,INT:3,WIS:10,CHA:4},16,13,2,'Dagger',4.5,7.5,60,'wh3',false,'s_well');
  }
  if(G.flags.caravanPaid&&!G.flags.caravanDone){
   if(!enemies.some(e=>e.id&&e.id.startsWith('cv'))) {
    spawnEnemy('Caravan Raider','🔪',{STR:13,DEX:13,CON:12,INT:9,WIS:10,CHA:9},20,13,2,'Shortsword',16.5,14.5,70,'cv1');
    spawnEnemy('Caravan Raider','🔪',{STR:13,DEX:13,CON:12,INT:9,WIS:10,CHA:9},20,13,2,'Shortsword',19.5,15.5,70,'cv2');
    spawnEnemy('Caravan Raider','🔪',{STR:13,DEX:13,CON:12,INT:9,WIS:10,CHA:9},20,13,2,'Shortsword',17.5,17.5,70,'cv3');
   }
  }
  spawnBountiesFor(6);
  addChest(9.5,12.5,{name:'Mill Loft Chest',dc:11,trap:false,loot:{gold:35,n:'Potion of Healing',t:'potion'}});
  props.push({t:'C',x:28.5,y:10.5,label:'Campfire'});
  exits.push({x:10.5,y:1.5,to:1,label:'⬆️ Coast Way Inn'},{x:30.5,y:14.5,to:8,label:'➡️ Cloakwood'});
 }
 else if(zi===7){
  /* --- Gnoll Stronghold --- */
  if(!G.flags.tinkFree)addNPC('Tink (captive)','🔧','gnome in a cage',12.5,10.5,{q:'tink'});
  if(!G.flags.chiefDead){
   spawnEnemy('Gnoll Chieftain','👹',{STR:18,DEX:13,CON:16,INT:8,WIS:11,CHA:10},55,15,4,'Greataxe +1',28.5,8.5,260,'chief2',true,'s_chief');
   spawnEnemy('Gnoll Shaman','🔮',{STR:10,DEX:12,CON:12,INT:12,WIS:15,CHA:9},30,13,3,'Quarterstaff',24.5,7.5,150,'sh2');
   spawnEnemy('Gnoll Guard','🐺',{STR:15,DEX:12,CON:12,INT:6,WIS:10,CHA:7},24,13,2,'Greataxe',14.5,6.5,80,'g1');
   spawnEnemy('Gnoll Guard','🐺',{STR:15,DEX:12,CON:12,INT:6,WIS:10,CHA:7},24,13,2,'Greataxe',20.5,12.5,80,'g2');
  }
  spawnBountiesFor(7);
  addChest(30.5,5.5,{name:"Chieftain's Hoard",dc:14,trap:true,loot:{gold:150,n:'Shortsword +1',t:'weapon'}});
  addLoot(10.5,13.5,{gold:20,n:'Potion of Healing',t:'potion'});
  props.push({t:'C',x:8.5,y:15.5,label:'Campfire'});
  exits.push({x:20.5,y:19.5,to:2,label:'⬇️ The Wilds'});
 }
 else if(zi===8){
  /* --- Cloakwood --- */
  addNPC('Druid Ash','🌿','bark-skinned warden',12.5,8.5,{q:'ash'});
  addNPC('Tracker Sarella','🧭','treasure hunter',24.5,13.5,{q:'sarella'});
  spawnEnemy('Giant Spider','🕷️',{STR:13,DEX:15,CON:12,INT:3,WIS:10,CHA:4},18,14,2,'Dagger',10.5,6.5,70,'sp1');
  spawnEnemy('Giant Spider','🕷️',{STR:13,DEX:15,CON:12,INT:3,WIS:10,CHA:4},18,14,2,'Dagger',28.5,9.5,70,'sp2');
  if(!G.flags.queenDead)spawnEnemy('Spider Queen','🕷️',{STR:16,DEX:14,CON:15,INT:4,WIS:11,CHA:5},45,15,4,'Greataxe',20.5,14.5,220,'sq_queen',true);
  spawnBountiesFor(8);
  if(!G.flags.bellFound)addLoot(30.5,16.5,{gold:0,n:"Bess's Bell",t:'quest_bell'});
  if(sqState('s_mill')==='active'&&!G.flags.wheelFound)addLoot(6.5,12.5,{gold:0,n:'Mill Wheel',t:'quest_millwheel'});
  addChest(33.5,6.5,{name:"Hunter's Cache",dc:15,trap:true,loot:{gold:90,n:'Diamond',t:'gem'}});
  if(sqState('s_blight')==='active')for(const[bx,by,id]of[[14.5,11.5,'bl1'],[22.5,6.5,'bl2'],[8.5,15.5,'bl3']])if(!G.flags[id])addProp('🦠',bx,by,'Blight Growth',id);
  props.push({t:'C',x:30.5,y:8.5,label:'Campfire'});
  exits.push({x:2.5,y:4.5,to:6,label:'⬅️ Nashkel Village'},{x:20.5,y:1.5,to:2,label:'⬆️ The Wilds'});
 }
 else{
  /* --- City Sewers --- */
  addNPC('Fence Skiv','🦹','buyer of everything',20.5,3.5,{q:'skiv'});
  addNPC('Cold-Eyed Mara','🗡️','thieves\' lieutenant',10.5,10.5,{q:'mara'});
  addNPC('Sergeant Dunn','💂','guard patrol lead',26.5,10.5,{q:'dunn'});
  if(G.flags.guildSide==='thieves'&&!G.flags.guildDone){
   if(!enemies.some(e=>e.id&&e.id.startsWith('gd')))for(let i=0;i<3;i++){const s=snapFloor(24.5+i*2,12.5);spawnEnemy('Guard Loyalist','💂',{STR:14,DEX:12,CON:14,INT:10,WIS:11,CHA:10},26,14,3,'Longsword',s.x,s.y,110,'gd'+i);}
  }
  if(G.flags.guildSide==='guard'&&!G.flags.guildDone){
   if(!enemies.some(e=>e.id&&e.id.startsWith('gt')))for(let i=0;i<3;i++){const s=snapFloor(8.5+i*2,12.5);spawnEnemy('Guild Cutthroat','🗡️',{STR:13,DEX:15,CON:12,INT:10,WIS:10,CHA:10},26,14,3,'Shortsword',s.x,s.y,110,'gt'+i);}
  }
  if(!G.flags.beastDead)spawnEnemy('Sewer Beast','🐊',{STR:18,DEX:12,CON:17,INT:4,WIS:11,CHA:6},60,15,4,'Greataxe',16.5,11.5,280,'sbeast',true);
  addChest(28.5,10.5,{name:'Guild Vault',dc:16,trap:true,loot:{gold:200,n:'Ruby',t:'gem'}});
  props.push({t:'C',x:20.5,y:17.5,label:'Campfire'});
  exits.push({x:8.5,y:2.5,to:5,label:'⬆️ Baldur\'s Gate'});
 }
 /* bounty board state refresh */
 snapAll();
 markQuestGivers();
 let sp=null;
 if(spawnTag==='exit0'&&exits.length){const e=exits[0];sp={x:e.x,y:e.y+1.2};}
 else if(spawnTag==='exit1'&&exits.length){const e=exits[exits.length-1];sp={x:e.x,y:e.y-1.2};}
 else if(spawnTag&&spawnTag.x){sp=spawnTag;}
 else{const s=findTiles('S')[0]||findTiles('E')[0]||{x:6,y:6};sp={x:s.x,y:s.y+1};}
 G.party.forEach((p,i)=>{p.x=clamp(sp.x+(i%2)*1-0.5,1.5,GW-1.5);p.y=clamp(sp.y+Math.floor(i/2)*1,1.5,GH-1.5);p.tx=null;p.ty=null;p.cool=0;});
 combat.active=false;combat.round=1;combat.order=[];combat.t=0;combat.paused=false;updatePauseBtn();
 $('zone-name').textContent=ZONES[zi].name;
 updateTracker();refreshParty();refreshActions();save();
 toast('📍 '+ZONES[zi].name+'<br><small>'+ZONES[zi].sub+'</small>');
 clog('📍 Entered <b>'+ZONES[zi].name+'</b>','info');
}
/* ============ 4. CREATION UI ============ */
const CC={name:'Asha',race:'Human',class:'Fighter',face:'🧑',bg:'Folk Hero',abil:{STR:15,DEX:13,CON:14,INT:10,WIS:12,CHA:8},points:27};
const COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
function ccPoints(){let s=0;for(const k in CC.abil)s+=COST[CC.abil[k]];return 27-s;}
function renderCC(){
 const rc=$('cc-races');rc.innerHTML='';for(const k in RACES){const b=document.createElement('button');b.className='chip'+(CC.race===k?' sel':'');b.textContent=RACES[k].icon+' '+RACES[k].name;b.onclick=()=>{CC.race=k;CC.face=RACES[k].icon;sfx.talk();renderCC();};rc.appendChild(b);}
 $('cc-race-desc').textContent=RACES[CC.race].desc+' Speed '+RACES[CC.race].speed+'ft.';
 const cl=$('cc-classes');cl.innerHTML='';for(const k in CLASSES){const b=document.createElement('button');b.className='chip'+(CC.class===k?' sel':'');b.textContent=CLASSES[k].icon+' '+CLASSES[k].name;b.onclick=()=>{CC.class=k;sfx.talk();renderCC();};cl.appendChild(b);}
 $('cc-class-desc').textContent=CLASSES[CC.class].desc+' '+(CLASSES[CC.class].features||[]).join(' · ');
 const pr=$('cc-portraits');pr.innerHTML='';PORTRAITS.forEach(p=>{const b=document.createElement('button');b.className='chip'+(CC.face===p?' sel':'');b.textContent=p;b.onclick=()=>{CC.face=p;renderCC();};pr.appendChild(b);});
 const vv=$('cc-voice');vv.innerHTML='';['Silent','Bold','Wry'].forEach(v=>{const b=document.createElement('button');b.className='chip'+((CC.voice||'Bold')===v?' sel':'');b.textContent=v;b.onclick=()=>{CC.voice=v;renderCC();};vv.appendChild(b);});
 const ab=$('cc-abilities');ab.innerHTML='';CC.points=ccPoints();$('cc-points').textContent=CC.points;
 for(const k of['STR','DEX','CON','INT','WIS','CHA']){const row=document.createElement('div');row.className='ab-row';const base=CC.abil[k],raceB=(RACES[CC.race].mods[k]||0);row.innerHTML=`<b>${k}</b><small>${base} +${raceB} racial = <b>${base+raceB}</b> (${fmtMod(mod(base+raceB))})</small>`;const dm=document.createElement('button');dm.textContent='−';dm.onclick=()=>{if(CC.abil[k]>8){CC.abil[k]--;renderCC();}};const cur=document.createElement('div');cur.style.textAlign='center';cur.style.fontSize='20px';cur.textContent=base;const pl=document.createElement('button');pl.textContent='+';pl.onclick=()=>{if(CC.abil[k]<15&&ccPoints()>=COST[CC.abil[k]+1]-COST[CC.abil[k]]){CC.abil[k]++;renderCC();}else toast('Not enough points');};row.appendChild(dm);row.appendChild(cur);row.appendChild(pl);ab.appendChild(row);}
 const bg=$('cc-bg');bg.innerHTML='';BACKGROUNDS.forEach(b=>{const btn=document.createElement('button');btn.className='chip'+(CC.bg===b?' sel':'');btn.textContent=b;btn.onclick=()=>{CC.bg=b;renderCC();};bg.appendChild(btn);});
 const final={};for(const k in CC.abil)final[k]=CC.abil[k]+(RACES[CC.race].mods[k]||0);
 $('cc-summary').innerHTML=`<b>${$('cc-name').value||'Hero'}</b> · ${RACES[CC.race].icon} ${CC.race} ${CLASSES[CC.class].icon} ${CC.class} · HP ${CLASSES[CC.class].hp+mod(final.CON)} · AC ${CLASSES[CC.class].ac} · ${CC.bg}`;
}
/* ============ 5. CANVAS / RENDER / INPUT ============ */
const cv=$('game-canvas'),ctx=cv.getContext('2d');
let cam={x:5,y:5},view={w:0,h:0},DPR=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);const r=$('screen-game').getBoundingClientRect();view.w=r.width;view.h=r.height;cv.width=r.width*DPR;cv.height=r.height*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);}
window.addEventListener('resize',resize);
function w2s(x,y){return[(x-cam.x)*TILE+view.w/2,(y-cam.y)*TILE+view.h/2];}
function s2w(px,py){return[(px-view.w/2)/TILE+cam.x,(py-view.h/2)/TILE+cam.y];}
function tileColor(t,x,y){
 if(t==='#'){const v=((x*7+y*13)%3);return['#3d3428','#443a2c','#372e22'][v];}
 if(t==='T')return'#1d3a1e';if(t==='~')return'#173a4d';if(t==='L')return'#2c4a68';
 if(t==='B')return'#4d2c1a';if(t==='R')return'#5a4a33';if(t==='I')return'#4a3a24';if(t==='N')return'#4a3a24';
 if(t==='A')return'#3a2e1e';if(t==='C')return'#2e2a1a';
 if(t==='H')return'#4a3226';if(t==='P')return'#3a2c1a';if(t==='D')return'#4d3d28';if(t==='K')return'#2a2a30';if(t==='O')return'#33302a';
 if(t==='W')return'#2e3a2a';if(t==='M')return'#3d3220';
 const v=((x*3+y*5)%2);return v?'#2e2b20':'#323026';
}
function draw(){
 if(!G||!G.hero)return;
 ctx.fillStyle='#000';ctx.fillRect(0,0,view.w,view.h);
 const l=selected()||leader();
 cam.x+=(l.x-cam.x)*.08;cam.y+=(l.y-cam.y)*.08;
 {const hw=(view.w/2)/TILE,hh=(view.h/2)/TILE;
  cam.x=GW*TILE<=view.w?GW/2:clamp(cam.x,hw,GW-hw);
  cam.y=GH*TILE<=view.h?GH/2:clamp(cam.y,hh,GH-hh);}
 const[x0,y0]=s2w(0,0),[x1,y1]=s2w(view.w,view.h);
 for(let y=Math.max(0,Math.floor(y0)-1);y<=Math.min(GH-1,Math.ceil(y1)+1);y++)for(let x=Math.max(0,Math.floor(x0)-1);x<=Math.min(GW-1,Math.ceil(x1)+1);x++){
  const[sx,sy]=w2s(x,y);const t=grid[y][x];
  ctx.fillStyle=tileColor(t,x,y);ctx.fillRect(sx,sy,TILE+1,TILE+1);
  if(t==='#'){ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(sx,sy+TILE-8,TILE+1,8);ctx.fillStyle='#5a4c36';ctx.fillRect(sx,sy,TILE+1,4);}
  else if(t==='T'){ctx.font='22px serif';ctx.textAlign='center';ctx.fillText(((x+y)%2)?'🌲':'🌳',sx+TILE/2,sy+26);}
  else if(t==='L'){ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('📚',sx+TILE/2,sy+25);}
  else if(t==='B'){ctx.font='18px serif';ctx.textAlign='center';ctx.fillText('🛏️',sx+TILE/2,sy+24);}
  else if(t==='R'){ctx.font='16px serif';ctx.textAlign='center';ctx.fillText('🪨',sx+TILE/2,sy+24);}
  else if(t==='H'){ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('🏠',sx+TILE/2,sy+26);}
  else if(t==='P'){ctx.fillStyle='#5a4426';ctx.fillRect(sx+4,sy+2,4,TILE-4);ctx.fillRect(sx+14,sy+2,4,TILE-4);ctx.fillRect(sx+24,sy+2,4,TILE-4);}
  else if(t==='D'){ctx.fillStyle='rgba(216,169,78,.25)';ctx.fillRect(sx,sy,TILE+1,TILE+1);}
  else if(t==='K'){ctx.strokeStyle='#888';ctx.lineWidth=3;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(sx+6+i*8,sy+2);ctx.lineTo(sx+6+i*8,sy+TILE-2);ctx.stroke();}}
  else if(t==='O'){ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('🛢️',sx+TILE/2,sy+26);}
  else if(t==='W'){ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('⛲',sx+TILE/2,sy+26);}
  else if(t==='M'){ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('🏪',sx+TILE/2,sy+26);}
  else if(t==='.'){if((x*7+y*11)%9===0){ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(sx+8,sy+8,3,3);}}
 }
 // exits (pulsing beacons)
 ctx.textAlign='center';
 const pulse=1+Math.sin(Date.now()/350)*.12;
 for(const e of exits){const[sx,sy]=w2s(e.x,e.y);ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle='#f5d789';ctx.lineWidth=3;ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,15*pulse,0,7);ctx.stroke();ctx.restore();ctx.font='26px serif';ctx.fillText('🚪',sx+TILE/2,sy+27);ctx.fillStyle='#ffe9b0';ctx.font='11px Georgia';ctx.fillText(e.label,sx+TILE/2,sy+42);}
 for(const p of props){const[sx,sy]=w2s(p.x,p.y);const ic=p.t==='C'?'🔥':(p.use?'❔':p.t);ctx.font='26px serif';ctx.fillText(ic,sx+TILE/2,sy+27);if(p.use){ctx.fillStyle='#ffe9b0';ctx.font='10px Georgia';ctx.fillText(p.label,sx+TILE/2,sy+40);}}
 for(const c of chests){if(c.opened)continue;const[sx,sy]=w2s(c.x,c.y);const b=Math.sin(Date.now()/400)*2;ctx.font='24px serif';ctx.fillText('🎁',sx+TILE/2,sy+28+b);}
 for(const l2 of loots){if(l2.taken)continue;const[sx,sy]=w2s(l2.x,l2.y);const b=Math.sin(Date.now()/400)*3;ctx.font='22px serif';ctx.fillText('✨',sx+TILE/2,sy+22+b);ctx.fillText('💰',sx+TILE/2,sy+30);}
 // npcs
 for(const n of npcs){const[sx,sy]=w2s(n.x,n.y);drawToken(sx,sy,n.face,'#4d7dd1',n.name,n.mark||(n.q==='lia'||n.q==='maren'||n.q==='bramm'||n.q==='elowen'?'➕':'💬'),false);}
 // enemies
 for(const e of enemies){if(!e.alive)continue;const[sx,sy]=w2s(e.x,e.y);const enraged=combat.active;drawToken(sx,sy,e.face,enraged?'#c0392b':'#7a5a3a',e.name,e.boss?'👑':'',true,e.hp/e.maxhp);}
 // party
 G.party.forEach((p,i)=>{const[sx,sy]=w2s(p.x,p.y);const isSel=i===(G.sel||0);
  if(p.hp<=0){ctx.font='24px serif';ctx.fillText('💀',sx+TILE/2,sy+26);return;}
  if(p.tx!=null){ctx.strokeStyle='rgba(255,215,137,.5)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(sx+TILE/2,sy+TILE/2);const[dx,dy]=w2s(p.tx,p.ty);ctx.lineTo(dx+TILE/2,dy+TILE/2);ctx.stroke();ctx.setLineDash([]);}
  drawToken(sx,sy,p.face,isSel?'#d8a94e':'#3fa34d',p.name,(p.cond.bless?'✨':'')+(p.cond.hidden?'🌙':''),false,p.hp/p.maxhp,isSel);
 });
 // objective arrow (quest compass)
 try{
  const ob=currentObjective();
  if(ob){const me2=selected()||leader();const dx=ob.x-me2.x,dy=ob.y-me2.y;const dd=Math.hypot(dx,dy);
   if(dd>3){
    const ang=Math.atan2(dy,dx);
    const rx=clamp(view.w/2+Math.cos(ang)*view.w*.38,30,view.w-30),ry=clamp(view.h/2+Math.sin(ang)*view.h*.32,90,view.h-170);
    ctx.save();ctx.translate(rx,ry);ctx.rotate(ang);
    ctx.fillStyle='rgba(245,215,137,.92)';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-9);ctx.lineTo(-4,0);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#ffe9b0';ctx.font='11px Georgia';ctx.textAlign='center';ctx.fillText('🎯 '+ob.label+' '+Math.round(dd*5)+'ft',rx,ry+22);
   }else{const[ox,oy]=w2s(ob.x,ob.y);ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('❗',ox+TILE/2,oy-4+Math.sin(Date.now()/300)*3);}
  }
 }catch(err){}
 // vignette
 const g=ctx.createRadialGradient(view.w/2,view.h/2,Math.min(view.w,view.h)*.35,view.w/2,view.h/2,Math.max(view.w,view.h)*.75);
 g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=g;ctx.fillRect(0,0,view.w,view.h);
 if(combat.paused){ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(0,0,view.w,view.h);ctx.fillStyle='#f5d789';ctx.font='bold 26px Georgia';ctx.textAlign='center';ctx.fillText('⏸ PAUSED',view.w/2,view.h/2);}
}
function drawToken(sx,sy,face,ring,name,mark,isEnemy,hpfrac,selRing){
 ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-4,TILE/2-2,7,0,0,7);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fill();
 if(selRing){ctx.strokeStyle='#f5d789';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE/2+4,TILE/2, TILE/2-2,0,0,7);ctx.stroke();}
 ctx.font='25px serif';ctx.textAlign='center';ctx.fillText(face,sx+TILE/2,sy+26);
 ctx.lineWidth=2;ctx.strokeStyle=ring;ctx.beginPath();ctx.arc(sx+TILE/2,sy+15,15,0,7);ctx.stroke();
 if(hpfrac!=null){ctx.fillStyle='#300';ctx.fillRect(sx+3,sy-2,TILE-6,5);ctx.fillStyle=hpfrac>.5?'#3fa34d':hpfrac>.25?'#d8a94e':'#c0392b';ctx.fillRect(sx+3,sy-2,(TILE-6)*clamp(hpfrac,0,1),5);}
 if(mark){ctx.font='13px serif';ctx.fillText(mark,sx+TILE/2,sy-4);}
}
function hasQuest(n){return !!n.mark;}
function liveEnemy(id){return enemies.find(e=>e.id===id&&e.alive);}
function currentObjective(){
 if(!G||!G.hero)return null;
 const Z=G.zone;
 if(G.quests.q1==='active'){const a=liveEnemy('q1a');if(a)return{x:a.x,y:a.y,label:'Assassin'};const e=exits[0];if(e)return{x:e.x,y:e.y,label:'South Gate'};}
 if(G.quests.q2==='active'){
  if(!G.flags.liaJoined){const n=npcs.find(n=>n.q==='lia');if(n)return{x:n.x,y:n.y,label:'Lia'};}
  if(!G.flags.marenJoined){const n=npcs.find(n=>n.q==='maren');if(n)return{x:n.x,y:n.y,label:'Maren'};}
  const t=enemies.find(e=>e.alive);if(t)return{x:t.x,y:t.y,label:t.name};
  const e=exits[exits.length-1];if(e)return{x:e.x,y:e.y,label:'Wilds'};
 }
 if(G.quests.q3==='active'){const t=enemies.find(e=>e.alive&&e.id.startsWith('w'));if(t)return{x:t.x,y:t.y,label:t.name};const e=exits.find(e=>e.to===3);if(e)return{x:e.x,y:e.y,label:'Mines'};}
 if(G.quests.q4==='active'){const b=liveEnemy('boss');if(b)return{x:b.x,y:b.y,label:'Iron Priest'};const t=enemies.find(e=>e.alive);if(t)return{x:t.x,y:t.y,label:t.name};}
 if(G.quests.q5==='active'){const c=liveEnemy('chief');if(c)return{x:c.x,y:c.y,label:'Chief Karg'};const s=liveEnemy('shaman');if(s)return{x:s.x,y:s.y,label:'Shaman'};const e=exits.find(e=>e.to===5);if(e)return{x:e.x,y:e.y,label:'City'};}
 if(G.quests.q6==='active'){const s=liveEnemy('sarev');if(s)return{x:s.x,y:s.y,label:'Lord Sarev'};const t=enemies.find(e=>e.alive);if(t)return{x:t.x,y:t.y,label:t.name};}
 return null;
}
function floatDmg(x,y,txt,cls){const[sx,sy]=w2s(x,y);const el=document.createElement('div');el.className='dmg '+cls;el.textContent=txt;el.style.left=(sx+Math.random()*20-10)+'px';el.style.top=(sy-6)+'px';$('dmg-layer').appendChild(el);setTimeout(()=>el.remove(),1150);}
/* ---- input: tap-to-move + joystick + keyboard ---- */
let joy={active:false,id:null,dx:0,dy:0};
(function(){
 const j=$('joystick'),s=$('stick');
 function setKnob(dx,dy){s.style.left=(31+dx*30)+'px';s.style.top=(31+dy*30)+'px';}
 j.addEventListener('pointerdown',e=>{joy.active=true;joy.id=e.pointerId;j.setPointerCapture(e.pointerId);joy.cx=e.clientX;joy.cy=e.clientY;});
 j.addEventListener('pointermove',e=>{if(!joy.active||e.pointerId!==joy.id)return;let dx=(e.clientX-joy.cx)/40,dy=(e.clientY-joy.cy)/40;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}joy.dx=dx;joy.dy=dy;setKnob(dx,dy);});
 const end=e=>{if(e.pointerId!==joy.id)return;joy.active=false;joy.dx=joy.dy=0;setKnob(0,0);};
 j.addEventListener('pointerup',end);j.addEventListener('pointercancel',end);
 let downPos=null,downT=0;
 cv.addEventListener('pointerdown',e=>{downPos={x:e.clientX,y:e.clientY};downT=Date.now();});
 cv.addEventListener('pointerup',e=>{
  if(!downPos)return;const moved=Math.hypot(e.clientX-downPos.x,e.clientY-downPos.y);downPos=null;
  if(moved>12||Date.now()-downT>600)return;
  const r=cv.getBoundingClientRect();const[wx,wy]=s2w(e.clientX-r.left,e.clientY-r.top);
  handleTap(wx,wy);
 });
 window.addEventListener('keydown',e=>{
  if(!$('screen-game').classList.contains('active'))return;
  if(!$('dialog').classList.contains('hidden')||!$('panel').classList.contains('hidden')){if(e.key==='Escape'){closePanel();closeDialog();}return;}
  const k=e.key.toLowerCase();
  if(k===' '){e.preventDefault();togglePause();}
  if(k==='1'||k==='2'||k==='3'||k==='4'){G.sel=clamp(parseInt(k)-1,0,G.party.length-1);refreshParty();refreshActions();}
  keys[k]=true;
 });
 window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
})();
let keys={};
function handleTap(wx,wy){
 if(!G||!G.hero)return;
 // enemy?
 let best=null,bd=1.1;
 for(const e of enemies){if(!e.alive)continue;const dd=Math.hypot(e.x-wx,e.y-wy);if(dd<bd){bd=dd;best={t:'enemy',o:e}};}
 for(const n of npcs){const dd=Math.hypot(n.x-wx,n.y-wy);if(dd<bd){bd=dd;best={t:'npc',o:n}};}
 for(const l of loots){if(l.taken)continue;const dd=Math.hypot(l.x-wx,l.y-wy);if(dd<bd){bd=dd;best={t:'loot',o:l}};}
 for(const c of chests){if(c.opened)continue;const dd=Math.hypot(c.x-wx,c.y-wy);if(dd<bd){bd=dd;best={t:'chest',o:c}};}
 for(const e of exits){const dd=Math.hypot(e.x-wx,e.y-wy);if(dd<2.2){best={t:'exit',o:e};break;}}
 for(const p of props){const dd=Math.hypot(p.x-wx,p.y-wy);if(dd<2.2){best={t:'prop',o:p};break;}}
 const me=selected();
 if(!best){orderMove(me,wx,wy);return;}
 if(best.t==='enemy'){G.target={kind:'enemy',id:best.o.id};sfx.talk();toast('⚔️ '+me.name+' → attack '+best.o.name);if(dist(me,best.o)>attackRange(me))orderMove(me,best.o.x,best.o.y);return;}
 if(best.t==='npc'){const n=best.o;if(dist(me,n)<1.8){startDialog(n.q,n);}else{orderMove(me,n.x,n.y);G.pendingTalk=n;}}
 if(best.t==='loot'){const l=best.o;if(dist(me,l)<1.6)takeLoot(l);else{orderMove(me,l.x,l.y);G.pendingLoot=l;}}
 if(best.t==='chest'){const c=best.o;if(dist(me,c)<1.8)openChest(c);else{orderMove(me,c.x,c.y);G.pendingChest=c;}}
 if(best.t==='exit'){if(dist(me,best.o)<2.2)useExit(best.o);else{orderMove(me,best.o.x,best.o.y);G.pendingExit=best.o;}}
 if(best.t==='prop'){const p=best.o;if(p.use){if(dist(me,p)<1.8)useProp(p);else{orderMove(me,p.x,p.y);G.pendingProp=p;}}else{if(dist(me,p)<1.8)longRest(true);else{orderMove(me,p.x,p.y);G.pendingRest=true;}}}
}
function useProp(p){
 if(combat.active){toast('❌ Not during combat!');return;}
 const key=p.use;
 if(key==='valve1'||key==='valve2'){
  if(G.flags[key]){toast('Valve already turned.');return;}
  G.flags[key]=true;sfx.quest();clog('⚙️ Forge valve turned ('+(G.flags.valve1&&G.flags.valve2?'2/2':'1/2')+')','info');
  if(G.flags.valve1&&G.flags.valve2)finishSide('s_valve',{gold:70,xp:60});
  save();return;
 }
 if(key==='barrel1'||key==='barrel2'||key==='barrel3'){
  if(G.flags[key]){toast('Already burned.');return;}
  G.flags[key]=true;sfx.spell();clog('🔥 Poison barrel burned!','good');floatDmg(p.x,p.y,'🔥','hit');
  p.t='🔥';
  if(['barrel1','barrel2','barrel3'].every(k=>G.flags[k]))finishSide('s_barrels',{gold:80,xp:80});
  save();return;
 }
 if(key==='banner'){
  if(G.flags.bannerTorn){toast('The banner lies trampled.');return;}
  const me=selected();const r=d20()+mod(me.abil.STR)+profBonus(me.lvl);
  if(r>=13){G.flags.bannerTorn=true;G.party.forEach(q=>{if(q.hp>0)q.cond.bless=Math.max(q.cond.bless||0,5);});finishSide('s_banner',{xp:50});clog(`🚩 ${me.name} tears down the war banner! <span class="roll">[${r} vs 13]</span>`,'good');refreshParty();}
  else{clog(`🚩 The banner holds. <span class="roll">[${r} vs 13]</span> — try again!`);toast('🚩 The banner holds — pull harder!');}
  save();return;
 }
 if(key==='temple'){
  if(G.side.s_temple==='done'){toast('The flame burns steady.');return;}
  if(G.gold<50){toast('Alms: 50 gp (you lack it).');return;}
  G.gold-=50;G.flags.templeGift=true;G.party.forEach(q=>{if(q.hp>0)q.cond.bless=99;});finishSide('s_temple',{xp:60});toast('🙏 Blessed by every god!');refreshParty();save();return;
 }
 if(key==='bl1'||key==='bl2'||key==='bl3'){
  if(G.flags[key]){toast('Already cleansed.');return;}
  G.flags[key]=true;sfx.spell();clog('🌿 Blight growth burned!','good');floatDmg(p.x,p.y,'🔥','hit');
  p.t='🔥';
  if(['bl1','bl2','bl3'].every(k=>G.flags[k]))finishSide('s_blight',{gold:60,xp:60});
  save();return;
 }
}
function openChest(c){
 if(c.opened)return;
 const hasRogue=G.party.some(p=>p.hp>0&&p.cls==='Rogue');
 let h=`<div class="qitem">🎁 <b>${c.name}</b> · lock DC ${c.dc}${c.key?'<br>🔑 A special key fits this lock.':''}${c.trap?'<br>'+(hasRogue?'⚠️ <b>Trapped!</b> (rogue senses wires)':'<i>Something glints inside the lock…</i>'):''}</div>`;
 h+=`<button class="dbtn" id="ch-pick">🗝️ Pick lock (DEX${hasRogue?' +rogue':''})</button>`;
 h+=`<button class="dbtn" id="ch-force">💪 Force it (STR)</button>`;
 if(c.trap&&!c.disarmed)h+=`<button class="dbtn" id="ch-disarm">🧤 Disarm trap (DEX${hasRogue?' +rogue':''})</button>`;
 if(c.key)h+=`<button class="dbtn" id="ch-key">🔑 Use special key</button>`;
 openPanel('🎁 '+c.name,h);
 const failTrap=()=>{
  if(!c.trap||c.disarmed)return;
  const me=selected();const save2=d20()+mod(me.abil.DEX);
  if(save2>=13){const h=Math.floor(d(2,6)/2);damageParty(me,h);clog(`⚠️ Trap! ${me.name} half-dodges (${h}). <span class="roll">[${save2} vs 13]</span>`);}
  else{const h=d(2,6);damageParty(me,h);clog(`⚠️ Trap springs! ${me.name} takes ${h}. <span class="roll">[${save2} vs 13]</span>`,'crit');}
 };
 const doOpen=()=>{
  c.opened=true;G.chestsDone++;closePanel();sfx.quest();
  if(c.name==='Old Stump Cache'&&!G.flags.cacheOpened){G.flags.cacheOpened=true;if(!G.side.s_cache)startSide('s_cache');finishSide('s_cache',{xp:40});}
  takeLoot({taken:false,loot:c.loot});
 };
 $('ch-pick').onclick=()=>{const me=selected();const rogue=me.cls==='Rogue';let r=d20()+mod(me.abil.DEX)+profBonus(me.lvl)+(rogue?2:0);if(me.cond.bless)r+=rnd(1,4);
  if(r>=c.dc){clog(`🗝️ Lock picked! <span class="roll">[${r} vs ${c.dc}]</span>`,'good');failTrap();if(partyAlive())doOpen();}
  else{clog(`🗝️ Pick fails. <span class="roll">[${r} vs ${c.dc}]</span>`);failTrap();}};
 $('ch-force').onclick=()=>{const me=selected();const r=d20()+mod(me.abil.STR)+profBonus(me.lvl);
  if(r>=c.dc-2){clog(`💪 Forced open! <span class="roll">[${r}]</span>`,'good');failTrap();if(partyAlive())doOpen();}
  else{clog(`💪 It holds. <span class="roll">[${r}]</span>`);failTrap();}};
 const dd=$('ch-disarm');if(dd)dd.onclick=()=>{const me=selected();const rogue=me.cls==='Rogue';const r=d20()+mod(me.abil.DEX)+profBonus(me.lvl)+(rogue?2:0);
  if(r>=c.dc){c.disarmed=true;clog(`🧤 Trap disarmed! <span class="roll">[${r}]</span>`,'good');toast('🧤 Trap disarmed — now open it!');openChest(c);}
  else{clog(`🧤 Disarm fails! <span class="roll">[${r}]</span>`);failTrap();}};
 const kk=$('ch-key');if(kk)kk.onclick=()=>{
  const has=G.inv.some(i=>i.t==='key');
  if(!has){toast('No special key (Tam? Nib?)');return;}
  c.disarmed=true;clog('🔑 The key turns smoothly — trap bypassed.','good');doOpen();};
}
function orderMove(p,x,y){x=clamp(x,1.2,GW-1.2);y=clamp(y,1.2,GH-1.2);p.tx=x;p.ty=y;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function attackRange(ch){const w=WEAPONS[ch.weapon];return w&&w.ranged?5:1.5;}
/* pending arrival checks in update */
function tryMove(p,dt){
 let mx=0,my=0;
 const isSel=p===(selected());
 if(isSel){
  if(joy.active&&(Math.abs(joy.dx)>.15||Math.abs(joy.dy)>.15)){mx=joy.dx;my=joy.dy;p.tx=null;p.ty=null;}
  else if(keys.w||keys.arrowup)my-=1;else if(keys.s||keys.arrowdown)my+=1;
  if(keys.a||keys.arrowleft)mx-=1;else if(keys.d||keys.arrowright)mx+=1;
  if(mx||my){const m=Math.hypot(mx,my);mx/=m;my/=m;}
  else if(p.tx!=null){const dx=p.tx-p.x,dy=p.ty-p.y,dd=Math.hypot(dx,dy);if(dd<.15){p.tx=null;p.ty=null;}else{mx=dx/dd;my=dy/dd;}}
 }else{
  // companions follow leader
  const l=leader();const dd=dist(p,l);
  if(combat.active){/* handled by AI */}
  else if(dd>2.2){mx=(l.x-p.x)/dd;my=(l.y-p.y)/dd;}
  else if(dd<1.2&&dd>.01){mx=-(l.x-p.x)/dd*.5;my=-(l.y-p.y)/dd*.5;}
 }
 if(!mx&&!my)return;
 const sp=(p.speed/30)*4.2*(combat.paused?0:1);
 if(sp===0)return;
 const nx=p.x+mx*sp*dt,ny=p.y+my*sp*dt;
 if(!solidAt(nx,p.y))p.x=nx;else if(p.tx!=null&&isSel){p.tx=null;}
 if(!solidAt(p.x,ny))p.y=ny;else if(p.tx!=null&&isSel){p.ty=null;}
 p.x=clamp(p.x,1.1,GW-1.1);p.y=clamp(p.y,1.1,GH-1.1);
}
/* ============ 6. COMBAT (RTwP + 5e) ============ */
let combat={active:false,round:1,t:0,order:[],paused:false};
function updatePauseBtn(){$('btn-pause').textContent=combat.paused?'▶️':'⏸️';}
function togglePause(){combat.paused=!combat.paused;updatePauseBtn();clog(combat.paused?'⏸ <b>Paused</b> (space)':'▶️ Resumed');}
function startCombat(){
 if(combat.active)return;combat.active=true;combat.round=1;combat.t=0;
 const parts=[...G.party.filter(p=>p.hp>0).map(p=>({n:p.name,ref:p,foe:false,i:d20()+mod(p.abil.DEX)}))];
 for(const e of enemies){if(!e.alive)continue;if(dist(e,leader())<e.aggroR+3)parts.push({n:e.name,ref:e,foe:true,i:d20()+mod(e.abil.DEX)});}
 parts.sort((a,b)=>b.i-a.i);combat.order=parts;
 $('combat-banner').classList.remove('hidden');$('round-num').textContent='1';
 $('init-order').textContent='· '+parts.slice(0,5).map(p=>p.n).join(' › ');
 clog('⚔️ <b>Combat!</b> Initiative: '+parts.map(p=>`${p.n} ${p.i}`).join(', '),'info');
 beep(140,.25,'sawtooth');
}
function endCombat(victory){
 combat.active=false;$('combat-banner').classList.add('hidden');
 G.target=null;
 if(victory){clog('✅ Combat over.','good');checkQuestCombat();}
}
function checkQuestCombat(){
 const alive=enemies.some(e=>e.alive);
 if(!alive){
  if(G.zone===0&&G.quests.q1==='active'){G.flags.q1done=true;G.quests.q1='done';G.quests.q2='active';G.unlocked[1]=true;sfx.quest();toast('📜 Quest complete: <b>Murder in the Library</b><br>Flee through the <b>South Gate ➡️</b>!');gainXP(100);updateTracker();$('journal-dot').classList.remove('hidden');}
  else if(G.zone===1&&!enemies.some(e=>e.alive)&&!G.flags.thugsDead){G.flags.thugsDead=true;gainXP(60);toast('🍺 The inn breathes again! <b>Tess</b> owes you a favor.');sfx.quest();updateTracker();}
  else if(G.zone===2&&G.quests.q3==='active'&&!enemies.some(e=>e.alive&&(e.id.startsWith('w')))){G.flags.wildsClear=true;G.quests.q3='done';G.quests.q4='active';G.unlocked[3]=true;sfx.quest();toast('📜 <b>Trail of Iron</b> complete — the mines await! (➡️ east)');gainXP(200);updateTracker();$('journal-dot').classList.remove('hidden');}
  else if(G.zone===3&&G.quests.q4==='active'&&!enemies.some(e=>e.alive)){G.flags.minesClear=true;G.quests.q4='done';G.quests.q5='active';G.unlocked[4]=true;sfx.quest();toast('📜 <b>The Rotting Iron</b> complete — take the ledger south to the <b>Bandit Camp</b>!');gainXP(250);updateTracker();$('journal-dot').classList.remove('hidden');}
  else if(G.zone===4&&G.quests.q5==='active'&&!enemies.some(e=>e.alive&&(e.id==='chief'||e.id==='shaman'||e.id==='b1'||e.id==='b2'))){G.flags.campClear=true;G.quests.q5='done';G.quests.q6='active';G.unlocked[5]=true;sfx.quest();toast('📜 <b>Cut Off the Hand</b> complete — to <b>Baldur\'s Gate ➡️</b>!');gainXP(300);updateTracker();$('journal-dot').classList.remove('hidden');}
  else if(G.zone===5&&!enemies.some(e=>e.alive)){G.flags.cityClear=true;G.quests.q6='done';showVictory();}
  else if(G.zone===6&&G.flags.caravanPaid&&!G.flags.caravanDone&&!enemies.some(e=>e.alive&&(e.id||'').startsWith('cv'))){G.flags.caravanDone=true;finishSide('s_caravan',{gold:80,xp:80});}
  else if(G.zone===9&&G.flags.guildSide&&!G.flags.guildDone){
   const foe=G.flags.guildSide==='thieves'?'gd':'gt';
   if(!enemies.some(e=>e.alive&&(e.id||'').startsWith(foe))){G.flags.guildDone=true;finishSide('s_guild',{gold:120,xp:100});}
  }
 }
 markQuestGivers();
}
function gainXP(n){
 // share among alive
 const alive=G.party.filter(p=>p.hp>0);if(!alive.length)return;
 const each=Math.ceil(n/alive.length);
 for(const p of alive){p.xp+=each;}
 G.xp+=n;clog(`✨ +${n} XP (party shares ${each} each)`,'good');
 // level ups 300->2, 900->3
 for(const p of G.party){const need=p.lvl===1?300:p.lvl===2?900:99999;if(p.xp>=need&&p.lvl<3)levelUp(p);}
 refreshParty();save();
}
function levelUp(p){
 p.lvl++;const hd=CLASSES[p.cls].hd;const gain=hd+mod(p.abil.CON);if(gain<1)p.maxhp+=1;else p.maxhp+=gain;p.hp=Math.min(p.maxhp,p.hp+gain);
 p.hdMax++;p.hd++;
 if(CLASSES[p.cls].spellcasting){p.slotsMax[1]++;if(p.lvl===3)p.slotsMax[1]=p.lvl===3?(p.cls==='Wizard'?4:3):p.slotsMax[1];p.slots[1]=p.slotsMax[1];}
 if(p.cls==='Rogue'&&p.lvl===3){/* sneak 2d6 */}
 sfx.level();showLevelUp(p,gain);clog(`🎉 <b>${p.name} reached level ${p.lvl}!</b> +${gain} HP`,'good');
}
function showLevelUp(p,gain){
 $('levelup-modal').classList.remove('hidden');
 $('levelup-body').innerHTML=`<p><b>${p.face} ${p.name}</b> — now level <b>${p.lvl}</b> ${p.cls}.</p><div class="qitem">❤️ +${gain} max HP (now ${p.maxhp})<br>🎲 Hit Dice: ${p.hd}/${p.hdMax} (d${CLASSES[p.cls].hd})<br>${CLASSES[p.cls].spellcasting?`🔮 Spell slots L1: ${p.slotsMax[1]}<br>`:''}${p.cls==='Rogue'?'🗡️ Sneak Attack now '+(p.lvl>=3?'2d6':'1d6'):''}${p.cls==='Fighter'&&p.lvl===2?'⚔️ Action Surge recharged!':''}</div>`;
}
function meleeAttack(att,isFoe,targ){
 // resolve d20
 const ab=isFoe?profBonus(att.lvl||1)+mod(att.abil[WEAPONS[att.weapon]?WEAPONS[att.weapon].ab:'STR']):attackBonus(att);
 const targAC=isFoe?targ.ac:targ.ac+(targ.cond&&targ.cond.shield?5:0);
 let roll=d20();let halflingLucky=false;
 if(!isFoe&&att.race==='Halfling'&&roll===1){roll=d20();halflingLucky=true;}
 const crit=roll===20,miss=roll===1;
 let adv=false;
 if(!isFoe&&targ.guided){adv=true;targ.guided=false;}
 if(!isFoe&&att.cond&&att.cond.hidden){adv=true;att.cond.hidden=false;clog(`🌙 ${att.name} strikes from hiding!`,'info');}
 let total=roll+ab,extra='';
 if(adv){const r2=d20();extra=` (adv ${roll},${r2})`;total=Math.max(roll,r2)+ab;}
 if(halflingLucky)extra+=' 🍀Lucky';
 if(crit||(!miss&&total>=targAC)){
  const w=WEAPONS[att.weapon]||WEAPONS.Dagger;
  let dice=w.dmg[0],size=w.dmg[1];if(crit)dice*=2;
  let dmg=d(dice,size)+(isFoe?mod(att.abil[w.ab]):abilForAttack(att));
  // sneak attack
  if(!isFoe&&att.cls==='Rogue'){const nearAlly=G.party.some(p=>p!==att&&p.hp>0&&dist(p,targ)<2.5);if(nearAlly||adv){const sd=att.lvl>=3?2:1;dmg+=d(sd,6);clog(`🗡️ Sneak Attack +${sd}d6!`,'info');}}
  dmg=Math.max(1,dmg);
  dealDamage(targ,dmg,isFoe);
  const an=isFoe?att.name:att.name,tn=isFoe?targ.name:targ.name;
  clog(`${crit?'💥 <span class="crit">CRIT!</span> ':''}⚔️ ${an} → ${tn}: <b>${dmg}</b> <span class="roll">[${roll}${extra}+${ab} vs AC ${targAC}]</span>`,crit?'crit':'');
  floatDmg(targ.x,targ.y,(crit?'CRIT ':'')+dmg,crit?'crit':'hit');
  if(crit)sfx.crit();else sfx.hit();
 }else{
  clog(`🛡️ ${isFoe?att.name:att.name} misses ${isFoe?targ.name:targ.name} <span class="roll">[${roll}${extra}+${ab} vs AC ${targAC}]</span>`);
  floatDmg(targ.x,targ.y,'MISS','miss');sfx.miss();
 }
}
function dealDamage(targ,dmg,isFoeTarget){
 // targ may be party or enemy
 targ.hp-=dmg;
 if(targ.hp<=0){
  if(isFoeTarget){targ.hp=0;} // party member down
  else{targ.hp=0;}
  if(targ.isHero!==undefined||targ.cls){
   // party
   targ.hp=0;targ.death={s:0,f:0};clog(`💀 <b>${targ.name} is down!</b> Death saves…`,'crit');toast('💀 '+targ.name+' is down! Heal or stabilize!');
   if(!partyAlive()){gameOver();}
  }else{
   // enemy dies — handled in enemy branch below? enemies don't have cls... but party chars do. Distinguish: party has .party flag? use hp branch
  }
 }
 // enemy death check (enemies have no .cls? they DO have weapon but no cls field... they have abil+lvl; party has cls. Use that.)
}
function damageEnemy(e,dmg,srcName){
 e.hp-=dmg;
  if(e.hp<=0&&e.alive){e.alive=false;e.hp=0;G.kills++;clog(`☠️ <b>${e.name} slain!</b> +${e.xp} XP`,'good');floatDmg(e.x,e.y,'☠','miss');sfx.coin();gainXP(e.xp);maybeDrop(e);
  if(e.boss){G.flags.bossDown=true;}
  if(e.id==='sq_queen'&&!G.flags.queenDead){G.flags.queenDead=true;finishSide('s_spiders',{gold:70,xp:80});}
  if(e.id==='sbeast'&&!G.flags.beastDead){G.flags.beastDead=true;finishSide('s_beast',{gold:120,xp:120});}
  if(e.id==='chief2'&&!G.flags.chiefDead){G.flags.chiefDead=true;}
  /* side-quest kill tracking */
  if(e.sq){
   G.sideKills[e.sq]=(G.sideKills[e.sq]||0)+1;
   const need={s_rats:3,s_spar:1,s_pelts:3,s_wolfpack:1,s_dogs:3,s_rats2:1,s_well:3,s_chief:1,s_arena:99}[e.sq]||99;
   const have=G.sideKills[e.sq];
   if(e.sq==='s_arena'){if(!enemies.some(x=>x.alive&&x.sq==='s_arena'))arenaWaveCleared();}
   else if(have>=need)sideKillsDone(e.sq);
   else clog(`🎯 ${SIDEQUESTS[e.sq]?SIDEQUESTS[e.sq].n:'Bounty'}: ${have}/${need}`,'info');
  }
  /* bounty tracking */
  for(const b of G.bounties){if(b.state==='hunting'&&b.foeN===e.name&&(b.zone===G.zone||b.zone===-1)){b.left--;clog(`🎯 Bounty: ${b.foeN} ${b.count-b.left}/${b.count}`,'info');if(b.left<=0)completeBounty(b);save();}}
  if(!enemies.some(x=>x.alive))endCombat(true);
 }
 refreshParty();
}
function sideKillsDone(sq){
 if(sq==='s_rats'){G.flags.ratsDead=true;finishSide('s_rats',{gold:25,xp:40,item:{n:'Potion of Healing',t:'potion',q:1}});}
 if(sq==='s_spar'){G.flags.sparDone=true;finishSide('s_spar',{xp:40,item:{n:'Shortsword',t:'weapon',q:1}});}
 if(sq==='s_pelts'){G.flags.peltsDone=true;toast('🐺 Wolves slain — gather the <b>pelts</b>!');}
 if(sq==='s_wolfpack'){G.flags.direDead=true;finishSide('s_wolfpack',{gold:60,xp:80,item:{n:'Leather +1',t:'armor',q:1}});}
 if(sq==='s_dogs'){G.flags.dogsDead=true;finishSide('s_dogs',{gold:50,xp:60});}
 if(sq==='s_rats2'){G.flags.wereratDead=true;finishSide('s_rats2',{gold:100,xp:80});}
 if(sq==='s_well'){G.flags.wellDone=true;finishSide('s_well',{gold:50,xp:60});}
 if(sq==='s_chief'){G.flags.chiefDead=true;finishSide('s_chief',{gold:150,xp:150});}
 markQuestGivers();save();
}
function damageParty(p,dmg){
 p.hp-=dmg;
 if(p.hp<=0){p.hp=0;p.death={s:0,f:0};p.tx=null;p.ty=null;clog(`💀 <b>${p.name} is down!</b> (death saves: need 3 ✓)`,'crit');toast('💀 '+p.name+' down! Use Cure/Stabilize fast!');sfx.miss();floatDmg(p.x,p.y,'DOWN','crit');
  if(!partyAlive())gameOver();
 }
 refreshParty();
}
/* unified melee that routes damage correctly */
function doAttack(att,targ){
 const attIsParty=!!att.cls, targIsParty=!!targ.cls;
 const ab=attIsParty?attackBonus(att):profBonus(att.lvl||1)+mod(att.abil[WEAPONS[att.weapon]?WEAPONS[att.weapon].ab:'STR']);
 const targAC=targ.ac+((targ.cond&&targ.cond.shield)?5:0);
 let roll=d20();let extra='';
 if(attIsParty&&att.race==='Halfling'&&roll===1){roll=d20();extra+=' 🍀';}
 let adv=false;
 if(attIsParty&&targ.guided){adv=true;targ.guided=false;}
 if(attIsParty&&att.cond.hidden){adv=true;att.cond.hidden=false;clog(`🌙 ${att.name} strikes unseen!`,'info');}
 if(!attIsParty&&targ.cond&&targ.cond.hidden){/* hidden target harder? skip */}
 let total=roll+ab;
 if(adv){const r2=d20();extra+=` adv(${roll},${r2})`;total=Math.max(roll,r2)+ab;}
 const crit=roll===20,fumble=roll===1;
  if(crit||(!fumble&&total>=targAC)){
   const w=WEAPONS[att.weapon]||WEAPONS.Dagger;let n=w.dmg[0],s=w.dmg[1];if(crit)n*=2;
   let dmg=d(n,s)+(attIsParty?abilForAttack(att)+(w.bonus||0):mod(att.abil[w.ab]));
   if(attIsParty&&att.cls==='Rogue'){const ally=G.party.some(p=>p!==att&&p.hp>0&&dist(p,targ)<2.5);if(ally||adv){const sd=att.lvl>=3?2:1;const extra2=d(sd,6);dmg+=extra2;clog(`🗡️ Sneak Attack +${extra2}!`,'info');}}
   if(attIsParty&&att.cls==='Ranger'&&targ.beast){dmg+=2;clog(`🏹 Favored Enemy +2!`,'info');}
  if(attIsParty&&att.cond.surge){dmg+=2;att.cond.surge=false;}
  if(att.cond&&att.cond.bless)dmg+=0;
  dmg=Math.max(1,dmg);
  if(targIsParty)damageParty(targ,dmg);else damageEnemy(targ,dmg,att.name);
  clog(`${crit?'💥 <span class="crit">CRIT</span> ':''}⚔️ ${att.name} → ${targ.name} <b>${dmg}</b> <span class="roll">[${roll}${extra}+${ab} vs ${targAC}]</span>`,crit?'crit':'');
  floatDmg(targ.x,targ.y,(crit?'CRIT ':'')+dmg,crit?'crit':'hit');
  if(crit)sfx.crit();else sfx.hit();
  if(targIsParty&&targ.cond.shield){targ.cond.shield=false;}
 }else{
  clog(`🛡️ ${att.name} misses ${targ.name} <span class="roll">[${roll}${extra}+${ab} vs ${targAC}]</span>`);
  floatDmg(targ.x,targ.y,'MISS','miss');sfx.miss();
 }
}
function maybeDrop(e){
 if(e.sq==='s_pelts'){addLoot(e.x,e.y,{gold:rnd(3,10),n:'Wolf Pelt',t:'quest_pelt'});return;}
 if(Math.random()<.5){addLoot(e.x,e.y,{gold:rnd(5,20),n:'Potion of Healing',t:'potion'});}
 else if(e.boss){addLoot(e.x,e.y,{gold:150,n:'Iron Throne Signet',t:'quest'});}
 else if(Math.random()<.2){addLoot(e.x,e.y,{gold:0,n:pick(['Quartz','Jade']),t:'gem'});}
}
function countItem(t){return G.inv.filter(i=>i.t===t).reduce((a,i)=>a+i.q,0);}
function removeItem(t,n){let left=n;for(let i=G.inv.length-1;i>=0&&left>0;i--){const it=G.inv[i];if(it.t!==t)continue;const take=Math.min(it.q,left);it.q-=take;left-=take;if(it.q<=0)G.inv.splice(i,1);}}
/* ---- spells ---- */
function castSpell(caster,key,target){
 const S=SPELLS[key];if(!S)return;
 if(S.type!=='cantrip'){if((caster.slots[1]||0)<=0){toast('❌ No level-1 spell slots! Long rest to recover.');return;}
  caster.slots[1]--;}
 sfx.spell();
 if(key==='cure'){
  const amt=Math.max(1,d(1,8)+spellMod(caster));
  target.hp=Math.min(target.maxhp,target.hp+amt);if(target.hp>0&&target.death)target.death={s:0,f:0};
  clog(`💚 ${caster.name} casts <b>Cure Wounds</b> on ${target.name}: +${amt} HP`,'good');floatDmg(target.x,target.y,'+'+amt,'heal');sfx.heal();
 }else if(key==='bless'){
  G.party.forEach(p=>{if(p.hp>0)p.cond.bless=10;});clog(`🙏 ${caster.name} casts <b>Bless</b>: party +1d4 attacks (10 rounds)`,'good');toast('🙏 Party blessed!');
 }else if(key==='shield'){
  caster.cond.shield=true;clog(`🛡️ ${caster.name} casts <b>Shield</b> (+5 AC)`,'info');
 }else if(key==='magicmissile'){
  let tot=0;for(let i=0;i<3;i++)tot+=rnd(1,4)+1;
  damageEnemy(target,tot,caster.name);clog(`💫 ${caster.name} <b>Magic Missile</b> → ${target.name}: <b>${tot}</b> force (auto-hit)`);floatDmg(target.x,target.y,tot,'hit');
 }else if(key==='burning'){
  // cone: all enemies within 2.5
  let hits=0;for(const e of enemies){if(!e.alive)continue;if(dist(caster,e)<2.8){const dc=spellDC(caster);const save=d20()+mod(e.abil.DEX);const dmg0=d(3,6);if(save>=dc){const h=Math.floor(dmg0/2);damageEnemy(e,h,caster.name);clog(`🔥 ${e.name} saves! half ${h} <span class="roll">[${save} vs DC ${dc}]</span>`);}else{damageEnemy(e,dmg0,caster.name);clog(`🔥 <b>Burning Hands</b> → ${e.name}: <b>${dmg0}</b> <span class="roll">[${save} vs DC ${dc}]</span>`);}floatDmg(e.x,e.y,dmg0,'hit');hits++;}}
  if(!hits)toast('🔥 No enemies in cone range — move closer!');
 }else if(key==='firebolt'||key==='guiding'||key==='sacred'){
  if(key==='sacred'){
   const dc=spellDC(caster);const save=d20()+mod(target.abil?target.abil.DEX:10);
   if(save>=dc){clog(`🌟 ${target.name} dodges Sacred Flame <span class="roll">[${save} vs DC ${dc}]</span>`);floatDmg(target.x,target.y,'SAVE','save');}
   else{const dmg=d(1,8);damageEnemy(target,dmg,caster.name);clog(`🌟 <b>Sacred Flame</b> → ${target.name}: <b>${dmg}</b> radiant`);floatDmg(target.x,target.y,dmg,'hit');}
  }else{
   const ab=profBonus(caster.lvl)+spellMod(caster);
   const roll=d20();const crit=roll===20;
   if(crit||(roll!==1&&roll+ab>=target.ac)){
    let dmg=key==='firebolt'?d(crit?2:1,10):d(crit?8:4,6);
    damageEnemy(target,dmg,caster.name);
    if(key==='guiding')target.guided=true;
    clog(`${crit?'💥CRIT ':''}☄️ ${caster.name} <b>${S.name}</b> → ${target.name}: <b>${dmg}</b> <span class="roll">[${roll}+${ab} vs ${target.ac}]</span>`,crit?'crit':'');
    floatDmg(target.x,target.y,dmg,crit?'crit':'hit');
   }else{clog(`🛡️ ${S.name} misses ${target.name} <span class="roll">[${roll}+${ab} vs ${target.ac}]</span>`);floatDmg(target.x,target.y,'MISS','miss');}
  }
 }
 caster.cool=1.2;refreshParty();refreshActions();save();
}
/* ---- combat update tick ---- */
function combatTick(dt){
 if(!G||!G.hero)return;
 // aggro check
 if(!combat.active){
  for(const e of enemies){if(!e.alive)continue;for(const p of G.party){if(p.hp<=0)continue;if(dist(e,p)<e.aggroR){startCombat();break;}}if(combat.active)break;}
 }
 if(combat.paused)return;
 if(combat.active){
  combat.t+=dt;
  if(combat.t>=6){combat.t=0;combat.round++;$('round-num').textContent=combat.round;
   for(const p of G.party){if(p.cond.bless)p.cond.bless--;if(p.cond.bless<=0)delete p.cond.bless;}
   // death saves
   for(const p of G.party){if(p.hp===0&&partyAlive()){const r=d20();if(r===20){p.hp=1;p.death={s:0,f:0};clog(`✨ ${p.name} <b>nat 20!</b> back at 1 HP!`,'good');floatDmg(p.x,p.y,'+1','heal');}else if(r===1){p.death.f+=2;clog(`💀 ${p.name} crit-fails death save (2 failures)!`,'crit');}else if(r>=10){p.death.s++;clog(`🤍 ${p.name} death save ✓ (${p.death.s}/3)`,'info');}else{p.death.f++;clog(`🩸 ${p.name} death save ✗ (${p.death.f}/3)`);}if(p.death.f>=3){clog(`☠️ ${p.name} has died…`,'crit');p.death.dead=true;}if(p.death.s>=3){p.hp=1;p.death={s:0,f:0};clog(`✨ ${p.name} stabilizes at 1 HP!`,'good');}refreshParty();}}
  }
  // party cooldowns + AI
  for(const p of G.party){if(p.cool>0)p.cool-=dt;}
  for(const e of enemies){if(!e.alive)continue;if(e.cool>0)e.cool-=dt;}
  // player-selected auto attack if target set & in range & cooldown ready
  const me=selected();
  // companions AI: nearest enemy
  G.party.forEach((p,idx)=>{
   if(p.hp<=0||p.cool>0)return;
   let foe=null;
   if(idx===(G.sel||0)&&G.target&&G.target.kind==='enemy'){foe=enemies.find(e=>e.id===G.target.id&&e.alive);}
   if(!foe){let bd=7;for(const e of enemies){if(!e.alive)continue;const dd=dist(p,e);if(dd<bd){bd=dd;foe=e;}}}
   if(foe){
    if(dist(p,foe)<=attackRange(p)+.3){doAttack(p,foe);p.cool=2.2;}
    else if(idx!==(G.sel||0)||!combat.paused){orderMove(p,foe.x,foe.y);}
   }
  });
  // enemy AI
  for(const e of enemies){
   if(!e.alive||e.cool>0)continue;
   let tgt=null,bd=1e9;for(const p of G.party){if(p.hp<=0)continue;const dd=dist(e,p);if(dd<bd){bd=dd;tgt=p;}}
   if(!tgt)continue;
   if(bd>10){/* leash */ const hd=Math.hypot(e.homeX-e.x,e.homeY-e.y);if(hd>3){e.x+=(e.homeX-e.x)/hd*2*dt;e.y+=(e.homeY-e.y)/hd*2*dt;}continue;}
   if(bd<=1.6){doAttack(e,tgt);e.cool=2.4;}
   else{const dx=(tgt.x-e.x)/bd,dy=(tgt.y-e.y)/bd;const nx=e.x+dx*3.4*dt,ny=e.y+dy*3.4*dt;if(!solidAt(nx,e.y))e.x=nx;if(!solidAt(e.x,ny))e.y=ny;}
  }
  if(!enemies.some(e=>e.alive))endCombat(true);
  else if(!partyAlive())gameOver();
 }
}
/* ============ 7. ACTIONS / HUD ============ */
function refreshParty(){
 const bar=$('party-bar');bar.innerHTML='';
 G.party.forEach((p,i)=>{
  const dv=document.createElement('div');dv.className='portrait'+(i===(G.sel||0)?' sel':'')+(p.hp<=0?' dead':'');
  dv.innerHTML=`<div class="face">${p.hp<=0?'💀':p.face}</div><div class="pname">${p.name} ${p.lvl}</div><div class="hpbar${p.hp<p.maxhp/3?' low':''}"><i style="width:${clamp(100*p.hp/p.maxhp,0,100)}%"></i></div><div class="php">${p.hp}/${p.maxhp}${p.slotsMax[1]?` ·🔮${p.slots[1]}`:''}</div>`;
  dv.onclick=()=>{G.sel=i;refreshParty();refreshActions();sfx.talk();};
  bar.appendChild(dv);
 });
}
function refreshActions(){
 const bar=$('action-bar');bar.innerHTML='';
 const me=selected();if(!me)return;
 const btn=(icon,label,fn,dis)=>{const b=document.createElement('button');b.className='act';b.innerHTML=`${icon}<small>${label}</small>`;b.disabled=!!dis;b.onclick=fn;bar.appendChild(b);return b;};
 btn('⚔️','Attack',()=>{const foe=nearestFoe(me);if(foe){G.target={kind:'enemy',id:foe.id};if(dist(me,foe)>attackRange(me))orderMove(me,foe.x,foe.y);else if(me.cool<=0)doAttack(me,foe);toast('⚔️ Attacking '+foe.name);}else toast('No enemies near — tap one!');});
 // spells by class
 if(me.cls==='Wizard'){btn('🔥','Fire',()=>spellOrMove(me,'firebolt'));if(me.lvl>=1){btn('💫','MM '+(me.slots[1]||0),()=>spellOrMove(me,'magicmissile'),(me.slots[1]||0)<=0);btn('🔥','Cone',()=>spellOrMove(me,'burning'),(me.slots[1]||0)<=0);btn('🛡️','Shld',()=>castSpell(me,'shield'),(me.slots[1]||0)<=0);}}
 if(me.cls==='Cleric'){btn('🌟','Flame',()=>spellOrMove(me,'sacred'));btn('💚','Heal '+(me.slots[1]||0),()=>{const w=mostHurtAlly();if(w)castSpell(me,'cure',w);else toast('Nobody hurt');},(me.slots[1]||0)<=0);btn('🙏','Bless',()=>castSpell(me,'bless'),(me.slots[1]||0)<=0);btn('☄️','Bolt',()=>spellOrMove(me,'guiding'),(me.slots[1]||0)<=0);}
 if(me.cls==='Fighter'){
  btn('💪','2ndWind',()=>{if(me.featUsed.wind){toast('Second Wind used — rest!');return;}me.featUsed.wind=true;const h=Math.max(1,d(1,10)+me.lvl);me.hp=Math.min(me.maxhp,me.hp+h);clog(`💪 ${me.name} Second Wind +${h}`,'good');floatDmg(me.x,me.y,'+'+h,'heal');sfx.heal();refreshParty();},me.featUsed.wind);
  btn('⚡','Surge',()=>{if(me.featUsed.surge){toast('Action Surge used — rest!');return;}me.featUsed.surge=true;me.cond.surge=true;me.cool=0;clog(`⚡ ${me.name} ACTION SURGE!`,'good');toast('⚡ Action Surge — attack now!');},me.featUsed.surge);
 }
 if(me.cls==='Rogue'||me.cls==='Ranger'){btn('🌙',me.cond.hidden?'Unhide':'Hide',()=>{if(me.cond.hidden)delete me.cond.hidden;else{const r=d20()+mod(me.abil.DEX)+profBonus(me.lvl);const dc=12;if(r>=dc){me.cond.hidden=true;clog(`🌙 ${me.name} hides <span class="roll">[${r} vs ${dc}]</span>`,'good');}else clog(`👁️ ${me.name} fails to hide <span class="roll">[${r}]</span>`);}refreshActions();});}
 btn('🧪','Potion',drinkPotion,G.inv.filter(i=>i.t==='potion'||i.t==='gpotion').length===0);
 btn('💤','Rest',()=>shortRest());
}
function nearestFoe(me){let b=null,bd=1e9;for(const e of enemies){if(!e.alive)continue;const dd=dist(me,e);if(dd<bd){bd=dd;b=e;}}return b;}
function mostHurtAlly(){let b=null,br=1;for(const p of G.party){if(p.hp<=0||p.hp>=p.maxhp)continue;const r=p.hp/p.maxhp;if(!b||r<br){br=r;b=p;}}return b||selected();}
function spellOrMove(me,key){
 const S=SPELLS[key];
 if(S.type!=='cantrip'&&(me.slots[1]||0)<=0){toast('❌ No spell slots!');return;}
 let foe=nearestFoe(me);
 if(G.target&&G.target.kind==='enemy'){const f=enemies.find(e=>e.id===G.target.id&&e.alive);if(f)foe=f;}
 if(!foe){toast('No target — tap an enemy first');return;}
 const range=S.range||5;
 if(key==='burning'&&dist(me,foe)>range){orderMove(me,foe.x,foe.y);toast('🔥 Move closer for cone!');return;}
 if(dist(me,foe)>range){orderMove(me,foe.x,foe.y);toast('📏 Closing to spell range…');G.pendingSpell={caster:me.name,key};return;}
 castSpell(me,key,foe);
}
function drinkPotion(){
 const i=G.inv.findIndex(x=>x.t==='potion'||x.t==='gpotion');
 if(i<0){toast('No potions! Buy at the inn 🍺');return;}
 const it=G.inv[i];const me=selected();
 const amt=it.t==='gpotion'?d(4,4)+4:d(2,4)+2;
 me.hp=Math.min(me.maxhp,me.hp+amt);if(me.hp>0)me.death={s:0,f:0};
 it.q--;if(it.q<=0)G.inv.splice(i,1);
 clog(`🧪 ${me.name} drinks ${it.n}: +${amt} HP`,'good');floatDmg(me.x,me.y,'+'+amt,'heal');sfx.heal();refreshParty();refreshActions();save();
}
function shortRest(){
 if(combat.active){toast('❌ Cannot rest in combat!');return;}
 let spent=false;
 for(const p of G.party){if(p.hp>0&&p.hp<p.maxhp&&p.hd>0){const hv=Math.min(p.hd,2);let tot=0;for(let i=0;i<hv;i++)tot+=rnd(1,CLASSES[p.cls].hd)+mod(p.abil.CON);tot=Math.max(hv,tot);p.hp=Math.min(p.maxhp,p.hp+tot);p.hd-=hv;clog(`💤 ${p.name} short rest: +${tot} HP (HD ${p.hd}/${p.hdMax})`,'info');spent=true;}}
 const me=selected();if(me.cls==='Wizard'&&me.slots[1]<me.slotsMax[1]){me.slots[1]++;clog('🔮 Arcane Recovery: +1 slot','info');spent=true;}
 if(!spent){toast('💤 Nobody needs rest (or no Hit Dice — long rest!)');return;}
 G.rests++;sfx.heal();toast('💤 Short rest complete (1 hr)');refreshParty();refreshActions();save();
}
function longRest(fromFire){
 if(combat.active){toast('❌ Cannot rest in combat!');return;}
 const safe=fromFire||G.zone===1;
 if(!safe){openPanel('Rest','<div class="qitem">🌙 The wilds are dangerous. Find a <b>🔥 campfire</b> or the <b>🍺 inn</b> (tap it) for a long rest. You can still <b>Short Rest</b> from the action bar.</div>');return;}
 for(const p of G.party){p.hp=p.maxhp;p.death={s:0,f:0};p.hd=p.hdMax;p.slots[1]=p.slotsMax[1];p.featUsed={};delete p.cond.shield;}
 G.rests++;save();sfx.level();toast('🌅 Long rest complete — HP, slots & features restored!');clog('🌅 <b>Long rest:</b> all restored.','good');refreshParty();refreshActions();
}
function takeLoot(l){
 if(l.taken)return;l.taken=true;sfx.coin();
 if(l.loot.gold){G.gold+=l.loot.gold;clog(`💰 Looted <b>${l.loot.gold} gp</b>`,'good');}
 if(l.loot.n){
  const t=l.loot.t,n=l.loot.n;
  if(t==='quest'){clog(`📿 Looted <b>${n}</b>!`,'good');G.flags.signet=true;}
  else if(t==='armor'){equipArmor({n});}
  else if(t==='weapon'){G.inv.push({n,t:'weapon',q:1});clog(`⚔️ Got <b>${n}</b> (equip in 🎒)`,'good');toast('⚔️ '+n+' — equip it in Inventory!');}
  else if(t==='gem'){G.inv.push({n,t:'gem',q:1});clog(`💎 Got <b>${n}</b> (sell at shops)`,'good');}
  else{const ex=G.inv.find(i=>i.n===n);if(ex)ex.q++;else G.inv.push({n,t,q:1});clog(`🎒 Got <b>${n}</b>`,'good');
   if(t==='quest_tome'&&!G.flags.tomeFound){G.flags.tomeFound=true;removeItem(t,99);finishSide('s_tome',{gold:40,xp:50});}
   if(t==='quest_candle'&&countItem(t)>=3&&sqState('s_candle')==='active'){removeItem(t,99);finishSide('s_candle',{xp:40,item:{n:'Potion of Healing',t:'potion',q:2}});}
   if(t==='quest_ring'&&!G.flags.ringFound){G.flags.ringFound=true;removeItem(t,99);finishSide('s_ring',{gold:50,xp:40});}
   if(t==='quest_herb'&&countItem(t)>=3&&sqState('s_herbs')==='active'){removeItem(t,99);finishSide('s_herbs',{xp:50,item:{n:'Potion of Greater Healing',t:'gpotion',q:2}});}
   if(t==='quest_letter'&&!G.flags.letterFound){G.flags.letterFound=true;removeItem(t,99);finishSide('s_patrol',{gold:60,xp:50});}
   if(t==='quest_snare'){G.flags['snare_'+l.loot.sq]=true;removeItem('quest_snare',1);if(['sn1','sn2','sn3'].every(k=>G.flags['snare_'+k]))finishSide('s_snare',{gold:40,xp:40});else toast('🪤 Snare broken ('+['sn1','sn2','sn3'].filter(k=>G.flags['snare_'+k]).length+'/3)');}
   if(t==='quest_ledger'&&!G.flags.ledgerFound){G.flags.ledgerFound=true;removeItem(t,99);finishSide('s_ledger',{gold:40,xp:60});toast('📕 Ledger secured! <b>Captain Ria</b> in the city will pay for this.');}
   if(t==='quest_canary'&&!G.flags.canaryFound){G.flags.canaryFound=true;removeItem(t,99);finishSide('s_canary',{xp:40,item:{n:'Potion of Greater Healing',t:'gpotion',q:1}});}
   if(t==='quest_locket'&&!G.flags.locketFound){G.flags.locketFound=true;removeItem(t,99);finishSide('s_heirloom',{xp:60,item:{n:'Diamond',t:'gem',q:1}});}
   if(t==='quest_bell'&&!G.flags.bellFound){G.flags.bellFound=true;removeItem(t,99);finishSide('s_goat',{gold:30,xp:40});}
   if(t==='quest_millwheel'&&!G.flags.wheelFound){G.flags.wheelFound=true;removeItem(t,99);finishSide('s_mill',{gold:60,xp:50});}
   if(t==='quest_pelt'&&countItem(t)>=3&&sqState('s_pelts')==='active'){removeItem(t,99);G.flags.peltsDone=true;finishSide('s_pelts',{gold:40,xp:50,item:{n:'Shortbow',t:'weapon',q:1}});}
  }}
 toast(`💰 Looted ${l.loot.gold||0} gp${l.loot.n?' + '+l.loot.n:''}`);
 refreshActions();markQuestGivers();save();
}
function equipArmor(item){
 const bonus=ARMOR_BONUS[item.n]||1;const me=selected();
 if(bonus>(me.armorBonus||0)){me.armorBonus=bonus;me.armorName=item.n;recalcAc(me);clog(`🛡️ ${me.name} dons <b>${item.n}</b> (AC ${me.ac})!`,'good');toast('🛡️ AC '+me.ac+'!');}
 else{G.inv.push({n:item.n,t:'armor',q:1});toast('🛡️ Stashed '+item.n+' (sell or equip later)');}
 refreshParty();markQuestGivers();
}
function useExit(e){
 sfx.talk();G.pos=null;
 if(e.to<G.zone)setupZoneFixed(e.to,'exit1');
 else setupZoneFixed(e.to,'exit0');
 const to=e.to;
 if(to===1&&G.quests.q1==='done'&&G.quests.q2==='locked'){G.quests.q2='active';G.unlocked[1]=true;updateTracker();}
 if(to===2&&G.quests.q2==='active'){G.flags.q2ambush=true;G.quests.q2='done';G.quests.q3='active';G.unlocked[2]=true;sfx.quest();toast('📜 <b>The Inn is Safe</b> — onward! Gnolls await.');gainXP(80);updateTracker();}
 if(to===2&&G.quests.q2==='done'){G.unlocked[2]=true;}
 if(to===3&&G.quests.q3==='done'&&G.quests.q4==='locked'){G.quests.q4='active';G.unlocked[3]=true;updateTracker();}
 if(to===4&&(G.quests.q4==='done'||G.quests.q5==='active')){if(G.quests.q4==='done'){G.quests.q5='active';}G.unlocked[4]=true;updateTracker();}
 if(to===5&&(G.quests.q5==='done'||G.quests.q6==='active')){if(G.quests.q5==='done'){G.quests.q6='active';}G.unlocked[5]=true;updateTracker();}
 markQuestGivers();
}
/* ============ 8. DIALOGUE / QUESTS ============ */
const DIALOGS={
 greet:{name:'Gorion 🧙',text:s=>`“${s}, child. The iron is rotting, the roads bleed — and last night an assassin stalked these cloisters. Candlekeep is no longer safe. Take my amulet. Find Lia at the Coast Way Inn. <b>Go — and do not trust the smiles in the dark.</b>”`,opts:s=>[
  {t:'“I\'m ready. (Begin — a killer waits by the stacks!)”',fn:()=>{closeDialog();G.flags.q1seen=true;toast('🗡️ An assassin lunges from the stacks!');clog('🗡️ Ambush!','crit');}},
  {t:'📜 [History] What is wrong with the iron? (INT)',check:{ab:'INT',dc:10},pass:'“Every blade west of the Chionthar snaps like tin. The mines at Nashkel runs red with sabotage. Someone <i>wants</i> a war.”',fail:'“Ask the scribes. I have said too much already.”'},
  {t:'Leave',fn:()=>closeDialog()}]},
 guard:{name:'Pellan 💂',text:()=>`“South gate's shut until the murder's answered. Assassin's still inside, mark me. And giant <b>rats</b> infest the cellar — the cooks are terrified.”`,opts:()=>[
  {t:'🐀 “I\'ll clear the rats.”',fn:()=>{if(!G.side.s_rats)startSide('s_rats');closeDialog();if(G.zone===0)setupZoneFixed(0,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'Understood.',fn:()=>closeDialog()}]},
 wynne:{name:'Scribe Wynne 📜',text:()=>`“Poor Brother Tethtoril's apprentice — stabbed with a <i>poisoned</i> blade! And I've lost my <b>tome</b> in the stacks besides. If you face the killer: <b>bless yourself, and strike together.</b>”<br><br><i>(Hint: select each hero, tap the assassin, use Bless + potions. Space = pause.)</i>`,opts:()=>[
  {t:'📕 “I\'ll find your tome.”',fn:()=>{if(!G.side.s_tome)startSide('s_tome');closeDialog();if(G.zone===0)setupZoneFixed(0,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'🙏 “Bless me.” (+1d4 next checks)',fn:()=>{G.flags.scribeBless=true;closeDialog();toast('🙏 Blessed by the scribes!');}},
  {t:'Leave',fn:()=>closeDialog()}]},
 lia:{name:'Lia 🦹',text:()=>`“${G.hero.name}! Gorion sent word — I'm coming with you, obviously. Locks, traps, pockets: I'm your girl. <b>Take me along?</b>”<br><i>(Halfling Rogue joins — sneak attack + trap sense.)</i>`,opts:()=>[
  {t:'“Welcome aboard, Lia!” (Recruit Rogue)',fn:()=>{closeDialog();recruit(makeLia(),'liaJoined','Lia twirls her shortsword. “Try to keep up!”');}},
  {t:'“Not yet.”',fn:()=>closeDialog()}]},
 maren:{name:'Sister Maren 🧕',text:()=>`“The temple sent me to staunch these roads. Your cause smells of iron and smoke — righteous work. <b>May I join your party?</b>”<br><i>(Human Cleric joins — heals, Bless, Guiding Bolt.)</i>`,opts:()=>[
  {t:'“The Light needs you. Join us!” (Recruit Cleric)',fn:()=>{closeDialog();recruit(makeMaren(),'marenJoined','Maren hefts her mace. “The Dawn protects.”');}},
  {t:'“Not yet.”',fn:()=>closeDialog()}]},
 gren:{name:'Gren the Arms-master 🛡️',text:()=>G.side.s_spar==='done'?`“Ha! The squire's still seeing stars. You've the makings, hero.”`:`“Soft cloister hands? Let's fix that. My <b>squire</b> spars in the yard — best him with practice steel and I'll call you blooded.”`,opts:()=>[
  {t:'🤺 “I\'ll face your squire.” (quest)',fn:()=>{if(!G.side.s_spar)startSide('s_spar');if(!G.flags.sparDone&&!enemies.some(e=>e.id==='spar1'&&e.alive)){const s=snapFloor(22.5,16.5);spawnEnemy('Training Squire','🤺',{STR:12,DEX:11,CON:12,INT:9,WIS:10,CHA:9},14,12,1,'Longsword',s.x,s.y,40,'spar1',false,'s_spar');toast('🤺 The squire salutes and attacks! (non-lethal… mostly)');}closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 fenn:{name:'Acolyte Fenn 🕯️',text:()=>G.side.s_candle==='done'?`“Three flames for the fallen. The vigil holds because of you.”`:`“The vigil for the murdered brother needs <b>3 candles</b> — the cellarer scattered them across the cloisters. Will you gather them?”`,opts:()=>[
  {t:'🕯️ “I\'ll gather the candles.”',fn:()=>{if(!G.side.s_candle)startSide('s_candle');closeDialog();if(G.zone===0)setupZoneFixed(0,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 pip:{name:'Novice Pip 🧒',text:()=>G.side.s_bully==='done'?`“Drest apologized! He even carries my books now. Thanks!”`:`“<i>(sniff)</i> Drest the trainee steals my dessert and calls me 'Pip-squeak'. Tell him to stop? He's by the yard…”`,opts:()=>[
  {t:'😠 “I\'ll deal with Drest.”',fn:()=>{if(!G.side.s_bully)startSide('s_bully');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 drest:{name:'Trainee Drest 😤',text:()=>G.side.s_bully==='done'?`“Fine! Fine. Pip's dessert is safe. Happy?”`:`“What? Pip sent you? Hah! What are <i>you</i> gonna do about it?”`,opts:()=>[
  {t:'💪 [Intimidation] “Apologize. Now.” (STR)',check:{ab:'STR',dc:11},pass:'Drest wilts. “S-sorry, Pip!” The yard applauds.',fail:'Drest puffs up. “Make me, hero.”',passFn:()=>{G.flags.bullyDone=true;finishSide('s_bully',{xp:30,item:{n:'Potion of Healing',t:'potion',q:1}});}},
  {t:'💬 [Persuasion] “Bullies end up alone.” (CHA)',check:{ab:'CHA',dc:11},pass:'Drest looks at his boots. “…Yeah. Okay. Sorry, Pip.”',fail:'“Alone and <i>strong</i>!”',passFn:()=>{G.flags.bullyDone=true;finishSide('s_bully',{xp:30,item:{n:'Potion of Healing',t:'potion',q:1}});}},
  {t:'Leave',fn:()=>closeDialog()}]},
 tess:{name:'Innkeep Tess 🍺',text:()=>`“Rooms, rumors, rations — and debts owed.” She jerks a thumb at the bard. “Raler owes me <b>30 gp</b>. You look convincing. What'll it be?”`,opts:()=>[
  {t:'🍺 Long rest — 5 gp (full heal)',fn:()=>{if(G.gold>=5){G.gold-=5;closeDialog();longRest(true);}else{toast('Not enough gold!');}}},
  {t:'🧪 Buy 2 potions — 20 gp',fn:()=>buyItem(20,{n:'Potion of Healing',t:'potion',q:2})},
  {t:'🍷 Buy wine — 5 gp (gift?)',fn:()=>buyItem(5,{n:'Wine',t:'wine',q:1})},
  {t:'🏹 Buy Shortbow — 15 gp',fn:()=>buyItem(15,{n:'Shortbow',t:'weapon',q:1})},
  {t:'🦺 Buy Leather +1 — 40 gp',fn:()=>buyItem(40,{n:'Leather +1',t:'armor',q:1})},
  {t:'💰 Sell gems & spare gear',fn:()=>{sellAll();}},
  {t:'🎻 “I\'ll collect Raler\'s debt.” (quest)',fn:()=>{if(!G.side.s_bard)startSide('s_bard');closeDialog();}},
  {t:'💬 [Persuasion] Hear anything? (CHA)',check:{ab:'CHA',dc:11},pass:'“Aye… mercenaries ask after the mines. And Dell the scout came back <i>bleeding</i> from the Wilds. Bring steel.”',fail:'“Just rain and taxes, love.”'},
  {t:'Leave',fn:()=>closeDialog()}]},
 traveler:{name:'Traveler Obe 🧳',text:()=>G.side.s_ring==='done'?`“My ring! Oh, bless your pockets. The Wilds took it, and you took it back.”`:`“Gnolls in the Wilds wear <i>new steel collars</i> — who arms gnolls, eh? And I lost my good ring out there, east trail. Reward in it for you.”`,opts:()=>[
  {t:'💍 “I\'ll find your ring.”',fn:()=>{if(!G.side.s_ring)startSide('s_ring');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 raler:{name:'Raler the Bard 🎻',text:()=>G.side.s_bard==='done'?`“Debt paid, songs sung, Tess placated. A ballad for you, hero — half price.”`:`“Tess? Debt? These are <i>creative differences</i>. Surely a fellow artist understands…”`,opts:()=>[
  {t:'🎻 [Persuasion] “Pay Tess. 20 gp.” (CHA)',check:{ab:'CHA',dc:11},pass:'Raler sighs theatrically and counts out 20 gp.',fail:'“Alas! The muse provides everything but coin.”',passFn:()=>{G.gold+=20;G.flags.bardGold=20;finishSide('s_bard',{gold:10,xp:40});}},
  {t:'💪 [Intimidation] “30. Now.” (STR)',check:{ab:'STR',dc:12},pass:'Raler pales and empties his purse: 30 gp.',fail:'Raler hides behind his lute.',passFn:()=>{G.gold+=30;G.flags.bardGold=30;finishSide('s_bard',{gold:10,xp:40});}},
  {t:'Leave',fn:()=>closeDialog()}]},
 kess:{name:'Hunter Kess 🏹',text:()=>`“Wolves grow bold on the east trails. <b>3 pelts</b> proves you're culling, not talking. And if you see the big <b>dire wolf</b> by the north treeline — end it.”`,opts:()=>[
  {t:'🐺 “I\'ll bring pelts.”',fn:()=>{if(!G.side.s_pelts)startSide('s_pelts');if(!G.side.s_wolfpack)startSide('s_wolfpack');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 ava:{name:'Pilgrim Ava 🧎',text:()=>G.side.s_herbs==='done'?`“The fever breaks. The gods used your hands, hero.”`:`“A road fever eats me. <b>3 feverfew herbs</b> grow along the trails — pale flowers. Please.”`,opts:()=>[
  {t:'🌿 “I\'ll gather feverfew.”',fn:()=>{if(!G.side.s_herbs)startSide('s_herbs');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 board:{name:'Notice Board 📌',text:()=>`Parchment flutters: contracts for blades-for-hire. <i>(New bounties after each completed contract.)</i>`,opts:()=>[
  {t:'🎯 View contracts',fn:()=>{closeDialog();showBounties();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 dell:{name:'Scout Dell 🏹',text:()=>`“Gnolls… alpha… men in black tabards…” <i>(coughs)</i> “My patrol never came back — their <b>letter</b> lies west trail. And break their <b>snares</b> if you can. Take my kit.”`,opts:()=>[
  {t:'💚 Take kit (+2 potions)',fn:()=>{if(!G.flags.dellMet){G.flags.dellMet=true;G.inv.push({n:'Potion of Healing',t:'potion',q:2});toast('🧪 +2 potions from Dell');refreshActions();}if(!G.side.s_patrol)startSide('s_patrol');if(!G.side.s_snare)startSide('s_snare');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 vesper:{name:'Hermit Vesper 🧙',text:()=>G.side.s_hermit==='done'?`“The wood remembers you, little hero.”`:`“RIDDLE ME: I have cities, but no houses; forests, but no trees; water, but no fish. <i>(Or bring wine and skip the thinking.)</i>”`,opts:()=>[
  {t:'🗺️ “A map.” [Arcana/INT]',check:{ab:'INT',dc:12},pass:'Vesper cackles! “YES! Take my blessing and brew.”',fail:'“No no. Think with the <i>other</i> head.”',passFn:()=>{G.flags.hermitDone=true;G.party.forEach(p=>{if(p.hp>0)p.cond.bless=10;});finishSide('s_hermit',{xp:60,item:{n:'Potion of Greater Healing',t:'gpotion',q:1}});refreshParty();}},
  {t:'🍷 Offer wine (have Wine)',fn:()=>{const i=G.inv.findIndex(x=>x.n==='Wine');if(i<0){toast('No wine — Tess sells it 🍷');return;}G.inv[i].q--;if(G.inv[i].q<=0)G.inv.splice(i,1);G.flags.hermitDone=true;G.party.forEach(p=>{if(p.hp>0)p.cond.bless=10;});finishSide('s_hermit',{xp:60,item:{n:'Potion of Greater Healing',t:'gpotion',q:1}});closeDialog();refreshActions();}},
  {t:'“I\'ll seek your wisdom.” (quest)',fn:()=>{if(!G.side.s_hermit)startSide('s_hermit');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 dain:{name:'Foreman Dain ⛏️',text:()=>`“Poison in the forge runoff, miners in cages, and my poor canary flown! Turn both <b>forge valves ⚙️</b>, free my people, find my bird.”`,opts:()=>[
  {t:'⛏️ “I\'ll help the mines.”',fn:()=>{if(!G.side.s_valve)startSide('s_valve');if(!G.side.s_canary)startSide('s_canary');if(!G.side.s_miners)startSide('s_miners');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 miner1:{name:'Miner Hobb 🧑‍🏭',text:()=>G.flags.miner1Free?`“Free! Bless you — I'm gone to the surface!”`:`“Locked in by kobolds! The cage just needs a strong arm or a quick pick…”`,opts:()=>[
  {t:'🔓 Force the cage (STR check)',check:{ab:'STR',dc:11},pass:'The bars bend! Hobb flees with thanks (+15 gp).',fail:'The bars hold. Hobb whimpers.',passFn:()=>{G.flags.miner1Free=true;G.gold+=15;if(G.flags.miner2Free)finishSide('s_miners',{xp:60});markQuestGivers();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 miner2:{name:'Miner Sella 👷',text:()=>G.flags.miner2Free?`“Sella owes you her life. Running now!”`:`“Please! My sister waits in the village. Get me out!”`,opts:()=>[
  {t:'🔓 Force the cage (STR check)',check:{ab:'STR',dc:11},pass:'Sella is free! She presses 15 gp on you and runs.',fail:'The lock sneers at you.',passFn:()=>{G.flags.miner2Free=true;G.gold+=15;if(G.flags.miner1Free)finishSide('s_miners',{xp:60});markQuestGivers();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 bramm:{name:'Bramm (captive) 🧔',text:()=>G.flags.brammJoined?`“Bramm fights beside you!”`:`“A dwarf in chains is still a dwarf. Break me out and my axe is yours. Burn their <b>poison barrels 🛢️</b> too — Wren here knows the camp.”<br><i>(Dwarven Fighter — greataxe, tough.)</i>`,opts:()=>[
  {t:'🔓 Break the chains',fn:()=>{if(!G.flags.brammFree){G.flags.brammFree=true;G.gold+=10;if(!G.side.s_prison)startSide('s_prison');if(!G.side.s_barrels)startSide('s_barrels');if(G.flags.wrenFree)finishSide('s_prison',{xp:80});toast('⛓️ Bramm is free!');clog('⛓️ <b>Bramm</b> freed!','good');}closeDialog();markQuestGivers();save();}},
  {t:'🪓 “Join us, Bramm!” (Recruit Fighter)',fn:()=>{closeDialog();if(!G.flags.brammFree){toast('Free him first!');return;}recruit(makeBramm(),'brammJoined','Bramm hefts a greataxe. “For the fallen!”');}},
  {t:'Leave',fn:()=>closeDialog()}]},
 wren:{name:'Wren (captive) 🧒',text:()=>G.flags.wrenFree?`“The chief's key? Tam the deserter holds one. His strongbox sits by the big tent.”`:`“Please! I'm just a scribe! Free me and — take this quartz, it's all I have. The <b>chief's strongbox</b> is by the big tent!”`,opts:()=>[
  {t:'🔓 Free Wren',fn:()=>{if(!G.flags.wrenFree){G.flags.wrenFree=true;G.inv.push({n:'Quartz',t:'gem',q:1});if(!G.side.s_prison)startSide('s_prison');if(G.flags.brammFree)finishSide('s_prison',{xp:80});toast('⛓️ Wren freed! (+Quartz)');clog('⛓️ <b>Wren</b> freed!','good');}closeDialog();markQuestGivers();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 tam:{name:'Tam the Deserter 🥷',text:()=>G.side.s_desert==='done'?`“I told you everything. Sarev's guard rotates at dusk. Go end him.”`:`“I deserted the Black Hand, aye. Sarev's lot pay better — or they did. What'll you give for what I know?”`,opts:()=>[
  {t:'💬 [Persuasion] “Help us end this.” (CHA)',check:{ab:'CHA',dc:12},pass:'Tam talks: Sarev\'s weak side exposed! (Final boss −2 AC.) +30 gp hush money reversed.',fail:'“Coin first, conscience later.”',passFn:()=>{G.flags.tamTalk=true;G.flags.sarevWeak=true;G.gold+=30;finishSide('s_desert',{xp:50});}},
  {t:'💪 [Intimidation] “The key. Now.” (STR)',check:{ab:'STR',dc:13},pass:'Tam hands over a strongbox key and 20 gp. “Don\'t kill me!”',fail:'Tam bolts into the trees… but drops 20 gp.',passFn:()=>{G.flags.tamTalk=true;G.inv.push({n:'Strongbox Key',t:'key',q:1});G.gold+=20;finishSide('s_desert',{xp:50});}},
  {t:'“Tell me about the camp.” (quest)',fn:()=>{if(!G.side.s_desert)startSide('s_desert');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 elowen:{name:'Elowen 👩',text:()=>`“Another farm-hero come to gawk at the city? Hm. No — you've the look of someone marching on the Iron Throne itself. My spellbook is packed. <b>Take a wizard?</b>”`,opts:()=>[
  {t:'🔮 “Welcome, Elowen!” (Recruit Wizard)',fn:()=>{closeDialog();recruit(makeElowen(),'elowenJoined','Elowen adjusts her spectacles. “Try not to die.”');}},
  {t:'“Not yet.”',fn:()=>closeDialog()}]},
 miri:{name:'Merchant Miri 🏪',text:()=>`“Blades, brews, and bargains! The Throne buys iron — I sell <i>better</i> iron.”`,opts:()=>[
  {t:'🧪 Buy 2 greater potions — 50 gp',fn:()=>buyItem(50,{n:'Potion of Greater Healing',t:'gpotion',q:2})},
  {t:'⚔️ Buy Longsword +1 — 120 gp',fn:()=>buyItem(120,{n:'Longsword +1',t:'weapon',q:1})},
  {t:'🏹 Buy Shortbow +1 — 120 gp',fn:()=>buyItem(120,{n:'Shortbow +1',t:'weapon',q:1})},
  {t:'🛡️ Buy Plate +1 — 200 gp',fn:()=>buyItem(200,{n:'Plate +1',t:'armor',q:1})},
  {t:'💰 Sell gems & spare gear',fn:()=>{sellAll();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 ria:{name:'Captain Ria 💂',text:()=>G.quests.q6==='active'||G.quests.q6==='done'?`“Sarev nests in the old HQ across the square, guards at every door. End him and the city breathes. <b>Rats infest the east alley</b>, by the way — wererat, likely.”`:`“Refugees? The roads are bad. Prove yourself first — then we'll talk war.”`,opts:()=>[
  {t:'🐀 “I\'ll hunt the wererat.”',fn:()=>{if(!G.side.s_rats2)startSide('s_rats2');closeDialog();markQuestGivers();}},
  {t:'📕 Hand over the Ledger of Names',fn:()=>{if(!G.flags.ledgerFound){toast('You have no ledger (mines, hidden cache).');return;}if(!G.flags.ledgerTurned){G.flags.ledgerTurned=true;G.flags.guardsDesert=true;G.gold+=80;sfx.quest();toast('📕 Ledger delivered! <b>2 HQ guards desert</b>. +80 gp');clog('📕 The ledger exposes Sarev — <b>2 guards desert!</b>','good');}closeDialog();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 widow:{name:'Widow Bell 🧕',text:()=>G.side.s_heirloom==='done'?`“My mother's locket… I can hear her humming again. Thank you.”`:`“Throne thugs took my mother's <b>locket</b> to their HQ. I cannot fight them. Can you?”`,opts:()=>[
  {t:'💍 “I\'ll recover it.”',fn:()=>{if(!G.side.s_heirloom)startSide('s_heirloom');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 vex:{name:'Vex the Informant 🎭',text:()=>G.side.s_inform==='done'?`“We're square. Dusk rotation, remember — the east guards walk away.”`:`“Sarev's guard roster, patrol gaps, his mistress's name… 40 gp. Or charm me, hero.”`,opts:()=>[
  {t:'💰 Pay 40 gp for the roster',fn:()=>{if(G.gold<40){toast('Not enough gold!');return;}G.gold-=40;G.flags.informDone=true;G.flags.guardsDesert=true;finishSide('s_inform',{xp:50});closeDialog();toast('🎭 Roster bought! <b>2 HQ guards desert.</b>');save();}},
  {t:'💬 [Persuasion] “For the city.” (CHA)',check:{ab:'CHA',dc:13},pass:'Vex slides the roster over free. “For the city, then. Dusk rotation.”',fail:'“Pretty words don\'t eat.”',passFn:()=>{G.flags.informDone=true;G.flags.guardsDesert=true;finishSide('s_inform',{xp:50});toast('🎭 Roster won! <b>2 HQ guards desert.</b>');}},
  {t:'“What do you know?” (quest)',fn:()=>{if(!G.side.s_inform)startSide('s_inform');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 alden:{name:'Priest Alden ⛪',text:()=>G.side.s_temple==='done'?`“The Light walks with you, heroes.”`:`“The temple keeps an eternal flame — and empty coffers. <b>50 gp</b> alms, and every god here blesses your final march.”`,opts:()=>[
  {t:'🙏 Donate 50 gp',fn:()=>{if(G.gold<50){toast('Not enough gold!');return;}G.gold-=50;G.flags.templeGift=true;G.party.forEach(p=>{if(p.hp>0)p.cond.bless=99;});finishSide('s_temple',{xp:60});closeDialog();toast('🙏 Blessed by every god! (long Bless)');refreshParty();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 pit:{name:'Pitmaster 🥊',text:()=>G.side.s_arena==='done'?`“Champion of the Pit! The crowds still chant your name.”`:`“The Pit: three rounds, escalating steel, no healers. Survivors rich. Corpses… compost. <b>Enter?</b>”`,opts:()=>[
  {t:'🥊 “I\'ll fight.” (start)',fn:()=>{if(!G.side.s_arena)startSide('s_arena');G.flags.arenaWave=1;closeDialog();toast('🥊 Round 1! (leave & return or call next round after clearing)');setupZoneFixed(G.zone,{x:leader().x,y:leader().y});}},
  {t:'🥊 “Call the next round!”',fn:()=>{if(sqState('s_arena')!=='active'){toast('Join the Pit first!');return;}closeDialog();setupZoneFixed(G.zone,{x:leader().x,y:leader().y});}},
  {t:'Leave',fn:()=>closeDialog()}]},
 henn:{name:'Mayor Henn 🧔',text:()=>`“Mill wheel broken, goats wandering, horrors in the well, and raiders on the road. The village needs heroes, not sympathy.”`,opts:()=>[
  {t:'🐐🌾⚔️ “We\'ll help Nashkel.” (all errands)',fn:()=>{if(!G.side.s_goat)startSide('s_goat');if(!G.side.s_well)startSide('s_well');if(!G.side.s_mill)startSide('s_mill');closeDialog();if(G.zone===6)setupZoneFixed(6,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'🐄 “Tell me of the troubles.”',fn:()=>{closeDialog();toast('🐐 Tilda\'s goat (Cloakwood bell) · 🕷️ well horrors · 🌾 mill wheel (Cloakwood) · 🛒 caravan needs 30 gp guard fund');}},
  {t:'🛒 Fund the caravan — 30 gp',fn:()=>{if(G.flags.caravanPaid){toast('Already funded — guard it!');return;}if(G.gold<30){toast('Not enough gold!');return;}G.gold-=30;G.flags.caravanPaid=true;if(!G.side.s_caravan)startSide('s_caravan');closeDialog();toast('🛒 Caravan funded! Raiders incoming — defend it!');setupZoneFixed(6,{x:leader().x,y:leader().y});save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 pell:{name:'Shopkeep Pell 🏪',text:()=>`“Flour by day, blades by night. A shopkeep survives.”`,opts:()=>[
  {t:'🧪 Buy 2 potions — 20 gp',fn:()=>buyItem(20,{n:'Potion of Healing',t:'potion',q:2})},
  {t:'🧪 Buy greater potion — 25 gp',fn:()=>buyItem(25,{n:'Potion of Greater Healing',t:'gpotion',q:1})},
  {t:'🗡️ Buy Shortsword +1 — 70 gp',fn:()=>buyItem(70,{n:'Shortsword +1',t:'weapon',q:1})},
  {t:'🦺 Buy Leather +1 — 40 gp',fn:()=>buyItem(40,{n:'Leather +1',t:'armor',q:1})},
  {t:'💰 Sell gems & spare gear',fn:()=>{sellAll();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 lanna:{name:'Priest Lanna ⛪',text:()=>G.side.s_well==='done'?`“The well runs clean. The village drinks to you.”`:`“Something <i>chitters</i> down the well. Three horrors by the sound. The Light — and your blades — must answer.”`,opts:()=>[
  {t:'🕷️ “We\'ll cleanse the well.”',fn:()=>{if(!G.side.s_well)startSide('s_well');closeDialog();if(G.zone===6)setupZoneFixed(6,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'🙏 “A blessing, priest.” (heal 1 ally)',fn:()=>{const w=mostHurtAlly();if(w&&w.hp<w.maxhp){w.hp=Math.min(w.maxhp,w.hp+d(2,6)+2);clog('🙏 Lanna heals '+w.name,'good');floatDmg(w.x,w.y,'+','heal');refreshParty();}else toast('No one hurt — the Light smiles.');closeDialog();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 sorrel:{name:'Sorrel 🏹',text:()=>`“Roads took my patrol. Bow's still mine. If you're walking into gnoll warrens and spider woods, you want a ranger. <b>Take me?</b>”<br><i>(Elven Ranger — bow, hide, +2 vs beasts.)</i>`,opts:()=>[
  {t:'🏹 “Welcome, Sorrel!” (Recruit Ranger)',fn:()=>{closeDialog();recruit(makeSorrel(),'sorrelJoined','Sorrel strings her bow. “Beasts fear me. Men should.”');}},
  {t:'“Not yet.”',fn:()=>closeDialog()}]},
 tilda:{name:'Kid Tilda 🧒',text:()=>G.side.s_goat==='done'?`“BESS! You found her bell! Best heroes ever!”`:`“Bess wandered into the <b>Cloakwood</b> and never came! Her bell — if you find her <b>bell</b>, I'll know she's… okay. Please!”`,opts:()=>[
  {t:'🐐 “We\'ll find Bess\'s bell.”',fn:()=>{if(!G.side.s_goat)startSide('s_goat');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 tink:{name:'Tink (captive) 🔧',text:()=>G.flags.tinkFree?`“Free! Tink's EMPORIUM will remember this! Take my life savings — all twelve coppers!”`:`“Tink sell pots, Tink end up IN pot! Gnolls cage Tink! Get Tink out, yes?”`,opts:()=>[
  {t:'🔓 Break the cage',fn:()=>{if(!G.flags.tinkFree){G.flags.tinkFree=true;G.gold+=12;G.inv.push({n:'Potion of Greater Healing',t:'gpotion',q:1});if(!G.side.s_gnome)startSide('s_gnome');finishSide('s_gnome',{xp:60});toast('🔧 Tink free! (+12 gp, +potion)');clog('🔧 <b>Tink</b> freed!','good');}closeDialog();markQuestGivers();save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 ash:{name:'Druid Ash 🌿',text:()=>`“The wood sickens. <b>Blight growths 🦠</b> pulse near the trails — burn them. And the <b>Spider Queen</b> nests southeast. The balance demands both.”`,opts:()=>[
  {t:'🌿 “We\'ll heal the wood.”',fn:()=>{if(!G.side.s_blight)startSide('s_blight');if(!G.side.s_spiders)startSide('s_spiders');closeDialog();if(G.zone===8)setupZoneFixed(8,{x:leader().x,y:leader().y});markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 sarella:{name:'Tracker Sarella 🧭',text:()=>G.side.s_riddle==='done'?`“The cache was real! Split fair, remember — you got the gold, I got the story.”`:`“RIDDLE: The more you take, the more you leave behind. Answer true and I'll mark a <b>rich cache</b> on your… mind.”`,opts:()=>[
  {t:'👣 “Footsteps.” [WIS]',check:{ab:'WIS',dc:11},pass:'Sarella whoops! “The east cache is yours — DC 15 lock, trapped, worth it.”',fail:'“No! …Well. Yes, actually walking. But that\'s not the ANSWER.”',passFn:()=>{G.flags.riddleDone=true;if(!G.side.s_riddle)startSide('s_riddle');finishSide('s_riddle',{xp:40});}},
  {t:'“Another riddle-wise errand.” (quest)',fn:()=>{if(!G.side.s_riddle)startSide('s_riddle');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 skiv:{name:'Fence Skiv 🦹',text:()=>`“No questions, no receipts. War's good for business — the Guild and the Guard both bleed gold down here.”`,opts:()=>[
  {t:'🗡️ Buy Dagger +1 — 90 gp',fn:()=>buyItem(90,{n:'Dagger +1',t:'weapon',q:1})},
  {t:'🛡️ Buy Chain Shirt +2 — 180 gp',fn:()=>buyItem(180,{n:'Chain Shirt +2',t:'armor',q:1})},
  {t:'🧪 Buy greater potion — 25 gp',fn:()=>buyItem(25,{n:'Potion of Greater Healing',t:'gpotion',q:1})},
  {t:'💰 Sell gems & spare gear',fn:()=>{sellAll();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 mara:{name:'Cold-Eyed Mara 🗡️',text:()=>G.side.s_guild==='done'?`“War's over. The Guild remembers its friends.”`:`“The Guard strangles our trade. Help us bleed <b>Dunn's patrol</b> and the sewers are yours. Or run to the Guard — see what <i>their</i> gold spends like.”`,opts:()=>[
  {t:'🗡️ “The Guild pays.” (side with thieves)',fn:()=>{if(!G.side.s_guild)startSide('s_guild');G.flags.guildSide='thieves';closeDialog();toast('🗡️ Kill <b>Dunn\'s loyalists</b>!');setupZoneFixed(9,{x:leader().x,y:leader().y});save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 dunn:{name:'Sergeant Dunn 💂',text:()=>G.side.s_guild==='done'?`“Sewers are the city's again. The Captain hears of you.”`:`“Cutthroats nest down here, hero. Stand with the <b>Guard</b> and we'll hang Mara's guild together.”`,opts:()=>[
  {t:'💂 “The Guard pays.” (side with guard)',fn:()=>{if(!G.side.s_guild)startSide('s_guild');G.flags.guildSide='guard';closeDialog();toast('💂 Kill Mara\'s <b>cutthroats</b>!');setupZoneFixed(9,{x:leader().x,y:leader().y});save();}},
  {t:'Leave',fn:()=>closeDialog()}]},
 nib:{name:'Orphan Nib 🧒',text:()=>G.side.s_orphan==='done'?`“Best day ever! When I grow up I'm pocketing tyrants too.”`:`“Got a spare ten, hero? …I mean, coppers. For bread. Definitely bread.”`,opts:()=>[
  {t:'🪙 Give 10 gp',fn:()=>{if(G.gold<10){toast('Not enough gold!');return;}G.gold-=10;G.flags.orphanDone=true;G.inv.push({n:'HQ Side Key',t:'key',q:1});finishSide('s_orphan',{xp:40});closeDialog();toast('🗝️ Nib slips you an <b>HQ Side Key</b> “from Sarev\'s own pocket”. Definitely bread money well spent.');save();}},
  {t:'“Best of luck, kid.” (quest)',fn:()=>{if(!G.side.s_orphan)startSide('s_orphan');closeDialog();markQuestGivers();}},
  {t:'Leave',fn:()=>closeDialog()}]}};
function recruit(ch,flag,line){
 if(G.party.length>=4){openRecruitSwap(ch,flag,line);return;}
 doRecruit(ch,flag,line);
}
function doRecruit(ch,flag,line,swapIdx){
 if(swapIdx!=null&&G.party[swapIdx]&&!G.party[swapIdx].isHero){
  const old=G.party[swapIdx];G.party[swapIdx]=ch;
  toast(`🔄 <b>${old.name}</b> waits at camp. <b>${ch.name}</b> joins!`);
  clog(`🔄 <b>${ch.name}</b> replaces ${old.name}.`,'good');
 }else{G.party.push(ch);}
 G.flags[flag]=true;sfx.level();
 const sp=leader();ch.x=sp.x+.8;ch.y=sp.y+.8;
 if(!swapIdx&&G.party[G.party.length-1]!==ch){/* already placed */}
 toast(`🎉 <b>${ch.name}</b> joined! (${ch.cls})<br><small>${line}</small>`);
 clog(`🎉 <b>${ch.name}</b> (${ch.face} ${ch.race} ${ch.cls}) joined the party!`,'good');
 if(G.party.length>=3&&G.zone===1&&G.quests.q2==='active'&&!G.flags.q2ambush){G.flags.q2ambush=true;
  setTimeout(()=>{if(G.zone===1){toast('🔪 Ambush! Iron Throne thugs!');const s1=snapFloor(leader().x+3,leader().y+2),s2=snapFloor(leader().x-3,leader().y+2);spawnEnemy('Iron Throne Thug','🔪',{STR:14,DEX:12,CON:12,INT:9,WIS:9,CHA:9},16,12,2,'Longsword',s1.x,s1.y,60,'amb1');spawnEnemy('Iron Throne Thug','🔪',{STR:14,DEX:12,CON:12,INT:9,WIS:9,CHA:9},16,12,2,'Longsword',s2.x,s2.y,60,'amb2');startCombat();}},1500);}
 G.sel=0;refreshParty();refreshActions();markQuestGivers();save();
}
function openRecruitSwap(ch,flag,line){
 let h=`<div class="qitem">Your party is full (4). <b>${ch.name}</b> (${ch.cls}) wants in — who waits at camp?</div>`;
 G.party.forEach((p,i)=>{if(!p.isHero)h+=`<button class="dbtn" data-swap="${i}">🔄 Replace ${p.face} ${p.name} (L${p.lvl} ${p.cls})</button>`;});
 h+=`<button class="dbtn" data-swap="-1">“Not now.”</button>`;
 openPanel('🎉 New Companion',h);
 document.querySelectorAll('#panel-body [data-swap]').forEach(b=>b.onclick=()=>{closePanel();const i=+b.dataset.swap;if(i>=0)doRecruit(ch,flag,line,i);});
}
function buyItem(cost,item){
 if(G.gold<cost){toast('Not enough gold! ('+cost+' gp)');return;}
 G.gold-=cost;const ex=G.inv.find(i=>i.n===item.n&&i.t===item.t);
 if(ex)ex.q+=item.q||1;else G.inv.push({...item});
 sfx.coin();toast('🛒 Bought '+item.n+'!');clog('🛒 Bought <b>'+item.n+'</b> (-'+cost+' gp)','good');
 closeDialog();refreshActions();save();
}
function sellAll(){
 let total=0;
 for(let i=G.inv.length-1;i>=0;i--){const it=G.inv[i];
  if(it.t==='gem'){total+=(GEM_VALUE[it.n]||10)*it.q;G.inv.splice(i,1);}
  else if(it.t==='weapon'&&!Object.values(G.party).some(p=>p.weapon===it.n)){/* spare weapons sellable if not equipped */}
 }
 // spare weapons: sell all weapon items (equipped ones aren't in inv)
 for(let i=G.inv.length-1;i>=0;i--){const it=G.inv[i];
  if(it.t==='weapon'){const base=it.n.includes('+1')?60:12;total+=base*it.q;G.inv.splice(i,1);}
  else if(it.t==='armor'){const base=(ARMOR_BONUS[it.n]||1)*30;total+=base*it.q;G.inv.splice(i,1);}
  else if(it.t==='wine'){total+=2*it.q;G.inv.splice(i,1);}
 }
 if(total<=0){toast('Nothing to sell (gems, spare weapons & armor sell here).');return;}
 G.gold+=total;sfx.coin();toast('💰 Sold loot: +'+total+' gp!');clog('💰 Sold spare loot: <b>+'+total+' gp</b>','good');
 closeDialog();refreshActions();save();
}
function showBounties(){
 const avail=genBounties().filter(b=>!G.bounties.some(x=>x.key===b.key));
 const hunting=G.bounties.filter(b=>b.state==='hunting');
 let h=`<div class="qitem">🎯 <b>Contracts</b> — accept, hunt in the named zone, collect. New contracts after each completion. Done: <b>${G.bounties.filter(b=>b.state==='done').length}</b></div>`;
 if(hunting.length)h+=`<div class="qitem"><b>Hunting:</b><br>`+hunting.map(b=>`• ${b.name}: ${b.count-b.left}/${b.count} ${b.foeN} @ ${ZONES[b.zone].name}`).join('<br>')+`</div>`;
 if(!avail.length&&!hunting.length)h+=`<div class="qitem">No contracts right now — complete a hunt first.</div>`;
 for(const b of avail){
  const f=b.foe;
  h+=`<div class="invrow"><span>🎯 Slay <b>${b.count}× ${f.n}</b> @ ${ZONES[b.zone].name}<br><small>Reward ${b.reward} gp</small></span><button data-b="${b.key}">TAKE</button></div>`;
 }
 h+=`<div class="qitem"><small>Hunting more than 3 marks at once is unwise — finish or abandon first.</small> <button class="qbtn" id="b-abandon">Abandon hunts</button></div>`;
 openPanel('📌 Notice Board',h);
 document.querySelectorAll('#panel-body [data-b]').forEach(btn=>btn.onclick=()=>{
  if(G.bounties.filter(b=>b.state==='hunting').length>=3){toast('Too many active hunts (3 max)!');return;}
  const b=avail.find(x=>x.key===btn.dataset.b);
  G.bounties.push({key:b.key,name:`${b.count}× ${b.foe.n}`,foe:b.foe,foeN:b.foe.n,count:b.count,left:b.count,zone:b.zone,reward:b.reward,state:'accepted'});
  const nb=G.bounties[G.bounties.length-1];closePanel();acceptBounty(nb);
 });
 const ab=$('b-abandon');if(ab)ab.onclick=()=>{G.bounties=G.bounties.filter(b=>b.state!=='hunting');closePanel();toast('Contracts abandoned.');save();};
}
function startDialog(q,npc){
 const D=DIALOGS[q];if(!D)return;sfx.talk();
 $('dialog').classList.remove('hidden');
 $('dialog-name').textContent=D.name;
 const st=G.hero?G.hero.name:'hero';
 $('dialog-text').innerHTML=typeof D.text==='function'?D.text(st):D.text;
 const box=$('dialog-opts');box.innerHTML='';
 const opts=typeof D.opts==='function'?D.opts(st):D.opts;
 opts.forEach(o=>{
  const b=document.createElement('button');b.className='dbtn'+(o.check?' check':'');
  b.innerHTML=o.check?`🎲 ${o.t}`:o.t;
  b.onclick=()=>{
   if(o.check){
    const me=selected();const score=me.abil[o.check.ab]+(G.flags.scribeBless?2:0);
    const r=d20();const tot=r+mod(score);
    // bless d4 visual
    const b4=me.cond.bless?rnd(1,4):0;const fin=tot+b4;
    if(fin>=o.check.dc){clog(`🎲 ${me.name} ${o.check.ab} check: <b>${fin} ✓</b> <span class="roll">[${r}+${mod(score)}${b4?`+${b4} bless`:''} vs ${o.check.dc}]</span>`,'good');$('dialog-text').innerHTML=o.pass;sfx.quest();if(o.passFn){try{o.passFn();}catch(err){}}box.innerHTML='';const c=document.createElement('button');c.className='dbtn';c.textContent='Continue';c.onclick=()=>closeDialog();box.appendChild(c);}
    else{clog(`🎲 ${me.name} ${o.check.ab} check: ${fin} ✗ <span class="roll">[${r} vs ${o.check.dc}]</span>`);$('dialog-text').innerHTML=o.fail;sfx.miss();}
    return;
   }
   if(o.fn)o.fn();
   };
   box.appendChild(b);
  });
}
function closeDialog(){$('dialog').classList.add('hidden');}
/* ============ 9. PANELS ============ */
function openPanel(title,html){$('panel').classList.remove('hidden');$('panel-title').textContent=title;$('panel-body').innerHTML=html;}
function closePanel(){$('panel').classList.add('hidden');}
function showJournal(){
 $('journal-dot').classList.add('hidden');
 const q=(t,s)=>`<div class="qitem"><b>${t}</b><br>${s}</div>`;
 let h='<h3 style="color:var(--gold2)">📜 Main Quest</h3>';
 h+=G.quests.q1==='done'?q('✅ 1. Murder in the Library','Assassin slain. Gorion\'s warning heeded.'):`${q('📜 1. Murder in the Library','Find the assassin in Candlekeep\'s <b>eastern stacks</b>. Follow the 🎯 arrow!')}`;
 h+=G.quests.q2==='locked'?q('🔒 2. The Coast Way Inn','???'):G.quests.q2==='done'?q('✅ 2. The Coast Way Inn','Party gathered. Thugs repelled.'):`${q('📜 2. The Coast Way Inn','South Gate ➡️ to the inn. Recruit <b>Lia 🦹</b> and <b>Maren 🧕</b>, handle the thugs.')}`;
 h+=G.quests.q3==='locked'?q('🔒 3. Trail of Iron','???'):G.quests.q3==='done'?q('✅ 3. Trail of Iron','Wilds cleared.'):`${q('📜 3. Trail of Iron','East to the <b>Wilds</b>. Aid Dell, slay the <b>Gnoll Alpha</b> & mercenaries.')}`;
 h+=G.quests.q4==='locked'?q('🔒 4. The Rotting Iron','???'):G.quests.q4==='done'?q('✅ 4. The Rotting Iron','Priest slain, ledger found.'):`${q('📜 4. The Rotting Iron','Enter the <b>Iron Mines</b>. Slay <b>Iron Priest Malach 🧛</b>, free miners, work the valves.')}`;
 h+=G.quests.q5==='locked'?q('🔒 5. Cut Off the Hand','???'):G.quests.q5==='done'?q('✅ 5. Cut Off the Hand','Camp broken.'):`${q('📜 5. Cut Off the Hand','South to the <b>Bandit Camp</b>. Free prisoners, burn stores, kill <b>Chief Karg</b>.')}`;
 h+=G.quests.q6==='locked'?q('🔒 6. Throne of Blood','???'):G.quests.q6==='done'?q('✅ 6. Throne of Blood','Sarev slain. The Coast is free!'):`${q('📜 6. Throne of Blood','East to <b>Baldur\'s Gate</b>. Gather allies, then face <b>Lord Sarev 👑</b> in the HQ.')}`;
 const act=Object.keys(SIDEQUESTS).filter(id=>G.side[id]==='active');
 const done=Object.keys(SIDEQUESTS).filter(id=>G.side[id]==='done');
 const avail=Object.keys(SIDEQUESTS).filter(id=>!G.side[id]&&SIDEQUESTS[id].z===G.zone);
 if(act.length){h+='<h3 style="color:var(--gold2)">❗ Active Errands ('+act.length+')</h3>';for(const id of act)h+=q('❗ '+SIDEQUESTS[id].n,SIDEQUESTS[id].h);}
 if(avail.length){h+='<h3 style="color:var(--gold2)">❓ Local Rumors</h3>';for(const id of avail)h+=q('❓ '+SIDEQUESTS[id].n,'Someone nearby needs help — look for ❓ marks.');}
 const hunting=G.bounties.filter(b=>b.state==='hunting');
 if(hunting.length){h+='<h3 style="color:var(--gold2)">🎯 Active Bounties</h3>';for(const b of hunting)h+=q('🎯 '+b.name,(b.count-b.left)+'/'+b.count+' slain @ '+ZONES[b.zone].name+' · '+b.reward+' gp');}
 if(done.length+G.bounties.filter(b=>b.state==='done').length){h+=q('✅ Completed ('+(done.length+G.bounties.filter(b=>b.state==='done').length)+')',done.map(id=>SIDEQUESTS[id].n).join(' · ')||'Bounties turned.');}
 h+=`<div class="qitem">🏆 Kills: <b>${G.kills}</b> · Quests: <b>${G.questsDone}</b> · Chests: <b>${G.chestsDone}</b> · Rests: ${G.rests} · Gold: <b>${G.gold} gp</b></div>`;
 openPanel('📜 Journal',h);
}
function showSheet(){
 const p=selected();
 const rows=['STR','DEX','CON','INT','WIS','CHA'].map(k=>`<div>${k}: <b>${p.abil[k]}</b> (${fmtMod(mod(p.abil[k]))})</div>`).join('');
 openPanel('🧝 '+p.name+` <small>L${p.lvl} ${p.race} ${p.cls}</small>`,
 `<div class="statgrid"><div>❤️ HP</div><div><b>${p.hp}/${p.maxhp}</b></div><div>🛡️ AC</div><div><b>${p.ac}</b></div><div>⚔️ Attack</div><div><b>${fmtMod(attackBonus(p))}</b> ${p.weapon} (${WEAPONS[p.weapon].dmg.join('d')})</div><div>🎲 XP</div><div><b>${p.xp}</b> ${p.lvl<3?`/ ${p.lvl===1?300:900}`:'(MAX demo)'}</div><div>🔮 Slots</div><div><b>${p.slots[1]||0}/${p.slotsMax[1]||0}</b></div><div>🎲 Hit dice</div><div><b>${p.hd}/${p.hdMax}</b> d${CLASSES[p.cls].hd}</div><div>👣 Speed</div><div><b>${p.speed}ft</b></div></div><div class="statgrid" style="margin-top:8px">${rows}</div><div class="qitem">${p.bg} · ${(CLASSES[p.cls].features||[]).join(' · ')}</div><div class="qitem">Switch hero: tap portraits ↑ · <button class="qbtn" id="q-heal">💤 Short Rest</button></div>`);
 $('q-heal').onclick=()=>{closePanel();shortRest();};
}
function showInv(){
 let h=`<div class="qitem">💰 <b>${G.gold} gp</b> · ${selected().name} wields <b>${selected().weapon}</b>, wears <b>${selected().armorName||'Cloth'}</b> (AC ${selected().ac}).</div>`;
 if(!G.inv.length)h+='<div class="qitem">Empty pockets…</div>';
 G.inv.forEach((it,i)=>{
  let icon='🎒',btn='';
  if(it.t==='potion'||it.t==='gpotion'){icon=it.t==='gpotion'?'🧪✨':'🧪';btn=`<button data-use="${i}">USE</button>`;}
  else if(it.t==='weapon'){icon='⚔️';btn=`<button data-eq="${i}">EQUIP</button>`;}
  else if(it.t==='armor'){icon='🛡️';btn=`<button data-ar="${i}">EQUIP</button>`;}
  else if(it.t==='gem'){icon='💎';}
  else if(it.t==='key'){icon='🗝️';}
  else if(it.t==='wine'){icon='🍷';}
  else if(String(it.t).startsWith('quest')){icon='📿';}
  h+=`<div class="invrow"><span>${icon} ${it.n} ×${it.q}</span>${btn}</div>`;});
 h+=`<div class="qitem">⚔️ Party: ${G.party.map(p=>p.name+': '+p.weapon+' / '+p.armorName).join(' · ')}<br><small>Sell gems & spare gear at Tess 🍺 or Miri 🏪.</small></div>`;
 openPanel('🎒 Inventory',h);
 document.querySelectorAll('#panel-body [data-use]').forEach(b=>b.onclick=()=>{const it=G.inv[+b.dataset.use];const me=selected();const amt=it.t==='gpotion'?d(4,4)+4:d(2,4)+2;me.hp=Math.min(me.maxhp,me.hp+amt);me.death={s:0,f:0};it.q--;if(it.q<=0)G.inv.splice(+b.dataset.use,1);sfx.heal();refreshParty();showInv();save();});
 document.querySelectorAll('#panel-body [data-eq]').forEach(b=>b.onclick=()=>{const idx=+b.dataset.eq;const it=G.inv[idx];const me=selected();const old=me.weapon;me.weapon=it.n;it.q--;if(it.q<=0)G.inv.splice(idx,1);if(old&&old!=='Fists'){const ex=G.inv.find(i=>i.n===old&&i.t==='weapon');if(ex)ex.q++;else G.inv.push({n:old,t:'weapon',q:1});}sfx.coin();toast('⚔️ '+me.name+' equips '+it.n+'!');clog('⚔️ '+me.name+' equips <b>'+it.n+'</b>','good');refreshParty();refreshActions();showInv();save();});
 document.querySelectorAll('#panel-body [data-ar]').forEach(b=>b.onclick=()=>{const idx=+b.dataset.ar;const it=G.inv[idx];it.q--;if(it.q<=0)G.inv.splice(idx,1);equipArmor({n:it.n});showInv();save();});
}
function showTravel(){
 let h='<div class="qitem">🗺️ Fast-travel to unlocked lands. <i>Wilderness roads are dangerous — ambushes happen!</i></div>';
 ZONES.forEach((z,i)=>{
  const un=G.unlocked[i]||i===G.zone;
  h+=un?`<button class="dbtn" data-z="${i}">${i===G.zone?'📍':'🗺️'} ${z.name}<br><small>${z.sub}</small></button>`:`<button class="dbtn" disabled>🔒 ??? <br><small>undiscovered</small></button>`;
 });
 openPanel('🗺️ World Map',h);
 document.querySelectorAll('#panel-body [data-z]').forEach(b=>b.onclick=()=>{
  closePanel();const to=+b.dataset.z;
  setupZoneFixed(to,{x:GW/2,y:GH/2});
  /* travel encounter: 35% ambush on arrival */
  if(to>=1&&Math.random()<.35&&partyAlive()){
    const s1=snapFloor(leader().x+3,leader().y+2),s2=snapFloor(leader().x-3,leader().y-2);
    const lvl=1+Math.floor(to/2);
    spawnEnemy('Roadside Ambusher','🔪',{STR:12+lvl,DEX:12,CON:12,INT:8,WIS:9,CHA:8},12+lvl*4,11+lvl,1+lvl,'Shortsword',s1.x,s1.y,40+lvl*10,'amb'+Date.now()+'a');
    spawnEnemy('Roadside Ambusher','🔪',{STR:12+lvl,DEX:12,CON:12,INT:8,WIS:9,CHA:8},12+lvl*4,11+lvl,1+lvl,'Shortsword',s2.x,s2.y,40+lvl*10,'amb'+Date.now()+'b');
    setTimeout(()=>{toast('🔪 <b>Ambush on the road!</b>');startCombat();},800);
   }
  });
}
function showMenu(){
 openPanel('☰ Menu',`<button class="dbtn" id="m-save">💾 Save game</button><button class="dbtn" id="m-rest">🌅 Long rest (campfire/inn only)</button><button class="dbtn" id="m-log">🧾 Toggle combat log</button><button class="dbtn" id="m-title">🏠 Quit to title</button><div class="qitem"><small>Autosaves constantly. Fan homage using 5e SRD. RTwP: Space = pause.</small></div>`);
 $('m-save').onclick=()=>{save();toast('💾 Saved!');closePanel();};
 $('m-rest').onclick=()=>{closePanel();longRest(false);};
 $('m-log').onclick=()=>{$('combat-log').classList.toggle('collapsed');closePanel();};
 $('m-title').onclick=()=>{save();location.reload();};
}
function updateTracker(){
 const t=$('quest-tracker');
 if(G.quests.q1!=='done')t.textContent='📜 Find the assassin (follow 🎯)';
 else if(G.quests.q2!=='done')t.textContent='📜 Recruit at the inn (South Gate ➡️)';
 else if(G.quests.q3!=='done')t.textContent='📜 Clear the Wilds (east ➡️)';
 else if(G.quests.q4!=='done')t.textContent='📜 Slay the Iron Priest (mines)';
 else if(G.quests.q5!=='done')t.textContent='📜 Break the Bandit Camp (south ⬇️)';
 else if(G.quests.q6!=='done')t.textContent='📜 Face Lord Sarev (city ➡️)';
 else t.textContent='🏆 The Coast is free!';
}
/* ============ 10. GAME OVER / VICTORY ============ */
function gameOver(){
 if(!G||$('gameover').classList.contains('hidden')===false)return;
 setTimeout(()=>{if(!partyAlive()){$('gameover').classList.remove('hidden');clog('💀 TPK…','crit');}},800);
}
function showVictory(){
 gainXP(300,true);save();sfx.level();
 $('victory').classList.remove('hidden');
 const sides=Object.keys(SIDEQUESTS).filter(id=>G.side[id]==='done').length;
 const bount=G.bounties.filter(b=>b.state==='done').length;
 $('victory-body').innerHTML=`<div class="qitem">Lord Sarev falls. The Iron Throne crumbles, good iron flows, and bards from Candlekeep to Baldur's Gate sing of <b>${G.party.map(p=>p.name).join(', ')}</b>.</div><div class="qitem">🏆 Kills <b>${G.kills}</b> · Party L${G.party.map(p=>p.lvl).join('/')} · Main 6/6 · Side quests <b>${sides}</b> · Bounties <b>${bount}</b> · Chests <b>${G.chestsDone}</b> · Gold ${G.gold}</div><div class="qitem"><small>The saga continues… New Game+ keeps nothing but glory. (Levels 1–3 demo scale.)</small></div>`;
}
/* ============ 11. MAIN LOOP ============ */
let last=0;
function loop(ts){
 requestAnimationFrame(loop);
 if(!G||!G.hero||!$('screen-game').classList.contains('active'))return;
 const dt=Math.min(.05,(ts-last)/1000||.016);last=ts;
 for(const p of G.party){if(p.hp>0)tryMove(p,dt);}
 // pending arrivals
 const me=selected();
  if(G.pendingTalk&&dist(me,G.pendingTalk)<1.8){const n=G.pendingTalk;G.pendingTalk=null;startDialog(n.q,n);}
  if(G.pendingLoot&&dist(me,G.pendingLoot)<1.6){const l=G.pendingLoot;G.pendingLoot=null;takeLoot(l);}
  if(G.pendingChest){const c=G.pendingChest;if(c.opened)G.pendingChest=null;else if(dist(me,c)<1.8){G.pendingChest=null;openChest(c);}}
  if(G.pendingExit&&dist(me,G.pendingExit)<2.2){const e=G.pendingExit;G.pendingExit=null;useExit(e);}
  if(G.pendingProp){const p=G.pendingProp;if(dist(me,p)<1.8){G.pendingProp=null;useProp(p);}}
  if(G.pendingSpell){const ps=G.pendingSpell;const c=G.party.find(p=>p.name===ps.caster);const foe=nearestFoe(c);if(foe&&dist(c,foe)<=(SPELLS[ps.key].range||5)){castSpell(c,ps.key,ps.key==='cure'?mostHurtAlly():foe);G.pendingSpell=null;}}
  if(G.pendingRest){let near=false;for(const pr of props)if(!pr.use&&dist(me,pr)<1.8)near=true;if(near){G.pendingRest=false;longRest(true);}}
 combatTick(dt);
 // update HUD cooldown visuals
 draw();
 if(Math.floor(ts/500)!==Math.floor((ts-dt*1000)/500)){/* half-sec */ if(combat.active)$('round-num').textContent=combat.round;}
}
/* ============ 12. BOOT / WIRING ============ */
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');if(id==='screen-game'){resize();setTimeout(resize,100);}}
function newGameFromCC(){
 const name=($('cc-name').value||'Hero').slice(0,16);
 const final={};for(const k in CC.abil)final[k]=CC.abil[k]+(RACES[CC.race].mods[k]||0);
 G=defaultState();
 const hero=makeChar({name,race:CC.race,class:CC.class,bg:CC.bg,face:CC.face,abil:final,isHero:true});
 G.hero={name,race:CC.race,class:CC.class};
 G.party=[hero];G.sel=0;G.quests={q1:'active',q2:'locked',q3:'locked',q4:'locked',q5:'locked',q6:'locked'};
 show('screen-game');resize();
 setupZoneFixed(0);
 clog(`🎲 <b>${name}</b>, ${CC.race} ${CC.class}, enters Candlekeep. <span class="roll">HP ${hero.maxhp} · AC ${hero.ac} · ${Object.entries(final).map(([k,v])=>k+' '+v).join(' ')}</span>`,'info');
 refreshParty();refreshActions();
 requestAnimationFrame(loop);
}
function continueGame(st){
 G=st;G.sel=0;G.target=null;G.pendingTalk=null;
 /* backfill fields from older saves */
 G.side=G.side||{};G.sideKills=G.sideKills||{};G.flags=G.flags||{};
 G.unlocked=G.unlocked||[true,false,false,false,false,false,false,false,false,false];while(G.unlocked.length<10)G.unlocked.push(false);G.visited=G.visited||[];
 G.bounties=G.bounties||[];G.bountyTier=G.bountyTier||0;
 G.quests=G.quests||{};for(const k of['q1','q2','q3','q4','q5','q6'])if(!G.quests[k])G.quests[k]=(k==='q1'?'active':'locked');
 G.chestsDone=G.chestsDone||0;G.questsDone=G.questsDone||0;G.kills=G.kills||0;G.rests=G.rests||0;
 // restore cond objects
 G.party.forEach(p=>{p.cond=p.cond||{};p.featUsed=p.featUsed||{};p.cool=0;p.tx=null;p.ty=null;if(p.baseAc==null){p.baseAc=p.ac;p.armorBonus=0;p.armorName='Cloth';}});
 /* never load into a corpse-state: temple raises a wiped party */
 if(!G.party.some(p=>p.hp>0)){G.party.forEach(p=>{p.hp=Math.max(1,Math.floor(p.maxhp/2));p.death={s:0,f:0};});setTimeout(()=>toast('⛪ The temple raised your party! (half HP — be careful)'),1200);}
 show('screen-game');resize();setupZoneFixed(G.zone||0,G.pos||{x:6,y:7});
 refreshParty();refreshActions();requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded',()=>{
 renderCC();
 if(hasSave())$('btn-continue').classList.remove('hidden');
 $('btn-new').onclick=()=>{sfx.talk();show('screen-create');};
 $('btn-continue').onclick=()=>{const st=load();if(st){continueGame(st);toast('📂 Save loaded!');}else toast('No save found');};
 $('btn-how').onclick=()=>show('screen-how');
 $('btn-how-back').onclick=()=>show('screen-title');
 $('btn-cc-back').onclick=()=>show('screen-title');
 $('cc-name').addEventListener('input',renderCC);
 $('btn-cc-start').onclick=()=>{beep(523,.15,'triangle');newGameFromCC();};
 $('btn-journal').onclick=()=>{showJournal();};
 $('btn-sheet').onclick=()=>showSheet();
 $('btn-bag').onclick=()=>showInv();
 $('btn-map').onclick=()=>showTravel();
 $('btn-menu').onclick=()=>showMenu();
 $('btn-pause').onclick=()=>togglePause();
 $('panel-close').onclick=()=>closePanel();
 $('log-head').onclick=()=>$('combat-log').classList.toggle('collapsed');
 $('levelup-ok').onclick=()=>$('levelup-modal').classList.add('hidden');
 $('btn-reload').onclick=()=>{const st=load();if(st){$('gameover').classList.add('hidden');continueGame(st);}else location.reload();};
 $('btn-totitle').onclick=()=>location.reload();
 $('btn-again').onclick=()=>{localStorage.removeItem(SAVE_KEY);location.reload();};
 // autosave
 setInterval(()=>{if(G&&G.hero)save();},15000);
 resize();
});
