// UI THEME LOCKED

"use client";

import dynamic from "next/dynamic";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Card } from "@/components/ui/card";
import type { AgentLocation } from "@/utils/agents";
import {
  agentOrder,
  formatLocationDisplay,
  getAgentById,
  getAgentLocation,
} from "@/utils/agents";
import type { AgentId, AgentStates, Connection } from "@/types";

const EARTH_RADIUS = 1;
const MARKER_RADIUS = 0.028;
const ATMOSPHERE_RADIUS = 1.08;
const ARC_SEGMENTS = 32;

// Dark theme – fits current UI (fallback when no texture)
const COLOR_EARTH_FALLBACK = "#0f172a";
const COLOR_ATMOSPHERE = "#38bdf8";
const ATMOSPHERE_OPACITY = 0.12;
const MARKER_IDLE = "#475569";
const MARKER_ACTIVE = "#38bdf8";
const MARKER_COMPLETE = "#10b981";
const ARC_ACTIVE = "#38bdf8";

function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(theta),
  );
}

interface CityMarkerProps {
  agentId: AgentId;
  position: THREE.Vector3;
  status: "idle" | "active" | "complete" | "blocked" | "failed";
  locationName: string;
  /** Pipeline order (0–4) for staggered scale-in so markers flow with agents. */
  orderIndex: number;
  runStatus?: string;
  /** Timestamp (ms) when run started for stagger delay. */
  runStartedAt?: number;
}

const RING_RADIUS = MARKER_RADIUS * 2.5;
const OVERSHOOT_SCALE = 1.15;
const OVERSHOOT_DURATION = 0.2;
const SETTLE_DURATION = 0.25;

const MARKER_STAGGER_SEC = 0.22;

/** Ease-out: fast at start, slow at end (t in 0..1). */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function CityMarker({
  agentId,
  position,
  status,
  locationName,
  orderIndex,
  runStatus,
  runStartedAt,
}: CityMarkerProps) {
  void agentId;
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const scaleRef = useRef(status === "idle" ? 0 : 1);
  const justActivatedRef = useRef(false);
  const ringProgressRef = useRef([1, 1, 1]);
  const prevStatusRef = useRef(status);
  const pipelineStartedAtRef = useRef<number | null>(null);
  const pulse = status === "active" || status === "complete";
  type Phase = "waiting" | "scale-in" | "settle" | "steady";
  const phaseRef = useRef<Phase>(status === "idle" ? "waiting" : "steady");
  const progressRef = useRef(0);
  const idleStartScaleRef = useRef(0);

  if (
    prevStatusRef.current === "idle" &&
    (status === "active" || status === "complete")
  ) {
    justActivatedRef.current = true;
    ringProgressRef.current = [0, 0, 0];
    if (runStatus === "running" && pipelineStartedAtRef.current === null)
      pipelineStartedAtRef.current = runStartedAt ?? Date.now();
  }
  if (status === "idle") phaseRef.current = "waiting";
  if (prevStatusRef.current !== "idle" && status === "idle")
    idleStartScaleRef.current = scaleRef.current;
  prevStatusRef.current = status;

  const t0 = pipelineStartedAtRef.current ?? runStartedAt ?? Date.now();

  useFrame((_, delta) => {
    const reducedMotion =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("reduce-motion");
    const staggerDelay = reducedMotion
      ? 0
      : orderIndex * MARKER_STAGGER_SEC * 1000;
    const canAnimate =
      reducedMotion || status === "idle" || Date.now() - t0 >= staggerDelay;

    if (meshRef.current) {
      let baseScale: number;
      if (reducedMotion) {
        baseScale = status === "idle" ? 0 : 1;
        scaleRef.current = baseScale;
        phaseRef.current = status === "idle" ? "waiting" : "steady";
        meshRef.current.scale.setScalar(baseScale);
      } else if (status === "idle") {
        progressRef.current += delta * 4;
        const t = Math.min(1, progressRef.current);
        baseScale = idleStartScaleRef.current * (1 - easeOutQuad(t));
        scaleRef.current = baseScale;
        meshRef.current.scale.setScalar(baseScale);
        if (t >= 1) progressRef.current = 0;
      } else {
        if (phaseRef.current === "waiting" && canAnimate) {
          phaseRef.current = "scale-in";
          progressRef.current = 0;
        }
        if (phaseRef.current === "scale-in") {
          progressRef.current += delta * (1 / OVERSHOOT_DURATION);
          const t = Math.min(1, progressRef.current);
          baseScale = OVERSHOOT_SCALE * easeOutQuad(t);
          scaleRef.current = baseScale;
          if (t >= 1) {
            phaseRef.current = "settle";
            progressRef.current = 0;
          }
        } else if (phaseRef.current === "settle") {
          progressRef.current += delta * (1 / SETTLE_DURATION);
          const t = Math.min(1, progressRef.current);
          baseScale = OVERSHOOT_SCALE + (1 - OVERSHOOT_SCALE) * easeOutQuad(t);
          scaleRef.current = baseScale;
          if (t >= 1) {
            phaseRef.current = "steady";
            progressRef.current = 0;
          }
        } else if (phaseRef.current === "steady") {
          baseScale = 1;
          scaleRef.current = 1;
        } else {
          baseScale = 0;
          scaleRef.current = 0;
        }
        const pulseAmount = pulse ? 0.2 * Math.sin(Date.now() * 0.003) : 0;
        const s = baseScale * (1 + pulseAmount);
        meshRef.current.scale.setScalar(s);
      }
      if (
        glowRef.current &&
        !reducedMotion &&
        (status === "active" || status === "complete")
      ) {
        const pulseAmount = 0.15 * Math.sin(Date.now() * 0.003);
        const glowScale = 1.4 * (1 + pulseAmount);
        glowRef.current.scale.setScalar(glowScale);
        glowRef.current.visible = scaleRef.current > 0.01;
      }
    }

    if (!reducedMotion && (status === "active" || status === "complete")) {
      const ringProgress = ringProgressRef.current;
      for (let i = 0; i < 3; i++) {
        if (justActivatedRef.current) ringProgress[i] = 0;
        if (ringProgress[i] < 1) {
          ringProgress[i] = Math.min(1, ringProgress[i] + delta * 2.2);
          const t = ringProgress[i];
          const ringScale = 1 + t * (1.2 + i * 0.25);
          const ringOpacity = (1 - t) * (1 - t) * 0.5;
          const mesh = ringRefs.current[i];
          if (mesh) {
            mesh.scale.setScalar(ringScale);
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat) mat.opacity = ringOpacity;
          }
        }
      }
      if (ringProgress.every((p) => p >= 1)) justActivatedRef.current = false;
    }
  });

  const color =
    status === "active"
      ? MARKER_ACTIVE
      : status === "complete"
        ? MARKER_COMPLETE
        : MARKER_IDLE;

  const reducedMotion =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion");
  const ringColor = status === "complete" ? MARKER_COMPLETE : MARKER_ACTIVE;

  return (
    <group position={[position.x, position.y, position.z]}>
      {!reducedMotion && (status === "active" || status === "complete") && (
        <>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              ref={(el) => {
                if (el) ringRefs.current[i] = el as unknown as THREE.Mesh;
              }}
              scale={[1, 1, 1]}
            >
              <ringGeometry
                args={[
                  RING_RADIUS + i * 0.008,
                  RING_RADIUS + 0.015 + i * 0.008,
                  24,
                ]}
              />
              <meshBasicMaterial
                color={ringColor}
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}
      {!reducedMotion && (status === "active" || status === "complete") && (
        <>
          {/* @ts-expect-error R3F mesh ref type differs from @types/three */}
          <mesh ref={glowRef} scale={[1.4, 1.4, 1.4]}>
            <sphereGeometry args={[MARKER_RADIUS * 1.8, 16, 12]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
      {/* @ts-expect-error three.js BufferGeometry type mismatch with @react-three/fiber */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[MARKER_RADIUS, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html
        center
        distanceFactor={8}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className="text-[10px] font-medium text-sky-100/90 whitespace-nowrap drop-shadow-md">
          {locationName}
        </span>
      </Html>
    </group>
  );
}

interface ArcLineProps {
  curve: THREE.QuadraticBezierCurve3;
  active: boolean;
  /** Index of this arc in pipeline order (0 = Architect→Builder). Arc i fills when currentStep >= i+2. */
  orderIndex: number;
  /** Current pipeline step (1–5) so arcs draw in sync with agents. */
  currentStep?: number;
}

function ArcLine({ curve, active, orderIndex, currentStep }: ArcLineProps) {
  const points = useMemo(() => curve.getPoints(ARC_SEGMENTS), [curve]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [points]);
  const lineRef = useRef<THREE.Line>(null);
  const progressRef = useRef(0);
  const lengthRef = useRef(curve.getLength());
  const reducedMotion =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion");
  const step = currentStep ?? 0;
  const canFill = reducedMotion || !active || step >= orderIndex + 2;

  useEffect(() => {
    lengthRef.current = curve.getLength();
    return () => geometry.dispose();
  }, [curve, geometry]);

  useFrame((_, delta) => {
    const target = active ? 1 : 0;
    const speed = reducedMotion ? 1.2 : canFill ? 2.2 : 0.3;
    progressRef.current +=
      (target - progressRef.current) * Math.min(1, delta * speed);
    const raw = Math.max(0, Math.min(1, progressRef.current));
    const eased = reducedMotion ? raw : 1 - (1 - raw) ** 1.5;
    const line = lineRef.current;
    if (!line?.material) return;
    const mat = line.material as THREE.LineDashedMaterial & {
      dashOffset?: number;
    };
    const len = lengthRef.current;
    mat.dashSize = eased * len;
    mat.gapSize = len * 2;
    if ("dashOffset" in mat) mat.dashOffset = 0;
    if ("computeLineDistances" in line)
      (line as THREE.Line).computeLineDistances?.();
  });

  if (!active && progressRef.current < 0.01) return null;

  return (
    // @ts-expect-error three.js Line primitive, not SVG line
    <line ref={lineRef} geometry={geometry}>
      <lineDashedMaterial color={ARC_ACTIVE} dashSize={0} gapSize={999} />
    </line>
  );
}

const COMET_TRAIL_OFFSETS = [0, -0.06, -0.12];
const COMET_TRAIL_SCALES = [1, 0.6, 0.35];
const COMET_TRAIL_OPACITIES = [1, 0.5, 0.2];

/** Traveling glow along the arc with comet trail; resets when connection becomes active. */
function ArcTravelingGlow({
  curve,
  active,
  orderIndex,
  currentStep,
}: ArcLineProps) {
  const trailRefs = useRef<(THREE.Group | null)[]>([]);
  const travelRef = useRef(0);
  const prevActiveRef = useRef(false);
  const reducedMotion =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion");
  if (active && !prevActiveRef.current) travelRef.current = 0;
  prevActiveRef.current = active;

  useFrame((_, delta) => {
    if (!active || reducedMotion) return;
    const step = currentStep ?? 0;
    const allowed = step >= orderIndex + 2;
    if (!allowed) return;
    const speed = 0.45;
    travelRef.current = (travelRef.current + delta * speed) % 1;
    const t = travelRef.current;
    COMET_TRAIL_OFFSETS.forEach((offset, i) => {
      const group = trailRefs.current[i];
      if (!group) return;
      const u = (t + offset + 1) % 1;
      const pos = curve.getPoint(u);
      group.position.copy(pos);
    });
  });

  if (!active || reducedMotion) return null;

  return (
    <>
      {COMET_TRAIL_OFFSETS.map((offset, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) trailRefs.current[i] = el as unknown as THREE.Group;
          }}
        >
          <mesh
            scale={[
              COMET_TRAIL_SCALES[i],
              COMET_TRAIL_SCALES[i],
              COMET_TRAIL_SCALES[i],
            ]}
          >
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshBasicMaterial
              color={ARC_ACTIVE}
              transparent
              opacity={COMET_TRAIL_OPACITIES[i]}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

interface GlobeSceneProps {
  agentStates: AgentStates;
  activeCities: string[];
  connections?: Connection[];
  agentLocations?: Record<AgentId, AgentLocation>;
  currentStep?: number;
  runStatus?: string;
  runStartedAt?: number;
}

function GlobeScene({
  agentStates,
  activeCities,
  connections,
  agentLocations,
  currentStep,
  runStatus,
  runStartedAt,
}: GlobeSceneProps) {
  void activeCities;
  const earthMap = useTexture("/earth-day.jpg");
  const atmosphereRef = useRef<THREE.Mesh>(null);

  const markerPositions = useMemo(() => {
    const map = new Map<AgentId, THREE.Vector3>();
    const locs = agentLocations;
    agentOrder.forEach((id) => {
      const loc = locs?.[id] ?? getAgentLocation(id);
      map.set(
        id,
        latLonToVector3(loc.lat, loc.lon, EARTH_RADIUS + MARKER_RADIUS * 2),
      );
    });
    return map;
  }, [agentLocations]);

  const arcCurves = useMemo(() => {
    const locs = agentLocations;
    return (connections ?? []).map((c) => {
      const fromLoc = locs?.[c.from] ?? getAgentLocation(c.from);
      const toLoc = locs?.[c.to] ?? getAgentLocation(c.to);
      return {
        from: c.from,
        to: c.to,
        active: c.active,
        curve: (() => {
          const A = latLonToVector3(fromLoc.lat, fromLoc.lon, EARTH_RADIUS);
          const B = latLonToVector3(toLoc.lat, toLoc.lon, EARTH_RADIUS);
          const mid = A.clone().add(B).multiplyScalar(0.5);
          mid.normalize().multiplyScalar(EARTH_RADIUS * 1.15);
          return new THREE.QuadraticBezierCurve3(A, mid, B);
        })(),
      };
    });
  }, [connections, agentLocations]);

  const earthGeometry = useMemo(
    () => new THREE.SphereGeometry(EARTH_RADIUS, 32, 16),
    [],
  );
  const atmosphereGeometry = useMemo(
    () => new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 32, 16),
    [],
  );

  useFrame((state) => {
    const reducedMotion =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("reduce-motion");
    if (reducedMotion || !atmosphereRef.current) return;
    const mat = atmosphereRef.current.material as THREE.MeshBasicMaterial;
    if (!mat) return;
    const time = state.clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.2);
    mat.opacity = ATMOSPHERE_OPACITY * (1 + 0.35 * pulse);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={0.5} />

      <Stars
        radius={80}
        depth={50}
        count={3000}
        factor={3}
        saturation={0}
        fade
        speed={1}
      />

      {/* @ts-expect-error three.js BufferGeometry type mismatch with @react-three/fiber */}
      <mesh geometry={earthGeometry}>
        <meshStandardMaterial
          map={earthMap}
          color={COLOR_EARTH_FALLBACK}
          roughness={0.85}
          metalness={0.05}
          emissive="#0a0a12"
        />
      </mesh>

      {/* @ts-expect-error three.js BufferGeometry type mismatch with @react-three/fiber */}
      <mesh ref={atmosphereRef} geometry={atmosphereGeometry}>
        <meshBasicMaterial
          color={COLOR_ATMOSPHERE}
          transparent
          opacity={ATMOSPHERE_OPACITY}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {agentOrder.map((agentId, idx) => {
        const pos = markerPositions.get(agentId);
        if (!pos) return null;
        const status = agentStates[agentId] ?? "idle";
        const loc = agentLocations?.[agentId] ?? getAgentLocation(agentId);
        return (
          <CityMarker
            key={agentId}
            agentId={agentId}
            position={pos}
            status={status}
            locationName={loc.name}
            orderIndex={idx}
            runStatus={runStatus}
            runStartedAt={runStartedAt}
          />
        );
      })}

      {arcCurves.map(({ curve, active: arcActive }, i) => (
        <React.Fragment key={i}>
          <ArcLine
            curve={curve}
            active={arcActive}
            orderIndex={i}
            currentStep={currentStep}
          />
          <ArcTravelingGlow
            curve={curve}
            active={arcActive}
            orderIndex={i}
            currentStep={currentStep}
          />
        </React.Fragment>
      ))}
    </>
  );
}

export interface HolographicGlobeProps {
  agentStates: AgentStates;
  activeCities: string[];
  connections?: Connection[];
  /** Run-scoped agent→location; when provided, locations change per pipeline. */
  agentLocations?: Record<AgentId, AgentLocation>;
  /** When true, component fills parent height (e.g. min-h-[60vh] on run page). */
  fullHeight?: boolean;
  /** Current pipeline step (1–5) so map animations flow in sync with agents. */
  currentStep?: number;
  /** Run status so we can stagger animations by pipeline phase. */
  runStatus?: "pending" | "running" | "completed" | "failed" | "blocked";
  /** Timestamp (ms) when run started so marker/arc stagger is consistent when page loads mid-run. */
  runStartedAt?: number;
}

function GlobeCanvasWrapper({
  agentStates,
  activeCities,
  connections,
  agentLocations,
  fullHeight,
  currentStep,
  runStatus,
  runStartedAt,
}: HolographicGlobeProps) {
  void fullHeight;
  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 45 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <GlobeScene
          agentStates={agentStates}
          activeCities={activeCities}
          connections={connections}
          agentLocations={agentLocations}
          currentStep={currentStep}
          runStatus={runStatus}
          runStartedAt={runStartedAt}
        />
      </Suspense>
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={1.8}
        maxDistance={4}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}

const DynamicGlobeCanvas = dynamic(() => Promise.resolve(GlobeCanvasWrapper), {
  ssr: false,
});

export function HolographicGlobe({
  agentStates,
  activeCities,
  connections = [],
  agentLocations,
  fullHeight = false,
  currentStep,
  runStatus,
  runStartedAt,
}: HolographicGlobeProps) {
  const getLoc = (id: AgentId) => agentLocations?.[id] ?? getAgentLocation(id);
  return (
    <Card
      className={`relative flex w-full flex-col overflow-hidden border-sky-500/40 bg-slate-950 p-4 ${fullHeight ? "h-full min-h-[60vh]" : "h-80"}`}
    >
      <div
        className={`relative w-full flex-1 min-h-[280px] ${fullHeight ? "min-h-0" : ""}`}
      >
        <DynamicGlobeCanvas
          agentStates={agentStates}
          activeCities={activeCities}
          connections={connections}
          agentLocations={agentLocations}
          fullHeight={fullHeight}
          currentStep={currentStep}
          runStatus={runStatus}
          runStartedAt={runStartedAt}
        />
      </div>
      <div className="pointer-events-auto mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-100/80">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-sky-300/80">
            Agent mesh
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {agentOrder.map((agentId) => {
            const status = agentStates[agentId] ?? "idle";
            const isActive = status === "active";
            const isComplete = status === "complete";
            const isBlocked = status === "blocked" || status === "failed";
            let color = "bg-slate-600";
            if (isBlocked) color = "bg-red-500";
            else if (isComplete) color = "bg-emerald-500";
            else if (isActive) color = "bg-sky-400";
            const loc = getLoc(agentId);
            return (
              <div key={agentId} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${color} shadow-[0_0_10px_rgba(56,189,248,0.7)]`}
                />
                <span className="text-[11px] text-slate-100/80">
                  {getAgentById(agentId)?.name ?? agentId} ·{" "}
                  {formatLocationDisplay(loc)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
