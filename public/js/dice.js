const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function showDiceReadout(d1, d2, isRolling = false) {
  const container = document.getElementById('dice-container');
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  const sumBadge = document.getElementById('dice-sum-badge');
  if (!container || !die1 || !die2) return;

  container.classList.remove('hidden');
  die1.classList.toggle('rolling', isRolling);
  die2.classList.toggle('rolling', isRolling);

  if (!isRolling && d1 && d2) {
    die1.textContent = DICE_FACES[d1 - 1] || d1;
    die2.textContent = DICE_FACES[d2 - 1] || d2;
    const isDouble = d1 === d2;
    die1.classList.toggle('double', isDouble);
    die2.classList.toggle('double', isDouble);
    if (sumBadge) {
      sumBadge.textContent = `${d1} + ${d2} = ${d1 + d2}${isDouble ? ' · DOUBLE!' : ''}`;
      sumBadge.classList.remove('hidden');
    }
  }
}

function animateDice(d1, d2, callback) {
  const container = document.getElementById('dice-container');
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  if (!container || !die1 || !die2) {
    if (callback) callback();
    return;
  }

  container.classList.remove('hidden');
  die1.classList.add('rolling');
  die2.classList.add('rolling');

  let count = 0;
  const interval = setInterval(() => {
    die1.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    die2.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    count++;
    if (count > 12) {
      clearInterval(interval);
      showDiceReadout(d1, d2, false);
      if (callback) setTimeout(callback, 350);
    }
  }, 65);
}

function animatePlayerMove(playerId, fromPos, toPos, players) {
  return new Promise((resolve) => {
    const steps = [];
    let pos = fromPos;
    let guard = 0;
    while (pos !== toPos && guard < 42) {
      pos = (pos + 1) % 40;
      steps.push(pos);
      guard++;
    }

    let i = 0;
    const moveStep = () => {
      if (i >= steps.length) {
        updatePlayerPositions(players);
        resolve();
        return;
      }
      const tempPlayers = players.map(p => {
        if (p.id === playerId) return { ...p, position: steps[i] };
        return p;
      });
      updatePlayerPositions(tempPlayers);
      i++;
      setTimeout(moveStep, 120);
    };
    moveStep();
  });
}
