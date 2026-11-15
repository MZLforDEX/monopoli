class Player {
  constructor(id, name, token, isBot = false) {
    this.id = id;
    this.name = name;
    this.token = token; // 'becak' | 'pinisi' | 'bajaj' | 'komodo'
    this.isBot = isBot;
    this.money = 15000; // 15 juta (dalam ribuan)
    this.position = 0;
    this.properties = []; // array of property ids
    this.inJail = false;
    this.jailTurns = 0;
    this.jailFreeCards = 0;
    this.bankrupt = false;
    this.doublesCount = 0;
    this.connected = true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      token: this.token,
      isBot: this.isBot,
      money: this.money,
      position: this.position,
      properties: this.properties,
      inJail: this.inJail,
      jailTurns: this.jailTurns,
      jailFreeCards: this.jailFreeCards,
      bankrupt: this.bankrupt
    };
  }
}

module.exports = Player;
