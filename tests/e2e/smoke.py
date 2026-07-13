# -*- coding: utf-8 -*-
"""Smoke e2e：選單→教學→隨機遊玩→暫停/重開→存檔→無限模式。
用法：先 npm run dev（或設 EAL_URL），再 python tests/e2e/smoke.py
"""
import sys, io, json, os, random, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

URL = os.environ.get('EAL_URL', 'http://localhost:5199')
OUT = pathlib.Path(__file__).parent / 'artifacts'
OUT.mkdir(exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))

    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.evaluate("localStorage.clear()")
    page.reload(); page.wait_for_load_state('networkidle'); page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / 'smoke_menu.png'))

    page.click('#btn-start'); page.wait_for_timeout(500)
    assert page.locator('#screen-game').evaluate("el => el.classList.contains('active')")
    assert not page.locator('#tutorial-overlay').evaluate("el => el.classList.contains('hidden')")

    # 教學前四步
    for key in ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Space']:
        page.keyboard.press(key); page.wait_for_timeout(250)
    print('tutorial:', page.locator('#tutorial-text').inner_text()[:50].replace('\n', ' '))
    page.locator('#btn-tut-skip').click(); page.wait_for_timeout(200)

    # 隨機遊玩 40 塊
    random.seed(1234)
    for i in range(40):
        for _ in range(random.randint(0, 4)):
            page.keyboard.press(random.choice(['ArrowLeft', 'ArrowRight']))
        if random.random() < 0.5:
            page.keyboard.press('ArrowUp')
        page.keyboard.press('Space')
        for _ in range(30):
            st = page.evaluate("() => window.__eal.session ? window.__eal.session.state : 'none'")
            if st in ('falling', 'over', 'won'):
                break
            page.wait_for_timeout(120)
        if st in ('over', 'won'):
            print(f'ended at piece {i}: {st}')
            break

    info = page.evaluate("""() => {
        const s = window.__eal.session;
        return { state: s.state, score: s.score.score, lines: s.stats.lines,
                 reactions: s.stats.reactions, maxChain: s.maxChain, locks: s.lockCount,
                 energy: Math.round(s.energy) };
    }""")
    print('random-40:', json.dumps(info))
    page.screenshot(path=str(OUT / 'smoke_playing.png'))

    # 暫停凍結
    if info['state'] == 'falling':
        page.keyboard.press('p'); page.wait_for_timeout(200)
        s1 = page.evaluate("() => window.__eal.session.score.score")
        page.wait_for_timeout(1000)
        s2 = page.evaluate("() => window.__eal.session.score.score")
        assert s1 == s2, 'pause must freeze score'
        page.click('#btn-restart'); page.wait_for_timeout(400)
        assert page.evaluate("() => window.__eal.session.score.score") == 0
        print('pause freeze + restart reset: OK')

    save = page.evaluate("() => JSON.parse(localStorage.getItem('eal_save') || 'null')")
    assert save is not None
    print('save discovered reactions:', list(save['discoveredReactions'].keys()))
    assert 'first_reaction' in save.get('achievements', {}), 'achievement should unlock'
    print('achievement first_reaction: OK')

    # 無限模式
    page.keyboard.press('p'); page.wait_for_timeout(200)
    page.click('#btn-quit'); page.wait_for_timeout(300)
    page.click('#btn-endless'); page.wait_for_timeout(300)
    assert page.evaluate("() => window.__eal.session.mode") == 'endless'
    print('endless: OK')

    browser.close()

print('CONSOLE ERRORS:', errors if errors else '(none)')
