'use strict';
// WebAudio：八音盒环境旋律 + 放置/破坏音效（全部程序合成，无音频文件）
let AC=null, master=null, musicOn=true, nextNote=2;

function initAudio(){
  if(AC){ if(AC.resume) AC.resume(); return; }
  try{ AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain(); master.gain.value=.5; master.connect(AC.destination);
  }catch(e){}
}
function plink(f,vol,delay){
  if(!AC||!musicOn) return;
  const t=AC.currentTime+(delay||0);
  for(const [mult,v] of [[1,vol],[2.01,vol*.28]]){
    const o=AC.createOscillator(), g=AC.createGain();
    o.type='sine'; o.frequency.value=f*mult;
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+1.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+1.4);
  }
}
const SCALE=[523.25,587.33,659.25,783.99,880,1046.5];
function musicTick(dt){
  if(!AC||!musicOn) return;
  nextNote-=dt;
  if(nextNote>0) return;
  nextNote=1.6+Math.random()*2.6;
  const n=2+((Math.random()*3)|0), base=(Math.random()*SCALE.length)|0;
  for(let i=0;i<n;i++){
    const f=SCALE[(base+i*(Math.random()<.5?1:2))%SCALE.length];
    plink(f,.045,i*.19);
  }
}
function sfxBlip(f){
  if(!AC)return; const t=AC.currentTime;
  const o=AC.createOscillator(), g=AC.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*.6,t+.09);
  g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.0001,t+.1);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+.12);
}
function sfxCrunch(){
  if(!AC)return; const t=AC.currentTime, len=.09;
  const buf=AC.createBuffer(1,AC.sampleRate*len,AC.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=AC.createBufferSource(); s.buffer=buf;
  const flt=AC.createBiquadFilter(); flt.type='lowpass'; flt.frequency.value=900;
  const g=AC.createGain(); g.gain.value=.22;
  s.connect(flt); flt.connect(g); g.connect(master); s.start(t);
}
