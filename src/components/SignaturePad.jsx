import React, { useEffect, useRef, useState } from "react";

function SignaturePad({
  value = null,
  onChange,
  width = 560,
  height = 180,
  disabled = false,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";

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

    const clientX =
      event.touches?.[0]?.clientX ?? event.clientX ?? rect.left;
    const clientY =
      event.touches?.[0]?.clientY ?? event.clientY ?? rect.top;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(event) {
    if (disabled) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
  }

  function draw(event) {
    if (!isDrawing || disabled) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endDrawing() {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    setIsDrawing(false);

    if (onChange) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function clearSignature() {
    if (disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (onChange) {
      onChange(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          maxWidth: width,
          height,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          background: disabled ? "#f8fafc" : "#fff",
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "crosshair",
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />

      <div>
        <button type="button" onClick={clearSignature} disabled={disabled}>
          Effacer la signature
        </button>
      </div>
    </div>
  );
}

export default SignaturePad;