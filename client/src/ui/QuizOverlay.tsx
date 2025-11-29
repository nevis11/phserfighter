import { useEffect, useMemo, useState } from 'react';
import type Phaser from 'phaser';
import { CUSTOM_EVENTS, EventBus } from '../game/EventBus';
import { getQuizQuestion, Quiz } from '../game/services/quiz';
import { SCENE_KEYS } from '../game/scenes/scene-keys';

type Props = {
  getGame: () => Phaser.Game | null;
};

export default function QuizOverlay({ getGame }: Props) {
  const [visible, setVisible] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pauseGame = useMemo(() => {
    return () => {
      const game = getGame();
      const scene = game?.scene.getScene(SCENE_KEYS.GAME_SCENE as any);
      scene?.scene.pause();
    };
  }, [getGame]);

  const resumeGame = useMemo(() => {
    return () => {
      const game = getGame();
      const scene = game?.scene.getScene(SCENE_KEYS.GAME_SCENE as any);
      scene?.scene.resume();
    };
  }, [getGame]);

  useEffect(() => {
    const onShowQuiz = async () => {
      setVisible(true);
      setLoading(true);
      setMounted(false);
      pauseGame();
      try {
        const q = await getQuizQuestion();
        setQuiz(q);
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setMounted(true));
      }
    };

    EventBus.on(CUSTOM_EVENTS.SHOW_QUIZ, onShowQuiz);
    return () => {
      EventBus.off(CUSTOM_EVENTS.SHOW_QUIZ, onShowQuiz);
    };
  }, [pauseGame]);

  const answer = (index: number) => {
    if (!quiz) return;
    const correct = index === quiz.correctIndex;
    setVisible(false);
    setQuiz(null);
    resumeGame();
    EventBus.emit(CUSTOM_EVENTS.QUIZ_ANSWERED, { correct });
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100%',
          borderRadius: 14,
          padding: 2,
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(16,185,129,0.9), rgba(59,130,246,0.9))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.05)',
          transform: mounted ? 'scale(1)' : 'scale(0.98)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 180ms ease-out, opacity 200ms ease-out',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            background: 'radial-gradient(120% 120% at 0% 0%, #0b1220 0%, #0b1220 40%, #0a1120 100%)',
            border: '1px solid rgba(148,163,184,0.25)',
            color: '#e5e7eb',
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
                display: 'grid',
                placeItems: 'center',
                color: '#0b1220',
                fontWeight: 800,
              }}
            >
              ❓
            </div>
            <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: 13, letterSpacing: 0.3 }}>
              Answer to open the chest
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Press Start 2P, monospace', fontSize: 11, opacity: 0.8 }}>
              Loading...
            </div>
          ) : (
            quiz && (
              <div>
                <div
                  style={{
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: 12,
                    lineHeight: 1.75,
                    marginBottom: 16,
                    color: '#f8fafc',
                    textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  }}
                >
                  {quiz.question}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {quiz.options.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => answer(i)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(148,163,184,0.25)',
                        background:
                          'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))',
                        color: '#e5e7eb',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                        boxShadow: '0 6px 18px rgba(2,6,23,0.55)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget.style.transform = 'translateY(-1px)');
                        (e.currentTarget.style.boxShadow = '0 10px 24px rgba(2,6,23,0.6)');
                        (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.45)');
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget.style.transform = 'translateY(0)');
                        (e.currentTarget.style.boxShadow = '0 6px 18px rgba(2,6,23,0.55)');
                        (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)');
                      }}
                    >
                      {i + 1}. {o.text}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
