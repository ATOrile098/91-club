/**
 * 97 NULL - Interactive Canvas Slider Puzzle CAPTCHA
 */

class SliderCaptcha {
  constructor() {
    this.modal = document.getElementById('captcha-modal');
    this.bgCanvas = document.getElementById('captcha-bg-canvas');
    this.pieceCanvas = document.getElementById('captcha-piece-canvas');
    this.sliderHandle = document.getElementById('slider-handle');
    this.sliderTrack = document.getElementById('slider-track');
    this.sliderFill = document.getElementById('slider-track-fill');
    this.sliderText = document.getElementById('slider-track-text');
    this.statusOverlay = document.getElementById('captcha-status-overlay');
    
    this.width = 310;
    this.height = 160;
    this.puzzleSize = 42;
    this.puzzleRadius = 8;
    
    this.targetX = 180;
    this.targetY = 50;
    this.currentX = 0;
    
    this.isDragging = false;
    this.startX = 0;
    this.onSuccessCallback = null;

    this.initEvents();
  }

  initEvents() {
    // Mouse events
    this.sliderHandle.addEventListener('mousedown', (e) => this.onDragStart(e.clientX));
    window.addEventListener('mousemove', (e) => this.onDragMove(e.clientX));
    window.addEventListener('mouseup', () => this.onDragEnd());

    // Touch events
    this.sliderHandle.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) this.onDragStart(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length > 0) {
        this.onDragMove(e.touches[0].clientX);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => this.onDragEnd());
  }

  show(onSuccess) {
    this.onSuccessCallback = onSuccess;
    this.modal.classList.add('active');
    this.statusOverlay.classList.add('hidden');
    this.resetSlider();
    this.render();
  }

  close() {
    this.modal.classList.remove('active');
    this.isDragging = false;
  }

  refresh() {
    this.resetSlider();
    this.render();
  }

  resetSlider() {
    this.currentX = 0;
    this.sliderHandle.style.left = '0px';
    this.sliderFill.style.width = '0px';
    this.sliderText.style.opacity = '1';
    this.statusOverlay.classList.add('hidden');
    this.isDragging = false;
    if (this.pieceCanvas) {
      this.pieceCanvas.style.transform = `translateX(0px)`;
    }
  }

  // Draw puzzle piece path
  drawPuzzlePath(ctx, x, y) {
    const s = this.puzzleSize;
    const r = this.puzzleRadius;
    const PI = Math.PI;

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Top edge with tab
    ctx.lineTo(x + s / 2 - r, y);
    ctx.arc(x + s / 2, y - r + 2, r, 0.72 * PI, 2.26 * PI, false);
    ctx.lineTo(x + s, y);
    
    // Right edge with tab
    ctx.lineTo(x + s, y + s / 2 - r);
    ctx.arc(x + s + r - 2, y + s / 2, r, 1.22 * PI, 2.78 * PI, false);
    ctx.lineTo(x + s, y + s);
    
    // Bottom edge
    ctx.lineTo(x, y + s);
    
    // Left edge
    ctx.lineTo(x, y);
    ctx.closePath();
  }

  // Generate procedural realistic nature/grass artwork for the background
  drawBackgroundGraphic(ctx) {
    // Night grass glowing scene (matching original 91Club nature screenshot)
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0c1a1a');
    gradient.addColorStop(0.5, '#122c1e');
    gradient.addColorStop(1, '#274b1e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Glowing sunburst / flare in bottom-left
    const radialGlow = ctx.createRadialGradient(90, 110, 5, 90, 110, 100);
    radialGlow.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
    radialGlow.addColorStop(0.3, 'rgba(163, 230, 53, 0.4)');
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, this.width, this.height);

    // Grass blades simulation
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 90; i++) {
      const startX = Math.random() * this.width;
      const endX = startX + (Math.random() * 40 - 20);
      const heightBlade = 40 + Math.random() * 110;
      
      const bladeGrad = ctx.createLinearGradient(startX, this.height, endX, this.height - heightBlade);
      bladeGrad.addColorStop(0, '#3f6212');
      bladeGrad.addColorStop(0.6, '#84cc16');
      bladeGrad.addColorStop(1, '#bef264');
      
      ctx.strokeStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(startX, this.height);
      ctx.quadraticCurveTo(startX + (Math.random() * 20 - 10), this.height - heightBlade / 2, endX, this.height - heightBlade);
      ctx.stroke();
    }

    // Dew sparkles
    for (let j = 0; j < 30; j++) {
      const sparkX = Math.random() * this.width;
      const sparkY = 30 + Math.random() * (this.height - 40);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, Math.random() * 2.2 + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  render() {
    const bgCtx = this.bgCanvas.getContext('2d');
    const pieceCtx = this.pieceCanvas.getContext('2d');

    // Randomize target position
    this.targetX = Math.floor(130 + Math.random() * 120);
    this.targetY = Math.floor(25 + Math.random() * 80);

    // Clear canvases
    bgCtx.clearRect(0, 0, this.width, this.height);
    pieceCtx.clearRect(0, 0, this.width, this.height);

    // 1. Draw base background
    this.drawBackgroundGraphic(bgCtx);

    // 2. Draw piece cutout on piece canvas
    pieceCtx.save();
    this.drawPuzzlePath(pieceCtx, 10, this.targetY);
    pieceCtx.clip();
    
    // Draw background onto the clipped piece
    pieceCtx.drawImage(this.bgCanvas, this.targetX - 10, 0, this.width, this.height, 0, 0, this.width, this.height);
    
    // Piece stroke / glow
    pieceCtx.strokeStyle = '#ffffff';
    pieceCtx.lineWidth = 2.5;
    pieceCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    pieceCtx.shadowBlur = 6;
    this.drawPuzzlePath(pieceCtx, 10, this.targetY);
    pieceCtx.stroke();
    pieceCtx.restore();

    // 3. Draw target hole on bg canvas
    bgCtx.save();
    this.drawPuzzlePath(bgCtx, this.targetX, this.targetY);
    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    bgCtx.fill();
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    bgCtx.lineWidth = 2;
    bgCtx.stroke();
    bgCtx.restore();
  }

  onDragStart(clientX) {
    this.isDragging = true;
    this.startX = clientX;
    this.sliderText.style.opacity = '0';
  }

  onDragMove(clientX) {
    if (!this.isDragging) return;

    const maxTrack = this.width - 42; // Track width minus handle width
    let moveX = clientX - this.startX;

    if (moveX < 0) moveX = 0;
    if (moveX > maxTrack) moveX = maxTrack;

    this.currentX = moveX;
    this.sliderHandle.style.left = `${moveX}px`;
    this.sliderFill.style.width = `${moveX + 21}px`;

    // Translate puzzle piece proportionally to match canvas
    const pieceMaxMove = this.width - this.puzzleSize - 20;
    const pieceTranslate = (moveX / maxTrack) * pieceMaxMove;
    this.pieceCanvas.style.transform = `translateX(${pieceTranslate}px)`;
  }

  onDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const maxTrack = this.width - 42;
    const pieceMaxMove = this.width - this.puzzleSize - 20;
    const pieceActualX = 10 + (this.currentX / maxTrack) * pieceMaxMove;

    const diff = Math.abs(pieceActualX - this.targetX);

    // Tolerance check (±6 pixels)
    if (diff <= 7) {
      // Verified successfully!
      this.statusOverlay.classList.remove('hidden');
      this.sliderHandle.style.background = '#22c55e';
      this.sliderHandle.style.color = '#ffffff';

      setTimeout(() => {
        this.close();
        if (typeof this.onSuccessCallback === 'function') {
          this.onSuccessCallback();
        }
      }, 700);
    } else {
      // Failed - slight shake animation and reset
      this.sliderHandle.style.background = '#ef4444';
      this.sliderHandle.style.color = '#ffffff';
      
      setTimeout(() => {
        this.sliderHandle.style.background = '#ffffff';
        this.sliderHandle.style.color = '#475569';
        this.refresh();
      }, 500);
    }
  }
}

const sliderCaptcha = new SliderCaptcha();
window.sliderCaptcha = sliderCaptcha;
