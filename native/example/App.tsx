// A playable board wired to chess.js — drop this into an Expo app
// (`npx expo install react-native-reanimated react-native-gesture-handler react-native-svg`,
// `npm i chess.js chessiro-canvas-native`).
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Chess } from 'chess.js';
import type { Square as ChessSquare } from 'chess.js';
import { ChessiroBoard } from 'chessiro-canvas-native';
import type {
  ChessiroBoardRef,
  Dests,
  MoveAnimationPreset,
  Orientation,
  PromotionPiece,
  Square,
} from 'chessiro-canvas-native';
// import * as Haptics from 'expo-haptics';

const PRESETS: MoveAnimationPreset[] = ['classic', 'snappy', 'smooth', 'playful', 'arcade', 'elegant'];

function legalDests(chess: Chess): Dests {
  const dests: Dests = new Map();
  for (const m of chess.moves({ verbose: true })) {
    const from = m.from as Square;
    const list = dests.get(from);
    if (list) list.push(m.to as Square);
    else dests.set(from, [m.to as Square]);
  }
  return dests;
}

function kingInCheck(chess: Chess): Square | null {
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  for (const row of chess.board()) {
    for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square as Square;
  }
  return null;
}

export default function App() {
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('white');
  const [preset, setPreset] = useState<MoveAnimationPreset>('playful');
  const board = useRef<ChessiroBoardRef>(null);

  // Recomputed per position only; the board treats `dests` as immutable.
  const dests = useMemo(() => legalDests(chess), [chess, fen]);

  const onMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      try {
        chess.move({ from: from as ChessSquare, to: to as ChessSquare, promotion });
      } catch {
        return false; // the board snaps the piece back
      }
      setFen(chess.fen());
      setLastMove({ from, to });
      return true;
    },
    [chess],
  );

  const onPieceLift = useCallback(() => {
    // void Haptics.selectionAsync();
  }, []);
  const onPieceDrop = useCallback((_from: string, _to: string | null, accepted: boolean) => {
    // void Haptics.impactAsync(accepted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Rigid);
    void accepted;
  }, []);

  const undo = () => {
    const m = chess.undo();
    if (!m) return;
    setFen(chess.fen());
    const history = chess.history({ verbose: true });
    const prev = history[history.length - 1];
    setLastMove(prev ? { from: prev.from, to: prev.to } : null);
  };
  const reset = () => {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
  };

  return (
    // Gesture Handler needs a root view once per app (usually in your root layout).
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <ChessiroBoard
          ref={board}
          position={fen}
          orientation={orientation}
          turnColor={chess.turn()}
          dests={dests}
          onMove={onMove}
          lastMove={lastMove}
          check={kingInCheck(chess)}
          moveAnimation={preset}
          onPieceLift={onPieceLift}
          onPieceDrop={onPieceDrop}
        />
        <View style={styles.row}>
          <Button label="Undo" onPress={undo} />
          <Button label="Flip" onPress={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
          <Button label="New game" onPress={reset} />
          <Button label="Hint" onPress={() => void board.current?.pulseSquare(chess.moves({ verbose: true })[0]?.from ?? 'e2')} />
        </View>
        <View style={styles.row}>
          {PRESETS.map((p) => (
            <Button key={p} label={p} active={p === preset} onPress={() => setPreset(p)} />
          ))}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function Button({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, active && styles.buttonActive]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e1e22' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#33333a' },
  buttonActive: { backgroundColor: '#B57340' },
  buttonText: { color: '#eee', fontWeight: '600' },
});
