import { useState, useRef, useEffect } from "react";

const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY;

async function claudeCall(system, userMsg, maxTokens = 1400) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const d = await r.json();
  return d.content.map((b) => b.text || "").join("").trim();
}

const ROLES=[{id:"mom",l:"Mom",e:"👩"},{id:"dad",l:"Dad",e:"👨"},{id:"child",l:"Child",e:"🧒"},{id:"baby",l:"Baby",e:"👶"},{id:"grandma",l:"Grandma",e:"👵"},{id:"grandpa",l:"Grandpa",e:"👴"},{id:"pet",l:"Pet",e:"🐾"},{id:"other",l:"Other",e:"🌟"}];
const STYLES=[{id:"wc",n:"Watercolor",t:"Dreamy & classic",m:"Timeless",e:"🎨",c:"sc-wc"},{id:"px",n:"Pixar 3D",t:"Cinematic magic",m:"Epic",e:"🌟",c:"sc-px"},{id:"sk",n:"Storybook Sketch",t:"Cozy & hand-drawn",m:"Cozy",e:"✏️",c:"sc-sk"},{id:"an",n:"Anime",t:"Vibrant & expressive",m:"Exciting",e:"🌸",c:"sc-an"},{id:"re",n:"Realistic",t:"Lifelike portraits",m:"Premium",e:"📸",c:"sc-re"},{id:"pl",n:"Soft Plush",t:"Stuffed animal world",m:"Gentle",e:"🧸",c:"sc-pl"}];
const SPARKS=[{id:"adventure",e:"🗺️",t:"Big Adventure",s:"They discover something amazing"},{id:"magic",e:"✨",t:"Magic Kingdom",s:"Where anything is possible"},{id:"bedtime",e:"🌙",t:"Bedtime Journey",s:"A cozy dream adventure"},{id:"superhero",e:"🦸",t:"Superhero Day",s:"They save the day!"},{id:"nature",e:"🌿",t:"Into the Wild",s:"Forest, ocean & jungle"},{id:"space",e:"🚀",t:"Space Explorer",s:"Stars & galaxies await"},{id:"friendship",e:"🤝",t:"New Friend",s:"A heartwarming bond"},{id:"sports",e:"⚽",t:"The Big Game",s:"Dream big, play bigger"},{id:"custom",e:"💭",t:"My Own Idea",s:"Type anything…"}];
const LOVES=[{id:"d",e:"🦕",l:"Dinosaurs"},{id:"u",e:"🦄",l:"Unicorns"},{id:"s",e:"🚀",l:"Space"},{id:"o",e:"🌊",l:"Ocean"},{id:"dr",e:"🐉",l:"Dragons"},{id:"sp",e:"⚽",l:"Sports"},{id:"mu",e:"🎵",l:"Music"},{id:"an",e:"🐾",l:"Animals"},{id:"ma",e:"🪄",l:"Magic"},{id:"ca",e:"🚗",l:"Cars"},{id:"ar",e:"🎨",l:"Art"},{id:"fo",e:"🍕",l:"Food"}];
const MOODS=[{id:"funny",e:"😂",l:"Funny & silly"},{id:"warm",e:"🥰",l:"Heartwarming"},{id:"exciting",e:"🎉",l:"Exciting"},{id:"bed",e:"🌙",l:"Cozy bedtime"},{id:"epic",e:"🦸",l:"Epic adventure"}];
const SREACT={adventure:"Ooh, an adventure! 🗺️ I love it already...",magic:"A magic kingdom — this is going to be enchanting ✨",bedtime:"A cozy bedtime story 🌙 So dreamy...",superhero:"SUPERHERO DAY!! 🦸 They'll feel so powerful!",nature:"Into the wild 🌿 I can hear the birds already...",space:"SPACE!! 🚀 Out of this world!",friendship:"A friendship story 🤝 These always make me emotional...",sports:"Game day!! ⚽ Let's make it legendary!",custom:"Your own unique idea — the best kind! 💭"};

async function genStory(cast,style,data){
  const cd=cast.map(c=>`${c.name} (${ROLES.find(r=>r.id===c.role)?.l}${c.age?`, age ${c.age}`:""})`).join(", ");
  const raw=await claudeCall(`Create a personalized children's picture book. Return ONLY valid JSON no markdown: {"title":"...","pages":[{"emoji":"...","text":"..."}]}. Exactly 5 pages. Each: expressive emoji + 2 warm vivid sentences, picture-book voice, use real names. Magical, age-appropriate.`,`Cast: ${cd}. Hero: ${data.hero}. Story: ${data.spark}. Loves: ${data.loves}. Mood: ${data.mood}. Style: ${style}.`);
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}
async function editTxt(text,inst,cast){
  return claudeCall("Edit a single children's book page. Return ONLY the new text — exactly 2 sentences, warm picture-book voice, no quotes.",`Current: "${text}"\nInstruction: "${inst}"\nCharacters: ${cast.map(c=>c.name).join(", ")}`,200);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,400&family=Nunito:wght@500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;}
body{font-family:'Nunito',sans-serif;background:#FEF7ED;color:#2C1810;}
:root{--terra:#C85D2A;--tlt:#E8845A;--tpal:#FFF0E8;--ink:#2C1810;--mid:#6B3D2E;--lt:#A0614A;--ghost:#D4A898;--gold:#F0B429;--glt:#FDE68A;--sh:0 2px 16px rgba(44,24,16,.08);--shh:0 6px 32px rgba(200,93,42,.18);--r:16px;--rp:999px;}
.app{min-height:100vh;background:#FEF7ED;}
.land{min-height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.land-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 0%,#FFE0CC,transparent 60%),radial-gradient(ellipse 60% 50% at 80% 20%,#FDE8C0,transparent 55%),#FEF7ED;}
.land-nav{position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:18px 24px;}
.logo{font-family:'Fraunces',serif;font-size:20px;font-weight:900;color:var(--terra);}
.nav-btn{background:var(--terra);color:white;border:none;border-radius:var(--rp);padding:9px 22px;font-family:'Nunito';font-size:13px;font-weight:800;cursor:pointer;}
.land-body{position:relative;z-index:5;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px 40px;text-align:center;}
.land-badge{display:inline-flex;align-items:center;gap:7px;background:#FFFBEB;border:1.5px solid var(--glt);border-radius:var(--rp);padding:7px 16px;font-size:12px;font-weight:800;color:#92600A;margin-bottom:24px;}
.land-h1{font-family:'Fraunces',serif;font-size:clamp(38px,8vw,72px);font-weight:900;line-height:.95;color:#1A0A00;letter-spacing:-1px;margin-bottom:18px;}
.land-h1 em{color:var(--terra);font-style:italic;}
.land-p{font-size:16px;color:var(--mid);line-height:1.65;font-weight:600;max-width:460px;margin:0 auto 36px;}
.land-cta{background:var(--terra);color:white;border:none;border-radius:var(--rp);padding:18px 48px;font-family:'Nunito';font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 6px 28px rgba(200,93,42,.4);transition:all .2s;margin-bottom:16px;display:inline-flex;align-items:center;gap:9px;}
.land-cta:hover{transform:translateY(-3px);}
.land-note{font-size:13px;color:var(--lt);font-weight:700;margin-bottom:32px;}
.land-steps{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.land-step{background:white;border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:10px 18px;font-size:13px;font-weight:700;color:var(--mid);}
.book-mock{position:relative;width:200px;height:240px;margin:0 auto 32px;}
.bk-back{position:absolute;top:10px;right:-8px;width:170px;height:210px;background:linear-gradient(135deg,#FFD4A3,#FFBC80);border-radius:14px;}
.bk-mid{position:absolute;top:5px;right:-3px;width:170px;height:210px;background:linear-gradient(135deg,#FDE8C0,#FFD4A3);border-radius:14px;}
.bk-front{position:absolute;top:0;left:0;width:170px;height:210px;background:white;border-radius:14px;box-shadow:0 12px 40px rgba(44,24,16,.15);overflow:hidden;display:flex;flex-direction:column;}
.bk-img{flex:1;background:linear-gradient(135deg,#FFE8D0,#FFD4E8,#D0E8FF);display:flex;align-items:center;justify-content:center;font-size:52px;}
.bk-txt{padding:10px 14px;}
.bk-ttl{font-family:'Fraunces',serif;font-size:11px;font-weight:700;color:var(--ink);font-style:italic;}
.bk-sub{font-size:10px;color:var(--lt);font-weight:700;margin-top:2px;}
.bk-badge{position:absolute;top:-10px;right:-14px;background:var(--gold);border-radius:var(--rp);padding:5px 12px;font-size:11px;font-weight:900;color:var(--ink);}
.review{display:inline-flex;align-items:center;gap:8px;background:white;border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:8px 16px;font-size:12px;font-weight:700;color:var(--mid);margin-top:12px;}
.stars{color:var(--gold);}
.shell{min-height:100vh;background:#FEF7ED;display:flex;flex-direction:column;align-items:center;padding:0 16px 80px;}
.topbar{width:100%;max-width:640px;display:flex;align-items:center;gap:12px;padding:18px 0 28px;}
.back-btn{background:white;border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:9px 20px;font-family:'Nunito';font-weight:800;font-size:13px;color:var(--terra);cursor:pointer;}
.back-btn:hover{background:var(--tpal);}
.prog-wrap{flex:1;display:flex;flex-direction:column;gap:5px;}
.prog{height:5px;background:#F0DDD4;border-radius:var(--rp);overflow:hidden;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--terra),var(--tlt));border-radius:var(--rp);transition:width .5s cubic-bezier(.4,0,.2,1);}
.prog-lbl{font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;text-align:right;letter-spacing:.3px;}
.content{width:100%;max-width:640px;}
.eyebrow{font-size:11px;font-weight:900;color:var(--terra);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;}
.sec-h{font-family:'Fraunces',serif;font-size:clamp(24px,4vw,36px);font-weight:900;color:#1A0A00;margin-bottom:6px;letter-spacing:-.5px;}
.sec-p{font-size:15px;color:var(--mid);font-weight:600;line-height:1.6;margin-bottom:24px;}
.stage{background:linear-gradient(155deg,#FFF7F0,#FEF0E8);border:1.5px solid #F0DDD4;border-radius:22px;padding:24px 18px;margin-bottom:16px;min-height:150px;position:relative;}
.stage-lbl{position:absolute;top:10px;left:14px;font-size:10px;font-weight:900;color:var(--ghost);text-transform:uppercase;letter-spacing:1px;}
.stage-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:110px;opacity:.4;gap:5px;}
.stage-cast{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding-top:4px;}
.cchar{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;position:relative;animation:charPop .4s cubic-bezier(.34,1.56,.64,1) both;}
.cchar-av{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#FFE4C4,#FFD4E8);display:flex;align-items:center;justify-content:center;font-size:24px;border:3px solid white;box-shadow:var(--sh);position:relative;transition:all .2s;}
.cchar:hover .cchar-av{transform:scale(1.07);}
.cchar-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
.hero-ring{position:absolute;inset:-4px;border-radius:50%;border:2.5px solid var(--gold);animation:ring 2s ease-in-out infinite;}
.hero-star{position:absolute;bottom:-1px;right:-1px;background:var(--gold);width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid white;}
.cchar-rm{position:absolute;top:-4px;right:-4px;background:#FF5A5A;color:white;border:2px solid white;border-radius:50%;width:18px;height:18px;font-size:9px;cursor:pointer;display:none;align-items:center;justify-content:center;font-weight:900;}
.cchar:hover .cchar-rm{display:flex;}
.cchar-name{font-size:11px;font-weight:800;color:var(--ink);max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cchar-role{font-size:9px;font-weight:800;color:var(--lt);text-transform:uppercase;}
.hero-tip{background:#FFFBEB;border:1.5px solid var(--glt);border-radius:12px;padding:11px 15px;margin-bottom:18px;font-size:13px;font-weight:700;color:#92600A;display:flex;align-items:center;gap:9px;line-height:1.4;}
.add-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:22px;}
.add-btn{background:white;border:1.5px dashed #F0DDD4;border-radius:13px;padding:11px 5px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:all .17s;font-family:'Nunito';}
.add-btn:hover{border-color:var(--terra);background:var(--tpal);transform:translateY(-2px);}
.ab-em{font-size:18px;}.ab-lbl{font-size:9px;font-weight:800;color:var(--mid);text-align:center;}
.overlay{position:fixed;inset:0;background:rgba(28,14,8,.6);backdrop-filter:blur(8px);z-index:300;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s;}
.modal{background:white;width:100%;max-width:460px;border-radius:24px 24px 0 0;padding:22px 22px 28px;box-shadow:0 -8px 60px rgba(0,0,0,.2);animation:sheetUp .3s cubic-bezier(.4,0,.2,1);position:relative;max-height:88vh;overflow-y:auto;}
.modal-handle{width:36px;height:4px;background:#E5D0C8;border-radius:2px;margin:0 auto 18px;}
.modal-x{position:absolute;top:16px;right:16px;background:#F5EBE0;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;color:var(--mid);font-weight:900;}
.m-h{font-family:'Fraunces',serif;font-size:22px;font-weight:700;margin-bottom:3px;}
.m-s{font-size:13px;font-weight:600;color:var(--mid);margin-bottom:18px;line-height:1.4;}
.rtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;}
.rtab{border:1.5px solid #F0DDD4;border-radius:11px;padding:8px 4px;text-align:center;cursor:pointer;transition:all .14s;background:white;font-family:'Nunito';}
.rtab:hover,.rtab.on{border-color:var(--terra);background:var(--tpal);}
.rt-em{font-size:17px;display:block;margin-bottom:3px;}.rt-lb{font-size:9px;font-weight:800;color:var(--ink);text-transform:uppercase;}
.pdrop{border:2px dashed #F0DDD4;border-radius:13px;padding:18px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:13px;background:#FDFAF8;position:relative;overflow:hidden;}
.pdrop:hover{border-color:var(--terra);background:var(--tpal);}
.pdrop.has{border-style:solid;border-color:var(--terra);padding:0;}
.pdrop.has img{width:100%;height:130px;object-fit:cover;border-radius:11px;display:block;}
.pd-ch{position:absolute;bottom:7px;right:7px;background:rgba(0,0,0,.5);color:white;border:none;border-radius:7px;padding:4px 10px;font-size:10px;font-weight:800;cursor:pointer;font-family:'Nunito';}
.f-lbl{font-size:10px;font-weight:900;color:var(--lt);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;}
.f-inp{width:100%;border:1.5px solid #F0DDD4;border-radius:11px;padding:11px 13px;font-family:'Nunito';font-size:14px;font-weight:700;color:var(--ink);background:#FDFAF8;outline:none;transition:border-color .2s;margin-bottom:13px;}
.f-inp:focus{border-color:var(--terra);}
.m-save{width:100%;background:var(--terra);color:white;border:none;border-radius:11px;padding:13px;font-family:'Nunito';font-size:14px;font-weight:900;cursor:pointer;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:7px;}
.m-save:hover{background:#A84A1F;}.m-save:disabled{background:#D4A898;cursor:not-allowed;}
.style-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;margin-bottom:24px;}
@media(min-width:540px){.style-grid{grid-template-columns:repeat(3,1fr);}}
.style-card{border:2px solid #F0DDD4;border-radius:18px;overflow:hidden;cursor:pointer;transition:all .22s;background:white;position:relative;}
.style-card:hover{border-color:var(--terra);transform:translateY(-3px);box-shadow:var(--shh);}
.style-card.on{border-color:var(--terra);box-shadow:var(--shh);}
.sc-check{position:absolute;top:8px;right:8px;background:var(--terra);color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;opacity:0;transform:scale(.7);transition:all .2s;}
.style-card.on .sc-check{opacity:1;transform:scale(1);}
.sc-prev{height:110px;display:flex;align-items:center;justify-content:center;font-size:46px;position:relative;overflow:hidden;}
.sc-wc{background:linear-gradient(135deg,#ffecd2,#fcb69f,#ffeaa7);}
.sc-px{background:linear-gradient(160deg,#0f0c29,#302b63,#24243e);}
.sc-sk{background:#F8F6F0;background-image:repeating-linear-gradient(0deg,#E8E4DC,#E8E4DC 1px,transparent 1px,transparent 18px),repeating-linear-gradient(90deg,#E8E4DC,#E8E4DC 1px,transparent 1px,transparent 18px);}
.sc-an{background:linear-gradient(135deg,#667eea,#f093fb,#fda085);}
.sc-re{background:linear-gradient(160deg,#1a1a2e,#16213e,#0f3460);}
.sc-pl{background:linear-gradient(135deg,#fccb90,#d57eeb,#a0d8ef);}
.sc-em{position:relative;z-index:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,.2));transition:transform .2s;}
.style-card:hover .sc-em{transform:scale(1.1);}
.sc-info{padding:11px 13px;}.sc-name{font-family:'Fraunces',serif;font-size:14px;font-weight:700;color:var(--ink);margin-bottom:2px;}
.sc-tag{font-size:11px;color:var(--mid);font-weight:600;}
.sc-mood{display:inline-block;background:var(--tpal);border-radius:var(--rp);padding:2px 8px;font-size:9px;font-weight:800;color:var(--terra);margin-top:4px;}
.chat-shell{height:100vh;display:flex;flex-direction:column;background:#FEF7ED;}
.chat-top{display:flex;align-items:center;gap:10px;padding:13px 14px 10px;background:white;border-bottom:1.5px solid #F0DDD4;flex-shrink:0;}
.chat-back{background:var(--tpal);border:none;border-radius:var(--rp);padding:7px 15px;font-family:'Nunito';font-weight:800;font-size:12px;color:var(--terra);cursor:pointer;}
.chat-prog-w{flex:1;display:flex;flex-direction:column;gap:4px;}
.chat-stori{display:flex;align-items:center;gap:7px;flex-shrink:0;}
.cs-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--terra),#A78BFA);display:flex;align-items:center;justify-content:center;font-size:14px;}
.cs-name{font-weight:900;font-size:12px;color:var(--ink);}.cs-online{font-size:10px;color:#6EE7B7;font-weight:800;}
.msgs{flex:1;overflow-y:auto;padding:14px 13px 6px;display:flex;flex-direction:column;gap:3px;}
.mrow{display:flex;gap:6px;align-items:flex-end;}
.mrow.ai{animation:msgIn .35s cubic-bezier(.4,0,.2,1) both;}
.mrow.hu{flex-direction:row-reverse;animation:msgInR .3s cubic-bezier(.4,0,.2,1) both;}
.av-sm{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;background:linear-gradient(135deg,var(--terra),#A78BFA);}
.bub{max-width:76%;padding:10px 14px;font-size:14px;font-weight:700;line-height:1.55;border-radius:17px;}
.bub.ai{background:white;color:var(--ink);border:1.5px solid #F0DDD4;border-bottom-left-radius:4px;box-shadow:var(--sh);}
.bub.ai strong{color:var(--terra);}
.bub.hu{background:linear-gradient(135deg,var(--terra),var(--tlt));color:white;border-bottom-right-radius:4px;box-shadow:0 3px 14px rgba(200,93,42,.28);}
.typing-r{display:flex;gap:6px;align-items:flex-end;animation:msgIn .3s ease both;}
.typing-b{background:white;border:1.5px solid #F0DDD4;border-radius:17px 17px 17px 4px;padding:12px 15px;display:flex;gap:5px;box-shadow:var(--sh);}
.dot{width:7px;height:7px;background:var(--ghost);border-radius:50%;animation:tdB 1.1s infinite;}
.dot:nth-child(2){animation-delay:.18s;}.dot:nth-child(3){animation-delay:.36s;}
.tray{flex-shrink:0;padding:7px 13px 10px;background:#FEF7ED;}
.tray-lbl{font-size:10px;font-weight:900;color:var(--ghost);text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px;display:flex;align-items:center;gap:6px;}
.tray-lbl::before,.tray-lbl::after{content:'';flex:1;height:1px;background:#F0DDD4;}
.sug-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.sgcard{background:white;border:1.5px solid #F0DDD4;border-radius:13px;padding:9px 6px 8px;text-align:center;cursor:pointer;transition:all .16s;}
.sgcard:hover{border-color:var(--terra);transform:translateY(-2px);box-shadow:var(--shh);}
.sg-em{font-size:22px;display:block;margin-bottom:4px;transition:transform .14s;}
.sgcard:hover .sg-em{transform:scale(1.1);}
.sg-ttl{font-family:'Fraunces',serif;font-size:11px;font-weight:700;color:var(--ink);margin-bottom:1px;}
.sg-sub{font-size:9px;color:var(--mid);font-weight:600;}
.pill-row{display:flex;flex-wrap:wrap;gap:6px;}
.pill{background:white;border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:7px 13px;font-family:'Nunito';font-size:13px;font-weight:800;color:var(--mid);cursor:pointer;transition:all .14s;display:flex;align-items:center;gap:6px;}
.pill:hover{border-color:var(--terra);color:var(--terra);background:var(--tpal);}
.pill img{width:17px;height:17px;border-radius:50%;object-fit:cover;}
.ded-ta{width:100%;border:1.5px solid #F0DDD4;border-radius:11px;padding:10px 12px;font-family:'Fraunces',serif;font-size:13px;font-style:italic;color:var(--ink);background:white;outline:none;resize:none;line-height:1.65;margin-bottom:7px;}
.ded-ta:focus{border-color:var(--terra);}
.ded-row{display:flex;gap:7px;}
.ded-skip{flex:1;background:white;border:1.5px solid #F0DDD4;border-radius:11px;padding:9px;font-family:'Nunito';font-size:12px;font-weight:800;color:var(--mid);cursor:pointer;}
.ded-use{flex:2;background:var(--terra);color:white;border:none;border-radius:11px;padding:9px;font-family:'Nunito';font-size:12px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;}
.recap{background:white;border:1.5px solid #F0DDD4;border-radius:13px;padding:13px;display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px;}
.rc-lbl{font-size:9px;font-weight:900;color:var(--lt);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}
.rc-val{font-size:13px;font-weight:800;color:var(--ink);}
.final-cta{width:100%;background:var(--terra);color:white;border:none;border-radius:13px;padding:14px;font-family:'Nunito';font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 5px 24px rgba(200,93,42,.4);display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;}
.final-cta:hover{transform:translateY(-2px);}
.ibar{flex-shrink:0;padding:8px 13px 13px;background:white;border-top:1.5px solid #F0DDD4;display:flex;gap:7px;align-items:flex-end;}
.iwrap{flex:1;background:#FEF7ED;border:1.5px solid #F0DDD4;border-radius:19px;padding:8px 13px;display:flex;align-items:flex-end;gap:6px;transition:border-color .2s;}
.iwrap:focus-within{border-color:var(--terra);background:white;}
.ita{flex:1;border:none;background:transparent;font-family:'Nunito';font-size:14px;font-weight:700;color:var(--ink);outline:none;resize:none;max-height:80px;min-height:19px;line-height:1.4;}
.ita::placeholder{color:var(--ghost);}
.isend{width:32px;height:32px;border-radius:50%;background:var(--terra);color:white;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s;flex-shrink:0;}
.isend:hover{background:#A84A1F;}.isend:disabled{background:#E5C9BD;cursor:not-allowed;}
.prev-wrap{width:100%;max-width:680px;}
.prev-top{text-align:center;margin-bottom:24px;}
.prev-h{font-family:'Fraunces',serif;font-size:clamp(22px,4vw,38px);font-weight:900;color:#1A0A00;margin-bottom:5px;letter-spacing:-.5px;}
.prev-meta{font-size:13px;color:var(--mid);font-weight:700;margin-bottom:6px;}
.prev-hint{font-size:11px;color:var(--ghost);font-weight:700;}
.ded-pg{background:linear-gradient(135deg,#FFFBEB,#FFF7F0);border:1.5px solid var(--glt);border-radius:18px;padding:36px 28px;text-align:center;margin-bottom:12px;box-shadow:var(--sh);}
.ded-pg-text{font-family:'Fraunces',serif;font-size:16px;font-style:italic;color:var(--ink);line-height:1.8;}
.spreads{display:flex;flex-direction:column;gap:11px;margin-bottom:22px;}
.spread{background:white;border-radius:18px;border:1.5px solid #F0DDD4;box-shadow:var(--sh);transition:all .2s;animation:pageIn .4s ease both;}
.spread:hover{box-shadow:var(--shh);}
.spread-in{display:grid;grid-template-columns:160px 1fr;}
.spread:nth-child(even) .spread-in{grid-template-columns:1fr 160px;}
.spread:nth-child(even) .sp-art{order:2;border-radius:0 18px 18px 0;}
.spread:nth-child(even) .sp-txt{order:1;border-radius:18px 0 0 18px;}
@media(max-width:480px){
  .spread-in,.spread:nth-child(even) .spread-in{grid-template-columns:1fr;grid-template-rows:140px auto;}
  .sp-art{border-radius:18px 18px 0 0!important;order:1!important;}
  .sp-txt{border-radius:0 0 18px 18px!important;order:2!important;}
}
.sp-art{background:linear-gradient(135deg,#FFE8D0,#FFD4E8);display:flex;align-items:center;justify-content:center;min-height:150px;border-radius:18px 0 0 18px;position:relative;overflow:hidden;}
.sp-art::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 12px,rgba(255,255,255,.05) 12px,rgba(255,255,255,.05) 24px);}
.sp-em{font-size:58px;position:relative;z-index:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,.1));transition:transform .25s;}
.spread:hover .sp-em{transform:scale(1.06);}
.sp-txt{padding:20px 22px;display:flex;flex-direction:column;gap:9px;justify-content:space-between;border-radius:0 18px 18px 0;}
.sp-num{font-size:10px;font-weight:900;color:var(--ghost);text-transform:uppercase;letter-spacing:1px;}
.sp-story{font-family:'Fraunces',serif;font-size:14px;line-height:1.85;color:var(--ink);font-style:italic;flex:1;}
.sp-acts{display:flex;gap:6px;flex-wrap:wrap;}
.sp-act{border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:5px 12px;font-family:'Nunito';font-size:11px;font-weight:800;color:var(--mid);background:white;cursor:pointer;transition:all .13s;display:flex;align-items:center;gap:4px;}
.sp-act:hover{border-color:var(--terra);color:var(--terra);background:var(--tpal);}
.ed-drawer{background:var(--tpal);border:1.5px solid #F0DDD4;border-top:none;border-radius:0 0 18px 18px;padding:14px 20px;animation:drawerDn .22s ease;}
.ed-ttl{font-size:11px;font-weight:900;color:var(--terra);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px;}
.ed-sugs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}
.ed-sug{background:white;border:1.5px solid #F0DDD4;border-radius:var(--rp);padding:5px 11px;font-size:11px;font-weight:800;color:var(--mid);cursor:pointer;font-family:'Nunito';transition:all .13s;}
.ed-sug:hover{border-color:var(--terra);color:var(--terra);}
.ed-row{display:flex;gap:7px;}
.ed-inp{flex:1;border:1.5px solid #F0DDD4;border-radius:11px;padding:9px 13px;font-family:'Nunito';font-size:13px;font-weight:700;color:var(--ink);background:white;outline:none;resize:none;}
.ed-inp:focus{border-color:var(--terra);}
.ed-send{background:var(--terra);color:white;border:none;border-radius:10px;padding:0 14px;font-size:15px;cursor:pointer;display:flex;align-items:center;}
.ed-send:disabled{background:#D4A898;cursor:not-allowed;}
.final-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
.f-btn{border-radius:14px;padding:14px;font-family:'Nunito';font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px;}
.f-pri{background:var(--terra);color:white;border:none;box-shadow:0 4px 18px rgba(200,93,42,.3);}
.f-pri:hover{transform:translateY(-2px);}
.f-sec{background:white;color:var(--terra);border:1.5px solid #F0DDD4;}
.f-sec:hover{background:var(--tpal);}
.loading{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#FEF7ED;padding:32px;}
.load-ring{width:56px;height:56px;border-radius:50%;border:5px solid #F0DDD4;border-top-color:var(--terra);animation:spin .9s linear infinite;}
.load-h{font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:var(--ink);text-align:center;}
.load-steps{display:flex;flex-direction:column;gap:7px;margin-top:6px;width:100%;max-width:240px;}
.ls{font-size:13px;font-weight:700;color:var(--ghost);display:flex;align-items:center;gap:7px;transition:all .4s;}
.ls.act{color:var(--terra);}.ls.dn{color:#6EE7B7;}
.big-btn{width:100%;background:var(--terra);color:white;border:none;border-radius:16px;padding:16px;font-family:'Nunito';font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 5px 24px rgba(200,93,42,.35);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;}
.big-btn:hover{transform:translateY(-2px);}.big-btn:disabled{background:#D4A898;cursor:not-allowed;box-shadow:none;transform:none;}
@keyframes charPop{from{opacity:0;transform:scale(.7) translateY(16px);}to{opacity:1;transform:scale(1) translateY(0);}}
@keyframes ring{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.6;transform:scale(1.08);}}
@keyframes msgIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
@keyframes msgInR{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}
@keyframes tdB{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes sheetUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pageIn{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes drawerDn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
`;

function CharModal({preset,existing,onSave,onClose}){
  const [role,setRole]=useState(existing?.role||preset||"child");
  const [name,setName]=useState(existing?.name||"");
  const [age,setAge]=useState(existing?.age||"");
  const [photo,setPhoto]=useState(existing?.photo||null);
  const fileRef=useRef();
  const ro=ROLES.find(r=>r.id===role);
  const handleFile=f=>{if(!f)return;const r=new FileReader();r.onload=e=>setPhoto(e.target.result);r.readAsDataURL(f);};
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <button className="modal-x" onClick={onClose}>✕</button>
        <div className="m-h">{existing?"Edit character":"Add a character"}</div>
        <div className="m-s">Add a photo to make illustrations extra special ✨</div>
        <div className="rtabs">{ROLES.map(r=><button key={r.id} className={`rtab${role===r.id?" on":""}`} onClick={()=>setRole(r.id)}><span className="rt-em">{r.e}</span><span className="rt-lb">{r.l}</span></button>)}</div>
        <div className={`pdrop${photo?" has":""}`} onClick={()=>fileRef.current.click()}>
          {photo?<><img src={photo} alt=""/><button className="pd-ch" onClick={e=>{e.stopPropagation();fileRef.current.click();}}>Change</button></>:<><div style={{fontSize:32,marginBottom:8}}>{ro?.e}</div><div style={{fontWeight:800,fontSize:14}}>Add a photo (optional)</div><div style={{fontSize:12,color:"var(--lt)",marginTop:3}}>Makes illustrations much more personal</div></>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        <label className="f-lbl">Name *</label>
        <input className="f-inp" value={name} onChange={e=>setName(e.target.value)} placeholder={role==="pet"?"e.g. Buddy":role==="mom"?"e.g. Sarah":"e.g. Emma"}/>
        {["child","baby"].includes(role)&&<><label className="f-lbl">Age</label><input className="f-inp" value={age} onChange={e=>setAge(e.target.value)} type="number" min="0" max="17" placeholder="e.g. 5"/></>}
        <button className="m-save" disabled={!name.trim()} onClick={()=>onSave({id:existing?.id||Date.now(),role,name:name.trim(),age,photo,emoji:ro.e})}>{existing?"Save changes ✓":`Add ${name||ro.l} to story ✨`}</button>
      </div>
    </div>
  );
}

function CastStep({onNext,onBack}){
  const [cast,setCast]=useState([]);
  const [modal,setModal]=useState(null);
  const save=c=>{setCast(p=>p.find(x=>x.id===c.id)?p.map(x=>x.id===c.id?c:x):[...p,c]);setModal(null);};
  const toggleHero=id=>setCast(c=>c.map(x=>({...x,isHero:x.id===id?!x.isHero:false})));
  return(
    <div className="shell">
      {modal&&<CharModal preset={modal._new?modal.role:undefined} existing={!modal._new?modal:undefined} onSave={save} onClose={()=>setModal(null)}/>}
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap"><div className="prog"><div className="prog-fill" style={{width:"25%"}}/></div><div className="prog-lbl">Step 1 of 4 · Build your cast</div></div>
      </div>
      <div className="content">
        <div className="eyebrow">Cast Builder</div>
        <h2 className="sec-h">Who's in this story?</h2>
        <p className="sec-p">Add everyone who should appear — then tap a character to make them the ⭐ hero.</p>
        <div className="stage">
          <div className="stage-lbl">Your story cast</div>
          {cast.length===0?<div className="stage-empty"><div style={{fontSize:40}}>🎭</div><div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:700,color:"var(--mid)"}}>Your cast will appear here</div></div>
          :<div className="stage-cast">{cast.map((c,i)=><div key={c.id} className="cchar" style={{animationDelay:`${i*.07}s`}} onClick={()=>toggleHero(c.id)}>
            <button className="cchar-rm" onClick={e=>{e.stopPropagation();setCast(p=>p.filter(x=>x.id!==c.id));}}>✕</button>
            <div className="cchar-av">{c.isHero&&<div className="hero-ring"/>}{c.photo?<img src={c.photo} alt=""/>:c.emoji}{c.isHero&&<div className="hero-star">⭐</div>}</div>
            <div className="cchar-name">{c.name}</div>
            <div className="cchar-role">{ROLES.find(r=>r.id===c.role)?.l}{c.age?`, ${c.age}`:""}</div>
          </div>)}</div>}
        </div>
        {cast.length>0&&<div className="hero-tip">💡 Tap any character to crown them the <strong>⭐ hero</strong>. Tap again to remove.</div>}
        <div className="add-grid">{ROLES.map(r=><button key={r.id} className="add-btn" onClick={()=>setModal({_new:true,role:r.id})}><span className="ab-em">{r.e}</span><span className="ab-lbl">Add {r.l}</span></button>)}</div>
        <button className="big-btn" disabled={cast.length===0} onClick={()=>onNext(cast)}>{cast.length===0?"Add at least one character":`Continue with ${cast.length} character${cast.length!==1?"s":""} →`}</button>
      </div>
    </div>
  );
}

function StyleStep({onNext,onBack}){
  const [sel,setSel]=useState(null);
  return(
    <div className="shell">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap"><div className="prog"><div className="prog-fill" style={{width:"50%"}}/></div><div className="prog-lbl">Step 2 of 4 · Art style</div></div>
      </div>
      <div className="content">
        <div className="eyebrow">Illustration Style</div>
        <h2 className="sec-h">How should it look?</h2>
        <p className="sec-p">Every page will be illustrated in this style. Take your time — this is the vibe of the whole book.</p>
        <div className="style-grid">
          {STYLES.map((s,i)=><div key={s.id} className={`style-card${sel===s.id?" on":""}`} style={{animationDelay:`${i*.06}s`,animation:"msgIn .4s ease both"}} onClick={()=>setSel(s.id)}>
            <div className="sc-check">✓</div>
            <div className={`sc-prev ${s.c}`}><span className="sc-em">{s.e}</span></div>
            <div className="sc-info"><div className="sc-name">{s.n}</div><div className="sc-tag">{s.t}</div><div className="sc-mood">{s.m}</div></div>
          </div>)}
        </div>
        <button className="big-btn" disabled={!sel} onClick={()=>onNext(STYLES.find(s=>s.id===sel)?.n||sel)}>{sel?`Continue with ${STYLES.find(s=>s.id===sel)?.n} →`:"Choose a style to continue"}</button>
      </div>
    </div>
  );
}

function ChatStep({cast,style,onNext,onBack}){
  const hero=cast.find(c=>c.isHero)||cast[0];
  const [phase,setPhase]=useState("spark");
  const [ans,setAns]=useState({});
  const [msgs,setMsgs]=useState([]);
  const [inp,setInp]=useState("");
  const [ded,setDed]=useState(`For ${cast.filter(c=>["child","baby"].includes(c.role)).map(c=>c.name).join(" & ")||"our little ones"}, who make every day magical. ❤️`);
  const [showTray,setShowTray]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadStep,setLoadStep]=useState(0);
  const [booted,setBooted]=useState(false);
  const endRef=useRef();
  const taRef=useRef();
  const scroll=()=>setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
  const addAI=(text,cb)=>{
    const id=Date.now();
    setMsgs(m=>[...m,{id,type:"typing"}]);scroll();
    setTimeout(()=>{setMsgs(m=>m.map(x=>x.id===id?{id,type:"ai",text}:x));scroll();setTimeout(()=>cb&&cb(),200);},900);
  };
  const addUser=text=>{setMsgs(m=>[...m,{id:Date.now(),type:"user",text}]);scroll();};
  useEffect(()=>{
    if(booted)return;setBooted(true);
    const names=cast.map(c=>c.name).join(", ");
    addAI(`I've got your cast — **${names}**! 🎉 They're all going to be in this story.`,()=>{
      setTimeout(()=>addAI(`What kind of adventure should this be? Pick one of my ideas below — or just type your own!`,()=>{setShowTray(true);}),600);
    });
  },[]);
  const pickSpark=(id,txt)=>{
    if(ans.spark)return;
    setShowTray(false);setAns(a=>({...a,spark:id,sparkTxt:txt}));setInp("");addUser(txt);
    setTimeout(()=>addAI(SREACT[id]||"Love it! ✨",()=>{setTimeout(()=>addAI(`Who should be the **star** of this story? Tap their name below — or just type it!`,()=>{setPhase("hero");setShowTray(true);}),500);}),300);
  };
  const pickHero=(id,name)=>{
    if(ans.hero)return;
    setShowTray(false);setAns(a=>({...a,hero:id,heroName:name}));setInp("");
    const c=cast.find(x=>x.id===id);addUser(`${c?.emoji||""} ${name}`);
    setTimeout(()=>addAI(`**${name}** is the perfect hero! 🌟`,()=>{setTimeout(()=>addAI(`What does **${name}** absolutely love? I'll weave it into the story! Tap below or type anything.`,()=>{setPhase("loves");setShowTray(true);}),500);}),300);
  };
  const pickLoves=(id,txt)=>{
    if(ans.loves)return;
    setShowTray(false);setAns(a=>({...a,loves:id,lovesTxt:txt}));setInp("");addUser(txt);
    setTimeout(()=>addAI(`${txt}! That's going right into the story 🎯`,()=>{setTimeout(()=>addAI(`Last one — what's the **vibe** of this book? Tap below or describe it!`,()=>{setPhase("mood");setShowTray(true);}),500);}),300);
  };
  const pickMood=(id,txt)=>{
    if(ans.mood)return;
    setShowTray(false);setAns(a=>({...a,mood:id,moodTxt:txt}));setInp("");addUser(txt);
    setTimeout(()=>addAI(`${txt} — that's going to be so beautiful 🥹`,()=>{setTimeout(()=>addAI(`One last touch — want to add a **dedication page**? I wrote one below. Edit it or skip!`,()=>{setPhase("ded");setShowTray(true);}),500);}),300);
  };
  const pickDed=(val)=>{
    setShowTray(false);setAns(a=>({...a,ded:val}));
    if(val!=="skip")addUser(`"${val.slice(0,55)}…"`);else addUser("Skip the dedication");
    setTimeout(()=>addAI(`I have everything I need ✨ Check the summary below — then let's create your book!`,()=>{setPhase("done");setShowTray(true);}),300);
  };
  const handleSend=()=>{
    const v=inp.trim();if(!v)return;setInp("");taRef.current?.focus();
    if(phase==="spark")pickSpark("custom",v);
    else if(phase==="hero"){const found=cast.find(c=>c.name.toLowerCase()===v.toLowerCase());pickHero(found?.id||"custom",found?.name||v);}
    else if(phase==="loves")pickLoves("custom",v);
    else if(phase==="mood")pickMood("custom",v);
  };
  const handleGen=async()=>{
    setLoading(true);
    const steps=["Building characters…","Writing the story…","Designing pages…","Adding the magic…"];
    for(let i=0;i<steps.length;i++){setLoadStep(i);await new Promise(r=>setTimeout(r,1000));}
    try{
      const story=await genStory(cast,style,{hero:ans.heroName||hero.name,spark:ans.sparkTxt||ans.spark,loves:ans.lovesTxt||ans.loves,mood:ans.moodTxt||ans.mood});
      onNext({story,ded:ans.ded!=="skip"?ans.ded:null,style});
    }catch(e){console.error(e);setLoading(false);}
  };
  if(loading)return(<div className="loading"><div style={{fontSize:56}}>📚</div><div className="load-ring"/><div className="load-h">Creating your storybook…</div><div className="load-steps">{["Building characters…","Writing the story…","Designing pages…","Adding the magic…"].map((s,i)=><div key={i} className={`ls${loadStep===i?" act":loadStep>i?" dn":""}`}><span>{loadStep>i?"✓":"→"}</span>{s}</div>)}</div></div>);
  const prog={spark:55,hero:67,loves:78,mood:88,ded:94,done:100};
  const sparkObj=SPARKS.find(s=>s.id===ans.spark);
  return(
    <div className="chat-shell">
      <div className="chat-top">
        <button className="chat-back" onClick={onBack}>← Back</button>
        <div className="chat-prog-w"><div className="prog"><div className="prog-fill" style={{width:`${prog[phase]||55}%`}}/></div><div className="prog-lbl">Step 3 of 4 · Build the story</div></div>
        <div className="chat-stori"><div className="cs-av">✨</div><div><div className="cs-name">Stori</div><div className="cs-online">● Ready</div></div></div>
      </div>
      <div className="msgs">
        {msgs.map(m=>m.type==="typing"?<div key={m.id} className="typing-r"><div className="av-sm">✨</div><div className="typing-b"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
          :m.type==="ai"?<div key={m.id} className="mrow ai"><div className="av-sm">✨</div><div className="bub ai" dangerouslySetInnerHTML={{__html:m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}}/></div>
          :<div key={m.id} className="mrow hu"><div className="bub hu">{m.text}</div></div>)}
        <div ref={endRef}/>
      </div>
      {showTray&&(
        <div className="tray">
          {phase==="spark"&&!ans.spark&&<><div className="tray-lbl">💡 Quick ideas — or type your own below</div><div className="sug-grid">{SPARKS.map(s=><div key={s.id} className="sgcard" onClick={()=>pickSpark(s.id,s.id==="custom"?(inp||s.t):s.t)}><span className="sg-em">{s.e}</span><div className="sg-ttl">{s.t}</div><div className="sg-sub">{s.s}</div></div>)}</div></>}
          {phase==="hero"&&!ans.hero&&<><div className="tray-lbl">👥 Your cast — tap to pick, or type a name</div><div className="pill-row">{cast.map(c=><button key={c.id} className="pill" onClick={()=>pickHero(c.id,c.name)}>{c.photo?<img src={c.photo} alt=""/>:c.emoji} {c.name}</button>)}</div></>}
          {phase==="loves"&&!ans.loves&&<><div className="tray-lbl">❤️ Things kids love — or type your own</div><div className="pill-row">{LOVES.map(l=><button key={l.id} className="pill" onClick={()=>pickLoves(l.id,`${l.e} ${l.l}`)}>{l.e} {l.l}</button>)}</div></>}
          {phase==="mood"&&!ans.mood&&<><div className="tray-lbl">🎭 Pick the vibe — or describe it</div><div className="pill-row">{MOODS.map(m=><button key={m.id} className="pill" onClick={()=>pickMood(m.id,`${m.e} ${m.l}`)}>{m.e} {m.l}</button>)}</div></>}
          {phase==="ded"&&!ans.ded&&<><div className="tray-lbl">📖 Dedication page — edit or skip</div><textarea className="ded-ta" rows={3} value={ded} onChange={e=>setDed(e.target.value)}/><div className="ded-row"><button className="ded-skip" onClick={()=>pickDed("skip")}>Skip</button><button className="ded-use" onClick={()=>pickDed(ded)}>✓ Add dedication</button></div></>}
          {phase==="done"&&<><div className="recap"><div><div className="rc-lbl">Story</div><div className="rc-val">{sparkObj?.e||"💭"} {ans.sparkTxt}</div></div><div><div className="rc-lbl">Hero</div><div className="rc-val">{cast.find(c=>c.id===ans.hero)?.emoji||"🌟"} {ans.heroName}</div></div><div><div className="rc-lbl">They love</div><div className="rc-val">{ans.lovesTxt}</div></div><div><div className="rc-lbl">Vibe</div><div className="rc-val">{ans.moodTxt}</div></div></div><button className="final-cta" onClick={handleGen}>🪄 Write My Storybook!</button></>}
        </div>
      )}
      {!["ded","done"].includes(phase)&&(
        <div className="ibar"><div className="iwrap">
          <textarea ref={taRef} className="ita" rows={1} value={inp}
            onChange={e=>{setInp(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,80)+"px";}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}
            placeholder={phase==="spark"?"Type your story idea… or pick one above":phase==="hero"?"Type a name… or tap above":phase==="loves"?"Type what they love… or tap above":"Describe the vibe… or tap above"}/>
          <button className="isend" onClick={handleSend} disabled={!inp.trim()}>→</button>
        </div></div>
      )}
    </div>
  );
}

function EditDrawer({type,onSave}){
  const [inp,setInp]=useState("");
  const [saving,setSaving]=useState(false);
  const ss=type==="story"?["Make it funnier 😄","More adventurous 🚀","Make it shorter","Add a twist ✨","Cozier 🌙"]:["Change setting 🌿","Add magic ✨","Make it nighttime 🌙","Warmer colors 🌅","Add the pet 🐾"];
  const go=async t=>{if(!t.trim()||saving)return;setSaving(true);await onSave(t);setSaving(false);setInp("");};
  return(
    <div className="ed-drawer">
      <div className="ed-ttl">{type==="story"?"✏️ What should change?":"🎨 How should the art look different?"}</div>
      <div className="ed-sugs">{ss.map(s=><button key={s} className="ed-sug" onClick={()=>go(s)}>{s}</button>)}</div>
      <div className="ed-row">
        <textarea className="ed-inp" rows={2} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go(inp);}}} placeholder="Or describe your change…"/>
        <button className="ed-send" onClick={()=>go(inp)} disabled={!inp.trim()||saving}>{saving?"…":"→"}</button>
      </div>
    </div>
  );
}

function PreviewStep({data,cast,onReset,onBack}){
  const {story,ded,style}=data;
  const [pages,setPages]=useState(story.pages);
  const [activeEdit,setActiveEdit]=useState(null);
  const toggle=(i,t)=>setActiveEdit(a=>a?.i===i&&a?.t===t?null:{i,t});
  const save=async(i,inst,t)=>{
    if(t==="story"){const txt=await editTxt(pages[i].text,inst,cast);setPages(p=>p.map((x,j)=>j===i?{...x,text:txt}:x));}
    else{const e=await claudeCall("Return ONLY a single emoji for a children's book illustration.",`Current: ${pages[i].emoji}. Change: "${inst}"`,20);setPages(p=>p.map((x,j)=>j===i?{...x,emoji:e.trim()}:x));}
    setActiveEdit(null);
  };
  return(
    <div className="shell">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap"><div className="prog"><div className="prog-fill" style={{width:"100%"}}/></div><div className="prog-lbl">Step 4 of 4 · Your storybook!</div></div>
      </div>
      <div className="prev-wrap">
        <div className="prev-top">
          <div style={{fontSize:44,marginBottom:10}}>🎊</div>
          <h2 className="prev-h">{story.title}</h2>
          <div className="prev-meta">{style} style · {pages.length} pages</div>
          <div className="prev-hint">Tap ✏️ or 🎨 on any page to edit it</div>
        </div>
        {ded&&<div className="ded-pg"><div style={{fontSize:28,marginBottom:10}}>📖</div><div className="ded-pg-text">{ded}</div></div>}
        <div className="spreads">
          {pages.map((p,i)=>(
            <div key={i} style={{borderRadius:18,overflow:"hidden",boxShadow:"var(--sh)"}}>
              <div className="spread"><div className="spread-in">
                <div className="sp-art"><span className="sp-em">{p.emoji}</span></div>
                <div className="sp-txt">
                  <div><div className="sp-num">Page {i+1}</div><div className="sp-story">{p.text}</div></div>
                  <div className="sp-acts">
                    <button className="sp-act" onClick={()=>toggle(i,"story")}>✏️ Edit story</button>
                    <button className="sp-act" onClick={()=>toggle(i,"art")}>🎨 Edit art</button>
                    <button className="sp-act" onClick={async()=>{const t=await editTxt(p.text,"regenerate fresh, same characters",cast);setPages(x=>x.map((y,j)=>j===i?{...y,text:t}:y));}}>🔄 Refresh</button>
                  </div>
                </div>
              </div></div>
              {activeEdit?.i===i&&<EditDrawer type={activeEdit.t} onSave={inst=>save(i,inst,activeEdit.t)}/>}
            </div>
          ))}
        </div>
        <div className="final-row">
          <button className="f-btn f-pri">🖨️ Print Book</button>
          <button className="f-btn f-pri">📱 Save PDF</button>
          <button className="f-btn f-sec">🔗 Share link</button>
          <button className="f-btn f-sec">🎁 Gift this</button>
        </div>
        <button onClick={onReset} style={{width:"100%",marginTop:10,borderRadius:14,padding:14,fontFamily:"'Nunito'",fontSize:14,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:"transparent",color:"var(--mid)",border:"1.5px solid #F0DDD4"}}>✨ Start a new story</button>
      </div>
    </div>
  );
}

function Landing({onStart}){
  return(
    <div className="land">
      <div className="land-bg"/>
      <div className="land-nav">
        <div className="logo">📖 StoriKids</div>
        <button className="nav-btn" onClick={onStart}>Start Free →</button>
      </div>
      <div className="land-body">
        <div className="land-badge">⭐ Loved by 47,000+ families</div>
        <div className="book-mock">
          <div className="bk-back"/><div className="bk-mid"/>
          <div className="bk-front">
            <div className="bk-img">🧒🌟</div>
            <div className="bk-txt"><div className="bk-ttl">Emma and the Magic Forest</div><div className="bk-sub">Personalized · 5 pages</div></div>
          </div>
          <div className="bk-badge">Ready in 2 min ⚡</div>
        </div>
        <h1 className="land-h1">Your family,<br/>their <em>magic</em> story.</h1>
        <p className="land-p">Add your kids and family, pick an art style, and our AI writes a gorgeous personalized picture book in minutes. A gift they'll keep forever.</p>
        <button className="land-cta" onClick={onStart}>Create Our Story ✨</button>
        <div className="land-note">Free to try · No account needed</div>
        <div className="land-steps">{["👨‍👩‍👧 Build your cast","🎨 Pick art style","✨ AI writes it","📚 Print & share"].map(s=><div key={s} className="land-step">{s}</div>)}</div>
        <div className="review" style={{marginTop:16}}><span className="stars">★★★★★</span><span>"My daughter cried happy tears" — Jessica M.</span></div>
      </div>
    </div>
  );
}

export default function App(){
  const [step,setStep]=useState("landing");
  const [cast,setCast]=useState([]);
  const [style,setStyle]=useState(null);
  const [result,setResult]=useState(null);
  return(
    <div className="app">
      <style>{CSS}</style>
      {step==="landing"&&<Landing onStart={()=>setStep("cast")}/>}
      {step==="cast"&&<CastStep onNext={c=>{setCast(c);setStep("style");}} onBack={()=>setStep("landing")}/>}
      {step==="style"&&<StyleStep onNext={s=>{setStyle(s);setStep("chat");}} onBack={()=>setStep("cast")}/>}
      {step==="chat"&&<ChatStep cast={cast} style={style} onNext={r=>{setResult(r);setStep("preview");}} onBack={()=>setStep("style")}/>}
      {step==="preview"&&<PreviewStep data={result} cast={cast} onReset={()=>{setCast([]);setStyle(null);setResult(null);setStep("landing");}} onBack={()=>setStep("chat")}/>}
    </div>
  );
}
