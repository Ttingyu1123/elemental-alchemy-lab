# -*- coding: utf-8 -*-
"""機制 e2e：消行/共鳴/淨化/法術/勝利/Boss/反應預覽。
用法：先 npm run dev（或設 EAL_URL），再 python tests/e2e/mechanics.py
"""
import sys, io, json, os, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

URL = os.environ.get('EAL_URL', 'http://localhost:5199')
OUT = pathlib.Path(__file__).parent / 'artifacts'
OUT.mkdir(exist_ok=True)
errors = []

MK = "const mk = (el, kind, extra) => Object.assign({id: Math.floor(Math.random()*1e9), lockId: Math.floor(Math.random()*1e9)}, {el, kind: kind||'normal'}, extra||{});"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.evaluate("localStorage.clear()")
    page.reload(); page.wait_for_load_state('networkidle'); page.wait_for_timeout(400)

    def wait_stable():
        for _ in range(40):
            st = page.evaluate("() => window.__eal.session ? window.__eal.session.state : 'none'")
            if st in ('falling', 'over', 'won', 'none'):
                return st
            page.wait_for_timeout(150)
        return 'timeout'

    page.click('#btn-start'); page.wait_for_timeout(400)
    page.locator('#btn-tut-skip').click(); page.wait_for_timeout(200)

    # 消行
    page.evaluate(f"""() => {{
        const s = window.__eal.session; {MK}
        for (let c = 0; c < 10; c++) s.board.set(23, c, mk(null, 'sand'));
        s.startResolution();
    }}""")
    wait_stable()
    assert page.evaluate("() => window.__eal.session.stats.lines") == 1, 'line clear'
    print('line clear: OK')

    # 共鳴＋核心
    page.evaluate(f"""() => {{
        const s = window.__eal.session; {MK}
        [[23,4],[23,5],[23,6],[22,5],[21,5]].forEach(([r,c]) => s.board.set(r, c, mk('fire')));
        s.startResolution();
    }}""")
    wait_stable()
    res = page.evaluate("""() => {
        const s = window.__eal.session;
        let core = 0; s.board.forEach((r,c,cell) => { if (cell.kind==='core') core++; });
        return { resonances: s.stats.resonances, cores: s.stats.cores, onBoard: core };
    }""")
    assert res['cores'] == 1 and res['onBoard'] == 1, res
    print('resonance + core: OK')

    # 光暗淨化（同時引爆場上核心）
    page.evaluate(f"""() => {{
        const s = window.__eal.session; {MK}
        s.board.set(23, 2, mk('light')); s.board.set(23, 3, mk('shadow'));
        s.startResolution();
    }}""")
    wait_stable()
    by = page.evaluate("() => window.__eal.session.stats.byType")
    assert by.get('eclipse') == 1, by
    print('eclipse: OK')

    # 反應預覽：場上水 + 幽靈含火拼塊移過去 → pvData 非空
    pv = page.evaluate(f"""() => {{
        const s = window.__eal.session; {MK}
        // 清空棋盤重佈
        for (let r = 0; r < s.board.rows; r++) for (let c = 0; c < s.board.cols; c++) s.board.set(r, c, null);
        s.board.set(23, 4, mk('water'));
        // 造一個純火 O 拼塊放在旁邊直落
        const shape = s.piece.shape;
        for (const cell of s.piece.cells) {{ cell.el = 'fire'; cell.kind = 'normal'; }}
        s.piece.x = 4; s.piece.rot = 0;
        const gy = s.piece.ghostY(s.board);
        return import('/src/alchemy/ReactionResolver.js').then(m =>
            m.previewReactions(s.board, s.piece.blocksAt(s.piece.x, gy)).length);
    }}""")
    assert pv >= 1, f'preview should show at least one reaction, got {pv}'
    print(f'reaction preview: OK ({pv} highlights)')
    page.screenshot(path=str(OUT / 'mech_preview.png'))

    # 法術：重力逆轉能量扣除、賢者之石每關一次
    spell = page.evaluate("""() => {
        const s = window.__eal.session;
        s.energy = 100;
        s.spells.beginCast('gravity');
        return s.energy;
    }""")
    wait_stable()
    assert spell == 60, spell
    stone = page.evaluate("""() => {
        const s = window.__eal.session;
        s.energy = 100;
        s.spells.beginCast('philostone');
        s.spells.onCellPicked(23, 5);
        return { used: s.spells.usedCounts['philostone'], energy: s.energy };
    }""")
    wait_stable()
    again = page.evaluate("() => { const s = window.__eal.session; s.energy = 100; return s.spells.canCast('philostone'); }")
    assert stone['used'] == 1 and stone['energy'] == 0 and again is False
    print('spells: OK')

    # 勝利 → 星級 → 解鎖
    page.evaluate("""() => {
        const s = window.__eal.session;
        s.score.score = 9000;
        for (const item of s.objectives.items) { item.done = true; item.progress = item.target; }
    }""")
    page.wait_for_timeout(800)
    won = page.evaluate("""() => {
        const save = JSON.parse(localStorage.getItem('eal_save'));
        return { state: window.__eal.session.state,
                 modal: !document.getElementById('modal-result').classList.contains('hidden'),
                 stars: save.levelStars['1'], unlocked: save.unlockedLevels };
    }""")
    assert won['state'] == 'won' and won['modal'] and won['unlocked'] == 2, won
    print('victory flow: OK, stars =', won['stars'])

    # Boss
    page.click('#btn-result-menu'); page.wait_for_timeout(300)
    page.evaluate("""() => {
        window.__eal.save.data.unlockedLevels = 12;
        window.__eal.save.save();
        window.__eal.startLevel(12);
    }""")
    page.wait_for_timeout(500)
    boss = page.evaluate("""() => {
        const s = window.__eal.session;
        const shown = !document.getElementById('boss-panel').classList.contains('hidden');
        s.boss.damage(9999, '測試');
        s.startResolution();
        return shown;
    }""")
    wait_stable(); page.wait_for_timeout(600)
    final = page.evaluate("() => window.__eal.session.state")
    assert boss and final == 'won', (boss, final)
    print('boss: OK')

    # ═══ 中途存檔：玩 3 塊 → 重新整理 → 繼續遊戲 → 狀態一致 ═══
    page.click('#btn-result-menu'); page.wait_for_timeout(300)
    page.evaluate("() => window.__eal.startLevel(3)")
    page.wait_for_timeout(500)
    for _ in range(3):
        page.keyboard.press('Space')
        wait_stable()
    before = page.evaluate("""() => {
        const s = window.__eal.session;
        return { score: s.score.score, locks: s.lockCount, level: s.levelDef.id,
                 next: s.queue.peek(3).map(p => p.shape.id),
                 cells: s.board.count(() => true) };
    }""")
    page.reload(); page.wait_for_load_state('networkidle'); page.wait_for_timeout(400)
    assert not page.locator('#btn-continue').evaluate("el => el.classList.contains('hidden')")
    page.click('#btn-continue'); page.wait_for_timeout(500)
    after = page.evaluate("""() => {
        const s = window.__eal.session;
        return { score: s.score.score, locks: s.lockCount, level: s.levelDef.id,
                 next: s.queue.peek(3).map(p => p.shape.id),
                 cells: s.board.count(() => true) };
    }""")
    assert after == before, (before, after)
    print('mid-game resume: OK', json.dumps(after))

    # 音樂開關不應報錯
    page.evaluate("() => window.__eal.setSetting('music', true)")
    page.wait_for_timeout(800)
    page.evaluate("() => window.__eal.setSetting('music', false)")
    print('music toggle: OK')

    browser.close()

print('CONSOLE ERRORS:', errors if errors else '(none)')
