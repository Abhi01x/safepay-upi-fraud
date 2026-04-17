export class BiometricCollector {
  constructor() {
    this.keyTimestamps = [];
    this.backspaceCount = 0;
    this.mousePositions = [];
    this.sessionStart = Date.now();
    this.copyPasteDetected = false;
    this.fieldHesitation = false;
    this._lastKeystroke = Date.now();
    this._hesitationTimer = null;
    this._listeners = [];
  }

  startTracking() {
    const onKeyDown = (e) => {
      const now = Date.now();
      this.keyTimestamps.push(now);
      if (e.key === 'Backspace') {
        this.backspaceCount++;
      }
      // Detect hesitation (>3s gap)
      if (now - this._lastKeystroke > 3000 && this.keyTimestamps.length > 1) {
        this.fieldHesitation = true;
      }
      this._lastKeystroke = now;
    };

    const onPaste = () => {
      this.copyPasteDetected = true;
    };

    const onMouseMove = (e) => {
      this.mousePositions.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      // Keep only last 200 points
      if (this.mousePositions.length > 200) {
        this.mousePositions = this.mousePositions.slice(-200);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('paste', onPaste);
    document.addEventListener('mousemove', onMouseMove);

    this._listeners = [
      ['keydown', onKeyDown],
      ['paste', onPaste],
      ['mousemove', onMouseMove],
    ];
  }

  stopTracking() {
    this._listeners.forEach(([event, handler]) => {
      document.removeEventListener(event, handler);
    });
    this._listeners = [];
  }

  getTypingSpeed() {
    if (this.keyTimestamps.length < 2) return 150;
    const gaps = [];
    for (let i = 1; i < this.keyTimestamps.length; i++) {
      const gap = this.keyTimestamps[i] - this.keyTimestamps[i - 1];
      if (gap < 2000) gaps.push(gap); // ignore pauses > 2s
    }
    if (gaps.length === 0) return 150;
    return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  getSessionDuration() {
    return Math.round((Date.now() - this.sessionStart) / 1000 * 10) / 10;
  }

  getMouseMovementScore() {
    const pts = this.mousePositions;
    if (pts.length < 10) return 50;

    let totalDist = 0;
    let straightDist = 0;
    let directionChanges = 0;

    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);

      if (i > 1) {
        const pdx = pts[i - 1].x - pts[i - 2].x;
        const pdy = pts[i - 1].y - pts[i - 2].y;
        const cross = dx * pdy - dy * pdx;
        if (Math.abs(cross) > 50) directionChanges++;
      }
    }

    if (pts.length > 1) {
      const fdx = pts[pts.length - 1].x - pts[0].x;
      const fdy = pts[pts.length - 1].y - pts[0].y;
      straightDist = Math.sqrt(fdx * fdx + fdy * fdy);
    }

    // Natural mouse has curvature and direction changes
    const curvatureRatio = straightDist > 0 ? totalDist / straightDist : 1;
    const changeRate = directionChanges / pts.length;

    // Score: more curvature + direction changes = more natural
    let score = Math.min(100, Math.round(
      (curvatureRatio * 15) + (changeRate * 200) + 20
    ));

    return Math.max(0, Math.min(100, score));
  }

  getData() {
    return {
      typing_speed_ms: this.getTypingSpeed(),
      session_duration_sec: this.getSessionDuration(),
      copy_paste_detected: this.copyPasteDetected,
      field_hesitation: this.fieldHesitation,
      backspace_count: this.backspaceCount,
      mouse_movement_score: this.getMouseMovementScore(),
    };
  }

  reset() {
    this.keyTimestamps = [];
    this.backspaceCount = 0;
    this.mousePositions = [];
    this.sessionStart = Date.now();
    this.copyPasteDetected = false;
    this.fieldHesitation = false;
    this._lastKeystroke = Date.now();
  }
}
