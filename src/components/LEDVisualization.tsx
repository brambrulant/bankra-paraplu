import React, { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Power, PowerOff } from "lucide-react";

interface Segment {
  id: number;
  len: number;
  col: number[][];
  on: boolean;
}

interface WLEDState {
  on: boolean;
  bri: number;
  preset: number;
  seg?: Segment[];
}

interface LEDVisualizationProps {
  wledState: WLEDState;
  connected: boolean;
}

const LEDVisualization: React.FC<LEDVisualizationProps> = ({
  wledState,
  connected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!connected) {
        ctx.fillStyle = "#374151";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#9CA3AF";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("WLED Disconnected", canvas.width / 2, canvas.height / 2);
        animationId = requestAnimationFrame(animate);
        return;
      }

      if (!wledState.on) {
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#6B7280";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("WLED Off", canvas.width / 2, canvas.height / 2);
        animationId = requestAnimationFrame(animate);
        return;
      }

      // Draw one strip per segment as rectangles
      const segs = wledState.seg || [];
      const stripHeight = Math.max(
        20,
        Math.floor(canvas.height / Math.max(1, segs.length))
      );
      const ledGap = 2;
      const stripGap = 8;
      const brightness = wledState.bri / 255;

      segs.forEach((segment, idx) => {
        const ledCount = segment.len;
        const ledWidth = Math.max(
          8,
          (canvas.width - stripGap * 2 - (ledCount - 1) * ledGap) / ledCount
        );
        const ledHeight = stripHeight - stripGap;
        const y = idx * stripHeight + stripGap;
        const color =
          segment.col && segment.col[0] ? segment.col[0] : [255, 255, 255];
        for (let i = 0; i < ledCount; i++) {
          const x = i * (ledWidth + ledGap) + stripGap;
          // Optionally animate or vary color
          const variation =
            0.8 + 0.2 * Math.sin(Date.now() * 0.001 + i * 0.1 + idx);
          const r = Math.floor(color[0] * brightness * variation);
          const g = Math.floor(color[1] * brightness * variation);
          const b = Math.floor(color[2] * brightness * variation);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, ledWidth, ledHeight);
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, ledWidth, ledHeight);
        }
        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
          `Segment ${segment.id ?? idx} (${segment.len} LEDs)`,
          stripGap,
          y - 4
        );
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [wledState, connected]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={Math.max(100, (wledState.seg?.length || 1) * 32)}
          className="w-full h-24 border border-white/20 rounded-lg bg-black"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center gap-3">
          <Badge
            variant={connected ? "default" : "secondary"}
            className={
              connected ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"
            }
          >
            {connected ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            {wledState.on ? (
              <Power className="h-4 w-4 text-green-400" />
            ) : (
              <PowerOff className="h-4 w-4 text-gray-400" />
            )}
            <span className={wledState.on ? "text-green-300" : "text-gray-400"}>
              Power: {wledState.on ? "On" : "Off"}
            </span>
          </div>

          <div className="text-white">Preset: {wledState.preset}</div>

          <div className="text-white">
            Brightness: {Math.floor((wledState.bri / 255) * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default LEDVisualization;
