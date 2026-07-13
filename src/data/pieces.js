// ═══ 7 種原創煉金拼塊；旋轉態於載入時預計算 ═══
// pivot 選在半格點使旋轉結果保持整數座標
const RAW_SHAPES = [
  { id: 'distiller',  name: '蒸餾管', cells: [[0,1],[1,1],[2,1],[3,1]], pivot: [1.5, 1.5] }, // 直線
  { id: 'crucible',   name: '坩堝',   cells: [[1,0],[2,0],[1,1],[2,1]], pivot: [1.5, 0.5] }, // 方形
  { id: 'tripod',     name: '三腳架', cells: [[0,1],[1,1],[2,1],[1,0]], pivot: [1, 1] },     // T 形
  { id: 'retort',     name: '曲頸瓶', cells: [[0,1],[1,1],[2,1],[2,0]], pivot: [1, 1] },     // L 形
  { id: 'siphon',     name: '虹吸管', cells: [[0,0],[0,1],[1,1],[2,1]], pivot: [1, 1] },     // 反 L
  { id: 'serpentine', name: '蛇形管', cells: [[1,0],[2,0],[0,1],[1,1]], pivot: [1, 1] },     // 階梯
  { id: 'zigzag',     name: '閃電符', cells: [[0,0],[1,0],[1,1],[2,1]], pivot: [1, 1] },     // 反階梯
];

function rotateCW(cells, [px, py]) {
  // 螢幕座標（y 向下）順時針：(dx,dy) -> (-dy,dx)
  return cells.map(([x, y]) => [px - (y - py), py + (x - px)]);
}

function normalize(cells) {
  const minX = Math.min(...cells.map(c => c[0]));
  const minY = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

export const SHAPES = RAW_SHAPES.map(raw => {
  const states = [];
  let cur = raw.cells;
  for (let r = 0; r < 4; r++) {
    states.push(normalize(cur).map(([x, y]) => [Math.round(x), Math.round(y)]));
    cur = rotateCW(cur, raw.pivot);
  }
  return { id: raw.id, name: raw.name, states };
});

export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map(s => [s.id, s]));

// 簡化 wall kick 偏移（依序嘗試）
export const KICK_OFFSETS = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0],
];
