class Bot {
  static decide(player, action, context) {
    switch (action) {
      case 'buy-property':
        if (player.money < context.price) return false;
        // Buy if remaining money > 25% of starting money (3750rb)
        return player.money - context.price >= 3500;

      case 'auction-bid': {
        // Bid up to 80% of property price, while keeping at least 1500rb reserve
        const maxAffordable = Math.max(0, player.money - 1500);
        const maxBid = Math.min(Math.floor(context.price * 0.8), maxAffordable);
        const nextBid = context.currentBid + 100;
        if (nextBid > maxBid || nextBid > player.money) return { bid: false };
        return { bid: true, amount: nextBid };
      }

      case 'jail':
        if (player.jailFreeCards > 0) return 'card';
        return player.money >= 2500 ? 'pay' : 'roll';

      case 'build':
        // Build if affordable and has enough reserve
        return player.money >= context.houseCost + 3000;

      default:
        return false;
    }
  }
}

module.exports = Bot;
