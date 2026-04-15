// © 2025 Sunil Malleshaiah — Block Puzzle v5.2 — MIT License
var GAME_VERSION='5.2',GAME_AUTHOR='Sunil Malleshaiah';

// localStorage safety — sandboxed iframes may throw SecurityError
var _ls={getItem:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},setItem:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},removeItem:function(k){try{localStorage.removeItem(k);}catch(e){}}};
if(!Array.prototype.find){Array.prototype.find=function(fn){for(var i=0;i<this.length;i++)if(fn(this[i],i,this))return this[i];};}

// ══════════════════════════════════════════════
//  SOUND ENGINE
// ══════════════════════════════════════════════
var AC=null;
function getAC(){if(!AC)try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return AC;}
function playTone(freq,dur,type,vol,delay){
  var ac=getAC();if(!ac)return;
  var osc=ac.createOscillator(),gain=ac.createGain();
  osc.connect(gain);gain.connect(ac.destination);
  osc.type=type||'sine';osc.frequency.value=freq;
  var t=ac.currentTime+(delay||0);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(vol||0.12,t+0.01);
  gain.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.start(t);osc.stop(t+dur+0.05);
}
var SFX={
  // Satisfying low "thock" — felt board drop
  place:function(){
    playTone(90,0.05,'sine',0.22,0);     // deep body thud
    playTone(160,0.04,'sine',0.12,0);    // harmonic
    playTone(800,0.012,'square',0.05,0); // click transient
  },
  // Bright ascending arpeggio
  clear:function(){
    playTone(523,0.07,'sine',0.14,0);    // C5
    playTone(659,0.07,'sine',0.15,0.055);// E5
    playTone(784,0.07,'sine',0.15,0.11); // G5
    playTone(1047,0.16,'sine',0.20,0.17);// C6
  },
  // Escalating fanfare per combo
  combo:function(n){
    var root=523*Math.pow(1.1,Math.min(n-1,7));
    playTone(root,0.07,'sine',0.14,0);
    playTone(root*1.26,0.07,'sine',0.16,0.06);
    playTone(root*1.5,0.07,'sine',0.16,0.12);
    playTone(root*2,0.18,'sine',0.22,0.18);
    if(n>=3)playTone(root*2.52,0.14,'sine',0.20,0.28);
  },
  // Sparkly unlock chime
  unlock:function(){
    playTone(659,0.06,'sine',0.12,0);
    playTone(784,0.06,'sine',0.13,0.07);
    playTone(1047,0.06,'sine',0.14,0.14);
    playTone(1319,0.22,'sine',0.18,0.21);
  },
  // Achievement fanfare — triumphant
  achieve:function(){
    playTone(784,0.07,'sine',0.14,0);
    playTone(988,0.07,'sine',0.15,0.08);
    playTone(1175,0.07,'sine',0.16,0.16);
    playTone(1568,0.28,'sine',0.22,0.24);
  },
  // Daily bonus cascade
  bonus:function(){
    for(var i=0;i<6;i++)playTone(440*Math.pow(1.14,i),0.07,'sine',0.13,i*0.055);
  },
  // Trophy fanfare
  trophy:function(){
    playTone(523,0.07,'sine',0.14,0);
    playTone(659,0.07,'sine',0.15,0.08);
    playTone(784,0.07,'sine',0.16,0.16);
    playTone(1047,0.32,'sine',0.22,0.24);
    playTone(1319,0.20,'sine',0.18,0.40);
  }
};

// ══════════════════════════════════════════════
//  SEEDED RNG  (LCG — same seed = same sequence)
// ══════════════════════════════════════════════
function SeededRNG(seed){
  this.s=seed>>>0||1;
  this.next=function(){this.s=(this.s*1664525+1013904223)>>>0;return this.s/4294967296;};
  this.int=function(n){return Math.floor(this.next()*n);};
}

// ══════════════════════════════════════════════
//  CHALLENGE SYSTEM
// ══════════════════════════════════════════════
var DIFF_LABELS=['easy','medium','hard'];
var DIFF_NAMES=['Easy','Medium','Hard'];
var DIFF_ICONS=['🟢','🟡','🔴'];
var DIFF_COLORS=['#4caf50','#ff9800','#f44336'];

// Difficulty by day: 1-10=easy, 11-20=medium, 21-31=hard
function getDiff(day){return day<=10?0:day<=20?1:2;}

// Trophy icon by difficulty
function getTrophyIcon(diff){return['🥉','🥈','🥇'][diff];}

// ── Achievement Trophy System ──
var ACHIEVEMENT_TROPHIES=[
  {id:'welcome',  icon:'🌟', title:'Welcome!',       desc:'Started your first game',      secret:false},
  {id:'score1k',  icon:'🎯', title:'Point Scorer',   desc:'Reached 1,000 points',         secret:false},
  {id:'score5k',  icon:'🔥', title:'On Fire',         desc:'Reached 5,000 points',         secret:false},
  {id:'score10k', icon:'💎', title:'Diamond',         desc:'Reached 10,000 points',        secret:false},
  {id:'score25k', icon:'👑', title:'Champion',        desc:'Reached 25,000 points',        secret:false},
  {id:'score50k', icon:'🏆', title:'Legend',          desc:'Reached 50,000 points',        secret:false},
  {id:'lines50',  icon:'⚡', title:'Line Cleaner',   desc:'Cleared 50 lines in one game', secret:false},
  {id:'combo5',   icon:'🌊', title:'Combo Master',   desc:'Hit a 5× combo',               secret:false},
  {id:'allpower', icon:'🧙', title:'Powerhouse',     desc:'Unlocked all 5 power-ups',     secret:false},
  {id:'month1',   icon:'📅', title:'Month Starter',  desc:'Completed 7 daily challenges', secret:false},
  {id:'perfect',  icon:'✨', title:'Perfectionist',  desc:'Completed a Hard challenge',   secret:false},
];

function getAchievements(){
  try{return JSON.parse(_ls.getItem('bp_achievements')||'{}');}catch(e){return{};}
}
function grantAchievement(id){
  var ach=getAchievements();
  if(ach[id])return; // already earned
  ach[id]={earnedAt:Date.now()};
  try{_ls.setItem('bp_achievements',JSON.stringify(ach));}catch(e){}
  var def=ACHIEVEMENT_TROPHIES.find(function(t){return t.id===id;});
  if(def){
    showAchToast(def.icon,'Achievement Unlocked!',def.title+' — '+def.desc);
    spawnParticles(10);
    SFX.achieve();
  }
}
function checkAchievements(){
  var ach=getAchievements();
  // Score-based
  if(score>=1000)grantAchievement('score1k');
  if(score>=5000)grantAchievement('score5k');
  if(score>=10000)grantAchievement('score10k');
  if(score>=25000)grantAchievement('score25k');
  if(score>=50000)grantAchievement('score50k');
  // Lines in one game
  if(totalLines>=50)grantAchievement('lines50');
  // Combo
  if(combo>=5)grantAchievement('combo5');
  // All power-ups
  if(starsEverEarned>=30)grantAchievement('allpower');
  // Monthly challenges
  var now=new Date();
  var mt=getMonthTrophies(now.getMonth()+1,now.getFullYear());
  if(mt.count>=7)grantAchievement('month1');
}
function grantWelcomeTrophy(){
  // Give welcome trophy on very first game
  setTimeout(function(){
    grantAchievement('welcome');
  },2000); // slight delay so it doesn't clash with game start
}


var EASY_SHAPES=[[0],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11],[12],[13]]; // small shapes (indices into SHAPES)
var MED_SHAPES=[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]; // medium
var HARD_SHAPES=[6,7,8,9,14,15,16,17,18,19,20,21,22,23,24,25]; // large shapes

function getShapePool(diff){return[EASY_SHAPES,MED_SHAPES,HARD_SHAPES][diff];}

// Generate seeded piece sequence for a challenge (30 pieces)
function genChallengePieces(day,month,year,diff){
  var seed=(day*73856093)^(month*19349663)^(year*83492791);
  var rng=new SeededRNG(seed);
  var pool=getShapePool(diff);
  var pieces=[];
  for(var i=0;i<30;i++) pieces.push(pool[rng.int(pool.length)]);
  return pieces;
}

// Challenge storage key
function chKey(day,month,year){return 'bp_ch_'+year+'_'+month+'_'+day;}

function loadChallenge(day,month,year){
  try{return JSON.parse(localStorage.getItem(chKey(day,month,year))||'null');}catch(e){return null;}
}
function saveChallenge(day,month,year,data){
  try{localStorage.setItem(chKey(day,month,year),JSON.stringify(data));}catch(e){}
}

// Get all trophies across all time
function getAllTrophies(){
  var trophies=[];
  var seen={};
  // Method 1: enumerate localStorage keys
  try{
    var keys=Object.keys(localStorage);
    keys.forEach(function(k){
      if(k.indexOf('bp_ch_')===0){
        var d=JSON.parse(localStorage.getItem(k)||'null');
        if(d&&d.completed&&!seen[k]){seen[k]=true;trophies.push(d);}
      }
    });
  }catch(e){}
  // Method 2: iterate last 3 months as fallback (covers cases where key enumeration fails)
  try{
    var now=new Date();
    for(var mo=0;mo<3;mo++){
      var mm=now.getMonth()+1-mo;
      var yy=now.getFullYear();
      if(mm<1){mm+=12;yy--;}
      for(var dd=1;dd<=31;dd++){
        var k=chKey(dd,mm,yy);
        if(!seen[k]){
          var d=loadChallenge(dd,mm,yy);
          if(d&&d.completed){seen[k]=true;trophies.push(d);}
        }
      }
    }
  }catch(e){}
  trophies.sort(function(a,b){return b.earnedAt-a.earnedAt;});
  return trophies;
}

// Count trophies for a given month+year
function getMonthTrophies(month,year){
  var count=0,trophies=[];
  for(var d=1;d<=31;d++){
    var ch=loadChallenge(d,month,year);
    if(ch&&ch.completed){count++;trophies.push(ch);}
  }
  return{count:count,trophies:trophies};
}

// Challenge state during gameplay
var isChallenge=false,challengeEnding=false;
var challengeDay=0,challengeMonth=0,challengeYear=0,challengeDiff=0;
var challengePieceQueue=[],challengePieceIndex=0;

// ── Objective bar ──
function updateObjBar(){
  var main=document.getElementById('obj-main');
  var sub=document.getElementById('obj-sub');
  var bar=document.getElementById('obj-bar');
  if(isChallenge){
    var diff=challengeDiff;
    var used=Math.min(challengePieceIndex,30);
    var total=30;
    var pct=Math.round((used/total)*100);
    main.textContent='📅 Day '+challengeDay+' · '+DIFF_NAMES[diff]+' '+DIFF_ICONS[diff];
    sub.innerHTML='<div class="ch-prog-wrap">'
      +'<div class="ch-prog-bar"><div class="ch-prog-fill" style="width:'+pct+'%"></div></div>'
      +'<div class="ch-prog-label">'+used+'/'+total+' pieces</div>'
      +'</div>';
  } else {
    main.textContent='Fill rows & columns to score points';
    sub.textContent='Drag pieces · Clear lines · Earn ⭐ stars';
  }
}

function startChallenge(day,month,year){
  isChallenge=true;
  challengeDay=day;challengeMonth=month;challengeYear=year;
  challengeDiff=getDiff(day);
  var diff=challengeDiff;
  challengePieceQueue=genChallengePieces(day,month,year,diff);
  challengePieceIndex=0;
  // Show banner (hidden now — obj bar handles it)
  document.getElementById('ch-banner').style.display='none';
  initGame();
  updateObjBar();
}

function rndChallenge(){
  // If queue exhausted — challenge is complete, end it
  if(challengePieceIndex>=challengePieceQueue.length){
    // Delay so current board render finishes first
    setTimeout(function(){
      if(isChallenge)finishChallenge();
    },400);
    // Return a dummy piece (won't be seen — game ends)
    return SHAPES[0];
  }
  var idx=challengePieceQueue[challengePieceIndex++];
  setTimeout(updateObjBar,0);
  return SHAPES[idx];
}

function fireConfetti(){
  var cont=document.getElementById('ch-confetti');cont.innerHTML='';
  var colors=['#f0c060','#7c5cbf','#1ecfb0','#ff6b6b','#4caf50','#ff9800','#fff'];
  for(var i=0;i<60;i++){
    var p=document.createElement('div');p.className='conf-piece';
    p.style.left=Math.random()*100+'vw';
    p.style.background=colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration=(1.5+Math.random()*2)+'s';
    p.style.animationDelay=(Math.random()*0.8)+'s';
    p.style.width=p.style.height=(6+Math.random()*8)+'px';
    cont.appendChild(p);
  }
  setTimeout(function(){cont.innerHTML='';},4000);
}

function finishChallenge(){
  if(!isChallenge)return;
  isChallenge=false; // mark done before async ops
  cancelHint();
  var day=challengeDay,month=challengeMonth,year=challengeYear,diff=challengeDiff;
  var existing=loadChallenge(day,month,year);
  var isFirstCompletion=!existing||!existing.completed;
  var isNewBest=!existing||score>(existing.score||0);
  var data={day:day,month:month,year:year,diff:diff,score:score,completed:true,
    earnedAt:(existing&&existing.earnedAt)||Date.now()};
  if(!isNewBest&&existing)data.score=existing.score; // keep best score
  else data.score=score;
  saveChallenge(day,month,year,data);
  if(isFirstCompletion){
    var reward=[10,20,35][diff];
    earnStars(reward);
    if(diff===2)grantAchievement('perfect'); // Hard challenge
    checkAchievements(); // check month1
  }
  SFX.trophy();
  fireConfetti();
  updateQuestProgress('challenge',1);
  // Short delay so confetti starts before modal appears
  setTimeout(function(){
    showChallengeResult(day,month,year,diff,isFirstCompletion,isNewBest,existing);
  },600);
}

function showChallengeResult(day,month,year,diff,isFirst,isNewBest,existing){
  var modal=document.getElementById('ch-result-modal');
  document.getElementById('ch-result-title').textContent=isFirst?'Trophy Earned! 🏆':'Challenge Complete!';
  document.getElementById('ch-result-icon').textContent=isFirst?getTrophyIcon(diff):'🎮';
  document.getElementById('ch-result-score').textContent=score.toLocaleString();
  var diffEl=document.getElementById('ch-result-diff');
  diffEl.textContent=DIFF_NAMES[diff]+' '+DIFF_ICONS[diff];
  diffEl.className='ch-result-diff '+DIFF_LABELS[diff];
  var newEl=document.getElementById('ch-result-new');
  if(isFirst){newEl.textContent='First completion! +'+[10,20,35][diff]+'⭐ reward';newEl.className='ch-result-new best';}
  else if(isNewBest){newEl.textContent='New best! Previous: '+(existing?existing.score:0);newEl.className='ch-result-new best';}
  else{newEl.textContent='Your best: '+(existing?existing.score:score);newEl.className='ch-result-new';}
  modal.classList.add('show');
  document.getElementById('ch-result-home').onclick=function(){
    modal.classList.remove('show');goHome();
  };
  document.getElementById('ch-result-retry').onclick=function(){
    modal.classList.remove('show');
    isChallenge=true;
    startChallenge(day,month,year);
  };
  // Play Next Challenge button
  var nextBtn=document.getElementById('ch-result-next');
  if(nextBtn){
    var now2=new Date();
    var maxDay=new Date(year,month,0).getDate();
    var nextDay=day+1;
    var nextAvail=nextDay<=maxDay&&(year<now2.getFullYear()||(year===now2.getFullYear()&&month<now2.getMonth()+1)||(year===now2.getFullYear()&&month===now2.getMonth()+1&&nextDay<=now2.getDate()));
    if(nextAvail){
      nextBtn.style.display='block';
      nextBtn.onclick=function(){
        modal.classList.remove('show');
        isChallenge=true;
        startChallenge(nextDay,month,year);
        goToGame();
      };
    } else {
      nextBtn.style.display='none';
    }
  }
}

// ── Challenges modal ──
var chViewMonth,chViewYear;
var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

function openChallengesModal(){
  var now=new Date();
  chViewMonth=now.getMonth()+1;chViewYear=now.getFullYear();
  renderChallengesModal();
  openModal('challenges-modal');
}
function renderChallengesModal(){
  var now=new Date();
  var todayD=now.getDate(),todayM=now.getMonth()+1,todayY=now.getFullYear();
  document.getElementById('ch-month-label').textContent=MONTH_NAMES[chViewMonth-1]+' '+chViewYear;
  // Calendar
  var cal=document.getElementById('ch-cal');cal.innerHTML='';
  var dayLabels=['S','M','T','W','T','F','S'];
  dayLabels.forEach(function(l){var d=document.createElement('div');d.className='ch-day-label';d.textContent=l;cal.appendChild(d);});
  // First day of month
  var firstDay=new Date(chViewYear,chViewMonth-1,1).getDay();
  var daysInMonth=new Date(chViewYear,chViewMonth,0).getDate();
  for(var i=0;i<firstDay;i++){var e=document.createElement('div');e.className='ch-day empty';cal.appendChild(e);}
  for(var d=1;d<=daysInMonth;d++){
    var cell=document.createElement('div');
    var diff=getDiff(d);
    cell.className='ch-day '+DIFF_LABELS[diff];
    var isToday=(d===todayD&&chViewMonth===todayM&&chViewYear===todayY);
    var isFuture=(chViewYear>todayY)||(chViewYear===todayY&&chViewMonth>todayM)||(chViewYear===todayY&&chViewMonth===todayM&&d>todayD);
    if(isToday)cell.classList.add('today');
    if(isFuture)cell.classList.add('future');
    var ch=loadChallenge(d,chViewMonth,chViewYear);
    cell.innerHTML='<div class="ch-num">'+d+'</div><div class="ch-dot"></div>';
    if(ch&&ch.completed)cell.innerHTML+='<div class="ch-trophy">'+getTrophyIcon(diff)+'</div>';
    if(!isFuture){
      (function(day){
        cell.addEventListener('click',function(){
          closeModal('challenges-modal');
          startChallenge(day,chViewMonth,chViewYear);
          goToGame();
        });
      })(d);
    }
    cal.appendChild(cell);
  }
  // Trophy shelf — all time trophies
  var shelf=document.getElementById('trophy-shelf');shelf.innerHTML='';
  var trophies=getAllTrophies();
  var ach=getAchievements();

  // Achievement trophies section
  var achTitle=document.createElement('div');
  achTitle.style.cssText='width:100%;font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;margin-top:4px';
  achTitle.textContent='Achievement Trophies';
  shelf.appendChild(achTitle);

  var achGrid=document.createElement('div');
  achGrid.style.cssText='display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-bottom:12px';
  var earned=0;
  ACHIEVEMENT_TROPHIES.forEach(function(def){
    var isEarned=!!ach[def.id];
    if(isEarned)earned++;
    var card=document.createElement('div');
    card.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;width:56px;border-radius:8px;padding:6px 4px;gap:2px;'+(isEarned?'background:rgba(255,200,50,.12);border:1px solid rgba(255,200,50,.3)':'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);opacity:.45;filter:grayscale(1)');
    card.innerHTML='<div style="font-size:20px">'+def.icon+'</div><div style="font-size:8px;color:rgba(255,255,255,'+(isEarned?'.7':'.3')+');text-align:center;line-height:1.2">'+def.title+'</div>';
    card.style.cursor='pointer';
    (function(d,e,el){el.addEventListener('click',function(ev){ev.stopPropagation();showAchPopover(d,e,el);});})(def,isEarned,card);
    achGrid.appendChild(card);
  });
  var achProg=document.createElement('div');
  achProg.style.cssText='width:100%;font-size:10px;color:rgba(255,255,255,.3);margin-bottom:2px';
  achProg.textContent=earned+' / '+ACHIEVEMENT_TROPHIES.length+' achievements earned';
  shelf.appendChild(achGrid);
  shelf.appendChild(achProg);

  // Daily challenge trophies section
  var chTitle=document.createElement('div');
  chTitle.style.cssText='width:100%;font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;margin-top:8px';
  chTitle.textContent='Challenge Trophies';
  shelf.appendChild(chTitle);

  if(trophies.length===0){
    var empty=document.createElement('div');
    empty.style.cssText='color:rgba(255,255,255,.25);font-size:12px;padding:8px 0';
    empty.textContent='Complete daily challenges to earn trophies!';
    shelf.appendChild(empty);
  } else {
    var chGrid=document.createElement('div');
    chGrid.style.cssText='display:flex;flex-wrap:wrap;gap:8px;width:100%';
    var unconv=trophies.filter(function(t){return !t.converted;});
    var totSt=unconv.reduce(function(s,t){return s+[10,20,35][t.diff];},0);
    if(unconv.length===0){
      // All trophies converted
      var allDone=document.createElement('div');
      allDone.style.cssText='color:rgba(30,207,176,.6);font-size:12px;padding:8px 0';
      allDone.textContent='✓ All '+trophies.length+' trophies converted to stars!';
      shelf.appendChild(allDone);
    } else {
      if(unconv.length){var inf=document.createElement('div');inf.style.cssText='font-size:11px;color:rgba(255,200,50,.6);margin-bottom:8px';inf.textContent=unconv.length+(unconv.length!==1?' trophies':' trophy')+' → '+totSt+'⭐ available';shelf.appendChild(inf);}
      unconv.forEach(function(t){
        var card=document.createElement('div');
        card.className='trophy-card '+DIFF_LABELS[t.diff];
        card.innerHTML='<div class="tc-icon">'+getTrophyIcon(t.diff)+'</div>'
          +'<div class="tc-day">Day '+t.day+'</div>'
          +'<div class="tc-score">'+t.score+'</div>'
          +'<div class="tc-diff">'+DIFF_NAMES[t.diff]+' +'+[10,20,35][t.diff]+'⭐</div>';
        chGrid.appendChild(card);
      });
      shelf.appendChild(chGrid);
      if(unconv.length){var cb=document.createElement('button');cb.className='convert-btn';cb.textContent='💰 Convert All → +'+totSt+'⭐';(function(l,b){b.addEventListener('click',function(){convertTrophiesToStars(l,b);});})(unconv,cb);shelf.appendChild(cb);}
    }
  }
  // Month master check — current viewed month
  var mt=getMonthTrophies(chViewMonth,chViewYear);
  var masterEl=document.getElementById('month-master-trophy');
  if(masterEl)masterEl.remove();
  if(mt.count>=daysInMonth){
    var mm=document.createElement('div');mm.id='month-master-trophy';mm.className='month-master';
    mm.innerHTML='<div class="mm-icon">👑</div><div class="mm-title">Month Master!</div><div class="mm-sub">All '+daysInMonth+' challenges completed for '+MONTH_NAMES[chViewMonth-1]+'</div>';
    document.getElementById('trophy-shelf').before(mm);
  }
  // Prev/Next nav
  document.getElementById('ch-prev').onclick=function(){
    chViewMonth--;if(chViewMonth<1){chViewMonth=12;chViewYear--;}renderChallengesModal();
  };
  document.getElementById('ch-next').onclick=function(){
    var now2=new Date();if(chViewYear>now2.getFullYear()||(chViewYear===now2.getFullYear()&&chViewMonth>=now2.getMonth()+1))return;
    chViewMonth++;if(chViewMonth>12){chViewMonth=1;chViewYear++;}renderChallengesModal();
  };
}
document.getElementById('challenges-close').addEventListener('click',function(){document.getElementById('challenges-modal').classList.remove('show');});
document.getElementById('challenges-modal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show');});

// ══════════════════════════════════════════════
//  DAILY LOGIN BONUS
// ══════════════════════════════════════════════
var STREAK_BONUSES=[3,5,8,10,12,15,20];
function getTodayStr(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}

function showDailyBonusClaimed(streak){
  var bonusAmt=STREAK_BONUSES[Math.min(streak-1,STREAK_BONUSES.length-1)];
  document.getElementById('streak-count').textContent=streak;
  document.getElementById('bonus-amount').style.display='none';
  document.getElementById('bonus-label').style.display='none';
  document.getElementById('daily-claim').style.display='none';
  document.getElementById('daily-close').style.display='block';
  var msg=document.getElementById('daily-claimed-msg');
  msg.style.display='block';
  msg.textContent='✅ Already claimed today! (+'+bonusAmt+'⭐)\nCome back tomorrow for more stars!';
  var cont=document.getElementById('streak-days');cont.innerHTML='';
  for(var d=1;d<=7;d++){
    var div=document.createElement('div');div.className='streak-day';
    if(d<=streak)div.classList.add('done');
    div.textContent=d<=streak?'✓':'D'+d;
    cont.appendChild(div);
  }
  openModal('daily-modal');
  document.getElementById('daily-close').onclick=function(){closeModal('daily-modal');};
}
function checkDailyBonus(){
  try{
    var last=_ls.getItem('bp_last_login')||'';
    var streak=parseInt(_ls.getItem('bp_streak')||'0')||0;
    var today=getTodayStr();
    if(last===today)return;
    var yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    var yStr=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate();
    streak=(last===yStr)?Math.min(streak+1,7):1;
    setTimeout(function(){showDailyBonus(streak);},1000);
  }catch(e){}
}
function showDailyBonus(streak){
  var bonusAmt=STREAK_BONUSES[Math.min(streak-1,STREAK_BONUSES.length-1)];
  document.getElementById('streak-count').textContent=streak;
  document.getElementById('bonus-amount').textContent='+'+bonusAmt+'⭐';
  var cont=document.getElementById('streak-days');cont.innerHTML='';
  for(var d=1;d<=7;d++){
    var div=document.createElement('div');div.className='streak-day';
    if(d<streak)div.classList.add('done');
    if(d===streak)div.classList.add('today');
    div.textContent=(d===streak)?'🌟':(d<streak?'✓':'D'+d);
    cont.appendChild(div);
  }
  document.getElementById('daily-claimed-msg').style.display='none';
  document.getElementById('bonus-amount').style.display='';
  document.getElementById('bonus-label').style.display='';
  document.getElementById('daily-claim').style.display='';
  document.getElementById('daily-close').style.display='none';
  openModal('daily-modal');
  document.getElementById('daily-claim').onclick=function(){
    closeModal('daily-modal');
    try{_ls.setItem('bp_last_login',getTodayStr());_ls.setItem('bp_streak',String(streak));}catch(e){}
    SFX.bonus();earnStars(bonusAmt);
    showAchToast('🎁','Daily Bonus!','+'+bonusAmt+'⭐ — '+streak+'-day streak!');
  };
}

// ══════════════════════════════════════════════
//  ACHIEVEMENT TOAST (lightweight — no modal)
// ══════════════════════════════════════════════
var achToastTimer=null;
function showAchToast(icon,title,desc){
  clearTimeout(achToastTimer);
  var t=document.getElementById('ach-toast');
  document.getElementById('ach-toast-icon').textContent=icon;
  document.getElementById('ach-toast-title').textContent=title;
  document.getElementById('ach-toast-desc').textContent=desc;
  t.classList.add('show');
  achToastTimer=setTimeout(function(){t.classList.remove('show');},1800);
}

// Combo splash
var comboSplashTimer=null;
function showComboSplash(n){
  if(n<2)return;
  clearTimeout(comboSplashTimer);
  var el=document.getElementById('combo-splash');
  el.classList.remove('pop');
  el.textContent=n>=5?'UNSTOPPABLE! 🔥🔥':n>=4?'AMAZING! 🔥':n>=3?'COMBO x'+n+'! 🔥':'COMBO x'+n+'!';
  void el.offsetWidth;el.classList.add('pop');
  comboSplashTimer=setTimeout(function(){el.classList.remove('pop');},900);
  SFX.combo(n);
  if(n>=5)grantAchievement('combo5');
  // Extra particles on high combo
  if(n>=3)spawnParticles(n*2);
}

// Particle burst — fires from board center
function spawnParticles(count){
  var bc=document.getElementById('bc');if(!bc)return;
  var rect=bc.getBoundingClientRect();
  var cx=rect.left+rect.width/2;
  var cy=rect.top+rect.height/2;
  var colors=['#f0e060','#ff7832','#7c5cbf','#1ecfb0','#f06060','#60d0ff','#f0c050'];
  var n=Math.min(count*4,40);
  for(var i=0;i<n;i++){
    (function(){
      var p=document.createElement('div');
      p.className='particle';
      var size=4+Math.random()*6;
      var angle=Math.random()*Math.PI*2;
      var dist=60+Math.random()*120;
      var tx=Math.cos(angle)*dist;
      var ty=Math.sin(angle)*dist;
      p.style.cssText='width:'+size+'px;height:'+size+'px;left:'+cx+'px;top:'+cy+'px;background:'+colors[Math.floor(Math.random()*colors.length)]+';--pt:translate('+tx+'px,'+ty+'px);';
      document.body.appendChild(p);
      setTimeout(function(){p.remove();},750);
    })();
  }
}


// ── Modal open/close helpers — block game interaction ──
function openModal(id){
  var el=document.getElementById(id);if(!el)return;
  el.classList.add('show');
  document.body.classList.add('modal-open');
}
function closeModal(id){
  var el=document.getElementById(id);if(!el)return;
  el.classList.remove('show');
  var anyOpen=document.querySelector('.modal-wrap.show');
  if(!anyOpen)document.body.classList.remove('modal-open');
}
// ══════════════════════════════════════════════
//  LOBBY
// ══════════════════════════════════════════════
var lbInterval=null;
function updateLobbyStats(){
  try{
    document.getElementById('lb-best').textContent=parseInt(_ls.getItem('bp_best')||'0')||0;
    document.getElementById('lb-stars').textContent=(parseInt(_ls.getItem('bp_stars')||'0')||0)+'⭐';
    document.getElementById('lb-streak').textContent=(parseInt(_ls.getItem('bp_streak')||'0')||0)+'d';
    document.getElementById('lb-trophies').textContent=getAllTrophies().length;
    // Today's challenge badge
    var now=new Date();
    var todayCh=loadChallenge(now.getDate(),now.getMonth()+1,now.getFullYear());
    var badge=document.getElementById('lb-challenge-badge');
    if(!todayCh||!todayCh.completed){badge.style.display='block';}else{badge.style.display='none';}
  }catch(e){}
}


// ── Daily Quest Templates ──
var QUEST_TEMPLATES=[
  {id:'score',    icon:'🎯',title:'Score {n} points',     reward:8,  targets:[500,1000,2000,3000]},
  {id:'lines',    icon:'✨',      title:'Clear {n} lines',       reward:6,  targets:[3,5,8,12]},
  {id:'pieces',   icon:'🧩',title:'Place {n} pieces',      reward:5,  targets:[10,15,20,30]},
  {id:'combo',    icon:'🔥',title:'Get a {n}x combo',      reward:10, targets:[2,3,4,5]},
  {id:'stars',    icon:'⭐',      title:'Earn {n} stars',        reward:7,  targets:[5,10,15,20]},
  {id:'powerup',  icon:'⚡',      title:'Use a power-up',        reward:6,  targets:[1,1,1,1]},
  {id:'challenge',icon:'📅',title:'Complete a challenge',  reward:12, targets:[1,1,1,1]},
  {id:'noundo',   icon:'🏅',title:'Score {n} pts no Undo', reward:10, targets:[300,600,1000,1500]},
];
var questUndoUsed=false,_questBusy=false;

var CHEST_TIERS=[
  {id:'bronze',icon:'📦',name:'Bronze Chest',cap:30, reward:15,unlockAt:0},
  {id:'silver',icon:'🪶',name:'Silver Chest', cap:60, reward:35,unlockAt:50},
  {id:'gold',  icon:'🏆',name:'Gold Chest',   cap:100,reward:65,unlockAt:150},
];
var chestGems=0; // current gems in chest

(function(){
  var LR=5,LC=7,lbB=document.getElementById('lb-board'),cells=[];
  for(var i=0;i<LR*LC;i++){var d=document.createElement('div');d.className='lb-cell';lbB.appendChild(d);cells.push(d);}
  var patterns=[
    [[0,0],[0,1],[0,2],[1,2],[2,2]],[[0,2],[1,2],[2,2],[2,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],[[0,1],[1,0],[1,1],[1,2]],
    [[0,3],[1,3],[2,3],[3,3]],[[0,3],[0,4],[1,3],[1,4]]
  ];
  var pi=0;
  function animStep(){
    var pat=patterns[pi%patterns.length];
    pat.forEach(function(rc){var idx=rc[0]*LC+rc[1];if(cells[idx])cells[idx].classList.add('flash');});
    setTimeout(function(){
      pat.forEach(function(rc){var idx=rc[0]*LC+rc[1];if(cells[idx]){cells[idx].classList.remove('flash');cells[idx].classList.add('on');}});
      pi++;if(pi%3===0){setTimeout(function(){cells.forEach(function(c){c.className='lb-cell';});},600);}
    },300);
  }
  animStep();lbInterval=setInterval(animStep,1200);
  updateLobbyStats();
  document.getElementById('lb-htp-btn').addEventListener('click',function(){openModal('lb-htp-modal');});
  document.getElementById('lb-htp-close').addEventListener('click',function(){closeModal('lb-htp-modal');});
  document.getElementById('lb-htp-modal').addEventListener('click',function(e){if(e.target===this)closeModal('lb-htp-modal');});
  document.getElementById('lb-challenges-btn').addEventListener('click',openChallengesModal);
  document.getElementById('lb-adv-btn').addEventListener('click',function(){openAdvMap();});
  document.getElementById('lb-adv-btn').addEventListener('touchstart',function(e){e.preventDefault();openAdvMap();},{passive:false});
  document.getElementById('lb-chest').addEventListener('click',openChest);
  document.getElementById('lb-chest').addEventListener('touchstart',function(e){e.preventDefault();openChest();},{passive:false});
  document.getElementById('lb-quests-btn').addEventListener('click',function(){renderQuestsModal();openModal('quests-modal');});
  document.getElementById('quests-close').addEventListener('click',function(){closeModal('quests-modal');});
  document.getElementById('quests-modal').addEventListener('click',function(e){if(e.target===this)closeModal('quests-modal');});
  document.getElementById('lb-daily-btn').addEventListener('click',function(){
    try{
      var streak=parseInt(_ls.getItem('bp_streak')||'0')||0;
      var last=_ls.getItem('bp_last_login')||'';
      var today=getTodayStr();
      if(last===today){showDailyBonusClaimed(streak);}
      else{showDailyBonus(Math.max(streak,1));}
    }catch(e){}
  });
  document.getElementById('lb-challenge-badge').addEventListener('click',function(){
    var now=new Date();
    startChallenge(now.getDate(),now.getMonth()+1,now.getFullYear());
    goToGame();
  });
  document.getElementById('lb-play').addEventListener('click',function(){
    if(_lbPlayTouched)return; // already handled by touchstart
    isChallenge=false;
    goToGame();
  });
  var _lbPlayTouched=false;
  document.getElementById('lb-play').addEventListener('touchstart',function(e){
    e.preventDefault();
    _lbPlayTouched=true;
    isChallenge=false;
    goToGame();
    setTimeout(function(){_lbPlayTouched=false;},600);
  },{passive:false});
  checkDailyBonus();
  updateQuestsBadge();
  loadChestGems();updateChestUI();
})();

function goToGame(){
  if(lbInterval){clearInterval(lbInterval);lbInterval=null;}
  document.body.classList.remove('modal-open');
  document.getElementById('lobby').classList.add('hide');
  document.getElementById('w').classList.add('show');
  document.getElementById('scale-shell').style.pointerEvents='auto';
  scaleGame();
  setTimeout(function(){document.getElementById('lobby').style.display='none';},500);
  if(!isChallenge)initGame();
}
function goHome(){
  isChallenge=false;
  challengeEnding=false;
  if(advMode)resetAdvMode();
  if(typeof blastMode!=='undefined'&&blastMode)cancelBlast();
  // Safety: clear all stuck states
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.modal-wrap.show').forEach(function(m){m.classList.remove('show');});
  document.getElementById('go').classList.remove('show');
  document.getElementById('w').classList.remove('game-over');
  document.getElementById('w').classList.remove('show');
  document.getElementById('scale-shell').style.pointerEvents='none';
  document.getElementById('lobby').style.display='';
  setTimeout(function(){
    document.getElementById('lobby').classList.remove('hide');
    updateLobbyStats();
  },50);
  updateObjBar();
  if(!lbInterval){
    var cells2=Array.from(document.getElementById('lb-board').children);
    cells2.forEach(function(c){c.className='lb-cell';});
    lbInterval=setInterval(function(){},9999);
  }
}
document.getElementById('home-btn').addEventListener('click',function(){showHomeConfirm();});
document.getElementById('bpa').addEventListener('click',function(){
  document.getElementById('go').classList.remove('show');
  document.getElementById('w').classList.remove('game-over');
  if(isChallenge){startChallenge(challengeDay,challengeMonth,challengeYear);}
  else{initGame();}
});

// ══════════════════════════════════════════════
//  PROGRESSIVE UNLOCK
// ══════════════════════════════════════════════
var UNLOCK_THRESHOLDS={shuffle:0,undo:6,rotate:12,hold2:20,blast:30};
var sessionUnlocks={shuffle:false,undo:false,rotate:false,hold2:false,blast:false};
function loadUnlocks(){
  try{
    var u=JSON.parse(_ls.getItem('bp_unlocks')||'{}');
    ['shuffle','undo','rotate','hold2','blast'].forEach(function(k){
      if(u[k]){sessionUnlocks[k]=true;applyUnlock(k,false);}
    });
    if(sessionUnlocks.shuffle){
      document.getElementById('shop').classList.remove('hidden');
      document.getElementById('stardisplay').classList.remove('hidden');
    }
  }catch(e){}
}
function saveUnlock(k){try{var u=JSON.parse(_ls.getItem('bp_unlocks')||'{}');u[k]=true;_ls.setItem('bp_unlocks',JSON.stringify(u));}catch(e){}}

// Track which unlock tooltips have been acknowledged (first click)
var ackUnlocks={};
function loadAckUnlocks(){try{ackUnlocks=JSON.parse(_ls.getItem('bp_ack')||'{}');}catch(e){ackUnlocks={};}}
function ackUnlock(k){ackUnlocks[k]=true;try{_ls.setItem('bp_ack',JSON.stringify(ackUnlocks));}catch(e){}}

function applyUnlock(k,animate){
  sessionUnlocks[k]=true;
  var id={shuffle:'btn-shuffle',undo:'btn-undo',rotate:'btn-rotate',hold2:'btn-hold2',blast:'btn-blast'}[k];
  var btn=document.getElementById(id);if(!btn)return;
  btn.classList.remove('locked');
  if(animate){
    btn.classList.add('unlocking');setTimeout(function(){btn.classList.remove('unlocking');},500);
    var fl=document.createElement('div');fl.className='unlock-flash';document.body.appendChild(fl);setTimeout(function(){fl.remove();},600);
    SFX.unlock();
  }
  // Add persistent NEW badge if not yet acknowledged
  if(!ackUnlocks[k]){
    // Remove any existing badge first
    var old=btn.querySelector('.new-badge');if(old)old.remove();
    var badge=document.createElement('span');badge.className='new-badge';badge.textContent='NEW';btn.appendChild(badge);
    // Show persistent tooltip
    if(animate)showPersistentTip(k,btn,badge);
    // On first click — acknowledge and remove badge+tip
    var onAck=function(){
      ackUnlock(k);
      badge.classList.add('fade');
      setTimeout(function(){if(badge.parentNode)badge.remove();},300);
      hidePersistentTip(k);
      btn.removeEventListener('click',onAck);
      btn.removeEventListener('touchend',onAck);
    };
    btn.addEventListener('click',onAck);
    btn.addEventListener('touchend',onAck);
  }
}

// ── Home confirm (replaces browser confirm — works everywhere) ──
function showHomeConfirm(){
  document.getElementById('home-confirm').classList.add('show');
}
document.getElementById('hc-yes').addEventListener('click',function(){
  document.getElementById('home-confirm').classList.remove('show');
  goHome();
});
document.getElementById('hc-no').addEventListener('click',function(){
  document.getElementById('home-confirm').classList.remove('show');
});

// Persistent in-game tooltip — appears above shop button, stays until clicked
var persistTips={};
var tipMessages={
  shuffle:{title:'🔀 Shuffle Unlocked!',text:'Reroll your 3 pieces for 2⭐. Tap here to use it!'},
  undo:   {title:'↩ Undo Unlocked!',   text:'Undo your last move for 3⭐. Tap here to use it!'},
  rotate: {title:'🔄 Rotate Unlocked!', text:'Rotate any piece — 1⭐ charged on placement. Tap here!'},
  hold2:  {title:'＋ +Hold Unlocked!',  text:'Unlock a 2nd HOLD slot for 4⭐. Tap here to buy!'},
  blast:  {title:'💥 Blast Unlocked!',  text:'Clear any row or column for 5⭐. Tap here to use it!'}
};
function showPersistentTip(k,btn,badge){
  // Only show when game screen is visible — never on lobby
  if(!document.getElementById('w').classList.contains('show'))return;
  hidePersistentTip(k);
  var msg=tipMessages[k];if(!msg)return;
  var tip=document.createElement('div');tip.className='ig-tip';tip.id='tip-'+k;
  tip.innerHTML='<strong>'+msg.title+'</strong><br>'+msg.text+'<div style="font-size:10px;opacity:.5;margin-top:6px">Tap to dismiss</div>';
  document.body.appendChild(tip);
  persistTips[k]=tip;
  // Tap tip to dismiss
  tip.addEventListener('pointerdown',function(e){
    e.stopPropagation();
    hidePersistentTip(k);
  });
  function positionTip(){
    var rect=btn.getBoundingClientRect();
    var tw=tip.offsetWidth||220;
    var th=tip.offsetHeight||80;
    var left=Math.max(8,Math.min(window.innerWidth-tw-8,rect.left+rect.width/2-tw/2));
    var top=rect.top-th-10;
    if(top<8)top=rect.bottom+10;
    tip.style.left=left+'px';
    tip.style.top=top+'px';
  }
  setTimeout(positionTip,16);
  tip._pos=positionTip;
  window.addEventListener('resize',positionTip);
  // Auto-hide after 8s
  setTimeout(function(){hidePersistentTip(k);},8000);
}
function hidePersistentTip(k){
  if(persistTips[k]){
    if(persistTips[k]._pos)window.removeEventListener('resize',persistTips[k]._pos);
    persistTips[k].remove();delete persistTips[k];
  }
  var old=document.getElementById('tip-'+k);if(old)old.remove();
}
function checkUnlocks(tot){
  ['shuffle','undo','rotate','hold2','blast'].forEach(function(k){
    if(!sessionUnlocks[k]&&tot>=UNLOCK_THRESHOLDS[k]){
      applyUnlock(k,true);saveUnlock(k);
      if(k==='shuffle'){document.getElementById('shop').classList.remove('hidden');document.getElementById('stardisplay').classList.remove('hidden');}
    }
  });
}

// ══════════════════════════════════════════════
//  GAME ENGINE
// ══════════════════════════════════════════════
var ROWS=10,COLS=10,LIFT=48,INNER_H=76,SNAP_DIST=3;
var DRAG_SPEED=1.8; // piece moves 1.8x faster than finger
var grid=[],score=0,best=0,totalLines=0,combo=0;
var stars=0,starsGame=0,lastState=null,starsEverEarned=0;
var pieces=[null,null,null],held=null,held2=null,extraHold=false;
var dragPiece=null,dragSlot=null,dragFromHold=false,dragFromHold2=false;
var dragging=false,ghostCells=[],dragEl=null,holdHov=false,holdHov2=false;
var hintCells=[],hintTimer=null,toastTimer=null,autoStoreGuard=false;
var rotateMode=false,rotatedSlots={};
var touchStartX=0,touchStartY=0,touchMoved=false,snapPos=null;
var dragOriginX=0,dragOriginY=0; // where drag started (finger pos)

var SHAPES=[
  [[1]],[[1,1]],[[1],[1]],[[1,1,1]],[[1],[1],[1]],[[1,1],[1,1]],
  [[1,1,1],[1,0,0]],[[1,1,1],[0,0,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],
  [[1,1],[1,0]],[[1,1],[0,1]],[[1,0],[1,1]],[[0,1],[1,1]],
  [[1,1,1,1]],[[1],[1],[1],[1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]],
  [[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1],[1,0],[1,0]],[[1,1],[0,1],[0,1]],
  [[1,1,1],[0,1,0]],[[0,1,0],[1,1,1]],[[1,1,1,1,1]],[[1],[1],[1],[1],[1]]
];

try{best=parseInt(_ls.getItem('bp_best')||'0')||0;document.getElementById('gbc').textContent=best;var bv=document.getElementById('best-val');if(bv)bv.textContent=best.toLocaleString();}catch(e){}
try{stars=parseInt(_ls.getItem('bp_stars')||'0')||0;document.getElementById('starcount').textContent=stars;}catch(e){}
try{starsEverEarned=parseInt(_ls.getItem('bp_stars_total')||'0')||0;}catch(e){}

document.getElementById('brs').addEventListener('click',function(){
  if(isChallenge){startChallenge(challengeDay,challengeMonth,challengeYear);}else{initGame();}
});
document.getElementById('chest-btn').addEventListener('click',openChest);
document.getElementById('chest-open-close').addEventListener('click',function(){
  var reward=parseInt(this.getAttribute('data-reward')||'0');
  if(reward>0){earnStars(reward);spawnParticles(15);SFX.achieve();this.setAttribute('data-reward','0');updateLobbyStats();}
  document.getElementById('chest-modal').classList.remove('show');
});
document.getElementById('chest-modal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show');});
document.getElementById('btn-undo').addEventListener('click',shopUndo);
document.getElementById('btn-shuffle').addEventListener('click',shopShuffle);
document.getElementById('btn-rotate').addEventListener('click',shopRotate);
document.getElementById('btn-hold2').addEventListener('click',shopHold2);
document.getElementById('save-end').addEventListener('click',triggerGameOver);

// rnd — uses seeded queue in challenge mode
var rnd=function(){
  if(isChallenge)return rndChallenge();
  return SHAPES[Math.floor(Math.random()*SHAPES.length)];
};

var boardCs=function(){var b=document.getElementById('bc');if(!b)return 36;var rect=b.getBoundingClientRect();return(rect.width-6)/10-2;};
var slotW=function(id){var e=document.getElementById(id);if(!e)return 56;var r=e.getBoundingClientRect();return r.width>0?r.width-14:56;};
function slotInnerH(id){var e=document.getElementById(id);if(!e)return 50;var r=e.getBoundingClientRect();return Math.max(30,r.height-18);}
function fitCs(sh,W,H){var g=2,cc=sh[0].length,rr=sh.length;var byW=Math.floor((W-g*(cc-1))/cc);var byH=Math.floor((H-g*(rr-1))/rr);return Math.max(4,Math.min(byW,byH,16));}
var cellEl=function(r,c){if(r<0||r>=ROWS||c<0||c>=COLS)return null;return document.getElementById('board').children[r*COLS+c];};
function resetCell(r,c){
  var el=cellEl(r,c);if(!el)return;
  var cls='cell';
  if(grid[r][c]){
    cls+=' on';
    var ice=advMode&&advIceGrid[r]?advIceGrid[r][c]:0;
    if(ice>=1){
      cls+=' ice-'+ice;
    } else if(advMode&&advColorGrid[r]&&advColorGrid[r][c]){
      cls+=' adv-block';
    } else if(advMode&&advBlockGrid[r]&&advBlockGrid[r][c]){
      cls+=' adv-block';
    }
  }
  el.className=cls;
}
function syncBoard(){for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++){resetCell(r,c);}
  if(advMode)renderAdvCellStyles();}
function clearGhost(){for(var i=0;i<ghostCells.length;i++){var g=ghostCells[i];resetCell(g.r,g.c);}ghostCells=[];snapPos=null;}
function trimShape(s){var r0=s.length,r1=-1,c0=s[0].length,c1=-1;for(var r=0;r<s.length;r++)for(var c=0;c<s[r].length;c++)if(s[r][c]){r0=Math.min(r0,r);r1=Math.max(r1,r);c0=Math.min(c0,c);c1=Math.max(c1,c);}if(r1<0)return s;return s.slice(r0,r1+1).map(function(row){return row.slice(c0,c1+1);});}
function canPlace(sh,sr,sc){for(var r=0;r<sh.length;r++)for(var c=0;c<sh[r].length;c++)if(sh[r][c]){var gr=sr+r,gc=sc+c;if(gr<0||gr>=ROWS||gc<0||gc>=COLS||grid[gr][gc])return false;}return true;}
function canPlaceAnywhere(sh){var s=trimShape(sh);for(var r=0;r<=ROWS-s.length;r++)for(var c=0;c<=COLS-s[0].length;c++)if(canPlace(s,r,c))return true;return false;}
function findPlacement(sh){var s=trimShape(sh);for(var r=0;r<=ROWS-s.length;r++)for(var c=0;c<=COLS-s[0].length;c++)if(canPlace(s,r,c))return{sr:r,sc:c,shape:s};return null;}
function doPlace(sh,sr,sc){
  var n=0;
  for(var r=0;r<sh.length;r++)for(var c=0;c<sh[r].length;c++){
    if(sh[r][c]){
      grid[sr+r][sc+c]=1;n++;
      if(advMode&&sh[r][c]===2&&advColorGrid[sr+r])advColorGrid[sr+r][sc+c]=1;
      var el=cellEl(sr+r,sc+c);
      if(el){
        var dcls='cell on placed'+(advMode&&sh[r][c]===2?' adv-block':'');
        el.className=dcls;
        (function(e,col){setTimeout(function(){
          e.classList.remove('placed');
          if(col&&advMode)e.classList.add('adv-block');
        },200);})(el,sh[r][c]===2);
      }
    }
  }
  updateQuestProgress('pieces',n);
  return n;
}
function rotateCW(sh){var rows=sh.length,cols=sh[0].length,res=[];for(var c=0;c<cols;c++){res.push([]);for(var r=rows-1;r>=0;r--)res[c].push(sh[r][c]);}return res;}
// Pending ghost update coords for RAF
var _pendingGhostX=0,_pendingGhostY=0,_ghostRafId=null;

function moveDragEl(cx,cy){
  if(!dragEl)return;
  var cs=boardCs()+2;
  var dx=(cx-dragOriginX)*DRAG_SPEED;
  var dy=(cy-dragOriginY)*DRAG_SPEED;
  var ax=dragOriginX+dx;
  var ay=dragOriginY+dy;
  var tx=ax-dragPiece[0].length*cs/2;
  var ty=ay-dragPiece.length*cs-LIFT;
  // GPU-accelerated transform — no layout reflow
  dragEl.style.transform='translate('+tx+'px,'+ty+'px)';
}
function visualCenter(cx,cy){var cs=boardCs()+2,ph=dragPiece.length*cs;var ax=ampX(cx),ay=ampY(cy);return{vcx:ax,vcy:ay-ph-LIFT+ph/2};}
function dropPos(cx,cy){var rect=document.getElementById('board').getBoundingClientRect(),cs=rect.width/COLS;return{row:Math.floor((cy-LIFT-(dragPiece.length*cs)/2-rect.top)/cs),col:Math.floor((cx-rect.left)/cs)};}
function overHoldBox(id,cx,cy){
  var el=document.getElementById(id);if(!el)return false;
  var r=el.getBoundingClientRect();
  // Use saved drag position if available (set just before dragEl is removed)
  if(window._lastDragRect){
    var dr=window._lastDragRect;
    var dcx=dr.left+dr.width/2;
    var dcy=dr.top+dr.height/2;
    return dcx>=r.left&&dcx<=r.right&&dcy>=r.top&&dcy<=r.bottom;
  }
  // Live drag element (during showGhost)
  if(dragEl){
    var dr2=dragEl.getBoundingClientRect();
    var dcx2=dr2.left+dr2.width/2;
    var dcy2=dr2.top+dr2.height/2;
    return dcx2>=r.left&&dcx2<=r.right&&dcy2>=r.top&&dcy2<=r.bottom;
  }
  // Last fallback: raw finger position
  var rawCx=dragOriginX+(cx-dragOriginX)/DRAG_SPEED;
  var rawCy=dragOriginY+(cy-dragOriginY)/DRAG_SPEED;
  return rawCx>=r.left&&rawCx<=r.right&&rawCy>=r.top&&rawCy<=r.bottom;
}
function overBoard(cx,cy){var rect=document.getElementById('board').getBoundingClientRect();return cx>=rect.left&&cx<=rect.right&&cy>=rect.top&&cy<=rect.bottom+100;}
function findSnapPos(cx,cy){var shape=trimShape(dragPiece),dp=dropPos(cx,cy),bSr=dp.row-Math.floor(shape.length/2),bSc=dp.col-Math.floor(shape[0].length/2);if(canPlace(shape,bSr,bSc))return{r:bSr,c:bSc};var best=null,bd=999;for(var dr=-SNAP_DIST;dr<=SNAP_DIST;dr++)for(var dc=-SNAP_DIST;dc<=SNAP_DIST;dc++){var sr=bSr+dr,sc=bSc+dc;if(canPlace(shape,sr,sc)){var d=Math.abs(dr)+Math.abs(dc);if(d<bd){bd=d;best={r:sr,c:sc};}}}return best;}

function earnStars(n){
  if(n<=0)return;
  stars+=n;starsGame+=n;starsEverEarned+=n;
  document.getElementById('starcount').textContent=stars;
  try{_ls.setItem('bp_stars',String(stars));_ls.setItem('bp_stars_total',String(starsEverEarned));}catch(e){}
  var sd=document.getElementById('stardisplay');
  if(sd.classList.contains('hidden')){sd.classList.remove('hidden');document.getElementById('shop').classList.remove('hidden');}
  var el=document.createElement('div');el.className='star-pop';el.textContent='+'+n+'⭐';
  var sd2=sd.getBoundingClientRect();
  el.style.left=(sd2.left+sd2.width/2-20)+'px';el.style.top=(sd2.top-10)+'px';
  document.body.appendChild(el);setTimeout(function(){el.remove();},1000);
  checkUnlocks(starsEverEarned);updateShopBtns();updateUnlockProgress();
  updateChestUI(); // tier may have changed
  updateQuestProgress('stars',n);
}
function spendStars(n){if(stars<n)return false;stars-=n;document.getElementById('starcount').textContent=stars;try{_ls.setItem('bp_stars',String(stars));}catch(e){}updateShopBtns();return true;}

function updateShopBtns(){
  var bU=document.getElementById('btn-undo'),bS=document.getElementById('btn-shuffle'),bR=document.getElementById('btn-rotate'),bH=document.getElementById('btn-hold2'),bB=document.getElementById('btn-blast');
  if(!bU.classList.contains('locked'))bU.disabled=stars<3||!lastState;
  if(!bS.classList.contains('locked'))bS.disabled=stars<2||pieces.every(function(p){return p===null;});
  if(!bR.classList.contains('locked')){bR.disabled=stars<1||pieces.every(function(p){return p===null;});if(rotateMode){bR.classList.add('active');bR.querySelector('.sl').textContent='Rotating';bR.querySelector('.sc2').textContent='tap=rotate';}else{bR.classList.remove('active');bR.querySelector('.sl').textContent='Rotate';bR.querySelector('.sc2').textContent='1⭐';}}
  if(!bH.classList.contains('locked')){if(extraHold){bH.disabled=true;bH.classList.add('active2');bH.querySelector('.sl').textContent='+Hold✓';bH.querySelector('.sc2').textContent='Active';}else{bH.disabled=stars<4;bH.classList.remove('active2');bH.querySelector('.sl').textContent='+Hold';bH.querySelector('.sc2').textContent='4⭐';}}
  if(bB&&!bB.classList.contains('locked')){bB.disabled=stars<5;if(blastMode){bB.classList.add('active-blast');bB.querySelector('.sl').textContent='Blasting';bB.querySelector('.sc2').textContent='tap board';}else{bB.classList.remove('active-blast');bB.querySelector('.sl').textContent='Blast';bB.querySelector('.sc2').textContent='5⭐';}}
}

function saveState(){
  var state={grid:grid.map(function(r){return r.slice();}),pieces:pieces.slice(),held:held,held2:held2,score:score,combo:combo,totalLines:totalLines};
  if(advMode){
    state.advColorGrid=advColorGrid.map(function(r){return r.slice();});
    state.advIceGrid=advIceGrid.map(function(r){return r.slice();});
    state.advBlockGrid=advBlockGrid.map(function(r){return r.slice();});
    state.advObjProgress=JSON.parse(JSON.stringify(advObjProgress));
  }
  lastState=state;
  updateShopBtns();
}
function shopUndo(){
  if(blastMode)cancelBlast();questUndoUsed=true;
  if(rotateMode){cancelRotate();return;}
  if(!lastState||stars<3)return;
  spendStars(3);
  grid=lastState.grid.map(function(r){return r.slice();});
  pieces=lastState.pieces.slice();
  held=lastState.held;held2=lastState.held2;
  score=lastState.score;combo=lastState.combo;totalLines=lastState.totalLines;
  document.getElementById('scd').textContent=score;
  // Restore adv grids
  if(advMode&&lastState.advColorGrid){
    advColorGrid=lastState.advColorGrid.map(function(r){return r.slice();});
    advIceGrid=lastState.advIceGrid.map(function(r){return r.slice();});
    advBlockGrid=lastState.advBlockGrid.map(function(r){return r.slice();});
    advObjProgress=JSON.parse(JSON.stringify(lastState.advObjProgress));
  }
  lastState=null;rotatedSlots={};
  syncBoard(); // also calls renderAdvCellStyles via hook
  renderTray();updateShopBtns();hideToast();
  checkState(pieces.slice(),held,held2);
}
function shopShuffle(){if(blastMode)cancelBlast();updateQuestProgress('powerup',1);if(rotateMode){cancelRotate();return;}if(stars<2||pieces.every(function(p){return p===null;}))return;spendStars(2);rotatedSlots={};for(var i=0;i<3;i++)if(pieces[i]!==null)pieces[i]=rnd();renderTray();checkState(pieces.slice(),held,held2);}
function shopRotate(){if(blastMode)cancelBlast();if(rotateMode){cancelRotate();return;}if(stars<1||pieces.every(function(p){return p===null;}))return;rotateMode=true;updateShopBtns();setRotateHandlers();showToast('🔄 Tap any piece to rotate (even locked) · 1⭐ on placement','info');}
function cancelRotate(){rotateMode=false;rotatedSlots={};updateShopBtns();hideToast();renderTray();}
function shopHold2(){if(blastMode)cancelBlast();if(rotateMode)cancelRotate();if(extraHold||stars<4)return;spendStars(4);extraHold=true;renderTray();updateShopBtns();}

var blastMode=false,blastDir='row'; // 'row' or 'col'
var blastHighlight=[];

function shopBlast(){
  if(blastMode){cancelBlast();return;}
  if(stars<5)return;
  if(rotateMode)cancelRotate();
  blastMode=true;blastDir='row';
  updateQuestProgress('powerup',1);
  updateShopBtns();
  document.getElementById('blast-bar').classList.add('show');
  document.getElementById('blast-row-btn').classList.add('sel');
  document.getElementById('blast-col-btn').classList.remove('sel');
  showToast('💥 Blast: drag across a row ↔ or column ↕ to destroy it','info');
  attachBlastHandlers();
}
function cancelBlast(){
  blastMode=false;
  clearBlastHighlight();
  document.getElementById('blast-bar').classList.remove('show');
  updateShopBtns();hideToast();
  detachBlastHandlers();
}
function clearBlastHighlight(){
  for(var i=0;i<blastHighlight.length;i++){var el=blastHighlight[i];if(el){el.classList.remove('blast-row','blast-col','blast-cross');}}
  blastHighlight=[];
}
function highlightBlastLine(idx){
  clearBlastHighlight();
  if(blastDir==='row'){
    for(var c=0;c<COLS;c++){var el=cellEl(idx,c);if(el){el.classList.add('blast-row');blastHighlight.push(el);}}
  } else {
    for(var r=0;r<ROWS;r++){var el=cellEl(r,idx);if(el){el.classList.add('blast-col');blastHighlight.push(el);}}
  }
}
function doBlast(idx){
  if(!spendStars(5))return;
  cancelHint();
  // Flash the line
  if(blastDir==='row'){
    for(var c=0;c<COLS;c++){var el=cellEl(idx,c);if(el)el.classList.add('flash');}
  } else {
    for(var r=0;r<ROWS;r++){var el=cellEl(r,idx);if(el)el.classList.add('flash');}
  }
  SFX.clear();
  setTimeout(function(){
    var blastRows=blastDir==='row'?[idx]:[];
    var blastCols=blastDir==='col'?[idx]:[];
    // Track ice stages before zeroing
    if(advMode)advTrackIce(blastRows,blastCols);
    // Track clear_blocks objectives before zeroing
    if(advMode)advTrackClearBlocks(blastRows,blastCols);
    // Zero the blasted row/col — skip still-iced cells
    if(blastDir==='row'){
      for(var c=0;c<COLS;c++){
        if(advMode&&advIceGrid[idx]&&advIceGrid[idx][c]>=1)continue;
        grid[idx][c]=0;
        if(advMode&&advColorGrid[idx])advColorGrid[idx][c]=0;
        if(advMode&&advBlockGrid[idx])advBlockGrid[idx][c]=0;
      }
    } else {
      for(var r=0;r<ROWS;r++){
        if(advMode&&advIceGrid[r]&&advIceGrid[r][idx]>=1)continue;
        grid[r][idx]=0;
        if(advMode&&advColorGrid[r])advColorGrid[r][idx]=0;
        if(advMode&&advBlockGrid[r])advBlockGrid[r][idx]=0;
      }
    }
    syncBoard();
    clearLines(function(pts){
      updateScore(pts+50);
      checkState(pieces.slice(),held,held2);
    });
  },220);
  cancelBlast();
}

// Board touch/mouse handlers for blast mode
var _blastMove=null,_blastUp=null,_blastTMove=null,_blastTUp=null,_blastTStart=null;
function attachBlastHandlers(){
  var board=document.getElementById('board');
  var _blastStartX=0,_blastStartY=0,_blastStarted=false,_blastCurrentIdx=-1;

  function getBoardPos(cx,cy){
    var rect=board.getBoundingClientRect();
    var col=Math.max(0,Math.min(COLS-1,Math.floor((cx-rect.left)/(rect.width/COLS))));
    var row=Math.max(0,Math.min(ROWS-1,Math.floor((cy-rect.top)/(rect.height/ROWS))));
    return{row:row,col:col};
  }

  // Mouse support
  _blastMove=function(e){
    if(!blastMode)return;
    var p=getBoardPos(e.clientX,e.clientY);
    var idx=blastDir==='row'?p.row:p.col;
    if(idx!==_blastCurrentIdx){_blastCurrentIdx=idx;highlightBlastLine(idx);}
  };
  _blastUp=function(e){
    if(!blastMode)return;
    var p=getBoardPos(e.clientX,e.clientY);
    doBlast(blastDir==='row'?p.row:p.col);
  };

  // Touch: drag to preview, auto-detect direction, lift to blast
  _blastTMove=function(e){
    if(!blastMode)return;e.preventDefault();
    var t=e.touches[0];
    var dx=Math.abs(t.clientX-_blastStartX),dy=Math.abs(t.clientY-_blastStartY);
    // Auto-detect direction after 8px movement
    if(!_blastStarted&&(dx>8||dy>8)){
      _blastStarted=true;
      blastDir=dx>dy?'row':'col'; // more horizontal = row, more vertical = col
      // Update bar UI
      document.getElementById('blast-row-btn').classList.toggle('sel',blastDir==='row');
      document.getElementById('blast-col-btn').classList.toggle('sel',blastDir==='col');
    }
    if(_blastStarted){
      var p=getBoardPos(t.clientX,t.clientY);
      var idx=blastDir==='row'?p.row:p.col;
      if(idx!==_blastCurrentIdx){_blastCurrentIdx=idx;highlightBlastLine(idx);}
    }
  };
  _blastTUp=function(e){
    if(!blastMode)return;
    if(_blastStarted&&_blastCurrentIdx>=0){
      doBlast(_blastCurrentIdx);
    } else {
      // Short tap — use current highlighted row/col or centre
      var t=e.changedTouches[0];
      var p=getBoardPos(t.clientX,t.clientY);
      doBlast(blastDir==='row'?p.row:p.col);
    }
    _blastStarted=false;_blastCurrentIdx=-1;
  };
  // Touchstart to record start position
  _blastTStart=function(e){
    if(!blastMode)return;e.preventDefault();
    var t=e.touches[0];_blastStartX=t.clientX;_blastStartY=t.clientY;
    _blastStarted=false;_blastCurrentIdx=-1;
    // Pre-highlight the touched row/col based on current blastDir
    var p=getBoardPos(t.clientX,t.clientY);
    var idx=blastDir==='row'?p.row:p.col;
    _blastCurrentIdx=idx;highlightBlastLine(idx);
  };
  board.addEventListener('mousemove',_blastMove);
  board.addEventListener('mouseup',_blastUp);
  board.addEventListener('touchstart',_blastTStart,{passive:false});
  board.addEventListener('touchmove',_blastTMove,{passive:false});
  board.addEventListener('touchend',_blastTUp);
}
function detachBlastHandlers(){
  var board=document.getElementById('board');
  if(_blastMove)board.removeEventListener('mousemove',_blastMove);
  if(_blastUp)board.removeEventListener('mouseup',_blastUp);
  if(_blastTStart)board.removeEventListener('touchstart',_blastTStart);
  if(_blastTMove)board.removeEventListener('touchmove',_blastTMove);
  if(_blastTUp)board.removeEventListener('touchend',_blastTUp);
  _blastMove=_blastUp=_blastTMove=_blastTUp=null;
}

document.getElementById('btn-blast').addEventListener('click',shopBlast);
document.getElementById('blast-row-btn').addEventListener('click',function(){
  blastDir='row';
  this.classList.add('sel');document.getElementById('blast-col-btn').classList.remove('sel');
  clearBlastHighlight();
});
document.getElementById('blast-col-btn').addEventListener('click',function(){
  blastDir='col';
  this.classList.add('sel');document.getElementById('blast-row-btn').classList.remove('sel');
  clearBlastHighlight();
});
document.getElementById('blast-cancel').addEventListener('click',cancelBlast);
function setRotateHandlers(){
  for(var i=0;i<3;i++){
    var slot=document.getElementById('p'+i);if(!slot||!pieces[i])continue;
    slot.style.pointerEvents='auto';slot.classList.add('rot-ready');
    slot.onmousedown=null;slot.ontouchstart=null;slot.onclick=null;slot.ontouchend=null;slot.onmouseup=null;
    (function(idx,sl){
      sl.onmousedown=function(e){
        e.preventDefault();touchMoved=false;touchStartX=e.clientX;touchStartY=e.clientY;
        function onMove(ev){if(!touchMoved&&(Math.abs(ev.clientX-touchStartX)>5||Math.abs(ev.clientY-touchStartY)>5)){touchMoved=true;document.removeEventListener('mousemove',onMove);beginDragFromRotate(ev,idx);}}
        document.addEventListener('mousemove',onMove);
        sl.onmouseup=function(ev){document.removeEventListener('mousemove',onMove);sl.onmouseup=null;if(!touchMoved)doRotatePiece(idx);};
      };
      sl.ontouchstart=function(e){
        e.preventDefault();touchMoved=false;touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;
        function onTMove(ev){ev.preventDefault();var t=ev.touches[0];if(!touchMoved&&(Math.abs(t.clientX-touchStartX)>5||Math.abs(t.clientY-touchStartY)>5)){touchMoved=true;dragging=true;dragPiece=pieces[idx];dragSlot=idx;dragFromHold=false;dragFromHold2=false;spawnDragEl(touchStartX,touchStartY);cancelHint();}if(touchMoved&&dragEl){moveDragEl(t.clientX,t.clientY);showGhost(t.clientX,t.clientY);}}
        function onTEnd(ev){document.removeEventListener('touchmove',onTMove);document.removeEventListener('touchend',onTEnd);if(!touchMoved){doRotatePiece(idx);}else if(dragEl){endDrag(ev.changedTouches[0].clientX,ev.changedTouches[0].clientY);}else{dragPiece=null;dragSlot=null;dragging=false;}}
        document.addEventListener('touchmove',onTMove,{passive:false});document.addEventListener('touchend',onTEnd);
      };
    })(i,slot);
  }
}
function beginDragFromRotate(e,idx){var piece=pieces[idx];if(!piece)return;cancelHint();dragging=true;dragSlot=idx;dragFromHold=false;dragFromHold2=false;dragPiece=piece;spawnDragEl(e.clientX,e.clientY);document.addEventListener('mousemove',onMv);document.addEventListener('mouseup',onUp);}
function doRotatePiece(idx){if(!pieces[idx])return;pieces[idx]=rotateCW(trimShape(pieces[idx]));rotatedSlots[idx]=true;renderSlot(idx);var slot=document.getElementById('p'+idx);if(slot)slot.style.pointerEvents='auto';if(rotateMode)setRotateHandlers();}

function showToast(msg,type){clearTimeout(toastTimer);var t=document.getElementById('toast');t.textContent=msg;t.className='show '+(type||'err');toastTimer=setTimeout(function(){t.className='';},4000);}
function hideToast(){clearTimeout(toastTimer);document.getElementById('toast').className='';}
function mkGrid(sh,W,H,ht){var cs=fitCs(sh,W,H),pg=document.createElement('div');pg.className='pgrid';pg.style.gridTemplateColumns='repeat('+sh[0].length+','+cs+'px)';pg.style.gridTemplateRows='repeat('+sh.length+','+cs+'px)';pg.style.gap='2px';for(var r=0;r<sh.length;r++)for(var c=0;c<sh[r].length;c++){var d=document.createElement('div');d.style.width=d.style.height=cs+'px';var v=sh[r][c];if(v){var cls='pc'+(ht===2?' hd2':ht===1?' hd':'');if(v===2)cls+=' adv-colored';d.className=cls;}else{d.style.background='transparent';d.style.border='none';}pg.appendChild(d);}return pg;}
function mkDragGrid(sh,ht){var cs=boardCs()+2,pg=document.createElement('div');pg.className='pgrid';pg.style.gridTemplateColumns='repeat('+sh[0].length+','+cs+'px)';pg.style.gridTemplateRows='repeat('+sh.length+','+cs+'px)';pg.style.gap='2px';for(var r=0;r<sh.length;r++)for(var c=0;c<sh[r].length;c++){var d=document.createElement('div');d.style.width=d.style.height=cs+'px';var v=sh[r][c];if(v){var cls='pc'+(ht===2?' hd2':ht===1?' hd':'');if(v===2)cls+=' adv-colored';d.className=cls;}else{d.style.background='transparent';d.style.border='none';}pg.appendChild(d);}return pg;}

function clearLines(onDone){
  if(advInitializing){if(onDone)onDone(0);return;}
  var rows=[],cols=[];
  for(var r=0;r<ROWS;r++)if(grid[r].every(function(v){return v;}))rows.push(r);
  for(var c=0;c<COLS;c++)if(grid.every(function(row){return row[c];}))cols.push(c);
  if(!rows.length&&!cols.length){combo=0;if(onDone)onDone(0);return;}

  // Reduce ice stages FIRST — before any animation or zeroing
  // Iced cells that still have stage>0 after reduction stay on board
  if(advMode)advTrackIce(rows,cols);

  combo++;totalLines+=rows.length+cols.length;
  var n=rows.length+cols.length;
  var base=n===1?100:n===2?300:500*(n-1);
  var pts=base+(combo>1?Math.floor(base*0.25*(combo-1)):0);
  addGems(n*5+(n>1?(n-1)*3:0)+(combo>1?(combo-1)*3:0));
  updateQuestProgress('lines',n);
  updateQuestProgress('combo',combo);
  advTrackLines(n);
  advTrackCombo(combo);
  if(combo>1){showComboSplash(combo);}else{SFX.clear();}
  try{var tl=parseInt(_ls.getItem('bp_tot_lines')||'0')||0;_ls.setItem('bp_tot_lines',String(tl+n));var bc=parseInt(_ls.getItem('bp_best_combo')||'0')||0;if(combo>bc)_ls.setItem('bp_best_combo',String(combo));}catch(e){}

  // Screen flash
  if(n>=2){
    var cf=document.getElementById('clear-flash');
    if(cf){cf.style.background=n>=4?'rgba(240,200,50,.35)':' rgba(124,92,191,.25)';cf.classList.remove('pop');void cf.offsetWidth;cf.classList.add('pop');}
  }

  // Build animation list — skip iced cells (they stay on board, just lose a stage)
  var cells=[];
  var STAGGER=18;
  rows.forEach(function(r){
    for(var c=0;c<COLS;c++){
      if(advMode&&advIceGrid[r]&&advIceGrid[r][c]>=1)continue; // still iced — skip
      var el=cellEl(r,c);
      if(el&&grid[r][c])cells.push({el:el,dist:Math.abs(c-4.5)});
    }
  });
  cols.forEach(function(c){
    for(var r=0;r<ROWS;r++){
      if(advMode&&advIceGrid[r]&&advIceGrid[r][c]>=1)continue;
      var el=cellEl(r,c);
      if(el&&grid[r][c]&&!cells.find(function(x){return x.el===el;})){
        cells.push({el:el,dist:Math.abs(r-4.5)});
      }
    }
  });

  // Blast animation on clearable cells
  cells.forEach(function(item){
    var delay=Math.round(item.dist)*STAGGER;
    setTimeout(function(){
      item.el.classList.remove('flash');
      item.el.classList.add('blast-out');
    },delay);
  });

  spawnParticles(n);

  var totalAnim=Math.round(4.5)*STAGGER+320+60;
  setTimeout(function(){
    // Count cleared blocks (excluding iced cells — they already reduced stage above)
    if(advMode)advTrackClearBlocks(rows,cols);

    // Zero cleared cells — skip any that still have ice
    rows.forEach(function(r){
      for(var cc=0;cc<COLS;cc++){
        if(advMode&&advIceGrid[r]&&advIceGrid[r][cc]>=1)continue;
        grid[r][cc]=0;
        if(advMode&&advColorGrid[r])advColorGrid[r][cc]=0;
        if(advMode&&advBlockGrid[r])advBlockGrid[r][cc]=0;
      }
    });
    cols.forEach(function(cl){
      for(var rr=0;rr<ROWS;rr++){
        if(advMode&&advIceGrid[rr]&&advIceGrid[rr][cl]>=1)continue;
        grid[rr][cl]=0;
        if(advMode&&advColorGrid[rr])advColorGrid[rr][cl]=0;
        if(advMode&&advBlockGrid[rr])advBlockGrid[rr][cl]=0;
      }
    });

    syncBoard(); // redraws board — iced cells re-render with new stage
    if(onDone)onDone(pts);
  },totalAnim);
}

function clearHint(){for(var i=0;i<hintCells.length;i++){var h=hintCells[i];resetCell(h.r,h.c);}hintCells=[];}
function scheduleHint(){clearTimeout(hintTimer);clearHint();hintTimer=setTimeout(showHint,5000);}
function cancelHint(){clearTimeout(hintTimer);hintTimer=null;clearHint();}
function showHint(){clearHint();var cands=pieces.filter(function(p){return p;});if(held)cands.push(held);if(held2)cands.push(held2);for(var i=0;i<cands.length;i++){var pos=findPlacement(cands[i]);if(pos){for(var r=0;r<pos.shape.length;r++)for(var c=0;c<pos.shape[r].length;c++){if(!pos.shape[r][c])continue;var el=cellEl(pos.sr+r,pos.sc+c);if(el){el.classList.add('hint');hintCells.push({r:pos.sr+r,c:pos.sc+c});}}return;}}}
function tryAutoStore(pArr,h,h2){if(autoStoreGuard)return false;var rem=[];for(var i=0;i<pArr.length;i++)if(pArr[i])rem.push({p:pArr[i],i:i});if(rem.length!==1)return false;var canStore=(h===null)||(extraHold&&h2===null);if(!canStore||canPlaceAnywhere(rem[0].p))return false;autoStoreGuard=true;if(h===null)held=rem[0].p;else held2=rem[0].p;pieces[rem[0].i]=null;pieces=[rndWithColor(0),rndWithColor(1),rndWithColor(2)];rotatedSlots={};advColoredPieces=[null,null,null];renderTray();autoStoreGuard=false;checkState(pieces.slice(),held,held2);return true;}

function updatePlacability(){
  document.getElementById('tray').style.gridTemplateColumns='repeat(4,1fr)';
  for(var i=0;i<3;i++){var slot=document.getElementById('p'+i);if(!slot)continue;slot.onclick=null;slot.ontouchend=null;slot.onmouseup=null;if(!pieces[i]){slot.className='ts ps used';slot.style.pointerEvents='none';slot.onmousedown=null;slot.ontouchstart=null;continue;}var ok=canPlaceAnywhere(pieces[i]);slot.className='ts ps'+(ok?'':' blk')+(rotatedSlots[i]?' rotated':'');slot.style.pointerEvents=ok?'auto':'none';slot.onmousedown=ok?(function(idx){return function(e){beginDrag(e,idx,false,false);};})(i):null;slot.ontouchstart=ok?(function(idx){return function(e){beginTouch(e,idx,false,false);};})(i):null;}
  var hs=document.getElementById('hs');if(hs){hs.classList.remove('blk');if(held){var ok1=canPlaceAnywhere(held);if(!ok1)hs.classList.add('blk');hs.style.pointerEvents=ok1?'auto':'none';hs.onmousedown=ok1?function(e){beginDrag(e,null,true,false);}:null;hs.ontouchstart=ok1?function(e){beginTouch(e,null,true,false);}:null;}else{hs.style.pointerEvents='auto';hs.onmousedown=null;hs.ontouchstart=null;}}
  var hs2=document.getElementById('hs2');if(extraHold&&hs2){hs2.classList.remove('blk');if(held2){var ok2=canPlaceAnywhere(held2);if(!ok2)hs2.classList.add('blk');hs2.style.pointerEvents=ok2?'auto':'none';hs2.onmousedown=ok2?function(e){beginDrag(e,null,false,true);}:null;hs2.ontouchstart=ok2?function(e){beginTouch(e,null,false,true);}:null;}else{hs2.style.pointerEvents='auto';hs2.onmousedown=null;hs2.ontouchstart=null;}}
}

function getSaveOptions(pArr){
  var opts=[];
  if(lastState&&stars>=3&&sessionUnlocks.undo)opts.push({type:'undo',label:'↩ Undo last move',cost:'3⭐',cls:'undo-btn'});
  if(stars>=2&&!pArr.every(function(p){return p===null;})&&sessionUnlocks.shuffle)opts.push({type:'shuffle',label:'🔀 Shuffle pieces',cost:'2⭐',cls:'shuffle-btn'});
  if(stars>=1&&sessionUnlocks.rotate){var ok=false;for(var i=0;i<pArr.length;i++){if(!pArr[i])continue;var s=trimShape(pArr[i]);for(var rot=0;rot<4;rot++){s=rotateCW(s);if(canPlaceAnywhere(s)){ok=true;break;}}if(ok)break;}if(ok)opts.push({type:'rotate',label:'🔄 Rotate a piece',cost:'1⭐',cls:'rotate-btn'});}
  return opts;
}
function showSavePrompt(pArr){
  var opts=getSaveOptions(pArr);if(opts.length===0){triggerGameOver();return;}
  var c=document.getElementById('save-options');c.innerHTML='';
  opts.forEach(function(opt){var btn=document.createElement('button');btn.className='save-btn '+opt.cls;btn.innerHTML='<span>'+opt.label+'</span><span class="sb-cost">'+opt.cost+'</span>';(function(o){btn.addEventListener('click',function(){hideSavePrompt();if(o.type==='undo')shopUndo();else if(o.type==='shuffle')shopShuffle();else if(o.type==='rotate'){rotateMode=true;updateShopBtns();setRotateHandlers();showToast('🔄 Tap any piece to rotate — even locked!','info');}});})(opt);c.appendChild(btn);});
  document.getElementById('save-prompt').classList.add('show');
}
function hideSavePrompt(){document.getElementById('save-prompt').classList.remove('show');}
function triggerGameOver(){
  if(advMode&&!advLevelComplete){showAdvFailed();return;}
  hideSavePrompt();
  // Challenge game over mid-challenge — just end it with current score
  if(isChallenge){finishChallenge();return;}
  document.getElementById('gsc').textContent=score;document.getElementById('gbc').textContent=best;
  document.getElementById('glc').textContent=totalLines;document.getElementById('gst').textContent='+'+starsGame+'⭐';
  document.getElementById('go').classList.add('show');
  document.getElementById('w').classList.add('game-over');
}
function checkState(pArr,h,h2){if(tryAutoStore(pArr,h,h2))return;var rem=pArr.filter(function(p){return p;});updatePlacability();updateShopBtns();if(rem.some(function(p){return canPlaceAnywhere(p);})){if(!rotateMode)hideToast();scheduleHint();return;}if(h&&canPlaceAnywhere(h)){if(!rotateMode)hideToast();scheduleHint();return;}if(h2&&canPlaceAnywhere(h2)){if(!rotateMode)hideToast();scheduleHint();return;}cancelHint();showSavePrompt(pArr);}

function initGame(){
  hideSavePrompt();
  if(typeof blastMode!=='undefined'&&blastMode)cancelBlast();
  grid=[];for(var r=0;r<ROWS;r++){grid.push([]);for(var c=0;c<COLS;c++)grid[r].push(0);}
  score=0;totalLines=0;combo=0;starsGame=0;lastState=null;extraHold=false;held=null;held2=null;rotateMode=false;rotatedSlots={};
  newBestThisGame=false;
  milestonesHit={};
  questUndoUsed=false;
  document.getElementById('scd').textContent=0;document.getElementById('go').classList.remove('show');document.getElementById('w').classList.remove('game-over');
  var b=document.getElementById('board');b.innerHTML='';
  for(var i=0;i<ROWS*COLS;i++){var d=document.createElement('div');d.className='cell';b.appendChild(d);}
  dragging=false;dragPiece=null;ghostCells=[];snapPos=null;pieces=[rnd(),rnd(),rnd()];
  cancelHint();autoStoreGuard=false;hideToast();renderTray();updateShopBtns();updateUnlockProgress();
  try{var g=parseInt(_ls.getItem('bp_games')||'0')||0;_ls.setItem('bp_games',String(g+1));if(g===0)grantWelcomeTrophy();}catch(e){}
  checkState(pieces.slice(),held,held2);
  updateObjBar();
}
function updateScore(n){
  score+=n;document.getElementById('scd').textContent=score;
  if(score>best){
    best=score;
    try{_ls.setItem('bp_best',String(best));}catch(e){}
    // Flash new record only once per game
    if(!newBestThisGame){
      newBestThisGame=true;
      var flash=document.getElementById('new-record-flash');
      var val=document.getElementById('new-record-val');
      if(flash&&val){
        val.textContent=score.toLocaleString();
        flash.classList.remove('pop');
        void flash.offsetWidth;
        flash.classList.add('pop');
        spawnParticles(12); // celebrate the record!
      }
    }
  }
  var bv=document.getElementById('best-val');
  if(bv)bv.textContent=best.toLocaleString();
  document.getElementById('gbc').textContent=best;
  checkMilestones();
  updateQuestProgress('score',score);
  advTrackScore(score);
  checkAchievements();
}

function renderTray(){var tray=document.getElementById('tray');tray.innerHTML='';tray.style.gridTemplateColumns='repeat(4,1fr)';var hs1=document.createElement('div');hs1.id='hs';hs1.className='ts hs';hs1.innerHTML='<div class="hl2">HOLD</div><div id="hi"></div>';tray.appendChild(hs1);for(var i=0;i<3;i++){var ps=document.createElement('div');ps.id='p'+i;ps.className='ts ps';tray.appendChild(ps);}renderHold();for(var j=0;j<3;j++)renderSlot(j);var eh=document.getElementById('eh-row');if(eh)eh.remove();if(extraHold){var row=document.createElement('div');row.id='eh-row';row.style.cssText='width:100%;display:flex;justify-content:flex-start;padding:0 0 4px 0;';var hs2=document.createElement('div');hs2.id='hs2';hs2.className='ts hs2';hs2.style.cssText='width:calc(25% - 5px);height:88px;';hs2.innerHTML='<div class="hl2p">HOLD 2</div><div id="hi2"></div>';row.appendChild(hs2);tray.insertAdjacentElement('afterend',row);}renderHold2();if(rotateMode)setRotateHandlers();else updatePlacability();}
function renderHold(){var s=document.getElementById('hs'),inn=document.getElementById('hi');if(!s||!inn)return;inn.innerHTML='';s.classList.remove('full','blk');s.onmousedown=null;s.ontouchstart=null;if(held){s.classList.add('full');inn.appendChild(mkGrid(held,slotW('hs'),slotInnerH('hs'),1));}}
function renderHold2(){var s=document.getElementById('hs2'),inn=document.getElementById('hi2');if(!s||!inn)return;inn.innerHTML='';s.classList.remove('full','blk');s.onmousedown=null;s.ontouchstart=null;if(held2){s.classList.add('full');inn.appendChild(mkGrid(held2,slotW('hs2')||52,slotInnerH('hs2'),2));}}
function renderSlot(i){var s=document.getElementById('p'+i);if(!s)return;s.innerHTML='';if(!pieces[i]){s.className='ts ps used';s.style.pointerEvents='none';s.onmousedown=null;s.ontouchstart=null;return;}var ok=canPlaceAnywhere(pieces[i]);var wasRotated=!!rotatedSlots[i];s.className='ts ps'+(ok?'':' blk')+(wasRotated?' rotated':'');s.style.pointerEvents=rotateMode?'auto':(ok?'auto':'none');s.onmousedown=null;s.ontouchstart=null;if(!rotateMode&&ok){s.onmousedown=(function(idx){return function(e){beginDrag(e,idx,false,false);};})(i);s.ontouchstart=(function(idx){return function(e){beginTouch(e,idx,false,false);};})(i);}s.appendChild(mkGrid(pieces[i],slotW('p'+i),slotInnerH('p'+i),0));}

function beginDrag(e,idx,fh,fh2){if(blastMode)return;var piece=fh2?held2:fh?held:pieces[idx];if(!piece)return;e.preventDefault();cancelHint();dragging=true;dragSlot=idx;dragFromHold=fh;dragFromHold2=fh2;dragPiece=piece;spawnDragEl(e.clientX,e.clientY);document.addEventListener('mousemove',onMv);document.addEventListener('mouseup',onUp);}
function beginTouch(e,idx,fh,fh2){if(blastMode)return;var piece=fh2?held2:fh?held:pieces[idx];if(!piece)return;e.preventDefault();cancelHint();dragging=true;dragSlot=idx;dragFromHold=fh;dragFromHold2=fh2;dragPiece=piece;var t=e.touches[0];spawnDragEl(t.clientX,t.clientY);document.addEventListener('touchmove',onMvT,{passive:false});document.addEventListener('touchend',onUpT);}
function spawnDragEl(cx,cy){
  dragOriginX=cx;dragOriginY=cy;
  if(_ghostRafId){cancelAnimationFrame(_ghostRafId);_ghostRafId=null;}
  dragEl=document.createElement('div');
  dragEl.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:9999;opacity:0.92;will-change:transform;';
  dragEl.appendChild(mkDragGrid(dragPiece,dragFromHold2?2:dragFromHold?1:0));
  document.body.appendChild(dragEl);
  moveDragEl(cx,cy);
}
// Convert raw finger position to amplified piece position
function ampX(cx){return dragOriginX+(cx-dragOriginX)*DRAG_SPEED;}
function ampY(cy){return dragOriginY+(cy-dragOriginY)*DRAG_SPEED;}
function onMv(e){
  moveDragEl(e.clientX,e.clientY);
  _pendingGhostX=ampX(e.clientX);_pendingGhostY=ampY(e.clientY);
  if(!_ghostRafId)_ghostRafId=requestAnimationFrame(_flushGhost);
}
function onMvT(e){
  e.preventDefault();var t=e.touches[0];
  moveDragEl(t.clientX,t.clientY);
  _pendingGhostX=ampX(t.clientX);_pendingGhostY=ampY(t.clientY);
  if(!_ghostRafId)_ghostRafId=requestAnimationFrame(_flushGhost);
}
function _flushGhost(){_ghostRafId=null;showGhost(_pendingGhostX,_pendingGhostY);}
function onUp(e){if(_ghostRafId){cancelAnimationFrame(_ghostRafId);_ghostRafId=null;}endDrag(ampX(e.clientX),ampY(e.clientY));document.removeEventListener('mousemove',onMv);document.removeEventListener('mouseup',onUp);}
function onUpT(e){if(_ghostRafId){cancelAnimationFrame(_ghostRafId);_ghostRafId=null;}var t=e.changedTouches[0];endDrag(ampX(t.clientX),ampY(t.clientY));document.removeEventListener('touchmove',onMvT);document.removeEventListener('touchend',onUpT);}
function advCellClass(r,c){
  if(!advMode)return '';
  if(advColorGrid[r]&&advColorGrid[r][c])return ' adv-block';
  if(advIceGrid[r]&&advIceGrid[r][c]>=1)return ' ice-'+advIceGrid[r][c];
  return '';
}
function showGhost(cx,cy){
  if(!dragging||!dragPiece)return;
  clearGhost();
  // Use drag element center for hold box detection (not amplified finger pos)
  var dcx=cx,dcy=cy;
  if(dragEl){var dr=dragEl.getBoundingClientRect();dcx=dr.left+dr.width/2;dcy=dr.top+dr.height/2;}
  if(!dragFromHold&&!dragFromHold2){
    var hr=document.getElementById('hs').getBoundingClientRect();
    if(dcx>=hr.left&&dcx<=hr.right&&dcy>=hr.top&&dcy<=hr.bottom){
      if(!holdHov){holdHov=true;document.getElementById('hs').classList.add('hover');}return;
    }
  }
  if(holdHov){holdHov=false;document.getElementById('hs').classList.remove('hover');}
  if(extraHold&&!dragFromHold&&!dragFromHold2){
    var hs2el=document.getElementById('hs2');
    if(hs2el){
      var hr2=hs2el.getBoundingClientRect();
      if(dcx>=hr2.left&&dcx<=hr2.right&&dcy>=hr2.top&&dcy<=hr2.bottom){
        if(!holdHov2){holdHov2=true;hs2el.classList.add('hover');}return;
      }
    }
  }
  if(holdHov2){holdHov2=false;var s2=document.getElementById('hs2');if(s2)s2.classList.remove('hover');}
  var shape=trimShape(dragPiece);
  if(overBoard(cx,cy)){
    var snap=findSnapPos(cx,cy);
    if(snap){snapPos=snap;for(var r=0;r<shape.length;r++)for(var c=0;c<shape[r].length;c++){if(!shape[r][c])continue;var el=cellEl(snap.r+r,snap.c+c);if(el){el.className='cell snap'+advCellClass(snap.r+r,snap.c+c);ghostCells.push({r:snap.r+r,c:snap.c+c});}}return;}
  }
  snapPos=null;var dp=dropPos(cx,cy),sr=dp.row-Math.floor(shape.length/2),sc=dp.col-Math.floor(shape[0].length/2);
  for(var r=0;r<shape.length;r++)for(var c=0;c<shape[r].length;c++){if(!shape[r][c])continue;var el=cellEl(sr+r,sc+c);if(el){el.className='cell bad'+advCellClass(sr+r,sc+c);ghostCells.push({r:sr+r,c:sc+c});}}
}
function endDrag(cx,cy){dragging=false;var hsEl=document.getElementById('hs');if(hsEl)hsEl.classList.remove('hover');holdHov=false;var hs2El=document.getElementById('hs2');if(hs2El)hs2El.classList.remove('hover');holdHov2=false;
  // Save drag rect BEFORE removing dragEl — used by overHoldBox
  window._lastDragRect=dragEl?dragEl.getBoundingClientRect():null;
  if(dragEl){dragEl.remove();dragEl=null;}
  if(!dragPiece){clearGhost();dragPiece=null;dragSlot=null;dragFromHold=false;dragFromHold2=false;window._lastDragRect=null;return;}
  if(!dragFromHold&&!dragFromHold2&&overHoldBox('hs',cx,cy)){clearGhost();window._lastDragRect=null;var prev=held;held=dragPiece;if(dragSlot!==null)pieces[dragSlot]=prev;else held2=prev;dragPiece=null;dragSlot=null;dragFromHold=false;dragFromHold2=false;if(pieces.every(function(p){return p===null;}))pieces=[rnd(),rnd(),rnd()];renderTray();checkState(pieces.slice(),held,held2);return;}
  if(extraHold&&!dragFromHold&&!dragFromHold2&&overHoldBox('hs2',cx,cy)){clearGhost();window._lastDragRect=null;var prev2=held2;held2=dragPiece;if(dragSlot!==null)pieces[dragSlot]=prev2;else held=prev2;dragPiece=null;dragSlot=null;dragFromHold=false;dragFromHold2=false;if(pieces.every(function(p){return p===null;}))pieces=[rnd(),rnd(),rnd()];renderTray();checkState(pieces.slice(),held,held2);return;}window._lastDragRect=null;var shape=trimShape(dragPiece);var sr,sc;if(snapPos){sr=snapPos.r;sc=snapPos.c;}else{var dp=dropPos(cx,cy);sr=dp.row-Math.floor(shape.length/2);sc=dp.col-Math.floor(shape[0].length/2);}clearGhost();var wasFH=dragFromHold,wasFH2=dragFromHold2,wasSlot=dragSlot;dragPiece=null;dragSlot=null;dragFromHold=false;dragFromHold2=false;if(canPlace(shape,sr,sc)){if(wasSlot!==null&&rotatedSlots[wasSlot]){spendStars(1);delete rotatedSlots[wasSlot];}if(rotateMode){if(wasSlot!==null&&rotatedSlots[wasSlot]){rotateMode=false;updateShopBtns();hideToast();}else{setTimeout(setRotateHandlers,50);}}saveState();SFX.place();var cnt=doPlace(shape,sr,sc);for(var r=0;r<shape.length;r++)for(var c=0;c<shape[r].length;c++)if(shape[r][c])resetCell(sr+r,sc+c);var nextPieces,nextHeld,nextHeld2;if(wasFH2){nextHeld=held;nextHeld2=null;nextPieces=pieces.slice();}else if(wasFH){nextHeld=null;nextHeld2=held2;nextPieces=pieces.slice();}else{pieces[wasSlot]=null;if(pieces.every(function(p){return p===null;})){pieces=[rndWithColor(0),rndWithColor(1),rndWithColor(2)];rotatedSlots={};advColoredPieces=[null,null,null];}nextPieces=pieces.slice();nextHeld=held;nextHeld2=held2;}if(wasFH2){held2=null;renderHold2();}else if(wasFH){held=null;renderHold();}else{for(var i=0;i<3;i++)renderSlot(i);}clearLines(function(pts){updateScore(cnt*2+pts);checkState(nextPieces,nextHeld,nextHeld2);});}else{scheduleHint();}}

document.getElementById('btn-blast').addEventListener('click',shopBlast);
document.getElementById('blast-row-btn').addEventListener('click',function(){
  blastDir='row';this.classList.add('sel');document.getElementById('blast-col-btn').classList.remove('sel');clearBlastHighlight();
});
document.getElementById('blast-col-btn').addEventListener('click',function(){
  blastDir='col';this.classList.add('sel');document.getElementById('blast-row-btn').classList.remove('sel');clearBlastHighlight();
});
document.getElementById('blast-cancel').addEventListener('click',cancelBlast);

// ── New best flag — fires only once per game ──
var newBestThisGame=false;

// ── Unlock progress bar ──
function updateUnlockProgress(){
  var keys=['shuffle','undo','rotate','hold2','blast'];
  var nextKey=null,nextThresh=0;
  for(var i=0;i<keys.length;i++){
    var k=keys[i];
    if(!sessionUnlocks[k]){nextKey=k;nextThresh=UNLOCK_THRESHOLDS[k];break;}
  }
  var bar=document.getElementById('unlock-progress');
  if(!bar)return;
  if(!nextKey){bar.style.display='none';return;}
  bar.style.display='block';
  var fill=document.getElementById('unlock-progress-fill');
  var label=document.getElementById('unlock-progress-label');
  var names={shuffle:'Shuffle',undo:'Undo',rotate:'Rotate',hold2:'+Hold',blast:'Blast'};
  var icons={shuffle:'🔀',undo:'↩',rotate:'🔄',hold2:'＋',blast:'💥'};
  var prevThresh=0;
  for(var j=0;j<keys.length;j++){
    if(keys[j]===nextKey)break;
    prevThresh=UNLOCK_THRESHOLDS[keys[j]];
  }
  var range=nextThresh-prevThresh;
  var progress=Math.max(0,starsEverEarned-prevThresh);
  var pct=Math.min(100,Math.round(progress/range*100));
  fill.style.width=pct+'%';
  var remaining=nextThresh-starsEverEarned;
  label.textContent=icons[nextKey]+' '+names[nextKey]+' unlocks in '+Math.max(0,remaining)+'⭐';
}

// ── Milestone definitions ──
var SCORE_MILESTONES=[500,1000,2500,5000,10000,25000,50000];
var LINE_MILESTONES=[10,25,50,100,250,500];
var milestonesHit={};
function checkMilestones(){
  SCORE_MILESTONES.forEach(function(m){
    var key='score_'+m;
    if(!milestonesHit[key]&&score>=m){
      milestonesHit[key]=true;
      showAchToast('🎯','Score Milestone!',m.toLocaleString()+' points reached!');
      spawnParticles(8);
    }
  });
  LINE_MILESTONES.forEach(function(m){
    var key='lines_'+m;
    if(!milestonesHit[key]&&totalLines>=m){
      milestonesHit[key]=true;
      showAchToast('✨','Line Milestone!',m+' lines cleared this game!');
      spawnParticles(6);
    }
  });
}

// ══ QUEST FUNCTIONS ══
function getQuestKey(){var d=new Date();return 'bp_quests_'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function generateDailyQuests(){
  var d=new Date(),seed=(d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate())*73856093;
  var rng=new SeededRNG(seed),pool=QUEST_TEMPLATES.slice(),chosen=[];
  while(chosen.length<3&&pool.length>0){
    var idx=rng.int(pool.length),tmpl=pool.splice(idx,1)[0],ti=rng.int(tmpl.targets.length),tgt=tmpl.targets[ti];
    chosen.push({id:tmpl.id,icon:tmpl.icon,title:tmpl.title.replace('{n}',tgt),target:tgt,reward:tmpl.reward+ti*2,progress:0,done:false});
  }
  return chosen;
}
function loadTodayQuests(){
  try{var s=JSON.parse(_ls.getItem(getQuestKey())||'null');if(s&&s.length)return s;}catch(e){}
  var q=generateDailyQuests();try{_ls.setItem(getQuestKey(),JSON.stringify(q));}catch(e){}return q;
}
function saveTodayQuests(q){try{_ls.setItem(getQuestKey(),JSON.stringify(q));}catch(e){}}
function msToMidnight(){var n=new Date(),x=new Date(n);x.setHours(24,0,0,0);return x-n;}
function fmtCountdown(ms){return Math.floor(ms/3600000)+'h '+Math.floor((ms%3600000)/60000)+'m';}
function updateQuestProgress(type,value){
  if(_questBusy)return;
  var quests=loadTodayQuests(),changed=false,rewards=[];
  quests.forEach(function(q){
    if(q.done)return;
    var prev=q.progress;
    if(q.id==='score'&&type==='score')q.progress=Math.max(q.progress,value);
    else if(q.id==='lines'&&type==='lines')q.progress=Math.min(q.progress+value,q.target);
    else if(q.id==='pieces'&&type==='pieces')q.progress=Math.min(q.progress+value,q.target);
    else if(q.id==='combo'&&type==='combo')q.progress=Math.max(q.progress,value);
    else if(q.id==='stars'&&type==='stars')q.progress=Math.min(q.progress+value,q.target);
    else if(q.id==='powerup'&&type==='powerup')q.progress=1;
    else if(q.id==='challenge'&&type==='challenge')q.progress=1;
    else if(q.id==='noundo'&&type==='score'&&!questUndoUsed)q.progress=Math.max(q.progress,value);
    if(q.progress>=q.target&&!q.done){q.done=true;changed=true;rewards.push(q);}
    else if(q.progress!==prev)changed=true;
  });
  if(changed){saveTodayQuests(quests);updateQuestsBadge();}
  if(rewards.length){_questBusy=true;setTimeout(function(){_questBusy=false;rewards.forEach(function(q){earnStars(q.reward);showAchToast('📋','Quest Complete!',q.title+' +'+q.reward+'⭐');spawnParticles(8);SFX.achieve();});},50);}
}
function updateQuestsBadge(){
  var btn=document.getElementById('lb-quests-btn');if(!btn)return;
  var q=loadTodayQuests(),done=q.filter(function(x){return x.done;}).length;
  if(done>0&&done<q.length)btn.classList.add('has-quests');else btn.classList.remove('has-quests');
}
function renderQuestsModal(){
  var list=document.getElementById('quests-list');if(!list)return;
  list.innerHTML='';
  loadTodayQuests().forEach(function(q){
    var pct=Math.min(100,Math.round(q.progress/q.target*100));
    var card=document.createElement('div');
    card.className='quest-card'+(q.done?' done':'');
    card.innerHTML='<div class="q-header"><div class="q-icon">'+q.icon+'</div><div><div class="q-title">'+q.title+'</div><div class="q-reward">+'+q.reward+' ⭐</div></div></div><div class="q-bar-wrap"><div class="q-bar-fill" style="width:'+pct+'%"></div></div><div class="q-prog-label">'+(q.done?'Complete! ✓':q.progress+' / '+q.target)+'</div><div class="q-check">✅</div>';
    list.appendChild(card);
  });
  var r=document.getElementById('quests-reset-label');if(r)r.textContent='Resets in '+fmtCountdown(msToMidnight());
}
function showAchPopover(def,isEarned,anchorEl){
  var pop=document.getElementById('ach-popover');if(!pop)return;
  document.getElementById('ap-icon').textContent=def.icon;
  document.getElementById('ap-title').textContent=def.title;
  document.getElementById('ap-desc').textContent=def.desc;
  var st=document.getElementById('ap-status');
  if(isEarned){var ach=getAchievements(),dt=new Date(ach[def.id].earnedAt);st.className='ap-status earned';st.textContent='✓ Earned '+dt.toLocaleDateString();}
  else{st.className='ap-status locked';st.textContent='🔒 '+def.desc;}
  // Position near card but clamp fully within viewport
  var rect=anchorEl.getBoundingClientRect();
  var pw=210,ph=170;
  var vw=window.innerWidth,vh=window.innerHeight;
  var left=rect.left+rect.width/2-pw/2;
  var top=rect.bottom+8;
  // Clamp horizontal
  left=Math.max(8,Math.min(vw-pw-8,left));
  // Flip above if would go off bottom
  if(top+ph>vh-8)top=Math.max(8,rect.top-ph-8);
  // If still off screen (e.g. very small screen), centre it
  if(top<8)top=Math.max(8,Math.round((vh-ph)/2));
  pop.style.left=left+'px';
  pop.style.top=top+'px';
  pop.classList.add('show');
}
function convertTrophiesToStars(trophies,btn){
  var total=trophies.reduce(function(s,t){return s+[10,20,35][t.diff];},0);
  if(!total)return;
  btn.disabled=true;btn.textContent='Converting…';
  var i=0;
  function next(){
    if(i>=trophies.length){earnStars(total);showAchToast('💰','Converted!','+'+total+'⭐');spawnParticles(10);SFX.unlock();updateLobbyStats();setTimeout(renderChallengesModal,350);return;}
    var t=trophies[i++],data=loadChallenge(t.day,t.month,t.year);
    if(data){data.converted=true;saveChallenge(t.day,t.month,t.year,data);}
    setTimeout(next,80);
  }
  next();
}


// ══════════════════════════════════════════════
//  TREASURE CHEST SYSTEM
// ══════════════════════════════════════════════

function getChestTier(){
  var tier=CHEST_TIERS[0];
  for(var i=CHEST_TIERS.length-1;i>=0;i--){
    if(starsEverEarned>=CHEST_TIERS[i].unlockAt){tier=CHEST_TIERS[i];break;}
  }
  return tier;
}
function loadChestGems(){
  chestGems=parseInt(_ls.getItem('bp_chest_gems')||'0')||0;
}
function saveChestGems(){
  _ls.setItem('bp_chest_gems',String(chestGems));
}
function addGems(n){
  var tier=getChestTier();
  chestGems=Math.min(chestGems+n,tier.cap);
  saveChestGems();
  updateChestUI();
}
function updateChestUI(){
  var tier=getChestTier();
  var pct=Math.round(chestGems/tier.cap*100);
  var full=chestGems>=tier.cap;

  // Game screen chest
  var btn=document.getElementById('chest-btn');
  var fill=document.getElementById('chest-bar-fill');
  var gems=document.getElementById('chest-gems');
  var icon=document.getElementById('chest-icon');
  var bar=document.getElementById('chest-bar');
  if(btn){btn.className=full?'full':'';if(icon)icon.textContent=tier.icon;}
  if(fill)fill.style.width=pct+'%';
  if(gems)gems.textContent=chestGems+' / '+tier.cap+' gems';
  if(bar)bar.className=tier.id;

  // Lobby chest
  var lbChest=document.getElementById('lb-chest');
  var lbIcon=document.getElementById('lb-chest-icon');
  var lbName=document.getElementById('lb-chest-name');
  var lbFill=document.getElementById('lb-chest-bar-fill');
  var lbStatus=document.getElementById('lb-chest-status');
  if(lbChest)lbChest.className=full?'ready':'';
  if(lbIcon)lbIcon.textContent=tier.icon;
  if(lbName)lbName.textContent=tier.name;
  if(lbFill)lbFill.style.width=pct+'%';
  if(lbStatus)lbStatus.textContent=full?'Tap to open! ✨':chestGems+' / '+tier.cap+' gems';
}
function openChest(){
  var tier=getChestTier();
  if(chestGems<tier.cap)return;
  // Reset chest
  chestGems=0;saveChestGems();
  document.getElementById('chest-open-close').setAttribute('data-reward',String(tier.reward));
  // Award stars
  // Show modal
  var modal=document.getElementById('chest-modal');
  var openIcon=document.getElementById('chest-open-icon');
  var openTitle=document.getElementById('chest-open-title');
  var openSub=document.getElementById('chest-open-sub');
  var openReward=document.getElementById('chest-open-reward');
  if(openIcon)openIcon.textContent=tier.icon;
  if(openTitle)openTitle.textContent=tier.name+' Opened!';
  if(openSub)openSub.textContent='You earned:';
  if(openReward)openReward.textContent='+'+tier.reward+'⭐';
  if(modal){modal.classList.remove('show');void modal.offsetWidth;modal.classList.add('show');}
  spawnParticles(20);
  SFX.achieve();
  updateChestUI();
  updateLobbyStats();
}

// ══════════════════════════════════════════════
//  ADVENTURE MODE — 25 LEVELS
// ══════════════════════════════════════════════
// Grid cell values:
//   0 = empty
//   1 = normal block (must be cleared by line clear)
//   2 = ice stage 1 (1 line clear to thaw → becomes normal)
//   3 = ice stage 2 (2 line clears to thaw)
//   4 = ice stage 3 (3 line clears to thaw)
// Objective types: 'score','clear_blocks','break_ice','combo','lines'

var ADV_LEVELS=[
  // ── WORLD 1: Warm Up (1-5) ──
  {id:1,name:'Warm Up',
   grid:[
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [1,1,0,0,0,0,0,0,1,1],
     [1,1,0,0,0,0,0,0,1,1],
   ],
   objectives:[{type:'score',target:500},{type:'clear_blocks',target:8}],
   stars:[300,600,1000]},

  {id:2,name:'Corner Clear',
   grid:[
     [1,1,0,0,0,0,0,0,1,1],
     [1,1,0,0,0,0,0,0,1,1],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [1,1,0,0,0,0,0,0,1,1],
     [1,1,0,0,0,0,0,0,1,1],
   ],
   objectives:[{type:'clear_blocks',target:16},{type:'score',target:800}],
   stars:[500,900,1400]},

  {id:3,name:'The Cross',
   grid:[
     [0,0,0,0,1,0,0,0,0,0],
     [0,0,0,0,1,0,0,0,0,0],
     [0,0,0,0,1,0,0,0,0,0],
     [1,1,1,1,1,1,1,1,1,0],
     [0,0,0,0,1,0,0,0,0,0],
     [0,0,0,0,1,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'clear_blocks',target:14},{type:'lines',target:2}],
   stars:[600,1100,1800]},

  {id:4,name:'Diagonal',
   grid:[
     [1,0,0,0,0,0,0,0,0,0],
     [0,1,0,0,0,0,0,0,0,0],
     [0,0,1,0,0,0,0,0,0,0],
     [0,0,0,1,0,0,0,0,0,0],
     [0,0,0,0,1,0,0,0,0,0],
     [0,0,0,0,0,1,0,0,0,0],
     [0,0,0,0,0,0,1,0,0,0],
     [0,0,0,0,0,0,0,1,0,0],
     [0,0,0,0,0,0,0,0,1,0],
     [0,0,0,0,0,0,0,0,0,1],
   ],
   objectives:[{type:'clear_blocks',target:10},{type:'score',target:1000}],
   stars:[700,1200,2000]},

  {id:5,name:'CHEST I 🪙',chest:true,
   grid:[
     [1,0,1,0,1,0,1,0,1,0],
     [0,1,0,1,0,1,0,1,0,1],
     [1,0,1,0,1,0,1,0,1,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'clear_blocks',target:15},{type:'lines',target:3}],
   stars:[800,1500,2500],
   chestReward:{stars:20,trophy:null}},

  // ── WORLD 2: Ice Age (6-10) ──
  {id:6,name:'First Frost',
   grid:[
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,3,3,3,3,3,3,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,3,3,3,3,3,3,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:12},{type:'score',target:1200}],
   stars:[900,1600,2600]},

  {id:7,name:'Ice Border',
   grid:[
     [3,3,3,3,3,3,3,3,3,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,0,0,0,0,0,0,0,0,3],
     [3,3,3,3,3,3,3,3,3,3],
   ],
   objectives:[{type:'break_ice',target:36},{type:'lines',target:4}],
   stars:[1100,2000,3200]},

  {id:8,name:'Deep Freeze',
   grid:[
     [0,0,0,0,0,0,0,0,0,0],
     [0,3,3,3,0,0,3,3,3,0],
     [0,3,0,3,0,0,3,0,3,0],
     [0,3,3,3,0,0,3,3,3,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,3,3,3,0,0,3,3,3,0],
     [0,3,0,3,0,0,3,0,3,0],
     [0,3,3,3,0,0,3,3,3,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:32},{type:'score',target:1800}],
   stars:[1200,2200,3500]},

  {id:9,name:'Glacier',
   grid:[
     [4,4,4,4,4,0,0,0,0,0],
     [4,4,4,4,4,0,0,0,0,0],
     [4,4,4,4,4,0,0,0,0,0],
     [0,0,0,0,0,4,4,4,4,4],
     [0,0,0,0,0,4,4,4,4,4],
     [0,0,0,0,0,4,4,4,4,4],
     [4,4,4,4,4,0,0,0,0,0],
     [4,4,4,4,4,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:40},{type:'combo',target:3}],
   stars:[1400,2600,4000]},

  {id:10,name:'CHEST II 🥈',chest:true,
   grid:[
     [4,4,0,0,4,4,0,0,4,4],
     [4,4,0,0,4,4,0,0,4,4],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,4,4,0,0,4,4,0,0],
     [0,0,4,4,0,0,4,4,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [4,4,0,0,4,4,0,0,4,4],
     [4,4,0,0,4,4,0,0,4,4],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:32},{type:'score',target:2500}],
   stars:[1600,3000,5000],
   chestReward:{stars:35,trophy:'bronze'}},

  // ── WORLD 3: Puzzle Master (11-15) ──
  {id:11,name:'Checkers',
   grid:[
     [1,0,1,0,1,0,1,0,1,0],
     [0,1,0,1,0,1,0,1,0,1],
     [1,0,1,0,1,0,1,0,1,0],
     [0,1,0,1,0,1,0,1,0,1],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'clear_blocks',target:20},{type:'lines',target:4}],
   stars:[1800,3200,5200]},

  {id:12,name:'Frozen Checkers',
   grid:[
     [2,0,2,0,2,0,2,0,2,0],
     [0,3,0,3,0,3,0,3,0,3],
     [2,0,2,0,2,0,2,0,2,0],
     [0,3,0,3,0,3,0,3,0,3],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:20},{type:'score',target:3000}],
   stars:[2000,3600,5800]},

  {id:13,name:'The Wall',
   grid:[
     [3,3,3,3,3,3,3,3,3,3],
     [3,3,3,3,3,3,3,3,3,3],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:20},{type:'combo',target:4}],
   stars:[2200,4000,6500]},

  {id:14,name:'Diamond Mine',
   grid:[
     [0,0,0,0,1,1,0,0,0,0],
     [0,0,0,1,2,2,1,0,0,0],
     [0,0,1,2,3,3,2,1,0,0],
     [0,1,2,3,4,4,3,2,1,0],
     [1,2,3,4,0,0,4,3,2,1],
     [1,2,3,4,0,0,4,3,2,1],
     [0,1,2,3,4,4,3,2,1,0],
     [0,0,1,2,3,3,2,1,0,0],
     [0,0,0,1,2,2,1,0,0,0],
     [0,0,0,0,1,1,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:36},{type:'clear_blocks',target:20},{type:'score',target:4000}],
   stars:[2500,4500,7000]},

  {id:15,name:'CHEST III 🥇',chest:true,
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,0,0,0,0,0,0,0,0,4],
     [4,0,3,3,3,3,3,3,0,4],
     [4,0,3,0,0,0,0,3,0,4],
     [4,0,3,0,2,2,0,3,0,4],
     [4,0,3,0,2,2,0,3,0,4],
     [4,0,3,0,0,0,0,3,0,4],
     [4,0,3,3,3,3,3,3,0,4],
     [4,0,0,0,0,0,0,0,0,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:60},{type:'score',target:5000}],
   stars:[3000,5500,8500],
   chestReward:{stars:50,trophy:'silver'}},

  // ── WORLD 4: Extreme (16-20) ──
  {id:16,name:'Blizzard',
   grid:[
     [4,3,2,2,0,0,2,2,3,4],
     [3,4,3,2,0,0,2,3,4,3],
     [2,3,4,3,0,0,3,4,3,2],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:24},{type:'combo',target:3},{type:'score',target:4500}],
   stars:[3200,5800,9000]},

  {id:17,name:'Fortress',
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,3,3,3,3,3,3,3,3,4],
     [4,3,2,2,2,2,2,2,3,4],
     [4,3,2,0,0,0,0,2,3,4],
     [4,3,2,0,0,0,0,2,3,4],
     [4,3,2,0,0,0,0,2,3,4],
     [4,3,2,0,0,0,0,2,3,4],
     [4,3,2,2,2,2,2,2,3,4],
     [4,3,3,3,3,3,3,3,3,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:84},{type:'score',target:6000}],
   stars:[3800,7000,11000]},

  {id:18,name:'X Marks',
   grid:[
     [4,0,0,0,3,3,0,0,0,4],
     [0,4,0,3,0,0,3,0,4,0],
     [0,0,4,0,0,0,0,4,0,0],
     [0,3,0,4,0,0,4,0,3,0],
     [3,0,0,0,4,4,0,0,0,3],
     [3,0,0,0,4,4,0,0,0,3],
     [0,3,0,4,0,0,4,0,3,0],
     [0,0,4,0,0,0,0,4,0,0],
     [0,4,0,3,0,0,3,0,4,0],
     [4,0,0,0,3,3,0,0,0,4],
   ],
   objectives:[{type:'break_ice',target:36},{type:'lines',target:8},{type:'score',target:5500}],
   stars:[4000,7500,12000]},

  {id:19,name:'Avalanche',
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [3,3,3,3,3,3,3,3,3,3],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:30},{type:'combo',target:5},{type:'score',target:7000}],
   stars:[4500,8000,13000]},

  {id:20,name:'CHEST IV 💎',chest:true,
   grid:[
     [4,4,3,3,2,2,1,1,0,0],
     [4,4,3,3,2,2,1,1,0,0],
     [4,4,3,3,2,2,1,1,0,0],
     [4,4,3,3,2,2,0,0,0,0],
     [4,4,3,3,0,0,0,0,0,0],
     [4,4,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,0,0,0],
   ],
   objectives:[{type:'break_ice',target:30},{type:'clear_blocks',target:6},{type:'score',target:8000}],
   stars:[5000,9000,14000],
   chestReward:{stars:75,trophy:'gold'}},

  // ── WORLD 5: Legend (21-25) ──
  {id:21,name:'Frozen Hell',
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,3,3,3,3,3,3,4,4],
     [4,3,4,2,2,2,2,4,3,4],
     [4,3,2,4,1,1,4,2,3,4],
     [4,3,2,1,4,4,1,2,3,4],
     [4,3,2,1,4,4,1,2,3,4],
     [4,3,2,4,1,1,4,2,3,4],
     [4,3,4,2,2,2,2,4,3,4],
     [4,4,3,3,3,3,3,3,4,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:92},{type:'clear_blocks',target:8},{type:'score',target:10000}],
   stars:[6000,10000,16000]},

  {id:22,name:'The Gauntlet',
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,0,0,0,0,0,0,0,0,4],
     [4,0,4,4,0,0,4,4,0,4],
     [4,0,4,4,0,0,4,4,0,4],
     [4,0,0,0,4,4,0,0,0,4],
     [4,0,0,0,4,4,0,0,0,4],
     [4,0,4,4,0,0,4,4,0,4],
     [4,0,4,4,0,0,4,4,0,4],
     [4,0,0,0,0,0,0,0,0,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:56},{type:'combo',target:4},{type:'score',target:9000}],
   stars:[6500,11000,17000]},

  {id:23,name:'Absolute Zero',
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,0,0,0,0,4,4,4],
     [4,4,4,0,0,0,0,4,4,4],
     [4,4,4,0,0,0,0,4,4,4],
     [4,4,4,0,0,0,0,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:84},{type:'lines',target:10},{type:'score',target:12000}],
   stars:[7500,13000,20000]},

  {id:24,name:'Endgame',
   grid:[
     [4,3,4,3,4,3,4,3,4,3],
     [3,4,3,4,3,4,3,4,3,4],
     [4,3,4,3,4,3,4,3,4,3],
     [3,4,3,4,3,4,3,4,3,4],
     [4,3,4,3,0,0,3,4,3,4],
     [3,4,3,4,0,0,4,3,4,3],
     [4,3,4,3,4,3,4,3,4,3],
     [3,4,3,4,3,4,3,4,3,4],
     [4,3,4,3,4,3,4,3,4,3],
     [3,4,3,4,3,4,3,4,3,4],
   ],
   objectives:[{type:'break_ice',target:96},{type:'combo',target:5},{type:'score',target:15000}],
   stars:[8500,15000,22000]},

  {id:25,name:'CHEST V 👑',chest:true,
   grid:[
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
     [4,4,4,4,4,4,4,4,4,4],
   ],
   objectives:[{type:'break_ice',target:100},{type:'score',target:20000},{type:'combo',target:5}],
   stars:[10000,18000,28000],
   chestReward:{stars:100,trophy:'campaign_master'}},
];

// ══════════════════════════════════════════════
//  ADVENTURE MODE ENGINE
// ══════════════════════════════════════════════
var advMode=false;
var advInitializing=false;
var advLevel=null;       // current level data
var advIceGrid=[];       // ice stage per cell [row][col]
var advBlockGrid=[];     // pre-placed blocks [row][col]
var advObjProgress={};   // progress per objective type
var advLevelComplete=false;

// ── Save/Load progress ──
function getAdvProgress(){
  try{return JSON.parse(localStorage.getItem('bp_adv_progress')||'{}');}catch(e){return{};}
}
function saveAdvProgress(p){try{localStorage.setItem('bp_adv_progress',JSON.stringify(p));}catch(e){}}
function getAdvUnlocked(){var p=getAdvProgress();return p.unlocked||1;}
function getAdvStars(levelId){var p=getAdvProgress();return (p.stars&&p.stars[levelId])||0;}
function saveAdvLevelResult(levelId,stars){
  var p=getAdvProgress();
  p.stars=p.stars||{};
  p.stars[levelId]=Math.max(p.stars[levelId]||0,stars);
  // Unlock next level
  p.unlocked=Math.max(p.unlocked||1,levelId+1);
  // Mark chest claimed
  saveAdvProgress(p);
}
function isChestClaimed(levelId){var p=getAdvProgress();return !!(p.chestsClaimed&&p.chestsClaimed[levelId]);}
function markChestClaimed(levelId){var p=getAdvProgress();p.chestsClaimed=p.chestsClaimed||{};p.chestsClaimed[levelId]=true;saveAdvProgress(p);}

// ── Map screen ──
function openAdvMap(){
  var screen=document.getElementById('adv-map-screen');
  if(screen){screen.classList.add('show');renderAdvMap();}
}
function closeAdvMap(){
  var screen=document.getElementById('adv-map-screen');
  if(screen)screen.classList.remove('show');
}
// S-curve node positions for 25 levels (x from left of 350px canvas, y top-down)
// Levels rendered bottom-to-top: level 1 at bottom, 25 at top
var ADV_NODE_POSITIONS=(function(){
  // 5 rows of 5 levels, zigzag left-right
  // Row heights spaced 180px apart, within 1200px canvas
  var pos=[];
  var xPositions=[
    [50,120,190,260,320],  // row 1 (levels 1-5): left to right
    [320,260,190,120,50],  // row 2 (levels 6-10): right to left
    [50,120,190,260,320],  // row 3 (levels 11-15): left to right
    [320,260,190,120,50],  // row 4 (levels 16-20): right to left
    [50,120,190,260,320],  // row 5 (levels 21-25): left to right
  ];
  var baseY=1160; // level 1 y (bottom)
  for(var lvl=1;lvl<=25;lvl++){
    var rowIdx=Math.floor((lvl-1)/5);
    var colIdx=(lvl-1)%5;
    var x=xPositions[rowIdx][colIdx];
    var y=baseY-Math.floor((lvl-1)/5)*220-colIdx*20;
    // Slight vertical offset per column for S-curve feel
    var yOff=[0,-15,-5,-15,0][colIdx];
    pos[lvl]={x:x,y:y+yOff};
  }
  return pos;
})();

function renderAdvMap(){
  var canvas=document.getElementById('adv-map-canvas');
  var svg=document.getElementById('adv-path-svg');
  if(!canvas||!svg)return;
  // Clear old nodes (not SVG)
  var oldNodes=canvas.querySelectorAll('.adv-node,.adv-node-chest-icon');
  oldNodes.forEach(function(n){n.remove();});

  var unlocked=getAdvUnlocked();
  // Determine current level (first not completed)
  var currentLevel=unlocked;

  // Calculate total canvas height
  var maxY=0;
  for(var i=1;i<=25;i++){if(ADV_NODE_POSITIONS[i]&&ADV_NODE_POSITIONS[i].y>maxY)maxY=ADV_NODE_POSITIONS[i].y;}
  var canvasH=maxY+80;
  canvas.style.height=canvasH+'px';
  svg.setAttribute('height',canvasH);
  svg.setAttribute('viewBox','0 0 350 '+canvasH);

  // Draw curved path through all nodes
  var pathD='';
  for(var i=1;i<=25;i++){
    var p=ADV_NODE_POSITIONS[i];
    var pNext=ADV_NODE_POSITIONS[i+1];
    if(!pNext)break;
    if(i===1){pathD='M '+p.x+' '+p.y;}
    // Cubic bezier for smooth curves
    var cp1x=p.x,cp1y=(p.y+pNext.y)/2;
    var cp2x=pNext.x,cp2y=(p.y+pNext.y)/2;
    pathD+=' C '+cp1x+','+cp1y+' '+cp2x+','+cp2y+' '+pNext.x+','+pNext.y;
  }
  // Shadow path
  var shadowPath=document.createElementNS('http://www.w3.org/2000/svg','path');
  shadowPath.setAttribute('d',pathD);
  shadowPath.setAttribute('fill','none');
  shadowPath.setAttribute('stroke','rgba(0,0,0,0.4)');
  shadowPath.setAttribute('stroke-width','18');
  shadowPath.setAttribute('stroke-linecap','round');
  shadowPath.setAttribute('stroke-linejoin','round');
  // Main path
  var mainPath=document.createElementNS('http://www.w3.org/2000/svg','path');
  mainPath.setAttribute('d',pathD);
  mainPath.setAttribute('fill','none');
  mainPath.setAttribute('stroke','rgba(60,40,100,0.9)');
  mainPath.setAttribute('stroke-width','14');
  mainPath.setAttribute('stroke-linecap','round');
  mainPath.setAttribute('stroke-linejoin','round');
  // Highlight path (completed portion)
  var hlPath=document.createElementNS('http://www.w3.org/2000/svg','path');
  hlPath.setAttribute('d',pathD);
  hlPath.setAttribute('fill','none');
  hlPath.setAttribute('stroke','rgba(255,255,255,0.08)');
  hlPath.setAttribute('stroke-width','6');
  hlPath.setAttribute('stroke-linecap','round');
  hlPath.setAttribute('stroke-dasharray','1,20');
  svg.innerHTML='';
  svg.appendChild(shadowPath);
  svg.appendChild(mainPath);
  svg.appendChild(hlPath);

  // Place chest icons beside path (levels 5,10,15,20,25 chest nodes replace regular)
  var CHEST_LEVELS={5:1,10:1,15:1,20:1,25:1};

  ADV_LEVELS.forEach(function(lvl){
    var p=ADV_NODE_POSITIONS[lvl.id];
    if(!p)return;
    var stars=getAdvStars(lvl.id);
    var isCompleted=stars>0;
    var isCurrent=lvl.id===currentLevel;
    var isLocked=lvl.id>unlocked;
    var isChest=!!lvl.chest;
    var chestClaimed=isChest&&isChestClaimed(lvl.id);

    // Chest levels: show chest icon, not a circle node
    if(isChest){
      var chestEl=document.createElement('div');
      chestEl.className='adv-node chest-node'+(chestClaimed?' claimed':'');
      chestEl.style.cssText='left:'+(p.x-28)+'px;top:'+(p.y-28)+'px;font-size:30px;';
      chestEl.textContent=chestClaimed?'📭':'🎁';
      if(!chestClaimed&&!isLocked){
        (function(l){
          chestEl.addEventListener('click',function(){startAdvLevel(l);});
          chestEl.addEventListener('touchstart',function(e){e.preventDefault();startAdvLevel(l);},{passive:false});
        })(lvl);
      }
      canvas.appendChild(chestEl);
      return;
    }

    // Regular level node
    var node=document.createElement('div');
    var cls='adv-node';
    if(isLocked)cls+=' locked';
    else if(isCurrent)cls+=' current';
    else if(isCompleted)cls+=' completed';
    node.className=cls;
    node.style.cssText='left:'+(p.x-32)+'px;top:'+(p.y-32)+'px;';
    node.innerHTML='<div class="adv-node-num">'+(isCompleted?'✓':lvl.id)+'</div>'
      +'<div class="adv-node-stars">'
      +'<span class="adv-star'+(stars>=1?' lit':'')+'">★</span>'
      +'<span class="adv-star'+(stars>=2?' lit':'')+'">★</span>'
      +'<span class="adv-star'+(stars>=3?' lit':'')+'">★</span>'
      +'</div>';
    if(!isLocked){
      (function(l){
        node.addEventListener('click',function(){selectAdvLevel(l);});
        node.addEventListener('touchstart',function(e){e.preventDefault();selectAdvLevel(l);},{passive:false});
      })(lvl);
    }
    canvas.appendChild(node);
    // Scroll current into view
    if(isCurrent){
      setTimeout(function(){node.scrollIntoView({behavior:'smooth',block:'center'});},300);
    }
  });

  // Scroll to bottom (level 1)
  setTimeout(function(){
    var sc=document.getElementById('adv-map-scroll');
    if(sc)sc.scrollTop=sc.scrollHeight;
  },50);

  // Update play button
  updateAdvPlayBtn(currentLevel);
  // Update timer
  updateAdvTimer();
}

var _selectedAdvLevel=null;
function selectAdvLevel(lvl){
  _selectedAdvLevel=lvl;
  updateAdvPlayBtn(lvl.id);
  // Highlight selected node briefly
  var nodes=document.querySelectorAll('.adv-node.selected');
  nodes.forEach(function(n){n.classList.remove('selected');});
}
function updateAdvPlayBtn(levelId){
  var btn=document.getElementById('adv-play-btn');
  if(!btn)return;
  var lvl=ADV_LEVELS.find(function(l){return l.id===levelId;});
  _selectedAdvLevel=lvl||_selectedAdvLevel;
  btn.textContent='Play Level '+(lvl?lvl.id:levelId);
}
function getWeekNumber(){
  var d=new Date();d.setHours(0,0,0,0);
  d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  var w1=new Date(d.getFullYear(),0,4);
  return 'W'+d.getFullYear()+'_'+(1+Math.round(((d.getTime()-w1.getTime())/86400000-3+(w1.getDay()+6)%7)/7));
}
function getMondayReset(){
  var now=new Date(),day=now.getUTCDay(),dUntilMon=day===1?7:(8-day)%7;
  var next=new Date(now);next.setUTCDate(now.getUTCDate()+dUntilMon);next.setUTCHours(0,0,0,0);return next.getTime();
}
function getAdvWeekKey(){return 'bp_adv_'+getWeekNumber();}
function getAdvProgress(){try{return JSON.parse(localStorage.getItem(getAdvWeekKey())||'{}')}catch(e){return{};}}
function saveAdvProgress(p){try{localStorage.setItem(getAdvWeekKey(),JSON.stringify(p));}catch(e){}}
function updateAdvTimer(){
  var el=document.getElementById('adv-map-timer');if(!el)return;
  var left=getMondayReset()-Date.now();
  if(left<=0){el.textContent='Resetting...';return;}
  var d=Math.floor(left/86400000),h=Math.floor((left%86400000)/3600000),m=Math.floor((left%3600000)/60000);
  el.textContent=d>0?'⏱ '+d+'d '+h+'h left':'⏱ '+h+'h '+m+'m left';
}
function objLabel(o){
  if(o.type==='score')return '🎯 '+o.target.toLocaleString()+' pts';
  if(o.type==='clear_blocks')return '🟪 Clear '+o.target;
  if(o.type==='break_ice')return '❄️ Break '+o.target+' ice';
  if(o.type==='combo')return '🔥 Combo ×'+o.target;
  if(o.type==='lines')return '✨ '+o.target+' lines';
  return '';
}

// ── Start a level ──
function startAdvLevel(lvl){
  closeAdvMap();
  advMode=true;
  advLevel=lvl;
  advLevelComplete=false;
  // Init objective progress
  advObjProgress={};
  advColoredPieces=[null,null,null];
  advColorGrid=[];
  for(var _i=0;_i<10;_i++)advColorGrid.push([0,0,0,0,0,0,0,0,0,0]);
  lvl.objectives.forEach(function(o){advObjProgress[o.type]=0;});
  // Build ice/block grids from level data
  advIceGrid=[];advBlockGrid=[];
  for(var r=0;r<10;r++){
    advIceGrid.push([0,0,0,0,0,0,0,0,0,0]);
    advBlockGrid.push([0,0,0,0,0,0,0,0,0,0]);
    for(var c=0;c<10;c++){
      var v=lvl.grid[r][c];
      if(v>=2)advIceGrid[r][c]=v;      // 2=light(2hits), 3=cracked(3hits), 4=hard(4hits)
      else if(v===1)advBlockGrid[r][c]=1;
    }
  }
  // initGame resets grid — call it once via goToGame
  isChallenge=false;
  // Set flag so goToGame skips its own initGame call
  var _advSkipInit=true;
  initGame(); // sets up board DOM, pieces, score
  // Now pre-fill grid with level data BEFORE showing the screen
  advInitializing=true;
  for(var r=0;r<10;r++){
    for(var c=0;c<10;c++){
      if(lvl.grid[r][c]>=1)grid[r][c]=1;
    }
  }
  syncBoard();          // renders board with pre-filled cells
  renderAdvCellStyles(); // applies ice/block colours
  renderAdvHUD();
  var nm=document.getElementById('adv-level-name');
  if(nm)nm.textContent='Level '+lvl.id+': '+lvl.name;
  // Now go to game screen — skip initGame inside goToGame
  isChallenge=true; // trick: goToGame skips initGame when isChallenge=true
  goToGame();
  isChallenge=false;
  setTimeout(function(){advInitializing=false;},100);
}

// Apply visual ice/block styling to cells
function renderAdvCellStyles(){
  if(!advMode)return;
  for(var r=0;r<10;r++){
    for(var c=0;c<10;c++){
      var el=cellEl(r,c);if(!el)continue;
      // Always start from scratch
      el.classList.remove('ice-1','ice-2','ice-3','ice-4','adv-block');
      if(!grid[r][c])continue; // empty cell — no classes needed
      var ice=advIceGrid[r][c];
      if(ice>=1){
        // Ice stage 1,2,3,4 — apply ice class
        el.classList.add('ice-'+ice);
      } else if(advColorGrid[r]&&advColorGrid[r][c]){
        // Coloured block (pink)
        el.classList.add('adv-block');
      } else if(advBlockGrid[r]&&advBlockGrid[r][c]){
        // Pre-placed board block (purple)
        el.classList.add('adv-block');
      }
    }
  }
}

// ── HUD ──
function renderAdvHUD(){
  if(!advMode||!advLevel)return;
  var hud=document.getElementById('adv-hud');
  var objBar=document.getElementById('adv-objectives');
  if(!hud||!objBar)return;
  hud.style.display='flex';
  objBar.style.display='flex';
  // Hide normal obj-bar and chest-bar in adv mode to save space
  var ob=document.getElementById('obj-bar');if(ob)ob.style.display='none';
  var cb=document.getElementById('chest-bar');if(cb)cb.style.display='none';
  objBar.innerHTML='';
  advLevel.objectives.forEach(function(o){
    var prog=advObjProgress[o.type]||0;
    var done=prog>=o.target;
    var chip=document.createElement('div');
    chip.className='adv-obj-chip'+(done?' done':'');
    chip.innerHTML='<span class="obj-icon">'+objIcon(o.type)+'</span>'
      +'<span class="adv-obj-progress">'+Math.min(prog,o.target)+'/'+o.target+'</span>';
    objBar.appendChild(chip);
  });
  // Update level name in HUD
  var nm=document.getElementById('adv-level-name');
  if(nm)nm.textContent='Level '+advLevel.id+': '+advLevel.name;
}
function objIcon(type){
  return{score:'🎯',clear_blocks:'🟪',break_ice:'❄️',combo:'🔥',lines:'✨'}[type]||'📋';
}
function hideAdvHUD(){
  var hud=document.getElementById('adv-hud');
  var obj=document.getElementById('adv-objectives');
  if(hud)hud.style.display='none';
  if(obj)obj.style.display='none';
  var ob=document.getElementById('obj-bar');if(ob)ob.style.display='';
  var cb=document.getElementById('chest-bar');if(cb)cb.style.display='';
}

// ── Objective tracking (hooked into game events) ──
function advTrackScore(s){
  if(!advMode||!advLevel)return;
  advObjProgress['score']=Math.max(advObjProgress['score']||0,s);
  renderAdvHUD();checkAdvComplete();
}
function advTrackLines(n){
  if(!advMode||!advLevel)return;
  advObjProgress['lines']=(advObjProgress['lines']||0)+n;
  renderAdvHUD();checkAdvComplete();
}
function advTrackCombo(c){
  if(!advMode||!advLevel)return;
  advObjProgress['combo']=Math.max(advObjProgress['combo']||0,c);
  renderAdvHUD();checkAdvComplete();
}
// Intersection cell (in both a cleared row AND col) counts as 2
// Count clear_blocks progress.
// Colored cells and pre-placed blocks count when their row/col is cleared.
// Iced cells are excluded — they survive the clear until ice=0.
// Intersection cells (row+col both cleared) count twice.
function advTrackClearBlocks(rows,cols){
  if(!advMode)return;
  var count=0;
  rows.forEach(function(r){
    for(var c=0;c<COLS;c++){
      // Skip if still iced — cell survived this clear
      if(advIceGrid[r]&&advIceGrid[r][c]>=1)continue;
      if(advBlockGrid[r]&&advBlockGrid[r][c]===1)count++;
      if(advColorGrid[r]&&advColorGrid[r][c]===1)count++;
    }
  });
  cols.forEach(function(col){
    for(var r=0;r<ROWS;r++){
      if(advIceGrid[r]&&advIceGrid[r][col]>=1)continue;
      if(advBlockGrid[r]&&advBlockGrid[r][col]===1)count++;
      if(advColorGrid[r]&&advColorGrid[r][col]===1)count++;
    }
  });
  if(count>0){
    advObjProgress['clear_blocks']=(advObjProgress['clear_blocks']||0)+count;
    renderAdvHUD();checkAdvComplete();
  }
}
function advTrackClearBlock(r,c){
  if(!advMode)return;
  var counted=false;
  if(advBlockGrid[r]&&advBlockGrid[r][c]===1){advBlockGrid[r][c]=0;counted=true;}
  if(advColorGrid[r]&&advColorGrid[r][c]===1){advColorGrid[r][c]=0;counted=true;}
  if(counted){
    advObjProgress['clear_blocks']=(advObjProgress['clear_blocks']||0)+1;
    renderAdvHUD();checkAdvComplete();
  }
}
// Ice stages: 3=hard ice, 2=cracked, 1=melting, 0=clear
// Each line clear hitting an iced cell reduces stage by 1
// At stage 0 → cell is physically cleared, counts toward break_ice
function advTrackIce(rows,cols){
  if(!advMode)return;
  var changed=false;
  for(var r=0;r<10;r++){
    for(var c=0;c<10;c++){
      var ice=advIceGrid[r][c];
      if(ice<1)continue; // no ice here
      // Only reduce if this cell's row OR col is being cleared
      if(rows.indexOf(r)<0&&cols.indexOf(c)<0)continue;
      // Reduce by 1 stage
      advIceGrid[r][c]=ice-1;
      changed=true;
      if(advIceGrid[r][c]===0){
        // Fully thawed — this cell will be zeroed by clearLines (grid[r][c]=0)
        // Count toward break_ice objective
        advObjProgress['break_ice']=(advObjProgress['break_ice']||0)+1;
        renderAdvHUD();checkAdvComplete();
      }
      // If still iced (stage>0): grid[r][c] stays 1, cell stays on board
      // clearLines will skip zeroing it (see ice skip in setTimeout)
    }
  }
  // Update visuals immediately so player sees stage change
  if(changed)renderAdvCellStyles();
}

// ── Check if all objectives met ──
function checkAdvComplete(){
  if(!advMode||!advLevel||advLevelComplete)return;
  var allDone=advLevel.objectives.every(function(o){
    return (advObjProgress[o.type]||0)>=o.target;
  });
  if(allDone){
    advLevelComplete=true;
    setTimeout(showAdvComplete,600);
  }
}
function showAdvComplete(){
  // Calculate stars
  var stars=0;
  if(score>=advLevel.stars[0])stars=1;
  if(score>=advLevel.stars[1])stars=2;
  if(score>=advLevel.stars[2])stars=3;
  saveAdvLevelResult(advLevel.id,stars);
  // Show modal
  var modal=document.getElementById('adv-complete-modal');
  document.getElementById('adv-complete-score').textContent=score.toLocaleString()+' pts';
  // Animate stars
  var starEls=document.querySelectorAll('.adv-cstar');
  starEls.forEach(function(el){el.classList.remove('lit');});
  for(var i=0;i<stars;i++){
    (function(idx){setTimeout(function(){if(starEls[idx])starEls[idx].classList.add('lit');SFX.achieve();},idx*400+300);})(i);
  }
  // Wire buttons
  var nextBtn=document.getElementById('adv-complete-next');
  var mapBtn=document.getElementById('adv-complete-map');
  var nextLvl=ADV_LEVELS.find(function(l){return l.id===advLevel.id+1;});
  if(nextBtn){
    nextBtn.style.display=nextLvl?'block':'none';
    nextBtn.onclick=function(){
      modal.classList.remove('show');
      // Show chest reward if this level has one
      if(advLevel.chest&&!isChestClaimed(advLevel.id)){
        markChestClaimed(advLevel.id);
        showAdvChest(advLevel.chestReward,function(){
          if(nextLvl)startAdvLevel(nextLvl);
          else{advMode=false;hideAdvHUD();openAdvMap();}
        });
      } else {
        if(nextLvl)startAdvLevel(nextLvl);
        else{advMode=false;hideAdvHUD();openAdvMap();}
      }
    };
  }
  if(mapBtn){
    mapBtn.onclick=function(){
      modal.classList.remove('show');
      if(advLevel.chest&&!isChestClaimed(advLevel.id)){
        markChestClaimed(advLevel.id);
        showAdvChest(advLevel.chestReward,function(){advMode=false;hideAdvHUD();goHome();openAdvMap();});
      } else {advMode=false;hideAdvHUD();goHome();openAdvMap();}
    };
  }
  spawnParticles(20);
  SFX.trophy();
  if(modal){modal.classList.remove('show');void modal.offsetWidth;modal.classList.add('show');}
}

// ── Chest reward ──
function showAdvChest(reward,onClose){
  var modal=document.getElementById('adv-chest-modal');
  var icons={bronze:'📦',silver:'🪣',gold:'🏆',campaign_master:'👑'};
  var icon=icons[reward.trophy]||'🎁';
  document.getElementById('adv-chest-icon').textContent=icon;
  document.getElementById('adv-chest-title').textContent='Treasure Unlocked!';
  var rewardText='+'+reward.stars+'⭐';
  if(reward.trophy&&reward.trophy!==null){
    rewardText+='\n🏅 '+reward.trophy.replace('_',' ').replace(/\b\w/g,function(c){return c.toUpperCase()})+' Trophy';
    // Grant achievement trophy
    grantAchievement(reward.trophy==='campaign_master'?'perfect':reward.trophy);
  }
  document.getElementById('adv-chest-reward').textContent=rewardText;
  earnStars(reward.stars);
  spawnParticles(25);
  SFX.trophy();
  document.getElementById('adv-chest-close').onclick=function(){
    modal.classList.remove('show');
    if(onClose)onClose();
  };
  if(modal){modal.classList.remove('show');void modal.offsetWidth;modal.classList.add('show');}
}

// ── Level failed ──
function showAdvFailed(){
  if(!advMode||advLevelComplete)return;
  var modal=document.getElementById('adv-fail-modal');
  // Show objective progress
  var objText=advLevel.objectives.map(function(o){
    var prog=Math.min(advObjProgress[o.type]||0,o.target);
    return objIcon(o.type)+' '+objLabel(o)+': '+prog+'/'+o.target+(prog>=o.target?' ✓':'');
  }).join('\n');
  document.getElementById('adv-fail-obj').textContent=objText;
  // Power-up buttons — disable if player can't afford
  var costs={shuffle:2,undo:3,blast:5};
  var pwrBtns=document.querySelectorAll('.adv-fail-pwrup');
  var canAffordAny=false;
  pwrBtns.forEach(function(btn){
    var type=btn.getAttribute('data-type');
    var cost=costs[type]||0;
    var canAfford=stars>=cost;
    if(canAfford)canAffordAny=true;
    // Dim and disable if can't afford
    btn.style.opacity=canAfford?'1':'0.35';
    btn.style.pointerEvents=canAfford?'auto':'none';
    btn.querySelector('.fp-cost').textContent=cost+'⭐';
    btn.onclick=canAfford?function(){
      var t=this.getAttribute('data-type');
      modal.classList.remove('show');
      if(t==='shuffle')shopShuffle();
      else if(t==='blast')shopBlast();
      else if(t==='undo')shopUndo();
    }:null;
  });
  // If no power-ups affordable, highlight restart prominently
  var restartBtn=document.getElementById('adv-fail-restart');
  var subEl=document.getElementById('adv-fail-sub');
  if(!canAffordAny){
    if(subEl)subEl.textContent='Not enough ⭐ stars for power-ups. Restart the level?';
    if(restartBtn){restartBtn.style.background='linear-gradient(135deg,#1ecfb0,#0aa890)';restartBtn.style.color='#fff';restartBtn.style.fontWeight='900';}
  } else {
    if(subEl)subEl.textContent='No more moves! Use a power-up to continue.';
    if(restartBtn){restartBtn.style.background='';restartBtn.style.color='';restartBtn.style.fontWeight='';}
  }
  // Wire restart and home
  document.getElementById('adv-fail-restart').onclick=function(){
    modal.classList.remove('show');
    startAdvLevel(advLevel);
  };
  document.getElementById('adv-fail-home').onclick=function(){
    modal.classList.remove('show');
    advMode=false;hideAdvHUD();goHome();
  };
  if(modal){modal.classList.remove('show');void modal.offsetWidth;modal.classList.add('show');}
}

// ── Reset adv mode on goHome ──
function resetAdvMode(){
  advMode=false;advLevel=null;advLevelComplete=false;
  advIceGrid=[];advBlockGrid=[];advObjProgress={};
  advColorGrid=[];advColoredPieces=[null,null,null];
  hideAdvHUD();
}


var advColoredPieces=[null,null,null];
var advColorGrid=[];
function advColorizePiece(shape){
  // Embed colour directly into shape: 2 = coloured cell
  if(!advMode||!advLevel)return shape;
  var hasColorObj=advLevel.objectives.some(function(o){return o.type==='clear_blocks';});
  if(!hasColorObj)return shape;
  // Deep copy shape so we don't mutate the original SHAPES array
  var colored=shape.map(function(row){return row.slice();});
  var found=false;
  for(var r=0;r<colored.length;r++)
    for(var c=0;c<colored[r].length;c++)
      if(colored[r][c]===1&&Math.random()<0.10){colored[r][c]=2;found=true;}
  return found?colored:shape;
}
function rndWithColor(slotIdx){
  var shape=rnd();
  if(advMode)shape=advColorizePiece(shape); // embed colour into shape matrix
  return shape;
}
var DESIGN_W=390,DESIGN_H=844;
function scaleGame(){
  var sw=window.innerWidth,sh=window.innerHeight;
  var scale=Math.min(sw/DESIGN_W,sh/DESIGN_H);
  var tx=(sw-DESIGN_W*scale)/2;
  var ty=(sh-DESIGN_H*scale)/2;
  // Scale adv map
  var advScreen=document.getElementById('adv-map-screen');
  if(advScreen){advScreen.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';}
  // Scale game canvas
  var w=document.getElementById('w');
  if(w){
    w.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
    w.style.transformOrigin='top left';
  }
  // Scale lobby to match
  var lobby=document.getElementById('lobby');
  if(lobby){
    lobby.style.width=DESIGN_W+'px';
    lobby.style.height=DESIGN_H+'px';
    lobby.style.position='fixed';
    lobby.style.top='0';
    lobby.style.left='0';
    lobby.style.transformOrigin='top left';
    lobby.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
  }
}
scaleGame();
window.addEventListener('resize',scaleGame);
document.addEventListener('click',function(){var p=document.getElementById('ach-popover');if(p)p.classList.remove('show');});
document.getElementById('ach-popover-close').addEventListener('click',function(e){e.stopPropagation();document.getElementById('ach-popover').classList.remove('show');});
requestAnimationFrame(function(){scaleGame();requestAnimationFrame(scaleGame);});

// Init
loadChestGems();
loadAckUnlocks();
loadUnlocks();
initGame();
window.addEventListener('resize',renderTray);

document.getElementById('adv-map-back').addEventListener('click',closeAdvMap);
document.getElementById('adv-play-btn').addEventListener('click',function(){if(_selectedAdvLevel)startAdvLevel(_selectedAdvLevel);});
document.getElementById('adv-play-btn').addEventListener('touchstart',function(e){e.preventDefault();if(_selectedAdvLevel)startAdvLevel(_selectedAdvLevel);},{passive:false});
document.getElementById('adv-awards-btn').addEventListener('click',function(){openChallengesModal();});
document.getElementById('adv-hud-back').addEventListener('click',function(){if(advMode){advMode=false;hideAdvHUD();goHome();setTimeout(openAdvMap,300);}});