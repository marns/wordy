/// <reference types="vite/client" />
import answersRaw from './answers.txt?raw';
import guessesRaw from './guesses.txt?raw';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const WIN_MESSAGES = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
];

// Sentinel kept in hidden input so iOS fires backspace events
const SENTINEL = '\u200B';

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
let modalWord: string[] = [];
let modalCol = 0;
const keyStates = new Map<string, TileState>();

// --- Helpers ---

function $(id: string) { return document.getElementById(id)!; }

function getTiles(row: number): HTMLElement[] {
  return Array.from(document.querySelector(`.row[data-row="${row}"]`)!.querySelectorAll('.tile'));
}

function getModalTiles(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#modal-tiles .tile'));
}

function showMessage(text: string, duration = 2000) {
  const msg = $('message');
  msg.innerHTML = `<div class="toast">${text}</div>`;
  if (duration > 0) setTimeout(() => { msg.innerHTML = ''; }, duration);
}

function showModalMessage(text: string, duration = 2000) {
  const msg = $('modal-message');
  msg.innerHTML = `<div class="toast">${text}</div>`;
  if (duration > 0) setTimeout(() => { msg.innerHTML = ''; }, duration);
}

// --- Setup ---

function getTargetWord(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      const decoded = atob(hash).toLowerCase();
      if (/^[a-z]{5}$/.test(decoded)) return decoded;
    } catch { /* invalid base64 */ }
  }
  return answers[Math.floor(Math.random() * answers.length)];
}

function createBoard() {
  const board = $('board');
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = String(r);
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function createKeyboard() {
  const keyboard = $('keyboard');
  for (const row of KEYBOARD_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key;
      btn.dataset.key = key;
      btn.addEventListener('click', () => {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
        handleKey(key);
      });
      rowEl.appendChild(btn);
    }
    keyboard.appendChild(rowEl);
  }
}

// --- Game logic ---

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

function shakeCurrentRow() {
  const rowEl = document.querySelector(`.row[data-row="${currentRow}"]`)!;
  rowEl.classList.add('shake');
  setTimeout(() => rowEl.classList.remove('shake'), 500);
}

function submitGuess() {
  if (currentCol < WORD_LENGTH) {
    showMessage('Not enough letters');
    shakeCurrentRow();
    return;
  }

  const guess = currentGuess.join('');
  if (!validGuesses.has(guess)) {
    showMessage('Not in word list');
    shakeCurrentRow();
    return;
  }

  const states = evaluateGuess(guess);
  revealRow(currentRow, states);

  const won = states.every(s => s === 'correct');
  const lastGuess = currentRow === MAX_GUESSES - 1;

  setTimeout(() => {
    if (won) {
      gameOver = true;
      showMessage(WIN_MESSAGES[currentRow - 1], 0);
    } else if (lastGuess) {
      gameOver = true;
      showMessage(targetWord.toUpperCase(), 0);
    }
  }, WORD_LENGTH * 300 + 300);

  currentRow++;
  currentCol = 0;
  currentGuess = [];
}

// --- Input handling ---

function handleKey(key: string) {
  if (gameOver && !modalOpen) return;

  if (key === 'Enter') {
    if (!modalOpen) submitGuess();
    return;
  }

  if (key === '⌫' || key === 'Backspace') {
    if (modalOpen) {
      if (modalCol > 0) {
        modalCol--;
        modalWord.pop();
        const tiles = getModalTiles();
        tiles[modalCol].textContent = '';
        tiles[modalCol].classList.remove('filled');
        updateModalActions();
      }
    } else if (currentCol > 0) {
      currentCol--;
      currentGuess.pop();
      const tiles = getTiles(currentRow);
      tiles[currentCol].textContent = '';
      tiles[currentCol].classList.remove('filled');
    }
    return;
  }

  const letter = key.toLowerCase();
  if (!/^[a-z]$/.test(letter)) return;

  if (modalOpen) {
    if (modalCol < WORD_LENGTH) {
      modalWord.push(letter);
      const tiles = getModalTiles();
      tiles[modalCol].textContent = letter;
      tiles[modalCol].classList.add('filled');
      modalCol++;
      updateModalActions();
    }
  } else if (currentCol < WORD_LENGTH) {
    currentGuess.push(letter);
    const tiles = getTiles(currentRow);
    tiles[currentCol].textContent = letter;
    tiles[currentCol].classList.add('filled');
    currentCol++;
  }
}

// --- Modal ---

function getModalInput(): HTMLInputElement {
  return $('modal-input') as HTMLInputElement;
}

function resetModalInput() {
  const input = getModalInput();
  input.value = SENTINEL;
  input.setSelectionRange(1, 1);
}

function getModalUrl(): string {
  return `${window.location.origin}${window.location.pathname}#${btoa(modalWord.join(''))}`;
}

function updateModalActions() {
  const actions = $('modal-actions');
  const msg = $('modal-message');

  if (modalCol < WORD_LENGTH) {
    actions.classList.add('hidden');
    msg.innerHTML = '';
    return;
  }

  const word = modalWord.join('');
  msg.innerHTML = validGuesses.has(word)
    ? ''
    : `<div class="confirm"><p>"${word}" is not in our dictionary, but you do you.</p></div>`;

  actions.classList.remove('hidden');
}

function openModal() {
  modalOpen = true;
  modalWord = [];
  modalCol = 0;

  const container = $('modal-tiles');
  container.innerHTML = '';
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    container.appendChild(tile);
  }

  $('modal-overlay').classList.remove('hidden');
  $('modal-actions').classList.add('hidden');
  $('modal-message').innerHTML = '';

  resetModalInput();
  getModalInput().focus();
}

function closeModal() {
  modalOpen = false;
  $('modal-overlay').classList.add('hidden');
  getModalInput().blur();
  document.body.focus();
}

function setupModal() {
  $('challenge-btn').addEventListener('click', openModal);
  $('modal-close').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  $('modal-share').addEventListener('click', async () => {
    if (modalCol < WORD_LENGTH) return;
    const url = getModalUrl();
    try {
      await navigator.share({
        title: 'wordy',
        text: "You've been challenged to play wordy! Can you guess my word?",
        url,
      });
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        showModalMessage('Link copied!');
      } catch { /* ignore */ }
    }
  });

  const copyBtn = $('modal-copy');
  copyBtn.addEventListener('click', async () => {
    if (modalCol < WORD_LENGTH) return;
    try {
      await navigator.clipboard.writeText(getModalUrl());
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
    } catch { /* ignore */ }
  });

  // Hidden input: compare against sentinel to detect backspace vs new chars
  const input = getModalInput();
  input.addEventListener('input', () => {
    const val = input.value;
    if (!val.includes(SENTINEL)) {
      handleKey('Backspace');
    } else {
      for (const ch of val.replace(SENTINEL, '')) {
        if (/^[a-zA-Z]$/.test(ch)) handleKey(ch);
      }
    }
    resetModalInput();
  });

  // Tap modal body (not buttons) to re-focus hidden input
  $('modal').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (modalOpen && !target.closest('button') && !target.closest('#modal-actions')) {
      getModalInput().focus();
    }
  });
}

// --- Init ---

targetWord = getTargetWord();
validGuesses.add(targetWord);
createBoard();
createKeyboard();
setupModal();
$('challenge-btn').classList.remove('hidden');

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && modalOpen) { closeModal(); return; }
  if (document.activeElement === getModalInput()) return;
  handleKey(e.key);
});
