export const COLS = 10;
export const ROWS = 20;

/** 0 = empty, 1-7 = piece types, 8 = garbage sent by the opponent. */
export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Board = Cell[][];
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PIECE_COLORS: Record<number, string> = {
  1: "#00E5FF", // I  cyan
  2: "#FF2E92", // O  magenta (matches accent)
  3: "#39FF14", // S  neon green
  4: "#FF3864", // Z  neon red
  5: "#FFB000", // L  amber
  6: "#3B82F6", // J  electric blue
  7: "#A855F7", // T  violet
  8: "#4B4B5C", // garbage  grey
};

// All 4 rotations for each piece, explicitly defined for correct pivot behaviour
const SHAPE_DATA: Record<number, string[][]> = {
  1: [ // I
    ["0000", "1111", "0000", "0000"],
    ["0100", "0100", "0100", "0100"],
    ["0000", "0000", "1111", "0000"],
    ["0010", "0010", "0010", "0010"],
  ],
  2: [ // O (invariant)
    ["0110", "0110", "0000", "0000"],
    ["0110", "0110", "0000", "0000"],
    ["0110", "0110", "0000", "0000"],
    ["0110", "0110", "0000", "0000"],
  ],
  3: [ // S
    ["0110", "1100", "0000", "0000"],
    ["0100", "0110", "0010", "0000"],
    ["0000", "0110", "1100", "0000"],
    ["1000", "1100", "0100", "0000"],
  ],
  4: [ // Z
    ["1100", "0110", "0000", "0000"],
    ["0010", "0110", "0100", "0000"],
    ["0000", "1100", "0110", "0000"],
    ["0100", "1100", "1000", "0000"],
  ],
  5: [ // L
    ["0010", "1110", "0000", "0000"],
    ["0100", "0100", "0110", "0000"],
    ["0000", "1110", "1000", "0000"],
    ["1100", "0100", "0100", "0000"],
  ],
  6: [ // J
    ["1000", "1110", "0000", "0000"],
    ["0110", "0100", "0100", "0000"],
    ["0000", "1110", "0010", "0000"],
    ["0100", "0100", "1100", "0000"],
  ],
  7: [ // T
    ["0100", "1110", "0000", "0000"],
    ["0100", "0110", "0100", "0000"],
    ["0000", "1110", "0100", "0000"],
    ["0100", "1100", "0100", "0000"],
  ],
};

export const ROTATIONS: Record<number, boolean[][][]> = Object.fromEntries(
  Object.entries(SHAPE_DATA).map(([k, rots]) => [
    k,
    rots.map(rows => rows.map(r => r.split("").map(c => c === "1"))),
  ])
);

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0) as Cell[]);
}

export type Piece = {
  type: PieceType;
  rotation: number;
  x: number;
  y: number;
};

export function randomType(): PieceType {
  return (Math.floor(Math.random() * 7) + 1) as PieceType;
}

export function spawnPiece(type: PieceType): Piece {
  // I piece: spawn one row above so its bar appears on row 0
  return { type, rotation: 0, x: 3, y: type === 1 ? -1 : 0 };
}

export function cells(p: Piece): [number, number][] {
  const shape = ROTATIONS[p.type][p.rotation];
  const out: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c]) out.push([p.y + r, p.x + c]);
    }
  }
  return out;
}

export function valid(board: Board, p: Piece): boolean {
  return cells(p).every(
    ([r, c]) =>
      c >= 0 &&
      c < COLS &&
      r < ROWS &&
      (r < 0 || board[r][c] === 0)
  );
}

export function place(board: Board, p: Piece): Board {
  const b = board.map(row => [...row]) as Board;
  for (const [r, c] of cells(p)) {
    if (r >= 0) b[r][c] = p.type;
  }
  return b;
}

export function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(c => c === 0));
  const cleared = ROWS - kept.length;
  const blanks = Array.from({ length: cleared }, () => new Array(COLS).fill(0) as Cell[]);
  return { board: [...blanks, ...kept] as Board, cleared };
}

export function rotate(board: Board, p: Piece): Piece {
  const next = { ...p, rotation: (p.rotation + 1) % 4 };
  // Wall-kick: try original position, then nudge left/right
  for (const dx of [0, -1, 1, -2, 2]) {
    const kicked = { ...next, x: next.x + dx };
    if (valid(board, kicked)) return kicked;
  }
  return p;
}

export function ghost(board: Board, p: Piece): Piece {
  let g = { ...p };
  while (valid(board, { ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 };
  return g;
}

export function linesToScore(lines: number, level: number): number {
  return ([0, 100, 300, 500, 800][lines] ?? 0) * (level + 1);
}

export function tickMs(level: number): number {
  return Math.max(80, 800 - level * 65);
}

/** Garbage rows are solid grey with a single hole. */
export const GARBAGE_CELL: Cell = 8;

/**
 * Push `rows` garbage lines in from the bottom, dropping the same number of
 * rows off the top. All rows in one attack share a hole column, matching
 * standard versus behaviour.
 */
export function addGarbage(board: Board, rows: number): Board {
  if (rows <= 0) return board;
  const n = Math.min(rows, ROWS);
  const hole = Math.floor(Math.random() * COLS);
  const garbage = Array.from({ length: n }, () =>
    Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE_CELL)) as Cell[]
  );
  return [...board.slice(n), ...garbage] as Board;
}

/**
 * Attack sent to the opponent for clearing `lines` rows at once.
 * 1 → 0, 2 → 1, 3 → 2, 4 → 4.
 */
export function linesToAttack(lines: number): number {
  return [0, 0, 1, 2, 4][lines] ?? 0;
}
