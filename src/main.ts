const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
];

// Random fallback words when no word is in the URL
const FALLBACK_WORDS = [
  'crane', 'slate', 'trace', 'crate', 'arise', 'stare', 'snare',
  'glide', 'plumb', 'trick', 'ghost', 'flame', 'brisk', 'dwell',
  'knack', 'shrug', 'swift', 'waltz', 'query', 'joust',
];

type TileState = 'correct' | 'present' | 'absent';

let targetWord: string;
let currentRow = 0;
let currentCol = 0;
let currentGuess: string[] = [];
let gameOver = false;
const keyStates = new Map<string, TileState>();

function getTargetWord(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      const decoded = atob(hash).toLowerCase();
      if (/^[a-z]{5}$/.test(decoded)) return decoded;
    } catch { /* ignore invalid base64 */ }
  }
  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
}

function createBoard() {
  const board = document.getElementById('board')!;
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = String(r);
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.col = String(c);
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function createKeyboard() {
  const keyboard = document.getElementById('keyboard')!;
  for (const row of KEYBOARD_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key;
      btn.dataset.key = key;
      btn.addEventListener('click', () => handleKey(key));
      rowEl.appendChild(btn);
    }
    keyboard.appendChild(rowEl);
  }
}

function getTiles(row: number): HTMLElement[] {
  const rowEl = document.querySelector(`.row[data-row="${row}"]`)!;
  return Array.from(rowEl.querySelectorAll('.tile'));
}

function showMessage(text: string, duration = 2000) {
  const msg = document.getElementById('message')!;
  msg.innerHTML = `<div class="toast">${text}</div>`;
  if (duration > 0) {
    setTimeout(() => { msg.innerHTML = ''; }, duration);
  }
}

function updateKeyboard(letter: string, state: TileState) {
  const priority: TileState[] = ['correct', 'present', 'absent'];
  const current = keyStates.get(letter);
  if (current && priority.indexOf(current) <= priority.indexOf(state)) return;
  keyStates.set(letter, state);
  const btn = document.querySelector(`.key[data-key="${letter}"]`) as HTMLElement | null;
  if (btn) {
    btn.classList.remove('correct', 'present', 'absent');
    btn.classList.add(state);
  }
}

function evaluateGuess(guess: string): TileState[] {
  const result: TileState[] = Array(WORD_LENGTH).fill('absent');
  const targetLetters = targetWord.split('');
  const guessLetters = guess.split('');

  // First pass: correct positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      targetLetters[i] = '#';
      guessLetters[i] = '*';
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === '*') continue;
    const idx = targetLetters.indexOf(guessLetters[i]);
    if (idx !== -1) {
      result[i] = 'present';
      targetLetters[idx] = '#';
    }
  }

  return result;
}

function revealRow(row: number, states: TileState[]) {
  const tiles = getTiles(row);
  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('reveal');
      setTimeout(() => {
        tile.classList.add(states[i]);
        updateKeyboard(tile.textContent!.toLowerCase(), states[i]);
      }, 250);
    }, i * 300);
  });
}

function generateShareText(): string {
  const rows: string[] = [];
  for (let r = 0; r < currentRow; r++) {
    const tiles = getTiles(r);
    const row = tiles.map(t => {
      if (t.classList.contains('correct')) return '🟩';
      if (t.classList.contains('present')) return '🟨';
      return '⬛';
    }).join('');
    rows.push(row);
  }
  return `wordy ${currentRow}/${MAX_GUESSES}\n\n${rows.join('\n')}`;
}

function submitGuess() {
  if (currentCol < WORD_LENGTH) {
    showMessage('Not enough letters');
    return;
  }

  const guess = currentGuess.join('');
  const states = evaluateGuess(guess);

  revealRow(currentRow, states);

  const won = states.every(s => s === 'correct');
  const lastGuess = currentRow === MAX_GUESSES - 1;

  setTimeout(() => {
    if (won) {
      gameOver = true;
      showMessage('Brilliant! 🎉', 0);
      setTimeout(() => {
        const shareText = generateShareText();
        navigator.clipboard.writeText(shareText).then(() => {
          showMessage('Results copied to clipboard!', 3000);
        }).catch(() => {});
      }, 2000);
    } else if (lastGuess) {
      gameOver = true;
      showMessage(targetWord.toUpperCase(), 0);
    }
  }, WORD_LENGTH * 300 + 300);

  currentRow++;
  currentCol = 0;
  currentGuess = [];
}

function handleKey(key: string) {
  if (gameOver) return;

  if (key === 'Enter') {
    submitGuess();
    return;
  }

  if (key === '⌫' || key === 'Backspace') {
    if (currentCol > 0) {
      currentCol--;
      currentGuess.pop();
      const tiles = getTiles(currentRow);
      tiles[currentCol].textContent = '';
      tiles[currentCol].classList.remove('filled');
    }
    return;
  }

  const letter = key.toLowerCase();
  if (/^[a-z]$/.test(letter) && currentCol < WORD_LENGTH) {
    currentGuess.push(letter);
    const tiles = getTiles(currentRow);
    tiles[currentCol].textContent = letter;
    tiles[currentCol].classList.add('filled');
    currentCol++;
  }
}

function setupShareLink() {
  const input = document.getElementById('custom-word') as HTMLInputElement;
  const btn = document.getElementById('create-link')!;
  const linkInput = document.getElementById('share-link') as HTMLInputElement;

  btn.addEventListener('click', () => {
    const word = input.value.toLowerCase().trim();
    if (!/^[a-z]{5}$/.test(word)) {
      showMessage('Enter a valid 5-letter word');
      return;
    }
    const encoded = btoa(word);
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    linkInput.value = url;
    linkInput.style.display = 'block';
    navigator.clipboard.writeText(url).then(() => {
      showMessage('Link copied to clipboard!');
    }).catch(() => {});
  });

  linkInput.addEventListener('click', () => {
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value).catch(() => {});
  });
}

// Init
targetWord = getTargetWord();
createBoard();
createKeyboard();
setupShareLink();

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  handleKey(e.key);
});
