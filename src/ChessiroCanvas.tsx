import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
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

const EMPTY_ARRAY: any[] = [];
const EMPTY_OBJECT: any = {};

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
      arrows = EMPTY_ARRAY,
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
      highlightedSquares = EMPTY_OBJECT,
      squareVisuals,
      arrowVisuals,
      notationVisuals,
      promotionVisuals,
      overlayVisuals,
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
      overlays = EMPTY_ARRAY,
      overlayRenderer,
      pieces: customPieces,
      className,
      style,
    } = props;

    const boardRef = useRef<HTMLDivElement>(null);
    const { bounds } = useBoardSize(boardRef);

    const piecesMap = useMemo(() => readFen(position || INITIAL_FEN), [position]);

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
      pieces: piecesMap,
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

    const occupiedSquares = useMemo(() => {
      if (interaction.legalSquares.length === 0 && interaction.premoveSquares.length === 0) {
        return undefined;
      }
      const set = new Set<string>();
      for (const sq of piecesMap.keys()) set.add(sq);
      return set;
    }, [piecesMap, interaction.legalSquares, interaction.premoveSquares]);

    const handleDeselect = useCallback(() => {
      interaction.clearSelection();
      onDeselect?.();
    }, [interaction.clearSelection, onDeselect]);

    useKeyboard({
      onPrevious,
      onNext,
      onFirst,
      onLast,
      onFlipBoard,
      onShowThreat,
      onDeselect: handleDeselect,
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

    // Cursor: grab when hovering pieces, grabbing while dragging
    const isDragging = !!interaction.drag;
    const cursor = !interactive ? 'default' : isDragging ? 'grabbing' : allowDragging ? 'grab' : 'pointer';

    const marginPx = showMargin ? marginThickness : 0;

    return (
      <div
        className={className}
        style={{
          position: 'relative',
          ...style,
        }}
        tabIndex={-1}
      >
        {/* Margin frame */}
        {marginPx > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: theme.margin || theme.darkSquare,
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            position: 'relative',
            padding: marginPx,
          }}
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
                  draggingSquare={interaction.drag?.origSquare}
                  legalSquares={interaction.legalSquares}
                  premoveSquares={interaction.premoveSquares}
                  premoveCurrent={interaction.premoveCurrent}
                  occupiedSquares={occupiedSquares}
                  markedSquares={interaction.activeMarkedSquares}
                  highlightedSquares={highlightedSquares}
                  squareVisuals={squareVisuals}
                  check={check}
                />

                <PiecesLayer
                  position={position}
                  pieces={piecesMap}
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
                  visuals={arrowVisuals}
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
                    visuals={notationVisuals}
                  />
                )}

                {overlays.length > 0 && (
                  <OverlaysLayer
                    overlays={overlays}
                    orientation={orientation}
                    boardWidth={boardWidth}
                    boardHeight={boardHeight}
                    renderer={overlayRenderer}
                    visuals={overlayVisuals}
                  />
                )}

                {interaction.pendingPromotion && (
                  <PromotionDialog
                    promotion={interaction.pendingPromotion}
                    pieceSet={pieceSet}
                    visuals={promotionVisuals}
                    onSelect={interaction.handlePromotionSelect}
                    onDismiss={interaction.handlePromotionDismiss}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {interaction.drag && (
          <DragGhost
            ref={interaction.dragGhostRef}
            piece={interaction.drag.piece}
            x={interaction.drag.startPos[0]}
            y={interaction.drag.startPos[1]}
            squareSize={squareSize}
            pieceSet={pieceSet}
            customPieces={customPieces}
          />
        )}
      </div>
    );
  },
);
