import { useRef } from "react";

/** 垂直拖拽把手：拖动时持续回调指针 x 坐标，由父组件换算宽度/比例 */
export default function ResizeHandle({
  onDrag,
  onDoubleClick,
  style,
  className = "",
}: {
  onDrag: (clientX: number) => void;
  onDoubleClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const dragging = useRef(false);

  return (
    <div
      className={`resize-handle ${className}`}
      style={style}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (dragging.current) onDrag(e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }}
    />
  );
}
