/**
 * Monopoli Nusantara — 3D Realistic HD Engine
 * Powered by Three.js with PBR materials, procedural models, dynamic lighting, and cinematic camera.
 */

const Board3D = {
  container: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  initialized: false,
  enabled: true,

  // Meshes & Objects
  boardGroup: null,
  tilesGroup: null,
  tokensGroup: null,
  buildingsGroup: null,
  diceGroup: null,
  effectsGroup: null,

  tileMeshes: [],
  playerTokens: new Map(), // playerId -> { mesh, targetPos, currentPosIndex, halo, light }
  buildingMeshes: new Map(), // propertyId -> array of meshes
  diceMeshes: [],

  // Raycaster for tile clicking
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  hoveredTile: null,
  selectedTileIndex: null,

  // Camera animation
  cameraAnimating: false,
  cameraTarget: new THREE.Vector3(0, 0, 0),
  cameraPosTarget: new THREE.Vector3(0, 18, 22),

  // Lighting
  dirLight: null,
  ambientLight: null,
  spotLight: null,
  isNightMode: true,

  // Board dimensions
  boardSize: 22,
  boardThickness: 0.8,
  cornerSize: 2.7,
  regularWidth: 1.84,
  regularDepth: 2.7,

  // Tile 3D coordinates lookup
  tileCoords: [],

  init(containerEl) {
    if (this.initialized) return;
    this.container = containerEl || document.getElementById('canvas-3d-wrapper');
    if (!this.container) return;

    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 640;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f1d);
    this.scene.fog = new THREE.FogExp2(0x0c0f1d, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    this.camera.position.set(0, 20, 24);

    // 3. Renderer with HD PBR settings
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2.05; // don't go under table
      this.controls.minDistance = 6;
      this.controls.maxDistance = 45;
      this.controls.target.set(0, 0, 0);
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

    // 10. Event listeners
    this.setupEvents();

    this.initialized = true;

    // Render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    console.log('🎮 3D Realistic HD Board initialized successfully!');
  },

  setupLighting() {
    // Soft warm ambient
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 0.6);
    this.scene.add(this.ambientLight);

    // Main chandelier / spotlight over the board
    this.dirLight = new THREE.DirectionalLight(0xfff5ea, 1.3);
    this.dirLight.position.set(8, 25, 12);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 45;
    this.dirLight.shadow.camera.left = -15;
    this.dirLight.shadow.camera.right = 15;
    this.dirLight.shadow.camera.top = 15;
    this.dirLight.shadow.camera.bottom = -15;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Secondary fill light for luxury highlights
    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.45);
    fillLight.position.set(-12, 15, -12);
    this.scene.add(fillLight);

    // Center jewel spotlight
    this.spotLight = new THREE.SpotLight(0xffd700, 0.8, 30, Math.PI / 4, 0.3, 1);
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
    const cornerCenter = bHalf - halfC; // 11 - 1.35 = 9.65

    // Tile 0: START (Bottom-Right)
    this.tileCoords[0] = { x: cornerCenter, z: cornerCenter, width: cSize, depth: cSize, rot: 0, isCorner: true };

    // Tiles 1-9: Bottom edge (Right to Left)
    for (let i = 1; i <= 9; i++) {
      const x = cornerCenter - halfC - (i - 0.5) * rWidth;
      this.tileCoords[i] = { x, z: cornerCenter, width: rWidth, depth: rDepth, rot: 0, isCorner: false };
    }

    // Tile 10: Penjara (Bottom-Left)
    this.tileCoords[10] = { x: -cornerCenter, z: cornerCenter, width: cSize, depth: cSize, rot: Math.PI / 2, isCorner: true };

    // Tiles 11-19: Left edge (Bottom to Top)
    for (let i = 11; i <= 19; i++) {
      const idx = i - 10;
      const z = cornerCenter - halfC - (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x: -cornerCenter, z, width: rDepth, depth: rWidth, rot: Math.PI / 2, isCorner: false };
    }

    // Tile 20: Parkir Bebas (Top-Left)
    this.tileCoords[20] = { x: -cornerCenter, z: -cornerCenter, width: cSize, depth: cSize, rot: Math.PI, isCorner: true };

    // Tiles 21-29: Top edge (Left to Right)
    for (let i = 21; i <= 29; i++) {
      const idx = i - 20;
      const x = -cornerCenter + halfC + (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x, z: -cornerCenter, width: rWidth, depth: rDepth, rot: Math.PI, isCorner: false };
    }

    // Tile 30: Masuk Penjara (Top-Right)
    this.tileCoords[30] = { x: cornerCenter, z: -cornerCenter, width: cSize, depth: cSize, rot: -Math.PI / 2, isCorner: true };

    // Tiles 31-39: Right edge (Top to Bottom)
    for (let i = 31; i <= 39; i++) {
      const idx = i - 30;
      const z = -cornerCenter + halfC + (idx - 0.5) * rWidth;
      this.tileCoords[i] = { x: cornerCenter, z, width: rDepth, depth: rWidth, rot: -Math.PI / 2, isCorner: false };
    }
  },

  buildTableAndBoard() {
    // 1. Luxury Table Surface beneath the board
    const tableGeo = new THREE.CylinderGeometry(28, 28, 1, 64);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x181310,
      roughness: 0.45,
      metalness: 0.15
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.55;
    tableMesh.receiveShadow = true;
    this.boardGroup.add(tableMesh);

    // Outer table decorative leather ring
    const ringGeo = new THREE.TorusGeometry(26, 0.6, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2b1c12, roughness: 0.7, metalness: 0.2 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -0.05;
    this.boardGroup.add(ringMesh);

    // 2. Thick Mahogany Board Base with beveled bevel edge
    const boardBaseGeo = new THREE.BoxGeometry(this.boardSize + 0.9, this.boardThickness, this.boardSize + 0.9);
    const boardBaseMat = new THREE.MeshStandardMaterial({
      color: 0x23140e,
      roughness: 0.35,
      metalness: 0.2
    });
    const boardBase = new THREE.Mesh(boardBaseGeo, boardBaseMat);
    boardBase.position.y = 0;
    boardBase.receiveShadow = true;
    boardBase.castShadow = true;
    this.boardGroup.add(boardBase);

    // Golden perimeter trim
    const trimGeo = new THREE.BoxGeometry(this.boardSize + 0.95, 0.12, this.boardSize + 0.95);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Metallic Gold
      roughness: 0.2,
      metalness: 0.85
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = this.boardThickness / 2 + 0.02;
    this.boardGroup.add(trimMesh);

    // 3. Center Board Felt / Canvas
    const centerSize = this.boardSize - (this.cornerSize * 2);
    const centerCanvas = this.generateCenterCanvas(centerSize * 40);
    const centerTexture = new THREE.CanvasTexture(centerCanvas);
    centerTexture.anisotropy = 8;

    const centerGeo = new THREE.PlaneGeometry(centerSize, centerSize);
    const centerMat = new THREE.MeshStandardMaterial({
      map: centerTexture,
      roughness: 0.7,
      metalness: 0.1
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.rotation.x = -Math.PI / 2;
    centerMesh.position.y = this.boardThickness / 2 + 0.03;
    centerMesh.receiveShadow = true;
    this.boardGroup.add(centerMesh);

    // Thin inner gold border around center felt
    const innerTrimGeo = new THREE.RingGeometry(centerSize * 0.49, centerSize * 0.505, 4);
    const innerTrimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
    const innerTrimMesh = new THREE.Mesh(innerTrimGeo, innerTrimMat);
    innerTrimMesh.rotation.x = -Math.PI / 2;
    innerTrimMesh.rotation.z = Math.PI / 4;
    innerTrimMesh.position.y = this.boardThickness / 2 + 0.035;
    this.boardGroup.add(innerTrimMesh);
  },

  generateCenterCanvas(size = 800) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Luxurious gradient background
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, '#1c2541');
    grad.addColorStop(0.65, '#0b132b');
    grad.addColorStop(1, '#070b1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Indonesian Batik / Geometric pattern ring
    ctx.save();
    ctx.translate(size / 2, size / 2);

    // Outer ornamental ring
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    // 8-Point Compass / Wind Rose Star
    ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
    for (let r = 0; r < 8; r++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const isMajor = r % 2 === 0;
      const rayLen = isMajor ? size * 0.36 : size * 0.25;
      const rayWidth = isMajor ? 28 : 16;
      ctx.lineTo(-rayWidth, 0);
      ctx.lineTo(0, -rayLen);
      ctx.lineTo(rayWidth, 0);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(Math.PI / 4);
    }

    // Monopoli Nusantara Emblem & Typography
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 12;

    // Island emoji/crest
    ctx.font = 'bold 72px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏝️', 0, -size * 0.11);

    // MONOPOLI text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 62px Inter, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('MONOPOLI', 0, -size * 0.01);

    // NUSANTARA gold gradient text
    const textGrad = ctx.createLinearGradient(-size * 0.3, 0, size * 0.3, 0);
    textGrad.addColorStop(0, '#f39c12');
    textGrad.addColorStop(0.5, '#f1c40f');
    textGrad.addColorStop(1, '#e67e22');
    ctx.fillStyle = textGrad;
    ctx.font = '900 66px Inter, sans-serif';
    ctx.fillText('NUSANTARA', 0, size * 0.08);

    // Subtitle tagline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 24px Inter, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('JELAJAHI INDONESIA, KUASAI NUSANTARA', 0, size * 0.17);

    // 4 Corner decorative accents
    ctx.fillStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.font = '32px Inter';
    ctx.fillText('🚲', -size * 0.34, -size * 0.34);
    ctx.fillText('⛵', size * 0.34, -size * 0.34);
    ctx.fillText('🛺', -size * 0.34, size * 0.34);
    ctx.fillText('🦎', size * 0.34, size * 0.34);

    ctx.restore();
    return canvas;
  },

  populateTiles(propertiesData) {
    if (!propertiesData || propertiesData.length === 0) return;

    // Clear old tiles if any
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

    console.log(`✅ Rendered 40 3D HD Tiles on the board!`);
  },

  createTileMesh(tileData, coord, index) {
    const tileGroup = new THREE.Group();
    tileGroup.position.set(coord.x, this.boardThickness / 2 + 0.04, coord.z);
    tileGroup.datasetIndex = index;

    const w = coord.width;
    const d = coord.depth;
    const h = 0.06;

    // 1. Tile Base Mesh
    const tileGeo = new THREE.BoxGeometry(w * 0.98, h, d * 0.98);
    const tileCanvas = this.generateTileTexture(tileData, coord);
    const texture = new THREE.CanvasTexture(tileCanvas);
    texture.anisotropy = 8;

    // Materials: top surface has HD texture, sides are slate
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1c2236, roughness: 0.5, metalness: 0.3 });
    const topMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.15
    });

    const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const mesh = new THREE.Mesh(tileGeo, materials);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    tileGroup.add(mesh);

    // 2. Selection / Hover Glow Frame
    const frameGeo = new THREE.BoxGeometry(w * 0.99, h + 0.02, d * 0.99);
    const frameMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      wireframe: true,
      visible: false
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    tileGroup.add(frame);
    tileGroup.highlightFrame = frame;

    tileGroup.tileData = tileData;
    tileGroup.coord = coord;
    return tileGroup;
  },

  generateTileTexture(tile, coord) {
    const canvas = document.createElement('canvas');
    const isCorner = coord.isCorner;
    const cw = isCorner ? 512 : 360;
    const ch = isCorner ? 512 : 512;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Tile orientation: bottom=0, left=PI/2, top=PI, right=-PI/2
    // We draw facing UP (canvas coordinates), and rotation handles orientation.

    // 1. Background
    ctx.fillStyle = '#181e33';
    ctx.fillRect(0, 0, cw, ch);

    // Subtle inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, cw - 8, ch - 8);

    if (tile.type === 'property') {
      // Color bar at top
      ctx.fillStyle = tile.color || '#999';
      ctx.fillRect(6, 6, cw - 12, ch * 0.26);

      // Thin separator
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(6, ch * 0.26, cw - 12, 4);

      // City Name
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 36px Inter, sans-serif';
      
      const words = tile.name.split(' ');
      if (words.length > 1 && tile.name.length > 10) {
        ctx.fillText(words[0], cw / 2, ch * 0.33);
        ctx.fillText(words.slice(1).join(' '), cw / 2, ch * 0.43);
      } else {
        ctx.fillText(tile.name, cw / 2, ch * 0.36);
      }

      // Landmark / City Icon
      ctx.font = '54px sans-serif';
      ctx.textBaseline = 'middle';
      const cityIcon = tile.group === 'brown' ? '🕌' :
                       tile.group === 'light-blue' ? '🌊' :
                       tile.group === 'purple' ? '🏛️' :
                       tile.group === 'orange' ? '🏙️' :
                       tile.group === 'red' ? '🌋' :
                       tile.group === 'yellow' ? '🌴' :
                       tile.group === 'green' ? '🌳' : '💎';
      ctx.fillText(cityIcon, cw / 2, ch * 0.65);

      // Price Tag at Bottom
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Rp${tile.price}rb`, cw / 2, ch - 16);

    } else if (isCorner) {
      // Corner Tiles
      ctx.fillStyle = '#141829';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, cw - 16, ch - 16);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (tile.type === 'start') {
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('🏁', cw / 2, ch * 0.32);
        ctx.fillStyle = '#2ecc71';
        ctx.font = '900 58px Inter, sans-serif';
        ctx.fillText('START', cw / 2, ch * 0.58);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.fillText('TERIMA Rp2JT', cw / 2, ch * 0.78);
      } else if (tile.type === 'jail-visit') {
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('🔒', cw / 2, ch * 0.32);
        ctx.fillStyle = '#e74c3c';
        ctx.font = '900 52px Inter, sans-serif';
        ctx.fillText('PENJARA', cw / 2, ch * 0.58);
        ctx.fillStyle = '#bdc3c7';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.fillText('HANYA BERKUNJUNG', cw / 2, ch * 0.78);
      } else if (tile.type === 'free-parking') {
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('🅿️', cw / 2, ch * 0.32);
        ctx.fillStyle = '#3498db';
        ctx.font = '900 50px Inter, sans-serif';
        ctx.fillText('PARKIR BEBAS', cw / 2, ch * 0.58);
        ctx.fillStyle = '#bdc3c7';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.fillText('ISTIRAHAT', cw / 2, ch * 0.78);
      } else if (tile.type === 'go-to-jail') {
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('🚔', cw / 2, ch * 0.32);
        ctx.fillStyle = '#e74c3c';
        ctx.font = '900 48px Inter, sans-serif';
        ctx.fillText('KE PENJARA', cw / 2, ch * 0.58);
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.fillText('LANGSUNG MASUK', cw / 2, ch * 0.78);
      }
    } else {
      // Airport, Utility, Tax, Chance, Community
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const typeIcons = {
        'airport': '✈️',
        'utility': tile.name === 'PLN' ? '⚡' : '💧',
        'tax': '💸',
        'chance': '❓',
        'community': '💳'
      };

      ctx.font = '64px sans-serif';
      ctx.fillText(typeIcons[tile.type] || '🎲', cw / 2, ch * 0.35);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.fillText(tile.name, cw / 2, ch * 0.62);

      if (tile.price) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.fillText(`Rp${tile.price}rb`, cw / 2, ch * 0.82);
      } else if (tile.type === 'chance' || tile.type === 'community') {
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText(tile.type === 'chance' ? 'KESEMPATAN' : 'DANA UMUM', cw / 2, ch * 0.82);
      }
    }

    return canvas;
  },

  /* ========================================================
     3D Procedural Token Figurine Models
     Becak, Pinisi, Bajaj, Komodo
     ======================================================== */
  buildTokenMesh(tokenType, playerIndex = 0) {
    const group = new THREE.Group();
    const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f]; // Player 1..4 colors
    const pColor = colors[playerIndex % colors.length];

    // Colored glowing circular pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.08, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.3,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.04;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // Glowing colored player ring
    const ringGeo = new THREE.TorusGeometry(0.58, 0.04, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: pColor });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.07;
    group.add(ring);

    // Realistic Token Model
    let model = null;
    switch (tokenType) {
      case 'becak':
        model = this.buildBecakModel(pColor);
        break;
      case 'pinisi':
        model = this.buildPinisiModel(pColor);
        break;
      case 'bajaj':
        model = this.buildBajajModel(pColor);
        break;
      case 'komodo':
      default:
        model = this.buildKomodoModel(pColor);
        break;
    }

    if (model) {
      model.position.y = 0.08;
      group.add(model);
    }

    group.scale.set(0.85, 0.85, 0.85);
    return group;
  },

  buildBecakModel(accentColor) {
    const g = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 0.9 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4, metalness: 0.3 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x331100, roughness: 0.8, metalness: 0.1 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });

    // Passenger Carriage Cabin
    const cabinGeo = new THREE.BoxGeometry(0.65, 0.35, 0.55);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 0.3, 0.15);
    cabin.castShadow = true;
    g.add(cabin);

    // Curved Canopy
    const canopyGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.65, 16, 1, false, 0, Math.PI);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.z = Math.PI / 2;
    canopy.position.set(0, 0.5, 0.12);
    canopy.castShadow = true;
    g.add(canopy);

    // Seat cushion
    const seatGeo = new THREE.BoxGeometry(0.55, 0.1, 0.35);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.32, 0.15);
    g.add(seat);

    // 2 Front Wheels
    const wheelGeo = new THREE.TorusGeometry(0.2, 0.025, 8, 24);
    const w1 = new THREE.Mesh(wheelGeo, rubberMat);
    w1.position.set(-0.38, 0.2, 0.25);
    w1.rotation.y = Math.PI / 2;
    w1.castShadow = true;
    g.add(w1);

    const w2 = w1.clone();
    w2.position.set(0.38, 0.2, 0.25);
    g.add(w2);

    // Rear frame & driver bicycle
    const frameGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
    const frame = new THREE.Mesh(frameGeo, chromeMat);
    frame.rotation.x = Math.PI / 3;
    frame.position.set(0, 0.28, -0.22);
    g.add(frame);

    // Rear single wheel
    const w3 = new THREE.Mesh(wheelGeo, rubberMat);
    w3.position.set(0, 0.2, -0.45);
    w3.rotation.y = Math.PI / 2;
    w3.castShadow = true;
    g.add(w3);

    // Saddle
    const saddleGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
    const saddle = new THREE.Mesh(saddleGeo, seatMat);
    saddle.rotation.x = Math.PI;
    saddle.position.set(0, 0.45, -0.25);
    g.add(saddle);

    return g;
  },

  buildPinisiModel(accentColor) {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.5, metalness: 0.1 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.4, metalness: 0.2 });

    // Streamlined wooden hull
    const hullGeo = new THREE.CylinderGeometry(0.22, 0.1, 1.1, 16);
    const hull = new THREE.Mesh(hullGeo, woodMat);
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(0.65, 1, 1);
    hull.position.set(0, 0.18, 0);
    hull.castShadow = true;
    g.add(hull);

    // Pointed bow
    const bowGeo = new THREE.ConeGeometry(0.18, 0.45, 16);
    const bow = new THREE.Mesh(bowGeo, woodMat);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.18, 0.65);
    g.add(bow);

    // Main Mast (Tiang Agung)
    const mastGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.95, 8);
    const mast1 = new THREE.Mesh(mastGeo, mastMat);
    mast1.position.set(0, 0.65, 0.1);
    g.add(mast1);

    // Fore Mast (Tiang Depan)
    const mast2 = new THREE.Mesh(mastGeo, mastMat);
    mast2.scale.set(0.85, 0.85, 0.85);
    mast2.position.set(0, 0.58, 0.38);
    g.add(mast2);

    // Billowing Pinisi Sails (Trapezoidal / Triangular)
    const sailGeo = new THREE.PlaneGeometry(0.45, 0.55);
    const sail1 = new THREE.Mesh(sailGeo, sailMat);
    sail1.position.set(0, 0.68, 0.05);
    sail1.rotation.y = Math.PI / 12;
    sail1.castShadow = true;
    g.add(sail1);

    const sail2 = new THREE.Mesh(sailGeo, sailMat);
    sail2.scale.set(0.8, 0.8, 0.8);
    sail2.position.set(0, 0.6, 0.34);
    sail2.rotation.y = Math.PI / 10;
    sail2.castShadow = true;
    g.add(sail2);

    // Bowsprit pole
    const bowspritGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8);
    const bowsprit = new THREE.Mesh(bowspritGeo, mastMat);
    bowsprit.rotation.x = Math.PI / 3;
    bowsprit.position.set(0, 0.3, 0.9);
    g.add(bowsprit);

    return g;
  },

  buildBajajModel(accentColor) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.25, metalness: 0.35 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x99ccff, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.6 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0.1 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.1, metalness: 0.9 });

    // Lower cabin body
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.32, 0.75);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.28, 0);
    body.castShadow = true;
    g.add(body);

    // Rounded Front Nose
    const noseGeo = new THREE.CylinderGeometry(0.24, 0.27, 0.3, 16);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.28, 0.36);
    g.add(nose);

    // Upper cabin / roof
    const roofGeo = new THREE.BoxGeometry(0.52, 0.22, 0.65);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 0.5, -0.05);
    roof.castShadow = true;
    g.add(roof);

    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(0.42, 0.18);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 0.46, 0.28);
    windshield.rotation.x = -Math.PI / 10;
    g.add(windshield);

    // Chrome Headlight
    const lightGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const light = new THREE.Mesh(lightGeo, chromeMat);
    light.position.set(0, 0.32, 0.5);
    g.add(light);

    // 3 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
    const wFront = new THREE.Mesh(wheelGeo, rubberMat);
    wFront.rotation.z = Math.PI / 2;
    wFront.position.set(0, 0.12, 0.35);
    wFront.castShadow = true;
    g.add(wFront);

    const wRearL = new THREE.Mesh(wheelGeo, rubberMat);
    wRearL.rotation.z = Math.PI / 2;
    wRearL.position.set(-0.28, 0.12, -0.22);
    wRearL.castShadow = true;
    g.add(wRearL);

    const wRearR = wRearL.clone();
    wRearR.position.x = 0.28;
    g.add(wRearR);

    return g;
  },

  buildKomodoModel(accentColor) {
    const g = new THREE.Group();
    // Antique Bronze / Emerald Komodo Figurine
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x3d6e50,
      roughness: 0.35,
      metalness: 0.7
    });

    // Body / Torso
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.75, 12);
    const body = new THREE.Mesh(bodyGeo, bronzeMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(1, 1, 0.6);
    body.position.set(0, 0.22, 0);
    body.castShadow = true;
    g.add(body);

    // Neck & Head
    const headGeo = new THREE.ConeGeometry(0.13, 0.38, 8);
    const head = new THREE.Mesh(headGeo, bronzeMat);
    head.rotation.x = -Math.PI / 2.3;
    head.position.set(0, 0.28, 0.48);
    head.castShadow = true;
    g.add(head);

    // Long Sinuous Tail
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.14, 0.75, 8);
    const tail = new THREE.Mesh(tailGeo, bronzeMat);
    tail.rotation.x = Math.PI / 2.2;
    tail.rotation.y = Math.PI / 8;
    tail.position.set(-0.06, 0.18, -0.65);
    tail.castShadow = true;
    g.add(tail);

    // 4 Splayed Legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
    const l1 = new THREE.Mesh(legGeo, bronzeMat);
    l1.position.set(-0.24, 0.14, 0.22);
    l1.rotation.z = Math.PI / 6;
    l1.castShadow = true;
    g.add(l1);

    const l2 = l1.clone();
    l2.position.set(0.24, 0.14, 0.22);
    l2.rotation.z = -Math.PI / 6;
    g.add(l2);

    const l3 = l1.clone();
    l3.position.set(-0.24, 0.14, -0.2);
    g.add(l3);

    const l4 = l2.clone();
    l4.position.set(0.24, 0.14, -0.2);
    g.add(l4);

    return g;
  },

  /* ========================================================
     3D Buildings: Houses & Hotels
     ======================================================== */
  createHouseMesh() {
    const g = new THREE.Group();
    // Emerald Green House
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.3, metalness: 0.2 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.4, metalness: 0.1 });
    const detailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });

    // House walls
    const wallGeo = new THREE.BoxGeometry(0.28, 0.22, 0.28);
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = 0.11;
    walls.castShadow = true;
    g.add(walls);

    // Pitched Roof
    const roofGeo = new THREE.ConeGeometry(0.24, 0.18, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.3;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // White Chimney
    const chimneyGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
    const chimney = new THREE.Mesh(chimneyGeo, detailMat);
    chimney.position.set(0.08, 0.32, 0.05);
    g.add(chimney);

    return g;
  },

  createHotelMesh() {
    const g = new THREE.Group();
    // Ruby Red Luxury Hotel Tower
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.25, metalness: 0.3 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.1, metalness: 0.5 });

    // Hotel main tower
    const towerGeo = new THREE.BoxGeometry(0.48, 0.52, 0.36);
    const tower = new THREE.Mesh(towerGeo, wallMat);
    tower.position.y = 0.26;
    tower.castShadow = true;
    g.add(tower);

    // Penthouse Roof
    const roofGeo = new THREE.BoxGeometry(0.42, 0.1, 0.3);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.56;
    roof.castShadow = true;
    g.add(roof);

    // Golden Spire
    const spireGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.22, 8);
    const spire = new THREE.Mesh(spireGeo, roofMat);
    spire.position.y = 0.7;
    g.add(spire);

    return g;
  },

  updateBuildings(boardState) {
    if (!boardState) return;

    // Remove existing building meshes
    while (this.buildingsGroup.children.length > 0) {
      this.buildingsGroup.remove(this.buildingsGroup.children[0]);
    }
    this.buildingMeshes.clear();

    for (const [id, state] of Object.entries(boardState)) {
      const tileIndex = parseInt(id);
      const coord = this.tileCoords[tileIndex];
      if (!coord) continue;

      const group = new THREE.Group();
      group.position.set(coord.x, this.boardThickness / 2 + 0.06, coord.z);
      group.rotation.y = coord.rot;

      if (state.hotel) {
        const hotel = this.createHotelMesh();
        hotel.position.set(0, 0, coord.isCorner ? 0 : -coord.depth * 0.25);
        group.add(hotel);
      } else if (state.houses > 0) {
        // Place up to 4 houses along the top color band of the tile
        const houseCount = state.houses;
        const spacing = (coord.width * 0.8) / 4;
        const startX = -((houseCount - 1) * spacing) / 2;

        for (let h = 0; h < houseCount; h++) {
          const house = this.createHouseMesh();
          house.position.set(startX + h * spacing, 0, coord.isCorner ? 0 : -coord.depth * 0.28);
          group.add(house);
        }
      }

      this.buildingsGroup.add(group);
      this.buildingMeshes.set(tileIndex, group);
    }
  },

  /* ========================================================
     3D Dice System with Physics-Style Roll Animation
     ======================================================== */
  initDice() {
    this.diceMeshes = [];
    while (this.diceGroup.children.length > 0) {
      this.diceGroup.remove(this.diceGroup.children[0]);
    }

    const d1 = this.createSingleDie();
    const d2 = this.createSingleDie();

    d1.position.set(-1.2, this.boardThickness / 2 + 0.35, 0);
    d2.position.set(1.2, this.boardThickness / 2 + 0.35, 0);

    this.diceGroup.add(d1);
    this.diceGroup.add(d2);
    this.diceMeshes = [d1, d2];
  },

  createSingleDie() {
    const size = 0.7;
    const geo = new THREE.BoxGeometry(size, size, size);

    // 6 textures for 6 faces
    const materials = [];
    for (let face = 1; face <= 6; face++) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      // Rounded ivory background
      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#d0cbc4';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 122, 122);

      // Draw pips (dots)
      ctx.fillStyle = face === 1 ? '#e74c3c' : '#1a1a1a'; // 1 pip is red (classic Indonesian/Asian dice)
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

      const tex = new THREE.CanvasTexture(canvas);
      materials.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1 }));
    }

    // Mapping Three.js BoxGeometry face index to dice value:
    // 0: +X, 1: -X, 2: +Y (Top), 3: -Y (Bottom), 4: +Z, 5: -Z
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  rollDice3D(d1Val, d2Val, callback) {
    if (this.diceMeshes.length < 2) return;
    const [die1, die2] = this.diceMeshes;

    const startY = 3.5;
    const endY = this.boardThickness / 2 + 0.35;
    const duration = 1200; // ms
    const startTime = performance.now();

    // Map face value to rotation where that face is pointing +Y (UP)
    const getFaceRotation = (val) => {
      // BoxGeometry faces: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
      switch (val) {
        case 1: return { x: 0, z: Math.PI / 2 };        // face 0 (+X) pointing up
        case 2: return { x: 0, z: -Math.PI / 2 };       // face 1 (-X) pointing up
        case 3: return { x: 0, z: 0 };                  // face 2 (+Y) pointing up
        case 4: return { x: Math.PI, z: 0 };            // face 3 (-Y) pointing up
        case 5: return { x: -Math.PI / 2, z: 0 };       // face 4 (+Z) pointing up
        case 6: return { x: Math.PI / 2, z: 0 };        // face 5 (-Z) pointing up
        default: return { x: 0, z: 0 };
      }
    };

    const targetRot1 = getFaceRotation(d1Val);
    const targetRot2 = getFaceRotation(d2Val);

    // Random initial tumble spin velocities
    const spins1 = { x: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 4) * Math.PI, y: Math.PI * 4, z: Math.PI * 4 };
    const spins2 = { x: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 4) * Math.PI, y: -Math.PI * 4, z: -Math.PI * 4 };

    // Dynamic light pulse in dice area
    if (this.spotLight) {
      this.spotLight.intensity = 1.8;
      setTimeout(() => { if (this.spotLight) this.spotLight.intensity = 0.8; }, 1500);
    }

    const animateRoll = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Parabolic drop with bounces
      const bounceHeight = Math.sin(progress * Math.PI * 3.5) * (1 - progress) * 1.5;
      const currentY = THREE.MathUtils.lerp(startY, endY, easeOut) + Math.max(0, bounceHeight);

      die1.position.y = currentY;
      die2.position.y = currentY;

      // Rotating
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
        // Settle exact rotations
        die1.position.y = endY;
        die2.position.y = endY;
        die1.rotation.set(targetRot1.x, 0, targetRot1.z);
        die2.rotation.set(targetRot2.x, 0, targetRot2.z);

        if (d1Val === d2Val) {
          // Double effect: burst of sparkles
          this.spawnDoubleBurst();
        }

        if (callback) callback();
      }
    };

    requestAnimationFrame(animateRoll);
  },

  spawnDoubleBurst() {
    const burstGeo = new THREE.RingGeometry(0.2, 1.8, 32);
    const burstMat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const burst = new THREE.Mesh(burstGeo, burstMat);
    burst.rotation.x = -Math.PI / 2;
    burst.position.set(0, this.boardThickness / 2 + 0.38, 0);
    this.effectsGroup.add(burst);

    let scale = 1;
    const fadeBurst = () => {
      scale += 0.08;
      burst.scale.set(scale, scale, scale);
      burstMat.opacity -= 0.04;
      if (burstMat.opacity > 0) {
        requestAnimationFrame(fadeBurst);
      } else {
        this.effectsGroup.remove(burst);
      }
    };
    fadeBurst();
  },

  /* ========================================================
     Player Tokens: Hop Movement & Dynamic Updates
     ======================================================== */
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

      // Position on tile
      const coord = this.tileCoords[p.position];
      if (coord) {
        // Offset slightly if multiple players share the tile
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
      { x: -0.35, z: -0.35 },
      { x: 0.35, z: -0.35 },
      { x: -0.35, z: 0.35 },
      { x: 0.35, z: 0.35 }
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

      // Calculate path sequence
      const steps = [];
      let pos = fromPos;
      while (pos !== toPos) {
        pos = (pos + 1) % 40;
        steps.push(pos);
      }

      if (steps.length === 0) {
        resolve();
        return;
      }

      let stepIdx = 0;
      const hopDuration = 180; // ms per tile hop

      const hopNextTile = () => {
        if (stepIdx >= steps.length) {
          resolve();
          return;
        }

        const targetTile = steps[stepIdx];
        const nextCoord = this.tileCoords[targetTile];
        const prevPos = pData.mesh.position.clone();
        const nextPos = new THREE.Vector3(nextCoord.x, this.boardThickness / 2 + 0.05, nextCoord.z);
        const startTime = performance.now();

        // Rotate token towards travel direction
        const dir = nextPos.clone().sub(prevPos);
        if (dir.lengthSq() > 0.001) {
          const angle = Math.atan2(dir.x, dir.z);
          pData.mesh.rotation.y = angle;
        }

        const animateHop = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / hopDuration, 1);

          // Parabolic jump arc
          const hopHeight = Math.sin(t * Math.PI) * 1.1;
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
            setTimeout(hopNextTile, 40);
          }
        };

        requestAnimationFrame(animateHop);
      };

      hopNextTile();
    });
  },

  /* ========================================================
     Camera View Presets & Controls
     ======================================================== */
  setCameraView(mode) {
    if (!this.controls) return;
    this.cameraAnimating = true;

    switch (mode) {
      case '3d': // Default angled luxury 3D view
        this.cameraPosTarget.set(0, 18, 22);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'top': // Overhead top-down 2D/3D board view
        this.cameraPosTarget.set(0, 27, 0.1);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'corner': // Dramatic corner view
        this.cameraPosTarget.set(16, 14, 16);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'focus': // Focus on current player token
        if (window.gameState) {
          const curr = window.gameState.players.find(p => p.id === window.gameState.currentPlayerId);
          if (curr && this.tileCoords[curr.position]) {
            const c = this.tileCoords[curr.position];
            this.cameraPosTarget.set(c.x * 1.2, 10, c.z * 1.2 + 8);
            this.cameraTarget.set(c.x, 0, c.z);
          }
        }
        break;
    }
  },

  toggleLighting() {
    this.isNightMode = !this.isNightMode;
    if (this.isNightMode) {
      this.scene.background.set(0x0c0f1d);
      this.ambientLight.color.set(0xffeedd);
      this.ambientLight.intensity = 0.6;
      this.dirLight.intensity = 1.3;
    } else {
      // Warm bright day
      this.scene.background.set(0x1a2536);
      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 0.85;
      this.dirLight.intensity = 1.6;
    }
  },

  /* ========================================================
     Interactive Mouse Raycasting & Tile Selection
     ======================================================== */
  setupEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleHover();
    });

    dom.addEventListener('click', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleClick();
    });

    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
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
      this.container.style.cursor = 'default';
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

    // Call existing 2D game showTileInfo to populate right panel!
    if (typeof showTileInfo === 'function') {
      showTileInfo(index);
    }
  },

  /* ========================================================
     Animation Loop
     ======================================================== */
  animate() {
    requestAnimationFrame(this.animate);

    // Smooth camera transition if active
    if (this.cameraAnimating && this.controls) {
      this.camera.position.lerp(this.cameraPosTarget, 0.08);
      this.controls.target.lerp(this.cameraTarget, 0.08);

      if (this.camera.position.distanceTo(this.cameraPosTarget) < 0.1) {
        this.cameraAnimating = false;
      }
    }

    if (this.controls) {
      this.controls.update();
    }

    // Gentle idle animation for player tokens (subtle hovering)
    const time = performance.now() * 0.003;
    for (const [, pData] of this.playerTokens) {
      if (pData && pData.mesh) {
        // Keep base on board, rock slightly
        pData.mesh.rotation.z = Math.sin(time + pData.currentPosIndex) * 0.03;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
};

