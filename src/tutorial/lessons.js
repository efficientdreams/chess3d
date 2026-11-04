// Interactive lessons. Every lesson requires the learner to *do* something on the board.
//
// Lesson types:
//  squares — click the requested squares/pieces (items: [{prompt, answers}])
//  stars   — move your piece(s) to collect every star; your opponent never moves
//  task    — make the right move(s); `steps` validate each move, the opponent may reply
//  play    — play out a position against the computer until the goal is reached
import { sq } from '../chess/engine.js';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

const isMate = (move) => !!move.mate;

export const CHAPTERS = [
  { id: 'board', title: 'The Battlefield', icon: '🗺️' },
  { id: 'pieces', title: 'How the Pieces Move', icon: '♞' },
  { id: 'capture', title: 'Capturing', icon: '⚔️' },
  { id: 'special', title: 'Special Moves', icon: '✨' },
  { id: 'check', title: 'Check', icon: '⚠️' },
  { id: 'mate', title: 'Checkmate', icon: '👑' },
  { id: 'tactics', title: 'Tactics & Openings', icon: '🏹' },
  { id: 'practice', title: 'Practice vs the Computer', icon: '🌲' },
];

export const LESSONS = [
  // ------------------------------------------------------------------ board
  {
    id: 'squares', chapter: 'board', title: 'Naming the Squares',
    intro: `The board has <b>64 squares</b>. Columns are called <b>files</b> and are lettered <b>a–h</b> from left to right.
      Rows are called <b>ranks</b> and are numbered <b>1–8</b> starting from White's side.
      Every square has a name made from its file and rank — like <b>e4</b>. Look at the letters and numbers carved into the board's frame.`,
    goal: 'Click each square as it is called out.',
    type: 'squares', fen: EMPTY,
    items: [
      { prompt: 'Click the square <b>e4</b>.', answers: ['e4'] },
      { prompt: 'Click the corner square <b>a1</b>.', answers: ['a1'] },
      { prompt: 'Click the opposite corner, <b>h8</b>.', answers: ['h8'] },
      { prompt: 'Click <b>d5</b>.', answers: ['d5'] },
      { prompt: 'Click <b>c7</b>.', answers: ['c7'] },
      { prompt: 'Click <b>f2</b>.', answers: ['f2'] },
      { prompt: 'Click <b>b6</b>.', answers: ['b6'] },
    ],
  },
  {
    id: 'setup', chapter: 'board', title: 'Setting Up the Armies',
    intro: `White's army starts on ranks 1 and 2; Black's on ranks 7 and 8. A light square is always in each player's right-hand corner.
      Rooks take the corners, knights stand beside them, then bishops. The <b>queen goes on her own colour</b>
      (the white queen on a light square, the black queen on a dark one) and the king stands beside her.`,
    goal: 'Find each piece that is asked for.',
    type: 'squares', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    items: [
      { prompt: 'Click any <b>white pawn</b>.', answers: ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'] },
      { prompt: 'Rooks guard the corners. Click a <b>black rook</b>.', answers: ['a8', 'h8'] },
      { prompt: 'Click a <b>white knight</b> — it stands next to a rook.', answers: ['b1', 'g1'] },
      { prompt: 'Click a <b>black bishop</b>.', answers: ['c8', 'f8'] },
      { prompt: 'The queen sits on her own colour. Click the <b>white queen</b>.', answers: ['d1'] },
      { prompt: 'Click the <b>black king</b>.', answers: ['e8'] },
    ],
  },

  // ------------------------------------------------------------------ pieces
  {
    id: 'rook1', chapter: 'pieces', title: 'The Rook',
    intro: `The <b>rook</b> moves in straight lines — up, down, left or right — as many squares as it likes.
      It cannot jump over pieces. Click the rook to see where it can go, then click a destination.`,
    goal: 'Collect all the stars with the rook.',
    type: 'stars', fen: '8/8/8/8/8/8/8/R7 w - - 0 1', stars: ['a5', 'e5', 'e8'], par: 3,
  },
  {
    id: 'rook2', chapter: 'pieces', title: 'Rook Around Obstacles',
    intro: `Pieces block the rook's path. Your own pawns are in the way here, so plan a route around them.`,
    goal: 'Collect all the stars. Only the rook may move.',
    type: 'stars', fen: '8/8/8/8/P7/2P5/8/R7 w - - 0 1', stars: ['a3', 'b8', 'h8', 'h1'], par: 5, movable: ['r'],
  },
  {
    id: 'bishop1', chapter: 'pieces', title: 'The Bishop',
    intro: `The <b>bishop</b> moves diagonally, any number of squares. Because it only moves diagonally,
      a bishop <b>stays on the same colour</b> for the whole game.`,
    goal: 'Collect all the stars with the bishop.',
    type: 'stars', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', stars: ['e3', 'g5', 'd8'], par: 3,
  },
  {
    id: 'bishop2', chapter: 'pieces', title: 'Bishop Journey',
    intro: 'Each of these stars sits on a light square — the only colour this bishop can ever reach.',
    goal: 'Collect all the stars.',
    type: 'stars', fen: '8/8/8/8/8/8/8/5B2 w - - 0 1', stars: ['b5', 'e8', 'h5', 'd1'], par: 4,
  },
  {
    id: 'queen1', chapter: 'pieces', title: 'The Queen',
    intro: `The <b>queen</b> is the most powerful piece: she moves like a rook <i>and</i> a bishop combined —
      any distance in a straight line or along a diagonal.`,
    goal: 'Collect all the stars with the queen.',
    type: 'stars', fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', stars: ['d6', 'a3', 'g3', 'b8'], par: 4,
  },
  {
    id: 'king1', chapter: 'pieces', title: 'The King',
    intro: `The <b>king</b> is the most important piece but moves slowly: just <b>one square</b> in any direction.
      Protect him — if he is trapped, the game is lost!`,
    goal: 'Walk the king to every star.',
    type: 'stars', fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', stars: ['e2', 'f3', 'f4', 'e5'], par: 4,
  },
  {
    id: 'knight1', chapter: 'pieces', title: 'The Knight',
    intro: `The <b>knight</b> moves in an <b>L-shape</b>: two squares in one direction, then one square to the side.
      It is the only piece that can <b>jump over</b> other pieces — notice it leaps right over your pawns.`,
    goal: 'Collect all the stars with the knight.',
    type: 'stars', fen: '8/8/8/8/8/8/PPPP4/1N6 w - - 0 1', stars: ['c3', 'd5', 'f6'], par: 3, movable: ['n'],
  },
  {
    id: 'knight2', chapter: 'pieces', title: 'Knight Gallop',
    intro: 'Knights take practice! Count “two, then one” for each hop.',
    goal: 'Collect all the stars.',
    type: 'stars', fen: '8/8/8/8/8/8/8/6N1 w - - 0 1', stars: ['f3', 'h4', 'g6', 'e5', 'c4'], par: 5,
  },
  {
    id: 'pawn1', chapter: 'pieces', title: 'The Pawn',
    intro: `<b>Pawns</b> march straight forward, one square at a time — they can never move backwards.
      On its <b>very first move</b>, a pawn may choose to advance <b>two squares</b>.`,
    goal: 'Collect the stars in as few moves as possible (use the two-square first move!).',
    type: 'stars', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', stars: ['e4', 'e5', 'e6'], par: 3,
  },
  {
    id: 'pawn2', chapter: 'pieces', title: 'Pawns Capture Diagonally',
    intro: `Pawns are unusual: they move straight ahead, but they <b>capture diagonally</b> forward one square.
      A pawn cannot capture the piece directly in front of it — that piece simply blocks it.`,
    goal: 'Capture the pieces marked with stars, using only your pawn.',
    type: 'stars', fen: '8/8/4r3/3b4/3pn3/3P4/8/8 w - - 0 1', stars: ['e4', 'd5', 'e6'], par: 3,
  },

  // ------------------------------------------------------------------ capture
  {
    id: 'capture1', chapter: 'capture', title: 'Capturing Enemies',
    intro: `To <b>capture</b>, move your piece onto a square occupied by an enemy piece. The enemy is removed from the board —
      watch it get carried off to the edge of the stump!`,
    goal: 'Capture every black piece with your queen.',
    type: 'stars', fen: '8/8/8/b2n4/8/8/8/3Qn3 w - - 0 1', stars: ['d5', 'a5', 'e1'], par: 3,
  },
  {
    id: 'values', chapter: 'capture', title: 'Piece Values',
    intro: `Not all pieces are equal. Players count them in points:
      <b>pawn 1</b>, <b>knight 3</b>, <b>bishop 3</b>, <b>rook 5</b>, <b>queen 9</b>. The king is priceless.
      When you can capture several things, grab the most valuable one!`,
    goal: 'Your knight can capture three different pieces. Pick the best capture.',
    type: 'task', fen: '6k1/8/3p1q2/2r5/4N3/8/5PPP/6K1 w - - 0 1',
    steps: [{
      solution: 'e4f6',
      accept: (m) => {
        if (m.to === sq('f6')) return true;
        if (m.captured === 'p') return 'That only wins a pawn — worth just 1 point. Look for something bigger!';
        if (m.captured === 'r') return 'A rook (5 points) is nice, but there is an even more valuable piece in reach!';
        return 'Your knight can capture something. Click the knight to see its moves.';
      },
    }],
    success: 'You captured the queen — 9 points! And it is check, too.',
  },

  // ------------------------------------------------------------------ special
  {
    id: 'promotion', chapter: 'special', title: 'Pawn Promotion',
    intro: `When a pawn reaches the far end of the board it <b>promotes</b>: it turns into a queen, rook, bishop or knight of your choice.
      Almost always you pick a <b>queen</b>.`,
    goal: 'Push your pawn to the last rank and promote it to a queen.',
    type: 'task', fen: '7k/4P3/8/8/8/8/8/K7 w - - 0 1',
    steps: [{
      solution: 'e7e8q',
      accept: (m) => (m.promotion === 'q' ? true : m.promotion ? 'That works, but the queen is the strongest choice. Try again and choose the queen!' : 'Move the pawn forward onto the last rank.'),
    }],
    success: 'A new queen! Promotion often decides endgames.',
  },
  {
    id: 'castle1', chapter: 'special', title: 'Castling Kingside',
    intro: `<b>Castling</b> is a special move that tucks your king into safety and brings a rook into play — the only time two pieces move at once.
      Move the king <b>two squares toward a rook</b>, and the rook hops over to the other side.
      Allowed only if neither piece has moved and the squares between them are empty.`,
    goal: 'Castle kingside: click your king, then click g1.',
    type: 'task', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    steps: [{ solution: 'e1g1', accept: (m) => (m.castle === 'K' ? true : m.castle ? 'That is queenside castling. This time castle toward the h1 rook!' : 'To castle, move the king two squares toward the rook on h1.') }],
    success: 'The king is safe behind his pawns and the rook is ready for action.',
  },
  {
    id: 'castle2', chapter: 'special', title: 'Castling Queenside',
    intro: `Castling can also be done on the queen's side. The king still moves <b>two squares</b> (to c1), and the rook jumps to d1.`,
    goal: 'Castle queenside.',
    type: 'task', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    steps: [{ solution: 'e1c1', accept: (m) => (m.castle === 'Q' ? true : m.castle ? 'That is kingside. Castle toward the a1 rook this time!' : 'Move the king two squares toward the a1 rook.') }],
    success: 'Queenside castling — also called “castling long”.',
  },
  {
    id: 'castle3', chapter: 'special', title: 'No Castling Through Check',
    intro: `You may <b>not</b> castle if your king is in check, would pass through an attacked square, or would land in check.
      Here the black bishop on a6 watches the f1 square…`,
    goal: 'Castle on the side where it is allowed.',
    type: 'task', fen: '4k3/8/b7/8/8/8/PPPP1PPP/R3K2R w KQ - 0 1',
    illegal: (from, to) => (from === sq('e1') && to === sq('g1') ? 'The bishop on a6 attacks f1 — your king can’t pass through it. Try the other side!' : null),
    steps: [{ solution: 'e1c1', accept: (m) => (m.castle ? true : 'Castle — move the king two squares toward a rook.') }],
    success: 'Exactly — kingside was blocked by the bishop, but queenside was safe.',
  },
  {
    id: 'enpassant', chapter: 'special', title: 'En Passant',
    intro: `Black's pawn just jumped two squares from d7 to d5, landing right beside your pawn on e5.
      For <b>one move only</b>, your pawn may capture it <b>“en passant”</b> (in passing) — as if it had only moved one square.
      Your pawn lands on d6 and the black pawn disappears.`,
    goal: 'Capture the d5 pawn en passant.',
    type: 'task', fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
    steps: [{ solution: 'e5d6', accept: (m) => (m.enPassant ? true : 'Legal, but try the special capture: move your e5 pawn diagonally to d6.') }],
    success: 'En passant! A rare but important rule.',
  },

  // ------------------------------------------------------------------ check
  {
    id: 'check1', chapter: 'check', title: 'Giving Check',
    intro: `When a piece attacks the enemy king, the king is in <b>check</b>. The opponent must deal with it immediately.`,
    goal: 'Move your queen to put the black king in check.',
    type: 'task', fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
    steps: [{ solution: 'd1a4', accept: (m) => (m.check ? true : 'That does not attack the king. Find a square where your queen sees e8.') }],
    success: 'Check! The king is attacked and Black must respond.',
  },
  {
    id: 'escape1', chapter: 'check', title: 'Escape: Move the King',
    intro: `There are three ways to get out of check: <b>move the king</b>, <b>block</b> the attack, or <b>capture</b> the attacker.
      Here the rook on e8 checks your king, and nothing can block or capture it.`,
    goal: 'Move your king out of check.',
    type: 'task', fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1',
    steps: [{ solution: 'e1d2', accept: () => true }],
    success: 'Safe! The king stepped off the e-file.',
  },
  {
    id: 'escape2', chapter: 'check', title: 'Escape: Block',
    intro: `The rook on a1 is checking your king along the first rank, and your own pawns stop the king from running.
      You can <b>block</b> by putting a piece in between.`,
    goal: 'Block the check.',
    type: 'task', fen: '6k1/8/8/8/8/8/4BPPP/r5K1 w - - 0 1',
    steps: [{ solution: 'e2f1', accept: () => true }],
    success: 'Blocked! Your bishop shields the king.',
  },
  {
    id: 'escape3', chapter: 'check', title: 'Escape: Capture',
    intro: `The black knight on f3 has jumped in to give check. Knights can't be blocked — but you can <b>capture the attacker</b>!`,
    goal: 'Get out of check by capturing the knight.',
    type: 'task', fen: '6k1/8/8/8/8/5n2/5PPP/6K1 w - - 0 1',
    steps: [{ solution: 'g2f3', accept: (m) => (m.to === sq('f3') ? true : 'That escapes, but in this lesson capture the checking knight instead!') }],
    success: 'Captured! Removing the attacker is often the best escape.',
  },

  // ------------------------------------------------------------------ mate
  {
    id: 'mate1', chapter: 'mate', title: 'Back-Rank Mate',
    intro: `<b>Checkmate</b> means the king is in check and there is no way out. That wins the game!
      Here Black's king is hemmed in by his own pawns…`,
    goal: 'Deliver checkmate in one move.',
    type: 'task', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    steps: [{ solution: 'a1a8', accept: (m) => (isMate(m) ? true : 'Not checkmate yet. Find a move that checks the king where he cannot escape.') }],
    success: 'Back-rank mate! The pawns became the king’s prison.',
  },
  {
    id: 'mate2', chapter: 'mate', title: 'Queen & King Mate',
    intro: 'The queen is strongest when your king supports her. Let them work together.',
    goal: 'Checkmate in one move.',
    type: 'task', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1',
    steps: [{ solution: 'h1h8', accept: (m) => (isMate(m) ? true : 'Not mate. The black king has an escape — look again!') }],
    success: 'Checkmate! The king and queen trapped him together.',
  },
  {
    id: 'mate3', chapter: 'mate', title: 'Smothered Mate',
    intro: `A beautiful pattern: the king is <b>smothered</b> by his own pieces, and a knight delivers the final blow.`,
    goal: 'Checkmate with the knight.',
    type: 'task', fen: '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1',
    steps: [{ solution: 'e5f7', accept: (m) => (isMate(m) ? true : 'Not quite. Which knight jump attacks h8?') }],
    success: 'Smothered mate — the king couldn’t move a single step.',
  },
  {
    id: 'stalemate', chapter: 'mate', title: 'Beware Stalemate',
    intro: `If the player to move has <b>no legal moves</b> but is <b>not in check</b>, it is <b>stalemate</b> — and the game is a <b>draw</b>!
      When you're winning, make sure the enemy king always has a move — or is checkmated.`,
    goal: 'Deliver checkmate — without stalemating!',
    type: 'task', fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
    steps: [{
      solution: 'b1b7',
      accept: (m, after) => {
        if (isMate(m)) return true;
        const st = after.status();
        if (st && st.reason === 'stalemate') return 'Stalemate! Black can’t move but isn’t in check — that’s only a draw. Try again!';
        return 'Not checkmate. Look for a check the king cannot escape.';
      },
    }],
    success: 'Checkmate, not stalemate. A crucial difference!',
  },
  {
    id: 'mate-in-2', chapter: 'mate', title: 'Rook Ladder (Mate in 2)',
    intro: `Two rooks can drive a king to the edge like climbing a ladder. First <b>cut off</b> the king's escape with one rook,
      then deliver mate with the other. The computer will defend!`,
    goal: 'Checkmate within 2 moves.',
    type: 'play', fen: '3k4/8/8/8/8/8/7R/R5K1 w - - 0 1', maxMoves: 2, engineLevel: 4,
    success: 'Mate in two — the classic rook ladder!',
  },

  // ------------------------------------------------------------------ tactics & openings
  {
    id: 'center', chapter: 'tactics', title: 'Control the Centre',
    intro: `A good opening move grabs the <b>centre</b> (d4, d5, e4, e5) and opens lines for your pieces.
      Edge moves like a4 or h4 do very little.`,
    goal: 'Play a strong first move for White.',
    type: 'task', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    steps: [{
      solution: 'e2e4',
      accept: (m) => {
        const good = ['e2e4', 'd2d4', 'c2c4', 'g1f3'];
        const u = uci(m);
        if (good.includes(u)) return true;
        if (m.piece === 'n') return 'Knights belong toward the centre — f3 or c3 is better than the rim. Try a central pawn move!';
        return 'That doesn’t fight for the centre. Try moving a centre pawn two squares!';
      },
    }],
    success: 'Excellent! You staked your claim in the centre.',
  },
  {
    id: 'scholar-defence', chapter: 'tactics', title: 'Stop the Scholar’s Mate',
    intro: `White's queen and bishop are both aiming at <b>f7</b>, the weakest square near Black's king.
      If you ignore it, White plays Qxf7 — checkmate! You are Black here.`,
    goal: 'Defend against the checkmate threat on f7.',
    type: 'task', side: 'b', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    steps: [{
      solution: 'd8e7',
      punish: true,
      accept: (m, after) => {
        const mate = after.moves().find((x) => { const u = after._make(x); const mt = after.inCheck() && after.moves().length === 0; after._unmake(x, u); return mt; });
        if (mate) return { fail: 'Ouch — Qxf7 is checkmate! Protect f7 or block the queen’s path.', reply: mate };
        return true;
      },
    }],
    success: 'Well defended! The quick checkmate trap is stopped.',
  },
  {
    id: 'scholar-attack', chapter: 'tactics', title: 'Scholar’s Mate',
    intro: 'Now you are White. Black has blundered and left f7 defended only by the king. Strike!',
    goal: 'Checkmate in one move.',
    type: 'task', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    steps: [{ solution: 'h5f7', accept: (m) => (isMate(m) ? true : 'Look at f7: your queen and bishop both attack it.') }],
    success: 'Checkmate in four moves — the famous Scholar’s Mate.',
  },
  {
    id: 'fork', chapter: 'tactics', title: 'The Knight Fork',
    intro: `A <b>fork</b> is a move that attacks two pieces at once. Knights are brilliant forkers.
      Find a check that also attacks the black queen.`,
    goal: 'Fork the king and queen, then win the queen.',
    type: 'task', fen: '6k1/3q4/8/8/4N3/8/5PPP/6K1 w - - 0 1',
    steps: [
      { solution: 'e4f6', reply: 'engine', accept: (m) => (m.to === sq('f6') ? true : 'Find the knight move that gives check AND attacks the queen on d7.') },
      { solution: 'f6d7', accept: (m) => (m.captured === 'q' ? true : 'Now collect your reward — capture the queen!') },
    ],
    success: 'Forked and won! The king had to move, leaving the queen to her fate.',
  },

  // ------------------------------------------------------------------ practice
  {
    id: 'develop', chapter: 'practice', title: 'Develop & Castle',
    intro: `In the opening, bring out your <b>knights and bishops</b> (“develop” them) and <b>castle</b> to keep your king safe.
      Play against the computer and complete the checklist within 10 moves.`,
    goal: 'Develop both knights, at least one bishop, and castle.',
    type: 'play', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', maxMoves: 10, engineLevel: 1,
    checklist: (c) => {
      const at = (s, t) => { const p = c.board[sq(s)]; return p && p.t === t && p.c === 'w'; };
      const castled = c.history.some((h) => h.move.color === 'w' && h.move.castle);
      return [
        { label: 'Knight from b1 developed', done: !at('b1', 'n') && c.history.some((h) => h.move.from === sq('b1')) },
        { label: 'Knight from g1 developed', done: !at('g1', 'n') && c.history.some((h) => h.move.from === sq('g1')) },
        { label: 'A bishop developed', done: c.history.some((h) => h.move.color === 'w' && h.move.piece === 'b') },
        { label: 'Castled', done: castled },
      ];
    },
    success: 'Textbook development! Your pieces are active and your king is safe.',
  },
  {
    id: 'kq-mate', chapter: 'practice', title: 'Checkmate with King & Queen',
    intro: `The most important basic checkmate. Use your queen to <b>shrink the box</b> around the enemy king
      (a knight's move away is a good spot), push him to the edge, then bring your own king up to help.
      Careful not to stalemate!`,
    goal: 'Checkmate the lone king within 20 moves.',
    type: 'play', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', maxMoves: 20, engineLevel: 3,
    success: 'You mastered the king & queen checkmate!',
  },
  {
    id: 'rr-mate', chapter: 'practice', title: 'The Two-Rook Lawnmower',
    intro: `Two rooks can mate without help from the king: one rook checks, the other cuts off the next rank, and they
      leapfrog toward the edge. Keep your rooks far from the enemy king so he can't attack them.`,
    goal: 'Checkmate within 15 moves.',
    type: 'play', fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1', maxMoves: 15, engineLevel: 3,
    success: 'The lawnmower strikes again!',
  },
  {
    id: 'kp-promote', chapter: 'practice', title: 'Escort the Pawn',
    intro: `With king and pawn against a lone king, use your <b>king to escort</b> the pawn to promotion.
      Your king leads the way; the pawn follows. Don't let the black king capture your pawn!`,
    goal: 'Promote your pawn to a queen within 12 moves.',
    type: 'play', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', maxMoves: 12, engineLevel: 3,
    goalCheck: (c, m) => (m && m.color === 'w' && m.promotion === 'q' ? 'success' : null),
    success: 'Promoted! King and pawn teamwork wins the day.',
  },
];

export function uci(m) {
  const n = (i) => 'abcdefgh'[i & 7] + ((i >> 3) + 1);
  return n(m.from) + n(m.to) + (m.promotion || '');
}
