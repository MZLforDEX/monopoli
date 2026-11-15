function animateDice(d1, d2, callback) {
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  
  die1.classList.add('rolling');
  die2.classList.add('rolling');
  
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  let count = 0;
  const interval = setInterval(() => {
    die1.textContent = faces[Math.floor(Math.random() * 6)];
    die2.textContent = faces[Math.floor(Math.random() * 6)];
    count++;
    if (count > 15) {
      clearInterval(interval);
      die1.textContent = faces[d1 - 1];
      die2.textContent = faces[d2 - 1];
      die1.classList.remove('rolling');
      die2.classList.remove('rolling');
      
      if (d1 === d2) {
        die1.classList.add('double');
        die2.classList.add('double');
        setTimeout(() => {
          die1.classList.remove('double');
          die2.classList.remove('double');
        }, 1000);
      }
      
      if (callback) setTimeout(callback, 500);
    }
  }, 80);
}

function animatePlayerMove(playerId, fromPos, toPos, players) {
  return new Promise((resolve) => {
    const steps = [];
    let pos = fromPos;
    while (pos !== toPos) {
      pos = (pos + 1) % 40;
      steps.push(pos);
    }
    
    let i = 0;
    const moveStep = () => {
      if (i >= steps.length) {
        resolve();
        return;
      }
      // Update player position visually
      const tempPlayers = players.map(p => {
        if (p.id === playerId) return { ...p, position: steps[i] };
        return p;
      });
      updatePlayerPositions(tempPlayers);
      i++;
      setTimeout(moveStep, 150);
    };
    moveStep();
  });
}
