const btn = document.getElementById('btn');
const listEl = document.getElementById('list');
const mathBtn = document.getElementById('math-btn');
const mathArea = document.getElementById('math-area');

// Client-side limits
const MAX_LINES = 500; // only process the first N lines
const MAX_LINE_LENGTH = 1000; // ignore lines longer than this

btn.addEventListener('click', async () => {
  if (btn.disabled) return;
  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = 'Loading…';
  try {
    const res = await fetch('sentences.txt', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load sentences');
    const text = await res.text();
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, MAX_LINES);
    const sentences = rawLines
      .map(l => {
        const parts = l.split('|');
        return parts.length > 1 ? parts.slice(1).join('|').trim() : l;
      })
      .filter(s => s.length > 0 && s.length <= MAX_LINE_LENGTH);

    if (sentences.length === 0) {
      listEl.innerHTML = '<li>No sentences found.</li>';
      return;
    }

    const picked = [];
    const dictationCount = mathConfig.etteutus_lines || mathConfig.dictation_lines || 4;
    const max = Math.min(dictationCount, sentences.length);
    while (picked.length < max) {
      const i = Math.floor(Math.random() * sentences.length);
      if (!picked.includes(sentences[i])) picked.push(sentences[i]);
    }

    listEl.innerHTML = '';
    picked.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s; // use textContent to avoid XSS
      listEl.appendChild(li);
    });
  } catch (err) {
    listEl.innerHTML = '<li>Error loading sentences.</li>';
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});

// Matemaatika functionality
let currentProblems = [];

function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min }

// Default math configuration (can be overridden by /maths.json in project root)
const defaultMathConfig = {
  min_integer: 1,
  max_integer: 10,
  maximum_sum: 16,
  minimum_difference: 1,
  addition_allowed: true,
  subtraction_allowed: true,
  multiplication_allowed: false,
  division_allowed: false,
  maximum_product: 100,
  minimum_quotient: 1
  ,
  // how many lines to show in the Etteütlus block
  dictation_lines: 4,
  // how many math problems to generate by default
  math_problem_count: 5
};

let mathConfig = Object.assign({}, defaultMathConfig);
// try to load overrides from /maths.json (non-blocking)
loadMathConfig();

async function loadMathConfig(){
  try{
    const resp = await fetch('./config.json', {cache: 'no-store'});
    if(!resp.ok) return; // leave defaults
    const cfg = await resp.json();
    // merge provided values into mathConfig
    mathConfig = Object.assign({}, defaultMathConfig, cfg || {});
    console.log('Loaded maths config', mathConfig);
  }catch(e){
    // ignore and keep defaults
    console.warn('No maths.json found or invalid; using defaults');
  }
}

function generateProblems(count = mathConfig.math_problem_count || 5){
  const problems = [];
  const seen = new Set();
  let attempts = 0;
  const min = mathConfig.min_integer;
  const max = mathConfig.max_integer;
  const ops = [];
  if(mathConfig.addition_allowed) ops.push('+');
  if(mathConfig.subtraction_allowed) ops.push('-');
  if(mathConfig.multiplication_allowed) ops.push('*');
  if(mathConfig.division_allowed) ops.push('/');

  if(ops.length === 0){
    // fallback to + and - if nothing allowed
    ops.push('+','-');
  }

  while(problems.length < count && attempts < 1000){
    attempts++;
    const op = ops[randInt(0, ops.length-1)];
    let x, y, z;

    if(op === '+'){
      // ensure sum <= maximum_sum
      y = randInt(min, max);
      const maxX = Math.min(max, mathConfig.maximum_sum - y);
      if(maxX < min) continue;
      x = randInt(min, maxX);
      z = x + y;
    } else if(op === '-'){
      // ensure difference >= minimum_difference
      y = randInt(min, max);
      const minX = y + mathConfig.minimum_difference;
      if(minX > max) continue;
      x = randInt(minX, max);
      z = x - y;
    } else if(op === '*'){
      // multiplication: ensure product <= maximum_product
      y = randInt(min, max);
      const maxX = Math.min(max, Math.floor(mathConfig.maximum_product / Math.max(1, y)));
      if(maxX < min) continue;
      x = randInt(min, maxX);
      z = x * y;
    } else { // division
      // choose divisor y, then quotient q such that x = q*y fits within range
      y = randInt(min, max);
      const maxQ = Math.floor(max / Math.max(1, y));
      const minQ = Math.max(mathConfig.minimum_quotient, 1);
      if(maxQ < minQ) continue;
      const q = randInt(minQ, maxQ);
      z = q; // z represents quotient here
      x = q * y;
    }

    const unknowns = ['x','y','z'];
    const unknown = unknowns[randInt(0,2)];
    let text;
    if(unknown === 'x') text = `_ ${op} ${y} = ${z}`;
    else if(unknown === 'y') text = `${x} ${op} _ = ${z}`;
    else text = `${x} ${op} ${y} = _`;

    if(seen.has(text)) continue;
    seen.add(text);
    problems.push({x,y,z,op,unknown,text});
  }
  return problems;
}

function renderProblems(probs){
  mathArea.innerHTML = '';
  probs.forEach(p => {
    const li = document.createElement('li');
    li.className = 'math-item';
    li.textContent = p.text;
    mathArea.appendChild(li);
  });
}

mathBtn && mathBtn.addEventListener('click', (e) => {
  mathBtn.disabled = true;
  mathBtn.textContent = 'Loon…';
  currentProblems = generateProblems();
  renderProblems(currentProblems);
  mathBtn.disabled = false;
  mathBtn.textContent = 'Matemaatika!';
});

// Live-reload / dev-watch (best-effort). Enabled on localhost or when ?dev=1
const DEV_MODE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('dev=1'));
let _lastMathsText = null;
let _lastSentencesText = null;

async function fetchText(url){
  try{
    const r = await fetch(url, {cache: 'no-store'});
    if(!r.ok) return null;
    return await r.text();
  }catch(e){
    return null;
  }
}

async function checkForChanges(){
  // maths config: update in-place when changed
  const mathsText = await fetchText('/config.json');
  if(mathsText !== null && mathsText !== _lastMathsText){
    _lastMathsText = mathsText;
    try{
      const parsed = JSON.parse(mathsText);
      mathConfig = Object.assign({}, defaultMathConfig, parsed || {});
      console.log('config.json changed, updated config', mathConfig);
      // regenerate visible problems if math area has items
      if(mathArea && mathArea.children.length > 0){
        currentProblems = generateProblems(currentProblems.length || mathConfig.math_problem_count || 5);
        renderProblems(currentProblems);
      }
    }catch(e){
      console.warn('Invalid maths.json detected; ignoring');
    }
  }

  // sentences: trigger full reload when sentences.txt changes
  const sentencesText = await fetchText('/sentences.txt');
  if(sentencesText !== null && _lastSentencesText !== null && sentencesText !== _lastSentencesText){
    console.log('sentences.txt changed; reloading page');
    location.reload();
    return;
  }
  if(sentencesText !== null) _lastSentencesText = sentencesText;
}

// initialize watcher
if(DEV_MODE){
  // populate initial state
  (async ()=>{
    _lastMathsText = await fetchText('/config.json');
    _lastSentencesText = await fetchText('/sentences.txt');
    // try to apply initial maths config if present
    if(_lastMathsText){
      try{ mathConfig = Object.assign({}, defaultMathConfig, JSON.parse(_lastMathsText) || {}); }catch(e){}
    }
    // poll for changes every 2s
    setInterval(checkForChanges, 2000);
    console.log('Dev-mode live-reload enabled');
  })();
}
