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
const AVATAR = 40;
const STEP = 24;
const HIT_DISTANCE = 90;

const HOST_START = { x: 20, y: ARENA_H - AVATAR - 20 };
const GUEST_START = { x: ARENA_W - AVATAR - 20, y: 20 };

export default function Room() {
  const router = useRouter();
  const { code, host, char } = router.query;
  const isHost = host === '1';

  const [hostChar, setHostChar] = useState(null);
  const [guestChar, setGuestChar] = useState(null);
  const [myHp, setMyHp] = useState(MAX_HP);
  const [opHp, setOpHp] = useState(MAX_HP);
  const [myPos, setMyPos] = useState(isHost ? HOST_START : GUEST_START);
  const [opPos, setOpPos] = useState(isHost ? GUEST_START : HOST_START);
  const [pressed, setPressed] = useState(false);
  const [toast, setToast] = useState('');
  const [gameOver, setGameOver] = useState(null);

  const channelRef = useRef(null);
  const myPosRef = useRef(myPos);
  const opPosRef = useRef(opPos);
  myPosRef.current = myPos;
  opPosRef.current = opPos;

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(''), 1400);
  }

  // 监听房间数据（谁加入了、双方选了什么角色）
  useEffect(() => {
    if (!code) return;

    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
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
          if (payload.new.guest_char && !guestChar) {
            showToast('对方已加入');
          }
          setGuestChar(payload.new.guest_char);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dbSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 实时对战频道：同步移动、开火、血量
  useEffect(() => {
    if (!code) return;

    const gameChannel = supabase.channel(`room-game-${code}`, {
      config: { broadcast: { self: false } },
    });

    gameChannel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        setOpPos(payload.pos);
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
      .subscribe();

    channelRef.current = gameChannel;

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [code]);

  function move(dx, dy) {
    if (gameOver) return;
    setMyPos((p) => {
      const next = {
        x: Math.max(0, Math.min(ARENA_W - AVATAR, p.x + dx)),
        y: Math.max(0, Math.min(ARENA_H - AVATAR, p.y + dy)),
      };
      channelRef.current?.send({ type: 'broadcast', event: 'move', payload: { pos: next } });
      return next;
    });
  }

  function fire() {
    if (gameOver) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);

    const dist = Math.hypot(myPosRef.current.x - opPosRef.current.x, myPosRef.current.y - opPosRef.current.y);
    if (dist < HIT_DISTANCE) {
      showToast('命中对手！');
      channelRef.current?.send({ type: 'broadcast', event: 'hit', payload: {} });
    } else {
      showToast('打空了，靠近点再试');
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

      <div className="arena">
        <div className="arena-avatar" style={{ left: myPos.x, top: myPos.y }}>
          <img src={me.img} alt={me.name} />
        </div>
        <div className="arena-avatar opponent" style={{ left: opPos.x, top: opPos.y }}>
          <img src={opponent.img} alt={opponent.name} />
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

          <div className={`fire-btn ${pressed ? 'pressed' : ''}`} onClick={fire}>
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
              <button className="btn yellow" onClick={() => router.push('/')}>返回大厅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
