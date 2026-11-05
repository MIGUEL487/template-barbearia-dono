"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useAnimatedDialog } from "./use-animated-dialog";
export function DialogPanel({
  open,
  onClose,
  titleId,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
  className?: string;
}) {
  const { ref, show, close } = useAnimatedDialog(),
    callback = useRef(onClose),
    retained = useRef(children);
  callback.current = onClose;
  if (open) retained.current = children;
  useEffect(() => {
    if (open && !ref.current?.open) show();
    else if (!open && ref.current?.open) void close();
  }, [open, show, close, ref]);
  return (
    <dialog
      ref={ref}
      inert={!open}
      aria-labelledby={titleId}
      className={"mg-dialog s3-dialog " + className}
      onClose={() => callback.current()}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          void close();
      }}
    >
      {open ? children : retained.current}
    </dialog>
  );
}
