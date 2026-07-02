import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const CHAR_MAP = {
  monster: { name: '小怪兽', img: '/characters/monster.png' },
  rocker: { name: '摇滚客', img: '/characters/rocker.png' },
  gamer: { name: '电玩宅', img: '/characters/gamer.png' },
  surfer: { name: '冲浪仔', img: '/characters/surfer.png' },
  robot: { name: '机器人', img: '/characters/robot.png' },
  karate: { name: '空手道', img: '/characters/karate.png' },
};

const OPPONENT_CHAR = CHAR_MAP.robot;
const MAX_HP = 3;
const ARENA_W = 320; // px, matches CSS .arena inner width roughly
const ARENA_H = 220;
const AVATAR = 40;
const STEP = 24;
const HIT_DISTANCE = 90;

export default function Room() {
  const router = useRouter();
  const { code } = router.query;

  const [myChar, setMyChar] = useState('monster');
  const [myHp, setMyHp] = useState(MAX_HP);
  const [opHp, setOpHp] = useState(MAX_HP);
  const [myPos, setMyPos] = useState({ x: 20, y: ARENA_H - AVATAR - 20 });
  const [opPos, setOpPos] = useState({ x: ARENA_W - AVATAR - 20, y: 20 });
  const [pressed, setPressed] = useState(false);
  const [toast, setToast] = useState('');
  const [gameOver, setGameOver] = useState(null); // 'win' | 'lose' | null

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('myCharacter') : null;
    if (saved && CHAR_MAP[saved]) setMyChar(saved);
  }, []);

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(''), 1400);
  }

  function copyRoomCode() {
    if (!code) return;
    navigator.clipboard.writeText(String(code)).then(() => showToast('房间号已复制'));
  }

  function move(dx, dy) {
    if (gameOver) return;
    setMyPos((p) => ({
      x: Math.max(0, Math.min(ARENA_W - AVATAR, p.x + dx)),
      y: Math.max(0, Math.min(ARENA_H - AVATAR, p.y + dy)),
    }));
    // demo阶段：对手随机小幅走动，真联网后这里会换成读取对方的真实位置
    setOpPos((p) => ({
      x: Math.max(0, Math.min(ARENA_W - AVATAR, p.x + (Math.random() - 0.5) * 30)),
      y: Math.max(0, Math.min(ARENA_H - AVATAR, p.y + (Math.random() - 0.5) * 30)),
    }));
  }

  function fire() {
    if (gameOver) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);

    const dist = Math.hypot(myPos.x - opPos.x, myPos.y - opPos.y);
    const hit = dist < HIT_DISTANCE;

    if (hit) {
      showToast('命中对手！');
      setOpHp((h) => {
        const next = Math.max(0, h - 1);
        if (next === 0) setGameOver('win');
        return next;
      });
    } else {
      showToast('打空了，靠近点再试');
    }
  }

  function restart() {
    setMyHp(MAX_HP);
    setOpHp(MAX_HP);
    setMyPos({ x: 20, y: ARENA_H - AVATAR - 20 });
    setOpPos({ x: ARENA_W - AVATAR - 20, y: 20 });
    setGameOver(null);
  }

  const me = CHAR_MAP[myChar];

  return (
    <div className="page">
      <div className="status-bar">
        <span>房间号 {code}</span>
        <span onClick={copyRoomCode} style={{ cursor: 'pointer', color: '#ffe36a' }}>
          复制 ↗
        </span>
      </div>

      <div className="card">
        <div className="vs-wrap">
          <div className="player-block">
            <div className="avatar"><img src={me.img} alt={me.name} /></div>
            <div className="hp-stack">
              <div className="label-row"><span>你 · {me.name}</span><span>{myHp}/{MAX_HP}</span></div>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(myHp / MAX_HP) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="vs">VS</div>

          <div className="player-block enemy">
            <div className="avatar"><img src={OPPONENT_CHAR.img} alt={OPPONENT_CHAR.name} /></div>
            <div className="hp-stack">
              <div className="label-row"><span>{opHp}/{MAX_HP}</span><span>小明 · {OPPONENT_CHAR.name}</span></div>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(opHp / MAX_HP) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="arena">
        <div
          className="arena-avatar"
          style={{ left: myPos.x, top: myPos.y }}
        >
          <img src={me.img} alt={me.name} />
        </div>
        <div
          className="arena-avatar opponent"
          style={{ left: opPos.x, top: opPos.y }}
        >
          <img src={OPPONENT_CHAR.img} alt={OPPONENT_CHAR.name} />
        </div>
      </div>

      <div className="card">
        <div className="control-row">
          <div className="dpad">
            <button className="dpad-btn up" onClick={() => move(0, -STEP)}>▲</button>
            <button className="dpad-btn left" onClick={() => move(-STEP, 0)}>◀</button>
            <button className="dpad-btn right" onClick={() => move(STEP, 0)}>▶</button>
            <button className="dpad-btn down" onClick={() => move(0, STEP)}>▼</button>
          </div>

          <div
            className={`fire-btn ${pressed ? 'pressed' : ''}`}
            onClick={fire}
          >
            🎯
          </div>
        </div>
      </div>

      {toast && <div className="floating-toast show">{toast}</div>}

      {gameOver && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 40 }}>{gameOver === 'win' ? '👑' : '☠'}</div>
            <div className={`result-title ${gameOver === 'win' ? 'win' : 'lose'}`}>
              {gameOver === 'win' ? '胜利' : '失败'}
            </div>
            <div className="btn-row">
              <button className="btn blue" onClick={restart}>再来一局</button>
              <button className="btn yellow" onClick={() => router.push('/')}>返回大厅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
