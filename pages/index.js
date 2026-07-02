import { useState } from 'react';
import { useRouter } from 'next/router';

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
  const [selected, setSelected] = useState('bolt');
  const [joinCode, setJoinCode] = useState('');

  function handleCreate() {
    const code = makeRoomCode();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('myCharacter', selected);
    }
    router.push(`/room/${code}?host=1`);
  }

  function handleJoin() {
    if (!joinCode || joinCode.length < 4) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('myCharacter', selected);
    }
    router.push(`/room/${joinCode}`);
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
        <button className="btn blue" onClick={handleCreate}>创建房间</button>
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
        <button className="btn yellow" onClick={handleJoin}>加入房间</button>
      </div>
    </div>
  );
}
