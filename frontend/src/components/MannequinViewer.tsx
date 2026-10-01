"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

interface MannequinModelProps {
  textureUrl?: string | null;
}

function MannequinModel({ textureUrl }: MannequinModelProps) {
  const { nodes } = useGLTF("/models/Mannequin.glb") as any;

  // Dynamically load user texture if provided
  const garmentTexture = useMemo(() => {
    if (!textureUrl) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(textureUrl);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [textureUrl]);

  // Clean studio porcelain/clay body material
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        roughness: 0.55,
        metalness: 0.08,
      }),
    []
  );

  // Hair material (slate)
  const hairMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.65,
      }),
    []
  );

  // Shorts / bottom material
  const shortMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#64748b",
        roughness: 0.65,
      }),
    []
  );

  // Shoes material
  const shoeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.5,
      }),
    []
  );

  // Clothing material (Torso & Sleeve) using user's uploaded pattern/sketch
  const clothesMaterial = useMemo(() => {
    if (garmentTexture) {
      return new THREE.MeshStandardMaterial({
        map: garmentTexture,
        roughness: 0.65,
        metalness: 0.05,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.7,
      metalness: 0.0,
    });
  }, [garmentTexture]);

  return (
    <group dispose={null}>
      {/* Hair */}
      {nodes.Hair && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Hair.geometry}
          material={hairMaterial}
        />
      )}

      {/* Knuckles */}
      {nodes.Knuckles && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Knuckles.geometry}
          material={bodyMaterial}
        />
      )}

      {/* Legs */}
      {nodes.Legs && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Legs.geometry}
          material={bodyMaterial}
          position={[0, 0.617, 0]}
          scale={0.194}
        />
      )}

      {/* Neck */}
      {nodes.Neck && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Neck.geometry}
          material={bodyMaterial}
        />
      )}

      {/* Shoes */}
      {nodes.Shoes && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Shoes.geometry}
          material={shoeMaterial}
        />
      )}

      {/* Short */}
      {nodes.Short && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Short.geometry}
          material={shortMaterial}
        />
      )}

      {/* ── CLOTHES: SLEEVE ── (Applied texture) */}
      {nodes.Sleeve && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Sleeve.geometry}
          material={clothesMaterial}
        />
      )}

      {/* ── CLOTHES: TORSO ── (Applied texture) */}
      {nodes.Torso && (
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Torso.geometry}
          material={clothesMaterial}
          position={[0, 1.399, 0]}
          scale={0.141}
        />
      )}

      {/* Spine / Rig if present */}
      {nodes.spine && <primitive object={nodes.spine} />}
    </group>
  );
}

useGLTF.preload("/models/Mannequin.glb");

interface MannequinViewerProps {
  textureUrl?: string | null;
  className?: string;
}

export default function MannequinViewer({
  textureUrl,
  className = "w-full aspect-[9/16]",
}: MannequinViewerProps) {
  return (
    <div
      className={`relative rounded-md overflow-hidden bg-slate-50 border border-slate-200/80 shadow-2xs select-none ${className}`}
    >
      <Canvas
        camera={{ position: [0, 0.2, 2.5], fov: 42 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 4]} intensity={1.3} />
        <directionalLight position={[-4, 3, -2]} intensity={0.5} />
        <directionalLight position={[0, 2, 3]} intensity={0.4} />

        <Suspense fallback={null}>
          <Center>
            <MannequinModel textureUrl={textureUrl} />
          </Center>
          <ContactShadows
            position={[0, -0.9, 0]}
            opacity={0.35}
            scale={2.8}
            blur={2.5}
            far={1.5}
            color="#475569"
          />
        </Suspense>

        <OrbitControls
          enablePan={true}
          panSpeed={1}
          screenSpacePanning={true}
          target={[0, 0.16, 0]}
          minDistance={0.7}
          maxDistance={4.5}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
