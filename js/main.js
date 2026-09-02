import { Game, STATE } from "./engine.js";
import { AudioEngine } from "./audio.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";

const BEST_KEY = "queda-certa-recorde";

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
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  overlayScore: document.getElementById("overlay-score"),
  btnPlay: document.getElementById("btn-play"),
  btnSound: document.getElementById("btn-sound"),
  btnPause: document.getElementById("btn-pause"),
  wrap: document.getElementById("board-wrap"),
  app: document.getElementById("app"),
};

const audio = new AudioEngine();
const renderer = new Renderer(els.board, [
  { canvas: els.hold, kind: "hold" },
  { canvas: els.next, kind: "next" },
  { canvas: els.holdM, kind: "hold" },
  { canvas: els.nextM, kind: "next" },
]);

let best = readBest();

const game = new Game({
  onScore: syncHud,
  onStart: () => {
    hideOverlay();
    syncHud();
  },
  onPause: () => {
    audio.pause();
    showOverlay("Pausa", "O jogo está parado. Continue quando quiser.", false);
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
  },
  onRotate: () => audio.rotate(),
  onHold: () => {
    audio.hold();
    syncHud();
  },
  onLineClear: ({ count, label, rows }) => {
    audio.lineClear(count);
    renderer.spawnClear(rows, game.board, count);
    renderer.showToast(label);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(count >= 4 ? [18, 30, 18] : 12);
      } catch {
        /* ignore */
      }
    }
    syncHud();
  },
  onLevelUp: () => {
    audio.levelUp();
    renderer.pulseLevel();
    if (game.lastClearLabel !== "Queda Certa!") {
      renderer.showToast(`Nível ${game.level}`);
    }
    syncHud();
  },
  onGameOver: (snap) => {
    audio.gameOver();
    if (snap.score > best) {
      best = snap.score;
      writeBest(best);
    }
    showOverlay(
      "Fim de jogo",
      "A pilha chegou ao topo. Tente outra partida!",
      true,
      snap.score,
    );
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
  if (document.hidden && game.state === STATE.PLAYING) {
    game.togglePause();
  }
});

syncSoundButton(audio.muted);
showStart();
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
}

function syncSoundButton(muted) {
  els.btnSound.setAttribute("aria-pressed", muted ? "true" : "false");
  els.btnSound.querySelector(".btn-label").textContent = muted ? "Som off" : "Som";
  els.btnSound.title = muted ? "Ativar som" : "Silenciar";
}

function showStart() {
  showOverlay(
    "Queda Certa",
    "Encaixe as peças, complete linhas e suba de nível. Toque ou pressione Enter para começar.",
    false,
  );
  els.btnPlay.textContent = "Jogar";
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
