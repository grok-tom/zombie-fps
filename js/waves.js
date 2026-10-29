/**
 * Wave director: spawn counts, intermission, difficulty curve.
 * count = 4 + N*3; speed/HP scale with wave.
 */
export class WaveDirector {
  constructor({ spawnPoints, onWaveStart, onSpawn }) {
    this.spawnPoints = spawnPoints;
    this.onWaveStart = onWaveStart;
    this.onSpawn = onSpawn;
    this.wave = 0;
    this.phase = 'idle'; // idle | spawning | fighting | intermission
    this.timer = 0;
    this.toSpawn = 0;
    this.spawnInterval = 0.55;
    this.spawnAcc = 0;
    this.kills = 0;
  }

  reset() {
    this.wave = 0;
    this.phase = 'idle';
    this.timer = 0;
    this.toSpawn = 0;
    this.spawnAcc = 0;
    this.kills = 0;
  }

  start() {
    this.wave = 0;
    this.kills = 0;
    this.beginNextWave();
  }

  beginNextWave() {
    this.wave += 1;
    this.toSpawn = 4 + this.wave * 3;
    this.spawnInterval = Math.max(0.28, 0.6 - this.wave * 0.03);
    this.spawnAcc = 0;
    this.phase = 'spawning';
    this.timer = 0;
    if (this.onWaveStart) this.onWaveStart(this.wave);
  }

  statsForWave() {
    const hp = 50 + this.wave * 12;
    const speed = 1.9 + this.wave * 0.18;
    return { hp, speed: Math.min(speed, 4.2) };
  }

  onKill() {
    this.kills += 1;
  }

  update(dt, aliveZombies) {
    if (this.phase === 'idle') return;

    if (this.phase === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this.beginNextWave();
      return;
    }

    if (this.phase === 'spawning') {
      this.spawnAcc += dt;
      while (this.toSpawn > 0 && this.spawnAcc >= this.spawnInterval) {
        this.spawnAcc -= this.spawnInterval;
        this._spawnOne();
        this.toSpawn -= 1;
      }
      if (this.toSpawn <= 0) {
        this.phase = 'fighting';
      }
    }

    if (this.phase === 'fighting' || this.phase === 'spawning') {
      if (this.toSpawn <= 0 && aliveZombies <= 0) {
        this.phase = 'intermission';
        this.timer = 4;
      }
    }
  }

  _spawnOne() {
    const pts = this.spawnPoints;
    const p = pts[Math.floor(Math.random() * pts.length)].clone();
    // jitter
    p.x += (Math.random() - 0.5) * 3;
    p.z += (Math.random() - 0.5) * 3;
    const stats = this.statsForWave();
    if (this.onSpawn) this.onSpawn(p, stats);
  }
}
