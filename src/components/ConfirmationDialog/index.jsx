"use client";

import { Warning } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import "./style.scss";

export default function ConfirmationDialog({
  open,
  eyebrow = "CONFIRMAÇÃO",
  title,
  description,
  cancelLabel = "Voltar",
  confirmLabel,
  busyLabel = "Confirmando...",
  secondaryLabel = "",
  onSecondary,
  busy = false,
  error = "",
  onCancel,
  onConfirm,
  id = "confirmation-dialog",
}) {
  const cancelRef = useRef(null);
  const secondaryRef = useRef(null);
  const confirmRef = useRef(null);
  const previousFocusRef = useRef(null);
  const interactionRef = useRef({ busy, onCancel });
  interactionRef.current = { busy, onCancel };

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const focusFrame = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !interactionRef.current.busy) {
        event.preventDefault();
        interactionRef.current.onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [cancelRef.current, secondaryRef.current, confirmRef.current].filter((control) => control && !control.disabled);
      if (!controls.length) return;
      const currentIndex = controls.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? controls.length - 1 : currentIndex - 1)
        : (currentIndex + 1) % controls.length;
      event.preventDefault();
      controls[nextIndex].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) requestAnimationFrame(() => previousFocus.focus());
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="confirmation-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy}>
        <div className="confirmation-dialog__icon" aria-hidden="true"><Warning size={26} weight="fill" /></div>
        <span className="eyebrow">{eyebrow}</span>
        <h3 id={`${id}-title`}>{title}</h3>
        <p id={`${id}-description`}>{description}</p>
        {error && <p className="confirmation-dialog__error" role="alert">{error}</p>}
        <div className="confirmation-dialog__actions">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          {secondaryLabel && <button ref={secondaryRef} type="button" className="confirmation-dialog__secondary" onClick={onSecondary} disabled={busy}>{secondaryLabel}</button>}
          <button ref={confirmRef} type="button" className="confirmation-dialog__confirm" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
