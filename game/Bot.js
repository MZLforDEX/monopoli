class Bot {
  static decide(player, action, context) {
    switch (action) {
      case 'buy-property':
        // Buy if remaining money > 30% of starting money
        return player.money - context.price > 4500;

      case 'auction-bid': {
        // Bid up to 80% of property price
        const maxBid = Math.floor(context.price * 0.8);
        if (context.currentBid >= maxBid) return { bid: false };
        return { bid: true, amount: Math.min(context.currentBid + 100, maxBid) };
      }

      case 'jail':
        // Pay to get out if has money
        return player.money > 500 ? 'pay' : 'roll';

      case 'build':
        // Build if affordable and has enough reserve
        return player.money > context.houseCost + 3000;

      default:
        return false;
    }
  }
}

module.exports = Bot;
