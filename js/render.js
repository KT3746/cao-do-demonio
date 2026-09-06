import { COLS, ROWS, HIDDEN, PIECES, cellsOf } from "./pieces.js";
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
    sizeCanvas(this.board, this.bctx, cssWidth, cssHeight, true);
    this.syncMinis();
  }

  syncMinis() {
    for (const miniCanvas of this.minis) {
      const rect = miniCanvas.canvas.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      sizeCanvas(miniCanvas.canvas, miniCanvas.ctx, rect.width, rect.height, false);
    }
  }

  spawnClear(rows, board, count) {
    const m = this.metrics();
    const burst = count >= 4 ? 16 : 9 + count * 2;
    for (const y of rows) {
      const visY = y - HIDDEN;
      if (visY < 0) continue;
      for (let x = 0; x < COLS; x++) {
        const cellData = board[y][x];
        const color = cellData?.color || "#fff";
        for (let i = 0; i < burst; i++) {
          this.particles.push({
            x: m.inset + (x + 0.5) * m.cw,
            y: m.inset + (visY + 0.5) * m.ch,
            vx: (Math.random() - 0.5) * 280 * m.dpr,
            vy: (Math.random() - 0.75) * 320 * m.dpr,
            life: 520 + Math.random() * 280,
            max: 700,
            size: (2.4 + Math.random() * 3.2) * m.dpr,
            color,
          });
        }
      }
    }
    this.flash = count >= 4 ? 0.92 : 0.5 + count * 0.1;
    this.shake = count >= 4 ? 18 : 8 + count * 2;
  }

  spawnLock(hard) {
    const m = this.metrics();
    const n = hard ? 18 : 10;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: m.inset + Math.random() * (this.board.width - m.inset * 2),
        y: m.inset + this.board.height * (0.55 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 200 * m.dpr,
        vy: (-80 - Math.random() * 180) * m.dpr,
        life: 280 + Math.random() * 220,
        max: 500,
        size: (1.6 + Math.random() * 2.4) * m.dpr,
        color: hard ? "#ffe9a8" : "#9ae6ff",
      });
    }
    if (hard) {
      this.flash = Math.max(this.flash, 0.28);
      this.shake = Math.max(this.shake, 6);
    }
  }

    showToast(text) {
    this.toast = text;
    this.toastMs = text === "TETROK!" ? 1400 : 1100;
  }

  pulseLevel() {
    this.levelFlash = 1;
  }

  stepFx(dt) {
    const t = dt;
    this.flash = Math.max(0, this.flash - t / 520);
    this.shake = Math.max(0, this.shake - t / 46);
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

  metrics() {
    const w = this.board.width;
    const h = this.board.height;
    const dpr = dprOf(this.board);
    const inset = Math.max(10, dpr * 5);
    return {
      w,
      h,
      dpr,
      inset,
      cw: (w - inset * 2) / COLS,
      ch: (h - inset * 2) / ROWS,
    };
  }

  drawBoard(game) {
    const ctx = this.bctx;
    const { w, h, dpr, inset, cw, ch } = this.metrics();

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const ox = this.shake ? (Math.random() - 0.5) * this.shake * dpr : 0;
    const oy = this.shake ? (Math.random() - 0.5) * this.shake * dpr : 0;
    ctx.translate(ox, oy);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1a2332");
    bg.addColorStop(1, "#0d121c");
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, cw * 0.14);
    ctx.fill();

    // borda neon sutil
    ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
    ctx.lineWidth = Math.max(2, dpr);
    roundRect(ctx, 1, 1, w - 2, h - 2, cw * 0.14);
    ctx.stroke();

    ctx.save();
    ctx.translate(inset, inset);
    const innerW = cw * COLS;
    const innerH = ch * ROWS;

    // Grade clássica: colunas só um pouco mais claras pra mirar
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = x % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.18)";
      ctx.fillRect(x * cw, 0, cw, innerH);
    }
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = Math.max(1, dpr * 0.5);
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * ch);
      ctx.lineTo(innerW, y * ch);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(34, 211, 238, 0.16)";
    ctx.lineWidth = Math.max(1.2, dpr * 0.65);
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cw, 0);
      ctx.lineTo(x * cw, innerH);
      ctx.stroke();
    }

    const clearing = new Set(game.clearingRows);
    const pulse = game.state === "clearing"
      ? 0.55 + 0.45 * Math.sin((game.clearAnimMs / 280) * Math.PI * 6)
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
      ctx.arc(p.x - inset, p.y - inset, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 244, 200, ${this.flash})`;
      ctx.fillRect(0, 0, innerW, innerH);
    }

    if (this.toastMs > 0 && this.toast) {
      const alpha = Math.min(1, this.toastMs / 240);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(ch * (this.toast === "TETROK!" ? 0.92 : 0.78))}px Sora, Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff6d2";
      ctx.shadowColor = "rgba(244, 201, 93, 0.95)";
      ctx.shadowBlur = 28;
      ctx.fillText(this.toast, innerW / 2, innerH * 0.42);
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(150, 245, 225, 0.38)";
    ctx.lineWidth = Math.max(2, dpr * 1.5);
    roundRect(ctx, 1, 1, w - 2, h - 2, cw * 0.16);
    ctx.stroke();

    ctx.restore();
  }

  drawMini(ctx, canvas, pieceId, dimmed) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1e293b");
    bg.addColorStop(1, "#0f172a");
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

function sizeCanvas(canvas, ctx, cssW, cssH, lockCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  if (lockCss) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
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
    ctx.shadowBlur = cw * 0.28;
  }
  ctx.fillStyle = deep || color;
  roundRect(ctx, px + inset * 0.3, py + inset * 0.3, cw - inset * 0.6, ch - inset * 0.6, r);
  ctx.fill();

  const g = ctx.createLinearGradient(px, py, px + cw, py + ch);
  g.addColorStop(0, shade(color, 0.34 * pulse));
  g.addColorStop(0.45, shade(color, 0.08));
  g.addColorStop(1, deep || shade(color, -0.22));
  ctx.fillStyle = g;
  roundRect(ctx, px + inset, py + inset, cw - inset * 2, ch - inset * 2, r * 0.8);
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, cw * 0.055);
  roundRect(ctx, px + inset * 0.35, py + inset * 0.35, cw - inset * 0.7, ch - inset * 0.7, r);
  ctx.stroke();

  if (glow) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = shade(color, 0.45);
    ctx.lineWidth = Math.max(1.2, cw * 0.07);
    roundRect(ctx, px + inset * 0.5, py + inset * 0.5, cw - inset, ch - inset, r * 0.85);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  roundRect(ctx, px + inset * 1.4, py + inset * 1.2, (cw - inset * 2.8) * 0.55, (ch - inset * 2.4) * 0.28, r * 0.4);
  ctx.fill();
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
