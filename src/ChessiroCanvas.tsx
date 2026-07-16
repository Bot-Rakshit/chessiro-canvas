import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type {
  ChessiroCanvasProps, ChessiroCanvasRef, BoardTheme,
  AnimateMoveOptions, PulseSquareOptions, PromotionPiece, Square,
  CameraController, CameraDriftOptions, CameraShakeOptions, CameraTiltOptions, CameraZoomOptions,
  CelebrateOptions, CinematicMoveOptions, CinematicPlayback, CinematicStep,
  PlayCinematicOptions, PopBadgeOptions, PopBannerOptions, SquareBurstOptions,
} from './types';
import { INITIAL_FEN, readFen } from './utils/fen';
import { screenPos2square } from './utils/coords';
import { useBoardSize } from './hooks/useBoardSize';
import { useInteraction } from './interaction/useInteraction';
import { useKeyboard } from './interaction/useKeyboard';
import { Squares } from './render/Squares';
import { PiecesLayer, type PiecesLayerRef } from './render/Pieces';
import { GhostPiecesLayer } from './render/GhostPieces';
import { SquareLabelsLayer } from './render/SquareLabels';
import { TeachingLayer, type TeachingLayerRef } from './render/TeachingLayer';
import { CinematicLayer, type CinematicLayerRef } from './render/CinematicLayer';
import { createCameraController } from './cinematics/camera';
import { playCinematicScript } from './cinematics/director';
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

function hasActiveRadius(radius: string | number): boolean {
  if (typeof radius === 'number') return radius > 0;
  const trimmed = radius.trim();
  if (trimmed.length === 0) return false;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isFinite(parsed)) return parsed > 0;
  return true;
}

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
      autoPromoteTo,
      expectedMove,
      onWrongMove,
      wrongMoveFeedback = 'shake',
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
      flipPieces = false,
      showMargin = true,
      marginThickness = 24,
      marginRadius = 4,
      boardRadius = 0,
      showNotation = true,
      highlightedSquares = EMPTY_OBJECT,
      squareVisuals,
      arrowVisuals,
      notationVisuals,
      promotionVisuals,
      overlayVisuals,
      check,
      moveQualityBadge,
      ghostPieces = EMPTY_ARRAY,
      squareLabels,
      allowDragging = true,
      allowDrawingArrows = true,
      animationDurationMs = 200,
      showAnimations = true,
      blockTouchScroll = false,
      selectedPieceScale,
      dragScale = 1,
      touchDragScale = 1.9,
      dragLiftSquares = 0,
      touchDragLiftSquares = 0.6,
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
    const piecesLayerRef = useRef<PiecesLayerRef>(null);
    const teachingRef = useRef<TeachingLayerRef>(null);
    const cinematicRef = useRef<CinematicLayerRef>(null);
    const cameraControllerRef = useRef<CameraController | null>(null);
    const playbackRef = useRef<CinematicPlayback | null>(null);
    const { bounds, getFreshBounds } = useBoardSize(boardRef);

    const orientationRef = useRef(orientation);
    orientationRef.current = orientation;

    // Lazy: the camera controller (and any camera animation) only exists
    // after the first camera call, so idle boards pay nothing.
    const getCameraController = useCallback((): CameraController => {
      if (!cameraControllerRef.current) {
        cameraControllerRef.current = createCameraController(
          () => boardRef.current,
          () => orientationRef.current === 'white',
        );
      }
      return cameraControllerRef.current;
    }, []);

    const handleImpactShake = useCallback((options: { intensity?: number; durationMs?: number }) => {
      void getCameraController().shake(options);
    }, [getCameraController]);

    useEffect(() => {
      return () => {
        playbackRef.current?.cancel();
        playbackRef.current = null;
      };
    }, []);

    const piecesMap = useMemo(() => readFen(position || INITIAL_FEN), [position]);

    const boundsToDomRect = useCallback((b: { left: number; top: number; width: number; height: number }): DOMRect => {
      return {
        left: b.left, top: b.top,
        width: b.width, height: b.height,
        right: b.left + b.width,
        bottom: b.top + b.height,
        x: b.left, y: b.top,
        toJSON: () => ({}),
      } as DOMRect;
    }, []);

    const boardDomRect = useMemo(() => {
      if (!bounds) return null;
      return boundsToDomRect(bounds);
    }, [bounds, boundsToDomRect]);

    const getFreshDomRect = useCallback((): DOMRect | null => {
      const fresh = getFreshBounds();
      return fresh ? boundsToDomRect(fresh) : null;
    }, [getFreshBounds, boundsToDomRect]);

    // Guided mode: only the expected move(s) pass through to onMove; anything
    // else is rejected (piece snaps back), shakes and fires onWrongMove.
    const guardedOnMove = useCallback(
      (from: string, to: string, promotion?: PromotionPiece): boolean => {
        if (expectedMove) {
          const accepted = (Array.isArray(expectedMove) ? expectedMove : [expectedMove]).some(
            (m) =>
              m.from === from &&
              m.to === to &&
              (m.promotion === undefined || m.promotion === promotion),
          );
          if (!accepted) {
            if (wrongMoveFeedback === 'shake') {
              teachingRef.current?.shakePiece(from);
            }
            onWrongMove?.(from, to);
            return false;
          }
        }
        return onMove?.(from, to, promotion) ?? false;
      },
      [expectedMove, onMove, onWrongMove, wrongMoveFeedback],
    );

    const interaction = useInteraction({
      position,
      pieces: piecesMap,
      orientation,
      interactive,
      allowDragging,
      allowDrawingArrows,
      boardRef,
      boardBounds: boardDomRect,
      onMove: onMove ? guardedOnMove : undefined,
      dests,
      autoPromoteTo,
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
      getFreshBounds: getFreshDomRect,
    });

    const occupiedSquares = useMemo(() => {
      if (interaction.legalSquares.length === 0 && interaction.premoveSquares.length === 0) {
        return undefined;
      }
      const set = new Set<string>();
      for (const sq of piecesMap.keys()) set.add(sq);
      return set;
    }, [piecesMap, interaction.legalSquares, interaction.premoveSquares]);

    const getPieceElement = useCallback((square: string): HTMLDivElement | null => {
      return piecesLayerRef.current?.getPieceElement(square) ?? null;
    }, []);

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
      getSquareAtPoint(clientX: number, clientY: number): Square | null {
        const fresh = getFreshDomRect();
        if (!fresh) return null;
        return screenPos2square(clientX, clientY, orientation === 'white', fresh) ?? null;
      },
      animateMove(from: string, to: string, options?: AnimateMoveOptions) {
        return teachingRef.current?.animateMove(from, to, options) ?? Promise.resolve();
      },
      pulseSquare(square: string, options?: PulseSquareOptions) {
        return teachingRef.current?.pulseSquare(square, options) ?? Promise.resolve();
      },
      shakePiece(square: string) {
        return teachingRef.current?.shakePiece(square) ?? Promise.resolve();
      },
      clearTeachingEffects() {
        teachingRef.current?.clearEffects();
      },
      cinematicMove(from: Square, to: Square, options?: CinematicMoveOptions) {
        return cinematicRef.current?.cinematicMove(from, to, options) ?? Promise.resolve();
      },
      squareBurst(square: Square, options?: SquareBurstOptions) {
        return cinematicRef.current?.squareBurst(square, options) ?? Promise.resolve();
      },
      popBadge(square: Square, options: PopBadgeOptions) {
        return cinematicRef.current?.popBadge(square, options) ?? Promise.resolve();
      },
      celebrate(options?: CelebrateOptions) {
        return cinematicRef.current?.celebrate(options) ?? Promise.resolve();
      },
      popBanner(options: PopBannerOptions) {
        return cinematicRef.current?.popBanner(options) ?? Promise.resolve();
      },
      clearCinematics() {
        playbackRef.current?.cancel();
        playbackRef.current = null;
        cinematicRef.current?.clearCinematics();
        cameraControllerRef.current?.reset();
      },
      playCinematic(steps: CinematicStep[], options?: PlayCinematicOptions) {
        playbackRef.current?.cancel();
        const playback = playCinematicScript(
          {
            getLayer: () => cinematicRef.current,
            getCamera: getCameraController,
            peekCamera: () => cameraControllerRef.current,
          },
          steps,
          options,
        );
        playbackRef.current = playback;
        return playback;
      },
      camera: {
        zoomTo: (square: Square, options?: CameraZoomOptions) => getCameraController().zoomTo(square, options),
        zoomOut: (options?: CameraZoomOptions) => getCameraController().zoomOut(options),
        tilt: (options?: CameraTiltOptions) => getCameraController().tilt(options),
        shake: (options?: CameraShakeOptions) => getCameraController().shake(options),
        drift: (options?: CameraDriftOptions) => getCameraController().drift(options),
        reset: () => cameraControllerRef.current?.reset(),
      },
    }), [bounds, orientation, getFreshDomRect, getCameraController]);

    const hasValidSize = bounds && bounds.width > 0;
    const boardWidth = bounds?.width ?? 0;
    const boardHeight = bounds?.height ?? 0;
    const squareSize = boardWidth / 8;

    // Cursor: grab when hovering pieces, grabbing while dragging
    const isDragging = !!interaction.drag;
    const cursor = !interactive ? 'default' : isDragging ? 'grabbing' : allowDragging ? 'grab' : 'pointer';

    const marginPx = showMargin ? marginThickness : 0;
    const clipBoardContent = hasActiveRadius(boardRadius);

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
              borderRadius: marginRadius,
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
              borderRadius: boardRadius,
              overflow: 'visible',
              cursor,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: blockTouchScroll ? 'none' : undefined,
            }}
            onMouseDown={interaction.handlePointerDown as any}
            onTouchStart={interaction.handlePointerDown as any}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: boardRadius,
                overflow: clipBoardContent ? 'hidden' : 'visible',
              }}
            >
              <Squares
                theme={theme}
                orientation={orientation}
                lastMove={lastMove}
                selectedSquare={interaction.selectedSquare}
                draggingSquare={interaction.drag?.origSquare}
                dragHoverSquare={interaction.dragHoverSquare}
                legalSquares={interaction.legalSquares}
                premoveSquares={interaction.premoveSquares}
                premoveCurrent={interaction.premoveCurrent}
                occupiedSquares={occupiedSquares}
                markedSquares={interaction.activeMarkedSquares}
                highlightedSquares={highlightedSquares}
                squareVisuals={squareVisuals}
                check={check}
              />

              {ghostPieces.length > 0 && (
                <GhostPiecesLayer
                  ghosts={ghostPieces}
                  orientation={orientation}
                  pieceSet={pieceSet}
                  customPieces={customPieces}
                  flipPieces={flipPieces}
                />
              )}

              <PiecesLayer
                ref={piecesLayerRef}
                position={position}
                pieces={piecesMap}
                orientation={orientation}
                pieceSet={pieceSet}
                customPieces={customPieces}
                flipPieces={flipPieces}
                animationDurationMs={showAnimations ? animationDurationMs : 0}
                showAnimations={showAnimations}
                draggingSquare={interaction.drag?.origSquare}
                selectedSquare={interaction.selectedSquare}
                selectedPieceScale={selectedPieceScale}
              />

              {squareLabels && (
                <SquareLabelsLayer labels={squareLabels} orientation={orientation} />
              )}

              <TeachingLayer
                ref={teachingRef}
                orientation={orientation}
                pieces={piecesMap}
                pieceSet={pieceSet}
                customPieces={customPieces}
                flipPieces={flipPieces}
                getPieceElement={getPieceElement}
              />

              <CinematicLayer
                ref={cinematicRef}
                orientation={orientation}
                pieces={piecesMap}
                pieceSet={pieceSet}
                customPieces={customPieces}
                flipPieces={flipPieces}
                getPieceElement={getPieceElement}
                onImpactShake={handleImpactShake}
              />

              {hasValidSize && (
                <>
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
                      flipPieces={flipPieces}
                      visuals={promotionVisuals}
                      onSelect={interaction.handlePromotionSelect}
                      onDismiss={interaction.handlePromotionDismiss}
                    />
                  )}
                </>
              )}
            </div>

            {showNotation && (
              <Notation
                orientation={orientation}
                theme={theme}
                showOnMargin={showMargin}
                marginThickness={marginThickness}
                marginRadius={marginRadius}
                visuals={notationVisuals}
              />
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
            flipPieces={flipPieces}
            scale={interaction.drag.isTouch ? touchDragScale : dragScale}
            liftSquares={interaction.drag.isTouch ? touchDragLiftSquares : dragLiftSquares}
          />
        )}
      </div>
    );
  },
);
