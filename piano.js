const keyboard = document.querySelector('#keyboard');
const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const mapping = ['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l','p',';'];
const extraCodes = {Quote:77,BracketRight:79,Backslash:81,BracketLeft:83,Enter:84};
const whiteHints = {77:':',79:']',81:'\\',83:'[',84:'↵'};
const keys = new Map(), voices = new Map(), held = new Map();
let context, master, latch = false, pedal = false, whiteIndex = 0;
const instruments = {
 piano: {partials:[1,.3,.12,.045], attack:.008, peak:.24, decay:.35, level:.07, end:5, release:.25},
 trumpet: {partials:[1,.65,.48,.3,.2,.12,.07,.04], attack:.06, peak:.15, decay:.18, level:.12, release:.12, vibrato:5.5},
 flute: {partials:[1,.09,.025,.01], attack:.09, peak:.24, decay:.2, level:.20, release:.18, vibrato:4.8},
 guitar: {partials:[1,.55,.3,.18,.09,.06], attack:.004, peak:.22, decay:.18, level:.065, end:2.6, release:.14}
};
for (let midi=60;midi<=84;midi++) {
  const black = [1,3,6,8,10].includes(midi%12);
  const button = document.createElement('button');
  button.className = `key ${black?'black':'white'}`;
  const label = names[midi%12]+(Math.floor(midi/12)-1);
  button.setAttribute('aria-label',label);button.setAttribute('aria-pressed','false');
  button.innerHTML = `<span class="labels"><span>${label}</span><kbd>${mapping[midi-60]?.toUpperCase() || whiteHints[midi] || ''}</kbd></span>`;
  if(black) button.style.left = `${whiteIndex/15*100-2.2}%`; else whiteIndex++;
  keyboard.append(button);keys.set(midi,button);
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);start(midi,'pointer'+e.pointerId);});
  const end=e=>release('pointer'+e.pointerId);
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);
  button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)start(midi,'focus');}});
  button.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();release('focus');}});
  button.addEventListener('blur',()=>release('focus'));
}
function audio(){
  if(!context){const Audio = window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('このブラウザは音声生成に対応していません。');context=new Audio();master=context.createGain();master.gain.value=Number(document.querySelector('#volume').value)/100;const limiter=context.createDynamicsCompressor();master.connect(limiter);limiter.connect(context.destination);}
  return context.resume();
}
async function start(midi,source){
  if(held.has(source))return;held.set(source,midi);
  try{await audio();}catch(error){held.delete(source);document.querySelector('#status').textContent=error.message;return;}
  if(held.get(source)!==midi)return;
  if(voices.has(midi))stop(midi);
  const now=context.currentTime, frequency=440*2**((midi-69)/12), gain=context.createGain();
  const instrument = instruments[document.querySelector('#instrument').value];
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(instrument.peak,now+instrument.attack);gain.gain.exponentialRampToValueAtTime(instrument.level,now+instrument.decay);
  if(instrument.end)gain.gain.exponentialRampToValueAtTime(.001,now+instrument.end);
  gain.connect(master);
  const oscillators=instrument.partials.map((partial,i)=>{const oscillator=context.createOscillator(), level=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency*(i+1);level.gain.value=partial;oscillator.connect(level);level.connect(gain);oscillator.start();return oscillator;});
  if(instrument.vibrato){const lfo=context.createOscillator(), depth=context.createGain();lfo.frequency.value=instrument.vibrato;depth.gain.setValueAtTime(0,now);depth.gain.linearRampToValueAtTime(7,now+.4);lfo.connect(depth);oscillators.forEach(o=>depth.connect(o.detune));lfo.start();oscillators.push(lfo);}
  const timer=instrument.end?setTimeout(()=>{if(voices.get(midi)?.gain===gain)stop(midi);},(instrument.end+.5)*1000):null;
  voices.set(midi,{gain,oscillators,timer,release:instrument.release});keys.get(midi).classList.add('active');keys.get(midi).setAttribute('aria-pressed','true');
  document.querySelector('#instrument-art').classList.add('playing');
  document.querySelector('#note').textContent=names[midi%12]+(Math.floor(midi/12)-1);document.querySelector('#status').textContent='演奏中 · 音を楽しんで';
}
function stop(midi){const voice=voices.get(midi);if(!voice)return;clearTimeout(voice.timer);const now=context.currentTime;voice.gain.gain.cancelAndHoldAtTime(now);voice.gain.gain.linearRampToValueAtTime(0,now+voice.release);voice.oscillators.forEach(o=>o.stop(now+voice.release+.05));setTimeout(()=>{voice.gain.disconnect();voice.oscillators.forEach(o=>o.disconnect());},(voice.release+.1)*1000);voices.delete(midi);keys.get(midi).classList.remove('active');keys.get(midi).setAttribute('aria-pressed','false');if(!voices.size){document.querySelector('#note').textContent='—';document.querySelector('#instrument-art').classList.remove('playing');}}
function release(source){const midi=held.get(source);held.delete(source);if(midi!==undefined&&!latch&&!pedal&&![...held.values()].includes(midi))stop(midi);}
function updatePedal(){const active=latch||pedal;const button=document.querySelector('#sustain');button.setAttribute('aria-pressed',String(active));button.textContent=`サステイン ${active?'ON':'OFF'}`;if(!active)for(const midi of voices.keys())if(![...held.values()].includes(midi))stop(midi);}
document.querySelector('#sustain').onclick=()=>{latch=!latch;updatePedal();};
document.querySelector('#volume').oninput=e=>{if(master)master.gain.setTargetAtTime(e.target.value/100,context.currentTime,.02);};
document.addEventListener('keydown',e=>{if(e.target.matches('input,button,select'))return;if(e.code==='Space'){e.preventDefault();pedal=true;updatePedal();return;}const index=mapping.indexOf(e.key.toLowerCase()),midi=index>=0?60+index:extraCodes[e.code];if(midi!==undefined){e.preventDefault();if(!e.repeat)start(midi,e.code);}});
document.addEventListener('keyup',e=>{if(e.code==='Space'){pedal=false;updatePedal();}release(e.code);});
function silence(){held.clear();pedal=false;latch=false;updatePedal();for(const midi of [...voices.keys()])stop(midi);}
window.addEventListener('blur',silence);document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});

const drawings = {
 trumpet: `<defs><linearGradient id="brass" x2="0" y2="1"><stop stop-color="#ffe5a4"/><stop offset=".45" stop-color="#b5863d"/><stop offset=".7" stop-color="#ffe9ac"/><stop offset="1" stop-color="#846028"/></linearGradient></defs><g fill="none" stroke="url(#brass)" stroke-width="19"><path d="M145 112H550Q587 112 587 147V167Q587 194 550 194H257Q222 194 222 166V145Q222 119 257 119"/><path d="M285 113V75M351 113V75M417 113V75"/></g><g fill="url(#brass)"><rect x="106" y="103" width="62" height="18" rx="4"/><path d="M490 103Q633 104 690 43V178Q633 119 490 121Z"/><ellipse cx="692" cy="110" rx="22" ry="68"/><rect x="265" y="64" width="40" height="13" rx="5"/><rect x="331" y="64" width="40" height="13" rx="5"/><rect x="397" y="64" width="40" height="13" rx="5"/></g><ellipse cx="696" cy="110" rx="13" ry="55" fill="#4d3920"/><g class="sounding" fill="none" stroke="#e6d3a2" stroke-width="3"><path d="M738 84q18 25 0 50M761 65q30 45 0 88"/></g>`,
 flute: `<defs><linearGradient id="silver" x2="0" y2="1"><stop stop-color="#8197a0"/><stop offset=".3" stop-color="#f5fcff"/><stop offset=".6" stop-color="#b7cad3"/><stop offset="1" stop-color="#526873"/></linearGradient></defs><rect x="65" y="108" width="690" height="32" rx="12" fill="url(#silver)"/><rect x="112" y="105" width="82" height="38" rx="18" fill="url(#silver)" stroke="#e1eef3"/><ellipse cx="153" cy="114" rx="18" ry="6" fill="#33464e"/><path d="M254 106H694" stroke="#dce9ec" stroke-width="5"/>${[270,325,380,435,490,545,600,655].map(x=>`<path d="M${x} 110V84" stroke="#c5d8df" stroke-width="8"/><circle cx="${x}" cy="83" r="17" fill="url(#silver)" stroke="#e2eff5" stroke-width="2"/>`).join('')}<g class="sounding" fill="none" stroke="#c2e5f2" stroke-width="3"><path d="M138 62q15-18 30 0M128 45q25-28 50 0"/></g>`,
 guitar: `<defs><linearGradient id="wood"><stop stop-color="#ac6a31"/><stop offset=".5" stop-color="#e4af65"/><stop offset="1" stop-color="#9e5a2d"/></linearGradient></defs><path d="M170 33C95 22 65 63 95 105C35 168 101 228 171 214C208 210 238 192 250 164C269 154 269 101 249 87C239 53 207 34 170 33Z" fill="url(#wood)" stroke="#f0c790" stroke-width="5"/><circle cx="184" cy="123" r="39" fill="#291b14" stroke="#e6c295" stroke-width="6"/><path d="M231 103H655V145H231Z" fill="#503425" stroke="#ac865a" stroke-width="3"/>${Array.from({length:14},(_,i)=>`<path d="M${255+i*27} 103V145" stroke="#b9b2a1" stroke-width="2"/>`).join('')}<path d="M655 103L727 83L761 92V153L730 166L655 145Z" fill="url(#wood)" stroke="#d9aa72" stroke-width="3"/>${[102,123,144].map(y=>`<circle cx="735" cy="${y}" r="7" fill="#bec9c5"/>`).join('')}<rect x="120" y="90" width="16" height="65" rx="3" fill="#503425"/>${Array.from({length:6},(_,i)=>`<path d="M128 ${112+i*4}H735" stroke="#eee0b9" stroke-width="${i<3?1:1.5}"/>`).join('')}<g class="sounding" fill="none" stroke="#f8d6a5" stroke-width="3"><path d="M175 65q13-12 27 0M168 51q22-20 42 0"/></g>`
};
function updateAppearance(){
  const select=document.querySelector('#instrument'), type=select.value;
  document.querySelector('#instrument-panel').dataset.instrument=type;
  document.querySelector('#instrument-panel').setAttribute('aria-label',select.selectedOptions[0].textContent);
  const art=document.querySelector('#instrument-art');
  art.hidden=type==='piano';
  art.innerHTML=type==='piano'?'':`<svg viewBox="0 0 820 250" xmlns="http://www.w3.org/2000/svg">${drawings[type]}</svg>`;
}
document.querySelector('#instrument').addEventListener('change',()=>{silence();updateAppearance();document.querySelector('#instrument').blur();document.querySelector('#status').textContent=document.querySelector('#instrument').selectedOptions[0].textContent+'で演奏できます';});
updateAppearance();
