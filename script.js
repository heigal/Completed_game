const GAME_DURATION = 30;
const BAR_GOAL = 100;
const WATER_PER_POP = 8;
const BAD_WATER_DRAIN = 8;
const BASE_POINTS = 10;
const OVERFLOW_BONUS = 5;
const SPAWN_DELAY = 650;
const BAD_BALLOON_CHANCE = 0.22;
const BAD_PENALTY = 15;
const SPECIAL_BALLOON_CHANCE = 0.1;
const SPECIAL_BALLOON_POINTS = 30;
const FREEZE_DURATION_MS = 2000;

const DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    spawnDelay: 820,
    badBalloonChance: 0,
    badPenalty: 10,
    specialBalloonChance: 0.14,
    freezeBalloonChance: 0,
    basePoints: 10
  },
  normal: {
    label: "Normal",
    spawnDelay: SPAWN_DELAY,
    badBalloonChance: BAD_BALLOON_CHANCE,
    badPenalty: BAD_PENALTY,
    specialBalloonChance: SPECIAL_BALLOON_CHANCE,
    freezeBalloonChance: 0,
    basePoints: BASE_POINTS
  },
  hard: {
    label: "Hard",
    spawnDelay: 500,
    badBalloonChance: 0.22,
    badPenalty: 20,
    specialBalloonChance: 0.07,
    freezeBalloonChance: 0.3,
    basePoints: 12
  }
};

let gameRunning = false;
let spawnIntervalId;
let timerIntervalId;
let score = 0;
let timeLeft = GAME_DURATION;
let waterLevel = 0;
let highScore = Number.parseInt(localStorage.getItem("water-balloon-high-score") || "0", 10);
let audioContext;
let currentDifficultyKey = "normal";
let currentDifficulty = DIFFICULTY_SETTINGS[currentDifficultyKey];
let nextMilestoneIndex = 0;
let milestoneTimeoutId;
let freezeTimeoutId;
let isGameFrozen = false;

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
const milestoneBanner = document.getElementById("milestone-banner");
const topDifficultySelect = document.getElementById("difficulty-select");
const overlayDifficultySelect = document.getElementById("overlay-difficulty-select");
const introOverlay = document.getElementById("intro-overlay");
const endMessage = document.getElementById("end-message");

const winMessages = [
  "You filled the tank in time. More families are one step closer to clean water. Let's keep working towards a better future together!",

];

const loseMessages = [
  "The timer ran out before the tank was full. It's okay let's try again, together we can make a change!.",

];

const milestoneMessages = [
  { score: 50, text: "Great start!" },
  { score: 100, text: "Halfway there!" },
  { score: 150, text: "Amazing momentum!" },
  { score: 200, text: "Water champion!" }
];

const cutsceneLines = [
  { speaker: "left",  name: "Tiger", text: "Those evil balloons are ruining our water supply! We need that water to help the community." },
  { speaker: "right", name: "Monkey", text: "Well let's go get it back!" },
  { speaker: "left",  name: "Tiger", text: " Will you join us?.", showSadTiger: true },

];

const csScreen    = document.getElementById("cutscene");
const csSpeakerEl = document.getElementById("cs-speaker");
const csTextEl    = document.getElementById("cs-text");
const csNextBtn   = document.getElementById("cs-next-btn");
const csHowToCard = document.getElementById("cs-howto-card");
const csHowToBtn  = document.getElementById("cs-howto-btn");
const csCharLeft  = document.getElementById("cs-char-left");
const csCharRight = document.getElementById("cs-char-right");
const csTigerImg  = document.querySelector("#cs-portrait-left img");
const TIGER_DEFAULT_SRC = "img/tiger.png";
const TIGER_SAD_SRC = "img/sad tiger.png";
let csStep = 0;
let csHowToShown = false;

function showCutsceneLine(index) {
  const line = cutsceneLines[index];
  if (csHowToCard) {
    csHowToCard.classList.add("hidden");
  }
  csSpeakerEl.textContent = line.name;
  csTextEl.textContent    = line.text;

  const shouldShowSadTiger = line.speaker === "left" && line.showSadTiger === true;
  if (csTigerImg) {
    csTigerImg.src = shouldShowSadTiger ? TIGER_SAD_SRC : TIGER_DEFAULT_SRC;
    csTigerImg.alt = shouldShowSadTiger ? "Sad Tiger" : "Tiger";
  }

  csCharLeft.classList.toggle("cs-active",   line.speaker === "left");
  csCharLeft.classList.toggle("cs-inactive", line.speaker !== "left");
  csCharRight.classList.toggle("cs-active",   line.speaker === "right");
  csCharRight.classList.toggle("cs-inactive", line.speaker !== "right");
  const isLast = index === cutsceneLines.length - 1;
  csNextBtn.textContent = isLast ? "Yes! ›" : "Next ›";
}

csNextBtn.addEventListener("click", () => {
  const currentLine = cutsceneLines[csStep];
  const nextLine = cutsceneLines[csStep + 1];
  const shouldShowHowToNow = csStep === 1 && currentLine?.speaker === "right" && nextLine?.speaker === "left";

  if (shouldShowHowToNow && !csHowToShown) {
    csHowToShown = true;
    if (csHowToCard) {
      csHowToCard.classList.remove("hidden");
    }
    return;
  }

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

if (csHowToBtn) {
  csHowToBtn.addEventListener("click", () => {
    if (csHowToCard) {
      csHowToCard.classList.add("hidden");
    }

    csStep++;
    if (csStep >= cutsceneLines.length) {
      return;
    }

    showCutsceneLine(csStep);
  });
}

showCutsceneLine(0);
// ─────────────────────────────────────────────────────────────────────────────

if (startButton) {
  startButton.addEventListener("click", startGame);
}
overlayStartButton.addEventListener("click", startGame);
highScoreDisplay.textContent = highScore;
updateWaterBar();

if (topDifficultySelect) {
  topDifficultySelect.value = currentDifficultyKey;
}

if (overlayDifficultySelect) {
  overlayDifficultySelect.value = currentDifficultyKey;
}

if (topDifficultySelect) {
  topDifficultySelect.addEventListener("change", () => {
    applyDifficultySelection(topDifficultySelect.value);

    if (!gameRunning) {
      goalChip.textContent = `${currentDifficulty.label} mode • Fill the tank before 30 seconds ends`;
      setFeedback(`${currentDifficulty.label} mode selected. Press start to launch the balloon run.`);
    }
  });
}

if (overlayDifficultySelect) {
  overlayDifficultySelect.addEventListener("change", () => {
    applyDifficultySelection(overlayDifficultySelect.value);

    if (!gameRunning) {
      goalChip.textContent = `${currentDifficulty.label} mode • Fill the tank before 30 seconds ends`;
      setFeedback(`${currentDifficulty.label} mode selected. Press start to launch the balloon run.`);
    }
  });
}

function startGame() {
  if (gameRunning) {
    return;
  }

  currentDifficultyKey = getSelectedDifficultyKey();
  currentDifficulty = DIFFICULTY_SETTINGS[currentDifficultyKey];

  primeAudio();
  resetRound();
  gameRunning = true;
  introOverlay.classList.add("hidden");
  endMessage.classList.add("hidden");
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Mission Live";
  }
  if (topDifficultySelect) {
    topDifficultySelect.disabled = true;
  }
  if (overlayDifficultySelect) {
    overlayDifficultySelect.disabled = true;
  }
  goalChip.textContent = `${currentDifficulty.label} mode • Fill the tank before the timer ends`;
  setFeedback(`Burst every red balloon you can. ${currentDifficulty.label} mode is active.`);

  spawnIntervalId = setInterval(createBalloon, currentDifficulty.spawnDelay);
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
  nextMilestoneIndex = 0;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  goalChip.textContent = `${currentDifficulty.label} mode • Fill the tank before 30 seconds ends`;
  setFeedback(`${currentDifficulty.label} mode selected. Press start to launch the balloon run.`);
  updateWaterBar();
  hideMilestoneBanner();
  clearFreezeState();

  const activeElements = gameContainer.querySelectorAll(".balloon, .burst-ring, .floating-points, .replay-button");
  activeElements.forEach((element) => element.remove());
}

function createBalloon() {
  if (!gameRunning || isGameFrozen) {
    return;
  }

  const balloon = document.createElement("button");
  const width = Math.round(56 + Math.random() * 30);
  const height = Math.round(width * 1.18);
  const xPosition = Math.random() * Math.max(gameContainer.clientWidth - width - 12, 12);
  const duration = (Math.random() * 1.6 + 3.4).toFixed(2);
  const sway = `${(Math.random() * 1.6 + 1.4).toFixed(2)}s`;

  const roll = Math.random();
  const freezeChance = currentDifficulty.freezeBalloonChance || 0;
  const specialCutoff = freezeChance + currentDifficulty.specialBalloonChance;
  const badCutoff = specialCutoff + currentDifficulty.badBalloonChance;
  const isFreeze = roll < freezeChance;
  const isSpecial = !isFreeze && roll < specialCutoff;
  const isBad = !isFreeze && !isSpecial && roll < badCutoff;

  balloon.type = "button";
  balloon.className = `balloon${isFreeze ? " freeze-balloon" : ""}${isSpecial ? " special-balloon" : ""}${isBad ? " bad-balloon" : ""}`;
  balloon.style.width = `${width}px`;
  balloon.style.height = `${height}px`;
  balloon.style.left = `${xPosition}px`;
  balloon.style.bottom = `-${height}px`;
  balloon.style.animationDuration = isSpecial
    ? `${duration}s, ${sway}, 1.15s`
    : isFreeze
      ? `${duration}s, ${sway}, 1.05s`
      : `${duration}s, ${sway}`;
  balloon.setAttribute("aria-label", isFreeze ? "Pop freeze balloon" : isSpecial ? "Pop special bonus balloon" : isBad ? "Avoid this bad balloon" : "Pop water balloon");
  if (isFreeze) {
    balloon.innerHTML = '<span class="freeze-mark" aria-hidden="true">❄</span>';
  } else if (isSpecial) {
    balloon.innerHTML = '<span class="balloon-can-mark" aria-hidden="true"></span>';
  } else if (isBad) {
    balloon.innerHTML = '<span class="bad-mark" aria-hidden="true">✕</span>';
  } else {
    balloon.innerHTML = '<span class="balloon-can-mark" aria-hidden="true"></span>';
  }

  balloon.addEventListener("pointerdown", () => popBalloon(balloon));
  balloon.addEventListener("animationend", () => {
    balloon.remove();
  });

  gameContainer.appendChild(balloon);
}

function popBalloon(balloon) {
  if (!gameRunning || !balloon.isConnected || isGameFrozen) {
    return;
  }

  const balloonRect = balloon.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  const x = balloonRect.left - containerRect.left + balloonRect.width / 2;
  const y = balloonRect.top - containerRect.top + balloonRect.height / 2;

  if (balloon.classList.contains("freeze-balloon")) {
    playPopSound();
    setFeedback("Freeze balloon activated. Everything is frozen for 2 seconds.");
    flashContainer("game-flash-freeze");
    showFloatingPoints(x, y, "Freeze!");
    showWaterParticles(x, y, "special");
    balloon.classList.add("popping");
    activateFreeze(FREEZE_DURATION_MS);
    return;
  }

  if (balloon.classList.contains("special-balloon")) {
    score += SPECIAL_BALLOON_POINTS;
    updateScoreDisplay();
    triggerMilestones();
    playPopSound();
    setFeedback(`Golden bonus balloon popped. +${SPECIAL_BALLOON_POINTS} points.`);
    flashContainer("game-flash-special");
    showFloatingPoints(x, y, `+${SPECIAL_BALLOON_POINTS}`);
    showWaterParticles(x, y, "special");
    balloon.classList.add("popping");
    return;
  }

  if (balloon.classList.contains("bad-balloon")) {
    score = Math.max(0, score - currentDifficulty.badPenalty);
    waterLevel = Math.max(0, waterLevel - BAD_WATER_DRAIN);
    updateScoreDisplay();
    triggerMilestones();
    updateWaterBar();
    playPopSound();
    setFeedback(`Polluted balloon popped. -${currentDifficulty.badPenalty} points and water dropped.`);
    flashContainer("game-flash-bad");
    showFloatingPoints(x, y, `-${currentDifficulty.badPenalty}`, true);
    showWaterParticles(x, y, "bad");
    balloon.classList.add("popping");
    return;
  }

  const bonusActive = waterLevel >= BAR_GOAL;
  const pointsEarned = currentDifficulty.basePoints + (bonusActive ? OVERFLOW_BONUS : 0);

  score += pointsEarned;
  waterLevel += WATER_PER_POP;

  updateScoreDisplay();
  triggerMilestones();
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
  fillBar.setAttribute("aria-valuenow", String(Math.round(percentage)));
  fillBar.setAttribute("aria-valuetext", overflowAmount > 0 ? `Full plus ${overflowAmount} percent` : `${Math.round(percentage)} percent full`);
  fillStatus.textContent = overflowAmount > 0 ? `Full +${overflowAmount}%` : `${Math.round(percentage)}%`;
  fillBar.classList.toggle("fill-bar-overflow", overflowAmount > 0);
  goalChip.textContent = overflowAmount > 0 ? "Tank full. Bonus points unlocked" : goalChip.textContent;
}

function setFeedback(message) {
  feedbackDisplay.textContent = message;
}

function triggerMilestones() {
  while (nextMilestoneIndex < milestoneMessages.length && score >= milestoneMessages[nextMilestoneIndex].score) {
    const milestone = milestoneMessages[nextMilestoneIndex];
    showMilestoneBanner(`${milestone.text} (${milestone.score} points)`);
    setFeedback(`Milestone reached: ${milestone.text}`);
    nextMilestoneIndex += 1;
  }
}

function showMilestoneBanner(message) {
  if (!milestoneBanner) {
    return;
  }

  milestoneBanner.textContent = message;
  milestoneBanner.classList.add("show");

  clearTimeout(milestoneTimeoutId);
  milestoneTimeoutId = setTimeout(() => {
    milestoneBanner.classList.remove("show");
  }, 1600);
}

function hideMilestoneBanner() {
  if (!milestoneBanner) {
    return;
  }

  clearTimeout(milestoneTimeoutId);
  milestoneBanner.classList.remove("show");
  milestoneBanner.textContent = "";
}

function flashContainer(className) {
  gameContainer.classList.remove("game-flash-good", "game-flash-overflow", "game-flash-bad", "game-flash-special", "game-flash-freeze");
  void gameContainer.offsetWidth;
  gameContainer.classList.add(className);
}

function activateFreeze(durationMs) {
  if (!gameRunning) {
    return;
  }

  isGameFrozen = true;
  gameContainer.classList.add("freeze-active");

  clearTimeout(freezeTimeoutId);
  freezeTimeoutId = setTimeout(() => {
    isGameFrozen = false;
    gameContainer.classList.remove("freeze-active");
    setFeedback("Freeze ended. Keep popping balloons.");
  }, durationMs);
}

function clearFreezeState() {
  isGameFrozen = false;
  clearTimeout(freezeTimeoutId);
  gameContainer.classList.remove("freeze-active");
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

  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = "Play Again";
  }
  if (topDifficultySelect) {
    topDifficultySelect.disabled = false;
  }
  if (overlayDifficultySelect) {
    overlayDifficultySelect.disabled = false;
  }
  goalChip.textContent = filledBar ? "Tank filled in time" : "Tank not filled in time";
  hideMilestoneBanner();
  clearFreezeState();
  setFeedback(filledBar ? "The tank was filled before the timer ended." : "Time is up. Reset and try again.");

  const remainingBalloons = gameContainer.querySelectorAll(".balloon");
  remainingBalloons.forEach((balloon) => balloon.remove());

  const winImageMarkup = filledBar
    ? `
      <div class="end-result-image">
        <img src="img/happy.png" alt="Happy Tiger">
      </div>
    `
    : "";

  endMessage.innerHTML = `
    <div class="result-badge ${filledBar ? "win" : "lose"}">${filledBar ? "Filled" : "Needs More Water"}</div>
    <h2>${filledBar ? "Water Bar Complete" : "Time Ran Out"}</h2>
    <p>${message}</p>
    ${winImageMarkup}
    <p>Your score: <strong>${score}</strong></p>
    <p>High score: <strong>${highScore}</strong></p>
    <button id="replay-btn" class="replay-button">Choose Difficulty And Replay</button>
  `;
  endMessage.classList.remove("hidden");
  document.getElementById("replay-btn").addEventListener("click", openReplaySetup);
}

function openReplaySetup() {
  endMessage.classList.add("hidden");
  introOverlay.classList.remove("hidden");

  if (topDifficultySelect) {
    topDifficultySelect.disabled = false;
    topDifficultySelect.value = currentDifficultyKey;
  }

  if (overlayDifficultySelect) {
    overlayDifficultySelect.disabled = false;
    overlayDifficultySelect.value = currentDifficultyKey;
  }

  goalChip.textContent = `${currentDifficulty.label} mode • Fill the tank before 30 seconds ends`;
  setFeedback("Pick your difficulty, then press Start Popping.");
}

function getSelectedDifficultyKey() {
  if (overlayDifficultySelect && DIFFICULTY_SETTINGS[overlayDifficultySelect.value]) {
    return overlayDifficultySelect.value;
  }

  if (topDifficultySelect && DIFFICULTY_SETTINGS[topDifficultySelect.value]) {
    return topDifficultySelect.value;
  }

  return "normal";
}

function applyDifficultySelection(nextDifficultyKey) {
  const safeKey = DIFFICULTY_SETTINGS[nextDifficultyKey] ? nextDifficultyKey : "normal";
  currentDifficultyKey = safeKey;
  currentDifficulty = DIFFICULTY_SETTINGS[safeKey];

  if (topDifficultySelect) {
    topDifficultySelect.value = safeKey;
  }
  if (overlayDifficultySelect) {
    overlayDifficultySelect.value = safeKey;
  }
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
