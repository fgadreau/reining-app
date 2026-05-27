import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

function SignaturePad({
  value = null,
  onChange,
  width = 560,
  height = 180,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftSignature, setDraftSignature] = useState(value);

  useEffect(() => {
    if (!isModalOpen) {
      setDraftSignature(value);
    }
  }, [isModalOpen, value]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  function openSignatureModal() {
    if (disabled) return;
    setDraftSignature(value);
    setIsModalOpen(true);
  }

  function clearSignature() {
    if (disabled) return;

    if (isModalOpen) {
      setDraftSignature(null);
      return;
    }

    if (onChange) {
      onChange(null);
    }
  }

  function saveModalSignature() {
    if (onChange) {
      onChange(draftSignature);
    }

    setIsModalOpen(false);
  }

  function cancelModalSignature() {
    setDraftSignature(value);
    setIsModalOpen(false);
  }

  return (
    <div style={padShellStyle}>
      <SignatureCanvas
        value={value}
        onChange={onChange}
        width={width}
        height={height}
        disabled={disabled}
      />

      <div style={buttonRowStyle}>
        <button type="button" onClick={openSignatureModal} disabled={disabled}>
          {value
            ? t("management.scoring.editSignaturePad")
            : t("management.scoring.openSignaturePad")}
        </button>
        <button type="button" onClick={clearSignature} disabled={disabled}>
          {t("management.scoring.clearSignature")}
        </button>
      </div>

      {isModalOpen && (
        <div style={modalBackdropStyle} role="dialog" aria-modal="true">
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>
                {t("management.scoring.judgeSignatureTitle")}
              </h2>
              <button
                type="button"
                onClick={cancelModalSignature}
                style={secondaryButtonStyle}
              >
                {t("management.access.cancel")}
              </button>
            </div>

            <div style={modalCanvasWrapStyle}>
              <SignatureCanvas
                value={draftSignature}
                onChange={setDraftSignature}
                width={1120}
                height={420}
                disabled={disabled}
                fullHeight
              />
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={clearSignature}
                disabled={disabled}
                style={secondaryButtonStyle}
              >
                {t("management.scoring.clearSignature")}
              </button>
              <button
                type="button"
                onClick={saveModalSignature}
                disabled={disabled}
                style={primaryButtonStyle}
              >
                {t("management.scoring.saveSignature")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignatureCanvas({
  value,
  onChange,
  width,
  height,
  disabled,
  fullHeight = false,
}) {
  const canvasRef = useRef(null);
  const pointerIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = prepareSignatureContext(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = value;
    }
  }, [value, width, height]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    return {
      x: Math.min(Math.max(x, 0), canvas.width),
      y: Math.min(Math.max(y, 0), canvas.height),
    };
  }

  function startDrawing(event) {
    if (disabled) return;

    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = prepareSignatureContext(canvas);
    const point = getPoint(event);

    pointerIdRef.current = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (disabled || pointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = prepareSignatureContext(canvas);
    const point = getPoint(event);

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endDrawing(event) {
    if (pointerIdRef.current !== event.pointerId) return;

    const canvas = canvasRef.current;
    pointerIdRef.current = null;
    canvas.releasePointerCapture?.(event.pointerId);

    if (onChange) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: "100%",
        maxWidth: fullHeight ? "100%" : width,
        height: fullHeight ? "min(62vh, 520px)" : height,
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: disabled ? "#f8fafc" : "#fff",
        touchAction: "none",
        cursor: disabled ? "not-allowed" : "crosshair",
      }}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={endDrawing}
      onPointerCancel={endDrawing}
    />
  );
}

function prepareSignatureContext(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#111827";
  return ctx;
}

const padShellStyle = {
  display: "grid",
  gap: 8,
};

const buttonRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  background: "rgba(15, 23, 42, 0.58)",
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalStyle = {
  width: "min(1180px, 100%)",
  height: "min(760px, 96vh)",
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  gap: 12,
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.32)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const modalTitleStyle = {
  margin: 0,
  fontSize: 22,
};

const modalCanvasWrapStyle = {
  minHeight: 0,
  display: "flex",
  alignItems: "stretch",
};

const modalActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

export default SignaturePad;
