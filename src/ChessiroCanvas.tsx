import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { ChessiroCanvasProps, ChessiroCanvasRef, BoardTheme } from './types';
import { INITIAL_FEN, readFen } from './utils/fen';
import { useBoardSize } from './hooks/useBoardSize';
import { useInteraction } from './interaction/useInteraction';
import { useKeyboard } from './interaction/useKeyboard';
import { Squares } from './render/Squares';
import { PiecesLayer } from './render/Pieces';
import { ArrowsLayer } from './render/Arrows';
import { Notation } from './render/Notation';
import { PromotionDialog } from './render/Promotion';
import { DragGhost } from './render/DragGhost';
import { Badge } from './render/Badge';
import { OverlaysLayer } from './render/Overlays';

const DEFAULT_THEME: BoardTheme = {
  id: 'Chessiro',
  name: 'Chessiro',
  darkSquare: '#785E45',
  lightSquare: '#DFC29A',
  margin: '#66503B',
  lastMoveHighlight: '#DFAA4E',
  selectedPiece: '#B57340',
};

export const ChessiroCanvas = forwardRef<ChessiroCanvasRef, ChessiroCanvasProps>(
  function ChessiroCanvas(props, ref) {
    const {
      position = INITIAL_FEN,
      orientation = 'white',
      interactive = true,
      turnColor,
      movableColor,
      onMove,
      lastMove,
      dests,
      premovable,
      arrows = [],
      onArrowsChange,
      arrowBrushes,
      snapArrowsToValidMoves = true,
      markedSquares,
      onMarkedSquaresChange,
      plyIndex,
      plyArrows,
      onPlyArrowsChange,
      plyMarks,
      onPlyMarksChange,
      theme = DEFAULT_THEME,
      pieceSet,
      showMargin = true,
      marginThickness = 24,
      showNotation = true,
      highlightedSquares = {},
      check,
      moveQualityBadge,
      allowDragging = true,
      allowDrawingArrows = true,
      animationDurationMs = 200,
      showAnimations = true,
      blockTouchScroll = false,
      onPrevious,
      onNext,
      onFirst,
      onLast,
      onFlipBoard,
      onShowThreat,
      onDeselect,
      onSquareClick,
      onClearOverlays,
      overlays = [],
      overlayRenderer,
      pieces: customPieces,
      className,
      style,
    } = props;

    const boardRef = useRef<HTMLDivElement>(null);
    const { bounds } = useBoardSize(boardRef);

    const occupiedSquares = useMemo(() => {
      const set = new Set<string>();
      const p = readFen(position || INITIAL_FEN);
      for (const sq of p.keys()) set.add(sq);
      return set;
    }, [position]);

    const boardDomRect = useMemo(() => {
      if (!bounds) return null;
      return {
        left: bounds.left, top: bounds.top,
        width: bounds.width, height: bounds.height,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height,
        x: bounds.left, y: bounds.top,
        toJSON: () => ({}),
      } as DOMRect;
    }, [bounds]);

    const interaction = useInteraction({
      position,
      orientation,
      interactive,
      allowDragging,
      allowDrawingArrows,
      boardRef,
      boardBounds: boardDomRect,
      onMove,
      dests,
      turnColor,
      movableColor,
      premovable,
      arrows,
      onArrowsChange,
      arrowBrushes,
      snapArrowsToValidMoves,
      markedSquares,
      onMarkedSquaresChange,
      plyIndex,
      plyArrows,
      onPlyArrowsChange,
      plyMarks,
      onPlyMarksChange,
      onSquareClick,
      onClearOverlays,
      blockTouchScroll,
    });

    useKeyboard({
      onPrevious,
      onNext,
      onFirst,
      onLast,
      onFlipBoard,
      onShowThreat,
      onDeselect,
    });

    useImperativeHandle(ref, () => ({
      getSquareRect(square: string) {
        if (!bounds) return null;
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;
        const asWhite = orientation === 'white';
        const col = asWhite ? file : 7 - file;
        const row = asWhite ? 7 - rank : rank;
        const sqW = bounds.width / 8;
        const sqH = bounds.height / 8;
        return new DOMRect(bounds.left + col * sqW, bounds.top + row * sqH, sqW, sqH);
      },
      getBoardRect() {
        return boardRef.current?.getBoundingClientRect() ?? null;
      },
    }), [bounds, orientation]);

    const hasValidSize = bounds && bounds.width > 0;
    const boardWidth = bounds?.width ?? 0;
    const boardHeight = bounds?.height ?? 0;
    const squareSize = boardWidth / 8;
    const marginSize = showMargin && showNotation ? marginThickness : 0;

    // Cursor: grab when hovering pieces, grabbing while dragging
    const isDragging = !!interaction.drag;
    const cursor = !interactive ? 'default' : isDragging ? 'grabbing' : 'grab';

    return (
      <div
        className={className}
        style={{
          position: 'relative',
          padding: marginSize,
          ...style,
        }}
        tabIndex={-1}
      >
        <div
          ref={boardRef}
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '100%',
            overflow: 'visible',
            cursor,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: blockTouchScroll ? 'none' : undefined,
          }}
          onMouseDown={interaction.handlePointerDown as any}
          onTouchStart={interaction.handlePointerDown as any}
        >
          {hasValidSize && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <Squares
                theme={theme}
                orientation={orientation}
                lastMove={lastMove}
                selectedSquare={interaction.selectedSquare}
                legalSquares={interaction.legalSquares}
                premoveSquares={interaction.premoveSquares}
                premoveCurrent={interaction.premoveCurrent}
                occupiedSquares={occupiedSquares}
                markedSquares={interaction.activeMarkedSquares}
                highlightedSquares={highlightedSquares}
                check={check}
              />

              <PiecesLayer
                position={position}
                orientation={orientation}
                pieceSet={pieceSet}
                customPieces={customPieces}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                animationDurationMs={showAnimations ? animationDurationMs : 0}
                showAnimations={showAnimations}
                draggingSquare={interaction.drag?.origSquare}
              />

              <ArrowsLayer
                arrows={interaction.renderedArrows}
                orientation={orientation}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
              />

              {moveQualityBadge && (
                <Badge
                  badge={moveQualityBadge}
                  orientation={orientation}
                  squareSize={squareSize}
                />
              )}

              {showNotation && (
                <Notation
                  orientation={orientation}
                  theme={theme}
                  showOnMargin={showMargin}
                  marginThickness={marginThickness}
                />
              )}

              {overlays.length > 0 && (
                <OverlaysLayer
                  overlays={overlays}
                  orientation={orientation}
                  boardWidth={boardWidth}
                  boardHeight={boardHeight}
                  renderer={overlayRenderer}
                />
              )}

              {interaction.pendingPromotion && (
                <PromotionDialog
                  promotion={interaction.pendingPromotion}
                  pieceSet={pieceSet}
                  onSelect={interaction.handlePromotionSelect}
                  onDismiss={interaction.handlePromotionDismiss}
                />
              )}
            </div>
          )}
        </div>

        {interaction.drag && (
          <DragGhost
            piece={interaction.drag.piece}
            x={interaction.drag.currentPos[0]}
            y={interaction.drag.currentPos[1]}
            squareSize={squareSize}
            pieceSet={pieceSet}
            customPieces={customPieces}
          />
        )}
      </div>
    );
  },
);
