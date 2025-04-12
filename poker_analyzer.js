// Texas Hold'em Poker Analyzer
// This program helps analyze poker hands and make strategic decisions

class PokerAnalyzer {
  constructor() {
    // Card values and suits
    this.values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    this.suits = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades
    
    // Position names in order (early to late)
    this.positions = [
      'UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'
    ];
    
    // Starting hand rankings (pairs and unpaired hands)
    this.startingHandTiers = this.initializeStartingHandTiers();
    
    // Player types and their tendencies
    this.playerTypes = {
      tight_passive: { vpip: 15, pfr: 8, af: 1.2, description: "Plays few hands, rarely raises" },
      tight_aggressive: { vpip: 18, pfr: 15, af: 3.0, description: "Plays few hands but raises often with them" },
      loose_passive: { vpip: 35, pfr: 12, af: 1.5, description: "Plays many hands but calls rather than raises" },
      loose_aggressive: { vpip: 32, pfr: 25, af: 3.2, description: "Plays many hands and raises frequently" },
      rock: { vpip: 10, pfr: 7, af: 2.0, description: "Extremely tight, only plays premium hands" },
      maniac: { vpip: 45, pfr: 40, af: 4.5, description: "Plays and raises with almost anything" },
      calling_station: { vpip: 40, pfr: 8, af: 0.8, description: "Calls with many hands, rarely folds to bets" },
      nit: { vpip: 8, pfr: 6, af: 1.8, description: "Extremely tight, very risk-averse" }
    };
  }
  
  // Initialize preflop hand strength tiers
  initializeStartingHandTiers() {
    return {
      premium: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
      strong: ['JJ', 'TT', 'AQs', 'AQo', 'AJs', 'ATs', 'KQs'],
      medium: ['99', '88', 'AJo', 'ATo', 'KQo', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'],
      speculative: ['77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
                   'KJo', 'KTo', 'QJo', 'JTo', 'T9s', '98s', '87s', '76s', '65s', '54s'],
      weak: ['K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'Q9s', 'Q8s', 'J9s', 'T8s']
    };
  }
  
  // Normalize a card input from various formats
  normalizeCard(card) {
    card = card.trim().toUpperCase();
    
    // Handle inputs like "Ah", "10c", etc.
    if (card.length === 2 || (card.length === 3 && card[0] === '1' && card[1] === '0')) {
      let value = card.length === 3 ? "T" : card[0];
      let suit = card[card.length - 1].toLowerCase();
      
      // Normalize value
      if (value === "1") value = "T";
      
      return value + suit;
    }
    
    return card;
  }
  
  // Convert hand to standard notation (e.g., "AhKs")
  normalizeHand(hand) {
    if (typeof hand === 'string') {
      // If it's already a string like "AhKs", split it into individual cards
      hand = hand.match(/.{2}/g) || [];
    }
    
    return hand.map(card => this.normalizeCard(card)).join('');
  }
  
  // Get the value of a card (2-14)
  getCardValue(card) {
    const value = card[0].toUpperCase();
    const valueMap = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
      'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    
    return valueMap[value] || 0;
  }
  
  // Get the hand type (e.g., "AA", "AKs")
  getHandType(cards) {
    if (cards.length !== 4) return null;
    
    const card1 = cards.slice(0, 2);
    const card2 = cards.slice(2, 4);
    
    const value1 = card1[0];
    const value2 = card2[0];
    const suit1 = card1[1];
    const suit2 = card2[1];
    
    // Check if pair
    if (value1 === value2) {
      return value1 + value2;
    }
    
    // Sort by value (higher card first)
    const values = [value1, value2].sort((a, b) => {
      return this.getCardValue(b) - this.getCardValue(a);
    });
    
    // Add 's' for suited, 'o' for offsuit
    const suffix = (suit1 === suit2) ? 's' : 'o';
    return values.join('') + suffix;
  }
  
  // Evaluate starting hand strength
  evaluateStartingHand(cards) {
    const handType = this.getHandType(cards);
    
    for (const [tier, hands] of Object.entries(this.startingHandTiers)) {
      if (hands.includes(handType)) {
        return { tier, handType };
      }
    }
    
    return { tier: 'trash', handType };
  }
  
  // Calculate pot odds
  calculatePotOdds(potSize, betToCall) {
    if (betToCall === 0) return 0;
    return betToCall / (potSize + betToCall);
  }
  
  // Calculate effective stack
  calculateEffectiveStack(heroStack, villainStack) {
    return Math.min(heroStack, villainStack);
  }
  
  // Get recommended action preflop
  getPreflopAction(hand, position, numPlayers, playerTypes, raisesBefore, potSize, betToCall, effectiveStack) {
    const handEval = this.evaluateStartingHand(hand);
    const positionIndex = this.positions.indexOf(position);
    const isLatePosition = positionIndex >= 6; // CO, BTN, SB, BB
    const isBigBlind = position === 'BB';
    const isSmallBlind = position === 'SB';
    
    // Basic strategy matrix based on hand tier, position, and previous action
    let action = 'fold';
    let reasoning = '';
    
    // No raises before - opening decision
    if (raisesBefore === 0) {
      if (handEval.tier === 'premium') {
        action = 'raise';
        reasoning = 'Premium hand, raising from any position';
      } else if (handEval.tier === 'strong') {
        action = 'raise';
        reasoning = 'Strong hand, raising from any position';
      } else if (handEval.tier === 'medium') {
        action = isLatePosition ? 'raise' : 'fold';
        reasoning = isLatePosition ? 'Medium hand, raising from late position' : 'Medium hand, folding from early position';
      } else if (handEval.tier === 'speculative') {
        if (isLatePosition) {
          action = 'raise';
          reasoning = 'Speculative hand, raising from late position';
        } else if (isBigBlind && betToCall === 0) {
          action = 'check';
          reasoning = 'Speculative hand, checking in big blind';
        } else {
          action = 'fold';
          reasoning = 'Speculative hand, folding from early/mid position';
        }
      } else {
        // Weak or trash hands
        if (position === 'BTN') {
          action = 'raise';
          reasoning = 'Button steal opportunity';
        } else if (isBigBlind && betToCall === 0) {
          action = 'check';
          reasoning = 'Checking any hand in big blind when no raise';
        } else {
          action = 'fold';
          reasoning = 'Weak hand, folding';
        }
      }
    } 
    // Facing a raise
    else if (raisesBefore === 1) {
      if (handEval.tier === 'premium') {
        action = 'raise';
        reasoning = 'Premium hand, 3-betting against a raise';
      } else if (handEval.tier === 'strong') {
        action = isLatePosition ? 'raise' : 'call';
        reasoning = isLatePosition ? 'Strong hand, 3-betting from position' : 'Strong hand, calling a raise';
      } else if (handEval.tier === 'medium') {
        if (isLatePosition && positionIndex > this.positions.indexOf(playerTypes[0].position)) {
          action = effectiveStack > 50 * betToCall ? 'call' : 'fold';
          reasoning = effectiveStack > 50 * betToCall ? 
            'Medium hand, calling with position and good stack depth' : 
            'Medium hand, folding to a raise with insufficient stack depth';
        } else {
          action = 'fold';
          reasoning = 'Medium hand, folding to a raise out of position';
        }
      } else {
        // Speculative, weak, or trash hands
        if (handEval.tier === 'speculative' && 
            (isBigBlind || isSmallBlind) && 
            this.calculatePotOdds(potSize, betToCall) > 0.25) {
          action = 'call';
          reasoning = 'Speculative hand in the blinds with good pot odds';
        } else {
          action = 'fold';
          reasoning = 'Weak hand, folding to a raise';
        }
      }
    } 
    // Facing multiple raises
    else {
      if (handEval.tier === 'premium') {
        if (handEval.handType === 'AA' || handEval.handType === 'KK') {
          action = 'raise';
          reasoning = 'Premium pair, 4-betting/shoving against multiple raises';
        } else {
          action = effectiveStack < 40 * betToCall ? 'call' : 'raise';
          reasoning = effectiveStack < 40 * betToCall ? 
            'Premium hand, calling with moderate stack depth' : 
            'Premium hand, 4-betting with good stack depth';
        }
      } else if (handEval.tier === 'strong' && handEval.handType.includes('JJ')) {
        action = 'call';
        reasoning = 'Strong pair, calling multiple raises cautiously';
      } else {
        action = 'fold';
        reasoning = 'Folding to multiple raises with anything less than premium';
      }
    }
    
    // Adjust based on opponent tendencies
    if (raisesBefore > 0) {
      const raiser = playerTypes[0]; // Assuming the first player in the array is the raiser
      if (raiser.type === 'tight_passive' || raiser.type === 'rock' || raiser.type === 'nit') {
        if (action === 'call' || action === 'raise') {
          if (handEval.tier !== 'premium') {
            action = 'fold';
            reasoning += '. Adjusting to fold against very tight raiser';
          }
        }
      } else if (raiser.type === 'loose_aggressive' || raiser.type === 'maniac') {
        if (action === 'fold' && (handEval.tier === 'medium' || handEval.tier === 'strong')) {
          action = 'raise';
          reasoning += '. Adjusting to re-raise against loose-aggressive player';
        }
      }
    }
    
    return {
      action,
      reasoning,
      handType: handEval.handType,
      tier: handEval.tier
    };
  }
  
  // Calculate hand equity against range
  calculateHandEquity(hand, range, board = []) {
    // Simplified equity calculation
    // In a real implementation, you would use more sophisticated algorithms
    
    // For now, we'll use a very simplified approach based on hand tiers
    const handEval = this.evaluateStartingHand(hand);
    
    // Base equity values by hand tier
    const baseEquity = {
      'premium': 0.85,
      'strong': 0.70,
      'medium': 0.55,
      'speculative': 0.40,
      'weak': 0.30,
      'trash': 0.20
    };
    
    // Adjust based on range strength
    let equityAdjustment = 0;
    
    // We're simplifying this greatly
    if (range === 'very_tight') equityAdjustment = -0.15;
    else if (range === 'tight') equityAdjustment = -0.10;
    else if (range === 'medium') equityAdjustment = 0;
    else if (range === 'loose') equityAdjustment = 0.10;
    else if (range === 'very_loose') equityAdjustment = 0.15;
    
    // Board texture adjustments would go here in a more complex implementation
    
    const equity = baseEquity[handEval.tier] + equityAdjustment;
    return Math.min(Math.max(equity, 0.05), 0.95); // Clamp between 5% and 95%
  }
  
  // Get postflop recommendation
  getPostflopAction(hand, board, position, playerTypes, betSize, potSize, stackSize) {
    // Convert to normalized cards
    hand = this.normalizeHand(hand);
    board = board.map(card => this.normalizeCard(card));
    
    // Analyze hand strength (this would be more complex in a real implementation)
    const handAndBoard = hand.match(/.{2}/g).concat(board);
    
    // Check for made hands (very simplified)
    const handStrength = this.evaluateHandStrength(handAndBoard);
    
    // Calculate pot odds
    const potOdds = this.calculatePotOdds(potSize, betSize);
    
    // Calculate SPR (Stack-to-Pot Ratio)
    const spr = stackSize / potSize;
    
    // Position is important postflop
    const isInPosition = this.isInPosition(position, playerTypes);
    
    // Make decision
    let action, reasoning;
    
    if (handStrength.rank >= 7) { // Two pair or better
      if (betSize === 0) {
        action = 'bet';
        reasoning = `Strong hand (${handStrength.name}), betting for value`;
      } else {
        action = 'raise';
        reasoning = `Strong hand (${handStrength.name}), raising for value`;
      }
    } 
    else if (handStrength.rank >= 5) { // One pair
      if (betSize === 0) {
        action = isInPosition ? 'bet' : 'check';
        reasoning = isInPosition ? 
          `Medium strength hand (${handStrength.name}), betting in position` : 
          `Medium strength hand (${handStrength.name}), checking out of position`;
      } else {
        if (isInPosition && spr > 3) {
          action = 'call';
          reasoning = `Medium strength hand (${handStrength.name}), calling in position with good SPR`;
        } else if (potOdds < 0.3) {
          action = 'call';
          reasoning = `Medium strength hand (${handStrength.name}), calling with good pot odds`;
        } else {
          action = 'fold';
          reasoning = `Medium strength hand (${handStrength.name}), folding to pressure`;
        }
      }
    }
    else { // High card or drawing hand
      if (handStrength.draw) {
        const drawOdds = this.calculateDrawOdds(handStrength.draw, board.length);
        
        if (betSize === 0) {
          action = (drawOdds > 0.3 && isInPosition) ? 'bet' : 'check';
          reasoning = (drawOdds > 0.3 && isInPosition) ? 
            `Drawing hand (${handStrength.draw}), semi-bluffing in position` : 
            `Drawing hand (${handStrength.draw}), checking`;
        } else {
          action = (drawOdds > potOdds) ? 'call' : 'fold';
          reasoning = (drawOdds > potOdds) ? 
            `Drawing hand (${handStrength.draw}), calling with sufficient equity` : 
            `Drawing hand (${handStrength.draw}), folding with insufficient equity`;
        }
      } else {
        if (betSize === 0) {
          action = isInPosition ? 'bet' : 'check';
          reasoning = isInPosition ? 
            'Weak hand, betting as a bluff in position' : 
            'Weak hand, checking out of position';
        } else {
          action = 'fold';
          reasoning = 'Weak hand, folding to bet';
        }
      }
    }
    
    return {
      action,
      reasoning,
      handStrength
    };
  }
  
  // Check if hero is in position relative to other players
  isInPosition(position, playerTypes) {
    const positionIndex = this.positions.indexOf(position);
    
    // If we're on the button, we're in position
    if (position === 'BTN') return true;
    
    // Check if there are any players acting after us
    for (const player of playerTypes) {
      const playerPosIndex = this.positions.indexOf(player.position);
      if (playerPosIndex < positionIndex) return false;
    }
    
    return true;
  }
  
  // Simplified hand evaluator
  evaluateHandStrength(cards) {
    // Extract values and suits
    const values = cards.map(card => card[0]);
    const suits = cards.map(card => card[1]);
    
    // Count value frequencies
    const valueCounts = {};
    for (const value of values) {
      valueCounts[value] = (valueCounts[value] || 0) + 1;
    }
    
    // Count suit frequencies
    const suitCounts = {};
    for (const suit of suits) {
      suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    }
    
    // Check for flush draw
    const flushDraw = Object.values(suitCounts).some(count => count === 4);
    
    // Check for straight draw
    const valueNumbers = values.map(v => this.getCardValue(v))
                              .sort((a, b) => a - b);
    const uniqueValues = [...new Set(valueNumbers)];
    
    let straightDraw = false;
    let openEndedDraw = false;
    let gutshot = false;
    
    if (uniqueValues.length >= 4) {
      for (let i = 0; i <= uniqueValues.length - 4; i++) {
        const consecutive = uniqueValues.slice(i, i + 4);
        if (consecutive[3] - consecutive[0] === 3) {
          straightDraw = true;
          if (i === 0 || i + 4 === uniqueValues.length) {
            openEndedDraw = true;
          }
          break;
        }
      }
      
      if (!straightDraw) {
        for (let i = 0; i <= uniqueValues.length - 3; i++) {
          const window = uniqueValues.slice(i, i + 3);
          if (window[2] - window[0] === 4) {
            gutshot = true;
            break;
          }
        }
      }
    }
    
    // Determine hand rank
    let rank = 0;
    let name = 'High Card';
    
    // Check for pairs, trips, quads
    const pairs = Object.values(valueCounts).filter(count => count === 2).length;
    const trips = Object.values(valueCounts).filter(count => count === 3).length;
    const quads = Object.values(valueCounts).filter(count => count === 4).length;
    
    if (quads > 0) {
      rank = 8;
      name = 'Four of a Kind';
    } else if (trips > 0 && pairs > 0) {
      rank = 7;
      name = 'Full House';
    } else if (Object.values(suitCounts).some(count => count >= 5)) {
      rank = 6;
      name = 'Flush';
    } else if (this.hasStraight(valueNumbers)) {
      rank = 5;
      name = 'Straight';
    } else if (trips > 0) {
      rank = 4;
      name = 'Three of a Kind';
    } else if (pairs >= 2) {
      rank = 3;
      name = 'Two Pair';
    } else if (pairs === 1) {
      rank = 2;
      name = 'One Pair';
    } else {
      rank = 1;
      name = 'High Card';
    }
    
    // Determine draw type
    let draw = null;
    if (flushDraw && rank < 6) draw = 'Flush Draw';
    else if (openEndedDraw && rank < 5) draw = 'Open-Ended Straight Draw';
    else if (gutshot && rank < 5) draw = 'Gutshot Straight Draw';
    
    return {
      rank,
      name,
      draw
    };
  }
  
  // Check for a straight
  hasStraight(values) {
    const uniqueSorted = [...new Set(values)].sort((a, b) => a - b);
    
    // Handle Ace low straight
    if (uniqueSorted.includes(14)) {  // Ace
      const aceLow = [1, ...uniqueSorted.filter(v => v !== 14)];
      aceLow.sort((a, b) => a - b);
      if (this.checkConsecutive(aceLow)) return true;
    }
    
    return this.checkConsecutive(uniqueSorted);
  }
  
  // Check if array contains 5 consecutive values
  checkConsecutive(values) {
    if (values.length < 5) return false;
    
    for (let i = 0; i <= values.length - 5; i++) {
      const window = values.slice(i, i + 5);
      if (window[4] - window[0] === 4) {
        return true;
      }
    }
    
    return false;
  }
  
  // Calculate odds for drawing hands
  calculateDrawOdds(drawType, boardLength) {
    // Number of outs
    let outs = 0;
    
    if (drawType === 'Flush Draw') outs = 9;
    else if (drawType === 'Open-Ended Straight Draw') outs = 8;
    else if (drawType === 'Gutshot Straight Draw') outs = 4;
    
    // Rough estimate of hitting on next card
    const hittingOdds = outs / 47;  // 52 - 5 cards we know
    
    // Adjust based on whether it's flop or turn
    if (boardLength === 3) {  // Flop
      // Two cards to come (turn and river)
      return 1 - Math.pow(1 - hittingOdds, 2);
    } else if (boardLength === 4) {  // Turn
      // One card to come (river)
      return hittingOdds;
    }
    
    return 0;  // Should not happen
  }
  
  // Analyze player tendencies based on action history
  analyzePlayerType(vpip, pfr, af) {
    // Simple analysis based on common poker stats
    // VPIP: Voluntarily Put $ In Pot
    // PFR: Preflop Raise
    // AF: Aggression Factor
    
    let type = '';
    
    if (vpip < 15) {
      type = (af > 2) ? 'tight_aggressive' : 'tight_passive';
      if (vpip < 10) type = 'nit';
    } else if (vpip < 25) {
      type = (af > 2) ? 'tight_aggressive' : 'tight_passive';
    } else if (vpip < 35) {
      type = (af > 2) ? 'loose_aggressive' : 'loose_passive';
    } else {
      type = (af > 2) ? 'loose_aggressive' : 'calling_station';
      if (vpip > 40 && pfr > 35) type = 'maniac';
    }
    
    return {
      type,
      description: this.playerTypes[type].description
    };
  }
  
  // Master analysis function
  analyzePokerSituation({
    hand,
    position,
    stage,
    board = [],
    numPlayers,
    playerTypes = [],
    potSize,
    betToCall = 0,
    raisesBefore = 0,
    heroStack,
    opponentStacks = []
  }) {
    // Normalize input
    hand = this.normalizeHand(hand);
    
    // Calculate effective stack
    const effectiveStack = this.calculateEffectiveStack(
      heroStack, 
      Math.min(...opponentStacks.filter(stack => stack > 0))
    );
    
    let analysis;
    
    // Preflop analysis
    if (stage === 'preflop') {
      analysis = this.getPreflopAction(
        hand, 
        position, 
        numPlayers, 
        playerTypes,
        raisesBefore,
        potSize,
        betToCall,
        effectiveStack
      );
    } 
    // Postflop analysis
    else {
      analysis = this.getPostflopAction(
        hand,
        board,
        position,
        playerTypes,
        betToCall,
        potSize,
        heroStack
      );
    }
    
    // Add additional context
    analysis.stage = stage;
    analysis.potOdds = this.calculatePotOdds(potSize, betToCall);
    analysis.effectiveStack = effectiveStack;
    
    return analysis;
  }
}

// UI component to use the analyzer
class PokerUI {
  constructor() {
    this.analyzer = new PokerAnalyzer();
    this.players = [];
    this.gameState = {
      heroHand: '',
      position: 'BTN',
      stage: 'preflop',
      board: [],
      numPlayers: 6,
      potSize: 1.5,
      betToCall: 1,
      raisesBefore: 0,
      heroStack: 100,
      opponentStacks: [100, 100, 100, 100, 100]
    };
  }
  
  // Setup players at the table
  setupPlayers(playerCount) {
    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        position: this.analyzer.positions[i % this.analyzer.positions.length],
        stack: 100,
        vpip: 25,
        pfr: 15,
        af: 2,
        type: 'unknown'
      });
    }
    
    this.gameState.numPlayers = playerCount;
    this.gameState.opponentStacks = this.players.map(p => p.stack);
    
    // Analyze player types
    this.players.forEach(player => {
      const analysis = this.analyzer.analyzePlayerType(player.vpip, player.pfr, player.af);
      player.type = analysis.type;
      player.description = analysis.description;
    });
  }
  
  // Update game state
  updateGameState(newState) {
    this.gameState = {...this.gameState, ...newState};
  }
  
  // Get analysis of current situation
  analyzeCurrentSituation() {
    // Get relevant players
    const activePlayers = this.players.filter(p => 
      this.analyzer.positions.indexOf(p.position) !== 
      this.analyzer.positions.indexOf(this.gameState.position)
    );
    
    return this.analyzer.analyzePokerSituation({
      hand: this.gameState.heroHand,
      position: this.gameState.position,
      stage: this.gameState.stage,
      board: this.gameState.board,
      numPlayers: this.gameState.numPlayers,
      playerTypes: activePlayers,
      potSize: this.gameState.potSize,
      betToCall: this.gameState.betToCall,
      raisesBefore: this.gameState.raisesBefore,
      heroStack: this.gameState.heroStack,
      opponentStacks: this.gameState.opponentStacks
    });
  }
  
  // Format hand for display
  formatHand(hand) {
    if (!hand || hand.length < 4) return '';
    
    const cards = hand.match(/.{2}/g) || [];
    return cards.map(card => {
      const value = card[0].toUpperCase();
      const suit = card[1].toLowerCase();
      
      let valueDisplay = value;
      if (value === 'T') valueDisplay = '10';
      
      let suitDisplay = '♠';
      if (suit === 'h') suitDisplay = '♥';
      else if (suit === 'd') suitDisplay = '♦';
      else if (suit === 'c') suitDisplay = '♣';
      
      return valueDisplay + suitDisplay;
    }).join(' ');
  }
  
  // Format board for display
  formatBoard(board) {
    if (!board || board.length === 0) return '';
    
    return board.map(card => {
      const normalizedCard = this.analyzer.normalizeCard(card);
      const value = normalizedCard[0].toUpperCase();
      const suit = normalizedCard[1].toLowerCase();
      
      let valueDisplay = value;
      if (value === 'T') valueDisplay = '10';
      
      let suitDisplay = '♠';
      if (suit === 'h') suitDisplay = '♥';
      else if (suit === 'd') suitDisplay = '♦';
      else if (suit === 'c') suitDisplay = '♣';
      
      return valueDisplay + suitDisplay;
    }).join(' ');
  }
  
  // Get recommendations as formatted output
  getRecommendation() {
    if (!this.gameState.heroHand || this.gameState.heroHand.length < 4) {
      return "Please enter your hand to get recommendations";
    }
    
    const analysis = this.analyzeCurrentSituation();
    
    let recommendation = '';
    
    // Show hand information
    recommendation += `Your hand: ${this.formatHand(this.gameState.heroHand)}`;
    if (analysis.handType) {
      recommendation += ` (${analysis.handType}, ${analysis.tier} tier)\n`;
    } else {
      recommendation += '\n';
    }
    
    // Show board if applicable
    if (this.gameState.stage !== 'preflop' && this.gameState.board.length > 0) {
      recommendation += `Board: ${this.formatBoard(this.gameState.board)}\n`;
      if (analysis.handStrength) {
        recommendation += `Hand strength: ${analysis.handStrength.name}`;
        if (analysis.handStrength.draw) {
          recommendation += ` with ${analysis.handStrength.draw}`;
        }
        recommendation += '\n';
      }
    }
    
    // Game situation
    recommendation += `\nGame situation:\n`;
    recommendation += `- Position: ${this.gameState.position}\n`;
    recommendation += `- Stage: ${this.gameState.stage}\n`;
    recommendation += `- Players: ${this.gameState.numPlayers}\n`;
    recommendation += `- Pot size: ${this.gameState.potSize} BB\n`;
    recommendation += `- Bet to call: ${this.gameState.betToCall} BB\n`;
    recommendation += `- Your stack: ${this.gameState.heroStack} BB\n`;
    
    if (analysis.potOdds) {
      recommendation += `- Pot odds: ${(analysis.potOdds * 100).toFixed(1)}%\n`;
    }
    
    // Recommendation
    recommendation += `\nRecommended action: ${analysis.action.toUpperCase()}\n`;
    recommendation += `Reasoning: ${analysis.reasoning}\n`;
    
    // Additional strategic considerations
    recommendation += `\nStrategic considerations:\n`;
    
    if (this.gameState.stage === 'preflop') {
      if (analysis.tier === 'premium' || analysis.tier === 'strong') {
        recommendation += `- Your hand is in the top ${analysis.tier === 'premium' ? '5%' : '15%'} of all starting hands\n`;
      }
      
      if (this.gameState.position === 'BTN' || this.gameState.position === 'CO') {
        recommendation += `- Your late position gives you a strategic advantage\n`;
      } else if (this.gameState.position === 'SB' || this.gameState.position === 'BB') {
        recommendation += `- Playing from the blinds requires caution as you'll be out of position postflop\n`;
      }
      
      if (this.gameState.raisesBefore > 0) {
        recommendation += `- Facing ${this.gameState.raisesBefore} raise(s) narrows your continuing range\n`;
      }
    } else {
      if (analysis.handStrength) {
        if (analysis.handStrength.rank >= 5) {
          recommendation += `- You have a strong made hand, focus on value betting\n`;
        } else if (analysis.handStrength.draw) {
          const drawOdds = this.analyzer.calculateDrawOdds(analysis.handStrength.draw, this.gameState.board.length);
          recommendation += `- Your draw has approximately ${(drawOdds * 100).toFixed(1)}% equity\n`;
          
          if (analysis.potOdds && drawOdds > analysis.potOdds) {
            recommendation += `- Your drawing odds exceed the pot odds, making a call profitable\n`;
          } else if (analysis.potOdds) {
            recommendation += `- Your drawing odds are less than pot odds, making a call unprofitable\n`;
          }
        }
      }
    }
    
    // Stack considerations
    const effectiveStackToPot = analysis.effectiveStack / this.gameState.potSize;
    if (effectiveStackToPot < 3) {
      recommendation += `- Low SPR (${effectiveStackToPot.toFixed(1)}) means you're often committed with medium-strong hands\n`;
    } else if (effectiveStackToPot > 10) {
      recommendation += `- High SPR (${effectiveStackToPot.toFixed(1)}) favors speculative hands and post-flop maneuverability\n`;
    }
    
    return recommendation;
  }
}

// Example usage
function initializePokerAnalyzer() {
  const ui = new PokerUI();
  ui.setupPlayers(6);
  
  // Set up a sample scenario
  ui.updateGameState({
    heroHand: 'AhKd', // Ace of hearts, King of diamonds
    position: 'CO',   // Cutoff position
    stage: 'preflop',
    raisesBefore: 1,  // One raise before us
    potSize: 2.5,     // 2.5 big blinds
    betToCall: 2,     // 2 big blinds to call
    heroStack: 100    // 100 big blinds
  });
  
  // Get and display recommendation
  console.log(ui.getRecommendation());
  
  // Another example with a postflop scenario
  ui.updateGameState({
    heroHand: 'AhKd',           // Ace of hearts, King of diamonds
    position: 'CO',             // Cutoff position
    stage: 'flop',
    board: ['Ac', '7s', '2d'],  // Ace of clubs, 7 of spades, 2 of diamonds
    raisesBefore: 0,
    potSize: 6.5,               // 6.5 big blinds
    betToCall: 0,               // No bet to call yet
    heroStack: 98               // 98 big blinds remaining
  });
  
  // Get and display recommendation
  console.log(ui.getRecommendation());
  
  return ui;
}

// Function to analyze the current poker game
function analyzeGame(handInput, position, stage, board, players, pot, betToCall, raises, stack) {
  // Create a new analyzer UI
  const ui = new PokerUI();
  ui.setupPlayers(players);
  
  // Set up the current game state
  ui.updateGameState({
    heroHand: handInput,
    position: position,
    stage: stage,
    board: board || [],
    numPlayers: players,
    potSize: pot,
    betToCall: betToCall,
    raisesBefore: raises,
    heroStack: stack
  });
  
  // Return the analysis
  return ui.getRecommendation();
}

// Create a simple UI for using the analyzer
function createPokerAnalyzerUI() {
  // Create UI elements
  const container = document.createElement('div');
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  
  const title = document.createElement('h1');
  title.textContent = 'Texas Hold\'em Poker Analyzer';
  container.appendChild(title);
  
  const description = document.createElement('p');
  description.textContent = 'Enter your current poker situation to get strategic advice';
  container.appendChild(description);
  
  // Form for input
  const form = document.createElement('form');
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'repeat(2, 1fr)';
  form.style.gap = '15px';
  form.style.marginBottom = '20px';
  
  // Hand input
  const handLabel = document.createElement('label');
  handLabel.textContent = 'Your hand (e.g., AhKd):';
  form.appendChild(handLabel);
  
  const handInput = document.createElement('input');
  handInput.type = 'text';
  handInput.placeholder = 'AhKd';
  handInput.required = true;
  form.appendChild(handInput);
  
  // Position selector
  const positionLabel = document.createElement('label');
  positionLabel.textContent = 'Your position:';
  form.appendChild(positionLabel);
  
  const positionSelect = document.createElement('select');
  ['UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'].forEach(pos => {
    const option = document.createElement('option');
    option.value = pos;
    option.textContent = pos;
    positionSelect.appendChild(option);
  });
  form.appendChild(positionSelect);
  
  // Game stage
  const stageLabel = document.createElement('label');
  stageLabel.textContent = 'Game stage:';
  form.appendChild(stageLabel);
  
  const stageSelect = document.createElement('select');
  ['preflop', 'flop', 'turn', 'river'].forEach(stage => {
    const option = document.createElement('option');
    option.value = stage;
    option.textContent = stage.charAt(0).toUpperCase() + stage.slice(1);
    stageSelect.appendChild(option);
  });
  stageSelect.addEventListener('change', () => {
    boardInput.disabled = stageSelect.value === 'preflop';
    if (stageSelect.value === 'preflop') {
      boardInput.value = '';
    }
  });
  form.appendChild(stageSelect);
  
  // Board cards
  const boardLabel = document.createElement('label');
  boardLabel.textContent = 'Board cards (e.g., AcTd2s):';
  form.appendChild(boardLabel);
  
  const boardInput = document.createElement('input');
  boardInput.type = 'text';
  boardInput.placeholder = 'AcTd2s for flop';
  boardInput.disabled = true; // Initially disabled for preflop
  form.appendChild(boardInput);
  
  // Number of players
  const playersLabel = document.createElement('label');
  playersLabel.textContent = 'Number of players:';
  form.appendChild(playersLabel);
  
  const playersInput = document.createElement('input');
  playersInput.type = 'number';
  playersInput.min = '2';
  playersInput.max = '10';
  playersInput.value = '6';
  form.appendChild(playersInput);
  
  // Pot size
  const potLabel = document.createElement('label');
  potLabel.textContent = 'Pot size (in BB):';
  form.appendChild(potLabel);
  
  const potInput = document.createElement('input');
  potInput.type = 'number';
  potInput.min = '0';
  potInput.step = '0.5';
  potInput.value = '1.5';
  form.appendChild(potInput);
  
  // Bet to call
  const betLabel = document.createElement('label');
  betLabel.textContent = 'Bet to call (in BB):';
  form.appendChild(betLabel);
  
  const betInput = document.createElement('input');
  betInput.type = 'number';
  betInput.min = '0';
  betInput.step = '0.5';
  betInput.value = '1';
  form.appendChild(betInput);
  
  // Raises before
  const raisesLabel = document.createElement('label');
  raisesLabel.textContent = 'Raises before you:';
  form.appendChild(raisesLabel);
  
  const raisesInput = document.createElement('input');
  raisesInput.type = 'number';
  raisesInput.min = '0';
  raisesInput.max = '5';
  raisesInput.value = '0';
  form.appendChild(raisesInput);
  
  // Stack size
  const stackLabel = document.createElement('label');
  stackLabel.textContent = 'Your stack (in BB):';
  form.appendChild(stackLabel);
  
  const stackInput = document.createElement('input');
  stackInput.type = 'number';
  stackInput.min = '1';
  stackInput.value = '100';
  form.appendChild(stackInput);
  
  // Submit button
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Analyze Hand';
  submitButton.style.gridColumn = '1 / span 2';
  submitButton.style.padding = '10px';
  submitButton.style.backgroundColor = '#4CAF50';
  submitButton.style.color = 'white';
  submitButton.style.border = 'none';
  submitButton.style.borderRadius = '4px';
  submitButton.style.cursor = 'pointer';
  form.appendChild(submitButton);
  
  container.appendChild(form);
  
  // Results area
  const resultsDiv = document.createElement('div');
  resultsDiv.style.marginTop = '20px';
  resultsDiv.style.padding = '15px';
  resultsDiv.style.border = '1px solid #ddd';
  resultsDiv.style.borderRadius = '4px';
  resultsDiv.style.backgroundColor = '#f9f9f9';
  resultsDiv.style.whiteSpace = 'pre-wrap';
  resultsDiv.textContent = 'Enter your hand details and click "Analyze Hand" to get recommendations.';
  container.appendChild(resultsDiv);
  
  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Parse form input
    const hand = handInput.value;
    const position = positionSelect.value;
    const stage = stageSelect.value;
    const boardText = boardInput.value;
    
    // Process board cards if needed
    let boardCards = [];
    if (stage !== 'preflop' && boardText) {
      // Split board into individual cards
      boardCards = [];
      for (let i = 0; i < boardText.length; i += 2) {
        if (i + 1 < boardText.length) {
          boardCards.push(boardText.substring(i, i + 2));
        }
      }
    }
    
    // Get other form values
    const players = parseInt(playersInput.value, 10);
    const pot = parseFloat(potInput.value);
    const betToCall = parseFloat(betInput.value);
    const raises = parseInt(raisesInput.value, 10);
    const stack = parseInt(stackInput.value, 10);
    
    // Analyze the hand
    const analysis = analyzeGame(hand, position, stage, boardCards, players, pot, betToCall, raises, stack);
    
    // Display results
    resultsDiv.textContent = analysis;
  });
  
  return container;
}

// Export relevant functions
window.PokerAnalyzer = {
  init: initializePokerAnalyzer,
  createUI: createPokerAnalyzerUI,
  analyze: analyzeGame
};