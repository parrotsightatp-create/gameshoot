import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const CHAR_MAP = {
  monster: { name: '小怪兽', img: '/characters/monster.png' },
  rocker: { name: '摇滚客', img: '/characters/rocker.png' },
  gamer: { name: '电玩宅', img: '/characters/gamer.png' },
  surfer: { name: '冲浪仔', img: '/characters/surfer.png' },
  robot: { name: '机器人', img: '/characters/robot.png' },
  karate: { name: '空手道', img: '/characters/karate.png' },
};

const MAX_HP = 3;
const ARENA_W = 320;
const ARENA_H = 220;
const AVATAR = 44;
const GROUND_Y = 0; // y = 高度，0代表站在地面上
const MAX_HEIGHT = ARENA_H - AVATAR - 10;

const GRAVITY = -1.4;
const THRUST = 1.8;
const MAX_RISE = 6;
const MAX_FALL = -10;
const MOVE_SPEED = 5;

const HIT_RANGE_X = 90;
const HIT_RANGE_Y = 40;

const HOST_START_X = 30;
const GUEST_START_X = ARENA_W - AVATAR - 30;

const TICK_MS = 33;
const BROADCAST_EVERY_N_TICKS = 3; // 节流：每3帧才广播一次位置，减少网络压力

export default function Room() {
  const router = useRouter();
  const { code, host, char } = router.query;
  const isHost = host === '1';

  const [hostChar, setHostChar] = useState(null);
  const [guestChar, setGuestChar] = useState(null);
  const [myHp, setMyHp] = useState(MAX_HP);
  const [opHp, setOpHp] = useState(MAX_HP);
  const [myX, setMyX] = useState(isHost ? HOST_START_X : GUEST_START_X);
  const [myY, setMyY] = useState(GROUND_Y);
  const [myFacing, setMyFacing] = useState(isHost ? 'right' : 'left');
  const [opX, setOpX] = useState(isHost ? GUEST_START_X : HOST_START_X);
  const [opY, setOpY] = useState(GROUND_Y);
  const [opFacing, setOpFacing] = useState(isHost ? 'left' : 'right');
  const [pressed, setPressed] = useState(false);
  const [toast, setToast] = useState('');
  const [gameOver, setGameOver] = useState(null);
  const [bullets, setBullets] = useState([]);

  const channelRef = useRef(null);
  const stateRef = useRef({ x: myX, y: GROUND_Y, vy: 0, facing: myFacing });
  const inputRef = useRef({ left: false, right: false, thrust: false });
  const tickCountRef = useRef(0);
  const opStateRef = useRef({ x: opX, y: opY });
  opStateRef.current = { x: opX, y: opY };

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(''), 1400);
  }

  // 房间信息监听
  useEffect(() => {
    if (!code) return;

    supabase.from('rooms').select('*').eq('code', code).single().then(({ data }) => {
      if (data) {
        setHostChar(data.host_char);
        setGuestChar(data.guest_char);
      }
    });

    const dbSub = supabase
      .channel(`room-db-${code}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          setHostChar(payload.new.host_char);
          if (payload.new.guest_char && !guestChar) showToast('对方已加入');
          setGuestChar(payload.new.guest_char);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(dbSub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 联网对战频道
  useEffect(() => {
    if (!code) return;

    const gameChannel = supabase.channel(`room-game-${code}`, {
      config: { broadcast: { self: false } },
    });

    gameChannel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        setOpX(payload.x);
        setOpY(payload.y);
        setOpFacing(payload.facing);
      })
      .on('broadcast', { event: 'hit' }, () => {
        setMyHp((h) => {
          const next = Math.max(0, h - 1);
          gameChannel.send({ type: 'broadcast', event: 'hpUpdate', payload: { hp: next } });
          if (next === 0) setGameOver('lose');
          return next;
        });
        showToast('你被击中了');
      })
      .on('broadcast', { event: 'hpUpdate' }, ({ payload }) => {
        setOpHp(payload.hp);
        if (payload.hp === 0) setGameOver('win');
      })
      .on('broadcast', { event: 'fire' }, ({ payload }) => {
        spawnBullet(payload.x, payload.y, payload.facing, false);
      })
      .subscribe();

    channelRef.current = gameChannel;
    return () => supabase.removeChannel(gameChannel);
  }, [code]);

  // 物理引擎循环：跑动 + 喷气背包 + 重力
  useEffect(() => {
    const timer = setInterval(() => {
      if (gameOver) return;
      const s = stateRef.current;
      const input = inputRef.current;

      // 水平移动
      if (input.left) {
        s.x = Math.max(0, s.x - MOVE_SPEED);
        s.facing = 'left';
      }
      if (input.right) {
        s.x = Math.min(ARENA_W - AVATAR, s.x + MOVE_SPEED);
        s.facing = 'right';
      }

      // 垂直：喷气背包推力 or 重力
      s.vy += input.thrust ? THRUST : GRAVITY;
      s.vy = Math.max(MAX_FALL, Math.min(MAX_RISE, s.vy));
      s.y = Math.max(GROUND_Y, Math.min(MAX_HEIGHT, s.y + s.vy));
      if (s.y <= GROUND_Y) {
        s.y = GROUND_Y;
        s.vy = 0;
      }

      setMyX(s.x);
      setMyY(s.y);
      setMyFacing(s.facing);

      tickCountRef.current += 1;
      if (tickCountRef.current % BROADCAST_EVERY_N_TICKS === 0) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'move',
          payload: { x: s.x, y: s.y, facing: s.facing },
        });
      }
    }, TICK_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  function setInput(key, value) {
    inputRef.current[key] = value;
  }

  function spawnBullet(x, y, facing, mine) {
    const id = `${Date.now()}-${Math.random()}`;
    setBullets((list) => [...list, { id, x, y, facing, mine }]);
    setTimeout(() => {
      setBullets((list) => list.filter((b) => b.id !== id));
    }, 500);
  }

  function fire() {
    if (gameOver) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);

    const s = stateRef.current;
    const op = opStateRef.current;
    const dx = op.x - s.x;
    const dy = Math.abs(op.y - s.y);
    const facingCorrect = (s.facing === 'right' && dx > 0) || (s.facing === 'left' && dx < 0);
    const inRange = Math.abs(dx) < HIT_RANGE_X && dy < HIT_RANGE_Y;

    spawnBullet(s.x, s.y, s.facing, true);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'fire',
      payload: { x: s.x, y: s.y, facing: s.facing },
    });

    if (facingCorrect && inRange) {
      showToast('命中对手！');
      channelRef.current?.send({ type: 'broadcast', event: 'hit', payload: {} });
    } else {
      showToast('打空了');
    }
  }

  function copyRoomCode() {
    if (!code) return;
    navigator.clipboard.writeText(String(code)).then(() => showToast('房间号已复制'));
  }

  const myCharId = char || (isHost ? hostChar : guestChar);
  const opCharId = isHost ? guestChar : hostChar;
  const me = CHAR_MAP[myCharId] || CHAR_MAP.monster;
  const opponent = opCharId ? CHAR_MAP[opCharId] : null;
  const waitingForOpponent = isHost && !guestChar;

  if (waitingForOpponent) {
    return (
      <div className="page">
        <div className="card room-card">
          <div className="room-small">房间号</div>
          <div className="room-num">{code}</div>
          <button className="btn blue" onClick={copyRoomCode}>复制房间号</button>
        </div>
        <div className="card" style={{ textAlign: 'center', color: '#b9a7ff' }}>
          等待对方加入…把房间号发给朋友
        </div>
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', color: '#b9a7ff' }}>
          正在连接房间…
        </div>
      </div>
    );
  }

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
            <div className="avatar"><img src={opponent.img} alt={opponent.name} /></div>
            <div className="hp-stack">
              <div className="label-row"><span>{opHp}/{MAX_HP}</span><span>对手 · {opponent.name}</span></div>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(opHp / MAX_HP) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="arena side-arena">
        <div className="ground-line" />
        <div
          className="arena-avatar"
          style={{
            left: myX,
            bottom: myY,
            top: 'auto',
            transform: myFacing === 'left' ? 'scaleX(-1)' : 'none',
          }}
        >
          <img src={me.img} alt={me.name} />
        </div>
        <div
          className="arena-avatar opponent"
          style={{
            left: opX,
            bottom: opY,
            top: 'auto',
            transform: opFacing === 'left' ? 'scaleX(-1)' : 'none',
          }}
        >
          <img src={opponent.img} alt={opponent.name} />
        </div>

        {bullets.map((b) => (
          <div
            key={b.id}
            className={`bullet ${b.facing === 'left' ? 'bullet-left' : 'bullet-right'}`}
            style={{
              left: b.x + AVATAR / 2,
              bottom: b.y + AVATAR / 2,
            }}
          />
        ))}
      </div>

      <div className="card">
        <div className="control-row">
          <div className="side-controls">
            <button
              className="dpad-btn"
              style={{ position: 'static' }}
              onPointerDown={() => setInput('left', true)}
              onPointerUp={() => setInput('left', false)}
              onPointerLeave={() => setInput('left', false)}
            >
              ◀
            </button>
            <button
              className="dpad-btn"
              style={{ position: 'static' }}
              onPointerDown={() => setInput('right', true)}
              onPointerUp={() => setInput('right', false)}
              onPointerLeave={() => setInput('right', false)}
            >
              ▶
            </button>
            <button
              className="dpad-btn jetpack-btn"
              style={{ position: 'static' }}
              onPointerDown={() => setInput('thrust', true)}
              onPointerUp={() => setInput('thrust', false)}
              onPointerLeave={() => setInput('thrust', false)}
            >
              🚀
            </button>
          </div>

          <div className={`fire-btn ${pressed ? 'pressed' : ''}`} onClick={fire}>
            🎯
          </div>
        </div>
        <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          左右移动，按住🚀上升，松开下降
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
              <button className="btn yellow" onClick={() => router.push('/')}>返回大厅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
