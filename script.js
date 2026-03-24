const GAME_DURATION = 30;
const BAR_GOAL = 100;
const WATER_PER_POP = 8;
const BASE_POINTS = 10;
const OVERFLOW_BONUS = 5;
const SPAWN_DELAY = 650;
const BAD_BALLOON_CHANCE = 0.22;
const BAD_PENALTY = 15;
const SPECIAL_BALLOON_CHANCE = 0.1;
const SPECIAL_BALLOON_POINTS = 30;

let gameRunning = false;
let spawnIntervalId;
let timerIntervalId;
let score = 0;
let timeLeft = GAME_DURATION;
let waterLevel = 0;
let highScore = Number.parseInt(localStorage.getItem("water-balloon-high-score") || "0", 10);
let audioContext;

const startButton = document.getElementById("start-btn");
const overlayStartButton = document.getElementById("overlay-start-btn");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("high-score");
const timeDisplay = document.getElementById("time");
const feedbackDisplay = document.getElementById("feedback");
const fillBar = document.getElementById("fill-bar");
const fillStatus = document.getElementById("fill-status");
const gameContainer = document.getElementById("game-container");
const goalChip = document.getElementById("goal-chip");
const introOverlay = document.getElementById("intro-overlay");
const endMessage = document.getElementById("end-message");

const winMessages = [
  "Monkey and Tiger thank you! You filled the tank in time. More families are one step closer to clean water.",
  "Good job! Monkey and Tiger are thrilled to have their water back. Can you do it again to keep it flowing?",
  "Mission complete. Tiger and Monkey applaud you! Your balloon pops delivered a full tank before the timer hit zero."
];

const loseMessages = [
  "The timer ran out before the tank was full. Reset and push the water line farther next round.",
  "Close run. The water bar still needs more before time expires, so try again.",
  "You added water, but the tank was not full in time. Replay and keep bursting balloons faster."
];

const cutsceneLines = [
  { speaker: "left",  name: "Tiger", text: "Those evil balloons are ruining our water supply! We need that water to help the community." },
  { speaker: "right", name: "Monkey", text: "Will you help us get our water back?" },
];

const csScreen    = document.getElementById("cutscene");
const csSpeakerEl = document.getElementById("cs-speaker");
const csTextEl    = document.getElementById("cs-text");
const csNextBtn   = document.getElementById("cs-next-btn");
const csCharLeft  = document.getElementById("cs-char-left");
const csCharRight = document.getElementById("cs-char-right");
let csStep = 0;

function showCutsceneLine(index) {
  const line = cutsceneLines[index];
  csSpeakerEl.textContent = line.name;
  csTextEl.textContent    = line.text;
  csCharLeft.classList.toggle("cs-active",   line.speaker === "left");
  csCharLeft.classList.toggle("cs-inactive", line.speaker !== "left");
  csCharRight.classList.toggle("cs-active",   line.speaker === "right");
  csCharRight.classList.toggle("cs-inactive", line.speaker !== "right");
  const isLast = index === cutsceneLines.length - 1;
  csNextBtn.textContent = isLast ? "Yes! ›" : "Next ›";
}

csNextBtn.addEventListener("click", () => {
  csStep++;
  if (csStep >= cutsceneLines.length) {
    csScreen.classList.add("cs-fade-out");
    csScreen.addEventListener("animationend", () => {
      csScreen.style.display = "none";
    }, { once: true });
    return;
  }
  showCutsceneLine(csStep);
});

showCutsceneLine(0);
// ─────────────────────────────────────────────────────────────────────────────

startButton.addEventListener("click", startGame);
overlayStartButton.addEventListener("click", startGame);
highScoreDisplay.textContent = highScore;
updateWaterBar();

function startGame() {
  if (gameRunning) {
    return;
  }

  primeAudio();
  resetRound();
  gameRunning = true;
  introOverlay.classList.add("hidden");
  endMessage.classList.add("hidden");
  startButton.disabled = true;
  startButton.textContent = "Mission Live";
  goalChip.textContent = "Fill the tank before the timer ends";
  setFeedback("Burst every red balloon you can. Overflow bonus starts once the tank is full.");

  spawnIntervalId = setInterval(createBalloon, SPAWN_DELAY);
  createBalloon();

  timerIntervalId = setInterval(() => {
    timeLeft -= 1;
    timeDisplay.textContent = timeLeft;

    if (timeLeft <= 8) {
      goalChip.textContent = "Final seconds. Keep the water coming";
    }

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function resetRound() {
  clearInterval(spawnIntervalId);
  clearInterval(timerIntervalId);

  score = 0;
  timeLeft = GAME_DURATION;
  waterLevel = 0;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  goalChip.textContent = "Fill the tank before 30 seconds ends";
  setFeedback("Press start to launch the balloon run.");
  updateWaterBar();

  const activeElements = gameContainer.querySelectorAll(".balloon, .burst-ring, .floating-points, .replay-button");
  activeElements.forEach((element) => element.remove());
}

function createBalloon() {
  if (!gameRunning) {
    return;
  }

  const balloon = document.createElement("button");
  const width = Math.round(56 + Math.random() * 30);
  const height = Math.round(width * 1.18);
  const xPosition = Math.random() * Math.max(gameContainer.clientWidth - width - 12, 12);
  const duration = (Math.random() * 1.6 + 3.4).toFixed(2);
  const sway = `${(Math.random() * 1.6 + 1.4).toFixed(2)}s`;

  const roll = Math.random();
  const isSpecial = roll < SPECIAL_BALLOON_CHANCE;
  const isBad = !isSpecial && roll < (SPECIAL_BALLOON_CHANCE + BAD_BALLOON_CHANCE);

  balloon.type = "button";
  balloon.className = `balloon${isSpecial ? " special-balloon" : ""}${isBad ? " bad-balloon" : ""}`;
  balloon.style.width = `${width}px`;
  balloon.style.height = `${height}px`;
  balloon.style.left = `${xPosition}px`;
  balloon.style.bottom = `-${height}px`;
  balloon.style.animationDuration = `${duration}s, ${sway}`;
  balloon.setAttribute("aria-label", isSpecial ? "Pop special bonus balloon" : isBad ? "Avoid this bad balloon" : "Pop water balloon");
  if (isSpecial) {
    balloon.innerHTML = '<span class="special-mark" aria-hidden="true">★</span>';
  } else if (isBad) {
    balloon.innerHTML = '<span class="bad-mark" aria-hidden="true">✕</span>';
  }

  balloon.addEventListener("pointerdown", () => popBalloon(balloon));
  balloon.addEventListener("animationend", () => {
    balloon.remove();
  });

  gameContainer.appendChild(balloon);
}

function popBalloon(balloon) {
  if (!gameRunning || !balloon.isConnected) {
    return;
  }

  const balloonRect = balloon.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  const x = balloonRect.left - containerRect.left + balloonRect.width / 2;
  const y = balloonRect.top - containerRect.top + balloonRect.height / 2;

  if (balloon.classList.contains("special-balloon")) {
    score += SPECIAL_BALLOON_POINTS;
    updateScoreDisplay();
    playPopSound();
    setFeedback(`Golden bonus balloon popped. +${SPECIAL_BALLOON_POINTS} points.`);
    flashContainer("game-flash-special");
    showFloatingPoints(x, y, `+${SPECIAL_BALLOON_POINTS}`);
    showWaterParticles(x, y, "special");
    balloon.classList.add("popping");
    return;
  }

  if (balloon.classList.contains("bad-balloon")) {
    score = Math.max(0, score - BAD_PENALTY);
    updateScoreDisplay();
    playPopSound();
    setFeedback(`Polluted balloon popped. -${BAD_PENALTY} points. Avoid the dark ones.`);
    flashContainer("game-flash-bad");
    showFloatingPoints(x, y, `-${BAD_PENALTY}`, true);
    showWaterParticles(x, y, "bad");
    balloon.classList.add("popping");
    return;
  }

  const bonusActive = waterLevel >= BAR_GOAL;
  const pointsEarned = BASE_POINTS + (bonusActive ? OVERFLOW_BONUS : 0);

  score += pointsEarned;
  waterLevel += WATER_PER_POP;

  updateScoreDisplay();
  updateWaterBar();
  playPopSound();
  setFeedback(bonusActive ? `Overflow bonus active. +${pointsEarned} points added.` : `Pop landed. +${pointsEarned} points and more water collected.`);
  flashContainer(waterLevel >= BAR_GOAL ? "game-flash-overflow" : "game-flash-good");
  showFloatingPoints(x, y, `+${pointsEarned}`);
  showWaterParticles(x, y, "good");
  balloon.classList.add("popping");
}

function updateScoreDisplay() {
  scoreDisplay.textContent = score;
  scoreDisplay.parentElement.classList.remove("score-pop");
  void scoreDisplay.offsetWidth;
  scoreDisplay.parentElement.classList.add("score-pop");
}

function updateWaterBar() {
  const percentage = Math.min((waterLevel / BAR_GOAL) * 100, 100);
  const overflowAmount = Math.max(waterLevel - BAR_GOAL, 0);

  fillBar.style.width = `${percentage}%`;
  fillStatus.textContent = overflowAmount > 0 ? `Full +${overflowAmount}%` : `${Math.round(percentage)}%`;
  fillBar.classList.toggle("fill-bar-overflow", overflowAmount > 0);
  goalChip.textContent = overflowAmount > 0 ? "Tank full. Bonus points unlocked" : goalChip.textContent;
}

function setFeedback(message) {
  feedbackDisplay.textContent = message;
}

function flashContainer(className) {
  gameContainer.classList.remove("game-flash-good", "game-flash-overflow", "game-flash-bad", "game-flash-special");
  void gameContainer.offsetWidth;
  gameContainer.classList.add(className);
}

function showFloatingPoints(x, y, text, isNegative = false) {
  const points = document.createElement("div");
  points.className = `floating-points${isNegative ? " negative" : ""}`;
  points.textContent = text;
  points.style.left = `${x}px`;
  points.style.top = `${y}px`;
  gameContainer.appendChild(points);

  setTimeout(() => {
    points.remove();
  }, 900);
}

function showWaterParticles(x, y, particleType) {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const distance = 44 + Math.random() * 52;
    const tx = Math.round(Math.cos(angle) * distance);
    const ty = Math.round(Math.sin(angle) * distance + 28);
    const size = Math.round(6 + Math.random() * 6);
    const dur = (0.44 + Math.random() * 0.24).toFixed(2);

    const particle = document.createElement("div");
    particle.className = `water-particle ${particleType}`;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${Math.round(size * 1.25)}px`;
    particle.style.setProperty("--tx", `${tx}px`);
    particle.style.setProperty("--ty", `${ty}px`);
    particle.style.setProperty("--dur", `${dur}s`);
    gameContainer.appendChild(particle);

    setTimeout(() => particle.remove(), 720);
  }
}

function endGame() {
  gameRunning = false;
  clearInterval(spawnIntervalId);
  clearInterval(timerIntervalId);

  const filledBar = waterLevel >= BAR_GOAL;
  const messagePool = filledBar ? winMessages : loseMessages;
  const message = messagePool[Math.floor(Math.random() * messagePool.length)];

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("water-balloon-high-score", String(highScore));
    highScoreDisplay.textContent = highScore;
  }

  startButton.disabled = false;
  startButton.textContent = "Play Again";
  goalChip.textContent = filledBar ? "Tank filled in time" : "Tank not filled in time";
  setFeedback(filledBar ? "The tank was filled before the timer ended." : "Time is up. Reset and try again.");

  const remainingBalloons = gameContainer.querySelectorAll(".balloon");
  remainingBalloons.forEach((balloon) => balloon.remove());

  const happyCharacters = filledBar
    ? `
      <div class="happy-cast" aria-label="Happy Tiger and Monkey celebration">
        <div class="happy-character">
          <img src="img/happy.png" alt="Happy Tiger">
          <span>Happy Tiger</span>
        </div>
        <div class="happy-character">
          <img src="img/happy monkey.png" alt="Happy Monkey">
          <span>Happy Monkey</span>
        </div>
      </div>
    `
    : "";

  const sadCharacters = !filledBar
    ? `
      <div class="happy-cast" aria-label="Sad Tiger and Monkey">
        <div class="happy-character">
          <img src="img/sad tiger.png" alt="Sad Tiger">
          <span>Sad Tiger</span>
        </div>
        <div class="happy-character">
          <img src="img/sad monkey.png" alt="Sad Monkey">
          <span>Sad Monkey</span>
        </div>
      </div>
    `
    : "";

  endMessage.innerHTML = `
    <div class="result-badge ${filledBar ? "win" : "lose"}">${filledBar ? "Filled" : "Needs More Water"}</div>
    <h2>${filledBar ? "Water Bar Complete" : "Time Ran Out"}</h2>
    <p>${message}</p>
    ${happyCharacters}
    ${sadCharacters}
    <p>Your score: <strong>${score}</strong></p>
    <p>High score: <strong>${highScore}</strong></p>
    <button id="replay-btn" class="replay-button">Reset And Replay</button>
  `;
  endMessage.classList.remove("hidden");
  document.getElementById("replay-btn").addEventListener("click", startGame);
}

function primeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playPopSound() {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.08);
  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.14, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.13);
}
