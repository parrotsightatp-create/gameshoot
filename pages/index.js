import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const CHARACTERS = [
  { id: 'monster', name: '小怪兽', img: '/characters/monster.png' },
  { id: 'rocker', name: '摇滚客', img: '/characters/rocker.png' },
  { id: 'gamer', name: '电玩宅', img: '/characters/gamer.png' },
  { id: 'surfer', name: '冲浪仔', img: '/characters/surfer.png' },
  { id: 'robot', name: '机器人', img: '/characters/robot.png' },
  { id: 'karate', name: '空手道', img: '/characters/karate.png' },
];

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState('monster');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    const code = makeRoomCode();
    const { error } = await supabase.from('rooms').insert({
      code,
      host_char: selected,
      guest_char: null,
    });
    setBusy(false);
    if (error) {
      setJoinError('创建房间失败，请重试');
      return;
    }
    router.push(`/room/${code}?host=1&char=${selected}`);
  }

  async function handleJoin() {
    if (!joinCode || joinCode.length < 4) return;
    setBusy(true);
    setJoinError('');

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode)
      .single();

    if (error || !data) {
      setBusy(false);
      setJoinError('房间不存在，请检查房间号');
      return;
    }

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ guest_char: selected })
      .eq('code', joinCode);

    setBusy(false);
    if (updateError) {
      setJoinError('加入房间失败，请重试');
      return;
    }

    router.push(`/room/${joinCode}?char=${selected}`);
  }

  return (
    <div className="page">
      <div className="card">
        <div className="title">对战竞技场</div>
        <div className="subtitle">选一个角色，创建房间或输入房间号加入朋友</div>

        <div className="char-grid">
          {CHARACTERS.map((c) => (
            <div
              key={c.id}
              className={`char-cell ${selected === c.id ? 'selected' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              <div className="char-avatar">
                <img src={c.img} alt={c.name} />
              </div>
              <span className="char-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="title" style={{ fontSize: 15 }}>创建新房间</div>
        <button className="btn blue" onClick={handleCreate} disabled={busy}>
          创建房间
        </button>
      </div>

      <div className="card">
        <div className="title" style={{ fontSize: 15 }}>加入朋友的房间</div>
        <input
          className="input"
          placeholder="输入房间号"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
        />
        {joinError && (
          <div style={{ color: '#ff9b9b', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>
            {joinError}
          </div>
        )}
        <button className="btn yellow" onClick={handleJoin} disabled={busy}>
          加入房间
        </button>
      </div>
    </div>
  );
}
