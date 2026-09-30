import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Chess } from 'chess.js';
import type { Square as ChessSquare } from 'chess.js';
import { ChessiroBoard } from 'chessiro-canvas-native';
import type { ChessiroBoardRef, MoveAnimationPreset, Orientation, PromotionPiece, Square } from 'chessiro-canvas-native';

interface HarnessApi {
  setFen: (fen: string) => void;
  setOrientation: (o: Orientation) => void;
  setPreset: (p: MoveAnimationPreset) => void;
  board: () => ChessiroBoardRef | null;
  fen: () => string;
  log: string[];
}

declare global {
  interface Window {
    __cc: HarnessApi;
  }
}

function toDests(chess: Chess): Map<Square, Square[]> {
  const dests = new Map<Square, Square[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from as Square);
    if (list) list.push(m.to as Square);
    else dests.set(m.from as Square, [m.to as Square]);
  }
  return dests;
}

function App() {
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(chess.fen());
  const [orientation, setOrientation] = useState<Orientation>('white');
  const [preset, setPreset] = useState<MoveAnimationPreset>('playful');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const boardRef = useRef<ChessiroBoardRef>(null);
  const log = useRef<string[]>([]);

  const onMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      try {
        chess.move({ from: from as ChessSquare, to: to as ChessSquare, promotion });
      } catch {
        log.current.push(`rejected ${from}${to}`);
        return false;
      }
      log.current.push(`move ${from}${to}${promotion ?? ''}`);
      setFen(chess.fen());
      setLastMove({ from, to });
      return true;
    },
    [chess],
  );

  useEffect(() => {
    window.__cc = {
      setFen: (f) => {
        chess.load(f);
        setFen(chess.fen());
        setLastMove(null);
      },
      setOrientation,
      setPreset,
      board: () => boardRef.current,
      fen: () => chess.fen(),
      log: log.current,
    };
  }, [chess]);

  const dests = useMemo(() => toDests(chess), [chess, fen]);
  const turn = chess.turn();
  const inCheck = chess.inCheck();
  const kingSquare = inCheck
    ? (chess.board().flat().find((p) => p && p.type === 'k' && p.color === turn)?.square ?? null)
    : null;

  return (
    <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View testID="board-wrap" style={{ width: 480 }}>
        <ChessiroBoard
          ref={boardRef}
          testID="board"
          size={480}
          position={fen}
          orientation={orientation}
          turnColor={turn}
          movableColor={turn}
          dests={dests}
          onMove={onMove}
          lastMove={lastMove}
          check={kingSquare}
          moveAnimation={preset}
          arrows={[{ startSquare: 'g1', endSquare: 'f3', color: '' , brush: 'green' }]}
          markedSquares={['h7']}
          onPieceLift={(sq) => log.current.push(`lift ${sq}`)}
          onPieceDrop={(from, to, ok) => log.current.push(`drop ${from}${to ?? '-'} ${ok}`)}
        />
      </View>
      <Text style={{ color: '#ddd', marginTop: 12, fontFamily: 'monospace' }} testID="fen">
        {fen}
      </Text>
    </GestureHandlerRootView>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
