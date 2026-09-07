import { COLS, ROWS, HIDDEN, PIECES, cellsOf } from "./pieces.js";
import { skinColors, skinStyle } from "./skins.js";
const MAX_DPR = 2.25;

export class Renderer {
  constructor(boardCanvas, minis) {
    this.board = boardCanvas;
    this.bctx = boardCanvas.getContext("2d");
    this.minis = minis.map(({ canvas, kind, index }) => ({
      canvas,
      ctx: canvas.getContext("2d"),
      kind,
      index: typeof index === "number" ? index : 0,
    }));
    this.particles = [];
    this.beams = [];
    this.rings = [];
    this.flash = 0;
    this.flashColor = "120, 220, 255";
    this.shake = 0;
    this.toast = "";
    this.toastMs = 0;
    this.levelFlash = 0;
    this.theme = "neon";
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

  setTheme(id) {
    const ok = id === "neon" || id === "candy" || id === "crt" || id === "pixel";
    this.theme = ok ? id : "neon";
  }

  spawnClear(rows, board, count) {
    const m = this.metrics();
    const hues = count >= 4
      ? ["#ff4fd8", "#7cf0ff", "#ffe566", "#a78bfa"]
      : count === 3
        ? ["#7cf0ff", "#ff7ad9", "#b8f26e"]
        : count === 2
          ? ["#5eead4", "#60a5fa"]
          : ["#38bdf8", "#a5b4fc"];
    this.flashColor = count >= 4 ? "255, 90, 210" : "90, 210, 255";
    this.flash = count >= 4 ? 0.55 : 0.28 + count * 0.08;
    this.shake = count >= 4 ? 10 : 3 + count;
    for (const y of rows) {
      const visY = y - HIDDEN;
      if (visY < 0) continue;
      const cy = m.inset + (visY + 0.5) * m.ch;
      const left = m.inset;
      const right = m.inset + COLS * m.cw;
      // laser beam across the cleared row
      this.beams.push({
        y: cy,
        life: 420 + count * 40,
        max: 460 + count * 40,
        h: Math.max(3, m.ch * (0.55 + count * 0.08)),
        color: hues[visY % hues.length],
        left,
        right,
      });
      // expanding ring from center of row
      this.rings.push({
        x: (left + right) / 2,
        y: cy,
        r: m.cw * 0.2,
        vr: m.cw * (2.8 + count * 0.5),
        life: 480 + count * 50,
        max: 520 + count * 50,
        color: hues[(visY + 1) % hues.length],
        lw: Math.max(2, m.dpr * 2.2),
      });
      // sideways sparks (no gravity) instead of exploding confetti
      for (let x = 0; x < COLS; x++) {
        const cellData = board[y][x];
        const color = cellData?.color || hues[x % hues.length];
        const px = m.inset + (x + 0.5) * m.cw;
        for (let i = 0; i < 2 + count; i++) {
          const dir = i % 2 === 0 ? -1 : 1;
          this.particles.push({
            x: px,
            y: cy,
            vx: dir * (140 + Math.random() * 220) * m.dpr,
            vy: (Math.random() - 0.5) * 40 * m.dpr,
            life: 360 + Math.random() * 220,
            max: 580,
            size: (1.8 + Math.random() * 2.6) * m.dpr,
            color,
            kind: "spark",
          });
        }
      }
    }
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
    this.flash = Math.max(0, this.flash - t / 380);
    this.shake = Math.max(0, this.shake - t / 50);
    this.toastMs = Math.max(0, this.toastMs - t);
    this.levelFlash = Math.max(0, this.levelFlash - t / 700);
    const next = [];
    for (const p of this.particles) {
      p.life -= t;
      p.x += (p.vx * t) / 1000;
      p.y += (p.vy * t) / 1000;
      if (p.kind !== "spark") p.vy += (380 * t) / 1000;
      else p.vx *= 1 - t / 900;
      if (p.life > 0) next.push(p);
    }
    this.particles = next;
    const nextBeams = [];
    for (const b of this.beams) {
      b.life -= t;
      if (b.life > 0) nextBeams.push(b);
    }
    this.beams = nextBeams;
    const nextRings = [];
    for (const r of this.rings) {
      r.life -= t;
      r.r += (r.vr * t) / 1000;
      if (r.life > 0) nextRings.push(r);
    }
    this.rings = nextRings;
  }

  draw(game) {
    this.drawBoard(game);
    const holdDim = !game.canHold && game.state === "playing";
    for (const mini of this.minis) {
      let id = null;
      if (mini.kind === "hold") id = game.hold;
      else {
        const idx = typeof mini.index === "number" ? mini.index : 0;
        id = game.queue[idx] || null;
      }
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


  paintWell(ctx, w, h, dpr, cw) {
    const theme = this.theme || "neon";
    const radius = theme === "candy" ? cw * 0.28 : theme === "pixel" ? cw * 0.06 : cw * 0.14;
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.save();
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.clip();

    if (theme === "candy") {
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, "#fff7ed");
      base.addColorStop(0.5, "#ffedd5");
      base.addColorStop(1, "#fed7aa");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      let g = ctx.createRadialGradient(w * 0.5, h * 0.15, 0, w * 0.5, h * 0.15, h * 0.55);
      g.addColorStop(0, "rgba(253, 224, 71, 0.28)");
      g.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.85, h * 0.85, 0, w * 0.85, h * 0.85, w * 0.6);
      g.addColorStop(0, "rgba(244, 114, 182, 0.16)");
      g.addColorStop(1, "rgba(244, 114, 182, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === "crt") {
      ctx.fillStyle = "#050300";
      ctx.fillRect(0, 0, w, h);
      // scanlines
      ctx.fillStyle = "rgba(255, 176, 0, 0.045)";
      const step = Math.max(2, dpr * 2);
      for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1 * dpr);
      let g = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.85);
      g.addColorStop(0, "rgba(255, 176, 0, 0.08)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === "pixel") {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
      ctx.fillRect(0, 0, w, h);
    } else {
      // neon vidro
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, "#0b1020");
      base.addColorStop(0.45, "#0a0e1a");
      base.addColorStop(1, "#07080f");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      let aurora = ctx.createRadialGradient(w * 0.22, h * 0.18, 0, w * 0.22, h * 0.18, w * 0.85);
      aurora.addColorStop(0, "rgba(56, 189, 248, 0.38)");
      aurora.addColorStop(0.45, "rgba(34, 211, 238, 0.12)");
      aurora.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h);
      aurora = ctx.createRadialGradient(w * 0.82, h * 0.55, 0, w * 0.82, h * 0.55, w * 0.9);
      aurora.addColorStop(0, "rgba(167, 139, 250, 0.34)");
      aurora.addColorStop(0.5, "rgba(129, 140, 248, 0.12)");
      aurora.addColorStop(1, "rgba(129, 140, 248, 0)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h);
      aurora = ctx.createRadialGradient(w * 0.5, h * 1.05, 0, w * 0.5, h * 1.05, h * 0.55);
      aurora.addColorStop(0, "rgba(45, 212, 191, 0.16)");
      aurora.addColorStop(1, "rgba(45, 212, 191, 0)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 97) % 1000) / 1000 * w;
        const sy = ((i * 53) % 1000) / 1000 * h;
        const r = (i % 3 === 0 ? 1.1 : 0.7) * dpr;
        ctx.globalAlpha = 0.18 + (i % 5) * 0.05;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const glass = ctx.createLinearGradient(0, 0, 0, h);
      glass.addColorStop(0, "rgba(255,255,255,0.06)");
      glass.addColorStop(0.2, "rgba(255,255,255,0)");
      glass.addColorStop(0.85, "rgba(0,0,0,0)");
      glass.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = glass;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    if (theme === "candy") {
      ctx.strokeStyle = "rgba(251, 146, 60, 0.7)";
      ctx.lineWidth = Math.max(3, dpr * 1.6);
      roundRect(ctx, 2, 2, w - 4, h - 4, radius);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = Math.max(1.5, dpr * 0.8);
      roundRect(ctx, 6, 6, w - 12, h - 12, radius * 0.85);
      ctx.stroke();
    } else if (theme === "crt") {
      ctx.strokeStyle = "rgba(255, 176, 0, 0.7)";
      ctx.lineWidth = Math.max(2, dpr * 1.3);
      roundRect(ctx, 2, 2, w - 4, h - 4, radius);
      ctx.stroke();
    } else if (theme === "pixel") {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = Math.max(3, dpr * 2);
      ctx.strokeRect(2, 2, w - 4, h - 4);
    } else {
      ctx.strokeStyle = "rgba(125, 211, 252, 0.6)";
      ctx.lineWidth = Math.max(2.2, dpr * 1.2);
      roundRect(ctx, 1.5, 1.5, w - 3, h - 3, radius);
      ctx.stroke();
      ctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
      ctx.lineWidth = Math.max(1, dpr * 0.7);
      roundRect(ctx, 4, 4, w - 8, h - 8, cw * 0.12);
      ctx.stroke();
    }
  }

  paintGrid(ctx, cw, ch, innerW, innerH, dpr) {
    const theme = this.theme || "neon";
    let even, odd, hLine, vLine;
    if (theme === "candy") {
      even = "rgba(251, 146, 60, 0.06)";
      odd = "rgba(255, 255, 255, 0.35)";
      hLine = "rgba(251, 146, 60, 0.18)";
      vLine = "rgba(249, 115, 22, 0.16)";
    } else if (theme === "crt") {
      even = "rgba(255, 176, 0, 0.03)";
      odd = "rgba(0, 0, 0, 0.25)";
      hLine = "rgba(255, 176, 0, 0.2)";
      vLine = "rgba(255, 176, 0, 0.22)";
    } else if (theme === "pixel") {
      even = "rgba(59, 130, 246, 0.05)";
      odd = "rgba(0, 0, 0, 0.15)";
      hLine = "rgba(96, 165, 250, 0.25)";
      vLine = "rgba(96, 165, 250, 0.25)";
    } else {
      even = "rgba(125, 211, 252, 0.045)";
      odd = "rgba(15, 23, 42, 0.22)";
      hLine = "rgba(226, 232, 240, 0.14)";
      vLine = "rgba(165, 243, 252, 0.22)";
    }
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = x % 2 === 0 ? even : odd;
      ctx.fillRect(x * cw, 0, cw, innerH);
    }
    ctx.strokeStyle = hLine;
    ctx.lineWidth = Math.max(1, dpr * 0.55);
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * ch);
      ctx.lineTo(innerW, y * ch);
      ctx.stroke();
    }
    ctx.strokeStyle = vLine;
    ctx.lineWidth = Math.max(1.15, dpr * 0.7);
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cw, 0);
      ctx.lineTo(x * cw, innerH);
      ctx.stroke();
    }
  }

  drawBoard(game) {
    const ctx = this.bctx;
    const { w, h, dpr, inset, cw, ch } = this.metrics();

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const ox = this.shake ? (Math.random() - 0.5) * this.shake * dpr : 0;
    const oy = this.shake ? (Math.random() - 0.5) * this.shake * dpr : 0;
    ctx.translate(ox, oy);

    this.paintWell(ctx, w, h, dpr, cw);

    ctx.save();
    ctx.translate(inset, inset);
    const innerW = cw * COLS;
    const innerH = ch * ROWS;
    this.paintGrid(ctx, cw, ch, innerW, innerH, dpr);

    const clearing = new Set(game.clearingRows);
    const pulse = game.state === "clearing"
      ? 0.55 + 0.45 * Math.sin((game.clearAnimMs / 280) * Math.PI * 6)
      : 1;

    for (let y = HIDDEN; y < HIDDEN + ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = game.board[y][x];
        if (!cell) continue;
        const visY = y - HIDDEN;
        const style = skinStyle(this.theme);
        if (clearing.has(y)) {
          const flash = style === "crt"
            ? { color: "#ffe08a", deep: "#ffb000" }
            : style === "candy"
              ? { color: "#fff1f2", deep: "#fb7185" }
              : { color: "#fff7d6", deep: "#f4c95d" };
          drawCell(ctx, x, visY, cw, ch, flash.color, flash.deep, 1, pulse, false, false, style, false);
        } else {
          const pal = skinColors(this.theme, cell.id || "viga");
          drawCell(ctx, x, visY, cw, ch, pal.color, pal.deep, 1, 1, false, false, style, !!pal.hatch);
        }
      }
    }

    if (game.active && game.state !== "over") {
      if (game.state !== "clearing") {
        const def = PIECES[game.active.id];
        for (const { x, y } of cellsOf(game.active)) {
          const visY = y - HIDDEN;
          if (visY < 0 || visY >= ROWS) continue;
          {
            const pal = skinColors(this.theme, game.active.id);
            drawCell(ctx, x, visY, cw, ch, pal.color, pal.deep, 1, 1, true, false, skinStyle(this.theme), !!pal.hatch);
          }
        }
      }
    }

    for (const b of this.beams) {
      const a = Math.max(0, b.life / b.max);
      const grd = ctx.createLinearGradient(b.left - inset, 0, b.right - inset, 0);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.15, b.color);
      grd.addColorStop(0.5, "#ffffff");
      grd.addColorStop(0.85, b.color);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = a;
      ctx.fillStyle = grd;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.fillRect(b.left - inset, b.y - inset - b.h / 2, b.right - b.left, b.h);
      ctx.shadowBlur = 0;
    }
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.max);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lw;
      ctx.beginPath();
      ctx.arc(r.x - inset, r.y - inset, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      if (p.kind === "spark") {
        ctx.fillRect(p.x - inset - p.size * 1.6, p.y - inset - p.size * 0.35, p.size * 3.2, p.size * 0.7);
      } else {
        ctx.beginPath();
        ctx.arc(p.x - inset, p.y - inset, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor}, ${this.flash})`;
      ctx.fillRect(0, 0, innerW, innerH);
    }

    if (this.toastMs > 0 && this.toast) {
      const alpha = Math.min(1, this.toastMs / 240);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(ch * (this.toast === "TETROK!" ? 0.92 : 0.78))}px Sora, Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = this.theme === "candy" ? "#9a3412" : this.theme === "crt" ? "#ffb000" : "#fff6d2";
      ctx.shadowColor = this.theme === "candy" ? "rgba(251, 146, 60, 0.85)" : this.theme === "crt" ? "rgba(255,176,0,0.9)" : "rgba(244, 201, 93, 0.95)";
      ctx.shadowBlur = 28;
      ctx.fillText(this.toast, innerW / 2, innerH * 0.42);
      ctx.restore();
    }

    ctx.restore();

    if (this.theme === "candy") {
      ctx.strokeStyle = "rgba(251, 146, 60, 0.45)";
      ctx.lineWidth = Math.max(2.5, dpr * 1.4);
      roundRect(ctx, 1, 1, w - 2, h - 2, cw * 0.28);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(150, 245, 225, 0.38)";
      ctx.lineWidth = Math.max(2, dpr * 1.5);
      roundRect(ctx, 1, 1, w - 2, h - 2, cw * 0.16);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawMini(ctx, canvas, pieceId, dimmed) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const theme = this.theme;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    if (theme === "candy") {
      bg.addColorStop(0, "#fff7ed");
      bg.addColorStop(1, "#ffedd5");
    } else if (theme === "crt") {
      bg.addColorStop(0, "#1a1200");
      bg.addColorStop(1, "#050300");
    } else if (theme === "pixel") {
      bg.addColorStop(0, "#1e293b");
      bg.addColorStop(1, "#0b1220");
    } else {
      bg.addColorStop(0, "#1e293b");
      bg.addColorStop(1, "#0f172a");
    }
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, theme === "pixel" ? 4 : 14 * dprOf(canvas));
    ctx.fill();
    ctx.strokeStyle = theme === "candy" ? "rgba(251, 146, 60, 0.35)" : theme === "crt" ? "rgba(255,176,0,0.45)" : theme === "pixel" ? "#3b82f6" : "rgba(160, 200, 255, 0.12)";
    ctx.lineWidth = dprOf(canvas);
    roundRect(ctx, 1, 1, w - 2, h - 2, theme === "pixel" ? 4 : 14 * dprOf(canvas));
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
      {
        const pal = skinColors(this.theme, pieceId);
        drawCell(
          ctx,
          (x - minX) + ox / cell,
          (y - minY) + oy / cell,
          cell,
          cell,
          pal.color,
          pal.deep,
          1,
          1,
          false,
          true,
          skinStyle(this.theme),
          !!pal.hatch,
        );
      }
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

function drawCell(ctx, x, y, cw, ch, color, deep, alpha = 1, pulse = 1, glow = false, raw = false, style = "neon", hatch = false) {
  const px = x * cw;
  const py = y * ch;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (style === "soft") {
    const inset = Math.max(1.2, cw * 0.08);
    const r = Math.max(5, cw * 0.38);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = cw * 0.12;
    ctx.fillStyle = deep || shade(color, -0.15);
    roundRect(ctx, px + inset * 0.15, py + inset * 0.35, cw - inset * 0.3, ch - inset * 0.35, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(px, py, px + cw * 0.2, py + ch);
    g.addColorStop(0, shade(color, 0.42 * pulse));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.08));
    ctx.fillStyle = g;
    roundRect(ctx, px + inset, py + inset, cw - inset * 2, ch - inset * 2, r * 0.9);
    ctx.fill();
    // brilho de bala / gelatina
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    roundRect(ctx, px + inset * 1.6, py + inset * 1.4, (cw - inset * 3) * 0.38, (ch - inset * 3) * 0.2, r * 0.45);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(px + cw * 0.32, py + ch * 0.3, cw * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "crt") {
    const inset = Math.max(1, cw * 0.08);
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? cw * 0.35 : cw * 0.12;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, cw * 0.1);
    ctx.strokeRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);
    if (hatch) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,176,0,0.35)";
      ctx.lineWidth = Math.max(1, cw * 0.04);
      for (let i = -ch; i < cw + ch; i += Math.max(3, cw * 0.18)) {
        ctx.beginPath();
        ctx.moveTo(px + inset + i, py + inset);
        ctx.lineTo(px + inset + i - ch + inset * 2, py + ch - inset);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "rgba(255, 176, 0, 0.18)";
      ctx.fillRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);
    }
    ctx.shadowBlur = 0;
  } else if (style === "pixel") {
    const inset = Math.max(1, cw * 0.06);
    // flat fill
    ctx.fillStyle = color;
    ctx.fillRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);
    // bevel highlight
    ctx.fillStyle = shade(color, 0.35);
    ctx.fillRect(px + inset, py + inset, cw - inset * 2, Math.max(1, ch * 0.12));
    ctx.fillRect(px + inset, py + inset, Math.max(1, cw * 0.12), ch - inset * 2);
    // shadow edge
    ctx.fillStyle = deep || shade(color, -0.35);
    ctx.fillRect(px + inset, py + ch - inset - Math.max(1, ch * 0.12), cw - inset * 2, Math.max(1, ch * 0.12));
    ctx.fillRect(px + cw - inset - Math.max(1, cw * 0.12), py + inset, Math.max(1, cw * 0.12), ch - inset * 2);
    // hard border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(1, cw * 0.06);
    ctx.strokeRect(px + inset * 0.5, py + inset * 0.5, cw - inset, ch - inset);
  } else {
    // neon — contorno brilhante + miolo translúcido (igual ao print)
    const inset = Math.max(1.0, cw * 0.08);
    const r = Math.max(3, cw * 0.22);
    // bloom externo (todas as peças, não só a ativa)
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? cw * 0.55 : cw * 0.32;
    // miolo colorido semi-transparente
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * (glow ? 0.42 : 0.32);
    roundRect(ctx, px + inset, py + inset, cw - inset * 2, ch - inset * 2, r);
    ctx.fill();
    ctx.globalAlpha = alpha;
    // borda neon grossa
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.4, cw * 0.14);
    roundRect(ctx, px + inset, py + inset, cw - inset * 2, ch - inset * 2, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // centro mais escuro / vidro
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, px + inset * 1.35, py + inset * 1.35, cw - inset * 2.7, ch - inset * 2.7, r * 0.65);
    ctx.fill();
    // highlight interno
    ctx.fillStyle = shade(color, 0.45 * pulse);
    ctx.globalAlpha = alpha * 0.55;
    roundRect(
      ctx,
      px + inset * 1.6,
      py + inset * 1.5,
      (cw - inset * 3.2) * 0.45,
      (ch - inset * 3.2) * 0.28,
      r * 0.35,
    );
    ctx.fill();
    ctx.globalAlpha = alpha;
    // anel interno claro
    ctx.strokeStyle = shade(color, 0.55);
    ctx.lineWidth = Math.max(1, cw * 0.045);
    roundRect(ctx, px + inset * 0.85, py + inset * 0.85, cw - inset * 1.7, ch - inset * 1.7, r * 0.9);
    ctx.stroke();
  }
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
