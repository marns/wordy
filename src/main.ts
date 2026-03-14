/// <reference types="vite/client" />
import answersRaw from './answers.txt?raw';
import guessesRaw from './guesses.txt?raw';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
];

const answers = answersRaw.trim().split('\n').map((w: string) => w.trim().toLowerCase());
const validGuesses = new Set([
  ...answers,
  ...guessesRaw.trim().split('\n').map((w: string) => w.trim().toLowerCase()),
]);

type TileState = 'correct' | 'present' | 'absent';

let targetWord: string;
let currentRow = 0;
let currentCol = 0;
let currentGuess: string[] = [];
let gameOver = false;
let modalOpen = false;
const keyStates = new Map<string, TileState>();

// Modal state
let modalWord: string[] = [];
let modalCol = 0;

function getTargetWord(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      const decoded = atob(hash).toLowerCase();
      if (/^[a-z]{5}$/.test(decoded)) return decoded;
    } catch { /* ignore invalid base64 */ }
  }
  return answers[Math.floor(Math.random() * answers.length)];
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

function getModalTiles(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#modal-tiles .tile'));
}

function showMessage(text: string, duration = 2000) {
  const msg = document.getElementById('message')!;
  msg.innerHTML = `<div class="toast">${text}</div>`;
  if (duration > 0) {
    setTimeout(() => { msg.innerHTML = ''; }, duration);
  }
}

function showModalMessage(text: string, duration = 2000) {
  const msg = document.getElementById('modal-message')!;
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

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      targetLetters[i] = '#';
      guessLetters[i] = '*';
    }
  }

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

  if (!validGuesses.has(guess)) {
    showMessage('Not in word list');
    const tiles = getTiles(currentRow);
    tiles.forEach(t => {
      t.classList.add('shake');
      setTimeout(() => t.classList.remove('shake'), 600);
    });
    return;
  }

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
  if (modalOpen) {
    handleModalKey(key);
    return;
  }

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

// --- Modal ---

function createModalTiles() {
  const container = document.getElementById('modal-tiles')!;
  container.innerHTML = '';
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    container.appendChild(tile);
  }
}

function openModal() {
  modalOpen = true;
  modalWord = [];
  modalCol = 0;
  createModalTiles();
  document.getElementById('modal-overlay')!.classList.remove('hidden');
  document.getElementById('modal-actions')!.classList.add('hidden');
  document.getElementById('modal-message')!.innerHTML = '';
}

function closeModal() {
  modalOpen = false;
  document.getElementById('modal-overlay')!.classList.add('hidden');
}

function updateModalActions() {
  const actions = document.getElementById('modal-actions')!;
  const msg = document.getElementById('modal-message')!;

  if (modalCol < WORD_LENGTH) {
    actions.classList.add('hidden');
    msg.innerHTML = '';
    return;
  }

  const word = modalWord.join('');
  const encoded = btoa(word);
  const url = `${window.location.origin}${window.location.pathname}#${encoded}`;

  if (!validGuesses.has(word)) {
    msg.innerHTML = `<div class="confirm"><p>"${word}" is not in our dictionary, but you do you.</p></div>`;
  } else {
    msg.innerHTML = '';
  }

  actions.classList.remove('hidden');

  const shareBtn = document.getElementById('modal-share')!;
  const copyBtn = document.getElementById('modal-copy')!;

  shareBtn.style.display = typeof navigator.share === 'function' ? '' : 'none';

  shareBtn.onclick = () => {
    navigator.share({
      title: 'wordy',
      text: "You've been challenged to play wordy! Can you guess my word?",
      url,
    }).catch(() => {});
  };

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(url).then(() => {
      showModalMessage('Copied!');
    }).catch(() => {});
  };
}

function handleModalKey(key: string) {
  if (key === 'Escape') {
    closeModal();
    return;
  }

  if (key === '⌫' || key === 'Backspace') {
    if (modalCol > 0) {
      modalCol--;
      modalWord.pop();
      const tiles = getModalTiles();
      tiles[modalCol].textContent = '';
      tiles[modalCol].classList.remove('filled');
      updateModalActions();
    }
    return;
  }

  const letter = key.toLowerCase();
  if (/^[a-z]$/.test(letter) && modalCol < WORD_LENGTH) {
    modalWord.push(letter);
    const tiles = getModalTiles();
    tiles[modalCol].textContent = letter;
    tiles[modalCol].classList.add('filled');
    modalCol++;
    updateModalActions();
  }
}

function setupModal() {
  document.getElementById('challenge-btn')!.addEventListener('click', openModal);
  document.getElementById('modal-close')!.addEventListener('click', closeModal);

  document.getElementById('modal-overlay')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// Init
targetWord = getTargetWord();
validGuesses.add(targetWord);
createBoard();
createKeyboard();
setupModal();
document.getElementById('challenge-btn')!.classList.remove('hidden');

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalOpen && e.key === 'Escape') {
    closeModal();
    return;
  }
  handleKey(e.key);
});
