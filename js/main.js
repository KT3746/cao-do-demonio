import { Game, STATE } from "./engine.js";
import { AudioEngine } from "./audio.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";

const BEST_KEY = "queda-certa-recorde";
const HOWTO_KEY = "queda-certa-como-jogar";
const HOWTO_MS = 1800;

const HOWTO_STEPS = [
  {
    title: "Mexe aí!",
    text: "◀ ▶ pra dançar a peça. Girar pra virar o jogo.",
  },
  {
    title: "Joga pra baixo",
    text: "▼ suave acelera. Queda! é o slam — trava no fundo!",
  },
  {
    title: "Limpa e explode",
    text: "Fecha a linha e ganha ponto. Quatro de uma vez? QUEDA CERTA!!!",
  },
  {
    title: "Guarda na manga",
    text: "O ＋ guarda a peça pra hora H. No PC: tecla C.",
  },
];

const els = {
  score: document.getElementById("stat-score"),
  level: document.getElementById("stat-level"),
  lines: document.getElementById("stat-lines"),
  scoreM: document.getElementById("stat-score-m"),
  levelM: document.getElementById("stat-level-m"),
  linesM: document.getElementById("stat-lines-m"),
  board: document.getElementById("board"),
  hold: document.getElementById("hold"),
  next: document.getElementById("next"),
  holdM: document.getElementById("hold-m"),
  nextM: document.getElementById("next-m"),
  holdSlot: document.getElementById("pad-hold"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  overlayScore: document.getElementById("overlay-score"),
  btnPlay: document.getElementById("btn-play"),
  btnSound: document.getElementById("btn-sound"),
  btnPause: document.getElementById("btn-pause"),
  wrap: document.getElementById("board-wrap"),
  app: document.getElementById("app"),
  howto: document.getElementById("howto"),
  howtoTitle: document.getElementById("howto-title"),
  howtoText: document.getElementById("howto-text"),
  howtoVisual: document.getElementById("howto-visual"),
  howtoDots: document.getElementById("howto-dots"),
  btnHowToNext: document.getElementById("btn-howto-next"),
  btnHowToSkip: document.getElementById("btn-howto-skip"),
};

const audio = new AudioEngine();
const renderer = new Renderer(els.board, [
  { canvas: els.hold, kind: "hold" },
  { canvas: els.next, kind: "next" },
  { canvas: els.holdM, kind: "hold" },
  { canvas: els.nextM, kind: "next" },
]);

let best = readBest();
let tutorialOpen = false;
let tutorialStep = 0;
let tutorialTimer = 0;
let hidePauseTimer = 0;

const game = new Game({
  onScore: syncHud,
  onStart: () => {
    hideOverlay();
    syncHud();
  },
  onPause: () => {
    audio.pause();
    showOverlay("Pausa", "Cafézinho? Quando quiser, bora de novo.", false);
    els.btnPause.setAttribute("aria-pressed", "true");
    els.btnPause.querySelector(".btn-label").textContent = "Continuar";
  },
  onResume: () => {
    audio.resume();
    hideOverlay();
    els.btnPause.setAttribute("aria-pressed", "false");
    els.btnPause.querySelector(".btn-label").textContent = "Pausa";
  },
  onLock: ({ hard }) => {
    if (!hard) audio.lock();
    renderer.spawnLock(Boolean(hard));
  },
  onRotate: () => audio.rotate(),
  onHold: () => {
    audio.hold();
    syncHud();
  },
  onLineClear: ({ count, label, rows, combo }) => {
    audio.lineClear(count);
    renderer.spawnClear(rows, game.board, count);
    const tip =
      combo > 1
        ? `${label}  ·  Combo x${combo}!`
        : label;
    renderer.showToast(tip);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(count >= 4 ? [24, 40, 24, 40, 36] : count >= 2 ? [16, 20, 16] : 14);
      } catch {
        /* ignore */
      }
    }
    syncHud();
  },
  onLevelUp: () => {
    audio.levelUp();
    renderer.pulseLevel();
    if (!String(game.lastClearLabel || "").includes("QUEDA CERTA")) {
      renderer.showToast(`Nível ${game.level}! Ficou mais rápido`);
    }
    syncHud();
  },
  onGameOver: (snap) => {
    audio.gameOver();
    if (snap.score > best) {
      best = snap.score;
      writeBest(best);
    }
    const roast =
      snap.score < 500
        ? "Quase! A pilha te ganhou dessa vez."
        : snap.score < 2000
          ? "Boa luta! Dá pra estourar esse recorde."
          : "Monstro! Agora tenta bater isso.";
    showOverlay("Game over!", roast, true, snap.score);
    els.btnPause.querySelector(".btn-label").textContent = "Pausa";
    els.btnPause.setAttribute("aria-pressed", "false");
    syncHud();
  },
  onSpawn: syncHud,
});

const buttons = [
  [document.getElementById("pad-left"), "left"],
  [document.getElementById("pad-right"), "right"],
  [document.getElementById("pad-soft"), "soft"],
  [document.getElementById("pad-hard"), "hard"],
  [document.getElementById("pad-rot"), "rotR"],
  [document.getElementById("pad-hold"), "hold"],
];

const input = new Input(game, audio, {
  onPause: handlePauseButton,
  boardEl: els.board,
  buttons,
  isBlocked: () => tutorialOpen,
});

els.btnPlay.addEventListener("click", () => {
  audio.unlock();
  if (game.state === STATE.OVER || game.state === STATE.READY) {
    game.start();
    audio.start();
  } else if (game.state === STATE.PAUSED) {
    game.start();
  }
});

els.btnSound.addEventListener("click", () => {
  audio.unlock();
  const muted = audio.toggleMute();
  syncSoundButton(muted);
});

els.btnPause.addEventListener("click", () => {
  audio.unlock();
  handlePauseButton();
});

els.btnHowToNext.addEventListener("click", () => {
  audio.unlock();
  advanceHowTo();
});

els.btnHowToSkip.addEventListener("click", () => {
  audio.unlock();
  finishHowTo();
});

document.addEventListener(
  "pointerdown",
  () => {
    audio.unlock();
  },
  { once: true, capture: true },
);

let lastWrapW = 0;
let lastWrapH = 0;
let last = performance.now();

window.addEventListener("resize", layout);
window.addEventListener("orientationchange", () => setTimeout(layout, 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", layout);
}

document.addEventListener("visibilitychange", () => {
  window.clearTimeout(hidePauseTimer);
  if (!document.hidden) return;
  if (tutorialOpen) return;
  if (game.state !== STATE.PLAYING) return;
  hidePauseTimer = window.setTimeout(() => {
    if (document.hidden && game.state === STATE.PLAYING && !tutorialOpen) {
      game.togglePause();
    }
  }, 450);
});

syncSoundButton(audio.muted);
bootScreen();
layout();
syncHud();
requestAnimationFrame(loop);

function loop(now) {
  const dt = Math.min(48, now - last);
  last = now;
  try {
    if (game.state === STATE.PLAYING) input.step(dt);
    game.tick(dt);
    renderer.stepFx(dt);
    layoutIfNeeded();
    renderer.draw(game);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(loop);
}

function handlePauseButton() {
  if (tutorialOpen) return;
  if (game.state === STATE.READY) {
    game.start();
    audio.start();
    return;
  }
  if (game.state === STATE.OVER) {
    game.start();
    audio.start();
    return;
  }
  game.togglePause();
}

function syncHud() {
  const s = String(game.score);
  const lv = String(game.level);
  const ln = String(game.lines);
  els.score.textContent = s;
  els.level.textContent = lv;
  els.lines.textContent = ln;
  els.scoreM.textContent = s;
  els.levelM.textContent = lv;
  els.linesM.textContent = ln;
  if (els.holdSlot) {
    els.holdSlot.classList.toggle("is-empty", !game.hold);
  }
}

function syncSoundButton(muted) {
  els.btnSound.setAttribute("aria-pressed", muted ? "true" : "false");
  els.btnSound.querySelector(".btn-label").textContent = muted ? "Som off" : "Som";
  els.btnSound.title = muted ? "Ativar som" : "Silenciar";
}

function bootScreen() {
  if (!readHowToSeen()) {
    openHowTo();
    return;
  }
  showStart();
}

function openHowTo() {
  tutorialOpen = true;
  tutorialStep = 0;
  els.overlay.hidden = true;
  els.howto.hidden = false;
  els.app.classList.add("is-overlay");
  renderHowTo();
  queueHowToTick();
}

function renderHowTo() {
  const step = HOWTO_STEPS[tutorialStep];
  els.howtoTitle.textContent = step.title;
  els.howtoText.textContent = step.text;
  els.howtoVisual.dataset.step = String(tutorialStep);
  els.howtoDots.innerHTML = HOWTO_STEPS.map(
    (_, i) => `<span class="${i === tutorialStep ? "is-on" : ""}"></span>`,
  ).join("");
  const last = tutorialStep >= HOWTO_STEPS.length - 1;
  els.btnHowToNext.textContent = last ? "Bora!" : "Próximo";
}

function queueHowToTick() {
  window.clearTimeout(tutorialTimer);
  tutorialTimer = window.setTimeout(() => {
    if (!tutorialOpen) return;
    advanceHowTo();
  }, HOWTO_MS);
}

function advanceHowTo() {
  if (tutorialStep >= HOWTO_STEPS.length - 1) {
    finishHowTo();
    return;
  }
  tutorialStep += 1;
  renderHowTo();
  queueHowToTick();
}

function finishHowTo() {
  window.clearTimeout(tutorialTimer);
  tutorialOpen = false;
  els.howto.hidden = true;
  writeHowToSeen();
  showStart();
}

function showStart() {
  showOverlay(
    "Queda Certa",
    "Cai bloco, limpa linha, sobe o clima. Bora jogar!",
    false,
  );
  els.btnPlay.textContent = "Jogar!";
  els.overlayScore.hidden = true;
}

function showOverlay(title, text, again, score) {
  els.overlay.hidden = false;
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.btnPlay.textContent = again ? "Jogar de novo" : game.state === STATE.PAUSED ? "Continuar" : "Jogar";
  if (typeof score === "number") {
    els.overlayScore.hidden = false;
    els.overlayScore.innerHTML = `<span>Pontos</span><strong>${score}</strong><span>Recorde</span><strong>${best}</strong>`;
  } else {
    els.overlayScore.hidden = true;
  }
  els.app.classList.add("is-overlay");
}

function hideOverlay() {
  els.overlay.hidden = true;
  els.app.classList.remove("is-overlay");
}

function layoutIfNeeded() {
  const box = els.wrap.getBoundingClientRect();
  if (Math.abs(box.height - lastWrapH) > 1 || Math.abs(box.width - lastWrapW) > 1) {
    layout();
  }
}

function layout() {
  const wrap = els.wrap;
  const rect = wrap.getBoundingClientRect();
  lastWrapW = rect.width;
  lastWrapH = rect.height;
  let maxW = rect.width || wrap.clientWidth;
  let maxH = rect.height || wrap.clientHeight;

  if (!maxW || !maxH) {
    maxW = Math.min(360, window.innerWidth * 0.92);
    maxH = Math.min(640, window.innerHeight * 0.6);
  }

  const ratio = 10 / 20;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  w = Math.floor(w);
  h = Math.floor(h);
  renderer.resize(w, h);
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function readHowToSeen() {
  try {
    return localStorage.getItem(HOWTO_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHowToSeen() {
  try {
    localStorage.setItem(HOWTO_KEY, "1");
  } catch {
    /* ignore */
  }
}
