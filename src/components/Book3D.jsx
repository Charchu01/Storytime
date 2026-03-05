import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCursor, Environment } from "@react-three/drei";
import * as THREE from "three";

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71; // 3:4 aspect
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const COVER_THICKNESS = 0.02;
const COVER_OVERHANG = 0.015; // Cover slightly larger than pages
const TURN_SPEED = 4;

// ── Texture loader with caching ──────────────────────────────────────────────
const textureCache = new Map();
const loader = new THREE.TextureLoader();

function loadTexture(url) {
  if (!url) return null;
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = loader.load(url, (t) => {
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
  });
  textureCache.set(url, tex);
  return tex;
}

// ── Blank page material ──────────────────────────────────────────────────────
const blankPageMaterial = new THREE.MeshStandardMaterial({
  color: "#FFF9F2",
  roughness: 0.85,
  metalness: 0,
  side: THREE.FrontSide,
});

// ── Page curl deformation ────────────────────────────────────────────────────
function applyPageCurl(geometry, turnProgress, direction = 1) {
  const positions = geometry.attributes.position;
  const count = positions.count;

  // turnProgress: 0 = flat (right side), 1 = fully turned (left side)
  // During the middle of the turn, the page curls
  const curlAmount = Math.sin(turnProgress * Math.PI) * 0.12;
  const liftAmount = Math.sin(turnProgress * Math.PI) * 0.08;

  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const normalizedX = x / PAGE_WIDTH; // 0 at spine, 1 at edge

    // Curl: page bends along its width
    const curl = Math.sin(normalizedX * Math.PI) * curlAmount;
    // Lift: outer edge lifts more
    const lift = normalizedX * liftAmount;

    positions.setZ(i, curl + lift);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

// ── Single Page ──────────────────────────────────────────────────────────────
function Page({ pageIndex, frontUrl, backUrl, isFlipped, zOffset, onClick }) {
  const groupRef = useRef();
  const frontMeshRef = useRef();
  const backMeshRef = useRef();
  const [hover, setHover] = useState(false);
  const prevProgress = useRef(isFlipped ? 1 : 0);
  useCursor(hover);

  const frontTexture = useMemo(() => loadTexture(frontUrl), [frontUrl]);
  const backTexture = useMemo(() => loadTexture(backUrl), [backUrl]);

  const frontGeometry = useMemo(
    () => new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_SEGMENTS, 1),
    []
  );
  const backGeometry = useMemo(
    () => new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_SEGMENTS, 1),
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const target = isFlipped ? -Math.PI : 0;
    const current = groupRef.current.rotation.y;
    const newRotation = THREE.MathUtils.lerp(current, target, delta * TURN_SPEED);
    groupRef.current.rotation.y = newRotation;

    // Calculate turn progress for curl (0 = flat right, 1 = flat left)
    const progress = Math.abs(newRotation) / Math.PI;

    // Only apply curl when actually animating
    if (Math.abs(progress - prevProgress.current) > 0.001) {
      applyPageCurl(frontGeometry, progress);
      applyPageCurl(backGeometry, progress);
      prevProgress.current = progress;
    }
  });

  const frontMat = useMemo(() => {
    if (frontTexture) {
      return new THREE.MeshStandardMaterial({
        map: frontTexture,
        roughness: 0.85,
        metalness: 0,
        side: THREE.FrontSide,
      });
    }
    return blankPageMaterial;
  }, [frontTexture]);

  const backMat = useMemo(() => {
    if (backTexture) {
      return new THREE.MeshStandardMaterial({
        map: backTexture,
        roughness: 0.85,
        metalness: 0,
        side: THREE.FrontSide,
      });
    }
    return blankPageMaterial;
  }, [backTexture]);

  return (
    <group
      ref={groupRef}
      position={[0, 0, zOffset]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {/* Front face */}
      <mesh
        ref={frontMeshRef}
        position={[PAGE_WIDTH / 2, 0, 0.001]}
        geometry={frontGeometry}
      >
        <primitive object={frontMat} attach="material" />
      </mesh>
      {/* Back face (mirrored) */}
      <mesh
        ref={backMeshRef}
        position={[PAGE_WIDTH / 2, 0, -0.001]}
        rotation={[0, Math.PI, 0]}
        geometry={backGeometry}
      >
        <primitive object={backMat} attach="material" />
      </mesh>
    </group>
  );
}

// ── Book Cover ───────────────────────────────────────────────────────────────
function BookCover({ textureUrl, isBack, isFlipped }) {
  const groupRef = useRef();
  const texture = useMemo(() => loadTexture(textureUrl), [textureUrl]);

  const materials = useMemo(() => {
    const binding = new THREE.MeshStandardMaterial({
      color: "#1a3a5c",
      roughness: 0.4,
      metalness: 0.1,
    });
    const face = texture
      ? new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.4,
          metalness: 0.05,
        })
      : new THREE.MeshStandardMaterial({
          color: "#1a3a5c",
          roughness: 0.4,
          metalness: 0.1,
        });
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z (front), -Z (back)
    return isBack
      ? [binding, binding, binding, binding, binding, face]
      : [binding, binding, binding, binding, face, binding];
  }, [texture, isBack]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = isFlipped ? -Math.PI : 0;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      target,
      delta * TURN_SPEED
    );
  });

  const coverW = PAGE_WIDTH + COVER_OVERHANG * 2;
  const coverH = PAGE_HEIGHT + COVER_OVERHANG * 2;

  return (
    <group
      ref={groupRef}
      position={[0, 0, isBack ? -0.04 : 0.04]}
    >
      <mesh position={[coverW / 2, 0, 0]} material={materials}>
        <boxGeometry args={[coverW, coverH, COVER_THICKNESS]} />
      </mesh>
    </group>
  );
}

// ── Desk Environment ─────────────────────────────────────────────────────────
function DeskEnvironment() {
  return (
    <group>
      {/* Desk surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PAGE_HEIGHT / 2 - 0.05, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Candle */}
      <group position={[2.4, -PAGE_HEIGHT / 2 + 0.1, -1.2]}>
        {/* Glass jar */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.07, 0.2, 12]} />
          <meshStandardMaterial color="#FFFFFF" transparent opacity={0.2} roughness={0.1} />
        </mesh>
        {/* Wax */}
        <mesh position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.12, 8]} />
          <meshStandardMaterial color="#F5E6C8" />
        </mesh>
        {/* Flame light */}
        <pointLight color="#FF9944" intensity={0.6} distance={4} position={[0, 0.2, 0]} />
      </group>

      {/* Pencils */}
      {[
        { color: "#E63946", pos: [-2.3, -PAGE_HEIGHT / 2 + 0.01, 0.9], rot: 0.2 },
        { color: "#457B9D", pos: [-2.15, -PAGE_HEIGHT / 2 + 0.01, 1.0], rot: -0.12 },
        { color: "#2A9D8F", pos: [-2.0, -PAGE_HEIGHT / 2 + 0.01, 0.95], rot: 0.3 },
        { color: "#E9C46A", pos: [-2.1, -PAGE_HEIGHT / 2 + 0.01, 0.82], rot: -0.08 },
      ].map((p, i) => (
        <mesh key={i} position={p.pos} rotation={[Math.PI / 2, 0, p.rot]}>
          <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}

      {/* Small plant */}
      <group position={[-2.5, -PAGE_HEIGHT / 2, -1.3]}>
        {/* Pot */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.16, 8]} />
          <meshStandardMaterial color="#C4784A" roughness={0.9} />
        </mesh>
        {/* Foliage (simple spheres) */}
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#4A7C59" roughness={0.8} />
        </mesh>
        <mesh position={[0.06, 0.3, 0.04]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#5A8C69" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

// ── Camera Rig (subtle parallax) ─────────────────────────────────────────────
function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const basePos = useRef({ x: 0, y: 3.2, z: 2.8 });

  useEffect(() => {
    const handleMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 0.25;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 0.12;
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      basePos.current.x + mouse.current.x,
      0.02
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      basePos.current.z + mouse.current.y,
      0.02
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── Main Book Scene ──────────────────────────────────────────────────────────
function BookScene({ pages, currentPage, onPageChange, coverUrl, backCoverUrl }) {
  const totalPages = pages.length;

  // Click on a page to flip it
  const handlePageClick = useCallback(
    (pageIndex) => {
      if (pageIndex < currentPage) {
        // Click on a flipped page = go back
        onPageChange(pageIndex);
      } else {
        // Click on unflipped page = go forward
        onPageChange(pageIndex + 1);
      }
    },
    [currentPage, onPageChange]
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} color="#FFF5E6" />
      <directionalLight
        position={[3, 5, 4]}
        intensity={0.65}
        color="#FFF0D4"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Desk */}
      <DeskEnvironment />

      {/* Book group — centered at spine */}
      <group position={[0, 0, 0]}>
        {/* Front cover */}
        <BookCover textureUrl={coverUrl} isFlipped={currentPage > 0} />

        {/* Pages */}
        {pages.map((page, i) => (
          <Page
            key={i}
            pageIndex={i}
            frontUrl={page.front}
            backUrl={page.back}
            isFlipped={currentPage > i + 1}
            zOffset={(totalPages / 2 - i) * PAGE_DEPTH}
            onClick={() => handlePageClick(i + 1)}
          />
        ))}

        {/* Back cover */}
        <BookCover
          textureUrl={backCoverUrl}
          isBack
          isFlipped={currentPage > totalPages}
        />
      </group>

      <CameraRig />
    </>
  );
}

// ── Exported Book3D Canvas ───────────────────────────────────────────────────
export default function Book3D({
  pages,
  currentPage,
  onPageChange,
  coverUrl,
  backCoverUrl,
}) {
  return (
    <Canvas
      camera={{
        position: [0, 3.2, 2.8],
        fov: 42,
        near: 0.1,
        far: 50,
      }}
      shadows
      frameloop="always"
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <BookScene
        pages={pages}
        currentPage={currentPage}
        onPageChange={onPageChange}
        coverUrl={coverUrl}
        backCoverUrl={backCoverUrl}
      />
    </Canvas>
  );
}
