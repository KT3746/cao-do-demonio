import { COLS, ROWS, HIDDEN, PIECES, cellsOf } from "./pieces.js";
import { ghostY } from "./engine.js";

const MAX_DPR = 2.25;

export class Renderer {
  constructor(boardCanvas, minis) {
    this.board = boardCanvas;
    this.bctx = boardCanvas.getContext("2d");
    this.minis = minis.map(({ canvas, kind }) => ({
      canvas,
      ctx: canvas.getContext("2d"),
      kind,
    }));
    this.particles = [];
    this.flash = 0;
    this.shake = 0;
    this.toast = "";
    this.toastMs = 0;
    this.levelFlash = 0;
  }

  resize(cssWidth, cssHeight) {
    sizeCanvas(this.board, this.bctx, cssWidth, cssHeight);
    const mini = Math.max(72, Math.min(120, Math.round(cssWidth * 0.34)));
    for (const miniCanvas of this.minis) {
      sizeCanvas(miniCanvas.canvas, miniCanvas.ctx, mini, mini);
    }
  }

  spawnClear(rows, board, count) {
    const cell = this.board.width / COLS / dprOf(this.board);
    const dpr = dprOf(this.board);
    const cellPx = this.board.width / COLS;
    for (const y of rows) {
      const visY = y - HIDDEN;
      if (visY < 0) continue;
      for (let x = 0; x < COLS; x++) {
        const cellData = board[y][x];
        const color = cellData?.color || "#fff";
        for (let i = 0; i < 5; i++) {
          this.particles.push({
            x: (x + 0.5) * cellPx,
            y: (visY + 0.5) * (this.board.height / ROWS),
            vx: (Math.random() - 0.5) * 220 * dpr,
            vy: (Math.random() - 0.7) * 240 * dpr,
            life: 420 + Math.random() * 220,
            max: 520,
            size: (2.2 + Math.random() * 2.4) * dpr,
            color,
          });
        }
      }
    }
    this.flash = count >= 4 ? 0.55 : 0.32;
    this.shake = count >= 4 ? 10 : 5 + count;
    void cell;
  }

  showToast(text) {
    this.toast = text;
    this.toastMs = 900;
  }

  pulseLevel() {
    this.levelFlash = 1;
  }

  stepFx(dt) {
    const t = dt;
    this.flash = Math.max(0, this.flash - t / 380);
    this.shake = Math.max(0, this.shake - t / 40);
    this.toastMs = Math.max(0, this.toastMs - t);
    this.levelFlash = Math.max(0, this.levelFlash - t / 700);
    const next = [];
    for (const p of this.particles) {
      p.life -= t;
      p.x += (p.vx * t) / 1000;
      p.y += (p.vy * t) / 1000;
      p.vy += (380 * t) / 1000;
      if (p.life > 0) next.push(p);
    }
    this.particles = next;
  }

  draw(game) {
    this.drawBoard(game);
    const holdDim = !game.canHold && game.state === "playing";
    for (const mini of this.minis) {
      const id = mini.kind === "hold" ? game.hold : game.queue[0];
      this.drawMini(mini.ctx, mini.canvas, id, mini.kind === "hold" && holdDim);
    }
  }

  drawBoard(game) {
    const ctx = this.bctx;
    const w = this.board.width;
    const h = this.board.height;
    const cw = w / COLS;
    const ch = h / ROWS;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const ox = this.shake ? (Math.random() - 0.5) * this.shake * dprOf(this.board) : 0;
    const oy = this.shake ? (Math.random() - 0.5) * this.shake * dprOf(this.board) : 0;
    ctx.translate(ox, oy);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#10182c");
    bg.addColorStop(1, "#0a1020");
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, cw * 0.18);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 0, 0, w, h, cw * 0.18);
    ctx.clip();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }

    ctx.strokeStyle = "rgba(180, 210, 255, 0.06)";
    ctx.lineWidth = Math.max(1, dprOf(this.board) * 0.7);
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cw, 0);
      ctx.lineTo(x * cw, h);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * ch);
      ctx.lineTo(w, y * ch);
      ctx.stroke();
    }

    const clearing = new Set(game.clearingRows);
    const pulse = game.state === "clearing"
      ? 0.55 + 0.45 * Math.sin((game.clearAnimMs / 320) * Math.PI * 6)
      : 1;

    for (let y = HIDDEN; y < HIDDEN + ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = game.board[y][x];
        if (!cell) continue;
        const visY = y - HIDDEN;
        if (clearing.has(y)) {
          drawCell(ctx, x, visY, cw, ch, "#fff7d6", "#f4c95d", 1, pulse);
        } else {
          drawCell(ctx, x, visY, cw, ch, cell.color, cell.deep, 1, 1);
        }
      }
    }

    if (game.active && game.state !== "over") {
      const gy = ghostY(game.board, game.active);
      if (gy !== game.active.y) {
        const def = PIECES[game.active.id];
        for (const { x, y } of cellsOf({ ...game.active, y: gy })) {
          const visY = y - HIDDEN;
          if (visY < 0 || visY >= ROWS) continue;
          drawGhost(ctx, x, visY, cw, ch, def.color);
        }
      }

      if (game.state !== "clearing") {
        const def = PIECES[game.active.id];
        for (const { x, y } of cellsOf(game.active)) {
          const visY = y - HIDDEN;
          if (visY < 0 || visY >= ROWS) continue;
          drawCell(ctx, x, visY, cw, ch, def.color, def.deep, 1, 1, true);
        }
      }
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 244, 200, ${this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.toastMs > 0 && this.toast) {
      const alpha = Math.min(1, this.toastMs / 220);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(ch * 0.85)}px Sora, Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff6d2";
      ctx.shadowColor = "rgba(244, 201, 93, 0.8)";
      ctx.shadowBlur = 24;
      ctx.fillText(this.toast, w / 2, h * 0.42);
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(120, 230, 210, 0.28)";
    ctx.lineWidth = Math.max(2, dprOf(this.board) * 1.4);
    roundRect(ctx, 1, 1, w - 2, h - 2, cw * 0.18);
    ctx.stroke();

    ctx.restore();
  }

  drawMini(ctx, canvas, pieceId, dimmed) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#121a30");
    bg.addColorStop(1, "#0c1324");
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, 14 * dprOf(canvas));
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 200, 255, 0.12)";
    ctx.lineWidth = dprOf(canvas);
    roundRect(ctx, 1, 1, w - 2, h - 2, 14 * dprOf(canvas));
    ctx.stroke();

    if (!pieceId) return;
    const def = PIECES[pieceId];
    const cells = def.shapes[0];
    let minX = 4, minY = 4, maxX = 0, maxY = 0;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const pad = w * 0.18;
    const cell = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    const ox = (w - bw * cell) / 2;
    const oy = (h - bh * cell) / 2;
    ctx.globalAlpha = dimmed ? 0.4 : 1;
    for (const [x, y] of cells) {
      drawCell(
        ctx,
        (x - minX) + ox / cell,
        (y - minY) + oy / cell,
        cell,
        cell,
        def.color,
        def.deep,
        1,
        1,
        false,
        true,
      );
    }
    ctx.globalAlpha = 1;
  }
}

function sizeCanvas(canvas, ctx, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function dprOf(canvas) {
  const css = canvas.getBoundingClientRect();
  return css.width ? canvas.width / css.width : 1;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCell(ctx, x, y, cw, ch, color, deep, alpha = 1, pulse = 1, glow = false, raw = false) {
  const px = raw ? x * cw : x * cw;
  const py = raw ? y * ch : y * ch;
  const inset = Math.max(1.2, cw * 0.08);
  const r = Math.max(3, cw * 0.18);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = cw * 0.45;
  }
  ctx.fillStyle = deep || color;
  roundRect(ctx, px + inset * 0.3, py + inset * 0.3, cw - inset * 0.6, ch - inset * 0.6, r);
  ctx.fill();

  const g = ctx.createLinearGradient(px, py, px + cw, py + ch);
  g.addColorStop(0, shade(color, 0.28 * pulse));
  g.addColorStop(0.45, color);
  g.addColorStop(1, deep || shade(color, -0.25));
  ctx.fillStyle = g;
  roundRect(ctx, px + inset, py + inset, cw - inset * 2, ch - inset * 2, r * 0.8);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  roundRect(ctx, px + inset * 1.4, py + inset * 1.2, (cw - inset * 2.8) * 0.55, (ch - inset * 2.4) * 0.28, r * 0.4);
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx, x, y, cw, ch, color) {
  const inset = Math.max(1.4, cw * 0.12);
  const r = Math.max(3, cw * 0.18);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  roundRect(ctx, x * cw + inset, y * ch + inset, cw - inset * 2, ch - inset * 2, r);
  ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, cw * 0.06);
  roundRect(ctx, x * cw + inset, y * ch + inset, cw - inset * 2, ch - inset * 2, r);
  ctx.stroke();
  ctx.restore();
}

function shade(hex, amt) {
  const n = hex.replace("#", "");
  const num = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  const r = clampByte(((num >> 16) & 255) + Math.round(255 * amt));
  const g = clampByte(((num >> 8) & 255) + Math.round(255 * amt));
  const b = clampByte((num & 255) + Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, v));
}
