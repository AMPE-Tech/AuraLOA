import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface EditorialGaugeProps {
  value: number;
  max?: number;
  size?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  accent?: string;
  trackColor?: string;
  duration?: number;
  decimals?: number;
}

export function EditorialGauge({
  value,
  max = 100,
  size = 180,
  prefix = "",
  suffix = "",
  label,
  accent = "#818cf8",
  trackColor = "rgba(129,140,248,0.10)",
  duration = 1.6,
  decimals = 0,
}: EditorialGaugeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const display = useMotionValue(0);
  const rounded = useTransform(display, (v) => v.toFixed(decimals));
  const [text, setText] = useState("0");

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setText(v));
    return () => unsub();
  }, [rounded]);

  useEffect(() => {
    if (inView) {
      const ctrl = animate(display, value, { duration, ease: [0.16, 1, 0.3, 1] });
      return () => ctrl.stop();
    }
  }, [inView, value, display, duration]);

  const stroke = 2;
  const radius = size / 2 - stroke * 4;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);

  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const tickInner = radius + 6;
  const tickOuter = radius + 11;

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* tick marks circulares — ar de cronômetro/instrumento */}
        <g style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {ticks.map((i) => {
            const angle = (i / ticks.length) * 360;
            const isMajor = i % 5 === 0;
            const isActive = i / ticks.length <= progress;
            const x1 = size / 2 + Math.cos((angle * Math.PI) / 180) * tickInner;
            const y1 = size / 2 + Math.sin((angle * Math.PI) / 180) * tickInner;
            const x2 = size / 2 + Math.cos((angle * Math.PI) / 180) * (isMajor ? tickOuter + 1 : tickOuter - 2);
            const y2 = size / 2 + Math.sin((angle * Math.PI) / 180) * (isMajor ? tickOuter + 1 : tickOuter - 2);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isActive ? accent : "rgba(255,255,255,0.10)"}
                strokeWidth={isMajor ? 1 : 0.5}
                strokeLinecap="round"
                style={{
                  opacity: isActive ? 0.9 : 0.4,
                  transition: "opacity 0.4s ease",
                }}
              />
            );
          })}
        </g>

        {/* track de fundo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />

        {/* arc animado */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke + 0.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: circumference * (1 - progress) } : {}}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent}80)` }}
        />

        {/* end-cap dot — gold AuraTECH accent */}
        {(() => {
          const endAngle = progress * 360;
          const x = size / 2 + Math.cos((endAngle * Math.PI) / 180) * radius;
          const y = size / 2 + Math.sin((endAngle * Math.PI) / 180) * radius;
          return (
            <motion.circle
              cx={x}
              cy={y}
              r={2.5}
              fill="#fbbf24"
              initial={{ opacity: 0, scale: 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: duration * 0.9, duration: 0.4 }}
              style={{ filter: "drop-shadow(0 0 4px #fbbf24)" }}
            />
          );
        })()}
      </svg>

      {/* centro: número monumental em Playfair Display + label uppercase Playfair Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="flex items-baseline justify-center gap-0.5">
          {prefix && (
            <span
              className="text-white/60 tabular-nums"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: size * 0.14, fontWeight: 400, letterSpacing: "0.02em" }}
            >
              {prefix}
            </span>
          )}
          <motion.span
            className="text-white tabular-nums"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: size * 0.30,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            {text}
          </motion.span>
          {suffix && (
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: size * 0.18,
                fontWeight: 500,
                color: accent,
                letterSpacing: "-0.015em",
              }}
            >
              {suffix}
            </span>
          )}
        </div>
        <span
          className="mt-2 uppercase"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: size * 0.060,
            letterSpacing: "0.30em",
            color: accent,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

interface EditorialComparisonProps {
  manualLabel: string;
  manualValue: string;
  digitalLabel: string;
  digitalValue: string;
  ratioLabel: string;
  accent?: string;
  duration?: number;
}

export function EditorialComparison({
  manualLabel,
  manualValue,
  digitalLabel,
  digitalValue,
  ratioLabel,
  accent = "#818cf8",
  duration = 1.4,
}: EditorialComparisonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="w-full flex flex-col items-center justify-center h-full">
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Manual */}
        <motion.div
          className="text-right"
          initial={{ opacity: 0, x: -10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div
            className="uppercase mb-1.5"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "rgba(248,113,113,0.75)",
              fontWeight: 500,
            }}
          >
            {manualLabel}
          </div>
          <div
            className="text-red-400 tabular-nums"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            {manualValue}
          </div>
        </motion.div>

        {/* divider central com ratio */}
        <motion.div
          className="flex flex-col items-center px-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          <div
            className="my-2"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontStyle: "italic",
              fontSize: 15,
              color: "rgba(255,255,255,0.42)",
              fontWeight: 400,
            }}
          >
            vs
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
        </motion.div>

        {/* Digital */}
        <motion.div
          className="text-left"
          initial={{ opacity: 0, x: 10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div
            className="uppercase mb-1.5"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 10,
              letterSpacing: "0.28em",
              color: accent,
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            {digitalLabel}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              color: accent,
              filter: `drop-shadow(0 0 12px ${accent}40)`,
            }}
          >
            {digitalValue}
          </div>
        </motion.div>
      </div>

      {/* ratio pill */}
      <motion.div
        className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.06]"
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.7 }}
      >
        <span
          className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"
        />
        <span
          className="uppercase tabular-nums"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 11,
            letterSpacing: "0.24em",
            color: "#fbbf24",
            fontWeight: 600,
          }}
        >
          {ratioLabel}
        </span>
      </motion.div>
    </div>
  );
}
