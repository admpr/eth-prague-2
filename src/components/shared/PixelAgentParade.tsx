"use client";

import { motion } from "framer-motion";

const SCALE = 5;
const COLS = 18;
const ROWS = 16;

const HEAD_PIXELS: Array<[number, number]> = [
  [6, 0], [7, 0],
  [6, 1], [7, 1],
  [5, 2], [6, 2], [7, 2], [8, 2],
  [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
  [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
  [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
  [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
  [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
];

const EYE_PIXELS: Array<[number, number]> = [
  [5, 5], [9, 5],
];

const BODY_PIXELS: Array<[number, number]> = [
  [5, 8], [6, 8], [7, 8], [8, 8],
  [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9],
  [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
  [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
  [3, 12], [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12],
];

const CHEST_PIXELS: Array<[number, number]> = [[6, 10], [7, 10]];

const ARM_PIXELS: Array<[number, number]> = [
  [11, 9], [11, 10], [11, 11],
];

const KEY_PIXELS: Array<[number, number]> = [
  [12, 8], [13, 8], [14, 8],
  [12, 9],          [14, 9],
  [12, 10], [13, 10], [14, 10],
  [15, 9],
  [16, 9], [16, 10],
  [17, 9], [17, 10],
];

const LEGS_A: Array<[number, number]> = [
  [4, 13], [5, 13], [8, 13], [9, 13],
  [4, 14], [5, 14], [8, 14], [9, 14],
  [4, 15], [9, 15],
];

const LEGS_B: Array<[number, number]> = [
  [3, 13], [4, 13], [9, 13], [10, 13],
  [3, 14], [4, 14], [9, 14], [10, 14],
  [2, 15], [10, 15],
];

function Pixels({
  pixels,
  fill,
}: {
  pixels: Array<[number, number]>;
  fill: string;
}) {
  return (
    <>
      {pixels.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x * SCALE}
          y={y * SCALE}
          width={SCALE}
          height={SCALE}
          fill={fill}
        />
      ))}
    </>
  );
}

type BotProps = {
  body: string;
  accent: string;
  keyColor: string;
  walkPhase: number;
};

function Bot({ body, accent, keyColor, walkPhase }: BotProps) {
  return (
    <svg
      width={COLS * SCALE}
      height={ROWS * SCALE}
      viewBox={`0 0 ${COLS * SCALE} ${ROWS * SCALE}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      <g style={{ animation: "bot-bob 0.64s steps(2) infinite" }}>
        <Pixels pixels={HEAD_PIXELS} fill={body} />
        <Pixels pixels={EYE_PIXELS} fill={accent} />
        <Pixels pixels={BODY_PIXELS} fill={body} />
        <Pixels pixels={CHEST_PIXELS} fill={accent} />
        <Pixels pixels={ARM_PIXELS} fill={body} />
        <g style={{ animation: "key-shimmer 1.6s steps(2) infinite" }}>
          <Pixels pixels={KEY_PIXELS} fill={keyColor} />
        </g>
        <g
          style={{
            animation: `bot-frame-a 0.36s steps(1) infinite`,
            animationDelay: `${walkPhase}s`,
          }}
        >
          <Pixels pixels={LEGS_A} fill={body} />
        </g>
        <g
          style={{
            animation: `bot-frame-b 0.36s steps(1) infinite`,
            animationDelay: `${walkPhase}s`,
          }}
        >
          <Pixels pixels={LEGS_B} fill={body} />
        </g>
      </g>
    </svg>
  );
}

type LaneAgent = {
  id: string;
  body: string;
  accent: string;
  keyColor: string;
  scale: number;
  duration: number;
  delay: number;
  walkPhase: number;
  pathName: "roam-1" | "roam-2" | "roam-3" | "roam-4" | "roam-5" | "roam-6";
  facing: "left" | "right";
  badge: string;
};

const LANE_AGENTS: LaneAgent[] = [
  {
    id: "AGT.01",
    body: "hsl(42 28% 85%)",
    accent: "hsl(333 80% 51%)",
    keyColor: "hsl(333 80% 58%)",
    scale: 1.3,
    duration: 26,
    delay: 0,
    walkPhase: 0,
    pathName: "roam-1",
    facing: "left",
    badge: "STABLECOIN",
  },
  {
    id: "AGT.02",
    body: "hsl(333 80% 60%)",
    accent: "hsl(42 28% 92%)",
    keyColor: "hsl(42 30% 88%)",
    scale: 1.55,
    duration: 22,
    delay: 4,
    walkPhase: 0.18,
    pathName: "roam-2",
    facing: "right",
    badge: "REBALANCE",
  },
  {
    id: "AGT.03",
    body: "hsl(152 40% 70%)",
    accent: "hsl(333 80% 51%)",
    keyColor: "hsl(333 80% 58%)",
    scale: 1.4,
    duration: 30,
    delay: 11,
    walkPhase: 0,
    pathName: "roam-3",
    facing: "left",
    badge: "CLAIMS",
  },
  {
    id: "AGT.04",
    body: "hsl(240 5% 60%)",
    accent: "hsl(333 80% 51%)",
    keyColor: "hsl(333 80% 58%)",
    scale: 1.15,
    duration: 34,
    delay: 2,
    walkPhase: 0.18,
    pathName: "roam-4",
    facing: "right",
    badge: "TREASURY",
  },
  {
    id: "AGT.05",
    body: "hsl(42 22% 75%)",
    accent: "hsl(333 80% 51%)",
    keyColor: "hsl(333 80% 58%)",
    scale: 1.0,
    duration: 28,
    delay: 7,
    walkPhase: 0.18,
    pathName: "roam-5",
    facing: "left",
    badge: "GAS.RUNNER",
  },
  {
    id: "AGT.06",
    body: "hsl(20 35% 68%)",
    accent: "hsl(42 28% 92%)",
    keyColor: "hsl(42 30% 88%)",
    scale: 1.2,
    duration: 38,
    delay: 14,
    walkPhase: 0,
    pathName: "roam-6",
    facing: "right",
    badge: "VOTER",
  },
];

export function PixelAgentParade({ className }: { className?: string }) {
  return (
    <div
      className={`relative h-full min-h-[560px] w-full overflow-hidden ${className ?? ""}`}
      aria-hidden
    >
      <style>{`
        @keyframes bot-frame-a {
          0%, 49.999% { opacity: 1; }
          50%, 100%   { opacity: 0; }
        }
        @keyframes bot-frame-b {
          0%, 49.999% { opacity: 0; }
          50%, 100%   { opacity: 1; }
        }
        @keyframes bot-bob {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes key-shimmer {
          0%, 70%   { opacity: 1; }
          71%, 80%  { opacity: 0.55; }
          81%, 100% { opacity: 1; }
        }

        /* Each agent gets its own meandering path. Top/left use percentages so
           the whole thing scales with the right column width. */
        @keyframes roam-1 {
          0%   { left: 105%; top: 8%; }
          22%  { left: 70%;  top: 18%; }
          48%  { left: 38%;  top: 11%; }
          74%  { left: 12%;  top: 22%; }
          100% { left: -20%; top: 14%; }
        }
        @keyframes roam-2 {
          0%   { left: -25%; top: 38%; }
          18%  { left: 8%;   top: 32%; }
          42%  { left: 35%;  top: 46%; }
          68%  { left: 65%;  top: 36%; }
          88%  { left: 88%;  top: 42%; }
          100% { left: 110%; top: 40%; }
        }
        @keyframes roam-3 {
          0%   { left: 110%; top: 64%; }
          25%  { left: 78%;  top: 56%; }
          52%  { left: 48%;  top: 68%; }
          78%  { left: 18%;  top: 60%; }
          100% { left: -22%; top: 66%; }
        }
        @keyframes roam-4 {
          0%   { left: -25%; top: 86%; }
          24%  { left: 16%;  top: 80%; }
          50%  { left: 42%;  top: 90%; }
          76%  { left: 72%;  top: 84%; }
          100% { left: 110%; top: 88%; }
        }
        @keyframes roam-5 {
          0%   { left: 105%; top: 30%; }
          20%  { left: 76%;  top: 36%; }
          46%  { left: 50%;  top: 28%; }
          72%  { left: 22%;  top: 38%; }
          100% { left: -22%; top: 32%; }
        }
        @keyframes roam-6 {
          0%   { left: -25%; top: 70%; }
          22%  { left: 14%;  top: 76%; }
          48%  { left: 40%;  top: 64%; }
          74%  { left: 70%;  top: 74%; }
          100% { left: 110%; top: 68%; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0"
      >
        {/* Subtle floor dots — no frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(hsl(0 0% 100% / 0.04) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {LANE_AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="absolute"
            style={{
              animation: `${agent.pathName} ${agent.duration}s linear infinite`,
              animationDelay: `-${agent.delay}s`,
              willChange: "left, top",
            }}
          >
            <div
              style={{
                transform: `scale(${agent.scale}) ${agent.facing === "left" ? "scaleX(-1)" : ""}`,
                transformOrigin: "bottom left",
              }}
            >
              <div
                className="flex flex-col items-center"
                style={{
                  // Counter-flip the label so text always reads left→right
                  transform: agent.facing === "left" ? "scaleX(-1)" : undefined,
                }}
              >
                <span className="mb-1.5 inline-flex items-center gap-1 border border-border/70 bg-background/85 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-foreground/85">
                  <span className="h-1 w-1 bg-primary" />
                  {agent.id}
                  <span className="text-muted-foreground/80">·</span>
                  <span className="text-foreground/70">{agent.badge}</span>
                </span>
              </div>
              <Bot
                body={agent.body}
                accent={agent.accent}
                keyColor={agent.keyColor}
                walkPhase={agent.walkPhase}
              />
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
