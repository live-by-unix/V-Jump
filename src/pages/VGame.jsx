import React, { useEffect, useRef, useState } from "react";

const VGame = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coinCount, setCoinCount] = useState(0);
  const [bestCoins, setBestCoins] = useState(0);
  const [speedBoostActive, setSpeedBoostActive] = useState(false);
  const [slowdownActive, setSlowdownActive] = useState(false);
  const [gameState, setGameState] = useState("menu"); // menu | playing | gameover
  const [muted, setMuted] = useState(false);
  const gameStateRef = useRef("menu");
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const mutedRef = useRef(false);
  const tapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const hs = parseInt(localStorage.getItem("v_highscore") || "0", 10);
    highScoreRef.current = hs;
    setHighScore(hs);
    const bc = parseInt(localStorage.getItem("v_bestcoins") || "0", 10);
    setBestCoins(bc);
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = canvas.clientWidth || 800);
    let height = (canvas.height = canvas.clientHeight || 600);

    const resize = () => {
      width = canvas.width = canvas.clientWidth || 800;
      height = canvas.height = canvas.clientHeight || 600;
    };
    window.addEventListener("resize", resize);

    // ===== Audio (Web Audio API generated song) =====
    let audioCtx = null;
    let masterGain = null;
    let songTimer = null;
    let beatIndex = 0;

    const initAudio = () => {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(audioCtx.destination);
    };

    const playTone = (freq, duration, type = "sine", vol = 0.5, when = 0) => {
      if (!audioCtx || mutedRef.current) return;
      const t0 = audioCtx.currentTime + when;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    };

    const playNoise = (duration, vol = 0.3) => {
      if (!audioCtx || mutedRef.current) return;
      const t0 = audioCtx.currentTime;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t0);
      noise.stop(t0 + duration);
    };

    // Simple looping melody pattern (frequencies in Hz)
    const melody = [
      [261.63, 0.25], [329.63, 0.25], [392.0, 0.25], [523.25, 0.25],
      [392.0, 0.25], [329.63, 0.25], [261.63, 0.25], [196.0, 0.25],
      [220.0, 0.25], [277.18, 0.25], [329.63, 0.25], [440.0, 0.25],
      [329.63, 0.25], [277.18, 0.25], [220.0, 0.25], [174.61, 0.25],
    ];
    const bass = [130.81, 130.81, 164.81, 164.81, 110.0, 110.0, 146.83, 146.83];

    const startSong = () => {
      if (!audioCtx) initAudio();
      if (audioCtx.state === "suspended") audioCtx.resume();
      if (songTimer) clearInterval(songTimer);
      beatIndex = 0;
      const beatDuration = 0.25;
      songTimer = setInterval(() => {
        if (mutedRef.current) return;
        const m = melody[beatIndex % melody.length];
        playTone(m[0], m[1] * 1.5, "square", 0.18);
        if (beatIndex % 2 === 0) {
          const b = bass[(beatIndex / 2) % bass.length];
          playTone(b, 0.4, "sawtooth", 0.15);
        }
        if (beatIndex % 4 === 0) playTone(m[0] * 2, 0.1, "sine", 0.1);
        beatIndex++;
      }, beatDuration * 1000);
    };

    const stopSong = () => {
      if (songTimer) clearInterval(songTimer);
      songTimer = null;
    };

    // ===== Game State =====
    const player = {
      x: 0, y: 0, vy: 0, radius: 16,
      trail: [],
    };
    let obstacles = [];
    let coins = [];
    let particles = [];
    let stars = [];
    let scrollX = 0;
    let speed = 3;
    let currentSpeed = 3;
    let spawnTimer = 0;
    let coinTimer = 0;
    let portalTimer = 0;
    let spawnInterval = 60;
    let speedBoostTimer = 0;
    let slowdownTimer = 0;
    let portals = [];
    let elapsed = 0;
    let lastTime = performance.now();
    let cameraShake = 0;
    let coinCount = 0;

    const initStars = () => {
      stars = [];
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: Math.random() * 0.8 + 0.2,
          size: Math.random() * 1.5 + 0.3,
        });
      }
    };
    initStars();

    const resetGame = () => {
      player.x = width * 0.25;
      player.y = height * 0.5;
      player.vy = 0;
      player.trail = [];
      obstacles = [];
      coins = [];
      particles = [];
      scrollX = 0;
      speed = 3;
      currentSpeed = 3;
      spawnTimer = 0;
      coinTimer = 0;
      portalTimer = 0;
      spawnInterval = 60;
      speedBoostTimer = 0;
      slowdownTimer = 0;
      portals = [];
      elapsed = 0;
      cameraShake = 0;
      coinCount = 0;
      setSpeedBoostActive(false);
      setSlowdownActive(false);
      setCoinCount(0);
      setScore(0);
      scoreRef.current = 0;
    };

    const startGame = () => {
      initAudio();
      resetGame();
      startSong();
      setGameState("playing");
      gameStateRef.current = "playing";
    };

    const endGame = () => {
      setGameState("gameover");
      gameStateRef.current = "gameover";
      stopSong();
      playNoise(0.5, 0.4);
      playTone(150, 0.6, "sawtooth", 0.3);
      playTone(100, 0.8, "sawtooth", 0.25, 0.1);
      cameraShake = 20;
      const finalScore = scoreRef.current;
      const finalCoins = coinCount;
      if (finalScore > highScoreRef.current) {
        highScoreRef.current = finalScore;
        setHighScore(finalScore);
        localStorage.setItem("v_highscore", String(finalScore));
      }
      const prevBestCoins = parseInt(localStorage.getItem("v_bestcoins") || "0", 10);
      if (finalCoins > prevBestCoins) {
        localStorage.setItem("v_bestcoins", String(finalCoins));
        setBestCoins(finalCoins);
      }
    };

    const tap = () => {
      if (gameStateRef.current === "menu") {
        startGame();
        return;
      }
      if (gameStateRef.current === "gameover") {
        startGame();
        return;
      }
      if (gameStateRef.current === "playing") {
        player.vy = slowdownTimer > 0 ? -5.2 : -7.5;
        playTone(440, 0.12, "sine", 0.25);
        for (let i = 0; i < 8; i++) {
          particles.push({
            x: player.x, y: player.y + player.radius * 0.5,
            vx: -Math.random() * 3 - 1,
            vy: Math.random() * 2 - 1,
            life: 1, decay: 0.04,
            color: "0, 255, 100", size: Math.random() * 3 + 1,
          });
        }
      }
    };

    tapRef.current = tap;

    // ===== Input =====
    const onKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.repeat) tap();
      }
      if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m);
      }
    };
    const onPointerDown = (e) => {
      e.preventDefault();
      tap();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    if (containerRef.current) containerRef.current.focus();

    // ===== Spawn =====
    const spawnObstacle = () => {
      const r = Math.random() * 14 + 12;
      const x = width + r + Math.random() * 100;
      const y = Math.random() * (height - r * 2) + r;
      const towardSpeed = Math.random() * 5 + 12 + currentSpeed * 1.4;
      const drift = (Math.random() - 0.5) * (1.5 + elapsed * 0.0014) * 2.5;
      obstacles.push({
        x, y, r, vy: drift, vx: -towardSpeed,
        hue: 20 + Math.random() * 20,
        trail: [],
        pulse: Math.random() * Math.PI * 2,
      });
      playTone(80 + Math.random() * 40, 0.08, "square", 0.08);
    };

    const spawnCoin = () => {
      const r = 10;
      const x = width + r + Math.random() * 150;
      const y = Math.random() * (height - r * 4) + r * 2;
      const coinSpeed = Math.random() * 2 + 4 + currentSpeed * 0.6;
      coins.push({
        x, y, r, vx: -coinSpeed, vy: Math.sin(Math.random() * 6) * 0.5,
        pulse: Math.random() * Math.PI * 2,
        collected: false,
      });
    };

    const spawnPortal = (type) => {
      const r = type === "slow" ? 24 : 15;
      const x = width + r + Math.random() * 120;
      const y = Math.random() * (height - r * 4) + r * 2;
      const vx = -(Math.random() * 2 + 3.5 + currentSpeed * 0.5);
      portals.push({ x, y, r, vx, type, pulse: Math.random() * Math.PI * 2, rot: 0 });
    };

    // ===== Collision =====
    const checkCollision = () => {
      for (const o of obstacles) {
        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.radius + o.r - 4) return true;
      }
      return false;
    };

    // ===== Update =====
    const update = (dt) => {
      if (gameStateRef.current !== "playing") return;

      elapsed += dt;
      const wasBoost = speedBoostTimer > 0;
      const wasSlow = slowdownTimer > 0;
      if (speedBoostTimer > 0) speedBoostTimer--;
      if (slowdownTimer > 0) slowdownTimer--;
      if (wasBoost && speedBoostTimer <= 0) setSpeedBoostActive(false);
      if (wasSlow && slowdownTimer <= 0) setSlowdownActive(false);
      speed = 4 + elapsed * 0.0012;
      let effSpeed = speed;
      if (speedBoostTimer > 0) effSpeed *= 1.7;
      if (slowdownTimer > 0) effSpeed *= 0.5;
      currentSpeed = effSpeed;
      scrollX += effSpeed;
      spawnInterval = Math.max(10, 50 - elapsed * 0.04);

      // Player physics
      player.vy += 0.35; // gravity
      if (player.vy > 12) player.vy = 12;
      player.y += player.vy;

      // Walls
      if (player.y - player.radius < 0) {
        player.y = player.radius;
        player.vy = 0;
      }
      if (player.y + player.radius > height) {
        return endGame();
      }

      // Player trail
      player.trail.push({ x: player.x, y: player.y, life: 1 });
      if (player.trail.length > 25) player.trail.shift();
      for (const t of player.trail) t.life -= 0.04;

      // Ambient player particles
      if (Math.random() < 0.5) {
        particles.push({
          x: player.x - player.radius * 0.5,
          y: player.y,
          vx: -Math.random() * 2 - 0.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1, decay: 0.03,
          color: "0, 255, 120", size: Math.random() * 2 + 1,
        });
      }

      // Spawn obstacles
      spawnTimer++;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnObstacle();
        if (elapsed > 12 && Math.random() < 0.5) spawnObstacle();
        if (elapsed > 30 && Math.random() < 0.35) spawnObstacle();
      }

      // Spawn coins
      coinTimer++;
      if (coinTimer >= 90) {
        coinTimer = 0;
        if (Math.random() < 0.7) spawnCoin();
      }

      // Spawn portals
      portalTimer++;
      if (portalTimer >= 200) {
        portalTimer = 0;
        const type = Math.random() < 0.6 ? "slow" : "speed";
        spawnPortal(type);
        if (type === "slow" && Math.random() < 0.4) spawnPortal("slow");
      }

      // Update coins
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.x += c.vx;
        c.y += c.vy;
        c.pulse += 0.1;
        if (c.x < -c.r * 2) {
          coins.splice(i, 1);
          continue;
        }
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + c.r) {
          coins.splice(i, 1);
          coinCount++;
          setCoinCount(coinCount);
          scoreRef.current += 50;
          setScore(scoreRef.current);
          playTone(880, 0.1, "sine", 0.3);
          playTone(1320, 0.12, "sine", 0.2, 0.05);
          for (let k = 0; k < 12; k++) {
            particles.push({
              x: c.x, y: c.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 1, decay: 0.04,
              color: "255, 215, 0", size: Math.random() * 3 + 1.5,
            });
          }
        }
      }

      // Update portals
      for (let i = portals.length - 1; i >= 0; i--) {
        const p = portals[i];
        p.x += p.vx;
        p.pulse += 0.08;
        p.rot += 0.06;
        if (p.x < -p.r * 2) {
          portals.splice(i, 1);
          continue;
        }
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.r) {
          portals.splice(i, 1);
          if (p.type === "speed") {
            speedBoostTimer = 240;
            setSpeedBoostActive(true);
            scoreRef.current += 100;
            setScore(scoreRef.current);
            playTone(660, 0.15, "sine", 0.3);
            playTone(990, 0.2, "sine", 0.2, 0.06);
            for (let k = 0; k < 14; k++) {
              particles.push({
                x: p.x, y: p.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1, decay: 0.04,
                color: "0, 200, 255", size: Math.random() * 3 + 1.5,
              });
            }
          } else {
            slowdownTimer = 300;
            setSlowdownActive(true);
            scoreRef.current = Math.max(0, scoreRef.current - 50);
            setScore(scoreRef.current);
            playTone(220, 0.3, "sawtooth", 0.3);
            playTone(150, 0.4, "sawtooth", 0.2, 0.1);
            cameraShake = 10;
            for (let k = 0; k < 16; k++) {
              particles.push({
                x: p.x, y: p.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 1, decay: 0.04,
                color: "220, 40, 220", size: Math.random() * 3 + 1.5,
              });
            }
          }
        }
      }

      // Update obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x += o.vx;
        o.y += o.vy;
        o.pulse += 0.15;
        o.trail.push({ x: o.x, y: o.y, life: 1 });
        if (o.trail.length > 12) o.trail.shift();
        for (const t of o.trail) t.life -= 0.08;
        if (o.x < -o.r * 2 || o.y < -o.r * 2 || o.y > height + o.r * 2) {
          obstacles.splice(i, 1);
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Update stars
      for (const s of stars) {
        s.x -= currentSpeed * s.z * 0.5;
        if (s.x < 0) {
          s.x = width;
          s.y = Math.random() * height;
        }
      }

      // Collision
      if (checkCollision()) return endGame();

      // Score
      const newScore = Math.floor(scrollX / 10);
      if (newScore !== scoreRef.current) {
        scoreRef.current = newScore;
        setScore(newScore);
      }

      if (cameraShake > 0) cameraShake -= 1;
    };

    // ===== Render =====
    const drawFireball = (x, y, r, hue, pulse, alpha = 1) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.8 * alpha})`);
      glow.addColorStop(0.3, `hsla(${hue}, 100%, 50%, ${0.4 * alpha})`);
      glow.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      const core = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      core.addColorStop(0, `hsla(${hue}, 100%, 90%, ${alpha})`);
      core.addColorStop(0.5, `hsla(${hue}, 100%, 65%, ${alpha})`);
      core.addColorStop(1, `hsla(${hue}, 100%, 45%, ${alpha})`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, r + Math.sin(pulse) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = () => {
      // Camera shake
      let sx = 0, sy = 0;
      if (cameraShake > 0) {
        sx = (Math.random() - 0.5) * cameraShake;
        sy = (Math.random() - 0.5) * cameraShake;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // Background
      ctx.fillStyle = "#000";
      ctx.fillRect(-50, -50, width + 100, height + 100);

      // Stars
      for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${s.z * 0.6})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      // Grid floor lines for motion sense
      ctx.strokeStyle = "rgba(0,255,150,0.08)";
      ctx.lineWidth = 1;
      const gridOffset = scrollX % 60;
      for (let i = -1; i < width / 60 + 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 60 - gridOffset, 0);
        ctx.lineTo(i * 60 - gridOffset, height);
        ctx.stroke();
      }
      for (let j = 0; j < height / 60; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * 60);
        ctx.lineTo(width, j * 60);
        ctx.stroke();
      }

      // Particles
      for (const p of particles) {
        ctx.fillStyle = `rgba(${p.color},${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Obstacle trails
      for (const o of obstacles) {
        for (let i = 0; i < o.trail.length; i++) {
          const t = o.trail[i];
          if (t.life > 0) {
            ctx.fillStyle = `hsla(${o.hue}, 100%, 55%, ${t.life * 0.3})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, o.r * 0.6 * t.life, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Obstacles
      for (const o of obstacles) {
        drawFireball(o.x, o.y, o.r, o.hue, o.pulse);
      }

      // Portals
      for (const p of portals) {
        const isSlow = p.type === "slow";
        const hue = isSlow ? 290 : 190;
        const pulse = p.r + Math.sin(p.pulse) * 2;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6);
        glow.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.85)`);
        glow.addColorStop(0.5, `hsla(${hue}, 100%, 50%, 0.35)`);
        glow.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.9)`;
        ctx.lineWidth = 3;
        ctx.setLineDash(isSlow ? [6, 6] : [4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coins
      for (const c of coins) {
        const pulse = c.r + Math.sin(c.pulse) * 1.5;
        const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 2.5);
        glow.addColorStop(0, "rgba(255, 215, 0, 0.9)");
        glow.addColorStop(0.4, "rgba(255, 180, 0, 0.4)");
        glow.addColorStop(1, "rgba(255, 180, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        const core = ctx.createRadialGradient(c.x - c.r * 0.3, c.y - c.r * 0.3, 0, c.x, c.y, pulse);
        core.addColorStop(0, "rgba(255, 255, 220, 1)");
        core.addColorStop(0.6, "rgba(255, 215, 0, 1)");
        core.addColorStop(1, "rgba(255, 160, 0, 1)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(c.x, c.y, pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player trail
      for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i];
        if (t.life > 0) {
          const tr = player.radius * (i / player.trail.length) * 0.9;
          ctx.fillStyle = `rgba(0,255,100,${t.life * 0.4})`;
          ctx.beginPath();
          ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Player
      if (gameStateRef.current === "playing" || gameStateRef.current === "gameover") {
        if (speedBoostTimer > 0) {
          ctx.strokeStyle = "rgba(0,200,255,0.8)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.radius + 8 + Math.sin(elapsed * 0.3) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (slowdownTimer > 0) {
          ctx.strokeStyle = "rgba(220,40,220,0.8)";
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawFireball(player.x, player.y, player.radius, 130, elapsed * 0.1);
      }

      ctx.restore();
    };

    // ===== Loop =====
    let rafId;
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;
      update(dt);
      render();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // Initial draw for menu
    player.x = width * 0.25;
    player.y = height * 0.5;

    return () => {
      cancelAnimationFrame(rafId);
      stopSong();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      if (audioCtx) audioCtx.close();
    };
  }, []);

  return (
    <div ref={containerRef} tabIndex={0} className="w-screen h-screen bg-black relative overflow-hidden select-none outline-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ imageRendering: "auto" }}
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="text-green-400 font-mono text-2xl font-bold tracking-wider drop-shadow-[0_0_10px_rgba(0,255,100,0.8)]">
            SCORE {score}
          </div>
          <div className="text-green-600 font-mono text-sm">
            BEST {highScore}
          </div>
          <div className="text-yellow-400 font-mono text-sm mt-1 drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">
            🪙 COINS {coinCount}
          </div>
          <div className="flex gap-2 mt-1">
            {speedBoostActive && (
              <span className="text-cyan-400 font-mono text-xs border border-cyan-500/50 px-2 py-0.5 rounded bg-cyan-500/10">
                ⚡ BOOST
              </span>
            )}
            {slowdownActive && (
              <span className="text-fuchsia-400 font-mono text-xs border border-fuchsia-500/50 px-2 py-0.5 rounded bg-fuchsia-500/10">
                🐌 SLOWED
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            className="pointer-events-auto text-green-400 font-mono text-sm border border-green-500/40 px-3 py-1 rounded hover:bg-green-500/10 transition"
          >
            {muted ? "🔇 MUTED" : "🔊 SOUND"}
          </button>
        </div>
      </div>

      {/* Menu */}
      {gameState === "menu" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
          onClick={() => tapRef.current && tapRef.current()}
        >
          <h1
            className="text-green-400 font-mono text-8xl font-black tracking-widest"
            style={{ textShadow: "0 0 30px rgba(0,255,100,0.9), 0 0 60px rgba(0,255,100,0.5)" }}
          >
            V
          </h1>
          <p className="text-green-300 font-mono text-lg mt-4 tracking-wide">
            ENTER / TAP to rise. Avoid the orange fire. Grab gold coins for +50.
          </p>
          <p className="text-cyan-300 font-mono text-sm mt-2 tracking-wide">
            Cyan portals = speed boost (+100). Fuchsia portals = slowdown (-50, weaker jumps).
          </p>
          <p className="text-green-600 font-mono text-sm mt-2 animate-pulse">
            Press ENTER / SPACE or tap to begin
          </p>
        </div>
      )}

      {/* Game Over */}
      {gameState === "gameover" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => tapRef.current && tapRef.current()}
        >
          <h1
            className="text-orange-500 font-mono text-6xl font-black tracking-widest"
            style={{ textShadow: "0 0 30px rgba(255,100,0,0.9)" }}
          >
            BURNED
          </h1>
          <p className="text-green-400 font-mono text-3xl mt-4">SCORE {score}</p>
          <p className="text-yellow-400 font-mono text-lg">🪙 COINS {coinCount}</p>
          <p className="text-green-600 font-mono text-lg">BEST {highScore}</p>
          <p className="text-green-300 font-mono text-sm mt-6 animate-pulse">
            Press ENTER / SPACE or tap to retry
          </p>
        </div>
      )}
    </div>
  );
};

export default VGame;