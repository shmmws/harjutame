const btn = document.getElementById('btn');
const listEl = document.getElementById('list');
const mathBtn = document.getElementById('math-btn');
const mathArea = document.getElementById('math-area');

// Guard against missing DOM elements
if (!listEl || !mathArea) {
  console.error('Required DOM elements not found');
}

// Client-side limits
const MAX_LINES = 500; // only process the first N lines
const MAX_LINE_LENGTH = 1000; // ignore lines longer than this

// Utility: Fisher-Yates shuffle for random selection
function shuffleArray(arr) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Utility: Pick N random unique items from an array
function pickRandom(arr, count) {
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, Math.min(count, arr.length));
}

// Utility: Pick sentences based on prefer_sentences_with config
function pickSentences(sentences, preferChars, dictationCount) {
  if (!preferChars || preferChars.length === 0) {
    // No preference filter; pick randomly from all sentences
    return pickRandom(sentences, dictationCount);
  }

  // Filter sentences containing at least one preferred character
  const matchingSentences = sentences.filter(s => {
    const lowerSentence = s.toLowerCase();
    return preferChars.some(char => lowerSentence.includes(char.toLowerCase()));
  });

  if (dictationCount <= 5) {
    // For <= 5 lines: all must contain preferred characters
    if (matchingSentences.length >= dictationCount) {
      return pickRandom(matchingSentences, dictationCount);
    } else {
      // Not enough matches; fall back to all sentences
      return pickRandom(sentences, dictationCount);
    }
  } else {
    // For > 5 lines: at least 75% must contain preferred characters
    const requiredMatches = Math.ceil(dictationCount * 0.75);
    const matchingSet = new Set(matchingSentences);
    const nonMatchingSentences = sentences.filter(s => !matchingSet.has(s));

    const picked = pickRandom(matchingSentences, requiredMatches);
    const remaining = dictationCount - picked.length;
    const additionalPicked = pickRandom(nonMatchingSentences, remaining);
    
    return [...picked, ...additionalPicked];
  }
}

btn && btn.addEventListener('click', async () => {
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

    const preferChars = mathConfig.prefer_sentences_with || [];
    const dictationCount = mathConfig.dictation_lines || 4;
    const picked = pickSentences(sentences, preferChars, dictationCount);

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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Default math configuration (can be overridden by config.json in project root)
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
  minimum_quotient: 1,
  dictation_lines: 4,
  math_problem_count: 5
};

let mathConfig = Object.assign({}, defaultMathConfig);
// try to load overrides from config.json (non-blocking)
loadMathConfig();

async function loadMathConfig() {
  try {
    const resp = await fetch('./config.json', { cache: 'no-store' });
    if (!resp.ok) return; // leave defaults
    const cfg = await resp.json();
    // merge provided values into mathConfig
    mathConfig = Object.assign({}, defaultMathConfig, cfg || {});
    console.log('Loaded config', mathConfig);
  } catch (e) {
    // ignore and keep defaults
    console.warn('config.json not found or invalid; using defaults');
  }
}

// Math operation generators
const mathOperations = {
  '+': (x, y) => x + y,
  '-': (x, y) => x - y,
  '*': (x, y) => x * y,
  '/': (x, y) => x / y
};

// Generate a problem for a given operation
function generateProblem(op, config, seen) {
  const min = config.min_integer;
  const max = config.max_integer;
  let x, y, z;

  if (op === '+') {
    // ensure sum <= maximum_sum
    y = randInt(min, max);
    const maxX = Math.min(max, config.maximum_sum - y);
    if (maxX < min) return null;
    x = randInt(min, maxX);
    z = x + y;
  } else if (op === '-') {
    // ensure difference >= minimum_difference
    y = randInt(min, max);
    const minX = y + config.minimum_difference;
    if (minX > max) return null;
    x = randInt(minX, max);
    z = x - y;
  } else if (op === '*') {
    // multiplication: ensure product <= maximum_product
    y = randInt(min, max);
    const maxX = Math.min(max, Math.floor(config.maximum_product / Math.max(1, y)));
    if (maxX < min) return null;
    x = randInt(min, maxX);
    z = x * y;
  } else if (op === '/') {
    // division: choose divisor y, then quotient q such that x = q*y fits within range
    y = randInt(min, max);
    const maxQ = Math.floor(max / Math.max(1, y));
    const minQ = Math.max(config.minimum_quotient, 1);
    if (maxQ < minQ) return null;
    const q = randInt(minQ, maxQ);
    z = q; // z represents quotient
    x = q * y;
  }

  const unknowns = ['x', 'y', 'z'];
  const unknown = unknowns[randInt(0, 2)];
  let text;
  if (unknown === 'x') text = `_ ${op} ${y} = ${z}`;
  else if (unknown === 'y') text = `${x} ${op} _ = ${z}`;
  else text = `${x} ${op} ${y} = _`;

  if (seen.has(text)) return null;

  return { x, y, z, op, unknown, text };
}

function generateProblems(count = mathConfig.math_problem_count || 5) {
  const problems = [];
  const seen = new Set();
  let attempts = 0;
  const ops = [];
  
  if (mathConfig.addition_allowed) ops.push('+');
  if (mathConfig.subtraction_allowed) ops.push('-');
  if (mathConfig.multiplication_allowed) ops.push('*');
  if (mathConfig.division_allowed) ops.push('/');

  if (ops.length === 0) {
    // fallback to + and - if nothing allowed
    ops.push('+', '-');
  }

  while (problems.length < count && attempts < 1000) {
    attempts++;
    const op = ops[randInt(0, ops.length - 1)];
    const problem = generateProblem(op, mathConfig, seen);
    
    if (problem) {
      seen.add(problem.text);
      problems.push(problem);
    }
  }
  
  return problems;
}

function renderProblems(probs) {
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
let _lastConfigText = null;
let _lastSentencesText = null;

async function fetchText(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

async function checkForChanges() {
  // config: update in-place when changed
  const configText = await fetchText('/config.json');
  if (configText !== null && configText !== _lastConfigText) {
    _lastConfigText = configText;
    try {
      const parsed = JSON.parse(configText);
      mathConfig = Object.assign({}, defaultMathConfig, parsed || {});
      console.log('config.json changed, updated config', mathConfig);
      // regenerate visible problems if math area has items
      if (mathArea && mathArea.children.length > 0) {
        currentProblems = generateProblems(currentProblems.length || mathConfig.math_problem_count || 5);
        renderProblems(currentProblems);
      }
    } catch (e) {
      console.warn('Invalid config.json detected; ignoring');
    }
  }

  // sentences: trigger full reload when sentences.txt changes
  const sentencesText = await fetchText('/sentences.txt');
  if (sentencesText !== null && _lastSentencesText !== null && sentencesText !== _lastSentencesText) {
    console.log('sentences.txt changed; reloading page');
    location.reload();
    return;
  }
  if (sentencesText !== null) _lastSentencesText = sentencesText;
}

// initialize watcher
if (DEV_MODE) {
  // populate initial state
  (async () => {
    _lastConfigText = await fetchText('/config.json');
    _lastSentencesText = await fetchText('/sentences.txt');
    // try to apply initial config if present
    if (_lastConfigText) {
      try { mathConfig = Object.assign({}, defaultMathConfig, JSON.parse(_lastConfigText) || {}); } catch (e) { }
    }
    // poll for changes every 2s
    setInterval(checkForChanges, 2000);
    console.log('Dev-mode live-reload enabled');
  })();
}
