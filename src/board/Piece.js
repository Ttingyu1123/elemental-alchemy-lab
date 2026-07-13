// ═══ 落下中的拼塊：移動、旋轉（wall kick）、幽靈落點 ═══
import { KICK_OFFSETS } from '../data/pieces.js';
import { HIDDEN_ROWS, COLS } from '../config.js';

export class Piece {
  // shape: SHAPES 條目；cells: 與 shape 格子一一對應的 [{el, kind}]
  constructor(shape, cells) {
    this.shape = shape;
    this.cells = cells;
    this.rot = 0;
    const st = shape.states[0];
    const w = Math.max(...st.map(p => p[0])) + 1;
    const h = Math.max(...st.map(p => p[1])) + 1;
    this.x = Math.floor((COLS - w) / 2);
    this.y = HIDDEN_ROWS - h; // 最底格剛好在隱藏區最後一列
  }

  blocksAt(x = this.x, y = this.y, rot = this.rot) {
    return this.shape.states[rot].map(([dx, dy], i) => ({
      r: y + dy, c: x + dx, cell: this.cells[i],
    }));
  }

  blocks() { return this.blocksAt(); }

  fits(board, x, y, rot) {
    return !board.collides(this.blocksAt(x, y, rot).map(({ r, c }) => ({ r, c })));
  }

  tryMove(board, dx, dy) {
    if (this.fits(board, this.x + dx, this.y + dy, this.rot)) {
      this.x += dx; this.y += dy;
      return true;
    }
    return false;
  }

  tryRotate(board, dir) { // dir: 1 順時針, -1 逆時針
    const newRot = (this.rot + dir + 4) % 4;
    for (const [kx, ky] of KICK_OFFSETS) {
      if (this.fits(board, this.x + kx, this.y + ky, newRot)) {
        this.x += kx; this.y += ky; this.rot = newRot;
        return true;
      }
    }
    return false;
  }

  ghostY(board) {
    let gy = this.y;
    while (this.fits(board, this.x, gy + 1, this.rot)) gy++;
    return gy;
  }

  isGrounded(board) {
    return !this.fits(board, this.x, this.y + 1, this.rot);
  }
}
