(() => {
  "use strict";

  const THREE = window.THREE;
  if (!THREE) {
    console.error("Three.js did not load; the 3D renderer is unavailable.");
    return;
  }

  function create(canvas, route, buildings) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    const mobile = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x849197, 850, 2600);
    const camera = new THREE.PerspectiveCamera(67, 1, .1, 4200);
    const hemi = new THREE.HemisphereLight(0xc8e7ff, 0x384437, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdfbf, 1.8);
    sun.position.set(-600, 1100, -250);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    scene.add(sun);
    scene.add(sun.target);

    scene.add(camera);
    const cockpit = new THREE.Group();
    camera.add(cockpit);
    const cockpitPaint = new THREE.MeshToonMaterial({ color: 0xdb71aa, emissive: 0x321427 });
    const dashboardMaterial = new THREE.MeshToonMaterial({ color: 0x17202b });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(5, .35, 3.5), cockpitPaint);
    hood.position.set(0, -6.5, -19);
    cockpit.add(hood);
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(5, .45, 1.1), dashboardMaterial);
    dashboard.position.set(0, -1.8, -3.5);
    cockpit.add(dashboard);
    const steeringWheel = new THREE.Mesh(
      new THREE.TorusGeometry(.42, .075, 8, 24),
      new THREE.MeshToonMaterial({ color: 0x263645 })
    );
    steeringWheel.position.set(0, -1.55, -3.3);
    steeringWheel.rotation.x = .18;
    cockpit.add(steeringWheel);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(3900, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: "varying vec3 vNormal; void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: "varying vec3 vNormal; void main(){float h=max(normalize(vNormal).y,0.0);vec3 low=vec3(0.82,0.47,0.46);vec3 high=vec3(0.08,0.13,0.24);gl_FragColor=vec4(mix(low,high,smoothstep(0.0,0.8,h)),1.0);}"
      })
    );
    scene.add(sky);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 4200), new THREE.MeshToonMaterial({ color: 0x577866 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1200, -.5, 900);
    ground.receiveShadow = true;
    scene.add(ground);
    const roadMaterial = new THREE.MeshToonMaterial({ color: 0x414c5a, side: THREE.DoubleSide });
    const curbMaterial = new THREE.MeshToonMaterial({ color: 0xe9c9ad, side: THREE.DoubleSide });
    const addRibbon = (inner, outer, material, y) => {
      const positions = [], indices = [], count = 320;
      for (let i = 0; i <= count; i++) {
        const t = i / count * route.length;
        const p = routePoint(t), before = routePoint(t - .002), after = routePoint(t + .002);
        const angle = Math.atan2(after.y - before.y, after.x - before.x);
        const nx = -Math.sin(angle), nz = Math.cos(angle);
        positions.push(p.x + nx * inner, y, p.y + nz * inner);
        positions.push(p.x + nx * outer, y, p.y + nz * outer);
      }
      for (let i = 0; i < count; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    addRibbon(-137, 137, roadMaterial, .08);
    addRibbon(137, 146, curbMaterial, .12);
    addRibbon(-146, -137, curbMaterial, .12);

    const dashMaterial = new THREE.MeshToonMaterial({ color: 0xe6e5dc, emissive: 0x32322a });
    for (let i = 0; i < 80; i++) {
      if (i < 3 || i % 3 === 1) continue;
      const t = i / 80 * route.length;
      const point = routePoint(t), next = routePoint(t + .006);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(5, .2, 31), dashMaterial);
      mark.position.set(point.x, .28, point.y);
      mark.rotation.y = Math.PI / 2 - Math.atan2(next.y - point.y, next.x - point.x);
      scene.add(mark);
    }

    const flowerColors = [0xff77c5, 0xf6df72, 0xa39aff, 0xffaa73, 0xf0f0d7];
    const flowerMaterials = flowerColors.map(color => new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: .16 }));
    const stemMaterial = new THREE.MeshToonMaterial({ color: 0x9aca83 });
    const flowerGeo = new THREE.SphereGeometry(1, 7, 5);
    const stemGeo = new THREE.CylinderGeometry(.13, .18, 5, 5);
    const flowerInstances = flowerMaterials.map(material => {
      const mesh = new THREE.InstancedMesh(flowerGeo, material, 2800);
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    });
    const stemInstances = new THREE.InstancedMesh(stemGeo, stemMaterial, 600);
    const heartInstances = new THREE.InstancedMesh(flowerGeo, new THREE.MeshToonMaterial({ color: 0xffed9a }), 600);
    stemInstances.count = 0;
    heartInstances.count = 0;
    scene.add(stemInstances, heartInstances);
    const flowerTransform = new THREE.Object3D();
    function plantFlower(x, z, size, colorIndex) {
      flowerTransform.position.set(x, 2.5 * size, z);
      flowerTransform.rotation.set(0, 0, 0);
      flowerTransform.scale.setScalar(size);
      flowerTransform.updateMatrix();
      stemInstances.setMatrixAt(stemInstances.count++, flowerTransform.matrix);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        flowerTransform.position.set(x + Math.cos(angle) * 1.25 * size, 5.3 * size, z + Math.sin(angle) * 1.25 * size);
        flowerTransform.scale.set(.9 * size, .45 * size, .68 * size);
        flowerTransform.updateMatrix();
        const instances = flowerInstances[((colorIndex % flowerMaterials.length) + flowerMaterials.length) % flowerMaterials.length];
        instances.setMatrixAt(instances.count++, flowerTransform.matrix);
      }
      flowerTransform.position.set(x, 5.35 * size, z);
      flowerTransform.scale.set(.48 * size, .4 * size, .48 * size);
      flowerTransform.updateMatrix();
      heartInstances.setMatrixAt(heartInstances.count++, flowerTransform.matrix);
    }

    const buildingMaterials = [
      0x6d8294, 0x6f897d, 0x82788d, 0x9a8b76, 0x587d8d
    ].map(color => new THREE.MeshToonMaterial({ color }));
    const roofMaterials = [0x273c4d, 0x304647, 0x433849].map(color => new THREE.MeshToonMaterial({ color }));
    const windowMaterials = [
      new THREE.MeshToonMaterial({ color: 0x9cf2df, emissive: 0x4ab79d, emissiveIntensity: .9 }),
      new THREE.MeshToonMaterial({ color: 0xffd18c, emissive: 0xb47c37, emissiveIntensity: .85 })
    ];
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x263747, transparent: true, opacity: .8 });
    const addOutline = (parent, mesh) => {
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), outlineMaterial);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      outline.scale.copy(mesh.scale);
      parent.add(outline);
    };
    const windowGeo = new THREE.BoxGeometry(4.5, 7, .8);
    const windowInstances = windowMaterials.map(material => {
      const mesh = new THREE.InstancedMesh(windowGeo, material, 2400);
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    });
    const windowTransform = new THREE.Object3D();
    const isCloseToRoad = (x, z, radius) => {
      for (let i = 0; i < route.length * 24; i++) {
        const point = routePoint(i / 24);
        if (Math.hypot(point.x - x, point.y - z) < radius) return true;
      }
      return false;
    };
    buildings.forEach((building, index) => {
      const x = building.x + building.w / 2, z = building.y + building.h / 2;
      if (isCloseToRoad(x, z, Math.max(building.w, building.h) * .46 + 142)) return;
      const height = 48 + (building.seed % 61);
      const body = new THREE.Mesh(new THREE.BoxGeometry(building.w, height, building.h), buildingMaterials[index % buildingMaterials.length]);
      body.position.set(x, height / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      scene.add(body);
      addOutline(scene, body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(building.w + 8, 4, building.h + 8), roofMaterials[index % roofMaterials.length]);
      roof.position.set(x, height + 2, z);
      roof.castShadow = true;
      scene.add(roof);
      addOutline(scene, roof);

      const rows = Math.max(2, Math.floor(height / 16));
      for (let row = 0; row < rows; row++) {
        const wy = 8 + row * 15;
        for (let col = 0; col < 3; col++) {
          const wx = x - building.w * .28 + col * building.w * .28;
          const frontIndex = (row + col + index) % 4 === 0 ? 1 : 0;
          windowTransform.position.set(wx, wy, z + building.h / 2 + .5);
          windowTransform.rotation.set(0, 0, 0);
          windowTransform.updateMatrix();
          windowInstances[frontIndex].setMatrixAt(windowInstances[frontIndex].count++, windowTransform.matrix);
          const sideIndex = (row + col + index) % 5 === 0 ? 1 : 0;
          windowTransform.position.set(x + building.w / 2 + .5, wy, z - building.h * .24 + col * building.h * .24);
          windowTransform.rotation.y = Math.PI / 2;
          windowTransform.updateMatrix();
          windowInstances[sideIndex].setMatrixAt(windowInstances[sideIndex].count++, windowTransform.matrix);
        }
      }

      for (let i = 0; i < 3; i++) {
        plantFlower(building.x + 18 + i * (building.w - 36) / 2, building.y + building.h + 14, .8 + (i % 2) * .2, index + i);
        plantFlower(building.x + 18 + i * (building.w - 36) / 2, building.y - 14, .75, index + i + 2);
      }
      if (index % 4 === 0) {
        const signCanvas = document.createElement("canvas");
        signCanvas.width = 512; signCanvas.height = 144;
        const signContext = signCanvas.getContext("2d");
        signContext.fillStyle = "#182536";
        signContext.fillRect(0, 0, 512, 144);
        signContext.strokeStyle = "#6cf4db";
        signContext.lineWidth = 8;
        signContext.strokeRect(6, 6, 500, 132);
        signContext.fillStyle = index % 8 ? "#ff9bd0" : "#7ff8e0";
        signContext.font = "800 54px sans-serif";
        signContext.textAlign = "center"; signContext.textBaseline = "middle";
        signContext.fillText(["BLOOM CLUB", "NOVA", "PETAL LAB", "SKYGARDEN"][index % 4], 256, 72);
        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide }));
        sign.position.set(x, height * .58, z + building.h / 2 + 1);
        scene.add(sign);
      }

    });
    for (let i = 0; i < route.length * 2; i++) {
      const t = i / 2, point = routePoint(t);
      const before = routePoint(t - .01), after = routePoint(t + .01);
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const side = i % 2 ? 1 : -1;
      const offset = 220 + (i % 3) * 32;
      const width = 94 + (i % 3) * 14, depth = 82 + (i % 4) * 13;
      const height = 72 + (i * 19) % 70;
      const tower = new THREE.Group();
      tower.position.set(point.x - Math.sin(angle) * offset * side, 0, point.y + Math.cos(angle) * offset * side);
      tower.rotation.y = -angle;
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterials[(i + 2) % buildingMaterials.length]);
      body.position.y = height / 2;
      body.castShadow = true; body.receiveShadow = true;
      tower.add(body); addOutline(tower, body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 8, 4, depth + 8), roofMaterials[i % roofMaterials.length]);
      roof.position.y = height + 2;
      tower.add(roof); addOutline(tower, roof);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const window = new THREE.Mesh(windowGeo, windowMaterials[(row + col + i) % 4 === 0 ? 1 : 0]);
          window.position.set(-width * .3 + col * width * .3, 13 + row * 14, -side * (depth / 2 + .6));
          window.rotation.y = side === 1 ? Math.PI : 0;
          tower.add(window);
        }
      }
      const adCanvas = document.createElement("canvas");
      adCanvas.width = 512; adCanvas.height = 144;
      const adContext = adCanvas.getContext("2d");
      adContext.fillStyle = "#182536"; adContext.fillRect(0, 0, 512, 144);
      adContext.strokeStyle = i % 2 ? "#ff83c8" : "#6cf4db"; adContext.lineWidth = 8; adContext.strokeRect(6, 6, 500, 132);
      adContext.fillStyle = "#f4fbff"; adContext.font = "800 49px sans-serif";
      adContext.textAlign = "center"; adContext.textBaseline = "middle";
      adContext.fillText(["NOVA", "ASTER", "BLOOM CLUB", "SKYGARDEN"][i % 4], 256, 72);
      const adTexture = new THREE.CanvasTexture(adCanvas);
      adTexture.colorSpace = THREE.SRGBColorSpace;
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(43, 12), new THREE.MeshBasicMaterial({ map: adTexture, side: THREE.DoubleSide }));
      ad.position.set(0, height * .58, -side * (depth / 2 + 1.2));
      ad.rotation.y = side === 1 ? Math.PI : 0;
      tower.add(ad);
      scene.add(tower);
      for (let flowerIndex = 0; flowerIndex < 3; flowerIndex++) {
        plantFlower(tower.position.x + Math.cos(angle) * (flowerIndex - 1) * 35, tower.position.z + Math.sin(angle) * (flowerIndex - 1) * 35, .9, i + flowerIndex);
      }
    }
    [...flowerInstances, stemInstances, heartInstances, ...windowInstances].forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });

    function addFlowerIsland(x, z) {
      const island = new THREE.Mesh(new THREE.CylinderGeometry(68, 74, 3, 32), new THREE.MeshToonMaterial({ color: 0x436d59 }));
      island.position.set(x, 1, z);
      island.receiveShadow = true;
      scene.add(island);
      for (let i = 0; i < 34; i++) {
        const a = i * 2.399, r = 9 + (i % 5) * 9;
        plantFlower(x + Math.cos(a) * r, z + Math.sin(a) * r, .8 + (i % 4) * .1, i);
      }
    }
    addFlowerIsland(1200, 900);

    const streetLampPole = new THREE.MeshToonMaterial({ color: 0x354858 });
    const streetLampColors = [
      new THREE.MeshBasicMaterial({ color: 0x72f4d8 }),
      new THREE.MeshBasicMaterial({ color: 0xff81c7 }),
      new THREE.MeshBasicMaterial({ color: 0xffd77e })
    ];
    for (let i = 0; i < route.length * 3; i++) {
      const t = i / 3, p = routePoint(t), before = routePoint(t - .01), after = routePoint(t + .01);
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const side = i % 2 ? 1 : -1;
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 33, 6), streetLampPole);
      pole.position.y = 16.5;
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 1.1), streetLampPole);
      arm.position.set(-side * 6, 32, 0);
      group.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), streetLampColors[i % streetLampColors.length]);
      bulb.position.set(-side * 12, 30, 0);
      group.add(bulb);
      group.position.set(p.x - Math.sin(angle) * 164 * side, 0, p.y + Math.cos(angle) * 164 * side);
      group.rotation.y = -angle;
      scene.add(group);
    }

    const garage = new THREE.Group();
    const archMat = new THREE.MeshToonMaterial({ color: 0x6ff5db, emissive: 0x2cccb7, emissiveIntensity: 1.6 });
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 36, 5), archMat);
    archLeft.position.set(0, 18, -155); garage.add(archLeft);
    const archRight = archLeft.clone(); archRight.position.z = 155; garage.add(archRight);
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 310), archMat);
    archTop.position.set(0, 37, 0); garage.add(archTop);
    garage.position.set(route[0].x, 0, route[0].y);
    scene.add(garage);

    const tireMaterial = new THREE.MeshToonMaterial({ color: 0x17202b });
    const glassMaterial = new THREE.MeshToonMaterial({ color: 0x90d7e5, emissive: 0x286279, emissiveIntensity: .25 });
    const blackMaterial = new THREE.MeshToonMaterial({ color: 0x273440 });
    const makeBadge = (name, model) => {
      const badge = document.createElement("canvas");
      badge.width = 256; badge.height = 96;
      const bctx = badge.getContext("2d");
      bctx.fillStyle = "#132431";
      bctx.fillRect(0, 0, badge.width, badge.height);
      bctx.fillStyle = "#f4fbff";
      bctx.font = "800 40px sans-serif";
      bctx.textAlign = "center"; bctx.textBaseline = "middle";
      bctx.fillText(name, 128, 34);
      bctx.fillStyle = "#6cf4db";
      bctx.font = "600 21px sans-serif";
      bctx.fillText(model, 128, 70);
      const texture = new THREE.CanvasTexture(badge);
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    };

    function createCar(name, model, color, police = false) {
      const group = new THREE.Group();
      const paint = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: .025,
        roughness: .28,
        metalness: .18,
        clearcoat: .8,
        clearcoatRoughness: .16
      });
      const rally = model.includes("Rally");
      const sedan = model.includes("RS") || police;
      const bodyLength = rally ? 27 : sedan ? 34 : 31;
      const bodyWidth = rally ? 15.5 : 14;
      const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLength, rally ? 5.7 : 5, bodyWidth), paint);
      body.position.y = 4;
      body.castShadow = true;
      group.add(body);
      addOutline(group, body);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(rally ? 9 : 12, 2.2, bodyWidth - .5), paint);
      hood.position.set(bodyLength * .27, 7, 0); hood.castShadow = true; group.add(hood); addOutline(group, hood);
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(sedan ? 8 : 6.5, 2, bodyWidth - 1), paint);
      trunk.position.set(-bodyLength * .34, 6.5, 0); group.add(trunk);
      const cabinLength = sedan ? 15 : rally ? 11 : 13;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLength, rally ? 6.4 : 5.7, bodyWidth - 3.5), glassMaterial);
      cabin.position.set(-1.7, rally ? 8.7 : 8.3, 0); cabin.castShadow = true; group.add(cabin); addOutline(group, cabin);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(sedan ? 11 : 9, 1.4, bodyWidth - 4.1), paint);
      roof.position.set(-1.8, rally ? 12.2 : 11.6, 0); roof.castShadow = true; group.add(roof); addOutline(group, roof);
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(rally ? 7 : 5, 1, bodyWidth + 1), blackMaterial);
      spoiler.position.set(-bodyLength * .46, 8, 0); group.add(spoiler);
      const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(bodyLength * .58, 1.1, .6), blackMaterial);
      sideSkirt.position.set(0, 2.8, bodyWidth * .5); group.add(sideSkirt);

      const wheelGeo = new THREE.CylinderGeometry(rally ? 3.8 : 3.2, rally ? 3.8 : 3.2, 2.3, 14);
      const wheels = [];
      for (const x of [-bodyLength * .31, bodyLength * .31]) {
        for (const z of [-(bodyWidth * .5 + .4), bodyWidth * .5 + .4]) {
          const wheel = new THREE.Mesh(wheelGeo, tireMaterial);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(x, 3.2, z);
          wheel.castShadow = true;
          group.add(wheel);
          wheels.push(wheel);
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(rally ? 1.9 : 1.7, rally ? 1.9 : 1.7, 2.4, 10), new THREE.MeshToonMaterial({ color: 0xa4b9c9, metalness: .5 }));
          rim.rotation.x = Math.PI / 2;
          rim.position.copy(wheel.position);
          group.add(rim);
          wheels.push(rim);
        }
      }

      const headlightMat = new THREE.MeshBasicMaterial({ color: 0xeaffd3 });
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xff526d, emissive: 0xff1839 });
      for (const side of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 3.2), headlightMat);
        head.position.set(15.8, 5.1, side * 4.5); group.add(head);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 3.2), tailMat);
        tail.position.set(-15.8, 5.4, side * 4.4); group.add(tail);
      }
      const grille = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.4, 5), blackMaterial);
      grille.position.set(15.9, 3.8, 0); group.add(grille);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), makeBadge(name, model));
      badge.position.set(-bodyLength * .5 - .2, 5.6, 0); badge.rotation.y = -Math.PI / 2; group.add(badge);
      const decal = new THREE.Mesh(new THREE.BoxGeometry(.4, 1, 9), new THREE.MeshToonMaterial({ color: 0xffd3ef, emissive: 0x53203f }));
      decal.position.set(-5, 4.8, bodyWidth * .5 + .1); group.add(decal);

      if (police) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 9), blackMaterial);
        bar.position.set(-2, 12.5, 0); group.add(bar);
        const red = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.7), new THREE.MeshBasicMaterial({ color: 0xff4068 }));
        red.position.set(-2, 13.4, -2.25); group.add(red);
        const blue = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.7), new THREE.MeshBasicMaterial({ color: 0x4d83ff }));
        blue.position.set(-2, 13.4, 2.25); group.add(blue);
      }
      group.userData = { name, model, police, wheels };
      return group;
    }

    const trafficSpecs = [
      { name: "NOVA", model: "Vesper GT", color: 0x70d7cf, progress: .25 },
      { name: "ASTER", model: "Luma RS", color: 0xf1ad72, progress: 2.55 },
      { name: "SOLARA", model: "Pico Rally", color: 0x9e91ff, progress: 5.1 }
    ];
    const traffic = trafficSpecs.map(spec => {
      const vehicle = createCar(spec.name, spec.model, spec.color);
      scene.add(vehicle);
      return { vehicle, ...spec };
    });
    const policeCars = [];
    const pickupMeshes = [];
    let pickupSignature = "";
    let pickupGlow = [];

    function syncPickups(pickups) {
      const signature = pickups.map(p => `${p.type}:${p.x}:${p.y}`).join("|");
      if (signature === pickupSignature) return;
      pickupSignature = signature;
      pickupMeshes.forEach(mesh => scene.remove(mesh));
      pickupGlow.forEach(mesh => scene.remove(mesh));
      pickupMeshes.length = 0; pickupGlow.length = 0;
      pickups.forEach(pickup => {
        const group = new THREE.Group();
        const color = pickup.type === "core" ? 0xff79c5 : pickup.type === "boost" ? 0x72f4d8 : 0xb7a3ff;
        const material = new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 1.1 });
        const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), material);
        group.add(petal);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7, .8, 6, 18), material);
        ring.rotation.x = Math.PI / 2; group.add(ring);
        group.position.set(pickup.x, 11, pickup.y);
        group.userData = { pickup };
        scene.add(group);
        pickupMeshes.push(group);
      });
    }

    function addStreetFlowers() {
      for (let i = 0; i < route.length * 8; i++) {
        const t = i / 8;
        const p = routePoint(t), before = routePoint(t - .01), after = routePoint(t + .01);
        const a = Math.atan2(after.y - before.y, after.x - before.x);
        const side = i % 2 ? 1 : -1;
        const offset = 155 + (i % 3) * 19;
        plantFlower(p.x + Math.sin(a) * offset * side, p.y - Math.cos(a) * offset * side, .7 + (i % 4) * .08, i);
      }
    }
    addStreetFlowers();

    function routePoint(t) {
      const i = ((Math.floor(t) % route.length) + route.length) % route.length;
      const p = t - Math.floor(t);
      const a = route[(i - 1 + route.length) % route.length], b = route[i];
      const c = route[(i + 1) % route.length], d = route[(i + 2) % route.length];
      const p2 = p * p, p3 = p2 * p;
      return {
        x: .5 * ((2 * b.x) + (-a.x + c.x) * p + (2*a.x - 5*b.x + 4*c.x - d.x) * p2 + (-a.x + 3*b.x - 3*c.x + d.x) * p3),
        y: .5 * ((2 * b.y) + (-a.y + c.y) * p + (2*a.y - 5*b.y + 4*c.y - d.y) * p2 + (-a.y + 3*b.y - 3*c.y + d.y) * p3)
      };
    }

    function render(state) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const { car, cops, pickups, elapsed } = state;
      const dx = Math.cos(car.angle), dz = Math.sin(car.angle);
      camera.position.set(car.x - dx * 3, 8.5, car.y - dz * 3);
      camera.lookAt(car.x + dx * 70, .5, car.y + dz * 70);
      camera.updateMatrixWorld();

      traffic.forEach(item => {
        const t = item.progress + elapsed * .018;
        const point = routePoint(t), next = routePoint(t + .008);
        item.vehicle.position.set(point.x, .2, point.y);
        item.vehicle.rotation.y = -Math.atan2(next.y - point.y, next.x - point.x);
        item.vehicle.userData.wheels.forEach((wheel, index) => {
          wheel.rotation.z = elapsed * 8 + index * Math.PI;
        });
      });
      while (policeCars.length < cops.length) {
        const group = createCar("VANTA", "Interceptor S", 0xf1f0eb, true);
        scene.add(group); policeCars.push(group);
      }
      while (policeCars.length > cops.length) scene.remove(policeCars.pop());
      cops.forEach((cop, i) => {
        const group = policeCars[i];
        group.position.set(cop.x, .22, cop.y);
        group.rotation.y = -cop.angle;
        group.userData.wheels.forEach((wheel, index) => {
          wheel.rotation.z = elapsed * 8 + index * Math.PI;
        });
        group.visible = cop.stunned <= 0 || Math.floor(elapsed * 12) % 2 === 0;
      });
      syncPickups(pickups);
      pickupMeshes.forEach(mesh => {
        const { pickup } = mesh.userData;
        mesh.visible = !pickup.got;
        mesh.rotation.y += .02;
        mesh.position.y = 12 + Math.sin(elapsed * 3 + pickup.x) * 2;
      });
      renderer.render(scene, camera);
    }

    return { render };
  }

  window.PetalRun3D = { create };
})();
