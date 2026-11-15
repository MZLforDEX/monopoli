/**
 * Monopoli Nusantara — 3D Realistic HD Engine
 * Powered by Three.js with PBR materials, procedural models, dynamic lighting, and responsive mobile camera.
 */

const Board3D = {
  container: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  initialized: false,
  enabled: true,
  isSoftwareGl: false,

  // Meshes & Objects
  boardGroup: null,
  tilesGroup: null,
  tokensGroup: null,
  buildingsGroup: null,
  diceGroup: null,
  effectsGroup: null,

  tileMeshes: [],
  playerTokens: new Map(), // playerId -> { mesh, currentPosIndex }
  buildingMeshes: new Map(), // propertyId -> group
  diceMeshes: [],

  // Raycaster & Pointer gesture tracking
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  pointerDownPos: { x: 0, y: 0 },
  hoveredTile: null,
  selectedTileIndex: null,

  // Camera animation
  cameraAnimating: false,
  cameraTarget: new THREE.Vector3(0, 0, 0),
  cameraPosTarget: new THREE.Vector3(0, 19, 23),
  currentViewMode: '3d',

  // Lighting
  dirLight: null,
  ambientLight: null,
  spotLight: null,
  isNightMode: true,

  // Board dimensions
  boardSize: 22,
  boardThickness: 0.8,
  cornerSize: 2.7,
  regularWidth: 1.844,
  regularDepth: 2.7,

  // Tile 3D coordinates lookup
  tileCoords: [],

  init(containerEl) {
    if (this.initialized) return;
    this.container = containerEl || document.getElementById('canvas-3d-wrapper');
    if (!this.container) return;

    const width = Math.max(300, this.container.clientWidth || 640);
    const height = Math.max(300, this.container.clientHeight || 540);

    // 1. Scene (no distance fog so far tiles stay razor-sharp)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b101e);
    this.scene.fog = null;

    // 2. Camera (balanced framing so all 40 tiles & 4 corners fit cleanly on desktop & portrait mobile)
    const aspect = width / height;
    const baseFov = aspect < 0.85 ? 54 : 44;
    this.camera = new THREE.PerspectiveCamera(baseFov, aspect, 0.1, 180);
    const portraitScale = aspect < 1 ? Math.min(1.95, 0.95 / Math.max(0.45, aspect)) : 1;
    this.camera.position.set(0, 22.5 * portraitScale, 24.5 * portraitScale);
    this.cameraTarget.set(0, 0, aspect < 1 ? 0.5 : 1.1);
    this.cameraPosTarget.copy(this.camera.position);

    // 3. Renderer with Full HD supersampling & sRGB color accuracy
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });

    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererInfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      this.isSoftwareGl = /SwiftShader|Software|llvmpipe/i.test(rendererInfo);
    } catch (e) {
      this.isSoftwareGl = false;
    }

    const rawDpr = window.devicePixelRatio || 1;
    const targetDpr = this.isSoftwareGl ? Math.max(rawDpr, 1.5) : Math.min(Math.max(rawDpr, 1.5), 2.5);
    this.maxAnisotropy = Math.min(16, (this.renderer.capabilities && this.renderer.capabilities.getMaxAnisotropy()) || 8);

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(targetDpr);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2.1;
      this.controls.minDistance = 7;
      this.controls.maxDistance = 68;
      this.controls.target.copy(this.cameraTarget);
      this.controls.enablePan = false;
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Groups
    this.boardGroup = new THREE.Group();
    this.tilesGroup = new THREE.Group();
    this.tokensGroup = new THREE.Group();
    this.buildingsGroup = new THREE.Group();
    this.diceGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();

    this.scene.add(this.boardGroup);
    this.scene.add(this.tilesGroup);
    this.scene.add(this.tokensGroup);
    this.scene.add(this.buildingsGroup);
    this.scene.add(this.diceGroup);
    this.scene.add(this.effectsGroup);

    // 7. Calculate tile 3D coordinates (indices 0..39)
    this.calcTileCoords();

    // 8. Build 3D Board and Environment
    this.buildTableAndBoard();

    // 9. Create 3D Dice
    this.initDice();

    // 10. Event listeners & ResizeObserver
    this.setupEvents();

    this.initialized = true;

    // Render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  },

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 0.7);
    this.scene.add(this.ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x1a1410, 0.45);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5ea, 1.25);
    this.dirLight.position.set(8, 25, 12);
    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.dirLight.shadow.camera.near = 5;
      this.dirLight.shadow.camera.far = 45;
      this.dirLight.shadow.camera.left = -14;
      this.dirLight.shadow.camera.right = 14;
      this.dirLight.shadow.camera.top = 14;
      this.dirLight.shadow.camera.bottom = -14;
      this.dirLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.dirLight);

    this.spotLight = new THREE.SpotLight(0xffd700, 0.75, 32, Math.PI / 3.5, 0.35, 1);
    this.spotLight.position.set(0, 16, 0);
    this.spotLight.target.position.set(0, 0, 0);
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);
  },

  calcTileCoords() {
    this.tileCoords = [];
    const bHalf = this.boardSize / 2; // 11
    const cSize = this.cornerSize; // 2.7
    const rWidth = this.regularWidth; // 1.844
    const rDepth = this.regularDepth; // 2.7
    const halfC = cSize / 2;
    const cornerCenter = bHalf - halfC; // 9.65

    // Note: All tiles use local width (X) and depth (Z) before rotation!
    // Local -Z faces the center of the board (where color bar & houses sit).

    // Tile 0: START (Bottom-Right)
    this.tileCoords[0] = { x: cornerCenter, z: cornerCenter, width: cSize, depth: cSize, rot: 0, isCorner: true };

    // Tiles 1-9: Bottom edge (Right to Left), facing North (-Z is inward) -> rot = 0
    for (let i = 1; i <= 9; i++) {
      const x = cornerCenter - halfC - (i - 0.5) * rWidth;
      this.tileCoords[i] = { x, z: cornerCenter, width: rWidth, depth: rDepth, rot: 0, isCorner: false };
    }

    // Tile 10: Penjara (Bottom-Left)
    this.tileCoords[10] = { x: -cornerCenter, z: cornerCenter, width: cSize, depth: cSize, rot: -Math.PI / 2, isCorner: true };

    // Tiles 11-19: Left edge (Bottom to Top), facing East (+X is inward) -> rot = -Math.PI / 2
    for (let i = 11; i <= 19; i++) {
      const idx = i - 10;
      const z = cornerCenter - halfC - (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x: -cornerCenter, z, width: rWidth, depth: rDepth, rot: -Math.PI / 2, isCorner: false };
    }

    // Tile 20: Parkir Bebas (Top-Left)
    this.tileCoords[20] = { x: -cornerCenter, z: -cornerCenter, width: cSize, depth: cSize, rot: Math.PI, isCorner: true };

    // Tiles 21-29: Top edge (Left to Right), facing South (+Z is inward) -> rot = Math.PI
    for (let i = 21; i <= 29; i++) {
      const idx = i - 20;
      const x = -cornerCenter + halfC + (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x, z: -cornerCenter, width: rWidth, depth: rDepth, rot: Math.PI, isCorner: false };
    }

    // Tile 30: Masuk Penjara (Top-Right)
    this.tileCoords[30] = { x: cornerCenter, z: -cornerCenter, width: cSize, depth: cSize, rot: Math.PI / 2, isCorner: true };

    // Tiles 31-39: Right edge (Top to Bottom), facing West (-X is inward) -> rot = Math.PI / 2
    for (let i = 31; i <= 39; i++) {
      const idx = i - 30;
      const z = -cornerCenter + halfC + (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x: cornerCenter, z, width: rWidth, depth: rDepth, rot: Math.PI / 2, isCorner: false };
    }
  },

  buildTableAndBoard() {
    // 1. Luxury Table Surface beneath the board
    const tableGeo = new THREE.CylinderGeometry(28, 28, 1, 48);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x16110e,
      roughness: 0.5,
      metalness: 0.15
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.55;
    tableMesh.receiveShadow = true;
    this.boardGroup.add(tableMesh);

    // Outer table decorative brass/wood ring
    const ringGeo = new THREE.TorusGeometry(26, 0.55, 12, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2b1c12, roughness: 0.65, metalness: 0.2 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -0.05;
    this.boardGroup.add(ringMesh);

    // 2. Thick Mahogany Board Base
    const boardBaseGeo = new THREE.BoxGeometry(this.boardSize + 0.9, this.boardThickness, this.boardSize + 0.9);
    const boardBaseMat = new THREE.MeshStandardMaterial({
      color: 0x24140e,
      roughness: 0.38,
      metalness: 0.18
    });
    const boardBase = new THREE.Mesh(boardBaseGeo, boardBaseMat);
    boardBase.position.y = 0;
    boardBase.receiveShadow = true;
    boardBase.castShadow = true;
    this.boardGroup.add(boardBase);

    // Golden perimeter trim (sits flush around base edge, below center felt and tiles)
    const trimGeo = new THREE.BoxGeometry(this.boardSize + 0.96, 0.12, this.boardSize + 0.96);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xe5b842,
      roughness: 0.25,
      metalness: 0.75
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = this.boardThickness / 2 - 0.05;
    this.boardGroup.add(trimMesh);

    // 3. Center Board Felt / Canvas (2K Full-HD texture + max anisotropic filtering)
    const centerSize = this.boardSize - (this.cornerSize * 2);
    const centerCanvas = this.generateCenterCanvas(1536);
    const centerTexture = this.createCrispTexture(centerCanvas);

    const centerGeo = new THREE.PlaneGeometry(centerSize, centerSize);
    const centerMat = new THREE.MeshStandardMaterial({
      map: centerTexture,
      roughness: 0.78,
      metalness: 0.04
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.rotation.x = -Math.PI / 2;
    centerMesh.position.y = this.boardThickness / 2 + 0.025;
    centerMesh.receiveShadow = true;
    this.boardGroup.add(centerMesh);
  },

  createCrispTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = this.maxAnisotropy || 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return texture;
  },

  generateCenterCanvas(pixelSize = 1536) {
    const size = 768;
    const scale = pixelSize / size;
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(scale, scale);

    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, '#18243c');
    grad.addColorStop(0.65, '#0d1528');
    grad.addColorStop(1, '#080c18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Outer gold frame
    ctx.strokeStyle = 'rgba(229, 184, 66, 0.45)';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, size - 40, size - 40);

    ctx.save();
    ctx.translate(size / 2, size / 2);

    // Compass circle
    ctx.strokeStyle = 'rgba(229, 184, 66, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.39, 0, Math.PI * 2);
    ctx.stroke();

    // 8-Point Surya Majapahit / Wind Rose Star
    ctx.fillStyle = 'rgba(229, 184, 66, 0.1)';
    for (let r = 0; r < 8; r++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const isMajor = r % 2 === 0;
      const rayLen = isMajor ? size * 0.35 : size * 0.24;
      const rayWidth = isMajor ? 26 : 15;
      ctx.lineTo(-rayWidth, 0);
      ctx.lineTo(0, -rayLen);
      ctx.lineTo(rayWidth, 0);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(Math.PI / 4);
    }

    // Community & Chance deck slots on the board felt
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    // Chance deck slot (top-left diagonal)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-210, -250, 140, 90, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KESEMPATAN', -140, -200);

    // Community deck slot (bottom-right diagonal)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath();
    ctx.roundRect(70, 160, 140, 90, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.fillText('DANA UMUM', 140, 210);
    ctx.restore();

    // Center Emblem Typography
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('MONOPOLI', 0, -size * 0.03);

    const textGrad = ctx.createLinearGradient(-size * 0.28, 0, size * 0.28, 0);
    textGrad.addColorStop(0, '#f59e0b');
    textGrad.addColorStop(0.5, '#fde047');
    textGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = textGrad;
    ctx.font = '900 62px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('NUSANTARA', 0, size * 0.06);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('EDISI KEPULAUAN INDONESIA', 0, size * 0.14);

    ctx.restore();
    return canvas;
  },

  populateTiles(propertiesData) {
    if (!propertiesData || propertiesData.length === 0) return;

    while (this.tilesGroup.children.length > 0) {
      this.tilesGroup.remove(this.tilesGroup.children[0]);
    }
    this.tileMeshes = [];

    propertiesData.forEach((tileData, index) => {
      const coord = this.tileCoords[index];
      if (!coord) return;

      const tileMesh = this.createTileMesh(tileData, coord, index);
      this.tilesGroup.add(tileMesh);
      this.tileMeshes[index] = tileMesh;
    });
  },

  createTileMesh(tileData, coord, index) {
    const tileGroup = new THREE.Group();
    tileGroup.position.set(coord.x, this.boardThickness / 2 + 0.04, coord.z);
    tileGroup.rotation.y = coord.rot;
    tileGroup.datasetIndex = index;

    const w = coord.width;
    const d = coord.depth;
    const h = 0.06;

    const tileGeo = new THREE.BoxGeometry(w * 0.98, h, d * 0.98);
    const tileCanvas = this.generateTileTexture(tileData, coord);
    const texture = this.createCrispTexture(tileCanvas);

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.5, metalness: 0.25 });
    const topMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.58,
      metalness: 0.04
    });

    const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const mesh = new THREE.Mesh(tileGeo, materials);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    tileGroup.add(mesh);

    // Selection / Hover Glow Frame
    const frameGeo = new THREE.BoxGeometry(w * 0.995, h + 0.025, d * 0.995);
    const frameMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      wireframe: true,
      visible: false
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    tileGroup.add(frame);
    tileGroup.highlightFrame = frame;

    // Owner badge strip on outer edge of tile
    const ownerGeo = new THREE.BoxGeometry(w * 0.85, 0.05, 0.14);
    const ownerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false });
    const ownerStrip = new THREE.Mesh(ownerGeo, ownerMat);
    ownerStrip.position.set(0, h / 2 + 0.02, d * 0.45);
    tileGroup.add(ownerStrip);
    tileGroup.ownerStrip = ownerStrip;

    tileGroup.tileData = tileData;
    tileGroup.coord = coord;
    return tileGroup;
  },

  drawFittedText(ctx, text, cx, cy, maxWidth, startSize, minSize = 18, weight = '800', family = '"Plus Jakarta Sans", sans-serif') {
    let fontSize = startSize;
    ctx.font = `${weight} ${fontSize}px ${family}`;
    while (ctx.measureText(text).width > maxWidth && fontSize > minSize) {
      fontSize -= 1;
      ctx.font = `${weight} ${fontSize}px ${family}`;
    }
    ctx.fillText(text, cx, cy, maxWidth);
  },

  drawWrappedFittedTitle(ctx, text, cx, topY, maxWidth, startSize = 31) {
    const words = String(text || '').trim().split(/\s+/);
    let lines = [text];

    if (words.length >= 2) {
      if (words.length === 2) {
        // Keep short 2-word names on 1 line if they comfortably fit
        ctx.font = `800 ${startSize}px "Plus Jakarta Sans", sans-serif`;
        if (ctx.measureText(text).width > maxWidth * 0.92) {
          lines = [words[0], words[1]];
        }
      } else {
        const mid = Math.ceil(words.length / 2);
        lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lines.length === 1) {
      this.drawFittedText(ctx, lines[0], cx, topY + 20, maxWidth, startSize, 18, '800');
    } else {
      this.drawFittedText(ctx, lines[0], cx, topY + 6, maxWidth, startSize - 3, 17, '800');
      this.drawFittedText(ctx, lines[1], cx, topY + 36, maxWidth, startSize - 3, 17, '800');
    }
  },

  generateTileTexture(tile, coord) {
    const canvas = document.createElement('canvas');
    const isCorner = coord.isCorner;
    const texScale = 2; // 720x1024 regular tiles, 1024x1024 corner tiles for crisp Full HD clarity
    const cw = isCorner ? 512 : 360;
    const ch = 512;
    canvas.width = cw * texScale;
    canvas.height = ch * texScale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(texScale, texScale);

    // Deep slate card base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);

    // Outer & inner clean border frames
    ctx.strokeStyle = isCorner ? '#e5b842' : 'rgba(226, 232, 240, 0.24)';
    ctx.lineWidth = isCorner ? 8 : 5;
    ctx.strokeRect(6, 6, cw - 12, ch - 12);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, cw - 28, ch - 28);

    const safeMaxTextWidth = cw - 52;

    if (tile.type === 'property') {
      // 1. Top Color Group Header Band (inward edge where houses sit)
      const bandH = Math.round(ch * 0.21);
      ctx.fillStyle = tile.color || '#64748b';
      ctx.fillRect(10, 10, cw - 20, bandH);

      // Subtle glossy highlight on color band
      const bandGrad = ctx.createLinearGradient(0, 10, 0, 10 + bandH);
      bandGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      bandGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(10, 10, cw - 20, bandH);

      // Gold divider line below color band
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(10, 10 + bandH, cw - 20, 4);

      // 2. City Name (Auto-fitted inside safe padding)
      ctx.fillStyle = '#ffffff';
      this.drawWrappedFittedTitle(ctx, tile.name.toUpperCase(), cw / 2, bandH + 28, safeMaxTextWidth, 32);

      // 3. Iconic City Landmark Illustration Frame
      const artX = 26;
      const artY = 198;
      const artW = cw - 52;
      const artH = 210;
      if (typeof NusantaraLandmarks !== 'undefined') {
        NusantaraLandmarks.drawLandmarkOnCanvas(ctx, tile, artX, artY, artW, artH, true);
      }

      // 4. Bottom Price Pill inside border
      const pillW = cw - 64;
      const pillH = 52;
      const pillX = 32;
      const pillY = ch - 76;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawFittedText(
        ctx,
        `Rp${tile.price.toLocaleString('id-ID')}rb`,
        cw / 2,
        pillY + pillH / 2 + 1,
        pillW - 20,
        30,
        18,
        '800',
        '"JetBrains Mono", monospace'
      );

    } else if (isCorner) {
      // Corner Tiles (START, Penjara, Parkir Bebas, Ke Penjara)
      const cornerMeta = {
        'start':        { title: 'START',        sub: 'GAJI +Rp2.000rb', color: '#10b981' },
        'jail-visit':   { title: 'PENJARA',      sub: 'KUNJUNGAN',       color: '#f97316' },
        'free-parking': { title: 'PARKIR BEBAS', sub: 'ZONA AMAN',       color: '#38bdf8' },
        'go-to-jail':   { title: 'KE PENJARA',   sub: 'DITAHAN',         color: '#ef4444' }
      }[tile.type] || { title: tile.name.toUpperCase(), sub: '', color: '#fbbf24' };

      // Top Corner Header Banner (strictly inside inner border)
      ctx.fillStyle = cornerMeta.color;
      ctx.fillRect(18, 18, cw - 36, 72);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawFittedText(ctx, cornerMeta.title, cw / 2, 54, cw - 80, 38, 20, '900');

      // Iconic Corner Illustration
      const artX = 36;
      const artY = 104;
      const artW = cw - 72;
      const artH = 286;
      if (typeof NusantaraLandmarks !== 'undefined') {
        NusantaraLandmarks.drawLandmarkOnCanvas(ctx, tile, artX, artY, artW, artH, true);
      }

      // Bottom Subtitle Pill (well inside inner border)
      const pillW = cw - 88;
      const pillH = 54;
      const pillX = 44;
      const pillY = ch - 86;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawFittedText(ctx, cornerMeta.sub, cw / 2, pillY + pillH / 2 + 1, pillW - 24, 26, 16, '800');

    } else {
      // Non-Corner Special Tiles (Airport, Utility, Tax, Chance, Community)
      const badgeConfig = {
        'airport':   { label: 'BANDARA',     color: '#0284c7' },
        'utility':   { label: 'UTILITAS',    color: '#ca8a04' },
        'tax':       { label: 'PAJAK NEGARA',color: '#dc2626' },
        'chance':    { label: 'KESEMPATAN',  color: '#d97706' },
        'community': { label: 'DANA UMUM',   color: '#0284c7' }
      }[tile.type] || { label: 'NUSANTARA', color: '#475569' };

      // Top Category Strip
      ctx.fillStyle = badgeConfig.color;
      ctx.fillRect(10, 10, cw - 20, 58);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawFittedText(ctx, badgeConfig.label, cw / 2, 39, safeMaxTextWidth, 24, 16, '800');

      // Tile Title
      ctx.fillStyle = '#f8fafc';
      this.drawWrappedFittedTitle(ctx, tile.name.toUpperCase(), cw / 2, 86, safeMaxTextWidth, 29);

      // Iconic Special Tile Illustration
      const artX = 26;
      const artY = 166;
      const artW = cw - 52;
      const artH = 242;
      if (typeof NusantaraLandmarks !== 'undefined') {
        NusantaraLandmarks.drawLandmarkOnCanvas(ctx, tile, artX, artY, artW, artH, true);
      }

      // Bottom Price or Action Pill
      const bottomText = tile.price
        ? `Rp${tile.price.toLocaleString('id-ID')}rb`
        : (tile.type === 'chance' ? 'AMBIL KARTU' : 'DANA UMUM');

      const pillW = cw - 64;
      const pillH = 52;
      const pillX = 32;
      const pillY = ch - 76;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawFittedText(
        ctx,
        bottomText,
        cw / 2,
        pillY + pillH / 2 + 1,
        pillW - 20,
        tile.price ? 30 : 24,
        16,
        '800',
        tile.price ? '"JetBrains Mono", monospace' : '"Plus Jakarta Sans", sans-serif'
      );
    }

    return canvas;
  },

  getPlayerColorHex(tokenType, playerIndex = 0) {
    const tokenColors = {
      merah: 0xef4444,
      biru: 0x38bdf8,
      hijau: 0x10b981,
      kuning: 0xfacc15,
      becak: 0xef4444,
      pinisi: 0x38bdf8,
      komodo: 0x10b981,
      bajaj: 0xfacc15
    };
    if (tokenColors[tokenType]) return tokenColors[tokenType];
    const fallback = [0xef4444, 0x38bdf8, 0x10b981, 0xfacc15];
    return fallback[playerIndex % fallback.length];
  },

  buildTokenMesh(tokenType, playerIndex = 0) {
    const group = new THREE.Group();
    const pColor = this.getPlayerColorHex(tokenType, playerIndex);

    // Dark obsidian pedestal for sharp contrast against every tile color
    const pedestalGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.1, 28);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.28,
      metalness: 0.72
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.05;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // Crisp colored base ring matching the pawn color
    const ringGeo = new THREE.TorusGeometry(0.49, 0.042, 12, 28);
    const ringMat = new THREE.MeshBasicMaterial({ color: pColor });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);

    const pawn = this.buildPawnModel(pColor);
    pawn.position.y = 0.09;
    group.add(pawn);

    group.scale.set(0.84, 0.84, 0.84);
    return group;
  },

  buildPawnModel(pawnColor) {
    const g = new THREE.Group();

    const pawnMat = new THREE.MeshStandardMaterial({
      color: pawnColor,
      roughness: 0.18,
      metalness: 0.16
    });
    const collarAccentMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.25,
      metalness: 0.75
    });

    // Classic sculpted board-game pawn silhouette via LatheGeometry
    const profile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.39, 0.0),
      new THREE.Vector2(0.39, 0.09),
      new THREE.Vector2(0.32, 0.16),
      new THREE.Vector2(0.24, 0.25),
      new THREE.Vector2(0.16, 0.48),
      new THREE.Vector2(0.14, 0.67),
      new THREE.Vector2(0.26, 0.72),
      new THREE.Vector2(0.26, 0.76),
      new THREE.Vector2(0.14, 0.80),
      new THREE.Vector2(0.0, 0.84)
    ];

    const bodyGeo = new THREE.LatheGeometry(profile, 32);
    const body = new THREE.Mesh(bodyGeo, pawnMat);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Subtle metallic collar trim for definition even on bright pawns
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.022, 10, 28), collarAccentMat);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.74;
    g.add(collarRing);

    // Classic spherical pawn head
    const headGeo = new THREE.SphereGeometry(0.255, 28, 22);
    const head = new THREE.Mesh(headGeo, pawnMat);
    head.position.y = 1.01;
    head.castShadow = true;
    head.receiveShadow = true;
    g.add(head);

    return g;
  },

  createHouseMesh() {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.2 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.1 });

    const walls = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), wallMat);
    walls.position.y = 0.11;
    walls.castShadow = true;
    g.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 4), roofMat);
    roof.position.y = 0.3;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);

    return g;
  },

  createHotelMesh() {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.25, metalness: 0.3 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.8 });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.36), wallMat);
    tower.position.y = 0.26;
    tower.castShadow = true;
    g.add(tower);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.3), roofMat);
    roof.position.y = 0.56;
    g.add(roof);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.22, 8), roofMat);
    spire.position.y = 0.7;
    g.add(spire);

    return g;
  },

  updateBuildings(boardState, players = []) {
    if (!boardState) return;

    while (this.buildingsGroup.children.length > 0) {
      this.buildingsGroup.remove(this.buildingsGroup.children[0]);
    }
    this.buildingMeshes.clear();

    for (const [id, state] of Object.entries(boardState)) {
      const tileIndex = parseInt(id, 10);
      const coord = this.tileCoords[tileIndex];
      if (!coord) continue;

      // Update 3D tile owner strip color
      const tileMesh = this.tileMeshes[tileIndex];
      if (tileMesh && tileMesh.ownerStrip) {
        if (state.ownerId && !state.mortgaged) {
          const ownerIdx = players.findIndex(p => p.id === state.ownerId);
          const ownerPlayer = players[ownerIdx];
          const colorHex = ownerPlayer ? this.getPlayerColorHex(ownerPlayer.token, ownerIdx) : 0xfbbf24;
          tileMesh.ownerStrip.material.color.setHex(colorHex);
          tileMesh.ownerStrip.material.visible = true;
        } else if (state.mortgaged) {
          tileMesh.ownerStrip.material.color.setHex(0x64748b);
          tileMesh.ownerStrip.material.visible = true;
        } else {
          tileMesh.ownerStrip.material.visible = false;
        }
      }

      if (!state.hotel && (!state.houses || state.houses <= 0)) continue;

      const group = new THREE.Group();
      group.position.set(coord.x, this.boardThickness / 2 + 0.06, coord.z);
      group.rotation.y = coord.rot;

      if (state.hotel) {
        const hotel = this.createHotelMesh();
        hotel.position.set(0, 0, coord.isCorner ? 0 : -coord.depth * 0.33);
        group.add(hotel);
      } else if (state.houses > 0) {
        const houseCount = state.houses;
        const spacing = (coord.width * 0.78) / 4;
        const startX = -((houseCount - 1) * spacing) / 2;

        for (let h = 0; h < houseCount; h++) {
          const house = this.createHouseMesh();
          house.position.set(startX + h * spacing, 0, coord.isCorner ? 0 : -coord.depth * 0.35);
          group.add(house);
        }
      }

      this.buildingsGroup.add(group);
      this.buildingMeshes.set(tileIndex, group);
    }
  },

  initDice() {
    this.diceMeshes = [];
    while (this.diceGroup.children.length > 0) {
      this.diceGroup.remove(this.diceGroup.children[0]);
    }

    const d1 = this.createSingleDie();
    const d2 = this.createSingleDie();

    d1.position.set(-1.1, this.boardThickness / 2 + 0.38, 0);
    d2.position.set(1.1, this.boardThickness / 2 + 0.38, 0);

    this.diceGroup.add(d1);
    this.diceGroup.add(d2);
    this.diceMeshes = [d1, d2];
  },

  createSingleDie() {
    const size = 0.74;
    const geo = new THREE.BoxGeometry(size, size, size);

    const materials = [];
    for (let face = 1; face <= 6; face++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(2, 2);

      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 122, 122);

      ctx.fillStyle = face === 1 ? '#e11d48' : '#0f172a';
      const r = 12;

      const drawDot = (x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      if (face === 1) drawDot(64, 64);
      else if (face === 2) { drawDot(36, 36); drawDot(92, 92); }
      else if (face === 3) { drawDot(36, 36); drawDot(64, 64); drawDot(92, 92); }
      else if (face === 4) { drawDot(36, 36); drawDot(92, 36); drawDot(36, 92); drawDot(92, 92); }
      else if (face === 5) { drawDot(36, 36); drawDot(92, 36); drawDot(64, 64); drawDot(36, 92); drawDot(92, 92); }
      else if (face === 6) {
        drawDot(36, 30); drawDot(92, 30);
        drawDot(36, 64); drawDot(92, 64);
        drawDot(36, 98); drawDot(92, 98);
      }

      const tex = this.createCrispTexture(canvas);
      materials.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.08 }));
    }

    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  rollDice3D(d1Val, d2Val, callback) {
    if (this.diceMeshes.length < 2) {
      if (callback) callback();
      return;
    }
    const [die1, die2] = this.diceMeshes;

    const startY = 3.6;
    const endY = this.boardThickness / 2 + 0.38;
    const duration = 900;
    const startTime = performance.now();

    const getFaceRotation = (val) => {
      switch (val) {
        case 1: return { x: 0, z: Math.PI / 2 };
        case 2: return { x: 0, z: -Math.PI / 2 };
        case 3: return { x: 0, z: 0 };
        case 4: return { x: Math.PI, z: 0 };
        case 5: return { x: -Math.PI / 2, z: 0 };
        case 6: return { x: Math.PI / 2, z: 0 };
        default: return { x: 0, z: 0 };
      }
    };

    const targetRot1 = getFaceRotation(d1Val);
    const targetRot2 = getFaceRotation(d2Val);

    const spins1 = { x: 4 * Math.PI, y: 2 * Math.PI, z: 2 * Math.PI };
    const spins2 = { x: -4 * Math.PI, y: -2 * Math.PI, z: 2 * Math.PI };

    const animateRoll = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const bounceHeight = Math.sin(progress * Math.PI * 3) * (1 - progress) * 1.3;
      const currentY = THREE.MathUtils.lerp(startY, endY, easeOut) + Math.max(0, bounceHeight);

      die1.position.y = currentY;
      die2.position.y = currentY;

      if (progress < 1) {
        const remaining = 1 - progress;
        die1.rotation.x = targetRot1.x + spins1.x * remaining;
        die1.rotation.y = spins1.y * remaining;
        die1.rotation.z = targetRot1.z + spins1.z * remaining;

        die2.rotation.x = targetRot2.x + spins2.x * remaining;
        die2.rotation.y = spins2.y * remaining;
        die2.rotation.z = targetRot2.z + spins2.z * remaining;

        requestAnimationFrame(animateRoll);
      } else {
        die1.position.y = endY;
        die2.position.y = endY;
        die1.rotation.set(targetRot1.x, 0, targetRot1.z);
        die2.rotation.set(targetRot2.x, 0, targetRot2.z);

        if (d1Val === d2Val) {
          this.spawnDoubleBurst();
        }
        if (callback) callback();
      }
    };

    requestAnimationFrame(animateRoll);
  },

  spawnDoubleBurst() {
    const burstGeo = new THREE.RingGeometry(0.2, 1.6, 32);
    const burstMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const burst = new THREE.Mesh(burstGeo, burstMat);
    burst.rotation.x = -Math.PI / 2;
    burst.position.set(0, this.boardThickness / 2 + 0.39, 0);
    this.effectsGroup.add(burst);

    let scale = 1;
    const fadeBurst = () => {
      scale += 0.08;
      burst.scale.set(scale, scale, scale);
      burstMat.opacity -= 0.05;
      if (burstMat.opacity > 0) {
        requestAnimationFrame(fadeBurst);
      } else {
        this.effectsGroup.remove(burst);
      }
    };
    fadeBurst();
  },

  updatePlayers(players) {
    if (!players) return;

    players.forEach((p, idx) => {
      if (p.bankrupt) {
        if (this.playerTokens.has(p.id)) {
          this.tokensGroup.remove(this.playerTokens.get(p.id).mesh);
          this.playerTokens.delete(p.id);
        }
        return;
      }

      let pData = this.playerTokens.get(p.id);
      if (!pData) {
        const mesh = this.buildTokenMesh(p.token, idx);
        this.tokensGroup.add(mesh);
        pData = { mesh, currentPosIndex: p.position };
        this.playerTokens.set(p.id, pData);
      }

      const coord = this.tileCoords[p.position];
      if (coord) {
        const offset = this.getPlayerTileOffset(p.id, p.position, players);
        pData.mesh.position.set(coord.x + offset.x, this.boardThickness / 2 + 0.05, coord.z + offset.z);
        pData.currentPosIndex = p.position;
      }
    });
  },

  getPlayerTileOffset(playerId, tileIndex, players) {
    const playersOnTile = players.filter(p => !p.bankrupt && p.position === tileIndex);
    const myIndex = playersOnTile.findIndex(p => p.id === playerId);
    if (playersOnTile.length <= 1 || myIndex === -1) return { x: 0, z: 0 };

    const offsets = [
      { x: -0.4, z: -0.4 },
      { x: 0.4, z: -0.4 },
      { x: -0.4, z: 0.4 },
      { x: 0.4, z: 0.4 }
    ];
    return offsets[myIndex % offsets.length];
  },

  animatePlayerMove3D(playerId, fromPos, toPos, players, onStepCallback) {
    return new Promise((resolve) => {
      const pData = this.playerTokens.get(playerId);
      if (!pData) {
        this.updatePlayers(players);
        resolve();
        return;
      }

      const steps = [];
      let pos = fromPos;
      let guard = 0;
      while (pos !== toPos && guard < 42) {
        pos = (pos + 1) % 40;
        steps.push(pos);
        guard++;
      }

      if (steps.length === 0) {
        resolve();
        return;
      }

      let stepIdx = 0;
      const hopDuration = 140;

      const hopNextTile = () => {
        if (stepIdx >= steps.length) {
          this.updatePlayers(players);
          resolve();
          return;
        }

        const targetTile = steps[stepIdx];
        const nextCoord = this.tileCoords[targetTile];
        const prevPos = pData.mesh.position.clone();
        const nextPos = new THREE.Vector3(nextCoord.x, this.boardThickness / 2 + 0.05, nextCoord.z);
        const startTime = performance.now();

        const dir = nextPos.clone().sub(prevPos);
        if (dir.lengthSq() > 0.001) {
          pData.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }

        const animateHop = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / hopDuration, 1);

          const hopHeight = Math.sin(t * Math.PI) * 0.95;
          pData.mesh.position.x = THREE.MathUtils.lerp(prevPos.x, nextPos.x, t);
          pData.mesh.position.z = THREE.MathUtils.lerp(prevPos.z, nextPos.z, t);
          pData.mesh.position.y = THREE.MathUtils.lerp(prevPos.y, nextPos.y, t) + hopHeight;

          if (t < 1) {
            requestAnimationFrame(animateHop);
          } else {
            pData.mesh.position.copy(nextPos);
            pData.currentPosIndex = targetTile;
            if (onStepCallback) onStepCallback(targetTile);
            stepIdx++;
            setTimeout(hopNextTile, 25);
          }
        };

        requestAnimationFrame(animateHop);
      };

      hopNextTile();
    });
  },

  setCameraView(mode) {
    if (!this.controls || !this.camera) return;
    this.currentViewMode = mode;
    this.cameraAnimating = true;
    const aspect = this.camera.aspect || 1;
    const portraitScale = aspect < 1 ? Math.min(1.95, 0.95 / Math.max(0.45, aspect)) : 1;

    switch (mode) {
      case '3d':
        this.cameraPosTarget.set(0, 22.5 * portraitScale, 24.5 * portraitScale);
        this.cameraTarget.set(0, 0, aspect < 1 ? 0.5 : 1.1);
        break;
      case 'top':
        this.cameraPosTarget.set(0, 29.5 * portraitScale, 0.1);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'corner':
        this.cameraPosTarget.set(16.8 * portraitScale, 15.0 * portraitScale, 16.8 * portraitScale);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'focus':
        if (window.gameState) {
          const curr = window.gameState.players.find(p => p.id === window.gameState.currentPlayerId);
          if (curr && this.tileCoords[curr.position]) {
            const c = this.tileCoords[curr.position];
            this.cameraPosTarget.set(c.x * 1.25, 9.5 * portraitScale, c.z * 1.25 + 6.5);
            this.cameraTarget.set(c.x, 0, c.z);
          }
        }
        break;
    }
  },

  toggleLighting() {
    this.isNightMode = !this.isNightMode;
    if (this.isNightMode) {
      this.scene.background.set(0x0b101e);
      if (this.scene.fog) this.scene.fog.color.set(0x0b101e);
      this.ambientLight.color.set(0xffeedd);
      this.ambientLight.intensity = 0.72;
      this.dirLight.intensity = 1.25;
    } else {
      this.scene.background.set(0x16243b);
      if (this.scene.fog) this.scene.fog.color.set(0x16243b);
      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 0.95;
      this.dirLight.intensity = 1.5;
    }
  },

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const aspect = w / h;
    const rawDpr = window.devicePixelRatio || 1;
    const targetDpr = this.isSoftwareGl ? Math.max(rawDpr, 1.5) : Math.min(Math.max(rawDpr, 1.5), 2.5);
    this.renderer.setPixelRatio(targetDpr);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.85 ? 54 : 44;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.setCameraView(this.currentViewMode || '3d');
  },

  setupEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleHover();
    });

    dom.addEventListener('pointerup', (e) => {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return; // Ignore orbit drags
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleClick();
    });

    window.addEventListener('resize', () => this.handleResize());

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.handleResize());
      ro.observe(this.container);
    }
  },

  handleHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tilesGroup.children, true);

    if (intersects.length > 0) {
      let topGroup = intersects[0].object;
      while (topGroup.parent && topGroup.parent !== this.tilesGroup) {
        topGroup = topGroup.parent;
      }

      if (this.hoveredTile && this.hoveredTile !== topGroup) {
        if (this.hoveredTile.highlightFrame && this.hoveredTile.datasetIndex !== this.selectedTileIndex) {
          this.hoveredTile.highlightFrame.material.visible = false;
        }
      }

      this.hoveredTile = topGroup;
      if (this.hoveredTile.highlightFrame) {
        this.hoveredTile.highlightFrame.material.visible = true;
      }
      this.container.style.cursor = 'pointer';
    } else {
      if (this.hoveredTile) {
        if (this.hoveredTile.highlightFrame && this.hoveredTile.datasetIndex !== this.selectedTileIndex) {
          this.hoveredTile.highlightFrame.material.visible = false;
        }
        this.hoveredTile = null;
      }
      this.container.style.cursor = 'grab';
    }
  },

  handleClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tilesGroup.children, true);

    if (intersects.length > 0) {
      let topGroup = intersects[0].object;
      while (topGroup.parent && topGroup.parent !== this.tilesGroup) {
        topGroup = topGroup.parent;
      }

      const tileIndex = topGroup.datasetIndex;
      if (typeof tileIndex !== 'undefined') {
        this.selectTile(tileIndex);
      }
    }
  },

  selectTile(index) {
    if (this.selectedTileIndex !== null && this.tileMeshes[this.selectedTileIndex]) {
      this.tileMeshes[this.selectedTileIndex].highlightFrame.material.visible = false;
    }

    this.selectedTileIndex = index;
    if (this.tileMeshes[index]) {
      this.tileMeshes[index].highlightFrame.material.visible = true;
    }

    if (typeof showTileInfo === 'function') {
      showTileInfo(index, true);
    }
  },

  animate() {
    requestAnimationFrame(this.animate);
    if (!this.enabled) return;

    if (this.cameraAnimating && this.controls) {
      this.camera.position.lerp(this.cameraPosTarget, 0.1);
      this.controls.target.lerp(this.cameraTarget, 0.1);

      if (this.camera.position.distanceTo(this.cameraPosTarget) < 0.12) {
        this.cameraAnimating = false;
      }
    }

    if (this.controls) {
      this.controls.update();
    }

    const time = performance.now() * 0.003;
    for (const [, pData] of this.playerTokens) {
      if (pData && pData.mesh) {
        pData.mesh.rotation.z = Math.sin(time + pData.currentPosIndex) * 0.025;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
};
